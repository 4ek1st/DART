using System.Text.Json;
using System.Text.Json.Nodes;

namespace ArtCatalog;

public sealed class FavoriteArtworkUpdate
{
    public CatalogItem Item { get; set; } = new();
    public bool Favorite { get; set; }
}

internal sealed partial class LocalStore
{
    private SavedWorksStore? favoriteArtworkLibrary;
    private SavedWorksStore FavoriteArtworkLibrary
    {
        get
        {
            if (favoriteArtworkLibrary is not null) return favoriteArtworkLibrary;
            var ownedDirectory = Path.Combine(directory, "favorite-artworks-v1");
            Directory.CreateDirectory(ownedDirectory);
            // Reuse the proven atomic library implementation in its own directory.
            // It never reads or changes the profile's likes/bookmarks library.
            return favoriteArtworkLibrary = new SavedWorksStore(ownedDirectory);
        }
    }
    private static IEnumerable<string> FavoriteArtworkTokens(JsonObject item) =>
        TransferWorkTokens(item).Where(token => !TransferWeakParent(token));

    public List<CatalogItem> GetFavoriteArtworks()
    {
        lock (sync) return FavoriteArtworkLibrary.Get("bookmarks");
    }
    public List<CatalogItem> SetFavoriteArtwork(CatalogItem item, bool favorite)
    {
        if (item is null || item.Id is not { Length: > 0 and <= 100 } || item.Key != item.Source + ":" + item.Id ||
            item.Title is null || item.Thumbnail is null || item.GroupKey is null || item.PixivGroupKey is null ||
            item.Images is null || item.Images.Any(url => url is null) || item.MemberKeys is not { Count: <= 1000 } ||
            item.Tags is not { Count: <= 2000 } || item.AllTags is not { Count: <= 2000 } ||
            !CatalogService.IsValidItem(item)) throw new ArgumentException("Invalid artwork.");
        lock (sync)
        {
            using var fileLock = AcquireFileLock(Path.Combine(directory, "favorite-artworks.lock"));
            var library = FavoriteArtworkLibrary;
            var tokens = FavoriteArtworkTokens(JsonSerializer.SerializeToNode(item, FavoriteJson)!.AsObject())
                .ToHashSet(StringComparer.Ordinal);
            var existing = library.FindMatchingKeys("bookmarks", tokens, FavoriteArtworkTokens);
            if (favorite && existing.Count == 0) library.Change("bookmarks", item, ensureSaved: true);
            if (!favorite && existing.Count > 0)
            {
                // One removal covers every matching primary key. Repeated
                // toggle calls can reinsert an empty row after an earlier
                // overlapping saved group has already removed that key.
                library.Change("bookmarks", new CatalogItem { Key = existing[0], MemberKeys = existing.Skip(1).ToList() }, ensureSaved: false);
            }
            return library.Get("bookmarks");
        }
    }
}
