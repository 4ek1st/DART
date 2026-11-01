package com.artcatalog.mobile;

import org.junit.Test;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.Assert.*;

public class FollowingRequestPlannerTest {
    private static final List<String> SOURCES=List.of("danbooru","gelbooru","rule34","sankaku");
    private FeedRound.Request request(String author,String source,int page){return new FeedRound.Request(author,Map.of(source,page));}
    private List<FeedRound.Request> all(int authors,int page){List<FeedRound.Request> result=new ArrayList<>();for(int i=0;i<authors;i++)for(String source:SOURCES)result.add(request("artist_"+i,source,page));return result;}
    @Test public void firstRoundReachesTwelveAuthorsInsteadOfOnlyThree(){List<FeedRound.Request> ready=all(24,0),selected=FollowingRequestPlanner.select(ready,12);Set<String> authors=new HashSet<>();Map<String,Integer> sources=new HashMap<>();
        for(FeedRound.Request r:selected){authors.add(r.query);sources.merge(r.source(),1,Integer::sum);assertTrue(ready.stream().anyMatch(original->original==r));}assertEquals(12,authors.size());assertEquals(Map.of("danbooru",3,"gelbooru",3,"rule34",3,"sankaku",3),sources);
    }
    @Test public void everyAvailableInitialPagePrecedesAnyDeepBackcatalog(){FeedRound.Request old=request("old_artist","danbooru",4);List<FeedRound.Request> ready=new ArrayList<>(List.of(old));ready.addAll(all(4,0));List<FeedRound.Request> selected=FollowingRequestPlanner.select(ready,12);assertEquals(12,selected.size());assertFalse(selected.contains(old));for(FeedRound.Request r:selected)assertEquals(0,(int)r.pages.get(r.source()));}
    @Test public void canonicalAliasOwnerDoesNotReceiveTwoSlotsBeforeAnotherAuthor(){FeedRound.Request a=request("artist_a","danbooru",0),alias=request("other_tag_for_a","gelbooru",0),b=request("artist_b","rule34",0);List<FeedRound.Request> result=FollowingRequestPlanner.select(List.of(a,alias,b),2,r->r==b?"artist:b":"artist:a");assertEquals(List.of(a,b),result);}
    @Test public void oneAuthorStillLoadsEveryProviderAndRetainsOriginalCursors(){List<FeedRound.Request> ready=all(1,7);assertEquals(new HashSet<>(ready),new HashSet<>(FollowingRequestPlanner.select(ready,12)));for(FeedRound.Request r:ready)assertEquals(7,(int)r.pages.get(r.source()));assertTrue(FollowingRequestPlanner.select(ready,0).isEmpty());}
    @Test public void uploaderOnlyFollowsCannotExcludeOtherHealthyProvidersFromInitialWorkers(){List<FeedRound.Request> ready=new ArrayList<>();for(int i=0;i<16;i++)ready.add(request("user:"+(i+1),"danbooru",0));ready.addAll(all(1,0));
        List<FeedRound.Request> selected=FollowingRequestPlanner.select(ready,12),started=FeedRound.fair(selected).subList(0,4);Set<String> providers=new HashSet<>();for(FeedRound.Request r:started)providers.add(r.source());assertEquals(new HashSet<>(SOURCES),providers);
        Set<String> authors=new HashSet<>();for(FeedRound.Request r:selected)authors.add(r.query);assertTrue(authors.size()>=9);
    }
    @Test public void actualRoundStartsFourProvidersAndFourAuthorsBeforeAnyHeldBodyFinishes() throws Exception {List<FeedRound.Request> selected=FollowingRequestPlanner.select(all(16,0),12);Set<String> sources=ConcurrentHashMap.newKeySet(),authors=ConcurrentHashMap.newKeySet();CountDownLatch entered=new CountDownLatch(4),release=new CountDownLatch(1);ExecutorService caller=Executors.newSingleThreadExecutor();
        try{Future<?> round=caller.submit(()->{try{FeedRound.run(selected,r->{sources.add(r.source());authors.add(r.query);entered.countDown();release.await();return new CatalogClient.Page();},r->{});}catch(InterruptedException e){Thread.currentThread().interrupt();}});assertTrue(entered.await(2,TimeUnit.SECONDS));assertEquals(new HashSet<>(SOURCES),sources);assertEquals(4,authors.size());assertFalse(round.isDone());release.countDown();round.get(2,TimeUnit.SECONDS);
        }finally{release.countDown();caller.shutdownNow();}
    }
}
