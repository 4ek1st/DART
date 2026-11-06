using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace ArtCatalog;

internal enum DanbooruFailureKind { Website, RateLimited, Access, Request, Timeout, Network, InvalidResponse, Queue }

internal sealed class DanbooruRequestException(string message, DateTimeOffset? retryAt,
    DanbooruFailureKind kind, HttpStatusCode statusCode = HttpStatusCode.ServiceUnavailable)
    : InvalidOperationException(message)
{
    public DateTimeOffset? RetryAt { get; } = retryAt;
    public DanbooruFailureKind Kind { get; } = kind;
    public HttpStatusCode StatusCode { get; } = statusCode;
}

// Search, profiles, detail and autocomplete share one host circuit. Media keeps
// its existing independent transport. A stopped reader never owns another tab's GET.
internal sealed class DanbooruRequestClient
{
    private sealed class Work(TimeSpan timeout)
    {
        public readonly CancellationTokenSource Cancellation = new(timeout);
        public readonly TaskCompletionSource<string> Completion = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public int Readers;
        public volatile bool Abandoned;
        public bool Probe;
        public long Generation;
    }
    private readonly HttpClient http;
    private readonly Func<DateTimeOffset> now;
    private readonly TimeSpan timeout, interval;
    private readonly SemaphoreSlim gate;
    private readonly object sync = new();
    private readonly Dictionary<string, Work> pending = new(StringComparer.Ordinal);
    private readonly Dictionary<string, (DateTimeOffset Expires, string Body, int Bytes)> cache = new(StringComparer.Ordinal);
    private readonly int maxPending;
    private long cacheBytes, generation;
    private DateTimeOffset blockedUntil, nextRequest;
    private DanbooruRequestException? blocked;
    private Work? probeOwner;
    private TaskCompletionSource<bool>? probe;
    private const int MaxBodyBytes = 8 * 1024 * 1024;

    public DanbooruRequestClient(HttpClient http, TimeSpan? timeout = null, TimeSpan? interval = null,
        Func<DateTimeOffset>? now = null, int concurrency = 2, int maxPending = 64)
    {
        this.http = http;
        this.timeout = timeout ?? TimeSpan.FromSeconds(8);
        this.interval = interval ?? TimeSpan.FromMilliseconds(200);
        this.now = now ?? (() => DateTimeOffset.UtcNow);
        gate = new(Math.Clamp(concurrency, 1, 4));
        this.maxPending = Math.Clamp(maxPending, 1, 128);
    }

    public DateTimeOffset? RetryAt { get { lock (sync) return blockedUntil > now() ? blockedUntil : null; } }
    public void ClearCache() { lock (sync) { cache.Clear(); cacheBytes = 0; } }

    public async Task<string> GetStringAsync(string uri, CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        Work work;
        lock (sync)
        {
            if (cache.TryGetValue(uri, out var found) && found.Expires > now()) return found.Body;
            ThrowIfBlocked();
            if (!pending.TryGetValue(uri, out work!) || work.Abandoned || work.Cancellation.IsCancellationRequested)
            {
                if (pending.Count >= maxPending)
                    throw new DanbooruRequestException("Очередь Danbooru занята. Повторим позже.", now().AddSeconds(1), DanbooruFailureKind.Queue);
                work = new Work(timeout);
                pending[uri] = work;
                _ = RunAsync(uri, work);
            }
            work.Readers++;
        }
        try { return await work.Completion.Task.WaitAsync(token); }
        finally
        {
            lock (sync)
                if (--work.Readers == 0 && !work.Completion.Task.IsCompleted)
                { work.Abandoned = true; work.Cancellation.Cancel(); }
        }
    }

    private async Task AvailabilityAsync(Work work, CancellationToken token)
    {
        for (;;)
        {
            Task? wait = null;
            lock (sync)
            {
                ThrowIfBlocked();
                if (blocked is null) return;
                if (probeOwner is null)
                {
                    probeOwner = work;
                    probe = new(TaskCreationOptions.RunContinuationsAsynchronously);
                    work.Probe = true; work.Generation = generation;
                    return;
                }
                wait = probe!.Task;
            }
            await wait.WaitAsync(token);
        }
    }

    private async Task RunAsync(string uri, Work work)
    {
        await Task.Yield();
        var token = work.Cancellation.Token;
        var entered = false;
        try
        {
            await gate.WaitAsync(token); entered = true;
            await AvailabilityAsync(work, token);
            DateTimeOffset start;
            lock (sync)
            {
                ThrowIfBlocked();
                start = nextRequest > now() ? nextRequest : now();
                nextRequest = start + interval;
            }
            if (start > now()) await Task.Delay(start - now(), token);
            lock (sync) ThrowIfBlocked();
            token.ThrowIfCancellationRequested();
            using var request = new HttpRequestMessage(HttpMethod.Get, uri);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, token);
            if (!response.IsSuccessStatusCode)
            {
                var status = response.StatusCode;
                var deadline = response.Headers.RetryAfter?.Date ??
                    now() + (response.Headers.RetryAfter?.Delta ?? TimeSpan.FromSeconds(status == HttpStatusCode.TooManyRequests ? 60 : 15));
                if (deadline <= now()) deadline = now().AddSeconds(1);
                if ((int)status >= 500)
                    throw Block($"Danbooru временно недоступен (HTTP {(int)status}). Повторим после паузы сайта.", deadline, DanbooruFailureKind.Website, status);
                if (status == HttpStatusCode.TooManyRequests)
                    throw Block("Danbooru ограничил частоту запросов (HTTP 429). Повторим позже.", deadline, DanbooruFailureKind.RateLimited, status);
                if (status is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
                {
                    // A restricted post/query must not close public search.
                    // Only a server-provided pause is shared across callers.
                    if (response.Headers.RetryAfter is not null)
                        throw Block($"Danbooru ограничил доступ (HTTP {(int)status}).", deadline, DanbooruFailureKind.Access, status);
                    throw new DanbooruRequestException($"Danbooru ограничил доступ (HTTP {(int)status}).", null, DanbooruFailureKind.Access, status);
                }
                throw new DanbooruRequestException($"Danbooru вернул ошибку HTTP {(int)status}.", null, DanbooruFailureKind.Request, status);
            }
            if (response.Content.Headers.ContentLength > MaxBodyBytes)
                throw InvalidResponse();
            await using var stream = await response.Content.ReadAsStreamAsync(token);
            using var bodyBytes = new MemoryStream();
            var buffer = new byte[32 * 1024];
            int count;
            while ((count = await stream.ReadAsync(buffer, token)) > 0)
            {
                if (bodyBytes.Length + count > MaxBodyBytes) throw InvalidResponse();
                bodyBytes.Write(buffer, 0, count);
            }
            var body = Encoding.UTF8.GetString(bodyBytes.GetBuffer(), 0, (int)bodyBytes.Length).TrimStart('\uFEFF');
            try
            {
                using var json = JsonDocument.Parse(body);
                if (json.RootElement.ValueKind is not (JsonValueKind.Array or JsonValueKind.Object)) throw InvalidResponse();
                if (json.RootElement.ValueKind == JsonValueKind.Object && json.RootElement.TryGetProperty("success", out var success) &&
                    success.ValueKind == JsonValueKind.False) throw InvalidResponse();
                if (!ValidEndpointPayload(uri, json.RootElement)) throw InvalidResponse();
            }
            catch (JsonException) { throw InvalidResponse(); }
            token.ThrowIfCancellationRequested();
            lock (sync)
            {
                if (work.Probe && ReferenceEquals(probeOwner, work) && work.Generation == generation)
                { blocked = null; blockedUntil = default; }
                if (cache.TryGetValue(uri, out var old)) cacheBytes -= old.Bytes;
                cache.Remove(uri);
                var size = Encoding.UTF8.GetByteCount(body);
                while (cache.Count > 0 && (cache.Count >= 128 || cacheBytes + size > MaxBodyBytes))
                {
                    var key = cache.Keys.First(); cacheBytes -= cache[key].Bytes; cache.Remove(key);
                }
                cache[uri] = (now().AddSeconds(45), body, size); cacheBytes += size;
            }
            work.Completion.TrySetResult(body);
        }
        catch (OperationCanceledException) when (work.Abandoned)
        { work.Completion.TrySetCanceled(token); }
        catch (Exception error) when (work.Abandoned && (error is HttpRequestException or IOException))
        { work.Completion.TrySetCanceled(token); }
        catch (OperationCanceledException)
        { work.Completion.TrySetException(Block("Danbooru не ответил вовремя. Повторим позже.", now().AddSeconds(15), DanbooruFailureKind.Timeout)); }
        catch (SourceWebsiteUnavailableException error)
        { work.Completion.TrySetException(Block("Danbooru временно недоступен. Повторим после паузы сайта.", error.RetryAt, DanbooruFailureKind.Website)); }
        catch (HttpRequestException)
        { work.Completion.TrySetException(Block("Не удалось соединиться с Danbooru. Повторим позже.", now().AddSeconds(15), DanbooruFailureKind.Network)); }
        catch (IOException)
        { work.Completion.TrySetException(Block("Не удалось прочитать ответ Danbooru. Повторим позже.", now().AddSeconds(15), DanbooruFailureKind.Network)); }
        catch (Exception error) { work.Completion.TrySetException(error); }
        finally
        {
            lock (sync)
            {
                if (ReferenceEquals(probeOwner, work))
                { var completed = probe; probe = null; probeOwner = null; completed?.TrySetResult(true); }
                if (pending.TryGetValue(uri, out var current) && ReferenceEquals(current, work)) pending.Remove(uri);
            }
            if (entered) gate.Release();
            _ = work.Completion.Task.Exception;
            work.Cancellation.Dispose();
        }
    }

    private static bool ValidEndpointPayload(string uri, JsonElement root)
    {
        var path = new Uri(uri).AbsolutePath;
        if (path is "/posts.json" or "/tags.json")
            return root.ValueKind == JsonValueKind.Array && root.EnumerateArray().All(value => value.ValueKind == JsonValueKind.Object);
        if (path.StartsWith("/posts/", StringComparison.Ordinal) && path.EndsWith(".json", StringComparison.Ordinal) &&
            long.TryParse(path[7..^5], out var expected))
        {
            if (expected <= 0 || root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("id", out var id)) return false;
            return id.ValueKind == JsonValueKind.Number && id.TryGetInt64(out var actual) && actual == expected ||
                id.ValueKind == JsonValueKind.String && long.TryParse(id.GetString(), out actual) && actual == expected;
        }
        return true;
    }

    private DanbooruRequestException InvalidResponse() => Block("Danbooru вернул неполный ответ вместо данных. Повторим позже.",
        now().AddSeconds(15), DanbooruFailureKind.InvalidResponse);
    private DanbooruRequestException Block(string message, DateTimeOffset until, DanbooruFailureKind kind,
        HttpStatusCode status = HttpStatusCode.ServiceUnavailable)
    {
        lock (sync)
        {
            generation++;
            if (blocked is null || until > blockedUntil)
            { blockedUntil = until; blocked = new(message, until, kind, status); }
            return blocked;
        }
    }
    private void ThrowIfBlocked()
    { if (blocked is not null && blockedUntil > now()) throw blocked; }
}
