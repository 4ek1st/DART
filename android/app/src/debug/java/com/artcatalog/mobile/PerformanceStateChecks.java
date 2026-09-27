package com.artcatalog.mobile;

import android.app.Activity;
import android.os.*;
import android.util.Log;
import android.view.*;
import android.widget.*;
import java.lang.reflect.*;
import java.util.*;
import java.util.function.Consumer;

/** Real native regressions for gallery identity and async filter publication. */
final class PerformanceStateChecks {
    static void run(Activity activity,ImageLoader images){
        Handler main=new Handler(Looper.getMainLooper());
        main.postDelayed(()->{try{
            Object client=field(activity,"client");List<Post> fixtures=(List<Post>)field(client,"fixtures");
            Post a=fixtures.get(9),b=fixtures.get(10),c=fixtures.get(11);
            Class<?> screenType=Class.forName("com.artcatalog.mobile.MainActivity$Screen");Constructor<?> ctor=screenType.getDeclaredConstructors()[0];ctor.setAccessible(true);Object screen=ctor.newInstance(activity,3);
            ((Object[])field(activity,"screens"))[3]=screen;
            method(activity,"buildFeed",screenType).invoke(activity,screen);set(screen,"loaded",true);set(screen,"more",false);
            List<Post> posts=(List<Post>)field(screen,"posts");posts.add(a);posts.add(b);BaseAdapter adapter=(BaseAdapter)field(screen,"adapter");
            method(activity,"display",View.class).invoke(activity,field(screen,"view"));adapter.notifyDataSetChanged();
            main.postDelayed(()->{try{
                View[] row={adapter.getView(0,null,new FrameLayout(activity))}; // Prime the shared [A,B] context.
                images.clearMemory();posts.clear();posts.add(a);posts.add(c);adapter.notifyDataSetChanged();
                main.postDelayed(()->{try{
                    List<Post> shown=(List<Post>)field(adapter,"shown");boolean loaded=shown.size()==2&&shown.get(1).key().equals(c.key());
                    row[0]=adapter.getView(0,row[0],new FrameLayout(activity));Post latest=Post.fromJson(a.toJson());latest.tags.add("qa_latest_metadata");posts.set(0,latest);adapter.notifyDataSetChanged();((ViewGroup)row[0]).getChildAt(0).performClick();
                    List<Post> gallery=(List<Post>)field(field(activity,"activeGallery"),"posts");
                    boolean correct=gallery.size()==2&&gallery.get(1).key().equals(c.key());
                    boolean metadata=((Post)field(activity,"activePost")).tags.contains("qa_latest_metadata");Log.i("ArtCatalogQA","PERF STATE same-count cold replacement loads while idle="+loaded+" current click gallery="+correct+" unchanged-card latest metadata="+metadata);
                    method(activity,"goBack").invoke(activity);filterRace(activity,fixtures.get(20),screenType);
                }catch(Exception e){Log.e("ArtCatalogQA","Cold gallery replacement",e);}},1500);
            }catch(Exception e){Log.e("ArtCatalogQA","Gallery prime",e);}},1500);
        }catch(Exception e){Log.e("ArtCatalogQA","State regression setup",e);}},4500);
    }
    private static void filterRace(Activity activity,Post p,Class<?> type)throws Exception{
        Store store=(Store)field(activity,"store");boolean wasSaved=store.saved(p),hidden=store.prefs.getBoolean("hideViewedAndSaved",false);
        if(wasSaved)store.toggle(p);store.prefs.edit().putBoolean("hideViewedAndSaved",false).apply();
        Constructor<?> ctor=type.getDeclaredConstructors()[0];ctor.setAccessible(true);Object source=ctor.newInstance(activity,0);set(source,"query","landscape");
        Consumer<List<Post>> applied=result->{boolean excluded=result.stream().noneMatch(item->item.key().equals(p.key()));Log.i("ArtCatalogQA","PERF STATE save between filter and publication stays excluded="+excluded);if(!wasSaved)store.toggle(p);store.prefs.edit().putBoolean("hideViewedAndSaved",hidden).apply();try{publicationRace(activity,type,p);hiddenPageChain(activity);}catch(Exception e){Log.e("ArtCatalogQA","Publication regressions",e);}};
        method(activity,"filterMerged",type,List.class,int.class,long.class,Consumer.class).invoke(activity,source,List.of(p),0,1L,applied);
        store.toggle(p); // Happens after filtering, before the main-posted publication.
    }
    private static void publicationRace(Activity activity,Class<?> type,Post p)throws Exception{
        Store store=(Store)field(activity,"store");Constructor<?> ctor=type.getDeclaredConstructors()[0];ctor.setAccessible(true);Object source=ctor.newInstance(activity,6);
        int[] applied={0};Method filter=method(activity,"filterMerged",type,List.class,int.class,long.class,Consumer.class);
        Consumer<List<Post>> partial=result->applied[0]=1,complete=result->applied[0]=2;
        filter.invoke(activity,source,List.of(p),0,1L,partial);store.toggle(p);filter.invoke(activity,source,List.of(p),0,2L,complete);
        new Handler(Looper.getMainLooper()).postDelayed(()->{Log.i("ArtCatalogQA","PERF STATE old partial retry cannot overwrite final="+(applied[0]==2));store.toggle(p);},500);
    }
    private static void hiddenPageChain(Activity activity)throws Exception{
        Store store=(Store)field(activity,"store");String excluded=store.prefs.getString("excludedTags","");boolean hidden=store.prefs.getBoolean("hideViewedAndSaved",false);
        store.prefs.edit().putString("excludedTags","qa_hidden").putBoolean("hideViewedAndSaved",false).apply();
        method(activity,"runSearch",String.class).invoke(activity,"qa_hidden_pages");
        new Handler(Looper.getMainLooper()).postDelayed(()->{try{Object source=((Object[])field(activity,"screens"))[1];int count=((List<?>)field(source,"posts")).size();boolean more=(boolean)field(source,"more");Log.i("ArtCatalogQA","PERF STATE hidden middle page continues without gesture="+(count==32&&!more)+" count="+count);inactiveHiddenFirst(activity,excluded,hidden);}catch(Exception e){Log.e("ArtCatalogQA","Hidden page chain",e);}},4000);
    }
    private static void inactiveHiddenFirst(Activity activity,String excluded,boolean hidden)throws Exception{
        method(activity,"runSearch",String.class).invoke(activity,"qa_hidden_first");method(activity,"selectNav",int.class).invoke(activity,0);
        Handler main=new Handler(Looper.getMainLooper());main.postDelayed(()->{try{Object source=((Object[])field(activity,"screens"))[1];boolean paused=((List<?>)field(source,"posts")).isEmpty()&&(boolean)field(source,"loaded")&&(boolean)field(source,"more");Log.i("ArtCatalogQA","PERF STATE hidden first page paused offscreen="+paused);method(activity,"selectNav",int.class).invoke(activity,1);}catch(Exception e){Log.e("ArtCatalogQA","Return to hidden first page",e);}},1000);
        main.postDelayed(()->{try{Object source=((Object[])field(activity,"screens"))[1];int count=((List<?>)field(source,"posts")).size();boolean more=(boolean)field(source,"more");Log.i("ArtCatalogQA","PERF STATE hidden first page resumes on return="+(count==16&&!more)+" count="+count);Store store=(Store)field(activity,"store");store.prefs.edit().putString("excludedTags",excluded).putBoolean("hideViewedAndSaved",hidden).apply();}catch(Exception e){Log.e("ArtCatalogQA","Hidden first resumed",e);}},3000);
    }
    private static Method method(Object target,String name,Class<?>...args)throws Exception{Method m=target.getClass().getDeclaredMethod(name,args);m.setAccessible(true);return m;}
    private static Object field(Object target,String name)throws Exception{Field f=target.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(target);}
    private static void set(Object target,String name,Object value)throws Exception{Field f=target.getClass().getDeclaredField(name);f.setAccessible(true);f.set(target,value);}
}
