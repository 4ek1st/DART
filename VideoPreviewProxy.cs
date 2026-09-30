using System.Net;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Http;

namespace ArtCatalog;

// Hover previews have a separate lane and a hard transfer budget. Full playback
// continues to use /api/video and is never restricted by a thumbnail job.
internal sealed class VideoPreviewProxy(HttpClient client)
{
    internal const int ChunkBytes = 512 * 1024;
    internal const int MaxPreviewBytes = 12 * 1024 * 1024;
    private readonly SemaphoreSlim gate = new(2, 2);
    private readonly object sync = new();
    private readonly Dictionary<string, Session> sessions = new(StringComparer.Ordinal);
    private sealed class Session(string url)
    {
        public readonly string Url = url;
        public readonly DateTimeOffset Expires = DateTimeOffset.UtcNow.AddSeconds(25);
        public int Remaining = MaxPreviewBytes;
        public int Requests;
    }

    private static bool ValidUrl(string value) => value.Length <= 2048 &&
        Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == "https" &&
        uri.UserInfo.Length == 0 && CatalogService.IsAllowedSourceHost(uri.Host) &&
        new[] { ".mp4", ".m4v", ".webm", ".ogv" }.Contains(
            Path.GetExtension(uri.AbsolutePath), StringComparer.OrdinalIgnoreCase);

    public async Task WriteAsync(string url, string token, HttpContext context)
    {
        if (!ValidUrl(url) || !Guid.TryParseExact(token, "N", out _))
        {
            context.Response.StatusCode = 400;
            return;
        }
        RangeHeaderValue? incoming = null;
        var text = context.Request.Headers.Range.ToString();
        if (text.Length > 0 && (text.Length > 128 ||
            !RangeHeaderValue.TryParse(text, out incoming) ||
            incoming.Unit != "bytes" || incoming.Ranges.Count != 1 ||
            incoming.Ranges.Single() is { From: null, To: 0 }))
        {
            context.Response.StatusCode = 416;
            return;
        }
        Session session;
        var head = HttpMethods.IsHead(context.Request.Method);
        var reservation = 0;
        lock (sync)
        {
            var now = DateTimeOffset.UtcNow;
            foreach (var expired in sessions.Where(pair => pair.Value.Expires <= now).ToArray())
                sessions.Remove(expired.Key);
            if (!sessions.TryGetValue(token, out session!))
            {
                if (sessions.Count >= 64) { context.Response.StatusCode = 429; return; }
                sessions[token] = session = new Session(url);
            }
            if (session.Url != url || ++session.Requests > 48 ||
                !head && session.Remaining <= 0)
            {
                context.Response.StatusCode = 429;
                return;
            }
            if (!head)
            {
                reservation = Math.Min(ChunkBytes, session.Remaining);
                session.Remaining -= reservation;
            }
        }
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(context.RequestAborted);
        var remainingTime = session.Expires - DateTimeOffset.UtcNow;
        if (remainingTime <= TimeSpan.Zero) { context.Response.StatusCode = 408; return; }
        deadline.CancelAfter(remainingTime);
        var entered = false;
        try
        {
            await gate.WaitAsync(deadline.Token);
            entered = true;
            var range = incoming?.Ranges.Single();
            var start = range?.From ?? 0;
            var allowance = head ? ChunkBytes : reservation;
            if (start > long.MaxValue - allowance) { context.Response.StatusCode = 416; return; }
            var requested = range is { From: null, To: not null }
                ? new RangeHeaderValue(null, Math.Min(range.To.Value, allowance))
                : new RangeHeaderValue(start, Math.Min(range?.To ?? long.MaxValue, start + allowance - 1));
            var uri = new Uri(url);
            for (var redirect = 0; redirect < 4; redirect++)
            {
                using var request = new HttpRequestMessage(head ? HttpMethod.Head : HttpMethod.Get, uri);
                if (!head) request.Headers.Range = requested;
                request.Headers.Referrer = new Uri(uri.Host.EndsWith("sankakucomplex.com", StringComparison.OrdinalIgnoreCase)
                    ? "https://sankaku.app/" : uri.Host.EndsWith("rule34.xxx", StringComparison.OrdinalIgnoreCase)
                    ? "https://rule34.xxx/" : uri.Host.EndsWith("gelbooru.com", StringComparison.OrdinalIgnoreCase)
                    ? "https://gelbooru.com/" : "https://danbooru.donmai.us/");
                using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, deadline.Token);
                if ((int)response.StatusCode is >= 300 and < 400 && response.Headers.Location is not null)
                {
                    uri = new Uri(uri, response.Headers.Location);
                    if (!ValidUrl(uri.AbsoluteUri)) break;
                    continue;
                }
                if (response.StatusCode == HttpStatusCode.RequestedRangeNotSatisfiable)
                {
                    context.Response.StatusCode = 416;
                    if (response.Content.Headers.ContentRange is { } unsatisfied)
                        context.Response.Headers.ContentRange = unsatisfied.ToString();
                    return;
                }
                var mime = response.Content.Headers.ContentType?.MediaType ?? "";
                var length = response.Content.Headers.ContentLength;
                var part = response.Content.Headers.ContentRange;
                if (response.StatusCode is not (HttpStatusCode.OK or HttpStatusCode.PartialContent) ||
                    !(mime.StartsWith("video/", StringComparison.OrdinalIgnoreCase) || mime == "application/octet-stream") ||
                    !head && (length is null or <= 0 || length > allowance ||
                        response.StatusCode == HttpStatusCode.PartialContent &&
                        (part?.Unit != "bytes" || part.From is null || part.To is null ||
                         part.Length is null || part.To - part.From + 1 != length ||
                         part.From < 0 || part.To >= part.Length ||
                         requested.Ranges.Single().From is { } from &&
                            (part.From != from || part.To > requested.Ranges.Single().To))))
                {
                    // Do not read a large 200 response from a host that ignores Range.
                    context.Response.StatusCode = 502;
                    return;
                }
                context.Response.StatusCode = (int)response.StatusCode;
                context.Response.ContentType = mime.StartsWith("video/", StringComparison.OrdinalIgnoreCase)
                    ? mime : Path.GetExtension(uri.AbsolutePath).ToLowerInvariant() switch
                    { ".webm" => "video/webm", ".ogv" => "video/ogg", _ => "video/mp4" };
                context.Response.ContentLength = length;
                context.Response.Headers.CacheControl = "no-store";
                context.Response.Headers.AcceptRanges = response.StatusCode == HttpStatusCode.PartialContent ? "bytes" : "none";
                if (part is not null) context.Response.Headers.ContentRange = part.ToString();
                if (head) return;
                lock (sync) session.Remaining += reservation - (int)length!.Value;
                await using var input = await response.Content.ReadAsStreamAsync(deadline.Token);
                var buffer = new byte[16 * 1024];
                var left = length.Value;
                while (left > 0)
                {
                    var read = await input.ReadAsync(buffer.AsMemory(0, (int)Math.Min(left, buffer.Length)), deadline.Token);
                    if (read == 0) throw new IOException("Incomplete preview range");
                    await context.Response.Body.WriteAsync(buffer.AsMemory(0, read), deadline.Token);
                    left -= read;
                }
                return;
            }
            context.Response.StatusCode = 502;
        }
        catch (Exception error) when (error is HttpRequestException or OperationCanceledException or IOException)
        {
            if (!context.Response.HasStarted && !context.RequestAborted.IsCancellationRequested)
                context.Response.StatusCode = 502;
            else context.Abort();
        }
        finally { if (entered) gate.Release(); }
    }
}
