using System.Text.Json;
using System.Text.Json.Serialization;

namespace ArtCatalog;

public sealed class FavoriteArtworkGroup
{
    public string Id { get; set; } = "";
    public List<string> Keys { get; set; } = [];
    [JsonExtensionData] public Dictionary<string, JsonElement>? Extensions { get; set; }
}

public sealed class FavoriteArtworkGroupUpdate
{
    public string FromKey { get; set; } = "";
    public string ToKey { get; set; } = "";
    public string? UngroupId { get; set; }
}

internal sealed partial class LocalStore
{
    private sealed class FavoriteGroupDocument
    {
        public int Schema { get; set; } = 1;
        public List<FavoriteArtworkGroup> Groups { get; set; } = [];
        [JsonExtensionData] public Dictionary<string, JsonElement>? Extensions { get; set; }
    }
    private string FavoriteGroupsFile => Path.Combine(directory, "favorite-artwork-groups-v1.json");
    private static FavoriteGroupDocument ReadFavoriteGroups(string path)
    {
        if (!File.Exists(path)) return new();
        if (new FileInfo(path).Length > 2_000_000) throw new IOException("Favorite groups are too large.");
        var document = JsonSerializer.Deserialize<FavoriteGroupDocument>(File.ReadAllBytes(path), FavoriteJson);
        if (document is null || document.Schema != 1 || document.Groups is not { Count: <= 1000 } ||
            document.Groups.Any(group => group is null || !Guid.TryParseExact(group.Id, "N", out _) ||
                group.Keys is not { Count: >= 2 and <= 200 } || group.Keys.Any(key => key is not { Length: > 0 and <= 200 } || key.Any(char.IsControl)) ||
                group.Keys.Distinct(StringComparer.Ordinal).Count() != group.Keys.Count) ||
            document.Groups.Select(group => group.Id).Distinct(StringComparer.Ordinal).Count() != document.Groups.Count ||
            document.Groups.SelectMany(group => group.Keys).Distinct(StringComparer.Ordinal).Count() != document.Groups.Sum(group => group.Keys.Count))
            throw new JsonException("Invalid Favorite groups.");
        return document;
    }
    public List<FavoriteArtworkGroup> GetFavoriteArtworkGroups()
    {
        lock (sync)
        {
            using var fileLock = AcquireFileLock(Path.Combine(directory, "favorite-artworks.lock"));
            try { return ReadFavoriteGroups(File.Exists(FavoriteGroupsFile) ? FavoriteGroupsFile : FavoriteGroupsFile + ".bak").Groups; }
            catch (Exception error) when (error is JsonException or IOException)
            {
                if (!File.Exists(FavoriteGroupsFile + ".bak")) throw;
                return ReadFavoriteGroups(FavoriteGroupsFile + ".bak").Groups;
            }
        }
    }
    public List<FavoriteArtworkGroup> GroupFavoriteArtworks(string fromKey, string toKey, string? ungroupId = null)
    {
        lock (sync)
        {
            using var fileLock = AcquireFileLock(Path.Combine(directory, "favorite-artworks.lock"));
            // Writes fail closed on damaged state; never replace the only good backup.
            if (!File.Exists(FavoriteGroupsFile) && File.Exists(FavoriteGroupsFile + ".bak"))
                throw new IOException("Favorite groups need recovery.");
            var document = ReadFavoriteGroups(FavoriteGroupsFile);
            if (ungroupId is not null)
            {
                if (!Guid.TryParseExact(ungroupId, "N", out _)) throw new ArgumentException("Invalid group.");
                if (document.Groups.RemoveAll(group => group.Id == ungroupId) == 0) return document.Groups;
            }
            else
            {
                var saved = FavoriteArtworkLibrary.Get("bookmarks");
                var lookup = new Dictionary<string, string>(StringComparer.Ordinal);
                foreach (var work in saved) foreach (var key in work.MemberKeys.Prepend(work.Key)) lookup.TryAdd(key, work.Key);
                string Resolve(string key) => key is { Length: > 0 and <= 200 } && lookup.TryGetValue(key, out var canonical) ? canonical : "";
                var from = Resolve(fromKey); var to = Resolve(toKey);
                if (from.Length == 0 || to.Length == 0) throw new ArgumentException("Only saved Favorite artworks can be grouped.");
                if (from == to) return document.Groups;
                var source = document.Groups.FirstOrDefault(group => group.Keys.Any(key => Resolve(key) == from));
                var target = document.Groups.FirstOrDefault(group => group.Keys.Any(key => Resolve(key) == to));
                if (source is not null && source == target) return document.Groups;
                var keys = (target?.Keys ?? [to]).Concat(source?.Keys ?? [from]).Select(Resolve)
                    .Where(key => key.Length > 0).Distinct(StringComparer.Ordinal).ToList();
                if (keys.Count > 200) throw new ArgumentException("A group can contain up to 200 artworks.");
                if (target is null && source is null && document.Groups.Count >= 1000) throw new ArgumentException("Too many groups.");
                if (source is not null) document.Groups.Remove(source);
                if (target is null) document.Groups.Add(new FavoriteArtworkGroup { Id = Guid.NewGuid().ToString("N"), Keys = keys });
                else target.Keys = keys;
            }
            var bytes = JsonSerializer.SerializeToUtf8Bytes(document, FavoriteJson);
            if (bytes.Length > 2_000_000) throw new ArgumentException("Favorite groups are too large.");
            WriteAtomic(FavoriteGroupsFile, bytes);
            return document.Groups;
        }
    }
}
