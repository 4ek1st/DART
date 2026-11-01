package com.artcatalog.mobile;

import org.junit.Test;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.Assert.*;

public class FeedRoundFairnessTest {
    @Test public void fourthHealthyProviderSettlesBeforeThreeHeldProvidersAreReleased() throws Exception {
        CountDownLatch entered=new CountDownLatch(3),release=new CountDownLatch(1),healthy=new CountDownLatch(1);ExecutorService caller=Executors.newSingleThreadExecutor();List<FeedRound.Request> requests=new ArrayList<>();
        for(String source:List.of("danbooru","gelbooru","rule34","sankaku"))requests.add(new FeedRound.Request("landscape",Map.of(source,0)));
        try{
            Future<List<FeedRound.Result>> round=caller.submit(()->FeedRound.run(requests,request->{if(!request.source().equals("sankaku")){entered.countDown();release.await();}return new CatalogClient.Page();},result->{if(result.request.source().equals("sankaku"))healthy.countDown();}));
            assertTrue(entered.await(2,TimeUnit.SECONDS));assertTrue("The healthy fourth service must not wait for the other sources",healthy.await(2,TimeUnit.SECONDS));assertFalse(round.isDone());assertEquals(1,release.getCount());release.countDown();assertEquals(4,round.get(2,TimeUnit.SECONDS).size());
        }finally{release.countDown();caller.shutdownNow();}
    }
}
