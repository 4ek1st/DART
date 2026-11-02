package com.artcatalog.mobile;

import android.app.Activity;
import android.os.*;
import android.util.Log;
import java.lang.reflect.*;
import java.util.*;
import org.json.*;

/** Real Activity regression scenarios. Neutral data only; absent from release builds. */
final class UsabilityChecks {
    private static final Handler main=new Handler(Looper.getMainLooper());
    private static final String TAG="DARTUsabilityQA";
    static void run(Activity activity,ImageLoader images,String mode){
        if(mode.equals("usability-live-sankaku")){liveSankaku(activity,images);return;}
        if(mode.equals("usability-preparation-error")){preparationError(activity);return;}
        if(mode.equals("usability-saved-gallery")){savedGallery(activity);return;}
        try{
            List<Post> fixtures=(List<Post>)field(field(activity,"client"),"fixtures");
            Post first=copy(fixtures.get(20)),last=copy(fixtures.get(22));
            Post unavailable=new Post();unavailable.source="sankaku";unavailable.id="NeutralMiss1";unavailable.title="Neutral unavailable artwork";unavailable.rating="g";
            unavailable.preview="https://unsupported.example/neutral-preview.jpg";unavailable.image="https://unsupported.example/neutral-full.jpg";unavailable.original=unavailable.image;unavailable.media=List.of(unavailable.image);
            Class<?> gallery=Class.forName("com.artcatalog.mobile.MainActivity$Gallery");Constructor<?> constructor=gallery.getDeclaredConstructors()[0];constructor.setAccessible(true);
            Object context=constructor.newInstance(activity,List.of(first,unavailable,last),null);
            method(activity,"openArtwork",Post.class,gallery).invoke(activity,first,context);
            main.postDelayed(()->{try{long started=SystemClock.elapsedRealtime();method(activity,"navigate",int.class).invoke(activity,1);
                main.postDelayed(()->{try{check(activity,"failed-media-arrival",unavailable,started);method(activity,"navigate",int.class).invoke(activity,1);
                    main.postDelayed(()->{try{check(activity,"past-failed-media",last,started);method(activity,"navigate",int.class).invoke(activity,-1);
                        main.postDelayed(()->{try{check(activity,"reverse-failed-media",unavailable,started);method(activity,"navigate",int.class).invoke(activity,-1);
                            main.postDelayed(()->{try{check(activity,"reverse-first",first,started);Log.i(TAG,"NAVIGATION COMPLETE");}catch(Exception e){fail(e);}},650);
                        }catch(Exception e){fail(e);}},650);
                    }catch(Exception e){fail(e);}},650);
                }catch(Exception e){fail(e);}},650);
            }catch(Exception e){fail(e);}},400);
        }catch(Exception error){fail(error);}
    }
    private static void savedGallery(Activity activity){try{
        Store store=(Store)field(activity,"store");Field rating=activity.getClass().getDeclaredField("rating");rating.setAccessible(true);rating.set(activity,"all");
        method(activity,"localGrid",String.class,List.class).invoke(activity,"Понравившееся",store.likes());
        main.postDelayed(()->{try{android.view.View card=findCard((android.view.View)field(activity,"currentView"));if(card==null)throw new IllegalStateException();card.performClick();
            Post previous=(Post)field(activity,"activePost");Object gallery=field(activity,"activeGallery"),source=field(gallery,"source");
            Log.i(TAG,"SAVED source snapshot synced="+field(gallery,"syncedRevision").equals(field(source,"revision"))+" count="+((List<?>)field(gallery,"posts")).size());
            long started=SystemClock.elapsedRealtime();method(activity,"navigate",int.class).invoke(activity,1);Runnable[] poll={null};poll[0]=()->{try{boolean arrived=field(activity,"activePost")!=previous&&field(activity,"navigating")==null;long elapsed=SystemClock.elapsedRealtime()-started;
                if(arrived||elapsed>=2000){Log.i(TAG,"SAVED first turn arrived="+arrived+" elapsedMs="+elapsed);return;}main.postDelayed(poll[0],40);
            }catch(Exception error){fail(error);}};main.post(poll[0]);
        }catch(Exception error){fail(error);}},500);
    }catch(Exception error){fail(error);}}
    private static android.view.View findCard(android.view.View view){android.graphics.Rect bounds=new android.graphics.Rect();if(view.getClass().getSimpleName().equals("Card")&&view.getGlobalVisibleRect(bounds)&&!bounds.isEmpty())return view;
        if(view instanceof android.view.ViewGroup)for(int i=0;i<((android.view.ViewGroup)view).getChildCount();i++){android.view.View found=findCard(((android.view.ViewGroup)view).getChildAt(i));if(found!=null)return found;}return null;}
    private static void preparationError(Activity activity){try{
        Store store=(Store)field(activity,"store");Post broken=new Post();broken.source="danbooru";broken.id="99999991";broken.rating="g";broken.artistTag="qa_fault_artist";
        broken.tags=new ArrayList<String>(List.of("landscape","forest")){
            @Override public Iterator<String> iterator(){String thread=Thread.currentThread().getName();if(thread.contains("taste-model")||thread.contains("grouping"))throw new OutOfMemoryError("Neutral worker failure");return super.iterator();}
        };
        store.like(broken);method(activity,"invalidateScreens").invoke(activity);method(activity,"selectNav",int.class).invoke(activity,0);
        main.postDelayed(()->{try{
            Object screen=((Object[])field(activity,"screens"))[0];boolean released=!(boolean)field(screen,"loading")&&(boolean)field(screen,"failed");
            Log.i(TAG,"PREPARATION failure released="+released);store.toggleLike(broken);method(activity,"statusAction",screen.getClass()).invoke(activity,screen);
            main.postDelayed(()->{try{Log.i(TAG,"PREPARATION retry recovered="+(!(boolean)field(screen,"loading")&&!(boolean)field(screen,"failed")));}catch(Exception error){fail(error);}},1800);
        }catch(Exception error){fail(error);}},1200);
    }catch(Exception error){fail(error);}}
    private static void liveSankaku(Activity activity,ImageLoader images){
        new Thread(()->{CatalogClient client=null;try{
            Store store=(Store)field(activity,"store");Post selected=null;
            for(Post post:store.likes())if(post.source.equals("sankaku")&&post.id.matches("[0-9]+")&&post.hash.matches("(?i)[a-f0-9]{32}")){selected=Post.fromJson(post.toJson());break;}
            if(selected==null){Log.e(TAG,"LIVE legacy setup missing");return;}
            Post target=selected;String originalKey=target.key(),hash=target.hash;long started=SystemClock.elapsedRealtime();client=new CatalogClient(store);client.enrich(target);
            boolean preserved=originalKey.equals(target.key())&&hash.equalsIgnoreCase(target.hash);boolean media=!target.media.isEmpty();
            Log.i(TAG,"LIVE legacy metadata preserved="+preserved+" media="+media+" elapsedMs="+(SystemClock.elapsedRealtime()-started));
            main.post(()->images.prepare(target.preview,720,decoded->Log.i(TAG,"LIVE legacy preview decoded="+decoded+" totalMs="+(SystemClock.elapsedRealtime()-started))));
        }catch(Throwable error){Log.e(TAG,"LIVE legacy failed type="+error.getClass().getSimpleName());}finally{if(client!=null)client.close();}},"DART-QA-guest-media").start();
    }
    private static Post copy(Post source){Post p=Post.fromJson(source.toJson());p.media=List.of(p.image);p.groupMembers=List.of();return p;}
    private static void check(Activity activity,String name,Post expected,long started)throws Exception{
        Post current=(Post)field(activity,"activePost");boolean passed=current==expected&&field(activity,"navigating")==null;
        Log.i(TAG,name+" passed="+passed+" elapsedMs="+(SystemClock.elapsedRealtime()-started));
    }
    private static void fail(Exception error){Log.e(TAG,"FAILED",error);}
    private static Object field(Object object,String name)throws Exception{Field f=object.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(object);}
    private static Method method(Object object,String name,Class<?>...types)throws Exception{Method m=object.getClass().getDeclaredMethod(name,types);m.setAccessible(true);return m;}
}
