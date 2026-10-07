using System.Net;
using System.Net.Http.Headers;
using System.Reflection;
using System.Buffers.Binary;
using System.Text;
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
            var context = Context($"bytes={n * chunk}-"); await write("https://cdn.donmai.us/large.mp4", token, context);
            Expect(context.Response.StatusCode == 206, "Budget must allow twelve MiB total");
        }
        var calls = handler.Calls;
        var exhausted = Context($"bytes={24 * chunk}-"); await write("https://cdn.donmai.us/large.mp4", token, exhausted);
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
        var overlaps = new Handler(request => {
            var range = request.Headers.Range!.Ranges.Single();
            long from = range.From!.Value, to = Math.Min(range.To!.Value, 951170);
            var response = new HttpResponseMessage(HttpStatusCode.PartialContent)
            { Content = new ByteArrayContent(new byte[to - from + 1]) };
            response.Content.Headers.ContentType = new MediaTypeHeaderValue("video/webm");
            response.Content.Headers.ContentRange = new ContentRangeHeaderValue(from, to, 951171);
            return response;
        });
        var overlapWriter = Writer(overlaps); token = Guid.NewGuid().ToString("N");
        foreach (var offset in new[] { 0, 262144, 458752, 655360, 819200 })
            await overlapWriter("https://wimg.rule34.xxx/v.webm", token, Context($"bytes={offset}-"));
        Expect(overlaps.Calls == 3, "Overlapping decoder ranges reuse source bytes instead of downloading them twice");

        await FastStartFixture();
        SampleTimesFixture();
        Console.WriteLine("Video preview transport fixtures passed (four sources, fast-start MP4, keyframe sampling, overlapping ranges, bounds, cancellation, redirects).");
    }

    private static byte[] Box(string type, params byte[][] content)
    {
        var bytes = new byte[8 + content.Sum(part => part.Length)];
        BinaryPrimitives.WriteUInt32BigEndian(bytes, (uint)bytes.Length);
        Encoding.ASCII.GetBytes(type).CopyTo(bytes, 4);
        var offset = 8;
        foreach (var part in content) { part.CopyTo(bytes, offset); offset += part.Length; }
        return bytes;
    }

    private static void SampleTimesFixture()
    {
        var handler = new byte[12]; Encoding.ASCII.GetBytes("vide").CopyTo(handler, 8);
        var time = new byte[24]; BinaryPrimitives.WriteUInt32BigEndian(time.AsSpan(12), 1000);
        var runs = new byte[16];
        BinaryPrimitives.WriteUInt32BigEndian(runs.AsSpan(4), 1);
        BinaryPrimitives.WriteUInt32BigEndian(runs.AsSpan(8), 100);
        BinaryPrimitives.WriteUInt32BigEndian(runs.AsSpan(12), 100);
        var sync = new byte[28]; BinaryPrimitives.WriteUInt32BigEndian(sync.AsSpan(4), 5);
        for (var key = 0; key < 5; key++) BinaryPrimitives.WriteUInt32BigEndian(sync.AsSpan(8 + key * 4), (uint)(1 + key * 20));
        byte[] Movie() => Box("moov", Box("trak", Box("mdia", Box("hdlr", handler), Box("mdhd", time),
            Box("minf", Box("stbl", Box("stts", runs), Box("stss", sync))))));
        var reader = typeof(CatalogItem).Assembly.GetType("ArtCatalog.PreviewMp4Samples")!
            .GetMethod("Read", BindingFlags.NonPublic | BindingFlags.Static)!;
        double[] Read() => (double[])reader.Invoke(null, [Movie(), 8])!;
        var samples = Read();
        Expect(samples.Length == 5 && samples.Select((value, index) => Math.Abs(value - (index * 2 + .002)) < .001).All(value => value),
            "Five preview times seek independently decodable samples distributed over the movie");
        BinaryPrimitives.WriteUInt32BigEndian(sync.AsSpan(4), uint.MaxValue);
        Expect(Read().Length == 0, "Invalid keyframe metadata safely falls back to ordinary sample times");
        BinaryPrimitives.WriteUInt32BigEndian(sync.AsSpan(4), 5); Encoding.ASCII.GetBytes("soun").CopyTo(handler, 8);
        Expect(Read().Length == 0, "Audio sample tables must never select the video preview times");
        var audioMovie = Movie(); var before = audioMovie.Length;
        typeof(CatalogItem).Assembly.GetType("ArtCatalog.PreviewMp4Samples")!
            .GetMethod("HideAudioTracks", BindingFlags.NonPublic | BindingFlags.Static)!.Invoke(null, [audioMovie, 8]);
        Expect(audioMovie.Length == before && Encoding.ASCII.GetString(audioMovie, 12, 4) == "free",
            "Silent hover previews skip audio samples while retaining byte offsets and full playback data");
    }

    private static async Task FastStartFixture()
    {
        var ftyp = Box("ftyp", new byte[16]);
        var media = Box("mdat", Enumerable.Range(0, 2048).Select(index => (byte)index).ToArray());
        var offsets = new byte[16];
        BinaryPrimitives.WriteUInt32BigEndian(offsets.AsSpan(4), 2);
        BinaryPrimitives.WriteUInt32BigEndian(offsets.AsSpan(8), (uint)(ftyp.Length + 8));
        BinaryPrimitives.WriteUInt32BigEndian(offsets.AsSpan(12), (uint)(ftyp.Length + 1000));
        var movie = Box("moov", Box("trak", Box("mdia", Box("minf", Box("stbl", Box("stco", offsets))))));
        var file = ftyp.Concat(media).Concat(movie).ToArray();
        long transferred = 0;
        var handler = new Handler(request => {
            var range = request.Headers.Range!.Ranges.Single();
            long from = range.From!.Value, to = Math.Min(range.To!.Value, file.Length - 1);
            var bytes = file.AsSpan((int)from, (int)(to - from + 1)).ToArray(); transferred += bytes.Length;
            var response = new HttpResponseMessage(HttpStatusCode.PartialContent) { Content = new ByteArrayContent(bytes) };
            response.Content.Headers.ContentType = new MediaTypeHeaderValue("video/mp4");
            response.Content.Headers.ContentRange = new ContentRangeHeaderValue(from, to, file.Length);
            return response;
        });
        var writer = Writer(handler); var token = Guid.NewGuid().ToString("N");
        var first = Context(); await writer("https://v.sankakucomplex.com/trailing.mp4", token, first);
        var rewritten = ((MemoryStream)first.Response.Body).ToArray();
        Expect(first.Response.StatusCode == 206 && rewritten.Length == file.Length, "Relocation keeps the original file length");
        Expect(Encoding.ASCII.GetString(rewritten, ftyp.Length + 4, 4) == "moov", "Trailing movie metadata precedes video samples");
        var stco = ftyp.Length + 5 * 8;
        Expect(BinaryPrimitives.ReadUInt32BigEndian(rewritten.AsSpan(stco + 16)) == ftyp.Length + 8 + movie.Length,
            "All track chunk offsets point at their relocated samples");
        Expect(rewritten.AsSpan(ftyp.Length + movie.Length, media.Length).SequenceEqual(media), "Relocation never rewrites media samples");
        var seek = Context($"bytes={ftyp.Length + movie.Length + 8}-{ftyp.Length + movie.Length + 107}");
        await writer("https://v.sankakucomplex.com/trailing.mp4", token, seek);
        Expect(((MemoryStream)seek.Response.Body).ToArray().SequenceEqual(media.AsSpan(8, 100).ToArray()), "Random seeks map back to the exact original bytes");
        Expect(transferred == file.Length, "Relocation and subsequent seeks reuse the buffered bytes");
    }
}
