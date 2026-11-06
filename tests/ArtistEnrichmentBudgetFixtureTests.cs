using System.Collections;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Reflection;
using ArtCatalog;

internal static class ArtistEnrichmentBudgetFixtureTests
{
    private const BindingFlags PrivateInstance = BindingFlags.Instance | BindingFlags.NonPublic;
    private sealed class Tags : HttpMessageHandler
    {
        internal readonly List<string> Names = [];
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        {
            if (request.RequestUri?.Host != "api.rule34.xxx") throw new Exception("Fixture attempted an unexpected host");
            var name = Uri.UnescapeDataString(request.RequestUri.Query.Split("&name=")[1].Split('&')[0]);
            Names.Add(name);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(
                "<tags><tag name=\"" + name + "\" type=\"1\" /></tags>") });
        }
    }
    private static void Expect(bool value, string message)
    { if (!value) throw new Exception("Artist enrichment budget: " + message); }
    private static ConcurrentDictionary<string, (DateTimeOffset Expires, bool IsArtist)> Cache(CatalogService service, string name) =>
        (ConcurrentDictionary<string, (DateTimeOffset, bool)>)typeof(CatalogService).GetField(name, PrivateInstance)!.GetValue(service)!;
    private static CatalogItem Item(string source, string tag) => new() { Key = source + ":" + tag, Source = source, Tags = [tag] };

    private static async Task Scenario(string root, bool cancelCaller)
    {
        var store = new LocalStore(root);
        store.UpdateSettings(new() { UserId = "neutral_fixture", ApiKey = "neutral_fixture",
            Rule34UserId = "neutral_fixture", Rule34ApiKey = "neutral_fixture" });
        var service = new CatalogService(store);
        var prefix = "fixture_" + Guid.NewGuid().ToString("N") + "_";
        var cachedGel = Item("gelbooru", prefix + "cached_gel");
        var cachedRule = Item("rule34", prefix + "cached_rule");
        var cold = Enumerable.Range(1, 3).Select(index => Item("rule34", prefix + "cold_" + index)).ToArray();
        var ordinary = Item("rule34", prefix + "ordinary_tag");
        CatalogItem[] items = [cachedGel, cachedRule, .. cold, ordinary];
        var artists = Cache(service, "artistTagCache");
        var native = Cache(service, "rule34ArtistTagCache");
        foreach (var item in items) artists[item.Tags[0]] = (DateTimeOffset.UtcNow.AddHours(1), item != ordinary);
        native[cachedRule.Tags[0]] = (DateTimeOffset.UtcNow.AddHours(1), true);

        // Exercise the real service, real 2-second budget and real shared
        // Rule34 client at its production 1.1-second pacing. Only HTTP is fake.
        var client = typeof(CatalogService).GetField("Rule34Api", BindingFlags.Static | BindingFlags.NonPublic)!.GetValue(null)!;
        var httpField = client.GetType().GetField("http", PrivateInstance)!;
        var nextField = client.GetType().GetField("nextRequest", PrivateInstance)!;
        var previousHttp = httpField.GetValue(client);
        var previousNext = nextField.GetValue(client);
        using var handler = new Tags(); using var http = new HttpClient(handler);
        using var caller = new CancellationTokenSource();
        httpField.SetValue(client, http); nextField.SetValue(client, default(DateTimeOffset));
        var watch = Stopwatch.StartNew();
        try
        {
            if (cancelCaller) caller.CancelAfter(150);
            var enrich = (Task)typeof(CatalogService).GetMethod("TryEnrichArtistTagsAsync", PrivateInstance)!
                .Invoke(service, [items, caller.Token])!;
            if (cancelCaller)
            {
                try { await enrich; throw new Exception("Caller cancellation was swallowed"); }
                catch (OperationCanceledException) when (caller.IsCancellationRequested) { }
                Expect(items.All(item => item.Participants.Count == 0), "caller cancellation published fallback attribution");
                Expect(watch.Elapsed < TimeSpan.FromSeconds(1), "caller cancellation waited for supplementary metadata");
            }
            else
            {
                await enrich;
                Expect(watch.Elapsed >= TimeSpan.FromMilliseconds(1800) && watch.Elapsed < TimeSpan.FromSeconds(3),
                    "supplementary metadata escaped the existing 2-second budget");
                Expect(handler.Names.Count == 2 && handler.Names[0] == cold[0].Tags[0], "fixture did not exercise three serial cold candidates");
                Expect(cachedGel.CreatorTag == cachedGel.Tags[0], "confirmed cached Gelbooru attribution disappeared on timeout");
                Expect(cachedRule.CreatorTag == cachedRule.Tags[0], "confirmed cached Rule34 attribution disappeared on timeout");
                Expect(cold[0].CreatorTag == cold[0].Tags[0] && cold[1].CreatorTag == cold[1].Tags[0],
                    "positively validated early candidates were discarded when a later candidate timed out");
                Expect(cold[2].Participants.Count == 0 && ordinary.Participants.Count == 0,
                    "unconfirmed or general tags were guessed as artists");
            }
            Console.WriteLine($"Artist enrichment {(cancelCaller ? "caller cancellation" : "partial timeout")}: {watch.Elapsed.TotalMilliseconds:F0}ms, HTTP replies {handler.Names.Count} PASS");
        }
        finally
        {
            var pending = (IDictionary)client.GetType().GetField("pending", PrivateInstance)!.GetValue(client)!;
            var cleanup = Stopwatch.StartNew();
            while (pending.Count > 0 && cleanup.Elapsed < TimeSpan.FromSeconds(2)) await Task.Delay(10);
            httpField.SetValue(client, previousHttp); nextField.SetValue(client, previousNext);
            Expect(pending.Count == 0, "cancelled metadata left a live shared request behind");
        }
    }

    internal static async Task RunAsync()
    {
        var temp = Path.GetFullPath(Path.GetTempPath());
        var root = Path.GetFullPath(Path.Combine(temp, "DART-Artist-Budget-" + Guid.NewGuid().ToString("N")));
        try { await Scenario(Path.Combine(root, "timeout"), false); await Scenario(Path.Combine(root, "cancel"), true); }
        finally
        {
            if (!root.StartsWith(Path.Combine(temp, "DART-Artist-Budget-"), StringComparison.OrdinalIgnoreCase))
                throw new Exception("Fixture cleanup escaped its isolated temporary directory");
            if (Directory.Exists(root)) Directory.Delete(root, recursive: true);
        }
    }
}
