using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace ArtCatalog;

public sealed class FavoriteViewUpdate
{
    public DateTimeOffset? ViewedAt { get; set; }
    public bool FilteringComplete { get; set; } = true;
    public CatalogItem Item { get; set; } = new();
    public bool MetadataOnly { get; set; }
}

public sealed class FavoriteArtwork
{
    public bool FilteringComplete { get; set; } = true;
    public string UploaderId { get; set; } = "";
    public string UploaderName { get; set; } = "";
    public string ArtistId { get; set; } = "";
    public string Artist { get; set; } = "";
    public List<CatalogItem> GroupMembers { get; set; } = [];
    public List<string> AllTags { get; set; } = [];
    public string Key { get; set; } = "";
    public string Source { get; set; } = "";
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Thumbnail { get; set; } = "";
    public string Rating { get; set; } = "";
    public string CreatorTag { get; set; } = "";
    public string CreatorName { get; set; } = "";
    public List<CatalogParticipant> Participants { get; set; } = [];
    public List<string> Images { get; set; } = [];
    public List<string> Tags { get; set; } = [];
    public List<string> CharacterTags { get; set; } = [];
    public List<string> CopyrightTags { get; set; } = [];
}

public sealed class FavoriteActivityEntry
{
    public string Tag { get; set; } = "";
    public string Kind { get; set; } = "tag";
    public int Count { get; set; }
    public int ActiveDays { get; set; }
    public DateTimeOffset LastViewedAt { get; set; }
    public string LastWorkKey { get; set; } = "";
}

public sealed class FavoriteActivitySummary
{
    public int TotalWorks { get; set; }
    public DateTimeOffset? TrackedSince { get; set; }
    public bool Incomplete { get; set; }
    public List<FavoriteActivityEntry> Entries { get; set; } = [];
    public List<FavoriteArtwork> Works { get; set; } = [];
    public Dictionary<string, string> Kinds { get; set; } = [];
}

internal sealed partial class LocalStore
{
    private const long FavoriteDailyLimit = 16 * 1024 * 1024;
    private static readonly JsonSerializerOptions FavoriteJson = new(JsonSerializerDefaults.Web);
    private readonly Dictionary<string, (string Stamp, DateTimeOffset At, FavoriteActivitySummary Summary)> favoriteSummaryCache = [];
    private string FavoriteActivityDirectory => Path.Combine(directory, "favorite-activity-v1");
    private string FavoriteActivityLock => Path.Combine(directory, "favorite-activity.lock");
    private string FavoriteKindsFile => Path.Combine(directory, "favorite-kinds-v1.json");

    private sealed class FavoriteActivityRecord
    {
        public DateTimeOffset At { get; set; }
        public bool MetadataOnly { get; set; }
        public FavoriteArtwork Work { get; set; } = new();
        public List<string> Tokens { get; set; } = [];
    }

    internal static string NormalizeFavoriteTag(string? value) => Regex.Replace(
        (value ?? "").Normalize(NormalizationForm.FormKC).Trim().ToLowerInvariant(), @"\s+", "_");

    internal static bool ValidFavoriteTag(string? tag) => tag is { Length: > 0 and <= 100 } &&
        !tag.StartsWith('-') && !tag.Any(char.IsWhiteSpace) && !tag.Any(char.IsControl);

    private static List<string> FavoriteTags(IEnumerable<string>? tags, int limit = 256) => (tags ?? [])
        .Where(tag => tag is not null).Select(NormalizeFavoriteTag).Where(ValidFavoriteTag)
        .Distinct(StringComparer.Ordinal).Take(limit).ToList();

    private static string FavoriteMedia(string? value) => value is { Length: <= 2000 } &&
        Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https" &&
        uri.UserInfo.Length == 0 && CatalogService.IsAllowedSourceHost(uri.Host) ? value : "";

    private static FavoriteActivityRecord FavoriteRecord(FavoriteViewUpdate update, DateTimeOffset at)
    {
        var item = update.Item;
        if (item is null || !CatalogState.IsSupported(item.Source) || item.Id is not { Length: > 0 and <= 100 } ||
            item.Key != item.Source + ":" + item.Id || item.Key.Any(char.IsControl) ||
            (item.Tags?.Count ?? 0) > 1000 || (item.AllTags?.Count ?? 0) > 1000 ||
            (item.CharacterTags?.Count ?? 0) > 256 || (item.CopyrightTags?.Count ?? 0) > 256 ||
            (item.MemberKeys?.Count ?? 0) > 128) throw new ArgumentException("Invalid artwork view.");
        var characters = FavoriteTags(item.CharacterTags).Where(tag => tag != "original_character").ToList();
        var copyrights = FavoriteTags(item.CopyrightTags);
        var excluded = copyrights.Concat(characters).Append(NormalizeFavoriteTag(item.CreatorTag))
            .Concat((item.Participants ?? []).Select(person => NormalizeFavoriteTag(person?.Tag))).ToHashSet(StringComparer.Ordinal);
        var tags = FavoriteTags((item.Tags ?? []).Concat(item.AllTags ?? []));
        tags.RemoveAll(excluded.Contains);
        var node = JsonSerializer.SerializeToNode(new CatalogItem
        {
            Key = item.Key, MemberKeys = (item.MemberKeys ?? []).Where(key =>
                key is { Length: <= 200 } && CatalogState.IsSupported(key.Split(':')[0])).ToList(),
            ContentHash = item.ContentHash ?? "", ImageRecords = item.ImageRecords?.Take(32).ToList(), GroupKey = item.GroupKey ?? "",
            PixivGroupKey = item.PixivGroupKey ?? "", OriginalUrl = item.OriginalUrl ?? ""
        }, FavoriteJson)!.AsObject();
        var tokens = TransferWorkTokens(node).Where(token => !TransferWeakParent(token))
            .Distinct(StringComparer.Ordinal).Take(160).ToList();
        return new FavoriteActivityRecord
        {
            At = at, MetadataOnly = update.MetadataOnly, Tokens = tokens,
            Work = new FavoriteArtwork
            {
                Key = item.Key, Source = item.Source, Id = item.Id,
                FilteringComplete = update.FilteringComplete,
                UploaderId = item.UploaderId ?? "", UploaderName = item.UploaderName ?? "",
                ArtistId = item.ArtistId ?? "", Artist = item.Artist ?? "",
                AllTags = FavoriteTags(characters.Concat(copyrights).Concat(item.AllTags ?? []).Concat(item.Tags ?? []), 2048),
                GroupMembers = (item.GroupMembers ?? []).Take(32).Select(member => new CatalogItem {
                    Key = member.Key, Source = member.Source, Id = member.Id, CreatorTag = member.CreatorTag, CreatorName = member.CreatorName,
                    ArtistId = member.ArtistId, Artist = member.Artist, UploaderId = member.UploaderId, UploaderName = member.UploaderName,
                    Tags = FavoriteTags((member.Tags ?? []).Concat(member.AllTags ?? []).Concat(member.CharacterTags ?? []).Concat(member.CopyrightTags ?? [])),
                    Participants = member.Participants ?? [] }).ToList(),
                Title = (item.Title ?? "")[..Math.Min(item.Title?.Length ?? 0, 200)],
                Thumbnail = FavoriteMedia(item.Thumbnail), Rating = item.Rating ?? "",
                CreatorTag = NormalizeFavoriteTag(item.CreatorTag), CreatorName = (item.CreatorName ?? "")[..Math.Min(item.CreatorName?.Length ?? 0, 100)],
                Participants = (item.Participants ?? []).Where(person => person?.Tag is { Length: > 0 and <= 100 })
                    .Take(16).Select(person => new CatalogParticipant { Tag = NormalizeFavoriteTag(person.Tag),
                        Name = (person.Name ?? "")[..Math.Min(person.Name?.Length ?? 0, 100)], Role = person.Role }).ToList(),
                Images = (item.Images ?? []).Select(FavoriteMedia).Where(url => url.Length > 0).Take(1).ToList(),
                Tags = tags, CharacterTags = characters, CopyrightTags = copyrights
            }
        };
    }

    public void RecordFavoriteActivity(List<FavoriteViewUpdate> records, DateTimeOffset? now = null)
    {
        if (records is null || records.Count is < 1 or > 16) throw new ArgumentException("Invalid activity batch.");
        var at = now ?? DateTimeOffset.UtcNow;
        var prepared = records.Select(record => FavoriteRecord(record, record.ViewedAt is { } viewed &&
            viewed >= at.AddDays(-31) && viewed <= at.AddMinutes(1) ? viewed : at)).ToArray();
        var bytes = Encoding.UTF8.GetBytes(string.Join('\n', prepared.Select(record =>
            JsonSerializer.Serialize(record, FavoriteJson))) + "\n");
        if (bytes.Length > 160_000) throw new ArgumentException("Activity batch is too large.");
        lock (sync)
        {
            using var fileLock = AcquireFileLock(FavoriteActivityLock);
            Directory.CreateDirectory(FavoriteActivityDirectory);
            var path = Path.Combine(FavoriteActivityDirectory, at.UtcDateTime.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + ".jsonl");
            using (var stream = new FileStream(path, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.Read))
            {
                if (stream.Length + bytes.Length > FavoriteDailyLimit)
                    File.WriteAllText(path + ".limited", "");
                else
                {
                    // A crashed partial final line is retained for diagnosis; start the next
                    // complete record on a fresh line instead of losing all following opens.
                    if (stream.Length > 0)
                    {
                        stream.Seek(-1, SeekOrigin.End);
                        if (stream.ReadByte() != '\n') { stream.Seek(0, SeekOrigin.End); stream.WriteByte((byte)'\n'); }
                    }
                    stream.Seek(0, SeekOrigin.End); stream.Write(bytes); stream.Flush(true);
                }
            }
            foreach (var old in Directory.EnumerateFiles(FavoriteActivityDirectory))
            {
                var name = Path.GetFileName(old);
                if (!Regex.IsMatch(name, @"^\d{4}-\d{2}-\d{2}\.jsonl(?:\.limited)?$") ||
                    name.Length < 10 || !DateOnly.TryParseExact(name[..10], "yyyy-MM-dd", CultureInfo.InvariantCulture,
                        DateTimeStyles.None, out var day) || day >= DateOnly.FromDateTime(at.UtcDateTime).AddDays(-31)) continue;
                // Only this feature's strictly named daily files under its owned directory.
                try { File.Delete(old); } catch (IOException) { /* Retry retention on a later open. */ }
            }
            favoriteSummaryCache.Clear();
        }
    }

    private JsonObject ReadFavoriteKindDocument(bool writing = false)
    {
        foreach (var path in new[] { FavoriteKindsFile, FavoriteKindsFile + ".bak" })
        {
            if (!File.Exists(path)) continue;
            try { return JsonNode.Parse(File.ReadAllText(path)) as JsonObject ?? throw new JsonException(); }
            catch (JsonException) when (!writing) { /* Read a surviving backup without overwriting it. */ }
        }
        if (File.Exists(FavoriteKindsFile) || File.Exists(FavoriteKindsFile + ".bak"))
            throw new InvalidDataException("Favorite classifications cannot be read.");
        return new();
    }

    public List<string>? SetFavoriteEntity(string tag, string kind, bool favorite)
    {
        tag = NormalizeFavoriteTag(tag);
        if (!ValidFavoriteTag(tag) || kind is not ("character" or "tag")) throw new ArgumentException("Invalid favorite.");
        lock (sync)
        {
            // Never turn a damaged authoritative list into an empty replacement.
            using (var tagLock = AcquireFileLock(favoriteTagsLockFile))
                if (File.Exists(favoriteTagsFile))
                {
                    using var original = JsonDocument.Parse(File.ReadAllText(favoriteTagsFile));
                    if (original.RootElement.ValueKind != JsonValueKind.Array || original.RootElement.EnumerateArray().Any(value => value.ValueKind != JsonValueKind.String))
                        throw new InvalidDataException("Favorite tags cannot be read.");
                }
            var tags = GetFavoriteTags();
            if (favorite && tags.Count >= 100 && !tags.Contains(tag, StringComparer.OrdinalIgnoreCase)) return null;
            if (favorite)
            {
                using var activityLock = AcquireFileLock(FavoriteActivityLock);
                var document = ReadFavoriteKindDocument(true);
                document[tag] = kind;
                // Write classification first. A later failed/limited tag write can leave
                // harmless unused metadata, but never a confirmed favorite without its kind.
                WriteAtomic(FavoriteKindsFile, JsonSerializer.SerializeToUtf8Bytes(document, FavoriteJson));
                favoriteSummaryCache.Clear();
            }
            return SetFavoriteTag(tag, favorite);
        }
    }

    private static string FavoriteStamp(string path)
    {
        var file = new FileInfo(path);
        return file.Exists ? $"{file.Name}:{file.Length}:{file.LastWriteTimeUtc.Ticks}:{file.CreationTimeUtc.Ticks}" : "";
    }

    public FavoriteActivitySummary GetFavoriteActivity(string rating = "all", DateTimeOffset? now = null)
    {
        if (rating is not ("general" or "explicit" or "all")) throw new ArgumentException("Invalid rating.");
        var at = now ?? DateTimeOffset.UtcNow;
        var cutoff = at.AddDays(-30);
        lock (sync)
        {
            var manual = GetFavoriteTags().Select(NormalizeFavoriteTag).ToHashSet(StringComparer.Ordinal);
            using var fileLock = AcquireFileLock(FavoriteActivityLock);
            var files = Directory.Exists(FavoriteActivityDirectory) ? Directory.EnumerateFiles(FavoriteActivityDirectory, "*.jsonl")
                .Where(path => DateOnly.TryParseExact(Path.GetFileNameWithoutExtension(path), "yyyy-MM-dd", CultureInfo.InvariantCulture,
                    DateTimeStyles.None, out var day) && day >= DateOnly.FromDateTime(cutoff.UtcDateTime) &&
                    day <= DateOnly.FromDateTime(at.UtcDateTime)).OrderDescending().ToArray() : [];
            var stamp = string.Join('|', files.SelectMany(path => new[] { FavoriteStamp(path), FavoriteStamp(path + ".limited") })) +
                FavoriteStamp(FavoriteKindsFile) + FavoriteStamp(FavoriteKindsFile + ".bak") + string.Join('|', manual.Order());
            if (favoriteSummaryCache.TryGetValue(rating, out var cached) && cached.Stamp == stamp &&
                cached.At <= at && cached.At >= at.AddSeconds(-15)) return cached.Summary;
            var kinds = ReadFavoriteKindDocument().Where(pair => ValidFavoriteTag(pair.Key) && pair.Value is JsonValue value &&
                value.TryGetValue<string>(out var kind) && kind is "character" or "tag")
                .ToDictionary(pair => pair.Key, pair => pair.Value!.GetValue<string>(), StringComparer.Ordinal);
            var records = new List<FavoriteActivityRecord>();
            var incomplete = false;
            foreach (var path in files)
            {
                incomplete |= File.Exists(path + ".limited");
                foreach (var line in File.ReadLines(path))
                {
                    if (records.Count >= 50_000) { incomplete = true; break; }
                    if (string.IsNullOrWhiteSpace(line)) continue;
                    if (line.Length > 160_000) { incomplete = true; continue; }
                    try
                    {
                        var record = JsonSerializer.Deserialize<FavoriteActivityRecord>(line, FavoriteJson);
                        if (record is null || record.Work is null || record.Tokens is not { Count: > 0 and <= 160 } ||
                            record.Tokens.Any(token => token is null || token.Length > 1000) ||
                            record.Work.Thumbnail is null || record.Work.Tags is null || record.Work.CharacterTags is null ||
                            record.Work.Tags.Concat(record.Work.CharacterTags).Any(tag => !ValidFavoriteTag(tag)) ||
                            !CatalogState.IsSupported(record.Work.Source) || record.Work.Key != record.Work.Source + ":" + record.Work.Id)
                        { incomplete = true; continue; }
                        if (record.At >= cutoff && record.At <= at) records.Add(record);
                    }
                    catch (JsonException) { incomplete = true; }
                }
                if (records.Count >= 50_000) break;
            }
            var summary = BuildFavoriteSummary(records, rating, manual);
            summary.Kinds = kinds; summary.Incomplete = incomplete || records.Any(record => !record.Work.FilteringComplete);
            favoriteSummaryCache[rating] = (stamp, at, summary);
            return summary;
        }
    }

    private static FavoriteActivitySummary BuildFavoriteSummary(List<FavoriteActivityRecord> records, string rating, HashSet<string> manual)
    {
        var parents = Enumerable.Range(0, records.Count).ToArray();
        int Root(int index) { while (parents[index] != index) { parents[index] = parents[parents[index]]; index = parents[index]; } return index; }
        var lookup = new Dictionary<string, int>(StringComparer.Ordinal);
        for (var index = 0; index < records.Count; index++)
            foreach (var token in records[index].Tokens)
            {
                if (lookup.TryGetValue(token, out var previous)) parents[Root(index)] = Root(previous);
                else lookup[token] = index;
            }
        var groups = records.Select((record, index) => (record, index, root: Root(index)))
            .GroupBy(pair => pair.root).Select(group => group.OrderByDescending(pair => pair.record.At)
                .ThenByDescending(pair => pair.index).Select(pair => pair.record).ToArray())
            .Where(group => group.Any(record => !record.MetadataOnly)).ToArray();
        var characters = groups.SelectMany(group => group).SelectMany(record => record.Work.CharacterTags ?? []).ToHashSet(StringComparer.Ordinal);
        var names = groups.SelectMany(group => group).SelectMany(record => (record.Work.CopyrightTags ?? [])
            .Append(record.Work.CreatorTag).Concat((record.Work.Participants ?? []).Select(person => person.Tag)))
            .Where(ValidFavoriteTag).ToHashSet(StringComparer.Ordinal);
        var sequence = records.Select((record, index) => (record, index)).ToDictionary(pair => pair.record, pair => pair.index);
        var entries = new Dictionary<string, (FavoriteActivityEntry Entry, HashSet<DateOnly> Days, int Sequence)>(StringComparer.Ordinal);
        var covers = new Dictionary<string, FavoriteArtwork>(StringComparer.Ordinal);
        var summary = new FavoriteActivitySummary();
        foreach (var group in groups)
        {
            var adult = group.Any(record => !new[] { "g", "general", "s", "sensitive", "safe", "sfw" }.Contains(record.Work.Rating, StringComparer.OrdinalIgnoreCase));
            if (rating == "general" && adult || rating == "explicit" && !adult) continue;
            var opens = group.Where(record => !record.MetadataOnly).ToArray();
            var latest = opens.Max(record => record.At);
            var lastSequence = opens.Where(record => record.At == latest).Max(record => sequence[record]);
            var first = opens.Min(record => record.At);
            summary.TotalWorks++;
            if (summary.TrackedSince is null || first < summary.TrackedSince) summary.TrackedSince = first;
            var cover = group.FirstOrDefault(record => record.Work.Thumbnail.Length > 0)?.Work ?? group[0].Work;
            var days = opens.Select(record => DateOnly.FromDateTime(record.At.UtcDateTime)).ToHashSet();
            var entityTags = group.SelectMany(record => (record.Work.Tags ?? []).Concat(record.Work.CharacterTags ?? []))
                .Distinct(StringComparer.Ordinal).Where(tag => characters.Contains(tag) || !names.Contains(tag));
            foreach (var tag in entityTags)
            {
                if (!entries.TryGetValue(tag, out var current)) current = (new FavoriteActivityEntry { Tag = tag,
                    Kind = characters.Contains(tag) ? "character" : "tag" }, [], -1);
                current.Entry.Count++; current.Days.UnionWith(days);
                current.Entry.ActiveDays = current.Days.Count;
                if (latest > current.Entry.LastViewedAt || latest == current.Entry.LastViewedAt && lastSequence > current.Sequence)
                {
                    current.Sequence = lastSequence;
                    current.Entry.LastViewedAt = latest; current.Entry.LastWorkKey = cover.Key; covers[cover.Key] = cover;
                }
                entries[tag] = current;
            }
        }
        var sorted = entries.Values.Select(pair => pair.Entry).OrderByDescending(entry => entry.Count)
            .ThenByDescending(entry => entry.LastViewedAt).ThenBy(entry => entry.Tag, StringComparer.Ordinal).ToArray();
        summary.Entries = sorted.Take(1024).Concat(sorted.Skip(1024).Where(entry => manual.Contains(entry.Tag))).ToList();
        var needed = summary.Entries.Select(entry => entry.LastWorkKey).ToHashSet(StringComparer.Ordinal);
        summary.Works = covers.Where(pair => needed.Contains(pair.Key)).Select(pair => pair.Value).ToList();
        return summary;
    }
}
