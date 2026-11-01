package com.artcatalog.mobile;

import java.util.*;
import org.junit.Test;
import static org.junit.Assert.*;

public class FeedViewportTest {
    @Test public void earlierDuplicateRemovalKeepsVisibleArtworkAndPixelOffset(){
        List<FeedViewport.Anchor> visible=List.of(new FeedViewport.Anchor(List.of("art:6","art:7"),4,-149),new FeedViewport.Anchor(List.of("art:8","art:9"),5,375));
        FeedViewport.Anchor result=FeedViewport.restore(visible,List.of(List.of("art:1","art:2"),List.of("art:3","art:4"),List.of("art:5","art:6"),List.of("art:7","art:8")));
        assertNotNull(result);assertEquals(2,result.position);assertEquals(-149,result.top);
    }
    @Test public void preferredMirrorCanBeLocatedThroughStrongAlias(){
        FeedViewport.Anchor result=FeedViewport.restore(List.of(new FeedViewport.Anchor(List.of("rule34:8"),2,23)),List.of(List.of("danbooru:1"),List.of("danbooru:2","rule34:8")));
        assertNotNull(result);assertEquals(1,result.position);assertEquals(23,result.top);
    }
    @Test public void removedFirstVisibleRowFallsBackToNextVisibleWorkAtItsOwnOffset(){
        FeedViewport.Anchor result=FeedViewport.restore(List.of(new FeedViewport.Anchor(List.of("removed"),4,-120),new FeedViewport.Anchor(List.of("survivor"),5,340)),List.of(List.of("other"),List.of("survivor")));
        assertNotNull(result);assertEquals(1,result.position);assertEquals(340,result.top);
    }
    @Test public void preferLeftArtworkEvenWhenItsPreviousPartnerMovesToEarlierRow(){
        FeedViewport.Anchor result=FeedViewport.restore(List.of(new FeedViewport.Anchor(List.of("left","right"),3,-20)),List.of(List.of("right","earlier"),List.of("left","new-partner")));
        assertNotNull(result);assertEquals(1,result.position);
    }
    @Test public void unrelatedNewVisitHasNoAnchor(){assertNull(FeedViewport.restore(List.of(new FeedViewport.Anchor(List.of("old"),0,0)),List.of(List.of("new"))));}
}
