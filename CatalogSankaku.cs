using System.Text.Json;

namespace ArtCatalog;

internal sealed partial class CatalogService
{
    private readonly SankakuApi Sankaku = new(store);

    public Task LoginSankakuAsync(string login, string password, CancellationToken cancellationToken) =>
        Sankaku.LoginAsync(login, password, cancellationToken);
    public Task LogoutSankakuAsync(CancellationToken cancellationToken) => Sankaku.LogoutAsync(cancellationToken);

    private async Task<CatalogItem?> GetSankakuDetailAsync(string id, CancellationToken cancellationToken)
    {
        using var json = await Sankaku.PostAsync(id, cancellationToken);
        var item = MapSankaku(json.RootElement);
        if (item is null)
        {
            if (SankakuRestricted(json.RootElement)) throw new SankakuAccessException(
                store.GetSankakuSession().AccessToken.Length == 0);
            return null;
        }
        if (item.RequiresAuthentication) item.AccessMessage = new SankakuAccessException(
            store.GetSankakuSession().AccessToken.Length == 0).Message;
        // The post response may have all tag names but only five categorized tags.
        // Fetch categories to identify every character and credited participant.
        var tags = new List<JsonElement>();
        try
        {
            for (var page = 1; page <= 6; page++)
            {
                using var tagJson = await Sankaku.PostTagsAsync(id, page, cancellationToken);
                var root = tagJson.RootElement;
                var data = root.ValueKind == JsonValueKind.Object && root.TryGetProperty("data", out var entries)
                    ? entries : root;
                if (data.ValueKind != JsonValueKind.Array) break;
                tags.AddRange(data.EnumerateArray().Select(tag => tag.Clone()));
                if (data.GetArrayLength() < 100 || tags.Count >= (Number(root, "total") ?? int.MaxValue)) break;
            }
            if (tags.Count > 0)
            {
                var post = System.Text.Json.Nodes.JsonNode.Parse(json.RootElement.GetRawText())!;
                post["tags"] = JsonSerializer.SerializeToNode(tags);
                using var complete = JsonDocument.Parse(post.ToJsonString());
                item = MapSankaku(complete.RootElement) ?? item;
                if (item.RequiresAuthentication) item.AccessMessage = new SankakuAccessException(
                    store.GetSankakuSession().AccessToken.Length == 0).Message;
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or InvalidOperationException)
        { /* Supplemental tag metadata must not hide the available artwork. */ }
        return item;
    }

    private async Task<SourcePage> SearchSankakuAsync(string query, int page, string rating,
        string sort, CancellationToken cancellationToken)
    {
        using var json = await Sankaku.PostsAsync(query, page, rating, sort, cancellationToken);
        var posts = json.RootElement;
        if (posts.ValueKind == JsonValueKind.Object && posts.TryGetProperty("data", out var data)) posts = data;
        if (posts.ValueKind != JsonValueKind.Array)
            throw new InvalidOperationException("Sankaku не вернул список работ. Проверьте теги.");
        var items = new List<CatalogItem>();
        var locked = 0;
        var unavailable = 0;
        var filtered = 0;
        foreach (var post in posts.EnumerateArray())
        {
            var item = MapSankaku(post);
            if (SankakuRestricted(post)) locked++;
            if (item is null) { unavailable++; continue; }
            if (!RatingMatches(item, rating)) { filtered++; continue; }
            items.Add(item);
        }
        var notice = locked == 0 ? null : new SankakuAccessException(
            store.GetSankakuSession().AccessToken.Length == 0).Message;
        // Sankaku can omit posts from a page according to the account's access and
        // filters. A short nonempty response does not mean the next page is empty.
        // Locked-only pages cannot make progress without another account's access.
        return new(items, posts.GetArrayLength() > 0 && (items.Any(item => !item.RequiresAuthentication) || locked == 0),
            posts.GetArrayLength(), unavailable, filtered, notice);
    }

    private async Task<List<(string Name, int Count)>> GetSankakuTagsAsync(string query,
        CancellationToken cancellationToken)
    {
        using var json = await Sankaku.TagsAsync(query, cancellationToken);
        var root = json.RootElement;
        if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("data", out var data)) root = data;
        if (root.ValueKind != JsonValueKind.Array) return [];
        return root.EnumerateArray().Select(tag =>
            (Name: SankakuTagName(tag), Count: Number(tag, "post_count") ?? Number(tag, "count") ?? 0))
            .Where(tag => tag.Name.Length > 0).ToList();
    }

    private static string SankakuTagName(JsonElement tag) =>
        (String(tag, "tagName") is { Length: > 0 } name ? name :
            String(tag, "name_en") is { Length: > 0 } english ? english : String(tag, "name"))
        .Trim().ToLowerInvariant().Replace(' ', '_');

    internal static bool SankakuMediaHost(string host) => host.Equals("sankakucomplex.com",
        StringComparison.OrdinalIgnoreCase) || host.EndsWith(".sankakucomplex.com", StringComparison.OrdinalIgnoreCase);

    private static bool SankakuRestricted(JsonElement post) =>
        !ValidImageUrl(String(post, "file_url")) && !ValidImageUrl(String(post, "sample_url")) &&
            (String(post, "redirect_to_signup") == "True" || String(post, "is_premium") == "True" ||
             ValidImageUrl(String(post, "preview_url")) || String(post, "status") == "active");

    internal static CatalogItem? MapSankaku(JsonElement post)
    {
        var id = String(post, "id");
        if (!SankakuApi.ValidId(id)) return null;
        var file = String(post, "file_url");
        var sample = String(post, "sample_url");
        var preview = String(post, "preview_url");
        if (!ValidImageUrl(preview)) preview = ValidImageUrl(sample) ? sample : ValidImageUrl(file) ? file : "";
        if (preview.Length == 0) return null;
        var full = ValidVideoFileUrl(file) ? file : ValidImageUrl(sample) ? sample : ValidImageUrl(file) ? file : "";
        var tags = new List<string>();
        var artists = new List<string>();
        var characters = new List<string>();
        var copyrights = new List<string>();
        if (post.TryGetProperty("tags", out var tagArray) && tagArray.ValueKind == JsonValueKind.Array)
            foreach (var tag in tagArray.EnumerateArray())
            {
                var name = SankakuTagName(tag);
                if (name.Length == 0) continue;
                tags.Add(name);
                switch (Number(tag, "type"))
                {
                    case 1: artists.Add(name); break;
                    case 3: copyrights.Add(name); break;
                    case 4 when name is not ("original_character" or "character_request"):
                        characters.Add(name); break;
                }
            }
        if (post.TryGetProperty("tag_names", out var names) && names.ValueKind == JsonValueKind.Array)
            tags.AddRange(names.EnumerateArray().Where(tag => tag.ValueKind == JsonValueKind.String)
                .Select(tag => (tag.GetString() ?? "").ToLowerInvariant().Replace(' ', '_')));
        tags = tags.Where(tag => tag.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var author = post.TryGetProperty("author", out var uploaded) ? uploaded : default;
        var uploaderName = String(author, "name");
        var uploaderId = String(author, "id");
        var published = "";
        if (post.TryGetProperty("created_at", out var created))
        {
            if (created.ValueKind == JsonValueKind.Object && created.TryGetProperty("s", out var seconds) &&
                seconds.TryGetInt64(out var epoch) && epoch is >= -62135596800 and <= 253402300799)
                published = DateTimeOffset.FromUnixTimeSeconds(epoch).ToString("O");
            else if (created.ValueKind == JsonValueKind.String) published = NormalizeDate(created.GetString() ?? "");
        }
        var original = OriginalSourceUrl(String(post, "source"));
        var pixiv = PixivGroupKey(original);
        var parent = String(post, "parent_id");
        var related = characters.FirstOrDefault() ?? copyrights.FirstOrDefault() ?? PickRelatedTag(tags);
        var item = new CatalogItem
        {
            Source = "sankaku", Id = id, Key = "sankaku:" + id,
            Title = characters.Count > 0 ? string.Join(", ", characters.Select(tag => tag.Replace('_', ' '))) : "Работа #" + id,
            Artist = uploaderName, ArtistId = uploaderName,
            UploaderName = uploaderName, UploaderId = uploaderName.Length > 0 ? uploaderName : uploaderId,
            Thumbnail = preview, Images = full.Length > 0 ? [full] : [],
            SourceUrl = "https://sankaku.app/posts/" + id, OriginalUrl = original,
            OriginalImageFileUrl = file, ContentHash = String(post, "md5"), PixivGroupKey = pixiv,
            GroupKey = parent != "0" && SankakuApi.ValidId(parent) ? "sankaku:parent:" + parent :
                String(post, "has_children") == "True" ? "sankaku:parent:" + id : pixiv,
            Published = published, PopularityCount = Number(post, "total_score") ?? Number(post, "fav_count"),
            Rating = String(post, "rating") == "s" ? "g" : String(post, "rating"),
            Tags = tags, CharacterTags = characters.Distinct().ToList(),
            CopyrightTags = copyrights.Distinct().ToList(), RelatedQuery = related,
            RequiresAuthentication = full.Length == 0,
            AccessMessage = full.Length == 0 ? "Для просмотра этой работы авторизуйтесь в Sankaku." : ""
        };
        CatalogCredits.Apply(item, artists);
        return item;
    }
}
