using System.Text.Json.Nodes;

namespace ArtCatalog;

internal static class CatalogState
{
    internal static readonly string[] Sources = ["danbooru", "gelbooru", "rule34", "sankaku"];

    internal static bool IsSupported(string? source) =>
        Sources.Contains(source, StringComparer.OrdinalIgnoreCase);

    internal static bool IsSupportedToken(string token)
    {
        if (!token.StartsWith("key:", StringComparison.Ordinal)) return true;
        return IsSupported(token.Split(':').ElementAtOrDefault(1));
    }

    internal static string CleanClientState(string raw)
    {
        var state = JsonNode.Parse(raw) as JsonObject ?? new JsonObject();
        if (state["recent"] is JsonArray recent)
            state["recent"] = new JsonArray(recent.Where(item =>
                IsSupported(Text(item, "source"))).Select(item => item?.DeepClone()).ToArray());
        if (state["session"] is not JsonObject session || session["tabs"] is not JsonArray tabs)
            return state.ToJsonString();
        var active = session["activeIndex"] is JsonValue value && value.TryGetValue<int>(out var index)
            ? index : 0;
        var kept = new JsonArray();
        var selected = -1;
        var legacyBookmarks = session["savedWorksVersion"] is not JsonValue version ||
            !version.TryGetValue<int>(out var savedWorksVersion) || savedWorksVersion < 1;
        string[] kinds = ["home", "search", "detail", "profile", "bookmarks", "likes",
            "recommendations", "follows", "recent", "settings"];
        string[] fields = ["kind", "title", "query", "searchQuery", "selectedSources", "rating",
            "sort", "feed", "item", "profileRef", "settingsSection", "preview", "pinned", "scrollTop"];
        for (var original = 0; original < tabs.Count; original++)
        {
            if (tabs[original] is not JsonObject tab) continue;
            var kind = Text(tab, "kind");
            if (!kinds.Contains(kind) ||
                (kind is "home" or "search") && Text(tab, "feed") is not ("" or "illustrations") ||
                kind == "detail" && !IsSupported(Text(tab["item"], "source")) ||
                kind == "profile" && Text(tab["profileRef"], "source") != "artist" &&
                    !IsSupported(Text(tab["profileRef"], "source"))) continue;
            var sources = tab["selectedSources"] as JsonArray;
            var supported = sources?.Select(source => source?.GetValue<string>())
                .Where(IsSupported).Distinct().ToArray();
            if (sources?.Count > 0 && supported?.Length == 0 && kind is "home" or "search") continue;
            var clean = new JsonObject();
            foreach (var field in fields)
                if (tab.ContainsKey(field)) clean[field] = tab[field]?.DeepClone();
            if (legacyBookmarks && kind == "bookmarks")
            { clean["kind"] = "likes"; clean["title"] = "Liked"; }
            clean["feed"] = "illustrations";
            clean["selectedSources"] = new JsonArray((supported is { Length: > 0 } ? supported : Sources)
                .Select(source => (JsonNode?)JsonValue.Create(source)).ToArray());
            if (original == active) selected = kept.Count;
            kept.Add(clean);
        }
        session["tabs"] = kept;
        session["savedWorksVersion"] = 1;
        session["activeIndex"] = selected >= 0 ? selected : Math.Clamp(active, 0, Math.Max(0, kept.Count - 1));
        return state.ToJsonString();
    }

    private static string Text(JsonNode? node, string field) =>
        node is JsonObject obj && obj[field] is JsonValue value && value.TryGetValue<string>(out var text)
            ? text : "";
}
