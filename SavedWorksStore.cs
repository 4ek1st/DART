using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Runtime.CompilerServices;

namespace ArtCatalog;

public sealed record SavedWorksSnapshot(List<CatalogItem> Items, string Revision);
public sealed record SavedWorkChange(bool Saved, string PreviousRevision, string Revision);
public sealed record SavedWorksJsonSnapshot(ReadOnlyMemory<byte> Json, string Revision);

internal sealed class SavedWorksStore
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private static readonly JsonSerializerOptions ApiJson = new(JsonSerializerDefaults.Web);
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> ProcessLocks = new(StringComparer.OrdinalIgnoreCase);
    private readonly string directory;
    private readonly string path;
    private readonly string lockPath;
    private JsonObject? cachedState;
    private (long Length, long Modified, long Created) cachedStamp;
    private string revision = Guid.NewGuid().ToString("N");
    private readonly ConditionalWeakTable<JsonObject, RecordSnapshot> recordSnapshots = new();
    private readonly ConditionalWeakTable<JsonArray, byte[]> responseSnapshots = new();
    private readonly Dictionary<string, IdentityIndex> identityIndexes = new(StringComparer.Ordinal);
    private sealed class RecordSnapshot(CatalogItem item)
    {
        internal readonly CatalogItem Item = item;
        internal ReadOnlyMemory<byte>? Json;
    }
    private sealed record IdentityIndex(JsonArray Items, Func<JsonObject, IEnumerable<string>> Tokens,
        Dictionary<string, HashSet<string>> Keys);

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

    public List<CatalogItem> Get(string collection) => GetSnapshot(collection).Items;

    public SavedWorksSnapshot GetSnapshot(string collection)
    {
        using var fileLock = AcquireLock();
        var items = ((JsonArray)Read()[collection]!).OfType<JsonObject>()
            .Select(Record).Where(record => CatalogState.IsSupported(record.Item.Source))
            .Select(record => record.Item.SnapshotCopy()).ToList();
        return new(items, revision);
    }

    public SavedWorksJsonSnapshot GetJsonSnapshot(string collection)
    {
        using var fileLock = AcquireLock();
        var items = (JsonArray)Read()[collection]!;
        // API data keeps the CatalogItem allowlist; unknown persisted fields
        // remain on disk, and never escape through a new raw JSON endpoint.
        var bytes = responseSnapshots.GetValue(items, values => JsonSerializer.SerializeToUtf8Bytes(
            values.OfType<JsonObject>().Select(Record).Select(record => record.Item)
                .Where(item => CatalogState.IsSupported(item.Source)), ApiJson));
        return new(bytes, revision);
    }

    internal List<string> FindMatchingKeys(string collection, IReadOnlySet<string> tokens,
        Func<JsonObject, IEnumerable<string>> tokenReader)
    {
        using var fileLock = AcquireLock();
        var items = (JsonArray)Read()[collection]!;
        if (!identityIndexes.TryGetValue(collection, out var index) ||
            !ReferenceEquals(index.Items, items) || !index.Tokens.Equals(tokenReader))
        {
            var keys = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
            foreach (var item in items.OfType<JsonObject>())
                foreach (var token in tokenReader(item))
                {
                    if (!keys.TryGetValue(token, out var owners)) keys[token] = owners = new(StringComparer.Ordinal);
                    owners.Add(SavedText(item, "key"));
                }
            index = new(items, tokenReader, keys);
            identityIndexes[collection] = index;
        }
        var matches = new HashSet<string>(StringComparer.Ordinal);
        foreach (var token in tokens) if (index.Keys.TryGetValue(token, out var keys)) matches.UnionWith(keys);
        return matches.Where(key => key.Length > 0).ToList();
    }

    public bool Toggle(string collection, CatalogItem item) => Change(collection, item, ensureSaved: false).Saved;

    public bool EnsureSaved(string collection, CatalogItem item) => Change(collection, item, ensureSaved: true).Saved;

    // The profile exchange holds this lock across all profile files. Normal
    // saved-work readers/writers wait until the additive transaction completes.
    internal IDisposable AcquireProfileTransferLock() => AcquireLock();
    internal JsonObject ProfileTransferSnapshot() => Read().DeepClone().AsObject();
    // Caller holds AcquireProfileTransferLock; every published state is immutable.
    internal JsonObject CaptureProfileTransferSnapshot() => Read();
    internal void WriteProfileTransferSnapshot(JsonObject snapshot) => Write(snapshot);
    internal void InvalidateProfileTransferSnapshot() => cachedState = null;

    public SavedWorkChange Change(string collection, CatalogItem item, bool ensureSaved)
    {
        using var fileLock = AcquireLock();
        var current = Read();
        var previousRevision = revision;
        var items = (JsonArray)current[collection]!;
        var keys = item.MemberKeys.Append(item.Key).ToHashSet(StringComparer.Ordinal);
        var existing = items.Select((saved, index) => (Saved: saved as JsonObject, Index: index))
            .Where(entry => entry.Saved is { } saved && (
                keys.Contains(saved["key"]?.GetValue<string>() ?? "") ||
                saved["memberKeys"] is JsonArray members && members.Any(key =>
                    key is JsonValue value && value.TryGetValue<string>(out var text) && keys.Contains(text))))
            .Select(entry => entry.Index).ToArray();
        // Double-click likes are idempotent even with stale clients or concurrent windows.
        // Keep existing metadata, unknown fields and library order byte-for-byte.
        if (ensureSaved && existing.Length > 0) return new(true, previousRevision, revision);
        // Clone only for a real write. A failed atomic write must not change the
        // validated snapshot or another request's acknowledgement.
        var state = CloneState(current);
        items = (JsonArray)state[collection]!;
        responseSnapshots.Remove(items);
        foreach (var index in existing.Reverse()) items.RemoveAt(index);
        if (existing.Length == 0) items.Insert(0, JsonSerializer.SerializeToNode(item, Json));
        Write(state);
        return new(existing.Length == 0, previousRevision, revision);
    }

    // Read the validated cached JSON, without materializing the entire saved library for
    // each visible card. A group representative's hash belongs only to that representative.
    internal string GetOwnedContentHash(string source, string id)
    {
        using var fileLock = AcquireLock();var hashes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var collection in new[] { "likes", "bookmarks" })
            foreach (var saved in ((JsonArray)Read()[collection]!).OfType<JsonObject>())
            {
                Collect(saved, 0);if (hashes.Count > 1) return "";
            }
        return hashes.Count == 1 ? hashes.Single() : "";
        void Collect(JsonObject saved, int depth)
        {
            var direct = SavedText(saved, "key") == source + ":" + id &&
                SavedText(saved, "source") == source && SavedText(saved, "id") == id;
            var contentHash = direct ? SavedText(saved, "contentHash") : "";
            if (ValidContentHash(contentHash)) hashes.Add(contentHash.ToLowerInvariant());
            else if (saved["imageRecords"] is JsonArray records)
                foreach (var record in records.OfType<JsonObject>().Where(record => SavedText(record, "owner") == source + ":" + id))
                { var hash = SavedText(record, "hash");if (ValidContentHash(hash)) hashes.Add(hash.ToLowerInvariant()); }
            if (depth < 2 && saved["groupMembers"] is JsonArray members)
                foreach (var member in members.OfType<JsonObject>()) Collect(member, depth + 1);
        }
    }
    private static string SavedText(JsonObject value, string name) => value[name] is JsonValue text && text.TryGetValue<string>(out var result) ? result : "";
    private static bool ValidContentHash(string value) => value.Length == 32 && value.All(Uri.IsHexDigit);
    internal static bool OwnsMediaRecord(JsonObject saved, string key) => saved["imageRecords"] is JsonArray records &&
        records.OfType<JsonObject>().Any(record => SavedText(record, "owner") == key);

    public bool RefreshMetadata(CatalogItem item, Func<JsonObject, bool> update) =>
        RefreshMetadataCore(item, update, includeOwnedMedia: false);

    internal bool RefreshOwnedMediaMetadata(CatalogItem item, Func<JsonObject, bool> update) =>
        RefreshMetadataCore(item, update, includeOwnedMedia: true);

    private bool RefreshMetadataCore(CatalogItem item, Func<JsonObject, bool> update, bool includeOwnedMedia)
    {
        using var fileLock = AcquireLock();
        var current = Read();
        JsonObject? state = null;
        foreach (var collection in new[] { "likes", "bookmarks" })
        {
            var items = (JsonArray)current[collection]!;
            for (var index = 0; index < items.Count; index++)
            {
                if (items[index] is not JsonObject saved || !(
                    saved["key"]?.GetValue<string>() == item.Key &&
                    saved["source"]?.GetValue<string>() == item.Source &&
                    saved["id"]?.GetValue<string>() == item.Id || saved["groupMembers"] is JsonArray members &&
                    members.OfType<JsonObject>().Any(member => member["key"]?.GetValue<string>() == item.Key &&
                        member["source"]?.GetValue<string>() == item.Source && member["id"]?.GetValue<string>() == item.Id) ||
                    includeOwnedMedia && OwnsMediaRecord(saved, item.Key))) continue;
                // Detail responses commonly describe an unsaved work or repeat
                // existing metadata. Give the updater its own artwork copy and
                // defer copying the complete library until a write is necessary.
                var refreshed = saved.DeepClone().AsObject();
                if (!update(refreshed)) continue;
                state ??= CloneState(current);
                responseSnapshots.Remove((JsonArray)state[collection]!);
                ((JsonArray)state[collection]!)[index] = refreshed;
            }
        }
        // The revision tracks membership. Refreshing the same saved artwork's
        // metadata must not force every subsequent like to reload the library.
        if (state is not null) Write(state, preserveRevision: true);
        return state is not null;
    }

    public bool RepairGroup(CatalogItem expected, List<CatalogItem> groups)
    {
        static HashSet<string> Keys(CatalogItem item) => item.MemberKeys.Append(item.Key).ToHashSet(StringComparer.Ordinal);
        var expectedKeys = Keys(expected);
        if (groups.Count is < 1 or > 100 || !expectedKeys.SetEquals(groups.SelectMany(group => Keys(group))))
            throw new InvalidDataException("Repair must retain every saved member.");
        using var fileLock = AcquireLock();
        var state = CloneState(Read()); var changed = false;
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
                responseSnapshots.Remove(items);
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
        if (cachedState is not null && File.Exists(path) && Stamp() == cachedStamp) return cachedState;
        foreach (var candidate in new[] { path, path + ".bak" })
        {
            if (!File.Exists(candidate)) continue;
            try
            {
                var bytes = File.ReadAllBytes(candidate);
                var state = JsonNode.Parse(bytes) as JsonObject;
                if (state?["schemaVersion"]?.GetValue<int>() != 1 ||
                    state["likes"] is not JsonArray likes || state["bookmarks"] is not JsonArray bookmarks)
                    throw new JsonException();
                ValidateItems(likes);
                ValidateItems(bookmarks);
                CacheRecordJson(state, bytes);
                if (candidate != path)
                {
                    if (File.Exists(path)) File.Copy(path, path + ".corrupt-" + Guid.NewGuid().ToString("N"));
                    File.Copy(candidate, path, overwrite: true);
                }
                Remember(state);
                return state;
            }
            catch (Exception error) when (error is JsonException or InvalidOperationException or FormatException) { }
        }
        throw new InvalidDataException("Не удалось прочитать лайки и закладки. Файлы сохранены для восстановления.");
    }

    private (long Length, long Modified, long Created) Stamp()
    {
        var file = new FileInfo(path);
        return (file.Length, file.LastWriteTimeUtc.Ticks, file.CreationTimeUtc.Ticks);
    }

    private void Remember(JsonObject state, bool preserveRevision = false)
    {
        cachedState = state;
        cachedStamp = Stamp();
        identityIndexes.Clear();
        if (!preserveRevision) revision = Guid.NewGuid().ToString("N");
    }

    private void Write(JsonObject state, bool preserveRevision = false)
    {
        var temporary = path + ".tmp-" + Guid.NewGuid().ToString("N");
        try
        {
            // Unchanged records already have verified serialized fragments.
            // Stream the atomic file without reserializing every tag or
            // allocating another complete library-sized byte array.
            using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 128 * 1024))
            using (var writer = new Utf8JsonWriter(stream, new JsonWriterOptions { Indented = true }))
            {
                writer.WriteStartObject();
                foreach (var property in state)
                {
                    writer.WritePropertyName(property.Key);
                    if (property.Key is "likes" or "bookmarks" && property.Value is JsonArray items)
                    {
                        writer.WriteStartArray();
                        foreach (var item in items.OfType<JsonObject>())
                        {
                            var record = Record(item);
                            record.Json ??= JsonSerializer.SerializeToUtf8Bytes(item, Json);
                            writer.WriteRawValue(record.Json.Value.Span, skipInputValidation: true);
                        }
                        writer.WriteEndArray();
                    }
                    else if (property.Value is null) writer.WriteNullValue();
                    else property.Value.WriteTo(writer, Json);
                }
                writer.WriteEndObject();
            }
            if (File.Exists(path)) File.Copy(path, path + ".bak", overwrite: true);
            File.Move(temporary, path, overwrite: true);
            Remember(state, preserveRevision);
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }

    private RecordSnapshot Record(JsonObject item) => recordSnapshots.GetValue(item, value => new(
        value.Deserialize<CatalogItem>(Json) ?? throw new JsonException()));

    private void CacheRecordJson(JsonObject state, byte[] bytes)
    {
        // Reuse exact, already validated UTF-8 record slices. Building this
        // cache must not serialize the entire library on startup or first like.
        var reader = new Utf8JsonReader(bytes);
        reader.Read();
        while (reader.Read() && reader.TokenType != JsonTokenType.EndObject)
        {
            var collection = reader.ValueTextEquals("likes") ? "likes" :
                reader.ValueTextEquals("bookmarks") ? "bookmarks" : null;
            reader.Read();
            if (collection is null) { reader.Skip(); continue; }
            var items = (JsonArray)state[collection]!;
            var index = 0;
            while (reader.Read() && reader.TokenType != JsonTokenType.EndArray)
            {
                var start = checked((int)reader.TokenStartIndex);
                reader.Skip();
                var end = checked((int)reader.BytesConsumed);
                Record((JsonObject)items[index++]!).Json = bytes.AsMemory(start, end - start);
            }
        }
    }

    private JsonObject CloneState(JsonObject state)
    {
        var copy = state.DeepClone().AsObject();
        // Share only immutable cached representations, not JsonNodes or the
        // mutable CatalogItems returned to callers. Failed writes keep state intact.
        foreach (var name in new[] { "likes", "bookmarks" })
        {
            var before = (JsonArray)state[name]!; var after = (JsonArray)copy[name]!;
            for (var index = 0; index < before.Count; index++)
                if (before[index] is JsonObject old && after[index] is JsonObject next &&
                    recordSnapshots.TryGetValue(old, out var snapshot)) recordSnapshots.Add(next, snapshot);
            if (responseSnapshots.TryGetValue(before, out var response)) responseSnapshots.Add(after, response);
        }
        return copy;
    }

    private void ValidateItems(JsonArray array)
    {
        if (array.Any(item => item is not JsonObject)) throw new JsonException();
        foreach (var item in array.OfType<JsonObject>()) _ = Record(item);
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
