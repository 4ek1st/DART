package com.artcatalog.mobile;

import android.app.Activity;
import android.graphics.Bitmap;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import java.io.File;
import java.io.FileOutputStream;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.json.JSONArray;
import org.json.JSONObject;

/** Neutral, native Following arrival/order/navigation regression; never part of release. */
final class MobileFollowingReliabilityChecks {
    private static final String TAG="DARTFollowingQA";
    private static final Handler MAIN=new Handler(Looper.getMainLooper());
    private static final class Probe {
        final Activity activity;
        final long started=SystemClock.elapsedRealtime();
        final JSONArray samples=new JSONArray(), events=new JSONArray();
        final List<JSONObject> requests=Collections.synchronizedList(new ArrayList<>());
        final List<String> encountered=new ArrayList<>();
        String liked="",mirror="";
        boolean opened;
        Probe(Activity activity){this.activity=activity;}
        void event(String name)throws Exception{
            JSONObject event=new JSONObject().put("name",name).put("ms",SystemClock.elapsedRealtime()-started);
            Post active=(Post)field(activity,"activePost");
            event.put("current",active==null?"":active.key());
            events.put(event);Log.i(TAG,name+" current="+(active==null?"none":active.id));
        }
        Object screen()throws Exception{return ((Object[])field(activity,"screens"))[2];}
        void openWhenReady(int attempts){
            try{
                Object screen=screen();List<Post> posts=screen==null?List.of():(List<Post>)field(screen,"posts");
                if(posts.size()<3){if(attempts<25)MAIN.postDelayed(()->openWhenReady(attempts+1),100);return;}
                Post target=posts.get(2);View card=findCard((View)field(screen,"view"),target.key());
                if(card==null){if(attempts<25)MAIN.postDelayed(()->openWhenReady(attempts+1),100);return;}
                card.performClick();opened=true;event("opened-while-peers-held");
                for(int i=0;i<8;i++)navigateAfter(300+i*350,1,"early-forward");
                for(int i=0;i<6;i++)navigateAfter(3300+i*350,-1,"early-back");
            }catch(Exception error){Log.e(TAG,"Open",error);}
        }
        void navigateAfter(long delay,int delta,String name){MAIN.postDelayed(()->{
            try{if(field(activity,"activePost")!=null){method(activity,"navigate",int.class).invoke(activity,delta);event(name);}}
            catch(Exception error){Log.e(TAG,"Navigate",error);}
        },delay);}
        void sample(int count){
            try{
                Object screen=screen();JSONObject row=new JSONObject().put("ms",SystemClock.elapsedRealtime()-started);
                if(screen!=null){List<Post> posts=(List<Post>)field(screen,"posts");row.put("feed",sequence(posts)).put("loading",field(screen,"loading")).put("unread",new JSONArray((java.util.Set<String>)field(screen,"unreadKeys")));}
                Post active=(Post)field(activity,"activePost");row.put("current",active==null?"":active.key());
                Object gallery=field(activity,"activeGallery");
                if(gallery!=null)row.put("gallery",sequence((List<Post>)field(gallery,"posts")));
                if(active!=null){ImageView image=(ImageView)field(activity,"activeArt");row.put("imageReady",image!=null&&image.getDrawable() instanceof android.graphics.drawable.BitmapDrawable);if(encountered.isEmpty()||!encountered.get(encountered.size()-1).equals(active.key()))encountered.add(active.key());}
                samples.put(row);
                if(count==260)finish();
            }catch(Exception error){Log.e(TAG,"Sample",error);}
        }
        void finish()throws Exception{
            JSONObject report=new JSONObject().put("samples",samples).put("events",events).put("requests",new JSONArray(requests)).put("encountered",new JSONArray(encountered)).put("liked",liked).put("mirror",mirror).put("opened",opened);
            File file=new File(activity.getExternalFilesDir(null),"following-fairness-native.json");
            try(FileOutputStream output=new FileOutputStream(file)){output.write(report.toString(2).getBytes(StandardCharsets.UTF_8));}
            Log.i(TAG,"RESULT opened="+opened+" samples="+samples.length()+" encounters="+encountered.size()+" liked="+liked);
        }
    }
    static void run(Activity activity,ImageLoader images){
        new Thread(()->{try{
            Probe probe=new Probe(activity);Map<String,List<Post>> authors=new LinkedHashMap<>();
            int authorIndex=0,run=(int)Math.floorMod(System.nanoTime(),100000);
            for(String tag:List.of("qa_fair_a","qa_fair_b","qa_fair_c","qa_fair_old")){
                List<Post> posts=new ArrayList<>();int amount=authorIndex==0?24:authorIndex==3?2:6;
                Bitmap bitmap=Bitmap.createBitmap(240,240,Bitmap.Config.ARGB_8888);bitmap.eraseColor(new int[]{0xff329cff,0xff24563d,0xffe0a055,0xff654a87}[authorIndex]);
                for(int i=0;i<amount;i++){
                    Post post=new Post();post.source="danbooru";post.id=String.format(Locale.ROOT,"97%d%05d%03d",authorIndex,run,amount-i);
                    post.artistTag=tag;post.artist=tag;post.artistTags=List.of(tag);post.title="Neutral Following "+tag+" "+(amount-i);
                    post.rating="g";post.width=post.height=240;post.published=authorIndex==3?"2026-10-31T10:00:00Z":"2026-11-01T10:00:00Z";
                    post.preview="https://cdn.donmai.us/qa-following/"+post.id+".jpg";post.smallPreview=post.preview;post.image=post.original=post.preview;post.media=List.of(post.image);
                    post.tags=List.of("landscape",tag,"qa_unique_"+post.id);images.seed(post.preview,bitmap);posts.add(post);
                }
                bitmap.recycle();authors.put(tag,posts);authorIndex++;
            }
            String hash="0123456789abcdef0123456789abcdef";
            authors.get("qa_fair_a").get(2).hash=hash;
            Post mirror=Post.fromJson(authors.get("qa_fair_a").get(2).toJson());mirror.source="sankaku";mirror.id=String.format(Locale.ROOT,"98%05d%04d",run,1);
            mirror.memberKeys=List.of(mirror.key());mirror.identityKeys=List.of();mirror.groupMembers=List.of();mirror.groupingVersion=0;mirror.imageRecords=new JSONArray();mirror.visualSamples=new JSONArray();probe.mirror=mirror.key();
            AtomicInteger mirrorCalls=new AtomicInteger();Map<String,AtomicInteger> calls=new ConcurrentHashMap<>();
            CatalogClient fake=new CatalogClient((source,query,page,rating,sort)->{
                CatalogClient.Page result=new CatalogClient.Page();result.fingerprints.put(source,query+":"+page);
                if(source.equals("sankaku")&&query.contains("qa_fair_a")&&page==0){int call=mirrorCalls.incrementAndGet();long start=SystemClock.elapsedRealtime()-probe.started;if(call==1)Thread.sleep(2100);result.posts.add(mirror);probe.requests.add(new JSONObject().put("author","qa_fair_a_mirror").put("startMs",start).put("doneMs",SystemClock.elapsedRealtime()-probe.started).put("call",call));return result;}
                if(!source.equals("danbooru")||page!=0)return result;
                for(Map.Entry<String,List<Post>> author:authors.entrySet())if(query.contains(author.getKey())){
                    int call=calls.computeIfAbsent(author.getKey(),key->new AtomicInteger()).incrementAndGet();
                    long start=SystemClock.elapsedRealtime()-probe.started;
                    if(call==1)Thread.sleep(author.getKey().endsWith("_b")?9500:author.getKey().endsWith("_c")?10000:author.getKey().endsWith("_old")?18000:40);
                    result.posts.addAll(author.getValue());probe.requests.add(new JSONObject().put("author",author.getKey()).put("startMs",start).put("doneMs",SystemClock.elapsedRealtime()-probe.started).put("call",call));break;
                }
                return result;
            });
            MAIN.post(()->{try{
                Store store=(Store)field(activity,"store");for(JSONObject entry:store.follows())store.removeFollow(entry.optString("key"));
                for(String tag:authors.keySet())if(!store.following(tag))store.toggleFollow(tag);
                synchronized(store){for(JSONObject entry:store.follows())entry.put("followedAt","2026-10-30T10:00:00Z").put("seenAt",new JSONObject().put("general","2026-10-31T18:00:00Z"));}
                store.prefs.edit().putBoolean("hideFollowedArtists",false).putBoolean("hideViewedAndSaved",true).putString("excludedTags","").putString("rating","general").putString("source","all").commit();
                set(activity,"client",fake);set(activity,"rating","general");set(activity,"sourceFilter","all");((Object[])field(activity,"screens"))[2]=null;
                method(activity,"selectNav",int.class).invoke(activity,2);
                MAIN.postDelayed(()->probe.openWhenReady(0),1600);
                probe.navigateAfter(14000,1,"sync-after-peer-arrival");
                MAIN.postDelayed(()->{try{Post active=(Post)field(activity,"activePost");if(active!=null){store.like(active);probe.liked=active.key();probe.event("liked-during-held-old-peer");}}catch(Exception error){Log.e(TAG,"Like",error);}},15000);
                for(int i=0;i<8;i++)probe.navigateAfter(16000+i*350,1,"mixed-forward");
                MAIN.postDelayed(()->{try{method(activity,"goBack").invoke(activity);probe.event("back-to-feed");}catch(Exception error){Log.e(TAG,"Back",error);}},22000);
                for(int tick=0;tick<=260;tick++){final int count=tick;MAIN.postDelayed(()->probe.sample(count),tick*100L);}
            }catch(Exception error){Log.e(TAG,"Setup UI",error);}});
        }catch(Exception error){Log.e(TAG,"Setup fixtures",error);}},"DART-QA-following").start();
    }
    private static JSONArray sequence(List<Post> posts)throws Exception{JSONArray sequence=new JSONArray();for(Post post:posts)sequence.put(new JSONObject().put("key",post.key()).put("artist",post.artistTag).put("published",post.published).put("aliases",new JSONArray(post.memberKeys)));return sequence;}
    private static View findCard(View view,String key)throws Exception{if(view==null)return null;if(view.getClass().getSimpleName().equals("Card")){Post post=(Post)field(view,"post");if(post!=null&&post.key().equals(key))return view;}if(view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++){View match=findCard(((ViewGroup)view).getChildAt(i),key);if(match!=null)return match;}return null;}
    private static Object field(Object target,String name)throws Exception{Field field=target.getClass().getDeclaredField(name);field.setAccessible(true);return field.get(target);}
    private static void set(Object target,String name,Object value)throws Exception{Field field=target.getClass().getDeclaredField(name);field.setAccessible(true);field.set(target,value);}
    private static Method method(Object target,String name,Class<?>...types)throws Exception{Method method=target.getClass().getDeclaredMethod(name,types);method.setAccessible(true);return method;}
}
