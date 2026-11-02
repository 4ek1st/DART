package com.artcatalog.mobile;

import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
import java.lang.reflect.*;
import java.util.*;
import org.json.JSONArray;

/** Actual gallery state methods, with neutral routes and read-only saved collections. */
final class GalleryRestoreChecks {
    static void run(Activity activity){Object[] screens=null;Object original=null;try{
        Class<?> sourceType=Class.forName("com.artcatalog.mobile.MainActivity$Screen"),galleryType=Class.forName("com.artcatalog.mobile.MainActivity$Gallery"),stateType=Class.forName("com.artcatalog.mobile.MainActivity$GalleryState");
        screens=(Object[])field(activity,"screens");original=screens[3];Object books=source(sourceType,activity,3);screens[3]=books;Object local=source(sourceType,activity,3);List<Post> neutral=new ArrayList<>();
        for(int i=0;i<32;i++){Post p=new Post();p.source="danbooru";p.id=String.valueOf(987000000L+i);p.title="Neutral gallery artwork";p.rating="g";neutral.add(p);}posts(local).addAll(neutral);set(local,"loaded",true);set(local,"more",false);
        Object gallery=gallery(galleryType,activity,neutral,local);set(gallery,"syncedRevision",0);Object snapshot=method(activity,"snapshotGallery",galleryType).invoke(activity,gallery),retained=method(activity,"restoreGallery",stateType).invoke(activity,snapshot);
        require(field(retained,"source")!=books&&posts(field(retained,"source")).size()==neutral.size());require(field(retained,"syncedRevision").equals(field(field(retained,"source"),"revision")));
        set(gallery,"syncedRevision",-1);snapshot=method(activity,"snapshotGallery",galleryType).invoke(activity,gallery);Object stale=method(activity,"restoreGallery",stateType).invoke(activity,snapshot);require(field(stale,"syncedRevision").equals(-1));set(gallery,"syncedRevision",0);
        Bundle bounded=(Bundle)method(activity,"galleryBundle",galleryType,Post.class).invoke(activity,gallery,neutral.get(16));require(new JSONArray(bounded.getString("posts")).length()<=11);
        Object paged=source(sourceType,activity,6);posts(paged).addAll(neutral);((Map<String,Integer>)field(paged,"pages")).put("danbooru",7);set(paged,"more",true);Object pg=gallery(galleryType,activity,neutral,paged);set(pg,"syncedRevision",0);
        Bundle cursor=(Bundle)method(activity,"galleryBundle",galleryType,Post.class).invoke(activity,pg,neutral.get(16));Object restored=method(activity,"galleryFromBundle",Bundle.class).invoke(activity,cursor);require(field(field(restored,"source"),"pages").equals(Map.of("danbooru",7)));require(field(restored,"syncedRevision").equals(0));
        Object following=source(sourceType,activity,2);posts(following).addAll(neutral);set(following,"followingExposed",17);Object fg=gallery(galleryType,activity,neutral,following);set(fg,"followingReached",17);set(fg,"syncedRevision",0);Bundle rebased=(Bundle)method(activity,"galleryBundle",galleryType,Post.class).invoke(activity,fg,neutral.get(16));require(rebased.getInt("followingReached")==6&&rebased.getInt("followingExposed")==6);
        Store store=(Store)field(activity,"store");String rating=(String)field(activity,"rating");int checked=0;for(String kind:List.of("likes","history","bookmarks")){
            List<Post> collection=kind.equals("likes")?store.likes():kind.equals("history")?store.history():store.bookmarks(),expected=new ArrayList<>();for(Post p:store.visible(collection,false))if(CatalogLogic.matchesRating(p.rating,rating))expected.add(p);if(expected.isEmpty())continue;
            Object ls=source(sourceType,activity,3);set(ls,"localCollection",kind);posts(ls).addAll(expected);Object lg=gallery(galleryType,activity,expected,ls);set(lg,"syncedRevision",0);Bundle state=(Bundle)method(activity,"galleryBundle",galleryType,Post.class).invoke(activity,lg,expected.get(expected.size()/2));Object complete=method(activity,"galleryFromBundle",Bundle.class).invoke(activity,state);List<Post> actual=(List<Post>)field(complete,"posts");require(actual.size()==expected.size());for(int i=0;i<actual.size();i++)require(actual.get(i).key().equals(expected.get(i).key()));require(field(complete,"syncedRevision").equals(field(field(complete,"source"),"revision")));checked++;
        }
        Log.i("ArtCatalogQA","GALLERY restore sourceIdentity=true boundedNeighbors=true retainedSync=true staleSync=true cursor=true followingBoundary=true savedCollections="+checked);
    }catch(Throwable error){Throwable cause=error instanceof InvocationTargetException&&error.getCause()!=null?error.getCause():error;Log.e("ArtCatalogQA","GALLERY restore FAILED type="+cause.getClass().getSimpleName());}finally{if(screens!=null)screens[3]=original;}}
    private static Object source(Class<?> type,Activity activity,int tab)throws Exception{Constructor<?> c=type.getDeclaredConstructors()[0];c.setAccessible(true);return c.newInstance(activity,tab);}
    private static Object gallery(Class<?> type,Activity activity,List<Post> posts,Object source)throws Exception{Constructor<?> c=type.getDeclaredConstructors()[0];c.setAccessible(true);return c.newInstance(activity,posts,source);}
    @SuppressWarnings("unchecked")private static List<Post> posts(Object source)throws Exception{return (List<Post>)field(source,"posts");}
    private static void require(boolean value){if(!value)throw new AssertionError("Gallery state regression");}
    private static Object field(Object o,String name)throws Exception{Field f=o.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(o);}
    private static void set(Object o,String name,Object value)throws Exception{Field f=o.getClass().getDeclaredField(name);f.setAccessible(true);f.set(o,value);}
    private static Method method(Object o,String name,Class<?>...types)throws Exception{Method m=o.getClass().getDeclaredMethod(name,types);m.setAccessible(true);return m;}
}
