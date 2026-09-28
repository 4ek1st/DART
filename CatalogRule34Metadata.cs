using System.Text.Json;

namespace ArtCatalog;

internal sealed partial class CatalogService
{
    private static void ApplyRule34TagInfo(CatalogItem item, JsonElement post)
    {
        if (!post.TryGetProperty("tag_info", out var entries) || entries.ValueKind != JsonValueKind.Array ||
            entries.GetArrayLength() == 0 && item.Tags.Count > 0) return;
        var available = item.Tags.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var artists = new List<string>();
        var characters = new List<string>();
        var copyrights = new List<string>();
        foreach (var entry in entries.EnumerateArray())
        {
            if (entry.ValueKind != JsonValueKind.Object) continue;
            var name = String(entry, "tag");
            if (!available.Contains(name)) continue;
            switch (String(entry, "type"))
            {
                case "artist": artists.Add(name); break;
                case "character": characters.Add(name); break;
                case "copyright": copyrights.Add(name); break;
            }
        }
        item.Rule34TagInfoKnown = true;
        CatalogCredits.Apply(item, artists);
        ApplyCharacterTags(item, characters);
        ApplyCopyrightTags(item, copyrights);
    }
}
