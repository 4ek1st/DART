package com.artcatalog.mobile;

import android.content.SharedPreferences;
import org.junit.Test;
import java.lang.reflect.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.*;
import static org.junit.Assert.*;

/** Actual store mutations with in-memory state; no Android files, preferences or workers run. */
public class StoreProfilePerformanceTest {
    private void field(Store store,String name,Object value) throws Exception {Field field=Store.class.getDeclaredField(name);field.setAccessible(true);field.set(store,value);}
    private Post post(int id){Post p=new Post();p.source="danbooru";p.id=String.valueOf(id);return p;}
    private Store store(List<Post> likes,AtomicInteger resolutions) throws Exception {
        Class<?> unsafeType=Class.forName("sun.misc.Unsafe");Field singleton=unsafeType.getDeclaredField("theUnsafe");singleton.setAccessible(true);
        Store store=(Store)unsafeType.getMethod("allocateInstance",Class.class).invoke(singleton.get(null),Store.class);
        field(store,"warning","Isolated test: disk writes disabled");
        for(String name:List.of("bookmarks","history","catalogue","openWorks","follows"))field(store,name,new LinkedHashMap<>());
        field(store,"hiddenAuthors",new LinkedHashSet<String>());field(store,"viewedIdentities",new LinkedHashSet<String>());
        field(store,"exposureGroups",new ArrayList<List<String>>());field(store,"recentSuggestions",new LinkedHashSet<String>());
        SharedPreferences prefs=(SharedPreferences)Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{SharedPreferences.class},(proxy,method,args)->{
            if(method.getName().equals("getBoolean"))return args[1];if(method.getName().equals("getString"))return args[1];if(method.getName().equals("getAll"))return Map.of();return null;
        });field(store,"prefs",prefs);
        Store.SavedIdentityIndex index=new Store.SavedIdentityIndex(p->{resolutions.incrementAndGet();return WorkGrouping.viewedTokens(p);});LinkedHashMap<String,Post> saved=new LinkedHashMap<>();for(Post p:likes){saved.put(p.key(),p);index.put(p);}
        Store.SavedIdentityIndex empty=new Store.SavedIdentityIndex();field(store,"likes",saved);field(store,"likedIndex",index);field(store,"likedTokens",index.tokens());field(store,"bookmarkIndex",empty);field(store,"bookmarkTokens",empty.tokens());
        try{field(store,"knownTokensRevision",Long.MIN_VALUE);field(store,"knownTokens",Set.of());}catch(NoSuchFieldException baseline){}
        try{field(store,"tastePreparation",new Object());}catch(NoSuchFieldException baseline){}
        resolutions.set(0);return store;
    }
    private Method method(String name,Class<?>...parameters){try{Method method=Store.class.getDeclaredMethod(name,parameters);method.setAccessible(true);return method;}catch(NoSuchMethodException missing){throw new AssertionError("Missing cached store operation: "+name,missing);}}
    private long revision(Store store) throws Exception {Field field=Store.class.getDeclaredField("profileRevision");field.setAccessible(true);return field.getLong(store);}
    @Test public void metadataRefreshOnlyResolvesTheAffectedSavedRecord() throws Exception {
        List<Post> posts=new ArrayList<>();for(int i=0;i<4000;i++)posts.add(post(i));AtomicInteger resolutions=new AtomicInteger();Store store=store(posts,resolutions);
        Post enriched=post(2);enriched.hash="a".repeat(32);store.refreshCachedPost(enriched);assertEquals(1,resolutions.get());assertTrue(store.liked(enriched));
        resolutions.set(0);store.refreshCachedPost(post(99999));assertEquals("Unsaved metadata never rebuilds the library",0,resolutions.get());
    }
    @Test public void repeatedKnownFilteringReusesSnapshotUntilAViewChangesIt() throws Exception {
        AtomicInteger resolutions=new AtomicInteger();Store store=store(List.of(post(1)),resolutions);Method snapshot=method("knownTokensSnapshot");
        Set<?> first=(Set<?>)snapshot.invoke(store);assertSame(first,snapshot.invoke(store));assertTrue(first.contains("key:danbooru:1"));
        store.visit(post(2));Set<?> next=(Set<?>)snapshot.invoke(store);assertNotSame(first,next);assertTrue(next.contains("key:danbooru:2"));assertFalse("Older background snapshots stay immutable",first.contains("key:danbooru:2"));assertSame(next,snapshot.invoke(store));
    }
    @SuppressWarnings("unchecked") @Test public void excludingLikedCandidatesUsesTheIndexAndPreservesDistinctConfirmedPublications() throws Exception {
        Post saved=post(1);saved.hash="b".repeat(32);saved.groupKey="rule34:parent:7";saved.originalUrl="https://www.pixiv.net/artworks/11111";
        AtomicInteger resolutions=new AtomicInteger();Store store=store(List.of(saved),resolutions);Post mirror=post(2);mirror.hash=saved.hash;Post different=post(3);different.groupKey=saved.groupKey;different.originalUrl="https://www.pixiv.net/artworks/22222";Post fresh=post(4);
        List<Post> visible=(List<Post>)method("excludeLiked",List.class).invoke(store,List.of(mirror,different,fresh));
        assertEquals(List.of(different,fresh),visible);assertEquals("Filtering does not reparse saved records",0,resolutions.get());
    }
    @Test public void emptySourcePagesAndUnrelatedAuthorsDoNotDirtyTheWholeProfile() throws Exception {
        Store store=store(List.of(post(1)),new AtomicInteger());long before=revision(store);
        store.remember(List.of());store.markSeen(post(2));
        assertEquals("No collection changed, so there is nothing to serialize",before,revision(store));
    }
    @Test public void aBurstOfViewsQueuesOneDeferredSaveWithoutStartingFullSerialization() throws Exception {
        Store store=store(List.of(post(1)),new AtomicInteger());QueueExecutor queue=new QueueExecutor();field(store,"writes",queue);field(store,"warning","");
        store.visit(post(2));store.visit(post(3));store.visit(post(4));
        assertEquals(1,queue.queued);assertTrue("A short batching window combines adjacent UI mutations before snapshot preparation",queue.delayMillis>=100);assertTrue(queue.delayMillis<=1000);
    }
    @Test public void backgroundFlushReplacesTheDelayAndRepeatedFlushDoesNotDuplicateWork() throws Exception {
        Store store=store(List.of(post(1)),new AtomicInteger());QueueExecutor queue=new QueueExecutor();field(store,"writes",queue);field(store,"warning","");store.visit(post(2));
        method("flushPending").invoke(store);assertTrue(queue.tasks.get(0).isCancelled());assertEquals(0,queue.delayMillis);assertEquals(2,queue.queued);
        method("flushPending").invoke(store);assertEquals("Only the one immediate callback remains active",2,queue.queued);assertFalse(queue.tasks.get(1).isCancelled());
    }
    private Object taste(Store store) throws Exception {return method("curationTaste").invoke(store);}
    private long likedRevision(Store store) throws Exception {return (Long)method("likedMetadataRevision").invoke(store);}
    @Test public void sharedTasteSurvivesViewsBookmarksAndExposureAcrossScreens() throws Exception {
        Store store=store(List.of(post(1)),new AtomicInteger());Object first=taste(store);long revision=likedRevision(store);
        store.visit(post(2));store.toggle(post(3));store.markSuggested(List.of(post(4)));store.refreshCachedPost(post(999));
        assertEquals(revision,likedRevision(store));assertSame("A route change can reuse the same immutable taste",first,taste(store));
    }
    @Test public void actualLikeChangesRebuildTasteButIdempotentLikesDoNot() throws Exception {
        Store store=store(List.of(post(1)),new AtomicInteger());Object first=taste(store);long initial=likedRevision(store);
        assertFalse(store.like(post(1)));assertEquals(initial,likedRevision(store));assertSame(first,taste(store));
        assertTrue(store.like(post(2)));assertEquals(initial+1,likedRevision(store));Object second=taste(store);assertNotSame(first,second);
        assertFalse(store.toggleLike(post(2)));assertEquals(initial+2,likedRevision(store));assertNotSame(second,taste(store));
    }
    @Test public void likedMetadataAndAliasEnrichmentInvalidateTasteWithoutALikeToggle() throws Exception {
        Post original=post(1);original.tags.add("watercolor_landscape");Store store=store(List.of(original),new AtomicInteger());Object first=taste(store);long revision=likedRevision(store);
        Post enriched=post(1);enriched.tags.add("architectural_scenery");enriched.memberKeys.add("gelbooru:2");store.refreshCachedPost(enriched);
        assertEquals(revision+1,likedRevision(store));Object second=taste(store);assertNotSame(first,second);
        Field weights=second.getClass().getDeclaredField("weights");weights.setAccessible(true);assertTrue(((Map<?,?>)weights.get(second)).containsKey("architectural scenery"));assertFalse(((Map<?,?>)weights.get(second)).containsKey("watercolor landscape"));
    }
    @Test public void tastePreparationRunsOutsideStoreLockAndRejectsAStaleRevision() throws Exception {
        Post original=post(1);final Store[] holder={null};java.util.concurrent.atomic.AtomicBoolean changed=new java.util.concurrent.atomic.AtomicBoolean();
        original.tags=new ArrayList<String>(List.of("watercolor_landscape")){
            @Override public Iterator<String> iterator(){assertFalse("Expensive taste preparation must not block UI store reads",Thread.holdsLock(holder[0]));if(changed.compareAndSet(false,true))holder[0].like(post(2));return super.iterator();}
        };
        Store store=store(List.of(original),new AtomicInteger());holder[0]=store;Object result=taste(store);Field count=result.getClass().getDeclaredField("likedCount");count.setAccessible(true);
        assertEquals("A result computed before the added like must not be published",2,count.getInt(result));assertSame(result,taste(store));
    }
    private static final class QueueExecutor extends AbstractExecutorService implements ScheduledExecutorService {
        int queued;long delayMillis;boolean stopped;List<Deferred> tasks=new ArrayList<>();
        public void execute(Runnable job){queued++;delayMillis=0;}
        public ScheduledFuture<?> schedule(Runnable job,long delay,TimeUnit unit){queued++;delayMillis=unit.toMillis(delay);Deferred task=new Deferred(job,delayMillis);tasks.add(task);return task;}
        public <V> ScheduledFuture<V> schedule(Callable<V> job,long delay,TimeUnit unit){throw new UnsupportedOperationException();}
        public ScheduledFuture<?> scheduleAtFixedRate(Runnable job,long initial,long interval,TimeUnit unit){throw new UnsupportedOperationException();}
        public ScheduledFuture<?> scheduleWithFixedDelay(Runnable job,long initial,long interval,TimeUnit unit){throw new UnsupportedOperationException();}
        public void shutdown(){stopped=true;}public List<Runnable> shutdownNow(){stopped=true;return List.of();}public boolean isShutdown(){return stopped;}public boolean isTerminated(){return stopped;}public boolean awaitTermination(long time,TimeUnit unit){return stopped;}
    }
    private static final class Deferred extends FutureTask<Void> implements ScheduledFuture<Void> {
        final long delay;Deferred(Runnable job,long delay){super(job,null);this.delay=delay;}
        public long getDelay(TimeUnit unit){return unit.convert(delay,TimeUnit.MILLISECONDS);}public int compareTo(Delayed other){return Long.compare(getDelay(TimeUnit.MILLISECONDS),other.getDelay(TimeUnit.MILLISECONDS));}
    }
}
