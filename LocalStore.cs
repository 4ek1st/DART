using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace ArtCatalog;

public sealed class SettingsUpdate
{
    public string UserId { get; set; } = "";
    public string ApiKey { get; set; } = "";
    public string? Rule34UserId { get; set; }
    public string? Rule34ApiKey { get; set; }
}

public sealed class PublicSettings
{
    public string UserId { get; set; } = "";
    public bool HasApiKey { get; set; }
    public string Rule34UserId { get; set; } = "";
    public bool HasRule34ApiKey { get; set; }
    public bool HasSankakuSession { get; set; }
    public bool SankakuAvailable { get; set; } = true;
    public string SankakuLogin { get; set; } = "";
}

public sealed class ContentPreferences
{
    public string Language { get; set; } = "en";
    public string AiMode { get; set; } = "all";
    public bool HideFurry { get; set; }
    public List<string> ExcludedTags { get; set; } = [];
    public string AttributionPriority { get; set; } = "creator";
    public bool HideViewedAndSaved { get; set; }
    public List<HiddenAuthor> HiddenAuthors { get; set; } = [];
}

public sealed class ContentPreferencesUpdate
{
    public string Language { get; set; } = "en";
    public string AiMode { get; set; } = "all";
    public bool? HideFurry { get; set; }
    public List<string> ExcludedTags { get; set; } = [];
    public string AttributionPriority { get; set; } = "creator";
    public bool HideViewedAndSaved { get; set; }
}

public sealed class PrivacyPreferences
{
    public bool HideFromScreenCapture { get; set; }
}

public sealed class HiddenAuthor
{
    public string Source { get; set; } = "artist";
    public string ArtistId { get; set; } = "";
    public string Name { get; set; } = "";
}

public sealed class HiddenAuthorUpdate
{
    public HiddenAuthor? Author { get; set; }
    public bool? Hidden { get; set; }
}

public sealed class FavoriteTagUpdate
{
    public string Tag { get; set; } = "";
    public bool? Favorite { get; set; }
}

public sealed class RecommendationTagPreferenceUpdate
{
    public string Tag { get; set; } = "";
    public string Mode { get; set; } = "";
}

public sealed class RecommendationTagPreferenceState
{
    public Dictionary<string, string> Preferences { get; set; } = [];
    public bool Initialized { get; set; }
}

public sealed class FollowRequest
{
    public string Source { get; set; } = "";
    public string ArtistId { get; set; } = "";
    public string Service { get; set; } = "";
    public string Name { get; set; } = "";
}

public sealed class FollowSeenRequest
{
    public List<string> Keys { get; set; } = [];
    public string Rating { get; set; } = "";
    public Dictionary<string, List<string>> WorkKeys { get; set; } = [];
}

public sealed class FollowTagUpdate
{
    public string Key { get; set; } = "";
    public string Tag { get; set; } = "";
}

public sealed class FollowedArtist
{
    public string Key { get; set; } = "";
    public string Source { get; set; } = "";
    public string ArtistId { get; set; } = "";
    public string Service { get; set; } = "";
    public string Name { get; set; } = "";
    public string GelbooruTag { get; set; } = "";
    public string FollowedAt { get; set; } = "";
    public Dictionary<string, string> SeenAt { get; set; } = [];
    public Dictionary<string, List<string>> SeenKeys { get; set; } = [];
}

internal sealed class LocalStore : ISankakuSessionStore
{
    public string CacheDirectory => Path.Combine(directory, "cache");
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };
    private readonly object sync = new();
    private readonly string directory;
    private readonly SavedWorksStore savedWorks;
    private readonly string followsFile;
    private readonly string followsLockFile;
    private readonly string clientStateFile;
    private readonly string recommendationPreferencesFile;
    private readonly string recommendationPreferencesLockFile;
    private readonly string contentPreferencesFile;
    private readonly string contentPreferencesLockFile;
    private readonly string privacyPreferencesFile;
    private readonly string privacyPreferencesLockFile;
    private readonly string viewedFile;
    private readonly string viewedLockFile;
    private readonly string favoriteTagsFile;
    private readonly string favoriteTagsLockFile;
    private readonly string settingsFile;
    private SettingsUpdate settings = new();

    public LocalStore(string? customDirectory = null)
    {
        directory = customDirectory ?? ResolveDefaultDirectory(AppContext.BaseDirectory,
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData));
        Directory.CreateDirectory(directory);
        followsFile = Path.Combine(directory, "follows.json");
        followsLockFile = Path.Combine(directory, "follows.lock");
        clientStateFile = Path.Combine(directory, "client-state-v4.json");
        recommendationPreferencesFile = Path.Combine(directory, "recommendation-tag-preferences.json");
        recommendationPreferencesLockFile = Path.Combine(directory, "recommendation-tag-preferences.lock");
        contentPreferencesFile = Path.Combine(directory, "content-preferences.json");
        contentPreferencesLockFile = Path.Combine(directory, "content-preferences.lock");
        privacyPreferencesFile = Path.Combine(directory, "privacy-preferences.json");
        privacyPreferencesLockFile = Path.Combine(directory, "privacy-preferences.lock");
        viewedFile = Path.Combine(directory, "viewed-identities.json");
        viewedLockFile = Path.Combine(directory, "viewed-identities.lock");
        favoriteTagsFile = Path.Combine(directory, "favorite-tags.json");
        favoriteTagsLockFile = Path.Combine(directory, "favorite-tags.lock");
        settingsFile = Path.Combine(directory, "settings.bin");
        savedWorks = new SavedWorksStore(directory);
        if (File.Exists(settingsFile))
        {
            var data = Dpapi.Unprotect(File.ReadAllBytes(settingsFile));
            settings = JsonSerializer.Deserialize<SettingsUpdate>(data, Json) ?? new();
        }
    }

    private static string ResolveDefaultDirectory(string applicationRoot, string localAppData)
    {
        var configuration = Path.Combine(applicationRoot, "profile-path.txt");
        if (!File.Exists(configuration)) return Path.Combine(localAppData, "ArtCatalog");
        var configured = File.ReadAllText(configuration).Trim();
        if (!Path.IsPathFullyQualified(configured))
            throw new InvalidOperationException("В profile-path.txt нужен полный путь к личному профилю ArtCatalog.");
        if (!Directory.Exists(configured))
            throw new DirectoryNotFoundException($"Папка личного профиля ArtCatalog недоступна: {configured}");
        return Path.GetFullPath(configured);
    }

    public List<CatalogItem> GetBookmarks() => savedWorks.Get("bookmarks");
    public List<CatalogItem> GetLikes() => savedWorks.Get("likes");
    public bool ToggleBookmark(CatalogItem item) => savedWorks.Toggle("bookmarks", item);
    public bool ToggleLike(CatalogItem item) => savedWorks.Toggle("likes", item);
    public bool EnsureLike(CatalogItem item) => savedWorks.EnsureSaved("likes", item);

    public bool RefreshSavedMetadata(CatalogItem item)
    {
        return savedWorks.RefreshMetadata(item, saved =>
        {
            var changed = false;
            void Update(string field, string value, bool allowEmpty = false)
            {
                if (!allowEmpty && string.IsNullOrWhiteSpace(value) || saved[field]?.GetValue<string>() == value) return;
                saved[field] = value;
                changed = true;
            }
            if (item.CharacterTags.Count > 0)
            {
                var previous = saved["characterTags"]?.Deserialize<List<string>>(Json) ?? [];
                var characters = previous.Concat(item.CharacterTags)
                    .Where(tag => !tag.Equals("original_character", StringComparison.OrdinalIgnoreCase))
                    .Distinct(StringComparer.OrdinalIgnoreCase).ToList();
                var previousTitle = saved["title"]?.GetValue<string>() ?? "";
                if (previousTitle.Length == 0 || previousTitle == $"Работа #{item.Id}" ||
                    previous.Count > 0 && previousTitle ==
                        string.Join(", ", previous.Select(tag => tag.Replace('_', ' '))))
                    Update("title", string.Join(", ", characters.Select(tag => tag.Replace('_', ' '))));
                if (!previous.SequenceEqual(characters))
                {
                    saved["characterTags"] = JsonSerializer.SerializeToNode(characters, Json);
                    changed = true;
                }
                Update("relatedQuery", item.RelatedQuery);
            }
            if (item.Participants.Count > 0)
            {
                var participants = JsonSerializer.SerializeToNode(item.Participants, Json);
                if (!JsonNode.DeepEquals(saved["participants"], participants))
                {
                    saved["participants"] = participants;
                    changed = true;
                }
                Update("creatorTag", item.CreatorTag, allowEmpty: true);
                Update("creatorName", item.CreatorName, allowEmpty: true);
                if (item.Source == "danbooru")
                {
                    Update("artistId", item.ArtistId, allowEmpty: true);
                    Update("artist", item.Artist);
                }
            }
            else if (item.CreatorTag.Length > 0)
            {
                Update("creatorTag", item.CreatorTag);
                Update("creatorName", item.CreatorName);
            }
            if (item.Source == "sankaku")
            {
                // Renew signed URLs in place while retaining other pages of a saved series.
                static string Identity(string url) => Uri.TryCreate(url, UriKind.Absolute, out var uri) &&
                    CatalogService.SankakuMediaHost(uri.Host) ? uri.GetLeftPart(UriPartial.Path) : url;
                var fresh = item.Images.ToDictionary(Identity, url => url);
                var previous = saved["images"]?.Deserialize<List<string>>(Json) ?? [];
                var images = previous.Select(url => fresh.GetValueOrDefault(Identity(url), url))
                    .Concat(item.Images).Distinct().Take(100).ToList();
                var node = JsonSerializer.SerializeToNode(images, Json);
                if (!JsonNode.DeepEquals(saved["images"], node))
                {
                    saved["images"] = node; changed = true;
                }
                if (saved["imageRecords"] is JsonArray records)
                    foreach (var record in records.OfType<JsonObject>())
                    {
                        var oldUrl = record["url"]?.GetValue<string>() ?? "";
                        if (fresh.TryGetValue(Identity(oldUrl), out var url) && url != oldUrl)
                        { record["url"] = url; changed = true; }
                    }
                Update("thumbnail", item.Thumbnail);
                Update("published", item.Published);
                if (saved["requiresAuthentication"]?.GetValue<bool>() != item.RequiresAuthentication)
                { saved["requiresAuthentication"] = item.RequiresAuthentication; changed = true; }
                var tags = JsonSerializer.SerializeToNode(item.Tags, Json);
                if (!JsonNode.DeepEquals(saved["tags"], tags)) { saved["tags"] = tags; changed = true; }
                Update("accessMessage", item.AccessMessage, allowEmpty: true);
            }
            return changed;
        });
    }

    public List<FollowedArtist> GetFollows()
    {
        lock (sync)
        {
            using var fileLock = AcquireFileLock(followsLockFile);
            return ReadFollowsFile(followsFile).Where(follow => CatalogState.IsSupported(follow.Source)).ToList();
        }
    }

    public bool ToggleFollow(FollowRequest request)
    {
        lock (sync)
        {
            using var fileLock = AcquireFileLock(followsLockFile);
            var follows = ReadFollowsFile(followsFile);
            var key = string.Join(':', request.Source.ToLowerInvariant(),
                "",
                request.ArtistId.ToLowerInvariant());
            var index = follows.FindIndex(follow => follow.Key == key);
            if (index >= 0) follows.RemoveAt(index);
            else
            {
                var now = DateTimeOffset.UtcNow.ToString("O");
                follows.Insert(0, new FollowedArtist
                {
                    Key = key, Source = request.Source, ArtistId = request.ArtistId,
                    Name = request.Name.Trim(), FollowedAt = now,
                    SeenAt = new Dictionary<string, string>
                    {
                        ["general"] = now, ["explicit"] = now, ["all"] = now
                    }
                });
            }
            WriteAtomic(followsFile, JsonSerializer.SerializeToUtf8Bytes(follows, Json));
            return index < 0;
        }
    }

    public bool SetGelbooruTag(string key, string tag)
    {
        lock (sync)
        {
            using var fileLock = AcquireFileLock(followsLockFile);
            var follows = ReadFollowsFile(followsFile);
            var follow = follows.Find(entry => entry.Key == key && entry.Source == "danbooru");
            if (follow is null) return false;
            follow.GelbooruTag = tag;
            WriteAtomic(followsFile, JsonSerializer.SerializeToUtf8Bytes(follows, Json));
            return true;
        }
    }

    public void MarkFollowsSeen(FollowSeenRequest update)
    {
        lock (sync)
        {
            using var fileLock = AcquireFileLock(followsLockFile);
            var follows = ReadFollowsFile(followsFile);
            var keys = update.Keys.ToHashSet(StringComparer.Ordinal);
            var changed = false;
            foreach (var follow in follows.Where(follow => keys.Contains(follow.Key)))
            {
                follow.SeenKeys ??= [];
                var viewed = follow.SeenKeys.GetValueOrDefault(update.Rating) ?? [];
                var incoming = update.WorkKeys.GetValueOrDefault(follow.Key) ?? [];
                follow.SeenKeys[update.Rating] = viewed.Concat(incoming)
                    .Distinct(StringComparer.Ordinal).TakeLast(2000).ToList();
                changed = true;
            }
            if (changed) WriteAtomic(followsFile, JsonSerializer.SerializeToUtf8Bytes(follows, Json));
        }
    }

    public PublicSettings GetPublicSettings()
    {
        lock (sync) return new PublicSettings
        {
            UserId = settings.UserId,
            HasApiKey = !string.IsNullOrWhiteSpace(settings.ApiKey),
            Rule34UserId = settings.Rule34UserId ?? "",
            HasRule34ApiKey = !string.IsNullOrWhiteSpace(settings.Rule34ApiKey),
            HasSankakuSession = GetSankakuSession().AccessToken.Length > 0,
            SankakuLogin = GetSankakuSession().Login
        };
    }

    public string GetClientStateJson()
    {
        lock (sync)
        {
            if (!File.Exists(clientStateFile)) return "{}";
            try
            {
                var raw = File.ReadAllText(clientStateFile);
                return CatalogState.CleanClientState(raw);
            }
            catch (JsonException) { return "{}"; }
        }
    }

    public string GetFollowFeedCacheJson(string rating)
    {
        if (rating is not ("general" or "explicit" or "all")) return "{\"groups\":[]}";
        lock (sync)
        {
            var path = Path.Combine(directory, $"follow-feed-cache-v1-{rating}.json");
            if (!File.Exists(path)) return "{\"groups\":[]}";
            try
            {
                var raw = File.ReadAllText(path);
                return JsonNode.Parse(raw) is JsonObject ? raw : "{\"groups\":[]}";
            }
            catch (Exception error) when (error is JsonException or IOException)
            { return "{\"groups\":[]}"; }
        }
    }

    public bool UpdateFollowFeedCacheJson(string rating, string raw)
    {
        if (rating is not ("general" or "explicit" or "all") ||
            JsonNode.Parse(raw) is not JsonObject input || input["groups"] is not JsonArray original)
            return false;
        static string Text(JsonNode? node) => node is JsonValue value &&
            value.TryGetValue<string>(out var text) ? text : "";
        lock (sync)
        {
            var followed = GetFollows().Select(follow => follow.Key).ToHashSet(StringComparer.Ordinal);
            var groups = new JsonArray();
            var count = 0;
            foreach (var group in original.OfType<JsonObject>().Take(300))
            {
                var key = Text(group["key"]);
                if (!followed.Contains(key) || group["items"] is not JsonArray originalItems) continue;
                var items = new JsonArray();
                foreach (var item in originalItems.OfType<JsonObject>())
                {
                    var source = Text(item["source"]);
                    var itemKey = Text(item["key"]);
                    if (!CatalogState.IsSupported(source) || itemKey.Length is < 3 or > 250 ||
                        !itemKey.StartsWith(source + ":", StringComparison.OrdinalIgnoreCase)) continue;
                    items.Add(item.DeepClone());
                    if (++count >= 800 || items.Count >= 12) break;
                }
                if (items.Count > 0) groups.Add(new JsonObject { ["key"] = key, ["items"] = items });
                if (count >= 800) break;
            }
            var path = Path.Combine(directory, $"follow-feed-cache-v1-{rating}.json");
            using var fileLock = AcquireFileLock(path + ".lock");
            WriteAtomic(path, JsonSerializer.SerializeToUtf8Bytes(new
            {
                savedAt = DateTimeOffset.UtcNow, groups
            }, Json));
            return true;
        }
    }

    public ContentPreferences GetContentPreferences()
    {
        lock (sync)
        {
            using var fileLock = AcquireFileLock(contentPreferencesLockFile);
            return ReadContentPreferencesFile(contentPreferencesFile);
        }
    }

    public PrivacyPreferences GetPrivacyPreferences()
    {
        lock (sync)
        {
            using var fileLock = AcquireFileLock(privacyPreferencesLockFile);
            foreach (var path in new[] { privacyPreferencesFile, privacyPreferencesFile + ".bak" })
            {
                if (!File.Exists(path)) continue;
                try
                {
                    return JsonSerializer.Deserialize<PrivacyPreferences>(File.ReadAllText(path), Json)
                        ?? new();
                }
                catch (JsonException) { /* Preserve the damaged file for recovery. */ }
            }
            return new();
        }
    }

    public void SetPrivacyPreferences(bool hideFromScreenCapture)
    {
        lock (sync)
        {
            using var fileLock = AcquireFileLock(privacyPreferencesLockFile);
            WriteAtomic(privacyPreferencesFile, JsonSerializer.SerializeToUtf8Bytes(
                new PrivacyPreferences { HideFromScreenCapture = hideFromScreenCapture }, Json));
        }
    }

    public List<string> GetViewedTokens()
    {
        lock (sync)
        {
            using var fileLock = AcquireFileLock(viewedLockFile);
            return ReadStringListFile(viewedFile).Where(CatalogState.IsSupportedToken).ToList();
        }
    }

    public void AddViewedTokens(List<string> incoming)
    {
        lock (sync)
        {
            using var fileLock = AcquireFileLock(viewedLockFile);
            var tokens = ReadStringListFile(viewedFile);
            var known = tokens.ToHashSet(StringComparer.Ordinal);
            var changed = false;
            foreach (var token in incoming.Where(CatalogState.IsSupportedToken))
                if (known.Add(token)) { tokens.Add(token); changed = true; }
            if (changed) WriteAtomic(viewedFile, JsonSerializer.SerializeToUtf8Bytes(tokens, Json));
        }
    }

    public List<string> GetFavoriteTags()
    {
        lock (sync)
        {
            using var fileLock = AcquireFileLock(favoriteTagsLockFile);
            return ReadStringListFile(favoriteTagsFile);
        }
    }

    public List<string>? SetFavoriteTag(string tag, bool favorite)
    {
        lock (sync)
        {
            using var fileLock = AcquireFileLock(favoriteTagsLockFile);
            var tags = ReadStringListFile(favoriteTagsFile);
            var index = tags.FindIndex(entry =>
                string.Equals(entry, tag, StringComparison.OrdinalIgnoreCase));
            if (favorite && index < 0)
            {
                if (tags.Count >= 100) return null;
                tags.Add(tag);
                WriteAtomic(favoriteTagsFile, JsonSerializer.SerializeToUtf8Bytes(tags, Json));
            }
            else if (!favorite && index >= 0)
            {
                tags.RemoveAt(index);
                WriteAtomic(favoriteTagsFile, JsonSerializer.SerializeToUtf8Bytes(tags, Json));
            }
            return tags;
        }
    }

    public ContentPreferences UpdateContentPreferences(ContentPreferencesUpdate update)
    {
        lock (sync)
        {
            using var fileLock = AcquireFileLock(contentPreferencesLockFile);
            var previous = ReadContentPreferencesFile(contentPreferencesFile);
            var preferences = new ContentPreferences
            {
                Language = update.Language is "en" or "ru" or "de" ? update.Language : "en",
                AiMode = update.AiMode,
                // A preferences form from an older window must not reset the new switch.
                HideFurry = update.HideFurry ?? previous.HideFurry,
                AttributionPriority = update.AttributionPriority,
                HideViewedAndSaved = update.HideViewedAndSaved,
                // Older windows do not send this field. Only the dedicated mutation changes it.
                HiddenAuthors = previous.HiddenAuthors ?? [],
                ExcludedTags = update.ExcludedTags.Select(tag => tag.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase).ToList()
            };
            WriteAtomic(contentPreferencesFile,
                JsonSerializer.SerializeToUtf8Bytes(preferences, Json));
            return preferences;
        }
    }

    public ContentPreferences? SetHiddenAuthor(HiddenAuthor author, bool hidden)
    {
        lock (sync)
        {
            using var fileLock = AcquireFileLock(contentPreferencesLockFile);
            var preferences = ReadContentPreferencesFile(contentPreferencesFile);
            preferences.HiddenAuthors ??= [];
            var existing = preferences.HiddenAuthors.FindIndex(entry => entry.Source == author.Source &&
                string.Equals(entry.ArtistId, author.ArtistId, StringComparison.OrdinalIgnoreCase));
            if (hidden && existing < 0)
            {
                if (preferences.HiddenAuthors.Count >= 500) return null;
                preferences.HiddenAuthors.Add(author);
            }
            else if (!hidden && existing >= 0) preferences.HiddenAuthors.RemoveAt(existing);
            else return preferences;
            WriteAtomic(contentPreferencesFile, JsonSerializer.SerializeToUtf8Bytes(preferences, Json));
            return preferences;
        }
    }

    public void UpdateClientStateJson(string raw)
    {
        lock (sync)
        {
            var next = JsonNode.Parse(CatalogState.CleanClientState(raw))!.AsObject();
            var previous = JsonNode.Parse(GetClientStateJson()) as JsonObject;
            // Verified duplicate pairs are a cache shared by windows. An older session save
            // may omit it, so retain and merge the evidence instead of resetting it.
            var pairs = new[] { previous?["mediaDuplicatePairs"], next["mediaDuplicatePairs"] }
                .OfType<JsonArray>().SelectMany(entries => entries)
                .OfType<JsonArray>().Where(pair => pair.Count == 2 && pair.All(value =>
                    value is JsonValue text && text.TryGetValue<string>(out var key) &&
                    key.Length <= 1000 && Uri.TryCreate(key, UriKind.Absolute, out var uri) &&
                    uri.Scheme is "http" or "https"))
                .Select(pair => pair.ToJsonString()).Distinct().TakeLast(512).ToArray();
            if (pairs.Length > 0 || next.ContainsKey("mediaDuplicatePairs"))
                next["mediaDuplicatePairs"] = new JsonArray(pairs.Select(pair => JsonNode.Parse(pair)).ToArray());
            WriteAtomic(clientStateFile, Encoding.UTF8.GetBytes(next.ToJsonString()));
        }
    }

    public RecommendationTagPreferenceState GetRecommendationTagPreferences()
    {
        lock (sync)
        {
            using var fileLock = AcquireFileLock(recommendationPreferencesLockFile);
            return ReadRecommendationTagPreferences();
        }
    }

    public RecommendationTagPreferenceState UpdateRecommendationTagPreference(
        RecommendationTagPreferenceUpdate update)
    {
        lock (sync)
        {
            using var fileLock = AcquireFileLock(recommendationPreferencesLockFile);
            var state = ReadRecommendationTagPreferences();
            if (update.Mode == "normal") state.Preferences.Remove(update.Tag);
            else state.Preferences[update.Tag] = update.Mode;
            WriteAtomic(recommendationPreferencesFile,
                JsonSerializer.SerializeToUtf8Bytes(state.Preferences, Json));
            state.Initialized = true;
            return state;
        }
    }

    private RecommendationTagPreferenceState ReadRecommendationTagPreferences()
    {
        if (File.Exists(recommendationPreferencesFile))
        {
            foreach (var path in new[] { recommendationPreferencesFile,
                recommendationPreferencesFile + ".bak" })
            {
                try
                {
                    var parsed = JsonSerializer.Deserialize<Dictionary<string, string>>(
                        File.ReadAllText(path), Json);
                    if (parsed is not null)
                        return new RecommendationTagPreferenceState
                        {
                            Preferences = ValidRecommendationTagPreferences(parsed),
                            Initialized = true
                        };
                }
                catch (Exception ex) when (ex is JsonException or IOException) { }
            }
            return new RecommendationTagPreferenceState { Initialized = true };
        }
        try
        {
            using var legacy = JsonDocument.Parse(GetClientStateJson());
            if (legacy.RootElement.TryGetProperty("recommendationTagPreferences", out var value) &&
                value.ValueKind == JsonValueKind.Object)
            {
                var parsed = JsonSerializer.Deserialize<Dictionary<string, string>>(
                    value.GetRawText(), Json) ?? [];
                return new RecommendationTagPreferenceState
                {
                    Preferences = ValidRecommendationTagPreferences(parsed)
                };
            }
        }
        catch (JsonException) { }
        return new RecommendationTagPreferenceState();
    }

    private static Dictionary<string, string> ValidRecommendationTagPreferences(
        Dictionary<string, string> source)
    {
        return source.Where(entry => entry.Key.Length is > 0 and <= 100 &&
                entry.Value is "priority" or "disabled")
            .Take(1000).ToDictionary(entry => entry.Key, entry => entry.Value,
                StringComparer.Ordinal);
    }

    public (string UserId, string ApiKey) GetGelbooruCredentials()
    {
        lock (sync) return (settings.UserId, settings.ApiKey);
    }

    public (string UserId, string ApiKey) GetRule34Credentials()
    {
        lock (sync) return (settings.Rule34UserId ?? "", settings.Rule34ApiKey ?? "");
    }

    public void UpdateSettings(SettingsUpdate update)
    {
        lock (sync)
        {
            var userId = update.UserId.Trim();
            var key = update.ApiKey.Trim();
            if (userId.Length == 0) key = "";
            else if (key.Length == 0 && userId == settings.UserId) key = settings.ApiKey;
            var rule34UserId = (update.Rule34UserId ?? settings.Rule34UserId ?? "").Trim();
            var rule34Key = (update.Rule34ApiKey ?? settings.Rule34ApiKey ?? "").Trim();
            if (rule34UserId.Length == 0) rule34Key = "";
            else if (update.Rule34ApiKey == "" && rule34UserId == settings.Rule34UserId)
                rule34Key = settings.Rule34ApiKey ?? "";
            settings = new SettingsUpdate
            {
                UserId = userId, ApiKey = key,
                Rule34UserId = rule34UserId, Rule34ApiKey = rule34Key
            };
            var plain = JsonSerializer.SerializeToUtf8Bytes(settings, Json);
            WriteAtomic(settingsFile, Dpapi.Protect(plain));
        }
    }

    public SankakuSession GetSankakuSession()
    {
        lock (sync)
        {
            using var fileLock = AcquireFileLock(Path.Combine(directory, "sankaku-session.lock"));
            var path = Path.Combine(directory, "sankaku-session.bin");
            if (!File.Exists(path)) return new();
            return JsonSerializer.Deserialize<SankakuSession>(Dpapi.Unprotect(File.ReadAllBytes(path)), Json) ?? new();
        }
    }

    public bool SetSankakuSession(SankakuSession session, string? expectedToken = null)
    {
        lock (sync)
        {
            using var fileLock = AcquireFileLock(Path.Combine(directory, "sankaku-session.lock"));
            var path = Path.Combine(directory, "sankaku-session.bin");
            if (expectedToken is not null)
            {
                var current = File.Exists(path) ? JsonSerializer.Deserialize<SankakuSession>(
                    Dpapi.Unprotect(File.ReadAllBytes(path)), Json) ?? new() : new();
                if (current.AccessToken != expectedToken) return false;
            }
            WriteAtomic(path, Dpapi.Protect(JsonSerializer.SerializeToUtf8Bytes(session, Json)));
            return true;
        }
    }

    private static void WriteAtomic(string path, byte[] bytes)
    {
        var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            File.WriteAllBytes(temporary, bytes);
            if (File.Exists(path)) File.Copy(path, path + ".bak", overwrite: true);
            File.Move(temporary, path, overwrite: true);
        }
        finally
        {
            if (File.Exists(temporary)) File.Delete(temporary);
        }
    }

    private static FileStream AcquireFileLock(string lockFile)
    {
        for (var attempt = 0; attempt < 50; attempt++)
        {
            try
            {
                return new FileStream(lockFile, FileMode.OpenOrCreate,
                    FileAccess.ReadWrite, FileShare.None);
            }
            catch (IOException) when (attempt < 49)
            {
                Thread.Sleep(50);
            }
        }
        throw new IOException("Не удалось открыть файл данных.");
    }

    private static List<FollowedArtist> ReadFollowsFile(string path)
    {
        if (!File.Exists(path)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<FollowedArtist>>(File.ReadAllText(path), Json) ?? [];
        }
        catch (JsonException)
        {
            var backup = path + ".bak";
            List<FollowedArtist>? restored = null;
            if (File.Exists(backup))
            {
                try { restored = JsonSerializer.Deserialize<List<FollowedArtist>>(
                    File.ReadAllText(backup), Json) ?? []; }
                catch (JsonException) { /* Keep both damaged files for recovery. */ }
            }
            File.Move(path, path + ".corrupt-" + Guid.NewGuid().ToString("N"));
            if (restored is not null) File.Copy(backup, path);
            return restored ?? [];
        }
    }

    private static ContentPreferences ReadContentPreferencesFile(string path)
    {
        if (!File.Exists(path)) return new();
        try
        {
            return JsonSerializer.Deserialize<ContentPreferences>(File.ReadAllText(path), Json)
                ?? new();
        }
        catch (JsonException)
        {
            var backup = path + ".bak";
            ContentPreferences? restored = null;
            if (File.Exists(backup))
            {
                try { restored = JsonSerializer.Deserialize<ContentPreferences>(
                    File.ReadAllText(backup), Json); }
                catch (JsonException) { /* Keep the damaged backup for recovery. */ }
            }
            File.Move(path, path + ".corrupt-" + Guid.NewGuid().ToString("N"));
            if (restored is not null) File.Copy(backup, path);
            return restored ?? new();
        }
    }

    private static List<string> ReadStringListFile(string path)
    {
        if (!File.Exists(path)) return [];
        foreach (var candidate in new[] { path, path + ".bak" })
        {
            if (!File.Exists(candidate)) continue;
            try { return JsonSerializer.Deserialize<List<string>>(
                File.ReadAllText(candidate), Json) ?? []; }
            catch (JsonException) { }
        }
        return [];
    }

}

internal static class Dpapi
{
    [StructLayout(LayoutKind.Sequential)]
    private struct DataBlob
    {
        public int Length;
        public IntPtr Data;
    }

    [DllImport("crypt32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CryptProtectData(ref DataBlob input, string? description,
        IntPtr entropy, IntPtr reserved, IntPtr prompt, int flags, out DataBlob output);

    [DllImport("crypt32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CryptUnprotectData(ref DataBlob input, out IntPtr description,
        IntPtr entropy, IntPtr reserved, IntPtr prompt, int flags, out DataBlob output);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr LocalFree(IntPtr memory);

    public static byte[] Protect(byte[] data) => Transform(data, true);
    public static byte[] Unprotect(byte[] data) => Transform(data, false);

    private static byte[] Transform(byte[] data, bool protect)
    {
        var input = new DataBlob { Length = data.Length, Data = Marshal.AllocHGlobal(data.Length) };
        var output = new DataBlob();
        var description = IntPtr.Zero;
        try
        {
            Marshal.Copy(data, 0, input.Data, data.Length);
            var okay = protect
                ? CryptProtectData(ref input, "ArtCatalog settings", IntPtr.Zero, IntPtr.Zero,
                    IntPtr.Zero, 1, out output)
                : CryptUnprotectData(ref input, out description, IntPtr.Zero, IntPtr.Zero,
                    IntPtr.Zero, 1, out output);
            if (!okay) throw new Win32Exception(Marshal.GetLastWin32Error());
            var result = new byte[output.Length];
            Marshal.Copy(output.Data, result, 0, result.Length);
            return result;
        }
        finally
        {
            Marshal.FreeHGlobal(input.Data);
            if (output.Data != IntPtr.Zero) LocalFree(output.Data);
            if (description != IntPtr.Zero) LocalFree(description);
        }
    }
}
