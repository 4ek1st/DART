using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace ArtCatalog;

internal sealed class SavedWorksStore
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> ProcessLocks = new(StringComparer.OrdinalIgnoreCase);
    private readonly string directory;
    private readonly string path;
    private readonly string lockPath;

    public SavedWorksStore(string directory)
    {
        this.directory = directory;
        path = Path.Combine(directory, "saved-works-v1.json");
        // Older DART versions use this lock for the migration source.
        lockPath = Path.Combine(directory, "bookmarks-v4.lock");
        using var fileLock = AcquireLock();
        if (File.Exists(path) || File.Exists(path + ".bak")) _ = Read();
        else MigrateBookmarks();
    }

    public List<CatalogItem> Get(string collection)
    {
        using var fileLock = AcquireLock();
        return Read()[collection]!.Deserialize<List<CatalogItem>>(Json)!
            .Where(item => CatalogState.IsSupported(item.Source)).ToList();
    }

    public bool Toggle(string collection, CatalogItem item) => Update(collection, item, ensureSaved: false);

    public bool EnsureSaved(string collection, CatalogItem item) => Update(collection, item, ensureSaved: true);

    private bool Update(string collection, CatalogItem item, bool ensureSaved)
    {
        using var fileLock = AcquireLock();
        var state = Read();
        var items = (JsonArray)state[collection]!;
        var keys = item.MemberKeys.Append(item.Key).ToHashSet(StringComparer.Ordinal);
        var existing = items.OfType<JsonObject>().Where(saved =>
            keys.Contains(saved["key"]?.GetValue<string>() ?? "") ||
            saved["memberKeys"] is JsonArray members && members.Any(key =>
                key is JsonValue value && value.TryGetValue<string>(out var text) && keys.Contains(text))).ToArray();
        // Double-click likes are idempotent even with stale clients or concurrent windows.
        // Keep existing metadata, unknown fields and library order byte-for-byte.
        if (ensureSaved && existing.Length > 0) return true;
        foreach (var saved in existing) items.Remove(saved);
        if (existing.Length == 0) items.Insert(0, JsonSerializer.SerializeToNode(item, Json));
        Write(state);
        return existing.Length == 0;
    }

    public bool RefreshMetadata(CatalogItem item, Func<JsonObject, bool> update)
    {
        using var fileLock = AcquireLock();
        var state = Read();
        var changed = false;
        foreach (var collection in new[] { "likes", "bookmarks" })
            foreach (var saved in ((JsonArray)state[collection]!).OfType<JsonObject>().Where(saved =>
                saved["key"]?.GetValue<string>() == item.Key &&
                saved["source"]?.GetValue<string>() == item.Source &&
                saved["id"]?.GetValue<string>() == item.Id || saved["groupMembers"] is JsonArray members &&
                members.OfType<JsonObject>().Any(member => member["key"]?.GetValue<string>() == item.Key &&
                    member["source"]?.GetValue<string>() == item.Source && member["id"]?.GetValue<string>() == item.Id)))
                changed |= update(saved);
        if (changed) Write(state);
        return changed;
    }

    public bool RepairGroup(CatalogItem expected, List<CatalogItem> groups)
    {
        static HashSet<string> Keys(CatalogItem item) => item.MemberKeys.Append(item.Key).ToHashSet(StringComparer.Ordinal);
        var expectedKeys = Keys(expected);
        if (groups.Count is < 1 or > 100 || !expectedKeys.SetEquals(groups.SelectMany(group => Keys(group))))
            throw new InvalidDataException("Repair must retain every saved member.");
        using var fileLock = AcquireLock();
        var state = Read(); var changed = false;
        foreach (var collection in new[] { "likes", "bookmarks" })
        {
            var items = (JsonArray)state[collection]!;
            for (var index = 0; index < items.Count; index++)
            {
                if (items[index] is not JsonObject saved || saved["key"]?.GetValue<string>() != expected.Key) continue;
                var current = saved.Deserialize<CatalogItem>(Json)!;
                if (current.GroupingVersion >= 2 && groups.Count == 1 || !expectedKeys.SetEquals(Keys(current))) continue;
                if (!changed)
                {
                    var backupDirectory = Path.Combine(directory, "migration-backups"); Directory.CreateDirectory(backupDirectory);
                    if (!Directory.EnumerateFiles(backupDirectory, "saved-works-before-grouping-*.json").Any())
                    {
                        var bytes = File.ReadAllBytes(path);
                        var hash = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
                        var backup = Path.Combine(backupDirectory, "saved-works-before-grouping-" + hash + ".json");
                        File.WriteAllBytes(backup, bytes);
                        if (!File.ReadAllBytes(backup).SequenceEqual(bytes)) throw new IOException("Grouping backup failed verification.");
                    }
                }
                // Clone the original so unknown user fields survive for every
                // split member. Only matching, still-saved groups are replaced.
                var ordered = groups.OrderByDescending(group => Keys(group).Contains(expected.Key)).ToArray();
                items.RemoveAt(index);
                for (var offset = 0; offset < ordered.Length; offset++)
                {
                    var next = saved.DeepClone().AsObject();
                    foreach (var field in JsonSerializer.SerializeToNode(ordered[offset], Json)!.AsObject())
                        next[field.Key] = field.Value?.DeepClone();
                    items.Insert(index + offset, next);
                }
                index += ordered.Length - 1; changed = true;
            }
        }
        if (changed) Write(state);
        return changed;
    }

    private void MigrateBookmarks()
    {
        JsonArray likes = [];
        var legacy = Path.Combine(directory, "bookmarks-v4.json");
        if (!File.Exists(legacy) && !File.Exists(legacy + ".bak")) legacy = Path.Combine(directory, "bookmarks.json");
        var candidates = new[] { legacy, legacy + ".bak" }.Where(File.Exists).ToArray();
        if (candidates.Length > 0)
        {
            byte[]? validBytes = null;
            foreach (var candidate in candidates)
            {
                var bytes = File.ReadAllBytes(candidate);
                try
                {
                    if (JsonNode.Parse(bytes) is not JsonArray array) continue;
                    ValidateItems(array);
                    likes = array;
                    validBytes = bytes;
                    break;
                }
                catch (JsonException) { }
            }
            if (validBytes is null)
                throw new InvalidDataException("Не удалось прочитать сохранённые работы для переноса. Исходные файлы сохранены.");
            var backupDirectory = Path.Combine(directory, "migration-backups");
            Directory.CreateDirectory(backupDirectory);
            var hash = Convert.ToHexString(SHA256.HashData(validBytes)).ToLowerInvariant();
            var backup = Path.Combine(backupDirectory, "bookmarks-before-likes-" + hash + ".json");
            if (!File.Exists(backup))
            {
                var temporary = backup + ".tmp-" + Guid.NewGuid().ToString("N");
                try
                {
                    File.WriteAllBytes(temporary, validBytes);
                    File.Move(temporary, backup);
                }
                finally { if (File.Exists(temporary)) File.Delete(temporary); }
            }
            if (!File.ReadAllBytes(backup).SequenceEqual(validBytes))
                throw new IOException("Резервная копия сохранённых работ не прошла проверку.");
        }
        // One atomic file makes the split all-or-nothing. The legacy file stays intact.
        Write(new JsonObject { ["schemaVersion"] = 1, ["likes"] = likes, ["bookmarks"] = new JsonArray() });
        File.Copy(path, path + ".bak", overwrite: false);
    }

    private JsonObject Read()
    {
        foreach (var candidate in new[] { path, path + ".bak" })
        {
            if (!File.Exists(candidate)) continue;
            try
            {
                var state = JsonNode.Parse(File.ReadAllBytes(candidate)) as JsonObject;
                if (state?["schemaVersion"]?.GetValue<int>() != 1 ||
                    state["likes"] is not JsonArray likes || state["bookmarks"] is not JsonArray bookmarks)
                    throw new JsonException();
                ValidateItems(likes);
                ValidateItems(bookmarks);
                if (candidate != path)
                {
                    if (File.Exists(path)) File.Copy(path, path + ".corrupt-" + Guid.NewGuid().ToString("N"));
                    File.Copy(candidate, path, overwrite: true);
                }
                return state;
            }
            catch (Exception error) when (error is JsonException or InvalidOperationException or FormatException) { }
        }
        throw new InvalidDataException("Не удалось прочитать лайки и закладки. Файлы сохранены для восстановления.");
    }

    private void Write(JsonObject state)
    {
        var temporary = path + ".tmp-" + Guid.NewGuid().ToString("N");
        try
        {
            File.WriteAllBytes(temporary, JsonSerializer.SerializeToUtf8Bytes(state, Json));
            if (File.Exists(path)) File.Copy(path, path + ".bak", overwrite: true);
            File.Move(temporary, path, overwrite: true);
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }

    private static void ValidateItems(JsonArray array)
    {
        if (array.Any(item => item is not JsonObject)) throw new JsonException();
        _ = array.Deserialize<List<CatalogItem>>(Json) ?? throw new JsonException();
    }

    private IDisposable AcquireLock()
    {
        var gate = ProcessLocks.GetOrAdd(Path.GetFullPath(lockPath), _ => new SemaphoreSlim(1, 1));
        // Metadata repair and UI reads share this queue. A legitimate slow
        // write in this process must not consume the external-file retry limit.
        gate.Wait();
        try
        {
            for (var attempt = 0; ; attempt++)
                try { return new StoreLock(new FileStream(lockPath, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None), gate); }
                catch (IOException) when (attempt < 49) { Thread.Sleep(50); }
        }
        catch { gate.Release(); throw; }
    }

    private sealed class StoreLock(FileStream file, SemaphoreSlim gate) : IDisposable
    {
        private int disposed;
        public void Dispose()
        {
            if (Interlocked.Exchange(ref disposed, 1) != 0) return;
            try { file.Dispose(); }
            finally { gate.Release(); }
        }
    }
}
