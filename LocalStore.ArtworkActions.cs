using System.Text.Json;
using System.Text.Json.Nodes;

namespace ArtCatalog;

public sealed class HiddenArtworkUpdate
{
    public CatalogItem Item { get; set; } = new();
    public bool Hidden { get; set; }
}

internal sealed partial class LocalStore
{
    private SavedWorksStore? hiddenArtworkLibrary;
    private SavedWorksStore HiddenArtworkLibrary
    {
        get
        {
            if (hiddenArtworkLibrary is not null) return hiddenArtworkLibrary;
            var owned = Path.Combine(directory, "hidden-artworks-v1");
            Directory.CreateDirectory(owned);
            return hiddenArtworkLibrary = new SavedWorksStore(owned);
        }
    }
    public List<CatalogItem> GetHiddenArtworks() { lock (sync) return HiddenArtworkLibrary.Get("bookmarks"); }
    public List<CatalogItem>? SetHiddenArtwork(CatalogItem item, bool hidden)
    {
        if (item is null || item.Id is not { Length: > 0 and <= 100 } || item.Key != item.Source + ":" + item.Id ||
            item.Title is null || item.Thumbnail is null || item.GroupKey is null || item.PixivGroupKey is null ||
            item.Images is null || item.Images.Any(url => url is null) || item.MemberKeys is not { Count: <= 1000 } ||
            item.Tags is not { Count: <= 2000 } || item.AllTags is not { Count: <= 2000 } ||
            !CatalogService.IsValidItem(item)) throw new ArgumentException("Invalid artwork.");
        lock (sync)
        {
            var library = HiddenArtworkLibrary;
            using var held = library.AcquireProfileTransferLock();
            var state = library.ProfileTransferSnapshot();
            var works = state["bookmarks"]!.AsArray();
            var node = JsonSerializer.SerializeToNode(item, Json)!.AsObject();
            var tokens = TransferWorkTokens(node).Where(token => !TransferWeakParent(token)).ToHashSet(StringComparer.Ordinal);
            var matches = works.OfType<JsonObject>().Where(saved => TransferWorkTokens(saved)
                .Any(token => !TransferWeakParent(token) && tokens.Contains(token))).ToArray();
            if (hidden && matches.Length > 0 || !hidden && matches.Length == 0)
                return works.Deserialize<List<CatalogItem>>(Json)!;
            if (hidden && works.Count >= 5000) return null;
            foreach (var saved in matches) works.Remove(saved);
            if (hidden) works.Insert(0, node);
            library.WriteProfileTransferSnapshot(state);
            return works.Deserialize<List<CatalogItem>>(Json)!;
        }
    }
}
