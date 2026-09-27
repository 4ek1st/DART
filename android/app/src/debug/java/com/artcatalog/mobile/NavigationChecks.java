package com.artcatalog.mobile;

import android.app.Activity;
import android.os.*;
import android.util.Log;
import java.lang.reflect.*;
import java.util.*;
import java.util.concurrent.*;

/** Exercises rapid input against the real activity and a deliberately busy grouping worker. */
final class NavigationChecks {
    static void manual(Activity activity,ImageLoader images){
        new Handler(Looper.getMainLooper()).postDelayed(()->{try{
            List<Post> fixtures=(List<Post>)field(field(activity,"client"),"fixtures");List<Post> posts=new ArrayList<>();
            for(int i=0;i<40;i++){Post p=Post.fromJson(fixtures.get(i).toJson());p.title="Проверка #"+p.id;p.media=new ArrayList<>(List.of(p.image));if(i==11){p.width=1600;p.height=450;}if(i==13){p.width=800;p.height=800;}if(i==15)p.media.add("https://cdn.donmai.us/artcatalog-qa/clip.mp4");posts.add(p);}
            Object source=screen(activity,posts,false),gallery=gallery(activity,posts,source);set(gallery,"syncedRevision",3);method(activity,"openArtwork",Post.class,gallery.getClass()).invoke(activity,posts.get(10),gallery);
            Log.i("ArtCatalogQA","NAV manual mixed-aspect gallery ready at 9000010; video variant at 9000015");
        }catch(Exception e){Log.e("ArtCatalogQA","Manual navigation setup",e);}},3500);
    }
    static void run(Activity activity, ImageLoader images) {
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            try {
                List<Post> fixtures=(List<Post>)field(field(activity,"client"),"fixtures");
                List<Post> posts=new ArrayList<>();
                for(int i=10;i<26;i++){Post p=Post.fromJson(fixtures.get(i).toJson());p.media=new ArrayList<>(List.of(p.image));posts.add(p);images.prefetch(p.preview,720);}
                Object source=screen(activity,posts,false);
                Object gallery=gallery(activity,posts,source);
                method(activity,"openArtwork",Post.class,gallery.getClass()).invoke(activity,posts.get(2),gallery);
                CountDownLatch release=new CountDownLatch(1);
                ((ExecutorService)field(activity,"grouping")).execute(()->{try{release.await(3,TimeUnit.SECONDS);}catch(InterruptedException e){Thread.currentThread().interrupt();}});
                set(gallery,"syncedRevision",-1);
                for(int i=0;i<5;i++)method(activity,"navigate",int.class).invoke(activity,1);
                new Handler(Looper.getMainLooper()).postDelayed(release::countDown,120);
                new Handler(Looper.getMainLooper()).postDelayed(()->{
                    try {
                        Post actual=(Post)field(activity,"activePost");
                        Log.i("ArtCatalogQA","NAV rapid five inputs survive grouping="+actual.key().equals(posts.get(7).key())+" expected="+posts.get(7).id+" actual="+actual.id);
                        pageBoundary(activity,fixtures);
                    }catch(Exception e){Log.e("ArtCatalogQA","Navigation result",e);}
                },3000);
            }catch(Exception e){Log.e("ArtCatalogQA","Navigation setup",e);}
        },3500);
    }
    private static void pageBoundary(Activity activity,List<Post> fixtures)throws Exception {
        method(activity,"selectNav",int.class).invoke(activity,0);
        List<Post> posts=new ArrayList<>();for(int i=0;i<16;i++){Post p=Post.fromJson(fixtures.get(i).toJson());p.media=new ArrayList<>(List.of(p.image));posts.add(p);}
        Object source=screen(activity,posts,true);set(source,"query","qa_slow_navigation");((Map<String,Integer>)field(source,"pages")).put("danbooru",1);
        Object gallery=gallery(activity,posts,source);set(gallery,"syncedRevision",(int)field(source,"revision"));
        method(activity,"openArtwork",Post.class,gallery.getClass()).invoke(activity,posts.get(15),gallery);
        for(int i=0;i<3;i++)method(activity,"navigate",int.class).invoke(activity,1);
        new Handler(Looper.getMainLooper()).postDelayed(()->{
            try {Post actual=(Post)field(activity,"activePost");Log.i("ArtCatalogQA","NAV three inputs across slow page including variant="+(actual.id.equals("9000017")&&(int)field(activity,"activeMediaIndex")==0)+" expected=9000017 actual="+actual.id);reverseVariants(activity,fixtures);}
            catch(Exception e){Log.e("ArtCatalogQA","Page navigation result",e);}
        },4000);
    }
    private static void reverseVariants(Activity activity,List<Post> fixtures)throws Exception {
        android.widget.ImageView old=(android.widget.ImageView)field(activity,"activeArt");
        for(int i=0;i<3;i++)method(activity,"navigate",int.class).invoke(activity,-1);
        Handler main=new Handler(Looper.getMainLooper());main.postDelayed(()->{
            try{android.widget.ImageView art=(android.widget.ImageView)field(activity,"activeArt"),snapshot=(android.widget.ImageView)field(activity,"outgoingMedia");boolean moving=Math.abs(art.getTranslationX())>0;Log.i("ArtCatalogQA","NAV real image animation retains bitmap and fixed controls="+(moving&&snapshot!=null&&snapshot.getDrawable()!=null&&((android.view.View)field(activity,"currentView")).getTranslationX()==0));}catch(Exception e){Log.e("ArtCatalogQA","Animation sampling",e);}
        },70);
        main.postDelayed(()->{
            try{Post actual=(Post)field(activity,"activePost");android.view.ViewGroup content=(android.view.ViewGroup)field(activity,"content");Log.i("ArtCatalogQA","NAV reverse three includes variant="+actual.id.equals("9000015")+" no retained pages="+(content.getChildCount()==1&&field(activity,"outgoingMedia")==null));hiddenPage(activity,fixtures);}
            catch(Exception e){Log.e("ArtCatalogQA","Reverse result",e);}
        },1500);
    }
    private static void hiddenPage(Activity activity,List<Post> fixtures)throws Exception {
        method(activity,"selectNav",int.class).invoke(activity,0);Store store=(Store)field(activity,"store");String excluded=store.prefs.getString("excludedTags","");store.prefs.edit().putString("excludedTags","qa_hidden").apply();
        List<Post> posts=new ArrayList<>(fixtures.subList(0,16));Object source=screen(activity,posts,true);set(source,"query","qa_hidden_pages");((Map<String,Integer>)field(source,"pages")).put("danbooru",1);
        Object gallery=gallery(activity,posts,source);set(gallery,"syncedRevision",(int)field(source,"revision"));method(activity,"openArtwork",Post.class,gallery.getClass()).invoke(activity,posts.get(15),gallery);method(activity,"navigate",int.class).invoke(activity,1);
        new Handler(Looper.getMainLooper()).postDelayed(()->{
            try{Post actual=(Post)field(activity,"activePost");Log.i("ArtCatalogQA","NAV one input crosses fully filtered page="+actual.id.equals("9000032")+" actual="+actual.id);store.prefs.edit().putString("excludedTags",excluded).apply();retry(activity,fixtures);}
            catch(Exception e){Log.e("ArtCatalogQA","Hidden navigation result",e);}
        },2000);
    }
    private static void retry(Activity activity,List<Post> fixtures)throws Exception {
        method(activity,"selectNav",int.class).invoke(activity,0);List<Post> posts=new ArrayList<>(fixtures.subList(0,16));Object source=screen(activity,posts,true);set(source,"query","qa_navigation_retry");((Map<String,Integer>)field(source,"pages")).put("danbooru",1);Object gallery=gallery(activity,posts,source);set(gallery,"syncedRevision",(int)field(source,"revision"));method(activity,"openArtwork",Post.class,gallery.getClass()).invoke(activity,posts.get(15),gallery);method(activity,"navigate",int.class).invoke(activity,1);
        Handler main=new Handler(Looper.getMainLooper());main.postDelayed(()->{
            try{Post actual=(Post)field(activity,"activePost");boolean released=field(activity,"navigating")==null;Log.i("ArtCatalogQA","NAV error keeps artwork and releases request="+(actual.id.equals("9000015")&&released));method(activity,"navigate",int.class).invoke(activity,1);}
            catch(Exception e){Log.e("ArtCatalogQA","Retry input",e);}
        },1400);
        main.postDelayed(()->{
            try{Post actual=(Post)field(activity,"activePost");Log.i("ArtCatalogQA","NAV retry resumes next artwork="+actual.id.equals("9000016"));cancelPending(activity,fixtures);}
            catch(Exception e){Log.e("ArtCatalogQA","Retry result",e);}
        },3200);
    }
    private static void cancelPending(Activity activity,List<Post> fixtures)throws Exception {
        method(activity,"selectNav",int.class).invoke(activity,0);List<Post> posts=new ArrayList<>(fixtures.subList(0,16));Object source=screen(activity,posts,true);set(source,"query","qa_slow_navigation");((Map<String,Integer>)field(source,"pages")).put("danbooru",1);Object gallery=gallery(activity,posts,source);set(gallery,"syncedRevision",(int)field(source,"revision"));method(activity,"openArtwork",Post.class,gallery.getClass()).invoke(activity,posts.get(15),gallery);method(activity,"navigate",int.class).invoke(activity,1);
        Handler main=new Handler(Looper.getMainLooper());main.postDelayed(()->{try{method(activity,"selectNav",int.class).invoke(activity,0);}catch(Exception e){Log.e("ArtCatalogQA","Cancel input",e);}},80);
        main.postDelayed(()->{try{Log.i("ArtCatalogQA","NAV tab change cancels delayed arrival="+(field(activity,"activePost")==null&&field(activity,"navigating")==null&&(int)field(activity,"nav")==0));imageFailure(activity,fixtures);}catch(Exception e){Log.e("ArtCatalogQA","Cancel result",e);}},1400);
    }
    private static void imageFailure(Activity activity,List<Post> fixtures)throws Exception {
        Post current=fixtures.get(12),bad=Post.fromJson(fixtures.get(53).toJson());bad.preview="https://unsupported.example/preview.jpg";bad.image="https://unsupported.example/full.jpg";bad.original=bad.image;bad.media=new ArrayList<>(List.of(bad.image));
        Object gallery=gallery(activity,List.of(current),null);method(activity,"openArtwork",Post.class,gallery.getClass()).invoke(activity,current,gallery);((List<Post>)field(gallery,"posts")).add(bad);
        Handler main=new Handler(Looper.getMainLooper());main.postDelayed(()->{try{method(activity,"navigate",int.class).invoke(activity,1);}catch(Exception e){Log.e("ArtCatalogQA","Image failure input",e);}},300);
        main.postDelayed(()->{try{boolean kept=field(activity,"activePost")==current&&field(activity,"navigating")==null&&((android.widget.ImageView)field(activity,"activeArt")).getDrawable() instanceof android.graphics.drawable.BitmapDrawable;Log.i("ArtCatalogQA","NAV failed image retains artwork without false readiness="+kept);method(activity,"navigate",int.class).invoke(activity,1);}catch(Exception e){Log.e("ArtCatalogQA","Image failure result",e);}},900);
        main.postDelayed(()->{try{Log.i("ArtCatalogQA","NAV failed image cooldown never counts as success="+(field(activity,"activePost")==current&&field(activity,"navigating")==null));cancelHeldTap(activity,fixtures);}catch(Exception e){Log.e("ArtCatalogQA","Failure cooldown",e);}},1400);
    }
    private static void cancelHeldTap(Activity activity,List<Post> fixtures)throws Exception {
        Post previous=(Post)field(activity,"activePost");Object gallery=gallery(activity,fixtures.subList(20,24),null);method(activity,"openArtwork",Post.class,gallery.getClass()).invoke(activity,fixtures.get(20),gallery);
        new Handler(Looper.getMainLooper()).postDelayed(()->{try{
            android.view.ViewGroup content=(android.view.ViewGroup)field(activity,"content");android.view.View button=(android.view.View)field(activity,"nextArtworkButton");int[] point=new int[2],origin=new int[2];button.getLocationOnScreen(point);content.getLocationOnScreen(origin);float x=point[0]-origin[0]+button.getWidth()/2f,y=point[1]-origin[1]+button.getHeight()/2f;long clock=SystemClock.uptimeMillis();
            android.view.MotionEvent down=android.view.MotionEvent.obtain(clock,clock,android.view.MotionEvent.ACTION_DOWN,x,y,0);content.dispatchTouchEvent(down);down.recycle();method(activity,"goBack").invoke(activity);int revision=(int)field(activity,"navigationGeneration");android.view.MotionEvent up=android.view.MotionEvent.obtain(clock,SystemClock.uptimeMillis(),android.view.MotionEvent.ACTION_UP,x,y,0);content.dispatchTouchEvent(up);up.recycle();
            Log.i("ArtCatalogQA","NAV Back cancels held pager tap="+(field(activity,"activePost")==previous&&(int)field(activity,"navigationGeneration")==revision));cancelAnimation(activity,fixtures);
        }catch(Exception e){Log.e("ArtCatalogQA","Held tap cancellation",e);}},500);
    }
    private static void cancelAnimation(Activity activity,List<Post> fixtures)throws Exception {
        Object gallery=gallery(activity,fixtures.subList(12,16),null);ImageLoader images=(ImageLoader)field(activity,"images");images.prefetch(fixtures.get(13).preview,720);method(activity,"openArtwork",Post.class,gallery.getClass()).invoke(activity,fixtures.get(12),gallery);
        Handler main=new Handler(Looper.getMainLooper());main.postDelayed(()->{try{method(activity,"navigate",int.class).invoke(activity,1);}catch(Exception e){Log.e("ArtCatalogQA","Animation cancel input",e);}},500);
        main.postDelayed(()->{try{boolean started=field(activity,"pageAnimator")!=null;method(activity,"selectNav",int.class).invoke(activity,0);Log.i("ArtCatalogQA","NAV cancellation exercised running animator="+started);}catch(Exception e){Log.e("ArtCatalogQA","Animation cancel",e);}},580);
        main.postDelayed(()->{try{android.view.ViewGroup content=(android.view.ViewGroup)field(activity,"content");Log.i("ArtCatalogQA","NAV cancelled animation cleans layers and queue="+(field(activity,"activePost")==null&&field(activity,"pageAnimator")==null&&field(activity,"outgoingMedia")==null&&field(activity,"outgoingPage")==null&&content.getChildCount()==1));}catch(Exception e){Log.e("ArtCatalogQA","Animation cancellation result",e);}},1100);
    }
    private static Object screen(Activity activity,List<Post> posts,boolean more)throws Exception {
        Class<?> type=Class.forName("com.artcatalog.mobile.MainActivity$Screen");Constructor<?> c=type.getDeclaredConstructors()[0];c.setAccessible(true);Object s=c.newInstance(activity,6);
        ((List<Post>)field(s,"posts")).addAll(posts);set(s,"loaded",true);set(s,"more",more);set(s,"revision",3);return s;
    }
    private static Object gallery(Activity activity,List<Post> posts,Object source)throws Exception {
        Class<?> type=Class.forName("com.artcatalog.mobile.MainActivity$Gallery");Constructor<?> c=type.getDeclaredConstructors()[0];c.setAccessible(true);return c.newInstance(activity,posts,source);
    }
    private static Method method(Object target,String name,Class<?>...args)throws Exception{Method m=target.getClass().getDeclaredMethod(name,args);m.setAccessible(true);return m;}
    private static Object field(Object target,String name)throws Exception{Field f=target.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(target);}
    private static void set(Object target,String name,Object value)throws Exception{Field f=target.getClass().getDeclaredField(name);f.setAccessible(true);f.set(target,value);}
}
