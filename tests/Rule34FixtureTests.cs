using System.Reflection;
using System.Text.Json;
using ArtCatalog;

static CatalogItem? Map(string method, string payload)
{
    using var json = JsonDocument.Parse(payload);
    var service = typeof(CatalogItem).Assembly.GetType("ArtCatalog.CatalogService")!;
    var mapper = service.GetMethod(method, BindingFlags.NonPublic | BindingFlags.Static)
        ?? throw new Exception($"Mapper {method} is missing.");
    return (CatalogItem?)mapper.Invoke(null, [json.RootElement]);
}

static void Expect(bool condition, string message)
{
    if (!condition) throw new Exception(message);
}

var profileResolver = typeof(CatalogItem).Assembly.GetType("ArtCatalog.LocalStore")!
    .GetMethod("ResolveDefaultDirectory", BindingFlags.NonPublic | BindingFlags.Static)
    ?? throw new Exception("The installed EXE must support a stable shared profile path");
var profileFixture = Path.Combine(Path.GetTempPath(), "ArtCatalog-profile-" + Guid.NewGuid());
Directory.CreateDirectory(profileFixture);
try
{
    var applicationRoot = Path.Combine(profileFixture, "application");
    var sharedProfile = Path.Combine(profileFixture, "personal-profile");
    var legacyRoot = Path.Combine(profileFixture, "redirected-appdata");
    Directory.CreateDirectory(applicationRoot);
    Directory.CreateDirectory(sharedProfile);
    string ResolveProfile() => (string)profileResolver.Invoke(null, [applicationRoot, legacyRoot])!;
    Expect(ResolveProfile() == Path.Combine(legacyRoot, "ArtCatalog"),
        "Existing installations must keep their profile when no shared path is configured");
    var profileConfig = Path.Combine(applicationRoot, "profile-path.txt");
    File.WriteAllText(profileConfig, sharedProfile + Environment.NewLine);
    Expect(ResolveProfile() == sharedProfile,
        "The configured personal profile must win over launcher-dependent AppData");
    File.WriteAllText(profileConfig, "relative-profile");
    try { ResolveProfile(); throw new Exception("A relative profile path was accepted"); }
    catch (TargetInvocationException error) when (error.InnerException is InvalidOperationException) { }
    File.WriteAllText(profileConfig, Path.Combine(profileFixture, "missing-profile"));
    try { ResolveProfile(); throw new Exception("A missing personal profile silently became empty"); }
    catch (TargetInvocationException error) when (error.InnerException is DirectoryNotFoundException) { }
}
finally
{
    // Only this unique fixture owns the directories being removed.
    foreach (var file in Directory.GetFiles(profileFixture, "*", SearchOption.AllDirectories)) File.Delete(file);
    foreach (var directory in Directory.GetDirectories(profileFixture).Reverse()) Directory.Delete(directory);
    Directory.Delete(profileFixture);
}

var pageParser = typeof(CatalogItem).Assembly.GetType("ArtCatalog.CatalogService")!.GetMethod("ParseSourcePages",
    BindingFlags.NonPublic | BindingFlags.Static)!;
var deepPages = (Dictionary<string, int>)pageParser.Invoke(null,
    ["danbooru:101,gelbooru:240,rule34:500,retired:-1"])!;
Expect(deepPages.GetValueOrDefault("danbooru") == 101 &&
    deepPages.GetValueOrDefault("gelbooru") == 240 &&
    deepPages.GetValueOrDefault("rule34") == 500 && !deepPages.ContainsKey("retired"),
    "Search must continue after page 100 while rejecting negative offsets");

var rule34 = Map("MapRule34", """
    {"id":123,"preview_url":"https://us-cdn.rule34.xxx/preview/a.jpg",
     "sample_url":"https://us-cdn.rule34.xxx/samples/a.jpg",
     "file_url":"https://us-cdn.rule34.xxx/images/a.png",
     "md5":"1234567890abcdef1234567890abcdef", "tags":"latex 1girl",
     "source":"https://www.pixiv.net/en/artworks/777", "owner":"uploader",
     "rating":"explicit","score":87,"created_at":"2026-01-01T00:00:00Z"}
    """) ?? throw new Exception("Rule34 image was discarded");
Expect(rule34.Key == "rule34:123" && rule34.Source == "rule34", "Rule34 identity is wrong");
Expect(rule34.GroupKey == "pixiv:777", "Pixiv artwork identity was lost");
Expect(rule34.ContentHash == "1234567890abcdef1234567890abcdef", "MD5 was lost");
Expect(rule34.Rating == "e", "Explicit rating was not normalized");
Expect(rule34.Images.Single() == "https://us-cdn.rule34.xxx/samples/a.jpg",
    "Rule34 image URL was not mapped");
Expect(rule34.ArtistId == "uploader", "Uploader profile cannot be opened");
Expect(rule34.PopularityCount == 87, "Rule34 votes were lost");
Expect(rule34.OriginalImageFileUrl == "https://us-cdn.rule34.xxx/images/a.png",
    "Rule34 original file URL is needed to verify exact cross-source image copies");

var general = Map("MapRule34", """
    {"id":124,"preview_url":"https://us-cdn.rule34.xxx/preview/b.jpg",
     "file_url":"https://us-cdn.rule34.xxx/images/b.png", "rating":"safe"}
    """);
Expect(general?.Rating == "g", "Safe rating was not mapped to ordinary art");

var video = Map("MapRule34", """
    {"id":125,"preview_url":"https://us-cdn.rule34.xxx/preview/c.jpg",
     "file_url":"https://us-cdn.rule34.xxx/images/c.mp4", "rating":"e"}
    """);
Expect(video?.Images.Single() == "https://us-cdn.rule34.xxx/images/c.mp4",
    "Rule34 video should open in the media viewer");
var videoWithSample = Map("MapRule34", """
    {"id":127,"preview_url":"https://us-cdn.rule34.xxx/preview/c.jpg",
     "sample_url":"https://us-cdn.rule34.xxx/samples/c.jpg",
     "file_url":"https://us-cdn.rule34.xxx/images/c.webm", "rating":"e"}
    """);
Expect(videoWithSample?.Images.Single().EndsWith(".webm") == true,
    "Rule34 preview image must not replace the playable video");
foreach (var method in new[] { "MapDanbooru", "MapGelbooru" })
{
    var mappedVideo = Map(method, """
        {"id":128,"preview_file_url":"https://cdn.donmai.us/preview/c.jpg",
         "preview_url":"https://gelbooru.com/preview/c.jpg",
         "large_file_url":"https://cdn.donmai.us/sample/c.jpg",
         "sample_url":"https://gelbooru.com/sample/c.jpg",
         "file_url":"https://cdn.donmai.us/original/c.mp4", "rating":"g"}
        """);
    Expect(mappedVideo?.Images.Single().EndsWith(".mp4") == true,
        $"{method} should preserve the original video instead of its still sample");
}
var noPosterVideo = Map("MapRule34", """
    {"id":129,"file_url":"https://us-cdn.rule34.xxx/images/c.mp4", "rating":"g"}
    """);
Expect(noPosterVideo is not null && noPosterVideo.Thumbnail.Length == 0 &&
    (bool)typeof(CatalogItem).Assembly.GetType("ArtCatalog.CatalogService")!
        .GetMethod("IsValidItem", BindingFlags.Public | BindingFlags.Static)!
        .Invoke(null, [noPosterVideo])!, "A video without a poster should still be usable");

var stateType = typeof(CatalogItem).Assembly.GetType("ArtCatalog.CatalogState")!;
var cleanState = stateType.GetMethod("CleanClientState", BindingFlags.NonPublic | BindingFlags.Static)!;
using (var state = JsonDocument.Parse((string)cleanState.Invoke(null, ["""
    {"searchHistory":["latex"],"recent":[{"source":"retired"},{"source":"danbooru","key":"danbooru:1"}],
      "session":{"activeIndex":3,"tabPreferences":{"artworkTabs":"new"},"tabs":[
        {"kind":"home","selectedSources":["danbooru","retired","rule34"]},
        {"kind":"detail","item":{"source":"retired","key":"retired:1"}},
        {"kind":"profile","profileRef":{"source":"retired","artist":"123"}},
        {"kind":"detail","item":{"source":"gelbooru","key":"gelbooru:2"},"scrollTop":456,"pinned":true}]}}
    """])!))
{
    var session = state.RootElement.GetProperty("session");
    Expect(session.GetProperty("tabs").GetArrayLength() == 2 &&
        session.GetProperty("activeIndex").GetInt32() == 1 &&
        session.GetProperty("tabs")[1].GetProperty("scrollTop").GetInt32() == 456 &&
        session.GetProperty("tabs")[1].GetProperty("pinned").GetBoolean() &&
        state.RootElement.GetProperty("recent").GetArrayLength() == 1 &&
        session.GetProperty("tabs")[0].GetProperty("selectedSources").GetArrayLength() == 2,
        "Session cleanup must remove unsupported catalogs while preserving the active tab and scroll");
}
foreach (var source in new[] { "danbooru", "gelbooru", "rule34" })
    Expect((bool)CallCatalog("IsValidFollow", new FollowRequest {
        Source = source, ArtistId = "artist", Name = "Artist" })!, "Supported follow was rejected");
Expect(!(bool)CallCatalog("IsValidFollow", new FollowRequest {
    Source = "retired", ArtistId = "artist", Name = "Artist" })!, "Unsupported follow was accepted");
Expect(!(bool)CallCatalog("IsAllowedSourceHost", "retired.example")!, "Unsupported media host was accepted");

var gelbooru = Map("MapGelbooru", """
    {"id":55,"preview_url":"https://gelbooru.com/preview/a.jpg",
     "file_url":"https://gelbooru.com/images/a.jpg", "md5":"1234567890abcdef1234567890abcdef",
     "source":"https://www.pixiv.net/artworks/777", "rating":"explicit", "score":43,
     "created_at":"Thu Sep 24 16:15:36 -0500 2026"}
    """);
Expect(gelbooru?.GroupKey == "pixiv:777", "Gelbooru copy did not join the Pixiv artwork");
Expect(gelbooru!.PopularityCount == 43, "Gelbooru votes were lost");
Expect(gelbooru.Published.StartsWith("2026-09-24", StringComparison.Ordinal),
    "Gelbooru publication date was lost");
var gelbooruPixivImage = Map("MapGelbooru", """
    {"id":14964513,"preview_url":"https://gelbooru.com/preview/b.jpg",
     "file_url":"https://gelbooru.com/images/b.jpg",
     "source":"https://i.pximg.net/img-original/img/2025/12/16/23/22/09/138685648-e538f050d756c05258ba31c9b063975b_p1.jpg"}
    """);
Expect(gelbooruPixivImage?.GroupKey == "pixiv:138685648",
    "Gelbooru Pixiv CDN pages did not inherit their artwork identity");
var gelbooruChild = Map("MapGelbooru", """
    {"id":56,"parent_id":55,"preview_url":"https://gelbooru.com/preview/c.jpg",
     "file_url":"https://gelbooru.com/images/c.jpg",
     "source":"https://www.pixiv.net/artworks/777"}
    """);
Expect(gelbooruChild?.GroupKey == "gelbooru:parent:55" &&
    gelbooruChild.PixivGroupKey == "pixiv:777",
    "Gelbooru child should join its parent without losing its Pixiv identity");
var rule34Child = Map("MapRule34", """
    {"id":126,"parent_id":123,"preview_url":"https://us-cdn.rule34.xxx/preview/d.jpg",
     "file_url":"https://us-cdn.rule34.xxx/images/d.png"}
    """);
Expect(rule34Child?.GroupKey == "rule34:parent:123",
    "Rule34 child should join its parent when the API provides that link");

var danbooru = Map("MapDanbooru", """
    {"id":100,"parent_id":99,"pixiv_id":777,
     "preview_file_url":"https://cdn.donmai.us/preview/a.jpg",
     "large_file_url":"https://cdn.donmai.us/sample/a.jpg",
     "md5":"1234567890abcdef1234567890abcdef", "rating":"e", "score":25}
    """);
Expect(danbooru?.GroupKey == "danbooru:parent:99" &&
    danbooru.PixivGroupKey == "pixiv:777",
    "Danbooru parent grouping lost the cross-source Pixiv identity");
Expect(danbooru!.PopularityCount == 25, "Danbooru votes were lost");
var danbooruPixivImage = Map("MapDanbooru", """
    {"id":122,"parent_id":99,"preview_file_url":"https://cdn.donmai.us/preview/c.jpg",
     "large_file_url":"https://cdn.donmai.us/sample/c.jpg",
     "source":"https://i.pximg.net/img-original/img/2025/12/16/23/22/09/138685648_p0.png"}
    """);
Expect(danbooruPixivImage?.GroupKey == "danbooru:parent:99" &&
    danbooruPixivImage.PixivGroupKey == "pixiv:138685648",
    "Danbooru parent lost its secondary Pixiv CDN identity");
var characterPost = Map("MapDanbooru", """
    {"id":101,"preview_file_url":"https://cdn.donmai.us/preview/b.jpg",
     "large_file_url":"https://cdn.donmai.us/sample/b.jpg",
     "tag_string":"1girl eris_greyrat original",
     "tag_string_character":"eris_greyrat"}
    """);
Expect(characterPost?.CharacterTags.SequenceEqual(["eris_greyrat"]) == true,
    "Danbooru character category was lost");

var collaborativePost = Map("MapDanbooru", """
    {"id":12069561,"preview_file_url":"https://cdn.donmai.us/preview/c.jpg",
     "large_file_url":"https://cdn.donmai.us/sample/c.jpg",
     "tag_string":"lilith_(voice_actor) the_atko",
     "tag_string_artist":"lilith_(voice_actor) the_atko"}
    """);
Expect(collaborativePost?.CreatorTag == "the_atko" && collaborativePost.ArtistId == "the_atko",
    "A voice actor must not replace the illustrator when artist tags arrive alphabetically");
Expect(collaborativePost!.Participants.Count == 2 &&
    collaborativePost.Participants[0].Tag == "the_atko" &&
    collaborativePost.Participants[1].Role == "voice_actor",
    "Every confirmed collaborator must retain a separate profile and role");
var voiceOnlyPost = Map("MapDanbooru", """
    {"id":120,"preview_file_url":"https://cdn.donmai.us/preview/c.jpg",
     "tag_string_artist":"person_(voice_actor)"}
    """)!;
Expect(voiceOnlyPost.CreatorTag == "" && voiceOnlyPost.ArtistId == "" &&
    voiceOnlyPost.Participants.Single().Role == "voice_actor",
    "A voice-only credit must remain usable without inventing an illustrator");

var catalogType = typeof(CatalogItem).Assembly.GetType("ArtCatalog.CatalogService")!;
static object? CallCatalog(string name, params object[] args)
{
    var type = typeof(CatalogItem).Assembly.GetType("ArtCatalog.CatalogService")!;
    var method = type.GetMethod(name, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static)
        ?? throw new Exception($"Search helper {name} is missing.");
    return method.Invoke(null, args);
}

foreach (var source in new[] { "danbooru", "gelbooru", "rule34" })
{
    var credited = new CatalogItem { Source = source, ArtistId = "uploader", Artist = "Uploader" };
    var credits = typeof(CatalogItem).Assembly.GetType("ArtCatalog.CatalogCredits")!;
    credits.GetMethod("Apply")!.Invoke(null, [credited,
        new[] { "lilith_(voice_actor)", "the_atko", "helper_(sound_editor)" }]);
    Expect(credited.CreatorTag == "the_atko" && credited.Participants.Count == 3 &&
        credited.Participants.Any(person => person.Role == "voice_actor") &&
        credited.Participants.Any(person => person.Role == "sound"),
        $"All participants must survive native attribution for {source}");
    if (source != "danbooru") Expect(credited.ArtistId == "uploader", "Uploader identity must remain separate");
}
var artistHtml = """
    <li class="tag-type-artist"><a href="index.php?page=post&amp;tags=lilith_%28voice_actor%29">Voice</a></li>
    <li class="tag-type-artist"><a href="index.php?page=post&amp;tags=the_atko">Artist</a></li>
    <li class="tag-type-general"><a href="index.php?page=post&amp;tags=reposter">Uploader</a></li>
    <li class="tag-type-artist"><a href="index.php?page=post&amp;tags=unrelated">Other post</a></li>
    """;
var nativeArtists = (List<string>)CallCatalog("ExtractRule34Tags", artistHtml,
    new List<string> { "lilith_(voice_actor)", "the_atko", "reposter" }, "artist")!;
Expect(nativeArtists.SequenceEqual(["lilith_(voice_actor)", "the_atko"]),
    "Native Rule34 category extraction must retain all artists and reject other tags/posts");

foreach (var emptyPayload in new[] { "", " \r\n\t", "[]" })
{
    using var emptyPosts = (JsonDocument)CallCatalog("ParseRule34PostsJson", emptyPayload)!;
    Expect(emptyPosts.RootElement.ValueKind == JsonValueKind.Array &&
        emptyPosts.RootElement.GetArrayLength() == 0,
        "A successful empty Rule34 response is an empty result, not a source outage");
}
using (var actualPosts = (JsonDocument)CallCatalog("ParseRule34PostsJson", "[{\"id\":1}]")!)
    Expect(actualPosts.RootElement.GetArrayLength() == 1, "Rule34 results must remain intact");
foreach (var malformedPayload in new[] { "<html>rate limited</html>", "[{\"id\":" })
{
    try
    {
        using var _ = (JsonDocument)CallCatalog("ParseRule34PostsJson", malformedPayload)!;
        throw new Exception("Malformed Rule34 responses must not be silently treated as empty results");
    }
    catch (TargetInvocationException ex) when (ex.InnerException is JsonException) { }
}

Expect((string?)CallCatalog("OriginalPostIdentity",
    "https://x.com/fuji_ysd/status/2101930207880134692?t=1") ==
    "x-status:2101930207880134692" &&
    (string?)CallCatalog("OriginalPostIdentity",
    "https://mobile.twitter.com/other/status/2101930207880134692") ==
    "x-status:2101930207880134692",
    "X and Twitter aliases of one post must share a publication identity");
Expect((string?)CallCatalog("OriginalPostIdentity",
    "https://x.com/fuji_ysd") == "" &&
    (string?)CallCatalog("OriginalPostIdentity",
    "https://notx.com/fuji_ysd/status/2101930207880134692") == "",
    "Artist profiles and unrelated hosts must not join different works");

using var characterMetadata = JsonDocument.Parse("""
    {"tag":[{"name":"eris_greyrat","type":4},
             {"name":"original","type":3},
             {"name":"unrelated_character","type":4}]}
    """);
var gelCharacters = (List<string>)CallCatalog("ExtractGelbooruCharacterTags",
    characterMetadata.RootElement, new List<string> { "eris_greyrat", "original" })!;
Expect(gelCharacters.SequenceEqual(["eris_greyrat"]),
    "Gelbooru metadata must mark only actual character tags in the post");
var ruleHtml = """
    <li class="tag-type-character tag"><a href="index.php?page=post&amp;s=list&amp;tags=neferpitou">Neferpitou</a></li>
    <li class="tag-type-character tag"><a href="index.php?page=post&amp;s=list&amp;tags=unrelated">Unrelated</a></li>
    """;
var ruleCharacters = (List<string>)CallCatalog("ExtractRule34CharacterTags", ruleHtml,
    new List<string> { "neferpitou", "original" })!;
Expect(ruleCharacters.SequenceEqual(["neferpitou"]),
    "Rule34 HTML categories must mark only actual character tags in the post");

var aishaHtml = """
    <li><h6>Character</h6></li><li class="tag-type-character tag">
    <a href="index.php?page=wiki&s=list&search=aisha_belka">?</a>
    <a href="index.php?page=post&amp;s=list&amp;tags=aisha_belka">aisha belka</a></li>
    <li class="tag-type-character tag">
    <a href="index.php?page=post&amp;s=list&amp;tags=original_character">original character</a></li>
    """;
var aishaPost = new CatalogItem { Key = "rule34:18006569", Source = "rule34",
    Id = "18006569", Title = "Работа #18006569", Tags = ["aisha_belka", "original_character"] };
CallCatalog("ApplyCharacterTags", aishaPost, CallCatalog("ExtractRule34CharacterTags",
    aishaHtml, aishaPost.Tags)!);
Expect(aishaPost.Title == "aisha belka" && aishaPost.CharacterTags.SequenceEqual(["aisha_belka"]) &&
    aishaPost.RelatedQuery == "aisha_belka",
    "Rule34 18006569 must be named after Aisha rather than the generic original_character category");

var namedRule34 = new CatalogItem { Key = "rule34:18783728", Source = "rule34",
    Id = "18783728", Title = "Работа #18783728",
    Tags = ["cecilia_immergreen", "gigi_murin", "mori_calliope", "aestheticc-meme"] };
CallCatalog("ApplyCharacterTags", namedRule34, new List<string> {
    "cecilia_immergreen", "gigi_murin", "mori_calliope", "not_in_post" });
Expect(namedRule34.Title == "cecilia immergreen, gigi murin, mori calliope" &&
    namedRule34.CharacterTags.Count == 3,
    "Confirmed character categories must replace the fallback Rule34 title");

var metadataDirectory = Path.Combine(Path.GetTempPath(), "ArtCatalog-metadata-" + Guid.NewGuid());
Directory.CreateDirectory(metadataDirectory);
try
{
    var metadataFile = Path.Combine(metadataDirectory, "bookmarks-v4.json");
    File.WriteAllText(metadataFile, """
        [{"key":"rule34:18783728","source":"rule34","id":"18783728",
          "title":"Работа #18783728","characterTags":[],"images":["one.jpg","two.jpg"],
          "futureField":{"keep":true}},
         {"key":"danbooru:2","source":"danbooru","id":"2","title":"Unrelated"}]
        """);
    var storeType = typeof(CatalogItem).Assembly.GetType("ArtCatalog.LocalStore")!;
    var metadataStore = Activator.CreateInstance(storeType, [metadataDirectory])!;
    var refresh = storeType.GetMethod("RefreshBookmarkMetadata");
    Expect(refresh is not null, "Saved work metadata must be refreshable without toggling the bookmark");
    refresh!.Invoke(metadataStore, [namedRule34]);
    var persisted = File.ReadAllText(metadataFile);
    using var updated = JsonDocument.Parse(persisted);
    var firstSaved = updated.RootElement[0];
    Expect(updated.RootElement.GetArrayLength() == 2 &&
        firstSaved.GetProperty("title").GetString() == namedRule34.Title &&
        firstSaved.GetProperty("characterTags").GetArrayLength() == 3 &&
        firstSaved.GetProperty("images").GetArrayLength() == 2 &&
        firstSaved.GetProperty("futureField").GetProperty("keep").GetBoolean() &&
        updated.RootElement[1].GetProperty("title").GetString() == "Unrelated",
        "Refreshing metadata must preserve grouped pages, unknown fields, order, and other bookmarks");
    refresh.Invoke(metadataStore, [new CatalogItem { Key = namedRule34.Key,
        Source = namedRule34.Source, Id = namedRule34.Id, Title = "Работа #18783728" }]);
    Expect(File.ReadAllText(metadataFile) == persisted,
        "Missing metadata must not erase known names or rewrite bookmarks");
    refresh.Invoke(metadataStore, [new CatalogItem { Key = "rule34:unknown", Source = "rule34",
        Id = "unknown", Title = "Unknown", CharacterTags = ["unknown"] }]);
    Expect(File.ReadAllText(metadataFile) == persisted,
        "Refreshing metadata must never add a new bookmark");
    File.WriteAllText(metadataFile, """
        [{"key":"danbooru:12069561","source":"danbooru","id":"12069561",
          "creatorTag":"lilith_(voice_actor)","creatorName":"lilith (voice actor)",
          "artistId":"lilith_(voice_actor)","artist":"lilith (voice actor)",
          "images":["one.jpg","two.jpg"],"futureField":42},
         {"key":"danbooru:2","source":"danbooru","id":"2","title":"Unrelated"}]
        """);
    refresh.Invoke(metadataStore, [collaborativePost]);
    using (var credited = JsonDocument.Parse(File.ReadAllText(metadataFile)))
    {
        var savedCredits = credited.RootElement[0];
        Expect(savedCredits.GetProperty("creatorTag").GetString() == "the_atko" &&
            savedCredits.GetProperty("artistId").GetString() == "the_atko" &&
            savedCredits.GetProperty("participants").GetArrayLength() == 2 &&
            savedCredits.GetProperty("images").GetArrayLength() == 2 &&
            savedCredits.GetProperty("futureField").GetInt32() == 42 &&
            credited.RootElement[1].GetProperty("title").GetString() == "Unrelated",
            "Credit repair must preserve grouped media, unknown fields, order, and unrelated saves");
    }
    File.WriteAllText(metadataFile, """
        [{"key":"rule34:18006569","source":"rule34","id":"18006569",
          "title":"aisha belka, original character",
          "characterTags":["aisha_belka","original_character"],"images":["one.jpg","two.jpg"]}]
        """);
    refresh.Invoke(metadataStore, [aishaPost]);
    using var cleaned = JsonDocument.Parse(File.ReadAllText(metadataFile));
    Expect(cleaned.RootElement[0].GetProperty("title").GetString() == "aisha belka" &&
        cleaned.RootElement[0].GetProperty("characterTags").GetArrayLength() == 1 &&
        cleaned.RootElement[0].GetProperty("images").GetArrayLength() == 2,
        "Refreshing a saved Rule34 post must repair old generic character metadata without losing pages");
    var groupedBookmark = JsonSerializer.Deserialize<CatalogItem>("""
        {"key":"rule34:18529241","source":"rule34","id":"18529241",
         "memberKeys":["rule34:18529241","sankaku:AbC123","gelbooru:123"]}
        """, new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
    var toggleBookmark = storeType.GetMethod("ToggleBookmark")!;
    Expect((bool)toggleBookmark.Invoke(metadataStore, [groupedBookmark])!, "Grouped bookmark must be saved");
    var reopened = (List<CatalogItem>)storeType.GetMethod("GetBookmarks")!.Invoke(metadataStore, null)!;
    var savedGroup = reopened.First(item => item.Key == groupedBookmark.Key);
    Expect(savedGroup.MemberKeys.SequenceEqual(["rule34:18529241", "sankaku:AbC123", "gelbooru:123"]),
        "Reading bookmarks after restart must retain every confirmed source, including Sankaku");
    refresh.Invoke(metadataStore, [new CatalogItem { Key = groupedBookmark.Key, Source = groupedBookmark.Source,
        Id = groupedBookmark.Id, CreatorTag = "lmsk", CreatorName = "lmsk" }]);
    reopened = (List<CatalogItem>)storeType.GetMethod("GetBookmarks")!.Invoke(metadataStore, null)!;
    Expect(reopened.First(item => item.Key == groupedBookmark.Key).MemberKeys.SequenceEqual(savedGroup.MemberKeys),
        "A partial detail refresh must not erase the bookmarked source records");
}
finally
{
    foreach (var file in Directory.GetFiles(metadataDirectory)) File.Delete(file);
    Directory.Delete(metadataDirectory);
}

Expect((string?)CallCatalog("BuildDanbooruSearchTags", "roboco-san", "explicit", "popular") ==
    "roboco-san rating:q,e order:score",
    "Danbooru popular search must keep older high-score posts available");
Expect((string?)CallCatalog("BuildDanbooruSearchTags", "roboco-san", "explicit", "recent") ==
    "roboco-san rating:q,e", "Danbooru recent search changed");
Expect((bool)CallCatalog("RatingMatches", new CatalogItem { Rating = "s" }, "general")! &&
    (bool)CallCatalog("RatingMatches", new CatalogItem { Rating = "sensitive" }, "general")! &&
    (bool)CallCatalog("RatingMatches", new CatalogItem { Rating = "safe" }, "general")! &&
    !(bool)CallCatalog("RatingMatches", new CatalogItem { Rating = "q" }, "general")!,
    "Ordinary searches must include G and Sensitive/Safe without including NSFW");
Expect((string?)CallCatalog("BuildDanbooruSearchTags", "rui_arneb", "general", "recent") ==
    "rui_arneb rating:g,s", "Danbooru must search both ordinary ratings");
using (var searchPage = JsonDocument.Parse("""
    [{"id":1,"rating":"g","preview_file_url":"https://cdn.donmai.us/preview/1.jpg"},
     {"id":2,"rating":"s","preview_file_url":"https://cdn.donmai.us/preview/2.jpg"},
     {"id":3,"rating":"q","preview_file_url":"https://cdn.donmai.us/preview/3.jpg"},
     {"id":4,"rating":"e","preview_file_url":"https://cdn.donmai.us/preview/4.jpg"},
     {"id":5,"rating":"e"}]
    """))
{
    Func<JsonElement, CatalogItem?> mapper = post => Map("MapDanbooru", post.GetRawText());
    var ordinaryPage = CallCatalog("ReadBooruPage", searchPage.RootElement, mapper, "general", 4)!;
    var pageType = ordinaryPage.GetType();
    int PageNumber(string field) => (int)pageType.GetProperty(field)!.GetValue(ordinaryPage)!;
    Expect(PageNumber("ReceivedCount") == 5 && PageNumber("UnavailableCount") == 1 &&
        PageNumber("RatingFilteredCount") == 2 &&
        ((List<CatalogItem>)pageType.GetProperty("Items")!.GetValue(ordinaryPage)!).Count == 2 &&
        (bool)pageType.GetProperty("HasMore")!.GetValue(ordinaryPage)!,
        "Search must distinguish inaccessible files and filtered ratings while paging raw results");
}
Expect((string?)CallCatalog("BuildBooruSearchTags", "roboco-san", "rating:general", "popular") ==
    "roboco-san rating:general sort:score:desc",
    "Booru popular search must keep older high-score posts available");
var retryPolicy = catalogType.GetMethod("ShouldRetryJsonError",
    BindingFlags.NonPublic | BindingFlags.Static);
Expect(retryPolicy is not null, "Rule34 rate limits need a fast-fail retry policy");
Expect((bool)retryPolicy!.Invoke(null, ["https://api.rule34.xxx/index.php",
        System.Net.HttpStatusCode.TooManyRequests, 0])! == false,
    "A Rule34 HTTP 429 must not delay the other sources with retries");
Expect((bool)retryPolicy.Invoke(null, ["https://gelbooru.com/index.php",
        System.Net.HttpStatusCode.ServiceUnavailable, 0])!,
    "Other temporary source errors still need their normal retry");

var month = new DateOnly(2026, 9, 1);
var posts = new (long Id, DateOnly Date)[]
{
    (2, new DateOnly(2026, 8, 29)),
    (4, new DateOnly(2026, 8, 31)),
    (7, new DateOnly(2026, 9, 1)),
    (11, new DateOnly(2026, 9, 2))
};
var probes = 0;
Task<(long Id, DateOnly Date)> Probe(long requested, CancellationToken _)
{
    probes++;
    return Task.FromResult(posts.First(post => post.Id >= requested));
}
var boundaryTask = (Task<long>)CallCatalog("FindMonthBoundaryAsync", 11L, month,
    (Func<long, CancellationToken, Task<(long Id, DateOnly Date)>>)Probe,
    CancellationToken.None)!;
Expect(await boundaryTask == 7 && probes <= 5,
    "Month boundary search skipped the first existing post of the month");
var emptyMonthTask = (Task<long>)CallCatalog("FindMonthBoundaryAsync", 11L,
    new DateOnly(2026, 10, 1),
    (Func<long, CancellationToken, Task<(long Id, DateOnly Date)>>)Probe,
    CancellationToken.None)!;
Expect(await emptyMonthTask == 12,
    "A month without posts must not include an older post");

if (Environment.GetEnvironmentVariable("ARTCATALOG_LIVE_RULE34_PROBE") == "1")
{
    // Explicit opt-in only: read saved access for a few real, read-only API queries.
    var liveStoreType = typeof(CatalogItem).Assembly.GetType("ArtCatalog.LocalStore")!;
    var liveStore = Activator.CreateInstance(liveStoreType, [null])!;
    var liveCatalog = Activator.CreateInstance(catalogType, [liveStore])!;
    var searchMethod = catalogType.GetMethod("SearchAsync")!;
    foreach (var tag in new[] { "shroobqueen", "guyenuangri", "garapagosunekko" })
    {
        var liveTask = (Task<SearchResponse>)searchMethod.Invoke(liveCatalog,
            [tag, 0, new[] { "rule34" }, "all", "recent", "illustrations", CancellationToken.None, null])!;
        var liveResult = await liveTask;
        Expect(liveResult.Errors.Count == 0, $"Live Rule34 query failed for {tag}");
        Expect(tag == "garapagosunekko" ? liveResult.Items.Count > 0 : liveResult.Items.Count == 0,
            $"Unexpected Rule34 result for {tag}");
        Console.WriteLine($"Live Rule34 {tag}: {liveResult.Items.Count} works, 0 errors");
        await Task.Delay(1200);
    }
}

Console.WriteLine("Rule34 mapping and cross-source identity: PASS");

var typedRule34 = Map("MapRule34", """
    {"id":18006569,"preview_url":"https://us-cdn.rule34.xxx/preview/a.jpg",
     "file_url":"https://us-cdn.rule34.xxx/images/a.png","rating":"e","owner":"reposter",
     "tags":"aisha_belka original_character zuharu lilith_(voice_actor) breasts",
     "tag_info":[{"tag":"aisha_belka","type":"character","count":186},
       {"tag":"original_character","type":"character","count":562508},
       {"tag":"lilith_(voice_actor)","type":"artist","count":5},
       {"tag":"zuharu","type":"artist","count":586},
       {"tag":"breasts","type":"tag","count":123},
       {"tag":"unrelated_artist","type":"artist","count":10}]}
    """)!;
Expect(typedRule34.CreatorTag == "zuharu" && typedRule34.Participants.Count == 2 &&
    typedRule34.Participants[0].Role == "artist" && typedRule34.Participants[1].Role == "voice_actor",
    "Rule34's native tag_info must supply all confirmed participants without secondary tag calls");
Expect(typedRule34.CharacterTags.SequenceEqual(new[] { "aisha_belka" }) &&
    typedRule34.Title == "aisha belka" && typedRule34.RelatedQuery == "aisha_belka",
    "Rule34's native categories must identify the character and exclude original_character");
Expect(typedRule34.UploaderName == "reposter", "Native tag categories replaced the uploader identity");
Console.WriteLine("Rule34 native tag categories: PASS");
await SankakuFixtureTests.Run();
