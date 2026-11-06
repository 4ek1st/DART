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
    public string ContentHash { get; set; } = "";
    public List<string> MemberKeys { get; set; } = [];
    public string OriginalUrl { get; set; } = "";
    public string GroupKey { get; set; } = "";
    public string PixivGroupKey { get; set; } = "";
    public string Published { get; set; } = "";
    public int Width { get; set; }
    public int Height { get; set; }
    public List<CatalogImageRecord> ImageRecords { get; set; } = [];
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
    private static readonly JsonSerializerOptions FavoriteJson = new(JsonSerializerDefaults.Web)
    { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
    private readonly object favoriteSummarySync = new();
    private long favoriteActivityRevision;
    private readonly Dictionary<string, (string Stamp, DateTimeOffset At, long Revision, FavoriteActivitySummary Summary)> favoriteSummaryCache = [];
    private sealed record FavoriteRecordsSnapshot(string Stamp, DateTimeOffset At, DateTimeOffset NextFutureAt,
        List<FavoriteActivityRecord> Records, bool Incomplete);
    private FavoriteRecordsSnapshot? favoriteRecordsCache;
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
                ContentHash = item.ContentHash ?? "", MemberKeys = (item.MemberKeys ?? []).Take(128).ToList(),
                OriginalUrl = (item.OriginalUrl ?? "")[..Math.Min(item.OriginalUrl?.Length ?? 0,2000)],
                GroupKey = item.GroupKey ?? "", PixivGroupKey = item.PixivGroupKey ?? "", Published = item.Published ?? "",
                Width = item.Width, Height = item.Height,
                ImageRecords = (item.ImageRecords ?? []).Take(100).Select(record=>new CatalogImageRecord {
                    Url = FavoriteMedia(record.Url), Hash = Regex.IsMatch(record.Hash ?? "", "^[a-fA-F0-9]{32}$") ? record.Hash! : "",
                    Owner = record.Owner is { Length: <= 200 } ? record.Owner : null }).ToList(),
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
                Images = (item.Images ?? []).Select(FavoriteMedia).Where(url => url.Length > 0).Distinct().Take(100).ToList(),
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
        if (bytes.Length > 512_000) throw new ArgumentException("Activity batch is too large.");
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
            Interlocked.Increment(ref favoriteActivityRevision);
            Volatile.Write(ref favoriteRecordsCache, null);
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
                Interlocked.Increment(ref favoriteActivityRevision);
            }
            return SetFavoriteTag(tag, favorite);
        }
    }

    private static string FavoriteStamp(string path)
    {
        var file = new FileInfo(path);
        return file.Exists ? $"{file.Name}:{file.Length}:{file.LastWriteTimeUtc.Ticks}:{file.CreationTimeUtc.Ticks}" : "";
    }

    private string[] FavoriteActivityFiles(DateTimeOffset cutoff, DateTimeOffset at) => Directory.Exists(FavoriteActivityDirectory)
        ? Directory.EnumerateFiles(FavoriteActivityDirectory, "*.jsonl")
            .Where(path => DateOnly.TryParseExact(Path.GetFileNameWithoutExtension(path), "yyyy-MM-dd", CultureInfo.InvariantCulture,
                DateTimeStyles.None, out var day) && day >= DateOnly.FromDateTime(cutoff.UtcDateTime) &&
                day <= DateOnly.FromDateTime(at.UtcDateTime)).OrderDescending().ToArray() : [];

    private static string FavoriteLogStamp(IEnumerable<string> files) =>
        string.Join('|', files.SelectMany(path => new[] { FavoriteStamp(path), FavoriteStamp(path + ".limited") }));

    private string FavoriteActivityStamp(IEnumerable<string> files, IEnumerable<string> manual) => FavoriteLogStamp(files) +
        FavoriteStamp(FavoriteKindsFile) + FavoriteStamp(FavoriteKindsFile + ".bak") + string.Join('|', manual.Order());

    // Capture the stable prefix while holding the activity lease, then release
    // it before decoding. Writers append only; a later append cannot change the
    // captured bytes or make this read include a half-written new record.
    private sealed class FavoriteLogPrefix(Stream source, long length) : Stream
    {
        private readonly long capturedLength = length;
        private long remaining = length;
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => capturedLength;
        public override long Position { get => capturedLength - remaining; set => throw new NotSupportedException(); }
        public override int Read(byte[] buffer, int offset, int count)
        {
            var read = source.Read(buffer, offset, (int)Math.Min(count, remaining));
            remaining -= read; return read;
        }
        public override void Flush() { }
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        protected override void Dispose(bool disposing) { if (disposing) source.Dispose(); base.Dispose(disposing); }
    }

    public FavoriteActivitySummary GetFavoriteActivity(string rating = "all", DateTimeOffset? now = null)
    {
        if (rating is not ("general" or "explicit" or "all" or "questionable" or "explicit-only" or "none")) throw new ArgumentException("Invalid rating.");
        var at = now ?? DateTimeOffset.UtcNow;
        var cutoff = at.AddDays(-30);
        lock (favoriteSummarySync)
        {
            var snapshots = new List<(Stream Stream, bool Limited)>();
            try
            {
                HashSet<string> manual;
                Dictionary<string, string> kinds;
                string stamp, logStamp;
                long revision;
                long snapshotBytes = 0;
                FavoriteRecordsSnapshot? reusedRecords;
                lock (sync)
                {
                    manual = GetFavoriteTags().Select(NormalizeFavoriteTag).ToHashSet(StringComparer.Ordinal);
                    using var fileLock = AcquireFileLock(FavoriteActivityLock);
                    var files = FavoriteActivityFiles(cutoff, at);
                    logStamp = FavoriteLogStamp(files);
                    stamp = FavoriteActivityStamp(files, manual);
                    revision = Volatile.Read(ref favoriteActivityRevision);
                    if (favoriteSummaryCache.TryGetValue(rating, out var cached) && cached.Stamp == stamp && cached.Revision == revision &&
                        cached.At <= at && cached.At >= at.AddSeconds(-15)) return cached.Summary;
                    kinds = ReadFavoriteKindDocument().Where(pair => ValidFavoriteTag(pair.Key) && pair.Value is JsonValue value &&
                        value.TryGetValue<string>(out var kind) && kind is "character" or "tag")
                        .ToDictionary(pair => pair.Key, pair => pair.Value!.GetValue<string>(), StringComparer.Ordinal);
                    reusedRecords = Volatile.Read(ref favoriteRecordsCache);
                    if (reusedRecords is not null && (reusedRecords.Stamp != logStamp || reusedRecords.At > at ||
                        reusedRecords.At < at.AddSeconds(-15) || reusedRecords.NextFutureAt <= at)) reusedRecords = null;
                    if (reusedRecords is null) Volatile.Write(ref favoriteRecordsCache, null);
                    foreach (var path in reusedRecords is null ? files : [])
                    {
                        var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete,
                            64 * 1024, FileOptions.SequentialScan);
                        snapshots.Add((new FavoriteLogPrefix(stream, stream.Length), File.Exists(path + ".limited")));
                        snapshotBytes += stream.Length;
                    }
                }
                var records = reusedRecords?.Records.Where(record => record.At >= cutoff && record.At <= at).ToList() ?? [];
                var incomplete = reusedRecords?.Incomplete ?? false;
                var nextFutureAt = DateTimeOffset.MaxValue;
                foreach (var snapshot in snapshots)
                {
                    incomplete |= snapshot.Limited;
                    using var reader = new StreamReader(snapshot.Stream, Encoding.UTF8, true, 64 * 1024, leaveOpen: true);
                    string? line;
                    while ((line = reader.ReadLine()) is not null)
                    {
                        if (records.Count >= 50_000) { incomplete = true; break; }
                        if (string.IsNullOrWhiteSpace(line)) continue;
                        if (line.Length > 512_000) { incomplete = true; continue; }
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
                            else if (record.At > at && record.At < nextFutureAt) nextFutureAt = record.At;
                        }
                        catch (JsonException) { incomplete = true; }
                    }
                    if (records.Count >= 50_000) break;
                }
                var summary = BuildFavoriteSummary(records, rating, manual);
                summary.Kinds = kinds; summary.Incomplete = incomplete || records.Any(record => !record.Work.FilteringComplete);
                lock (sync)
                {
                    using var fileLock = AcquireFileLock(FavoriteActivityLock);
                    var latestManual = GetFavoriteTags().Select(NormalizeFavoriteTag).ToHashSet(StringComparer.Ordinal);
                    if (Volatile.Read(ref favoriteActivityRevision) == revision &&
                        FavoriteActivityStamp(FavoriteActivityFiles(cutoff, at), latestManual) == stamp)
                    {
                        favoriteSummaryCache[rating] = (stamp, at, revision, summary);
                        // Ratings share one immutable parsed input, not repeated
                        // decoding of the same logs. Keep memory and time bounded;
                        // a future event becoming eligible must force a fresh read.
                        if (reusedRecords is null && snapshotBytes <= 32 * 1024 * 1024 && records.Count < 50_000)
                            Volatile.Write(ref favoriteRecordsCache, new(logStamp, at, nextFutureAt, records, incomplete));
                    }
                }
                return summary;
            }
            finally { foreach (var snapshot in snapshots) snapshot.Stream.Dispose(); }
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
            var explicitRating = group.Any(record => !new[] { "g", "general", "s", "sensitive", "safe", "sfw", "q", "questionable" }.Contains(record.Work.Rating, StringComparer.OrdinalIgnoreCase));
            if (rating == "none" || rating == "general" && adult || rating == "explicit" && !adult ||
                rating == "questionable" && (!adult || explicitRating) || rating == "explicit-only" && !explicitRating) continue;
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
