package com.artcatalog.mobile;

import org.junit.Test;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import static org.junit.Assert.*;

public class CatalogTransportTest {
    private CatalogTransport.RequestCache cache(AtomicLong clock,int entries,int bytes){return new CatalogTransport.RequestCache(clock::get,FutureTask::new,4,8,entries,bytes);}
    private void await(java.util.function.BooleanSupplier condition) throws Exception {long until=System.nanoTime()+TimeUnit.SECONDS.toNanos(3);while(!condition.getAsBoolean()&&System.nanoTime()<until)Thread.sleep(5);assertTrue("Condition did not settle",condition.getAsBoolean());}

    @Test public void cacheCoalescesRequestsAndKeepsSuccessUntilTtl() throws Exception {
        AtomicLong clock=new AtomicLong();AtomicInteger calls=new AtomicInteger();CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1);ExecutorService readers=Executors.newFixedThreadPool(2);
        try(CatalogTransport.RequestCache cache=cache(clock,4,1024)){
            Callable<String> loader=()->{calls.incrementAndGet();entered.countDown();release.await();return "neutral";};
            Future<String> first=readers.submit(()->cache.get("same",1000,loader));assertTrue(entered.await(2,TimeUnit.SECONDS));
            Future<String> second=readers.submit(()->cache.get("same",1000,loader));await(()->cache.readers("same")==2);release.countDown();
            assertEquals("neutral",first.get(2,TimeUnit.SECONDS));assertEquals("neutral",second.get(2,TimeUnit.SECONDS));
            assertEquals("neutral",cache.get("same",1000,loader));assertEquals(1,calls.get());clock.set(1001);cache.get("same",1000,loader);assertEquals(2,calls.get());
        }finally{release.countDown();readers.shutdownNow();}
    }
    @Test public void cancelingOneReaderDoesNotCancelAnotherReader() throws Exception {
        AtomicLong clock=new AtomicLong();CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1);AtomicBoolean loaderInterrupted=new AtomicBoolean();ExecutorService readers=Executors.newFixedThreadPool(2);
        try(CatalogTransport.RequestCache cache=cache(clock,4,1024)){
            Callable<String> loader=()->{entered.countDown();try{release.await();}catch(InterruptedException stopped){loaderInterrupted.set(true);throw stopped;}return "landscape";};
            Future<String> first=readers.submit(()->cache.get("same",1000,loader));assertTrue(entered.await(2,TimeUnit.SECONDS));Future<String> second=readers.submit(()->cache.get("same",1000,loader));await(()->cache.readers("same")==2);
            first.cancel(true);await(()->cache.readers("same")==1);assertFalse(loaderInterrupted.get());release.countDown();assertEquals("landscape",second.get(2,TimeUnit.SECONDS));
        }finally{release.countDown();readers.shutdownNow();}
    }
    @Test public void cancelingLastReaderInterruptsWorkAndDoesNotCacheFailure() throws Exception {
        CountDownLatch entered=new CountDownLatch(1),interrupted=new CountDownLatch(1);ExecutorService readers=Executors.newSingleThreadExecutor();
        try(CatalogTransport.RequestCache cache=cache(new AtomicLong(),4,1024)){
            Future<String> first=readers.submit(()->cache.get("same",1000,()->{entered.countDown();try{new CountDownLatch(1).await();}catch(InterruptedException stop){interrupted.countDown();throw stop;}return "never";}));
            assertTrue(entered.await(2,TimeUnit.SECONDS));first.cancel(true);assertTrue(interrupted.await(2,TimeUnit.SECONDS));assertEquals(0,cache.cacheSize());
            assertEquals("retry",cache.get("same",1000,()->"retry"));
        }finally{readers.shutdownNow();}
    }
    @Test public void foregroundCanStartWhileOrdinaryWorkersAreHeld() throws Exception {
        CountDownLatch ordinary=new CountDownLatch(3),release=new CountDownLatch(1);ExecutorService readers=Executors.newFixedThreadPool(4);
        try(CatalogTransport.RequestCache cache=cache(new AtomicLong(),4,1024)){
            for(int i=0;i<3;i++){String key="ordinary"+i;readers.submit(()->cache.get(key,0,()->{ordinary.countDown();release.await();return key;}));}
            assertTrue(ordinary.await(2,TimeUnit.SECONDS));Future<String> foreground=readers.submit(()->cache.get("foreground",0,0,priority->"ready"));
            assertEquals("ready",foreground.get(2,TimeUnit.SECONDS));assertEquals(1,release.getCount());
        }finally{release.countDown();readers.shutdownNow();}
    }
    @Test public void fourthProviderCanStartWhileThreeOtherProvidersAreHeld() throws Exception {
        CountDownLatch ordinary=new CountDownLatch(3),release=new CountDownLatch(1);ExecutorService readers=Executors.newFixedThreadPool(4);
        try(CatalogTransport.RequestCache cache=new CatalogTransport.RequestCache(System::currentTimeMillis,FutureTask::new,5,8,4,1024)){
            for(String provider:List.of("danbooru","gelbooru","rule34"))readers.submit(()->cache.get(provider,0,()->{ordinary.countDown();release.await();return provider;}));
            assertTrue(ordinary.await(2,TimeUnit.SECONDS));Future<String> fourth=readers.submit(()->cache.get("sankaku",0,()->"ready"));assertEquals("ready",fourth.get(2,TimeUnit.SECONDS));assertEquals(1,release.getCount());
        }finally{release.countDown();readers.shutdownNow();}
    }
    @Test public void foregroundAdoptsQueuedOrdinaryRequestWithoutStartingAnotherLoader() throws Exception {
        CountDownLatch ordinary=new CountDownLatch(3),release=new CountDownLatch(1);ExecutorService readers=Executors.newFixedThreadPool(5);AtomicInteger loads=new AtomicInteger();
        try(CatalogTransport.RequestCache cache=cache(new AtomicLong(),8,1024)){
            for(int i=0;i<3;i++){String key="ordinary"+i;readers.submit(()->cache.get(key,0,()->{ordinary.countDown();release.await();return key;}));}
            assertTrue(ordinary.await(2,TimeUnit.SECONDS));Future<String> waiting=readers.submit(()->cache.get("adopt",0,1,priority->{loads.incrementAndGet();assertEquals(0,priority.getAsInt());return "shared";}));
            await(()->cache.readers("adopt")==1);Future<String> foreground=readers.submit(()->cache.get("adopt",0,0,priority->{throw new AssertionError("Existing request must be reused");}));
            assertEquals("shared",foreground.get(2,TimeUnit.SECONDS));assertEquals("shared",waiting.get(2,TimeUnit.SECONDS));assertEquals(1,loads.get());assertEquals(1,release.getCount());
        }finally{release.countDown();readers.shutdownNow();}
    }
    @Test public void cacheIsBoundedByEntriesAndApproximateStringBytes() throws Exception {
        try(CatalogTransport.RequestCache cache=cache(new AtomicLong(),2,16)){
            cache.get("one",1000,()->"1234");cache.get("two",1000,()->"5678");cache.get("three",1000,()->"9012");assertEquals(2,cache.cacheSize());assertEquals(16,cache.cachedBytes());
            cache.get("large",1000,()->"123456789");assertEquals(2,cache.cacheSize());cache.invalidate();assertEquals(0,cache.cachedBytes());
        }
    }
    @Test public void capacityReservesAnInteractiveSlotAndBoundsBackground() throws Exception {
        CatalogTransport.Capacity capacity=new CatalogTransport.Capacity(5,4,2);List<CatalogTransport.Capacity.Permit> held=new ArrayList<>();ExecutorService threads=Executors.newFixedThreadPool(2);
        try{
            held.add(capacity.acquire(()->2));held.add(capacity.acquire(()->2));Future<CatalogTransport.Capacity.Permit> background=threads.submit(()->capacity.acquire(()->2));
            held.add(capacity.acquire(()->1));held.add(capacity.acquire(()->1));Future<CatalogTransport.Capacity.Permit> ordinary=threads.submit(()->capacity.acquire(()->1));
            try(CatalogTransport.Capacity.Permit foreground=capacity.acquire(()->0)){assertEquals(5,capacity.active());assertFalse(background.isDone());assertFalse(ordinary.isDone());}
            background.cancel(true);held.remove(3).close();held.add(ordinary.get(2,TimeUnit.SECONDS));
        }finally{for(CatalogTransport.Capacity.Permit permit:held)permit.close();threads.shutdownNow();}
    }
    @Test public void cooldownIsSharedPerProviderAndClearedOnlyAfterSuccess() {
        AtomicLong clock=new AtomicLong(1000);CatalogTransport.Backoff state=new CatalogTransport.Backoff(clock::get);
        assertEquals(31000,state.fail("rule34",429,0));assertEquals(31000,state.retryAt("rule34"));assertEquals(0,state.retryAt("gelbooru"));
        clock.set(31001);assertEquals(0,state.retryAt("rule34"));assertEquals(91001,state.fail("rule34",429,0));state.success("rule34");assertEquals(0,state.retryAt("rule34"));
        assertEquals(0,state.fail("rule34",422,0));assertEquals(0,state.retryAt("rule34"));assertEquals(331001,state.fail("sankaku",503,Long.MAX_VALUE));
    }
    @Test public void lateSuccessCannotEraseNewerProviderCooldown() {
        CatalogTransport.Backoff state=new CatalogTransport.Backoff(()->1000);long olderRequest=state.revision("rule34");state.fail("rule34",429,0);
        state.success("rule34",olderRequest);assertEquals(31000,state.retryAt("rule34"));long nextRequest=state.revision("rule34");state.success("rule34",nextRequest);assertEquals(0,state.retryAt("rule34"));
    }
    @Test public void imageQueueIsBoundedAndMaintainsPriorityOrdering() {
        CatalogTransport.BoundedPriorityQueue<Integer> queue=new CatalogTransport.BoundedPriorityQueue<>(2);
        assertTrue(queue.offer(5));assertTrue(queue.offer(1));assertFalse(queue.offer(0));assertEquals(0,queue.remainingCapacity());assertEquals(Integer.valueOf(1),queue.poll());assertTrue(queue.offer(0));assertEquals(Integer.valueOf(0),queue.poll());
    }
    @Test public void realLoopbackResponseIsCachedWithoutAnotherConnection() throws Exception {
        try(ServerSocket server=new ServerSocket(0,5,InetAddress.getByName("127.0.0.1"))){
            ExecutorService serving=Executors.newSingleThreadExecutor();AtomicInteger connections=new AtomicInteger();
            Future<?> serve=serving.submit(()->{try(Socket socket=server.accept()){
                connections.incrementAndGet();BufferedReader reader=new BufferedReader(new InputStreamReader(socket.getInputStream(),StandardCharsets.US_ASCII));String line;while((line=reader.readLine())!=null&&!line.isEmpty()){}
                byte[] body="{\"neutral\":true}".getBytes(StandardCharsets.UTF_8);OutputStream output=socket.getOutputStream();output.write(("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: "+body.length+"\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII));output.write(body);output.flush();
            }catch(IOException failure){throw new RuntimeException(failure);}});
            try{String url="http://127.0.0.1:"+server.getLocalPort()+"/neutral";assertEquals("{\"neutral\":true}",CatalogClient.get(url));assertEquals("{\"neutral\":true}",CatalogClient.get(url));serve.get(2,TimeUnit.SECONDS);assertEquals(1,connections.get());}finally{serving.shutdownNow();}
        }
    }
}
