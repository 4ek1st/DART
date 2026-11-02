package com.artcatalog.mobile;

import android.app.Activity;
import android.os.*;
import android.util.Log;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BooleanSupplier;
import org.json.*;

/** Owned neutral APK only; absent from release and never changes the production update URL. */
final class UpdaterChecks {
    private static final String TAG="DARTUpdatesQA";
    private static boolean started;
    private static final String APK_URL="https://github.com/4ek1st/DART/releases/download/android-v0.1.15/DART.Android-0.1.15.apk";
    private final Activity activity;private final Handler main=new Handler(Looper.getMainLooper());
    private final JSONObject result=new JSONObject();private final AtomicInteger requests=new AtomicInteger();
    private volatile boolean offline,slow;private volatile byte[] metadata;private File fixture;
    private AppUpdates updates;private boolean callbacksOnMain=true;
    private UpdaterChecks(Activity activity){this.activity=activity;}
    static synchronized void run(Activity activity){if(!BuildConfig.DEBUG||!activity.getIntent().getBooleanExtra("qaFixtures",false))throw new IllegalStateException("Neutral debug fixtures required");if(started)return;started=true;new UpdaterChecks(activity).start();}
    private void start(){try{
        fixture=new File(activity.getFilesDir(),"qa-future-update.apk");if(!fixture.isFile())throw new IOException("Owned future debug APK fixture is missing");
        metadata=new JSONObject().put("schema",1).put("packageName",activity.getPackageName()).put("versionCode",BuildConfig.VERSION_CODE+1).put("versionName","0.1.15").put("minSdk",26).put("apkUrl",APK_URL).put("sha256",hash(fixture)).put("size",fixture.length()).put("releaseNotes","Neutral updater verification. Existing profile is preserved.").toString().getBytes(StandardCharsets.UTF_8);
        URL.setURLStreamHandlerFactory(protocol->protocol.equals("https")?new URLStreamHandler(){@Override protected URLConnection openConnection(URL url)throws IOException{return connection(url);}}:null);
        updates=AppUpdates.get(activity);updates.addListener(state->{callbacksOnMain&=Looper.myLooper()==Looper.getMainLooper();});
        main.postDelayed(()->{try{flag("debugDoesNotAutoRequest",requests.get()==0);updates.check(true);await(()->updates.state().status==AppUpdates.Status.AVAILABLE,8000,()->available());}catch(Throwable failure){failed(failure);}},500);
    }catch(Throwable failure){failed(failure);}}
    private HttpURLConnection connection(URL url)throws IOException {
        if(!url.toString().equals(AppUpdates.FEED)&&!url.toString().equals(APK_URL))throw new IOException("Only owned update fixtures are mapped");requests.incrementAndGet();
        return new HttpURLConnection(url){private InputStream body;
            @Override public void connect()throws IOException{if(offline)throw new IOException("Neutral offline fixture");connected=true;}
            @Override public int getResponseCode()throws IOException{connect();return 200;}
            @Override public long getContentLengthLong(){return url.toString().equals(AppUpdates.FEED)?metadata.length:fixture.length();}
            @Override public InputStream getInputStream()throws IOException{connect();body=url.toString().equals(AppUpdates.FEED)?new ByteArrayInputStream(metadata):new FilterInputStream(new FileInputStream(fixture)){
                @Override public int read(byte[] bytes,int offset,int count)throws IOException{if(slow)try{Thread.sleep(50);}catch(InterruptedException canceled){Thread.currentThread().interrupt();throw new InterruptedIOException("Neutral cancellation");}return super.read(bytes,offset,Math.min(count,8192));}
            };return body;}
            @Override public void disconnect(){try{if(body!=null)body.close();}catch(IOException ignored){}connected=false;}
            @Override public boolean usingProxy(){return false;}
        };
    }
    private void available(){try{
        flag("manualCheckFindsUpdate",updates.state().hasUpdate());flag("checkDoesNotDownload",updates.verifiedApk()==null);offline=true;updates.check(true);
        await(()->updates.state().error==AppUpdates.Error.NETWORK,8000,()->{try{flag("offlineRetainsKnownUpdate",updates.state().hasUpdate()&&updates.state().status==AppUpdates.Status.AVAILABLE);offline=false;slow=true;updates.download();await(()->updates.state().downloadedBytes>0,8000,()->cancel());}catch(Throwable failure){failed(failure);}});
    }catch(Throwable failure){failed(failure);}}
    private void cancel(){try{updates.cancelDownload();await(()->updates.state().status==AppUpdates.Status.AVAILABLE&&!partials(),8000,()->{
        try{flag("cancelRemovesPartial",!partials()&&updates.verifiedApk()==null);slow=false;updates.download();await(()->updates.state().status==AppUpdates.Status.READY||updates.state().status==AppUpdates.Status.ERROR,15000,()->ready());}catch(Throwable failure){failed(failure);}
    });}catch(Throwable failure){failed(failure);}}
    private void ready(){try{File apk=updates.verifiedApk();flag("signedArchiveReady",updates.state().status==AppUpdates.Status.READY&&apk!=null&&apk.length()==fixture.length());flag("verifiedFileMatches",apk!=null&&hash(apk).equals(hash(fixture)));flag("listenerCallbacksOnMain",callbacksOnMain);flag("noPartialAfterDownload",!partials());flag("downloadDoesNotOpenInstaller",activity.hasWindowFocus());save();Log.i(TAG,"Core update checks complete; ready for native permission/installer UI");}catch(Throwable failure){failed(failure);}}
    private boolean partials(){File[] files=new File(activity.getCacheDir(),"updates").listFiles();if(files!=null)for(File file:files)if(file.getName().endsWith(".part"))return true;return false;}
    private void await(BooleanSupplier condition,long timeout,Runnable next){long deadline=SystemClock.elapsedRealtime()+timeout;Runnable check=new Runnable(){public void run(){try{if(condition.getAsBoolean()){next.run();return;}if(SystemClock.elapsedRealtime()>=deadline)throw new IOException("Timed out at "+updates.state().status+"/"+updates.state().error);main.postDelayed(this,50);}catch(Throwable failure){failed(failure);}}};main.post(check);}
    private void flag(String key,boolean value)throws JSONException{result.put(key,value);Log.i(TAG,key+"="+value);}
    private void failed(Throwable failure){try{result.put("failure",failure.getClass().getSimpleName());result.put("message",String.valueOf(failure.getMessage()));save();}catch(Exception ignored){}Log.e(TAG,"Updater check failed",failure);}
    private void save()throws IOException{try(FileOutputStream output=new FileOutputStream(new File(activity.getExternalFilesDir(null),"qa-updates-core.json"))){output.write(result.toString().getBytes(StandardCharsets.UTF_8));}}
    private static String hash(File file)throws Exception{MessageDigest digest=MessageDigest.getInstance("SHA-256");try(InputStream input=new FileInputStream(file)){byte[] buffer=new byte[32768];int count;while((count=input.read(buffer))!=-1)digest.update(buffer,0,count);}StringBuilder out=new StringBuilder();for(byte value:digest.digest())out.append(String.format(Locale.ROOT,"%02x",value&255));return out.toString();}
}
