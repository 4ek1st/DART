using System.Reflection;
using System.Text.Json;
using ArtCatalog;

internal static class ArtworkActionsFixtureTests
{
    private static readonly Type Store = typeof(CatalogItem).Assembly.GetType("ArtCatalog.LocalStore")!;
    internal static void Run()
    {
        var method = Store.GetMethod("SetHiddenArtwork") ?? throw new Exception("Persistent artwork hiding is missing");
        var root = Path.Combine(Path.GetTempPath(), "DART-artwork-actions-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        object Open() => Activator.CreateInstance(Store, [root])!;
        List<CatalogItem> Read(object store) => (List<CatalogItem>)Store.GetMethod("GetHiddenArtworks")!.Invoke(store, null)!;
        CatalogItem Work(string source, string id, string hash = "") => new() { Source=source, Id=id, Key=source+":"+id,
            Title="Forest", Thumbnail="https://cdn.donmai.us/preview/fixture.jpg", ContentHash=hash, Tags=["forest"], Rating="g" };
        try
        {
            var store = Open(); var first = Work("danbooru", "10", new string('a',32));
            method.Invoke(store, [first,true]); method.Invoke(Open(), [Work("gelbooru","20",new string('a',32)),true]);
            if (Read(Open()).Count != 1) throw new Exception("Hidden mirrors/repeated writes must persist once");
            if (((SavedWorksSnapshot)Store.GetMethod("GetSavedWorksSnapshot")!.Invoke(store,["likes"])!).Items.Count != 0 ||
                ((SavedWorksSnapshot)Store.GetMethod("GetSavedWorksSnapshot")!.Invoke(store,["bookmarks"])!).Items.Count != 0)
                throw new Exception("Hiding must not mutate saved libraries");
            method.Invoke(store,[Work("rule34","30",new string('a',32)),false]);
            if (Read(Open()).Count != 0) throw new Exception("Restoring a mirror must restore the logical work");
            var a=Work("danbooru","11"); var b=Work("gelbooru","22"); a.GroupKey=b.GroupKey="danbooru:parent:1";
            method.Invoke(store,[a,true]);method.Invoke(store,[b,true]);
            if(Read(Open()).Count!=2) throw new Exception("Weak parents must not hide unrelated works");
            Console.WriteLine("Artwork hiding: restart, strong mirrors, weak parents, restoration and library isolation PASS");
        }
        finally { if (Path.GetFileName(root).StartsWith("DART-artwork-actions-",StringComparison.Ordinal)) Directory.Delete(root,true); }
    }
}
