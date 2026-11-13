using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using ArtCatalog;

internal static class LocalDocumentCacheFixtureTests
{
    private static readonly Type Store = typeof(CatalogItem).Assembly.GetType("ArtCatalog.LocalStore")!;
    private static object Open(string path) => Activator.CreateInstance(Store, [path])!;
    private static object? Call(object store, string name, params object?[] args) => Store.GetMethod(name)!.Invoke(store, args);
    private static void Expect(bool value, string message) { if (!value) throw new Exception(message); }

    internal static void Run()
    {
        var root = Path.Combine(Path.GetTempPath(), "DART-document-cache-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            History(Path.Combine(root, "history"));
            Sessions(Path.Combine(root, "sessions"));
            IndependentLocks(Path.Combine(root, "locks"));
            Console.WriteLine("Viewed/session cache invalidation, no-op cost, failed-commit safety and independent file ownership: PASS");
        }
        finally { Directory.Delete(root, true); }
    }

    private static void History(string directory)
    {
        Directory.CreateDirectory(directory);
        var path = Path.Combine(directory, "viewed-identities.json");
        File.WriteAllText(path, JsonSerializer.Serialize(Enumerable.Range(0, 100000).Select(i => "key:danbooru:" + i).Append("key:future:preserved")));
        var store = Open(directory);
        List<string> Read() => (List<string>)Call(store, "GetViewedTokens")!;
        var first = Read(); first.Clear();
        Expect(Read().Count == 100000, "A caller must not mutate the viewed index");
        var before = File.ReadAllBytes(path); var stamp = File.GetLastWriteTimeUtc(path);
        Call(store, "AddViewedTokens", new List<string> { "key:danbooru:1" });
        var allocated = GC.GetAllocatedBytesForCurrentThread();
        for (var i = 0; i < 100; i++) Call(store, "AddViewedTokens", new List<string> { "key:danbooru:1" });
        var cost = GC.GetAllocatedBytesForCurrentThread() - allocated;
        Expect(cost < 2_000_000, $"Known viewed identities must reuse the large index; allocated {cost} bytes");
        Expect(before.SequenceEqual(File.ReadAllBytes(path)) && stamp == File.GetLastWriteTimeUtc(path), "Known identities must not rewrite history");
        Call(store, "AddViewedTokens", new List<string> { "key:danbooru:100001", "key:danbooru:100001" });
        Expect(JsonNode.Parse(File.ReadAllText(path))!.AsArray().Any(value => value!.GetValue<string>() == "key:future:preserved"),
            "Adding a viewed identity must not erase unsupported legacy records from the private file");
        var second = Open(directory);
        Call(second, "AddViewedTokens", new List<string> { "key:rule34:100002" });
        Expect(Read().Count == 100002 && Read().Contains("key:rule34:100002"), "Another store's atomic append must invalidate the cached identities");
        var external = JsonNode.Parse(File.ReadAllText(path))!.AsArray();
        external[0] = "key:danbooru:9"; // Same-length direct replacement of one token.
        File.WriteAllText(path, external.ToJsonString()); File.SetLastWriteTimeUtc(path, DateTime.UtcNow.AddSeconds(1));
        Expect(!Read().Contains("key:danbooru:0"), "Same-size external edits must not preserve a stale membership index");
        File.Delete(path + ".bak"); Directory.CreateDirectory(path + ".bak");
        try { Call(store, "AddViewedTokens", new List<string> { "key:danbooru:999999" }); throw new Exception("Expected atomic-write failure"); }
        catch (TargetInvocationException error) when (error.InnerException is IOException or UnauthorizedAccessException) { }
        Expect(!Read().Contains("key:danbooru:999999"), "A failed history write cannot publish an unsaved identity into the cache");
        Directory.Delete(path + ".bak");
    }

    private static void Sessions(string directory)
    {
        var store = Open(directory);
        var path = Path.Combine(directory, "client-state-v4.json");
        var first = """{"clientWriter":"neutral","clientRevision":1,"session":{"savedWorksVersion":1,"tabs":[{"kind":"likes"}]},"future":{"keep":true},"recent":[{"key":"danbooru:1","source":"danbooru","id":"1"}]}""";
        Call(store, "UpdateClientStateJson", first);
        var bytes = File.ReadAllBytes(path); var stamp = File.GetLastWriteTimeUtc(path);
        var clean = (string)Call(store, "GetClientStateJson")!;
        Expect(ReferenceEquals(clean, Call(store, "GetClientStateJson")), "An unchanged session read must reuse validated immutable JSON");
        for (var i = 0; i < 5; i++) Call(store, "UpdateClientStateJson", first);
        Expect(bytes.SequenceEqual(File.ReadAllBytes(path)) && stamp == File.GetLastWriteTimeUtc(path), "An identical session save must not write or rotate its backup");
        var second = Open(directory);
        Call(second, "UpdateClientStateJson", """{"clientWriter":"neutral","clientRevision":2,"session":{"savedWorksVersion":1,"tabs":[{"kind":"home"}]}}""");
        Call(store, "UpdateClientStateJson", first);
        var current = JsonNode.Parse((string)Call(store, "GetClientStateJson")!)!;
        Expect(current["session"]!["tabs"]![0]!["kind"]!.GetValue<string>() == "home", "A cached old input must not bypass revision validation after an external save");
        Expect(current["future"]!["keep"]!.GetValue<bool>() && current["recent"]!.AsArray().Count == 1, "Compact saves preserve omitted unknown fields and history");
        // Import owns the same file locks and legacy recommendation choices may
        // live in client state. Its fallback must not reacquire that file lock.
        var legacy = JsonNode.Parse(File.ReadAllText(path))!.AsObject();
        legacy["recommendationTagPreferences"] = new JsonObject { ["neutral tag"] = "priority" };
        File.WriteAllText(path, legacy.ToJsonString()); File.SetLastWriteTimeUtc(path, DateTime.UtcNow.AddSeconds(1));
        var document = new JsonObject { ["format"] = "dart-profile", ["version"] = 1 };
        var import = Task.Run(() => Call(store, "ImportProfileTransfer", document, false));
        Expect(import.Wait(TimeSpan.FromSeconds(3)), "Legacy session preference fallback must not deadlock profile transfer");
        var exported = (JsonObject)Call(store, "ExportProfileTransfer")!;
        Expect(exported["recommendationTags"]!["neutral tag"]!.GetValue<string>() == "priority", "Export preserves valid legacy recommendation preferences");
        File.WriteAllText(Path.Combine(directory, "recommendation-tag-preferences.json"), "{\"broken\":4}");
        File.WriteAllText(Path.Combine(directory, "recommendation-tag-preferences.json.bak"), "{\"rescued\":\"priority\"}");
        exported = (JsonObject)Call(store, "ExportProfileTransfer")!;
        Expect(exported["recommendationTags"]!["rescued"]!.GetValue<string>() == "priority", "Captured export retains recommendation-preference backup recovery");
    }

    private static void IndependentLocks(string directory)
    {
        var store = Open(directory);
        var global = Store.GetField("sync", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(store)!;
        // These owned operations must proceed even while an unrelated setting
        // transaction holds the global monitor. This is a dependency check,
        // not a wall-time performance claim.
        foreach (var action in new Action[] {
            () => Call(store, "AddViewedTokens", new List<string> { "key:danbooru:55" }),
            () => Call(store, "UpdateClientStateJson", """{"clientWriter":"locks","clientRevision":1}"""),
            () => Call(store, "GetClientStateJson"),
            () => Call(store, "ExportProfileTransfer") })
        {
            Task operation;
            lock (global)
            {
                operation = Task.Factory.StartNew(action, CancellationToken.None, TaskCreationOptions.LongRunning, TaskScheduler.Default);
                Expect(operation.Wait(TimeSpan.FromSeconds(3)), "An independent document operation waited for the global profile monitor");
            }
            operation.GetAwaiter().GetResult();
        }
    }
}
