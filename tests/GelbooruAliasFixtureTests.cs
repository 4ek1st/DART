using System.Net;
using System.Reflection;
using ArtCatalog;

internal static class GelbooruAliasFixtureTests
{
    internal static async Task RunAsync()
    {
        const string row = """
            <div id="aliases"><table><tr><th>Tags</th></tr><tr class="even"><td>
            <a href="index.php?page=post&amp;s=list&amp;tags=old_tag">old tag</a>
            <span class="tag-count">90785</span> <b>&rarr;</b>
            <a href="index.php?page=post&amp;s=list&amp;tags=current_tag">current tag</a>
            <span class="tag-count">117927</span></td></tr></table></div>
            """;
        Expect(GelbooruSearchAliases.ParseTarget(row, "old_tag") == "current_tag",
            "Official approved alias rows must identify the exact canonical target");
        var reported = row.Replace("old_tag", "forced_to_fuck").Replace("current_tag", "rape");
        Expect(GelbooruSearchAliases.ParseTarget(reported, "forced_to_fuck") == "rape",
            "The reported 90k tag must resolve using the observed official alias row");
        Expect(GelbooruSearchAliases.ParseTarget(row, "other_tag") is null,
            "An unrelated alias result must never authorize the requested tag");
        Expect(GelbooruSearchAliases.ParseTarget(row.Replace("&rarr;", "pending"), "old_tag") is null,
            "An unapproved or ambiguous alias row must not authorize the target");
        Expect(GelbooruSearchAliases.ParseTarget(row.Replace("tags=current_tag", "tags=current_tag+other"), "old_tag") is null,
            "An alias target must be one literal tag, not an injected query");
        Expect(GelbooruSearchAliases.ParseTarget(row.Replace("href=\"index.php?page=post&amp;s=list&amp;tags=current_tag",
                "href=\"https://unrelated.example/index.php?page=post&amp;s=list&amp;tags=current_tag"), "old_tag") is null,
            "An external link is not a Gelbooru alias target");
        Expect(GelbooruSearchAliases.ParseTarget(row.Replace("<div id=\"aliases\">", "<div id=\"suggestions\">"), "old_tag") is null,
            "Suggestion links outside the official alias list are not evidence");
        Expect(GelbooruSearchAliases.ParseTarget(row.Replace("current_tag", "old_tag"), "old_tag") is null,
            "A self alias must not bypass literal validation");
        var extraRow = "<tr><td><a href=\"index.php?page=post&amp;s=list&amp;tags=old_tag\">old</a> &rarr; " +
            "<a href=\"index.php?page=post&amp;s=list&amp;tags=another_tag\">other</a></td></tr>";
        Expect(GelbooruSearchAliases.ParseTarget(row.Replace("</table>", extraRow + "</table>"), "old_tag") is null,
            "Conflicting alias records must fail closed");
        Expect(GelbooruSearchAliases.ParseTarget("<div id=\"aliases\"><table></table></div>" +
                "<table>" + extraRow + "</table>", "old_tag") is null,
            "Rows outside the official alias container must not authorize a replacement");

        var transport = new AliasHandler(row);
        using var http = new HttpClient(transport);
        var resolver = new GelbooruSearchAliases(http);
        var posts = new[] { new CatalogItem { Source = "gelbooru", Tags = ["current_tag", "blue_hair"] } };
        var rewritten = await resolver.ResolveQueryAsync("old_tag blue_hair -excluded ~optional rating:e", posts, CancellationToken.None);
        Expect(rewritten == "current_tag blue_hair -excluded ~optional rating:e" && transport.Requests == 1,
            "Resolve only a missing positive literal and preserve exclusions/metatags");
        Expect(transport.Paths.Single() == "/index.php?page=alias&s=list&search=old_tag",
            "The supplemental request must be a read-only exact official alias lookup");
        Expect(await resolver.ResolveQueryAsync("old_tag", posts, CancellationToken.None) == "current_tag" && transport.Requests == 1,
            "Repeated pages must reuse the verified alias without extra requests");
        var combined = new[] { new CatalogItem { Source = "gelbooru", Tags = ["current_tag", "a", "b", "c", "d"] } };
        Expect(await resolver.ResolveQueryAsync("old_tag a b c d", combined, CancellationToken.None) == "current_tag a b c d" && transport.Requests == 1,
            "The lookup budget applies to missing tags rather than already matching query terms");
        Expect(await resolver.ResolveQueryAsync("blue_hair", posts, CancellationToken.None) == "blue_hair" && transport.Requests == 1,
            "Ordinary matching searches must incur no supplemental request");
        Expect(await resolver.ResolveQueryAsync("old_tag", [], CancellationToken.None) == "old_tag" && transport.Requests == 1,
            "Empty or rating-filtered pages must retain raw pagination without an alias lookup");
        var catalog = typeof(CatalogItem).Assembly.GetType("ArtCatalog.CatalogService")!;
        var matches = catalog.GetMethod("MatchesSearchTags", BindingFlags.NonPublic | BindingFlags.Static)!;
        Expect(!(bool)matches.Invoke(null, [posts[0], "old_tag"])! &&
               (bool)matches.Invoke(null, [posts[0], "current_tag blue_hair"])!,
            "Resolved Gelbooru terms must pass the existing strict literal guard");
        Expect(!(bool)matches.Invoke(null, [posts[0], "old_tag"])!,
            "Other providers must still validate the original query independently");
        var unrelated = new[] { new CatalogItem { Source = "gelbooru", Tags = ["unrelated"] } };
        Expect(!(bool)matches.Invoke(null, [unrelated[0], await resolver.ResolveQueryAsync("old_tag", unrelated, CancellationToken.None)])!,
            "A verified alias must not admit unrelated fallback records");

        var missingTransport = new AliasHandler("<div id=\"aliases\"><table></table></div>");
        using var missingHttp = new HttpClient(missingTransport);
        var missing = new GelbooruSearchAliases(missingHttp);
        Expect(await missing.ResolveQueryAsync("unknown_tag", posts, CancellationToken.None) == "unknown_tag" &&
               await missing.ResolveQueryAsync("unknown_tag", posts, CancellationToken.None) == "unknown_tag" && missingTransport.Requests == 1,
            "Unknown tags fail closed and cache their absence");
        var failureTransport = new AliasHandler(row, HttpStatusCode.ServiceUnavailable);
        using var failureHttp = new HttpClient(failureTransport);
        var failed = new GelbooruSearchAliases(failureHttp);
        for (var attempt = 0; attempt < 2; attempt++)
        {
            try { await failed.ResolveQueryAsync("old_tag", posts, CancellationToken.None); throw new Exception("Expected a retryable alias failure"); }
            catch (GelbooruAliasLookupException) { }
        }
        Expect(failureTransport.Requests == 1,
            "A supplemental outage must retain the source cursor for retry and avoid repeated requests");
        var challengeTransport = new AliasHandler("<html><body>Access check required</body></html>");
        using var challengeHttp = new HttpClient(challengeTransport);
        try
        {
            await new GelbooruSearchAliases(challengeHttp).ResolveQueryAsync("old_tag", posts, CancellationToken.None);
            throw new Exception("Expected a retryable protection-page failure");
        }
        catch (GelbooruAliasLookupException) { }
        using var canceled = new CancellationTokenSource(); canceled.Cancel();
        try { await resolver.ResolveQueryAsync("old_tag", posts, canceled.Token); throw new Exception("Expected cancellation"); }
        catch (OperationCanceledException) { }
        var many = new AliasHandler(row);
        using var manyHttp = new HttpClient(many);
        await new GelbooruSearchAliases(manyHttp).ResolveQueryAsync("one two three four five", posts, CancellationToken.None);
        Expect(many.Requests == 0, "Oversized literal queries must not fan out into alias lookups");
        Console.WriteLine("Gelbooru confirmed search aliases: PASS");
    }

    private static void Expect(bool value, string message)
    {
        if (!value) throw new Exception(message);
    }

    private sealed class AliasHandler(string html, HttpStatusCode status = HttpStatusCode.OK) : HttpMessageHandler
    {
        public int Requests { get; private set; }
        public List<string> Paths { get; } = [];
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        {
            Requests++; Paths.Add(request.RequestUri!.PathAndQuery);
            Expect(request.Method == HttpMethod.Get && request.RequestUri.Host == "gelbooru.com" &&
                   request.Headers.Authorization is null, "Alias lookup must remain read-only and credential-free");
            return Task.FromResult(new HttpResponseMessage(status) { RequestMessage = request,
                Content = new StringContent(html, System.Text.Encoding.UTF8, "text/html") });
        }
    }
}
