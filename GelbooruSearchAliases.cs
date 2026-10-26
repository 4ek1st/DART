using System.Collections.Concurrent;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace ArtCatalog;

internal sealed class GelbooruAliasLookupException() : InvalidOperationException(
    "Gelbooru временно не вернул данные синонимов тегов. Повторите поиск позже.");

// Gelbooru's posts API resolves approved aliases but returns only the new tags.
// Keep exact-tag validation, accepting replacements only from its official alias list.
internal sealed class GelbooruSearchAliases(HttpClient http)
{
    private const int MaximumHtmlBytes = 512 * 1024;
    private static readonly TimeSpan ParseTimeout = TimeSpan.FromMilliseconds(100);
    private readonly ConcurrentDictionary<string, (DateTimeOffset Expires, string? Target, bool Failed)> cache = new(StringComparer.Ordinal);
    private readonly SemaphoreSlim gate = new(1, 1);

    internal async Task<string> ResolveQueryAsync(string query, IReadOnlyList<CatalogItem> items, CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        if (items.Count == 0) return query;
        var terms = query.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var available = items.Select(item => item.Tags.ToHashSet(StringComparer.OrdinalIgnoreCase)).ToArray();
        var missing = terms.Where(IsLiteralTag).Distinct(StringComparer.OrdinalIgnoreCase)
            .Where(literal => !available.All(tags => tags.Contains(literal))).ToArray();
        if (missing.Length is 0 or > 4) return query;
        using var budget = CancellationTokenSource.CreateLinkedTokenSource(token);
        budget.CancelAfter(TimeSpan.FromSeconds(3));
        try
        {
            foreach (var literal in missing)
            {
                var canonical = await ResolveTagAsync(literal.ToLowerInvariant(), budget.Token);
                if (canonical is null) continue;
                for (var i = 0; i < terms.Length; i++)
                    if (terms[i].Equals(literal, StringComparison.OrdinalIgnoreCase)) terms[i] = canonical;
            }
        }
        catch (OperationCanceledException) when (!token.IsCancellationRequested)
        { throw new GelbooruAliasLookupException(); }
        token.ThrowIfCancellationRequested();
        return string.Join(' ', terms);
    }

    private async Task<string?> ResolveTagAsync(string tag, CancellationToken token)
    {
        if (cache.TryGetValue(tag, out var saved) && saved.Expires > DateTimeOffset.UtcNow)
        {
            if (saved.Failed) throw new GelbooruAliasLookupException();
            return saved.Target;
        }
        await gate.WaitAsync(token);
        try
        {
            if (cache.TryGetValue(tag, out saved) && saved.Expires > DateTimeOffset.UtcNow)
            {
                if (saved.Failed) throw new GelbooruAliasLookupException();
                return saved.Target;
            }
            string? target = null;
            var failed = false;
            var lifetime = TimeSpan.FromMinutes(10);
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get,
                    "https://gelbooru.com/index.php?page=alias&s=list&search=" + Uri.EscapeDataString(tag));
                request.Headers.Accept.ParseAdd("text/html");
                using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, token);
                response.EnsureSuccessStatusCode();
                if (response.RequestMessage?.RequestUri is not { Scheme: "https", Host: "gelbooru.com" } ||
                    response.Content.Headers.ContentType?.MediaType != "text/html" ||
                    response.Content.Headers.ContentLength > MaximumHtmlBytes)
                    throw new InvalidOperationException("Unexpected alias response");
                await using var stream = await response.Content.ReadAsStreamAsync(token);
                using var bytes = new MemoryStream();
                var buffer = new byte[8192];
                int read;
                while ((read = await stream.ReadAsync(buffer, token)) > 0)
                {
                    if (bytes.Length + read > MaximumHtmlBytes) throw new InvalidOperationException("Alias response is too large");
                    bytes.Write(buffer, 0, read);
                }
                var html = Encoding.UTF8.GetString(bytes.GetBuffer(), 0, (int)bytes.Length);
                if (!TryAliasTable(html, out _)) throw new InvalidOperationException("Alias list is unavailable");
                target = ParseTarget(html, tag);
                if (target is not null) lifetime = TimeSpan.FromHours(1);
            }
            catch (Exception error) when (error is HttpRequestException or InvalidOperationException or IOException or RegexMatchTimeoutException)
            { lifetime = TimeSpan.FromSeconds(30); failed = true; }
            if (cache.Count >= 512)
                foreach (var old in cache.Keys.Take(64)) cache.TryRemove(old, out _);
            cache[tag] = (DateTimeOffset.UtcNow + lifetime, target, failed);
            if (failed) throw new GelbooruAliasLookupException();
            return target;
        }
        finally { gate.Release(); }
    }

    internal static string? ParseTarget(string html, string requested)
    {
        if (!IsLiteralTag(requested) || !TryAliasTable(html, out var tableBody)) return null;
        var targets = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (Match row in Regex.Matches(tableBody, @"<tr\b[^>]*>(?<body>.*?)</tr>",
                     RegexOptions.IgnoreCase | RegexOptions.Singleline, ParseTimeout))
        {
            var body = WebUtility.HtmlDecode(row.Groups["body"].Value);
            var links = Regex.Matches(body, "<a\\b[^>]*\\bhref\\s*=\\s*(['\"])(?<url>.*?)\\1[^>]*>.*?</a>",
                RegexOptions.IgnoreCase | RegexOptions.Singleline, ParseTimeout).Cast<Match>().ToArray();
            if (links.Length != 2 || !TryTagLink(links[0].Groups["url"].Value, out var source) ||
                !source.Equals(requested, StringComparison.OrdinalIgnoreCase) ||
                !TryTagLink(links[1].Groups["url"].Value, out var target) ||
                source.Equals(target, StringComparison.OrdinalIgnoreCase)) continue;
            var between = body[(links[0].Index + links[0].Length)..links[1].Index];
            if (!between.Contains('→')) continue;
            targets.Add(target);
        }
        return targets.Count == 1 ? targets.Single().ToLowerInvariant() : null;
    }

    private static bool TryAliasTable(string html, out string tableBody)
    {
        tableBody = "";
        if (html.Length > MaximumHtmlBytes) return false;
        var list = Regex.Match(html, "<div\\b[^>]*\\bid\\s*=\\s*(['\"])aliases\\1[^>]*>",
            RegexOptions.IgnoreCase, ParseTimeout);
        if (!list.Success) return false;
        var contentsStart = list.Index + list.Length;
        var contentsEnd = html.IndexOf("</div", contentsStart, StringComparison.OrdinalIgnoreCase);
        if (contentsEnd < 0) return false;
        var table = Regex.Match(html[contentsStart..contentsEnd], @"<table\b[^>]*>(?<body>.*?)</table>",
            RegexOptions.IgnoreCase | RegexOptions.Singleline, ParseTimeout);
        if (!table.Success) return false;
        tableBody = table.Groups["body"].Value;
        return true;
    }

    private static bool TryTagLink(string href, out string tag)
    {
        tag = "";
        if (!Uri.TryCreate(new Uri("https://gelbooru.com/"), href, out var uri) ||
            uri.Scheme != "https" || uri.Host != "gelbooru.com" || !uri.IsDefaultPort ||
            uri.UserInfo.Length > 0 || uri.Fragment.Length > 0 || uri.AbsolutePath != "/index.php") return false;
        var values = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var entry in uri.Query.TrimStart('?').Split('&'))
        {
            var pair = entry.Split('=', 2);
            if (pair.Length != 2 || !values.TryAdd(pair[0], Uri.UnescapeDataString(pair[1].Replace('+', ' ')))) return false;
        }
        if (values.Count != 3 || !values.TryGetValue("page", out var page) || page != "post" ||
            !values.TryGetValue("s", out var action) || action != "list" ||
            !values.TryGetValue("tags", out tag!) || !IsLiteralTag(tag)) return false;
        return true;
    }

    private static bool IsLiteralTag(string tag) => Regex.IsMatch(tag,
        @"^[\p{L}\p{N}_][\p{L}\p{M}\p{N}_()'.,!;/\-]{0,99}$", RegexOptions.CultureInvariant, ParseTimeout);
}
