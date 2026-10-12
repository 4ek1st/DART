package com.artcatalog.mobile;

import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;

public class RecommendationsTest {
    private static Post post(String source,String id,String hash,String artist,String... tags){
        Post post=new Post();post.source=source;post.id=id;post.hash=hash;post.artistTag=artist;
        post.tags=new ArrayList<>(Arrays.asList(tags));return post;
    }
    @Test public void likesDriveQueriesWhileGenericTagsDoNot(){
        Post first=post("danbooru","1","","alice","1girl","landscape","blue_sky");
        Post second=post("danbooru","2","","bob","solo","landscape","mountain");
        Recommendations.Model model=Recommendations.build(List.of(first,second),Map.of(),0);
        assertTrue(model.queries.contains("landscape"));
        assertFalse(model.queries.contains("1girl"));
        assertFalse(model.queries.contains("solo"));
    }
    @Test public void priorityAndDisabledTagsChangeCandidateSelection(){
        Post liked=post("danbooru","1","hash-1","alice","landscape","forest");
        Recommendations.Model model=Recommendations.build(List.of(liked),Map.of("forest","priority","landscape","disabled"),0);
        assertTrue(model.queries.contains("forest"));
        assertFalse(model.queries.contains("landscape"));
        Post blocked=post("danbooru","2","","bob","forest","landscape");
        Post allowed=post("danbooru","3","","carol","forest");
        assertEquals(List.of(allowed),model.rank(List.of(blocked,allowed),List.of(),Set.of()));
    }
    @Test public void likedMirrorsAndAlreadyDisplayedCopiesAreNotRepeated(){
        Post liked=post("danbooru","1","shared","alice","landscape");
        Recommendations.Model model=Recommendations.build(List.of(liked),Map.of(),0);
        Post mirror=post("gelbooru","2","shared","alice","landscape");
        Post displayed=post("danbooru","3","another","bob","landscape");
        Post copy=post("rule34","4","another","bob","landscape");
        Post fresh=post("danbooru","5","fresh","carol","landscape");
        assertEquals(List.of(fresh),model.rank(List.of(mirror,copy,fresh),List.of(displayed),Set.of()));
    }
    @Test public void rankingDiversifiesRepeatedArtistsWithoutDroppingTheirWorks(){
        Post liked=post("danbooru","1","","alice","landscape");
        Recommendations.Model model=Recommendations.build(List.of(liked),Map.of(),0);
        Post a=post("danbooru","2","","bob","landscape");
        Post b=post("danbooru","3","","bob","landscape");
        Post c=post("danbooru","4","","carol","landscape");
        assertEquals(List.of(a,c,b),model.rank(List.of(a,b,c),List.of(),Set.of()));
    }
    @Test public void groupedFurryCopyAndCopyrightRemainVisibleToFiltersAndTags(){
        Post first=post("danbooru","1","same","alice","animal_ears");
        Post second=post("gelbooru","2","same","alice","female_anthro");
        second.copyrightTags=List.of("my_series");
        Post grouped=CatalogLogic.merge(List.of(first),List.of(second)).get(0);
        assertTrue(CatalogLogic.hidden(grouped,"all",List.of(),true));
        assertFalse(CatalogLogic.hidden(first,"all",List.of(),true));
        assertEquals("copyright",CatalogLogic.tagKind(grouped,"my_series"));
    }
    @Test public void recurringPairNeedsIndependentLikedAuthors(){
        List<Post> liked=new ArrayList<>();
        for(int i=0;i<3;i++)liked.add(post("danbooru",""+(i+1),"","red_author_"+i,"red_dress","black_shoes"));
        for(int i=0;i<3;i++)liked.add(post("danbooru",""+(i+4),"","blue_author_"+i,"blue_sky","mountain"));
        Recommendations.Model model=Recommendations.build(liked,Map.of(),0);
        assertTrue(model.queries.stream().anyMatch(query->query.contains("red_dress")&&query.contains("black_shoes")));
        for(Post post:liked)post.artistTag="same_artist";
        Recommendations.Model oneAuthor=Recommendations.build(liked,Map.of(),0);
        assertFalse(oneAuthor.queries.stream().anyMatch(query->query.contains("red_dress")&&query.contains("black_shoes")));
    }
}
