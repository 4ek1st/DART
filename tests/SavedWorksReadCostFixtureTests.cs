using System.Reflection;
using System.Text.Json.Nodes;
using ArtCatalog;

internal static class SavedWorksReadCostFixtureTests
{
    private static readonly Type Store = typeof(CatalogItem).Assembly.GetType("ArtCatalog.LocalStore")!;

    internal static void Run(string directory)
    {
        Directory.CreateDirectory(directory);
        var file = Path.Combine(directory, "saved-works-v1.json");
        var items = new JsonArray();
        for (var index = 0; index < 2048; index++)
            items.Add(new JsonObject
            {
                ["source"] = "danbooru", ["id"] = index.ToString(), ["key"] = "danbooru:" + index,
                ["title"] = "Synthetic artwork", ["futureMetadata"] = new JsonObject
                { ["retained"] = new string('x', 1024) }
            });
        File.WriteAllText(file, new JsonObject
        {
            ["schemaVersion"] = 1, ["likes"] = items,
            ["bookmarks"] = new JsonArray(items[0]!.DeepClone())
        }.ToJsonString());
        var store = Activator.CreateInstance(Store, [directory])!;
        var refresh = Store.GetMethod("RefreshSavedMetadata")!;
        var ensure = Store.GetMethod("EnsureLike")!;
        var first = new CatalogItem { Source = "danbooru", Id = "0", Key = "danbooru:0" };
        var absent = new CatalogItem { Source = "danbooru", Id = "missing", Key = "danbooru:missing" };
        var before = File.ReadAllBytes(file);
        var originalRevision = ((SavedWorksSnapshot)Store.GetMethod("GetSavedWorksSnapshot")!.Invoke(store, ["likes"])!).Revision;

        // Opening ordinary details or double-clicking an existing like must not
        // allocate another copy of every saved work's metadata. Measure allocation,
        // rather than a wall-clock deadline that depends on the test machine.
        BoundedAllocation(() => refresh.Invoke(store, [absent]), "Unsaved detail refresh copied the saved library");
        BoundedAllocation(() => refresh.Invoke(store, [first]), "Unchanged saved detail copied the saved library");
        BoundedAllocation(() => ensure.Invoke(store, [first]), "Idempotent like copied the saved library");
        Expect(File.ReadAllBytes(file).SequenceEqual(before), "Read-only details and an existing like rewrote the library");
        Expect(((SavedWorksSnapshot)Store.GetMethod("GetSavedWorksSnapshot")!.Invoke(store, ["likes"])!).Revision == originalRevision,
            "Read-only details and an existing like changed the membership revision");

        // A real refresh still writes both collections atomically. If its backup
        // fails, neither the cached copy nor the durable copy may expose the edit.
        var changed = new CatalogItem { Source = first.Source, Id = first.Id, Key = first.Key, CreatorTag = "synthetic_artist" };
        File.Copy(file, file + ".bak");
        using (var blocked = new FileStream(file + ".bak", FileMode.Open, FileAccess.Read, FileShare.None))
        {
            var failed = false;
            try { refresh.Invoke(store, [changed]); }
            catch (TargetInvocationException error) when (error.InnerException is IOException) { failed = true; }
            Expect(failed, "A blocked metadata backup did not report its write failure");
        }
        foreach (var collection in new[] { "likes", "bookmarks" })
            Expect(((SavedWorksSnapshot)Store.GetMethod("GetSavedWorksSnapshot")!.Invoke(store, [collection])!).Items
                .Single(item => item.Key == first.Key).CreatorTag.Length == 0,
                "A failed metadata refresh leaked an uncommitted edit into the cached library");
        Expect(File.ReadAllBytes(file).SequenceEqual(before), "A failed metadata refresh changed the durable library");
        Expect((bool)refresh.Invoke(store, [changed])!, "A committed metadata refresh did not report its edit");
        var reopened = Activator.CreateInstance(Store, [directory])!;
        foreach (var collection in new[] { "likes", "bookmarks" })
            Expect(((SavedWorksSnapshot)Store.GetMethod("GetSavedWorksSnapshot")!.Invoke(reopened, [collection])!).Items
                .Single(item => item.Key == first.Key).CreatorTag == "synthetic_artist",
                "A committed metadata refresh did not survive restart in both collections");
        var durable = JsonNode.Parse(File.ReadAllText(file))!;
        Expect(durable["likes"]!.AsArray().Count == 2048 && durable["likes"]![0]!["futureMetadata"]!["retained"]!.GetValue<string>().Length == 1024 &&
            durable["likes"]![1]!["id"]!.GetValue<string>() == "1", "Metadata refresh lost unknown fields, membership or order");
        Console.WriteLine("Saved-work detail/idempotent read cost and failed metadata write isolation: PASS");
    }

    private static void BoundedAllocation(Action action, string message)
    {
        action();
        var before = GC.GetAllocatedBytesForCurrentThread();
        action();
        var allocated = GC.GetAllocatedBytesForCurrentThread() - before;
        Expect(allocated < 500_000, message + " (allocated " + allocated + " bytes)");
    }

    private static void Expect(bool condition, string message)
    { if (!condition) throw new Exception(message); }
}
