using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace ArtCatalog;

internal sealed class Rule34RequestException(string message, DateTimeOffset? retryAt = null)
    : InvalidOperationException(message)
{
    public DateTimeOffset? RetryAt { get; } = retryAt;
}

// All Rule34 API users share this client: feeds, searches, profiles and tag lookups.
// Media downloads use their existing, separate transport.
internal sealed class Rule34RequestClient
{
    private sealed class Work
    {
        public readonly CancellationTokenSource Cancellation = new();
        public readonly TaskCompletionSource<string> Completion =
            new(TaskCreationOptions.RunContinuationsAsynchronously);
        public int Readers;
    }
    private readonly HttpClient http;
    private readonly TimeSpan interval;
    private readonly TimeSpan fallbackCooldown;
    private readonly Func<DateTimeOffset> now;
    private readonly object sync = new();
    private readonly SemaphoreSlim gate = new(1, 1);
    private readonly Dictionary<string, Work> pending = new(StringComparer.Ordinal);
    private readonly Dictionary<string, (DateTimeOffset Expires, string Body)> cache = new(StringComparer.Ordinal);
    private DateTimeOffset nextRequest;
    private DateTimeOffset blockedUntil;
    private string blockedMessage = "";

    public Rule34RequestClient(HttpClient http, TimeSpan? interval = null,
        TimeSpan? fallbackCooldown = null, Func<DateTimeOffset>? now = null)
    {
        this.http = http;
        this.interval = interval ?? TimeSpan.FromMilliseconds(1100);
        this.fallbackCooldown = fallbackCooldown ?? TimeSpan.FromSeconds(60);
        this.now = now ?? (() => DateTimeOffset.UtcNow);
    }

    public void ClearCache() { lock (sync) cache.Clear(); }
    public DateTimeOffset? RetryAt
    {
        get { lock (sync) return blockedUntil > now() ? blockedUntil : null; }
    }

    public async Task<string> GetStringAsync(string uri, string accept, CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        var key = accept + "\n" + uri;
        Work work;
        lock (sync)
        {
            if (cache.TryGetValue(key, out var found) && found.Expires > now()) return found.Body;
            ThrowIfBlocked();
            if (!pending.TryGetValue(key, out work!) || work.Cancellation.IsCancellationRequested)
            {
                work = new Work();
                pending[key] = work;
                _ = RunAsync(key, uri, accept, work);
            }
            work.Readers++;
        }
        try { return await work.Completion.Task.WaitAsync(token); }
        finally
        {
            lock (sync)
                if (--work.Readers == 0 && !work.Completion.Task.IsCompleted)
                    work.Cancellation.Cancel();
        }
    }

    private async Task RunAsync(string key, string uri, string accept, Work work)
    {
        // Enter the shared queue after the caller has registered its interest.
        await Task.Yield();
        var token = work.Cancellation.Token;
        try
        {
            await gate.WaitAsync(token);
            string body;
            try
            {
                lock (sync) ThrowIfBlocked();
                while (nextRequest - now() is var delay && delay > TimeSpan.Zero)
                    await Task.Delay(delay, token);
                lock (sync) ThrowIfBlocked();
                token.ThrowIfCancellationRequested();
                nextRequest = now() + interval;
                using var request = new HttpRequestMessage(HttpMethod.Get, uri);
                request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue(accept));
                using var response = await http.SendAsync(request, token);
                if (!response.IsSuccessStatusCode)
                {
                    if (response.StatusCode == HttpStatusCode.TooManyRequests)
                    {
                        var retryAt = response.Headers.RetryAfter?.Date ??
                            now() + (response.Headers.RetryAfter?.Delta ?? fallbackCooldown);
                        throw Block("Rule34 ограничил частоту запросов (HTTP 429). Загрузка возобновится автоматически.",
                            retryAt > now() ? retryAt : now() + TimeSpan.FromSeconds(1));
                    }
                    if (response.StatusCode == HttpStatusCode.Unauthorized)
                        throw new Rule34RequestException("Rule34 отклонил ключ API. Проверьте данные в настройках.");
                    var message = response.StatusCode == HttpStatusCode.Forbidden
                        ? "Rule34 временно ограничил доступ (HTTP 403). Повторим позже."
                        : $"Rule34 временно не отвечает (HTTP {(int)response.StatusCode}). Повторим позже.";
                    throw Block(message, now() + TimeSpan.FromSeconds(15));
                }
                body = await response.Content.ReadAsStringAsync(token);
                if (accept == "application/json") body = ValidateJson(uri, body);
                token.ThrowIfCancellationRequested();
                lock (sync)
                {
                    if (cache.Count >= 256)
                        foreach (var old in cache.Keys.Take(64).ToArray()) cache.Remove(old);
                    cache[key] = (now() + TimeSpan.FromSeconds(45), body);
                }
            }
            finally { gate.Release(); }
            work.Completion.TrySetResult(body);
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested)
        {
            work.Completion.TrySetCanceled(token);
        }
        catch (Exception error) when (error is HttpRequestException or OperationCanceledException)
        {
            work.Completion.TrySetException(Block("Rule34 не ответил вовремя. Повторим загрузку автоматически.",
                now() + TimeSpan.FromSeconds(15)));
        }
        catch (Exception error) { work.Completion.TrySetException(error); }
        finally
        {
            lock (sync)
                if (pending.TryGetValue(key, out var current) && ReferenceEquals(current, work)) pending.Remove(key);
            // Observe abandoned failures without affecting callers that still await them.
            _ = work.Completion.Task.Exception;
            work.Cancellation.Dispose();
        }
    }

    private string ValidateJson(string uri, string body)
    {
        if (string.IsNullOrWhiteSpace(body) && uri.Contains("&s=post&", StringComparison.Ordinal)) return "[]";
        JsonDocument json;
        try { json = JsonDocument.Parse(body); }
        catch (JsonException)
        {
            throw Block("Rule34 вернул неполный ответ или страницу защиты вместо данных. Повторим позже.",
                now() + TimeSpan.FromSeconds(15));
        }
        using (json)
        {
            var root = json.RootElement;
            if (root.ValueKind == JsonValueKind.String || root.ValueKind == JsonValueKind.Object &&
                root.TryGetProperty("success", out var success) &&
                (success.ValueKind == JsonValueKind.False || success.ToString().Equals("false", StringComparison.OrdinalIgnoreCase)))
            {
                var message = root.ValueKind == JsonValueKind.String ? root.GetString() ?? "" :
                    root.TryGetProperty("message", out var value) ? value.ToString() : "";
                if (Regex.IsMatch(message, @"api[ _-]?key|user[ _-]?id|unauthori[sz]ed|invalid credentials|authentication",
                    RegexOptions.IgnoreCase | RegexOptions.CultureInvariant))
                    throw new Rule34RequestException("Rule34 отклонил ключ API. Проверьте данные в настройках.");
                throw Block("Поиск Rule34 временно недоступен на стороне сайта. Загрузка возобновится автоматически.",
                    now() + TimeSpan.FromSeconds(15));
            }
            if (root.ValueKind != JsonValueKind.Array &&
                !(root.ValueKind == JsonValueKind.Object && root.TryGetProperty("post", out var posts) &&
                    posts.ValueKind == JsonValueKind.Array))
                throw Block("Rule34 вернул неполный ответ вместо списка работ. Повторим позже.",
                    now() + TimeSpan.FromSeconds(15));
        }
        return body;
    }

    private Rule34RequestException Block(string message, DateTimeOffset until)
    {
        lock (sync)
        {
            if (until > blockedUntil) { blockedUntil = until; blockedMessage = message; }
            return new Rule34RequestException(blockedMessage, blockedUntil);
        }
    }

    private void ThrowIfBlocked()
    {
        if (blockedUntil > now()) throw new Rule34RequestException(blockedMessage, blockedUntil);
    }
}
