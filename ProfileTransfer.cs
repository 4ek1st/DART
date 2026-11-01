using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace ArtCatalog;

/// <summary>A portable allowlisted document, independent of either device's profile layout.</summary>
internal static class ProfileTransfer
{
    internal const int MaxBytes = 20 * 1024 * 1024;
    // Indentation can push an otherwise valid portable profile past the shared byte limit.
    internal static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = false };
    private static readonly Regex WorkKey = new("^(danbooru|gelbooru|rule34|sankaku):[a-zA-Z0-9]{1,100}$", RegexOptions.CultureInvariant);
    private static readonly string[] Collections = ["likes", "bookmarks", "history"];
    private static readonly string[] Ratings = ["general", "explicit", "all"];

    internal static JsonObject Parse(string raw)
    {
        if (Encoding.UTF8.GetByteCount(raw) > MaxBytes) throw new InvalidDataException("Profile file exceeds 20 MB.");
        var parsed = JsonNode.Parse(raw, documentOptions: new JsonDocumentOptions { MaxDepth = 32 })
            ?? throw new InvalidDataException("Choose a DART profile JSON file.");
        return Normalize(parsed);
    }

    // Local snapshots contain provider/cache metadata that is stripped below. Apply the
    // portable byte limit to the cleaned document; untrusted input still enters via Parse.
    internal static JsonObject NormalizeTrustedSnapshot(JsonObject snapshot) => Normalize(snapshot);

    private static JsonObject Normalize(JsonNode parsed)
    {
        var legacyArray = parsed as JsonArray;
        var source = parsed as JsonObject ?? (legacyArray is not null ? new JsonObject { ["bookmarks"] = legacyArray.DeepClone() } :
            throw new InvalidDataException("Choose a DART profile JSON file."));
        var format = Text(source, "format", 40);
        var mobile = format == "artcatalog-mobile";
        if (format == "dart-profile" && Number(source, "version") != 1 || mobile && Number(source, "version") is not (1 or 2))
            throw new InvalidDataException("This profile version is not supported yet.");
        if (format is not ("dart-profile" or "artcatalog-mobile" or ""))
            throw new InvalidDataException("Choose a DART profile JSON file.");
        if (format == "" && !source.ContainsKey("bookmarks") && !source.ContainsKey("likes"))
            throw new InvalidDataException("Choose a DART profile JSON file.");
        var result = new JsonObject { ["format"] = "dart-profile", ["version"] = 1 };
        var total = 0;
        foreach (var collection in Collections)
        {
            var items = Array(source, collection, 100000); total += items.Count;
            if (total > 100000) throw new InvalidDataException("Too many saved works in the profile.");
            result[collection] = new JsonArray(items.Select(item => (JsonNode)CleanWork(Object(item), 0)).ToArray());
        }
        if (mobile && Number(source, "version") == 1 && !source.ContainsKey("likes"))
            result["likes"] = result["bookmarks"]!.DeepClone();
        result["viewedIdentities"] = Strings(source, "viewedIdentities", 200000, 250, ValidIdentity);
        result["favoriteTags"] = Strings(source, "favoriteTags", 100, 100, ValidTag);
        result["recommendationTags"] = CleanRecommendationTags(source["recommendationTags"]);
        result["follows"] = new JsonArray(Array(source, "follows", 2000).Select(value => (JsonNode)CleanFollow(Object(value), mobile)).ToArray());
        if (source["preferences"] is not null) result["preferences"] = CleanPreferences(Object(source["preferences"]));
        else result["preferences"] = new JsonObject();
        var groups = new JsonArray();
        foreach (var value in Array(source, "recommendationExposureGroups", 512))
        {
            if (value is not JsonArray group || group.Count > 32) throw new InvalidDataException("Invalid recommendation exposure history.");
            var keys = new JsonObject { ["keys"] = group.DeepClone() };
            groups.Add(Strings(keys, "keys", 32, 120, key => WorkKey.IsMatch(key)));
        }
        result["recommendationExposureGroups"] = groups;
        if (Encoding.UTF8.GetByteCount(result.ToJsonString()) > MaxBytes) throw new InvalidDataException("Profile file exceeds 20 MB.");
        return result;
    }

    internal static JsonObject Counts(JsonObject document) => new([
        ..Collections.Concat(["viewedIdentities", "follows", "favoriteTags"]).Select(key =>
            new KeyValuePair<string, JsonNode?>(key, JsonValue.Create(((JsonArray)document[key]!).Count))),
        new("recommendationTags", JsonValue.Create(((JsonObject)document["recommendationTags"]!).Count))]);

    internal static JsonObject CleanWork(JsonObject source, int depth)
    {
        var provider = Text(source, "source", 20).ToLowerInvariant();
        var id = Text(source, "id", 100);
        var key = provider + ":" + id;
        if (!WorkKey.IsMatch(key) || provider != "sankaku" && !id.All(char.IsAsciiDigit))
            throw new InvalidDataException("The profile contains an unsupported artwork identity.");
        if (source.ContainsKey("key") && Text(source, "key", 120) != key)
            throw new InvalidDataException("An artwork key does not match its source and ID.");
        var result = new JsonObject { ["key"] = key, ["source"] = provider, ["id"] = id };
        foreach (var field in new[] { "title", "artist", "artistId", "creatorName", "creatorTag", "uploaderName", "uploaderId", "groupKey", "pixivGroupKey", "contentHash", "visualHash", "visualPHash", "rating", "published" })
            if (source.ContainsKey(field)) result[field] = Text(source, field, field == "title" ? 999 : 250);
        if (!result.ContainsKey("creatorName") && source.ContainsKey("artist")) result["creatorName"] = result["artist"]!.DeepClone();
        foreach (var field in new[] { "width", "height", "popularityCount", "groupingVersion" })
            if (source.ContainsKey(field) && source[field] is not null) result[field] = Number(source, field);
        if (!result.ContainsKey("popularityCount") && source.ContainsKey("score")) result["popularityCount"] = Number(source, "score");
        foreach (var field in new[] { "groupMinTime", "groupMaxTime" })
            if (source.ContainsKey(field))
            {
                if (source[field] is not JsonValue time || !time.TryGetValue<long>(out var milliseconds)) throw new InvalidDataException("Invalid artwork timestamp.");
                result[field] = milliseconds;
            }
        if (source.ContainsKey("visualAspectRatio"))
        {
            if (source["visualAspectRatio"] is not JsonValue value || !value.TryGetValue<double>(out var ratio) || !double.IsFinite(ratio) || ratio < 0 || ratio > 10000)
                throw new InvalidDataException("Invalid artwork dimensions.");
            result["visualAspectRatio"] = ratio;
        }
        foreach (var field in new[] { "tags", "allTags", "characterTags", "copyrightTags", "artistTags" })
            result[field] = Strings(source, field, 1000, 200, value => !value.Any(char.IsControl));
        result["memberKeys"] = Strings(source, "memberKeys", 1000, 120, value => WorkKey.IsMatch(value));
        result["identityKeys"] = Strings(source, "identityKeys", 2000, 250, ValidIdentity);
        foreach (var field in new[] { "thumbnail", "originalUrl", "sourceUrl" })
            result[field] = PortableUrl(Text(source, field, 4096), field == "thumbnail");
        var images = Array(source, "images", 100);
        if (images.Count == 0 && Text(source, "image", 4096) is { Length: > 0 } image) images = new JsonArray(image);
        result["images"] = new JsonArray(images.Select(value => PortableUrl(String(value, 4096), true)).Where(value => value.Length > 0).Distinct().Select(value => (JsonNode)JsonValue.Create(value)!).ToArray());
        var records = new JsonArray();
        foreach (var value in Array(source, "imageRecords", 100))
        {
            var record = Object(value); var url = PortableUrl(Text(record, "url", 4096), true);
            if (url.Length == 0) continue;
            var next = new JsonObject { ["url"] = url, ["hash"] = Text(record, "hash", 64) };
            var owner = Text(record, "owner", 120); if (owner.Length > 0 && WorkKey.IsMatch(owner)) next["owner"] = owner;
            records.Add(next);
        }
        result["imageRecords"] = records;
        var participants = new JsonArray();
        foreach (var value in Array(source, "participants", 100))
        {
            var person = Object(value); var tag = Text(person, "tag", 100);
            if (!ValidTag(tag)) throw new InvalidDataException("Invalid creator tag.");
            participants.Add(new JsonObject { ["tag"] = tag, ["name"] = Text(person, "name", 200), ["role"] = Text(person, "role", 32) });
        }
        result["participants"] = participants;
        var members = Array(source, "groupMembers", 100);
        if (depth > 0 && members.Count > 0) throw new InvalidDataException("Nested artwork groups are not supported.");
        result["groupMembers"] = new JsonArray(members.Select(member => (JsonNode)CleanWork(Object(member), depth + 1)).ToArray());
        // Only known scalar visual evidence crosses devices. No arbitrary extension fields.
        var samples = new JsonArray();
        foreach (var value in Array(source, "visualSamples", 100))
        {
            var sample = Object(value); var next = new JsonObject();
            foreach (var field in new[] { "hash", "pHash", "perceptualHash", "creator", "source", "owner", "publication", "rating", "uploader", "published" })
                if (sample.ContainsKey(field)) next[field] = Text(sample, field, 250);
            next["tags"] = Strings(sample, "tags", 1000, 200, tag => !tag.Any(char.IsControl));
            next["characters"] = Strings(sample, "characters", 1000, 200, tag => !tag.Any(char.IsControl));
            if (sample["aspectRatio"] is JsonValue aspect && aspect.TryGetValue<double>(out var number) && double.IsFinite(number) && number >= 0 && number <= 10000) next["aspectRatio"] = number;
            samples.Add(next);
        }
        result["visualSamples"] = samples;
        return result;
    }

    internal static JsonObject CleanFollow(JsonObject source, bool mobile = false)
    {
        var provider = Text(source, "source", 20).ToLowerInvariant();
        var role = Text(source, "role", 20);
        if (role.Length == 0) role = mobile ? (provider.Length == 0 || provider == "artist" || Text(source, "key", 220).StartsWith("artist:") ? "artist" : "uploader") : provider == "danbooru" || provider == "artist" ? "artist" : "uploader";
        var id = Text(source, "artistId", 100);
        if (id.Length == 0) id = Text(source, "tag", 105).Replace("user:", "", StringComparison.Ordinal);
        id = id.Trim().Replace(' ', '_').ToLowerInvariant();
        if (!CatalogService.ValidArtistTag(id) || role is not ("artist" or "uploader") || role == "uploader" && !CatalogState.IsSupported(provider))
            throw new InvalidDataException("Invalid followed artist or uploader.");
        var result = new JsonObject { ["role"] = role, ["source"] = role == "artist" ? "artist" : provider,
            ["artistId"] = id, ["name"] = Text(source, "name", 160), ["gelbooruTag"] = Text(source, "gelbooruTag", 100),
            ["followedAt"] = IsoDate(Text(source, "followedAt", 64)) };
        var seenAt = new JsonObject(); var seenKeys = new JsonObject();
        var dates = source["seenAt"] is null ? new JsonObject() : Object(source["seenAt"]);
        var keys = source["seenKeys"] is null ? new JsonObject() : Object(source["seenKeys"]);
        foreach (var rating in Ratings)
        {
            if (dates.ContainsKey(rating)) seenAt[rating] = IsoDate(Text(dates, rating, 64));
            seenKeys[rating] = Strings(keys, rating, 4000, 120, value => WorkKey.IsMatch(value));
        }
        if (mobile && source["seen"] is JsonArray seen)
            foreach (var rating in Ratings)
                seenKeys[rating] = Strings(new JsonObject { ["keys"] = seen.DeepClone() }, "keys", 4000, 120, value => WorkKey.IsMatch(value));
        result["seenAt"] = seenAt; result["seenKeys"] = seenKeys;
        return result;
    }

    internal static JsonObject CleanPreferences(JsonObject source)
    {
        var result = new JsonObject();
        foreach (var field in new[] { "hideFurry", "hideViewedAndSaved", "hideFollowedArtists" })
            if (source.ContainsKey(field)) result[field] = Boolean(source, field);
        if (source.ContainsKey("aiMode"))
        {
            var ai = Text(source, "aiMode", 30); if (ai is not ("all" or "generated" or "generated-and-assisted")) throw new InvalidDataException("Invalid AI filter."); result["aiMode"] = ai;
        }
        if (source.ContainsKey("attributionPriority"))
        {
            var priority = Text(source, "attributionPriority", 20); if (priority is not ("creator" or "original" or "uploader")) throw new InvalidDataException("Invalid attribution preference."); result["attributionPriority"] = priority;
        }
        if (source.ContainsKey("excludedTags"))
        {
            if (source["excludedTags"] is JsonValue text && text.TryGetValue<string>(out var legacy))
                source = source.DeepClone().AsObject();
            if (source["excludedTags"] is JsonValue legacyText)
                source["excludedTags"] = new JsonArray(legacyText.GetValue<string>().Split([',', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Select(value => (JsonNode)JsonValue.Create(value)!).ToArray());
            result["excludedTags"] = Strings(source, "excludedTags", 1000, 100, ValidTag);
        }
        if (source["curation"] is not null)
        {
            var curation = Object(source["curation"]); var clean = new JsonObject();
            foreach (var field in new[] { "enabled", "popularity", "personal", "freshness", "resolution" })
                if (curation.ContainsKey(field)) clean[field] = Boolean(curation, field);
            result["curation"] = clean;
        }
        var hidden = new JsonArray();
        foreach (var value in Array(source, "hiddenAuthors", 500))
        {
            JsonObject author;
            if (value is JsonValue old && old.TryGetValue<string>(out var token))
            {
                var separator = token.IndexOf(':'); if (separator <= 0) throw new InvalidDataException("Invalid hidden author.");
                author = new JsonObject { ["source"] = token[..separator], ["artistId"] = token[(separator + 1)..] };
            }
            else author = Object(value);
            var provider = Text(author, "source", 20); var id = Text(author, "artistId", 100);
            if (provider != "artist" && !CatalogState.IsSupported(provider) || !CatalogService.ValidArtistTag(id)) throw new InvalidDataException("Invalid hidden author.");
            hidden.Add(new JsonObject { ["source"] = provider, ["artistId"] = id, ["name"] = Text(author, "name", 160) });
        }
        if (source.ContainsKey("hiddenAuthors")) result["hiddenAuthors"] = hidden;
        return result;
    }

    internal static string PortableUrl(string value, bool media)
    {
        if (value.Length == 0 || !Uri.TryCreate(value, UriKind.Absolute, out var url) || url.Scheme != "https" || url.UserInfo.Length != 0 || url.IsLoopback ||
            System.Net.IPAddress.TryParse(url.Host, out _) || media && !CatalogService.IsAllowedSourceHost(url.Host)) return "";
        var query = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(url.Query);
        if (query.Keys.Any(key => Regex.IsMatch(key, "^(?:user_?id|api_?key|access_?token|refresh_?token|token|authorization|password|signature|sig|policy|key-pair-id|x-amz-.+)$", RegexOptions.IgnoreCase)) ||
            query.ContainsKey("m") && query.ContainsKey("e")) return "";
        return new UriBuilder(url) { Fragment = "" }.Uri.AbsoluteUri;
    }

    internal static bool ValidIdentity(string value) => !value.Any(char.IsControl) &&
        (value.StartsWith("key:", StringComparison.Ordinal) && WorkKey.IsMatch(value[4..]) ||
        Regex.IsMatch(value, "^(?:hash:[a-fA-F0-9]{32}|group:(?:media:[a-fA-F0-9]{64}|pixiv:[0-9]{5,12}|(?:danbooru|gelbooru|rule34|sankaku):[a-zA-Z0-9:_-]{1,180})|original:(?:x-status:[0-9]{5,25}|discord-attachment:[0-9]{5,25}:[0-9]{5,25}))$"));
    internal static bool ValidTag(string value) => value.Length is > 0 and <= 100 && !string.IsNullOrWhiteSpace(value) && !value.Any(char.IsControl);
    internal static JsonObject CleanRecommendationTags(JsonNode? node)
    {
        var result = new JsonObject(); if (node is null) return result;
        var source = Object(node); if (source.Count > 1000) throw new InvalidDataException("Too many recommendation preferences.");
        foreach (var field in source)
        {
            if (!ValidTag(field.Key)) throw new InvalidDataException("Invalid recommendation tag.");
            var mode = String(field.Value, 20); if (mode is not ("priority" or "disabled")) throw new InvalidDataException("Invalid recommendation preference.");
            var normalized = Regex.Replace(Regex.Replace(field.Key.Normalize(NormalizationForm.FormKC).ToLowerInvariant(), "[_:]+", " "), "\\s+", " ").Trim();
            if (normalized.Length == 0 || normalized.Length > 100) throw new InvalidDataException("Invalid recommendation tag.");
            if (!result.ContainsKey(normalized)) result[normalized] = mode;
        }
        return result;
    }
    internal static JsonObject Object(JsonNode? node) => node as JsonObject ?? throw new InvalidDataException("Invalid profile object.");
    internal static JsonArray Array(JsonObject source, string key, int limit)
    {
        if (!source.ContainsKey(key)) return [];
        if (source[key] is not JsonArray result || result.Count > limit) throw new InvalidDataException("Invalid or oversized profile collection: " + key);
        return result;
    }
    internal static string Text(JsonObject source, string key, int limit) => !source.ContainsKey(key) || source[key] is null ? "" : String(source[key], limit);
    private static string String(JsonNode? node, int limit) => node is JsonValue value && value.TryGetValue<string>(out var text) && text.Length <= limit ? text : throw new InvalidDataException("Invalid profile text.");
    internal static int Number(JsonObject source, string key) => source[key] is JsonValue value && value.TryGetValue<int>(out var number) ? number : throw new InvalidDataException("Invalid profile number.");
    private static bool Boolean(JsonObject source, string key) => source[key] is JsonValue value && value.TryGetValue<bool>(out var flag) ? flag : throw new InvalidDataException("Invalid profile switch.");
    private static string IsoDate(string value) => value.Length == 0 ? "" : DateTimeOffset.TryParse(value, out var date) ? date.ToUniversalTime().ToString("O") : throw new InvalidDataException("Invalid profile timestamp.");
    internal static JsonArray Strings(JsonObject source, string key, int count, int length, Func<string, bool> valid)
    {
        var values = Array(source, key, count).Select(node => String(node, length)).ToArray();
        if (values.Any(value => !valid(value))) throw new InvalidDataException("Invalid profile values: " + key);
        return new JsonArray(values.Distinct(StringComparer.Ordinal).Select(value => (JsonNode)JsonValue.Create(value)!).ToArray());
    }
}
