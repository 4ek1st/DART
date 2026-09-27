param(
    [string]$SdkPath = "$env:LOCALAPPDATA\ArtCatalogBuild\sdk",
    [string]$JdkPath = "$env:LOCALAPPDATA\ArtCatalogBuild\jdk\jdk-21.0.12.1+1"
)
$ErrorActionPreference = 'Stop'
$env:JAVA_HOME = $JdkPath
$env:ANDROID_HOME = $SdkPath
if (-not (Test-Path -LiteralPath "$JdkPath\bin\keytool.exe")) { throw 'Set -JdkPath to a full JDK 17 or newer.' }
$androidTools = Join-Path $SdkPath 'build-tools\35.0.0'
if (-not (Test-Path -LiteralPath "$androidTools\apksigner.bat")) { throw 'Install Android SDK platform/build-tools 35, or set -SdkPath.' }
Push-Location $PSScriptRoot
try {
    & .\gradlew.bat :app:testDebugUnitTest :app:lintRelease :app:assembleRelease --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Android build/tests failed.' }
    $signingDir = Join-Path $env:LOCALAPPDATA 'ArtCatalogBuild\signing'
    New-Item -ItemType Directory -Path $signingDir -Force | Out-Null
    $passwordFile = Join-Path $signingDir 'password.dpapi'
    $keyFile = Join-Path $signingDir 'artcatalog-mobile.jks'
    if (-not (Test-Path -LiteralPath $passwordFile)) {
        if (Test-Path -LiteralPath $keyFile) { throw 'Existing signing key has no password file; preserve it and restore its password.' }
        $randomBytes = New-Object byte[] 32
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($randomBytes) } finally { $rng.Dispose() }
        $newPassword = [BitConverter]::ToString($randomBytes).Replace('-', '')
        $newPassword | ConvertTo-SecureString -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath $passwordFile
    }
    $securePassword = (Get-Content -Raw -LiteralPath $passwordFile).Trim() | ConvertTo-SecureString
    $env:ARTCATALOG_SIGN_PASSWORD = [Net.NetworkCredential]::new('', $securePassword).Password
    if (-not (Test-Path -LiteralPath $keyFile)) {
        & "$JdkPath\bin\keytool.exe" -genkeypair -keystore $keyFile -alias artcatalog -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=ArtCatalog Mobile' -storepass:env ARTCATALOG_SIGN_PASSWORD -keypass:env ARTCATALOG_SIGN_PASSWORD
        if ($LASTEXITCODE -ne 0) { throw 'Signing key generation failed.' }
    }
    $outputDir = Join-Path $PSScriptRoot 'outputs'
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    $alignedApk = Join-Path $outputDir 'ArtCatalog-Mobile-aligned.apk'
    $signedApk = Join-Path $outputDir 'ArtCatalog-Mobile-0.1.6.apk'
    & "$androidTools\zipalign.exe" -f -p 4 'app\build\outputs\apk\release\app-release-unsigned.apk' $alignedApk
    if ($LASTEXITCODE -ne 0) { throw 'APK alignment failed.' }
    & "$androidTools\apksigner.bat" sign --ks $keyFile --ks-key-alias artcatalog --ks-pass env:ARTCATALOG_SIGN_PASSWORD --key-pass env:ARTCATALOG_SIGN_PASSWORD --out $signedApk $alignedApk
    if ($LASTEXITCODE -ne 0) { throw 'APK signing failed.' }
    & "$androidTools\apksigner.bat" verify --verbose $signedApk
    if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
    Remove-Item -LiteralPath $alignedApk
    Get-FileHash -LiteralPath $signedApk -Algorithm SHA256
} finally {
    Remove-Item Env:ARTCATALOG_SIGN_PASSWORD -ErrorAction SilentlyContinue
    Pop-Location
}
