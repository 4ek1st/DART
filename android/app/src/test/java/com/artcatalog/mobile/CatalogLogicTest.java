package com.artcatalog.mobile;

import org.json.*;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;

public class CatalogLogicTest {
    @Test public void catalogueCardsUseDelivered720VariantInsteadOf180Thumbnail() throws Exception {
        Post p=CatalogLogic.map("danbooru",new JSONObject("{\"id\":9,\"preview_file_url\":\"https://cdn.donmai.us/tiny.jpg\",\"large_file_url\":\"https://cdn.donmai.us/sample.jpg\",\"media_asset\":{\"variants\":[{\"type\":\"180x180\",\"url\":\"https://cdn.donmai.us/tiny.jpg\"},{\"type\":\"720x720\",\"url\":\"https://cdn.donmai.us/card.webp\"}]}}"));
        assertEquals("https://cdn.donmai.us/card.webp",p.preview);
    }
    @Test public void duplicateCopiesKeepTagsNeededByContentFilters() {
        Post a=new Post();a.source="danbooru";a.id="1";a.hash="same";a.tags=List.of("sky");
        Post b=new Post();b.source="gelbooru";b.id="2";b.hash="same";b.tags=List.of("ai_generated");
        assertEquals(List.of("sky","ai_generated"),CatalogLogic.merge(List.of(a),List.of(b)).get(0).tags);
    }
    @Test public void uploaderDoesNotBecomeAnUnconfirmedArtist() throws Exception {
        Post p=CatalogLogic.map("gelbooru",new JSONObject("{\"id\":4,\"owner\":\"reposter\",\"tags\":\"sky\"}"));
        assertEquals("Автор не указан",p.artist);
    }
    @Test public void ratingBoundaryIncludesGeneralSensitiveAndExcludesUnknown() {
        assertTrue(CatalogLogic.matchesRating("g", "general"));
        assertTrue(CatalogLogic.matchesRating("sensitive", "general"));
        assertFalse(CatalogLogic.matchesRating("q", "general"));
        assertFalse(CatalogLogic.matchesRating("", "general"));
        assertTrue(CatalogLogic.matchesRating("explicit", "explicit"));
        assertFalse(CatalogLogic.matchesRating("safe", "explicit"));
    }
    @Test public void mappingUsesPreviewAndConfirmedArtistTag() throws Exception {
        Post p = CatalogLogic.map("danbooru", new JSONObject("{\"id\":42,\"rating\":\"g\",\"preview_file_url\":\"https://cdn.donmai.us/p.jpg\",\"file_url\":\"https://cdn.donmai.us/o.jpg\",\"tag_string\":\"landscape blue_sky artist_one\",\"tag_string_artist\":\"artist_one\",\"tag_string_character\":\"\",\"md5\":\"abc\"}"));
        assertEquals("https://cdn.donmai.us/p.jpg", p.preview);
        assertEquals("artist_one", p.artistTag);
        assertEquals("danbooru:42", p.key());
        assertEquals("abc", p.hash);
    }
    @Test public void ratingFilteredPageStillHasMoreWhenRawPageIsFull() {
        assertTrue(CatalogLogic.hasMore(24, 24));
        assertFalse(CatalogLogic.hasMore(0, 24));
        assertFalse(CatalogLogic.hasMore(23, 24));
    }
    @Test public void duplicatesMergeByHashAcrossSources() {
        Post a=new Post(); a.source="danbooru";a.id="1";a.hash="same";
        Post b=new Post(); b.source="gelbooru";b.id="9";b.hash="same";
        Post c=new Post(); c.source="danbooru";c.id="2";
        assertEquals(2, CatalogLogic.merge(List.of(a), List.of(b,c)).size());
    }
    @Test public void repeatedBookmarkTagsGenerateRecommendationsAndSkipGenericTags() {
        Post a=new Post();a.tags=List.of("1girl","landscape","blue_sky");
        Post b=new Post();b.tags=List.of("solo","landscape","mountain");
        assertEquals("landscape", CatalogLogic.recommendationTags(List.of(a,b)).get(0));
        assertFalse(CatalogLogic.recommendationTags(List.of(a,b)).contains("1girl"));
    }
    @Test public void savedCopiesAreExcludedFromRecommendations() {
        Post saved=new Post(); saved.source="danbooru";saved.id="1";saved.hash="match";
        Post copy=new Post();copy.source="gelbooru";copy.id="2";copy.hash="match";
        Post fresh=new Post();fresh.source="danbooru";fresh.id="3";
        assertEquals(List.of(fresh),CatalogLogic.excludeSaved(List.of(copy,fresh),List.of(saved)));
    }
    @Test public void plainQueryBecomesBooruTagsWithoutDestroyingMetatags() {
        assertEquals("blue_sky landscape",CatalogLogic.cleanQuery(" blue_sky   landscape "));
        assertEquals("-ai_generated order:score",CatalogLogic.cleanQuery("-ai_generated order:score"));
    }
    @Test public void desktopBookmarkImportsKeepOriginalAndArtistData() throws Exception {
        Post p=Post.fromJson(new JSONObject("{\"source\":\"danbooru\",\"id\":\"5\",\"title\":\"Sky\",\"creatorTag\":\"alice\",\"thumbnail\":\"https://cdn.donmai.us/a.jpg\",\"images\":[\"https://cdn.donmai.us/b.jpg\"],\"tags\":[\"sky\"],\"rating\":\"g\"}"));
        assertEquals("alice",p.artistTag);
        assertEquals("https://cdn.donmai.us/b.jpg",p.original);
        assertEquals("sky",p.tags.get(0));
    }
    @Test public void mediaUrlsRequireHttpsAndCannotUsePrivateHosts() {
        assertTrue(CatalogLogic.isMediaUrl("https://cdn.donmai.us/a.jpg"));
        assertFalse(CatalogLogic.isMediaUrl("http://cdn.donmai.us/a.jpg"));
        assertFalse(CatalogLogic.isMediaUrl("https://127.0.0.1/a.jpg"));
        assertFalse(CatalogLogic.isMediaUrl("file:///sdcard/secret"));
    }
    @Test public void exactExcludedTagDoesNotHideLongerTagAndAiModesStaySeparate(){
        Post gloves=new Post();gloves.tags=List.of("latex_gloves");assertFalse(CatalogLogic.hidden(gloves,"all",CatalogLogic.excludedTags("#Latex")));
        gloves.tags=List.of("latex");assertTrue(CatalogLogic.hidden(gloves,"all",CatalogLogic.excludedTags("latex")));
        Post assisted=new Post();assisted.tags=List.of("ai_assisted");assertFalse(CatalogLogic.hidden(assisted,"generated",List.of()));assertTrue(CatalogLogic.hidden(assisted,"generated-and-assisted",List.of()));
        assisted.tags=List.of("stable_diffusion_1.5");assertTrue(CatalogLogic.hidden(assisted,"generated",List.of()));
    }
    @Test public void characterAndOriginalTagsKeepCategoriesAcrossProfileRoundTrip() throws Exception {
        Post p=CatalogLogic.map("danbooru",new JSONObject("{\"id\":7,\"tag_string\":\"sky original alice original_character\",\"tag_string_character\":\"alice original_character\",\"tag_string_artist\":\"artist_one artist_two\"}"));
        Post copy=Post.fromJson(p.toJson());assertEquals("character",CatalogLogic.tagKind(copy,"alice"));assertEquals("original",CatalogLogic.tagKind(copy,"original"));assertEquals("",CatalogLogic.tagKind(copy,"original_character"));assertEquals(List.of("alice","original","sky","original_character"),CatalogLogic.artworkTags(copy));assertEquals(List.of("artist_one","artist_two"),copy.artistTags);
    }
    @Test public void desktopImportSeparatesCreatorAndUploaderAndPreservesAllImages() throws Exception {
        Post p=Post.fromJson(new JSONObject("{\"source\":\"gelbooru\",\"id\":3,\"artist\":\"reposter\",\"creatorTag\":\"real_artist\",\"creatorName\":\"Real Artist\",\"uploaderName\":\"reposter\",\"originalUrl\":\"https://www.pixiv.net/artworks/123\",\"images\":[\"https://gelbooru.com/one.jpg\",\"https://gelbooru.com/two.jpg\"]}"));
        assertEquals("Real Artist",p.artist);assertEquals("reposter",p.uploaderName);assertEquals(2,p.media.size());assertEquals("https://www.pixiv.net/artworks/123",Post.fromJson(p.toJson()).originalUrl);
    }
    @Test public void neighborsFollowActualFeedOrderAndStopAtBoundaries(){
        Post a=new Post();a.id="30";Post b=new Post();b.id="10";Post c=new Post();c.id="20";List<Post> feed=List.of(a,b,c);assertSame(c,CatalogLogic.neighbor(feed,b,1));assertSame(a,CatalogLogic.neighbor(feed,b,-1));assertNull(CatalogLogic.neighbor(feed,a,-1));assertNull(CatalogLogic.neighbor(feed,c,1));
    }
    @Test public void relatedQueriesPreferCharactersAndNeverQueryTheArtistOrAnEmptyCatalogue(){
        Post p=new Post();p.artistTag="artist_one";p.tags=List.of("artist_one","alice","sky","signature");p.characterTags=List.of("alice");assertEquals("alice",CatalogLogic.relatedQueries(p).get(0));assertFalse(CatalogLogic.relatedQueries(p).contains("artist_one"));p.tags=List.of("solo","1girl");p.characterTags=List.of();assertTrue(CatalogLogic.relatedQueries(p).isEmpty());
    }
    @Test public void publicationVariantsGroupIntoOneCardWithEveryImage() throws Exception {
        Post a=Post.fromJson(new JSONObject("{\"source\":\"danbooru\",\"id\":1,\"originalUrl\":\"https://www.pixiv.net/en/artworks/123456\",\"images\":[\"https://cdn.donmai.us/one.jpg\"]}"));
        Post b=Post.fromJson(new JSONObject("{\"source\":\"gelbooru\",\"id\":9,\"originalUrl\":\"https://www.pixiv.net/artworks/123456\",\"images\":[\"https://gelbooru.com/two.jpg\"]}"));
        List<Post> grouped=CatalogLogic.merge(List.of(a),List.of(b));assertEquals(1,grouped.size());assertEquals(2,grouped.get(0).media.size());assertTrue(grouped.get(0).memberKeys.contains("gelbooru:9"));
    }
    @Test public void parentSeriesGroupsButDifferentPublicationsStaySeparate() throws Exception {
        Post a=CatalogLogic.map("danbooru",new JSONObject("{\"id\":5,\"has_children\":true,\"file_url\":\"https://cdn.donmai.us/a.jpg\"}"));Post b=CatalogLogic.map("danbooru",new JSONObject("{\"id\":6,\"parent_id\":5,\"file_url\":\"https://cdn.donmai.us/b.jpg\"}"));assertEquals(1,CatalogLogic.merge(List.of(a),List.of(b)).size());
        a.originalUrl="https://www.pixiv.net/artworks/123456";b.originalUrl="https://www.pixiv.net/artworks/123457";a.groupKey="";b.groupKey="";a=Post.fromJson(a.toJson());b=Post.fromJson(b.toJson());assertEquals(2,CatalogLogic.merge(List.of(a),List.of(b)).size());
    }
    @Test public void compactArtistBatchGroupsOnlyInsideIdTimeAndTagBounds(){
        Post a=new Post();a.source="danbooru";a.id="100";a.artistTag="alice";a.uploaderId="12";a.rating="g";a.published="2026-09-27T10:00:00Z";a.tags=List.of("a","b","c","d","e","f","g","h","i","j","k","l","m");
        Post b=Post.fromJson(a.toJson());b.id="105";b.published="2026-09-27T10:05:00Z";assertEquals(1,CatalogLogic.merge(List.of(a),List.of(b)).size());b.id="113";assertEquals(2,CatalogLogic.merge(List.of(a),List.of(b)).size());b.id="105";b.published="2026-09-27T10:11:00Z";assertEquals(2,CatalogLogic.merge(List.of(a),List.of(b)).size());b.published=a.published;b.uploaderId="13";assertEquals(2,CatalogLogic.merge(List.of(a),List.of(b)).size());
        b.uploaderId="12";b.id="110";Post c=Post.fromJson(a.toJson());c.id="120";assertEquals(2,CatalogLogic.merge(List.of(a,b),List.of(c)).size());
        b.id="101";c.id="102";b.published="2026-09-27T10:09:00Z";c.published="2026-09-27T10:18:00Z";assertEquals(2,CatalogLogic.merge(List.of(a,b),List.of(c)).size());assertEquals(2,CatalogLogic.merge(List.of(c,b),List.of(a)).size());
    }
    @Test public void rule34VisualVariantsRequireBothOwnerAndTagOverlap(){
        Post a=new Post();a.source="rule34";a.id="1";a.uploaderId="12";a.visualHash="0000000000000000";a.tags=List.of("sky","ocean","landscape","sun");
        Post b=Post.fromJson(a.toJson());b.id="2";b.visualHash="000000000000000f";assertEquals(1,CatalogLogic.merge(List.of(a),List.of(b)).size());b.uploaderId="13";assertEquals(2,CatalogLogic.merge(List.of(a),List.of(b)).size());b.uploaderId="12";b.tags=List.of("sky","portrait","city");assertEquals(2,CatalogLogic.merge(List.of(a),List.of(b)).size());
    }
    @Test public void incrementalSeriesKeepsTheWholePublicationTimeRange(){
        Post a=batchPost("100","2026-09-27T10:00:00Z"),b=batchPost("101","2026-09-27T10:09:00Z"),c=batchPost("102","2026-09-27T10:18:00Z");
        List<Post> bc=CatalogLogic.merge(List.of(b),List.of(c));assertEquals(1,bc.size());
        assertEquals(2,CatalogLogic.merge(bc,List.of(a)).size());
        assertEquals(2,CatalogLogic.merge(List.of(a),bc).size());
    }
    @Test public void knownDifferentPixivPublicationsDoNotBecomeAnInferredSeries(){
        Post a=batchPost("100","2026-09-27T10:00:00Z"),b=batchPost("101","2026-09-27T10:01:00Z");a.pixivGroupKey="pixiv:123456";b.pixivGroupKey="pixiv:123457";
        assertEquals(2,CatalogLogic.merge(List.of(a),List.of(b)).size());
    }
    private Post batchPost(String id,String published){Post p=new Post();p.source="danbooru";p.id=id;p.published=published;p.rating="g";p.artistTag="alice";p.uploaderId="12";p.tags=List.of("a","b","c","d","e","f","g","h","i","j","k","l","m");return p;}
    @Test public void tagNormalizationPreservesUnicodeAndExactFiltering(){
        assertEquals("blue sky",CatalogLogic.normalizeTag("  ###Ｂｌｕｅ__-\tＳｋｙ  "));
        assertEquals("ёжик",CatalogLogic.normalizeTag("#ЁЖИК"));
        Post p=new Post();p.tags=List.of("ＢＬＵＥ＿ＳＫＹ");assertTrue(CatalogLogic.hidden(p,"all",CatalogLogic.excludedTags("blue_sky")));
        p.tags=List.of("blue_sky_day");assertFalse(CatalogLogic.hidden(p,"all",CatalogLogic.excludedTags("blue_sky")));
    }
}
