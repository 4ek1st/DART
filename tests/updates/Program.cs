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
