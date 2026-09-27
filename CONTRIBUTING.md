# Contributing to DART

[← Back to the main page](README.md) · [Project rules](AGENTS.md)

## Run locally

You need the .NET 8 SDK, Node.js, and the Microsoft Edge WebView2 Runtime.
Publishing also requires PowerShell 7, Git, and GitHub CLI.

Run the app with a separate test profile:

```powershell
dotnet run --project ArtCatalog.csproj -- --data-dir <test-profile>
```

The `ArtCatalog` project name and namespace remain for compatibility.
The app is called **DART — Discover Art**. Android is a separate project.

## Checks

In PowerShell:

```powershell
$tests = @(Get-ChildItem tests -Filter '*.test.cjs' -File | Select-Object -ExpandProperty FullName)
node --test --test-concurrency=1 @tests
dotnet run --project tests/Rule34FixtureTests.csproj -c Release
dotnet run --project tests/updates/UpdateSystemTests.csproj -c Release
```

Fixtures use temporary data. Follow the restriction in [AGENTS.md](AGENTS.md)
for the separate `tests/chrome` native UI harness: its build output was
quarantined by antivirus and needs independent investigation.

## Publish an official update

Before a release, change the version in `ArtCatalog.csproj`, review the
changes, and commit them. Use the registered canonical source directory
and the existing private release key:

```powershell
./scripts/Publish-Release.ps1 -Version <new-version> -NotesFile <release-notes.md> -PublishGitHub
```

The script checks the source registration, previous release base, Git
history, clean working tree, tests, and source drift during the build.
It then creates a complete EXE and signed manifest for GitHub Releases.

The signature uses ECDSA P-256; the file is checked by size and SHA-256.
Installation verifies the version, sequence, and connection to previous
releases. A protected record selects the active version, and accepted
release files live in separate immutable directories.

The first release registers the install and key once through
`Updates/ReleaseTool`. Official updates require the owner's private key,
which must never enter Git or release assets.

Do not copy an EXE, DLL, or frontend files over an installed app, or delete
protected files to bypass a rejected update. After initial registration,
install through the update button or guarded launcher. Keep bookmarks,
subscriptions, credentials, and the user profile separate from source code
and release assets.

For a small fix, describe the problem in an [issue](https://github.com/4ek1st/DART/issues)
or open a pull request with your changes and the checks you ran.
