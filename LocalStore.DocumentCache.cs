using System.Text.Json;
using System.Text.Json.Nodes;

namespace ArtCatalog;

internal sealed partial class LocalStore
{
    private readonly object viewedStateSync = new(), clientStateSync = new();
    private ViewedDocument? viewedSnapshot;
    private ClientDocument? clientStateSnapshot;

    private readonly record struct FileVersion(long Length, long Modified, long Created);
    private readonly record struct DocumentVersion(FileVersion Main, FileVersion Backup);
    private static FileVersion FileStamp(string path)
    {
        var file = new FileInfo(path);
        return file.Exists ? new(file.Length, file.LastWriteTimeUtc.Ticks, file.CreationTimeUtc.Ticks) : default;
    }
    private static DocumentVersion DocumentStamp(string path) => new(FileStamp(path), FileStamp(path + ".bak"));

    private sealed class ViewedDocument(DocumentVersion stamp, List<string> items)
    {
        internal DocumentVersion Stamp = stamp;
        internal readonly List<string> Items = items;
        internal readonly HashSet<string> Known = items.ToHashSet(StringComparer.Ordinal);
    }
    private ViewedDocument ReadViewedSnapshot()
    {
        var stamp = DocumentStamp(viewedFile);
        if (viewedSnapshot?.Stamp == stamp) return viewedSnapshot;
        return viewedSnapshot = new(stamp, ReadStringListFile(viewedFile));
    }
    private void WriteViewedSnapshot(List<string> current, string[] added)
    {
        var temporary = viewedFile + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            using (var writer = new Utf8JsonWriter(stream, new JsonWriterOptions { Indented = Json.WriteIndented }))
            {
                writer.WriteStartArray();
                foreach (var token in current) writer.WriteStringValue(token);
                foreach (var token in added) writer.WriteStringValue(token);
                writer.WriteEndArray();
                writer.Flush();
            }
            if (File.Exists(viewedFile)) File.Copy(viewedFile, viewedFile + ".bak", overwrite: true);
            File.Move(temporary, viewedFile, overwrite: true);
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }

    // The parsed node is private and never mutated after publication. All
    // sessions share its cleaned JSON; callers only receive immutable text.
    private sealed class ClientDocument(DocumentVersion stamp, string clean, JsonObject value)
    {
        internal readonly DocumentVersion Stamp = stamp;
        internal readonly string Clean = clean;
        internal readonly JsonObject Value = value;
        internal string? LastInput;
    }
    private ClientDocument ReadClientStateSnapshot()
    {
        var stamp = DocumentStamp(clientStateFile);
        if (clientStateSnapshot?.Stamp == stamp) return clientStateSnapshot;
        var clean = "{}";
        if (File.Exists(clientStateFile))
            try { clean = CatalogState.CleanClientState(File.ReadAllText(clientStateFile)); }
            catch (JsonException) { /* Keep the existing empty-state recovery behavior. */ }
        return clientStateSnapshot = new(stamp, clean, JsonNode.Parse(clean)!.AsObject());
    }
}
