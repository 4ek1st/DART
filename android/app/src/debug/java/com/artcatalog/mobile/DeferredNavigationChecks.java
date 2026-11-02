package com.artcatalog.mobile;

import android.app.Activity;
import android.graphics.Bitmap;
import android.os.*;
import android.util.Log;
import android.view.View;
import android.widget.BaseAdapter;
import java.io.*;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.json.*;

/** Real-Activity boundary/retry regression with neutral, entirely local data. */
final class DeferredNavigationChecks {
    private static final String TAG="DARTDeferredQA",QUERY="qa_deferred_boundary";
    private static final Handler MAIN=new Handler(Looper.getMainLooper());
    private static final class Probe {
        final Activity activity;final JSONObject result=new JSONObject();final Map<String,Integer> requested=Collections.synchronizedMap(new LinkedHashMap<>());
        final AtomicInteger arrivals=new AtomicInteger(),requestCount=new AtomicInteger();final long started=SystemClock.elapsedRealtime();Object screen,job;Post first,last,extra;
        Probe(Activity activity){this.activity=activity;}
        void flag(String name,boolean value)throws Exception{result.put(name,value);Log.i(TAG,name+"="+value);}
        void failure(Throwable error){try{while(error instanceof InvocationTargetException&&error.getCause()!=null)error=error.getCause();result.put("failure",error.getClass().getSimpleName());Log.e(TAG,"Deferred check: "+error.getClass().getSimpleName());save();}catch(Exception ignored){}}
        void save()throws Exception{result.put("elapsedMs",SystemClock.elapsedRealtime()-started);synchronized(requested){result.put("requests",new JSONObject(requested));}File path=new File(activity.getExternalFilesDir(null),"qa-deferred-navigation.json");try(OutputStream out=new FileOutputStream(path)){out.write(result.toString(2).getBytes(StandardCharsets.UTF_8));}}
        void start(ImageLoader images)throws Exception{
            Store store=(Store)field(activity,"store");store.prefs.edit().putBoolean("hideViewedAndSaved",false).putBoolean("hideFollowedArtists",false).putString("excludedTags","").commit();
            first=post(1);last=post(2);extra=post(3);Bitmap bitmap=Bitmap.createBitmap(80,80,Bitmap.Config.ARGB_8888);bitmap.eraseColor(0xff329cff);for(Post p:List.of(first,last,extra))images.seed(p.preview,bitmap);bitmap.recycle();
            CatalogClient fake=new CatalogClient((source,query,page,rating,sort)->{CatalogClient.Page response=new CatalogClient.Page();response.fingerprints.put(source,query+":"+page);if(query.equals(QUERY)){requestCount.incrementAndGet();requested.put(source,page);if(source.equals("danbooru"))response.posts.add(extra);}return response;});
            set(activity,"client",fake);set(activity,"rating","general");set(activity,"sourceFilter","all");
            Class<?> type=Class.forName("com.artcatalog.mobile.MainActivity$Screen");Constructor<?> constructor=type.getDeclaredConstructors()[0];constructor.setAccessible(true);screen=constructor.newInstance(activity,2);((Object[])field(activity,"screens"))[2]=screen;
            method(activity,"buildFeed",type).invoke(activity,screen);List<Post> posts=(List<Post>)field(screen,"posts");posts.add(first);posts.add(last);set(screen,"loaded",true);set(screen,"more",true);set(screen,"followingExposed",2);set(screen,"revision",1);
            Class<?> jobType=Class.forName("com.artcatalog.mobile.MainActivity$Job");Constructor<?> jobConstructor=jobType.getDeclaredConstructor(String.class,Map.class);jobConstructor.setAccessible(true);job=jobConstructor.newInstance(QUERY,new LinkedHashMap<>(Map.of("danbooru",4,"gelbooru",7)));((Deque<Object>)field(screen,"jobs")).add(job);
            Map<String,Long> deferred=(Map<String,Long>)field(screen,"deferredSources");long deadline=System.currentTimeMillis()+2500;deferred.put(QUERY+"|danbooru",deadline);deferred.put(QUERY+"|gelbooru",deadline);
            ((BaseAdapter)field(screen,"adapter")).notifyDataSetChanged();method(activity,"display",View.class).invoke(activity,field(screen,"view"));
            Class<?> galleryType=Class.forName("com.artcatalog.mobile.MainActivity$Gallery");Constructor<?> galleryConstructor=galleryType.getDeclaredConstructors()[0];galleryConstructor.setAccessible(true);Object gallery=galleryConstructor.newInstance(activity,List.of(first,last),screen);set(gallery,"syncedRevision",1);
            method(activity,"openArtwork",Post.class,galleryType).invoke(activity,last,gallery);
            try{method(activity,"navigate",int.class,Runnable.class).invoke(activity,1,(Runnable)arrivals::incrementAndGet);flag("nextReturnedWithoutRecursion",true);}catch(Throwable error){while(error instanceof InvocationTargetException&&error.getCause()!=null)error=error.getCause();flag("nextReturnedWithoutRecursion",false);result.put("nextError",error.getClass().getSimpleName());}
            MAIN.postDelayed(()->{try{flag("waitingKeepsCurrent",field(activity,"activePost")==last);flag("waitingHasNoRequests",requested.isEmpty());flag("waitingPreservesCursors",cursors());method(activity,"navigate",int.class).invoke(activity,-1);}catch(Throwable error){failure(error);}},250);
            MAIN.postDelayed(()->{try{flag("reverseCancelsPendingNext",field(activity,"activePost")==first&&field(activity,"navigating")==null&&arrivals.get()==0);flag("reversePreservesCursors",cursors());flag("reverseStillHasNoRequests",requested.isEmpty());save();}catch(Throwable error){failure(error);}},1000);
            MAIN.postDelayed(()->{try{flag("viewerRetriesDeferredPages",Integer.valueOf(4).equals(requested.get("danbooru"))&&Integer.valueOf(7).equals(requested.get("gelbooru")));flag("lateRetryDoesNotAutoNavigate",field(activity,"activePost")==first&&arrivals.get()==0);flag("retryAddsNewArtwork",((List<Post>)field(screen,"posts")).stream().anyMatch(p->p.key().equals(extra.key())));method(activity,"navigate",int.class,Runnable.class).invoke(activity,1,(Runnable)()->{});save();}catch(Throwable error){failure(error);}},4000);
            MAIN.postDelayed(()->{try{flag("forwardAfterRetryRevisitsImmediateNeighbor",((Post)field(activity,"activePost")).key().equals(last.key()));method(activity,"navigate",int.class,Runnable.class).invoke(activity,1,(Runnable)()->{});}catch(Throwable error){failure(error);}},4500);
            MAIN.postDelayed(()->{try{flag("forwardReachesRetriedArtwork",((Post)field(activity,"activePost")).key().equals(extra.key()));flag("noProviderFlood",requestCount.get()==2);save();Log.i(TAG,"Deferred navigation checks complete");}catch(Throwable error){failure(error);}},5100);
        }
        boolean cursors()throws Exception{return ((Map<?,?>)field(job,"pages")).equals(Map.of("danbooru",4,"gelbooru",7));}
    }
    static void run(Activity activity,ImageLoader images){if(!activity.getIntent().getBooleanExtra("qaFixtures",false))throw new IllegalStateException("Neutral fixtures required");Probe probe=new Probe(activity);try{probe.start(images);}catch(Throwable error){probe.failure(error);}}
    private static Post post(int index){Post p=new Post();p.source="danbooru";p.id=""+(9800900+index);p.hash=String.format(Locale.ROOT,"%032x",9800900+index);p.title="Neutral deferred work "+index;p.rating="g";p.artistTag="qa_deferred_artist";p.artistTags=List.of(p.artistTag);p.preview=p.image=p.original="https://cdn.donmai.us/qa-deferred/"+index+".jpg";p.media=List.of(p.image);p.width=p.height=80;p.tags=List.of("landscape","qa_deferred_unique_"+index);return p;}
    private static Object field(Object target,String name)throws Exception{Field field=target.getClass().getDeclaredField(name);field.setAccessible(true);return field.get(target);}
    private static void set(Object target,String name,Object value)throws Exception{Field field=target.getClass().getDeclaredField(name);field.setAccessible(true);field.set(target,value);}
    private static Method method(Object target,String name,Class<?>... types)throws Exception{Method method=target.getClass().getDeclaredMethod(name,types);method.setAccessible(true);return method;}
}
