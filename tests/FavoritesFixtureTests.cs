using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using ArtCatalog;

internal static class FavoritesFixtureTests
{
    private static readonly Type Store = typeof(CatalogItem).Assembly.GetType("ArtCatalog.LocalStore")!;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-11-02T12:00:00Z");
    private static object Open(string path) => Activator.CreateInstance(Store, [path])!;
    private static void Expect(bool value, string message) { if (!value) throw new Exception(message); }
    private static JsonObject Snapshot(object store, string rating = "all", DateTimeOffset? at = null) =>
        JsonSerializer.SerializeToNode(Store.GetMethod("GetFavoriteActivity")!.Invoke(store, [rating, at ?? Now]), Json)!.AsObject();
    private static void Record(object store, DateTimeOffset at, params (CatalogItem Item, bool MetadataOnly)[] records)
    {
        var method = Store.GetMethod("RecordFavoriteActivity") ?? throw new Exception("Favorites activity method is missing");
        var payload = JsonSerializer.Serialize(records.Select(record => new { item = record.Item, metadataOnly = record.MetadataOnly }), Json);
        var batch = JsonSerializer.Deserialize(payload, method.GetParameters()[0].ParameterType, Json)!;
        method.Invoke(store, [batch, at]);
    }
    private static CatalogItem Work(string source, string id, string hash = "", string character = "fern") => new()
    {
        Source = source, Id = id, Key = source + ":" + id, ContentHash = hash,
        Thumbnail = "https://cdn.donmai.us/preview/" + id + ".jpg", Rating = "g", Title = character,
        CharacterTags = [character], Tags = [character, "forest", "solo", "sample_artist", "sample_series"],
        CopyrightTags = ["sample_series"], CreatorTag = "sample_artist"
    };
    private static JsonObject Entry(JsonObject state, string tag) => state["entries"]!.AsArray()
        .OfType<JsonObject>().Single(entry => entry["tag"]!.GetValue<string>() == tag);

    internal static void Run()
    {
        Expect(Store.GetMethod("RecordFavoriteActivity") is not null, "Favorites activity method is missing");
        Expect(Store.GetMethod("GetFavoriteActivity") is not null, "Favorites summary method is missing");
        var root = Path.Combine(Path.GetTempPath(), "DART-favorites-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            var empty = Open(Path.Combine(root, "empty"));
            Expect(Store.GetMethod("SetFavoriteArtwork") is not null, "Independent artwork Favorites persistence is missing");
            var favoriteItem = Work("danbooru", "91", new string('9', 32));
            Store.GetMethod("SetFavoriteArtwork")!.Invoke(empty, [favoriteItem, true]);
            Store.GetMethod("SetFavoriteArtwork")!.Invoke(empty, [Work("gelbooru", "92", new string('9', 32)), true]);
            var artworkFavorites = (List<CatalogItem>)Store.GetMethod("GetFavoriteArtworks")!.Invoke(Open(Path.Combine(root, "empty")), null)!;
            Expect(artworkFavorites.Count == 1 && artworkFavorites[0].Key == favoriteItem.Key,
                "Artwork Favorites must survive restart and keep a mirror/idempotent save only once");
            Expect(((SavedWorksSnapshot)Store.GetMethod("GetSavedWorksSnapshot")!.Invoke(empty, ["likes"])!).Items.Count == 0 &&
                ((SavedWorksSnapshot)Store.GetMethod("GetSavedWorksSnapshot")!.Invoke(empty, ["bookmarks"])!).Items.Count == 0,
                "Artwork Favorites must not add likes or bookmarks");
            Store.GetMethod("SetFavoriteArtwork")!.Invoke(empty, [Work("gelbooru", "92", new string('9', 32)), false]);
            Expect(((List<CatalogItem>)Store.GetMethod("GetFavoriteArtworks")!.Invoke(empty, null)!).Count == 0,
                "A favorite artwork can be removed through a matching mirror");
            Expect(Snapshot(empty)["totalWorks"]!.GetValue<int>() == 0 &&
                Snapshot(empty)["trackedSince"] is null, "A fresh profile must not invent previous viewing dates");
            var batched = Open(Path.Combine(root, "batched"));
            Record(batched, Now, (Work("danbooru", "101"), false), (Work("danbooru", "102"), false));
            Expect(Entry(Snapshot(batched), "fern")["lastWorkKey"]!.GetValue<string>() == "danbooru:102",
                "The last actual open in a batch must supply the latest cover");

            var path = Path.Combine(root, "activity");
            var store = Open(path);
            var first = Work("danbooru", "1", new string('a', 32));
            var mirror = Work("gelbooru", "2", new string('a', 32));
            Record(store, Now.AddDays(-3), (first, false));
            Record(store, Now.AddDays(-2), (mirror, false));
            var second = Work("rule34", "3", new string('b', 32));
            Record(store, Now.AddDays(-1), (second, false));
            var summary = Snapshot(store);
            Expect(summary["totalWorks"]!.GetValue<int>() == 2 && Entry(summary, "fern")["count"]!.GetValue<int>() == 2,
                "Same-file mirrors and repeated opens must count as one logical work");
            Expect(Entry(summary, "fern")["activeDays"]!.GetValue<int>() == 3, "Days with actual opens must remain available");
            Expect(!summary["entries"]!.AsArray().OfType<JsonObject>().Any(entry =>
                entry["tag"]!.GetValue<string>() is "sample_artist" or "sample_series"), "Creator and copyright tags are not content favorites");

            var old = Work("danbooru", "9", new string('c', 32));
            Record(store, Now.AddDays(-31), (old, false));
            Record(store, Now.AddMinutes(-1), (Work("sankaku", "newmetadata", new string('d', 32)), true));
            Expect(Snapshot(store)["totalWorks"]!.GetValue<int>() == 2, "Old opens and metadata for unopened works must not inflate statistics");
            var hydrated = Work("rule34", "3", new string('b', 32));
            hydrated.CharacterTags.Add("other_character");
            hydrated.Thumbnail = "https://cdn.donmai.us/preview/refreshed.jpg";
            Record(store, Now, (hydrated, true));
            summary = Snapshot(store);
            Expect(Entry(summary, "other_character")["count"]!.GetValue<int>() == 1 &&
                DateTimeOffset.Parse(Entry(summary, "fern")["lastViewedAt"]!.GetValue<string>()) == Now.AddDays(-1),
                "Late metadata enriches the existing open without creating a new timestamp");
            Expect(summary["works"]!.AsArray().OfType<JsonObject>().Any(work =>
                work["thumbnail"]!.GetValue<string>().EndsWith("refreshed.jpg")), "Latest available preview metadata must survive reopening");
            Expect(summary["works"]!.AsArray().OfType<JsonObject>().All(work =>
                work["creatorTag"]?.GetValue<string>() == "sample_artist"), "Covers must retain attribution needed by hidden-author filters");

            var adult = Work("sankaku", "adult1", new string('e', 32)); adult.Rating = "e";
            Record(store, Now, (adult, false));
            Expect(Snapshot(store, "general")["totalWorks"]!.GetValue<int>() == 2 &&
                Snapshot(store, "explicit")["totalWorks"]!.GetValue<int>() == 1, "Rating filters share the correct work-count denominator and covers");
            Expect(Snapshot(Open(path))["totalWorks"]!.GetValue<int>() == 3, "Actual viewing statistics must survive a process restart");

            var transitive = Open(Path.Combine(root, "transitive"));
            var bridge = Work("sankaku", "bridge", new string('f', 32)); bridge.MemberKeys = ["danbooru:11", "gelbooru:12"];
            Record(transitive, Now, (Work("danbooru", "11"), false), (Work("gelbooru", "12"), false), (bridge, false));
            Expect(Snapshot(transitive)["totalWorks"]!.GetValue<int>() == 1, "Alias deduplication must be transitive");
            var unrelated = Work("rule34", "13"); unrelated.GroupKey = "danbooru:parent:10";
            var unrelated2 = Work("danbooru", "14"); unrelated2.GroupKey = unrelated.GroupKey;
            Record(transitive, Now, (unrelated, false), (unrelated2, false));
            Expect(Snapshot(transitive)["totalWorks"]!.GetValue<int>() == 3, "A weak parent label must not merge unrelated artwork views");

            var logDirectory = Path.Combine(path, "favorite-activity-v1");
            var log = Directory.GetFiles(logDirectory, "*.jsonl").Order().Last();
            File.AppendAllText(log, "\n{broken tail");
            Record(store, Now, (Work("danbooru", "15", new string('1', 32)), false));
            summary = Snapshot(Open(path));
            Expect(summary["totalWorks"]!.GetValue<int>() == 4 && summary["incomplete"]!.GetValue<bool>(),
                "A damaged tail must retain valid older records, accept new opens and report partial statistics");

            var choicesPath = Path.Combine(root, "choices");
            var choices = Open(choicesPath);
            Store.GetMethod("SetFavoriteTag")!.Invoke(choices, ["landscape", true]);
            var before = File.ReadAllBytes(Path.Combine(choicesPath, "favorite-tags.json"));
            Store.GetMethod("SetFavoriteEntity")!.Invoke(choices, ["fern", "character", true]);
            var reopened = Open(choicesPath);
            Expect(Snapshot(reopened)["kinds"]!["fern"]!.GetValue<string>() == "character" &&
                ((List<string>)Store.GetMethod("GetFavoriteTags")!.Invoke(reopened, null)!).SequenceEqual(["landscape", "fern"]),
                "Typed favorites must preserve the existing favorite list and survive restart");
            Store.GetMethod("SetFavoriteEntity")!.Invoke(reopened, ["fern", "character", false]);
            Expect(File.ReadAllBytes(Path.Combine(choicesPath, "favorite-tags.json")).SequenceEqual(before),
                "Removing a character must retain every unrelated existing favorite");
            File.WriteAllText(Path.Combine(choicesPath, "favorite-tags.json"),
                JsonSerializer.Serialize(Enumerable.Range(0, 99).Select(index => "tag_" + index).Prepend("landscape")));
            Expect(Store.GetMethod("SetFavoriteEntity")!.Invoke(reopened, ["over_limit", "character", true]) is null &&
                ((List<string>)Store.GetMethod("GetFavoriteTags")!.Invoke(Open(choicesPath), null)!).Count == 100,
                "The existing 100-favorite limit must preserve every choice on failure");
            File.WriteAllText(Path.Combine(choicesPath, "favorite-kinds-v1.json"), "{damaged");
            var protectedTags = File.ReadAllBytes(Path.Combine(choicesPath, "favorite-tags.json"));
            try { Store.GetMethod("SetFavoriteEntity")!.Invoke(reopened, ["landscape", "character", true]);
                throw new Exception("A damaged classification must reject a write"); }
            catch (TargetInvocationException error) when (error.InnerException is IOException or JsonException) { }
            Expect(File.ReadAllBytes(Path.Combine(choicesPath, "favorite-tags.json")).SequenceEqual(protectedTags), "Corruption must not replace existing favorites");
            Console.WriteLine("Favorites: dated views, mirrors, metadata, rating, restart, damaged-tail recovery and manual choices PASS");
        }
        finally
        {
            var full = Path.GetFullPath(root);
            if (full.StartsWith(Path.GetFullPath(Path.GetTempPath()), StringComparison.OrdinalIgnoreCase) &&
                Path.GetFileName(full).StartsWith("DART-favorites-", StringComparison.Ordinal)) Directory.Delete(full, true);
        }
    }
}
