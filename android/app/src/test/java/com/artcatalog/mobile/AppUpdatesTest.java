package com.artcatalog.mobile;

import org.json.*;
import org.junit.Test;
import java.io.*;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.function.*;
import static org.junit.Assert.*;

public class AppUpdatesTest {
    private static final String APK="https://github.com/4ek1st/DART/releases/download/android-v0.1.15/DART-Android-0.1.15.apk";
    private Class<?> core(){try{return Class.forName("com.artcatalog.mobile.AppUpdates");}catch(ClassNotFoundException absent){throw new AssertionError("Android update core is missing",absent);}}
    private Object call(String name,Class<?>[] parameters,Object...values) throws Exception {
        Method method=core().getDeclaredMethod(name,parameters);method.setAccessible(true);try{return method.invoke(null,values);}catch(InvocationTargetException wrapper){Throwable cause=wrapper.getCause();if(cause instanceof Exception)throw (Exception)cause;if(cause instanceof Error)throw (Error)cause;throw wrapper;}
    }
    private JSONObject metadata() throws Exception {return new JSONObject().put("schema",1).put("packageName","com.artcatalog.mobile").put("versionCode",16).put("versionName","0.1.15").put("minSdk",26).put("apkUrl",APK).put("sha256","a".repeat(64)).put("size",4096).put("releaseNotes","Neutral update notes");}
    private Object parse(JSONObject value) throws Exception {return call("parseDescriptor",new Class<?>[]{byte[].class,String.class},value.toString().getBytes(StandardCharsets.UTF_8),"com.artcatalog.mobile");}
    private Object field(Object value,String name) throws Exception {Field field=value.getClass().getDeclaredField(name);field.setAccessible(true);return field.get(value);}
    private void reject(JSONObject value) throws Exception {try{parse(value);fail("Unsafe update descriptor was accepted");}catch(IOException|IllegalArgumentException expected){}}
    @Test public void descriptorRequiresExactPackagePositiveIntegersAndBoundedSize() throws Exception {
        Object descriptor=parse(metadata());assertEquals(16,field(descriptor,"versionCode"));assertEquals(4096L,field(descriptor,"size"));
        for(String json:List.of("{schema:2}","{versionCode:0}","{versionCode:16.5}","{versionCode:'16'}","{packageName:'other.app'}","{size:134217729}","{size:0}","{sha256:'bad'}","{minSdk:0}")){
            JSONObject value=metadata(),changes=new JSONObject(json);for(Iterator<String> keys=changes.keys();keys.hasNext();){String key=keys.next();value.put(key,changes.get(key));}reject(value);
        }
    }
    @Test public void descriptorRejectsTrailingDataAndOversizedOrNestedJson() throws Exception {
        for(byte[] value:List.of((metadata()+" {}").getBytes(StandardCharsets.UTF_8),new byte[65537],("[".repeat(40)+"0"+"]".repeat(40)).getBytes(StandardCharsets.UTF_8))){try{call("parseDescriptor",new Class<?>[]{byte[].class,String.class},value,"com.artcatalog.mobile");fail("Invalid metadata accepted");}catch(IOException|IllegalArgumentException expected){}}
    }
    @Test public void descriptorRejectsAndroidsLenientGrammarBeforeItsRecursiveParser() throws Exception {
        String json=metadata().toString();
        for(String value:List.of(json.replace('"','\''),json.replace("\"schema\":","schema:"),json.substring(0,json.length()-1)+",}",metadata().put("extra",new JSONArray().put(new JSONArray())).toString())){
            try{call("parseDescriptor",new Class<?>[]{byte[].class,String.class},value.getBytes(StandardCharsets.UTF_8),"com.artcatalog.mobile");fail("Noncanonical or nested descriptor reached the platform parser");}catch(IOException expected){}
        }
        assertNotNull(parse(metadata().put("releaseNotes","What's new: \"quoted\" notes, [brackets], {braces} and newline\n")));
    }
    @Test public void cacheCleanupRecognizesOnlyExactOwnedArtifactNames() throws Exception {
        String owned="dart-update-v16-"+"a".repeat(64)+".apk";
        assertEquals(true,call("ownedArtifactName",new Class<?>[]{String.class},owned));assertEquals(true,call("ownedArtifactName",new Class<?>[]{String.class},owned+".part"));
        for(String name:List.of("descriptor.json","profile.json","other.apk","../"+owned,owned+".backup","dart-update-v0-"+"a".repeat(64)+".apk"))assertEquals(name,false,call("ownedArtifactName",new Class<?>[]{String.class},name));
    }
    @Test public void initialApkUrlIsRestrictedToThisRepositoriesAndroidReleaseAssets() throws Exception {
        assertEquals(true,call("allowedAssetUrl",new Class<?>[]{String.class},APK));
        for(String url:List.of(APK.replace("https:","http:"),APK.replace("github.com","github.com.evil.test"),APK.replace("4ek1st/DART","other/DART"),APK.replace("android-v","v"),APK+"?token=secret",APK+"#fragment",APK.replace("github.com","user@github.com"),APK.replace("github.com","github.com:444"),APK.replace("DART/releases","DART%2freleases"),APK.replace(".apk",".html")))assertEquals(url,false,call("allowedAssetUrl",new Class<?>[]{String.class},url));
    }
    @Test public void redirectHostsStayHttpsAndCannotSwitchToAnotherRepository() throws Exception {
        for(String url:List.of(APK,"https://release-assets.githubusercontent.com/neutral.apk?signature=temporary","https://objects.githubusercontent.com/neutral.apk"))assertEquals(true,call("allowedRedirect",new Class<?>[]{String.class},url));
        for(String url:List.of("http://objects.githubusercontent.com/neutral.apk","https://objects.githubusercontent.com.evil.test/neutral.apk","https://user@objects.githubusercontent.com/a","https://objects.githubusercontent.com:444/a","https://github.com/other/repo/releases/download/android-v1/a.apk","https://localhost/a.apk"))assertEquals(url,false,call("allowedRedirect",new Class<?>[]{String.class},url));
    }
    private String archive(Object descriptor,String pkg,long code,int sdk,Set<String> signer,String installed,long installedCode,Set<String> installedSigner,int device) throws Exception {
        return call("archiveError",new Class<?>[]{descriptor.getClass(),String.class,long.class,int.class,Set.class,String.class,long.class,Set.class,int.class},descriptor,pkg,code,sdk,signer,installed,installedCode,installedSigner,device).toString();
    }
    @Test public void archiveRequiresExpectedPackageVersionSdkAndExactCurrentSignerSet() throws Exception {
        Object descriptor=parse(metadata());Set<String> cert=Set.of("trusted");
        assertEquals("NONE",archive(descriptor,"com.artcatalog.mobile",16,26,cert,"com.artcatalog.mobile",15,cert,35));
        assertEquals("PACKAGE_MISMATCH",archive(descriptor,"other.app",16,26,cert,"com.artcatalog.mobile",15,cert,35));
        assertEquals("VERSION_MISMATCH",archive(descriptor,"com.artcatalog.mobile",15,26,cert,"com.artcatalog.mobile",15,cert,35));
        assertEquals("VERSION_MISMATCH",archive(descriptor,"com.artcatalog.mobile",17,26,cert,"com.artcatalog.mobile",15,cert,35));
        assertEquals("UNSUPPORTED_ANDROID",archive(descriptor,"com.artcatalog.mobile",16,36,cert,"com.artcatalog.mobile",15,cert,35));
        for(Set<String> signer:List.of(Set.of("other"),Set.of("trusted","other"),Set.<String>of()))assertEquals("SIGNATURE_MISMATCH",archive(descriptor,"com.artcatalog.mobile",16,26,signer,"com.artcatalog.mobile",15,cert,35));
    }
    private String hash(byte[] bytes) throws Exception {StringBuilder text=new StringBuilder();for(byte value:MessageDigest.getInstance("SHA-256").digest(bytes))text.append(String.format(Locale.ROOT,"%02x",value&255));return text.toString();}
    private void stage(byte[] data,File part,Object descriptor,BooleanSupplier canceled) throws Exception {call("stage",new Class<?>[]{InputStream.class,File.class,descriptor.getClass(),BooleanSupplier.class,LongConsumer.class},new ByteArrayInputStream(data),part,descriptor,canceled,(LongConsumer)ignored->{});}
    @Test public void downloadVerifiesBytesAndRemovesEveryFailedOrCancelledPartialFile() throws Exception {
        byte[] data="neutral APK fixture bytes".getBytes(StandardCharsets.UTF_8);JSONObject raw=metadata().put("sha256",hash(data)).put("size",data.length);Object descriptor=parse(raw);Path directory=Files.createTempDirectory("dart-updates-test-");File part=directory.resolve("owned.part").toFile();
        try{stage(data,part,descriptor,()->false);assertArrayEquals(data,Files.readAllBytes(part.toPath()));Files.delete(part.toPath());
            for(int mode=0;mode<4;mode++){try{if(mode==0)stage(Arrays.copyOf(data,data.length-1),part,descriptor,()->false);else if(mode==1)stage(Arrays.copyOf(data,data.length+1),part,descriptor,()->false);else if(mode==2)stage(data,part,parse(raw.put("sha256","b".repeat(64))),()->false);else stage(data,part,descriptor,()->true);fail("Failed download was accepted");}catch(IOException expected){}assertFalse("An unusable partial file remains",part.exists());}
        }finally{Files.deleteIfExists(part.toPath());Files.delete(directory);}
    }
    @Test public void sixHourThrottleAllowsManualRetryAndClockRollback() throws Exception {
        long now=100000000L,interval=6*60*60*1000L;Class<?>[] types={long.class,long.class,boolean.class};
        assertEquals(false,call("shouldCheck",types,now-1000,now,false));assertEquals(true,call("shouldCheck",types,now-1000,now,true));assertEquals(true,call("shouldCheck",types,now-interval,now,false));assertEquals(true,call("shouldCheck",types,now+1000,now,false));assertEquals(true,call("shouldCheck",types,0L,now,false));
    }
    @Test public void descriptorAndStateExposeOnlyImmutableFields() throws Exception {
        for(String nested:List.of("Descriptor","State"))for(Field field:Class.forName(core().getName()+"$"+nested).getDeclaredFields())if(!Modifier.isStatic(field.getModifiers()))assertTrue(nested+"."+field.getName(),Modifier.isFinal(field.getModifiers()));
    }
}
