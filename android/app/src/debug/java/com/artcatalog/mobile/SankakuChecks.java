package com.artcatalog.mobile;

import android.app.Activity;
import android.content.*;
import android.os.*;
import android.util.Log;
import java.io.*;
import java.util.*;
import org.json.*;

/** Opt-in native checks use their own profile and preferences; never compiled into release. */
final class SankakuChecks {
    static void run(Activity activity){
        new Thread(()->{try{
            Context isolated=new ContextWrapper(activity.getApplicationContext()){
                @Override public SharedPreferences getSharedPreferences(String name,int mode){return super.getSharedPreferences("qa_sankaku_"+name,mode);}
                @Override public File getFilesDir(){File dir=new File(super.getFilesDir(),"qa_sankaku_profile");if(!dir.exists()&&!dir.mkdirs())throw new IllegalStateException("QA directory");return dir;}
            };
            Store test=new Store(isolated);test.load();String stage=activity.getIntent().getStringExtra("qaSankakuStage");
            if("write".equals(stage)){
                test.saveSession("qa-access-not-a-real-token","qa-refresh-not-a-real-token","qa-user");
                check(!test.prefs.getString("sankaku.access","").contains("qa-access"),"tokens encrypted at rest");
                Post p=CatalogLogic.map("sankaku",new JSONObject("{\"id\":\"QaId123\",\"rating\":\"s\",\"tags\":[{\"tagName\":\"qa_artist\",\"type\":1}],\"file_url\":\"https://s.sankakucomplex.com/qa.jpg\"}"));
                if(!test.saved(p))test.toggle(p);if(!test.following("qa_artist"))test.toggleFollow("qa_artist");
                check(!test.export().toString().contains("qa-access")&&!test.export().toString().contains("qa-refresh"),"export omits session credentials");
                Log.i("ArtCatalogQA","SANKAKU native write stage ready");
            }else if("read".equals(stage)){
                check(test.accessToken().equals("qa-access-not-a-real-token")&&test.refreshToken().equals("qa-refresh-not-a-real-token"),"encrypted session survives cold process restart");
                check(test.bookmarks().size()==1&&test.bookmarks().get(0).id.equals("QaId123")&&test.following("qa_artist"),"alphanumeric bookmark and follow survive restart");
                test.clearSession();check(!test.sankakuAuthenticated()&&test.accessToken().isEmpty()&&test.refreshToken().isEmpty(),"logout removes only session");check(test.bookmarks().size()==1&&test.follows().size()==1,"logout preserves bookmarks and follows");
                CatalogClient client=new CatalogClient(test);try{
                    Map<String,Integer> first=Map.of("sankaku",0),second=Map.of("sankaku",1);
                    CatalogClient.Page a=client.search("landscape",first,"general","popular"),b=client.search("landscape",second,"general","popular");
                    check(a.errors.isEmpty()&&b.errors.isEmpty(),"live native popular search returns without HTTP errors");
                    check(!a.posts.isEmpty()&&!b.posts.isEmpty()&&!Objects.equals(a.fingerprints.get("sankaku"),b.fingerprints.get("sankaku")),"live pagination changes page");
                    Post p=a.posts.get(0);client.enrich(p);check(!p.media.isEmpty()&&CatalogLogic.isMediaUrl(p.original),"live details refresh media URLs");
                    Log.i("ArtCatalogQA","SANKAKU live native results first="+a.posts.size()+" second="+b.posts.size()+" authNotice="+a.authRequired.contains("sankaku"));
                }finally{client.close();}
            }
            if(activity.getIntent().getBooleanExtra("qaSankakuPrompt",false))new Handler(Looper.getMainLooper()).post(()->{try{java.lang.reflect.Method method=activity.getClass().getDeclaredMethod("accessPrompt",SankakuApi.AccessException.class);method.setAccessible(true);method.invoke(activity,new SankakuApi.AccessException(true));}catch(Exception e){Log.e("ArtCatalogQA","Sankaku prompt failed",e);}});
        }catch(Exception error){Log.e("ArtCatalogQA","SANKAKU checks failed",error);}},"ArtCatalog-Sankaku-QA").start();
    }
    private static void check(boolean passed,String name){Log.i("ArtCatalogQA","SANKAKU "+name+"="+passed);if(!passed)throw new AssertionError(name);}
}
