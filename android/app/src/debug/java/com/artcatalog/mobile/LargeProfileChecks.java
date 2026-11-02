package com.artcatalog.mobile;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Rect;
import android.graphics.drawable.BitmapDrawable;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.util.JsonReader;
import android.util.JsonToken;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import java.io.*;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.json.*;

/** Real Activity checks after a large portable import. Debug-only; logs contain aggregates only. */
final class LargeProfileChecks {
    private static final String TAG="DARTLargeProfileQA";
    private static final int PAGE_SIZE=12,PAGES=3,STAGES=4;
    private final Activity activity;private final ImageLoader images;private final Store store;
    private final Handler main=new Handler(Looper.getMainLooper());
    private final JSONObject report=new JSONObject();private final List<Post> fixtureArt;
    private final Map<String,Long> gaps=new LinkedHashMap<>();
    private final AtomicInteger totalRequests=new AtomicInteger(),heldPeers=new AtomicInteger();
    private AtomicInteger highestPage=new AtomicInteger();
    private final List<String> interests=new ArrayList<>();
    private String phase="import";private boolean stopped;private long heartbeatAt=SystemClock.elapsedRealtime();
    private CatalogClient client;private Post savedProbe;private int initialLikes,initialBookmarks,initialFollows;
    private final String runLabel;private boolean verification;
    private long deadlineMs=45000;

    static void run(Activity activity,ImageLoader images,String mode){
        try{if(!activity.getIntent().getBooleanExtra("qaFixtures",false))throw new IllegalStateException();
            LargeProfileChecks checks=new LargeProfileChecks(activity,images);checks.verification=mode.endsWith("-verify");checks.begin();
        }catch(Throwable error){Log.e(TAG,"START failed errorType="+type(error));}
    }
    @SuppressWarnings("unchecked") private LargeProfileChecks(Activity activity,ImageLoader images)throws Exception{
        this.activity=activity;this.images=images;store=(Store)field(activity,"store");
        fixtureArt=new ArrayList<>((List<Post>)field(field(activity,"client"),"fixtures"));
        String selected=activity.getIntent().getStringExtra("qaReliabilityPhase");runLabel=selected!=null&&selected.matches("[A-Za-z0-9_-]{1,24}")?selected:"run";
        put("run",runLabel);
        deadlineMs=Math.max(5000,Math.min(120000,activity.getIntent().getLongExtra("qaLargePhaseTimeoutMs",45000)));
    }
    private void begin()throws Exception{
        if(verification){verifyColdProfile();return;}
        heartbeat();method(activity,"invalidateScreens").invoke(activity);((CatalogClient)field(activity,"client")).close();
        new Thread(()->{
            try{
                long started=SystemClock.elapsedRealtime();File internal=new File(activity.getFilesDir(),"dart-large-profile.json"),external=activity.getExternalFilesDir(null);
                File input=internal.exists()?internal:external!=null?new File(external,"dart-large-profile.json"):internal;
                if(!input.exists())write(input,neutralProfile().toString().getBytes(StandardCharsets.UTF_8));
                if(input.length()>ProfileTransfer.MAX_BYTES)throw new IOException();
                byte[] bytes;try(InputStream in=new FileInputStream(input)){bytes=in.readAllBytes();}
                long parsing=SystemClock.elapsedRealtime();JSONObject document=ProfileTransfer.parse(new String(bytes,StandardCharsets.UTF_8));
                long parsed=SystemClock.elapsedRealtime();ProfileTransfer.Merge imported=store.importProfile(document,true);
                long merged=SystemClock.elapsedRealtime();initialLikes=store.likes().size();initialBookmarks=store.bookmarks().size();initialFollows=store.follows().size();
                pickInterests();seedImages();store.prefs.edit().putString("rating","general").putString("source","all").commit();
                put("inputBytes",bytes.length);put("inputCounts",ProfileTransfer.counts(document));put("parseMs",parsed-parsing);put("importMs",merged-parsed);
                put("prepareTotalMs",SystemClock.elapsedRealtime()-started);put("importChanged",imported.changed);
                put("likesBefore",initialLikes);put("bookmarksBefore",initialBookmarks);put("followsBefore",initialFollows);put("eligibleInterestCount",interests.size());
                main.post(()->{try{set(activity,"rating","general");set(activity,"sourceFilter","all");home();}catch(Throwable error){fail("home-start",error);finish();}});
                Log.i(TAG,"IMPORT complete bytes="+bytes.length+" parseMs="+(parsed-parsing)+" importMs="+(merged-parsed)+" likes="+initialLikes+" bookmarks="+initialBookmarks+" follows="+initialFollows+" eligibleInterests="+interests.size());
            }catch(Throwable error){main.post(()->{fail("import",error);finish();});}
        },"DART-large-profile-import").start();
    }
    private void heartbeat(){
        if(stopped||activity.isFinishing())return;long now=SystemClock.elapsedRealtime();gaps.put(phase,Math.max(gaps.getOrDefault(phase,0L),now-heartbeatAt));heartbeatAt=now;main.postDelayed(this::heartbeat,50);
    }
    private void phase(String name){phase=name;gaps.putIfAbsent(name,0L);heartbeatAt=SystemClock.elapsedRealtime();}
    private void installClient(int stage)throws Exception{
        if(client!=null)client.close();AtomicBoolean delayed=new AtomicBoolean();AtomicInteger pages=new AtomicInteger();highestPage=pages;
        client=new CatalogClient((source,query,page,rating,sort)->{
            totalRequests.incrementAndGet();CatalogClient.Page result=new CatalogClient.Page();
            if(source.equals("sankaku")&&delayed.compareAndSet(false,true)){heldPeers.incrementAndGet();try{Thread.sleep(4000);}finally{heldPeers.decrementAndGet();}}
            if(source.equals("danbooru")&&page<PAGES){pages.accumulateAndGet(page,Math::max);for(int i=0;i<PAGE_SIZE;i++)result.posts.add(candidate(stage,page*PAGE_SIZE+i));if(page+1<PAGES)result.more.add(source);}
            result.fingerprints.put(source,"neutral:"+stage+":"+page);return result;
        });set(activity,"client",client);
    }
    private void home()throws Exception{
        phase("home");installClient(0);method(activity,"invalidateScreens").invoke(activity);long started=SystemClock.elapsedRealtime();
        method(activity,"selectNav",int.class).invoke(activity,0);awaitCards("home",()->screen(0),started,()->openAndBack("home",screen(0),true,this::following));
    }
    private void following(){
        try{phase("following");installClient(1);long started=SystemClock.elapsedRealtime();method(activity,"selectNav",int.class).invoke(activity,2);
            awaitCards("following",()->screen(2),started,()->openAndBack("following",screen(2),false,this::search));
        }catch(Throwable error){fail("following",error);search();}
    }
    private void awaitCards(String name,CheckedSupplier<Object> source,long started,CheckedRunnable continuation){
        poll(()->{Object screen=source.get();return screen!=null&&firstCard(screen)!=null;},deadlineMs,()->{
            try{Object screen=source.get();int cards=countCards(screen,false),bitmaps=countCards(screen,true);
                put(name+"FirstCardMs",SystemClock.elapsedRealtime()-started);put(name+"MaterializedCards",cards);put(name+"ReadyBitmaps",bitmaps);put(name+"Posts",((List<?>)field(screen,"posts")).size());
                put(name+"PeerHeldAtFirstCard",heldPeers.get()>0);Log.i(TAG,name+" FIRST elapsedMs="+(SystemClock.elapsedRealtime()-started)+" materialized="+cards+" readyBitmaps="+bitmaps+" peerHeld="+(heldPeers.get()>0));continuation.run();
            }catch(Throwable error){fail(name+"-cards",error);next(name);}
        },()->{put(name+"FirstCardTimedOut",true);Log.i(TAG,name+" FIRST timeout elapsedMs="+(SystemClock.elapsedRealtime()-started));next(name);});
    }
    private void openAndBack(String name,Object source,boolean save,CheckedRunnable continuation)throws Exception{
        int generation=(Integer)field(source,"generation");View feed=(View)field(source,"view");View card=firstCard(source);if(card==null)throw new IllegalStateException();
        long started=SystemClock.elapsedRealtime();boolean held=heldPeers.get()>0;card.performClick();
        main.postDelayed(()->{try{Post active=(Post)field(activity,"activePost");boolean opened=active!=null;put(name+"CardOpened",opened);put(name+"OpenMs",SystemClock.elapsedRealtime()-started);put(name+"OpenWhilePeerHeld",held&&heldPeers.get()>0);
            Log.i(TAG,name+" OPEN passed="+opened+" elapsedMs="+(SystemClock.elapsedRealtime()-started)+" peerHeld="+(held&&heldPeers.get()>0));
            if(save&&active!=null){savedProbe=active;TextView like=(TextView)field(activity,"activeLikeButton");ViewGroup actions=(ViewGroup)like.getParent();int likeIndex=actions.indexOfChild(like);
                View bookmark=likeIndex>0?actions.getChildAt(likeIndex-1):null;
                if(!(bookmark instanceof TextView)||!((TextView)bookmark).getText().toString().startsWith("▣"))throw new IllegalStateException();
                like.performClick();bookmark.performClick();boolean saved=store.liked(active)&&store.saved(active);put("likeAndBookmarkImmediate",saved);if(!saved)throw new IllegalStateException();}
            long back=SystemClock.elapsedRealtime();method(activity,"goBack").invoke(activity);main.postDelayed(()->{try{
                boolean sameView=field(activity,"currentView")==feed,sameGeneration=generation==(Integer)field(source,"generation"),same=sameView&&sameGeneration;put(name+"BackMs",SystemClock.elapsedRealtime()-back);put(name+"BackSameFeedGeneration",same);put(name+"BackSameView",sameView);put(name+"BackGenerationBefore",generation);put(name+"BackGenerationAfter",field(source,"generation"));
                if(save&&savedProbe!=null){boolean retained=false;for(Post post:(List<Post>)field(source,"posts"))if(FeedSession.keys(post).contains(savedProbe.key()))retained=true;put("savedCardRetainedThisVisit",retained);}
                Log.i(TAG,name+" BACK sameFeedGeneration="+same+" elapsedMs="+(SystemClock.elapsedRealtime()-back));continuation.run();
            }catch(Throwable error){fail(name+"-back",error);next(name);}},200);
        }catch(Throwable error){fail(name+"-open",error);next(name);}},120);
    }
    private void search(){
        try{phase("search");installClient(2);long started=SystemClock.elapsedRealtime();method(activity,"runSearch",String.class).invoke(activity,"qa_large_profile_search");
            awaitCards("search",()->screen(1),started,()->{
                Object source=screen(1);int before=((List<?>)field(source,"posts")).size();FeedListView list=(FeedListView)field(source,"list");
                android.widget.BaseAdapter adapter=(android.widget.BaseAdapter)field(source,"adapter");list.setSelectionFromTop(Math.max(0,adapter.getCount()-1),0);
                poll(()->highestPage.get()>0||((List<?>)field(source,"posts")).size()>before,20000,()->{try{put("searchPagination",true);put("searchPostsAfterPagination",((List<?>)field(source,"posts")).size());author();}catch(Throwable error){fail("search-pagination",error);author();}},()->{put("searchPagination",false);author();});
            });
        }catch(Throwable error){fail("search",error);author();}
    }
    private void author(){
        try{phase("author");installClient(3);long started=SystemClock.elapsedRealtime();method(activity,"authorProfile",String.class).invoke(activity,"qa_large_profile_artist");
            awaitCards("author",()->field(activity,"activeAuthor"),started,this::profile);
        }catch(Throwable error){fail("author",error);profile();}
    }
    private void profile(){
        try{phase("profile");long started=SystemClock.elapsedRealtime();method(activity,"selectNav",int.class).invoke(activity,4);put("profileOpenMs",SystemClock.elapsedRealtime()-started);
            put("likesAfter",store.likes().size());put("bookmarksAfter",store.bookmarks().size());put("followsAfter",store.follows().size());
            method(activity,"invalidateScreens").invoke(activity);if(client!=null)client.close();
            new Thread(()->{try{
                awaitProfileWriteIdle();
                if(savedProbe!=null)write(new File(activity.getFilesDir(),"dart-large-profile-"+runLabel+"-probe.json"),new JSONArray(FeedSession.keys(savedProbe)).toString().getBytes(StandardCharsets.UTF_8));
                File file=new File(activity.getFilesDir(),"catalog.json");DiskCounts disk=readDiskCounts(file,savedProbe==null?Set.of():FeedSession.keys(savedProbe));
                put("savedActionsPersisted",savedProbe!=null&&disk.liked&&disk.saved);put("persistedLikes",disk.likes);put("persistedBookmarks",disk.bookmarks);put("persistedFollows",disk.follows);
                put("persistedProfileBytes",file.length());put("persistenceVerification","streamed-file");main.post(this::finish);
            }catch(Throwable error){main.post(()->{fail("persistence",error);finish();});}},"DART-large-profile-persistence").start();
        }catch(Throwable error){fail("profile",error);finish();}
    }
    private void verifyColdProfile()throws Exception{
        phase("cold-profile");heartbeat();method(activity,"invalidateScreens").invoke(activity);((CatalogClient)field(activity,"client")).close();
        new Thread(()->{try{List<Post> likes=store.likes(),bookmarks=store.bookmarks();Set<String> saved=new HashSet<>();for(Post post:bookmarks)saved.addAll(FeedSession.keys(post));
            String expectedLabel=activity.getIntent().getStringExtra("qaLargeExpectedPhase");if(expectedLabel==null||!expectedLabel.matches("[A-Za-z0-9_-]{1,24}"))expectedLabel=runLabel;
            Set<String> probeKeys=new HashSet<>();File probeFile=new File(activity.getFilesDir(),"dart-large-profile-"+expectedLabel+"-probe.json");
            if(probeFile.exists()&&probeFile.length()<32768)try(InputStream input=new FileInputStream(probeFile)){JSONArray keys=new JSONArray(new String(input.readAllBytes(),StandardCharsets.UTF_8));for(int i=0;i<keys.length();i++)probeKeys.add(keys.optString(i));}
            boolean probe=false;for(Post post:likes){Set<String> keys=FeedSession.keys(post);if(!Collections.disjoint(keys,probeKeys)&&!Collections.disjoint(keys,saved)){probe=true;break;}}
            put("coldPersistedLikes",likes.size());put("coldPersistedBookmarks",bookmarks.size());put("coldPersistedFollows",store.follows().size());put("coldSavedActionsRetained",probe);
            File expectedFile=new File(activity.getFilesDir(),"dart-large-profile-"+expectedLabel+"-results.json");boolean matched=false;
            if(expectedFile.exists()&&expectedFile.length()<32768){JSONObject expected;try(InputStream in=new FileInputStream(expectedFile)){expected=new JSONObject(new String(in.readAllBytes(),StandardCharsets.UTF_8));}matched=expected.optInt("persistedLikes",-1)==likes.size()&&expected.optInt("persistedBookmarks",-1)==bookmarks.size()&&expected.optInt("persistedFollows",-1)==store.follows().size();}
            put("coldCountsMatchPersistedRun",matched);put("coldVerificationUsesSingleLoadedStore",true);main.post(this::finish);
        }catch(Throwable error){main.post(()->{fail("cold-profile",error);finish();});}},"DART-large-profile-cold-verify").start();
    }
    private static final class DiskCounts {int likes,bookmarks,follows;boolean liked,saved;}
    /** Check the AtomicFile without allocating a second copy of the already loaded profile. */
    private static DiskCounts readDiskCounts(File file,Set<String> probe)throws IOException{
        DiskCounts result=new DiskCounts();try(JsonReader reader=new JsonReader(new BufferedReader(new InputStreamReader(new FileInputStream(file),StandardCharsets.UTF_8),8192))){reader.beginObject();while(reader.hasNext()){String field=reader.nextName();if(!Set.of("likes","bookmarks","follows").contains(field)||reader.peek()!=JsonToken.BEGIN_ARRAY){reader.skipValue();continue;}
                int count=0;boolean found=false;reader.beginArray();while(reader.hasNext()){count++;if((field.equals("likes")||field.equals("bookmarks"))&&reader.peek()==JsonToken.BEGIN_OBJECT){String source="",id="";boolean matching=false;reader.beginObject();while(reader.hasNext()){String key=reader.nextName();if(Set.of("key","source","id").contains(key)&&reader.peek()==JsonToken.STRING){String value=reader.nextString();if(key.equals("source"))source=value;else if(key.equals("id"))id=value;else matching|=probe.contains(value);}else if(key.equals("memberKeys")&&reader.peek()==JsonToken.BEGIN_ARRAY){reader.beginArray();while(reader.hasNext()){if(reader.peek()==JsonToken.STRING)matching|=probe.contains(reader.nextString());else reader.skipValue();}reader.endArray();}else reader.skipValue();}reader.endObject();found|=matching||probe.contains(source+":"+id);}else reader.skipValue();}reader.endArray();
                if(field.equals("likes")){result.likes=count;result.liked=found;}else if(field.equals("bookmarks")){result.bookmarks=count;result.saved=found;}else result.follows=count;
            }reader.endObject();}return result;
    }
    private void next(String failed){if(failed.equals("home"))following();else if(failed.equals("following"))search();else if(failed.equals("search"))author();else profile();}
    private void awaitProfileWriteIdle()throws Exception{
        ExecutorService writes=(ExecutorService)field(store,"writes");long until=SystemClock.elapsedRealtime()+90000;
        while(SystemClock.elapsedRealtime()<until){
            try{method(store,"flushPending").invoke(store);}catch(NoSuchMethodException baseline){}
            writes.submit(()->{}).get(Math.max(1,until-SystemClock.elapsedRealtime()),TimeUnit.MILLISECONDS);
            boolean dirty,writing,snapshot=false;synchronized(store){dirty=(Boolean)field(store,"dirty");writing=(Boolean)field(store,"writing");try{snapshot=(Boolean)field(store,"snapshotWriting");}catch(NoSuchFieldException baseline){}}
            if(!dirty&&!writing&&!snapshot){put("savedWriteIdle",true);return;}Thread.sleep(50);
        }
        throw new TimeoutException();
    }
    private void poll(CheckedSupplier<Boolean> condition,long timeout,Runnable yes,Runnable no){
        long started=SystemClock.elapsedRealtime();Runnable[] check={null};check[0]=()->{if(stopped)return;try{if(condition.get()){yes.run();return;}}catch(Throwable error){fail(phase+"-poll",error);no.run();return;}
            if(SystemClock.elapsedRealtime()-started>=timeout){no.run();return;}main.postDelayed(check[0],100);};main.post(check[0]);
    }
    private void finish(){
        if(stopped)return;stopped=true;put("complete",true);put("requestCount",totalRequests.get());put("mainHeartbeatMaxGapMs",gaps.values().stream().mapToLong(Long::longValue).max().orElse(0));put("phaseHeartbeatMaxGapMs",new JSONObject(gaps));
        new Thread(()->{try{write(new File(activity.getFilesDir(),"dart-large-profile-"+runLabel+(verification?"-verify":"")+"-results.json"),report.toString().getBytes(StandardCharsets.UTF_8));Log.i(TAG,"COMPLETE aggregates="+report);}catch(Throwable error){Log.e(TAG,"RESULT failed errorType="+type(error));}},"DART-large-profile-report").start();
    }
    private void pickInterests(){
        Map<String,Integer> counts=new LinkedHashMap<>();Map<String,String> choices=store.recommendationTags();
        for(Post post:store.likes())for(String tag:Recommendations.workTags(post))if(!Recommendations.broad(tag)&&!"disabled".equals(choices.get(tag)))counts.merge(tag,1,Integer::sum);
        List<String> ordered=new ArrayList<>(counts.keySet());ordered.sort(Comparator.comparingInt((String tag)->counts.get(tag)).reversed());
        for(String tag:ordered){if(counts.get(tag)<8)continue;Post trial=candidate(0,0);trial.tags=new ArrayList<>(List.of(tag));if(store.visible(List.of(trial),true,true).isEmpty())continue;interests.add(tag);if(interests.size()>=6)break;}
    }
    private void seedImages()throws Exception{
        File directory=(File)field(images,"directory");String url=fixtureArt.get(0).image;Bitmap art=BitmapFactory.decodeFile(new File(directory,sha(url)).getPath());if(art==null)throw new IOException();
        try{for(int stage=0;stage<STAGES;stage++)for(int index=0;index<PAGE_SIZE*PAGES;index++)images.seed(candidateUrl(stage,index),art);}finally{art.recycle();}
    }
    private Post candidate(int stage,int index){
        Post p=new Post();p.source="danbooru";p.id=String.valueOf(986000000L+stage*10000L+index);p.title="Neutral artwork";p.artist="Neutral artist";
        p.artistTag=stage==3?"qa_large_profile_artist":"qa_large_profile_artist_"+(index%4);p.artistTags=List.of(p.artistTag);p.rating="g";
        p.preview=candidateUrl(stage,index);p.smallPreview=p.preview;p.image=p.preview;p.original=p.preview;p.media=List.of(p.image);p.hash=String.format(Locale.ROOT,"%032x",986000000L+stage*10000L+index);
        p.width=720;p.height=900;p.published="2026-11-01T12:00:00Z";p.tags=new ArrayList<>(interests);p.tags.add("qa_neutral_landscape");p.sourceUrl="https://danbooru.donmai.us/posts/"+p.id;return p;
    }
    private static String candidateUrl(int stage,int index){return "https://cdn.donmai.us/artcatalog-qa/large-profile-"+stage+"-"+index+".jpg";}
    private static JSONObject neutralProfile()throws Exception{
        JSONObject document=new JSONObject().put("format","dart-profile").put("version",1).put("createdAt","2026-11-01T12:00:00Z");
        int id=7000000;for(String field:List.of("likes","bookmarks","history")){JSONArray records=new JSONArray();int size=field.equals("likes")?3200:field.equals("bookmarks")?400:40;
            for(int i=0;i<size;i++){Post p=new Post();p.source="danbooru";p.id=String.valueOf(id++);p.title="Neutral saved artwork "+"detail ".repeat(100);p.artist="Neutral saved artist";p.artistTag="qa_saved_artist_"+(i%120);p.artistTags=List.of(p.artistTag);p.rating="g";p.hash=String.format(Locale.ROOT,"%032x",id);p.published="2026-10-01T12:00:00Z";for(int tag=0;tag<128;tag++)p.tags.add(String.format(Locale.ROOT,"qa_large_interest_%03d",tag));records.put(p.toJson());}document.put(field,records);}
        JSONArray follows=new JSONArray();for(int i=0;i<120;i++)follows.put(new JSONObject().put("role","artist").put("source","artist").put("artistId","qa_saved_artist_"+i).put("name","Neutral saved artist"));
        JSONArray viewed=new JSONArray();for(int i=0;i<75000;i++)viewed.put("key:danbooru:"+(3000000+i));
        return document.put("follows",follows).put("viewedIdentities",viewed).put("favoriteTags",new JSONArray()).put("recommendationTags",new JSONObject())
            .put("preferences",new JSONObject().put("aiMode","generated-and-assisted").put("hideFurry",true).put("hideViewedAndSaved",true).put("hideFollowedArtists",true).put("excludedTags",new JSONArray().put("qa_excluded")));
    }
    private Object screen(int index)throws Exception{return ((Object[])field(activity,"screens"))[index];}
    private Set<String> cardKeys(Object screen)throws Exception{Set<String> keys=new HashSet<>();View view=(View)field(screen,"view");Object adapter=field(screen,"adapter");if(view==null||view!=field(activity,"currentView")||adapter==null||((List<?>)field(adapter,"shown")).isEmpty())return keys;
        for(Post post:(List<Post>)field(screen,"posts"))keys.addAll(FeedSession.keys(post));return keys;}
    private View firstCard(Object screen)throws Exception{Set<String> keys=cardKeys(screen);return keys.isEmpty()?null:firstCard((View)field(screen,"view"),field(screen,"adapter"),keys);}
    private static boolean boundCard(View view,Object adapter,Set<String> keys)throws Exception{if(!view.getClass().getSimpleName().equals("Card"))return false;Rect visible=new Rect();if(view.getVisibility()!=View.VISIBLE||!view.getGlobalVisibleRect(visible)||visible.isEmpty()||field(view,"feed")!=adapter)return false;
        Post post=(Post)field(view,"post");return post!=null&&!Collections.disjoint(FeedSession.keys(post),keys);}
    private static View firstCard(View view,Object adapter,Set<String> keys)throws Exception{if(view==null)return null;if(boundCard(view,adapter,keys))return view;
        if(view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++){View found=firstCard(((ViewGroup)view).getChildAt(i),adapter,keys);if(found!=null)return found;}return null;}
    private int countCards(Object screen,boolean bitmapOnly)throws Exception{Set<String> keys=cardKeys(screen);return keys.isEmpty()?0:countCards((View)field(screen,"view"),field(screen,"adapter"),keys,bitmapOnly);}
    private static int countCards(View view,Object adapter,Set<String> keys,boolean bitmapOnly)throws Exception{if(view==null)return 0;if(boundCard(view,adapter,keys))return !bitmapOnly||((android.widget.ImageView)field(view,"image")).getDrawable() instanceof BitmapDrawable?1:0;
        int count=0;if(view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++)count+=countCards(((ViewGroup)view).getChildAt(i),adapter,keys,bitmapOnly);return count;}
    private void fail(String name,Throwable error){put(name+"ErrorType",type(error));List<String> causes=new ArrayList<>();for(Throwable cause=error;cause!=null&&causes.size()<6;cause=cause.getCause())causes.add(cause.getClass().getSimpleName());put(name+"ErrorCauses",new JSONArray(causes));Log.e(TAG,name+" failed errorTypes="+causes);for(StackTraceElement frame:error.getStackTrace())if(frame.getClassName().startsWith("com.artcatalog.mobile"))Log.e(TAG,"failure-site="+frame.getClassName()+":"+frame.getLineNumber());}
    private synchronized void put(String key,Object value){try{report.put(key,value);}catch(JSONException ignored){}}
    private static String type(Throwable error){if(error instanceof InvocationTargetException&&error.getCause()!=null)return error.getCause().getClass().getSimpleName();return error.getClass().getSimpleName();}
    private static void write(File file,byte[] bytes)throws IOException{try(OutputStream out=new FileOutputStream(file)){out.write(bytes);}}
    private static String sha(String value)throws Exception{byte[] bytes=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));StringBuilder out=new StringBuilder();for(byte b:bytes)out.append(String.format(Locale.ROOT,"%02x",b));return out.toString();}
    private static Object field(Object object,String name)throws Exception{Field field=object.getClass().getDeclaredField(name);field.setAccessible(true);return field.get(object);}
    private static void set(Object object,String name,Object value)throws Exception{Field field=object.getClass().getDeclaredField(name);field.setAccessible(true);field.set(object,value);}
    private static Method method(Object object,String name,Class<?>...types)throws Exception{Method method=object.getClass().getDeclaredMethod(name,types);method.setAccessible(true);return method;}
    private interface CheckedSupplier<T>{T get()throws Exception;}
    private interface CheckedRunnable{void run()throws Exception;}
}
