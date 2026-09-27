using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace ArtCatalog.Updates;

internal sealed record UpdateStatus
{
    public string CurrentVersion { get; init; } = typeof(UpdateStatus).Assembly.GetName().Version?.ToString(3) ?? "локальная сборка";
    public string Version { get; init; } = "";
    public string Repository { get; init; } = "";
    public bool Configured { get; init; }
    public bool Available { get; init; }
    public bool Verified { get; init; }
    public bool Installing { get; init; }
    public string Notes { get; init; } = "";
    public string Error { get; init; } = "";
}
internal sealed record UpdateSource(string Repository, string Token = "");
internal sealed class UpdateService(string? installationRoot, HttpClient? transport = null)
{
    private readonly Installation? installation = installationRoot is null ? null : new(installationRoot);
    private readonly HttpClient http = transport ?? new(new HttpClientHandler
        { AutomaticDecompression = DecompressionMethods.All, MaxAutomaticRedirections = 5 }) { Timeout = TimeSpan.FromMinutes(8) };
    private readonly SemaphoreSlim gate = new(1, 1);
    private DateTimeOffset checkedAt;
    private UpdateStatus status = new();
    private (ReleaseManifest Release, string Envelope, Uri Artifact)? candidate;
    private string SourceFile => Path.Combine(installation!.Root, "update-source.bin");
    public string? Root => installation?.Root;
    public static string RepositoryName(string value)
    {
        if (!Uri.TryCreate(value.Trim().TrimEnd('/'), UriKind.Absolute, out var uri) || uri.Scheme != "https" ||
            uri.Host != "github.com" || uri.UserInfo.Length != 0 || !uri.IsDefaultPort || uri.Query.Length != 0 || uri.Fragment.Length != 0 ||
            !Regex.IsMatch(uri.AbsolutePath, @"^/[A-Za-z0-9-]+/[A-Za-z0-9_.-]+$"))
            throw new InvalidOperationException("Нужна ссылка на репозиторий https://github.com/owner/name.");
        return uri.AbsolutePath.Trim('/');
    }
    private UpdateSource Source()
    {
        if (File.Exists(SourceFile)) return JsonSerializer.Deserialize<UpdateSource>(
            UpdateProtection.Unprotect(File.ReadAllBytes(SourceFile)), ReleaseProtocol.Json) ?? new("");
        return new(installation!.Config.Repository);
    }
    public void Configure(UpdateSource source)
    {
        gate.Wait();
        try
        {
        if (installation is null) throw new InvalidOperationException("Настройка обновлений доступна в установленной DART.");
        if (status.Installing) throw new InvalidOperationException("Дождитесь завершения установки.");
        _ = RepositoryName(source.Repository);
        if (source.Token.Length > 1000 || source.Token.Any(char.IsControl)) throw new InvalidOperationException("Неверный токен GitHub.");
        // Empty input preserves an existing token; public repositories need none.
        var previous = Source();
        if (source.Token.Length == 0 && source.Repository == previous.Repository) source = source with { Token = previous.Token };
        ReleaseProtocol.WriteAtomic(SourceFile, UpdateProtection.Protect(JsonSerializer.SerializeToUtf8Bytes(source, ReleaseProtocol.Json)));
        candidate = null; checkedAt = default;
        }
        finally { gate.Release(); }
    }
    public void InstallationFailed() => status = status with { Installing = false };
    private HttpRequestMessage Request(Uri uri, UpdateSource source, bool binary = false)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, uri);
        request.Headers.UserAgent.ParseAdd("DART/0.2 (Windows)");
        request.Headers.Accept.ParseAdd(binary ? "application/octet-stream" : "application/vnd.github+json");
        if (uri.Host == "api.github.com")
        {
            request.Headers.TryAddWithoutValidation("X-GitHub-Api-Version", "2022-11-28");
            if (source.Token.Length > 0) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", source.Token);
        }
        return request;
    }
    private static Uri Asset(JsonElement assets, string name, string repository, bool privateAccess)
    {
        var asset = assets.EnumerateArray().FirstOrDefault(value => value.GetProperty("name").GetString() == name);
        if (asset.ValueKind != JsonValueKind.Object) throw new InvalidOperationException("В выпуске нет полного файла обновления или подписи.");
        var raw = asset.GetProperty(privateAccess ? "url" : "browser_download_url").GetString();
        if (!Uri.TryCreate(raw, UriKind.Absolute, out var uri) || uri.Scheme != "https" || uri.UserInfo.Length != 0 ||
            !uri.IsDefaultPort || (privateAccess ? uri.Host != "api.github.com" ||
                !uri.AbsolutePath.StartsWith("/repos/" + repository + "/releases/assets/", StringComparison.OrdinalIgnoreCase) :
                uri.Host != "github.com" || !uri.AbsolutePath.StartsWith("/" + repository + "/releases/download/", StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException("Файл обновления расположен за пределами выбранного репозитория.");
        return uri;
    }
    public async Task<UpdateStatus> CheckAsync(bool force, CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            if (status.Installing) return status;
            if (!force && checkedAt > DateTimeOffset.UtcNow.AddMinutes(-20)) return status;
            if (installation is null) return status;
            var current = installation.Current(); var source = Source();
            status = new() { CurrentVersion = current.Version, Repository = source.Repository, Configured = source.Repository.Length > 0 };
            candidate = null;
            if (!status.Configured) return status;
            try
            {
                var repository = RepositoryName(source.Repository);
                using var request = Request(new("https://api.github.com/repos/" + repository + "/releases/latest"), source);
                using var response = await http.SendAsync(request, cancellationToken);
                if (response.StatusCode == HttpStatusCode.NotFound) return status;
                if (!response.IsSuccessStatusCode) throw new InvalidOperationException(
                    "Не удалось проверить GitHub. Проверьте доступ и повторите позже.");
                using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
                var release = json.RootElement;
                if (release.GetProperty("draft").GetBoolean() || release.GetProperty("prerelease").GetBoolean()) return status;
                var assets = release.GetProperty("assets");
                var signatureUri = Asset(assets, "signed-release.json", repository, source.Token.Length > 0);
                using var signatureRequest = Request(signatureUri, source, true);
                using var signatureResponse = await http.SendAsync(signatureRequest, cancellationToken);
                signatureResponse.EnsureSuccessStatusCode();
                var envelope = await signatureResponse.Content.ReadAsStringAsync(cancellationToken);
                var manifest = ReleaseProtocol.Verify(envelope, installation.Config.PublicKey);
                if (manifest.BuildId == current.BuildId) return status;
                ReleaseProtocol.CheckUpgrade(current, manifest);
                candidate = (manifest, envelope, Asset(assets, manifest.ArtifactName, repository, source.Token.Length > 0));
                status = status with { Available = true, Verified = true, Version = manifest.Version, Notes = manifest.Notes };
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch (Exception error) when (error is HttpRequestException or InvalidOperationException or JsonException or TaskCanceledException)
            { status = status with { Error = error is InvalidOperationException ? error.Message : "Проверка обновлений временно недоступна. Повторите позже." }; }
            return status;
        }
        finally { checkedAt = DateTimeOffset.UtcNow; gate.Release(); }
    }
    public async Task<string> PrepareAsync(CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            if (installation is null || candidate is not { } update || !status.Available || !status.Verified)
                throw new InvalidOperationException("Проверенного обновления пока нет.");
            ReleaseProtocol.CheckUpgrade(installation.Current(), update.Release);
            status = status with { Installing = true };
            var folder = Path.Combine(installation.Root, "staging", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(folder);
            var target = Path.Combine(folder, update.Release.ArtifactName);
            using var request = Request(update.Artifact, Source(), true);
            using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            response.EnsureSuccessStatusCode();
            await using (var output = new FileStream(target, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            await using (var input = await response.Content.ReadAsStreamAsync(cancellationToken))
            {
                var buffer = new byte[128 * 1024]; long received = 0; int count;
                while ((count = await input.ReadAsync(buffer, cancellationToken)) != 0)
                {
                    received += count;
                    if (received > update.Release.ArtifactSize) throw new InvalidOperationException("Размер обновления не совпадает с подписанным выпуском.");
                    await output.WriteAsync(buffer.AsMemory(0, count), cancellationToken);
                }
                await output.FlushAsync(cancellationToken);
            }
            ReleaseProtocol.VerifyArtifact(update.Release, target);
            ReleaseProtocol.WriteAtomic(Path.Combine(folder, "signed-release.json"), System.Text.Encoding.UTF8.GetBytes(update.Envelope));
            return folder;
        }
        catch { status = status with { Installing = false }; throw; }
        finally { gate.Release(); }
    }
}
