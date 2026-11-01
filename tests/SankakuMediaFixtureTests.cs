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
    private const string LegacyId = "12345678", ResolvedId = "ResolvedABC123";
    private static readonly string HashA = new('a', 32), HashB = new('b', 32);
    private static string ResolvedPost(string hash, string id = ResolvedId) => JsonSerializer.Serialize(new {
        id, md5 = hash, rating = "s", preview_url = "https://s.sankakucomplex.com/preview/resolved.jpg?e=4102444800&m=fresh",
        file_url = "https://s.sankakucomplex.com/data/resolved.png?e=4102444800&m=fresh", tags = Array.Empty<object>() });
    private sealed class LegacyTransport : HttpMessageHandler
    {
        internal string Body = "[" + ResolvedPost(HashA) + "]";
        internal string DirectBody = ResolvedPost(HashA);
        internal int Direct, Lookups, TagPages;
        internal readonly List<string> Hashes = [];
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        {
            var uri = request.RequestUri!;Expect(uri.Host == "sankakuapi.com", "fixture reached another host");
            var query = uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries).Select(part => part.Split('=', 2))
                .ToDictionary(pair => WebUtility.UrlDecode(pair[0]), pair => pair.Length == 2 ? WebUtility.UrlDecode(pair[1]) : "");
            if (uri.AbsolutePath == "/v2/posts")
            {
                Lookups++;Expect(query.GetValueOrDefault("limit") == "2" && query.GetValueOrDefault("page") == "1", "hash lookup must be bounded to two results");
                var tags = query.GetValueOrDefault("tags", "");Expect(tags.StartsWith("md5:") && tags.Length == 36, "lookup was not an exact MD5 search");Hashes.Add(tags[4..]);
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(Body) });
            }
            if (uri.AbsolutePath.EndsWith("/tags"))
            {
                TagPages++;Expect(uri.AbsolutePath == "/posts/" + ResolvedId + "/tags", "supplemental tags used the rejected legacy ID");
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("[]") });
            }
            Direct++;
            return Task.FromResult(new HttpResponseMessage(uri.AbsolutePath == "/posts/" + ResolvedId ? HttpStatusCode.OK : HttpStatusCode.BadRequest)
                { Content = new StringContent(uri.AbsolutePath == "/posts/" + ResolvedId ? DirectBody : "{}") });
        }
    }
    private static CatalogService LegacyService(LocalStore store, HttpClient transport)
    {
        var service = new CatalogService(store);typeof(CatalogService).GetField("Sankaku", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(service, new SankakuApi(store, transport));return service;
    }
    private static CatalogItem Legacy(string id = LegacyId, string? hash = null) => new() {
        Key = "sankaku:" + id, Source = "sankaku", Id = id, ContentHash = hash ?? HashA,
        Title = "Retained legacy title", CreatorTag = "confirmed_artist", Tags = ["retained_tag"], Images = [] };
    private static async Task LegacyMedia(string root)
    {
        var store = new LocalStore(Path.Combine(root, "legacy"));var saved = Legacy();store.ToggleLike(saved);store.ToggleBookmark(saved);
        var before = store.GetSavedWorksSnapshot("likes");using var handler = new LegacyTransport();using var http = new HttpClient(handler);var service = LegacyService(store, http);
        var media = await service.GetMediaDetailAsync("sankaku", LegacyId, default);
        Expect(media is not null && media.Key == saved.Key && media.Id == saved.Id && media.Thumbnail.Length > 0 && media.Images.Count == 1, "legacy numeric ID did not resolve usable media under its original identity");
        Expect(handler.Lookups == 1 && handler.Direct == 0 && handler.TagPages == 0 && handler.Hashes.Single() == HashA, "legacy media resolution made extra provider requests");
        Expect(media!.MemberKeys.Count == 0, "resolution inflated catalog aliases");store.RefreshSavedMedia(media);
        foreach (var collection in new[] { "likes", "bookmarks" }) {
            var restored = new LocalStore(Path.Combine(root, "legacy")).GetSavedWorksSnapshot(collection).Items.Single();
            Expect(restored.Key == saved.Key && restored.Id == saved.Id && restored.Thumbnail == media.Thumbnail && restored.Images.SequenceEqual(media.Images), "legacy media did not persist after reopening");
            Expect(restored.Title == saved.Title && restored.CreatorTag == saved.CreatorTag && restored.Tags.SequenceEqual(saved.Tags) && restored.MemberKeys.SequenceEqual(saved.MemberKeys), "resolution changed saved metadata or membership");
        }
        Expect(store.GetSavedWorksSnapshot("likes").Revision == before.Revision, "legacy resolution changed membership revision");
        var full = await service.GetDetailAsync("sankaku", LegacyId, default);Expect(full?.Key == saved.Key && full.Id == saved.Id && handler.TagPages == 1, "full legacy detail did not use canonical supplemental tags and retain its saved identity");
        foreach (var body in new[] { "[]", "[" + ResolvedPost(HashB) + "]", "[" + ResolvedPost(HashA) + "," + ResolvedPost(HashA, "OtherABC123") + "]", "[{\"id\":\"ResolvedABC123\",\"md5\":\"" + HashA + "\"}]" }) {
            using var rejectedHandler = new LegacyTransport { Body = body };using var rejectedHttp = new HttpClient(rejectedHandler);
            var rejected = await LegacyService(store, rejectedHttp).GetMediaDetailAsync("sankaku", LegacyId, default);Expect(rejected is null, "empty, mismatched, ambiguous or media-less hash result was accepted");Expect(rejectedHandler.Lookups == 1 && rejectedHandler.Direct == 0, "rejected lookup performed another broad request");
        }
        using var modernHandler = new LegacyTransport();using var modernHttp = new HttpClient(modernHandler);
        var modern = await LegacyService(store, modernHttp).GetMediaDetailAsync("sankaku", ResolvedId, default);Expect(modern?.Id == ResolvedId && modernHandler.Direct == 1 && modernHandler.Lookups == 0, "modern opaque ID did not retain its single direct request");
        using var wrongHandler = new LegacyTransport { DirectBody = ResolvedPost(HashA, "WrongABC123") };using var wrongHttp = new HttpClient(wrongHandler);Expect(await LegacyService(store, wrongHttp).GetMediaDetailAsync("sankaku", ResolvedId, default) is null, "direct response for another post was attached to the requested identity");
        var absentStore = new LocalStore(Path.Combine(root, "no-known-hash"));absentStore.ToggleLike(Legacy(hash: ""));using var absentHandler = new LegacyTransport();using var absentHttp = new HttpClient(absentHandler);
        try { await LegacyService(absentStore, absentHttp).GetMediaDetailAsync("sankaku", LegacyId, default); } catch (InvalidOperationException) { }
        Expect(absentHandler.Lookups == 0 && absentHandler.Direct == 1, "missing saved hash started a speculative search");
        var unownedStore = new LocalStore(Path.Combine(root, "unowned-hash"));unownedStore.ToggleLike(new CatalogItem { Key = "danbooru:7", Source = "danbooru", Id = "7", ContentHash = HashA, MemberKeys = ["danbooru:7", "sankaku:" + LegacyId], ImageRecords = [new() { Owner = "danbooru:7", Hash = HashA }] });
        using var unownedHandler = new LegacyTransport();using var unownedHttp = new HttpClient(unownedHandler);try { await LegacyService(unownedStore, unownedHttp).GetMediaDetailAsync("sankaku", LegacyId, default); } catch (InvalidOperationException) { }Expect(unownedHandler.Lookups == 0, "an alias-only group guessed another primary source's hash");
        var conflicting = new LocalStore(Path.Combine(root, "conflicting-hashes"));conflicting.ToggleLike(Legacy(hash: HashA));conflicting.ToggleBookmark(Legacy(hash: HashB));using var conflictHandler = new LegacyTransport();using var conflictHttp = new HttpClient(conflictHandler);try { await LegacyService(conflicting, conflictHttp).GetMediaDetailAsync("sankaku", LegacyId, default); } catch (InvalidOperationException) { }Expect(conflictHandler.Lookups == 0, "conflicting saved hashes started an ambiguous lookup");
        var groupStore = new LocalStore(Path.Combine(root, "member-hash"));var child = Legacy("23456789", HashB);groupStore.ToggleLike(new CatalogItem { Key = "sankaku:87654321", Source = "sankaku", Id = "87654321", ContentHash = HashA, MemberKeys = ["sankaku:87654321", child.Key], GroupMembers = [child] });
        using var childHandler = new LegacyTransport { Body = "[" + ResolvedPost(HashB) + "]" };using var childHttp = new HttpClient(childHandler);
        var childMedia = await LegacyService(groupStore, childHttp).GetMediaDetailAsync("sankaku", child.Id, default);Expect(childMedia?.Key == child.Key && childHandler.Hashes.Single() == HashB, "grouped lookup used another variant's primary hash");
        var recordStore = new LocalStore(Path.Combine(root, "record-hash"));recordStore.ToggleLike(new CatalogItem { Key = "danbooru:7", Source = "danbooru", Id = "7", ContentHash = HashA, Title = "Retained mixed title", MemberKeys = ["danbooru:7", child.Key], ImageRecords = [new() { Owner = child.Key, Hash = HashB }] });
        using var recordHandler = new LegacyTransport { Body = "[" + ResolvedPost(HashB) + "]" };using var recordHttp = new HttpClient(recordHandler);
        var recordMedia = await LegacyService(recordStore, recordHttp).GetMediaDetailAsync("sankaku", child.Id, default);Expect(recordMedia?.Key == child.Key && recordHandler.Hashes.Single() == HashB, "exact imageRecord ownership was not used for the legacy hash");
        recordStore.RefreshSavedMedia(recordMedia!);var record = new LocalStore(Path.Combine(root, "record-hash")).GetSavedWorksSnapshot("likes").Items.Single();Expect(record.Key == "danbooru:7" && record.Title == "Retained mixed title" && record.Thumbnail == recordMedia!.Thumbnail, "owned-record recovery changed the primary identity or failed to persist media");
        Console.WriteLine("Sankaku legacy numeric IDs: exact owned hashes, bounded lookup, rejected ambiguity, retained identity, canonical tag requests and saved media persistence: PASS");
    }
    public static async Task Run()
    {
        var root = Path.Combine(Path.GetTempPath(), "DART-Sankaku-Media-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            await LegacyMedia(root);
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
