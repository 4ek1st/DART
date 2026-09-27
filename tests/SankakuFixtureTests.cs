using System.Net;
using System.Text;
using System.Text.Json;
using ArtCatalog;

internal static class SankakuFixtureTests
{
    private static void Expect(bool value, string message)
    { if (!value) throw new Exception("Sankaku: " + message); }
    private sealed class Session : ISankakuSessionStore
    {
        public SankakuSession Value = new();
        public SankakuSession GetSankakuSession() => Value;
        public bool SetSankakuSession(SankakuSession value, string? expectedToken = null)
        {
            if (expectedToken is not null && Value.AccessToken != expectedToken) return false;
            Value = value; return true;
        }
    }
    private sealed class Transport : HttpMessageHandler
    {
        public readonly Queue<(int Status, string Body)> Responses = new();
        public readonly List<(string Path, string Token, string Body)> Calls = [];
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        {
            Expect(request.RequestUri!.Host == "sankakuapi.com", "credentials were sent to an unexpected host");
            Expect(!request.Headers.Contains("Platform"), "web header restricts otherwise public media");
            Calls.Add((request.RequestUri.PathAndQuery, request.Headers.Authorization?.Parameter ?? "",
                request.Content is null ? "" : await request.Content.ReadAsStringAsync(token)));
            var response = Responses.Dequeue();
            return new((HttpStatusCode)response.Status) { Content = new StringContent(response.Body) };
        }
    }
    private static async Task AccessFailure(Func<Task> action, bool loginRequired)
    {
        try { await action(); throw new Exception("Sankaku accepted restricted request"); }
        catch (SankakuAccessException error) { Expect(error.LoginRequired == loginRequired, "wrong access prompt"); }
    }

    private static async Task ShortSearchPages()
    {
        var handler = new Transport();
        using var http = new HttpClient(handler);
        var store = new LocalStore(Path.Combine(Path.GetTempPath(), "ArtCatalog-Sankaku-Paging-" + Guid.NewGuid()));
        var service = new CatalogService(store);
        typeof(CatalogService).GetField("Sankaku", System.Reflection.BindingFlags.Instance |
            System.Reflection.BindingFlags.NonPublic)!.SetValue(service, new SankakuApi(store, http));
        string Posts(int count, string prefix, string rating = "e") => JsonSerializer.Serialize(
            Enumerable.Range(0, count).Select(index => new
            {
                id = prefix + index, rating, status = "active",
                preview_url = "https://s.sankakucomplex.com/" + prefix + index + ".jpg",
                file_url = "https://s.sankakucomplex.com/" + prefix + index + ".jpg"
            }));

        handler.Responses.Enqueue((200, Posts(13, "First")));
        var first = await service.SearchAsync("", 0, ["sankaku"], "all", "recent", "illustrations", default);
        Expect(first.Items.Count == 13 && first.SourceStats["sankaku"].Received == 13,
            "short page lost available artwork");
        Expect(first.HasMoreSources.SequenceEqual(["sankaku"]),
            "a short nonempty Sankaku page incorrectly ended the feed");
        handler.Responses.Enqueue((200, Posts(16, "Second")));
        var second = await service.SearchAsync("", 1, ["sankaku"], "all", "recent", "illustrations", default);
        Expect(second.Items.Count == 16 && second.Items[0].Id == "Second0" &&
            second.HasMoreSources.SequenceEqual(["sankaku"]), "next short page was skipped or repeated");
        handler.Responses.Enqueue((200, "[]"));
        var end = await service.SearchAsync("", 2, ["sankaku"], "all", "recent", "illustrations", default);
        Expect(end.Items.Count == 0 && end.HasMoreSources.Count == 0, "empty terminal page kept loading forever");
        Expect(handler.Calls.Select(call => call.Path).SequenceEqual([
            "/v2/posts?lang=en&limit=24&page=1&tags=",
            "/v2/posts?lang=en&limit=24&page=2&tags=",
            "/v2/posts?lang=en&limit=24&page=3&tags="]), "pagination requested the wrong offsets");

        handler.Responses.Enqueue((200, Posts(7, "Popular")));
        var popular = await service.SearchAsync("", 0, ["sankaku"], "all", "popular", "illustrations", default);
        Expect(popular.Items.Select(item => item.Id).SequenceEqual([
            "Popular0", "Popular1", "Popular2", "Popular3", "Popular4", "Popular5", "Popular6"]) &&
            popular.HasMoreSources.SequenceEqual(["sankaku"]), "short popularity page lost its native order or continuation");

        handler.Responses.Enqueue((200, Posts(4, "Filtered")));
        var filtered = await service.SearchAsync("", 0, ["sankaku"], "general", "recent", "illustrations", default);
        Expect(filtered.Items.Count == 0 && filtered.SourceStats["sankaku"].RatingFiltered == 4 &&
            filtered.HasMoreSources.SequenceEqual(["sankaku"]), "local rating filtering stopped later available pages");
        Console.WriteLine("Sankaku short pages, popularity order and terminal page: PASS");
    }

    public static async Task Run()
    {
        await ShortSearchPages();
        using var mapped = JsonDocument.Parse("""
            {"id":"Alpha123","rating":"q","status":"active","author":{"id":9,"name":"uploader"},
             "file_url":"https://v.sankakucomplex.com/test.mp4?e=200&m=sig",
             "preview_url":"https://s.sankakucomplex.com/test.jpg?e=200&m=sig",
             "created_at":{"s":1700000000},"md5":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
             "parent_id":"Parent123","total_score":17,"source":"https://www.pixiv.net/artworks/456",
             "tags":[{"name":"real_artist","type":1},{"name":"character","type":4},
                      {"name":"original_character","type":4},{"name":"original","type":3}]}
            """);
        var item = CatalogService.MapSankaku(mapped.RootElement)!;
        Expect(item.Id == "Alpha123" && item.Rating == "q", "identity/rating mapping");
        Expect(item.CreatorTag == "real_artist" && item.UploaderName == "uploader", "artist replaced by uploader");
        Expect(item.CharacterTags.SequenceEqual(["character"]), "tag categories lost");
        Expect(item.Title == "character" && item.GroupKey == "sankaku:parent:Parent123", "title/group mapping");
        Expect(item.Images.Single().Contains("test.mp4") && item.Published.StartsWith("2023-11-14"), "media/date mapping");
        Expect(item.PopularityCount == 17 && item.PixivGroupKey == "pixiv:456", "popularity and source identity");
        Expect(CatalogService.IsAllowedSourceHost("s.sankakucomplex.com") &&
            !CatalogService.IsAllowedSourceHost("sankakucomplex.com.evil.test"), "media host boundary");
        using var locked = JsonDocument.Parse("""
            {"id":123,"rating":"s","preview_url":"https://s.sankakucomplex.com/a.jpg","file_url":null}
            """);
        Expect(CatalogService.MapSankaku(locked.RootElement) is { RequiresAuthentication: true, Rating: "g" },
            "preview only artwork must ask for login");
        Expect(SankakuApi.SearchPath("landscape", 2, "explicit", "popular").Contains("page=3") &&
            SankakuApi.SearchPath("landscape", 2, "explicit", "popular").Contains("order%3Apopularity"), "native popularity/paging");
        Expect(!SankakuApi.ValidId("../auth/token"), "invalid ID accepted");

        var session = new Session();
        var handler = new Transport();
        using var http = new HttpClient(handler);
        var api = new SankakuApi(session, http);
        handler.Responses.Enqueue((200, "{\"access_token\":\"access\",\"refresh_token\":\"refresh\"}"));
        await api.LoginAsync(" user ", "secret", default);
        Expect(session.Value == new SankakuSession("access", "refresh", "user"), "login session missing");
        Expect(handler.Calls[0].Token.Length == 0 && handler.Calls[0].Body.Contains("secret"), "login protocol");
        handler.Responses.Enqueue((401, "{}"));
        handler.Responses.Enqueue((200, "{\"access_token\":\"renewed\",\"refresh_token\":\"rotated\"}"));
        handler.Responses.Enqueue((200, "[]"));
        using (await api.PostsAsync("landscape", 0, "general", "recent", default)) { }
        Expect(handler.Calls[^1].Token == "renewed" && session.Value.RefreshToken == "rotated", "token refresh not retried once");
        handler.Responses.Enqueue((401, "{}"));
        handler.Responses.Enqueue((429, "{}"));
        try { using var _ = await api.PostsAsync("", 0, "all", "recent", default); }
        catch (InvalidOperationException error) { Expect(error is not SankakuAccessException, "rate limit is not logout"); }
        Expect(session.Value.AccessToken == "renewed", "temporary refresh error erased session");
        handler.Responses.Enqueue((403, "{\"code\":\"invalid-token\"}"));
        handler.Responses.Enqueue((403, "{}"));
        await AccessFailure(async () => { using var _ = await api.PostsAsync("", 0, "all", "recent", default); }, true);
        Expect(session.Value.AccessToken.Length == 0, "expired refresh was persisted");
        handler.Responses.Enqueue((429, "{\"code\":\"_tags-explicit-limit\"}"));
        await AccessFailure(async () => { using var _ = await api.PostsAsync("", 0, "all", "recent", default); }, true);
        handler.Responses.Enqueue((429, "{\"success\":false,\"code\":\"snackbar__anonymous_tags-limit\",\"param\":\"4\"}"));
        await AccessFailure(async () => { using var _ = await api.PostsAsync("many tags here", 0, "all", "recent", default); }, true);
        session.Value = new("previous", "previous-refresh", "previous-user");
        handler.Responses.Enqueue((403, "{\"error\":\"invalid login or password\"}"));
        try { await api.LoginAsync("bad", "bad", default); throw new Exception("Invalid login accepted"); }
        catch (InvalidOperationException) { }
        Expect(session.Value.AccessToken == "previous", "failed login erased previous session");
        await api.LogoutAsync(default);
        Expect(session.Value == new SankakuSession(), "logout failed");

        var profile = Path.Combine(Path.GetTempPath(), "ArtCatalog-Sankaku-" + Guid.NewGuid());
        var store = new LocalStore(profile);
        store.SetSankakuSession(new("sensitive-access", "sensitive-refresh", "account"));
        var bytes = File.ReadAllBytes(Path.Combine(profile, "sankaku-session.bin"));
        Expect(!Encoding.UTF8.GetString(bytes).Contains("sensitive"), "session persisted without DPAPI");
        var reopened = new LocalStore(profile);
        Expect(reopened.GetSankakuSession().AccessToken == "sensitive-access" &&
            reopened.GetPublicSettings().HasSankakuSession, "session did not survive restart");
        Expect(!JsonSerializer.Serialize(reopened.GetPublicSettings()).Contains("sensitive"), "public settings leaked tokens");
        reopened.UpdateSettings(new());
        Expect(reopened.GetSankakuSession().Login == "account", "other provider settings cleared Sankaku");
        reopened.SetSankakuSession(new());
        Expect(!store.SetSankakuSession(new("stale"), "sensitive-access"), "late refresh resurrected logout");
        Console.WriteLine("Sankaku mapping, access, refresh and encrypted persistence: PASS");
    }
}
