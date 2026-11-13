using System.Reflection;
using System.Diagnostics;
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

    private static string ActivityLine(CatalogItem item, DateTimeOffset at) => JsonSerializer.Serialize(new
        { at, metadataOnly = false, work = item, tokens = new[] { "key:" + item.Key } }, Json);

    private static void ConcurrentSummary(string root)
    {
        var directory = Path.Combine(root, "concurrent-summary");
        var logs = Path.Combine(directory, "favorite-activity-v1");
        Directory.CreateDirectory(logs);
        var dense = Work("danbooru", "12000", new string('a', 32));
        dense.Tags = Enumerable.Range(0, 96).Select(index => "neutral_feature_" + index + "_detail").Prepend("fern").ToList();
        for (var day = 0; day < 4; day++)
        {
            var at = Now.AddDays(-day);
            var line = ActivityLine(dense, at);
            File.WriteAllText(Path.Combine(logs, at.ToString("yyyy-MM-dd") + ".jsonl"), string.Concat(Enumerable.Repeat(line + "\n", 2000)));
        }
        var store = Open(directory);
        var gate = Store.GetField("sync", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(store)!;
        using var finished = new ManualResetEventSlim();
        JsonObject? captured = null; Exception? summaryError = null, writerError = null;
        double summaryMs = 0, relatedMs = 0;
        var reader = new Thread(() => {
            var watch = Stopwatch.StartNew();
            try { captured = Snapshot(store); } catch (Exception error) { summaryError = error; }
            finally { summaryMs = watch.Elapsed.TotalMilliseconds; finished.Set(); }
        }) { IsBackground = true };
        reader.Start();
        var sawCapture = SpinWait.SpinUntil(() => {
            if (finished.IsSet) return true;
            if (!Monitor.TryEnter(gate)) return true;
            Monitor.Exit(gate); return false;
        }, TimeSpan.FromSeconds(10));
        Expect(sawCapture && !finished.IsSet, "The cold activity fixture must reach its capture phase");
        var writer = new Thread(() => {
            var watch = Stopwatch.StartNew();
            try
            {
                _ = Store.GetMethod("GetFavoriteTags")!.Invoke(store, null);
                relatedMs = watch.Elapsed.TotalMilliseconds;
                Record(store, Now, (Work("danbooru", "12001", new string('b', 32), "new_character"), false));
                Store.GetMethod("SetFavoriteEntity")!.Invoke(store, ["new_character", "character", true]);
            }
            catch (Exception error) { writerError = error; }
            finally { if (relatedMs == 0) relatedMs = watch.Elapsed.TotalMilliseconds; }
        }) { IsBackground = true };
        writer.Start();
        Expect(reader.Join(TimeSpan.FromSeconds(30)) && writer.Join(TimeSpan.FromSeconds(30)), "Activity snapshot and concurrent writes must not deadlock");
        if (summaryError is not null) throw summaryError;
        if (writerError is not null) throw writerError;
        Expect(relatedMs < summaryMs * 0.6,
            $"Unrelated reads waited for summary decoding: related={relatedMs:F1}ms, summary={summaryMs:F1}ms");
        Expect(captured!["totalWorks"]!.GetValue<int>() == 1, "A captured log prefix must not absorb a later append");
        var updated = Snapshot(store);
        Expect(updated["totalWorks"]!.GetValue<int>() == 2 && updated["kinds"]!["new_character"]!.GetValue<string>() == "character",
            "An older snapshot must not publish over new activity or classification");
        Console.WriteLine($"Favorites concurrent summary: unrelated reads {relatedMs:F1}ms during {summaryMs:F1}ms decoding; concurrent append, stable prefix and fresh revision PASS");
    }

    private static void SharedRecordWindow(string root)
    {
        var directory = Path.Combine(root, "shared-record-window");
        var logs = Path.Combine(directory, "favorite-activity-v1");
        Directory.CreateDirectory(logs);
        var old = Work("danbooru", "13000", new string('c', 32));
        var present = Work("danbooru", "13001", new string('d', 32));
        var future = Work("danbooru", "13002", new string('e', 32));
        File.WriteAllText(Path.Combine(logs, Now.ToString("yyyy-MM-dd") + ".jsonl"),
            string.Join('\n', ActivityLine(old, Now.AddDays(-30).AddSeconds(3)), ActivityLine(present, Now), ActivityLine(future, Now.AddSeconds(5))) + "\n");
        var store = Open(directory);
        Expect(Snapshot(store)["totalWorks"]!.GetValue<int>() == 2, "Future activity must not count before its actual time");
        Expect(Snapshot(store, "general", Now.AddSeconds(6))["totalWorks"]!.GetValue<int>() == 2,
            "Shared parsed records must expire old activity and include newly eligible future activity");
        Store.GetMethod("SetFavoriteEntity")!.Invoke(store, ["fern", "character", true]);
        Expect(Snapshot(store, "explicit", Now.AddSeconds(7))["kinds"]!["fern"]!.GetValue<string>() == "character",
            "Reusing parsed logs must retain fresh manual classifications");
    }

    internal static void Run()
    {
        Expect(Store.GetMethod("RecordFavoriteActivity") is not null, "Favorites activity method is missing");
        Expect(Store.GetMethod("GetFavoriteActivity") is not null, "Favorites summary method is missing");
        var root = Path.Combine(Path.GetTempPath(), "DART-favorites-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            FavoriteArtworksIdentityFixtureTests.Run(Path.Combine(root, "artwork-identities"));
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
            var precise = Open(Path.Combine(root, "precise"));
            var questionable = Work("sankaku", "q1"); questionable.Rating = "q";
            var explicitWork = Work("gelbooru", "810"); explicitWork.Rating = "e";
            Record(precise, Now, (questionable, false), (explicitWork, false));
            Expect(Snapshot(precise,"questionable")["totalWorks"]!.GetValue<int>() == 1 &&
                Snapshot(precise,"explicit-only")["totalWorks"]!.GetValue<int>() == 1 && Snapshot(precise,"none")["totalWorks"]!.GetValue<int>() == 0,
                "Favorite statistics must follow precise Q/NSFW choices");
            var galleryStore = Open(Path.Combine(root, "gallery"));
            var gallery = Work("danbooru", "899"); gallery.Images = ["https://cdn.donmai.us/a.jpg", "https://cdn.donmai.us/b.jpg"];
            gallery.Published = "2026-11-02"; gallery.MemberKeys = ["danbooru:899", "gelbooru:899"];
            gallery.ImageRecords = gallery.Images.Select(url => new CatalogImageRecord { Url = url, Owner = gallery.Key, Hash = new string('b',32) }).ToList();
            Record(galleryStore, Now, (gallery, false));
            var galleryCover = Snapshot(galleryStore)["works"]![0]!;
            Expect(galleryCover["images"]!.AsArray().Count == 2 && galleryCover["imageRecords"]![1]!["owner"]!.GetValue<string>() == gallery.Key &&
                galleryCover["memberKeys"]!.AsArray().Count == 2 && galleryCover["published"]!.GetValue<string>() == gallery.Published,
                "Shared Favorite covers must retain galleries, source identities and dates");
            Record(batched, Now, (Work("danbooru", "101"), false), (Work("danbooru", "102"), false));
            var projected = Snapshot(batched)["works"]!.AsArray().OfType<JsonObject>().First();
            Expect(projected["allTags"] is JsonArray evidence && evidence.Any(tag => tag?.GetValue<string>() == "fern") &&
                evidence.Any(tag => tag?.GetValue<string>() == "sample_series"), "Cover filtering must retain typed tag evidence independently of content statistics");
            Expect(Entry(Snapshot(batched), "fern")["lastWorkKey"]!.GetValue<string>() == "danbooru:102",
                "The last actual open in a batch must supply the latest cover");
            Record(batched, Now.AddSeconds(1), (Work("danbooru", "101"), false), (Work("danbooru", "102"), false), (Work("danbooru", "101"), false));
            Expect(Entry(Snapshot(batched, at: Now.AddSeconds(1)), "fern")["lastWorkKey"]!.GetValue<string>() == "danbooru:101",
                "A B A must choose A even when one batch uses equal server timestamps");
            var lateTypes = Open(Path.Combine(root, "late-types"));
            var untyped = Work("danbooru", "103"); untyped.CreatorTag = ""; untyped.CopyrightTags = [];
            untyped.Tags.AddRange(["late_artist", "late_series"]); Record(lateTypes, Now, (untyped, false));
            untyped.CreatorTag = "late_artist"; untyped.CopyrightTags = ["late_series"];
            Record(lateTypes, Now.AddSeconds(1), (untyped, true));
            Expect(!Snapshot(lateTypes, at: Now.AddSeconds(1))["entries"]!.AsArray().OfType<JsonObject>().Any(entry =>
                entry["tag"]!.GetValue<string>() is "late_artist" or "late_series"), "Late categories must remove artist/copyright names from content statistics");

            var path = Path.Combine(root, "activity");
            var store = Open(path);
            var first = Work("danbooru", "1", new string('a', 32));
            first.UploaderId = "42";
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
            var unicode = Open(Path.Combine(root, "unicode"));
            var unicodeWorks = Enumerable.Range(700, 5).Select(index => {
                var item = Work("danbooru", index.ToString());
                item.Tags = Enumerable.Range(0, 128).Select(tag => new string('語', 65) + "_" + tag).ToList();
                return (item, false);
            }).ToArray();
            Record(unicode, Now, unicodeWorks);
            Expect(Snapshot(unicode)["totalWorks"]!.GetValue<int>() == 5, "Valid compact Unicode batches must not fail after private filtering metadata expands");
            ConcurrentSummary(root);
            SharedRecordWindow(root);
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
