using System.Net;
using System.Net.Http.Headers;
using ArtCatalog;

static void Expect(bool value, string message)
{
    if (!value) throw new Exception(message);
}
static HttpResponseMessage Reply(HttpStatusCode status = HttpStatusCode.OK, string body = "[]") =>
    new(status) { Content = new StringContent(body) };
const string Base = "https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=";

// Concurrent sections share pacing and identical GETs share one upstream request.
var starts = new List<DateTimeOffset>();
var active = 0;
var peak = 0;
using var http = new HttpClient(new FakeHandler(async (_, token) => {
    lock (starts) starts.Add(DateTimeOffset.UtcNow);
    peak = Math.Max(peak, Interlocked.Increment(ref active));
    await Task.Delay(10, token);
    Interlocked.Decrement(ref active);
    return Reply();
}));
var client = new Rule34RequestClient(http, TimeSpan.FromMilliseconds(35));
await Task.WhenAll(Enumerable.Range(0, 4).Select(index =>
    client.GetStringAsync(Base + index, "application/json", CancellationToken.None)));
Expect(peak == 1, "Rule34 requests from different sections overlapped");
for (var index = 1; index < starts.Count; index++)
    Expect(starts[index] - starts[index - 1] >= TimeSpan.FromMilliseconds(30),
        "Rule34 requests did not share an interval");
await Task.WhenAll(Enumerable.Range(0, 5).Select(_ =>
    client.GetStringAsync(Base + "shared", "application/json", CancellationToken.None)));
Expect(starts.Count == 5, "Identical concurrent Rule34 GETs were sent more than once");
await client.GetStringAsync(Base + "shared", "application/json", CancellationToken.None);
Expect(starts.Count == 5, "A successful recent Rule34 page was fetched again");
Console.WriteLine("PASS shared pacing, coalescing and successful page cache");

// A slow response already covers the minimum interval between request starts.
// Waiting another full interval after it finishes makes large Following lists take minutes.
var logicalClock = new DateTimeOffset(2026, 9, 28, 12, 0, 0, TimeSpan.Zero);
var slowCalls = 0;
using var slowHttp = new HttpClient(new FakeHandler((_, _) => {
    slowCalls++;
    if (slowCalls == 1) logicalClock = logicalClock.AddSeconds(2);
    return Task.FromResult(Reply());
}));
var slowClient = new Rule34RequestClient(slowHttp, TimeSpan.FromSeconds(1), now: () => logicalClock);
await slowClient.GetStringAsync(Base + "slow-one", "application/json", CancellationToken.None);
using (var deadline = new CancellationTokenSource(TimeSpan.FromMilliseconds(400)))
    await slowClient.GetStringAsync(Base + "slow-two", "application/json", deadline.Token);
Expect(slowCalls == 2, "Rule34 added a redundant interval after a slow response");
Console.WriteLine("PASS slow response counts toward Rule34 pacing");

// One aborted tab must not cancel another tab's shared GET.
var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
var complete = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
using var cancellationHttp = new HttpClient(new FakeHandler(async (_, token) => {
    entered.TrySetResult();
    await complete.Task.WaitAsync(token);
    return Reply();
}));
var cancellationClient = new Rule34RequestClient(cancellationHttp, TimeSpan.Zero);
using var canceled = new CancellationTokenSource();
var first = cancellationClient.GetStringAsync(Base + "cancel", "application/json", canceled.Token);
var second = cancellationClient.GetStringAsync(Base + "cancel", "application/json", CancellationToken.None);
await entered.Task;
canceled.Cancel();
try { await first; throw new Exception("Canceled caller completed"); }
catch (OperationCanceledException) { }
complete.TrySetResult();
Expect(await second == "[]", "Aborting one caller canceled another caller");
Console.WriteLine("PASS independent cancellation of a shared GET");

// Abandoned autocomplete/search requests must leave the queue without hitting the site.
var queueEntered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
var queueRelease = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
var calls = 0;
using var queueHttp = new HttpClient(new FakeHandler(async (_, token) => {
    Interlocked.Increment(ref calls);
    queueEntered.TrySetResult();
    await queueRelease.Task.WaitAsync(token);
    return Reply();
}));
var queueClient = new Rule34RequestClient(queueHttp, TimeSpan.Zero);
var blocker = queueClient.GetStringAsync(Base + "block", "application/json", CancellationToken.None);
await queueEntered.Task;
using var abandoned = new CancellationTokenSource();
var queued = queueClient.GetStringAsync(Base + "abandoned", "application/json", abandoned.Token);
abandoned.Cancel();
try { await queued; throw new Exception("Abandoned caller completed"); }
catch (OperationCanceledException) { }
queueRelease.TrySetResult();
await blocker;
await queueClient.GetStringAsync(Base + "after", "application/json", CancellationToken.None);
Expect(calls == 2, "An abandoned queued request consumed Rule34 quota");
Console.WriteLine("PASS abandoned queued requests do not consume quota");

// Retry-After is source-wide, honors both forms and failures are never cached as empty pages.
var clock = new DateTimeOffset(2026, 9, 27, 12, 0, 0, TimeSpan.Zero);
var limitedCalls = 0;
using var limitedHttp = new HttpClient(new FakeHandler((_, _) => {
    limitedCalls++;
    var reply = limitedCalls == 1 ? Reply(HttpStatusCode.TooManyRequests) : Reply();
    if (limitedCalls == 1) reply.Headers.RetryAfter = new RetryConditionHeaderValue(clock.AddSeconds(120));
    return Task.FromResult(reply);
}));
var limited = new Rule34RequestClient(limitedHttp, TimeSpan.Zero, now: () => clock);
async Task<Rule34RequestException> Limited(string tag) {
    try { await limited.GetStringAsync(Base + tag, "application/json", CancellationToken.None); }
    catch (Rule34RequestException error) { return error; }
    throw new Exception("Expected Rule34 cooldown");
}
var limitError = await Limited("one");
Expect(limitError.RetryAt == clock.AddSeconds(120), "Absolute Retry-After was ignored or shortened");
await Limited("two");
Expect(limitedCalls == 1, "A different section hit Rule34 during its cooldown");
clock = clock.AddSeconds(121);
Expect(await limited.GetStringAsync(Base + "one", "application/json", CancellationToken.None) == "[]",
    "Rule34 did not recover after its cooldown");
Expect(limitedCalls == 2, "A failed Rule34 request was cached as an empty result");
using var deltaHttp = new HttpClient(new FakeHandler((_, _) => {
    var reply = Reply(HttpStatusCode.TooManyRequests);
    reply.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(75));
    return Task.FromResult(reply);
}));
var deltaClient = new Rule34RequestClient(deltaHttp, TimeSpan.Zero, now: () => clock);
try { await deltaClient.GetStringAsync(Base + "delta", "application/json", CancellationToken.None); }
catch (Rule34RequestException error) {
    Expect(error.RetryAt == clock.AddSeconds(75), "Retry-After seconds were ignored");
}
Console.WriteLine("PASS global 429 cooldown, Retry-After and recovery");

foreach (var payload in new[] { "{\"success\":false,\"message\":\"search down\"}", "<html>challenge</html>" }) {
    var requestCount = 0;
    using var failureHttp = new HttpClient(new FakeHandler((_, _) => {
        requestCount++;
        return Task.FromResult(Reply(body: requestCount == 1 ? payload : "[]"));
    }));
    var failureClient = new Rule34RequestClient(failureHttp, TimeSpan.Zero, now: () => clock);
    try { await failureClient.GetStringAsync(Base + "fault", "application/json", CancellationToken.None);
        throw new Exception("Invalid Rule34 response was accepted"); }
    catch (Rule34RequestException error) { Expect(error.RetryAt > clock, "Temporary response failure lacked recovery time"); }
    clock = clock.AddMinutes(1);
    Expect(await failureClient.GetStringAsync(Base + "fault", "application/json", CancellationToken.None) == "[]",
        "Invalid response poisoned the success cache");
}
Console.WriteLine("PASS search-down and HTML responses are failures, not empty pages");

using var emptyHttp = new HttpClient(new FakeHandler((_, _) => Task.FromResult(Reply(body: "  "))));
Expect(await new Rule34RequestClient(emptyHttp, TimeSpan.Zero)
    .GetStringAsync(Base + "empty", "application/json", CancellationToken.None) == "[]",
    "Rule34's valid empty post body became a false outage");
Console.WriteLine("PASS empty post response remains a valid empty page");

sealed class FakeHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> send)
    : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token) =>
        send(request, token);
}
