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
    private LinkedHashMap<String,Post> bookmarks=new LinkedHashMap<>();
    private LinkedHashMap<String,Post> likes=new LinkedHashMap<>();
    private Set<String> bookmarkTokens=new HashSet<>(),likedTokens=new HashSet<>();
    private LinkedHashMap<String,Post> history=new LinkedHashMap<>();
    private LinkedHashMap<String,JSONObject> follows=new LinkedHashMap<>();
    private final ArrayList<String> searches=new ArrayList<>();
    private final LinkedHashMap<String,Post> catalogue=new LinkedHashMap<>();
    private final LinkedHashMap<String,Post> openWorks=new LinkedHashMap<>();private final Set<String> pinned=new LinkedHashSet<>();private String previewKey="";
    private Set<String> viewedIdentities=new LinkedHashSet<>();
    private LinkedHashMap<String,String> recommendationTags=new LinkedHashMap<>();
    private final LinkedHashSet<String> recentSuggestions=new LinkedHashSet<>();
    private List<List<String>> exposureGroups=new ArrayList<>();
    private LinkedHashSet<String> favoriteTags=new LinkedHashSet<>();
    private LinkedHashSet<String> hiddenAuthors=new LinkedHashSet<>();
    private int recommendationSeed;
    String warning="";
    private boolean loaded,dirty,writing;private long visibilityRevision,profileRevision;
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
            if(o.has("likes"))readPosts(o.optJSONArray("likes"),likes);
            else{
                // Before Liked existed the bookmark heart expressed both intents. Preserve
                // every bookmark, and seed interests once without erasing the collection.
                likes.putAll(bookmarks);
                dirty=true;
            }
            rebuildSavedTokens();
            readPosts(o.optJSONArray("catalogueCache"),catalogue);
            readPosts(o.optJSONArray("openWorks"),openWorks);JSONArray pinnedKeys=o.optJSONArray("pinnedWorks");if(pinnedKeys!=null)for(int i=0;i<pinnedKeys.length();i++)if(openWorks.containsKey(pinnedKeys.optString(i)))pinned.add(pinnedKeys.optString(i));previewKey=o.optString("previewKey");
            JSONArray viewed=o.optJSONArray("viewedIdentities");if(viewed!=null)for(int i=0;i<viewed.length();i++)viewedIdentities.add(viewed.optString(i));for(Post p:history.values())viewedIdentities.addAll(WorkGrouping.viewedTokens(p));
            JSONObject choices=o.optJSONObject("recommendationTags");if(choices!=null)for(Iterator<String> tags=choices.keys();tags.hasNext();){String tag=tags.next();
                String mode=choices.optString(tag);if(Set.of("priority","disabled").contains(mode)&&recommendationTags.size()<1000)recommendationTags.put(Recommendations.normal(tag),mode);
            }
            JSONArray suggestions=o.optJSONArray("recentSuggestions");if(suggestions!=null)for(int i=0;i<suggestions.length()&&i<400;i++)recentSuggestions.add(suggestions.optString(i));
            readExposure(o);JSONArray favorites=o.optJSONArray("favoriteTags");if(favorites!=null)for(int i=0;i<Math.min(100,favorites.length());i++)favoriteTags.add(favorites.optString(i));
            readHiddenAuthors(o.optJSONArray("hiddenAuthors"));
            recommendationSeed=Math.max(0,o.optInt("recommendationSeed"));
            JSONArray f=o.optJSONArray("follows");
            if(f!=null)for(int i=0;i<f.length();i++){
                JSONObject entry=f.optJSONObject(i);if(entry!=null)follows.put(entry.optString("key"),entry);
            }
            JSONArray q=o.optJSONArray("searches");
            if(q!=null)for(int i=0;i<Math.min(q.length(),20);i++)searches.add(q.optString(i));
        }catch(FileNotFoundException ignored){}
        catch(Exception e){warning="Не удалось прочитать профиль. Сохраните резервную копию через настройки.";}
        rebuildSavedTokens();
        if(dirty&&warning.isBlank())persist();
    }
    private void readPosts(JSONArray array,LinkedHashMap<String,Post> target){
        if(array==null)return;
        for(int i=0;i<Math.min(array.length(),100000);i++){
            JSONObject obj=array.optJSONObject(i);if(obj==null)continue;
            Post p=Post.fromJson(obj);
            if(CatalogLogic.validId(p.source,p.id))target.put(p.key(),p);
        }
    }
    private void rebuildSavedTokens(){bookmarkTokens.clear();likedTokens.clear();for(Post post:bookmarks.values())bookmarkTokens.addAll(WorkGrouping.viewedTokens(post));for(Post post:likes.values())likedTokens.addAll(WorkGrouping.viewedTokens(post));}
    synchronized List<Post> bookmarks(){List<Post> list=new ArrayList<>(bookmarks.values());Collections.reverse(list);return list;}
    synchronized List<Post> likes(){List<Post> list=new ArrayList<>(likes.values());Collections.reverse(list);return list;}
    synchronized Map<String,String> recommendationTags(){return new LinkedHashMap<>(recommendationTags);}
    synchronized String recommendationTagMode(String tag){return recommendationTags.getOrDefault(Recommendations.normal(tag),"normal");}
    synchronized void setRecommendationTagMode(String tag,String mode){
        String normalized=Recommendations.normal(tag);if(normalized.isBlank()||normalized.length()>100)return;
        if(mode.equals("normal"))recommendationTags.remove(normalized);
        else if(Set.of("priority","disabled").contains(mode)&&(recommendationTags.containsKey(normalized)||recommendationTags.size()<1000))recommendationTags.put(normalized,mode);
        visibilityRevision++;persist();
    }
    synchronized int recommendationSeed(){return recommendationSeed;}
    synchronized int rotateRecommendations(){recommendationSeed++;persist();return recommendationSeed;}
    synchronized Set<String> recentSuggestions(){Set<String> keys=new LinkedHashSet<>(recentSuggestions);for(String key:ExposureHistory.keys(exposureGroups)){keys.add(key);keys.add("key:"+key);}return keys;}
    private void readExposure(JSONObject root){
        List<List<String>> groups=new ArrayList<>();JSONArray stored=root.optJSONArray("recommendationExposureGroups");
        if(stored!=null)for(int i=0;i<stored.length();i++){JSONArray group=stored.optJSONArray(i);if(group==null)continue;List<String> keys=new ArrayList<>();for(int j=0;j<group.length();j++)keys.add(group.optString(j));groups=ExposureHistory.append(groups,keys);}
        else for(String token:recentSuggestions){String key=token.replaceFirst("^key:","");if(ExposureHistory.valid(key))groups=ExposureHistory.append(groups,List.of(key));}
        exposureGroups=groups;
    }
    synchronized List<String> favoriteTags(){return new ArrayList<>(favoriteTags);}
    synchronized boolean favoriteTag(String tag){return favoriteTags.contains(CatalogLogic.normalizeTag(tag));}
    synchronized void toggleFavoriteTag(String tag){String key=CatalogLogic.normalizeTag(tag);if(key.isBlank()||key.length()>100)return;if(!favoriteTags.remove(key)&&favoriteTags.size()<100)favoriteTags.add(key);persist();}
    Map<String,Boolean> curation(){Map<String,Boolean> result=new LinkedHashMap<>();for(String key:List.of("enabled","popularity","personal","freshness","resolution"))result.put(key,prefs.getBoolean("curation."+key,!key.equals("enabled")));return result;}
    private static String authorKey(String source,String id){
        String normalized=CatalogLogic.normalizeTag(id);if(normalized.isBlank()||normalized.length()>100)return "";
        return (source.equals("artist")||Arrays.asList(CatalogClient.SOURCES).contains(source))?source+":"+normalized:"";
    }
    private static Set<String> authorKeys(Post post){Set<String> keys=new HashSet<>();
        for(String tag:post.artistTags){String key=authorKey("artist",tag);if(!key.isBlank())keys.add(key);}
        if(!post.artistTag.isBlank())keys.add(authorKey("artist",post.artistTag));
        if(!post.uploaderId.isBlank())keys.add(authorKey(post.source,post.uploaderId));
        for(String uploader:post.uploaderKeys){int separator=uploader.indexOf(':');if(separator>0){String key=authorKey(uploader.substring(0,separator),uploader.substring(separator+1));if(!key.isBlank())keys.add(key);}}
        return keys;
    }
    private void readHiddenAuthors(JSONArray values){if(values==null)return;for(int i=0;i<Math.min(200,values.length());i++){
        String source="",id="";Object item=values.opt(i);
        if(item instanceof JSONObject){JSONObject author=(JSONObject)item;source=author.optString("source");id=author.optString("artistId");}
        else if(item instanceof String){String key=(String)item;int separator=key.indexOf(':');if(separator>0){source=key.substring(0,separator);id=key.substring(separator+1);}}
        String key=authorKey(source,id);if(!key.isBlank())hiddenAuthors.add(key);
    }}
    synchronized List<String> hiddenAuthors(){return new ArrayList<>(hiddenAuthors);}
    synchronized boolean hiddenAuthor(String source,String id){return hiddenAuthors.contains(authorKey(source,id));}
    synchronized void setHiddenAuthor(String source,String id,boolean hidden){String key=authorKey(source,id);if(key.isBlank())return;
        if(hidden&&hiddenAuthors.size()<200)hiddenAuthors.add(key);else if(!hidden)hiddenAuthors.remove(key);
        visibilityRevision++;persist();
    }
    private boolean hiddenAuthor(Post post,Set<String> hidden){return !Collections.disjoint(hidden,authorKeys(post));}
    synchronized void markSuggested(List<Post> posts){
        List<List<String>> before=exposureGroups;
        for(Post post:posts){List<String> keys=new ArrayList<>(post.memberKeys);keys.add(0,post.key());exposureGroups=ExposureHistory.append(exposureGroups,keys);}
        if(!before.equals(exposureGroups))persist();
    }
    synchronized List<Post> history(){List<Post> list=new ArrayList<>(history.values());Collections.reverse(list);return list;}
    synchronized List<Post> catalogue(){List<Post> list=new ArrayList<>(catalogue.values());Collections.reverse(list);return list;}
    synchronized void remember(List<Post> posts){for(Post p:posts){catalogue.remove(p.key());catalogue.put(p.key(),p);}while(catalogue.size()>200)catalogue.remove(catalogue.keySet().iterator().next());persist();}
    synchronized void refreshCachedPost(Post post){for(Map<String,Post> collection:List.of(bookmarks,likes,history,catalogue,openWorks))if(collection.containsKey(post.key()))collection.put(post.key(),post);rebuildSavedTokens();remember(List.of(post));}
    synchronized void openWork(Post p){if(openWorks.containsKey(p.key()))return;if(prefs.getString("artworkTabs","preview").equals("preview")){if(!previewKey.isBlank()&&!pinned.contains(previewKey))openWorks.remove(previewKey);previewKey=p.key();}openWorks.put(p.key(),p);while(openWorks.size()>40){String remove=null;for(String key:openWorks.keySet())if(!pinned.contains(key)&&!key.equals(p.key())){remove=key;break;}if(remove==null)break;openWorks.remove(remove);}persist();}
    synchronized List<Post> openWorks(){return new ArrayList<>(openWorks.values());}
    synchronized boolean pinned(Post p){return pinned.contains(p.key());}
    synchronized void pin(Post p){if(!pinned.remove(p.key()))pinned.add(p.key());persist();}
    synchronized void closeWork(Post p){if(!pinned.contains(p.key())){openWorks.remove(p.key());if(previewKey.equals(p.key()))previewKey="";persist();}}
    boolean isHidden(Post post){Set<String> hidden;synchronized(this){hidden=new HashSet<>(hiddenAuthors);}return hiddenAuthor(post,hidden)||CatalogLogic.hidden(post,prefs.getString("aiMode","all"),CatalogLogic.excludedTags(prefs.getString("excludedTags","")),prefs.getBoolean("hideFurry",false));}
    List<Post> visible(List<Post> posts,boolean hideKnown){return visible(posts,hideKnown,false);}
    List<Post> visible(List<Post> posts,boolean hideKnown,boolean hideFollowed){List<Post> filtered=new ArrayList<>();String ai=prefs.getString("aiMode","all");List<String> excluded=CatalogLogic.excludedTags(prefs.getString("excludedTags",""));boolean furry=prefs.getBoolean("hideFurry",false);Set<String> hidden,followed;synchronized(this){hidden=new HashSet<>(hiddenAuthors);followed=new HashSet<>();for(JSONObject follow:follows.values()){String source=follow.optString("source");followed.add(authorKey(source.isBlank()?"artist":source,follow.optString("tag").replaceFirst("^user:","")));if(source.isBlank()&&!follow.optString("gelbooruTag").isBlank())followed.add(authorKey("artist",follow.optString("gelbooruTag")));}}for(Post p:posts)if(!hiddenAuthor(p,hidden)&&!CatalogLogic.hidden(p,ai,excluded,furry)&&!(hideFollowed&&prefs.getBoolean("hideFollowedArtists",false)&&!Collections.disjoint(followed,authorKeys(p))))filtered.add(p);if(hideKnown&&prefs.getBoolean("hideViewedAndSaved",false)){Set<String> known;synchronized(this){known=new HashSet<>(viewedIdentities);known.addAll(bookmarkTokens);known.addAll(likedTokens);}filtered.removeIf(p->!Collections.disjoint(known,WorkGrouping.viewedTokens(p)));}return filtered;}
    synchronized boolean saved(Post p){return !Collections.disjoint(bookmarkTokens,WorkGrouping.viewedTokens(p));}
    synchronized boolean liked(Post p){return !Collections.disjoint(likedTokens,WorkGrouping.viewedTokens(p));}
    synchronized boolean toggleLike(Post p){
        boolean add=!liked(p);
        if(add)likes.put(p.key(),p);else{Set<String> tokens=WorkGrouping.viewedTokens(p);likes.entrySet().removeIf(entry->!Collections.disjoint(tokens,WorkGrouping.viewedTokens(entry.getValue())));}
        rebuildSavedTokens();visibilityRevision++;persist();return add;
    }
    synchronized boolean like(Post p){if(liked(p))return false;likes.put(p.key(),p);rebuildSavedTokens();visibilityRevision++;persist();return true;}
    synchronized boolean toggle(Post p){
        boolean add=!saved(p);
        if(add)bookmarks.put(p.key(),p);else{Set<String> tokens=WorkGrouping.viewedTokens(p);bookmarks.entrySet().removeIf(entry->!Collections.disjoint(tokens,WorkGrouping.viewedTokens(entry.getValue())));}
        rebuildSavedTokens();visibilityRevision++;persist();return add;
    }
    synchronized void visit(Post p){if(viewedIdentities.addAll(WorkGrouping.viewedTokens(p)))visibilityRevision++;history.remove(p.key());history.put(p.key(),p);while(history.size()>200)history.remove(history.keySet().iterator().next());persist();}
    synchronized List<String> searches(){return new ArrayList<>(searches);}
    synchronized void search(String q){if(q.isBlank())return;searches.remove(q);searches.add(0,q);while(searches.size()>20)searches.remove(searches.size()-1);persist();}
    synchronized List<JSONObject> follows(){return new ArrayList<>(follows.values());}
    synchronized boolean following(String tag){return follows.containsKey("artist:"+tag);}
    synchronized boolean followingUploader(String source,String id){return follows.containsKey(source+":"+CatalogLogic.normalizeTag(id));}
    synchronized void toggleFollow(String tag){
        String key="artist:"+tag;
        if(follows.remove(key)==null){
            JSONObject entry=new JSONObject();
            try{entry.put("key",key).put("tag",tag).put("name",tag.replace('_',' ')).put("followedAt",java.time.Instant.now().toString()).put("initialized",false).put("seen",new JSONArray());}catch(JSONException ignored){}
            follows.put(key,entry);
        }
        persist();
    }
    synchronized void toggleFollowUploader(String source,String id,String displayName){
        String normalized=CatalogLogic.normalizeTag(id),key=source+":"+normalized;
        if(normalized.isBlank()||normalized.length()>100||!Arrays.asList(CatalogClient.SOURCES).contains(source))return;
        if(follows.remove(key)==null){JSONObject entry=new JSONObject();try{
            entry.put("key",key).put("tag","user:"+id.replace(' ','_')).put("source",source)
                .put("name",displayName.isBlank()?id:displayName).put("followedAt",java.time.Instant.now().toString()).put("initialized",false).put("seen",new JSONArray());
        }catch(JSONException ignored){}follows.put(key,entry);}
        persist();
    }
    synchronized void removeFollow(String key){if(follows.remove(key)!=null)persist();}
    synchronized Map<String,FollowingOrder.NewSnapshot> followingSnapshots(String rating,long startedAt){
        Set<String> known=new HashSet<>(viewedIdentities);known.addAll(bookmarkTokens);known.addAll(likedTokens);
        Set<String> configured=new LinkedHashSet<>(),selected=new LinkedHashSet<>();String filter=prefs.getString("source","all");for(String source:CatalogClient.SOURCES)if(configured(source)){configured.add(source);if(filter.equals("all")||filter.equals(source))selected.add(source);}
        if(selected.isEmpty()&&!filter.equals("all")&&Arrays.asList(CatalogClient.SOURCES).contains(filter))selected.add(filter);
        // A filtered visit advances that provider only. Its portable all-provider timestamp
        // must not make an unselected or failed provider's unseen works look old later.
        return FollowingOrder.snapshots(follows.values(),rating,startedAt,follow->{String scope=follow.optString("source");return scope.isBlank()?selected:Set.of(scope);},follow->{String scope=follow.optString("source");return scope.isBlank()?configured:Set.of(scope);},known);
    }
    synchronized void recordFollowingSuccess(FollowingOrder.NewSnapshot snapshot,String source,List<Post> posts){
        JSONObject follow=follows.get(snapshot.key);if(follow!=null&&FollowingOrder.recordSuccess(follow,snapshot,source,posts))persist();
    }
    synchronized boolean knownForFollowing(Post post){Set<String> identities=FollowingOrder.knownTokens(post);return !Collections.disjoint(identities,viewedIdentities)||!Collections.disjoint(identities,likedTokens)||!Collections.disjoint(identities,bookmarkTokens);}
    synchronized Set<String> unread(List<Post> posts,String tag,String source){
        JSONObject follow=follows.get(source.isBlank()?"artist:"+tag:source+":"+CatalogLogic.normalizeTag(tag.replaceFirst("^user:","")));if(follow==null)return Set.of();
        FollowingOrder.NewSnapshot snapshot=followingSnapshots(prefs.getString("rating","general"),System.currentTimeMillis()).get(FollowingOrder.followKey(follow));if(snapshot==null)return Set.of();
        Set<String> unread=FollowingOrder.unread(posts,snapshot),successful=new LinkedHashSet<>();for(Post post:posts)if(source.isBlank()||source.equals(post.source))successful.add(post.source);
        boolean changed=false;for(String provider:successful)changed|=FollowingOrder.recordSuccess(follow,snapshot,provider,posts);if(changed)persist();return unread;
    }
    synchronized void markSeen(Post p){
        Set<String> authors=authorKeys(p),works=new LinkedHashSet<>(p.memberKeys);works.add(p.key());
        for(JSONObject f:follows.values())if(authors.contains(authorKey(f.optString("source").isBlank()?"artist":f.optString("source"),f.optString("tag").replaceFirst("^user:","")))||f.optString("source").isBlank()&&!f.optString("gelbooruTag").isBlank()&&authors.contains(authorKey("artist",f.optString("gelbooruTag")))){
            JSONArray seen=f.optJSONArray("seen");if(seen==null)seen=new JSONArray();
            Set<String> existing=new HashSet<>();for(int i=0;i<seen.length();i++)existing.add(seen.optString(i));
            for(String key:works)if(existing.add(key))seen.put(key);
            if(seen.length()>4000){JSONArray recent=new JSONArray();for(int i=seen.length()-3000;i<seen.length();i++)recent.put(seen.optString(i));seen=recent;}
            try{f.put("seen",seen);}catch(JSONException ignored){}
        }
        persist();
    }
    JSONObject export(){
        List<Post> saved,liked,recent;List<JSONObject> authors=new ArrayList<>();List<String> queries,viewed,hidden,favorites;Map<String,String> choices;List<List<String>> exposures=new ArrayList<>();Set<String> suggestions;int seed;
        synchronized(this){saved=new ArrayList<>(bookmarks.values());liked=new ArrayList<>(likes.values());recent=new ArrayList<>(history.values());queries=new ArrayList<>(searches);
            for(JSONObject f:follows.values())try{authors.add(new JSONObject(f.toString()));}catch(JSONException ignored){}
            viewed=new ArrayList<>(viewedIdentities);hidden=new ArrayList<>(hiddenAuthors);favorites=new ArrayList<>(favoriteTags);choices=new LinkedHashMap<>(recommendationTags);suggestions=new LinkedHashSet<>(recentSuggestions);seed=recommendationSeed;for(List<String> group:exposureGroups)exposures.add(new ArrayList<>(group));
        }
        try{return new JSONObject().put("format","artcatalog-mobile").put("version",2).put("bookmarks",array(saved)).put("likes",array(liked))
            .put("history",array(recent)).put("follows",new JSONArray(authors)).put("searches",new JSONArray(queries))
            .put("preferences",new JSONObject().put("aiMode",prefs.getString("aiMode","all")).put("excludedTags",prefs.getString("excludedTags","")).put("hideFurry",prefs.getBoolean("hideFurry",false)).put("hideViewedAndSaved",prefs.getBoolean("hideViewedAndSaved",false)).put("hideFollowedArtists",prefs.getBoolean("hideFollowedArtists",false)).put("curation",new JSONObject(curation())).put("attributionPriority",prefs.getString("attributionPriority","creator")).put("artworkTabs",prefs.getString("artworkTabs","preview")).put("themePreference",prefs.getString("themePreference","dark")).put("secureCapture",prefs.getBoolean("secureCapture",false)))
            .put("viewedIdentities",new JSONArray(viewed)).put("recommendationTags",new JSONObject(choices)).put("recentSuggestions",new JSONArray(suggestions)).put("recommendationExposureGroups",new JSONArray(exposures)).put("favoriteTags",new JSONArray(favorites)).put("recommendationSeed",seed).put("hiddenAuthors",new JSONArray(hidden));
        }catch(JSONException e){throw new IllegalStateException(e);}
    }
    private JSONArray array(Collection<Post> posts){JSONArray a=new JSONArray();for(Post p:posts)a.put(p.toJson());return a;}
    int importJson(String json) throws Exception {return importProfile(ProfileTransfer.parse(json),false).added.optInt("bookmarks");}
    ProfileTransfer.Merge importProfile(JSONObject document,boolean applySettings) throws Exception {
        // One serialized disk writer, expensive preparation outside the UI-facing store lock.
        try{return writes.submit(()->{
            for(int attempt=0;attempt<8;attempt++){
                long expected;List<Post> cached,opened;Set<String> pinnedKeys;String preview;
                synchronized(this){expected=profileRevision;cached=new ArrayList<>(catalogue.values());opened=new ArrayList<>(openWorks.values());pinnedKeys=new LinkedHashSet<>(pinned);preview=previewKey;}
                JSONObject current=export();synchronized(this){if(profileRevision!=expected)continue;}
                ProfileTransfer.Merge merged=ProfileTransfer.merge(current,document,applySettings);
                if(!merged.changed){synchronized(this){if(profileRevision==expected)return merged;else continue;}}
                PreparedImport prepared=new PreparedImport(merged.mobile);
                JSONObject disk=new JSONObject(merged.mobile.toString()).put("catalogueCache",array(cached)).put("openWorks",array(opened)).put("pinnedWorks",new JSONArray(pinnedKeys)).put("previewKey",preview);
                File staging=new File(context.getFilesDir(),"catalog-import-staged.json");
                try(FileOutputStream stream=new FileOutputStream(staging)){stream.write(disk.toString().getBytes(StandardCharsets.UTF_8));stream.getFD().sync();}
                synchronized(this){if(profileRevision!=expected){staging.delete();continue;}}
                File original=file.getBaseFile();
                if(original.exists()){
                    File backup=new File(context.getFilesDir(),"catalog-before-import-"+System.currentTimeMillis()+".json");
                    try(InputStream in=new FileInputStream(original);FileOutputStream out=new FileOutputStream(backup)){byte[] bytes=new byte[8192];int count;while((count=in.read(bytes))!=-1)out.write(bytes,0,count);out.getFD().sync();}
                }
                synchronized(this){
                    if(profileRevision!=expected){staging.delete();continue;}
                    Map<String,?> before=prefs.getAll();Set<String> changed=new LinkedHashSet<>();
                    try{
                        if(applySettings){JSONObject imported=merged.mobile.optJSONObject("preferences");SharedPreferences.Editor edit=prefs.edit();
                            if(imported!=null){for(String field:List.of("aiMode","excludedTags","attributionPriority"))if(imported.has(field)){edit.putString(field,imported.optString(field));changed.add(field);}
                                for(String field:List.of("hideFurry","hideViewedAndSaved","hideFollowedArtists"))if(imported.has(field)){edit.putBoolean(field,imported.optBoolean(field));changed.add(field);}
                                JSONObject curation=imported.optJSONObject("curation");if(curation!=null)for(String field:List.of("enabled","popularity","personal","freshness","resolution"))if(curation.has(field)){String key="curation."+field;edit.putBoolean(key,curation.optBoolean(field));changed.add(key);}}
                            if(!edit.commit())throw new IOException("Не удалось сохранить настройки. Профиль не изменён.");
                        }
                        java.nio.file.Files.move(staging.toPath(),original.toPath(),java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                    }catch(Exception error){SharedPreferences.Editor restore=prefs.edit();for(String key:changed){Object value=before.get(key);if(value instanceof Boolean)restore.putBoolean(key,(Boolean)value);else if(value instanceof String)restore.putString(key,(String)value);else restore.remove(key);}restore.commit();staging.delete();throw error;}
                    bookmarks=prepared.bookmarks;likes=prepared.likes;history=prepared.history;follows=prepared.follows;viewedIdentities=prepared.viewed;
                    bookmarkTokens=prepared.bookmarkTokens;likedTokens=prepared.likedTokens;recommendationTags=prepared.choices;favoriteTags=prepared.favorites;hiddenAuthors=prepared.hidden;exposureGroups=prepared.exposures;
                    visibilityRevision++;profileRevision++;warning="";dirty=false;return merged;
                }
            }
            throw new IOException("Профиль обновлялся во время импорта. Данные сохранены; повторите импорт.");
        }).get();}catch(ExecutionException error){Throwable cause=error.getCause();if(cause instanceof Exception)throw (Exception)cause;throw new IOException("Не удалось объединить профиль",cause);}
    }
    private final class PreparedImport {
        final LinkedHashMap<String,Post> bookmarks=new LinkedHashMap<>(),likes=new LinkedHashMap<>(),history=new LinkedHashMap<>();final LinkedHashMap<String,JSONObject> follows=new LinkedHashMap<>();
        final Set<String> viewed=new LinkedHashSet<>(),bookmarkTokens=new HashSet<>(),likedTokens=new HashSet<>();final LinkedHashMap<String,String> choices=new LinkedHashMap<>();final LinkedHashSet<String> favorites=new LinkedHashSet<>(),hidden=new LinkedHashSet<>();List<List<String>> exposures=new ArrayList<>();
        PreparedImport(JSONObject root){
            readPosts(root.optJSONArray("bookmarks"),bookmarks);readPosts(root.optJSONArray("likes"),likes);readPosts(root.optJSONArray("history"),history);
            JSONArray values=root.optJSONArray("viewedIdentities");if(values!=null)for(int i=0;i<values.length();i++)viewed.add(values.optString(i));for(Post post:history.values())viewed.addAll(WorkGrouping.viewedTokens(post));while(history.size()>200)history.remove(history.keySet().iterator().next());
            for(Post post:bookmarks.values())bookmarkTokens.addAll(WorkGrouping.viewedTokens(post));for(Post post:likes.values())likedTokens.addAll(WorkGrouping.viewedTokens(post));
            JSONArray authors=root.optJSONArray("follows");if(authors!=null)for(int i=0;i<authors.length();i++){JSONObject f=authors.optJSONObject(i);if(f!=null)follows.put(f.optString("key"),f);}
            JSONObject tags=root.optJSONObject("recommendationTags");if(tags!=null)for(Iterator<String> keys=tags.keys();keys.hasNext();){String key=keys.next();choices.put(key,tags.optString(key));}
            JSONArray starred=root.optJSONArray("favoriteTags");if(starred!=null)for(int i=0;i<starred.length();i++)favorites.add(starred.optString(i));
            JSONArray concealed=root.optJSONArray("hiddenAuthors");if(concealed!=null)for(int i=0;i<concealed.length();i++){String key=concealed.optString(i);int at=key.indexOf(':');if(at>0){String normalized=authorKey(key.substring(0,at),key.substring(at+1));if(!normalized.isBlank())hidden.add(normalized);}}
            JSONArray groups=root.optJSONArray("recommendationExposureGroups");if(groups!=null)for(int i=0;i<groups.length();i++){JSONArray group=groups.optJSONArray(i);if(group==null)continue;List<String> keys=new ArrayList<>();for(int j=0;j<group.length();j++)keys.add(group.optString(j));exposures=ExposureHistory.append(exposures,keys);}
        }
    }
    private synchronized void persist(){
        profileRevision++;
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
