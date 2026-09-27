package com.artcatalog.mobile;

import org.json.*;
import java.io.IOException;

/** Sankaku protocol kept separate from Android storage and HTTP for deterministic access tests. */
final class SankakuApi {
    interface Session {
        String accessToken() throws Exception;
        String refreshToken() throws Exception;
        String loginName();
        void saveSession(String access,String refresh,String login) throws Exception;
        void clearSession();
    }
    interface Transport { Response request(String method,String path,JSONObject body,String token) throws Exception; }
    static final class Response { final int status;final String body;Response(int status,String body){this.status=status;this.body=body;} }
    static final class AccessException extends IOException {
        final boolean loginRequired;
        AccessException(boolean loginRequired){super(loginRequired?"Авторизуйтесь в Sankaku, чтобы получить доступ к этим работам.":"Sankaku ограничил доступ для этого аккаунта. Проверьте условия доступа или подписку Plus на сайте.");this.loginRequired=loginRequired;}
    }
    private final Session session;private final Transport transport;
    SankakuApi(Session session,Transport transport){this.session=session;this.transport=transport;}
    synchronized void login(String name,String password) throws Exception {
        name=name.trim();if(name.isEmpty()||password.isEmpty())throw new IOException("Введите логин и пароль Sankaku.");
        Response response=transport.request("POST","/auth/token",new JSONObject().put("login",name).put("password",password),"");
        JSONObject data=object(response.body);String access=string(data,"access_token");
        if(response.status==200&&!access.isBlank()&&!Boolean.FALSE.equals(data.opt("success"))){session.saveSession(access,string(data,"refresh_token"),name);return;}
        if(response.status==429)throw new IOException("Слишком много запросов входа. Подождите немного.");
        String code=string(data,"code")+" "+string(data,"error");
        if(code.toLowerCase(java.util.Locale.ROOT).matches(".*(mfa|otp|two.factor|authentication.factor).*"))throw new IOException("Sankaku требует двухэтапную проверку. Этот способ входа пока не поддерживает её.");
        if(response.status==400||response.status==401||response.status==403)throw new IOException("Неверный логин или пароль Sankaku.");
        throw new IOException("Не удалось войти в Sankaku ("+response.status+"). Повторите позже.");
    }
    synchronized void logout(){session.clearSession();}
    JSONArray posts(String query,int page,String rating,String sort,int size) throws Exception {
        String tags=CatalogLogic.cleanQuery(query)+(rating.equals("general")?" rating:s":rating.equals("explicit")?" rating:q,e":"")+(sort.equals("popular")?" order:popularity":"");
        Response response=request("/v2/posts?lang=en&limit="+size+"&page="+(page+1)+"&tags="+CatalogClient.encode(tags.trim()));
        Object value=new JSONTokener(response.body).nextValue();if(value instanceof JSONArray)return (JSONArray)value;
        if(value instanceof JSONObject){JSONArray data=((JSONObject)value).optJSONArray("data");if(data!=null)return data;}
        throw new IOException("Sankaku не вернул список работ. Проверьте теги.");
    }
    JSONObject post(String id) throws Exception {
        if(!CatalogLogic.validId("sankaku",id))throw new IOException("Некорректный ID Sankaku.");
        JSONObject post=object(request("/posts/"+id+"?lang=en").body);
        if(!id.equals(string(post,"id")))throw new IOException("Работа Sankaku недоступна или удалена.");
        if(CatalogLogic.map("sankaku",post).media.isEmpty()){
            if(post.optBoolean("redirect_to_signup")||post.optBoolean("is_premium")||CatalogLogic.isMediaUrl(post.optString("preview_url")))throw new AccessException(session.accessToken().isBlank());
            throw new IOException("У этой работы Sankaku нет доступного изображения.");
        }
        return post;
    }
    private Response request(String path) throws Exception {
        String token=session.accessToken();Response response=transport.request("GET",path,null,token);
        if(invalidToken(response)&&!token.isBlank()){
            String refreshed=refresh(token);response=transport.request("GET",path,null,refreshed);
            if(invalidToken(response)){session.clearSession();throw new AccessException(true);}
        }
        if(response.status==401||response.status==403)throw new AccessException(session.accessToken().isBlank());
        if(response.status==429&&response.body.contains("_tags-explicit-limit"))throw new AccessException(session.accessToken().isBlank());
        if(response.status==429)throw new IOException("Слишком много запросов к Sankaku. Подождите немного.");
        if(response.status==400||response.status==422)throw new IOException("Sankaku не принял запрос. Попробуйте меньше тегов.");
        if(response.status!=200)throw new IOException("Sankaku ответил с ошибкой ("+response.status+").");
        return response;
    }
    private static boolean invalidToken(Response response){return response.status==401||response.status==403&&(response.body.contains("invalid-token")||response.body.contains("invalid_token"));}
    private synchronized String refresh(String previous) throws Exception {
        String current=session.accessToken();if(!current.equals(previous)){if(current.isBlank())throw new AccessException(true);return current;}
        String refresh=session.refreshToken();if(refresh.isBlank()){session.clearSession();throw new AccessException(true);}
        Response response=transport.request("POST","/auth/token",new JSONObject().put("refresh_token",refresh),"");
        JSONObject data=object(response.body);String access=string(data,"access_token");
        if(response.status==200&&!access.isBlank()){
            String rotated=string(data,"refresh_token");session.saveSession(access,rotated.isBlank()?refresh:rotated,session.loginName());return access;
        }
        if(response.status==400||response.status==401||response.status==403){session.clearSession();throw new AccessException(true);}
        throw new IOException(response.status==429?"Слишком много запросов к Sankaku. Подождите немного.":"Не удалось обновить вход Sankaku. Повторите позже.");
    }
    private static JSONObject object(String body){try{return new JSONObject(body);}catch(JSONException e){return new JSONObject();}}
    private static String string(JSONObject o,String key){return o.isNull(key)?"":o.optString(key);}
}
