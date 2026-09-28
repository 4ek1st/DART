[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Version,
    [Parameter(Mandatory)][string]$NotesFile,
    [string]$InstallationRoot = (Join-Path $env:LOCALAPPDATA 'Programs\DART'),
    [string]$SigningKey = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'DART\ReleaseKeys\signing-key.bin'),
    [switch]$PublishGitHub
)
$ErrorActionPreference = 'Stop'
$sourceRoot = [IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
Set-Location -LiteralPath $sourceRoot
function Invoke-Checked([string]$Program, [string[]]$Arguments) {
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed ($LASTEXITCODE). Release stopped." }
}
function Get-SourceHash {
    $lines = foreach ($name in (& git ls-files | Sort-Object)) {
        $hash = (Get-FileHash -LiteralPath (Join-Path $sourceRoot $name) -Algorithm SHA256).Hash.ToLowerInvariant()
        "$name $hash"
    }
    $bytes = [Text.Encoding]::UTF8.GetBytes(($lines -join "`n"))
    [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
}
if (!(Test-Path -LiteralPath (Join-Path $InstallationRoot 'update-system.json'))) {
    throw 'No registered installation. Perform the one-time launcher initialization first; automatic reset is forbidden.'
}
if (!(Test-Path -LiteralPath $NotesFile -PathType Leaf)) { throw 'Release notes file is missing.' }
if ([Version]$Version -ne [Version]([xml](Get-Content -LiteralPath 'ArtCatalog.csproj' -Raw)).Project.PropertyGroup.Version) {
    throw 'Version must match the committed project version.'
}
$dirty = & git status --porcelain
if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'Commit and review all intended source changes before building a release.' }
$sourceCommit = (& git rev-parse HEAD).Trim()
$sourceHash = Get-SourceHash
Invoke-Checked -Program dotnet -Arguments @('build','Updates/ReleaseTool/ReleaseTool.csproj','-c','Release','--nologo','-v','quiet')
$releaseTool = Join-Path $sourceRoot 'Updates\ReleaseTool\bin\Release\net8.0-windows\ReleaseTool.dll'
Invoke-Checked -Program dotnet -Arguments @($releaseTool,'check-base',$InstallationRoot,$sourceRoot)
$testFiles = @(Get-ChildItem -LiteralPath 'tests' -Filter '*.test.cjs' -File | Select-Object -ExpandProperty FullName)
Invoke-Checked node (@('--test','--test-concurrency=1') + $testFiles)
Invoke-Checked -Program dotnet -Arguments @('run','--project','tests/Rule34FixtureTests.csproj','-c','Release')
Invoke-Checked -Program dotnet -Arguments @('run','--project','tests/privacy/PrivacyFixtureTests.csproj','-c','Release')
Invoke-Checked -Program dotnet -Arguments @('run','--project','tests/updates/UpdateSystemTests.csproj','-c','Release')
$output = Join-Path $env:TEMP ('DART-release-' + $Version + '-' + [Guid]::NewGuid().ToString('N'))
Invoke-Checked -Program dotnet -Arguments @('publish','ArtCatalog.csproj','-c','Release','-r','win-x64','--self-contained','true',
    '-p:PublishSingleFile=true','-p:IncludeNativeLibrariesForSelfExtract=true','-p:EnableCompressionInSingleFile=true',
    '-p:DebugType=None','-p:DebugSymbols=false','-o',$output)
if ((Get-SourceHash) -ne $sourceHash -or (& git status --porcelain)) { throw 'Source changed during verification/build. Release stopped.' }
$stage = & dotnet $releaseTool seal $InstallationRoot $sourceRoot (Join-Path $output 'DART.exe') $Version $sourceHash $SigningKey $NotesFile $sourceCommit
if ($LASTEXITCODE -ne 0) { throw 'Signing rejected. Existing installation was not changed.' }
$stage = ($stage | Select-Object -Last 1).Trim()
if ($PublishGitHub) {
    $config = Get-Content -LiteralPath (Join-Path $InstallationRoot 'update-system.json') -Raw | ConvertFrom-Json
    $repository = ([Uri]$config.repository).AbsolutePath.Trim('/')
    Invoke-Checked -Program git -Arguments @('push','origin','HEAD:main')
    Invoke-Checked -Program gh -Arguments @('release','create',('v' + $Version),(Join-Path $stage 'DART.Windows.exe'),
        (Join-Path $stage 'signed-release.json'),'--repo',$repository,'--target',$sourceCommit,
        '--title',('DART ' + $Version),'--notes-file',$NotesFile)
}
Write-Output "Verified, signed release: $stage"
Write-Output 'The installed program was not replaced. Install with its update button or guarded launcher activation.'
