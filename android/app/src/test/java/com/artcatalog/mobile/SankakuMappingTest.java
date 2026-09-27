package com.artcatalog.mobile;

import org.json.*;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;

public class SankakuMappingTest {
    private JSONObject nativePost() throws Exception {
        return new JSONObject("""
            {"id":"AbC123xyz", "rating":"s", "md5":"aabbccdd", "total_score":87,
             "created_at":{"s":1790503200}, "width":900, "height":1200,
             "author":{"id":"uploader123","name":"upload_person"},
             "file_url":"https://s.sankakucomplex.com/data/art.jpg?e=1999999999&m=signed",
             "sample_url":"https://s.sankakucomplex.com/data/sample/art.jpg?e=1999999999&m=signed",
             "preview_url":"https://v.sankakucomplex.com/data/preview/art.avif?expires=1999999999&token=signed",
             "tags":[{"tagName":"alice_(example)","type":4},
                     {"tagName":"artist_one","type":1}, {"tagName":"artist_two","type":1},
                     {"tagName":"landscape","type":0}, {"tagName":"original","type":3}]}
            """);
    }
    @Test public void typedTagsKeepEveryArtistAndUploaderSeparate() throws Exception {
        Post post=CatalogLogic.map("sankaku",nativePost());
        assertEquals(List.of("artist_one","artist_two"),post.artistTags);
        assertEquals("artist_one",post.artistTag);
        assertEquals("upload_person",post.uploaderName);
        assertEquals(List.of("alice_(example)"),post.characterTags);
        assertEquals("alice (example)",post.title);
        assertTrue(post.tags.contains("landscape"));
        assertEquals("https://sankaku.app/posts/AbC123xyz",post.sourceUrl);
    }
    @Test public void signedMediaAndNativeScoreAndTimestampRemainUsable() throws Exception {
        Post post=CatalogLogic.map("sankaku",nativePost());
        assertTrue(CatalogLogic.isMediaUrl(post.preview));
        assertTrue(CatalogLogic.isMediaUrl(post.original));
        assertEquals(87,post.score);
        assertTrue(post.published.startsWith("2026-09-27T"));
        assertTrue(CatalogLogic.matchesRating(post.rating,"general"));
        Post restored=Post.fromJson(post.toJson());
        assertEquals(post.key(),restored.key());
        assertEquals(post.artistTags,restored.artistTags);
    }
    @Test public void alphanumericParentAndHashJoinVariantsAndCrossSiteCopies() throws Exception {
        JSONObject first=nativePost().put("has_children",true);
        JSONObject second=nativePost().put("id","OtherId456").put("md5","different")
            .put("parent_id","AbC123xyz").put("file_url","https://s.sankakucomplex.com/data/variant.jpg");
        Post a=CatalogLogic.map("sankaku",first),b=CatalogLogic.map("sankaku",second);
        assertEquals("sankaku:parent:AbC123xyz",b.groupKey);
        assertEquals(1,CatalogLogic.merge(List.of(a),List.of(b)).size());
        Post copy=new Post();copy.source="danbooru";copy.id="123";copy.hash=a.hash;
        assertEquals(1,CatalogLogic.merge(List.of(a),List.of(copy)).size());
    }
    @Test public void missingMediaDoesNotTurnJsonNullIntoAUrl() throws Exception {
        JSONObject locked=nativePost().put("file_url",JSONObject.NULL).put("preview_url",JSONObject.NULL)
            .put("sample_url",JSONObject.NULL).put("redirect_to_signup",true);
        Post post=CatalogLogic.map("sankaku",locked);
        assertEquals("",post.image);
        assertEquals("",post.preview);
        assertTrue(post.media.isEmpty());
    }
    @Test public void refreshingSignedUrlPreservesGalleryVariants() throws Exception {
        Post current=CatalogLogic.map("sankaku",nativePost());String variant="https://s.sankakucomplex.com/data/variant.jpg?e=1000&m=old";current.media.add(variant);
        JSONObject updated=nativePost().put("file_url","https://s.sankakucomplex.com/data/art.jpg?e=2000000000&m=renewed").put("sample_url","https://s.sankakucomplex.com/data/sample/art.jpg?e=2000000000&m=renewed");
        Post fresh=CatalogLogic.map("sankaku",updated);CatalogLogic.refreshSignedMedia(current,fresh);
        assertEquals(fresh.original,current.media.get(0));assertEquals(variant,current.media.get(1));assertEquals(fresh.image,current.image);
    }
    @Test public void nativePopularityIsNotResortedByIncomparableSiteScores(){
        Post d=new Post();d.source="danbooru";d.score=100;
        Post a=new Post();a.source="sankaku";a.id="first";a.score=1;
        Post b=new Post();b.source="sankaku";b.id="second";b.score=900;
        assertEquals(List.of(d,a,b),CatalogClient.nativeRanking(List.of(d,a,b)));
    }
    @Test public void avifThumbnailUsesJpegSampleForAndroidEightCompatibility() throws Exception {
        Post post=CatalogLogic.map("sankaku",nativePost());assertEquals(post.image,post.preview);
        assertTrue(post.smallPreview.contains(".avif"));
    }
}
