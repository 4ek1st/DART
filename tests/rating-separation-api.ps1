param([Parameter(Mandatory=$true)][string]$BaseUrl)
$ErrorActionPreference = 'Stop'
foreach ($source in @('danbooru', 'gelbooru', 'rule34')) {
  foreach ($rating in @('general', 'explicit')) {
    $result = Invoke-RestMethod -Uri "$BaseUrl/api/search?q=latex&sources=$source&rating=$rating&page=0"
    if ($result.errors.$source) { throw "$source unavailable: $($result.errors.$source)" }
    $allowed = if ($rating -eq 'general') { @('g', 's', 'general', 'sensitive', 'safe') } else { @('q', 'e', 'questionable', 'explicit') }
    if (@($result.items | Where-Object { $_.source -ne $source -or $_.rating -notin $allowed }).Count) {
      throw "$source returned an incorrect rating for $rating"
    }
    "$source $rating=$(@($result.items).Count)"
  }
}
