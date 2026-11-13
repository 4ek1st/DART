using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.Json;
using ArtCatalog.Updates;

internal static class SourceHistoryFixture
{
    private const string Original = "dcfbceafa908d5cc91cefdbf57b24878dcf7b18b";
    private const string Corrected = "dcd98e46ec5eac6fe1eae0c1e3771fac368256d9";
    private const string CommonBase = "ccad41a78389627b3c3cf79788ee8c0061d02b97";
    private const string Build = "8df0e4b796b260967075cf46a4da5f8a78e29f344b076ae545debb60ebc5e75c";

    internal static void Run(string temporaryRoot, ECDsa key, ReleaseManifest template)
    {
        var repository = Directory.GetCurrentDirectory();
        var objectDirectory = Path.Combine(Git(repository, "rev-parse", "--path-format=absolute", "--git-common-dir"), "objects");
        var source = Path.Combine(temporaryRoot, "rewritten-source");
        var installation = Path.Combine(temporaryRoot, "rewrite-installation");
        Directory.CreateDirectory(source);
        Directory.CreateDirectory(installation);
        Git(source, "init", "--quiet");
        Git(source, "config", "user.name", "Fixture");
        Git(source, "config", "user.email", "fixture@example.test");
        File.WriteAllText(Path.Combine(source, ".git", "objects", "info", "alternates"),
            objectDirectory.Replace('\\', '/') + "\n");
        Git(source, "symbolic-ref", "HEAD", "refs/heads/main");
        var tree = Git(source, "rev-parse", Original + "^{tree}");
        if (tree != Git(source, "rev-parse", Corrected + "^{tree}"))
            throw new Exception("Approved metadata rewrite changed the source tree.");
        File.WriteAllText(Path.Combine(installation, "update-system.json"),
            JsonSerializer.Serialize(new InstallationConfig
            {
                SourceRoot = source, PublicKey = key.ExportSubjectPublicKeyInfoPem()
            }, ReleaseProtocol.Json));
        var release = template with
        {
            SourceCommit = Original, Sequence = 81, Version = "0.2.81",
            BuildId = Build, ArtifactSha256 = Build
        };
        void Bind(ReleaseManifest value)
        {
            File.WriteAllText(Path.Combine(installation, "release-head.json"), ReleaseProtocol.Sign(value, key));
            File.WriteAllText(Path.Combine(source, ".dart-release-base.json"),
                JsonSerializer.Serialize(new { buildId = value.BuildId }));
        }
        void Point(string commit) => Git(source, "update-ref", "refs/heads/main", commit);
        Bind(release);
        Point(Original);
        ReleasePublisher.CheckBase(installation, source);
        Point(Corrected);
        ReleasePublisher.CheckBase(installation, source);
        var later = Git(source, "commit-tree", tree, "-p", Corrected, "-m", "Later fixture commit");
        Point(later);
        ReleasePublisher.CheckBase(installation, source);
        Point(CommonBase);
        Reject(() => ReleasePublisher.CheckBase(installation, source), "An old source checkout passed the rewrite guard.");
        var unrelated = Git(source, "commit-tree", tree, "-p", CommonBase, "-m", "Unapproved identical-tree rewrite");
        Point(unrelated);
        Reject(() => ReleasePublisher.CheckBase(installation, source), "An unapproved same-tree rewrite passed.");
        Point(Corrected);
        Bind(release with { Sequence = 82 });
        Reject(() => ReleasePublisher.CheckBase(installation, source), "Rewrite approval leaked into another release sequence.");
        Bind(release with { BuildId = new string('c', 64), ArtifactSha256 = new string('c', 64) });
        Reject(() => ReleasePublisher.CheckBase(installation, source), "Rewrite approval accepted another signed build.");
        Bind(release with { SourceCommit = later });
        Reject(() => ReleasePublisher.CheckBase(installation, source), "Rewrite approval replaced a different source anchor.");
        Console.WriteLine("Source attribution rewrite: identical trees, exact signed release, approved ancestry and stale/fake history rejection: PASS");
    }

    private static void Reject(Action action, string message)
    {
        try { action(); }
        catch (InvalidOperationException) { return; }
        throw new Exception(message);
    }

    private static string Git(string directory, params string[] arguments)
    {
        var start = new ProcessStartInfo("git")
        {
            WorkingDirectory = directory, UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardOutput = true, RedirectStandardError = true
        };
        foreach (var argument in arguments) start.ArgumentList.Add(argument);
        using var process = Process.Start(start) ?? throw new Exception("Fixture git process did not start.");
        var output = process.StandardOutput.ReadToEnd();
        var error = process.StandardError.ReadToEnd();
        process.WaitForExit();
        if (process.ExitCode != 0) throw new Exception("Fixture git failed: " + error);
        return output.Trim();
    }
}
