param([Parameter(Mandatory=$true)][string]$BaseUrl)
$ErrorActionPreference = 'Stop'
$artist = 'chikap'
$upstreamUrl = 'https://danbooru.donmai.us/posts.json?limit=24&page=1&tags=chikap%20rating%3Aq%2Ce'
$upstream = Invoke-RestMethod -Uri $upstreamUrl -Headers @{'User-Agent'='ArtCatalog/0.4'} -TimeoutSec 30
$localUrl = "$BaseUrl/api/profile?source=danbooru&artist=$artist&rating=explicit&page=0"
$local = Invoke-RestMethod -Uri $localUrl -TimeoutSec 45
$expected = @($upstream | Where-Object { $_.rating -in @('q', 'e') } | ForEach-Object { [string]$_.id })
$actual = @($local.items | ForEach-Object { [string]$_.id })
$missing = @($expected | Where-Object { $_ -notin $actual })
if ($expected.Count -lt 4) { throw "Danbooru currently returned only $($expected.Count) q/e chikap works" }
if ($missing.Count) { throw "Artist profile omitted Danbooru posts: $($missing -join ', ')" }
if (@($local.items | Where-Object { $_.rating -notin @('q', 'e') }).Count) {
    throw '18+ profile contains a non-adult Danbooru post'
}
"UPSTREAM=$($expected.Count) PROFILE=$($actual.Count) RATINGS=$((@($local.items | ForEach-Object rating)) -join ',')"
