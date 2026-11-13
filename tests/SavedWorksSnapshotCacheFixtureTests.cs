using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using ArtCatalog;

internal static class SavedWorksSnapshotCacheFixtureTests
{
    private static readonly Type Store = typeof(CatalogItem).Assembly.GetType("ArtCatalog.LocalStore")!;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private static object Open(string path) => Activator.CreateInstance(Store, [path])!;
    private static object? Call(object store, string method, params object?[] args) => Store.GetMethod(method)!.Invoke(store, args);
    private static SavedWorksSnapshot Read(object store, string collection = "likes") => (SavedWorksSnapshot)Call(store, "GetSavedWorksSnapshot", collection)!;
    private static SavedWorksJsonSnapshot Api(object store, string collection = "likes") => (SavedWorksJsonSnapshot)Call(store, "GetSavedWorksJsonSnapshot", collection)!;
    private static JsonArray Values(SavedWorksJsonSnapshot snapshot) => JsonNode.Parse(snapshot.Json.Span)!.AsArray();
    private static void Expect(bool value, string message) { if (!value) throw new Exception(message); }

    internal static void Run(string directory)
    {
        Directory.CreateDirectory(directory);
        var file = Path.Combine(directory, "saved-works-v1.json");
        var root = Work(11); root.Title = "Neutral scene";
        var child = Work(12); child.GroupMembers.Add(Work(13)); root.GroupMembers.Add(child);
        var raw = JsonSerializer.SerializeToNode(root, Json)!.AsObject();
        raw["privateProviderCache"] = new JsonObject { ["token"] = "PRIVATE_PROVIDER_SENTINEL" };
        raw["originalImageFileUrl"] = "PRIVATE_IGNORED_FIELD_SENTINEL";
        raw["groupMembers"]![0]!["privateMemberState"] = "PRIVATE_MEMBER_SENTINEL";
        raw["participants"]![0]!["privateConnection"] = "PRIVATE_PARTICIPANT_SENTINEL";
        File.WriteAllText(file, new JsonObject { ["schemaVersion"] = 1,
            ["likes"] = new JsonArray(raw), ["bookmarks"] = new JsonArray(raw.DeepClone()) }.ToJsonString(Json));
        var store = Open(directory);

        var api = Api(store); var original = api.Json.ToArray(); var durable = File.ReadAllBytes(file);
        var expected = JsonSerializer.SerializeToNode(Read(store).Items, Json);
        Expect(JsonNode.DeepEquals(expected, Values(api)), "Compact API snapshots must match the public typed CatalogItem representation");
        var wire = System.Text.Encoding.UTF8.GetString(original);
        Expect(!wire.Contains("PRIVATE_", StringComparison.Ordinal) && !wire.Contains("privateProviderCache", StringComparison.Ordinal),
            "Cached API output must not expose private unknown or JsonIgnore fields at any nesting level");

        var mutable = Read(store);
        Mutate(mutable.Items[0]); mutable.Items.Clear();
        Expect(JsonNode.DeepEquals(expected, JsonSerializer.SerializeToNode(Read(store).Items, Json)),
            "Mutating a public snapshot's nested collections/descriptors must not alter the next typed snapshot");
        Expect(original.AsSpan().SequenceEqual(Api(store).Json.Span), "Public snapshot mutations must not alter cached compact API bytes");
        Expect(durable.SequenceEqual(File.ReadAllBytes(file)), "Mutating a public snapshot must not reach the persisted library");
        Expect(JsonNode.DeepEquals(expected, Values(Api(store, "bookmarks"))), "Independent collections must not share mutable public metadata");

        var beforeLike = Api(store); var bookmarkBytes = Api(store, "bookmarks").Json.ToArray();
        var added = Work(21);
        var ack = (SavedWorkChange)Call(store, "ChangeSavedWork", "likes", added, false)!;
        var afterLike = Api(store);
        Expect(ack.Saved && afterLike.Revision == ack.Revision && afterLike.Revision != beforeLike.Revision &&
            Values(afterLike)[0]!["key"]!.GetValue<string>() == added.Key,
            "A membership write must invalidate cached API content and return its committed revision/order");
        Expect(original.AsSpan().SequenceEqual(beforeLike.Json.Span) && bookmarkBytes.AsSpan().SequenceEqual(Api(store, "bookmarks").Json.Span),
            "Previously returned API snapshots and an unrelated collection retain stable contents after membership changes");
        var noOp = (SavedWorkChange)Call(store, "ChangeSavedWork", "likes", added, true)!;
        Expect(noOp.Revision == afterLike.Revision && afterLike.Json.Span.SequenceEqual(Api(store).Json.Span),
            "An idempotent like must keep the content/revision pair coherent");

        var oldTyped = Read(store);
        var beforeMetadata = Api(store);
        var detail = new CatalogItem { Key = root.Key, Source = root.Source, Id = root.Id,
            CreatorTag = "new_artist", CreatorName = "New Artist" };
        Expect((bool)Call(store, "RefreshSavedMetadata", detail)!, "Real metadata must commit for cached saved works");
        var afterMetadata = Api(store);
        Expect(afterMetadata.Revision == beforeMetadata.Revision &&
            Values(afterMetadata).OfType<JsonObject>().Single(item => item["key"]!.GetValue<string>() == root.Key)["creatorTag"]!.GetValue<string>() == "new_artist",
            "Metadata-only changes must invalidate API bytes even while the membership revision stays unchanged");
        Expect(Read(store).Items.Single(item => item.Key == root.Key).CreatorTag == "new_artist" &&
            oldTyped.Items.Single(item => item.Key == root.Key).CreatorTag == root.CreatorTag,
            "Metadata publication must refresh future typed snapshots without mutating an earlier public snapshot");
        Expect(JsonNode.DeepEquals(Values(beforeMetadata), JsonSerializer.SerializeToNode(oldTyped.Items, Json)),
            "The old compact and typed snapshots must continue to describe the same earlier state");
        Expect(!((bool)Call(store, "RefreshSavedMetadata", detail)!) &&
            afterMetadata.Revision == Api(store).Revision && afterMetadata.Json.Span.SequenceEqual(Api(store).Json.Span),
            "An unchanged detail refresh must preserve coherent cached output");

        var stored = JsonNode.Parse(File.ReadAllText(file))!["likes"]!.AsArray().OfType<JsonObject>()
            .Single(item => item["key"]!.GetValue<string>() == root.Key);
        Expect(stored["privateProviderCache"]!["token"]!.GetValue<string>() == "PRIVATE_PROVIDER_SENTINEL" &&
            stored["groupMembers"]![0]!["privateMemberState"]!.GetValue<string>() == "PRIVATE_MEMBER_SENTINEL",
            "API allowlisting must never strip unknown persisted root/member data during writes");

        var second = Open(directory);
        Call(second, "ChangeSavedWork", "likes", Work(22), false);
        var external = Api(store);
        Expect(Values(external).Count == 3 && external.Revision != afterMetadata.Revision,
            "Another store's atomic membership replacement must invalidate the first store's response cache");
        var priorExternal = external.Json.ToArray();
        var originalRaw = File.ReadAllText(file);
        const string oldTitle = "\"Neutral scene\"", newTitle = "\"Changed scene\"";
        var titlePosition = originalRaw.IndexOf(oldTitle, StringComparison.Ordinal);
        Expect(titlePosition >= 0, "The replacement fixture must contain its exact original quoted title");
        // Preserve the store writer's raw-record whitespace. Reformatting the
        // whole document would turn this into a different-size replacement.
        var replacementBytes = System.Text.Encoding.UTF8.GetBytes(
            originalRaw[..titlePosition] + newTitle + originalRaw[(titlePosition + oldTitle.Length)..]);
        Expect(replacementBytes.Length == new FileInfo(file).Length, "The direct replacement fixture must keep the saved file size unchanged");
        var temporary = file + ".external"; File.WriteAllBytes(temporary, replacementBytes); File.Move(temporary, file, true);
        File.SetLastWriteTimeUtc(file, DateTime.UtcNow.AddSeconds(1));
        var sameSize = Api(store);
        Expect(Values(sameSize).OfType<JsonObject>().Single(item => item["key"]!.GetValue<string>() == root.Key)["title"]!.GetValue<string>() == "Changed scene" &&
            Read(store).Items.Single(item => item.Key == root.Key).Title == "Changed scene",
            "Same-size external edits must invalidate both typed records and compact response caches");
        Expect(priorExternal.AsSpan().SequenceEqual(external.Json.Span), "External replacement must not mutate earlier returned response memory");

        var committed = Api(store).Json.ToArray(); var revision = Api(store).Revision;
        using (var blocked = new FileStream(file + ".bak", FileMode.Open, FileAccess.Read, FileShare.None))
        {
            var rejected = false;
            try { Call(store, "RefreshSavedMetadata", new CatalogItem { Key = root.Key, Source = root.Source, Id = root.Id, CreatorTag = "uncommitted_artist" }); }
            catch (TargetInvocationException error) when (error.InnerException is IOException) { rejected = true; }
            Expect(rejected, "The failed-commit regression must block the metadata backup write");
        }
        Expect(committed.AsSpan().SequenceEqual(Api(store).Json.Span) && Api(store).Revision == revision &&
            Read(store).Items.Single(item => item.Key == root.Key).CreatorTag == "new_artist",
            "A failed metadata commit must not seed either typed or API caches with uncommitted values");
        RawSliceBoundaries(Path.Combine(directory, "raw-slice-boundaries"));
        NullableMetadata(Path.Combine(directory, "nullable-metadata"));
        CachedApiCost(Path.Combine(directory, "cached-api-cost"));
        Console.WriteLine("Saved-work nested snapshot isolation, API allowlist and membership/metadata/external cache invalidation: PASS");
    }

    private static void RawSliceBoundaries(string directory)
    {
        Directory.CreateDirectory(directory); var file = Path.Combine(directory, "saved-works-v1.json");
        const string raw = """
            {"rootBefore":{"likes":[{"fake":1}],"nested":[null,{"text":"雪 ä"}]},"schemaVersion":1,
             "li\u006Bes":[{"source":"danbooru","id":"81","key":"danbooru:81","title":"Сцена \u00E4 \uD83C\uDF32 漢字","rating":"g",
               "images":["https://cdn.donmai.us/81-a.jpg","https://cdn.donmai.us/81-b.jpg"],
               "imageRecords":[{"url":"https://cdn.donmai.us/81-a.jpg","owner":"danbooru:81","hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}],
               "futureMeta":{"multibyte":"雪 ä","delimiters":"} ], \"bookmarks\": ["}},
               {"source":"danbooru","id":"82","key":"danbooru:82","title":"Второй"}],
             "rootBetween":[{"bookmarks":{"nested":[1,2,3]}},"\u0061"],"book\u006Darks":[],
             "rootAfter":{"nested":[{"likes":[],"bookmarks":[]}],"text":"終わり"}}
            """;
        var initial = JsonNode.Parse(raw)!.AsObject();
        var original = initial["likes"]![0]!.DeepClone();
        initial["bookmarks"]!.AsArray().Add(original.DeepClone());
        // Keep escaped root names and literal multibyte UTF-8 in the actual source file.
        var source = raw.Replace("\"book\\u006Darks\":[]", "\"book\\u006Darks\":[" + original.ToJsonString() + "]", StringComparison.Ordinal);
        File.WriteAllText(file, source, new System.Text.UTF8Encoding(false));
        var store = Open(directory); var warmLikes = Api(store); var warmBookmarks = Api(store, "bookmarks");
        Expect(Values(warmLikes)[0]!["title"]!.GetValue<string>() == original["title"]!.GetValue<string>(),
            "Raw-slice offsets must count UTF-8 bytes rather than decoded Unicode characters");
        Call(store, "ChangeSavedWork", "likes", Work(84), false);
        Expect(warmBookmarks.Json.Span.SequenceEqual(Api(store, "bookmarks").Json.Span),
            "A membership write after raw-slice warming must keep the unrelated response intact");
        Call(store, "RefreshSavedMetadata", new CatalogItem { Source = "danbooru", Id = "81", Key = "danbooru:81", CreatorTag = "updated_raw_artist" });
        var durable = JsonNode.Parse(File.ReadAllBytes(file))!.AsObject();
        foreach (var name in new[] { "rootBefore", "rootBetween", "rootAfter" })
            Expect(JsonNode.DeepEquals(initial[name], durable[name]), "Skipping unknown nested root values must preserve " + name);
        Expect(durable["likes"]!.AsArray().Select(node => node!["key"]!.GetValue<string>()).SequenceEqual(new[] { "danbooru:84", "danbooru:81", "danbooru:82" }),
            "Raw-slice membership writes must retain source record order after the inserted work");
        foreach (var collection in new[] { "likes", "bookmarks" })
        {
            var record = durable[collection]!.AsArray().OfType<JsonObject>().Single(item => item["key"]!.GetValue<string>() == "danbooru:81");
            foreach (var field in new[] { "title", "images", "imageRecords", "futureMeta" })
                Expect(JsonNode.DeepEquals(original[field], record[field]), "Raw-slice metadata writes must retain multibyte/escaped media and unknown " + field);
            Expect(Values(Api(store, collection)).OfType<JsonObject>().Single(item => item["key"]!.GetValue<string>() == "danbooru:81")["creatorTag"]!.GetValue<string>() == "updated_raw_artist",
                "Metadata refresh must invalidate both warmed collection responses after a raw-slice membership write");
        }
    }

    private static void CachedApiCost(string directory)
    {
        Directory.CreateDirectory(directory);
        var file = Path.Combine(directory, "saved-works-v1.json");
        var tags = Enumerable.Range(0, 128).Select(index => "neutral_detail_feature_" + index).ToList();
        var records = Enumerable.Range(1000, 1000).Select(id => new CatalogItem
        {
            Key = "danbooru:" + id, Source = "danbooru", Id = id.ToString(),
            Title = "Neutral cached landscape " + id, Rating = "g", CreatorTag = "neutral_artist",
            Tags = tags.ToList(), CharacterTags = ["neutral_character"],
            Images = ["https://cdn.donmai.us/" + id + ".jpg"]
        }).ToList();
        File.WriteAllText(file, JsonSerializer.Serialize(new { schemaVersion = 1, likes = records, bookmarks = Array.Empty<CatalogItem>() }, Json));
        var store = Open(directory);
        var warm = Api(store); // Initial typed conversion/serialization is outside the warm-read budget.
        var expected = warm.Json.ToArray(); var stamp = File.GetLastWriteTimeUtc(file);
        byte[] DiskHash()
        {
            using var input = File.OpenRead(file);
            return System.Security.Cryptography.SHA256.HashData(input);
        }
        var durableHash = DiskHash();
        var allocated = GC.GetAllocatedBytesForCurrentThread();
        var last = warm;
        for (var pass = 0; pass < 100; pass++) last = Api(store);
        var cost = GC.GetAllocatedBytesForCurrentThread() - allocated;
        Expect(cost < 2_000_000, $"Warm compact API reads must reuse encoded library bytes rather than reserialize every record; allocated {cost} bytes");
        Expect(last.Revision == warm.Revision && expected.AsSpan().SequenceEqual(last.Json.Span),
            "Repeated cached API reads must retain the same committed content and revision");
        Expect(stamp == File.GetLastWriteTimeUtc(file) && durableHash.SequenceEqual(DiskHash()),
            "Warming or reading the compact API cache must not rewrite the durable library");
    }

    private static void NullableMetadata(string directory)
    {
        Directory.CreateDirectory(directory);
        var nullLists = Work(71);
        nullLists.MemberKeys = null!; nullLists.GroupMembers = null!; nullLists.Images = null!;
        nullLists.Tags = null!; nullLists.AllTags = null!; nullLists.CharacterTags = null!; nullLists.CopyrightTags = null!;
        nullLists.ImageRecords = null; nullLists.Participants = null!; nullLists.VisualSamples = null!; nullLists.VideoSamples = null!;
        var nullElements = Work(72);
        nullElements.GroupMembers = [null!]; nullElements.ImageRecords = [null!]; nullElements.Participants = [null!];
        nullElements.VisualSamples = [null!]; nullElements.VideoSamples = [null!];
        var nestedNulls = Work(73);
        nestedNulls.VisualSamples[0].Tags = null!; nestedNulls.VisualSamples[0].Characters = null!;
        nestedNulls.VideoSamples[0].Frames = [null!];
        var nullFrames = Work(74); nullFrames.VideoSamples[0].Frames = null!;
        var records = new List<CatalogItem> { nullLists, nullElements, nestedNulls, nullFrames };
        var payload = JsonSerializer.SerializeToNode(records, Json)!.AsArray();
        // The original uncached reader used this typed deserialization contract.
        var expected = JsonSerializer.SerializeToNode(payload.Deserialize<List<CatalogItem>>(Json), Json);
        var file = Path.Combine(directory, "saved-works-v1.json");
        File.WriteAllText(file, new JsonObject { ["schemaVersion"] = 1, ["likes"] = payload, ["bookmarks"] = new JsonArray() }.ToJsonString(Json));
        var original = File.ReadAllBytes(file); var store = Open(directory);
        for (var pass = 0; pass < 2; pass++)
        {
            var typed = Read(store);
            Expect(JsonNode.DeepEquals(expected, JsonSerializer.SerializeToNode(typed.Items, Json)) &&
                JsonNode.DeepEquals(expected, Values(Api(store))),
                "Cached snapshots must preserve null lists/elements and nested sample/frame nulls exactly like typed STJ reads");
            Expect(typed.Items[0].Tags is null && typed.Items[1].GroupMembers.Count == 1 && typed.Items[1].GroupMembers[0] is null &&
                typed.Items[2].VideoSamples[0].Frames.Count == 1 && typed.Items[2].VideoSamples[0].Frames[0] is null,
                "Nullable legacy records must not be rejected, silently removed or replaced with empty lists");
            typed.Items[1].GroupMembers.Clear(); typed.Items[2].VideoSamples[0].Frames.Clear();
        }
        Expect(original.SequenceEqual(File.ReadAllBytes(file)), "Reading nullable legacy metadata must not rewrite the saved file");
    }

    private static CatalogItem Work(int id) => new()
    {
        Key = "danbooru:" + id, Source = "danbooru", Id = id.ToString(), Title = "Work " + id,
        CreatorTag = "neutral_artist", CreatorName = "Neutral Artist", Rating = "g",
        MemberKeys = ["sankaku:mirror" + id], Tags = ["forest"], AllTags = ["forest", "landscape"],
        CharacterTags = ["neutral_character"], CopyrightTags = ["neutral_series"],
        Images = ["https://cdn.donmai.us/" + id + ".jpg"],
        ImageRecords = [new() { Url = "https://cdn.donmai.us/" + id + ".jpg", Hash = new string('a', 32), Owner = "danbooru:" + id }],
        Participants = [new() { Tag = "neutral_artist", Name = "Neutral Artist", Role = "artist" }],
        VisualSamples = [new() { Id = "sample" + id, Hash = "0000000000000001", Tags = ["forest"], Characters = ["neutral_character"] }],
        VideoSamples = [new() { Url = "https://cdn.donmai.us/" + id + ".mp4", Duration = 2,
            Frames = [new() { Hash = "0000000000000001", PerceptualHash = "0000000000000002" }] }]
    };

    private static void Mutate(CatalogItem item)
    {
        item.Title = "mutated";
        item.MemberKeys.Clear(); item.Images.Clear(); item.Tags.Clear(); item.AllTags.Clear();
        item.CharacterTags.Clear(); item.CopyrightTags.Clear();
        item.ImageRecords![0].Url = "mutated"; item.ImageRecords[0].Owner = "mutated";
        item.Participants[0].Tag = "mutated"; item.Participants[0].Name = "mutated"; item.Participants[0].Role = "mutated";
        item.VisualSamples[0].Hash = "mutated"; item.VisualSamples[0].Tags.Clear(); item.VisualSamples[0].Characters.Clear();
        item.VideoSamples[0].Url = "mutated"; item.VideoSamples[0].Frames[0].Hash = "mutated";
        item.VideoSamples[0].Frames.Clear();
        foreach (var member in item.GroupMembers) Mutate(member);
        item.GroupMembers.Clear(); item.ImageRecords.Clear(); item.Participants.Clear(); item.VisualSamples.Clear(); item.VideoSamples.Clear();
    }
}
