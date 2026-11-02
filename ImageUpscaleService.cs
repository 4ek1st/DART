using System.Buffers.Binary;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Threading.Channels;

namespace ArtCatalog;

internal sealed record UpscaleDimensions(int Width, int Height);
internal static class UpscalePng
{
    internal const long MaxInputBytes = 64 * 1024 * 1024;
    internal const long MaxInputPixels = 40_000_000, MaxOutputPixels = 160_000_000;
    internal static UpscaleDimensions Read(ReadOnlySpan<byte> data, int scale)
    {
        if (scale is not (2 or 4)) throw new UpscaleException("scale");
        if (data.Length > MaxInputBytes) throw new UpscaleException("too-large");
        var size = Header(data);
        if ((long)size.Width * size.Height > MaxInputPixels ||
            (long)size.Width * size.Height * scale * scale > MaxOutputPixels ||
            (long)Math.Max(size.Width, size.Height) * scale > 32_768) throw new UpscaleException("too-large");
        var offset = 8; var pixels = false;
        while (offset <= data.Length - 12)
        {
            var length = BinaryPrimitives.ReadUInt32BigEndian(data[offset..]);
            if (length > data.Length - offset - 12) throw new UpscaleException("image");
            var type = data.Slice(offset + 4, 4);
            if (type.SequenceEqual("acTL"u8)) throw new UpscaleException("animated");
            if (type.SequenceEqual("IDAT"u8)) pixels = true;
            if (type.SequenceEqual("IEND"u8))
            {
                if (!pixels || length != 0 || offset + 12 != data.Length) throw new UpscaleException("image");
                return size;
            }
            offset += checked((int)length + 12);
        }
        throw new UpscaleException("image");
    }
    private static UpscaleDimensions Header(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length < 33 || !bytes[..8].SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }) ||
            BinaryPrimitives.ReadUInt32BigEndian(bytes[8..]) != 13 || !bytes.Slice(12, 4).SequenceEqual("IHDR"u8))
            throw new UpscaleException("image");
        var width = BinaryPrimitives.ReadInt32BigEndian(bytes[16..]);
        var height = BinaryPrimitives.ReadInt32BigEndian(bytes[20..]);
        if (width <= 0 || height <= 0) throw new UpscaleException("image");
        return new(width, height);
    }
    internal static async Task<bool> ValidOutputAsync(string path, int width, int height, CancellationToken token)
    {
        if (!File.Exists(path)) return false;
        UpscaleStorage.CheckParents(path);
        await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        if (stream.Length is < 57 or > 768L * 1024 * 1024) return false;
        var header = new byte[33]; await stream.ReadExactlyAsync(header, token);
        try { if (Header(header) != new UpscaleDimensions(width, height)) return false; }
        catch (UpscaleException) { return false; }
        stream.Seek(-12, SeekOrigin.End);
        var tail = new byte[12]; await stream.ReadExactlyAsync(tail, token);
        return tail.AsSpan(0, 8).SequenceEqual(new byte[] { 0, 0, 0, 0, 73, 69, 78, 68 });
    }
}

internal interface IUpscaleRunner
{
    Task RunAsync(string directory, string input, string output, int scale, CancellationToken token);
}
internal sealed class NativeUpscaleRunner : IUpscaleRunner
{
    public async Task RunAsync(string directory, string input, string output, int scale, CancellationToken token)
    {
        // Keep model paths relative: upstream's Windows model selection does not accept
        // every absolute path. Input/output are always our own absolute local files.
        var start = new ProcessStartInfo(Path.Combine(directory, "waifu2x-ncnn-vulkan.exe"))
        {
            UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = directory,
            RedirectStandardError = true, RedirectStandardOutput = true
        };
        foreach (var argument in new[] { "-i", input, "-o", output, "-s", scale.ToString(), "-n", "-1",
            "-t", "128", "-m", "models-cunet", "-j", "1:1:1", "-f", "png" }) start.ArgumentList.Add(argument);
        using var process = Process.Start(start) ?? throw new UpscaleException("engine");
        using var cancel = token.Register(() => { try { if (!process.HasExited) process.Kill(entireProcessTree: true); }
            catch (Exception error) when (error is InvalidOperationException or System.ComponentModel.Win32Exception) { } });
        // Drain without accumulating potentially large native progress output or private paths.
        var stdout = DrainAsync(process.StandardOutput);
        var stderr = DrainAsync(process.StandardError);
        await process.WaitForExitAsync(CancellationToken.None);
        await Task.WhenAll(stdout, stderr);
        token.ThrowIfCancellationRequested();
        if (process.ExitCode != 0) throw new UpscaleException("engine");
    }
    private static async Task DrainAsync(StreamReader reader)
    { var buffer = new char[4096]; while (await reader.ReadAsync(buffer) > 0) { } }
}

internal sealed record UpscaleJobStatus(string Id, string State, int Scale, int Width, int Height,
    string? Error = null, string? ResultUrl = null, bool Cached = false);

/// <summary>A bounded, explicitly requested workload. The UI never waits on a native process.</summary>
internal sealed class ImageUpscaleService : IDisposable
{
    private const long MaxCacheBytes = 1024L * 1024 * 1024;
    private readonly string root, workRoot, resultsRoot;
    private readonly UpscaleComponent component;
    private readonly IUpscaleRunner runner;
    private readonly CancellationTokenSource lifetime = new();
    private readonly SemaphoreSlim submissions = new(1, 1);
    private readonly Channel<Job> queue = Channel.CreateBounded<Job>(new BoundedChannelOptions(3)
    { SingleReader = true, FullMode = BoundedChannelFullMode.Wait });
    private readonly object sync = new();
    private readonly Dictionary<string, Job> jobs = new(StringComparer.Ordinal);
    private readonly Task worker;
    private int disposed;
    private sealed class Job(string id, string key, string directory, string output, int scale, UpscaleDimensions size)
    {
        internal readonly string Id = id, Key = key, Directory = directory, Output = output;
        internal readonly CancellationTokenSource Cancellation = new();
        internal UpscaleJobStatus Status = new(id, "queued", scale, size.Width, size.Height);
        internal DateTimeOffset FinishedAt;
        internal bool Done;
    }
    internal ImageUpscaleService(string root, UpscaleComponent component, IUpscaleRunner? runner = null)
    {
        this.root = Path.GetFullPath(root); this.component = component; this.runner = runner ?? new NativeUpscaleRunner();
        workRoot = UpscaleStorage.Child(this.root, "work"); resultsRoot = UpscaleStorage.Child(this.root, "results");
        worker = Task.Run(WorkAsync);
    }
    internal async Task<UpscaleJobStatus> SubmitAsync(byte[] input, int scale, CancellationToken token)
    {
        var dimensions = UpscalePng.Read(input, scale);
        if (!component.Status.Installed) throw new UpscaleException("not-installed");
        var key = Convert.ToHexString(SHA256.HashData(input)).ToLowerInvariant() + "-" + scale + "-" + component.Version;
        await submissions.WaitAsync(token);
        string? directory = null;
        try
        {
            lock (sync)
            {
                var active = jobs.Values.FirstOrDefault(job => job.Key == key && job.Status.State is "queued" or "processing");
                if (active is not null) return active.Status;
                if (jobs.Values.Count(job => job.Status.State is "queued" or "processing") >= 4) throw new UpscaleException("queue-full");
                foreach (var finished in jobs.Values.Where(job => job.Done).OrderByDescending(job => job.FinishedAt).Skip(32).ToArray())
                { jobs.Remove(finished.Id); finished.Cancellation.Dispose(); }
            }
            UpscaleStorage.CheckParents(root); Directory.CreateDirectory(workRoot); Directory.CreateDirectory(resultsRoot);
            UpscaleStorage.CheckParents(resultsRoot);
            var output = UpscaleStorage.Child(resultsRoot, key + ".png");
            var cached = await UpscalePng.ValidOutputAsync(output, dimensions.Width * scale, dimensions.Height * scale, token);
            var id = Guid.NewGuid().ToString("N");
            directory = UpscaleStorage.Child(workRoot, id);
            var job = new Job(id, key, directory, output, scale, dimensions);
            if (cached)
            {
                File.SetLastWriteTimeUtc(output, DateTime.UtcNow);
                job.Status = job.Status with { State = "completed", ResultUrl = ResultUrl(id), Cached = true };
                job.FinishedAt = DateTimeOffset.UtcNow; job.Done = true;
                lock (sync) jobs.Add(id, job);
                return job.Status;
            }
            Directory.CreateDirectory(directory);
            await File.WriteAllBytesAsync(UpscaleStorage.Child(directory, "input.png"), input, token);
            lock (sync) jobs.Add(id, job);
            if (!queue.Writer.TryWrite(job))
            {
                lock (sync) jobs.Remove(id);
                job.Cancellation.Dispose(); throw new UpscaleException("queue-full");
            }
            directory = null;
            return job.Status;
        }
        finally { if (directory is not null) UpscaleStorage.TryDelete(workRoot, directory); submissions.Release(); }
    }
    internal UpscaleJobStatus? Get(string id) { lock (sync) return jobs.GetValueOrDefault(id)?.Status; }
    internal void Cancel(string id)
    {
        lock (sync)
        {
            if (!jobs.TryGetValue(id, out var job) || job.Status.State is not ("queued" or "processing")) return;
            job.Cancellation.Cancel();
            if (job.Status.State == "queued")
            { job.Status = job.Status with { State = "cancelled" }; job.FinishedAt = DateTimeOffset.UtcNow; }
        }
    }
    private async Task WorkAsync()
    {
        try
        {
            await foreach (var job in queue.Reader.ReadAllAsync(lifetime.Token))
            {
                using var timeout = new CancellationTokenSource(TimeSpan.FromMinutes(15));
                using var cancellation = CancellationTokenSource.CreateLinkedTokenSource(job.Cancellation.Token, lifetime.Token, timeout.Token);
                var token = cancellation.Token;
                var state = "completed"; string? error = null;
                try
                {
                    token.ThrowIfCancellationRequested();
                    using (var module = await component.AcquireAsync(token))
                    {
                        lock (sync) job.Status = job.Status with { State = "processing" };
                        var temporary = UpscaleStorage.Child(job.Directory, "result.png");
                        await runner.RunAsync(module.Directory, UpscaleStorage.Child(job.Directory, "input.png"),
                            temporary, job.Status.Scale, token);
                        token.ThrowIfCancellationRequested();
                        if (!await UpscalePng.ValidOutputAsync(temporary, job.Status.Width * job.Status.Scale,
                            job.Status.Height * job.Status.Scale, token)) throw new UpscaleException("output");
                        File.Move(temporary, job.Output, overwrite: true);
                    }
                    TrimCache(job.Output);
                }
                catch (OperationCanceledException) { state = timeout.IsCancellationRequested ? "error" : "cancelled"; error = timeout.IsCancellationRequested ? "timeout" : null; }
                catch (Exception e) when (e is UpscaleException or IOException or UnauthorizedAccessException or System.ComponentModel.Win32Exception)
                { state = "error"; error = e is UpscaleException upscale ? upscale.Code : "engine"; }
                finally
                {
                    UpscaleStorage.TryDelete(workRoot, job.Directory);
                    lock (sync)
                    {
                        job.Status = job.Status with { State = state, Error = error,
                            ResultUrl = state == "completed" ? ResultUrl(job.Id) : null };
                        job.FinishedAt = DateTimeOffset.UtcNow;
                        job.Done = true;
                    }
                }
            }
        }
        catch (OperationCanceledException) when (lifetime.IsCancellationRequested) { }
        finally
        {
            while (queue.Reader.TryRead(out var job)) UpscaleStorage.TryDelete(workRoot, job.Directory);
        }
    }
    internal FileStream? OpenResult(string id)
    {
        lock (sync)
        {
            if (!jobs.TryGetValue(id, out var job) || job.Status.State != "completed" || !File.Exists(job.Output)) return null;
            UpscaleStorage.CheckParents(job.Output);
            return new FileStream(job.Output, FileMode.Open, FileAccess.Read, FileShare.Read | FileShare.Delete);
        }
    }
    internal long CacheBytes() => Directory.Exists(resultsRoot) ? new DirectoryInfo(resultsRoot).EnumerateFiles("*.png").Sum(file => file.Length) : 0;
    internal void ClearCache()
    {
        if (!submissions.Wait(0)) throw new UpscaleException("busy");
        try
        {
            lock (sync)
            {
                if (jobs.Values.Any(job => !job.Done)) throw new UpscaleException("busy");
                if (Directory.Exists(resultsRoot)) UpscaleStorage.Delete(root, resultsRoot);
                foreach (var job in jobs.Values) job.Cancellation.Dispose();
                jobs.Clear();
            }
        }
        finally { submissions.Release(); }
    }
    private void TrimCache(string keep)
    {
        var files = new DirectoryInfo(resultsRoot).GetFiles("*.png").OrderBy(file => file.LastWriteTimeUtc).ToArray();
        var bytes = files.Sum(file => file.Length);
        foreach (var file in files)
        {
            if (bytes <= MaxCacheBytes) break;
            if (file.FullName == keep) continue;
            UpscaleStorage.CheckParents(file.FullName); bytes -= file.Length;
            try { file.Delete(); } catch (IOException) { }
        }
    }
    private static string ResultUrl(string id) => "/api/upscale/jobs/" + id + "/image";
    public void Dispose()
    {
        if (Interlocked.Exchange(ref disposed, 1) != 0) return;
        lifetime.Cancel(); queue.Writer.TryComplete();
        try { worker.GetAwaiter().GetResult(); } catch (OperationCanceledException) { }
        foreach (var job in jobs.Values) job.Cancellation.Dispose();
        lifetime.Dispose(); submissions.Dispose();
    }
}
