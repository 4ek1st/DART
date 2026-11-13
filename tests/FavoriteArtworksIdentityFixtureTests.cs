using System.Diagnostics;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using ArtCatalog;

internal static class FavoriteArtworksIdentityFixtureTests
{
    private static readonly Type Store = typeof(CatalogItem).Assembly.GetType("ArtCatalog.LocalStore")!;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static object Open(string directory) => Activator.CreateInstance(Store, [directory])!;
    private static List<CatalogItem> Set(object store, CatalogItem item, bool favorite) =>
        (List<CatalogItem>)Store.GetMethod("SetFavoriteArtwork")!.Invoke(store, [item, favorite])!;
    private static void Expect(bool value, string message) { if (!value) throw new Exception(message); }
    private static CatalogItem Work(int id) => new() { Source = "danbooru", Id = id.ToString(), Key = "danbooru:" + id,
        Title = "Neutral " + id, Rating = "g", Thumbnail = "https://cdn.donmai.us/" + id + ".jpg",
        Tags = Enumerable.Range(0, 64).Select(i => "neutral_tag_" + i).ToList() };

    internal static void Run(string directory)
    {
        var owned = Path.Combine(directory, "favorite-artworks-v1"); Directory.CreateDirectory(owned);
        var file = Path.Combine(owned, "saved-works-v1.json");
        var works = Enumerable.Range(1, 1000).Select(Work).ToArray();
        works[0].ContentHash = new string('a', 32);
        var bookmarks = JsonSerializer.SerializeToNode(works, Json)!.AsArray();
        bookmarks[0]!["futureIdentityField"] = "preserved";
        File.WriteAllText(file, new JsonObject { ["schemaVersion"] = 1, ["likes"] = new JsonArray(), ["bookmarks"] = bookmarks }.ToJsonString());
        var store = Open(directory); var before = File.ReadAllBytes(file); var stamp = File.GetLastWriteTimeUtc(file);
        var result = Set(store, works[999], true);
        Expect(result.Count == 1000, "An already-saved Favorite cannot duplicate a dense library");
        var elapsed = Stopwatch.StartNew();
        for (var i = 0; i < 8; i++) _ = Set(store, works[999], true);
        elapsed.Stop();
        Expect(File.ReadAllBytes(file).SequenceEqual(before) && File.GetLastWriteTimeUtc(file) == stamp,
            "No-op Favorite saves must preserve bytes, unknown fields and file modification time");
        Console.WriteLine($"Favorite artworks: 1000 dense records, warm idempotent setter {elapsed.Elapsed.TotalMilliseconds / 8:F2}ms; exact unchanged file PASS");
        var mirror = Work(1001); mirror.Source = "gelbooru"; mirror.Key = "gelbooru:1001"; mirror.ContentHash = works[0].ContentHash;
        Expect(Set(store, mirror, true).Count == 1000, "A cross-source file hash must reuse the saved Favorite");
        var writer = Open(directory); var external = Work(2001); external.ContentHash = new string('b', 32);
        Set(writer, external, true);
        var externalMirror = Work(2002); externalMirror.Source = "rule34"; externalMirror.Key = "rule34:2002"; externalMirror.ContentHash = external.ContentHash;
        var changed = Set(store, externalMirror, true);
        Expect(changed.Count == 1001 && changed.Any(work => work.Key == external.Key),
            "A cached identity index must detect another store's added artwork without duplicating its mirror");
        Expect(Set(store, externalMirror, false).Count == 1000, "Removal by an externally-added mirror must remove its actual primary");
        var weak = Work(3001); weak.GroupKey = "danbooru:parent:123";
        var different = Work(3002); different.GroupKey = weak.GroupKey;
        Set(store, weak, true); Expect(Set(store, different, true).Count == 1002,
            "A shared weak provider parent alone cannot identify two Favorites as the same work");
        Expect(Set(store, weak, false).Any(work => work.Key == different.Key), "Removing one weak-parent work must retain the other");
        var overlapDirectory = Path.Combine(directory, "overlap"); var overlapOwned = Path.Combine(overlapDirectory, "favorite-artworks-v1");
        Directory.CreateDirectory(overlapOwned);
        var first = Work(1); first.MemberKeys = ["danbooru:2"]; var second = Work(2);
        File.WriteAllText(Path.Combine(overlapOwned, "saved-works-v1.json"), new JsonObject { ["schemaVersion"] = 1,
            ["likes"] = new JsonArray(), ["bookmarks"] = JsonSerializer.SerializeToNode(new[] { first, second }, Json) }.ToJsonString());
        var overlap = Open(overlapDirectory);
        Expect(Set(overlap, first, false).Count == 0,
            "Removing overlapping legacy Favorites must never toggle a removed key back into an empty record");
        Expect(Set(overlap, first, false).Count == 0, "Repeated removal is idempotent");
    }
}
