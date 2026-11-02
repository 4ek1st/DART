using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Json;

namespace ArtCatalog;

internal sealed class UpscaleException(string code) : Exception(code)
{ internal string Code { get; } = code; }
internal sealed record UpscaleFile(long Bytes, string Sha256);
internal sealed record UpscalePackage(Uri DownloadUri, long DownloadBytes, string Sha256,
    string Prefix, string Version, IReadOnlyDictionary<string, UpscaleFile> Files)
{
    internal static readonly UpscalePackage Official = new(
        new("https://github.com/nihui/waifu2x-ncnn-vulkan/releases/download/20250915/waifu2x-ncnn-vulkan-20250915-windows.zip"),
        35_497_352, "7425be94b94e4c8f37a1e433ac0e0100c43790e2c37418f4b65d8235adfbdc87",
        "waifu2x-ncnn-vulkan-20250915-windows/", "waifu2x-20250915", new Dictionary<string, UpscaleFile>
        {
            ["waifu2x-ncnn-vulkan.exe"] = new(5_094_912, "7ef2efc4c54e1a963046b3a9b0aee6bca5b1487a7c907373035a10f4187a733d"),
            ["models-cunet/scale2.0x_model.bin"] = new(2_776_400, "d82ed30207fd07e1c16726a9ca838ce44e6e25a105b0278c7ca681516ee0e18e"),
            ["models-cunet/scale2.0x_model.param"] = new(7_310, "9b06073e039ca93d5bd79f6bb42016cd98d5bdefa0e9761df6b22b844c39965f"),
            ["LICENSE"] = new(1_093, "0100dda18fae09954490a58690d1ddd9355794a0a60da80609c9a8886ca587c6"),
            ["README.md"] = new(7_029, "16bd3b7e436c90c44e96bf7570a5d0db74e25288443bf5f4b1eff9adc2670a3b")
        });
}

internal sealed record UpscaleComponentStatus(string State, bool Installed, long ReceivedBytes,
    long TotalBytes, long InstalledBytes, string? Error, string Engine, string Version);
internal sealed record UpscalePreferences(int Scale = 2);

/// <summary>Only explicitly requested, pinned upstream bytes may become an executable component.</summary>
internal sealed class UpscaleComponent : IDisposable
{
    private readonly string root;
    private readonly HttpClient http;
    private readonly bool ownsHttp;
    private readonly UpscalePackage package;
    private readonly SemaphoreSlim gate = new(1, 1);
    private readonly object sync = new();
    private CancellationTokenSource? installation;
    private UpscaleComponentStatus status;
    private UpscalePreferences preferences;
    internal Task Completion { get; private set; } = Task.CompletedTask;
    internal string DirectoryPath { get; }
    internal string Version => package.Version;
    internal UpscaleComponentStatus Status { get { lock (sync) return status; } }
    internal UpscalePreferences Preferences { get { lock (sync) return preferences; } }

    internal UpscaleComponent(string root, HttpClient? http = null, UpscalePackage? package = null)
    {
        this.root = Path.GetFullPath(root);
        this.package = package ?? UpscalePackage.Official;
        if (this.package.Version.Length > 80 || this.package.Version.Any(c => !char.IsAsciiLetterOrDigit(c) && c is not '-' and not '.'))
            throw new ArgumentException("Invalid component version");
        DirectoryPath = UpscaleStorage.Child(this.root, this.package.Version);
        ownsHttp = http is null;
        this.http = http ?? new HttpClient { Timeout = TimeSpan.FromMinutes(10) };
        if (ownsHttp) this.http.DefaultRequestHeaders.UserAgent.ParseAdd("DART-OptionalUpscale/1.0");
        var installed = FilesPresent();
        status = new(installed ? "ready" : "not-installed", installed, 0, this.package.DownloadBytes,
            this.package.Files.Values.Sum(file => file.Bytes), null, "waifu2x · CUnet", this.package.Version);
        preferences = ReadPreferences();
    }

    private UpscalePreferences ReadPreferences()
    {
        var path = UpscaleStorage.Child(root, "preferences.json");
        try
        {
            UpscaleStorage.CheckParents(path);
            if (File.Exists(path) && new FileInfo(path).Length <= 1024 &&
                JsonSerializer.Deserialize<UpscalePreferences>(File.ReadAllText(path)) is { Scale: 2 or 4 } value) return value;
        }
        catch (Exception e) when (e is JsonException or IOException or UnauthorizedAccessException or UpscaleException) { }
        return new();
    }
    internal UpscalePreferences SetScale(int scale)
    {
        if (scale is not (2 or 4)) throw new UpscaleException("scale");
        lock (sync)
        {
            UpscaleStorage.CheckParents(root); Directory.CreateDirectory(root);
            var path = UpscaleStorage.Child(root, "preferences.json");
            var temporary = UpscaleStorage.Child(root, ".preferences-" + Guid.NewGuid().ToString("N"));
            try { File.WriteAllText(temporary, JsonSerializer.Serialize(new UpscalePreferences(scale))); File.Move(temporary, path, true); }
            finally { if (File.Exists(temporary)) File.Delete(temporary); }
            return preferences = new(scale);
        }
    }

    internal void StartInstall()
    {
        lock (sync)
        {
            if (status.State is "downloading" or "verifying" or "installing") return;
            if (!gate.Wait(0)) throw new UpscaleException("busy");
            installation?.Dispose(); installation = new();
            status = status with { State = "downloading", ReceivedBytes = 0, Error = null };
            var token = installation.Token;
            Completion = Task.Run(() => InstallAsync(token));
        }
    }

    internal void CancelInstall() { lock (sync) installation?.Cancel(); }

    private async Task InstallAsync(CancellationToken token)
    {
        string? staging = null, previous = null;
        try
        {
            using var owned = LockDirectory();
            using var response = await http.GetAsync(package.DownloadUri, HttpCompletionOption.ResponseHeadersRead, token);
            if (!response.IsSuccessStatusCode) throw new UpscaleException("download");
            if (response.Content.Headers.ContentLength is long declared && declared != package.DownloadBytes)
                throw new UpscaleException("integrity");
            using var bytes = new MemoryStream((int)package.DownloadBytes);
            using var digest = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            await using (var body = await response.Content.ReadAsStreamAsync(token))
            {
                var buffer = new byte[64 * 1024]; int count;
                while ((count = await body.ReadAsync(buffer, token)) > 0)
                {
                    if (bytes.Length + count > package.DownloadBytes) throw new UpscaleException("integrity");
                    bytes.Write(buffer, 0, count); digest.AppendData(buffer, 0, count);
                    Set(s => s with { ReceivedBytes = bytes.Length });
                }
            }
            Set(s => s with { State = "verifying" });
            token.ThrowIfCancellationRequested();
            if (bytes.Length != package.DownloadBytes || !HashEquals(digest.GetHashAndReset(), package.Sha256))
                throw new UpscaleException("integrity");
            staging = UpscaleStorage.Child(root, ".install-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(staging);
            Set(s => s with { State = "installing" });
            bytes.Position = 0;
            using (var zip = new ZipArchive(bytes, ZipArchiveMode.Read))
            {
                var found = new HashSet<string>(StringComparer.Ordinal);
                foreach (var entry in zip.Entries)
                {
                    token.ThrowIfCancellationRequested();
                    var name = entry.FullName.Replace('\\', '/');
                    if (name.Split('/').Any(part => part is ".." or ".") || name.StartsWith('/') ||
                        ((entry.ExternalAttributes >> 16) & 0xf000) == 0xa000) throw new UpscaleException("integrity");
                    if (!name.StartsWith(package.Prefix, StringComparison.Ordinal)) continue;
                    var relative = name[package.Prefix.Length..];
                    if (!package.Files.TryGetValue(relative, out var expected)) continue;
                    if (!found.Add(relative) || entry.Length != expected.Bytes) throw new UpscaleException("integrity");
                    var target = UpscaleStorage.Child(staging, relative);
                    Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                    await using (var input = entry.Open())
                    await using (var output = new FileStream(target, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                        await input.CopyToAsync(output, token);
                    if (!await MatchesAsync(target, expected, token)) throw new UpscaleException("integrity");
                }
                if (found.Count != package.Files.Count) throw new UpscaleException("integrity");
            }
            token.ThrowIfCancellationRequested();
            if (Directory.Exists(DirectoryPath))
            {
                UpscaleStorage.CheckTree(DirectoryPath);
                previous = UpscaleStorage.Child(root, ".previous-" + Guid.NewGuid().ToString("N"));
                Directory.Move(DirectoryPath, previous);
            }
            try { Directory.Move(staging, DirectoryPath); staging = null; }
            catch
            {
                if (previous is not null) { Directory.Move(previous, DirectoryPath); previous = null; }
                throw;
            }
            Set(s => s with { State = "ready", Installed = true, Error = null });
        }
        catch (OperationCanceledException) { Set(s => s with { State = token.IsCancellationRequested ? FilesPresent() ? "ready" : "not-installed" : "error",
            Installed = FilesPresent(), Error = token.IsCancellationRequested ? null : "download" }); }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or HttpRequestException or UpscaleException)
        { Set(s => s with { State = "error", Installed = FilesPresent(), Error = error is UpscaleException e ? e.Code : "download" }); }
        finally
        {
            if (staging is not null) UpscaleStorage.TryDelete(root, staging);
            if (previous is not null) UpscaleStorage.TryDelete(root, previous);
            gate.Release();
        }
    }

    internal async Task<UpscaleLease> AcquireAsync(CancellationToken token)
    {
        await gate.WaitAsync(token);
        FileStream? owned = null;
        try
        {
            owned = LockDirectory();
            if (!Directory.Exists(DirectoryPath)) throw new UpscaleException("not-installed");
            if (!FilesPresent()) throw new UpscaleException("integrity");
            foreach (var (name, file) in package.Files)
                if (!await MatchesAsync(UpscaleStorage.Child(DirectoryPath, name), file, token))
                    throw new UpscaleException("integrity");
            return new(DirectoryPath, () => { owned.Dispose(); gate.Release(); });
        }
        catch (UpscaleException error)
        {
            if (error.Code == "integrity") Set(s => s with { State = "error", Installed = false, Error = "integrity" });
            owned?.Dispose(); gate.Release(); throw;
        }
        catch { owned?.Dispose(); gate.Release(); throw; }
    }

    internal void Remove()
    {
        if (!gate.Wait(0)) throw new UpscaleException("busy");
        try
        {
            using var owned = LockDirectory();
            if (Directory.Exists(DirectoryPath)) UpscaleStorage.Delete(root, DirectoryPath);
            Set(s => s with { State = "not-installed", Installed = false, ReceivedBytes = 0, Error = null });
        }
        finally { gate.Release(); }
    }
    private FileStream LockDirectory()
    {
        UpscaleStorage.CheckParents(root); Directory.CreateDirectory(root);
        try { return new FileStream(UpscaleStorage.Child(root, ".component-lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None); }
        catch (IOException) { throw new UpscaleException("busy"); }
    }
    private bool FilesPresent() => package.Files.All(pair =>
    {
        var file = new FileInfo(UpscaleStorage.Child(DirectoryPath, pair.Key));
        return file.Exists && file.Length == pair.Value.Bytes && (file.Attributes & FileAttributes.ReparsePoint) == 0;
    });
    private void Set(Func<UpscaleComponentStatus, UpscaleComponentStatus> change) { lock (sync) status = change(status); }
    private static bool HashEquals(byte[] actual, string expected) =>
        CryptographicOperations.FixedTimeEquals(actual, Convert.FromHexString(expected));
    private static async Task<bool> MatchesAsync(string path, UpscaleFile file, CancellationToken token)
    {
        UpscaleStorage.CheckParents(path);
        if (!File.Exists(path) || new FileInfo(path).Length != file.Bytes) return false;
        await using var input = File.OpenRead(path);
        return HashEquals(await SHA256.HashDataAsync(input, token), file.Sha256);
    }
    public void Dispose() { CancelInstall(); if (ownsHttp) http.Dispose(); }
}

internal sealed class UpscaleLease(string directory, Action release) : IDisposable
{
    private Action? cleanup = release;
    internal string Directory { get; } = directory;
    public void Dispose() => Interlocked.Exchange(ref cleanup, null)?.Invoke();
}

internal static class UpscaleStorage
{
    internal static string DeviceRoot(string? dataDirectory, bool serverOnly, string localApplicationData) =>
        serverOnly && !string.IsNullOrWhiteSpace(dataDirectory) ? Path.Combine(Path.GetFullPath(dataDirectory), "device-upscale")
            : Path.Combine(localApplicationData, "DART", "Upscale");
    internal static string Child(string root, string relative)
    {
        var target = Path.GetFullPath(Path.Combine(root, relative));
        if (!target.StartsWith(Path.TrimEndingDirectorySeparator(Path.GetFullPath(root)) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            throw new UpscaleException("storage");
        return target;
    }
    internal static void CheckParents(string path)
    {
        for (var current = Path.GetFullPath(path); current is not null; current = Path.GetDirectoryName(current))
            if ((File.Exists(current) || Directory.Exists(current)) && (File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0)
                throw new UpscaleException("storage");
    }
    internal static void CheckTree(string path)
    {
        CheckParents(path);
        foreach (var child in Directory.EnumerateFileSystemEntries(path))
        {
            if ((File.GetAttributes(child) & FileAttributes.ReparsePoint) != 0) throw new UpscaleException("storage");
            if (Directory.Exists(child)) CheckTree(child);
        }
    }
    internal static void Delete(string root, string path)
    { _ = Child(root, Path.GetRelativePath(root, path)); CheckTree(path); Directory.Delete(path, recursive: true); }
    internal static void TryDelete(string root, string path)
    { try { if (Directory.Exists(path)) Delete(root, path); } catch (Exception e) when (e is IOException or UnauthorizedAccessException or UpscaleException) { } }
}
