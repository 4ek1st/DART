using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Collections.Concurrent;
using System.Xml.Linq;
using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http;

namespace ArtCatalog;

public sealed class CatalogItem
{
    public string Key { get; set; } = "";
    public string Source { get; set; } = "";
    public string Id { get; set; } = "";
    public List<string> MemberKeys { get; set; } = [];
    public string Title { get; set; } = "";
    public string Artist { get; set; } = "";
    public string ArtistId { get; set; } = "";
    public string CreatorName { get; set; } = "";
    public string CreatorTag { get; set; } = "";
    public List<CatalogParticipant> Participants { get; set; } = [];
    public string UploaderName { get; set; } = "";
    public string UploaderId { get; set; } = "";
    public string OriginalUrl { get; set; } = "";
    public string RelatedQuery { get; set; } = "";
    public string GroupKey { get; set; } = "";
    public string PixivGroupKey { get; set; } = "";
    public string ContentHash { get; set; } = "";
    public string VisualHash { get; set; } = "";
    public List<CatalogVisualSample> VisualSamples { get; set; } = [];
    [JsonIgnore] public string OriginalImageFileUrl { get; set; } = "";
    [JsonIgnore] public bool Rule34TagInfoKnown { get; set; }
    public string Thumbnail { get; set; } = "";
    public string SourceUrl { get; set; } = "";
    public string Published { get; set; } = "";
    public int? PopularityCount { get; set; }
    public string Rating { get; set; } = "";
    public List<string> Images { get; set; } = [];
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<CatalogImageRecord>? ImageRecords { get; set; }
    public List<string> Tags { get; set; } = [];
    public List<string> AllTags { get; set; } = [];
    public List<string> CharacterTags { get; set; } = [];
    public List<string> CopyrightTags { get; set; } = [];
    public bool RequiresAuthentication { get; set; }
    public string AccessMessage { get; set; } = "";
}

public sealed class CatalogImageRecord
{
    public string Url { get; set; } = "";
    public string Hash { get; set; } = "";
}

public sealed class SearchResponse
{
    public List<CatalogItem> Items { get; set; } = [];
    public Dictionary<string, string> Errors { get; set; } = [];
    public Dictionary<string, string> Notices { get; set; } = [];
    public Dictionary<string, long> RetryAt { get; set; } = [];
    public List<string> HasMoreSources { get; set; } = [];
    public int Page { get; set; }
    public Dictionary<string, SearchSourceStats> SourceStats { get; set; } = [];
}

public sealed class SearchSourceStats
{
    public int Received { get; set; }
    public int Unavailable { get; set; }
    public int RatingFiltered { get; set; }
    public int TagFiltered { get; set; }
    public int Returned { get; set; }
}

public sealed class TagSuggestion
{
    public string Name { get; set; } = "";
    public int Count { get; set; }
    public List<string> Sources { get; set; } = [];
}

public sealed class ProfileResponse
{
    public string Name { get; set; } = "";
    public string Role { get; set; } = "";
    public string Source { get; set; } = "";
    public string Url { get; set; } = "";
    public List<CatalogItem> Items { get; set; } = [];
    public bool HasMore { get; set; }
    public int Page { get; set; }
    public Dictionary<string, string> Notices { get; set; } = [];
}

public sealed class CatalogVisualSample
{
    public string Hash { get; set; } = "";
    public string Owner { get; set; } = "";
    public List<string> Tags { get; set; } = [];
    public string Source { get; set; } = "";
    public List<string> Characters { get; set; } = [];
    public string Uploader { get; set; } = "";
    public string Published { get; set; } = "";
    public string Publication { get; set; } = "";
}

internal sealed partial class CatalogService(LocalStore store)
{
    // Keep offset multiplication safe; pagination ends according to each source.
    internal const int MaxSearchPage = int.MaxValue / 50 - 1;
    private sealed record SourcePage(List<CatalogItem> Items, bool HasMore,
        int? ReceivedCount = null, int UnavailableCount = 0, int RatingFilteredCount = 0,
        string? Notice = null);
    private static readonly HttpClient Api = CreateClient(allowRedirect: true);
    private static readonly Rule34RequestClient Rule34Api = new(Api);
    private static readonly Rule34RequestClient Rule34Web = new(Api);
    private static readonly HttpClient Images = CreateClient(allowRedirect: false);
    private static readonly string[] AllSources = CatalogState.Sources;
    private static readonly string[] ImageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];
    private static readonly string[] VideoExtensions = [".mp4", ".webm", ".m4v", ".ogv"];
    private readonly SemaphoreSlim apiGate = new(3, 3);
    private readonly SemaphoreSlim imageGate = new(4, 4);
    private readonly SemaphoreSlim videoGate = new(3, 3);
    private readonly ConcurrentDictionary<string, (DateTimeOffset Expires, SearchResponse Value)> searchCache = new();
    private readonly ConcurrentDictionary<string, (DateTimeOffset Expires, List<TagSuggestion> Value)> tagCache = new();
    private readonly ConcurrentDictionary<string, (DateTimeOffset Expires, bool IsArtist)> artistTagCache = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, (DateTimeOffset Expires, bool IsArtist)> rule34ArtistTagCache = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, string> mediaMd5Cache = new(StringComparer.Ordinal);
    private readonly SemaphoreSlim mediaMd5Gate = new(2, 2);
    private readonly SemaphoreSlim rule34TagGate = new(1, 1);
    private readonly ConcurrentDictionary<string, long> monthStartIds = new();
    private readonly ConcurrentDictionary<string, SemaphoreSlim> monthStartGates = new();

    public void ClearSearchCache()
    {
        searchCache.Clear();
        tagCache.Clear();
        Rule34Api.ClearCache();
        Rule34Web.ClearCache();
    }

    private static HttpClient CreateClient(bool allowRedirect)
    {
        var handler = new HttpClientHandler
        {
            AllowAutoRedirect = allowRedirect,
            AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate
        };
        var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(20) };
        client.DefaultRequestHeaders.UserAgent.ParseAdd("ArtCatalog/0.1 (Windows WebView2)");
        return client;
    }

    public async Task<SearchResponse> SearchAsync(string query, int page, string[] sources,
        string rating, string sort, string kind,
        CancellationToken cancellationToken, IReadOnlyDictionary<string, int>? sourcePages = null)
    {
        rating = rating is "explicit" or "all" ? rating : "general";
        sort = sort == "popular" ? "popular" : "recent";
        kind = "illustrations";
        query = CleanSearchQuery(query);
        var selected = sources.Length == 0
            ? AllSources
            : AllSources.Where(s => sources.Contains(s, StringComparer.OrdinalIgnoreCase)).ToArray();
        var requestedPages = selected.ToDictionary(source => source,
            source => sourcePages is not null && sourcePages.TryGetValue(source, out var custom)
                ? custom : page);
        var cacheKey = $"{query}\n{rating}\n{sort}\n{kind}\n" +
            string.Join(',', selected.Select(source => $"{source}:{requestedPages[source]}"));
        if (selected.Contains("sankaku"))
            cacheKey += "\n" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(
                store.GetSankakuSession().AccessToken)));
        if (searchCache.TryGetValue(cacheKey, out var cached) &&
            cached.Expires > DateTimeOffset.UtcNow) return cached.Value;
        var result = new SearchResponse { Page = page };
        var tasks = selected.Select(async source =>
        {
            try
            {
                var sharedGate = source != "rule34";
                if (sharedGate) await apiGate.WaitAsync(cancellationToken);
                SourcePage sourcePage;
                try
                {
                    sourcePage = source switch
                    {
                        "danbooru" => await SearchDanbooruAsync(query, requestedPages[source], rating, sort, cancellationToken),
                        "gelbooru" => await SearchGelbooruAsync(query, requestedPages[source], rating, sort, cancellationToken),
                        "rule34" => await SearchRule34Async(query, requestedPages[source], rating, sort, cancellationToken),
                        "sankaku" => await SearchSankakuAsync(query, requestedPages[source], rating, sort, cancellationToken),
                        _ => throw new InvalidOperationException("Источник не поддерживается.")
                    };
                }
                finally { if (sharedGate) apiGate.Release(); }
                return (Source: source, Page: sourcePage, Error: (string?)null);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException
                                       or JsonException or InvalidOperationException)
            {
                var message = FormatSourceError(ex, source);
                return (Source: source, Page: new SourcePage([], false), Error: (string?)message);
            }
        });
        var responses = await Task.WhenAll(tasks);
        try
        {
            await EnrichArtistTagsAsync(responses.SelectMany(response => response.Page.Items),
                cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or
                                       InvalidOperationException or System.Xml.XmlException)
        {
            // Attribution is supplementary. A tag API outage must not hide the artwork.
        }
        var buckets = new List<CatalogItem>[responses.Length];
        for (var responseIndex = 0; responseIndex < responses.Length; responseIndex++)
        {
            var response = responses[responseIndex];
            var received = response.Page.Items;
            // Some booru endpoints silently ignore unknown tags and return their
            // latest posts. Verify literal search terms against the returned tags.
            buckets[responseIndex] = query.Length == 0 || response.Source == "sankaku"
                ? received : received.Where(item => MatchesSearchTags(item, query)).ToList();
            if (response.Error is null)
                result.SourceStats[response.Source] = new SearchSourceStats
                {
                    Received = response.Page.ReceivedCount ?? received.Count,
                    Unavailable = response.Page.UnavailableCount,
                    RatingFiltered = response.Page.RatingFilteredCount,
                    TagFiltered = received.Count - buckets[responseIndex].Count,
                    Returned = buckets[responseIndex].Count
                };
            if (response.Page.HasMore &&
                (received.Count == 0 || buckets[responseIndex].Count > 0))
                result.HasMoreSources.Add(response.Source);
            if (response.Error is not null) result.Errors[response.Source] = response.Error;
            if (response.Error is not null && response.Source == "rule34" && Rule34Api.RetryAt is { } retryAt)
                result.RetryAt[response.Source] = retryAt.ToUnixTimeMilliseconds();
            if (response.Page.Notice is not null) result.Notices[response.Source] = response.Page.Notice;
        }
        for (var index = 0; buckets.Any(bucket => bucket.Count > index); index++)
            foreach (var bucket in buckets)
                if (bucket.Count > index) result.Items.Add(bucket[index]);
        await EnrichCrossSourceHashesAsync(result.Items, cancellationToken);
        if (result.Errors.Count == 0)
        {
            if (searchCache.Count > 80)
                foreach (var key in searchCache.Keys.Take(20)) searchCache.TryRemove(key, out _);
            searchCache[cacheKey] = (DateTimeOffset.UtcNow.AddSeconds(45), result);
        }
        return result;
    }

    internal static Dictionary<string, int> ParseSourcePages(string? value)
    {
        var pages = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        if (value is null || value.Length > 100) return pages;
        foreach (var entry in value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var parts = entry.Split(':');
            if (parts.Length == 2 && AllSources.Contains(parts[0], StringComparer.OrdinalIgnoreCase) &&
                int.TryParse(parts[1], out var page) && page is >= 0 and <= MaxSearchPage)
                pages[parts[0]] = page;
        }
        return pages;
    }

    private static string FormatSourceError(Exception ex, string source)
    {
        if (ex is InvalidOperationException) return ex.Message;
        if (ex is HttpRequestException http && http.StatusCode is not null)
        {
            var code = (int)http.StatusCode.Value;
            if (http.StatusCode == HttpStatusCode.TooManyRequests)
                return $"Сайт ограничил частоту запросов (HTTP {code}). Подождите и повторите.";
            if (code >= 500)
                return $"Сервер источника временно не отвечает (HTTP {code}). Повторите позже.";
            if ((code is 401 or 403) && (source is "rule34" or "gelbooru"))
                return $"Источник отклонил доступ (HTTP {code}). Проверьте ключ API в настройках.";
            return $"Источник вернул ошибку HTTP {code}. Повторите запрос позже.";
        }
        if (ex is TaskCanceledException)
            return "Источник не ответил вовремя. Повторите запрос.";
        return "Источник сейчас недоступен. Повторите запрос позже.";
    }

    public async Task<List<TagSuggestion>> SearchTagsAsync(string query, CancellationToken cancellationToken)
    {
        query = Regex.Replace(query.Normalize(NormalizationForm.FormKC).ToLowerInvariant(),
            @"[^\p{L}\p{N}_-]", "").Trim();
        if (query.Length is < 2 or > 50) return [];
        if (tagCache.TryGetValue(query, out var cached) && cached.Expires > DateTimeOffset.UtcNow)
            return cached.Value;

        async Task<(string Source, List<(string Name, int Count)> Tags, bool Success)> Fetch(
            string source, Func<CancellationToken, Task<List<(string Name, int Count)>>> fetch)
        {
            using var budget = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            budget.CancelAfter(TimeSpan.FromSeconds(3));
            try
            {
                var sharedGate = source != "rule34";
                if (sharedGate) await apiGate.WaitAsync(budget.Token);
                try { return (source, await fetch(budget.Token), true); }
                finally { if (sharedGate) apiGate.Release(); }
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException or
                                       JsonException or InvalidOperationException)
            {
                return (source, [], false);
            }
        }

        var credentials = store.GetGelbooruCredentials();
        var tasks = new List<Task<(string Source, List<(string Name, int Count)> Tags, bool Success)>>
        {
            Fetch("danbooru", token => GetDanbooruTagsAsync(query, token)),
            Fetch("rule34", token => GetRule34TagsAsync(query, token)),
            Fetch("sankaku", token => GetSankakuTagsAsync(query, token))
        };
        if (!string.IsNullOrWhiteSpace(credentials.UserId) &&
            !string.IsNullOrWhiteSpace(credentials.ApiKey))
            tasks.Add(Fetch("gelbooru", token => GetGelbooruTagsAsync(query, credentials, token)));
        var groups = await Task.WhenAll(tasks);
        var merged = new Dictionary<string, TagSuggestion>(StringComparer.OrdinalIgnoreCase);
        foreach (var (source, tags, _) in groups)
            foreach (var (name, count) in tags)
            {
                if (!merged.TryGetValue(name, out var suggestion))
                {
                    suggestion = new TagSuggestion { Name = name };
                    merged[name] = suggestion;
                }
                suggestion.Count += count;
                if (!suggestion.Sources.Contains(source)) suggestion.Sources.Add(source);
            }
        var result = merged.Values.OrderByDescending(tag => tag.Name.Equals(query,
                StringComparison.OrdinalIgnoreCase))
            .ThenByDescending(tag => tag.Name.StartsWith(query, StringComparison.OrdinalIgnoreCase))
            .ThenByDescending(tag => tag.Count).Take(12).ToList();
        if (tagCache.Count > 100)
            foreach (var key in tagCache.Keys.Take(25)) tagCache.TryRemove(key, out _);
        if (groups.All(group => group.Success))
            tagCache[query] = (DateTimeOffset.UtcNow.AddMinutes(3), result);
        return result;
    }

    private static async Task<List<(string Name, int Count)>> GetDanbooruTagsAsync(
        string query, CancellationToken cancellationToken)
    {
        var uri = "https://danbooru.donmai.us/tags.json?search%5Bname_matches%5D=" +
            Uri.EscapeDataString(query + "*") + "&search%5Border%5D=count&limit=15";
        using var json = await GetJsonAsync(uri, cancellationToken);
        return ReadTags(json.RootElement, "name", "post_count");
    }

    private static async Task<List<(string Name, int Count)>> GetGelbooruTagsAsync(
        string query, (string UserId, string ApiKey) credentials,
        CancellationToken cancellationToken)
    {
        var uri = "https://gelbooru.com/index.php?page=dapi&s=tag&q=index&json=1&limit=15" +
            "&name_pattern=" + Uri.EscapeDataString(query + "%") +
            "&orderby=count&order=DESC&user_id=" + Uri.EscapeDataString(credentials.UserId) +
            "&api_key=" + Uri.EscapeDataString(credentials.ApiKey);
        using var json = await GetJsonAsync(uri, cancellationToken);
        var root = json.RootElement;
        if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("tag", out var tags))
            root = tags;
        return ReadTags(root, "name", "count");
    }

    private async Task TryEnrichArtistTagsAsync(IEnumerable<CatalogItem> items,
        CancellationToken cancellationToken)
    {
        try { await EnrichArtistTagsAsync(items, cancellationToken); }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or
                                       System.Xml.XmlException or InvalidOperationException)
        {
            // The post remains available when tag classification is unavailable.
        }
    }

    private async Task EnrichArtistTagsAsync(IEnumerable<CatalogItem> items,
        CancellationToken cancellationToken)
    {
        var targets = items.Where(item => item.Source is "gelbooru" or "rule34" &&
            item.Participants.Count == 0 && !item.Rule34TagInfoKnown).ToList();
        if (targets.Count == 0) return;
        var credentials = store.GetGelbooruCredentials();
        if (credentials.UserId.Length == 0 || credentials.ApiKey.Length == 0) return;

        var now = DateTimeOffset.UtcNow;
        var missing = targets.SelectMany(item => item.Tags)
            .Where(tag => tag.Length is > 0 and <= 100)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Where(tag => !artistTagCache.TryGetValue(tag, out var cached) || cached.Expires <= now)
            .Take(700).ToList();
        var chunks = new List<List<string>>();
        var chunk = new List<string>();
        var encodedLength = 0;
        foreach (var tag in missing)
        {
            var length = Uri.EscapeDataString(tag).Length + 3;
            if (chunk.Count >= 50 || encodedLength + length > 1400)
            {
                chunks.Add(chunk);
                chunk = [];
                encodedLength = 0;
            }
            chunk.Add(tag);
            encodedLength += length;
        }
        if (chunk.Count > 0) chunks.Add(chunk);

        await Parallel.ForEachAsync(chunks,
            new ParallelOptions { MaxDegreeOfParallelism = 3, CancellationToken = cancellationToken },
            async (names, token) =>
            {
                var uri = "https://gelbooru.com/index.php?page=dapi&s=tag&q=index&json=1&limit=1000" +
                    "&names=" + Uri.EscapeDataString(string.Join(' ', names)) +
                    "&user_id=" + Uri.EscapeDataString(credentials.UserId) +
                    "&api_key=" + Uri.EscapeDataString(credentials.ApiKey);
                using var json = await GetJsonAsync(uri, token);
                var root = json.RootElement;
                if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("tag", out var tags))
                    root = tags;
                var artists = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                if (root.ValueKind == JsonValueKind.Array)
                    foreach (var tag in root.EnumerateArray())
                        if (String(tag, "type") == "1") artists.Add(String(tag, "name"));
                else if (root.ValueKind == JsonValueKind.Object && String(root, "type") == "1")
                    artists.Add(String(root, "name"));
                var expiry = DateTimeOffset.UtcNow.AddHours(12);
                foreach (var name in names)
                    artistTagCache[name] = (expiry, artists.Contains(name));
            });

        var rule34Credentials = store.GetRule34Credentials();
        if (rule34Credentials.UserId.Length > 0 && rule34Credentials.ApiKey.Length > 0)
        {
            var candidates = targets.Where(item => item.Source == "rule34")
                .SelectMany(item => item.Tags)
                .Where(tag => artistTagCache.TryGetValue(tag, out var classified) &&
                    classified.IsArtist && classified.Expires > DateTimeOffset.UtcNow)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Where(tag => !rule34ArtistTagCache.TryGetValue(tag, out var cached) ||
                    cached.Expires <= DateTimeOffset.UtcNow)
                .Take(8).ToList();
            await Parallel.ForEachAsync(candidates,
                new ParallelOptions { MaxDegreeOfParallelism = 1, CancellationToken = cancellationToken },
                async (tag, token) =>
                {
                    var uri = "https://api.rule34.xxx/index.php?page=dapi&s=tag&q=index" +
                        "&name=" + Uri.EscapeDataString(tag) +
                        "&user_id=" + Uri.EscapeDataString(rule34Credentials.UserId) +
                        "&api_key=" + Uri.EscapeDataString(rule34Credentials.ApiKey);
                    try
                    {
                        await rule34TagGate.WaitAsync(token);
                        try
                        {
                            if (rule34ArtistTagCache.TryGetValue(tag, out var cached) &&
                                cached.Expires > DateTimeOffset.UtcNow) return;
                            var xml = await Rule34Api.GetStringAsync(uri, "application/xml", token);
                            rule34ArtistTagCache[tag] = (DateTimeOffset.UtcNow.AddHours(12),
                                Rule34TagIsArtist(xml, tag));
                        }
                        finally { rule34TagGate.Release(); }
                    }
                    catch (OperationCanceledException) when (token.IsCancellationRequested) { throw; }
                    catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or
                                               System.Xml.XmlException or InvalidOperationException)
                    {
                        // Unknown is safer than treating a general tag as an artist.
                    }
                });
        }

        foreach (var item in targets)
        {
            var artists = item.Tags.Where(tag =>
                artistTagCache.TryGetValue(tag, out var cached) &&
                cached.Expires > DateTimeOffset.UtcNow && cached.IsArtist &&
                (item.Source == "gelbooru" ||
                    rule34ArtistTagCache.TryGetValue(tag, out var native) &&
                    native.Expires > DateTimeOffset.UtcNow && native.IsArtist));
            CatalogCredits.Apply(item, artists);
        }
    }

    private static bool Rule34TagIsArtist(string xml, string name) =>
        XDocument.Parse(xml).Descendants("tag").Any(tag =>
            string.Equals((string?)tag.Attribute("name"), name,
                StringComparison.OrdinalIgnoreCase) &&
            (string?)tag.Attribute("type") == "1");

    private static async Task<List<(string Name, int Count)>> GetRule34TagsAsync(
        string query, CancellationToken cancellationToken)
    {
        using var json = await GetJsonAsync("https://api.rule34.xxx/autocomplete.php?q=" +
            Uri.EscapeDataString(query), cancellationToken);
        if (json.RootElement.ValueKind != JsonValueKind.Array) return [];
        return json.RootElement.EnumerateArray().Where(tag => tag.ValueKind == JsonValueKind.Object)
            .Select(tag =>
            {
                var label = String(tag, "label");
                var match = Regex.Match(label, @"\((\d+)\)\s*$", RegexOptions.CultureInvariant);
                return (Name: String(tag, "value"), Count: match.Success &&
                    int.TryParse(match.Groups[1].Value, out var count) ? count : 0);
            })
            .Where(tag => tag.Name.Length is > 0 and <= 100).Take(15).ToList();
    }

    private static List<(string Name, int Count)> ReadTags(JsonElement root,
        string nameField, string countField)
    {
        if (root.ValueKind != JsonValueKind.Array) return [];
        return root.EnumerateArray().Where(tag => tag.ValueKind == JsonValueKind.Object)
            .Select(tag => (Name: String(tag, nameField), Count:
                int.TryParse(String(tag, countField), out var count) ? count : 0))
            .Where(tag => tag.Name.Length is > 0 and <= 100).ToList();
    }

    private static string CleanSearchQuery(string query) => Regex.Replace(query,
        @"(?i)(^|\s)(rating|order|sort):\S+", " ").Trim();

    private static string CanonicalSearchTag(string tag) => Regex.Replace(
        tag.Normalize(NormalizationForm.FormKC).Trim().TrimStart('#').ToLowerInvariant(),
        @"[_\-\s]+", " ").Trim();

    private static bool MatchesSearchTags(CatalogItem item, string query)
    {
        var requested = query.Split(' ', StringSplitOptions.RemoveEmptyEntries |
            StringSplitOptions.TrimEntries).Where(term => !term.StartsWith('-') &&
            !term.StartsWith('~') && !term.Contains('*') &&
            !Regex.IsMatch(term, @"^(?:user|fav|pool|id|parent|source|score|date|filetype|status|order|sort|rating):",
                RegexOptions.IgnoreCase)).Select(CanonicalSearchTag).Where(term => term.Length > 0);
        var available = item.Tags.Select(CanonicalSearchTag).ToHashSet(StringComparer.Ordinal);
        return requested.All(available.Contains);
    }

    private static bool RatingMatches(CatalogItem item, string rating) =>
        rating == "all" || (rating == "explicit"
            ? item.Rating is "q" or "questionable" or "e" or "explicit"
            : item.Rating is "g" or "general" or "s" or "sensitive" or "safe" or "sfw");

    private static DateOnly CurrentMonthStart() =>
        new(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);

    private static string BuildDanbooruSearchTags(string query, string rating,
        string sort)
    {
        var ratingTag = rating switch
        {
            "explicit" => "rating:q,e",
            "general" => "rating:g,s",
            _ => ""
        };
        return string.Join(' ', new[] { query, ratingTag,
            sort == "popular" ? "order:score" : "" }.Where(part => part.Length > 0));
    }

    private static string BuildBooruSearchTags(string query, string ratingTag,
        string sort) =>
        string.Join(' ', new[] { query, ratingTag,
            sort == "popular" ? "sort:score:desc" : "" }.Where(part => part.Length > 0));

    private static async Task<long> FindMonthBoundaryAsync(long latestId,
        DateOnly monthStart,
        Func<long, CancellationToken, Task<(long Id, DateOnly Date)>> probe,
        CancellationToken cancellationToken)
    {
        long low = 1, high = latestId;
        while (low < high)
        {
            var middle = low + (high - low) / 2;
            var found = await probe(middle, cancellationToken);
            if (found.Id < middle || found.Id > latestId)
                throw new InvalidOperationException("Источник вернул неверный ID публикации.");
            if (found.Date >= monthStart) high = middle;
            else low = found.Id + 1;
        }
        if (low > latestId) return low;
        return (await probe(low, cancellationToken)).Id;
    }

    private async Task<long> GetMonthStartIdAsync(string source, string userId,
        string apiKey, DateOnly monthStart, CancellationToken cancellationToken)
    {
        var key = $"{source}:{monthStart:yyyy-MM-dd}";
        if (monthStartIds.TryGetValue(key, out var cached)) return cached;
        var cacheFile = Path.Combine(store.CacheDirectory,
            $"popular-start-{source}-{monthStart:yyyy-MM}.txt");
        var gate = monthStartGates.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        try
        {
            if (monthStartIds.TryGetValue(key, out cached)) return cached;
            try
            {
                if (File.Exists(cacheFile) &&
                    long.TryParse(await File.ReadAllTextAsync(cacheFile, cancellationToken),
                        NumberStyles.Integer, CultureInfo.InvariantCulture, out cached) &&
                    cached > 0)
                {
                    monthStartIds[key] = cached;
                    return cached;
                }
            }
            catch (IOException) { /* An unavailable cache only slows this lookup. */ }
            var latest = await FetchBooruPostAsync(source, "sort:id:desc", userId,
                apiKey, cancellationToken);
            if (!long.TryParse(String(latest, "id"), out var latestId) || latestId <= 0)
                throw new InvalidOperationException("Не удалось определить последнюю публикацию источника.");
            async Task<(long Id, DateOnly Date)> Probe(long requested, CancellationToken token)
            {
                var post = await FetchBooruPostAsync(source,
                    $"id:>{requested - 1} sort:id:asc", userId, apiKey, token);
                if (!long.TryParse(String(post, "id"), out var id))
                    throw new InvalidOperationException("Не удалось определить ID публикации источника.");
                DateOnly date;
                if (source == "gelbooru")
                {
                    if (!TryParseGelbooruDate(String(post, "created_at"), out var posted))
                        throw new InvalidOperationException("Не удалось прочитать дату Gelbooru.");
                    date = DateOnly.FromDateTime(posted.DateTime);
                }
                else
                {
                    var html = await GetHtmlAsync(
                        $"https://rule34.xxx/index.php?page=post&s=view&id={id}", token);
                    var match = Regex.Match(html, @"Posted:\s*(?<date>\d{4}-\d{2}-\d{2})",
                        RegexOptions.IgnoreCase);
                    if (!match.Success || !DateOnly.TryParseExact(match.Groups["date"].Value,
                            "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out date))
                        throw new InvalidOperationException("Не удалось прочитать дату Rule34.");
                }
                return (id, date);
            }
            var boundary = await FindMonthBoundaryAsync(latestId, monthStart, Probe,
                cancellationToken);
            monthStartIds[key] = boundary;
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(cacheFile)!);
                await File.WriteAllTextAsync(cacheFile,
                    boundary.ToString(CultureInfo.InvariantCulture), cancellationToken);
            }
            catch (IOException) { /* The in-memory value remains usable. */ }
            return boundary;
        }
        finally { gate.Release(); }
    }

    private static async Task<JsonElement> FetchBooruPostAsync(string source, string tags,
        string userId, string apiKey, CancellationToken cancellationToken)
    {
        var host = source == "gelbooru" ? "https://gelbooru.com/index.php" :
            "https://api.rule34.xxx/index.php";
        var uri = $"{host}?page=dapi&s=post&q=index&json=1&limit=1&pid=0" +
            $"&tags={Uri.EscapeDataString(tags)}&user_id={Uri.EscapeDataString(userId)}" +
            $"&api_key={Uri.EscapeDataString(apiKey)}";
        using var json = await GetJsonAsync(uri, cancellationToken);
        var root = json.RootElement;
        var posts = source == "gelbooru" && root.ValueKind == JsonValueKind.Object &&
            root.TryGetProperty("post", out var gelPosts) ? gelPosts : root;
        if (posts.ValueKind != JsonValueKind.Array || posts.GetArrayLength() == 0)
            throw new InvalidOperationException("Источник не вернул публикацию для определения начала месяца.");
        return posts[0].Clone();
    }

    private static async Task<SourcePage> SearchDanbooruAsync(string query, int page,
        string rating, string sort,
        CancellationToken cancellationToken)
    {
        var tags = BuildDanbooruSearchTags(query, rating, sort);
        var uri = $"https://danbooru.donmai.us/posts.json?limit=24&page={page + 1}&tags={Uri.EscapeDataString(tags)}";
        using var json = await GetJsonAsync(uri, cancellationToken);
        return ReadBooruPage(json.RootElement, MapDanbooru, rating, 24);
    }

    private static SourcePage ReadBooruPage(JsonElement posts,
        Func<JsonElement, CatalogItem?> mapper, string rating, int pageSize)
    {
        if (posts.ValueKind != JsonValueKind.Array) return new SourcePage([], false, 0);
        var received = posts.GetArrayLength();
        var mapped = posts.EnumerateArray().Select(mapper).Where(item => item is not null)
            .Select(item => item!).ToList();
        var items = mapped.Where(item => RatingMatches(item, rating)).ToList();
        return new SourcePage(items, received >= pageSize, received,
            received - mapped.Count, mapped.Count - items.Count);
    }

    private async Task<SourcePage> SearchGelbooruAsync(string query, int page,
        string rating, string sort, CancellationToken cancellationToken, string? id = null)
    {
        var credentials = store.GetGelbooruCredentials();
        if (string.IsNullOrWhiteSpace(credentials.UserId) ||
            string.IsNullOrWhiteSpace(credentials.ApiKey))
            throw new InvalidOperationException("Укажите user ID и API key Gelbooru в настройках.");

        var uri = new StringBuilder("https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1");
        uri.Append("&limit=24&pid=").Append(page);
        if (id is not null) uri.Append("&id=").Append(Uri.EscapeDataString(id));
        if (id is null)
        {
            // Gelbooru does not reliably combine two rating metatags in one query.
            // Filter both g/s and q/e locally while paging the complete source listing.
            var tags = BuildBooruSearchTags(query, "", sort);
            uri.Append("&tags=").Append(Uri.EscapeDataString(tags));
        }
        uri.Append("&user_id=").Append(Uri.EscapeDataString(credentials.UserId));
        uri.Append("&api_key=").Append(Uri.EscapeDataString(credentials.ApiKey));
        using var json = await GetJsonAsync(uri.ToString(), cancellationToken);
        if (!json.RootElement.TryGetProperty("post", out var posts) ||
            posts.ValueKind != JsonValueKind.Array) return new SourcePage([], false);
        return ReadBooruPage(posts, MapGelbooru, id is not null ? "all" : rating, 24);
    }

    private async Task<SourcePage> SearchRule34Async(string query, int page,
        string rating, string sort, CancellationToken cancellationToken, string? id = null)
    {
        var credentials = store.GetRule34Credentials();
        if (string.IsNullOrWhiteSpace(credentials.UserId) ||
            string.IsNullOrWhiteSpace(credentials.ApiKey))
            throw new InvalidOperationException("Укажите user ID и API key Rule34 в настройках.");

        var uri = new StringBuilder("https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&fields=tag_info");
        uri.Append("&limit=48&pid=").Append(page);
        if (id is not null) uri.Append("&id=").Append(Uri.EscapeDataString(id));
        else
        {
            // Filter ratings locally because combined rating metatags are unreliable.
            var tags = BuildBooruSearchTags(query, "", sort);
            if (tags.Length > 0) uri.Append("&tags=").Append(Uri.EscapeDataString(tags));
        }
        uri.Append("&user_id=").Append(Uri.EscapeDataString(credentials.UserId));
        uri.Append("&api_key=").Append(Uri.EscapeDataString(credentials.ApiKey));
        using var json = await GetJsonAsync(uri.ToString(), cancellationToken, allowEmptyArray: true);
        var root = json.RootElement;
        if (Rule34ApiFailure(root) is { } failure)
            throw new InvalidOperationException(failure);
        var posts = root.ValueKind == JsonValueKind.Array ? root :
            root.ValueKind == JsonValueKind.Object && root.TryGetProperty("post", out var found)
                ? found : default;
        if (posts.ValueKind != JsonValueKind.Array) return new SourcePage([], false);
        return ReadBooruPage(posts, MapRule34, id is not null ? "all" : rating, 48);
    }

    private static string? Rule34ApiFailure(JsonElement root)
    {
        var failed = root.ValueKind == JsonValueKind.String ||
            root.ValueKind == JsonValueKind.Object &&
            root.TryGetProperty("success", out var success) && success.ValueKind == JsonValueKind.False;
        if (!failed) return null;
        var message = root.ValueKind == JsonValueKind.String
            ? root.GetString() ?? "" : String(root, "message");
        return Regex.IsMatch(message, @"api[ _-]?key|user[ _-]?id|unauthori[sz]ed|invalid credentials|authentication",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)
            ? "Rule34 отклонил ключ API. Проверьте данные в настройках."
            : "Поиск Rule34 временно недоступен на стороне сайта. Повторите позже.";
    }

    public async Task<CatalogItem?> GetDetailAsync(string source, string id, CancellationToken cancellationToken)
    {
        if (source == "sankaku" && SankakuApi.ValidId(id))
        {
            return await GetSankakuDetailAsync(id, cancellationToken);
        }
        if (source == "danbooru" && long.TryParse(id, out _))
        {
            using var json = await GetJsonAsync(
                $"https://danbooru.donmai.us/posts/{Uri.EscapeDataString(id)}.json", cancellationToken);
            return MapDanbooru(json.RootElement);
        }
        if (source == "gelbooru" && long.TryParse(id, out _))
        {
            var item = (await SearchGelbooruAsync("", 0, "all", "recent", cancellationToken, id))
                .Items.FirstOrDefault();
            if (item is not null)
            {
                await TryEnrichArtistTagsAsync([item], cancellationToken);
                var (characters, copyrights) = await GetGelbooruTagCategoriesAsync(item, cancellationToken);
                ApplyCharacterTags(item, characters);
                ApplyCopyrightTags(item, copyrights);
            }
            return item;
        }
        if (source == "rule34" && long.TryParse(id, out _))
        {
            var item = (await SearchRule34Async("", 0, "all", "recent", cancellationToken, id))
                .Items.FirstOrDefault();
            if (item is not null)
            {
                var (characters, copyrights) = await GetRule34TagCategoriesAsync(item, cancellationToken);
                ApplyCharacterTags(item, characters);
                ApplyCopyrightTags(item, copyrights);
                await TryEnrichArtistTagsAsync([item], cancellationToken);
            }
            return item;
        }
        return null;
    }

    private static void ApplyCharacterTags(CatalogItem item, List<string> characters)
    {
        var available = item.Tags.ToHashSet(StringComparer.OrdinalIgnoreCase);
        item.CharacterTags = characters.Where(tag => available.Contains(tag) &&
            !tag.Equals("original_character", StringComparison.OrdinalIgnoreCase))
            .Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if (item.CharacterTags.Count == 0) return;
        if (item.Title == $"Работа #{item.Id}")
            item.Title = string.Join(", ", item.CharacterTags.Select(tag => tag.Replace('_', ' ')));
        item.RelatedQuery = item.CharacterTags[0];
    }

    private static void ApplyCopyrightTags(CatalogItem item, List<string> copyrights)
    {
        var available = item.Tags.ToHashSet(StringComparer.OrdinalIgnoreCase);
        item.CopyrightTags = copyrights.Where(available.Contains)
            .Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    private async Task<(List<string> Characters, List<string> Copyrights)> GetGelbooruTagCategoriesAsync(CatalogItem item,
        CancellationToken cancellationToken)
    {
        var credentials = store.GetGelbooruCredentials();
        if (string.IsNullOrWhiteSpace(credentials.UserId) ||
            string.IsNullOrWhiteSpace(credentials.ApiKey)) return ([], []);
        var result = new List<string>();
        var copyrights = new List<string>();
        var artists = new List<string>();
        try
        {
            foreach (var names in item.Tags.Chunk(60))
            {
                var uri = "https://gelbooru.com/index.php?page=dapi&s=tag&q=index&json=1&limit=200" +
                    "&names=" + Uri.EscapeDataString(string.Join(' ', names)) +
                    "&user_id=" + Uri.EscapeDataString(credentials.UserId) +
                    "&api_key=" + Uri.EscapeDataString(credentials.ApiKey);
                using var json = await GetJsonAsync(uri, cancellationToken);
                result.AddRange(ExtractGelbooruCharacterTags(json.RootElement, item.Tags));
                copyrights.AddRange(ExtractGelbooruTags(json.RootElement, item.Tags, "3"));
                artists.AddRange(ExtractGelbooruTags(json.RootElement, item.Tags, "1"));
            }
        }
        catch (Exception ex) when ((ex is HttpRequestException or TaskCanceledException or JsonException) &&
                                   !cancellationToken.IsCancellationRequested)
        {
            // Missing category metadata must not hide an otherwise valid post.
        }
        if (artists.Count > 0) CatalogCredits.Apply(item, artists);
        return (result.Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
            copyrights.Distinct(StringComparer.OrdinalIgnoreCase).ToList());
    }

    private static List<string> ExtractGelbooruCharacterTags(JsonElement root,
        List<string> availableTags) => ExtractGelbooruTags(root, availableTags, "4");

    private static List<string> ExtractGelbooruTags(JsonElement root,
        List<string> availableTags, string category)
    {
        if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("tag", out var value))
            root = value;
        if (root.ValueKind != JsonValueKind.Array) return [];
        var available = availableTags.ToHashSet(StringComparer.OrdinalIgnoreCase);
        return root.EnumerateArray().Where(tag => String(tag, "type") == category)
            .Select(tag => String(tag, "name"))
            .Where(name => available.Contains(name)).Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static async Task<(List<string> Characters, List<string> Copyrights)> GetRule34TagCategoriesAsync(CatalogItem item,
        CancellationToken cancellationToken)
    {
        if (item.Rule34TagInfoKnown) return (item.CharacterTags, item.CopyrightTags);
        try
        {
            var html = await GetHtmlAsync(item.SourceUrl, cancellationToken);
            var artists = ExtractRule34Tags(html, item.Tags, "artist");
            if (artists.Count > 0) CatalogCredits.Apply(item, artists);
            return (ExtractRule34CharacterTags(html, item.Tags),
                ExtractRule34Tags(html, item.Tags, "copyright"));
        }
        catch (Exception ex) when ((ex is HttpRequestException or TaskCanceledException or InvalidOperationException) &&
                                   !cancellationToken.IsCancellationRequested)
        {
            return ([], []);
        }
    }

    private static List<string> ExtractRule34CharacterTags(string html,
        List<string> availableTags) => ExtractRule34Tags(html, availableTags, "character");

    private static List<string> ExtractRule34Tags(string html,
        List<string> availableTags, string categoryName)
    {
        var available = availableTags.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var result = new List<string>();
        foreach (Match category in Regex.Matches(html,
            @"<li\b[^>]*\btag-type-" + Regex.Escape(categoryName) + @"\b[^>]*>(?<body>.*?)</li>",
            RegexOptions.IgnoreCase | RegexOptions.Singleline))
        {
            var link = Regex.Match(category.Groups["body"].Value,
                "href=\"[^\"]*(?:&amp;|&)tags=(?<tag>[^\"&]+)\"",
                RegexOptions.IgnoreCase);
            if (!link.Success) continue;
            var name = Uri.UnescapeDataString(WebUtility.HtmlDecode(link.Groups["tag"].Value));
            if (available.Contains(name) && !result.Contains(name, StringComparer.OrdinalIgnoreCase))
                result.Add(name);
        }
        return result;
    }

    public async Task<ProfileResponse?> GetProfileAsync(string source, string artistId,
        int page, string rating, CancellationToken cancellationToken)
    {
        rating = rating is "explicit" or "all" ? rating : "general";
        if (source == "sankaku" && ValidArtistTag(artistId))
        {
            var query = "user:" + artistId.Replace(' ', '_');
            var listing = await SearchSankakuAsync(query, page, rating, "recent", cancellationToken);
            return new ProfileResponse
            {
                Source = source, Role = "Загрузил на Sankaku", Name = artistId, Page = page,
                Url = "https://sankaku.app/?tags=" + Uri.EscapeDataString(query),
                Items = listing.Items, HasMore = listing.HasMore,
                Notices = listing.Notice is null ? [] : new() { [source] = listing.Notice }
            };
        }
        if (source == "danbooru" && ValidArtistTag(artistId))
        {
            var listing = await SearchDanbooruAsync(artistId, page, rating, "recent", cancellationToken);
            return new ProfileResponse
            {
                Source = source, Role = CatalogCredits.RoleLabel(CatalogCredits.RoleForTag(artistId)),
                Name = artistId.Replace('_', ' '), Page = page,
                Url = "https://danbooru.donmai.us/posts?tags=" + Uri.EscapeDataString(artistId),
                Items = listing.Items, HasMore = listing.HasMore
            };
        }
        if (source == "gelbooru" && ValidArtistTag(artistId))
        {
            var query = "user:" + artistId.Replace(' ', '_');
            var listing = await SearchGelbooruAsync(query, page, rating, "recent", cancellationToken);
            await TryEnrichArtistTagsAsync(listing.Items, cancellationToken);
            return new ProfileResponse
            {
                Source = source, Role = "Загрузил на Gelbooru", Name = artistId, Page = page,
                Url = "https://gelbooru.com/index.php?page=post&s=list&tags=" +
                    Uri.EscapeDataString(query),
                Items = listing.Items, HasMore = listing.HasMore
            };
        }
        if (source == "rule34" && ValidArtistTag(artistId))
        {
            var query = "user:" + artistId.Replace(' ', '_');
            var listing = await SearchRule34Async(query, page, rating, "recent", cancellationToken);
            await TryEnrichArtistTagsAsync(listing.Items, cancellationToken);
            return new ProfileResponse
            {
                Source = source, Role = "Загрузил на Rule34", Name = artistId, Page = page,
                Url = "https://rule34.xxx/index.php?page=post&s=list&tags=" +
                    Uri.EscapeDataString(query),
                Items = listing.Items, HasMore = listing.HasMore
            };
        }
        return null;
    }

    public static bool ValidArtistTag(string value) => value.Length is > 0 and <= 100 &&
        value.All(c => char.IsLetterOrDigit(c) || c is '_' or '-' or '.' or '(' or ')' or ' ');

    public static bool IsValidFollow(FollowRequest request) =>
        CatalogState.IsSupported(request.Source) &&
        request.ArtistId is not null && request.Service is not null &&
        request.Name is { Length: > 0 and <= 160 } &&
        request.Name.Trim().Length > 0 &&
        ValidArtistTag(request.ArtistId) && request.Service.Length == 0;

    private static bool ShouldRetryJsonError(string uri, HttpStatusCode status, int attempt) =>
        attempt < 2 &&
        !(status == HttpStatusCode.TooManyRequests &&
            uri.StartsWith("https://api.rule34.xxx/", StringComparison.OrdinalIgnoreCase)) &&
        status is HttpStatusCode.TooManyRequests or HttpStatusCode.BadGateway or
            HttpStatusCode.ServiceUnavailable or HttpStatusCode.GatewayTimeout;

    private static JsonDocument ParseRule34PostsJson(string payload) =>
        JsonDocument.Parse(string.IsNullOrWhiteSpace(payload) ? "[]" : payload);

    private static async Task<JsonDocument> GetJsonAsync(string uri, CancellationToken cancellationToken,
        bool allowEmptyArray = false)
    {
        if (uri.StartsWith("https://api.rule34.xxx/", StringComparison.OrdinalIgnoreCase))
            return JsonDocument.Parse(await Rule34Api.GetStringAsync(uri, "application/json", cancellationToken));
        for (var attempt = 0; attempt < 3; attempt++)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, uri);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            using var response = await Api.SendAsync(request, HttpCompletionOption.ResponseHeadersRead,
                cancellationToken);
            if (ShouldRetryJsonError(uri, response.StatusCode, attempt))
            {
                var retryAfter = response.Headers.RetryAfter?.Delta;
                if (retryAfter is null || retryAfter <= TimeSpan.FromSeconds(8))
                {
                    var delay = retryAfter ?? TimeSpan.FromMilliseconds(
                        response.StatusCode == HttpStatusCode.TooManyRequests
                            ? 2000 * (attempt + 1) : 500 * (attempt + 1));
                    await Task.Delay(delay, cancellationToken);
                    continue;
                }
            }
            response.EnsureSuccessStatusCode();
            // Rule34's post API returns HTTP 200 with no body when no posts match.
            if (allowEmptyArray)
                return ParseRule34PostsJson(await response.Content.ReadAsStringAsync(cancellationToken));
            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            return await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        }
        throw new HttpRequestException("The source is temporarily unavailable.");
    }

    private static async Task<string> GetHtmlAsync(string uri, CancellationToken cancellationToken)
    {
        if (Uri.TryCreate(uri, UriKind.Absolute, out var address) &&
            address.Host.Equals("rule34.xxx", StringComparison.OrdinalIgnoreCase))
            return await Rule34Web.GetStringAsync(uri, "text/html", cancellationToken);
        for (var attempt = 0; attempt < 4; attempt++)
        {
            using var response = await Api.GetAsync(uri, cancellationToken);
            if (response.StatusCode == HttpStatusCode.TooManyRequests && attempt < 3)
            {
                var delay = response.Headers.RetryAfter?.Delta ??
                    TimeSpan.FromSeconds(2 * (attempt + 1));
                await Task.Delay(TimeSpan.FromSeconds(Math.Clamp(delay.TotalSeconds, 1, 6)),
                    cancellationToken);
                continue;
            }
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadAsStringAsync(cancellationToken);
        }
        throw new HttpRequestException("The source is temporarily unavailable.");
    }

    private static CatalogItem? MapDanbooru(JsonElement post)
    {
        var id = String(post, "id");
        var thumbnail = String(post, "preview_file_url");
        var full = String(post, "large_file_url");
        if (string.IsNullOrWhiteSpace(full)) full = String(post, "file_url");
        if (ValidVideoFileUrl(String(post, "file_url"))) full = String(post, "file_url");
        if (!long.TryParse(id, out _) || !ValidImageUrl(thumbnail)) return null;
        var tags = String(post, "tag_string").Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();
        var artistTags = String(post, "tag_string_artist").Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var characterTags = String(post, "tag_string_character")
            .Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();
        var character = characterTags.FirstOrDefault() ?? "";
        var copyrightTags = String(post, "tag_string_copyright")
            .Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();
        var related = character.Length > 0 ? character : (copyrightTags.FirstOrDefault() ?? "");
        if (related.Length == 0) related = PickRelatedTag(tags);
        var title = character.Length > 0 ? character.Replace('_', ' ') : $"Работа #{id}";
        var parentId = String(post, "parent_id");
        var pixivId = String(post, "pixiv_id");
        var source = String(post, "source");
        var hasChildren = post.TryGetProperty("has_children", out var children) &&
            children.ValueKind == JsonValueKind.True;
        var pixivGroupKey = long.TryParse(pixivId, out var pixivArtworkId) && pixivArtworkId > 0
            ? $"pixiv:{pixivArtworkId}" : PixivGroupKey(source);
        var groupKey = long.TryParse(parentId, out var parentNumber) && parentNumber > 0
            ? $"danbooru:parent:{parentNumber}"
            : hasChildren ? $"danbooru:parent:{id}"
            : pixivGroupKey;
        var item = new CatalogItem
        {
            Key = $"danbooru:{id}", Source = "danbooru", Id = id,
            Title = title, RelatedQuery = related,
            UploaderId = String(post, "uploader_id"),
            OriginalUrl = OriginalSourceUrl(source),
            GroupKey = groupKey, PixivGroupKey = pixivGroupKey,
            ContentHash = String(post, "md5"),
            Thumbnail = thumbnail,
            SourceUrl = $"https://danbooru.donmai.us/posts/{id}",
            Published = NormalizeDate(String(post, "created_at")),
            PopularityCount = Number(post, "score"),
            Rating = String(post, "rating"), Tags = tags, CharacterTags = characterTags,
            CopyrightTags = copyrightTags,
            Images = ValidImageUrl(full) ? [full] : []
        };
        CatalogCredits.Apply(item, artistTags);
        return item;
    }

    private static CatalogItem? MapGelbooru(JsonElement post)
    {
        var id = String(post, "id");
        var thumbnail = String(post, "preview_url");
        var full = String(post, "sample_url");
        if (string.IsNullOrWhiteSpace(full)) full = String(post, "file_url");
        if (ValidVideoFileUrl(String(post, "file_url"))) full = String(post, "file_url");
        if (!long.TryParse(id, out _) || !ValidImageUrl(thumbnail)) return null;
        var tags = String(post, "tags").Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();
        var source = String(post, "source");
        var pixivGroupKey = PixivGroupKey(source);
        var parentId = String(post, "parent_id");
        var hasChildren = post.TryGetProperty("has_children", out var children) &&
            children.ValueKind == JsonValueKind.True;
        var groupKey = long.TryParse(parentId, out var parentNumber) && parentNumber > 0
            ? $"gelbooru:parent:{parentNumber}"
            : hasChildren ? $"gelbooru:parent:{id}" : pixivGroupKey;
        return new CatalogItem
        {
            Key = $"gelbooru:{id}", Source = "gelbooru", Id = id,
            Title = $"Работа #{id}",
            Artist = String(post, "owner") is { Length: > 0 } owner ? owner : "Неизвестный автор",
            ArtistId = String(post, "owner"), RelatedQuery = PickRelatedTag(tags),
            UploaderName = String(post, "owner"), UploaderId = String(post, "owner"),
            OriginalUrl = OriginalSourceUrl(source),
            GroupKey = groupKey, PixivGroupKey = pixivGroupKey,
            ContentHash = String(post, "md5"),
            Thumbnail = thumbnail,
            SourceUrl = $"https://gelbooru.com/index.php?page=post&s=view&id={id}",
            Published = NormalizeDate(String(post, "created_at")),
            PopularityCount = Number(post, "score"),
            Rating = String(post, "rating"), Tags = tags,
            Images = ValidImageUrl(full) ? [full] : []
        };
    }

    private static CatalogItem? MapRule34(JsonElement post)
    {
        var id = String(post, "id");
        if (!long.TryParse(id, out _)) return null;
        var file = String(post, "file_url");
        if (file.Length > 0 && !ValidImageFileUrl(file) && !ValidVideoFileUrl(file)) return null;
        var sample = String(post, "sample_url");
        var full = ValidVideoFileUrl(file) ? file : ValidImageFileUrl(sample) ? sample : file;
        var preview = String(post, "preview_url");
        var thumbnail = ValidImageUrl(preview) ? preview : ValidVideoFileUrl(full) ? "" : full;
        if ((!ValidImageFileUrl(full) && !ValidVideoFileUrl(full)) ||
            !(ValidImageUrl(thumbnail) || thumbnail.Length == 0 && ValidVideoFileUrl(full))) return null;
        var tags = String(post, "tags").Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();
        var owner = String(post, "owner");
        var source = String(post, "source");
        var pixivGroupKey = PixivGroupKey(source);
        var parentId = String(post, "parent_id");
        var hasChildren = post.TryGetProperty("has_children", out var children) &&
            children.ValueKind == JsonValueKind.True;
        var groupKey = long.TryParse(parentId, out var parentNumber) && parentNumber > 0
            ? $"rule34:parent:{parentNumber}"
            : hasChildren ? $"rule34:parent:{id}" : pixivGroupKey;
        var rating = String(post, "rating").ToLowerInvariant() switch
        {
            "general" or "safe" or "g" or "s" => "g",
            "questionable" or "q" => "q",
            "explicit" or "e" => "e",
            _ => "u"
        };
        var item = new CatalogItem
        {
            Key = $"rule34:{id}", Source = "rule34", Id = id,
            Title = $"Работа #{id}",
            Artist = owner.Length > 0 ? owner : "Неизвестный загрузчик",
            ArtistId = owner, RelatedQuery = PickRelatedTag(tags),
            UploaderName = owner, UploaderId = owner,
            OriginalUrl = OriginalSourceUrl(source),
            GroupKey = groupKey, PixivGroupKey = pixivGroupKey,
            ContentHash = String(post, "md5"),
            OriginalImageFileUrl = file,
            Thumbnail = thumbnail,
            SourceUrl = $"https://rule34.xxx/index.php?page=post&s=view&id={id}",
            Published = NormalizeDate(String(post, "created_at")),
            PopularityCount = Number(post, "score"),
            Rating = rating, Tags = tags, Images = [full]
        };
        ApplyRule34TagInfo(item, post);
        return item;
    }

    private static string PixivGroupKey(string source)
    {
        if (!Uri.TryCreate(source, UriKind.Absolute, out var url) ||
            url.Scheme is not ("http" or "https")) return "";
        Match match;
        if (url.Host.Equals("pixiv.net", StringComparison.OrdinalIgnoreCase) ||
            url.Host.Equals("www.pixiv.net", StringComparison.OrdinalIgnoreCase))
            match = Regex.Match(url.AbsolutePath,
                @"^/(?:en/)?artworks/(?<id>\d+)(?:/|$)",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        else if (url.Host.Equals("i.pximg.net", StringComparison.OrdinalIgnoreCase) &&
                 (url.AbsolutePath.StartsWith("/img-original/", StringComparison.OrdinalIgnoreCase) ||
                  url.AbsolutePath.StartsWith("/img-master/", StringComparison.OrdinalIgnoreCase)))
            match = Regex.Match(url.AbsolutePath,
                @"/(?<id>\d{5,12})(?:-[a-f0-9]{32})?_p\d+(?:_[^/.]+)?\.(?:jpe?g|png|gif|webp)$",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        else return "";
        return match.Success ? "pixiv:" + match.Groups["id"].Value : "";
    }

    private static string OriginalPostIdentity(string source)
    {
        if (!Uri.TryCreate(source, UriKind.Absolute, out var url) ||
            url.Scheme is not ("http" or "https")) return "";
        var host = url.Host.ToLowerInvariant();
        if (host.StartsWith("www.", StringComparison.Ordinal)) host = host[4..];
        else if (host.StartsWith("mobile.", StringComparison.Ordinal)) host = host[7..];
        if (host is not ("x.com" or "twitter.com")) return "";
        var match = Regex.Match(url.AbsolutePath,
            @"^/(?:[^/]+/status|i/web/status)/(?<id>\d{5,25})(?:/|$)",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        return match.Success ? "x-status:" + match.Groups["id"].Value : "";
    }

    private static IEnumerable<string> PublicationKeys(CatalogItem item)
    {
        if (item.GroupKey.StartsWith("pixiv:", StringComparison.Ordinal))
            yield return item.GroupKey;
        if (item.PixivGroupKey.StartsWith("pixiv:", StringComparison.Ordinal))
            yield return item.PixivGroupKey;
        var pixiv = PixivGroupKey(item.OriginalUrl);
        if (pixiv.Length > 0) yield return pixiv;
        var socialPost = OriginalPostIdentity(item.OriginalUrl);
        if (socialPost.Length > 0) yield return socialPost;
    }

    private async Task EnrichCrossSourceHashesAsync(List<CatalogItem> items,
        CancellationToken cancellationToken)
    {
        var linkedPublications = items.Where(item => item.Source != "rule34" &&
            Regex.IsMatch(item.ContentHash, "^[a-f0-9]{32}$", RegexOptions.IgnoreCase))
            .SelectMany(PublicationKeys).ToHashSet(StringComparer.Ordinal);
        if (linkedPublications.Count == 0) return;
        var candidates = items.Where(item => item.Source == "rule34" &&
            item.ContentHash.Length == 0 && item.OriginalImageFileUrl.Length > 0 &&
            PublicationKeys(item).Any(linkedPublications.Contains)).Take(12).ToArray();
        if (candidates.Length == 0) return;
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(5));
        await Task.WhenAll(candidates.Select(async item =>
        {
            try
            {
                var hash = await GetRule34ImageMd5Async(item.OriginalImageFileUrl, timeout.Token);
                if (hash.Length > 0) item.ContentHash = hash;
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                // Image verification is optional; the publication link still groups the cards.
            }
        }));
    }

    private async Task<string> GetRule34ImageMd5Async(string rawUrl,
        CancellationToken cancellationToken)
    {
        if (mediaMd5Cache.TryGetValue(rawUrl, out var cached)) return cached;
        if (!ValidImageFileUrl(rawUrl)) return "";
        var uri = new Uri(rawUrl);
        if (!uri.Host.Equals("rule34.xxx", StringComparison.OrdinalIgnoreCase) &&
            !uri.Host.EndsWith(".rule34.xxx", StringComparison.OrdinalIgnoreCase)) return "";
        await mediaMd5Gate.WaitAsync(cancellationToken);
        try
        {
            for (var redirects = 0; redirects < 3; redirects++)
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, uri);
                request.Headers.Referrer = new Uri("https://rule34.xxx/");
                using var response = await Images.SendAsync(request,
                    HttpCompletionOption.ResponseHeadersRead, cancellationToken);
                if ((int)response.StatusCode is >= 300 and < 400 &&
                    response.Headers.Location is not null)
                {
                    uri = new Uri(uri, response.Headers.Location);
                    if (uri.Scheme != "https" || !IsAllowedSourceHost(uri.Host)) return "";
                    continue;
                }
                if (!response.IsSuccessStatusCode ||
                    !((response.Content.Headers.ContentType?.MediaType ?? "")
                        .StartsWith("image/", StringComparison.OrdinalIgnoreCase)) ||
                    response.Content.Headers.ContentLength is > 8_000_000) return "";
                await using var input = await response.Content.ReadAsStreamAsync(cancellationToken);
                using var md5 = IncrementalHash.CreateHash(HashAlgorithmName.MD5);
                var buffer = new byte[64 * 1024];
                long bytes = 0;
                int count;
                while ((count = await input.ReadAsync(buffer, cancellationToken)) > 0)
                {
                    bytes += count;
                    if (bytes > 8_000_000) return "";
                    md5.AppendData(buffer, 0, count);
                }
                var hash = Convert.ToHexString(md5.GetHashAndReset()).ToLowerInvariant();
                if (mediaMd5Cache.Count > 1000)
                    foreach (var key in mediaMd5Cache.Keys.Take(100))
                        mediaMd5Cache.TryRemove(key, out _);
                mediaMd5Cache[rawUrl] = hash;
                return hash;
            }
        }
        catch (Exception) when (!cancellationToken.IsCancellationRequested)
        {
            // Optional content matching must never turn an image CDN failure into a search failure.
            return "";
        }
        finally { mediaMd5Gate.Release(); }
        return "";
    }

    private static string OriginalSourceUrl(string source) =>
        source.Length <= 2000 && Uri.TryCreate(source, UriKind.Absolute, out var url) &&
        url.Scheme is "http" or "https" ? url.ToString() : "";

    private static bool ValidImageFileUrl(string value) =>
        ValidImageUrl(value) && Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
        ImageExtensions.Contains(Path.GetExtension(uri.AbsolutePath), StringComparer.OrdinalIgnoreCase);

    private static string PickRelatedTag(List<string> tags) => tags.FirstOrDefault(tag =>
        !new[] { "1girl", "1boy", "solo", "original", "rating:general", "rating:explicit" }
            .Contains(tag, StringComparer.OrdinalIgnoreCase)) ?? tags.FirstOrDefault() ?? "";

    private static string String(JsonElement element, string name)
    {
        if (element.ValueKind != JsonValueKind.Object ||
            !element.TryGetProperty(name, out var value) ||
            value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined) return "";
        return value.ValueKind == JsonValueKind.String ? value.GetString() ?? "" : value.ToString();
    }

    private static int? Number(JsonElement element, string name) =>
        int.TryParse(String(element, name), NumberStyles.Integer, CultureInfo.InvariantCulture,
            out var value) ? value : null;

    private static string NormalizeDate(string value) =>
        (TryParseGelbooruDate(value, out var date) ||
         DateTimeOffset.TryParse(value, out date))
            ? date.ToUniversalTime().ToString("O") : "";

    private static bool TryParseGelbooruDate(string value, out DateTimeOffset date)
    {
        date = default;
        var match = Regex.Match(value,
            @"^[A-Za-z]{3}\s+(?<month>[A-Za-z]{3})\s+(?<day>\d{1,2})\s+" +
            @"(?<time>\d{2}:\d{2}:\d{2})\s+(?<offset>[+-]\d{4})\s+(?<year>\d{4})$");
        if (!match.Success || !DateTime.TryParseExact(
                $"{match.Groups["month"].Value} {match.Groups["day"].Value} " +
                $"{match.Groups["year"].Value} {match.Groups["time"].Value}",
                "MMM d yyyy HH:mm:ss", CultureInfo.InvariantCulture,
                DateTimeStyles.None, out var local)) return false;
        var zone = match.Groups["offset"].Value;
        var minutes = (int.Parse(zone.AsSpan(1, 2), CultureInfo.InvariantCulture) * 60 +
            int.Parse(zone.AsSpan(3, 2), CultureInfo.InvariantCulture)) *
            (zone[0] == '-' ? -1 : 1);
        date = new DateTimeOffset(local, TimeSpan.FromMinutes(minutes));
        return true;
    }

    private static bool ValidImageUrl(string value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == "https" && uri.UserInfo.Length == 0 &&
        IsAllowedSourceHost(uri.Host);

    private static bool ValidVideoFileUrl(string value) => ValidImageUrl(value) &&
        VideoExtensions.Contains(Path.GetExtension(new Uri(value).AbsolutePath),
            StringComparer.OrdinalIgnoreCase);

    public static bool IsValidItem(CatalogItem item) =>
        CatalogState.IsSupported(item.Source) &&
        item.Key.Length is > 3 and < 250 && item.Title.Length < 1000 &&
        item.GroupKey.Length < 200 && item.PixivGroupKey.Length < 200 &&
        item.Images.Count <= 100 &&
        item.Participants is { Count: <= 100 } && item.Participants.All(person =>
            person is not null && person.Tag is { Length: > 0 and <= 100 } &&
            person.Name is { Length: <= 200 } && person.Role is { Length: <= 32 }) &&
        (ValidImageUrl(item.Thumbnail) || item.Thumbnail.Length == 0 &&
            item.Images.Any(ValidVideoFileUrl)) &&
        item.Images.All(ValidImageUrl);

    public static bool IsAllowedSourceHost(string host) =>
        new[] { "donmai.us", "gelbooru.com", "rule34.xxx", "sankakucomplex.com" }
            .Any(domain => host.Equals(domain, StringComparison.OrdinalIgnoreCase) ||
                           host.EndsWith("." + domain, StringComparison.OrdinalIgnoreCase));

    public async Task WriteVideoAsync(string rawUrl, HttpContext context)
    {
        if (rawUrl.Length > 2048 || !ValidVideoFileUrl(rawUrl))
        {
            context.Response.StatusCode = 400;
            return;
        }
        RangeHeaderValue? range = null;
        var rangeText = context.Request.Headers.Range.ToString();
        if (rangeText.Length > 0 && (rangeText.Length > 128 ||
            !RangeHeaderValue.TryParse(rangeText, out range) ||
            range.Unit != "bytes" || range.Ranges.Count != 1))
        {
            context.Response.StatusCode = 416;
            return;
        }
        var uri = new Uri(rawUrl);
        await videoGate.WaitAsync(context.RequestAborted);
        try
        {
            for (var redirects = 0; redirects < 4; redirects++)
            {
                using var request = new HttpRequestMessage(
                    HttpMethods.IsHead(context.Request.Method) ? HttpMethod.Head : HttpMethod.Get, uri);
                request.Headers.Range = range;
                if (uri.Host.EndsWith(".gelbooru.com", StringComparison.OrdinalIgnoreCase) ||
                    uri.Host.Equals("gelbooru.com", StringComparison.OrdinalIgnoreCase))
                    request.Headers.Referrer = new Uri("https://gelbooru.com/");
                else if (uri.Host.EndsWith(".rule34.xxx", StringComparison.OrdinalIgnoreCase) ||
                         uri.Host.Equals("rule34.xxx", StringComparison.OrdinalIgnoreCase))
                    request.Headers.Referrer = new Uri("https://rule34.xxx/");
                else if (SankakuMediaHost(uri.Host))
                    request.Headers.Referrer = new Uri("https://sankaku.app/");
                using var response = await Images.SendAsync(request,
                    HttpCompletionOption.ResponseHeadersRead, context.RequestAborted);
                if ((int)response.StatusCode is >= 300 and < 400 && response.Headers.Location is not null)
                {
                    uri = new Uri(uri, response.Headers.Location);
                    if (uri.Scheme != "https" || !IsAllowedSourceHost(uri.Host)) break;
                    continue;
                }
                if (response.StatusCode == HttpStatusCode.RequestedRangeNotSatisfiable)
                {
                    context.Response.StatusCode = 416;
                    if (response.Content.Headers.ContentRange is { } unsatisfied)
                        context.Response.Headers.ContentRange = unsatisfied.ToString();
                    return;
                }
                var contentType = response.Content.Headers.ContentType?.MediaType ?? "";
                if (response.StatusCode is not (HttpStatusCode.OK or HttpStatusCode.PartialContent) ||
                    !(contentType.StartsWith("video/", StringComparison.OrdinalIgnoreCase) ||
                      contentType.Equals("application/octet-stream", StringComparison.OrdinalIgnoreCase)))
                {
                    context.Response.StatusCode = 502;
                    return;
                }
                context.Response.StatusCode = (int)response.StatusCode;
                context.Response.ContentType = contentType.StartsWith("video/", StringComparison.OrdinalIgnoreCase)
                    ? contentType : Path.GetExtension(new Uri(rawUrl).AbsolutePath).ToLowerInvariant() switch
                    { ".webm" => "video/webm", ".ogv" => "video/ogg", _ => "video/mp4" };
                context.Response.ContentLength = response.Content.Headers.ContentLength;
                context.Response.Headers.CacheControl = "private, max-age=3600";
                context.Response.Headers.AcceptRanges = string.Join(",", response.Headers.AcceptRanges);
                if (response.Content.Headers.ContentRange is { } contentRange)
                    context.Response.Headers.ContentRange = contentRange.ToString();
                if (HttpMethods.IsHead(context.Request.Method)) return;
                await using var input = await response.Content.ReadAsStreamAsync(context.RequestAborted);
                await input.CopyToAsync(context.Response.Body, context.RequestAborted);
                return;
            }
            context.Response.StatusCode = 502;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or IOException)
        {
            if (!context.Response.HasStarted && !context.RequestAborted.IsCancellationRequested)
                context.Response.StatusCode = 502;
            else context.Abort();
        }
        finally { videoGate.Release(); }
    }

    public async Task WriteImageAsync(string rawUrl, HttpContext context)
    {
        if (rawUrl.Length > 2048 || !ValidImageUrl(rawUrl))
        {
            context.Response.StatusCode = 400;
            return;
        }
        var uri = new Uri(rawUrl);
        await imageGate.WaitAsync(context.RequestAborted);
        try
        {
            for (var redirects = 0; redirects < 4; redirects++)
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, uri);
                if (uri.Host.Equals("gelbooru.com", StringComparison.OrdinalIgnoreCase) ||
                    uri.Host.EndsWith(".gelbooru.com", StringComparison.OrdinalIgnoreCase))
                    request.Headers.Referrer = new Uri("https://gelbooru.com/");
                else if (uri.Host.Equals("rule34.xxx", StringComparison.OrdinalIgnoreCase) ||
                         uri.Host.EndsWith(".rule34.xxx", StringComparison.OrdinalIgnoreCase))
                    request.Headers.Referrer = new Uri("https://rule34.xxx/");
                else if (SankakuMediaHost(uri.Host))
                    request.Headers.Referrer = new Uri("https://sankaku.app/");
                using var response = await Images.SendAsync(request, HttpCompletionOption.ResponseHeadersRead,
                    context.RequestAborted);
                if ((int)response.StatusCode is >= 300 and < 400 && response.Headers.Location is not null)
                {
                    uri = new Uri(uri, response.Headers.Location);
                    if (uri.Scheme != "https" || !IsAllowedSourceHost(uri.Host)) break;
                    continue;
                }
                var mediaType = response.Content.Headers.ContentType?.MediaType ?? "";
                if (!response.IsSuccessStatusCode || !mediaType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                {
                    context.Response.StatusCode = 502;
                    return;
                }
                if (response.Content.Headers.ContentLength is > 30_000_000)
                {
                    context.Response.StatusCode = 413;
                    return;
                }
                await using var input = await response.Content.ReadAsStreamAsync(context.RequestAborted);
                await using var buffer = new MemoryStream();
                var chunk = new byte[80 * 1024];
                int count;
                while ((count = await input.ReadAsync(chunk, context.RequestAborted)) > 0)
                {
                    if (buffer.Length + count > 30_000_000)
                    {
                        context.Response.StatusCode = 413;
                        return;
                    }
                    await buffer.WriteAsync(chunk.AsMemory(0, count), context.RequestAborted);
                }
                context.Response.ContentType = mediaType;
                context.Response.Headers.CacheControl = "private, max-age=3600";
                buffer.Position = 0;
                await buffer.CopyToAsync(context.Response.Body, context.RequestAborted);
                return;
            }
        }
        catch (Exception ex) when ((ex is HttpRequestException or TaskCanceledException) &&
                                   !context.RequestAborted.IsCancellationRequested)
        {
            context.Response.StatusCode = 502;
            return;
        }
        finally { imageGate.Release(); }
        context.Response.StatusCode = 502;
    }
}
