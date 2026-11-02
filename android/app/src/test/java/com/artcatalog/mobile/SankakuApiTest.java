package com.artcatalog.mobile;

import org.json.*;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;

public class SankakuApiTest {
    static final class MemorySession implements SankakuApi.Session {
        String access="",refresh="",login="";
        public String accessToken(){return access;} public String refreshToken(){return refresh;} public String loginName(){return login;}
        public void saveSession(String a,String r,String l){access=a;refresh=r;login=l;} public void clearSession(){access="";refresh="";login="";}
    }
    @Test public void popularQueryUsesNativePopularityAndNextIntegerPage() throws Exception {
        List<String> requests=new ArrayList<>();SankakuApi api=new SankakuApi(new MemorySession(),(method,path,body,token)->{requests.add(path);assertEquals("",token);return new SankakuApi.Response(200,"[]");});
        api.posts("artist_one",1,"general","popular",24);
        assertTrue(requests.get(0).contains("page=2"));assertTrue(requests.get(0).contains("artist_one+rating%3As+order%3Apopularity"));
        api.posts("",0,"explicit","latest",24);assertTrue(requests.get(1).contains("rating%3Aq%2Ce"));
    }
    @Test public void loginStoresTokensAndNeverStoresPassword() throws Exception {
        MemorySession session=new MemorySession();SankakuApi api=new SankakuApi(session,(method,path,body,token)->{assertEquals("POST",method);assertEquals("/auth/token",path);assertEquals("person",body.getString("login"));assertEquals("temporary",body.getString("password"));return new SankakuApi.Response(200,"{\"success\":true,\"access_token\":\"access\",\"refresh_token\":\"refresh\"}");});
        api.login("person","temporary");assertEquals("access",session.access);assertEquals("refresh",session.refresh);assertEquals("person",session.login);
    }
    @Test public void expiredTokenRefreshesOnlyOnceAndRetriesWithNewBearer() throws Exception {
        MemorySession session=new MemorySession();session.saveSession("expired","refresh","person");List<String> calls=new ArrayList<>();
        SankakuApi api=new SankakuApi(session,(method,path,body,token)->{calls.add(method+" "+path+" "+token);if(method.equals("POST")){assertEquals("refresh",body.getString("refresh_token"));return new SankakuApi.Response(200,"{\"access_token\":\"renewed\"}");}return token.equals("expired")?new SankakuApi.Response(401,"{\"code\":\"unauthorized\"}"):new SankakuApi.Response(200,"[]");});
        api.posts("",0,"all","latest",24);assertEquals(3,calls.size());assertEquals("renewed",session.access);assertEquals("refresh",session.refresh);
    }
    @Test public void invalidSessionIsClearedAndPromptsLoginWithoutLooping() throws Exception {
        MemorySession session=new MemorySession();session.saveSession("expired","bad","person");int[] calls={0};
        SankakuApi api=new SankakuApi(session,(method,path,body,token)->{calls[0]++;return new SankakuApi.Response(401,"{\"success\":false}");});
        try{api.posts("",0,"all","latest",24);fail("Expected authorization message");}catch(SankakuApi.AccessException e){assertTrue(e.loginRequired);assertTrue(e.getMessage().contains("Авторизуйтесь"));}
        assertEquals(2,calls[0]);assertEquals("",session.access);
    }
    @Test public void publicRestrictionsAndPaidRestrictionsHaveDifferentActions() throws Exception {
        MemorySession session=new MemorySession();SankakuApi api=new SankakuApi(session,(method,path,body,token)->new SankakuApi.Response(403,"{}"));
        try{api.posts("",0,"all","latest",24);fail();}catch(SankakuApi.AccessException e){assertTrue(e.loginRequired);}
        session.saveSession("valid","refresh","person");try{api.posts("",0,"all","latest",24);fail();}catch(SankakuApi.AccessException e){assertFalse(e.loginRequired);}
    }
    @Test public void rateLimitDoesNotAskForLoginOrEraseSession() throws Exception {
        MemorySession session=new MemorySession();session.saveSession("valid","refresh","person");SankakuApi api=new SankakuApi(session,(method,path,body,token)->new SankakuApi.Response(429,"{}"));
        try{api.posts("",0,"all","latest",24);fail();}catch(java.io.IOException e){assertFalse(e instanceof SankakuApi.AccessException);assertTrue(e.getMessage().contains("много запросов"));}assertEquals("valid",session.access);
    }
    @Test public void lockedDetailPromptsLoginAndEmptyDetailReportsMissingMedia() throws Exception {
        MemorySession session=new MemorySession();SankakuApi api=new SankakuApi(session,(method,path,body,token)->{assertEquals("/posts/AbC123xyz?lang=en",path);return new SankakuApi.Response(200,"{\"id\":\"AbC123xyz\",\"redirect_to_signup\":true,\"file_url\":null}");});
        try{api.post("AbC123xyz");fail();}catch(SankakuApi.AccessException e){assertTrue(e.loginRequired);}
    }
    @Test public void invalidLoginLeavesExistingSessionIntact() throws Exception {
        MemorySession session=new MemorySession();session.saveSession("existing","refresh","person");SankakuApi api=new SankakuApi(session,(method,path,body,token)->new SankakuApi.Response(403,"{\"success\":false,\"error\":\"invalid login or password\"}"));
        try{api.login("person","bad");fail();}catch(java.io.IOException e){assertTrue(e.getMessage().contains("логин или пароль"));}assertEquals("existing",session.access);
    }
    @Test public void previewOnlyAccessAlsoPromptsLoginWithoutSignupFlag() throws Exception {
        SankakuApi api=new SankakuApi(new MemorySession(),(method,path,body,token)->new SankakuApi.Response(200,"{\"id\":\"AbC123xyz\",\"status\":\"active\",\"preview_url\":\"https://v.sankakucomplex.com/preview.jpg\"}"));
        try{api.post("AbC123xyz");fail();}catch(SankakuApi.AccessException e){assertTrue(e.loginRequired);}
    }
    @Test public void anonymousTagLimitIsAnAuthorizationRestriction(){
        SankakuApi api=new SankakuApi(new MemorySession(),(method,path,body,token)->new SankakuApi.Response(429,"{\"code\":\"_tags-explicit-limit\"}"));
        try{api.posts("landscape sky ocean",0,"all","latest",24);fail();}catch(SankakuApi.AccessException e){assertTrue(e.loginRequired);}catch(Exception e){fail("Must offer login for the guest tag limit");}
    }
    private static final String HASH="112233445566778899aabbccddeeff00";
    private static JSONObject resolved(String hash,String id) throws Exception {
        return new JSONObject().put("id",id).put("md5",hash)
            .put("file_url","https://s.sankakucomplex.com/data/"+hash+".png?e=4102444800&m=fresh")
            .put("preview_url","https://s.sankakucomplex.com/preview/"+hash+".jpg?e=4102444800&m=fresh");
    }
    @Test public void importedNumericIdUsesOneExactOwnedHashLookupAndRetainsRequestedIdentity() throws Exception {
        List<String> paths=new ArrayList<>();SankakuApi api=new SankakuApi(new MemorySession(),(method,path,body,token)->{
            paths.add(path);assertEquals("GET",method);assertTrue(path.contains("limit=2"));assertTrue(path.contains("page=1"));
            assertTrue(path.contains("tags=md5%3A"+HASH));return new SankakuApi.Response(200,new JSONArray().put(resolved(HASH,"ModernABC123")).toString());
        });
        JSONObject post=api.post("1234567",HASH.toUpperCase(Locale.ROOT));
        assertEquals("1234567",post.getString("id"));assertEquals(HASH,post.getString("md5"));assertEquals(1,paths.size());
        assertEquals("sankaku:1234567",CatalogLogic.map("sankaku",post).key());assertTrue(CatalogLogic.map("sankaku",post).preview.contains(HASH));
    }
    @Test public void exactLegacyHashLookupAcceptsTheDataEnvelope() throws Exception {
        SankakuApi api=new SankakuApi(new MemorySession(),(method,path,body,token)->new SankakuApi.Response(200,
            new JSONObject().put("data",new JSONArray().put(resolved(HASH,"ModernABC123"))).toString()));
        assertEquals("1234567",api.post("1234567",HASH).getString("id"));
    }
    @Test public void legacyHashLookupRejectsMissingAmbiguousMismatchedAndUnusableRecordsWithoutRetry() throws Exception {
        JSONObject valid=resolved(HASH,"ModernABC123");
        List<String> bodies=List.of("[]",new JSONArray().put(valid).put(valid).toString(),
            new JSONArray().put(resolved("ffeeddccbbaa99887766554433221100","ModernABC123")).toString(),
            new JSONArray().put(resolved(HASH,"../invalid")).toString(),
            new JSONArray().put(new JSONObject().put("id","ModernABC123").put("md5",HASH)).toString(),"{}");
        for(String response:bodies){int[] calls={0};SankakuApi api=new SankakuApi(new MemorySession(),(method,path,body,token)->{calls[0]++;return new SankakuApi.Response(200,response);});
            try{api.post("1234567",HASH);fail("Unconfirmed hash result must not become saved media");}catch(java.io.IOException expected){}
            assertEquals("The exact lookup must not start broad fallback requests",1,calls[0]);
        }
    }
    @Test public void numericIdWithoutAnOwnedHashDoesNotSearchByOtherMetadata() throws Exception {
        List<String> paths=new ArrayList<>();SankakuApi api=new SankakuApi(new MemorySession(),(method,path,body,token)->{paths.add(path);return new SankakuApi.Response(404,"{}");});
        for(String invalid:List.of("","not-a-hash",HASH+" extra"))try{api.post("1234567",invalid);fail();}catch(java.io.IOException expected){}
        assertEquals(List.of("/posts/1234567?lang=en","/posts/1234567?lang=en","/posts/1234567?lang=en"),paths);
    }
    @Test public void modernOpaqueIdDoesNotUseAnotherSavedMembersHash() throws Exception {
        List<String> paths=new ArrayList<>();SankakuApi api=new SankakuApi(new MemorySession(),(method,path,body,token)->{paths.add(path);return new SankakuApi.Response(200,resolved(HASH,"ModernABC123").toString());});
        assertEquals("ModernABC123",api.post("ModernABC123",HASH).getString("id"));assertEquals(List.of("/posts/ModernABC123?lang=en"),paths);
    }
}
