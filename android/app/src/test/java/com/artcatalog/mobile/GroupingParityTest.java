package com.artcatalog.mobile;
import org.junit.Test;
import org.json.*;
import java.util.*;
import static org.junit.Assert.*;

public class GroupingParityTest {
    private static Post p(String source,String id){Post p=new Post();p.source=source;p.id=id;p.rating="g";p.artistTag="alice";p.uploaderId="uploader";p.tags=List.of("landscape","mountain","forest","waterfall","grass","cloud","sky","sunlight","lake","rocks","river","tree");return p;}
    @Test public void parentCannotBridgeTwoConfirmedPublications(){Post a=p("danbooru","1"),b=p("danbooru","2"),bridge=p("danbooru","3");a.originalUrl="https://www.pixiv.net/artworks/123456";b.originalUrl="https://www.pixiv.net/artworks/123457";a.groupKey=b.groupKey=bridge.groupKey="danbooru:parent:1";
        assertEquals(2,CatalogLogic.merge(List.of(a,bridge),List.of(b)).size());}
    @Test public void parentWithoutHasChildrenStillFindsChild(){Post a=p("danbooru","1"),b=p("danbooru","2");b.groupKey="danbooru:parent:1";assertEquals(1,CatalogLogic.merge(List.of(a),List.of(b)).size());}
    @Test public void mediaHashAndSignedRenewalDoNotDuplicateGalleryPages(){String hash="0123456789abcdef0123456789abcdef";Post a=p("sankaku","abc"),b=p("sankaku","def");
        a.media=List.of("https://s.sankakucomplex.com/o/01/23/"+hash+".jpg?e=1&m=old");b.media=List.of("https://v.sankakucomplex.com/data/01/23/"+hash+".jpg?expires=9&token=new");
        List<Post> group=CatalogLogic.merge(List.of(a),List.of(b));assertEquals(1,group.size());assertEquals(1,group.get(0).media.size());assertEquals(2,group.get(0).memberKeys.size());}
    @Test public void visualOwnerCannotMergeDifferentConfirmedCreators(){Post a=p("rule34","1"),b=p("rule34","2");a.visualHash=b.visualHash="0000000000000000";b.artistTag="bob";
        assertEquals(2,CatalogLogic.merge(List.of(a),List.of(b)).size());}
    @Test public void sankakuAndDanbooruCreatorVisualCopiesUseDualEvidence(){Post a=p("sankaku","abc"),b=p("danbooru","2");a.visualHash=b.visualHash="0123456789abcdef";a.visualPHash=b.visualPHash="fedcba9876543210";a.visualAspectRatio=b.visualAspectRatio=1.2;
        assertEquals(1,CatalogLogic.merge(List.of(a),List.of(b)).size());b.visualPHash="0000000000000000";assertEquals(2,CatalogLogic.merge(List.of(a),List.of(b)).size());}
    @Test public void sameUploadTimeButDifferentTypedCharactersDoesNotMerge(){Post a=p("danbooru","100"),b=p("danbooru","101");a.published=b.published="2026-11-01T00:00:00Z";a.characterTags=List.of("alice_character");b.characterTags=List.of("bob_character");
        assertEquals(2,CatalogLogic.merge(List.of(a),List.of(b)).size());}
    @Test public void groupedMetadataKeepsParticipantAndSourceEvidence() throws Exception {Post a=p("danbooru","1"),b=p("gelbooru","2");a.hash=b.hash="shared";a.participants=new JSONArray("[{\"tag\":\"alice\",\"role\":\"artist\"}]");b.participants=new JSONArray("[{\"tag\":\"bob_(voice_actor)\",\"role\":\"voice_actor\"}]");
        Post group=CatalogLogic.merge(List.of(a),List.of(b)).get(0);assertEquals(2,group.groupingVersion);assertEquals(2,group.groupMembers.size());assertEquals(2,group.participants.length());assertEquals(2,Post.fromJson(group.toJson()).groupMembers.size());}
    @Test public void newFollowingEntriesAreFirstAndDatesCompareAcrossSources(){Post older=p("rule34","999"),fresh=p("sankaku","opaque"),newOld=p("gelbooru","3");older.published="2026-10-01T00:00:00Z";fresh.published="2026-11-01T00:00:00Z";newOld.published="2026-09-01T00:00:00Z";
        assertEquals(List.of(newOld,fresh,older),CatalogLogic.orderFollowing(List.of(older,fresh,newOld),Set.of(newOld.key())));}
}
