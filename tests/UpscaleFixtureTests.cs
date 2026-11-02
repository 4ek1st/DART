using System.IO.Compression;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using ArtCatalog;

internal static class UpscaleFixtureTests
{
    private static void Check(bool value, string message)
    { if (!value) throw new Exception("Upscale: " + message); }

    internal static async Task RunAsync()
    {
        var root = Path.Combine(Path.GetTempPath(), "DART-upscale-fixture-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            var files = new Dictionary<string, byte[]>
            {
                ["waifu2x-ncnn-vulkan.exe"] = "test executable, never run"u8.ToArray(),
                ["models-cunet/scale2.0x_model.bin"] = "fixture weights"u8.ToArray(),
                ["models-cunet/scale2.0x_model.param"] = "fixture parameters"u8.ToArray(),
                ["LICENSE"] = "fixture license"u8.ToArray()
            };
            var archive = Package(files);
            var package = new UpscalePackage(new Uri("https://example.invalid/fixture.zip"), archive.Length,
                Hash(archive), "fixture/", "fixture-1", files.ToDictionary(pair => pair.Key,
                    pair => new UpscaleFile(pair.Value.Length, Hash(pair.Value))));
            using var http = new HttpClient(new Reply(archive));
            using var component = new UpscaleComponent(Path.Combine(root, "component"), http, package);
            Check(!component.Status.Installed, "a missing optional module must stay absent");
            Check(component.Preferences.Scale == 2, "default enlargement is 2x until the user chooses otherwise");
            component.SetScale(4);
            using (var restarted = new UpscaleComponent(Path.Combine(root, "component"), http, package))
                Check(restarted.Preferences.Scale == 4, "default enlargement survives a native restart without profile changes");
            Throws(() => component.SetScale(3), "scale", "invalid preferences cannot be saved");
            component.StartInstall(); await component.Completion;
            Check(component.Status is { Installed: true, State: "ready" }, "one verified download must install automatically");
            Check(File.Exists(Path.Combine(component.DirectoryPath, "LICENSE")), "upstream license must remain installed");
            using (var lease = await component.AcquireAsync(default))
            {
                Check(lease.Directory == component.DirectoryPath, "runner must receive the verified installed directory");
                Throws(() => component.Remove(), "busy", "module removal while processing must be rejected");
            }
            await File.WriteAllTextAsync(Path.Combine(component.DirectoryPath, "waifu2x-ncnn-vulkan.exe"), "tampered");
            await ThrowsAsync(async () => { using var unused = await component.AcquireAsync(default); },
                "integrity", "modified binaries must never reach a runner");
            component.StartInstall(); await component.Completion;
            Check(component.Status.Installed, "repair must restore verified files");

            using var corruptHttp = new HttpClient(new Reply(archive.Select((b, i) => i == 8 ? (byte)(b ^ 1) : b).ToArray()));
            using var corrupt = new UpscaleComponent(Path.Combine(root, "corrupt"), corruptHttp, package);
            corrupt.StartInstall(); await corrupt.Completion;
            Check(corrupt.Status is { Installed: false, Error: "integrity" }, "wrong archive digest must fail closed");
            Check(!File.Exists(Path.Combine(corrupt.DirectoryPath, "waifu2x-ncnn-vulkan.exe")), "unverified archive must not install an executable");

            using var slowHttp = new HttpClient(new Reply(archive, slow: true));
            using var slow = new UpscaleComponent(Path.Combine(root, "cancel"), slowHttp, package);
            slow.StartInstall(); slow.CancelInstall(); await slow.Completion;
            Check(slow.Status.State == "not-installed", "cancelled installation must be reusable");

            var escapedArchive = Package(files, traversal: true);
            using var escapedHttp = new HttpClient(new Reply(escapedArchive));
            using var escaped = new UpscaleComponent(Path.Combine(root, "escaped"), escapedHttp,
                package with { DownloadBytes = escapedArchive.Length, Sha256 = Hash(escapedArchive) });
            escaped.StartInstall(); await escaped.Completion;
            Check(!File.Exists(Path.Combine(root, "escape.exe")), "archive traversal must never escape staging");

            var image = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==");
            var info = UpscalePng.Read(image, 4);
            Check(info.Width == 1 && info.Height == 1, "PNG dimensions must be checked before processing");
            Throws(() => UpscalePng.Read(image, 3), "scale", "unsupported scale must be rejected");
            var huge = image.ToArray();
            System.Buffers.Binary.BinaryPrimitives.WriteInt32BigEndian(huge.AsSpan(16), 100_000);
            Throws(() => UpscalePng.Read(huge, 4), "too-large", "decompression and output limits must reject huge dimensions");
            Throws(() => UpscalePng.Read("<html>not an image</html>"u8.ToArray(), 2), "image", "an error page is never input pixels");

            var runner = new BlockingRunner();
            using var jobs = new ImageUpscaleService(Path.Combine(root, "jobs"), component, runner);
            var first = await jobs.SubmitAsync(image, 2, default);
            await runner.Started.Task.WaitAsync(TimeSpan.FromSeconds(5));
            var same = await jobs.SubmitAsync(image, 2, default);
            Check(same.Id == first.Id, "double submit must share one job");
            var second = await jobs.SubmitAsync(image, 4, default);
            Check(jobs.Get(second.Id)?.State == "queued" && runner.Calls == 1, "only one GPU process may run");
            jobs.Cancel(second.Id);
            Check(jobs.Get(second.Id)?.State == "cancelled", "queued cancellation must be immediate");
            jobs.Cancel(first.Id);
            await runner.Stopped.Task.WaitAsync(TimeSpan.FromSeconds(5));
            await Wait(() => jobs.Get(first.Id)?.State == "cancelled");
            Check(jobs.Get(first.Id)?.ResultUrl is null, "cancelled job must not expose partial output");
            Check(runner.MaximumActive == 1, "processing must remain serialized");
            using (var successful = new ImageUpscaleService(Path.Combine(root, "successful"), component, new PngRunner()))
            {
                var completed = await successful.SubmitAsync(image, 2, default);
                await Wait(() => successful.Get(completed.Id)?.State == "completed");
                using var result = successful.OpenResult(completed.Id);
                Check(result is { Length: > 57 }, "a successful result must be available separately from the original");
                var repeated = await successful.SubmitAsync(image, 2, default);
                Check(repeated is { State: "completed", Cached: true }, "identical input and scale must reuse the checked result");
                Check(successful.CacheBytes() > 0, "result cache must report its actual size");
                result?.Dispose(); successful.ClearCache();
                Check(successful.CacheBytes() == 0 && successful.Get(repeated.Id) is null,
                    "clearing results must remove stale URLs without removing the module");
                Check(component.Status.Installed, "clearing cached results must preserve the installed module");
            }
            component.Remove();
            Check(!component.Status.Installed, "optional module can be removed without profile changes");
            Console.WriteLine("Optional upscale integrity, limits, installation and queue cancellation: PASS");
        }
        finally { Directory.Delete(root, recursive: true); }
    }

    private static string Hash(byte[] data) => Convert.ToHexString(SHA256.HashData(data)).ToLowerInvariant();
    private static byte[] Package(Dictionary<string, byte[]> files, bool traversal = false)
    {
        using var memory = new MemoryStream();
        using (var zip = new ZipArchive(memory, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var pair in files)
            { using var output = zip.CreateEntry("fixture/" + pair.Key).Open(); output.Write(pair.Value); }
            if (traversal) { using var output = zip.CreateEntry("fixture/../../escape.exe").Open(); output.WriteByte(1); }
        }
        return memory.ToArray();
    }
    private static void Throws(Action action, string code, string message)
    { try { action(); } catch (UpscaleException error) when (error.Code == code) { return; } throw new Exception(message); }
    private static async Task ThrowsAsync(Func<Task> action, string code, string message)
    { try { await action(); } catch (UpscaleException error) when (error.Code == code) { return; } throw new Exception(message); }
    private static async Task Wait(Func<bool> ready)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        while (!ready()) await Task.Delay(10, timeout.Token);
    }
    private sealed class Reply(byte[] bytes, bool slow = false) : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        { if (slow) await Task.Delay(Timeout.Infinite, token); return new(HttpStatusCode.OK) { Content = new ByteArrayContent(bytes) }; }
    }
    private sealed class BlockingRunner : IUpscaleRunner
    {
        public TaskCompletionSource Started { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource Stopped { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public int Calls, Active, MaximumActive;
        public async Task RunAsync(string directory, string input, string output, int scale, CancellationToken token)
        {
            Calls++; Active++; MaximumActive = Math.Max(MaximumActive, Active); Started.TrySetResult();
            try { await Task.Delay(Timeout.Infinite, token); }
            finally { Active--; Stopped.TrySetResult(); }
        }
    }
    private sealed class PngRunner : IUpscaleRunner
    {
        public Task RunAsync(string directory, string input, string output, int scale, CancellationToken token)
        {
            var bytes = File.ReadAllBytes(input);
            System.Buffers.Binary.BinaryPrimitives.WriteInt32BigEndian(bytes.AsSpan(16), scale);
            System.Buffers.Binary.BinaryPrimitives.WriteInt32BigEndian(bytes.AsSpan(20), scale);
            return File.WriteAllBytesAsync(output, bytes, token); // Header-only fake; actual native decode is checked by opt-in smoke.
        }
    }
}
