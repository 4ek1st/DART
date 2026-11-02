package com.artcatalog.mobile;

import org.junit.Test;
import java.util.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.*;
import java.lang.reflect.Field;
import static org.junit.Assert.*;

public class MediaIdentityTokenTest {
    private static final class ObservedRecord extends org.json.JSONObject {int serializations;@Override public String toString(){serializations++;return super.toString();}}
    @org.junit.Test public void groupingTokenProjectionDoesNotSerializeImageRecordJson() throws Exception {Post p=new Post();p.source="danbooru";p.id="1";p.image="https://cdn.donmai.us/neutral/one.jpg";p.media=java.util.List.of(p.image);ObservedRecord record=new ObservedRecord();record.put("url",p.image).put("hash","0123456789abcdef0123456789abcdef").put("owner",p.key());p.imageRecords.put(record);java.util.Set<String> tokens=WorkGrouping.tokens(p);org.junit.Assert.assertTrue(tokens.contains("hash:0123456789abcdef0123456789abcdef"));org.junit.Assert.assertEquals("Identity-only lookups must not JSON-encode image records",0,record.serializations);}
    @Test public void directMediaProjectionMatchesEveryRecordFallbackWithoutChangingGalleryRecords() throws Exception {List<String> urls=List.of("https://cdn.donmai.us/neutral/one.jpg","https://cdn.donmai.us/"+"A".repeat(32)+".png","https://v.sankakucomplex.com/preview/a.jpg?e=1&m=signature","", "not a URL");for(int count=0;count<=5;count++)for(int mode=0;mode<5;mode++){Post p=new Post();p.source="danbooru";p.id="1";p.hash="b".repeat(32);p.image=urls.get(mode);p.media=new ArrayList<>(urls.subList(0,count));for(String url:p.media){p.imageRecords.put(new org.json.JSONObject().put("url",url).put("hash",mode==0?"C".repeat(32):mode==1?"":mode==2?"invalid":org.json.JSONObject.NULL));if(mode==4)p.imageRecords.put(new org.json.JSONObject().put("url",url).put("hash","d".repeat(32)));}String before=p.imageRecords.toString();Set<String> expected=new HashSet<>(Set.of("sentinel"));org.json.JSONArray records=MediaIdentity.records(p);for(int i=0;i<records.length();i++){org.json.JSONObject record=records.getJSONObject(i);String token=MediaIdentity.token(record.optString("url")),hash=record.optString("hash");if(!token.isBlank())expected.add(token);if(hash.matches("(?i)[a-f0-9]{32}"))expected.add("hash:"+hash.toLowerCase(Locale.ROOT));}Set<String> actual=new HashSet<>(Set.of("sentinel"));MediaIdentity.addTokens(p,actual);assertEquals("count="+count+", mode="+mode,expected,actual);assertEquals(before,p.imageRecords.toString());}}
    private String reference(String raw){try{String url=MediaIdentity.cacheKey(raw);URI uri=URI.create(url);if(!Set.of("https","http").contains(uri.getScheme().toLowerCase(Locale.ROOT)))return "";int fragment=url.indexOf('#');if(fragment>=0)url=url.substring(0,fragment);StringBuilder result=new StringBuilder("group:media:");for(byte b:MessageDigest.getInstance("SHA-256").digest(url.getBytes(StandardCharsets.UTF_8)))result.append(String.format(Locale.ROOT,"%02x",b&255));return result.toString();}catch(Exception ignored){return "";}}
    @Test public void cachedDirectHexTokensExactlyMatchFormerAlgorithm(){List<String> urls=new ArrayList<>(List.of("", "not a URL", "data:image/png;base64,abc", "https://cdn.donmai.us/a.jpg#bad fragment", "https://cdn.donmai.us/a.jpg#frame", "https://v.sankakucomplex.com/preview/a.jpg?e=1&m=old", "https://v.sankakucomplex.com/preview/a.jpg?e=4102444800&m=new", "https://s.sankakucomplex.com/data/ab/cd/"+"a".repeat(32)+".png?e=1&m=old", "https://cdn.donmai.us/%C3%A4.png?size=large"));
        for(int i=0;i<300;i++)urls.add("https://"+List.of("cdn.donmai.us","img.rule34.xxx","img.gelbooru.com").get(i%3)+"/neutral/"+i+".png?size="+(i%4));for(String url:urls){assertEquals(url,reference(url),MediaIdentity.token(url));assertEquals(reference(url),MediaIdentity.token(url));}
        assertEquals(MediaIdentity.token(urls.get(5)),MediaIdentity.token(urls.get(6)));
    }
    @Test public void tokenCacheIsThreadSafeAndBounded() throws Exception {ExecutorService workers=Executors.newFixedThreadPool(4);List<Future<?>> tasks=new ArrayList<>();
        try{for(int thread=0;thread<4;thread++)tasks.add(workers.submit(()->{for(int i=0;i<2200;i++){String url="https://cdn.donmai.us/neutral/cache-"+(Thread.currentThread().getId()*10000+i)+".png";assertEquals(reference(url),MediaIdentity.token(url));}}));for(Future<?> task:tasks)task.get();}finally{workers.shutdownNow();}
        Field cache=MediaIdentity.class.getDeclaredField("TOKENS");cache.setAccessible(true);Map<?,?> values=(Map<?,?>)cache.get(null);synchronized(values){assertTrue(values.size()<=8192);}
    }
}
