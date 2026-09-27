param([Parameter(Mandatory=$true)][string]$BaseUrl)
$ErrorActionPreference = 'Stop'
$base = $BaseUrl.TrimEnd('/')
$suggestions = Invoke-RestMethod -Uri ($base + '/api/tags?q=latex') -TimeoutSec 45
$latex = @($suggestions | Where-Object { $_.name -eq 'latex' }) | Select-Object -First 1
if (-not $latex -or $latex.sources -notcontains 'danbooru') {
  throw 'The unified latex suggestion is missing Danbooru.'
}
Write-Output ('LATEX_SOURCES=' + ($latex.sources -join ','))
