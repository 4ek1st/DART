using System.Reflection;
using System.Text.Json.Nodes;
using ArtCatalog;

internal static class ProfileTransferFixtureTests
{
    private static readonly Type Store = typeof(CatalogItem).Assembly.GetType("ArtCatalog.LocalStore")!;
    private static readonly Type Codec = typeof(CatalogItem).Assembly.GetType("ArtCatalog.ProfileTransfer")!;
    private static JsonObject Parse(string raw) => (JsonObject)Codec.GetMethod("Parse", BindingFlags.NonPublic | BindingFlags.Static)!.Invoke(null, [raw])!;
    private static object Open(string directory) => Activator.CreateInstance(Store, [directory])!;
    private static JsonObject Import(object store, JsonObject document, bool settings = false) => (JsonObject)Store.GetMethod("ImportProfileTransfer")!.Invoke(store, [document, settings])!;
    private static JsonObject Export(object store) => (JsonObject)Store.GetMethod("ExportProfileTransfer")!.Invoke(store, null)!;
    private static void Expect(bool condition, string message) { if (!condition) throw new Exception(message); }
    private static JsonObject Work(string source, string id, string? hash = null) => new()
    { ["key"] = source + ":" + id, ["source"] = source, ["id"] = id, ["title"] = "Neutral study",
      ["thumbnail"] = "https://cdn.donmai.us/preview/study.jpg", ["images"] = new JsonArray("https://cdn.donmai.us/study.jpg"),
      ["contentHash"] = hash ?? "", ["tags"] = new JsonArray("landscape"), ["rating"] = "g" };
    private static JsonObject Document() => new() { ["format"] = "dart-profile", ["version"] = 1,
        ["likes"] = new JsonArray(Work("danbooru", "100", new string('a', 32))),
        ["bookmarks"] = new JsonArray(Work("rule34", "200")), ["history"] = new JsonArray(Work("gelbooru", "300")),
        ["viewedIdentities"] = new JsonArray("key:gelbooru:300"),
        ["follows"] = new JsonArray(new JsonObject { ["role"] = "artist", ["source"] = "artist", ["artistId"] = "sample_artist", ["name"] = "Sample Artist" },
            new JsonObject { ["role"] = "uploader", ["source"] = "rule34", ["artistId"] = "123", ["name"] = "Uploader" }),
        ["favoriteTags"] = new JsonArray("landscape"), ["recommendationTags"] = new JsonObject { ["landscape"] = "priority" },
        ["preferences"] = new JsonObject { ["hideFurry"] = true, ["excludedTags"] = new JsonArray("sample_blocked"),
            ["curation"] = new JsonObject { ["enabled"] = true } },
        ["recommendationExposureGroups"] = new JsonArray(new JsonArray("danbooru:100", "sankaku:sample100")) };

    internal static void Run()
    {
        var root = Path.Combine(Path.GetTempPath(), "DART-transfer-fixture-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            var store = Open(root); var first = Import(store, Document());
            Expect(first["added"]!["likes"]!.GetValue<int>() == 1 && first["added"]!["bookmarks"]!.GetValue<int>() == 1 &&
                first["added"]!["follows"]!.GetValue<int>() == 2 && first["backupCreated"]!.GetValue<bool>(), "Both collections, subscriptions and backup must be created");
            var exported = Export(store);
            Expect(exported["likes"]!.AsArray().Count == 1 && exported["bookmarks"]!.AsArray().Count == 1, "Likes and bookmarks stay separate");
            Expect(exported["follows"]![0]!["role"]!.GetValue<string>() == "artist" && exported["follows"]![1]!["role"]!.GetValue<string>() == "uploader", "Artist and uploader roles survive roundtrip");
            Expect(exported["viewedIdentities"]!.AsArray().Any(value => value!.GetValue<string>() == "key:gelbooru:300"), "Imported history remains permanently viewed");
            Expect(!exported["preferences"]!.AsObject().ContainsKey("hideFurry"), "Content settings are not applied by default");
            var snapshot = Snapshot(root);
            var repeat = Import(store, Document());
            Expect(!repeat["changed"]!.GetValue<bool>() && repeat["added"]!.AsObject().All(entry => entry.Value!.GetValue<int>() == 0), "Repeated import must be an exact no-op");
            Expect(Same(snapshot, Snapshot(root)), "Repeated imports must not rewrite profile files");
            var alias = Document(); alias["likes"] = new JsonArray(Work("sankaku", "mirror100", new string('a', 32)));
            var duplicate = Import(store, alias);
            Expect(duplicate["added"]!["likes"]!.GetValue<int>() == 0 && Export(store)["likes"]!.AsArray().Count == 1 &&
                Export(store)["likes"]![0]!["memberKeys"]!.AsArray().Any(value => value!.GetValue<string>() == "sankaku:mirror100"), "Exact file copies merge new aliases without duplicating saved works");
            Expect(Export(store)["likes"]![0]!["images"]!.AsArray().Count == 1, "An exact mirrored image must not appear twice in the imported gallery");
            var variant = Document(); variant["likes"]![0]!["images"]!.AsArray().Add("https://cdn.donmai.us/study-variant.jpg");
            variant["likes"]![0]!["imageRecords"] = new JsonArray(new JsonObject { ["url"] = "https://cdn.donmai.us/study.jpg", ["hash"] = new string('a',32) },
                new JsonObject { ["url"] = "https://cdn.donmai.us/study-variant.jpg", ["hash"] = new string('b',32) });
            variant["likes"]![0]!["participants"] = new JsonArray(new JsonObject { ["tag"] = "sample_artist", ["name"] = "Sample Artist", ["role"] = "artist" });
            variant["likes"]![0]!["visualSamples"] = new JsonArray(new JsonObject { ["hash"] = "aaaaaaaaaaaaaaaa", ["perceptualHash"] = "bbbbbbbbbbbbbbbb", ["creator"] = "sample_artist", ["aspectRatio"] = 1.5 });
            variant["likes"]![0]!["groupingVersion"] = 2;
            Import(store, variant);
            Expect(Export(store)["likes"]![0]!["images"]!.AsArray().Count == 2 && !Import(store, variant)["changed"]!.GetValue<bool>(),
                "A genuine new variant merges into an already-liked group exactly once");
            Expect(Export(store)["likes"]![0]!["participants"]!.AsArray().Count == 1 && Export(store)["likes"]![0]!["visualSamples"]![0]!["perceptualHash"]!.GetValue<string>() == "bbbbbbbbbbbbbbbb" &&
                Export(store)["likes"]![0]!["groupingVersion"]!.GetValue<int>() == 2, "Attribution and current grouping evidence are retained when enriching a matching saved work");
            snapshot = Snapshot(root); var broken = Document(); broken["viewedIdentities"] = new JsonArray("key:retired:12");
            ExpectFailure(() => Import(store, broken)); Expect(Same(snapshot, Snapshot(root)), "Invalid input must not mutate any collection");
            broken = Document(); broken["version"] = 999; ExpectFailure(() => Parse(broken.ToJsonString()));
            broken = Document(); broken["likes"]![0]!["key"] = "rule34:100"; ExpectFailure(() => Parse(broken.ToJsonString()));
            var secret = Document(); var item = secret["likes"]![0]!.AsObject(); item["apiKey"] = "private-fixture-secret";
            item["images"] = new JsonArray("https://cdn.donmai.us/study.jpg?api_key=private-fixture-secret", "https://s.sankakucomplex.com/study.jpg?e=4102444800&m=private-fixture-secret");
            item["thumbnail"] = "https://cdn.donmai.us/study.jpg?token=private-fixture-secret";
            secret["settings"] = new JsonObject { ["apiKey"] = "private-fixture-secret" };
            secret["preferences"]!["language"] = "de"; secret["preferences"]!["secureCapture"] = true;
            var sanitized = Parse(secret.ToJsonString());
            Expect(!sanitized.ToJsonString().Contains("private-fixture-secret") && !sanitized["preferences"]!.AsObject().ContainsKey("language"), "Secrets, signed media URLs and device settings never enter the portable document");
            var preferencesPath = Path.Combine(root, "content-preferences.json");
            File.WriteAllText(preferencesPath, "{\"language\":\"de\",\"futureSetting\":true,\"excludedTags\":[\"local_filter\"]}");
            Import(store, Document(), true); var applied = JsonNode.Parse(File.ReadAllText(preferencesPath))!;
            Expect(applied["language"]!.GetValue<string>() == "de" && applied["futureSetting"]!.GetValue<bool>() && applied["hideFurry"]!.GetValue<bool>() && applied["excludedTags"]!.AsArray().Count == 2,
                "Opted-in settings apply while preserving device choices, unknown fields and existing filters");
            var failedRoot = Path.Combine(root, "failed"); Directory.CreateDirectory(failedRoot); var failed = Open(failedRoot);
            File.WriteAllText(Path.Combine(failedRoot, "content-preferences.json"), "{\"hideFurry\":false}");
            Directory.CreateDirectory(Path.Combine(failedRoot, "content-preferences.json.bak"));
            var failedBefore = Snapshot(failedRoot); ExpectFailure(() => Import(failed, Document(), true));
            Expect(Same(failedBefore, Snapshot(failedRoot)), "A later file-write failure must roll back earlier writes and preserve the library");
            var mobile = new JsonObject { ["format"] = "artcatalog-mobile", ["version"] = 2, ["likes"] = new JsonArray(Work("gelbooru", "456")), ["bookmarks"] = new JsonArray(),
                ["follows"] = new JsonArray(new JsonObject { ["key"] = "artist:sample_artist", ["tag"] = "sample_artist", ["name"] = "Sample" }) };
            Expect(Parse(mobile.ToJsonString())["follows"]![0]!["role"]!.GetValue<string>() == "artist", "Legacy Android artist follows import with the correct role");
            Expect(Parse(new JsonArray(Work("danbooru", "999")).ToJsonString())["bookmarks"]!.AsArray().Count == 1, "Legacy bookmark arrays remain importable");
            var manyRoot = Path.Combine(root, "many"); var manyStore = Open(manyRoot); var many = Document();
            many["history"] = new JsonArray(Enumerable.Range(1000, 75).Select(id => (JsonNode)Work("danbooru", id.ToString())).ToArray());
            Import(manyStore, many); var manyExport = Export(manyStore);
            Expect(manyExport["history"]!.AsArray().Count == 40 && manyExport["viewedIdentities"]!.AsArray().Any(value => value!.GetValue<string>() == "key:danbooru:1074"),
                "History beyond the display limit must remain permanently viewed");
            Expect(!Import(manyStore, many)["changed"]!.GetValue<bool>(), "Reimporting history beyond the display limit must not rewrite or resurrect records");
            var emptyRoot = Path.Combine(root, "empty"); var emptyStore = Open(emptyRoot);
            var empty = new JsonObject { ["format"] = "dart-profile", ["version"] = 1 };
            Expect(!Import(emptyStore, empty)["changed"]!.GetValue<bool>(), "An empty valid profile must not rewrite current state");
            var punctuation = Document(); punctuation["recommendationTags"]!["sample/series:tag"] = "priority";
            Expect(Parse(punctuation.ToJsonString())["recommendationTags"]!.AsObject().ContainsKey("sample/series tag"), "Legitimate tag punctuation and the shared recommendation normalization survive transfer");
            var bridgeRoot = Path.Combine(root, "bridge"); Directory.CreateDirectory(bridgeRoot);
            var left = Work("danbooru", "1", new string('a',32)); left["images"] = new JsonArray("https://cdn.donmai.us/1.jpg");
            var right = Work("gelbooru", "2", new string('b',32)); right["images"] = new JsonArray("https://cdn.donmai.us/2.jpg"); right["futureMetadata"] = "keep";
            File.WriteAllText(Path.Combine(bridgeRoot,"saved-works-v1.json"),new JsonObject { ["schemaVersion"] = 1, ["likes"] = new JsonArray(left,right,Work("rule34","3")), ["bookmarks"] = new JsonArray() }.ToJsonString());
            var bridgeStore = Open(bridgeRoot); var bridge = new JsonObject { ["format"]="dart-profile", ["version"]=1, ["likes"]=new JsonArray(Work("danbooru","1",new string('a',32))) };
            bridge["likes"]![0]!["memberKeys"] = new JsonArray("danbooru:1","gelbooru:2"); bridge["likes"]![0]!["images"] = new JsonArray("https://cdn.donmai.us/1.jpg");
            Import(bridgeStore,bridge); var bridged=Export(bridgeStore);
            Expect(bridged["likes"]!.AsArray().Count==2 && bridged["likes"]![0]!["images"]!.AsArray().Count==2 && bridged["likes"]![1]!["key"]!.GetValue<string>()=="rule34:3",
                "An imported alias bridge must combine every matching local group, preserve distinct media and leave unrelated order intact");
            var storedBridge=JsonNode.Parse(File.ReadAllText(Path.Combine(bridgeRoot,"saved-works-v1.json")))!;
            Expect(storedBridge["likes"]![0]!["groupMembers"]!.AsArray().OfType<JsonObject>().Any(member=>member["futureMetadata"]?.GetValue<string>()=="keep"),"Metadata from a bridged local member must survive");
            Expect(!Import(bridgeStore,bridge)["changed"]!.GetValue<bool>(),"Reimporting a transitive alias bridge must be a no-op");
            PublicationBoundaryFixture(Path.Combine(root,"publication-boundary"));
            Console.WriteLine("Profile transfer validation, independent collections, roles, aliases, opt-in settings, idempotence, verified backups and rollback: PASS");
        }
        finally { Directory.Delete(root, true); }
    }
    private static Dictionary<string, byte[]> Snapshot(string root) => Directory.EnumerateFiles(root, "*", SearchOption.TopDirectoryOnly)
        .Where(path => !path.EndsWith(".lock")).ToDictionary(path => Path.GetFileName(path)!, File.ReadAllBytes);
    private static bool Same(Dictionary<string, byte[]> before, Dictionary<string, byte[]> after) => before.Count == after.Count && before.All(entry => after.TryGetValue(entry.Key, out var bytes) && bytes.SequenceEqual(entry.Value));
    private static void ExpectFailure(Action action)
    { try { action(); } catch (Exception error) when (error is TargetInvocationException or InvalidDataException or IOException) { return; } throw new Exception("Expected rejection"); }

    private static void PublicationBoundaryFixture(string root)
    {
        JsonObject Published(string source,string id,string publication,string hash,bool parent=true)
        {
            var work=Work(source,id,hash);work["pixivGroupKey"]="pixiv:"+publication;
            work["images"]=new JsonArray("https://cdn.donmai.us/"+id+".jpg");
            if(parent)work["identityKeys"]=new JsonArray("group:danbooru:parent:77");
            return work;
        }
        JsonObject Bundle(params JsonObject[] works)=>new(){["format"]="dart-profile",["version"]=1,["likes"]=new JsonArray(works.Select(work=>(JsonNode)work).ToArray())};
        var first=Published("danbooru","10","123456",new string('a',32));
        var second=Published("gelbooru","20","654321",new string('b',32));
        var store=Open(root);var document=Bundle(first,second);Import(store,document);
        Expect(Export(store)["likes"]!.AsArray().Count==2,"Different confirmed publications must not merge through a shared legacy parent identity");
        Expect(!Import(store,document)["changed"]!.GetValue<bool>(),"Separate confirmed publications must remain stable on repeated import");
        var samePublicationStore=Open(root+"-same");
        Import(samePublicationStore,Bundle(Published("danbooru","11","123456",new string('c',32),false),Published("rule34","21","123456",new string('d',32),false)));
        Expect(Export(samePublicationStore)["likes"]!.AsArray().Count==1,"Confirmed same-publication variants still merge without relying on parent metadata");
        var exactStore=Open(root+"-exact");
        Import(exactStore,Bundle(Published("danbooru","12","123456",new string('e',32)),Published("rule34","22","654321",new string('e',32))));
        Expect(Export(exactStore)["likes"]!.AsArray().Count==1,"An exact matching file remains stronger evidence than distinct repost publication IDs");
        var urlStore=Open(root+"-urls");var urlA=Published("danbooru","13","123456",new string('a',32));var urlB=Published("rule34","23","654321",new string('b',32));
        urlA.Remove("pixivGroupKey");urlB.Remove("pixivGroupKey");urlA["originalUrl"]="https://www.pixiv.net/en/artworks/123456";urlB["originalUrl"]="https://pixiv.net/artworks/654321";
        Import(urlStore,Bundle(urlA,urlB));Expect(Export(urlStore)["likes"]!.AsArray().Count==2,"Confirmed original publication URLs protect distinct works without a cached publication key");
        var mirrorStore=Open(root+"-mirrors");var mirrorA=Work("sankaku","mirrorA",new string('a',32));var mirrorB=Work("sankaku","mirrorB",new string('b',32));
        mirrorA["identityKeys"]=new JsonArray("group:danbooru:parent:77");mirrorB["identityKeys"]=new JsonArray("group:danbooru:parent:77");
        Import(mirrorStore,Bundle(Published("danbooru","14","123456",new string('a',32)),Published("gelbooru","24","654321",new string('b',32)),mirrorA,mirrorB));
        Expect(Export(mirrorStore)["likes"]!.AsArray().Count==2,"Metadata-poor mirrors cannot transitively bridge conflicting confirmed publications through a weak parent");
        var weakStore=Open(root+"-weak");var weakA=Work("danbooru","15");var weakB=Work("rule34","25");weakA["identityKeys"]=new JsonArray("group:danbooru:parent:77");weakB["identityKeys"]=new JsonArray("group:danbooru:parent:77");
        Import(weakStore,Bundle(weakA,weakB));Expect(Export(weakStore)["likes"]!.AsArray().Count==1,"Legacy parent-only variants still merge when there is no conflicting confirmed publication");
        var viewed=Bundle();viewed["viewedIdentities"]=new JsonArray("group:danbooru:parent:77");Import(store,viewed);
        Expect(Export(store)["viewedIdentities"]!.AsArray().Any(value=>value!.GetValue<string>()=="group:danbooru:parent:77"),"Existing viewed tokens are preserved independently of merge-only safety rules");
    }
}
