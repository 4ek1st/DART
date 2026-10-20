using System.Security.Cryptography;
using System.Text.Json;
using ArtCatalog.Updates;

Expect(UpdateService.RepositoryName("https://github.com/4ek1st/DART") == "4ek1st/DART", "repository parsing failed");
Reject(() => UpdateService.RepositoryName("https://github.com.evil.test/4ek1st/DART"), "untrusted repository host accepted");
Reject(() => UpdateService.RepositoryName("https://user:pass@github.com/4ek1st/DART"), "credentials in repository URL accepted");
Reject(() => UpdateService.RepositoryName("https://github.com/4ek1st/DART/tree/main"), "non-repository path accepted");

static void Expect(bool value, string message) { if (!value) throw new Exception(message); }
static void Reject(Action action, string message)
{
    try { action(); } catch (InvalidOperationException) { return; }
    throw new Exception(message);
}
using var key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
var publicKey = key.ExportSubjectPublicKeyInfoPem();
var folder = Path.Combine(Path.GetTempPath(), "ArtCatalog-UpdateTests-" + Guid.NewGuid());
Directory.CreateDirectory(folder);
string Candidate(string text, long sequence, string version, string[] ancestors)
{
    var candidate = Path.Combine(folder, "candidate" + sequence);
    Directory.CreateDirectory(candidate);
    var file = Path.Combine(candidate, "DART.Windows.exe");
    File.WriteAllText(file, text);
    var hash = ReleaseProtocol.FileHash(file);
    var release = new ReleaseManifest { Sequence = sequence, Version = version, BuildId = hash,
        ArtifactSha256 = hash, ArtifactSize = new FileInfo(file).Length, Ancestors = ancestors,
        SourceSha256 = new string('a', 64), Notes = "Test release" };
    File.WriteAllText(Path.Combine(candidate, "signed-release.json"), ReleaseProtocol.Sign(release, key));
    return candidate;
}
var first = Candidate("first build", 1, "0.2.0", []);
var firstEnvelope = File.ReadAllText(Path.Combine(first, "signed-release.json"));
var initial = ReleaseProtocol.Verify(firstEnvelope, publicKey);
Expect(initial.Sequence == 1 && initial.Version == "0.2.0", "signed manifest lost release identity");
using var wrongKey = ECDsa.Create(ECCurve.NamedCurves.nistP256);
Reject(() => ReleaseProtocol.Verify(firstEnvelope, wrongKey.ExportSubjectPublicKeyInfoPem()), "wrong signer accepted");
var envelope = JsonSerializer.Deserialize<SignedRelease>(firstEnvelope, ReleaseProtocol.Json)!;
var bytes = Convert.FromBase64String(envelope.Payload); bytes[bytes.Length / 2] ^= 1;
Reject(() => ReleaseProtocol.Verify(JsonSerializer.Serialize(envelope with { Payload = Convert.ToBase64String(bytes) },
    ReleaseProtocol.Json), publicKey), "modified signed payload accepted");
var installation = Path.Combine(folder, "installation");
Directory.CreateDirectory(installation);
File.WriteAllText(Path.Combine(installation, "update-system.json"), JsonSerializer.Serialize(new InstallationConfig
    { PublicKey = publicKey, SourceRoot = folder, ProfilePath = Path.Combine(folder, "profile") }, ReleaseProtocol.Json));
Directory.CreateDirectory(Path.Combine(folder, "profile"));
File.WriteAllText(Path.Combine(folder, "profile", "bookmarks.json"), "personal state");
var profileHash = ReleaseProtocol.FileHash(Path.Combine(folder, "profile", "bookmarks.json"));
var installed = new Installation(installation);
installed.Activate(first, bootstrap: true);
Expect(installed.Current().BuildId == initial.BuildId && installed.Current().Sequence == 1, "bootstrap failed");
Reject(() => installed.Activate(first), "same release replaced active installation");
var stale = Candidate("old source newer number", 2, "0.2.1", [new string('b', 64)]);
Reject(() => installed.Activate(stale), "stale ancestry accepted");
var downgraded = Candidate("older version", 3, "0.1.9", [initial.BuildId]);
Reject(() => installed.Activate(downgraded), "semantic downgrade accepted");
var second = Candidate("second build", 4, "0.2.2", [new string('c', 64), initial.BuildId]);
var secondManifest = ReleaseProtocol.Verify(File.ReadAllText(Path.Combine(second, "signed-release.json")), publicKey);
File.AppendAllText(Path.Combine(second, "DART.Windows.exe"), "tampered");
Reject(() => installed.Activate(second), "tampered executable activated");
Expect(installed.Current().BuildId == initial.BuildId, "rejected update changed active release");
File.WriteAllText(Path.Combine(second, "DART.Windows.exe"), "second build");
installed.Activate(second);
Expect(installed.Current().BuildId == secondManifest.BuildId && installed.Current().Sequence == 4,
    "signed upgrade skipping versions failed");
Reject(() => installed.Activate(first), "accepted sequence rollback");
Expect(ReleaseProtocol.FileHash(Path.Combine(folder, "profile", "bookmarks.json")) == profileHash,
    "activation changed personal data");
var receipt = File.ReadAllBytes(Path.Combine(installation, "active-release.bin"));
Expect(!System.Text.Encoding.UTF8.GetString(receipt).Contains("0.2.2"), "receipt not protected with DPAPI");
var networkRelease = new ReleaseManifest { Version = "0.2.3", Sequence = 5, Ancestors = [secondManifest.BuildId],
    BuildId = ReleaseProtocol.Hash(System.Text.Encoding.UTF8.GetBytes("network build")),
    ArtifactSha256 = ReleaseProtocol.Hash(System.Text.Encoding.UTF8.GetBytes("network build")),
    ArtifactSize = 13, SourceSha256 = new string('d', 64) };
var networkEnvelope = ReleaseProtocol.Sign(networkRelease, key);
var network = new UpdateTransport(networkEnvelope, "network build");
using var client = new HttpClient(network);
var updater = new UpdateService(installation, client);
updater.Configure(new("https://github.com/4ek1st/DART"));
var offered = await updater.CheckAsync(true, default);
Expect(offered.Available && offered.Verified && offered.Version == "0.2.3", "verified internet update not offered");
network.Binary = "wrong bytes";
try { await updater.PrepareAsync(default); throw new Exception("bad internet download accepted"); }
catch (InvalidOperationException) { }
Expect(installed.Current().BuildId == secondManifest.BuildId, "failed download replaced active release");
network.Binary = "network build";
var prepared = await updater.PrepareAsync(default);
ReleaseProtocol.VerifyArtifact(networkRelease, Path.Combine(prepared, "DART.Windows.exe"));
Expect(installed.Current().BuildId == secondManifest.BuildId, "preparing download implicitly activated update");
Expect((await updater.CheckAsync(true, default)).Installing, "concurrent check reset an active download");
updater.InstallationFailed(); // The fixture does not start the native launcher.
network.Envelope = networkEnvelope.Replace("signature", "invalidSignature");
Expect(!(await updater.CheckAsync(true, default)).Available, "invalid remote signature exposed install action");
Console.WriteLine("Repository boundary, verified network discovery, corrupted download rejection and explicit activation: PASS");

// RED against the previous updater: rate-limit responses had no retry metadata,
// every forced check repeated the API request, and a signed public fallback was never requested.
string UpdateInstallation(string name)
{
    var root = Path.Combine(folder, name); Directory.CreateDirectory(root);
    File.WriteAllText(Path.Combine(root, "update-system.json"), JsonSerializer.Serialize(new InstallationConfig
        { PublicKey = publicKey, SourceRoot = folder, ProfilePath = Path.Combine(folder, "profile") }, ReleaseProtocol.Json));
    new Installation(root).Activate(second, bootstrap: true);
    return root;
}
static HttpResponseMessage Reply(System.Net.HttpStatusCode code, string body = "", string? retryAfter = null,
    string? remaining = null, string? reset = null)
{
    var response = new HttpResponseMessage(code) { Content = new StringContent(body) };
    if (retryAfter is not null) response.Headers.TryAddWithoutValidation("Retry-After", retryAfter);
    if (remaining is not null) response.Headers.TryAddWithoutValidation("X-RateLimit-Remaining", remaining);
    if (reset is not null) response.Headers.TryAddWithoutValidation("X-RateLimit-Reset", reset);
    return response;
}
const string latestApi = "https://api.github.com/repos/4ek1st/DART/releases/latest";
const string latestSignature = "https://github.com/4ek1st/DART/releases/latest/download/signed-release.json";
const string pinnedBinary = "https://github.com/4ek1st/DART/releases/download/v0.2.3/DART.Windows.exe";
const string apiRelease = """
    {"draft":false,"prerelease":false,"assets":[
    {"name":"signed-release.json","url":"https://api.github.com/repos/4ek1st/DART/releases/assets/1","browser_download_url":"https://github.com/4ek1st/DART/releases/download/v0.2.3/signed-release.json"},
    {"name":"DART.Windows.exe","url":"https://api.github.com/repos/4ek1st/DART/releases/assets/2","browser_download_url":"https://github.com/4ek1st/DART/releases/download/v0.2.3/DART.Windows.exe"}]}
    """;
var clock = new UpdateClock(new DateTimeOffset(2027, 1, 1, 12, 0, 0, TimeSpan.Zero));
var resetAt = clock.GetUtcNow().AddMinutes(2);
var fallbackRoot = UpdateInstallation("fallback");
var download = "network build";
using var fallbackTransport = new ScriptedUpdateTransport(request => Task.FromResult(
    request.RequestUri!.AbsoluteUri == latestApi
        ? Reply(System.Net.HttpStatusCode.Forbidden, retryAfter: "90", remaining: "0", reset: resetAt.ToUnixTimeSeconds().ToString())
        : request.RequestUri.AbsoluteUri == latestSignature ? Reply(System.Net.HttpStatusCode.OK, networkEnvelope)
        : request.RequestUri.AbsoluteUri == pinnedBinary ? Reply(System.Net.HttpStatusCode.OK, download)
        : throw new Exception("unexpected fallback URL: " + request.RequestUri)));
using var fallbackClient = new HttpClient(fallbackTransport);
var fallback = new UpdateService(fallbackRoot, fallbackClient, clock);
fallback.Configure(new("https://github.com/4ek1st/DART"));
var recovered = await fallback.CheckAsync(true, default);
Expect(recovered.Available && recovered.Verified && recovered.Error.Length == 0 && recovered.Notice.Length > 0 &&
    recovered.RateLimited && recovered.RetryAt >= resetAt, "rate-limited public discovery did not offer the verified fallback");
Expect(fallbackTransport.Requests.Count == 2 && fallbackTransport.Requests.All(request => request.Authorization is null),
    "public fallback sent credentials or unexpected requests");
await fallback.CheckAsync(true, default); await fallback.CheckAsync(false, default);
Expect(fallbackTransport.Requests.Count == 2, "force/focus bypassed API cooldown or repeated fallback during cooldown");
var restarted = new UpdateService(fallbackRoot, fallbackClient, clock);
Expect((await restarted.CheckAsync(true, default)).RetryAt >= resetAt && fallbackTransport.Requests.Count == 2,
    "a new updater instance forgot the persisted API cooldown");
download = "network buile"; // Same length, wrong hash.
try { await fallback.PrepareAsync(default); throw new Exception("corrupted fallback binary accepted"); }
catch (InvalidOperationException) { }
download = "network build";
var fallbackPrepared = await fallback.PrepareAsync(default);
ReleaseProtocol.VerifyArtifact(networkRelease, Path.Combine(fallbackPrepared, "DART.Windows.exe"));
Expect(new Installation(fallbackRoot).Current().BuildId == secondManifest.BuildId,
    "fallback preparation activated a release");
fallback.InstallationFailed();
clock.Advance(TimeSpan.FromMinutes(3));
await fallback.CheckAsync(false, default);
Expect(fallbackTransport.Requests.Count(request => request.Uri.AbsoluteUri == latestApi) == 2,
    "an API error was negative-cached for twenty minutes");

foreach (var header in new[] { "90", clock.GetUtcNow().AddSeconds(90).ToString("R"), "864000", "not-a-date", "-10", "999999999999999999999" })
{
    var root = UpdateInstallation("retry-header-" + Guid.NewGuid().ToString("N"));
    using var handler = new ScriptedUpdateTransport(request => Task.FromResult(
        Reply(System.Net.HttpStatusCode.TooManyRequests, retryAfter: header)));
    using var headerClient = new HttpClient(handler);
    var service = new UpdateService(root, headerClient, clock);
    service.Configure(new("https://github.com/4ek1st/DART", "private-fixture-token"));
    var limited = await service.CheckAsync(true, default);
    Expect(limited.RateLimited && limited.RetryAt > clock.GetUtcNow() &&
        limited.RetryAt <= clock.GetUtcNow().AddDays(1), "Retry-After produced an absent or unbounded cooldown: " + header);
    if (header == "90" || header.Contains("GMT"))
        Expect(limited.RetryAt >= clock.GetUtcNow().AddSeconds(90), "Retry-After was shortened: " + header);
    await service.CheckAsync(true, default);
    var freshService = new UpdateService(root, headerClient, clock);
    await freshService.CheckAsync(true, default);
    Expect(handler.Requests.Count == 1 && handler.Requests[0].Authorization == "Bearer private-fixture-token",
        "private cooldown was bypassed or a token-bearing source used public fallback");
    Expect(!System.Text.Encoding.UTF8.GetString(File.ReadAllBytes(Path.Combine(root, "update-retry.bin")))
        .Contains("private-fixture-token"), "retry persistence contained an unprotected token");
}

foreach (var transientCode in new[] { System.Net.HttpStatusCode.ServiceUnavailable, System.Net.HttpStatusCode.RequestTimeout })
{
    var root = UpdateInstallation("transient-reset-" + (int)transientCode);
    using var handler = new ScriptedUpdateTransport(request => Task.FromResult(Reply(transientCode,
        remaining: "50", reset: clock.GetUtcNow().AddHours(1).ToUnixTimeSeconds().ToString())));
    using var transientClient = new HttpClient(handler);
    var service = new UpdateService(root, transientClient, clock);
    service.Configure(new("https://github.com/4ek1st/DART", "private-fixture-token"));
    var transient = await service.CheckAsync(true, default);
    Expect(!transient.RateLimited && transient.RetryAt == clock.GetUtcNow().AddSeconds(60),
        "a normal quota reset header replaced transient error backoff");
}

var secondaryRoot = UpdateInstallation("secondary-limit");
using var secondaryTransport = new ScriptedUpdateTransport(request => Task.FromResult(Reply(System.Net.HttpStatusCode.Forbidden,
    retryAfter: "90", remaining: "50", reset: clock.GetUtcNow().AddHours(1).ToUnixTimeSeconds().ToString())));
using var secondaryClient = new HttpClient(secondaryTransport);
var secondary = new UpdateService(secondaryRoot, secondaryClient, clock);
secondary.Configure(new("https://github.com/4ek1st/DART", "private-fixture-token"));
var secondaryPause = await secondary.CheckAsync(true, default);
Expect(secondaryPause.RateLimited && secondaryPause.RetryAt == clock.GetUtcNow().AddSeconds(90),
    "secondary rate limit used the primary quota reset instead of Retry-After");

foreach (var networkFailure in new[] { false, true })
{
    var root = UpdateInstallation("public-transient-" + networkFailure);
    using var handler = new ScriptedUpdateTransport(request => request.RequestUri!.AbsoluteUri == latestApi
        ? networkFailure ? Task.FromException<HttpResponseMessage>(new HttpRequestException("offline"))
            : Task.FromResult(Reply(System.Net.HttpStatusCode.ServiceUnavailable))
        : Task.FromResult(Reply(System.Net.HttpStatusCode.OK, networkEnvelope)));
    using var transientClient = new HttpClient(handler);
    var service = new UpdateService(root, transientClient, clock); service.Configure(new("https://github.com/4ek1st/DART"));
    var recoveredTransient = await service.CheckAsync(true, default);
    Expect(recoveredTransient.Available && recoveredTransient.Verified && !recoveredTransient.RateLimited &&
        recoveredTransient.Error.Length == 0 && recoveredTransient.RetryAt == clock.GetUtcNow().AddSeconds(60),
        "a public transient API failure did not recover from the signed fallback");
}

foreach (var limits in new[]
{
    (ApiSeconds: 0, FallbackCode: System.Net.HttpStatusCode.TooManyRequests, FallbackSeconds: 3600, ExpectedSeconds: 3600),
    (ApiSeconds: 0, FallbackCode: System.Net.HttpStatusCode.ServiceUnavailable, FallbackSeconds: 1800, ExpectedSeconds: 1800),
    (ApiSeconds: 600, FallbackCode: System.Net.HttpStatusCode.TooManyRequests, FallbackSeconds: 120, ExpectedSeconds: 600)
})
{
    var root = UpdateInstallation("fallback-deadline-" + limits.ExpectedSeconds);
    var failDiscovery = false;
    using var handler = new ScriptedUpdateTransport(request => Task.FromResult(!failDiscovery
        ? Reply(System.Net.HttpStatusCode.OK, request.RequestUri!.AbsoluteUri == latestApi ? apiRelease : networkEnvelope)
        : request.RequestUri!.AbsoluteUri == latestApi
            ? limits.ApiSeconds > 0 ? Reply(System.Net.HttpStatusCode.Forbidden, remaining: "0",
                reset: clock.GetUtcNow().AddSeconds(limits.ApiSeconds).ToUnixTimeSeconds().ToString())
                : Reply(System.Net.HttpStatusCode.ServiceUnavailable)
            : Reply(limits.FallbackCode, retryAfter: limits.FallbackSeconds.ToString())));
    using var deadlineClient = new HttpClient(handler);
    var service = new UpdateService(root, deadlineClient, clock); service.Configure(new("https://github.com/4ek1st/DART"));
    Expect((await service.CheckAsync(true, default)).Available, "candidate missing before fallback deadline test");
    failDiscovery = true;
    var waiting = await service.CheckAsync(true, default);
    Expect(waiting.RetryAt == clock.GetUtcNow().AddSeconds(limits.ExpectedSeconds) &&
        waiting.RateLimited == (limits.ApiSeconds > 0 || limits.FallbackCode == System.Net.HttpStatusCode.TooManyRequests) &&
        waiting.Available && waiting.Verified && waiting.Error.Length == 0 && waiting.Notice.Length > 0,
        "fallback shortened/lost a server deadline or discarded a verified candidate");
    await service.CheckAsync(true, default);
    var newWindow = new UpdateService(root, deadlineClient, clock);
    Expect((await newWindow.CheckAsync(true, default)).RetryAt == waiting.RetryAt && handler.Requests.Count == 4,
        "fallback deadline was not persisted across forced checks/new windows");
}

foreach (var statusCode in new[] { System.Net.HttpStatusCode.Forbidden, System.Net.HttpStatusCode.Unauthorized,
    System.Net.HttpStatusCode.NotFound })
{
    var root = UpdateInstallation("no-fallback-" + (int)statusCode);
    using var handler = new ScriptedUpdateTransport(request => Task.FromResult(Reply(statusCode)));
    using var deniedClient = new HttpClient(handler);
    var service = new UpdateService(root, deniedClient, clock); service.Configure(new("https://github.com/4ek1st/DART"));
    var denied = await service.CheckAsync(true, default);
    Expect(!denied.Available && denied.Error.Length > 0 && handler.Requests.Count == 1,
        "access denial or missing release used the public fallback or appeared up to date");
}

foreach (var invalidEnvelope in new[] { networkEnvelope.Replace("signature", "invalidSignature"),
    ReleaseProtocol.Sign(networkRelease with { Ancestors = [new string('e', 64)] }, key),
    ReleaseProtocol.Sign(networkRelease with { Version = "0.1.0" }, key) })
{
    var root = UpdateInstallation("invalid-fallback-" + Guid.NewGuid().ToString("N"));
    var fallbackFault = false;
    using var handler = new ScriptedUpdateTransport(request => Task.FromResult(request.RequestUri!.AbsoluteUri == latestApi
        ? fallbackFault ? Reply(System.Net.HttpStatusCode.ServiceUnavailable) : Reply(System.Net.HttpStatusCode.OK, apiRelease)
        : Reply(System.Net.HttpStatusCode.OK, fallbackFault ? invalidEnvelope : networkEnvelope)));
    using var invalidClient = new HttpClient(handler);
    var service = new UpdateService(root, invalidClient, clock); service.Configure(new("https://github.com/4ek1st/DART"));
    Expect((await service.CheckAsync(true, default)).Available, "valid candidate missing before invalid fallback test");
    fallbackFault = true;
    var rejected = await service.CheckAsync(true, default);
    Expect(!rejected.Available && !rejected.Verified && rejected.Error.Length > 0,
        "invalid fallback signature/ancestry/version exposed installation or up-to-date state");
    try { await service.PrepareAsync(default); throw new Exception("unverified fallback prepared a binary"); }
    catch (InvalidOperationException) { }
}

foreach (var badUrl in new[] { "https://github.com.evil.test/4ek1st/DART/releases/download/v0.2.3/DART.Windows.exe",
    "https://github.com/other/repo/releases/download/v0.2.3/DART.Windows.exe",
    "https://github.com:444/4ek1st/DART/releases/download/v0.2.3/DART.Windows.exe" })
{
    var root = UpdateInstallation("invalid-url-" + Guid.NewGuid().ToString("N"));
    var replaceUrl = false;
    using var handler = new ScriptedUpdateTransport(request => Task.FromResult(Reply(System.Net.HttpStatusCode.OK,
        request.RequestUri!.AbsoluteUri == latestApi ? replaceUrl ? apiRelease.Replace(pinnedBinary, badUrl) : apiRelease : networkEnvelope)));
    using var invalidClient = new HttpClient(handler);
    var service = new UpdateService(root, invalidClient, clock); service.Configure(new("https://github.com/4ek1st/DART"));
    Expect((await service.CheckAsync(true, default)).Available, "valid candidate missing before invalid URL test");
    replaceUrl = true;
    Expect(!(await service.CheckAsync(true, default)).Available &&
        handler.Requests.All(request => request.Uri.AbsoluteUri != latestSignature), "untrusted asset URL fell back or was accepted");
}

foreach (var declaredLength in new[] { true, false })
{
    var root = UpdateInstallation("oversized-manifest-" + declaredLength);
    using var oversized = new MeasuredUpdateContent(200_000, declaredLength);
    using var handler = new ScriptedUpdateTransport(request => Task.FromResult(request.RequestUri!.AbsoluteUri == latestApi
        ? Reply(System.Net.HttpStatusCode.ServiceUnavailable)
        : new HttpResponseMessage(System.Net.HttpStatusCode.OK) { Content = oversized }));
    using var oversizedClient = new HttpClient(handler);
    var service = new UpdateService(root, oversizedClient, clock); service.Configure(new("https://github.com/4ek1st/DART"));
    var rejected = await service.CheckAsync(true, default);
    Expect(!rejected.Available && rejected.Error.Length > 0 && oversized.BytesRead <= 128_000 + 8192 &&
        (declaredLength ? oversized.BytesRead == 0 : oversized.BytesRead > 128_000),
        "oversized declared/streamed manifest was fully downloaded before verification");
}

var retainedRoot = UpdateInstallation("retained"); var discoveryMode = "success";
using var retainedTransport = new ScriptedUpdateTransport(request =>
{
    if (request.RequestUri!.AbsoluteUri == latestApi)
        return discoveryMode == "network" ? Task.FromException<HttpResponseMessage>(new HttpRequestException("offline")) :
            Task.FromResult(Reply(System.Net.HttpStatusCode.OK, apiRelease));
    return Task.FromResult(Reply(System.Net.HttpStatusCode.OK, discoveryMode == "invalid" ? "{}" : networkEnvelope));
});
using var retainedClient = new HttpClient(retainedTransport);
var retained = new UpdateService(retainedRoot, retainedClient, clock);
retained.Configure(new("https://github.com/4ek1st/DART", "private-fixture-token"));
Expect((await retained.CheckAsync(true, default)).Available, "private API discovery failed");
discoveryMode = "network";
var retainedOffer = await retained.CheckAsync(true, default);
Expect(retainedOffer.Available && retainedOffer.Verified && retainedOffer.Error.Length == 0 && retainedOffer.RetryAt > clock.GetUtcNow(),
    "a transient API failure discarded a previously verified candidate");
Expect(retainedTransport.Requests.All(request => request.Uri.Host == "api.github.com" &&
    request.Authorization == "Bearer private-fixture-token"), "private request leaked to a public download host");
var firstRetry = retainedOffer.RetryAt!.Value;
clock.Advance(TimeSpan.FromSeconds(61));
var secondFailure = await retained.CheckAsync(false, default);
Expect(secondFailure.RetryAt >= clock.GetUtcNow().AddSeconds(120) && secondFailure.RetryAt > firstRetry,
    "transient retry backoff did not grow");
clock.Advance(TimeSpan.FromMinutes(3));
Expect((await retained.CheckAsync(false, default)).RetryAt >= clock.GetUtcNow().AddSeconds(240), "third transient retry was not backed off");
clock.Advance(TimeSpan.FromSeconds(241));
Expect((await retained.CheckAsync(false, default)).RetryAt == clock.GetUtcNow().AddSeconds(300), "retry backoff did not stop at five minutes");
clock.Advance(TimeSpan.FromSeconds(301));
Expect((await retained.CheckAsync(false, default)).RetryAt == clock.GetUtcNow().AddSeconds(300), "retry backoff exceeded five minutes");
clock.Advance(TimeSpan.FromSeconds(301)); discoveryMode = "invalid";
Expect(!(await retained.CheckAsync(true, default)).Available, "an invalid signature retained an earlier install candidate");

var concurrentRoot = UpdateInstallation("concurrent");
var responseEntered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
var releaseResponse = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
using var concurrentTransport = new ScriptedUpdateTransport(async request =>
{
    responseEntered.TrySetResult(); await releaseResponse.Task;
    return Reply(System.Net.HttpStatusCode.TooManyRequests, retryAfter: "120");
});
using var concurrentClient = new HttpClient(concurrentTransport);
var windowOne = new UpdateService(concurrentRoot, concurrentClient, clock);
windowOne.Configure(new("https://github.com/4ek1st/DART", "private-fixture-token"));
var windowTwo = new UpdateService(concurrentRoot, concurrentClient, clock);
var firstCheck = windowOne.CheckAsync(true, default); await responseEntered.Task;
using var cancelWait = new CancellationTokenSource();
var canceledWindow = new UpdateService(concurrentRoot, concurrentClient, clock);
var canceledCheck = canceledWindow.CheckAsync(true, cancelWait.Token); cancelWait.Cancel();
try { await canceledCheck; throw new Exception("a canceled lease wait continued checking"); }
catch (OperationCanceledException) { }
Expect(!File.Exists(Path.Combine(concurrentRoot, "update-retry.bin")) && concurrentTransport.Requests.Count == 1,
    "canceling a lease wait wrote cooldown state or started another request");
var secondCheck = windowTwo.CheckAsync(true, default); releaseResponse.TrySetResult();
await Task.WhenAll(firstCheck, secondCheck);
Expect(concurrentTransport.Requests.Count == 1, "concurrent windows made duplicate rate-limited API requests");
Expect(ReleaseProtocol.FileHash(Path.Combine(folder, "profile", "bookmarks.json")) == profileHash,
    "update retry/fallback changed profile state");
Console.WriteLine("Rate-limit persistence/force, Retry-After, signed public fallback, private isolation and recovery: PASS");
var publicationRoot = Path.Combine(folder, "publication"); Directory.CreateDirectory(publicationRoot);
File.WriteAllText(Path.Combine(publicationRoot, "update-system.json"), JsonSerializer.Serialize(new InstallationConfig
    { PublicKey = publicKey, SourceRoot = folder, ProfilePath = Path.Combine(folder, "profile") }, ReleaseProtocol.Json));
ReleasePublisher.CheckBase(publicationRoot, folder);
Reject(() => ReleasePublisher.CheckBase(publicationRoot, Path.Combine(folder, "old-copy")), "publisher accepted old source directory");
File.WriteAllText(Path.Combine(publicationRoot, "release-head.json"), firstEnvelope);
Reject(() => ReleasePublisher.CheckBase(publicationRoot, folder), "publisher accepted missing release base");
File.WriteAllText(Path.Combine(folder, ".dart-release-base.json"), JsonSerializer.Serialize(new { buildId = new string('b', 64) }));
Reject(() => ReleasePublisher.CheckBase(publicationRoot, folder), "publisher accepted stale release base");
File.WriteAllText(Path.Combine(folder, ".dart-release-base.json"), JsonSerializer.Serialize(new { buildId = initial.BuildId }));
ReleasePublisher.CheckBase(publicationRoot, folder);
Console.WriteLine("Publisher canonical directory, missing base and stale base guards: PASS");
receipt[0] ^= 1; File.WriteAllBytes(Path.Combine(installation, "active-release.bin"), receipt);
Reject(() => installed.Current(), "corrupt receipt silently reset version floor");
Console.WriteLine("Signed release, tampering, ancestry, version floor, atomic activation and profile preservation: PASS");

internal sealed class UpdateTransport(string envelope, string binary) : HttpMessageHandler
{
    public string Envelope = envelope, Binary = binary;
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        string data;
        if (request.RequestUri!.Host == "api.github.com") data = """
            {"draft":false,"prerelease":false,"assets":[
            {"name":"signed-release.json","browser_download_url":"https://github.com/4ek1st/DART/releases/download/v0.2.3/signed-release.json"},
            {"name":"DART.Windows.exe","browser_download_url":"https://github.com/4ek1st/DART/releases/download/v0.2.3/DART.Windows.exe"}]}
            """;
        else data = request.RequestUri.AbsolutePath.EndsWith("signed-release.json") ? Envelope : Binary;
        return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK) { Content = new StringContent(data) });
    }
}

internal sealed class UpdateClock(DateTimeOffset now) : TimeProvider
{
    private DateTimeOffset current = now;
    public override DateTimeOffset GetUtcNow() => current;
    public void Advance(TimeSpan elapsed) => current += elapsed;
}
internal sealed record ObservedUpdateRequest(Uri Uri, string? Authorization);
internal sealed class ScriptedUpdateTransport(Func<HttpRequestMessage, Task<HttpResponseMessage>> respond) : HttpMessageHandler
{
    public List<ObservedUpdateRequest> Requests { get; } = [];
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        lock (Requests) Requests.Add(new(request.RequestUri!, request.Headers.Authorization?.ToString()));
        return respond(request);
    }
}
internal sealed class MeasuredUpdateContent(int length, bool declaredLength) : HttpContent
{
    public long BytesRead { get; private set; }
    protected override bool TryComputeLength(out long contentLength) { contentLength = length; return declaredLength; }
    protected override Task SerializeToStreamAsync(Stream stream, System.Net.TransportContext? context) =>
        stream.WriteAsync(new byte[length]).AsTask();
    protected override Task<Stream> CreateContentReadStreamAsync() =>
        Task.FromResult<Stream>(new CountedUpdateStream(new byte[length], count => BytesRead += count));
}
internal sealed class CountedUpdateStream(byte[] bytes, Action<int> count) : MemoryStream(bytes, writable: false)
{
    public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
    {
        var received = await base.ReadAsync(buffer, cancellationToken); count(received); return received;
    }
}
