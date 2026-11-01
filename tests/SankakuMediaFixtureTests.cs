using System.Net;
using System.Reflection;
using System.Text.Json;
using ArtCatalog;

internal static class SankakuMediaFixtureTests
{
    private static void Expect(bool value, string message) { if (!value) throw new Exception("Sankaku media: " + message); }
    private sealed class HeldTags : HttpMessageHandler
    {
        internal readonly TaskCompletionSource Release = new(TaskCreationOptions.RunContinuationsAsynchronously);
        internal int Posts, Tags;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        {
            Expect(request.RequestUri!.Host == "sankakuapi.com", "unexpected fixture destination");
            if (request.RequestUri.AbsolutePath.EndsWith("/tags"))
            { Interlocked.Increment(ref Tags); await Release.Task.WaitAsync(token); return new(HttpStatusCode.OK) { Content = new StringContent("[]") }; }
            Interlocked.Increment(ref Posts);
            return new(HttpStatusCode.OK) { Content = new StringContent("""
              {"id":"Neutral123","rating":"s","preview_url":"https://s.sankakucomplex.com/preview/neutral.jpg?e=4102444800&m=fresh",
               "file_url":"https://s.sankakucomplex.com/data/neutral.png?e=4102444800&m=fresh","tags":[],"tag_names":["landscape"]}
              """) };
        }
    }
    private static Task<CatalogItem?> Media(CatalogService service)
    {
        // The legacy fallback makes the regression exercise the former real request path.
        var method = typeof(CatalogService).GetMethod("GetMediaDetailAsync") ?? typeof(CatalogService).GetMethod("GetDetailAsync")!;
        return (Task<CatalogItem?>)method.Invoke(service, ["sankaku", "Neutral123", CancellationToken.None])!;
    }
    public static async Task Run()
    {
        var root = Path.Combine(Path.GetTempPath(), "DART-Sankaku-Media-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            var store = new LocalStore(root);using var handler = new HeldTags();using var http = new HttpClient(handler);var service = new CatalogService(store);
            typeof(CatalogService).GetField("Sankaku", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(service, new SankakuApi(store, http));
            var imported = new CatalogItem { Key = "sankaku:Neutral123", Source = "sankaku", Id = "Neutral123", Title = "Retained title", CreatorTag = "landscape_artist", CreatorName = "Landscape Artist", Tags = ["retained_tag"], Images = [] };
            store.ToggleLike(imported);store.ToggleBookmark(imported);
            var media = Media(service);
            try { await Task.WhenAny(media, Task.Delay(300));Expect(media.IsCompleted, "an imported blank preview waited for held supplemental tag metadata"); }
            finally { handler.Release.TrySetResult(); }
            var detail = await media;Expect(detail?.Thumbnail.Length > 0 && detail.Images.Count == 1, "no usable media after renewal");
            Expect(handler.Posts == 1 && handler.Tags == 0, "preview recovery must perform one post request and no tag pagination");
            var refresh = typeof(LocalStore).GetMethod("RefreshSavedMedia") ?? typeof(LocalStore).GetMethod("RefreshSavedMetadata")!;
            refresh.Invoke(store, [detail]);var reopened = new LocalStore(root);
            foreach (var collection in new[] { "likes", "bookmarks" })
            {
                var saved = reopened.GetSavedWorksSnapshot(collection).Items.Single();
                Expect(saved.Thumbnail == detail!.Thumbnail && saved.Images.SequenceEqual(detail.Images), "renewed media did not survive reopening");
                Expect(saved.Title == imported.Title && saved.CreatorTag == imported.CreatorTag && saved.Tags.SequenceEqual(imported.Tags), "media-only recovery replaced saved descriptive metadata");
            }
            var unchanged = File.ReadAllBytes(Path.Combine(root, "saved-works-v1.json"));
            refresh.Invoke(store, [detail]);Expect(unchanged.SequenceEqual(File.ReadAllBytes(Path.Combine(root, "saved-works-v1.json"))), "repeat media update rewrote the saved library");
            var mixedStore = new LocalStore(Path.Combine(root, "mixed"));
            var mixed = new CatalogItem { Key = "danbooru:7", Source = "danbooru", Id = "7", Title = "Retained grouped title", Tags = ["retained_group_tag"], GroupingVersion = 3,
                MemberKeys = ["danbooru:7", imported.Key], GroupMembers = [new CatalogItem { Key = "danbooru:7", Source = "danbooru", Id = "7" }, imported] };
            mixedStore.ToggleLike(mixed);var revision = mixedStore.GetSavedWorksSnapshot("likes").Revision;refresh.Invoke(mixedStore, [detail]);
            var mixedResult = new LocalStore(Path.Combine(root, "mixed")).GetSavedWorksSnapshot("likes").Items.Single();
            Expect(mixedResult.Key == mixed.Key && mixedResult.Id == mixed.Id && mixedResult.Source == mixed.Source && mixedResult.Title == mixed.Title && mixedResult.Tags.SequenceEqual(mixed.Tags), "mixed-source recovery replaced the primary artwork identity or metadata");
            Expect(mixedResult.Thumbnail == detail!.Thumbnail && mixedResult.Images.Contains(detail.Images[0]) && mixedResult.GroupMembers.Single(member => member.Key == imported.Key).Thumbnail == detail.Thumbnail, "mixed-source recovery did not persist both group and member preview");
            Expect(mixedStore.GetSavedWorksSnapshot("likes").Revision == revision, "media renewal changed collection membership revision");
            using var fullHandler = new HeldTags();using var fullHttp = new HttpClient(fullHandler);typeof(CatalogService).GetField("Sankaku", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(service, new SankakuApi(store, fullHttp));
            var full = service.GetDetailAsync("sankaku", "Neutral123", default);await Task.Delay(30);Expect(!full.IsCompleted && fullHandler.Tags == 1, "full artwork detail no longer enriches its tags");fullHandler.Release.TrySetResult();await full;
            Console.WriteLine("Sankaku imported media bypasses held tag pages, preserves saved metadata and survives reopening: PASS");
        }
        finally { Directory.Delete(root, recursive: true); }
    }
}
