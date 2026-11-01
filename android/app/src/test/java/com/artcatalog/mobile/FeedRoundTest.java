package com.artcatalog.mobile;

import org.junit.Test;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;

public class FeedRoundTest {
    private FeedRound.Request r(String query,String source,int page){return new FeedRound.Request(query,Map.of(source,page));}
    private CatalogClient.Page page(String id){CatalogClient.Page p=new CatalogClient.Page();Post post=new Post();post.source="danbooru";post.id=id;p.posts.add(post);return p;}
    @Test public void fastStreamsSettleBeforeHeldSourceAndItsLaterQueries() throws Exception {
        CountDownLatch release=new CountDownLatch(1),fast=new CountDownLatch(2);List<String> delivered=Collections.synchronizedList(new ArrayList<>());ExecutorService caller=Executors.newSingleThreadExecutor();
        List<FeedRound.Request> requests=List.of(r("slow_a","rule34",0),r("slow_b","rule34",0),r("slow_c","rule34",0),r("fast_a","danbooru",3),r("fast_b","sankaku",2));
        try{Future<List<FeedRound.Result>> task=caller.submit(()->FeedRound.run(requests,request->{if(request.source().equals("rule34"))release.await();return page(request.query);},result->{delivered.add(result.request.query);if(!result.request.source().equals("rule34"))fast.countDown();},2000));
            assertTrue("Other sources must publish while Rule34 is held",fast.await(1,TimeUnit.SECONDS));assertFalse(task.isDone());assertEquals(Set.of("fast_a","fast_b"),new HashSet<>(delivered));release.countDown();assertEquals(5,task.get(2,TimeUnit.SECONDS).size());
            assertEquals(3,(int)requests.get(3).pages.get("danbooru"));assertEquals(2,(int)requests.get(4).pages.get("sankaku"));
        }finally{release.countDown();caller.shutdownNow();}
    }
    @Test public void roundHasOneDeadlineAndNeverAdvancesTimedOutCursor() throws Exception {
        CountDownLatch release=new CountDownLatch(1);FeedRound.Request slow=r("forest","gelbooru",7);long start=System.nanoTime();List<FeedRound.Result> settled=new ArrayList<>();
        try{List<FeedRound.Result> result=FeedRound.run(List.of(slow,r("sky","danbooru",9)),request->{if(request==slow)release.await();return page(request.query);},settled::add,150);
            assertEquals(2,result.size());assertEquals(2,settled.size());FeedRound.Result timeout=result.stream().filter(item->item.request==slow).findFirst().orElseThrow();assertTrue(timeout.page.errors.containsKey("gelbooru"));assertTrue(timeout.page.posts.isEmpty());assertEquals(7,(int)timeout.request.pages.get("gelbooru"));assertTrue(TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-start)<1000);
        }finally{release.countDown();}
    }
    @Test public void cancelInterruptsAllWorkersAndDoesNotPublishLateResults() throws Exception {
        CountDownLatch entered=new CountDownLatch(3),stopped=new CountDownLatch(3);AtomicInteger callbacks=new AtomicInteger();ExecutorService caller=Executors.newSingleThreadExecutor();
        try{Future<?> task=caller.submit(()->{try{FeedRound.run(List.of(r("a","danbooru",0),r("b","gelbooru",0),r("c","sankaku",0)),request->{entered.countDown();try{new CountDownLatch(1).await();return page("late");}finally{stopped.countDown();}},result->callbacks.incrementAndGet());fail("Should cancel");}catch(InterruptedException expected){Thread.currentThread().interrupt();}});
            assertTrue(entered.await(1,TimeUnit.SECONDS));task.cancel(true);assertTrue(stopped.await(1,TimeUnit.SECONDS));assertEquals(0,callbacks.get());
        }finally{caller.shutdownNow();}
    }
    @Test public void failuresDoNotStopOtherStreamsOrMutateInput() throws Exception {
        Map<String,Integer> source=new LinkedHashMap<>(Map.of("danbooru",4));FeedRound.Request first=new FeedRound.Request("forest",source);source.put("danbooru",99);
        List<FeedRound.Result> result=FeedRound.run(List.of(first,r("sky","sankaku",0)),request->{if(request==first)throw new java.io.IOException("private URL must not escape");return page("2");},r->{},1000);
        assertEquals(2,result.size());assertEquals(4,(int)first.pages.get("danbooru"));assertTrue(result.stream().anyMatch(r->r.page.posts.size()==1));assertFalse(result.stream().anyMatch(r->r.page.errors.toString().contains("private")));
    }
    @Test public void loopbackFastBodyPublishesWhilePeerBodyIsHeld() throws Exception {
        CountDownLatch release=new CountDownLatch(1),held=new CountDownLatch(1),ready=new CountDownLatch(1);ServerSocket server=new ServerSocket(0,8,InetAddress.getLoopbackAddress());ExecutorService connections=Executors.newCachedThreadPool(),caller=Executors.newSingleThreadExecutor();
        connections.submit(()->{try{while(!server.isClosed()){Socket socket=server.accept();connections.submit(()->{try(Socket client=socket){BufferedReader reader=new BufferedReader(new InputStreamReader(client.getInputStream(),StandardCharsets.US_ASCII));String line=reader.readLine();while(!reader.readLine().isEmpty()){}boolean slow=line.contains("/slow");OutputStream output=client.getOutputStream();output.write("HTTP/1.1 200 OK\r\nContent-Length: 1\r\nConnection: close\r\n\r\n".getBytes(StandardCharsets.US_ASCII));output.flush();if(slow){held.countDown();release.await();}output.write('1');output.flush();}catch(Exception ignored){}});}}catch(IOException ignored){}});
        try{Future<List<FeedRound.Result>> task=caller.submit(()->FeedRound.run(List.of(r("slow","rule34",0),r("fast","danbooru",0)),request->{HttpURLConnection connection=CatalogClient.open("http://127.0.0.1:"+server.getLocalPort()+"/"+request.query);try{assertEquals(200,connection.getResponseCode());try(InputStream body=connection.getInputStream()){assertEquals('1',body.read());}return page(request.query);}finally{connection.disconnect();}},result->{if(result.request.query.equals("fast"))ready.countDown();},2000));
            assertTrue(held.await(1,TimeUnit.SECONDS));assertTrue(ready.await(1,TimeUnit.SECONDS));assertFalse(task.isDone());release.countDown();assertEquals(2,task.get(2,TimeUnit.SECONDS).size());
        }finally{release.countDown();server.close();connections.shutdownNow();caller.shutdownNow();}
    }
    @Test public void limitsRejectInvalidStreams(){try{r("forest","danbooru",-1);fail();}catch(IllegalArgumentException expected){}
        List<FeedRound.Request> requests=new ArrayList<>();for(int i=0;i<13;i++)requests.add(r("q"+i,"danbooru",i));try{FeedRound.run(requests,r->page("1"),r->{});fail();}catch(IllegalArgumentException expected){}catch(InterruptedException impossible){fail();}}
}
