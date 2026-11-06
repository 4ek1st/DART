using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using ArtCatalog;

internal static class DanbooruTransportFixtureTests
{
    private const string Base = "https://danbooru.donmai.us/";
    private sealed class Handler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> reply) : HttpMessageHandler
    {
        public int Calls;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        { Interlocked.Increment(ref Calls); return reply(request, token); }
    }
    private sealed class HeldStream : Stream
    {
        public override bool CanRead => true; public override bool CanSeek => false; public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => 0; set => throw new NotSupportedException(); }
        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken token = default)
        { await Task.Delay(Timeout.Infinite, token); return 0; }
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override void Flush() { } public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
    private static void Expect(bool value, string message) { if (!value) throw new Exception("Danbooru transport: " + message); }
    private static HttpResponseMessage Reply(HttpStatusCode status = HttpStatusCode.OK, string body = "[]") =>
        new(status) { Content = new StringContent(body) };
    private static HttpResponseMessage Success(HttpRequestMessage request)
    {
        var path = request.RequestUri!.AbsolutePath;
        return Reply(body: path.StartsWith("/posts/") && path.EndsWith(".json") && long.TryParse(path[7..^5], out var id)
            ? "{\"id\":" + id + "}" : "[]");
    }
    private static async Task<DanbooruRequestException> Failure(Task<string> pending)
    {
        try { await pending; throw new Exception("Expected a bounded Danbooru failure"); }
        catch (DanbooruRequestException error) { return error; }
    }
    private static async Task MaintenanceAndRecovery()
    {
        var clock = new DateTimeOffset(2026, 11, 6, 12, 0, 0, TimeSpan.Zero);
        var initial = clock;
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var probeCalls = 0;
        using var handler = new Handler(async (request, token) => {
            if (clock == initial) { var failure = Reply(HttpStatusCode.ServiceUnavailable, "Danbooru is down for maintenance."); failure.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(30)); return failure; }
            if (Interlocked.Increment(ref probeCalls) == 1) { entered.TrySetResult(); await release.Task.WaitAsync(token); }
            return Success(request);
        });
        using var http = new HttpClient(handler);
        var client = new DanbooruRequestClient(http, interval: TimeSpan.Zero, now: () => clock, concurrency: 1);
        var failures = await Task.WhenAll(Enumerable.Range(0, 24).Select(index => Failure(client.GetStringAsync(Base + "posts.json?tags=neutral_" + index, default))));
        Expect(handler.Calls == 1, "distinct artists kept contacting the website after maintenance was confirmed");
        Expect(failures.All(error => error.Kind == DanbooruFailureKind.Website && error.RetryAt == initial.AddSeconds(30)), "maintenance deadline/category was lost");
        client.ClearCache();
        Expect((await Failure(client.GetStringAsync(Base + "tags.json", default))).RetryAt == initial.AddSeconds(30), "Refresh cleared the website deadline");
        Expect(handler.Calls == 1, "a different section bypassed the host cooldown");
        clock = clock.AddSeconds(31);
        var recovery = Enumerable.Range(1, 8).Select(index => client.GetStringAsync(Base + "posts/" + index + ".json", default)).ToArray();
        await entered.Task.WaitAsync(TimeSpan.FromSeconds(2));
        Expect(handler.Calls == 2, "expiry sent multiple website probes before the first completed");
        release.TrySetResult(); await Task.WhenAll(recovery);
        Expect(client.RetryAt is null && handler.Calls == 9, "successful expiry probe did not resume pending sections");
    }
    private static async Task DeadlinesAndCachedReads()
    {
        var clock = new DateTimeOffset(2026, 11, 6, 12, 0, 0, TimeSpan.Zero);
        using var handler = new Handler((request, _) => {
            if (request.RequestUri!.AbsolutePath == "/posts/1.json") return Task.FromResult(Reply(body: "{\"id\":1}"));
            var failure = Reply(HttpStatusCode.TooManyRequests);
            failure.Headers.RetryAfter = new RetryConditionHeaderValue(clock.AddHours(2));
            return Task.FromResult(failure);
        });
        using var http = new HttpClient(handler);
        var client = new DanbooruRequestClient(http, interval: TimeSpan.Zero, now: () => clock);
        var known = await client.GetStringAsync(Base + "posts/1.json", default);
        var failure = await Failure(client.GetStringAsync(Base + "posts.json", default));
        Expect(failure.Kind == DanbooruFailureKind.RateLimited && failure.RetryAt == clock.AddHours(2), "date/long Retry-After was clamped or called a website failure");
        Expect(await client.GetStringAsync(Base + "posts/1.json", default) == known && handler.Calls == 2, "valid recent data was unavailable during cooldown");
        foreach (var status in new[] { HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden, HttpStatusCode.BadRequest, HttpStatusCode.UnprocessableEntity })
        {
            using var deniedHandler = new Handler((request, _) => Task.FromResult(request.RequestUri!.AbsolutePath == "/tags.json" ? Reply(status) : Success(request)));
            using var deniedHttp = new HttpClient(deniedHandler);
            var denied = new DanbooruRequestClient(deniedHttp, interval: TimeSpan.Zero);
            var error = await Failure(denied.GetStringAsync(Base + "tags.json", default));
            Expect(error.StatusCode == status && error.Kind != DanbooruFailureKind.Website, "access or query rejection was mislabeled as a website outage");
            Expect(error.RetryAt is null, "access/query rejection invented a shared pause");
            Expect(await denied.GetStringAsync(Base + "posts.json", default) == "[]" && deniedHandler.Calls == 2 && denied.RetryAt is null,
                "an individual restricted request disabled unrelated public search");
        }
        using var pauseHandler = new Handler((_, _) => { var response = Reply(HttpStatusCode.Forbidden); response.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(70)); return Task.FromResult(response); });
        using var pauseHttp = new HttpClient(pauseHandler);
        var paused = new DanbooruRequestClient(pauseHttp, interval: TimeSpan.Zero, now: () => clock);
        var access = await Failure(paused.GetStringAsync(Base + "posts/1.json", default));
        Expect(access.Kind == DanbooruFailureKind.Access && access.StatusCode == HttpStatusCode.Forbidden && access.RetryAt == clock.AddSeconds(70), "explicit access Retry-After was ignored or mislabeled");
        await Failure(paused.GetStringAsync(Base + "posts.json", default));
        Expect(pauseHandler.Calls == 1, "explicit server access pause was bypassed");
    }
    private static async Task ConcurrentExpiryProbe()
    {
        var clock = new DateTimeOffset(2026, 11, 6, 12, 0, 0, TimeSpan.Zero);
        var initial = clock;
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var probing = 0;
        using var handler = new Handler(async (request, token) => {
            if (clock == initial) { var failure = Reply(HttpStatusCode.ServiceUnavailable); failure.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(30)); return failure; }
            if (Interlocked.Increment(ref probing) == 1) { entered.TrySetResult(); await release.Task.WaitAsync(token); }
            return Success(request);
        });
        using var http = new HttpClient(handler);
        var client = new DanbooruRequestClient(http, interval: TimeSpan.Zero, now: () => clock, concurrency: 2);
        await Failure(client.GetStringAsync(Base + "posts.json", default));
        clock = clock.AddSeconds(31);
        var pending = Enumerable.Range(1, 8).Select(index => client.GetStringAsync(Base + "posts/" + index + ".json", default)).ToArray();
        await entered.Task;
        await Task.Delay(20);
        Expect(handler.Calls == 2, "two independent lanes bypassed the single expiry probe");
        release.TrySetResult(); await Task.WhenAll(pending);
        Expect(client.RetryAt is null && handler.Calls == 9, "probe completion did not release both healthy lanes");
    }
    private static async Task TotalBudgets()
    {
        using var heldBodyHandler = new Handler((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StreamContent(new HeldStream()) }));
        using var heldHttp = new HttpClient(heldBodyHandler);
        var bodyClient = new DanbooruRequestClient(heldHttp, timeout: TimeSpan.FromMilliseconds(80), interval: TimeSpan.Zero);
        var watch = Stopwatch.StartNew();
        var body = await Failure(bodyClient.GetStringAsync(Base + "posts.json", default));
        Expect(body.Kind == DanbooruFailureKind.Timeout && watch.Elapsed < TimeSpan.FromSeconds(2), "body read escaped the total deadline after headers arrived");
        using var slowHandler = new Handler(async (_, token) => { await Task.Delay(90, token); return Reply(); });
        using var slowHttp = new HttpClient(slowHandler);
        var queued = new DanbooruRequestClient(slowHttp, timeout: TimeSpan.FromMilliseconds(145), interval: TimeSpan.Zero, concurrency: 1);
        watch.Restart();
        var first = queued.GetStringAsync(Base + "posts/first.json", default);
        var second = Failure(queued.GetStringAsync(Base + "posts/second.json", default));
        await first; var queueFailure = await second;
        Expect(queueFailure.Kind == DanbooruFailureKind.Timeout && watch.Elapsed < TimeSpan.FromMilliseconds(400), "queue waiting received another full response timeout");
        using var headerHandler = new Handler(async (_, token) => { await Task.Delay(Timeout.Infinite, token); return Reply(); });
        using var headerHttp = new HttpClient(headerHandler);
        var headerClient = new DanbooruRequestClient(headerHttp, timeout: TimeSpan.FromMilliseconds(60), interval: TimeSpan.Zero);
        Expect((await Failure(headerClient.GetStringAsync(Base + "posts.json", default))).Kind == DanbooruFailureKind.Timeout, "header wait escaped total budget");
        using var networkHandler = new Handler((_, _) => throw new HttpRequestException("Neutral network failure"));
        using var networkHttp = new HttpClient(networkHandler);
        var network = new DanbooruRequestClient(networkHttp, interval: TimeSpan.Zero);
        Expect((await Failure(network.GetStringAsync(Base + "posts.json", default))).Kind == DanbooruFailureKind.Network, "a network error was called a confirmed website outage");
    }
    private static async Task CancellationAndCoalescing()
    {
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        using var handler = new Handler(async (request, token) => { entered.TrySetResult(); await release.Task.WaitAsync(token); return Success(request); });
        using var http = new HttpClient(handler);
        var client = new DanbooruRequestClient(http, interval: TimeSpan.Zero);
        using var cancel = new CancellationTokenSource();
        var first = client.GetStringAsync(Base + "posts/1.json", cancel.Token);
        var second = client.GetStringAsync(Base + "posts/1.json", default);
        await entered.Task; cancel.Cancel();
        try { await first; throw new Exception("Reader cancellation was ignored"); } catch (OperationCanceledException) { }
        release.TrySetResult(); await second;
        Expect(handler.Calls == 1 && client.RetryAt is null, "one reader cancelled another section or opened the website circuit");
        await client.GetStringAsync(Base + "posts/1.json", default);
        Expect(handler.Calls == 1, "a successful recent response was fetched again");
        var stopped = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        using var abandonedHandler = new Handler(async (request, token) => {
            if (request.RequestUri!.AbsolutePath == "/posts/held.json")
                try { await Task.Delay(Timeout.Infinite, token); }
                finally { stopped.TrySetResult(); }
            return Reply();
        });
        using var abandonedHttp = new HttpClient(abandonedHandler);
        var abandoned = new DanbooruRequestClient(abandonedHttp, interval: TimeSpan.Zero);
        using var leave = new CancellationTokenSource();
        var held = abandoned.GetStringAsync(Base + "posts/held.json", leave.Token);
        while (abandonedHandler.Calls == 0) await Task.Yield();
        leave.Cancel(); try { await held; } catch (OperationCanceledException) { }
        await stopped.Task;
        await abandoned.GetStringAsync(Base + "posts/next.json", default);
        Expect(abandoned.RetryAt is null, "leaving the only tab incorrectly marked the website unavailable");
    }
    private static async Task LimitsAndInvalidResponses()
    {
        foreach (var payload in new[] { "<html>maintenance</html>", "", "[", "false", "{\"success\":false}", "{}", "[\"error\"]", "{\"error\":\"failure\"}" })
        {
            using var handler = new Handler((_, _) => Task.FromResult(Reply(body: payload)));
            using var http = new HttpClient(handler);
            var client = new DanbooruRequestClient(http, interval: TimeSpan.Zero);
            Expect((await Failure(client.GetStringAsync(Base + "posts.json", default))).Kind == DanbooruFailureKind.InvalidResponse, "invalid JSON was accepted as an empty successful page");
            await Failure(client.GetStringAsync(Base + "tags.json", default));
            Expect(handler.Calls == 1, "invalid responses were cached/retried across different sections");
        }
        using var successHandler = new Handler((request, _) => Task.FromResult(Success(request)));
        using var successHttp = new HttpClient(successHandler);
        var cached = new DanbooruRequestClient(successHttp, interval: TimeSpan.Zero);
        for (var index = 1; index <= 140; index++) await cached.GetStringAsync(Base + "posts/" + index + ".json", default);
        await cached.GetStringAsync(Base + "posts/1.json", default);
        Expect(successHandler.Calls == 141, "the successful page cache grew without its entry bound");
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        using var queueHandler = new Handler(async (_, token) => { entered.TrySetResult(); await Task.Delay(Timeout.Infinite, token); return Reply(); });
        using var queueHttp = new HttpClient(queueHandler);
        var queue = new DanbooruRequestClient(queueHttp, interval: TimeSpan.Zero, concurrency: 1, maxPending: 2);
        using var cancel = new CancellationTokenSource();
        var a = queue.GetStringAsync(Base + "posts/a.json", cancel.Token); await entered.Task;
        var b = queue.GetStringAsync(Base + "posts/b.json", cancel.Token);
        var overflow = await Failure(queue.GetStringAsync(Base + "posts/c.json", default));
        Expect(overflow.Kind == DanbooruFailureKind.Queue && queue.RetryAt is null, "queue pressure blamed the website or was unbounded");
        cancel.Cancel(); foreach (var pending in new[] { a, b }) try { await pending; } catch (OperationCanceledException) { }
    }
    private static async Task WrongShapeRecovery()
    {
        foreach (var sample in new[] { (Path: "posts.json", Body: "{}"), (Path: "tags.json", Body: "[\"error\"]"),
            (Path: "posts/7.json", Body: "[]"), (Path: "posts/7.json", Body: "{\"id\":8}"), (Path: "posts/7.json", Body: "{\"error\":\"denied\"}") })
        {
            var clock = new DateTimeOffset(2026, 11, 6, 12, 0, 0, TimeSpan.Zero);
            using var handler = new Handler((request, _) => Task.FromResult(clock.Second == 0 ? Reply(body: sample.Body) : Success(request)));
            using var http = new HttpClient(handler);
            var client = new DanbooruRequestClient(http, interval: TimeSpan.Zero, now: () => clock);
            var error = await Failure(client.GetStringAsync(Base + sample.Path, default));
            Expect(error.Kind == DanbooruFailureKind.InvalidResponse, "unexpected JSON endpoint shape was accepted as success");
            clock = clock.AddSeconds(16);
            var valid = await client.GetStringAsync(Base + sample.Path, default);
            Expect(handler.Calls == 2 && valid != sample.Body && client.RetryAt is null, "an invalid success response poisoned the cached recovery page");
        }
    }
    public static async Task RunAsync()
    {
        await MaintenanceAndRecovery(); await ConcurrentExpiryProbe(); await DeadlinesAndCachedReads(); await TotalBudgets();
        await CancellationAndCoalescing(); await LimitsAndInvalidResponses(); await WrongShapeRecovery();
        Console.WriteLine("Danbooru shared transport: maintenance deadlines, one recovery probe, bounded queue/body/cache, cancellation and access classification PASS");
    }
}
