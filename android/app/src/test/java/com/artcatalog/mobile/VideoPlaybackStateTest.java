package com.artcatalog.mobile;

import org.junit.Test;
import java.util.List;
import static org.junit.Assert.*;

public class VideoPlaybackStateTest {
    @Test public void preparedIsNotAVisibleFrameAndKeepsThePoster(){
        VideoPlaybackState state=new VideoPlaybackState();long token=state.begin();
        assertTrue(state.posterVisible());assertTrue(state.loading());
        assertTrue(state.prepared(token));assertTrue(state.posterVisible());assertTrue(state.loading());
        assertTrue(state.rendered(token));assertFalse(state.posterVisible());assertFalse(state.loading());
        assertFalse(state.rendered(token));
    }
    @Test public void aNewSelectionRejectsOldPreparationFramesAndErrors(){
        VideoPlaybackState state=new VideoPlaybackState();long old=state.begin(),current=state.begin();
        assertFalse(state.prepared(old));assertFalse(state.rendered(old));assertFalse(state.fail(old));
        assertTrue(state.posterVisible());assertTrue(state.prepared(current));assertTrue(state.rendered(current));
    }
    @Test public void failureShowsPosterAndRetryGetsAnIndependentSession(){
        VideoPlaybackState state=new VideoPlaybackState();long failed=state.begin();state.prepared(failed);state.rendered(failed);
        assertTrue(state.fail(failed));assertTrue(state.posterVisible());assertFalse(state.loading());
        assertFalse(state.prepared(failed));assertFalse(state.rendered(failed));
        long retry=state.begin();assertTrue(state.posterVisible());assertTrue(state.prepared(retry));assertTrue(state.rendered(retry));
        assertFalse(state.fail(failed));assertFalse(state.posterVisible());
    }
    @Test public void closingMakesEveryPendingCallbackHarmless(){
        VideoPlaybackState state=new VideoPlaybackState();long token=state.begin();state.close();
        assertFalse(state.current(token));assertFalse(state.prepared(token));assertFalse(state.rendered(token));assertFalse(state.fail(token));
        assertFalse(state.loading());
    }
    @Test public void bufferingKeepsAnAlreadyDecodedFrameVisible(){
        VideoPlaybackState state=new VideoPlaybackState();long token=state.begin();state.prepared(token);state.rendered(token);
        state.buffering(token,true);assertTrue(state.loading());assertFalse(state.posterVisible());
        state.buffering(token,false);assertFalse(state.loading());assertFalse(state.posterVisible());
    }
    @Test public void surfaceRecreationNeedsAFreshFrameBeforeThePosterHidesAgain(){
        VideoPlaybackState state=new VideoPlaybackState();long token=state.begin();state.prepared(token);state.rendered(token);
        assertTrue(state.surfaceLost(token));assertTrue(state.posterVisible());assertTrue(state.loading());
        assertTrue(state.prepared(token));assertTrue(state.posterVisible());assertTrue(state.rendered(token));assertFalse(state.posterVisible());
        state.close();assertFalse(state.surfaceLost(token));
    }
    @Test public void signedUrlsAvoidUnnecessaryRenewalUntilTheyNearExpiry(){
        long now=1800000000000L;
        assertFalse(VideoPlaybackState.expiring("https://s.sankakucomplex.com/a.mp4?e=1800000600&m=sig",now));
        assertTrue(VideoPlaybackState.expiring("https://s.sankakucomplex.com/a.mp4?e=1800000010&m=sig",now));
        assertTrue(VideoPlaybackState.expiring("https://s.sankakucomplex.com/a.mp4?expires=1799999999&token=sig",now));
        assertFalse(VideoPlaybackState.expiring("https://s.sankakucomplex.com/a.mp4",now));
    }
    @Test public void aClickedVariantSelectsItsOwnMediaInsteadOfTheScrollPosition(){
        List<String> urls=List.of("https://cdn.donmai.us/a.mp4","https://cdn.donmai.us/b.jpg","https://cdn.donmai.us/c.mp4");
        assertEquals(0,VideoPlaybackState.selectedIndex(urls,urls.get(0),2));
        assertEquals(2,VideoPlaybackState.selectedIndex(urls,urls.get(2),0));
        assertEquals(0,VideoPlaybackState.selectedIndex(urls,"missing",0));
    }
    @Test public void aGroupedVideoUsesItsExactLeafPosterInsteadOfThePrimaryWork(){
        Post owner=new Post(),leaf=new Post();owner.preview="https://cdn.donmai.us/parent.jpg";
        leaf.image="https://cdn.donmai.us/sample-second.mp4";leaf.original="https://cdn.donmai.us/second.mp4";
        leaf.preview="https://cdn.donmai.us/second.jpg";leaf.smallPreview="https://cdn.donmai.us/second-small.jpg";owner.groupMembers=List.of(leaf);
        assertArrayEquals(new String[]{leaf.preview,leaf.smallPreview},VideoPlaybackState.posterFor(owner,leaf.image));
        assertArrayEquals(new String[]{leaf.preview,leaf.smallPreview},VideoPlaybackState.posterFor(owner,leaf.original));
        assertEquals("https://cdn.donmai.us/parent.jpg",owner.preview);
    }
    @Test public void signatureRenewalStillFindsTheExactVideoOwner(){
        Post owner=new Post(),leaf=new Post();String path="/o/ab/cd/0123456789abcdef0123456789abcdef.mp4";
        leaf.image="https://s.sankakucomplex.com"+path+"?e=1800000000&m=old";
        leaf.preview="https://s.sankakucomplex.com/own-poster.jpg?e=1800000000&m=poster";owner.groupMembers=List.of(leaf);
        assertArrayEquals(new String[]{leaf.preview,""},VideoPlaybackState.posterFor(owner,"https://v.sankakucomplex.com"+path+"?e=1800000600&m=fresh"));
    }
    @Test public void unknownVariantNeverInheritsAnUnrelatedPrimaryPoster(){
        Post owner=new Post(),leaf=new Post();owner.preview="https://cdn.donmai.us/parent.jpg";owner.smallPreview=owner.preview;
        leaf.image="https://cdn.donmai.us/other.mp4";leaf.preview="https://cdn.donmai.us/other.jpg";owner.groupMembers=List.of(leaf);
        assertArrayEquals(new String[]{"",""},VideoPlaybackState.posterFor(owner,"https://cdn.donmai.us/unknown.mp4"));
        assertArrayEquals(new String[]{"",""},VideoPlaybackState.posterFor(owner,""));
    }
    @Test public void membershipInAMultiMediaLeafDoesNotProveWhichPosterBelongsToAVariant(){
        Post owner=new Post(),leaf=new Post();String second="https://cdn.donmai.us/second.mp4";
        leaf.image="https://cdn.donmai.us/first.mp4";leaf.preview="https://cdn.donmai.us/first.jpg";leaf.media=List.of(leaf.image,second);owner.groupMembers=List.of(leaf);
        assertArrayEquals(new String[]{"",""},VideoPlaybackState.posterFor(owner,second));
    }
}
