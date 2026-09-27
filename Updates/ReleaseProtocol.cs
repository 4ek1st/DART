using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace ArtCatalog.Updates;

internal sealed record ReleaseManifest
{
    public int Schema { get; init; } = 1;
    public string Product { get; init; } = "DART";
    public string Platform { get; init; } = "win-x64";
    public long Sequence { get; init; }
    public string Version { get; init; } = "";
    public string BuildId { get; init; } = "";
    public string[] Ancestors { get; init; } = [];
    public string SourceSha256 { get; init; } = "";
    public string SourceCommit { get; init; } = "";
    public string ArtifactName { get; init; } = "DART.Windows.exe";
    public string ArtifactSha256 { get; init; } = "";
    public long ArtifactSize { get; init; }
    public string Published { get; init; } = DateTimeOffset.UtcNow.ToString("O");
    public string Notes { get; init; } = "";
}
internal sealed record SignedRelease(string Payload, string Signature);
internal sealed record InstallationConfig
{
    public string PublicKey { get; init; } = "";
    public string Repository { get; set; } = "";
    public string SourceRoot { get; init; } = "";
    public string ProfilePath { get; init; } = "";
}
internal sealed record ActivationReceipt(string BuildId, long Sequence, string Version, string PublicKeyHash);

internal static class ReleaseProtocol
{
    internal static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    internal static string Hash(byte[] bytes) => Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    internal static string FileHash(string path)
    {
        using var file = File.OpenRead(path);
        return Convert.ToHexString(SHA256.HashData(file)).ToLowerInvariant();
    }
    internal static bool IsHash(string? value) => value is { Length: 64 } && value.All(Uri.IsHexDigit);
    internal static string Sign(ReleaseManifest release, ECDsa key)
    {
        Validate(release);
        var payload = JsonSerializer.SerializeToUtf8Bytes(release, Json);
        return JsonSerializer.Serialize(new SignedRelease(Convert.ToBase64String(payload),
            Convert.ToBase64String(key.SignData(payload, HashAlgorithmName.SHA256))), Json);
    }
    internal static ReleaseManifest Verify(string envelope, string publicKey)
    {
        try
        {
            if (envelope.Length > 128_000) throw new InvalidOperationException("Слишком большой манифест обновления.");
            var signed = JsonSerializer.Deserialize<SignedRelease>(envelope, Json)
                ?? throw new InvalidOperationException("Нет подписи обновления.");
            using var key = ECDsa.Create(); key.ImportFromPem(publicKey);
            var payload = Convert.FromBase64String(signed.Payload);
            if (!key.VerifyData(payload, Convert.FromBase64String(signed.Signature), HashAlgorithmName.SHA256))
                throw new InvalidOperationException("Подпись обновления не совпадает. Установка отклонена.");
            var release = JsonSerializer.Deserialize<ReleaseManifest>(payload, Json)
                ?? throw new InvalidOperationException("Нет манифеста обновления.");
            Validate(release); return release;
        }
        catch (Exception error) when (error is JsonException or FormatException or CryptographicException or ArgumentException)
        { throw new InvalidOperationException("Повреждённая подпись или манифест обновления.", error); }
    }
    private static void Validate(ReleaseManifest release)
    {
        if (release.Schema != 1 || release.Product != "DART" || release.Platform != "win-x64" ||
            release.Sequence <= 0 || !Version.TryParse(release.Version, out var version) || version.Major < 0 ||
            !IsHash(release.BuildId) || release.BuildId != release.ArtifactSha256 || !IsHash(release.SourceSha256) ||
            release.ArtifactName != "DART.Windows.exe" || release.ArtifactSize is < 1 or > 1_000_000_000 ||
            release.Ancestors is null || release.Ancestors.Length > 512 || release.Ancestors.Any(value => !IsHash(value)) ||
            release.SourceCommit is null || release.SourceCommit.Length != 0 &&
                (release.SourceCommit.Length != 40 || !release.SourceCommit.All(Uri.IsHexDigit)) ||
            release.Notes is null || release.Notes.Length > 16_000)
            throw new InvalidOperationException("Неподдерживаемый или повреждённый выпуск DART.");
    }
    internal static void CheckUpgrade(ReleaseManifest current, ReleaseManifest next)
    {
        if (next.Sequence <= current.Sequence || Version.Parse(next.Version) <= Version.Parse(current.Version))
            throw new InvalidOperationException("Установка старой или той же версии запрещена.");
        if (!next.Ancestors.Contains(current.BuildId, StringComparer.Ordinal))
            throw new InvalidOperationException("Обновление основано на другой истории выпусков. Установка отклонена.");
    }
    internal static void VerifyArtifact(ReleaseManifest release, string path)
    {
        if (!File.Exists(path) || new FileInfo(path).Length != release.ArtifactSize || FileHash(path) != release.ArtifactSha256)
            throw new InvalidOperationException("Файл обновления повреждён или подменён. Установка отклонена.");
    }
    internal static void WriteAtomic(string path, byte[] bytes)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path))!);
        var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            { stream.Write(bytes); stream.Flush(flushToDisk: true); }
            File.Move(temporary, path, overwrite: true);
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }
}

internal sealed class Installation(string root)
{
    public string Root { get; } = Path.GetFullPath(root);
    public InstallationConfig Config => JsonSerializer.Deserialize<InstallationConfig>(
        File.ReadAllText(Path.Combine(Root, "update-system.json")), ReleaseProtocol.Json)
        ?? throw new InvalidOperationException("Нет конфигурации установки DART.");
    private string ReceiptPath => Path.Combine(Root, "active-release.bin");
    private string DirectoryFor(string buildId)
    {
        if (!ReleaseProtocol.IsHash(buildId)) throw new InvalidOperationException("Неверный идентификатор сборки.");
        return Path.Combine(Root, "releases", buildId);
    }
    public ReleaseManifest Current()
    {
        try
        {
            var receipt = JsonSerializer.Deserialize<ActivationReceipt>(UpdateProtection.Unprotect(File.ReadAllBytes(ReceiptPath)),
                ReleaseProtocol.Json) ?? throw new InvalidOperationException("Нет подтверждения версии.");
            if (receipt.PublicKeyHash != ReleaseProtocol.Hash(Encoding.UTF8.GetBytes(Config.PublicKey)))
                throw new InvalidOperationException("Ключ проверки установки был изменён.");
            var release = ReleaseProtocol.Verify(File.ReadAllText(Path.Combine(DirectoryFor(receipt.BuildId), "signed-release.json")),
                Config.PublicKey);
            if (release.BuildId != receipt.BuildId || release.Sequence != receipt.Sequence || release.Version != receipt.Version)
                throw new InvalidOperationException("Установленная версия не совпадает с подтверждением обновления.");
            return release;
        }
        catch (Exception error) when (error is IOException or JsonException or CryptographicException or FormatException)
        { throw new InvalidOperationException("Повреждено подтверждение версии. Автоматический сброс запрещён.", error); }
    }
    public string Executable()
    {
        var release = Current(); var path = Path.Combine(DirectoryFor(release.BuildId), "DART.exe");
        ReleaseProtocol.VerifyArtifact(release, path); return path;
    }
    public void Activate(string candidate, bool bootstrap = false)
    {
        Directory.CreateDirectory(Root);
        using var gate = new FileStream(Path.Combine(Root, "activation.lock"), FileMode.OpenOrCreate,
            FileAccess.ReadWrite, FileShare.None);
        var release = ReleaseProtocol.Verify(File.ReadAllText(Path.Combine(candidate, "signed-release.json")), Config.PublicKey);
        var binary = Path.Combine(candidate, release.ArtifactName);
        ReleaseProtocol.VerifyArtifact(release, binary);
        if (bootstrap)
        {
            if (File.Exists(ReceiptPath) || Directory.Exists(Path.Combine(Root, "releases")) &&
                Directory.EnumerateDirectories(Path.Combine(Root, "releases")).Any())
                throw new InvalidOperationException("Повторная начальная установка запрещена.");
        }
        else { _ = Executable(); ReleaseProtocol.CheckUpgrade(Current(), release); }
        var destination = DirectoryFor(release.BuildId);
        if (Directory.Exists(destination))
        {
            ReleaseProtocol.VerifyArtifact(release, Path.Combine(destination, "DART.exe"));
            var stored = ReleaseProtocol.Verify(File.ReadAllText(Path.Combine(destination, "signed-release.json")), Config.PublicKey);
            if (stored.Sequence != release.Sequence) throw new InvalidOperationException("Коллизия идентификатора выпуска.");
        }
        else
        {
            // A failed copy must never leave a partial immutable release directory.
            var pending = Path.Combine(Root, "staging", "activation-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(pending);
            File.Copy(binary, Path.Combine(pending, "DART.exe"));
            File.Copy(Path.Combine(candidate, "signed-release.json"), Path.Combine(pending, "signed-release.json"));
            ReleaseProtocol.VerifyArtifact(release, Path.Combine(pending, "DART.exe"));
            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            Directory.Move(pending, destination);
        }
        var receipt = new ActivationReceipt(release.BuildId, release.Sequence, release.Version,
            ReleaseProtocol.Hash(Encoding.UTF8.GetBytes(Config.PublicKey)));
        ReleaseProtocol.WriteAtomic(ReceiptPath, UpdateProtection.Protect(JsonSerializer.SerializeToUtf8Bytes(receipt, ReleaseProtocol.Json)));
    }
}

internal static class UpdateProtection
{
    [StructLayout(LayoutKind.Sequential)] private struct Blob { public int Size; public IntPtr Data; }
    [DllImport("crypt32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CryptProtectData(ref Blob input, string? description,
        IntPtr entropy, IntPtr reserved, IntPtr prompt, int flags, out Blob output);
    [DllImport("crypt32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CryptUnprotectData(ref Blob input, IntPtr description,
        IntPtr entropy, IntPtr reserved, IntPtr prompt, int flags, out Blob output);
    [DllImport("kernel32.dll")] private static extern IntPtr LocalFree(IntPtr memory);
    public static byte[] Protect(byte[] data) => Convert(data, true);
    public static byte[] Unprotect(byte[] data) => Convert(data, false);
    private static byte[] Convert(byte[] data, bool encrypt)
    {
        var input = new Blob { Size = data.Length, Data = Marshal.AllocHGlobal(data.Length) };
        try
        {
            Marshal.Copy(data, 0, input.Data, data.Length);
            Blob output;
            var success = encrypt ? CryptProtectData(ref input, null, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, 1, out output) :
                CryptUnprotectData(ref input, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, 1, out output);
            if (!success) throw new CryptographicException(Marshal.GetLastWin32Error());
            try { var result = new byte[output.Size]; Marshal.Copy(output.Data, result, 0, result.Length); return result; }
            finally { LocalFree(output.Data); }
        }
        finally { Marshal.FreeHGlobal(input.Data); }
    }
}
