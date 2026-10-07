using System.Net;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Http;

namespace ArtCatalog;

// Preview and full playback have independent lanes. A hover job transfers at
// most twelve MiB of unique source bytes, even when the decoder repeats ranges.
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
        public readonly SemaphoreSlim Gate = new(1, 1);
        public readonly SortedDictionary<long, byte[]> Parts = [];
        public int Remaining = MaxPreviewBytes, Requests, CachedBytes;
        public long? Length;
        public string Mime = "video/mp4";
        public bool Initialized;
        public PreviewMp4Layout? Layout;
    }
    private sealed class PreviewFailure(int status) : Exception
    { public int Status { get; } = status; }

    private static bool ValidUrl(string value) => value.Length <= 2048 &&
        Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == "https" &&
        uri.UserInfo.Length == 0 && CatalogService.IsAllowedSourceHost(uri.Host) &&
        new[] { ".mp4", ".m4v", ".webm", ".ogv" }.Contains(
            Path.GetExtension(uri.AbsolutePath), StringComparer.OrdinalIgnoreCase);

    private async Task<byte[]> FetchAsync(Session session, long? from, int count, CancellationToken token)
    {
        count = Math.Min(count, Math.Min(ChunkBytes, session.Remaining));
        if (count <= 0) throw new PreviewFailure(429);
        var range = from.HasValue ? new RangeHeaderValue(from.Value, checked(from.Value + count - 1))
            : new RangeHeaderValue(null, count);
        var uri = new Uri(session.Url);
        for (var redirect = 0; redirect < 4; redirect++)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, uri);
            request.Headers.Range = range;
            request.Headers.Referrer = new Uri(uri.Host.EndsWith("sankakucomplex.com", StringComparison.OrdinalIgnoreCase)
                ? "https://sankaku.app/" : uri.Host.EndsWith("rule34.xxx", StringComparison.OrdinalIgnoreCase)
                ? "https://rule34.xxx/" : uri.Host.EndsWith("gelbooru.com", StringComparison.OrdinalIgnoreCase)
                ? "https://gelbooru.com/" : "https://danbooru.donmai.us/");
            using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, token);
            if ((int)response.StatusCode is >= 300 and < 400 && response.Headers.Location is not null)
            {
                uri = new Uri(uri, response.Headers.Location);
                if (!ValidUrl(uri.AbsoluteUri)) break;
                continue;
            }
            if (response.StatusCode == HttpStatusCode.RequestedRangeNotSatisfiable) throw new PreviewFailure(416);
            var mime = response.Content.Headers.ContentType?.MediaType ?? "";
            var length = response.Content.Headers.ContentLength;
            var part = response.Content.Headers.ContentRange;
            if (response.StatusCode is not (HttpStatusCode.OK or HttpStatusCode.PartialContent) ||
                !(mime.StartsWith("video/", StringComparison.OrdinalIgnoreCase) || mime == "application/octet-stream") ||
                length is null or <= 0 || length > count ||
                response.StatusCode == HttpStatusCode.OK && from is > 0 ||
                response.StatusCode == HttpStatusCode.PartialContent &&
                (part?.Unit != "bytes" || part.From is null || part.To is null || part.Length is null ||
                 part.To - part.From + 1 != length || part.From < 0 || part.To >= part.Length ||
                 from.HasValue && part.From != from || from.HasValue && part.To > from.Value + count - 1))
                throw new PreviewFailure(502); // Never read an unbounded 200 response.
            var total = part?.Length ?? length.Value;
            if (session.Length.HasValue && session.Length != total) throw new PreviewFailure(502);
            session.Length = total;
            session.Mime = mime.StartsWith("video/", StringComparison.OrdinalIgnoreCase) ? mime
                : Path.GetExtension(uri.AbsolutePath).ToLowerInvariant() switch
                { ".webm" => "video/webm", ".ogv" => "video/ogg", _ => "video/mp4" };
            session.Remaining -= (int)length.Value;
            var bytes = new byte[(int)length.Value];
            await using var input = await response.Content.ReadAsStreamAsync(token);
            await input.ReadExactlyAsync(bytes, token);
            var start = part?.From ?? 0;
            if (session.Parts.Remove(start, out var replaced)) session.CachedBytes -= replaced.Length;
            session.Parts[start] = bytes;
            session.CachedBytes += bytes.Length;
            // Each session retains at most one MiB plus at most two MiB of
            // rewritten movie metadata; sixteen sessions bound total memory.
            while (session.CachedBytes > 1024 * 1024 && session.Parts.Count > 1)
            {
                var old = session.Parts.First(pair => pair.Key != start);
                session.Parts.Remove(old.Key); session.CachedBytes -= old.Value.Length;
            }
            return bytes;
        }
        throw new PreviewFailure(502);
    }

    private async Task<byte[]> ReadAsync(Session session, long start, int count, CancellationToken token)
    {
        if (session.Length is { } length) count = (int)Math.Min(count, length - start);
        if (start < 0 || count <= 0) throw new PreviewFailure(416);
        var result = new byte[count];
        var copied = 0;
        while (copied < count)
        {
            var position = start + copied;
            var cached = session.Parts.LastOrDefault(pair => pair.Key <= position && position < pair.Key + pair.Value.Length);
            if (cached.Value is null)
            {
                var next = session.Parts.Keys.FirstOrDefault(offset => offset > position, long.MaxValue);
                await FetchAsync(session, position, (int)Math.Min(count - copied, next - position), token);
                continue;
            }
            var offset = (int)(position - cached.Key);
            var take = Math.Min(count - copied, cached.Value.Length - offset);
            cached.Value.AsSpan(offset, take).CopyTo(result.AsSpan(copied));
            copied += take;
        }
        return result;
    }

    private async Task<byte[]> ReadLayoutAsync(Session session, long start, int count, CancellationToken token)
    {
        var layout = session.Layout;
        if (layout is null) return await ReadAsync(session, start, count, token);
        var result = new byte[count];
        var copied = 0;
        while (copied < count)
        {
            var position = start + copied;
            if (position >= layout.InsertAt && position < layout.InsertAt + layout.Movie.Length)
            {
                var offset = (int)(position - layout.InsertAt);
                var take = Math.Min(count - copied, layout.Movie.Length - offset);
                layout.Movie.AsSpan(offset, take).CopyTo(result.AsSpan(copied)); copied += take;
            }
            else
            {
                var boundary = position < layout.InsertAt ? layout.InsertAt
                    : position < layout.OriginalEnd ? layout.OriginalEnd : session.Length!.Value;
                var original = position >= layout.InsertAt + layout.Movie.Length && position < layout.OriginalEnd
                    ? position - layout.Movie.Length : position;
                var take = (int)Math.Min(count - copied, boundary - position);
                var bytes = await ReadAsync(session, original, take, token);
                bytes.CopyTo(result, copied); copied += take;
            }
        }
        return result;
    }

    public async Task WriteAsync(string url, string token, HttpContext context)
    {
        if (!ValidUrl(url) || !Guid.TryParseExact(token, "N", out _))
        { context.Response.StatusCode = 400; return; }
        RangeHeaderValue? incoming = null;
        var text = context.Request.Headers.Range.ToString();
        if (text.Length > 0 && (text.Length > 128 || !RangeHeaderValue.TryParse(text, out incoming) ||
            incoming.Unit != "bytes" || incoming.Ranges.Count != 1 ||
            incoming.Ranges.Single() is { From: null, To: 0 }))
        { context.Response.StatusCode = 416; return; }
        Session session;
        lock (sync)
        {
            foreach (var expired in sessions.Where(pair => pair.Value.Expires <= DateTimeOffset.UtcNow).ToArray())
                sessions.Remove(expired.Key);
            if (!sessions.TryGetValue(token, out session!))
            {
                if (sessions.Count >= 16) { context.Response.StatusCode = 429; return; }
                sessions[token] = session = new Session(url);
            }
            if (session.Url != url || ++session.Requests > 96)
            { context.Response.StatusCode = 429; return; }
        }
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(context.RequestAborted);
        var time = session.Expires - DateTimeOffset.UtcNow;
        if (time <= TimeSpan.Zero) { context.Response.StatusCode = 408; return; }
        deadline.CancelAfter(time);
        var entered = false; var locked = false;
        try
        {
            await gate.WaitAsync(deadline.Token); entered = true;
            await session.Gate.WaitAsync(deadline.Token); locked = true;
            var range = incoming?.Ranges.Single();
            if (!session.Initialized)
            {
                if (range is { From: null, To: not null }) await FetchAsync(session, null, (int)Math.Min(range.To.Value, ChunkBytes), deadline.Token);
                else await FetchAsync(session, 0, ChunkBytes, deadline.Token);
                if (Path.GetExtension(new Uri(url).AbsolutePath).ToLowerInvariant() is ".mp4" or ".m4v")
                    session.Layout = await PreviewMp4Layout.ReadAsync(session.Length!.Value,
                        (offset, length) => ReadAsync(session, offset, length, deadline.Token));
                session.Initialized = true;
            }
            if (context.Request.Query["info"] == "1")
            {
                context.Response.Headers.CacheControl = "no-store";
                await context.Response.WriteAsJsonAsync(new { sampleTimes = session.Layout?.SampleTimes ?? [] }, deadline.Token);
                return;
            }
            var total = session.Length!.Value;
            var start = range is { From: null, To: not null } ? Math.Max(0, total - range.To.Value) : range?.From ?? 0;
            if (start < 0 || start >= total) { context.Response.StatusCode = 416; context.Response.Headers.ContentRange = $"bytes */{total}"; return; }
            var count = (int)Math.Min(ChunkBytes, total - start);
            if (range is { From: not null, To: not null }) count = (int)Math.Min(count, range.To.Value - start + 1);
            if (count <= 0) throw new PreviewFailure(416);
            var head = HttpMethods.IsHead(context.Request.Method);
            var bytes = head ? Array.Empty<byte>() : await ReadLayoutAsync(session, start, count, deadline.Token);
            context.Response.StatusCode = 206;
            context.Response.ContentType = session.Mime;
            context.Response.ContentLength = count;
            context.Response.Headers.CacheControl = "no-store";
            context.Response.Headers.AcceptRanges = "bytes";
            context.Response.Headers.ContentRange = $"bytes {start}-{start + count - 1}/{total}";
            if (!head) await context.Response.Body.WriteAsync(bytes, deadline.Token);
        }
        catch (PreviewFailure failure) { context.Response.StatusCode = failure.Status; }
        catch (Exception error) when (error is HttpRequestException or OperationCanceledException or IOException or OverflowException)
        {
            if (!context.Response.HasStarted && !context.RequestAborted.IsCancellationRequested) context.Response.StatusCode = 502;
            else context.Abort();
        }
        finally { if (locked) session.Gate.Release(); if (entered) gate.Release(); }
    }
}
