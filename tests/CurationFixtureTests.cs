using System.Reflection;
using System.Text.Json;
using ArtCatalog;

internal static class CurationFixtureTests
{
    public static void Run()
    {
        var assembly = typeof(CatalogItem).Assembly;
        var storeType = assembly.GetType("ArtCatalog.LocalStore")!;
        var change = storeType.GetMethod("UpdateCurationPreferences")
            ?? throw new Exception("Curation preferences must have an independent persistent update");
        var updateType = change.GetParameters()[0].ParameterType;
        var cleanState = assembly.GetType("ArtCatalog.CatalogState")!.GetMethod("CleanClientState",
            BindingFlags.Static | BindingFlags.NonPublic)!;
        using var migrated = JsonDocument.Parse((string)cleanState.Invoke(null, ["""
            {"session":{"savedWorksVersion":1,"tabs":[{"kind":"search","sort":"curated","curationBaseSort":"popular"}],"activeIndex":0}}
            """])!);
        var migratedTab = migrated.RootElement.GetProperty("session").GetProperty("tabs")[0];
        if (migratedTab.GetProperty("sort").GetString() != "popular" || migratedTab.TryGetProperty("curationBaseSort", out _))
            throw new Exception("Curation: a legacy Curated session must migrate to its normal source ordering");
        var directory = Path.Combine(Path.GetTempPath(), "DART-curation-fixture-" + Guid.NewGuid());
        Directory.CreateDirectory(directory);
        try
        {
            object Store() => Activator.CreateInstance(storeType, [directory])!;
            JsonElement Read(object store) => JsonSerializer.SerializeToElement(
                storeType.GetMethod("GetContentPreferences")!.Invoke(store, null), new JsonSerializerOptions(JsonSerializerDefaults.Web));
            void Update(string json) => change.Invoke(Store(), [JsonSerializer.Deserialize(json, updateType,
                new JsonSerializerOptions(JsonSerializerDefaults.Web))!]);
            void Expect(bool valid, string message) { if (!valid) throw new Exception("Curation: " + message); }
            Expect(!Read(Store()).GetProperty("curation").GetProperty("enabled").GetBoolean(), "legacy profiles must opt in");
            Expect(!Read(Store()).GetProperty("hideFollowedArtists").GetBoolean(),
                "new profiles must continue showing followed artists by default");
            File.WriteAllText(Path.Combine(directory, "content-preferences.json"), """{"language":"en"}""");
            Expect(!Read(Store()).GetProperty("hideFollowedArtists").GetBoolean(),
                "a legacy preference file without the new field must continue showing followed artists");
            File.WriteAllText(Path.Combine(directory, "content-preferences.json"), """
                {"language":"de","aiMode":"generated-and-assisted","hideFurry":true,
                 "hideViewedAndSaved":true,"hideFollowedArtists":true,"excludedTags":["blocked"],
                 "hiddenAuthors":[{"source":"artist","artistId":"hidden","name":"Hidden"}],
                 "futureSetting":{"kept":42},"curation":{"futureFactor":"keep"}}
                """);
            Update("""{"enabled":true,"popularity":false,"personal":true,"freshness":false,"resolution":true}""");
            var reopened = Read(Store());
            Expect(reopened.GetProperty("language").GetString() == "de" && reopened.GetProperty("hideFurry").GetBoolean() &&
                reopened.GetProperty("hideViewedAndSaved").GetBoolean() &&
                reopened.GetProperty("hideFollowedArtists").GetBoolean() &&
                reopened.GetProperty("excludedTags")[0].GetString() == "blocked" &&
                reopened.GetProperty("hiddenAuthors").GetArrayLength() == 1 &&
                reopened.GetProperty("futureSetting").GetProperty("kept").GetInt32() == 42,
                "saving curation changed unrelated or unknown preferences");
            var curation = reopened.GetProperty("curation");
            Expect(curation.GetProperty("enabled").GetBoolean() && !curation.GetProperty("popularity").GetBoolean() &&
                curation.GetProperty("personal").GetBoolean() && !curation.GetProperty("freshness").GetBoolean() &&
                curation.GetProperty("resolution").GetBoolean() && curation.GetProperty("futureFactor").GetString() == "keep",
                "factor selection did not survive reopening");
            Update("""{"enabled":false}""");
            Expect(!Read(Store()).GetProperty("curation").GetProperty("popularity").GetBoolean(), "partial update reset factors");
            storeType.GetMethod("UpdateContentPreferences")!.Invoke(Store(), [new ContentPreferencesUpdate { Language = "ru" }]);
            var afterLegacySave = Read(Store());
            Expect(!afterLegacySave.GetProperty("curation").GetProperty("popularity").GetBoolean() &&
                afterLegacySave.GetProperty("hideFollowedArtists").GetBoolean() &&
                afterLegacySave.GetProperty("curation").GetProperty("futureFactor").GetString() == "keep" &&
                afterLegacySave.GetProperty("futureSetting").GetProperty("kept").GetInt32() == 42,
                "an older content-settings form reset curation or unknown preferences");

            var updateContent = storeType.GetMethod("UpdateContentPreferences")!;
            var hiddenAuthor = new HiddenAuthor { Source = "artist", ArtistId = "temporary", Name = "Temporary" };
            storeType.GetMethod("SetHiddenAuthor")!.Invoke(Store(), [hiddenAuthor, true]);
            Expect(Read(Store()).GetProperty("hideFollowedArtists").GetBoolean(),
                "changing hidden authors reset followed-artist hiding");
            storeType.GetMethod("SetHiddenAuthor")!.Invoke(Store(), [hiddenAuthor, false]);
            updateContent.Invoke(Store(), [new ContentPreferencesUpdate { HideFollowedArtists = false }]);
            Expect(!Read(Store()).GetProperty("hideFollowedArtists").GetBoolean(),
                "explicitly disabling followed-artist hiding did not survive reopening");
            updateContent.Invoke(Store(), [new ContentPreferencesUpdate { HideFollowedArtists = true }]);
            Expect(Read(Store()).GetProperty("hideFollowedArtists").GetBoolean(),
                "explicitly enabling followed-artist hiding did not survive reopening");
            updateContent.Invoke(Store(), [new ContentPreferencesUpdate { Language = "de" }]);
            Expect(Read(Store()).GetProperty("hideFollowedArtists").GetBoolean(),
                "a partial legacy update reset followed-artist hiding");

            var catalog = assembly.GetType("ArtCatalog.CatalogService")!;
            foreach (var source in new[] { "Danbooru", "Gelbooru", "Rule34", "Sankaku" })
            {
                var host = source switch { "Sankaku" => "s.sankakucomplex.com", "Danbooru" => "cdn.donmai.us", _ => "us-cdn.rule34.xxx" };
                using var post = JsonDocument.Parse($$"""
                    {"id":123,"status":"active","preview_url":"https://{{host}}/preview/a.jpg",
                     "preview_file_url":"https://{{host}}/preview/a.jpg",
                     "file_url":"https://{{host}}/a.jpg","sample_url":"https://{{host}}/sample/a.jpg",
                     "width":1800,"height":2400,"image_width":1800,"image_height":2400,
                     "preview_width":150,"preview_height":200,"rating":"s","tags":"landscape"}
                    """);
                var item = catalog.GetMethod("Map" + source, BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic)!
                    .Invoke(null, [post.RootElement]);
                Expect(item is not null, source + " rejected the dimensions fixture");
                var mapped = JsonSerializer.SerializeToElement(item, new JsonSerializerOptions(JsonSerializerDefaults.Web));
                Expect(mapped.GetProperty("width").GetInt32() == 1800 && mapped.GetProperty("height").GetInt32() == 2400,
                    source + " lost original dimensions or used the thumbnail dimensions");
            }
            var legacy = new CatalogItem { Key = "danbooru:123", Source = "danbooru", Id = "123", Title = "Legacy" };
            storeType.GetMethod("ToggleLike")!.Invoke(Store(), [legacy]);
            var measured = new CatalogItem { Key = legacy.Key, Source = legacy.Source, Id = legacy.Id, Width = 1800, Height = 2400 };
            storeType.GetMethod("RefreshSavedMetadata")!.Invoke(Store(), [measured]);
            storeType.GetMethod("RefreshSavedMetadata")!.Invoke(Store(), [legacy]);
            var likes = JsonSerializer.SerializeToElement(storeType.GetMethod("GetLikes")!.Invoke(Store(), null),
                new JsonSerializerOptions(JsonSerializerDefaults.Web));
            Expect(likes[0].GetProperty("width").GetInt32() == 1800 && likes[0].GetProperty("height").GetInt32() == 2400,
                "original dimensions must enrich saved works and survive a partial refresh");
            Console.WriteLine("Curation persistence, legacy client preservation and four-source original dimensions: PASS");
        }
        finally
        {
            if (!Path.GetFullPath(directory).StartsWith(Path.GetFullPath(Path.GetTempPath()), StringComparison.OrdinalIgnoreCase))
                throw new Exception("Fixture cleanup escaped the temporary directory");
            Directory.Delete(directory, true);
        }
    }
}
