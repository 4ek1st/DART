using System.Text.Json;
using System.Text.Json.Nodes;

namespace ArtCatalog;

internal sealed partial class LocalStore
{
    internal string GetSavedSankakuHash(string id) => savedWorks.GetOwnedContentHash("sankaku", id);
    // The lightweight post response may omit categorized credits/tags. Renew URLs without
    // replacing the saved descriptive metadata or changing collection membership/revision.
    public bool RefreshSavedMedia(CatalogItem item)
    {
        if (item.Source != "sankaku" || !SankakuApi.ValidId(item.Id)) return false;
        return savedWorks.RefreshMetadata(item, UpdateMedia, includeOwnedMedia: true);
        bool UpdateMedia(JsonObject saved)
        {
            var changed = false;
            if (saved["groupMembers"] is JsonArray members)
                foreach (var member in members.OfType<JsonObject>().Where(member => member["key"]?.GetValue<string>() == item.Key))
                    changed |= UpdateMedia(member);
            var direct = saved["key"]?.GetValue<string>() == item.Key;
            if (!direct && !changed && !SavedWorksStore.OwnsMediaRecord(saved, item.Key)) return false;
            var thumbnail = saved["thumbnail"]?.GetValue<string>() ?? "";
            if (item.Thumbnail.Length > 0 && (direct || thumbnail.Length == 0 ||
                CatalogService.SankakuMediaIdentity(thumbnail) == CatalogService.SankakuMediaIdentity(item.Thumbnail)) &&
                thumbnail != item.Thumbnail) { saved["thumbnail"] = item.Thumbnail; changed = true; }
            var fresh = item.Images.GroupBy(CatalogService.SankakuMediaIdentity)
                .ToDictionary(group => group.Key, group => group.Last());
            var previous = saved["images"]?.Deserialize<List<string>>(Json) ?? [];
            var images = previous.Select(url => fresh.GetValueOrDefault(CatalogService.SankakuMediaIdentity(url), url))
                .Concat(item.Images).Distinct().Take(100).ToList();
            if (!previous.SequenceEqual(images)) { saved["images"] = JsonSerializer.SerializeToNode(images, Json); changed = true; }
            if (saved["imageRecords"] is JsonArray records)
                foreach (var record in records.OfType<JsonObject>())
                {
                    var oldUrl = record["url"]?.GetValue<string>() ?? "";
                    if (fresh.TryGetValue(CatalogService.SankakuMediaIdentity(oldUrl), out var url) && url != oldUrl)
                    { record["url"] = url; changed = true; }
                }
            if (direct)
            {
                if (saved["requiresAuthentication"]?.GetValue<bool>() != item.RequiresAuthentication)
                { saved["requiresAuthentication"] = item.RequiresAuthentication; changed = true; }
                if ((saved["accessMessage"]?.GetValue<string>() ?? "") != item.AccessMessage)
                { saved["accessMessage"] = item.AccessMessage; changed = true; }
            }
            return changed;
        }
    }
}
