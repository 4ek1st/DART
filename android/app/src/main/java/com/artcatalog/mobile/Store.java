package com.artcatalog.mobile;

import android.content.*;
import android.util.*;
import android.util.Base64;
import android.security.keystore.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.*;
import java.util.concurrent.*;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import org.json.*;

final class Store implements SankakuApi.Session {
    private static Store instance;
    static synchronized Store get(Context context){if(instance==null)instance=new Store(context.getApplicationContext());return instance;}
    private final Context context;
    final SharedPreferences prefs;
    private final AtomicFile file;
    private final ExecutorService writes=Executors.newSingleThreadExecutor(r->new Thread(()->{android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_BACKGROUND);r.run();},"ArtCatalog-profile"));
    private final LinkedHashMap<String,Post> bookmarks=new LinkedHashMap<>();
    private final LinkedHashMap<String,Post> history=new LinkedHashMap<>();
    private final LinkedHashMap<String,JSONObject> follows=new LinkedHashMap<>();
    private final ArrayList<String> searches=new ArrayList<>();
    private final LinkedHashMap<String,Post> catalogue=new LinkedHashMap<>();
    private final LinkedHashMap<String,Post> openWorks=new LinkedHashMap<>();private final Set<String> pinned=new LinkedHashSet<>();private String previewKey="";
    private final Set<String> viewedIdentities=new LinkedHashSet<>();
    String warning="";
    private boolean loaded,dirty,writing;private long visibilityRevision;
    synchronized long visibilityRevision(){return visibilityRevision;}

    Store(Context context) {
        this.context=context; prefs=context.getSharedPreferences("settings",Context.MODE_PRIVATE);
        file=new AtomicFile(new File(context.getFilesDir(),"catalog.json"));
    }
    synchronized void load(){
        if(loaded)return;loaded=true;
        try{
            JSONObject o=new JSONObject(new String(file.readFully(),StandardCharsets.UTF_8));
            readPosts(o.optJSONArray("bookmarks"),bookmarks);readPosts(o.optJSONArray("history"),history);
            readPosts(o.optJSONArray("catalogueCache"),catalogue);
            readPosts(o.optJSONArray("openWorks"),openWorks);JSONArray pinnedKeys=o.optJSONArray("pinnedWorks");if(pinnedKeys!=null)for(int i=0;i<pinnedKeys.length();i++)if(openWorks.containsKey(pinnedKeys.optString(i)))pinned.add(pinnedKeys.optString(i));previewKey=o.optString("previewKey");
            JSONArray viewed=o.optJSONArray("viewedIdentities");if(viewed!=null)for(int i=0;i<viewed.length();i++)viewedIdentities.add(viewed.optString(i));for(Post p:history.values())viewedIdentities.addAll(WorkGrouping.tokens(p));
            JSONArray f=o.optJSONArray("follows");
            if(f!=null)for(int i=0;i<f.length();i++){
                JSONObject entry=f.optJSONObject(i);if(entry!=null)follows.put(entry.optString("key"),entry);
            }
            JSONArray q=o.optJSONArray("searches");
            if(q!=null)for(int i=0;i<Math.min(q.length(),20);i++)searches.add(q.optString(i));
        }catch(FileNotFoundException ignored){}
        catch(Exception e){warning="Не удалось прочитать профиль. Сохраните резервную копию через настройки.";}
    }
    private void readPosts(JSONArray array,LinkedHashMap<String,Post> target){
        if(array==null)return;
        for(int i=0;i<Math.min(array.length(),50000);i++){
            JSONObject obj=array.optJSONObject(i);if(obj==null)continue;
            Post p=Post.fromJson(obj);
            if(CatalogLogic.validId(p.source,p.id))target.put(p.key(),p);
        }
    }
    synchronized List<Post> bookmarks(){List<Post> list=new ArrayList<>(bookmarks.values());Collections.reverse(list);return list;}
    synchronized List<Post> history(){List<Post> list=new ArrayList<>(history.values());Collections.reverse(list);return list;}
    synchronized List<Post> catalogue(){List<Post> list=new ArrayList<>(catalogue.values());Collections.reverse(list);return list;}
    synchronized void remember(List<Post> posts){for(Post p:posts){catalogue.remove(p.key());catalogue.put(p.key(),p);}while(catalogue.size()>200)catalogue.remove(catalogue.keySet().iterator().next());persist();}
    synchronized void refreshCachedPost(Post post){for(Map<String,Post> collection:List.of(bookmarks,history,catalogue,openWorks))if(collection.containsKey(post.key()))collection.put(post.key(),post);remember(List.of(post));}
    synchronized void openWork(Post p){if(openWorks.containsKey(p.key()))return;if(prefs.getString("artworkTabs","preview").equals("preview")){if(!previewKey.isBlank()&&!pinned.contains(previewKey))openWorks.remove(previewKey);previewKey=p.key();}openWorks.put(p.key(),p);while(openWorks.size()>40){String remove=null;for(String key:openWorks.keySet())if(!pinned.contains(key)&&!key.equals(p.key())){remove=key;break;}if(remove==null)break;openWorks.remove(remove);}persist();}
    synchronized List<Post> openWorks(){return new ArrayList<>(openWorks.values());}
    synchronized boolean pinned(Post p){return pinned.contains(p.key());}
    synchronized void pin(Post p){if(!pinned.remove(p.key()))pinned.add(p.key());persist();}
    synchronized void closeWork(Post p){if(!pinned.contains(p.key())){openWorks.remove(p.key());if(previewKey.equals(p.key()))previewKey="";persist();}}
    List<Post> visible(List<Post> posts,boolean hideKnown){List<Post> filtered=new ArrayList<>();String ai=prefs.getString("aiMode","all");List<String> excluded=CatalogLogic.excludedTags(prefs.getString("excludedTags",""));for(Post p:posts)if(!CatalogLogic.hidden(p,ai,excluded))filtered.add(p);if(hideKnown&&prefs.getBoolean("hideViewedAndSaved",false)){Set<String> known;synchronized(this){known=new HashSet<>(viewedIdentities);}for(Post saved:bookmarks())known.addAll(WorkGrouping.tokens(saved));filtered.removeIf(p->!Collections.disjoint(known,WorkGrouping.tokens(p)));}return filtered;}
    synchronized boolean saved(Post p){for(Post saved:bookmarks.values())if(!Collections.disjoint(WorkGrouping.tokens(saved),WorkGrouping.tokens(p)))return true;return false;}
    synchronized boolean toggle(Post p){
        boolean add=!saved(p);
        if(add)bookmarks.put(p.key(),p);else{Set<String> tokens=WorkGrouping.tokens(p);bookmarks.entrySet().removeIf(entry->!Collections.disjoint(tokens,WorkGrouping.tokens(entry.getValue())));}
        visibilityRevision++;persist();return add;
    }
    synchronized void visit(Post p){if(viewedIdentities.addAll(WorkGrouping.tokens(p)))visibilityRevision++;history.remove(p.key());history.put(p.key(),p);while(history.size()>200)history.remove(history.keySet().iterator().next());persist();}
    synchronized List<String> searches(){return new ArrayList<>(searches);}
    synchronized void search(String q){if(q.isBlank())return;searches.remove(q);searches.add(0,q);while(searches.size()>20)searches.remove(searches.size()-1);persist();}
    synchronized List<JSONObject> follows(){return new ArrayList<>(follows.values());}
    synchronized boolean following(String tag){return follows.containsKey("artist:"+tag);}
    synchronized void toggleFollow(String tag){
        String key="artist:"+tag;
        if(follows.remove(key)==null){
            JSONObject entry=new JSONObject();
            try{entry.put("key",key).put("tag",tag).put("name",tag.replace('_',' ')).put("initialized",false).put("seen",new JSONArray());}catch(JSONException ignored){}
            follows.put(key,entry);
        }
        persist();
    }
    synchronized Set<String> unread(List<Post> posts,String tag){
        JSONObject follow=follows.get("artist:"+tag);Set<String> unread=new HashSet<>();
        if(follow==null)return unread;
        JSONArray seen=follow.optJSONArray("seen");Set<String> keys=new HashSet<>();
        if(seen!=null)for(int i=0;i<seen.length();i++)keys.add(seen.optString(i));
        boolean initialized=follow.optBoolean("initialized");
        for(Post p:posts){if(initialized&&!keys.contains(p.key()))unread.add(p.key());if(!initialized)keys.add(p.key());}
        if(!initialized){try{follow.put("initialized",true).put("seen",new JSONArray(keys));}catch(JSONException ignored){}persist();}
        return unread;
    }
    synchronized void markSeen(Post p){
        for(JSONObject f:follows.values())if(p.tags.contains(f.optString("tag"))){
            JSONArray seen=f.optJSONArray("seen");if(seen==null)seen=new JSONArray();
            boolean found=false;for(int i=0;i<seen.length();i++)if(p.key().equals(seen.optString(i)))found=true;
            if(!found){seen.put(p.key());try{f.put("seen",seen);}catch(JSONException ignored){}}
        }
        persist();
    }
    JSONObject export(){
        List<Post> saved,recent;List<JSONObject> authors=new ArrayList<>();List<String> queries;
        synchronized(this){saved=new ArrayList<>(bookmarks.values());recent=new ArrayList<>(history.values());queries=new ArrayList<>(searches);
            for(JSONObject f:follows.values())try{authors.add(new JSONObject(f.toString()));}catch(JSONException ignored){}
        }
        JSONObject o=new JSONObject();
        try{
            o.put("format","artcatalog-mobile").put("version",1).put("bookmarks",array(saved))
                .put("history",array(recent)).put("follows",new JSONArray(authors))
                .put("searches",new JSONArray(queries));
            o.put("preferences",new JSONObject().put("aiMode",prefs.getString("aiMode","all")).put("excludedTags",prefs.getString("excludedTags","")).put("hideViewedAndSaved",prefs.getBoolean("hideViewedAndSaved",false)).put("attributionPriority",prefs.getString("attributionPriority","creator")).put("artworkTabs",prefs.getString("artworkTabs","preview")));
            synchronized(this){o.put("viewedIdentities",new JSONArray(viewedIdentities));}
        }catch(JSONException e){throw new IllegalStateException(e);}
        return o;
    }
    private JSONArray array(Collection<Post> posts){JSONArray a=new JSONArray();for(Post p:posts)a.put(p.toJson());return a;}
    synchronized int importJson(String json) throws Exception {
        Object parsed=new JSONTokener(json).nextValue();
        if(parsed instanceof JSONObject&&"artcatalog-mobile".equals(((JSONObject)parsed).optString("format"))&&((JSONObject)parsed).optInt("version")!=1)throw new JSONException("Эта версия профиля пока не поддерживается.");
        JSONArray a=parsed instanceof JSONArray?(JSONArray)parsed:parsed instanceof JSONObject?((JSONObject)parsed).optJSONArray("bookmarks"):null;
        if(a==null)throw new JSONException("Выберите JSON с закладками ArtCatalog.");
        LinkedHashMap<String,Post> imported=new LinkedHashMap<>();readPosts(a,imported);
        if(a.length()>0&&imported.isEmpty())throw new JSONException("В файле нет поддерживаемых закладок.");
        int before=bookmarks.size();for(Post p:imported.values())bookmarks.putIfAbsent(p.key(),p);
        if(parsed instanceof JSONObject){
            JSONObject importedRoot=(JSONObject)parsed;
            JSONArray viewed=importedRoot.optJSONArray("viewedIdentities");if(viewed!=null)for(int i=0;i<Math.min(200000,viewed.length());i++)viewedIdentities.add(viewed.optString(i));
            JSONObject preferences=importedRoot.optJSONObject("preferences");if(preferences!=null){String ai=preferences.optString("aiMode","all"),priority=preferences.optString("attributionPriority","creator"),tabs=preferences.optString("artworkTabs","preview");if(Set.of("all","generated","generated-and-assisted").contains(ai)&&Set.of("creator","original","uploader").contains(priority)&&Set.of("preview","new").contains(tabs))prefs.edit().putString("aiMode",ai).putString("excludedTags",String.join(",",CatalogLogic.excludedTags(preferences.optString("excludedTags")))).putBoolean("hideViewedAndSaved",preferences.optBoolean("hideViewedAndSaved")).putString("attributionPriority",priority).putString("artworkTabs",tabs).apply();}
            LinkedHashMap<String,Post> importedHistory=new LinkedHashMap<>();readPosts(importedRoot.optJSONArray("history"),importedHistory);
            for(Post p:importedHistory.values())history.putIfAbsent(p.key(),p);
            while(history.size()>200)history.remove(history.keySet().iterator().next());
            JSONArray importedSearches=importedRoot.optJSONArray("searches");
            if(importedSearches!=null)for(int i=0;i<Math.min(20,importedSearches.length());i++){String q=CatalogLogic.cleanQuery(importedSearches.optString(i));if(!q.isBlank()&&q.length()<=200&&!searches.contains(q)&&searches.size()<20)searches.add(q);}
            JSONArray fs=((JSONObject)parsed).optJSONArray("follows");
            if(fs!=null)for(int i=0;i<fs.length();i++){
                JSONObject f=fs.optJSONObject(i);if(f==null)continue;
                String tag=f.optString("tag",f.optString("artistId"));
                if(tag.matches("[a-zA-Z0-9_().!+\\-]{1,100}")&&!following(tag)){
                    f.put("tag",tag).put("key","artist:"+tag);follows.put("artist:"+tag,f);
                }
            }
        }
        if(!warning.isBlank()){
            File damaged=file.getBaseFile();
            if(damaged.exists())try(InputStream in=new FileInputStream(damaged);OutputStream out=new FileOutputStream(new File(context.getFilesDir(),"catalog-unreadable-"+System.currentTimeMillis()+".json"))){byte[] bytes=new byte[8192];int n;while((n=in.read(bytes))!=-1)out.write(bytes,0,n);}
            warning="";
        }
        visibilityRevision++;persist();return bookmarks.size()-before;
    }
    private synchronized void persist(){
        // A damaged profile is preserved until the user explicitly imports a replacement.
        if(!warning.isBlank())return;
        dirty=true;if(writing)return;writing=true;
        writes.execute(()->{while(true){
            synchronized(this){if(!dirty){writing=false;return;}dirty=false;}
            JSONObject snapshotObject=export();List<Post> cached,opened;Set<String> pinnedKeys;String preview;
            synchronized(this){cached=new ArrayList<>(catalogue.values());opened=new ArrayList<>(openWorks.values());pinnedKeys=new LinkedHashSet<>(pinned);preview=previewKey;}
            try{snapshotObject.put("catalogueCache",array(cached)).put("openWorks",array(opened)).put("pinnedWorks",new JSONArray(pinnedKeys)).put("previewKey",preview);}catch(JSONException ignored){}String snapshot=snapshotObject.toString();FileOutputStream stream=null;
            try{stream=file.startWrite();stream.write(snapshot.getBytes(StandardCharsets.UTF_8));file.finishWrite(stream);}
            catch(IOException e){if(stream!=null)file.failWrite(stream);Log.e("ArtCatalog","Profile write failed",e);}
        }});
    }
    String credential(String source,String key) throws Exception {
        String encoded=prefs.getString(source+"."+key,"");if(encoded.isBlank())return "";
        byte[] bytes=Base64.decode(encoded,Base64.NO_WRAP);
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE,secretKey(),new GCMParameterSpec(128,Arrays.copyOfRange(bytes,0,12)));
        return new String(cipher.doFinal(Arrays.copyOfRange(bytes,12,bytes.length)),StandardCharsets.UTF_8);
    }
    void credentials(String source,String id,String apiKey) throws Exception {
        prefs.edit().putString(source+".user",encrypt(id)).putString(source+".key",encrypt(apiKey)).commit();
    }
    boolean configured(String source){return source.equals("danbooru")||source.equals("sankaku")||(!prefs.getString(source+".user","").isBlank()&&!prefs.getString(source+".key","").isBlank());}
    boolean sankakuAuthenticated(){return !prefs.getString("sankaku.access","").isBlank();}
    @Override public synchronized String accessToken() throws Exception {return credential("sankaku","access");}
    @Override public synchronized String refreshToken() throws Exception {return credential("sankaku","refresh");}
    @Override public String loginName(){return prefs.getString("sankaku.login","");}
    @Override public synchronized void saveSession(String access,String refresh,String login) throws Exception {
        String encryptedAccess=encrypt(access),encryptedRefresh=encrypt(refresh);
        if(!prefs.edit().putString("sankaku.access",encryptedAccess).putString("sankaku.refresh",encryptedRefresh).putString("sankaku.login",login).commit())throw new IOException("Не удалось сохранить вход Sankaku.");
    }
    @Override public synchronized void clearSession(){prefs.edit().remove("sankaku.access").remove("sankaku.refresh").remove("sankaku.login").commit();}
    private String encrypt(String plain) throws Exception {
        if(plain.isBlank())return "";
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,secretKey());
        byte[] value=cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8)),iv=cipher.getIV();
        byte[] all=new byte[iv.length+value.length];System.arraycopy(iv,0,all,0,iv.length);System.arraycopy(value,0,all,iv.length,value.length);
        return Base64.encodeToString(all,Base64.NO_WRAP);
    }
    private synchronized javax.crypto.SecretKey secretKey() throws Exception {
        KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);
        String alias="artcatalog.api";
        if(!ks.containsAlias(alias)){
            KeyGenerator gen=KeyGenerator.getInstance("AES","AndroidKeyStore");
            gen.init(new KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());gen.generateKey();
        }
        return (javax.crypto.SecretKey)ks.getKey(alias,null);
    }
}
