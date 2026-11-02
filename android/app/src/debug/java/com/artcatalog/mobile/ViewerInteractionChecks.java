package com.artcatalog.mobile;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.drawable.BitmapDrawable;
import android.os.*;
import android.view.*;
import android.widget.*;
import java.io.*;
import java.lang.reflect.*;
import java.util.*;
import java.util.concurrent.*;
import org.json.*;

/** Native regression checks for viewer input and imported saved previews. Neutral debug data only. */
final class ViewerInteractionChecks {
    private final Activity activity;
    private final ImageLoader images;
    private final Handler main=new Handler(Looper.getMainLooper());
    private final JSONObject result=new JSONObject();
    private ViewerInteractionChecks(Activity activity,ImageLoader images){this.activity=activity;this.images=images;}
    static void run(Activity activity,ImageLoader images){new ViewerInteractionChecks(activity,images).start();}
    private void check(String key,boolean value)throws Exception{result.put(key,value);android.util.Log.i("DARTInteractionQA",key+"="+value);save();}
    private void metric(String key,long value)throws Exception{result.put(key,value);save();}
    private void save()throws Exception{try(FileOutputStream out=new FileOutputStream(new File(activity.getExternalFilesDir(null),"viewer-interactions.json"))){out.write(result.toString(2).getBytes(java.nio.charset.StandardCharsets.UTF_8));}}
    private void failure(Throwable error){try{result.put("error",error.toString());save();}catch(Exception ignored){}android.util.Log.e("DARTInteractionQA","Native interaction check failed",error);}
    private void start(){try{
        if(!activity.getIntent().getBooleanExtra("qaFixtures",false))throw new IllegalStateException("Neutral fixtures required");
        zoom();likes();
    }catch(Throwable error){failure(error);}}
    private void zoom()throws Exception{
        ZoomImageView view=new ZoomImageView(activity);view.layout(0,0,400,800);
        Bitmap bitmap=Bitmap.createBitmap(400,800,Bitmap.Config.ARGB_8888);bitmap.setDensity(0);view.setImageBitmap(bitmap);
        set(view,"scale",2f);set(view,"x",-200f);set(view,"y",-400f);method(view,"update").invoke(view);
        long now=SystemClock.uptimeMillis();
        touch(view,now,0,MotionEvent.ACTION_DOWN,new int[]{4},new float[]{100,200});
        touch(view,now,20,MotionEvent.ACTION_POINTER_DOWN|(1<<MotionEvent.ACTION_POINTER_INDEX_SHIFT),new int[]{4,9},new float[]{100,200,300,600});
        touch(view,now,40,MotionEvent.ACTION_MOVE,new int[]{4,9},new float[]{80,180,320,620});
        touch(view,now,60,MotionEvent.ACTION_POINTER_UP,new int[]{4,9},new float[]{80,180,320,620});
        float x=(float)field(view,"x"),y=(float)field(view,"y");
        touch(view,now,80,MotionEvent.ACTION_MOVE,new int[]{9},new float[]{320,620});
        check("liftingFirstPinchFingerKeepsImageStill",Math.abs(x-(float)field(view,"x"))<.01&&Math.abs(y-(float)field(view,"y"))<.01);
        touch(view,now,100,MotionEvent.ACTION_UP,new int[]{9},new float[]{320,620});
        view.fit();set(view,"scale",2f);set(view,"x",-200f);set(view,"y",-400f);method(view,"update").invoke(view);
        touch(view,now+1000,0,MotionEvent.ACTION_DOWN,new int[]{4},new float[]{60,100});
        touch(view,now+1000,100,MotionEvent.ACTION_POINTER_DOWN|(1<<MotionEvent.ACTION_POINTER_INDEX_SHIFT),new int[]{4,9},new float[]{60,100,340,700});
        touch(view,now+1000,200,MotionEvent.ACTION_MOVE,new int[]{4,9},new float[]{40,80,360,720});
        touch(view,now+1000,300,MotionEvent.ACTION_MOVE,new int[]{4,9},new float[]{35,75,365,725});
        float beforePan=(float)field(view,"x");
        touch(view,now+1000,400,MotionEvent.ACTION_MOVE,new int[]{4,9},new float[]{55,75,385,725});
        metric("twoFingerPanMovementPx",Math.round((float)field(view,"x")-beforePan));
        check("twoFingerPanFollowsFingerCenter",Math.abs((float)field(view,"x")-beforePan-20)<.1);
        touch(view,now+1000,450,MotionEvent.ACTION_CANCEL,new int[]{4,9},new float[]{55,75,385,725});
        view.setTag("neutral-same-media");view.fit();set(view,"scale",2f);set(view,"x",-200f);set(view,"y",-400f);method(view,"update").invoke(view);
        Bitmap full=Bitmap.createBitmap(800,1600,Bitmap.Config.ARGB_8888);full.setDensity(0);view.setImageBitmap(full);
        check("qualityUpgradeKeepsZoomAndSubject",Math.abs((float)field(view,"scale")/(float)field(view,"minScale")-2)<.001&&Math.abs((float)field(view,"x")+200)<.01&&Math.abs((float)field(view,"y")+400)<.01);
        view.fit();int[] moves={0};view.onNext=()->moves[0]++;view.onPrevious=()->moves[0]--;
        touch(view,now+3000,0,MotionEvent.ACTION_DOWN,new int[]{0},new float[]{320,400});
        touch(view,now+3000,100,MotionEvent.ACTION_MOVE,new int[]{0},new float[]{80,400});
        touch(view,now+3000,180,MotionEvent.ACTION_UP,new int[]{0},new float[]{80,400});
        check("fingerLeftOpensNext",moves[0]==1);
        moves[0]=0;
        touch(view,now+4000,0,MotionEvent.ACTION_DOWN,new int[]{0},new float[]{80,400});
        touch(view,now+4000,100,MotionEvent.ACTION_MOVE,new int[]{0},new float[]{320,400});
        touch(view,now+4000,180,MotionEvent.ACTION_UP,new int[]{0},new float[]{320,400});
        check("fingerRightReturnsPrevious",moves[0]==-1);
        view.setImageDrawable(null);bitmap.recycle();full.recycle();
    }
    private static void touch(View view,long down,long elapsed,int action,int[] ids,float[] xy){
        MotionEvent.PointerProperties[] properties=new MotionEvent.PointerProperties[ids.length];MotionEvent.PointerCoords[] coords=new MotionEvent.PointerCoords[ids.length];
        for(int i=0;i<ids.length;i++){properties[i]=new MotionEvent.PointerProperties();properties[i].id=ids[i];properties[i].toolType=MotionEvent.TOOL_TYPE_FINGER;coords[i]=new MotionEvent.PointerCoords();coords[i].x=xy[i*2];coords[i].y=xy[i*2+1];coords[i].pressure=1;coords[i].size=1;}
        MotionEvent event=MotionEvent.obtain(down,down+elapsed,action,ids.length,properties,coords,0,0,1,1,0,0,android.view.InputDevice.SOURCE_TOUCHSCREEN,0);try{view.dispatchTouchEvent(event);}finally{event.recycle();}
    }
    private void likes()throws Exception{
        Post post=post(0);FrameLayout host=(FrameLayout)field(activity,"content");TextView feedback=(TextView)method(activity,"likeFeedback",FrameLayout.class).invoke(activity,host);
        Method like=method(activity,"likeArtwork",Post.class,TextView.class,TextView.class);like.invoke(activity,post,null,feedback);
        main.postDelayed(()->{try{
            long started=SystemClock.elapsedRealtime();like.invoke(activity,post,null,feedback);metric("repeatLikeHandlerMs",SystemClock.elapsedRealtime()-started);
            main.postDelayed(()->{try{check("repeatLikeVisibleWithin100ms",feedback.getAlpha()>.2f&&feedback.getVisibility()==View.VISIBLE);Store store=(Store)field(activity,"store");check("repeatedDoubleTapKeepsLiked",store.liked(post));feedback.animate().cancel();host.removeView(feedback);navigation();}catch(Throwable error){failure(error);}},100);
        }catch(Throwable error){failure(error);}},1200);
    }
    private void navigation()throws Exception{
        method(activity,"selectNav",int.class).invoke(activity,0);List<Post> posts=List.of(post(1),post(2),post(3));
        for(Post p:posts){Bitmap bitmap=Bitmap.createBitmap(64,64,Bitmap.Config.ARGB_8888);bitmap.eraseColor(0xff329cff);images.seed(p.preview,bitmap);bitmap.recycle();}
        Class<?> screenType=Class.forName("com.artcatalog.mobile.MainActivity$Screen");Constructor<?> constructor=screenType.getDeclaredConstructors()[0];constructor.setAccessible(true);Object screen=constructor.newInstance(activity,6);
        ((List<Post>)field(screen,"posts")).addAll(posts);set(screen,"revision",7);set(screen,"loaded",true);set(screen,"more",false);
        Class<?> galleryType=Class.forName("com.artcatalog.mobile.MainActivity$Gallery");constructor=galleryType.getDeclaredConstructors()[0];constructor.setAccessible(true);Object gallery=constructor.newInstance(activity,posts,screen);
        method(activity,"openArtwork",Post.class,galleryType).invoke(activity,posts.get(0),gallery);set(gallery,"syncedRevision",-1);
        CountDownLatch held=new CountDownLatch(1),entered=new CountDownLatch(1);((ExecutorService)field(activity,"grouping")).execute(()->{entered.countDown();try{held.await(2,TimeUnit.SECONDS);}catch(InterruptedException error){Thread.currentThread().interrupt();}});
        new Thread(()->{try{entered.await(2,TimeUnit.SECONDS);main.post(()->{try{
            long started=SystemClock.elapsedRealtime();method(activity,"navigate",int.class,Runnable.class).invoke(activity,1,(Runnable)()->{});
            main.postDelayed(()->{try{metric("readyNeighborCheckMs",SystemClock.elapsedRealtime()-started);check("readyNeighborDoesNotWaitForGrouping",field(activity,"activePost")==posts.get(1));}catch(Throwable error){failure(error);}finally{held.countDown();main.postDelayed(()->{try{cachedDuplicates(posts,screen,gallery);}catch(Throwable error){failure(error);}},500);}},120);
        }catch(Throwable error){held.countDown();failure(error);}});}catch(InterruptedException error){Thread.currentThread().interrupt();}},"DART-QA-held-grouping").start();
    }
    private void cachedDuplicates(List<Post> posts,Object screen,Object gallery)throws Exception{
        method(activity,"selectNav",int.class).invoke(activity,0);Post merged=posts.get(0).copy();merged.memberKeys=List.of(posts.get(0).key(),posts.get(1).key());
        List<Post> current=(List<Post>)field(screen,"posts");current.clear();current.addAll(List.of(merged,posts.get(2)));set(screen,"revision",8);
        method(activity,"openArtwork",Post.class,gallery.getClass()).invoke(activity,posts.get(0),gallery);
        method(activity,"navigate",int.class,Runnable.class).invoke(activity,1,(Runnable)()->{});
        main.postDelayed(()->{try{check("readyNavigationSkipsNewlyConfirmedCopy",field(activity,"activePost")==posts.get(2));savedPreview();}catch(Throwable error){failure(error);}},200);
    }
    private void savedPreview()throws Exception{
        Post saved=post(4);saved.source="sankaku";saved.id="qaSavedMedia4";saved.preview=saved.smallPreview=saved.image=saved.original="";saved.media=List.of();saved.hash="44444444444444444444444444444444";
        String renewed="https://s.sankakucomplex.com/qa-renewed/44444444444444444444444444444444.jpg?e=9999999999&m=fresh";
        Bitmap bitmap=Bitmap.createBitmap(64,64,Bitmap.Config.ARGB_8888);bitmap.eraseColor(0xff329cff);images.seed(renewed,bitmap);bitmap.recycle();
        CatalogClient previous=(CatalogClient)field(activity,"client");CatalogClient fake=new CatalogClient((source,query,page,rating,sort)->new CatalogClient.Page()){
            @Override void enrich(Post p,int priority){p.preview=p.smallPreview=p.image=p.original=renewed;p.media=List.of(renewed);}
        };set(activity,"client",fake);previous.close();Store store=(Store)field(activity,"store");store.like(saved);if(!store.saved(saved))store.toggle(saved);
        method(activity,"localGrid",String.class,List.class).invoke(activity,"Понравившееся",List.of(saved));
        main.postDelayed(()->{try{View card=findCard((View)field(activity,"currentView"),saved.key());ImageView cover=card==null?null:(ImageView)field(card,"image");check("importedSankakuPreviewRebindsWithoutLeavingLikes",cover!=null&&cover.getTag() instanceof ImageLoader.Ticket&&((ImageLoader.Ticket)cover.getTag()).url.equals(renewed)&&cover.getDrawable() instanceof BitmapDrawable);check("savedCollectionsKeepTheirIdentity",store.liked(saved)&&store.saved(saved));result.put("complete",true);save();}catch(Throwable error){failure(error);}},750);
    }
    private static View findCard(View view,String key)throws Exception{if(view.getClass().getSimpleName().equals("Card")){Post post=(Post)field(view,"post");if(post!=null&&post.key().equals(key))return view;}if(view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++){View card=findCard(((ViewGroup)view).getChildAt(i),key);if(card!=null)return card;}return null;}
    private static Post post(int index){Post p=new Post();p.source="danbooru";p.id=""+(9810100+index);p.title="Neutral viewer interaction "+index;p.rating="g";p.width=400;p.height=800;p.hash=String.format(Locale.ROOT,"%032x",9810100+index);p.preview=p.image=p.original="https://cdn.donmai.us/artcatalog-qa/viewer-"+index+".jpg";p.media=List.of(p.image);p.tags=List.of("landscape","qa_viewer_"+index);return p;}
    private static Object field(Object target,String name)throws Exception{Field field=target.getClass().getDeclaredField(name);field.setAccessible(true);return field.get(target);}
    private static void set(Object target,String name,Object value)throws Exception{Field field=target.getClass().getDeclaredField(name);field.setAccessible(true);field.set(target,value);}
    private static Method method(Object target,String name,Class<?>... types)throws Exception{Method method=target.getClass().getDeclaredMethod(name,types);method.setAccessible(true);return method;}
}
