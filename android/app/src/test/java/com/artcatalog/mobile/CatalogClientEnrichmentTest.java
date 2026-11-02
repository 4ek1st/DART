package com.artcatalog.mobile;

import org.json.*;
import org.junit.Test;
import java.util.*;
import java.lang.reflect.*;
import static org.junit.Assert.*;

public class CatalogClientEnrichmentTest {
    @Test public void visibleRepairKeepsBackgroundPriorityAndSuppliesOnlyOwnedHash() throws Exception {
        CatalogClient client=new CatalogClient((s,q,p,r,o)->new CatalogClient.Page());String hash="a".repeat(32);List<String> paths=new ArrayList<>();List<Integer> priorities=new ArrayList<>();
        Field priorityField=CatalogClient.class.getDeclaredField("REQUEST_PRIORITY");priorityField.setAccessible(true);@SuppressWarnings("unchecked") ThreadLocal<Integer> priority=(ThreadLocal<Integer>)priorityField.get(null);
        SankakuApi.Session session=new SankakuApi.Session(){public String accessToken(){return "";}public String refreshToken(){return "";}public String loginName(){return "";}public void saveSession(String a,String b,String c){}public void clearSession(){}};
        SankakuApi api=new SankakuApi(session,(method,path,body,token)->{paths.add(path);priorities.add(priority.get());return new SankakuApi.Response(200,"[{\"id\":\"Resolved123\",\"md5\":\""+hash+"\",\"file_url\":\"https://s.sankakucomplex.com/data/neutral.png\",\"preview_url\":\"https://s.sankakucomplex.com/preview/neutral.jpg\",\"tags\":[]}]");});
        Field field=CatalogClient.class.getDeclaredField("sankaku");field.setAccessible(true);field.set(client,api);Post saved=new Post();saved.source="sankaku";saved.id="12345678";saved.hash=hash;
        Method enrich;try{enrich=CatalogClient.class.getDeclaredMethod("enrich",Post.class,int.class);}catch(NoSuchMethodException old){enrich=CatalogClient.class.getDeclaredMethod("enrich",Post.class);}enrich.setAccessible(true);
        if(enrich.getParameterCount()==2)enrich.invoke(client,saved,2);else enrich.invoke(client,saved);
        assertEquals(List.of(2),priorities);assertEquals(1,paths.size());assertTrue(paths.get(0).contains("limit=2"));assertEquals("12345678",saved.id);assertFalse(saved.media.isEmpty());assertEquals(Integer.valueOf(1),priority.get());
    }
    @Test public void hashFallbackNeverUsesAnotherGroupedVariant() throws Exception {
        Post saved=new Post();saved.source="sankaku";saved.id="12345678";Post other=new Post();other.source="sankaku";other.id="87654321";other.hash="b".repeat(32);saved.groupMembers=List.of(other);
        assertEquals("",CatalogClient.ownedSankakuHash(saved));saved.imageRecords.put(new JSONObject().put("owner",other.key()).put("hash",other.hash));assertEquals("",CatalogClient.ownedSankakuHash(saved));
        saved.imageRecords.put(new JSONObject().put("owner",saved.key()).put("hash","a".repeat(32)));assertEquals("a".repeat(32),CatalogClient.ownedSankakuHash(saved));
    }
}
