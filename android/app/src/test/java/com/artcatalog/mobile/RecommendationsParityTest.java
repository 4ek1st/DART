package com.artcatalog.mobile;

import org.json.*;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;

/** Regression cases mirror the canonical desktop formulas using neutral fixtures. */
public class RecommendationsParityTest {
    private static Post work(int id,String artist,String... tags){
        Post p=new Post();p.source="danbooru";p.id=String.valueOf(id);p.artistTag=artist;
        p.rating="g";p.tags=new ArrayList<>(List.of(tags));return p;
    }
    @Test public void manualPriorityWorksWithoutAnyLike(){
        Recommendations.Model m=Recommendations.build(List.of(),Map.of("forest","priority"),0);
        assertEquals(List.of("forest"),m.queries);
        Post unrelated=work(1,"alice","city"),matching=work(2,"bob","forest");
        assertEquals(List.of(matching),m.rank(List.of(unrelated,matching),List.of(),Set.of()));
    }
    @Test public void unicodeSpacesNormalizeWithoutJvmOnlyRegexFlags(){assertEquals("forest scene blue-sky",Recommendations.normal("\u00a0Ｆｏｒｅｓｔ\u2003scene:blue-sky\ufeff"));}
    @Test public void incidentalSingleLikeTagDoesNotAdmitWorkInLargeProfile(){
        List<Post> likes=new ArrayList<>();
        for(int i=0;i<20;i++)likes.add(work(i+1,"artist_"+i,"landscape",i==0?"rare_detail":"forest"));
        Post incidental=work(100,"new_artist","rare_detail"),supported=work(101,"other_artist","landscape");
        assertEquals(List.of(supported),Recommendations.build(likes,Map.of(),0)
            .rank(List.of(incidental,supported),List.of(),Set.of()));
    }
    @Test public void colonPriorityPreservesSearchSpellingAndCanBeDisabled(){
        Post liked=work(1,"alice","alternate:costume","landscape");
        Recommendations.Model model=Recommendations.build(List.of(liked),Map.of("alternate costume","priority"),0);
        assertTrue(model.queries.contains("alternate:costume"));
        assertEquals(List.of(),Recommendations.build(List.of(liked),Map.of("alternate costume","disabled"),0)
            .rank(List.of(work(2,"bob","alternate:costume","landscape")),List.of(),Set.of()));
    }
    @Test public void aiCreatedMatchesDesktopMarker(){
        assertTrue(CatalogLogic.hidden(work(1,"alice","ai-created"),"generated",List.of()));
        assertTrue(CatalogLogic.hidden(work(1,"alice","ai_created"),"generated",List.of()));
    }
    @Test public void missingPopularityDoesNotBecomeZeroAfterGroupingOrRoundTrip(){
        Post missing=work(1,"alice","landscape");assertNull(Post.fromJson(missing.toJson()).popularityCount);
        assertNull(CatalogLogic.merge(List.of(),List.of(missing)).get(0).popularityCount);
    }
    @Test public void relatedParentDoesNotHideDifferentConfirmedPublication(){
        Post liked=work(1,"alice","landscape"),candidate=work(2,"alice","landscape");liked.originalUrl="https://www.pixiv.net/artworks/123456";candidate.originalUrl="https://www.pixiv.net/artworks/123457";
        liked.groupKey=candidate.groupKey="danbooru:parent:1";assertEquals(1,Recommendations.build(List.of(liked),Map.of(),0).rank(List.of(candidate),List.of(),Set.of()).size());
    }
    @Test public void desktopMetadataSurvivesNativeRoundTrip() throws Exception {
        JSONObject input=new JSONObject("{\"source\":\"danbooru\",\"id\":\"42\",\"key\":\"danbooru:42\",\"creatorTag\":\"alice\",\"relatedQuery\":\"forest\",\"popularityCount\":71,\"groupingVersion\":2,\"visualPHash\":\"0123456789abcdef\",\"visualAspectRatio\":1.25,\"participants\":[{\"tag\":\"alice\",\"name\":\"Alice\",\"role\":\"artist\"},{\"tag\":\"bob_(voice_actor)\",\"role\":\"voice_actor\"}],\"groupMembers\":[{\"source\":\"gelbooru\",\"id\":\"43\",\"key\":\"gelbooru:43\",\"creatorTag\":\"alice\"}]}");
        JSONObject output=Post.fromJson(input).toJson();
        for(String field:List.of("key","relatedQuery","popularityCount","groupingVersion","visualPHash"))
            assertEquals(field,input.get(field),output.opt(field));
        assertEquals(input.getDouble("visualAspectRatio"),output.getDouble("visualAspectRatio"),0);
        assertEquals(2,output.getJSONArray("participants").length());
        assertEquals("gelbooru:43",output.getJSONArray("groupMembers").getJSONObject(0).getString("key"));
    }
}
