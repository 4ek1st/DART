using System.Net;
using System.Net.Http.Headers;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
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
    public DateTimeOffset? RetryAt { get; init; }
    public bool RateLimited { get; init; }
    public string Notice { get; init; } = "";
}
internal sealed record UpdateSource(string Repository, string Token = "");
internal sealed class UpdateService(string? installationRoot, HttpClient? transport = null, TimeProvider? timeProvider = null)
{
    private readonly Installation? installation = installationRoot is null ? null : new(installationRoot);
    private readonly HttpClient http = transport ?? new(new HttpClientHandler
        { AutomaticDecompression = DecompressionMethods.All, MaxAutomaticRedirections = 5 }) { Timeout = TimeSpan.FromMinutes(8) };
    private readonly SemaphoreSlim gate = new(1, 1);
    private readonly TimeProvider clock = timeProvider ?? TimeProvider.System;
    private DateTimeOffset checkedAt;
    private string statusScope = "", candidateScope = "";
    private UpdateStatus status = new();
    private (ReleaseManifest Release, string Envelope, Uri Artifact)? candidate;
    private string SourceFile => Path.Combine(installation!.Root, "update-source.bin");
    private string RetryFile => Path.Combine(installation!.Root, "update-retry.bin");
    private const string UnavailableMessage = "Проверка обновлений временно недоступна. Повторите позже.";
    private const string RateMessage = "GitHub временно ограничил частоту проверки обновлений.";
    private sealed record RetryState(string Scope, DateTimeOffset? RetryAt = null, bool RateLimited = false,
        int Failures = 0, string Error = "");
    private sealed class DiscoveryUnavailable(bool rateLimited, DateTimeOffset? retryAt, string message) : Exception(message)
    {
        public bool RateLimited { get; } = rateLimited;
        public DateTimeOffset? RetryAt { get; } = retryAt;
    }
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
        candidate = null; candidateScope = statusScope = ""; checkedAt = default;
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
    private static string Scope(UpdateSource source) => ReleaseProtocol.Hash(Encoding.UTF8.GetBytes(
        RepositoryName(source.Repository).ToLowerInvariant() + "\n" + source.Token));
    private async Task<FileStream> RetryLeaseAsync(CancellationToken cancellationToken)
    {
        // File ownership survives await and serializes independent windows/processes.
        // A busy or inaccessible installation must not make the UI wait for a download timeout.
        for (var attempt = 0; ; attempt++)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try { return new FileStream(RetryFile + ".lock", FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None); }
            catch (IOException) when (attempt < 100) { await Task.Delay(50, cancellationToken); }
        }
    }
    private RetryState ReadRetry(string scope)
    {
        if (!File.Exists(RetryFile)) return new(scope);
        try
        {
            if (new FileInfo(RetryFile).Length > 16_000) return new(scope);
            var saved = JsonSerializer.Deserialize<RetryState>(UpdateProtection.Unprotect(File.ReadAllBytes(RetryFile)), ReleaseProtocol.Json);
            return saved is not null && saved.Scope == scope ? saved : new(scope);
        }
        catch (Exception error) when (error is JsonException or CryptographicException) { return new(scope); }
    }
    private void SaveRetry(RetryState retry) => ReleaseProtocol.WriteAtomic(RetryFile,
        UpdateProtection.Protect(JsonSerializer.SerializeToUtf8Bytes(retry, ReleaseProtocol.Json)));
    private DateTimeOffset BoundedDeadline(DateTimeOffset deadline)
    {
        var now = clock.GetUtcNow();
        return deadline < now.AddSeconds(1) ? now.AddSeconds(1) : deadline > now.AddDays(1) ? now.AddDays(1) : deadline;
    }
    private RetryState Pause(RetryState previous, bool rateLimited, DateTimeOffset? requested, string error)
    {
        var now = clock.GetUtcNow();
        var failures = Math.Clamp(previous.Failures, 0, 3) + 1;
        var fallback = now.AddSeconds(rateLimited ? 60 : Math.Min(60 * (1 << (failures - 1)), 300));
        var deadline = BoundedDeadline(requested ?? fallback);
        var retry = new RetryState(previous.Scope, deadline, rateLimited, failures, error);
        SaveRetry(retry); return retry;
    }
    private DateTimeOffset? RetryDeadline(HttpResponseMessage response, bool primaryLimit)
    {
        var now = clock.GetUtcNow(); DateTimeOffset? deadline = null;
        if (response.Headers.TryGetValues("Retry-After", out var values))
        {
            var raw = values.FirstOrDefault();
            if (long.TryParse(raw, NumberStyles.None, CultureInfo.InvariantCulture, out var seconds))
                deadline = now.AddSeconds(Math.Clamp(seconds, 1, 86_400));
            else if (DateTimeOffset.TryParse(raw, CultureInfo.InvariantCulture,
                DateTimeStyles.AllowWhiteSpaces | DateTimeStyles.AssumeUniversal, out var date)) deadline = date;
        }
        if (primaryLimit && response.Headers.TryGetValues("X-RateLimit-Reset", out var resets) &&
            long.TryParse(resets.FirstOrDefault(), NumberStyles.None, CultureInfo.InvariantCulture, out var reset) &&
            reset is >= 0 and <= 253402300799)
        {
            var date = DateTimeOffset.FromUnixTimeSeconds(reset);
            if (deadline is null || date > deadline) deadline = date;
        }
        return deadline;
    }
    private async Task<string> ReadRemoteAsync(Uri uri, UpdateSource source, bool binary, int limit,
        CancellationToken cancellationToken)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(15));
        try
        {
            using var request = Request(uri, source, binary);
            using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
            var exhausted = response.Headers.TryGetValues("X-RateLimit-Remaining", out var remaining) &&
                remaining.Any(value => value.Trim() == "0");
            var rateLimited = response.StatusCode == HttpStatusCode.TooManyRequests ||
                response.StatusCode == HttpStatusCode.Forbidden &&
                (response.Headers.Contains("Retry-After") || exhausted);
            if (rateLimited || response.StatusCode == HttpStatusCode.RequestTimeout || (int)response.StatusCode >= 500)
                throw new DiscoveryUnavailable(rateLimited, RetryDeadline(response, rateLimited && exhausted), rateLimited ? RateMessage : UnavailableMessage);
            if (!response.IsSuccessStatusCode)
                throw new InvalidOperationException("Не удалось проверить GitHub. Проверьте репозиторий и доступ, затем повторите позже.");
            if (response.Content.Headers.ContentLength > limit)
                throw new InvalidOperationException("Слишком большой ответ службы обновлений.");
            await using var input = await response.Content.ReadAsStreamAsync(timeout.Token);
            using var output = new MemoryStream(); var buffer = new byte[8192]; int count;
            while ((count = await input.ReadAsync(buffer, timeout.Token)) != 0)
            {
                if (output.Length + count > limit) throw new InvalidOperationException("Слишком большой ответ службы обновлений.");
                output.Write(buffer, 0, count);
            }
            return Encoding.UTF8.GetString(output.ToArray());
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception error) when (error is HttpRequestException or IOException or OperationCanceledException)
        { throw new DiscoveryUnavailable(false, null, UnavailableMessage); }
    }
    private void ClearCandidate()
    {
        candidate = null; candidateScope = "";
        status = status with { Available = false, Verified = false, Version = "", Notes = "" };
    }
    private void Offer(string envelope, ReleaseManifest current, string scope, Func<ReleaseManifest, Uri> artifact)
    {
        var manifest = ReleaseProtocol.Verify(envelope, installation!.Config.PublicKey);
        if (manifest.BuildId == current.BuildId) { ClearCandidate(); return; }
        ReleaseProtocol.CheckUpgrade(current, manifest);
        candidate = (manifest, envelope, artifact(manifest)); candidateScope = scope;
        status = status with { Available = true, Verified = true, Version = manifest.Version, Notes = manifest.Notes, Error = "" };
    }
    private void ReportPause(RetryState retry)
    {
        status = status with { RetryAt = retry.RetryAt, RateLimited = retry.RateLimited,
            Notice = retry.RateLimited ? RateMessage : UnavailableMessage,
            Error = candidate is null ? retry.Error : "" };
    }
    public async Task<UpdateStatus> CheckAsync(bool force, CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            if (status.Installing) return status;
            if (installation is null) return status;
            var current = installation.Current(); var source = Source();
            if (source.Repository.Length == 0)
            { ClearCandidate(); return status = new() { CurrentVersion = current.Version }; }
            var scope = Scope(source); var now = clock.GetUtcNow();
            if (candidateScope != scope) ClearCandidate();
            if (candidate is { } retained)
            {
                try { ReleaseProtocol.CheckUpgrade(current, retained.Release); }
                catch (InvalidOperationException) { ClearCandidate(); }
            }
            status = status with { CurrentVersion = current.Version };
            if (statusScope == scope && status.RetryAt > now) return status;
            if (statusScope == scope && !force && checkedAt > now.AddMinutes(-20) && status.Error.Length == 0 && status.RetryAt is null)
                return status;
            status = status with { CurrentVersion = current.Version, Repository = source.Repository, Configured = true,
                RetryAt = null, RateLimited = false, Notice = "", Error = "" };
            statusScope = scope;
            await using var lease = await RetryLeaseAsync(cancellationToken);
            var retry = ReadRetry(scope);
            if (retry.RetryAt > clock.GetUtcNow()) { ReportPause(retry); return status; }
            try
            {
                var repository = RepositoryName(source.Repository);
                using var json = JsonDocument.Parse(await ReadRemoteAsync(new("https://api.github.com/repos/" + repository + "/releases/latest"),
                    source, false, 1_000_000, cancellationToken));
                var release = json.RootElement;
                if (release.GetProperty("draft").GetBoolean() || release.GetProperty("prerelease").GetBoolean()) ClearCandidate();
                else
                {
                    var assets = release.GetProperty("assets");
                    var signatureUri = Asset(assets, "signed-release.json", repository, source.Token.Length > 0);
                    var envelope = await ReadRemoteAsync(signatureUri, source, true, 128_000, cancellationToken);
                    Offer(envelope, current, scope, manifest => Asset(assets, manifest.ArtifactName, repository, source.Token.Length > 0));
                }
                SaveRetry(new(scope)); checkedAt = clock.GetUtcNow();
            }
            catch (DiscoveryUnavailable error)
            {
                retry = Pause(retry, error.RateLimited, error.RetryAt, error.Message);
                ReportPause(retry);
                if (source.Token.Length == 0)
                {
                    try
                    {
                        var repository = RepositoryName(source.Repository);
                        var envelope = await ReadRemoteAsync(new("https://github.com/" + repository +
                            "/releases/latest/download/signed-release.json"), source, true, 128_000, cancellationToken);
                        // latest identifies only the signed manifest. The verified version pins the executable.
                        Offer(envelope, current, scope, manifest => new("https://github.com/" + repository +
                            "/releases/download/" + Uri.EscapeDataString("v" + manifest.Version) + "/" + manifest.ArtifactName));
                        status = status with { Error = "" };
                    }
                    catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
                    catch (DiscoveryUnavailable fallbackError)
                    {
                        // Both endpoints must respect their server deadlines; this is one failed check.
                        var deadline = BoundedDeadline(fallbackError.RetryAt ?? clock.GetUtcNow().AddSeconds(60));
                        if (retry.RetryAt is { } previousDeadline && previousDeadline > deadline) deadline = previousDeadline;
                        var limited = retry.RateLimited || fallbackError.RateLimited;
                        retry = retry with { RetryAt = deadline, RateLimited = limited,
                            Error = limited ? RateMessage : UnavailableMessage };
                        SaveRetry(retry); ReportPause(retry);
                    }
                    catch (Exception fallbackError) when (fallbackError is InvalidOperationException or JsonException)
                    {
                        ClearCandidate(); status = status with { Error = fallbackError is InvalidOperationException ? fallbackError.Message : UnavailableMessage };
                        SaveRetry(retry with { Error = status.Error });
                    }
                }
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch (Exception error) when (error is InvalidOperationException or JsonException or KeyNotFoundException)
            {
                ClearCandidate();
                ReportPause(Pause(retry, false, null, error is InvalidOperationException ? error.Message : UnavailableMessage));
            }
            return status;
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or CryptographicException)
        {
            status = status with { RetryAt = clock.GetUtcNow().AddMinutes(1), RateLimited = false,
                Notice = UnavailableMessage, Error = candidate is null ? UnavailableMessage : "" };
            return status;
        }
        finally { gate.Release(); }
    }
    public async Task<string> PrepareAsync(CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            if (installation is null || candidate is not { } update || !status.Available || !status.Verified)
                throw new InvalidOperationException("Проверенного обновления пока нет.");
            var source = Source();
            if (candidateScope != Scope(source)) throw new InvalidOperationException("Настройки обновлений изменились. Проверьте выпуск заново.");
            ReleaseProtocol.CheckUpgrade(installation.Current(), update.Release);
            status = status with { Installing = true };
            var folder = Path.Combine(installation.Root, "staging", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(folder);
            var target = Path.Combine(folder, update.Release.ArtifactName);
            using var request = Request(update.Artifact, source, true);
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
