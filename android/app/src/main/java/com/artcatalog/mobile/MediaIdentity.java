package com.artcatalog.mobile;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.regex.*;
import org.json.*;

/** Exact original-file identity; signature renewal never creates another gallery page. */
final class MediaIdentity {
    private MediaIdentity(){}
    private static final Pattern SANKAKU=Pattern.compile("(?:.*\\.)?sankakucomplex\\.com"),HOST=Pattern.compile("(?:.*\\.)?(?:donmai\\.us|gelbooru\\.com|rule34\\.xxx|sankakucomplex\\.com)"),
        ORIGINAL=Pattern.compile("^/(?:o|data)/[a-f0-9]{2}/[a-f0-9]{2}/([a-f0-9]{32}\\.[a-z0-9]+)$",Pattern.CASE_INSENSITIVE),
        FILE=Pattern.compile("/(?:sample-|thumbnail_|sample_)?([a-f0-9]{32})\\.(?:jpe?g|png|webp|gif|avif|mp4|webm|m4v|ogv)$",Pattern.CASE_INSENSITIVE),HASH=Pattern.compile("[a-f0-9]{32}",Pattern.CASE_INSENSITIVE);
    private static final Map<String,String> TOKENS=new LinkedHashMap<>(256,.75f,true);
    private static final char[] HEX="0123456789abcdef".toCharArray();
    static String cacheKey(String raw){try{URI u=URI.create(raw);String host=u.getHost()==null?"":u.getHost().toLowerCase(Locale.ROOT);String query=u.getRawQuery();
        if(!u.getScheme().equalsIgnoreCase("https")||!SANKAKU.matcher(host).matches()||query==null)return raw;
        List<String> args=new ArrayList<>(List.of(query.split("&")));Set<String> names=new HashSet<>();for(String arg:args)names.add(arg.split("=",2)[0]);
        boolean shortSigned=names.contains("e")&&names.contains("m"),longSigned=names.contains("expires")&&names.contains("token");if(!shortSigned&&!longSigned)return raw;
        args.removeIf(arg->{String name=arg.split("=",2)[0];return shortSigned&&(name.equals("e")||name.equals("m"))||longSigned&&(name.equals("expires")||name.equals("token"));});
        String suffix=args.isEmpty()?"":"?"+String.join("&",args);Matcher original=ORIGINAL.matcher(u.getRawPath());
        if(original.matches())return "https://sankakucomplex.com/media/original/"+original.group(1).toLowerCase(Locale.ROOT)+suffix;
        return "https://"+u.getRawAuthority()+u.getRawPath()+suffix+(u.getRawFragment()==null?"":"#"+u.getRawFragment());
    }catch(Exception ignored){return raw;}}
    static String hash(String raw){try{URI u=URI.create(raw);String host=u.getHost()==null?"":u.getHost().toLowerCase(Locale.ROOT);
        if(!Set.of("https","http").contains(u.getScheme().toLowerCase(Locale.ROOT))||!HOST.matcher(host).matches())return "";
        Matcher m=FILE.matcher(u.getPath());return m.find()?m.group(1).toLowerCase(Locale.ROOT):"";
    }catch(Exception ignored){return "";}}
    /** Same URL/hash projection as records(), without constructing or encoding JSON. */
    static void addTokens(Post p,Set<String> out){List<String> media=p.media.isEmpty()&&!p.image.isBlank()?List.of(p.image):p.media;Map<String,JSONObject> known=new HashMap<>();for(int i=0;i<p.imageRecords.length();i++){JSONObject record=p.imageRecords.optJSONObject(i);if(record!=null)known.put(record.optString("url"),record);}
        for(String url:media){JSONObject record=known.get(url);String hash=record==null?"":record.optString("hash");if(hash.isBlank())hash=hash(url);if(hash.isBlank()&&media.size()==1)hash=p.hash;String token=token(url);if(!token.isBlank())out.add(token);if(HASH.matcher(hash).matches())out.add("hash:"+hash.toLowerCase(Locale.ROOT));}}
    static String token(String raw){try{String url=cacheKey(raw);URI u=URI.create(url);if(!Set.of("https","http").contains(u.getScheme().toLowerCase(Locale.ROOT)))return "";int fragment=url.indexOf('#');if(fragment>=0)url=url.substring(0,fragment);
        synchronized(TOKENS){String cached=TOKENS.get(url);if(cached!=null)return cached;}
        byte[] bytes=MessageDigest.getInstance("SHA-256").digest(url.getBytes(StandardCharsets.UTF_8));char[] hex=new char[bytes.length*2];for(int i=0;i<bytes.length;i++){int value=bytes[i]&255;hex[i*2]=HEX[value>>>4];hex[i*2+1]=HEX[value&15];}String result="group:media:"+new String(hex);
        synchronized(TOKENS){String cached=TOKENS.get(url);if(cached!=null)return cached;TOKENS.put(url,result);while(TOKENS.size()>8192)TOKENS.remove(TOKENS.keySet().iterator().next());}return result;
    }catch(Exception ignored){return "";}}
    static JSONArray records(Post p){JSONArray out=new JSONArray();List<String> media=p.media.isEmpty()&&!p.image.isBlank()?List.of(p.image):p.media;Map<String,JSONObject> known=new HashMap<>();for(int i=0;i<p.imageRecords.length();i++){JSONObject record=p.imageRecords.optJSONObject(i);if(record!=null)known.put(record.optString("url"),record);}
        for(String url:media)try{JSONObject record=known.containsKey(url)?new JSONObject(known.get(url).toString()):new JSONObject().put("url",url);String hash=record.optString("hash");if(hash.isBlank())hash=hash(url);if(hash.isBlank()&&media.size()==1)hash=p.hash;
            record.put("hash",hash.toLowerCase(Locale.ROOT));if(!record.has("owner")&&p.memberKeys.size()<=1)record.put("owner",p.key());out.put(record);
        }catch(JSONException ignored){}return out;}
    static JSONArray unique(Collection<JSONArray> groups){JSONArray out=new JSONArray();Set<String> urls=new HashSet<>(),hashes=new HashSet<>();for(JSONArray group:groups)for(int i=0;i<group.length()&&out.length()<100;i++){
        JSONObject record=group.optJSONObject(i);if(record==null)continue;String url=record.optString("url"),hash=record.optString("hash").toLowerCase(Locale.ROOT);if(hash.isBlank())hash=hash(url);String key=cacheKey(url);
        if(url.isBlank()||urls.contains(key)||!hash.isBlank()&&hashes.contains(hash))continue;try{JSONObject copy=new JSONObject(record.toString());copy.put("hash",hash);out.put(copy);urls.add(key);if(!hash.isBlank())hashes.add(hash);}catch(JSONException ignored){}
    }return out;}
}
