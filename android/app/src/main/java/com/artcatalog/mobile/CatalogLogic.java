package com.artcatalog.mobile;

import org.json.*;
import java.util.*;
import java.net.URI;
import java.text.Normalizer;

public final class CatalogLogic {
    private static final Set<String> GENERIC=Set.of("1girl","1boy","solo","2girls","multiple_girls","rating:safe","highres","absurdres","commentary","commentary_request","translated","translation_request","tagme","artist_request","source_request");
    public static String normalizeRating(String r){
        return switch(r.toLowerCase(Locale.ROOT)){
            case "g","general","safe" -> "g"; case "s","sensitive" -> "s";
            case "q","questionable" -> "q"; case "e","explicit" -> "e"; default -> "u";
        };
    }
    public static boolean matchesRating(String r,String filter){
        String n=normalizeRating(r);
        return "all".equals(filter)||("explicit".equals(filter)?n.equals("q")||n.equals("e"):n.equals("g")||n.equals("s"));
    }
    public static Post map(String source,JSONObject o){
        if(source.equals("sankaku"))return mapSankaku(o);
        Post p=new Post();p.source=source;p.id=o.optString("id");
        p.rating=normalizeRating(o.optString("rating"));p.hash=o.optString("md5");
        String rawTags=o.optString(source.equals("danbooru")?"tag_string":"tags");
        if(!rawTags.isBlank())p.tags=new ArrayList<>(Arrays.asList(rawTags.trim().split("\\s+")));
        String character=o.optString("tag_string_character");
        p.title=character.isBlank()?"Иллюстрация #"+p.id:character.replace('_',' ');
        if(!character.isBlank())p.characterTags=new ArrayList<>(Arrays.asList(character.trim().split("\\s+")));
        String artists=o.optString("tag_string_artist").trim();if(!artists.isBlank())p.artistTags=new ArrayList<>(Arrays.asList(artists.split("\\s+")));
        p.artistTag=p.artistTags.isEmpty()?"":p.artistTags.get(0);
        p.artist=p.artistTag.isBlank()?"Автор не указан":p.artistTag.replace('_',' ');
        p.uploaderId=o.optString("uploader_id",o.optString("creator_id"));p.uploaderName=o.optString("owner");
        JSONObject uploader=o.optJSONObject("uploader");if(uploader!=null)p.uploaderName=uploader.optString("name",p.uploaderName);
        String originalLink=o.optString("source");if(originalLink.matches("https://[^\\s]+"))p.originalUrl=originalLink;
        String parent=o.optString("parent_id");p.groupKey=parent.matches("[1-9][0-9]*")?source+":parent:"+parent:o.optBoolean("has_children")?source+":parent:"+p.id:"";
        p.preview=o.optString(source.equals("danbooru")?"preview_file_url":"preview_url");
        p.smallPreview=p.preview;
        p.original=o.optString("file_url");
        p.image=o.optString(source.equals("danbooru")?"large_file_url":"sample_url");
        if(p.image.isBlank())p.image=p.original;
        if(p.original.matches(".*\\.(mp4|webm)(\\?.*)?$"))p.image=p.original;
        JSONObject asset=o.optJSONObject("media_asset");JSONArray variants=asset==null?null:asset.optJSONArray("variants");
        if(variants!=null)for(int i=0;i<variants.length();i++){JSONObject v=variants.optJSONObject(i);if(v!=null&&v.optString("type").equals("720x720")&&isMediaUrl(v.optString("url")))p.preview=v.optString("url");}
        if(p.preview.equals(p.smallPreview)&&!p.isVideo()&&isMediaUrl(o.optString(source.equals("danbooru")?"large_file_url":"sample_url")))p.preview=p.image;
        if(p.preview.isBlank()&&!p.isVideo())p.preview=p.image;
        if(!p.image.isBlank())p.media.add(p.original.isBlank()?p.image:p.original);
        p.width=o.optInt("image_width",o.optInt("width"));
        p.height=o.optInt("image_height",o.optInt("height"));
        p.score=o.optInt("score");p.published=o.optString("created_at");
        p.sourceUrl=switch(source){
            case "gelbooru" -> "https://gelbooru.com/index.php?page=post&s=view&id="+p.id;
            case "rule34" -> "https://rule34.xxx/index.php?page=post&s=view&id="+p.id;
            default -> "https://danbooru.donmai.us/posts/"+p.id;
        };
        return p;
    }
    private static String value(JSONObject o,String key){return o.isNull(key)?"":o.optString(key);}
    private static Post mapSankaku(JSONObject o){
        Post p=new Post();p.source="sankaku";p.id=value(o,"id");p.rating=normalizeRating(value(o,"rating"));p.hash=value(o,"md5");
        JSONArray tags=o.optJSONArray("tags");
        if(tags!=null)for(int i=0;i<tags.length();i++){
            JSONObject tag=tags.optJSONObject(i);if(tag==null)continue;
            String name=value(tag,"tagName");if(name.isBlank())name=value(tag,"name_en");if(name.isBlank())name=value(tag,"name");
            if(name.isBlank()||p.tags.contains(name))continue;p.tags.add(name);
            if(tag.optInt("type",-1)==1)p.artistTags.add(name);
            if(tag.optInt("type",-1)==4&&!name.endsWith("_request")&&!name.equals("original_character"))p.characterTags.add(name);
        }
        p.artistTag=p.artistTags.isEmpty()?"":p.artistTags.get(0);p.artist=p.artistTag.isBlank()?"Автор не указан":p.artistTag.replace('_',' ');
        p.title=p.characterTags.isEmpty()?"Иллюстрация #"+p.id:String.join(", ",p.characterTags).replace('_',' ');
        JSONObject author=o.optJSONObject("author");if(author!=null){p.uploaderId=value(author,"id");p.uploaderName=value(author,"name");}
        String originalLink=value(o,"source");if(originalLink.matches("https://[^\\s]+"))p.originalUrl=originalLink;
        String parent=value(o,"parent_id");p.groupKey=validId("sankaku",parent)?"sankaku:parent:"+parent:o.optBoolean("has_children")?"sankaku:parent:"+p.id:"";
        p.original=value(o,"file_url");p.image=value(o,"sample_url");p.preview=value(o,"preview_url");p.smallPreview=p.preview;
        if(p.image.isBlank()||p.original.matches(".*\\.(mp4|webm|m4v)(\\?.*)?$"))p.image=p.original;
        if(p.preview.matches(".*\\.avif(\\?.*)?$")&&!p.isVideo()&&isMediaUrl(p.image))p.preview=p.image;
        if(p.preview.isBlank()&&!p.isVideo())p.preview=p.image;
        if(isMediaUrl(p.original))p.media.add(p.original);else if(isMediaUrl(p.image))p.media.add(p.image);
        if(!p.media.isEmpty())try{p.imageRecords.put(new JSONObject().put("url",p.media.get(0)).put("hash",p.hash).put("source","sankaku").put("id",p.id));}catch(JSONException ignored){}
        p.width=o.optInt("width");p.height=o.optInt("height");p.score=o.optInt("total_score",o.optInt("fav_count"));
        JSONObject created=o.optJSONObject("created_at");if(created!=null&&created.optLong("s",0)>0)p.published=java.time.Instant.ofEpochSecond(created.optLong("s")).toString();else p.published=value(o,"created_at");
        p.sourceUrl="https://sankaku.app/posts/"+p.id;return p;
    }
    static boolean validId(String source,String id){return source.equals("sankaku")?id.matches("[a-zA-Z0-9]{1,64}"):Set.of("danbooru","gelbooru","rule34").contains(source)&&id.matches("[0-9]+");}
    static void refreshSignedMedia(Post current,Post fresh){
        Map<String,String> replacements=new HashMap<>();for(String url:List.of(fresh.original,fresh.image,fresh.preview,fresh.smallPreview))if(isMediaUrl(url))replacements.put(mediaPath(url),url);
        List<String> refreshed=new ArrayList<>();for(String url:current.media)refreshed.add(replacements.getOrDefault(mediaPath(url),url));current.media=refreshed;
        for(int i=0;i<current.imageRecords.length();i++){JSONObject record=current.imageRecords.optJSONObject(i);if(record!=null)try{String url=record.optString("url");record.put("url",replacements.getOrDefault(mediaPath(url),url));}catch(JSONException ignored){}}
        if(current.key().equals(fresh.key())){current.preview=fresh.preview;current.smallPreview=fresh.smallPreview;current.image=fresh.image;current.original=fresh.original;}
    }
    private static String mediaPath(String url){try{URI u=URI.create(url);return u.getHost()+u.getPath();}catch(Exception e){return url;}}
    public static boolean hasMore(int received,int size){return received>=size;}
    /** Keep the open work's first image while merging new variants by content identity. */
    static boolean updateGalleryMedia(Post current,Post equivalent){
        Set<String> urls=new LinkedHashSet<>(),hashes=new HashSet<>();JSONArray records=new JSONArray();
        for(Post post:List.of(current,equivalent)){
            JSONArray media=post.imageRecords;
            if(media.length()==0){media=new JSONArray();for(String url:post.media)try{media.put(new JSONObject().put("url",url).put("hash",post.media.size()==1?post.hash:""));}catch(JSONException ignored){}}
            for(int i=0;i<media.length()&&records.length()<100;i++){JSONObject record=media.optJSONObject(i);if(record==null)continue;String url=record.optString("url"),hash=record.optString("hash").toLowerCase(Locale.ROOT);if(url.isBlank()||urls.contains(url)||!hash.isBlank()&&hashes.contains(hash))continue;urls.add(url);if(!hash.isBlank())hashes.add(hash);records.put(record);}
        }
        List<String> merged=new ArrayList<>(urls);boolean changed=!current.media.equals(merged);current.media=merged;current.imageRecords=records;
        Set<String> members=new LinkedHashSet<>(current.memberKeys);members.addAll(equivalent.memberKeys);members.add(equivalent.key());current.memberKeys=new ArrayList<>(members);return changed;
    }
    private static String identity(Post p){return p.hash.isBlank()?p.key():"md5:"+p.hash;}
    public static List<Post> merge(List<Post> a,List<Post> b){return WorkGrouping.group(a,b);}
    private static List<String> union(List<String> a,List<String> b){LinkedHashSet<String> values=new LinkedHashSet<>(a);values.addAll(b);return new ArrayList<>(values);}
    public static String normalizeTag(String tag){
        boolean ascii=true;for(int i=0;i<tag.length();i++)if(tag.charAt(i)>127){ascii=false;break;}
        String normal=(ascii?tag:Normalizer.normalize(tag,Normalizer.Form.NFKC)).toLowerCase(Locale.ROOT).trim();
        int start=0;while(start<normal.length()&&normal.charAt(start)=='#')start++;
        StringBuilder result=new StringBuilder(normal.length());boolean space=false;
        for(int i=start;i<normal.length();i++){char c=normal.charAt(i);if(c=='_'||c=='-'||c==' '||c>='\t'&&c<='\r')space=true;else{if(space&&result.length()>0)result.append(' ');result.append(c);space=false;}}
        return result.toString().trim();
    }
    public static List<String> excludedTags(String raw){LinkedHashSet<String> result=new LinkedHashSet<>();for(String tag:raw.split(",")){String clean=normalizeTag(tag);if(!clean.isBlank()&&clean.length()<=100&&result.size()<100)result.add(clean);}return new ArrayList<>(result);}
    private static final Set<String> GENERATED=Set.of("ai generated","ai art","ai artwork","ai image","ai illustration","stable diffusion","nai diffusion","novelai","midjourney","dall e","dall e 2","dall e 3","comfyui","automatic1111","thisanimedoesnotexist","generated with ai","made with ai");
    private static final Set<String> ASSISTED=Set.of("ai assisted","ai aided","ai enhanced");
    private static boolean marker(String tag,Set<String> markers){for(String m:markers)if(tag.equals(m)||tag.startsWith(m+" "))return true;return false;}
    public static boolean hidden(Post p,String aiMode,Collection<String> excluded){if(aiMode.equals("all")&&excluded.isEmpty())return false;Set<String> blocked=excluded instanceof Set?(Set<String>)excluded:new HashSet<>(excluded);for(String raw:p.tags){String tag=normalizeTag(raw);if(blocked.contains(tag)||!aiMode.equals("all")&&marker(tag,GENERATED)||aiMode.equals("generated-and-assisted")&&marker(tag,ASSISTED))return true;}return false;}
    public static String tagKind(Post p,String tag){String normalized=normalizeTag(tag);if(!normalized.equals("original character"))for(String character:p.characterTags)if(normalizeTag(character).equals(normalized))return "character";return normalized.equals("original")?"original":"";}
    public static List<String> artworkTags(Post p){List<String> sorted=union(p.tags,p.characterTags);Set<String> characters=new HashSet<>();for(String tag:p.characterTags)characters.add(normalizeTag(tag));Map<String,Integer> kinds=new HashMap<>();for(String tag:sorted){String normal=normalizeTag(tag);kinds.put(tag,!normal.equals("original character")&&characters.contains(normal)?0:normal.equals("original")?1:2);}sorted.sort(Comparator.comparingInt(kinds::get));return sorted;}
    public static List<String> relatedQueries(Post p){List<String> result=new ArrayList<>();for(String tag:p.characterTags)if(!normalizeTag(tag).equals("original character"))result.add(tag);for(String tag:recommendationTags(List.of(p)))if(!tag.equals(p.artistTag)&&!p.artistTags.contains(tag)&&!Set.of("artist_name","signature","watermark","original").contains(tag)&&!result.contains(tag))result.add(tag);return result;}
    public static Post neighbor(List<Post> posts,Post current,int delta){for(int i=0;i<posts.size();i++)if(posts.get(i).key().equals(current.key())||posts.get(i).memberKeys.contains(current.key())){int next=i+delta;return next>=0&&next<posts.size()?posts.get(next):null;}return null;}
    public static List<String> recommendationTags(List<Post> bookmarks){
        Map<String,Integer> counts=new HashMap<>();
        for(Post p:bookmarks)for(String tag:new HashSet<>(p.tags))
            if(!GENERIC.contains(tag)&&!tag.contains(":")&&tag.length()>2)
                counts.merge(tag,1,Integer::sum);
        List<String> result=new ArrayList<>(counts.keySet());
        result.sort(Comparator.<String>comparingInt(t->counts.get(t)).reversed().thenComparing(t->t));
        return result.subList(0,Math.min(12,result.size()));
    }
    public static List<Post> excludeSaved(List<Post> items,List<Post> saved){
        Set<String> tokens=new HashSet<>();for(Post p:saved)tokens.addAll(WorkGrouping.tokens(p));List<Post> out=new ArrayList<>();
        for(Post p:items)if(Collections.disjoint(tokens,WorkGrouping.tokens(p)))out.add(p);
        return out;
    }
    public static String cleanQuery(String query){return query.replaceAll("[\\p{Cntrl}]", " ").trim().replaceAll("\\s+"," ");}
    public static boolean isMediaUrl(String url){
        try{
            URI uri=URI.create(url);String host=uri.getHost();
            if(!"https".equals(uri.getScheme())||host==null||uri.getUserInfo()!=null)return false;
            host=host.toLowerCase(Locale.ROOT);
            for(String root:List.of("donmai.us","gelbooru.com","rule34.xxx","r34.xxx","rule34.us","sankakucomplex.com"))
                if(host.equals(root)||host.endsWith("."+root))return true;
        }catch(Exception ignored){}
        return false;
    }
    static String mediaReferer(String url){String host=URI.create(url).getHost().toLowerCase(Locale.ROOT);if(host.equals("sankakucomplex.com")||host.endsWith(".sankakucomplex.com"))return "https://sankaku.app/";if(host.equals("donmai.us")||host.endsWith(".donmai.us"))return "https://danbooru.donmai.us/";if(host.equals("gelbooru.com")||host.endsWith(".gelbooru.com"))return "https://gelbooru.com/";return "https://rule34.xxx/";}
}
