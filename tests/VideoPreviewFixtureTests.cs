using System.Net;
using System.Net.Http.Headers;
using System.Reflection;
using ArtCatalog;
using Microsoft.AspNetCore.Http;

internal static class VideoPreviewFixtureTests
{
    private sealed class Handler(Func<HttpRequestMessage, HttpResponseMessage> reply) : HttpMessageHandler
    {
        public int Calls;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        { token.ThrowIfCancellationRequested(); Calls++; return Task.FromResult(reply(request)); }
    }
    private sealed class TrackedStream(int length) : MemoryStream(new byte[length])
    {
        public int Reads;
        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken token = default)
        { Reads++; return base.ReadAsync(buffer, token); }
    }
    private static Func<string, string, HttpContext, Task> Writer(HttpMessageHandler handler)
    {
        var type = typeof(CatalogItem).Assembly.GetType("ArtCatalog.VideoPreviewProxy")!;
        var instance = Activator.CreateInstance(type, [new HttpClient(handler)])!;
        return type.GetMethod("WriteAsync")!.CreateDelegate<Func<string, string, HttpContext, Task>>(instance);
    }
    private static DefaultHttpContext Context(string range = "bytes=0-", string method = "GET")
    {
        var context = new DefaultHttpContext();
        context.Request.Method = method; context.Request.Headers.Range = range;
        context.Response.Body = new MemoryStream(); return context;
    }
    private static void Expect(bool value, string message)
    { if (!value) throw new Exception(message); }

    public static async Task RunAsync()
    {
        const int chunk = 512 * 1024, total = 100 * 1024 * 1024;
        var handler = new Handler(request => {
            var range = request.Headers.Range!.Ranges.Single();
            var from = range.From ?? total - range.To!.Value;
            var to = range.From.HasValue ? Math.Min(range.To ?? total - 1, total - 1) : total - 1;
            var response = new HttpResponseMessage(HttpStatusCode.PartialContent)
            { Content = new ByteArrayContent(new byte[to - from + 1]) };
            response.Content.Headers.ContentType = new MediaTypeHeaderValue("video/mp4");
            response.Content.Headers.ContentRange = new ContentRangeHeaderValue(from, to, total);
            return response;
        });
        var write = Writer(handler);
        var hosts = new[] { "cdn.donmai.us", "video-cdn.gelbooru.com", "wimg.rule34.xxx", "v.sankakucomplex.com" };
        foreach (var host in hosts)
        {
            var context = Context();
            await write($"https://{host}/video.mp4", Guid.NewGuid().ToString("N"), context);
            Expect(context.Response.StatusCode == 206 && context.Response.Body.Length == chunk,
                "All video sources must use the same bounded preview path");
            Expect(context.Response.Headers.ContentRange == $"bytes 0-{chunk - 1}/{total}", "Correct partial response metadata");
        }
        var suffix = Context("bytes=-128");
        await write("https://cdn.donmai.us/video.mp4", Guid.NewGuid().ToString("N"), suffix);
        Expect(suffix.Response.Body.Length == 128, "Tail metadata requests stay bounded");

        var token = Guid.NewGuid().ToString("N");
        for (var n = 0; n < 24; n++)
        {
            var context = Context(); await write("https://cdn.donmai.us/large.mp4", token, context);
            Expect(context.Response.StatusCode == 206, "Budget must allow twelve MiB total");
        }
        var calls = handler.Calls;
        var exhausted = Context(); await write("https://cdn.donmai.us/large.mp4", token, exhausted);
        Expect(exhausted.Response.StatusCode == 429 && handler.Calls == calls, "Exhausted jobs cannot fetch more video bytes");
        var unrelated = Context(); await write("https://cdn.donmai.us/other.mp4", token, unrelated);
        Expect(unrelated.Response.StatusCode == 429 && handler.Calls == calls, "A session cannot switch files to bypass its budget");

        foreach (var range in new[] { "bytes=0-1,3-4", "bytes=-0", "items=0-10", "bad" })
        {
            var context = Context(range); await write("https://cdn.donmai.us/video.mp4", Guid.NewGuid().ToString("N"), context);
            Expect(context.Response.StatusCode == 416, "Malformed or multipart ranges are rejected");
        }
        foreach (var url in new[] { "http://cdn.donmai.us/v.mp4", "https://evilrule34.xxx/v.mp4", "https://cdn.donmai.us/v.jpg" })
        {
            var context = Context(); await write(url, Guid.NewGuid().ToString("N"), context);
            Expect(context.Response.StatusCode == 400, "Only supported HTTPS video hosts are accepted");
        }
        var large = new TrackedStream(2 * chunk);
        var ignoresRange = Writer(new Handler(_ => {
            var response = new HttpResponseMessage(HttpStatusCode.OK) { Content = new StreamContent(large) };
            response.Content.Headers.ContentType = new MediaTypeHeaderValue("video/mp4");
            response.Content.Headers.ContentLength = large.Length; return response;
        }));
        var rejected = Context(); await ignoresRange("https://cdn.donmai.us/v.mp4", Guid.NewGuid().ToString("N"), rejected);
        Expect(rejected.Response.StatusCode == 502 && large.Reads == 0,
            "A large video whose host ignores Range must never be downloaded for hover");

        var redirects = new Handler(_ => new HttpResponseMessage(HttpStatusCode.Redirect)
        { Headers = { Location = new Uri("https://example.org/private.mp4") } });
        var redirected = Context(); await Writer(redirects)("https://cdn.donmai.us/v.mp4", Guid.NewGuid().ToString("N"), redirected);
        Expect(redirected.Response.StatusCode == 502 && redirects.Calls == 1, "Redirects cannot leave the source allowlist");
        var cancelled = Context(); cancelled.RequestAborted = new CancellationToken(true);
        calls = handler.Calls;
        await write("https://cdn.donmai.us/v.mp4", Guid.NewGuid().ToString("N"), cancelled);
        Expect(handler.Calls == calls, "Cancelled hover work must not reach the source");
        Console.WriteLine("Video preview transport fixtures passed (four sources, range cap, transfer budget, cancellation, redirects).");
    }
}
