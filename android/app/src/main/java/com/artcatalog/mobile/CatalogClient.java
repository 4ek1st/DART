package com.artcatalog.mobile;

import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.zip.GZIPInputStream;

class CatalogClient {
    // Closing a canceled request also releases a worker blocked in network I/O.
    static final class NetworkTask<T> extends FutureTask<T> {
        private volatile HttpURLConnection connection;
        private static final ThreadLocal<NetworkTask<?>> CURRENT=new ThreadLocal<>();
        NetworkTask(Callable<T> callable){super(callable);}
        NetworkTask(Runnable runnable){super(runnable,null);}
        @Override public void run(){CURRENT.set(this);try{super.run();}finally{CURRENT.remove();connection=null;}}
        @Override public boolean cancel(boolean interrupt){boolean changed=super.cancel(interrupt);HttpURLConnection c=connection;if(changed&&c!=null)c.disconnect();return changed;}
        static void attach(HttpURLConnection c) throws InterruptedIOException {NetworkTask<?> task=CURRENT.get();if(Thread.currentThread().isInterrupted()||task!=null&&task.isCancelled()){c.disconnect();throw new InterruptedIOException();}if(task!=null){task.connection=c;if(task.isCancelled()){c.disconnect();throw new InterruptedIOException();}}}
        static void detach(HttpURLConnection c){NetworkTask<?> task=CURRENT.get();if(task!=null&&task.connection==c)task.connection=null;}
    }
    static final String[] SOURCES={"danbooru","gelbooru","rule34","sankaku"};
    static final class Page {
        final List<Post> posts=new ArrayList<>();final Map<String,String> errors=new LinkedHashMap<>();
        final Set<String> more=new LinkedHashSet<>();
        final Map<String,String> fingerprints=new LinkedHashMap<>();
        final Map<String,String> notices=new LinkedHashMap<>();final Set<String> authRequired=new LinkedHashSet<>();
    }
    private final Store store;
    private final SankakuApi sankaku;
    private final ThreadPoolExecutor sources=new ThreadPoolExecutor(4,4,30,TimeUnit.SECONDS,new LinkedBlockingQueue<>(24));
    private final Set<NetworkTask<Page>> requests=ConcurrentHashMap.newKeySet();
    CatalogClient(Store store){this.store=store;this.sankaku=new SankakuApi(store,CatalogClient::sankakuRequest);}
    void loginSankaku(String login,String password) throws Exception {sankaku.login(login,password);}
    void logoutSankaku(){sankaku.logout();}
    Page search(String query,Map<String,Integer> pages,String rating,String sort){
        return search(query,pages,rating,sort,null);
    }
    Page search(String query,Map<String,Integer> pages,String rating,String sort,java.util.function.Consumer<Page> arrived){
        Page result=new Page();Map<String,NetworkTask<Page>> tasks=new LinkedHashMap<>();
        if(Thread.currentThread().isInterrupted())return result;
        try{
            for(Map.Entry<String,Integer> e:pages.entrySet()){NetworkTask<Page> task=new NetworkTask<>(()->{Page page=sourcePage(e.getKey(),query,e.getValue(),rating,sort);if(arrived!=null&&!Thread.currentThread().isInterrupted())arrived.accept(page);return page;});tasks.put(e.getKey(),task);requests.add(task);sources.execute(task);}
            for(Map.Entry<String,NetworkTask<Page>> e:tasks.entrySet()){
                try{Page p=e.getValue().get(22,TimeUnit.SECONDS);result.posts.addAll(p.posts);result.more.addAll(p.more);result.fingerprints.putAll(p.fingerprints);result.errors.putAll(p.errors);result.notices.putAll(p.notices);result.authRequired.addAll(p.authRequired);}
                catch(InterruptedException interrupted){Thread.currentThread().interrupt();return result;}
                catch(Exception err){e.getValue().cancel(true);Throwable cause=err instanceof ExecutionException?err.getCause():err;if(cause instanceof SankakuApi.AccessException){result.notices.put(e.getKey(),cause.getMessage());if(((SankakuApi.AccessException)cause).loginRequired)result.authRequired.add(e.getKey());}else result.errors.put(e.getKey(),message(err));}
            }
        }catch(RejectedExecutionException rejected){for(String source:pages.keySet())result.errors.put(source,"Повторите загрузку.");}
        finally{for(NetworkTask<Page> task:tasks.values()){if(!task.isDone())task.cancel(true);sources.remove(task);requests.remove(task);}}
        List<Post> merged=CatalogLogic.merge(List.of(),result.posts);result.posts.clear();result.posts.addAll(merged);
        if(sort.equals("popular")){if(pages.containsKey("sankaku")){List<Post> ranked=nativeRanking(result.posts);result.posts.clear();result.posts.addAll(ranked);}else result.posts.sort(Comparator.comparingInt((Post p)->p.score).reversed());}
        return result;
    }
    private String message(Exception err){
        Throwable e=err instanceof ExecutionException?err.getCause():err;
        if(e instanceof MissingKey)return "Добавьте User ID и API key в настройках.";
        if(e instanceof SocketTimeoutException||e instanceof TimeoutException)return "Источник не ответил. Повторите загрузку.";
        if(e instanceof ApiException)return e.getMessage();
        if(e instanceof IOException&&e.getMessage()!=null&&e.getMessage().contains("Sankaku"))return e.getMessage();
        return "Источник сейчас недоступен. Проверьте подключение.";
    }
    private static final class MissingKey extends Exception{}
    static final class ApiException extends IOException{ApiException(String message){super(message);}}
    private Page sourcePage(String source,String query,int page,String rating,String sort) throws Exception {
        query=CatalogLogic.cleanQuery(query);if(query.length()>200)throw new ApiException("Запрос слишком длинный.");
        if(source.equals("sankaku"))return sankakuPage(query,page,rating,sort);
        int size=source.equals("rule34")?48:24;
        String endpoint;
        if(source.equals("danbooru")){
            String tags=query+(rating.equals("general")?" rating:g,s":rating.equals("explicit")?" rating:q,e":"")+(sort.equals("popular")?" order:score":"");
            endpoint="https://danbooru.donmai.us/posts.json?limit="+size+"&page="+(page+1)+"&tags="+encode(tags.trim())+"&only=id,md5,rating,score,created_at,image_width,image_height,tag_string,tag_string_artist,tag_string_character,file_url,large_file_url,preview_file_url,source,uploader_id,uploader,media_asset,parent_id,has_children";
        }else{
            String id=store.credential(source,"user"),key=store.credential(source,"key");
            if(id.isBlank()||key.isBlank())throw new MissingKey();
            endpoint=(source.equals("gelbooru")?"https://gelbooru.com":"https://api.rule34.xxx")+
                "/index.php?page=dapi&s=post&q=index&json=1&limit="+size+"&pid="+page+
                "&tags="+encode(query+(sort.equals("popular")?" sort:score:desc":""))+"&user_id="+encode(id)+"&api_key="+encode(key);
        }
        Object data=new JSONTokener(get(endpoint)).nextValue();
        JSONArray posts=data instanceof JSONArray?(JSONArray)data:data instanceof JSONObject?((JSONObject)data).optJSONArray("post"):null;
        if(posts==null)throw new ApiException("Источник отклонил запрос. Проверьте ключи и теги.");
        Page out=new Page();if(CatalogLogic.hasMore(posts.length(),size))out.more.add(source);
        StringBuilder fingerprint=new StringBuilder();for(int i=0;i<posts.length();i++){JSONObject obj=posts.optJSONObject(i);if(obj!=null)fingerprint.append(obj.optString("id")).append(',');}out.fingerprints.put(source,fingerprint.toString());
        for(int i=0;i<posts.length();i++){
            JSONObject obj=posts.optJSONObject(i);if(obj==null)continue;
            Post p=CatalogLogic.map(source,obj);
            if(p.id.matches("[0-9]+")&&CatalogLogic.matchesRating(p.rating,rating)&&
                (CatalogLogic.isMediaUrl(p.preview)||p.isVideo()))out.posts.add(p);
        }
        return out;
    }
    private Page sankakuPage(String query,int page,String rating,String sort) throws Exception {
        int size=24,locked=0;JSONArray data=sankaku.posts(query,page,rating,sort,size);Page out=new Page();StringBuilder fingerprint=new StringBuilder();
        for(int i=0;i<data.length();i++){
            JSONObject obj=data.optJSONObject(i);if(obj==null)continue;fingerprint.append(obj.optString("id")).append(',');Post post=CatalogLogic.map("sankaku",obj);
            if(!CatalogLogic.validId("sankaku",post.id)||!CatalogLogic.matchesRating(post.rating,rating))continue;
            if(CatalogLogic.isMediaUrl(post.preview)||CatalogLogic.isMediaUrl(post.image))out.posts.add(post);
            if(post.media.isEmpty()&&(obj.optBoolean("redirect_to_signup")||obj.optBoolean("is_premium")||CatalogLogic.isMediaUrl(post.preview)))locked++;
        }
        if(data.length()>=size)out.more.add("sankaku");out.fingerprints.put("sankaku",fingerprint.toString());
        if(locked>0){boolean login=!store.sankakuAuthenticated();out.notices.put("sankaku",locked+" работ на странице ограничены. "+new SankakuApi.AccessException(login).getMessage());if(login)out.authRequired.add("sankaku");}
        return out;
    }
    /** Scores from different sites are incomparable; keep each native ranking and alternate sources. */
    static List<Post> nativeRanking(List<Post> posts){
        Map<String,ArrayDeque<Post>> queues=new LinkedHashMap<>();for(Post p:posts)queues.computeIfAbsent(p.source,key->new ArrayDeque<>()).add(p);List<Post> ranked=new ArrayList<>();
        while(ranked.size()<posts.size())for(ArrayDeque<Post> queue:queues.values())if(!queue.isEmpty())ranked.add(queue.removeFirst());return ranked;
    }
    List<String> tags(String q) throws Exception {
        Object data=new JSONTokener(get("https://danbooru.donmai.us/tags.json?limit=8&search[order]=count&search[name_matches]="+encode(q.toLowerCase(Locale.ROOT).replace(' ','_')+"*"))).nextValue();
        List<String> out=new ArrayList<>();if(data instanceof JSONArray){JSONArray a=(JSONArray)data;for(int i=0;i<a.length();i++){JSONObject o=a.optJSONObject(i);if(o!=null)out.add(o.optString("name"));}}
        return out;
    }
    List<String> artistTags(Post post) throws Exception {enrich(post);return new ArrayList<>(post.artistTags);}
    void enrich(Post post) throws Exception {
        if(post.source.equals("danbooru"))return;
        if(post.source.equals("sankaku")){Post fresh=CatalogLogic.map("sankaku",sankaku.post(post.id));CatalogLogic.refreshSignedMedia(post,fresh);post.tags=fresh.tags;post.artistTags=fresh.artistTags;post.artistTag=fresh.artistTag;post.artist=fresh.artist;post.characterTags=fresh.characterTags;post.title=fresh.title;post.originalUrl=fresh.originalUrl;return;}
        if(post.source.equals("gelbooru")&&store.configured("gelbooru")){
            for(int start=0;start<Math.min(post.tags.size(),250);start+=40){String names=String.join(" ",post.tags.subList(start,Math.min(start+40,post.tags.size())));String url="https://gelbooru.com/index.php?page=dapi&s=tag&q=index&json=1&limit=200&names="+encode(names)+"&user_id="+encode(store.credential("gelbooru","user"))+"&api_key="+encode(store.credential("gelbooru","key"));Object data=new JSONTokener(get(url)).nextValue();JSONArray tags=data instanceof JSONArray?(JSONArray)data:data instanceof JSONObject?((JSONObject)data).optJSONArray("tag"):null;if(tags!=null)for(int i=0;i<tags.length();i++){JSONObject tag=tags.optJSONObject(i);if(tag==null)continue;String name=tag.optString("name");if(!post.tags.contains(name))continue;if(tag.optInt("type")==1&&!post.artistTags.contains(name))post.artistTags.add(name);if(tag.optInt("type")==4&&!post.characterTags.contains(name))post.characterTags.add(name);}}
        }else if(post.source.equals("rule34")){
            String html=get(post.sourceUrl);java.util.regex.Matcher categories=java.util.regex.Pattern.compile("<li\\b[^>]*\\btag-type-(artist|character)\\b[^>]*>(.*?)</li>",java.util.regex.Pattern.CASE_INSENSITIVE|java.util.regex.Pattern.DOTALL).matcher(html);
            while(categories.find()){java.util.regex.Matcher link=java.util.regex.Pattern.compile("href=\"[^\"]*(?:&amp;|&)tags=([^\"&]+)\"",java.util.regex.Pattern.CASE_INSENSITIVE).matcher(categories.group(2));if(!link.find())continue;String tag=URLDecoder.decode(link.group(1),StandardCharsets.UTF_8.name());if(!post.tags.contains(tag))continue;List<String> target=categories.group(1).equalsIgnoreCase("artist")?post.artistTags:post.characterTags;if(!target.contains(tag))target.add(tag);}
        }
        if(!post.artistTags.isEmpty()){post.artistTag=post.artistTags.get(0);post.artist=post.artistTag.replace('_',' ');}
    }
    static String encode(String s){try{return URLEncoder.encode(s,StandardCharsets.UTF_8.name());}catch(Exception e){throw new IllegalStateException(e);}}
    static String get(String url) throws IOException {
        HttpURLConnection c=open(url);
        try{
            int status=c.getResponseCode();
            if(status!=200){
                String reason=status==401||status==403?"Источник ограничил доступ. Проверьте API key или повторите позже.":status==422?"Источник не принял теги. Попробуйте один или два тега.":status==429?"Слишком много запросов. Подождите немного.":"Источник ответил с ошибкой ("+status+").";
                throw new ApiException(reason);
            }
            try(InputStream raw=c.getInputStream();InputStream in="gzip".equalsIgnoreCase(c.getContentEncoding())?new GZIPInputStream(raw):raw;ByteArrayOutputStream out=new ByteArrayOutputStream()){
                byte[] bytes=new byte[8192];int read,total=0;
                while((read=in.read(bytes))!=-1){if(Thread.currentThread().isInterrupted())throw new InterruptedIOException();total+=read;if(total>8*1024*1024)throw new IOException("Response too large");out.write(bytes,0,read);}
                return out.toString(StandardCharsets.UTF_8.name());
            }
        }finally{c.disconnect();NetworkTask.detach(c);}
    }
    static HttpURLConnection open(String url) throws IOException {
        HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();
        NetworkTask.attach(c);
        c.setConnectTimeout(8000);c.setReadTimeout(10000);c.setInstanceFollowRedirects(false);
        c.setRequestProperty("User-Agent","ArtCatalogMobile/0.1 (Android)");c.setRequestProperty("Accept-Encoding","gzip");
        String host=c.getURL().getHost().toLowerCase(Locale.ROOT);if(host.equals("sankakucomplex.com")||host.endsWith(".sankakucomplex.com"))c.setRequestProperty("Referer","https://sankaku.app/");
        return c;
    }
    private static SankakuApi.Response sankakuRequest(String method,String path,JSONObject body,String token) throws IOException {
        if(!path.startsWith("/")||path.startsWith("//"))throw new IOException("Invalid API path");HttpURLConnection c=open("https://sankakuapi.com"+path);
        try{
            c.setRequestMethod(method);c.setRequestProperty("Accept","application/vnd.sankaku.api+json;v=2");c.setRequestProperty("Origin","https://sankaku.app");
            if(!token.isBlank())c.setRequestProperty("Authorization","Bearer "+token);
            if(body!=null){c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");byte[] payload=body.toString().getBytes(StandardCharsets.UTF_8);c.setFixedLengthStreamingMode(payload.length);try(OutputStream out=c.getOutputStream()){out.write(payload);}}
            int status=c.getResponseCode();InputStream response=status>=400?c.getErrorStream():c.getInputStream();if(response==null)return new SankakuApi.Response(status,"{}");
            try(InputStream raw=response;InputStream in="gzip".equalsIgnoreCase(c.getContentEncoding())?new GZIPInputStream(raw):raw;ByteArrayOutputStream out=new ByteArrayOutputStream()){
                byte[] bytes=new byte[8192];int read,total=0;while((read=in.read(bytes))!=-1){if(Thread.currentThread().isInterrupted())throw new InterruptedIOException();total+=read;if(total>8*1024*1024)throw new IOException("Response too large");out.write(bytes,0,read);}return new SankakuApi.Response(status,out.toString(StandardCharsets.UTF_8.name()));
            }
        }finally{c.disconnect();NetworkTask.detach(c);}
    }
    void close(){for(NetworkTask<Page> task:requests)task.cancel(true);sources.shutdownNow();}
}
