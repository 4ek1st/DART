using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using ArtCatalog;

internal static class SavedWorksFixtureTests
{
    private static readonly Type Store = typeof(CatalogItem).Assembly.GetType("ArtCatalog.LocalStore")!;
    private static object Open(string directory) => Activator.CreateInstance(Store, [directory])!;
    private static List<CatalogItem> Read(object store, string collection) =>
        (List<CatalogItem>)Store.GetMethod("Get" + collection)!.Invoke(store, null)!;
    private static bool Toggle(object store, string collection, CatalogItem item) =>
        (bool)Store.GetMethod("Toggle" + collection)!.Invoke(store, [item])!;
    private static void Expect(bool condition, string message)
    { if (!condition) throw new Exception(message); }

    internal static void Run()
    {
        var root = Path.Combine(Path.GetTempPath(), "DART-saved-works-" + Guid.NewGuid());
        Directory.CreateDirectory(root);
        try
        {
            var oldFile = Path.Combine(root, "bookmarks-v4.json");
            const string legacy = """
                [{"key":"danbooru:1","source":"danbooru","id":"1","title":"First",
                  "memberKeys":["danbooru:1","sankaku:mirror"],
                  "images":["page1.jpg","page2.jpg"],"tags":["character_name"],
                  "imageRecords":[{"url":"page1.jpg","owner":"danbooru:1"}],
                  "futureField":{"keep":true}},
                 {"key":"rule34:2","source":"rule34","id":"2","title":"Second"}]
                """;
            File.WriteAllText(oldFile, legacy);
            var original = File.ReadAllBytes(oldFile);
            var store = Open(root);
            var libraryFile = Path.Combine(root, "saved-works-v1.json");
            var state = JsonNode.Parse(File.ReadAllText(libraryFile))!;
            Expect(JsonNode.DeepEquals(state["likes"], JsonNode.Parse(legacy)),
                "Migration must retain order, grouped pages, identities and unknown fields exactly");
            Expect(Read(store, "Likes").Count == 2 && Read(store, "Bookmarks").Count == 0,
                "All legacy bookmarks become likes; the new bookmark collection starts empty");
            var backup = Directory.GetFiles(Path.Combine(root, "migration-backups")).Single();
            Expect(File.ReadAllBytes(backup).SequenceEqual(original) &&
                File.ReadAllBytes(oldFile).SequenceEqual(original), "Migration must verify a byte-identical backup and leave the original intact");

            var first = Read(store, "Likes")[0];
            Expect(Toggle(store, "Bookmark", first), "A liked work can also be bookmarked");
            Expect(JsonNode.DeepEquals(JsonNode.Parse(File.ReadAllText(libraryFile))!["likes"], JsonNode.Parse(legacy)),
                "Writing an unrelated collection must preserve every original field in migrated likes");
            Expect(!Toggle(store, "Like", new CatalogItem { Key = "sankaku:mirror", Source = "sankaku", Id = "mirror" }),
                "Unliking a confirmed source mirror must remove the existing group rather than add another like");
            Expect(Read(store, "Likes").Count == 1 && Read(store, "Bookmarks").Count == 1,
                "Unliking a work must retain its independent bookmark");
            Expect(Toggle(store, "Like", first) && !Toggle(store, "Bookmark", first), "Both buttons must toggle independently");
            Expect(Read(store, "Likes").Count == 2 && Read(store, "Bookmarks").Count == 0,
                "Removing a bookmark must retain the like");
            var retained = File.ReadAllBytes(libraryFile);
            var ensure = Store.GetMethod("EnsureLike")!;
            Expect((bool)ensure.Invoke(store, [first])! &&
                (bool)ensure.Invoke(store, [new CatalogItem { Key = "sankaku:mirror", Source = "sankaku", Id = "mirror" }])! &&
                File.ReadAllBytes(libraryFile).SequenceEqual(retained),
                "Repeated image likes and confirmed mirrors must retain the like, original fields and order without a write");
            var concurrent = new CatalogItem { Key = "rule34:3", Source = "rule34", Id = "3" };
            Parallel.For(0, 8, _ => ensure.Invoke(Open(root), [concurrent]));
            Expect(Read(store, "Likes").Count(item => item.Key == concurrent.Key) == 1,
                "Concurrent idempotent likes must add one record and never toggle it back off");
            Toggle(store, "Like", concurrent);
            Toggle(store, "Bookmark", first);
            var refreshed = new CatalogItem { Key = first.Key, Source = first.Source, Id = first.Id,
                CreatorTag = "confirmed_artist", CreatorName = "Confirmed Artist" };
            Store.GetMethod("RefreshSavedMetadata")!.Invoke(store, [refreshed]);
            Expect(Read(store, "Likes")[0].CreatorTag == "confirmed_artist" &&
                Read(store, "Bookmarks")[0].CreatorTag == "confirmed_artist", "Metadata enrichment must update both collections");
            var mediaStore = Open(Path.Combine(root, "cdn-media"));
            const string hash = "702c33e2ba298328287ef45485cb0422";
            var oldVideo = $"https://s.sankakucomplex.com/o/70/2c/{hash}.mp4?e=1&m=old";
            var newVideo = $"https://v.sankakucomplex.com/data/70/2c/{hash}.mp4?e=4102444800&m=fresh";
            var movie = new CatalogItem { Key = "sankaku:k3R9x5dwqrG", Source = "sankaku", Id = "k3R9x5dwqrG",
                CreatorTag = "confirmed_artist", Images = [oldVideo, "https://cdn.donmai.us/variant.jpg"] };
            Toggle(mediaStore, "Like", movie); Toggle(mediaStore, "Bookmark", movie);
            Store.GetMethod("RefreshSavedMetadata")!.Invoke(mediaStore, [new CatalogItem {
                Key = movie.Key, Source = movie.Source, Id = movie.Id, Images = [newVideo] }]);
            foreach (var collection in new[] { "Likes", "Bookmarks" })
            {
                var renewed = Read(Open(Path.Combine(root, "cdn-media")), collection).Single();
                Expect(renewed.Images.SequenceEqual(new[] { newVideo, movie.Images[1] }) && renewed.CreatorTag == movie.CreatorTag,
                    "Moving a signed Sankaku original between CDNs must replace its expired URL, retain its variant and survive restart");
            }
            foreach (var item in Read(store, "Likes")) Toggle(store, "Like", item);
            Expect(Read(Open(root), "Likes").Count == 0 && Read(Open(root), "Bookmarks").Count == 1,
                "Repeated startup must not resurrect removed likes or migrate new bookmarks");
            Expect(Directory.GetFiles(Path.Combine(root, "migration-backups")).Length == 1,
                "Migration must run only once");

            Parallel.For(10, 30, id => Toggle(Open(root), id % 2 == 0 ? "Like" : "Bookmark",
                new CatalogItem { Key = "gelbooru:" + id, Source = "gelbooru", Id = id.ToString() }));
            Expect(Read(store, "Likes").Count == 10 && Read(store, "Bookmarks").Count == 11,
                "Concurrent writers must not overwrite either collection");
            var recoverable = File.ReadAllBytes(libraryFile + ".bak");
            File.WriteAllText(libraryFile, "{broken");
            _ = Open(root);
            Expect(File.ReadAllBytes(libraryFile).SequenceEqual(recoverable) &&
                Directory.GetFiles(root, "saved-works-v1.json.corrupt-*").Length == 1,
                "A corrupt library must recover its last complete backup and preserve damaged bytes");
            File.WriteAllText(libraryFile, "{broken");
            File.WriteAllText(libraryFile + ".bak", "{also broken");
            ExpectOpenFailure(root);
            Expect(File.ReadAllText(libraryFile) == "{broken", "Unreadable collections must not be silently replaced");

            var damagedRoot = Path.Combine(root, "legacy-recovery");
            Directory.CreateDirectory(damagedRoot);
            var damagedFile = Path.Combine(damagedRoot, "bookmarks-v4.json");
            File.WriteAllText(damagedFile, "[null]");
            ExpectOpenFailure(damagedRoot);
            Expect(!File.Exists(Path.Combine(damagedRoot, "saved-works-v1.json")), "Bad migration input must not create an empty library");
            File.WriteAllText(damagedFile + ".bak", legacy);
            Expect(Read(Open(damagedRoot), "Likes").Count == 2 && File.ReadAllText(damagedFile) == "[null]",
                "Legacy migration must recover a valid backup without destroying the damaged original");

            var clean = typeof(CatalogItem).Assembly.GetType("ArtCatalog.CatalogState")!
                .GetMethod("CleanClientState", BindingFlags.NonPublic | BindingFlags.Static)!;
            var session = """{"session":{"activeIndex":1,"tabs":[{"kind":"home"},{"kind":"bookmarks","title":"Закладки","pinned":true,"scrollTop":640}]}}""";
            var migrated = (string)clean.Invoke(null, [session])!;
            var migratedState = JsonNode.Parse(migrated)!;
            Expect(migratedState["session"]!["tabs"]![1]!["kind"]!.GetValue<string>() == "likes" &&
                migratedState["session"]!["tabs"]![1]!["scrollTop"]!.GetValue<int>() == 640 &&
                migratedState["session"]!["activeIndex"]!.GetValue<int>() == 1,
                "Old bookmark tabs must open likes and retain position and active selection");
            migratedState["session"]!["tabs"]!.AsArray().Add(new JsonObject { ["kind"] = "bookmarks" });
            var reopenedState = JsonNode.Parse((string)clean.Invoke(null, [migratedState.ToJsonString()])!)!;
            Expect(reopenedState["session"]!["tabs"]![2]!["kind"]!.GetValue<string>() == "bookmarks",
                "New bookmark tabs must remain bookmarks after restart");
            var updateClient = Store.GetMethod("UpdateClientStateJson")!;
            var readClient = Store.GetMethod("GetClientStateJson")!;
            var largeState = new JsonObject {
                ["clientWriter"] = "test-window", ["clientRevision"] = 1,
                ["session"] = new JsonObject { ["savedWorksVersion"] = 1,
                    ["tabs"] = new JsonArray(new JsonObject { ["kind"] = "likes" }) },
                ["recent"] = new JsonArray(new JsonObject { ["source"] = "sankaku", ["title"] = new string('x', 70000) }),
                ["futureField"] = new JsonObject { ["keep"] = true },
                ["mediaVerifiedImages"] = new JsonArray("https://cdn.donmai.us/first.jpg")
            };
            updateClient.Invoke(store, [largeState.ToJsonString()]);
            updateClient.Invoke(store, ["""{"clientWriter":"test-window","clientRevision":2,"session":{"savedWorksVersion":1,"tabs":[{"kind":"home"}]},"mediaDuplicatePairs":[["https://cdn.donmai.us/first.jpg","https://s.sankakucomplex.com/mirror.jpg"]]}"""]);
            updateClient.Invoke(store, [largeState.ToJsonString()]);
            var restored = JsonNode.Parse((string)readClient.Invoke(store, null)!)!;
            Expect(restored["session"]!["tabs"]![0]!["kind"]!.GetValue<string>() == "home", "A slow old save cannot resurrect closed tabs");
            Expect(restored["recent"]![0]!["title"]!.GetValue<string>().Length == 70000 &&
                restored["futureField"]!["keep"]!.GetValue<bool>() && restored["mediaDuplicatePairs"]!.AsArray().Count == 1 &&
                restored["mediaVerifiedImages"]!.AsArray().Count == 1, "Compact teardown retains large history, duplicate evidence and future fields");
            Console.WriteLine("Saved works migration, independent collections, recovery, concurrent writes and large session persistence: PASS");
        }
        finally { Directory.Delete(root, recursive: true); }
    }

    private static void ExpectOpenFailure(string directory)
    {
        try { _ = Open(directory); throw new Exception("Damaged saved works were accepted"); }
        catch (TargetInvocationException error) when (error.InnerException is InvalidDataException) { }
    }
}
