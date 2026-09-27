package com.artcatalog.mobile;

import android.app.Activity;
import android.os.*;
import android.util.Log;
import android.view.*;
import android.widget.*;
import java.lang.reflect.*;
import java.util.*;

/** Bounded, seeded performance regression; never included in release. */
final class PerformanceChecks {
    static void run(Activity activity, ImageLoader images) {
        Handler main=new Handler(Looper.getMainLooper());
        for(int i=0;i<8;i++)images.prefetch("https://cdn.donmai.us/artcatalog-qa/landscape-"+i+".jpg",720);
        main.postDelayed(()->{try{
            List<Post> posts=new ArrayList<>();
            for(int i=0;i<1000;i++){Post p=new Post();p.source="danbooru";p.id=String.valueOf(9100000+i);p.hash="perf-"+i;p.rating="g";p.title="Пейзаж "+i;p.width=720;p.height=900;p.preview="https://cdn.donmai.us/artcatalog-qa/landscape-"+(i%8)+".jpg";p.image=p.preview;p.original=p.preview;p.media=List.of(p.preview);p.tags=new ArrayList<>(List.of("landscape","blue_sky","original","qa_character"));for(int t=0;t<50;t++)p.tags.add("qa_tag_"+t);posts.add(p);}
            Class<?> screenType=Class.forName("com.artcatalog.mobile.MainActivity$Screen");Constructor<?> ctor=screenType.getDeclaredConstructors()[0];ctor.setAccessible(true);Object screen=ctor.newInstance(activity,6);
            ((List<Post>)field(screen,"posts")).addAll(posts);set(screen,"loaded",true);set(screen,"more",false);
            Class<?> adapterType=Class.forName("com.artcatalog.mobile.MainActivity$FeedAdapter");ctor=adapterType.getDeclaredConstructors()[0];ctor.setAccessible(true);BaseAdapter adapter=(BaseAdapter)ctor.newInstance(activity,screen);set(screen,"adapter",adapter);
            long start=SystemClock.elapsedRealtimeNanos();
            for(int pass=0;pass<3;pass++)for(Post p:posts)CatalogLogic.hidden(p,"all",List.of());
            long filter=(SystemClock.elapsedRealtimeNanos()-start)/1000000;
            adapter.notifyDataSetChanged();FrameLayout parent=new FrameLayout(activity);
            start=SystemClock.elapsedRealtimeNanos();View row=adapter.getView(0,null,parent);long bind=(SystemClock.elapsedRealtimeNanos()-start)/1000000;
            start=SystemClock.elapsedRealtimeNanos();((ViewGroup)row).getChildAt(0).performClick();long open=(SystemClock.elapsedRealtimeNanos()-start)/1000000;
            Log.i("ArtCatalogQA","PERF 1000 works: filter3000="+filter+"ms bindRow="+bind+"ms openCard="+open+"ms openUnder50ms="+(open<50));
            Method back=activity.getClass().getDeclaredMethod("goBack");back.setAccessible(true);back.invoke(activity);
        }catch(Exception error){Log.e("ArtCatalogQA","Performance regression",error);}},4000);
    }
    private static Object field(Object object,String name)throws Exception{Field f=object.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(object);}
    private static void set(Object object,String name,Object value)throws Exception{Field f=object.getClass().getDeclaredField(name);f.setAccessible(true);f.set(object,value);}
}
