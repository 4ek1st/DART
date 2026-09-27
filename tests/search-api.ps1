param([Parameter(Mandatory=$true)][string]$BaseUrl)
$ErrorActionPreference = 'Stop'
$base = $BaseUrl.TrimEnd('/')
$search = Invoke-RestMethod -Uri ($base + '/api/search?q=latex&sources=danbooru&rating=all&kind=illustrations&page=0') -TimeoutSec 45
$items = @($search.items)
if ($items.Count -eq 0) { throw 'Danbooru latex search returned no illustrated posts.' }
if (@($items | Where-Object { @($_.tags | Where-Object { $_ -ieq 'latex' }).Count -eq 0 -or @($_.images).Count -eq 0 }).Count -gt 0) {
  throw 'Danbooru latex search included a result without its tag or image.'
}
$tags = Invoke-RestMethod -Uri ($base + '/api/tags?q=latex') -TimeoutSec 45
if (@($tags | Where-Object { $_.name -eq 'latex' -and $_.sources -contains 'danbooru' }).Count -eq 0) {
  throw 'Unified suggestions did not include Danbooru latex.'
}
Write-Output ('SEARCH_ITEMS=' + $items.Count)
Write-Output ('SUGGESTIONS=' + @($tags).Count)
