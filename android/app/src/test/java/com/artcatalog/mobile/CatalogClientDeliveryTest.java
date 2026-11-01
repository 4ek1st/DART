package com.artcatalog.mobile;

import org.junit.Test;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.Assert.*;

public class CatalogClientDeliveryTest {
    @Test public void rule34AcceptsEmptyJsonAndXmlWithoutFalseSourceFailure() throws Exception {
        assertEquals(0,CatalogClient.parsePosts("rule34","").length());assertEquals(0,CatalogClient.parsePosts("rule34","[]").length());
        assertEquals(0,CatalogClient.parsePosts("rule34","<?xml version=\"1.0\"?><posts count=\"0\"/>").length());
        assertEquals("42",CatalogClient.parsePosts("rule34","<posts count=\"1\"><post id=\"42\" tags=\"landscape sky\" rating=\"s\" /></posts>").getJSONObject(0).getString("id"));
        assertEquals(1,CatalogClient.parsePosts("gelbooru","{\"post\":[{\"id\":42}]}").length());
    }
    @Test public void htmlAndExternalEntityXmlNeverBecomeEmptyResults() throws Exception {
        for(String body:List.of("<html><body>Challenge</body></html>","<!DOCTYPE posts [<!ENTITY data SYSTEM 'file:///never-read'>]><posts>&data;</posts>","{\"success\":false}","null")){
            try{CatalogClient.parsePosts("rule34",body);fail("An access or malformed response must not look empty");}catch(CatalogClient.ApiException expected){}
        }
    }
    @Test public void sourceSuccessAndFailureAreDeliveredBeforeSlowPeerCompletes() throws Exception {
        CountDownLatch slowEntered=new CountDownLatch(1),release=new CountDownLatch(1),success=new CountDownLatch(1),failure=new CountDownLatch(1);ExecutorService outer=Executors.newSingleThreadExecutor();
        CatalogClient client=new CatalogClient((source,query,page,rating,sort)->{
            if(source.equals("danbooru")){slowEntered.countDown();release.await();return new CatalogClient.Page();}
            if(source.equals("rule34"))throw new CatalogClient.ApiException("Limited",429,123456);
            CatalogClient.Page result=new CatalogClient.Page();result.fingerprints.put(source,"neutral");return result;
        });
        try{
            LinkedHashMap<String,Integer> pages=new LinkedHashMap<>();pages.put("danbooru",0);pages.put("rule34",0);pages.put("gelbooru",0);
            Future<CatalogClient.Page> result=outer.submit(()->client.search("landscape",pages,"general","latest",arrived->{if(arrived.fingerprints.containsKey("gelbooru"))success.countDown();if(arrived.errors.containsKey("rule34")){assertEquals(Long.valueOf(123456),arrived.retryAt.get("rule34"));failure.countDown();}}));
            assertTrue(slowEntered.await(2,TimeUnit.SECONDS));assertTrue(success.await(2,TimeUnit.SECONDS));assertTrue(failure.await(2,TimeUnit.SECONDS));assertFalse(result.isDone());release.countDown();
            assertTrue(result.get(2,TimeUnit.SECONDS).errors.containsKey("rule34"));
        }finally{release.countDown();client.close();outer.shutdownNow();}
    }
    @Test public void retryAfterIsBoundedAndProviderAliasesShareIdentity() {
        assertEquals(300000,CatalogClient.retryDelay("9223372036854775807"));assertEquals(2000,CatalogClient.retryDelay("2"));assertEquals(0,CatalogClient.retryDelay("-1"));assertEquals(0,CatalogClient.retryDelay("nonsense"));
        assertEquals("rule34",CatalogClient.provider("https://api.rule34.xxx/index.php"));assertEquals("rule34",CatalogClient.provider("https://rule34.xxx/index.php"));assertEquals("",CatalogClient.provider("https://example.org/"));
    }
}
