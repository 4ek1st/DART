package com.artcatalog.mobile;

import android.app.Activity;
import android.graphics.drawable.BitmapDrawable;
import android.os.*;
import android.util.Log;
import android.view.*;
import android.widget.*;
import java.lang.reflect.*;
import java.util.*;

/** Native regressions explicitly enabled by qaStableRendering; absent from release. */
final class RenderingChecks {
    static void run(Activity activity,ImageLoader images){
        Handler main=new Handler(Looper.getMainLooper());
        ImageView first=new ImageView(activity);
        images.bind(first,"https://cdn.donmai.us/artcatalog-qa/landscape-0.jpg",720,()->{
            ImageView cached=new ImageView(activity);images.bind(cached,"https://cdn.donmai.us/artcatalog-qa/landscape-0.jpg",720);
            Log.i("ArtCatalogQA","RENDER cached bind synchronous="+(cached.getDrawable() instanceof BitmapDrawable));
        });
        main.postDelayed(()->{try{
            Field field=activity.getClass().getDeclaredField("screens");field.setAccessible(true);Object screen=((Object[])field.get(activity))[0];
            Field rankingField=screen.getClass().getDeclaredField("ranking");rankingField.setAccessible(true);LinearLayout ranking=(LinearLayout)rankingField.get(screen);
            Field postsField=screen.getClass().getDeclaredField("posts");postsField.setAccessible(true);List<?> posts=(List<?>)postsField.get(screen);
            Method fill=activity.getClass().getDeclaredMethod("fillRanking",screen.getClass(),List.class,String.class);fill.setAccessible(true);fill.invoke(activity,screen,posts,"Популярные в ленте");
            main.postDelayed(()->{View previous=ranking.getChildAt(0);try{fill.invoke(activity,screen,posts,"Популярные в ленте");Log.i("ArtCatalogQA","RENDER identical ranking keeps card="+(previous==ranking.getChildAt(0)));}catch(Exception error){Log.e("ArtCatalogQA","Ranking repeat",error);}},1000);
            Object card=ranking.getChildAt(0),gallery=field(card,"gallery");
            Log.i("ArtCatalogQA","GALLERY ranking has continuation="+(field(gallery,"source")!=null));
            Class<?> galleryClass=gallery.getClass();Constructor<?> constructor=galleryClass.getDeclaredConstructors()[0];constructor.setAccessible(true);
            Object full=constructor.newInstance(activity,posts,screen);
            Method save=activity.getClass().getDeclaredMethod("galleryBundle",galleryClass,Post.class);save.setAccessible(true);
            Bundle route=(Bundle)save.invoke(activity,full,posts.get(0));
            Method restore=activity.getClass().getDeclaredMethod("galleryFromBundle",Bundle.class);restore.setAccessible(true);
            Object restored=restore.invoke(activity,route);
            Log.i("ArtCatalogQA","GALLERY saved buffer complete="+(((List<?>)field(restored,"posts")).size()==posts.size())+" count="+posts.size());
        }catch(Exception error){Log.e("ArtCatalogQA","Rendering regression setup",error);}},2500);
        if(activity.getIntent().getBooleanExtra("qaGalleryChecks",false))main.postDelayed(()->{try{
            Object client=field(activity,"client");List<?> fixtures=(List<?>)field(client,"fixtures");Object[] screens=(Object[])field(activity,"screens");Object screen=screens[0];
            Constructor<?> sourceConstructor=screen.getClass().getDeclaredConstructors()[0];sourceConstructor.setAccessible(true);Object source=sourceConstructor.newInstance(activity,6);
            ((List<Object>)field(source,"posts")).addAll((List<Object>)fixtures.subList(0,32));set(source,"more",false);
            Class<?> galleryClass=Class.forName("com.artcatalog.mobile.MainActivity$Gallery");Constructor<?> constructor=galleryClass.getDeclaredConstructors()[0];constructor.setAccessible(true);Object gallery=constructor.newInstance(activity,fixtures.subList(0,2),source);
            Method open=activity.getClass().getDeclaredMethod("openArtwork",Post.class,galleryClass);open.setAccessible(true);open.invoke(activity,fixtures.get(1),gallery);
            Method next=activity.getClass().getDeclaredMethod("navigate",int.class);next.setAccessible(true);next.invoke(activity,1);
            main.postDelayed(()->{try{Log.i("ArtCatalogQA","GALLERY late final page remains navigable="+(((Post)field(activity,"activePost")).id.equals("9000002")));}catch(Exception error){Log.e("ArtCatalogQA","Late gallery check",error);}},1500);
        }catch(Exception error){Log.e("ArtCatalogQA","Gallery regression setup",error);}},5000);
        main.postDelayed(new Runnable(){int remaining=90;public void run(){
            if(activity.isDestroyed())return;
            try{Object current=field(activity,"currentView");List<Object> candidates=new ArrayList<>(Arrays.asList((Object[])field(activity,"screens")));candidates.add(field(activity,"activeRelated"));candidates.add(field(activity,"activeAuthor"));
                for(Object screen:candidates)if(screen!=null&&field(screen,"view")==current){FeedListView list=(FeedListView)field(screen,"list");List<Post> posts=(List<Post>)field(screen,"posts");PreviewWindow window=new PreviewWindow(Math.max(0,list.getFirstVisiblePosition()-1)*2,list.getVisibleCount()*2,posts.size());int ready=0;for(int i=window.visibleEnd;i<window.end;i++)if(images.prepared(posts.get(i).preview,720))ready++;int[] visible={0,0};countImages(list,visible);
                    Log.i("ArtCatalogQA","WINDOW active="+(field(activity,"activePost")==null?"feed":((Post)field(activity,"activePost")).id)+" tab="+field(screen,"tab")+" row="+list.getFirstVisiblePosition()+" metadata="+posts.size()+" visible bitmaps="+visible[0]+" placeholders="+visible[1]+" below ready="+ready+"/"+(window.end-window.visibleEnd));
                    if(remaining==88){Map<View,Object> before=new IdentityHashMap<>();collectCards(list,before);Object adapter=field(screen,"adapter");((BaseAdapter)adapter).notifyDataSetChanged();((BaseAdapter)adapter).notifyDataSetChanged();main.postDelayed(()->{Map<View,Object> after=new IdentityHashMap<>();collectCards(list,after);boolean kept=!before.isEmpty();for(Map.Entry<View,Object> e:before.entrySet())kept&=after.containsKey(e.getKey())&&after.get(e.getKey())==e.getValue();Log.i("ArtCatalogQA","RENDER unchanged visible cards and drawables retained="+kept);},120);}
                }
            }catch(Exception error){Log.e("ArtCatalogQA","Viewport check",error);}
            if(--remaining>0)main.postDelayed(this,2000);
        }},4000);
    }
    private static void countImages(View view,int[] counts){if(view instanceof ImageView&&view.getTag() instanceof ImageLoader.Ticket){if(((ImageView)view).getDrawable() instanceof BitmapDrawable)counts[0]++;else counts[1]++;}if(view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++)countImages(((ViewGroup)view).getChildAt(i),counts);}
    private static void collectCards(View view,Map<View,Object> map){try{if(view.getClass().getSimpleName().equals("Card")){ImageView image=(ImageView)field(view,"image");map.put(view,image.getDrawable());}}catch(Exception ignored){}if(view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++)collectCards(((ViewGroup)view).getChildAt(i),map);}
    private static Object field(Object object,String name)throws Exception{Field f=object.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(object);}
    private static void set(Object object,String name,Object value)throws Exception{Field f=object.getClass().getDeclaredField(name);f.setAccessible(true);f.set(object,value);}
}
