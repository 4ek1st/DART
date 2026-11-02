package com.artcatalog.mobile;

import android.app.Activity;
import android.content.*;
import android.content.pm.*;
import android.net.Uri;
import android.os.*;
import android.util.AtomicFile;
import androidx.core.content.FileProvider;
import org.json.*;
import java.io.*;
import java.lang.ref.WeakReference;
import java.net.*;
import java.nio.charset.*;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.*;

/** Application-scoped updater. It never reads a catalog profile, provider credentials or signing keys. */
final class AppUpdates {
    static final String FEED="https://raw.githubusercontent.com/4ek1st/DART/main/android/update.json";
    static final int MAX_METADATA=64*1024;
    static final long MAX_APK=128L*1024*1024,CHECK_INTERVAL=6L*60*60*1000;
    enum Status { IDLE,CHECKING,UP_TO_DATE,AVAILABLE,DOWNLOADING,VERIFYING,READY,ERROR,UNSUPPORTED }
    enum Error { NONE,NETWORK,INVALID_METADATA,UNSUPPORTED_ANDROID,STORAGE,DOWNLOAD,SIZE_MISMATCH,HASH_MISMATCH,INVALID_APK,PACKAGE_MISMATCH,VERSION_MISMATCH,SIGNATURE_MISMATCH,INSTALL_PERMISSION_REQUIRED,INSTALL_FAILED }
    static final class Descriptor {
        final String packageName,versionName,apkUrl,sha256,releaseNotes;
        final int versionCode,minSdk;final long size;
        Descriptor(String packageName,int versionCode,String versionName,int minSdk,String apkUrl,String sha256,long size,String releaseNotes){this.packageName=packageName;this.versionCode=versionCode;this.versionName=versionName;this.minSdk=minSdk;this.apkUrl=apkUrl;this.sha256=sha256;this.size=size;this.releaseNotes=releaseNotes;}
        JSONObject json() throws JSONException {return new JSONObject().put("schema",1).put("packageName",packageName).put("versionCode",versionCode).put("versionName",versionName).put("minSdk",minSdk).put("apkUrl",apkUrl).put("sha256",sha256).put("size",size).put("releaseNotes",releaseNotes);}
    }
    static final class State {
        final Status status;final Error error;final Descriptor update;final String currentVersion;
        final int currentVersionCode;final long downloadedBytes,totalBytes,checkedAtMillis;
        State(Status status,Error error,Descriptor update,String currentVersion,int currentVersionCode,long downloadedBytes,long totalBytes,long checkedAtMillis){this.status=status;this.error=error;this.update=update;this.currentVersion=currentVersion;this.currentVersionCode=currentVersionCode;this.downloadedBytes=downloadedBytes;this.totalBytes=totalBytes;this.checkedAtMillis=checkedAtMillis;}
        boolean hasUpdate(){return update!=null&&update.versionCode>currentVersionCode;}
        boolean busy(){return status==Status.CHECKING||status==Status.DOWNLOADING||status==Status.VERIFYING;}
        int progressPercent(){return totalBytes<=0?0:(int)Math.min(100,Math.max(0,downloadedBytes*100/totalBytes));}
    }
    private static final class UpdateFailure extends IOException {final Error error;UpdateFailure(Error error){super(error.name());this.error=error;}}
    private static volatile AppUpdates singleton;
    static AppUpdates get(Context context){AppUpdates result=singleton;if(result==null)synchronized(AppUpdates.class){result=singleton;if(result==null)singleton=result=new AppUpdates(context.getApplicationContext());}return result;}
    private final Context context;private final String packageName;
    private final Object lock=new Object();private final Handler main=new Handler(Looper.getMainLooper());
    private final Set<Consumer<State>> listeners=new CopyOnWriteArraySet<>();
    private final ScheduledExecutorService worker=Executors.newSingleThreadScheduledExecutor(job->new Thread(()->{android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_BACKGROUND);job.run();},"DART-app-updates"));
    private volatile State state;
    private Descriptor available;private File readyFile;private long checkedAt;
    private boolean checking,downloadActive,installing,metadataKnown;private volatile long downloadGeneration;
    private Future<?> downloadFuture;private ScheduledFuture<?> automaticCheck;private long foregroundGeneration;
    private volatile HttpURLConnection downloadConnection;
    private AppUpdates(Context context){this.context=context;packageName=context.getPackageName();state=new State(Status.IDLE,Error.NONE,null,BuildConfig.VERSION_NAME,BuildConfig.VERSION_CODE,0,0,0);worker.execute(this::initialize);foreground();}
    void foreground(){if(BuildConfig.DEBUG)return;synchronized(lock){long generation=++foregroundGeneration;if(automaticCheck!=null)automaticCheck.cancel(false);automaticCheck=worker.schedule(()->{synchronized(lock){if(generation!=foregroundGeneration)return;automaticCheck=null;}check(false);},5,TimeUnit.SECONDS);}}
    State state(){return state;}
    void addListener(Consumer<State> listener){if(listener==null)return;listeners.add(listener);State value=state;main.post(()->{if(listeners.contains(listener))listener.accept(state==value?value:state);});}
    void removeListener(Consumer<State> listener){listeners.remove(listener);}
    private void publish(Status status,Error error,long bytes){State value;synchronized(lock){value=new State(status,error,available,BuildConfig.VERSION_NAME,BuildConfig.VERSION_CODE,bytes,available==null?0:available.size,checkedAt);state=value;}main.post(()->{if(state!=value)return;for(Consumer<State> listener:listeners)if(listeners.contains(listener))listener.accept(value);});}
    private void base(Error error){Status status;long bytes=0;synchronized(lock){if(available==null)status=error==Error.NONE?metadataKnown?Status.UP_TO_DATE:Status.IDLE:Status.ERROR;else if(available.minSdk>Build.VERSION.SDK_INT){status=Status.UNSUPPORTED;error=Error.UNSUPPORTED_ANDROID;}else if(readyFile!=null){status=Status.READY;bytes=available.size;}else status=error==Error.NONE||error==Error.NETWORK?Status.AVAILABLE:Status.ERROR;publish(status,error,bytes);}}
    private void publishDownload(long generation,Status status,long bytes){synchronized(lock){if(generation==downloadGeneration&&downloadActive)publish(status,Error.NONE,bytes);}}
    private void completedDownload(long generation,File file,long bytes){synchronized(lock){if(generation!=downloadGeneration||!downloadActive)return;readyFile=file;downloadActive=false;downloadFuture=null;downloadConnection=null;publish(Status.READY,Error.NONE,bytes);}}
    private void failedDownload(long generation,Error error){synchronized(lock){if(generation!=downloadGeneration||!downloadActive)return;downloadActive=false;downloadFuture=null;downloadConnection=null;base(error);}}
    private File directory() throws IOException {File directory=new File(context.getCacheDir(),"updates").getCanonicalFile();if(!directory.getParentFile().equals(context.getCacheDir().getCanonicalFile())||!directory.isDirectory()&&!directory.mkdirs())throw new IOException("Update cache unavailable");return directory;}
    private File artifact(Descriptor update,boolean partial) throws IOException {File directory=directory(),file=new File(directory,"dart-update-v"+update.versionCode+"-"+update.sha256+".apk"+(partial?".part":"")).getCanonicalFile();if(!file.getParentFile().equals(directory))throw new IOException("Invalid update path");return file;}
    static boolean ownedArtifactName(String name){return name!=null&&name.matches("dart-update-v[1-9][0-9]{0,9}-[a-f0-9]{64}\\.apk(?:\\.part)?");}
    private void pruneCache() throws IOException {
        File directory=directory();Descriptor keep;synchronized(lock){keep=available;}
        String name=keep==null?"":artifact(keep,false).getName();File[] files=directory.listFiles();
        if(files!=null)for(File file:files)if(ownedArtifactName(file.getName())&&!file.getName().equals(name)&&file.getCanonicalFile().getParentFile().equals(directory))file.delete();
    }
    private AtomicFile metadataCache() throws IOException {return new AtomicFile(new File(directory(),"descriptor.json"));}
    private void initialize(){
        Error error=Error.NONE;try{
            checkedAt=context.getSharedPreferences("dart-app-updates",Context.MODE_PRIVATE).getLong("checkedAt",0);
            Descriptor cached=null;try(InputStream input=metadataCache().openRead()){cached=parseDescriptor(readBounded(input,MAX_METADATA),packageName);}catch(FileNotFoundException absent){}catch(Exception invalid){metadataCache().delete();}
            synchronized(lock){metadataKnown=cached!=null;}
            if(cached!=null&&cached.versionCode>BuildConfig.VERSION_CODE){synchronized(lock){available=cached;}File file=artifact(cached,false);if(file.isFile()&&cached.minSdk<=Build.VERSION.SDK_INT)try{verifyFile(file,cached);synchronized(lock){readyFile=file;}}catch(UpdateFailure invalid){file.delete();error=invalid.error;}}
            pruneCache();
        }catch(Exception failure){error=Error.STORAGE;}
        synchronized(lock){if(checking){publish(Status.CHECKING,Error.NONE,0);return;}}base(error);
    }
    static boolean shouldCheck(long previous,long now,boolean force){return force||previous<=0||now<previous||now-previous>=CHECK_INTERVAL;}
    void check(boolean force){synchronized(lock){if(checking||downloadActive||installing)return;checking=true;}worker.execute(()->{Error outcome=Error.NONE;
        try{
            long now=System.currentTimeMillis();if(!shouldCheck(checkedAt,now,force))return;
            checkedAt=now;context.getSharedPreferences("dart-app-updates",Context.MODE_PRIVATE).edit().putLong("checkedAt",now).apply();publish(Status.CHECKING,Error.NONE,0);
            Descriptor descriptor=fetchDescriptor();
            synchronized(lock){metadataKnown=true;if(available==null||!available.sha256.equals(descriptor.sha256)||available.versionCode!=descriptor.versionCode)readyFile=null;available=descriptor.versionCode>BuildConfig.VERSION_CODE?descriptor:null;}
            pruneCache();
            try{AtomicFile cache=metadataCache();FileOutputStream stream=null;try{stream=cache.startWrite();stream.write(descriptor.json().toString().getBytes(StandardCharsets.UTF_8));cache.finishWrite(stream);}catch(Exception failure){if(stream!=null)cache.failWrite(stream);throw failure;}}catch(Exception cacheFailure){outcome=Error.STORAGE;}
        }catch(UpdateFailure failure){outcome=failure.error;}catch(Exception failure){outcome=Error.NETWORK;}finally{synchronized(lock){checking=false;base(outcome);}}
    });}
    private Descriptor fetchDescriptor() throws IOException {
        HttpURLConnection connection=open(FEED);try{if(connection.getResponseCode()!=200)throw new UpdateFailure(Error.NETWORK);if(connection.getContentLengthLong()>MAX_METADATA)throw new UpdateFailure(Error.INVALID_METADATA);try(InputStream input=connection.getInputStream()){return parseDescriptor(readBounded(input,MAX_METADATA),packageName);}}finally{connection.disconnect();}
    }
    void download(){Descriptor descriptor;long generation;synchronized(lock){if(checking||downloadActive||installing||available==null||available.versionCode<=BuildConfig.VERSION_CODE||available.minSdk>Build.VERSION.SDK_INT)return;if(readyFile!=null){base(Error.NONE);return;}descriptor=available;downloadActive=true;generation=++downloadGeneration;publish(Status.DOWNLOADING,Error.NONE,0);downloadFuture=worker.submit(()->download(descriptor,generation));}}
    private void download(Descriptor descriptor,long generation){File part=null;HttpURLConnection connection=null;try{
        File completed=artifact(descriptor,false);if(completed.isFile())try{verifyFile(completed,descriptor);completedDownload(generation,completed,descriptor.size);return;}catch(UpdateFailure invalid){completed.delete();}
        part=artifact(descriptor,true);connection=openApk(descriptor.apkUrl,generation);long declared=connection.getContentLengthLong();if(declared>=0&&declared!=descriptor.size)throw new UpdateFailure(Error.SIZE_MISMATCH);
        long[] last={0};try(InputStream input=connection.getInputStream()){stage(input,part,descriptor,()->generation!=downloadGeneration||Thread.currentThread().isInterrupted(),bytes->{long now=System.nanoTime();if(now-last[0]>=TimeUnit.MILLISECONDS.toNanos(150)||bytes==descriptor.size){last[0]=now;publishDownload(generation,Status.DOWNLOADING,bytes);}});}
        canceled(generation);publishDownload(generation,Status.VERIFYING,descriptor.size);verifyArchive(part,descriptor);canceled(generation);Files.move(part.toPath(),completed.toPath(),StandardCopyOption.REPLACE_EXISTING);part=null;
        completedDownload(generation,completed,descriptor.size);
    }catch(Exception failure){failedDownload(generation,failure instanceof UpdateFailure?((UpdateFailure)failure).error:failure instanceof InterruptedIOException?Error.NONE:Error.DOWNLOAD);}
        finally{if(connection!=null)connection.disconnect();if(part!=null)part.delete();synchronized(lock){if(generation==downloadGeneration){downloadActive=false;downloadFuture=null;downloadConnection=null;}}}
    }
    void cancelDownload(){HttpURLConnection connection;synchronized(lock){if(!downloadActive)return;downloadGeneration++;downloadActive=false;if(downloadFuture!=null)downloadFuture.cancel(true);downloadFuture=null;connection=downloadConnection;downloadConnection=null;base(Error.NONE);}if(connection!=null)connection.disconnect();}
    private void canceled(long generation) throws InterruptedIOException {if(generation!=downloadGeneration||Thread.currentThread().isInterrupted())throw new InterruptedIOException("Update canceled");}
    private HttpURLConnection openApk(String url,long generation) throws IOException {
        for(int redirects=0;redirects<=4;redirects++){
            if(!allowedRedirect(url))throw new UpdateFailure(Error.INVALID_METADATA);canceled(generation);HttpURLConnection connection=open(url);downloadConnection=connection;
            try{canceled(generation);int status=connection.getResponseCode();if(status==200)return connection;if(Set.of(301,302,303,307,308).contains(status)){String location=connection.getHeaderField("Location");if(location==null)throw new UpdateFailure(Error.DOWNLOAD);url=new URI(url).resolve(location).toString();connection.disconnect();continue;}throw new UpdateFailure(Error.DOWNLOAD);}catch(Exception error){connection.disconnect();if(error instanceof IOException)throw (IOException)error;throw new UpdateFailure(Error.DOWNLOAD);}
        }throw new UpdateFailure(Error.DOWNLOAD);
    }
    private static HttpURLConnection open(String url) throws IOException {HttpURLConnection connection=(HttpURLConnection)new URL(url).openConnection();connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(8000);connection.setReadTimeout(15000);connection.setUseCaches(false);connection.setRequestProperty("Accept-Encoding","identity");connection.setRequestProperty("Cookie","");connection.setRequestProperty("User-Agent","DART-Android-Updater");return connection;}
    boolean canInstall(){try{return Build.VERSION.SDK_INT<26||context.getPackageManager().canRequestPackageInstalls();}catch(RuntimeException denied){return false;}}
    File verifiedApk(){synchronized(lock){return state.status==Status.READY?readyFile:null;}}
    void openInstall(Activity activity){Descriptor descriptor;File file;WeakReference<Activity> owner=new WeakReference<>(activity);synchronized(lock){if(checking||downloadActive||installing||readyFile==null||available==null)return;if(!canInstall()){base(Error.INSTALL_PERMISSION_REQUIRED);return;}descriptor=available;file=readyFile;installing=true;}publish(Status.VERIFYING,Error.NONE,descriptor.size);worker.execute(()->{
        try{verifyFile(file,descriptor);main.post(()->{try{Activity target=owner.get();if(target==null||target.isFinishing()||target.isDestroyed())return;if(!canInstall()){base(Error.INSTALL_PERMISSION_REQUIRED);return;}Uri uri=FileProvider.getUriForFile(context,packageName+".updates",file);Intent install=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);install.setClipData(ClipData.newRawUri("DART update",uri));target.startActivity(install);}catch(RuntimeException failure){base(Error.INSTALL_FAILED);}finally{synchronized(lock){installing=false;}if(state.status==Status.VERIFYING)base(Error.NONE);}});}
        catch(Exception failure){synchronized(lock){installing=false;readyFile=null;}base(failure instanceof UpdateFailure?((UpdateFailure)failure).error:Error.INVALID_APK);}
    });}
    private void verifyFile(File file,Descriptor descriptor) throws IOException {if(!file.isFile()||file.length()!=descriptor.size)throw new UpdateFailure(Error.SIZE_MISMATCH);try(InputStream input=new FileInputStream(file)){if(!descriptor.sha256.equals(digest(input)))throw new UpdateFailure(Error.HASH_MISMATCH);}verifyArchive(file,descriptor);}
    @SuppressWarnings("deprecation") private void verifyArchive(File file,Descriptor descriptor) throws IOException {
        try{PackageManager manager=context.getPackageManager();int flags=Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;PackageInfo installed=manager.getPackageInfo(packageName,flags),archive=manager.getPackageArchiveInfo(file.getAbsolutePath(),flags);if(archive==null)throw new UpdateFailure(Error.INVALID_APK);
            long installedCode=Build.VERSION.SDK_INT>=28?installed.getLongVersionCode():installed.versionCode,archiveCode=Build.VERSION.SDK_INT>=28?archive.getLongVersionCode():archive.versionCode;int minimum=archive.applicationInfo==null?Integer.MAX_VALUE:archive.applicationInfo.minSdkVersion;
            Error error=archiveError(descriptor,archive.packageName,archiveCode,minimum,certificates(archive),installed.packageName,installedCode,certificates(installed),Build.VERSION.SDK_INT);if(error!=Error.NONE)throw new UpdateFailure(error);
        }catch(UpdateFailure failure){throw failure;}catch(Exception failure){throw new UpdateFailure(Error.INVALID_APK);}
    }
    @SuppressWarnings("deprecation") private static Set<String> certificates(PackageInfo info) throws GeneralSecurityException {
        android.content.pm.Signature[] signatures;
        if(Build.VERSION.SDK_INT>=28){if(info.signingInfo==null)return Set.of();if(info.signingInfo.hasMultipleSigners())signatures=info.signingInfo.getApkContentsSigners();else{android.content.pm.Signature[] history=info.signingInfo.getSigningCertificateHistory();signatures=history==null||history.length==0?null:new android.content.pm.Signature[]{history[history.length-1]};}}
        else signatures=info.signatures;
        Set<String> result=new HashSet<>();if(signatures!=null)for(android.content.pm.Signature signature:signatures)result.add(hex(MessageDigest.getInstance("SHA-256").digest(signature.toByteArray())));return result;
    }
    static Error archiveError(Descriptor descriptor,String archivePackage,long archiveCode,int archiveMinSdk,Set<String> archiveSigners,String installedPackage,long installedCode,Set<String> installedSigners,int sdk){
        if(!descriptor.packageName.equals(installedPackage)||!installedPackage.equals(archivePackage))return Error.PACKAGE_MISMATCH;
        if(archiveCode!=descriptor.versionCode||archiveCode<=installedCode)return Error.VERSION_MISMATCH;
        if(descriptor.minSdk>sdk||archiveMinSdk>sdk)return Error.UNSUPPORTED_ANDROID;
        return installedSigners.isEmpty()||!installedSigners.equals(archiveSigners)?Error.SIGNATURE_MISMATCH:Error.NONE;
    }
    static void stage(InputStream input,File part,Descriptor descriptor,BooleanSupplier canceled,LongConsumer progress) throws IOException {
        boolean complete=false;try(FileOutputStream output=new FileOutputStream(part)){MessageDigest digest;try{digest=MessageDigest.getInstance("SHA-256");}catch(GeneralSecurityException impossible){throw new IOException(impossible);}byte[] buffer=new byte[32768];long count=0;
            while(true){if(canceled.getAsBoolean())throw new InterruptedIOException("Update canceled");int read=input.read(buffer);if(read<0)break;if(count+read>descriptor.size||count+read>MAX_APK)throw new UpdateFailure(Error.SIZE_MISMATCH);output.write(buffer,0,read);digest.update(buffer,0,read);count+=read;progress.accept(count);}
            if(canceled.getAsBoolean())throw new InterruptedIOException("Update canceled");if(count!=descriptor.size)throw new UpdateFailure(Error.SIZE_MISMATCH);if(!descriptor.sha256.equals(hex(digest.digest())))throw new UpdateFailure(Error.HASH_MISMATCH);output.getFD().sync();complete=true;
        }finally{if(!complete)part.delete();}
    }
    private static String digest(InputStream input) throws IOException {try{MessageDigest digest=MessageDigest.getInstance("SHA-256");byte[] buffer=new byte[32768];int count;while((count=input.read(buffer))!=-1)digest.update(buffer,0,count);return hex(digest.digest());}catch(GeneralSecurityException impossible){throw new IOException(impossible);}}
    private static String hex(byte[] bytes){char[] digits="0123456789abcdef".toCharArray(),out=new char[bytes.length*2];for(int i=0;i<bytes.length;i++){out[i*2]=digits[(bytes[i]&255)>>>4];out[i*2+1]=digits[bytes[i]&15];}return new String(out);}
    static boolean allowedAssetUrl(String raw){try{URI uri=new URI(raw);return secure(uri)&&uri.getHost().equalsIgnoreCase("github.com")&&uri.getRawQuery()==null&&uri.getRawPath().matches("/4ek1st/DART/releases/download/android-v[0-9][a-zA-Z0-9._-]{0,79}/[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}\\.apk");}catch(Exception invalid){return false;}}
    static boolean allowedRedirect(String raw){try{URI uri=new URI(raw);if(!secure(uri))return false;String host=uri.getHost().toLowerCase(Locale.ROOT);return host.equals("github.com")?allowedAssetUrl(raw):Set.of("release-assets.githubusercontent.com","objects.githubusercontent.com").contains(host);}catch(Exception invalid){return false;}}
    private static boolean secure(URI uri){return "https".equalsIgnoreCase(uri.getScheme())&&uri.getHost()!=null&&uri.getRawUserInfo()==null&&uri.getRawFragment()==null&&(uri.getPort()==-1||uri.getPort()==443);}
    static Descriptor parseDescriptor(byte[] raw,String expectedPackage) throws IOException {
        if(raw.length==0||raw.length>MAX_METADATA)throw new UpdateFailure(Error.INVALID_METADATA);
        try{String json=StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(java.nio.ByteBuffer.wrap(raw)).toString();flatMetadata(json);
            JSONTokener parser=new JSONTokener(json);Object value=parser.nextValue();if(!(value instanceof JSONObject)||parser.nextClean()!=0)throw new JSONException("Metadata");JSONObject object=(JSONObject)value;
            if(integer(object,"schema",1)!=1)throw new JSONException("Schema");String pkg=text(object,"packageName",200),version=text(object,"versionName",60),url=text(object,"apkUrl",2048),hash=text(object,"sha256",64).toLowerCase(Locale.ROOT),notes=text(object,"releaseNotes",20000);int code=(int)integer(object,"versionCode",Integer.MAX_VALUE),sdk=(int)integer(object,"minSdk",1000);long size=integer(object,"size",MAX_APK);
            if(!pkg.equals(expectedPackage)||!version.matches("[0-9][a-zA-Z0-9 ._+\\-]{0,59}")||!allowedAssetUrl(url)||!hash.matches("[a-f0-9]{64}")||notes.chars().anyMatch(c->Character.isISOControl(c)&&c!='\n'&&c!='\r'&&c!='\t'))throw new JSONException("Metadata");return new Descriptor(pkg,code,version,sdk,url,hash,size,notes);
        }catch(Exception invalid){throw new UpdateFailure(Error.INVALID_METADATA);}
    }
    private static long integer(JSONObject object,String key,long max) throws JSONException {Object value=object.get(key);if(!(value instanceof Integer||value instanceof Long)||((Number)value).longValue()<=0||((Number)value).longValue()>max)throw new JSONException("Integer");return ((Number)value).longValue();}
    // Schema 1 is a flat object of strings and unsigned integers. Validate that
    // grammar before Android's deliberately lenient, recursive JSONTokener runs.
    private static void flatMetadata(String json) throws JSONException {
        int at=space(json,0);if(at>=json.length()||json.charAt(at++)!='{')throw new JSONException("Metadata");at=space(json,at);
        if(at<json.length()&&json.charAt(at)=='}')at++;
        else while(true){
            at=space(json,quoted(json,at));if(at>=json.length()||json.charAt(at++)!=':')throw new JSONException("Metadata");at=space(json,at);
            if(at<json.length()&&json.charAt(at)=='"')at=quoted(json,at);
            else{int start=at;while(at<json.length()&&json.charAt(at)>='0'&&json.charAt(at)<='9')at++;if(at==start||at-start>1&&json.charAt(start)=='0')throw new JSONException("Metadata");}
            at=space(json,at);if(at>=json.length())throw new JSONException("Metadata");char separator=json.charAt(at++);if(separator=='}')break;if(separator!=',')throw new JSONException("Metadata");at=space(json,at);
        }
        if(space(json,at)!=json.length())throw new JSONException("Metadata");
    }
    private static int space(String text,int at){while(at<text.length()&&" \t\r\n".indexOf(text.charAt(at))>=0)at++;return at;}
    private static int quoted(String text,int at) throws JSONException {
        if(at>=text.length()||text.charAt(at++)!='"')throw new JSONException("Metadata");
        while(at<text.length()){char c=text.charAt(at++);if(c=='"')return at;if(c<32)throw new JSONException("Metadata");if(c=='\\'){if(at>=text.length())throw new JSONException("Metadata");char escaped=text.charAt(at++);if(escaped=='u'){for(int i=0;i<4;i++)if(at>=text.length()||Character.digit(text.charAt(at++),16)<0)throw new JSONException("Metadata");}else if("\"\\/bfnrt".indexOf(escaped)<0)throw new JSONException("Metadata");}}
        throw new JSONException("Metadata");
    }
    private static String text(JSONObject object,String key,int max) throws JSONException {Object value=object.get(key);if(!(value instanceof String)||((String)value).length()>max)throw new JSONException("Text");return (String)value;}
    private static byte[] readBounded(InputStream input,int max) throws IOException {ByteArrayOutputStream output=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int count;while((count=input.read(buffer))!=-1){if(output.size()+count>max)throw new UpdateFailure(Error.INVALID_METADATA);output.write(buffer,0,count);}return output.toByteArray();}
}
