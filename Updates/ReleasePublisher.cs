using System.Security.Cryptography;
using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace ArtCatalog.Updates;

internal static class ReleasePublisher
{
    public static void CheckBase(string root, string source)
    {
        var installation = new Installation(root);
        if (!Path.GetFullPath(source).TrimEnd(Path.DirectorySeparatorChar).Equals(
            Path.GetFullPath(installation.Config.SourceRoot).TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Публикация разрешена только из зарегистрированной общей папки исходников.");
        var head = Path.Combine(root, "release-head.json");
        if (!File.Exists(head))
        {
            if (File.Exists(Path.Combine(root, "active-release.bin")))
                throw new InvalidOperationException("История выпусков отсутствует. Автоматическое обнуление запрещено.");
            return;
        }
        var release = ReleaseProtocol.Verify(File.ReadAllText(head), installation.Config.PublicKey);
        var record = Path.Combine(source, ".dart-release-base.json");
        if (!File.Exists(record)) throw new InvalidOperationException("У исходников нет подтверждённой базы выпуска.");
        using var json = JsonDocument.Parse(File.ReadAllText(record));
        if (json.RootElement.GetProperty("buildId").GetString() != release.BuildId)
            throw new InvalidOperationException("Исходники основаны на старом выпуске. Публикация отклонена.");
        if (release.SourceCommit.Length > 0 && !HasSourceAncestor(source, release.SourceCommit))
        {
            // Owner-approved attribution cleanup, 2026-11-13. The six rewritten
            // commits retain their trees, authors and dates. Both 0.2.81 anchors
            // have tree 20695d232d8d17a28ef5b424001a18b2e5f65f36. Bind this
            // exception to that exact signed release and corrected Git object.
            var approvedRewrite = release.Sequence == 81 && release.Version == "0.2.81" &&
                release.BuildId == "8df0e4b796b260967075cf46a4da5f8a78e29f344b076ae545debb60ebc5e75c" &&
                release.SourceCommit == "dcfbceafa908d5cc91cefdbf57b24878dcf7b18b" &&
                HasSourceAncestor(source, "dcd98e46ec5eac6fe1eae0c1e3771fac368256d9");
            if (!approvedRewrite)
                throw new InvalidOperationException("Git-история исходников не содержит последний выпуск. Публикация отклонена.");
        }
    }
    private static bool HasSourceAncestor(string source, string commit)
    {
        var git = new ProcessStartInfo("git") { WorkingDirectory = source, UseShellExecute = false, CreateNoWindow = true };
        git.ArgumentList.Add("--no-replace-objects");
        git.ArgumentList.Add("merge-base"); git.ArgumentList.Add("--is-ancestor");
        git.ArgumentList.Add(commit); git.ArgumentList.Add("HEAD");
        using var process = Process.Start(git)!;
        process.WaitForExit();
        return process.ExitCode == 0;
    }
    public static string Seal(string root, string source, string executable, string version, string sourceHash,
        string keyPath, string notes, string sourceCommit = "")
    {
        using var gate = new FileStream(Path.Combine(root, "publication.lock"), FileMode.OpenOrCreate,
            FileAccess.ReadWrite, FileShare.None);
        CheckBase(root, source);
        var config = new Installation(root).Config;
        var headFile = Path.Combine(root, "release-head.json");
        var previous = File.Exists(headFile) ? ReleaseProtocol.Verify(File.ReadAllText(headFile), config.PublicKey) : null;
        using var key = ECDsa.Create();
        var privateBytes = UpdateProtection.Unprotect(File.ReadAllBytes(keyPath));
        try { key.ImportPkcs8PrivateKey(privateBytes, out _); }
        finally { CryptographicOperations.ZeroMemory(privateBytes); }
        if (key.ExportSubjectPublicKeyInfoPem() != config.PublicKey) throw new InvalidOperationException("Неверный ключ подписи выпуска.");
        var hash = ReleaseProtocol.FileHash(executable);
        var release = new ReleaseManifest { Version = version, Sequence = (previous?.Sequence ?? 0) + 1,
            BuildId = hash, ArtifactSha256 = hash, ArtifactSize = new FileInfo(executable).Length,
            SourceSha256 = sourceHash, SourceCommit = sourceCommit, Ancestors = previous is null ? [] :
                new[] { previous.BuildId }.Concat(previous.Ancestors).Distinct().Take(512).ToArray(), Notes = notes };
        if (previous is not null) ReleaseProtocol.CheckUpgrade(previous, release);
        var envelope = ReleaseProtocol.Sign(release, key);
        var folder = Path.Combine(root, "prepared", hash);
        Directory.CreateDirectory(folder);
        var target = Path.Combine(folder, release.ArtifactName);
        if (File.Exists(target)) throw new InvalidOperationException("Этот файл сборки уже опубликован. Перезапись запрещена.");
        File.Copy(executable, target);
        ReleaseProtocol.VerifyArtifact(release, target);
        ReleaseProtocol.WriteAtomic(Path.Combine(folder, "signed-release.json"), Encoding.UTF8.GetBytes(envelope));
        ReleaseProtocol.WriteAtomic(headFile, Encoding.UTF8.GetBytes(envelope));
        ReleaseProtocol.WriteAtomic(Path.Combine(source, ".dart-release-base.json"),
            JsonSerializer.SerializeToUtf8Bytes(new { buildId = hash, release.Sequence, release.Version }, ReleaseProtocol.Json));
        return folder;
    }
    public static void Initialize(string root, string source, string profile, string keyPath, string repository)
    {
        if (!Directory.Exists(profile)) throw new InvalidOperationException("Профиль недоступен.");
        _ = UpdateService.RepositoryName(repository);
        Directory.CreateDirectory(root);
        var configFile = Path.Combine(root, "update-system.json");
        if (File.Exists(configFile)) { CheckBase(root, source); return; }
        using var key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        if (File.Exists(keyPath))
        {
            var bytes = UpdateProtection.Unprotect(File.ReadAllBytes(keyPath));
            try { key.ImportPkcs8PrivateKey(bytes, out _); } finally { CryptographicOperations.ZeroMemory(bytes); }
        }
        else ReleaseProtocol.WriteAtomic(keyPath, UpdateProtection.Protect(key.ExportPkcs8PrivateKey()));
        var config = new InstallationConfig { PublicKey = key.ExportSubjectPublicKeyInfoPem(),
            SourceRoot = Path.GetFullPath(source), ProfilePath = Path.GetFullPath(profile), Repository = repository };
        ReleaseProtocol.WriteAtomic(configFile, JsonSerializer.SerializeToUtf8Bytes(config, ReleaseProtocol.Json));
    }
}
