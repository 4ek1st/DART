using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace ArtCatalog;

internal sealed partial class LocalStore
{
    public JsonObject ExportProfileTransfer()
    {
        lock (sync)
        {
            using var libraryLock = savedWorks.AcquireProfileTransferLock();
            using var locks = AcquireTransferFileLocks();
            var library = savedWorks.ProfileTransferSnapshot();
            var client = ReadTransferObject(clientStateFile);
            var document = new JsonObject
            {
                ["format"] = "dart-profile", ["version"] = 1,
                ["likes"] = library["likes"]!.DeepClone(), ["bookmarks"] = library["bookmarks"]!.DeepClone(),
                ["history"] = client["recent"]?.DeepClone() ?? new JsonArray(),
                ["follows"] = new JsonArray(ReadTransferArray(followsFile).OfType<JsonObject>()
                    .Select(follow => (JsonNode)ProfileTransfer.CleanFollow(follow)).ToArray()),
                ["viewedIdentities"] = ReadTransferArray(viewedFile),
                ["favoriteTags"] = ReadTransferArray(favoriteTagsFile),
                ["recommendationTags"] = JsonSerializer.SerializeToNode(ReadRecommendationTagPreferences().Preferences, Json),
                ["preferences"] = ReadTransferObject(contentPreferencesFile),
                ["recommendationExposureGroups"] = client["recommendationExposureGroups"]?.DeepClone() ?? new JsonArray()
            };
            // Parsing our own snapshot applies exactly the same allowlist and
            // portable-URL policy used for imports. Account/session fields never cross.
            var clean = ProfileTransfer.Parse(document.ToJsonString());
            clean["createdAt"] = DateTimeOffset.UtcNow.ToString("O"); clean["platform"] = "windows";
            if (JsonSerializer.SerializeToUtf8Bytes(clean, ProfileTransfer.Json).Length > ProfileTransfer.MaxBytes)
                throw new InvalidDataException("Profile file exceeds 20 MB.");
            return clean;
        }
    }

    public JsonObject ImportProfileTransfer(JsonObject incoming, bool applySettings)
    {
        // Revalidate even callers other than the HTTP endpoint before acquiring
        // any write lock or creating a backup.
        var document = ProfileTransfer.Parse(incoming.ToJsonString());
        lock (sync)
        {
            using var libraryLock = savedWorks.AcquireProfileTransferLock();
            using var locks = AcquireTransferFileLocks();
            var library = savedWorks.ProfileTransferSnapshot();
            var originalLibrary = library.DeepClone();
            var client = ReadTransferObject(clientStateFile);
            var originalClient = client.DeepClone();
            var originalFollows = ReadTransferArray(followsFile);
            var mergedFollows = originalFollows.DeepClone().AsArray();
            var viewed = ReadTransferArray(viewedFile);
            var favorites = ReadTransferArray(favoriteTagsFile);
            var preferences = ReadTransferObject(contentPreferencesFile);
            var recTags = JsonSerializer.SerializeToNode(ReadRecommendationTagPreferences().Preferences, Json)!.AsObject();
            var added = new JsonObject(); var skipped = new JsonObject();
            foreach (var collection in new[] { "likes", "bookmarks" })
            {
                var count = MergeTransferWorks(library[collection]!.AsArray(), document[collection]!.AsArray());
                added[collection] = count; skipped[collection] = document[collection]!.AsArray().Count - count;
            }
            var history = client["recent"] as JsonArray ?? new JsonArray();
            history = history.DeepClone().AsArray();
            var knownHistory = viewed.Select(value => value!.GetValue<string>()).Concat(history.OfType<JsonObject>().SelectMany(TransferWorkTokens)).ToHashSet(StringComparer.Ordinal);
            var historyAdded = 0;
            foreach (var entry in document["history"]!.AsArray().OfType<JsonObject>())
            {
                var tokens = TransferWorkTokens(entry).ToArray();
                if (!tokens.Any(knownHistory.Contains)) historyAdded++;
                knownHistory.UnionWith(tokens);
            }
            MergeTransferWorks(history, document["history"]!.AsArray());
            // Recent entries are a bounded UI convenience; every imported entry
            // also contributes permanent viewed identities before the display cap.
            var allViewed = document["viewedIdentities"]!.AsArray().DeepClone().AsArray();
            foreach (var work in document["history"]!.AsArray().OfType<JsonObject>())
                foreach (var token in TransferWorkTokens(work)) allViewed.Add(token);
            var viewedAdded = MergeTransferStrings(viewed, allViewed);
            if (history.Count > 0 || client.ContainsKey("recent")) client["recent"] = new JsonArray(history.Take(40).Select(item => item?.DeepClone()).ToArray());
            added["history"] = historyAdded; skipped["history"] = document["history"]!.AsArray().Count - historyAdded;
            added["viewedIdentities"] = viewedAdded;
            skipped["viewedIdentities"] = Math.Max(0, document["viewedIdentities"]!.AsArray().Count - viewedAdded);
            var favoriteAdded = MergeTransferStrings(favorites, document["favoriteTags"]!.AsArray());
            if (favorites.Count > 100) throw new InvalidDataException("The merged profile exceeds the limit of 100 favorite tags.");
            added["favoriteTags"] = favoriteAdded; skipped["favoriteTags"] = document["favoriteTags"]!.AsArray().Count - favoriteAdded;
            var recAdded = 0;
            foreach (var choice in document["recommendationTags"]!.AsObject())
            {
                if (!recTags.ContainsKey(choice.Key)) { recTags[choice.Key] = choice.Value?.DeepClone(); recAdded++; }
                else if (applySettings) recTags[choice.Key] = choice.Value?.DeepClone();
            }
            if (recTags.Count > 1000) throw new InvalidDataException("Too many recommendation preferences in the merged profile.");
            added["recommendationTags"] = recAdded; skipped["recommendationTags"] = document["recommendationTags"]!.AsObject().Count - recAdded;
            var followAdded = MergeTransferFollows(mergedFollows, document["follows"]!.AsArray());
            if (mergedFollows.Count > 2000) throw new InvalidDataException("Too many followed artists in the merged profile.");
            added["follows"] = followAdded; skipped["follows"] = document["follows"]!.AsArray().Count - followAdded;
            if (applySettings) MergeTransferPreferences(preferences, document["preferences"]!.AsObject());
            var oldGroups = client["recommendationExposureGroups"] as JsonArray ?? [];
            if (oldGroups.Count > 0 || document["recommendationExposureGroups"]!.AsArray().Count > 0)
            {
                client["recommendationExposureGroups"] = MergeTransferExposure(oldGroups, document["recommendationExposureGroups"]!.AsArray());
                client["recommendationExposure"] = new JsonArray(client["recommendationExposureGroups"]!.AsArray()
                    .OfType<JsonArray>().SelectMany(group => group).Select(value => value!.GetValue<string>()).Distinct()
                    .TakeLast(512).Select(value => (JsonNode)JsonValue.Create(value)!).ToArray());
            }

            var writes = new Dictionary<string, byte[]>(StringComparer.OrdinalIgnoreCase);
            AddIfChanged(followsFile, originalFollows, mergedFollows);
            AddIfChanged(clientStateFile, originalClient, client);
            AddIfChanged(viewedFile, ReadTransferArray(viewedFile), viewed);
            AddIfChanged(favoriteTagsFile, ReadTransferArray(favoriteTagsFile), favorites);
            AddIfChanged(recommendationPreferencesFile, JsonSerializer.SerializeToNode(ReadRecommendationTagPreferences().Preferences, Json)!, recTags);
            AddIfChanged(contentPreferencesFile, ReadTransferObject(contentPreferencesFile), preferences);
            var libraryChanged = !JsonNode.DeepEquals(originalLibrary, library);
            var libraryPath = Path.Combine(directory, "saved-works-v1.json");
            var changed = writes.Keys.Concat(libraryChanged ? [libraryPath] : Array.Empty<string>()).ToArray();
            if (changed.Length > 0)
            {
                var originals = changed.SelectMany(path => new[] { path, path + ".bak" }).Distinct()
                    .ToDictionary(path => path, path => File.Exists(path) ? File.ReadAllBytes(path) : null, StringComparer.OrdinalIgnoreCase);
                var backup = Path.Combine(directory, "transfer-backups", DateTimeOffset.UtcNow.ToString("yyyyMMddTHHmmssfff") + "-" + Guid.NewGuid().ToString("N"));
                Directory.CreateDirectory(backup);
                foreach (var entry in originals.Where(entry => entry.Value is not null))
                {
                    var target = Path.Combine(backup, Path.GetFileName(entry.Key));
                    File.WriteAllBytes(target, entry.Value!);
                    if (!SHA256.HashData(File.ReadAllBytes(target)).SequenceEqual(SHA256.HashData(entry.Value!)))
                        throw new IOException("Could not verify the profile backup.");
                }
                try
                {
                    foreach (var entry in writes) WriteAtomic(entry.Key, entry.Value);
                    if (libraryChanged) savedWorks.WriteProfileTransferSnapshot(library);
                }
                catch
                {
                    foreach (var entry in originals)
                    {
                        if (entry.Value is null) { if (File.Exists(entry.Key)) File.Delete(entry.Key); }
                        else File.WriteAllBytes(entry.Key, entry.Value);
                    }
                    savedWorks.InvalidateProfileTransferSnapshot();
                    throw;
                }
            }
            return new JsonObject { ["added"] = added, ["skipped"] = skipped, ["settingsApplied"] = applySettings,
                ["backupCreated"] = changed.Length > 0, ["changed"] = changed.Length > 0 };

            void AddIfChanged(string path, JsonNode before, JsonNode after)
            { if (!JsonNode.DeepEquals(before, after)) writes[path] = JsonSerializer.SerializeToUtf8Bytes(after, ProfileTransfer.Json); }
        }
    }

    private IDisposable AcquireTransferFileLocks()
    {
        var held = new List<IDisposable>();
        try
        {
            foreach (var path in new[] { followsLockFile, clientStateFile + ".lock", viewedLockFile, favoriteTagsLockFile, recommendationPreferencesLockFile, contentPreferencesLockFile }.Order(StringComparer.OrdinalIgnoreCase))
                held.Add(AcquireFileLock(path));
            return new TransferLocks(held);
        }
        catch { foreach (var item in held.AsEnumerable().Reverse()) item.Dispose(); throw; }
    }
    private sealed class TransferLocks(List<IDisposable> held) : IDisposable
    { public void Dispose() { foreach (var item in held.AsEnumerable().Reverse()) item.Dispose(); } }
    private static JsonNode ReadTransferNode(string path, bool array)
    {
        if (!File.Exists(path)) return array ? new JsonArray() : new JsonObject();
        foreach (var candidate in new[] { path, path + ".bak" })
        {
            if (!File.Exists(candidate)) continue;
            try
            {
                var node = JsonNode.Parse(File.ReadAllBytes(candidate));
                if (array && node is JsonArray || !array && node is JsonObject) return node!;
            }
            catch (JsonException) { }
        }
        throw new InvalidDataException("Could not read the existing profile. Its files have been preserved.");
    }
    private static JsonArray ReadTransferArray(string path) => ReadTransferNode(path, true).AsArray();
    private static JsonObject ReadTransferObject(string path) => ReadTransferNode(path, false).AsObject();

    private static IEnumerable<string> TransferWorkTokens(JsonObject item)
    {
        var publications = TransferPublications(item);
        foreach (var publication in publications) yield return publication;
        yield return "key:" + item["key"]!.GetValue<string>();
        foreach (var value in item["memberKeys"] as JsonArray ?? []) if (value is JsonValue key) yield return "key:" + key.GetValue<string>();
        foreach (var value in item["identityKeys"] as JsonArray ?? [])
            if (value is JsonValue token && ProfileTransfer.ValidIdentity(token.GetValue<string>()) &&
                (publications.Count == 0 || !TransferWeakParent(token.GetValue<string>()))) yield return token.GetValue<string>();
        if (item["contentHash"] is JsonValue hash && System.Text.RegularExpressions.Regex.IsMatch(hash.GetValue<string>(), "^[a-fA-F0-9]{32}$")) yield return "hash:" + hash.GetValue<string>().ToLowerInvariant();
        foreach (var record in (item["imageRecords"] as JsonArray ?? []).OfType<JsonObject>())
            if (record["hash"] is JsonValue imageHash && System.Text.RegularExpressions.Regex.IsMatch(imageHash.GetValue<string>(), "^[a-fA-F0-9]{32}$")) yield return "hash:" + imageHash.GetValue<string>().ToLowerInvariant();
    }

    private static bool TransferWeakParent(string token) => System.Text.RegularExpressions.Regex.IsMatch(token,
        "^group:(danbooru|gelbooru|rule34|sankaku):parent:");

    private static HashSet<string> TransferPublications(JsonObject item)
    {
        var result = new HashSet<string>(StringComparer.Ordinal);
        foreach (var field in new[] { "pixivGroupKey", "groupKey" })
            if (item[field] is JsonValue value && value.TryGetValue<string>(out var key) &&
                System.Text.RegularExpressions.Regex.IsMatch(key, "^pixiv:[0-9]{5,12}$")) result.Add("group:" + key);
        var original = item["originalUrl"]?.GetValue<string>();
        if (!Uri.TryCreate(original, UriKind.Absolute, out var url) || url.Scheme is not ("http" or "https") || url.UserInfo.Length != 0) return result;
        var host = System.Text.RegularExpressions.Regex.Replace(url.Host.ToLowerInvariant(), "^(www|mobile)\\.", "");
        System.Text.RegularExpressions.Match match;
        if (host == "pixiv.net")
        {
            match = System.Text.RegularExpressions.Regex.Match(url.AbsolutePath, "^/(?:en/)?artworks/([0-9]{5,12})(?:/|$)");
            if (match.Success) result.Add("group:pixiv:" + match.Groups[1].Value);
        }
        else if (host == "i.pximg.net" && (url.AbsolutePath.StartsWith("/img-original/") || url.AbsolutePath.StartsWith("/img-master/")))
        {
            match = System.Text.RegularExpressions.Regex.Match(url.AbsolutePath, @"/([0-9]{5,12})(?:-[a-fA-F0-9]{32})?_p[0-9]+(?:_[^/.]+)?\.(?:jpg|jpeg|png|gif|webp)$");
            if (match.Success) result.Add("group:pixiv:" + match.Groups[1].Value);
        }
        else if (host is "x.com" or "twitter.com")
        {
            match = System.Text.RegularExpressions.Regex.Match(url.AbsolutePath, "^/(?:[^/]+/status|i/web/status)/([0-9]{5,25})(?:/|$)");
            if (match.Success) result.Add("original:x-status:" + match.Groups[1].Value);
        }
        return result;
    }

    private static int MergeTransferWorks(JsonArray existing, JsonArray incoming)
    {
        var local = existing.OfType<JsonObject>().ToArray();
        var items = local.Concat(incoming.OfType<JsonObject>()).ToArray();
        var roots = Enumerable.Range(0, items.Length).ToArray();
        int Root(int index) { while (roots[index] != index) { roots[index] = roots[roots[index]]; index = roots[index]; } return index; }
        var publications = items.Select(TransferPublications).ToArray();
        void Join(int first, int second, bool weak = false)
        {
            var a = Root(first); var b = Root(second); if (a == b) return;
            if (weak && publications[a].Count > 0 && publications[b].Count > 0 && !publications[a].Overlaps(publications[b])) return;
            roots[a] = b; publications[b].UnionWith(publications[a]);
        }
        var lookup = new Dictionary<string, int>(StringComparer.Ordinal);
        var parents = new Dictionary<string, List<int>>(StringComparer.Ordinal);
        for (var index = 0; index < items.Length; index++)
            foreach (var token in TransferWorkTokens(items[index]))
                if (TransferWeakParent(token))
                {
                    if (!parents.TryGetValue(token, out var members)) parents[token] = members = [];
                    members.Add(index);
                }
                else if (lookup.TryGetValue(token, out var previous)) Join(index, previous);
                else lookup[token] = index;
        // Exact identities settle first. A metadata-poor mirror must not use a
        // legacy parent to bridge two already confirmed different publications.
        foreach (var members in parents.Values)
            for (var index = 1; index < members.Count; index++)
                Join(members[index], members[0], weak: true);
        var groups = Enumerable.Range(0, items.Length).GroupBy(Root).ToDictionary(group => group.Key, group => group.ToArray());
        var merged = new Dictionary<int, JsonObject>(); var added = 0;
        foreach (var (root, indices) in groups)
        {
            if (!indices.Any(index => index >= local.Length)) continue;
            var first = indices.First(); var result = items[first].DeepClone().AsObject();
            if (first >= local.Length) added++;
            foreach (var index in indices)
            {
                var item = items[index];
                var members = (result["memberKeys"] as JsonArray)?.DeepClone().AsArray() ?? [];
                var aliases = TransferWorkTokens(item).Where(token => token.StartsWith("key:") && token[4..] != result["key"]!.GetValue<string>());
                MergeTransferStrings(members, new JsonArray(aliases.Select(token => (JsonNode)JsonValue.Create(token[4..])!).ToArray()));
                if (members.Count > 1000) throw new InvalidDataException("Too many aliases in a merged artwork.");
                if (members.Count > 0 && !JsonNode.DeepEquals(result["memberKeys"], members)) result["memberKeys"] = members;
                MergeTransferWorkMetadata(result, item);
            }
            merged[root] = result;
        }
        var output = new JsonArray(); var published = new HashSet<int>();
        for (var index = 0; index < items.Length; index++)
        {
            var root = Root(index);
            if (merged.TryGetValue(root, out var value)) { if (published.Add(root)) output.Add(value); }
            else if (index < local.Length) output.Add(items[index].DeepClone());
        }
        var committed = output.ToArray(); output.Clear(); existing.Clear();
        foreach (var value in committed) existing.Add(value);
        return added;
    }

    private static void MergeTransferWorkMetadata(JsonObject existing, JsonObject incoming)
    {
        if (string.IsNullOrEmpty(existing["creatorTag"]?.GetValue<string>()) && incoming["creatorTag"] is JsonValue creator &&
            creator.TryGetValue<string>(out var creatorTag) && creatorTag.Length > 0 && incoming["creatorName"] is JsonValue creatorName)
            existing["creatorName"] = creatorName.DeepClone();
        foreach (var field in new[] { "creatorTag", "creatorName", "thumbnail", "originalUrl", "published" })
            if (string.IsNullOrEmpty(existing[field]?.GetValue<string>()) && incoming[field] is JsonValue text && text.TryGetValue<string>(out var value) && value.Length > 0)
                existing[field] = value;
        if (TransferPublications(existing).Count == 0)
        {
            var publication = TransferPublications(incoming).FirstOrDefault(value => value.StartsWith("group:pixiv:"));
            if (publication is not null) existing["pixivGroupKey"] = publication[6..];
        }
        foreach (var field in new[] { "tags", "allTags", "characterTags", "copyrightTags", "artistTags", "identityKeys" })
        {
            var values = (existing[field] as JsonArray)?.DeepClone().AsArray() ?? [];
            MergeTransferStrings(values, incoming[field] as JsonArray ?? []);
            if (values.Count > (field == "identityKeys" ? 2000 : 1000)) throw new InvalidDataException("Too much merged artwork metadata.");
            if (values.Count > 0 && !JsonNode.DeepEquals(existing[field], values)) existing[field] = values;
        }
        foreach (var field in new[] { "participants", "visualSamples" })
        {
            var values = (existing[field] as JsonArray)?.DeepClone().AsArray() ?? [];
            foreach (var value in incoming[field] as JsonArray ?? [])
                if (!values.Any(known => JsonNode.DeepEquals(known, value))) values.Add(value?.DeepClone());
            if (values.Count > 100) throw new InvalidDataException("Too much merged artwork evidence.");
            if (values.Count > 0 && !JsonNode.DeepEquals(existing[field], values)) existing[field] = values;
        }
        if (incoming["groupingVersion"] is JsonValue version && version.TryGetValue<int>(out var groupingVersion) &&
            groupingVersion > (existing["groupingVersion"]?.GetValue<int>() ?? 0)) existing["groupingVersion"] = groupingVersion;
        var urls = new JsonArray(); var records = new JsonArray(); var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in new[] { existing, incoming })
        {
            var images = item["images"] as JsonArray ?? [];
            var metadata = (item["imageRecords"] as JsonArray ?? []).OfType<JsonObject>()
                .GroupBy(record => record["url"]?.GetValue<string>() ?? "").ToDictionary(group => group.Key, group => group.First());
            foreach (var value in images)
            {
                var url = value!.GetValue<string>(); var record = metadata.GetValueOrDefault(url)?.DeepClone().AsObject() ?? new JsonObject { ["url"] = url };
                var hash = record["hash"]?.GetValue<string>() ?? "";
                if (hash.Length == 0 && images.Count == 1) hash = item["contentHash"]?.GetValue<string>() ?? "";
                if (!System.Text.RegularExpressions.Regex.IsMatch(hash, "^[a-fA-F0-9]{32}$"))
                {
                    var match = System.Text.RegularExpressions.Regex.Match(url, @"/([a-fA-F0-9]{32})\.[a-zA-Z0-9]+(?:\?|$)");
                    hash = match.Success ? match.Groups[1].Value : "";
                }
                var identity = hash.Length > 0 ? "hash:" + hash.ToLowerInvariant() : "url:" + url;
                if (!seen.Add(identity)) continue;
                urls.Add(url); if (hash.Length > 0) record["hash"] = hash;
                records.Add(record);
            }
        }
        if (urls.Count > 100) throw new InvalidDataException("Too many images in a merged artwork.");
        if (urls.Count > 0 && !JsonNode.DeepEquals(existing["images"], urls)) existing["images"] = urls;
        if (records.Count > 0 && !JsonNode.DeepEquals(existing["imageRecords"], records)) existing["imageRecords"] = records;
        var groupMembers = (existing["groupMembers"] as JsonArray)?.DeepClone().AsArray() ?? [];
        var memberKeys = groupMembers.OfType<JsonObject>().Select(member => member["key"]?.GetValue<string>() ?? "").ToHashSet(StringComparer.Ordinal);
        var candidates = (incoming["groupMembers"] as JsonArray ?? []).OfType<JsonObject>();
        if (incoming["key"]?.GetValue<string>() != existing["key"]?.GetValue<string>()) candidates = candidates.Prepend(incoming);
        foreach (var member in candidates)
            if (memberKeys.Add(member["key"]!.GetValue<string>()))
            {
                var copy = member.DeepClone().AsObject(); copy["groupMembers"] = new JsonArray(); groupMembers.Add(copy);
            }
        if (groupMembers.Count > 100) throw new InvalidDataException("Too many members in a merged artwork.");
        if (groupMembers.Count > 0 && !JsonNode.DeepEquals(existing["groupMembers"], groupMembers)) existing["groupMembers"] = groupMembers;
    }

    private static int MergeTransferStrings(JsonArray existing, JsonArray incoming)
    {
        var known = existing.Select(value => value!.GetValue<string>()).ToHashSet(StringComparer.Ordinal);
        var count = 0;
        foreach (var value in incoming)
            if (value is JsonValue text && known.Add(text.GetValue<string>())) { existing.Add(text.GetValue<string>()); count++; }
        return count;
    }

    private static int MergeTransferFollows(JsonArray existing, JsonArray incoming)
    {
        var known = existing.OfType<JsonObject>().GroupBy(value =>
            (value["source"]?.GetValue<string>() ?? "").ToLowerInvariant() + "::" +
            (value["artistId"]?.GetValue<string>() ?? "").Trim().Replace(' ', '_').ToLowerInvariant(), StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.Ordinal);
        var added = 0;
        foreach (var entry in incoming.OfType<JsonObject>())
        {
            var source = entry["role"]!.GetValue<string>() == "artist" ? "danbooru" : entry["source"]!.GetValue<string>();
            var id = entry["artistId"]!.GetValue<string>(); var key = source + "::" + id;
            if (!known.TryGetValue(key, out var match))
            {
                match = new JsonObject { ["key"] = key, ["source"] = source, ["artistId"] = id, ["service"] = "",
                    ["name"] = entry["name"]!.GetValue<string>() is { Length: > 0 } name ? name : id.Replace('_', ' '),
                    ["gelbooruTag"] = entry["gelbooruTag"]!.DeepClone(), ["followedAt"] = entry["followedAt"]!.GetValue<string>() is { Length: > 0 } followedAt ? followedAt : DateTimeOffset.UtcNow.ToString("O"),
                    ["seenAt"] = entry["seenAt"]!.DeepClone(), ["seenKeys"] = entry["seenKeys"]!.DeepClone() };
                existing.Add(match); known[key] = match; added++;
            }
            else
            {
                var seen = match["seenKeys"] as JsonObject ?? new JsonObject(); seen = seen.DeepClone().AsObject();
                foreach (var rating in new[] { "general", "explicit", "all" })
                {
                    var keys = seen[rating] as JsonArray ?? []; keys = keys.DeepClone().AsArray();
                    MergeTransferStrings(keys, entry["seenKeys"]![rating]!.AsArray());
                    seen[rating] = new JsonArray(keys.TakeLast(4000).Select(value => value?.DeepClone()).ToArray());
                }
                match["seenKeys"] = seen;
            }
        }
        return added;
    }

    private static void MergeTransferPreferences(JsonObject existing, JsonObject incoming)
    {
        foreach (var entry in incoming)
        {
            if (entry.Key is "excludedTags" or "hiddenAuthors")
            {
                var values = existing[entry.Key] as JsonArray ?? []; values = values.DeepClone().AsArray();
                foreach (var value in entry.Value!.AsArray())
                    if (!values.Any(known => JsonNode.DeepEquals(known, value))) values.Add(value?.DeepClone());
                if (values.Count > (entry.Key == "hiddenAuthors" ? 500 : 1000)) throw new InvalidDataException("Too many merged content filters.");
                existing[entry.Key] = values;
            }
            else if (entry.Key == "curation")
            {
                var curation = existing[entry.Key] as JsonObject ?? new JsonObject(); curation = curation.DeepClone().AsObject();
                foreach (var choice in entry.Value!.AsObject()) curation[choice.Key] = choice.Value?.DeepClone();
                existing[entry.Key] = curation;
            }
            else existing[entry.Key] = entry.Value?.DeepClone();
        }
    }

    private static JsonArray MergeTransferExposure(JsonArray existing, JsonArray incoming)
    {
        var groups = new List<List<string>>();
        foreach (var entry in existing.Concat(incoming).OfType<JsonArray>())
        {
            var keys = entry.Select(value => value!.GetValue<string>()).Distinct().Take(32).ToList();
            if (keys.Count == 0) continue;
            var matches = groups.Where(group => group.Intersect(keys).Any()).ToArray();
            foreach (var match in matches) { keys.AddRange(match); groups.Remove(match); }
            groups.Add(keys.Distinct().Take(32).ToList());
        }
        return new JsonArray(groups.TakeLast(512).Select(group => (JsonNode)new JsonArray(group.Select(value => (JsonNode)JsonValue.Create(value)!).ToArray())).ToArray());
    }
}
