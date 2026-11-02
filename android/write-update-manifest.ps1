param(
    [Parameter(Mandatory = $true)][string]$ApkPath,
    [Parameter(Mandatory = $true)][string]$ReleaseNotesPath,
    [string]$SdkPath = "$env:LOCALAPPDATA\ArtCatalogBuild\sdk",
    [string]$JdkPath = "$env:LOCALAPPDATA\ArtCatalogBuild\jdk\jdk-21.0.12.1+1"
)
$ErrorActionPreference = 'Stop'
$env:JAVA_HOME = $JdkPath
$apk = Get-Item -LiteralPath $ApkPath
$notes = [IO.File]::ReadAllText((Get-Item -LiteralPath $ReleaseNotesPath).FullName, [Text.Encoding]::UTF8).Trim()
if ($notes.Length -gt 12000) { throw 'Update notes exceed 12000 characters.' }
if ($notes -match '[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]') { throw 'Update notes contain unsupported control characters.' }
$toolsDir = Join-Path $SdkPath 'build-tools\35.0.0'
$signature = & (Join-Path $toolsDir 'apksigner.bat') verify --print-certs $apk.FullName 2>&1
if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
$certificates = @($signature | Select-String '^Signer #[0-9]+ certificate SHA-256 digest: ([a-fA-F0-9]+)$' | ForEach-Object { $_.Matches[0].Groups[1].Value.ToLowerInvariant() })
if ($certificates.Count -ne 1 -or $certificates[0] -ne 'b97a808c1adcfa9b0489b04b09848f8638eb6df276d259f044d58f1fd01fcf5d') { throw 'APK does not use the existing DART Android release certificate.' }
$badging = & (Join-Path $toolsDir 'aapt.exe') dump badging $apk.FullName 2>&1
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect the signed APK.' }
$package = [regex]::Match(($badging -join "`n"), "(?m)^package: name='([^']+)' versionCode='([0-9]+)' versionName='([^']+)'")
$sdk = [regex]::Match(($badging -join "`n"), "(?m)^sdkVersion:'([0-9]+)'")
if (-not $package.Success -or -not $sdk.Success -or $package.Groups[1].Value -ne 'com.artcatalog.mobile') { throw 'Unexpected Android package or SDK.' }
$gradle = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'app\build.gradle') -Raw
$sourceCode = [regex]::Match($gradle, 'versionCode\s+([0-9]+)')
$sourceName = [regex]::Match($gradle, "versionName\s+'([0-9]+\.[0-9]+\.[0-9]+)'")
if (-not $sourceCode.Success -or -not $sourceName.Success -or $package.Groups[2].Value -ne $sourceCode.Groups[1].Value -or $package.Groups[3].Value -ne $sourceName.Groups[1].Value) { throw 'APK version differs from the reviewed Android source.' }
$version = $package.Groups[3].Value
if ($apk.Name -ne "DART.Android-$version.apk") { throw "Use the published asset filename DART.Android-$version.apk." }
if ($apk.Length -le 0 -or $apk.Length -gt 128MB) { throw 'APK exceeds the updater download limit.' }
$descriptor = [ordered]@{
    schema = 1
    packageName = 'com.artcatalog.mobile'
    versionCode = [int]$package.Groups[2].Value
    versionName = $version
    minSdk = [int]$sdk.Groups[1].Value
    apkUrl = "https://github.com/4ek1st/DART/releases/download/android-v$version/$($apk.Name)"
    sha256 = (Get-FileHash -LiteralPath $apk.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    size = $apk.Length
    releaseNotes = $notes
}
$json = ($descriptor | ConvertTo-Json -Depth 4) + "`n"
if ([Text.Encoding]::UTF8.GetByteCount($json) -gt 65536) { throw 'Update metadata exceeds 64 KiB.' }
$destination = Join-Path $PSScriptRoot 'update.json'
$staging = $destination + '.tmp'
try {
    [IO.File]::WriteAllText($staging, $json, [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $staging -Destination $destination -Force
} finally { if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging } }
Write-Output "Wrote Android $version metadata. Publish the verified APK asset before pushing this feed."
