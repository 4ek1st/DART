using System.Reflection;
using System.Text.Json;
using ArtCatalog;

internal static class RatingSelectionFixtureTests
{
    internal static void Run()
    {
        var type = typeof(CatalogItem).Assembly.GetType("ArtCatalog.CatalogService")!;
        object? Call(string name, params object[] values) =>
            (type.GetMethod(name, BindingFlags.NonPublic | BindingFlags.Static)
                ?? throw new Exception("Missing rating helper: " + name)).Invoke(null, values);
        void Expect(bool condition, string message)
        { if (!condition) throw new Exception("Rating selection: " + message); }
        foreach (var rating in new[] { "general", "explicit", "all", "questionable", "explicit-only", "none" })
            Expect((string?)Call("NormalizeRating", rating) == rating, "precise rating must survive API normalization");
        Expect((string?)Call("NormalizeRating", "unknown") == "general", "invalid rating must stay conservative");
        foreach (var (mode, accepted) in new[] {
            ("questionable", new[] { "q", "questionable" }),
            ("explicit-only", new[] { "e", "explicit" }), ("none", Array.Empty<string>()) })
        {
            foreach (var rating in new[] { "g", "s", "safe", "q", "questionable", "e", "explicit", "" })
                Expect((bool)Call("RatingMatches", new CatalogItem { Rating = rating }, mode)! == accepted.Contains(rating),
                    mode + " must exclude unchecked ratings");
        }
        foreach (var (mode, tag) in new[] { ("questionable", "q"), ("explicit-only", "e") })
        {
            Expect((string?)Call("BuildDanbooruSearchTags", "landscape", mode, "recent") == "landscape rating:" + tag,
                "Danbooru must request the chosen rating");
            Expect(Uri.UnescapeDataString(SankakuApi.SearchPath("landscape", 2, mode, "popular"))
                .Contains("tags=landscape rating:" + tag + " order:popularity"), "Sankaku must request the chosen rating");
        }
        using var posts = JsonDocument.Parse("""
            [{"id":1,"rating":"e","preview_file_url":"https://cdn.donmai.us/preview/1.jpg"},
             {"id":2,"rating":"e","preview_file_url":"https://cdn.donmai.us/preview/2.jpg"}]
            """);
        Func<JsonElement, CatalogItem?> mapper = post => (CatalogItem?)Call("MapDanbooru", post);
        var page = Call("ReadBooruPage", posts.RootElement, mapper, "questionable", 2)!;
        var pageType = page.GetType();
        Expect(((List<CatalogItem>)pageType.GetProperty("Items")!.GetValue(page)!).Count == 0 &&
            (bool)pageType.GetProperty("HasMore")!.GetValue(page)! &&
            (int)pageType.GetProperty("RatingFilteredCount")!.GetValue(page)! == 2,
            "a page without the chosen rating must keep paging by raw results");
        var directory = Path.Combine(Path.GetTempPath(), "DART-rating-selection-" + Guid.NewGuid().ToString("N"));
        try
        {
            var storeType = type.Assembly.GetType("ArtCatalog.LocalStore")!;
            var store = Activator.CreateInstance(storeType, [directory])!;
            object? Store(string name, params object[] values) => storeType.GetMethod(name)!.Invoke(store, values);
            Store("ToggleFollow", new FollowRequest { Source = "danbooru", ArtistId = "fixture_artist", Name = "Fixture" });
            var follow = ((List<FollowedArtist>)Store("GetFollows")!)[0];
            var snapshots = new Dictionary<string, string>();
            foreach (var rating in new[] { "explicit", "questionable", "explicit-only" })
            {
                var payload = JsonSerializer.Serialize(new { groups = new[] { new { key = follow.Key,
                    items = new[] { new { key = "danbooru:" + rating, source = "danbooru" } } } } });
                Expect((bool)Store("UpdateFollowFeedCacheJson", rating, payload)!, "precise cache must be writable");
                snapshots[rating] = (string)Store("GetFollowFeedCacheJson", rating)!;
            }
            foreach (var rating in snapshots.Keys)
                Expect((string)Store("GetFollowFeedCacheJson", rating)! == snapshots[rating],
                    "Q/E preview caches must not overwrite the combined adult cache");
            var service = Activator.CreateInstance(type, [store])!;
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(2));
            var result = ((Task<SearchResponse>)type.GetMethod("SearchAsync")!.Invoke(service,
                ["", 0, new[] { "danbooru", "gelbooru", "rule34", "sankaku" }, "none", "recent", "illustrations", timeout.Token, null])!)
                .GetAwaiter().GetResult();
            Expect(result.Items.Count == 0 && result.HasMoreSources.Count == 0 && result.Errors.Count == 0,
                "both adult ratings off must finish without credentials or provider requests");
        }
        finally { if (Directory.Exists(directory)) Directory.Delete(directory, recursive: true); }
        Console.WriteLine("Precise Q/NSFW rating fixtures passed.");
    }
}
