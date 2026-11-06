using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using ArtCatalog;

internal static class SourceAvailabilityFixtureTests
{
    private sealed class Replies(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> send) : HttpMessageHandler
    {
        internal int Requests;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        { Interlocked.Increment(ref Requests); return send(request, token); }
    }
    private static void Expect(bool value, string message) { if (!value) throw new Exception(message); }
    private static SourceAvailabilityStatus Status(SourceAvailability state, string source) => state.Snapshot().Single(row => row.Source == source);

    internal static async Task RunAsync()
    {
        var hosts = new Dictionary<string, string> { ["danbooru"] = "danbooru.donmai.us",
            ["gelbooru"] = "gelbooru.com", ["rule34"] = "api.rule34.xxx", ["sankaku"] = "sankakuapi.com" };
        foreach (var (source, host) in hosts)
        {
            var now = DateTimeOffset.Parse("2026-11-06T12:00:00Z");
            var state = new SourceAvailability(() => now);
            var handler = new Replies((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)
                { Headers = { RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(30)) } }));
            using var http = new HttpClient(new SourceAvailabilityHandler(handler, state));
            using (await http.GetAsync("https://" + host + "/posts.json?tags=neutral_fixture")) { }
            Expect(Status(state, source).WebsiteUnavailable && state.GetRetryAt(source) == now.AddSeconds(30),
                "A real maintenance response must mark only its source with the exact retry deadline");
            foreach (var row in state.Snapshot().Where(row => row.Source != source))
                Expect(!row.WebsiteUnavailable && row.CheckedAt is null, "An outage must not mark other sources");
            for (var index = 0; index < 12; index++)
            {
                try { using var response = await http.GetAsync("https://" + host + "/posts/" + index + ".json"); throw new Exception("Blocked request reached HTTP"); }
                catch (SourceWebsiteUnavailableException error)
                { Expect(error.RetryAt == now.AddSeconds(30), "Preflight must retain the server deadline"); }
            }
            Expect(handler.Requests == 1, "Confirmed maintenance must suppress distinct queued paths");
            now = now.AddSeconds(31);
            Expect(state.GetRetryAt(source) is null && Status(state, source).WebsiteUnavailable,
                "Retry expiry permits a probe; it must not pretend the site recovered");
            var okHandler = new Replies((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)));
            using var recovered = new HttpClient(new SourceAvailabilityHandler(okHandler, state));
            using (await recovered.GetAsync("https://" + host + "/posts.json")) { }
            Expect(!Status(state, source).WebsiteUnavailable && Status(state, source).StatusCode == 200,
                "A real successful probe must restore the source color");
        }

        {
            var now = DateTimeOffset.Parse("2026-11-06T12:00:00Z");
            var state = new SourceAvailability(() => now);
            var longDeadline = now.AddHours(2);
            var handler = new Replies((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadGateway)
                { Headers = { RetryAfter = new RetryConditionHeaderValue(longDeadline) } }));
            using var http = new HttpClient(new SourceAvailabilityHandler(handler, state));
            using (await http.GetAsync("https://danbooru.donmai.us/posts.json")) { }
            Expect(state.GetRetryAt("danbooru") == longDeadline, "Absolute and long server deadlines must not be clamped");
            using var canceled = new CancellationTokenSource(); canceled.Cancel();
            try { using var response = await http.GetAsync("https://danbooru.donmai.us/posts.json", canceled.Token); throw new Exception("Canceled request succeeded"); }
            catch (OperationCanceledException) { }
            Expect(handler.Requests == 1 && state.GetRetryAt("danbooru") == longDeadline,
                "Caller cancellation cannot change source evidence");
        }

        foreach (var code in new[] { HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden, HttpStatusCode.TooManyRequests, HttpStatusCode.NotFound })
        {
            var state = new SourceAvailability();
            using var http = new HttpClient(new SourceAvailabilityHandler(new Replies((_, _) =>
                Task.FromResult(new HttpResponseMessage(code))), state));
            using (await http.GetAsync("https://api.rule34.xxx/index.php")) { }
            Expect(!Status(state, "rule34").WebsiteUnavailable && state.GetRetryAt("rule34") is null,
                "Credentials, access restrictions and rate limits must not falsely blame the website");
        }
        {
            var state = new SourceAvailability();
            using var http = new HttpClient(new SourceAvailabilityHandler(new Replies((_, _) =>
                throw new HttpRequestException("Neutral network failure")), state));
            try { using var response = await http.GetAsync("https://gelbooru.com/index.php"); throw new Exception("Network fixture unexpectedly succeeded"); }
            catch (HttpRequestException) { }
            Expect(state.Snapshot().All(row => row.CheckedAt is null && !row.WebsiteUnavailable),
                "Network failures must remain unclassified rather than a website outage");
        }
        {
            var state = new SourceAvailability();
            using var http = new HttpClient(new SourceAvailabilityHandler(new Replies((_, _) =>
                Task.FromResult(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable))), state));
            using (await http.GetAsync("https://cdn.donmai.us/sample.jpg")) { }
            using (await http.GetAsync("https://danbooru.donmai.us.example.test/posts.json")) { }
            Expect(state.Snapshot().All(row => row.CheckedAt is null), "Media CDNs and lookalike hosts are not API health evidence");
            var older = state.Begin(); var newer = state.Begin();
            state.Observe("danbooru", HttpStatusCode.OK, newer);
            state.Observe("danbooru", HttpStatusCode.ServiceUnavailable, older);
            Expect(!Status(state, "danbooru").WebsiteUnavailable, "A delayed older response must not overwrite a newer successful probe");
            state.Observe("not-a-source", HttpStatusCode.ServiceUnavailable, state.Begin());
            var wire = JsonSerializer.Serialize(state.Snapshot());
            Expect(state.Snapshot().Length == 4 && !wire.Contains("http") && !wire.Contains("neutral_fixture"),
                "The status API must contain only bounded source evidence, never request URLs or queries");
        }
        Console.WriteLine("Source availability: four-source maintenance, recovery, Retry-After, neutral auth/network/cancellation, exact hosts and private bounded status PASS");
    }
}
