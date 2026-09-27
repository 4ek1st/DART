param([Parameter(Mandatory=$true)][string]$BaseUrl)
$ErrorActionPreference = 'Stop'
$base = $BaseUrl.TrimEnd('/')
$first = Invoke-RestMethod -Uri ($base + '/api/search?q=latex&sources=danbooru&rating=all&kind=illustrations&page=0') -TimeoutSec 45
if (@($first.items).Count -eq 0) { throw 'The first Danbooru page was empty.' }
if ($first.hasMoreSources -notcontains 'danbooru') { throw 'The API did not advertise the next Danbooru page.' }
$second = Invoke-RestMethod -Uri ($base + '/api/search?q=latex&sources=danbooru&rating=all&kind=illustrations&page=1') -TimeoutSec 45
if (@($second.items).Count -eq 0) { throw 'The second Danbooru page was empty.' }
if (@($first.items | Where-Object { $second.items.key -contains $_.key }).Count -gt 0) {
  throw 'The next page repeated artwork from the first page.'
}
Write-Output ('FIRST=' + @($first.items).Count)
Write-Output ('SECOND=' + @($second.items).Count)
