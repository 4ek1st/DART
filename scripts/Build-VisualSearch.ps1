[CmdletBinding()]
param(
    [switch]$VerifyOnly,
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# This is an explicit component build. Guarded application publishing runs the
# Node verifier, not this script, and does not require a Rust installation.
$expectedRustc = 'rustc 1.86.0 (05f9846f8 2025-03-31)'
$expectedCargo = 'cargo 1.86.0 (adf9b6ad1 2025-02-28)'
$projectDirectory = (Resolve-Path -LiteralPath $ProjectRoot).Path
$verifier = Join-Path $PSScriptRoot 'verify-visual-search.cjs'
$artifactRelative = 'wwwroot/rust/visual-search.wasm'
$manifestRelative = 'wwwroot/rust/visual-search.manifest.json'
$artifactDestination = Join-Path $projectDirectory $artifactRelative
$manifestDestination = Join-Path $projectDirectory $manifestRelative

foreach ($entry in Get-ChildItem Env:) {
    if ($entry.Name -match '^(RUSTFLAGS|CARGO_ENCODED_RUSTFLAGS|CARGO_BUILD_RUSTFLAGS|CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_RUSTFLAGS|RUSTC|RUSTC_WRAPPER|RUSTC_WORKSPACE_WRAPPER|CARGO_PROFILE_RELEASE_.*)$' -and $entry.Value) {
        throw "Remove the $($entry.Name) override for a reproducible visual-search build."
    }
}

$node = (Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$cargo = (Get-Command cargo -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$rustc = (Get-Command rustc -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$previousAutoInstall = [Environment]::GetEnvironmentVariable('RUSTUP_AUTO_INSTALL', 'Process')
$temporaryBuildDirectory = $null

try {
    # Never install or update a toolchain or target on the caller's behalf.
    [Environment]::SetEnvironmentVariable('RUSTUP_AUTO_INSTALL', '0', 'Process')
    $rustcVersion = (& $rustc --version | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $rustcVersion -ne $expectedRustc) {
        throw "Visual-search requires the existing pinned toolchain: $expectedRustc"
    }
    $cargoVersion = (& $cargo --version | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $cargoVersion -ne $expectedCargo) {
        throw "Visual-search requires the existing pinned Cargo: $expectedCargo"
    }
    if ($VerifyOnly) {
        & $node $verifier --root $projectDirectory
        if ($LASTEXITCODE -ne 0) { throw 'Existing visual-search assets failed verification; no files were changed.' }
    }

    $temporaryBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    $temporaryBuildDirectory = Join-Path $temporaryBase ('dart-visual-build-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $temporaryBuildDirectory | Out-Null
    $snapshotFile = Join-Path $temporaryBuildDirectory 'source-snapshot.json'
    $candidateManifest = Join-Path $temporaryBuildDirectory 'visual-search.manifest.json'
    & $node $verifier --snapshot --root $projectDirectory --output $snapshotFile
    if ($LASTEXITCODE -ne 0) { throw 'Cannot snapshot visual-search component sources.' }

    # Compile a private copy of this one crate. Existing target directories,
    # repository-level Cargo configuration, and unrelated projects are untouched.
    $snapshot = Get-Content -Raw -LiteralPath $snapshotFile | ConvertFrom-Json
    $buildProject = Join-Path $temporaryBuildDirectory 'project'
    foreach ($entry in $snapshot.sourceFiles) {
        $destination = Join-Path $buildProject $entry.path
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $projectDirectory $entry.path) -Destination $destination
    }
    $wrapperCopy = Join-Path $buildProject $snapshot.wrapper.path
    New-Item -ItemType Directory -Path (Split-Path -Parent $wrapperCopy) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectDirectory $snapshot.wrapper.path) -Destination $wrapperCopy
    $copiedSnapshot = Join-Path $temporaryBuildDirectory 'copied-source-snapshot.json'
    & $node $verifier --snapshot --root $buildProject --output $copiedSnapshot
    if ($LASTEXITCODE -ne 0 -or
        (Get-FileHash -Algorithm SHA256 -LiteralPath $snapshotFile).Hash -ne
        (Get-FileHash -Algorithm SHA256 -LiteralPath $copiedSnapshot).Hash) {
        throw 'Visual-search source snapshot changed while copying the component for its build.'
    }
    $crateDirectory = Join-Path $buildProject 'native/visual-core'
    $targetDirectory = Join-Path $temporaryBuildDirectory 'target'
    Push-Location -LiteralPath $crateDirectory
    try {
        # rustup can select another compiler after a directory change.
        $temporaryRustc = (& $rustc --version | Out-String).Trim()
        if ($LASTEXITCODE -ne 0 -or $temporaryRustc -ne $expectedRustc) {
            throw 'Rust toolchain changed inside the temporary crate; refusing to compile.'
        }
        $temporaryCargo = (& $cargo --version | Out-String).Trim()
        if ($LASTEXITCODE -ne 0 -or $temporaryCargo -ne $expectedCargo) {
            throw 'Cargo toolchain changed inside the temporary crate; refusing to compile.'
        }
        & $cargo test --offline --locked --target-dir $targetDirectory
        if ($LASTEXITCODE -ne 0) { throw 'Visual-search Rust component tests failed.' }
        & $cargo build --offline --locked --release --target wasm32-unknown-unknown --target-dir $targetDirectory
        if ($LASTEXITCODE -ne 0) { throw 'Visual-search WASM build failed; the existing WASM target must already be installed.' }
    }
    finally { Pop-Location }

    $candidateArtifact = Join-Path $targetDirectory 'wasm32-unknown-unknown/release/dart_visual_core.wasm'
    & $node $verifier --prepare --root $projectDirectory --artifact $candidateArtifact --source-snapshot $snapshotFile --rustc-version $rustcVersion --cargo-version $cargoVersion --output $candidateManifest
    if ($LASTEXITCODE -ne 0) { throw 'Built visual-search artifact failed ABI, source-snapshot, or manifest validation.' }

    if ($VerifyOnly) {
        $rebuiltHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $candidateArtifact).Hash
        $trackedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $artifactDestination).Hash
        if ($rebuiltHash -ne $trackedHash) {
            throw 'Visual-search reproducibility check failed: a fresh Rust rebuild differs from the checked-in artifact. No files were changed.'
        }
        Write-Host "Visual-search reproducibility verified: rebuilt WASM is byte-identical ($($rebuiltHash.ToLowerInvariant())). No shipped files were changed."
    }
    else {
        # Only the two component outputs are written, after tests and ABI checks.
        New-Item -ItemType Directory -Path (Split-Path -Parent $artifactDestination) -Force | Out-Null
        Copy-Item -LiteralPath $candidateArtifact -Destination $artifactDestination -Force
        Copy-Item -LiteralPath $candidateManifest -Destination $manifestDestination -Force
        & $node $verifier --root $projectDirectory
        if ($LASTEXITCODE -ne 0) { throw 'Installed visual-search component outputs did not pass final verification.' }
        Write-Host 'Updated only wwwroot/rust/visual-search.wasm and visual-search.manifest.json.'
    }
}
finally {
    [Environment]::SetEnvironmentVariable('RUSTUP_AUTO_INSTALL', $previousAutoInstall, 'Process')
    if ($temporaryBuildDirectory -and (Test-Path -LiteralPath $temporaryBuildDirectory)) {
        $resolvedCleanup = [IO.Path]::GetFullPath($temporaryBuildDirectory)
        $resolvedBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
        if (-not $resolvedCleanup.StartsWith($resolvedBase, [StringComparison]::OrdinalIgnoreCase) -or
            -not ([IO.Path]::GetFileName($resolvedCleanup)).StartsWith('dart-visual-build-', [StringComparison]::Ordinal)) {
            throw 'Refusing to clean an unexpected visual-search build directory.'
        }
        Remove-Item -LiteralPath $resolvedCleanup -Recurse -Force
    }
}
