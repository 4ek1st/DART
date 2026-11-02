package com.artcatalog.mobile;

import org.json.*;
import java.util.*;

public final class Post {
    public String source="", id="", title="", artist="", artistTag="", preview="",
        image="", original="", sourceUrl="", hash="", rating="", published="",smallPreview="",
        originalUrl="",uploaderId="",uploaderName="",groupKey="",pixivGroupKey="",visualHash="",visualPHash="",relatedQuery="",accessMessage="";
    public int width, height, score,groupingVersion,groupCount;
    public Integer popularityCount;
    public double visualAspectRatio;
    public boolean requiresAuthentication;
    public JSONArray participants=new JSONArray();
    public List<Post> groupMembers=new ArrayList<>();
    public long groupMinTime=-1,groupMaxTime=-1;
    public List<String> tags=new ArrayList<>();
    public List<String> characterTags=new ArrayList<>(),copyrightTags=new ArrayList<>(),artistTags=new ArrayList<>(),memberKeys=new ArrayList<>(),media=new ArrayList<>();
    public List<String> identityKeys=new ArrayList<>(),uploaderKeys=new ArrayList<>();public JSONArray visualSamples=new JSONArray(),imageRecords=new JSONArray();
    public String key(){return source+":"+id;}
    public boolean isVideo(){return image.toLowerCase(Locale.ROOT).matches(".*\\.(mp4|webm|m4v)(\\?.*)?$");}
    /** The existing persistence round-trip values, without allocating a JSON tree for every field. */
    Post copy(){return copy(true);}
    private Post copy(boolean includeMembers){
        Post p=new Post();p.source=source;p.id=id;p.title=title;p.artist=artist;p.artistTag=artistTag;p.preview=preview;
        p.image=image;p.original=original;p.sourceUrl=sourceUrl;p.hash=hash;p.rating=rating;p.published=published;p.smallPreview=smallPreview;
        p.originalUrl=originalUrl;p.uploaderId=uploaderId;p.uploaderName=uploaderName;p.groupKey=groupKey;p.pixivGroupKey=pixivGroupKey;
        p.visualHash=visualHash;p.visualPHash=visualPHash;p.relatedQuery=relatedQuery;p.accessMessage=accessMessage;
        p.width=width;p.height=height;p.score=score;p.groupingVersion=groupingVersion;p.groupCount=Math.max(1,media.size());p.popularityCount=popularityCount;
        p.groupMinTime=groupMinTime;p.groupMaxTime=groupMaxTime;p.visualAspectRatio=visualAspectRatio;p.requiresAuthentication=requiresAuthentication;
        p.tags=copyStrings(tags,1000,true);p.characterTags=copyStrings(characterTags,1000,false);p.copyrightTags=copyStrings(copyrightTags,1000,false);
        p.artistTags=copyStrings(artistTags,1000,false);if(p.artistTags.isEmpty()&&!artistTag.isBlank())p.artistTags.add(artistTag);
        p.memberKeys=copyStrings(memberKeys,1000,false);p.identityKeys=copyStrings(identityKeys,2000,false);p.uploaderKeys=copyStrings(uploaderKeys,1000,false);
        p.media=copyStrings(media,1000,false);if(p.media.isEmpty()&&!image.isBlank())p.media.add(image);
        try{
            // Serialization adds missing artists before the parser applies its first-100-slot limit.
            Set<String> seen=new HashSet<>();int slots=participants.length();
            for(int i=0;i<Math.min(100,slots);i++){JSONObject person=participants.optJSONObject(i);if(person!=null){seen.add(person.optString("tag"));if(person.optString("tag").length()<=100)p.participants.put(copyJson(person));}}
            if(slots<100){List<String> artists=new ArrayList<>(artistTags);if(!artistTag.isBlank())artists.add(artistTag);
                for(String tag:artists)if(!tag.isBlank()&&seen.add(tag)){if(slots++>=100)break;if(tag.length()<=100)p.participants.put(new JSONObject().put("tag",tag).put("name",tag.equals(artistTag)?artist:tag.replace('_',' ')).put("role",participantRole(tag,"")));}}
            p.visualSamples=(JSONArray)copyJson(visualSamples);p.imageRecords=(JSONArray)copyJson(imageRecords);
            if(!Double.isFinite(visualAspectRatio))throw new JSONException("Non-finite aspect ratio");
        }catch(JSONException e){throw new IllegalStateException(e);}
        if(includeMembers)for(int i=0;i<Math.min(100,groupMembers.size());i++)p.groupMembers.add(groupMembers.get(i).copy(false));return p;
    }
    private static List<String> copyStrings(List<String> source,int limit,boolean keepBlank){List<String> result=new ArrayList<>(Math.min(source.size(),limit));
        for(int i=0;i<Math.min(source.size(),limit);i++){String value=source.get(i);if(value==null)value="";if(keepBlank||!value.isBlank())result.add(value);}return result;}
    private static Object copyJson(Object value)throws JSONException {
        if(value instanceof JSONObject){JSONObject source=(JSONObject)value,result=new JSONObject();Iterator<String> keys=source.keys();while(keys.hasNext()){String key=keys.next();result.put(key,copyJson(source.get(key)));}return result;}
        if(value instanceof JSONArray){JSONArray source=(JSONArray)value,result=new JSONArray();for(int i=0;i<source.length();i++)result.put(copyJson(source.get(i)));return result;}return value;
    }
    public JSONObject toJson() {return toJson(true);}
    private JSONObject toJson(boolean includeMembers) {
        JSONObject o=new JSONObject();
        try {
            o.put("key",key()).put("source",source).put("id",id).put("title",title).put("artist",artist).put("creatorName",artist)
                .put("creatorTag",artistTag).put("thumbnail",preview).put("image",image)
                .put("original",original).put("sourceUrl",sourceUrl).put("contentHash",hash)
                .put("rating",rating).put("published",published).put("width",width)
                .put("height",height).put("score",score).put("tags",new JSONArray(tags))
                .put("characterTags",new JSONArray(characterTags)).put("copyrightTags",new JSONArray(copyrightTags)).put("artistTags",new JSONArray(artistTags))
                .put("memberKeys",new JSONArray(memberKeys)).put("images",new JSONArray(media))
                .put("smallPreview",smallPreview).put("originalUrl",originalUrl).put("uploaderId",uploaderId).put("uploaderName",uploaderName);
            o.put("groupKey",groupKey).put("pixivGroupKey",pixivGroupKey).put("identityKeys",new JSONArray(identityKeys)).put("uploaderKeys",new JSONArray(uploaderKeys)).put("visualHash",visualHash).put("visualSamples",visualSamples).put("imageRecords",imageRecords).put("groupMinTime",groupMinTime).put("groupMaxTime",groupMaxTime);
            JSONArray members=new JSONArray();if(includeMembers)for(Post member:groupMembers)members.put(member.toJson(false));
            JSONArray people=new JSONArray(participants.toString());Set<String> peopleTags=new HashSet<>();for(int i=0;i<people.length();i++){JSONObject person=people.optJSONObject(i);if(person!=null)peopleTags.add(person.optString("tag"));}
            List<String> knownArtists=new ArrayList<>(artistTags);if(!artistTag.isBlank())knownArtists.add(artistTag);for(String tag:knownArtists)if(!tag.isBlank()&&peopleTags.add(tag))people.put(new JSONObject().put("tag",tag).put("name",tag.equals(artistTag)?artist:tag.replace('_',' ')).put("role",participantRole(tag,"")));
            o.put("groupMembers",members).put("groupingVersion",groupingVersion).put("groupCount",Math.max(1,media.size()))
                .put("participants",people).put("relatedQuery",relatedQuery).put("visualPHash",visualPHash)
                .put("visualAspectRatio",visualAspectRatio).put("popularityCount",popularityCount==null?JSONObject.NULL:popularityCount)
                .put("requiresAuthentication",requiresAuthentication).put("accessMessage",accessMessage);
        } catch(JSONException e){throw new IllegalStateException(e);}
        return o;
    }
    public static Post fromJson(JSONObject o){return fromJson(o,true);}
    private static Post fromJson(JSONObject o,boolean includeMembers){
        Post p=new Post();
        p.source=o.optString("source"); p.id=o.optString("id"); p.title=o.optString("title");
        p.artistTag=o.optString("creatorTag",o.optString("artistTag"));p.artist=o.optString("creatorName",p.artistTag.isBlank()?"Автор не указан":p.artistTag.replace('_',' '));
        p.preview=o.optString("thumbnail",o.optString("preview"));
        JSONArray images=o.optJSONArray("images");
        p.image=o.optString("image",images!=null?images.optString(0):"");
        p.original=o.optString("original",p.image);
        p.smallPreview=o.optString("smallPreview",p.preview);p.originalUrl=o.optString("originalUrl");p.uploaderId=o.optString("uploaderId");p.uploaderName=o.optString("uploaderName");
        p.groupKey=o.optString("groupKey");p.pixivGroupKey=o.optString("pixivGroupKey");p.identityKeys=strings(o.optJSONArray("identityKeys"),2000);p.uploaderKeys=strings(o.optJSONArray("uploaderKeys"));p.visualHash=o.optString("visualHash");JSONArray samples=o.optJSONArray("visualSamples"),records=o.optJSONArray("imageRecords");if(samples!=null)p.visualSamples=samples;if(records!=null)p.imageRecords=records;
        p.sourceUrl=o.optString("sourceUrl");p.hash=o.optString("contentHash",o.optString("hash"));
        p.rating=o.optString("rating");p.published=o.optString("published");
        p.groupMinTime=o.optLong("groupMinTime",-1);p.groupMaxTime=o.optLong("groupMaxTime",-1);
        p.width=o.optInt("width");p.height=o.optInt("height");p.score=o.optInt("score");
        if(o.has("popularityCount")){if(!o.isNull("popularityCount"))p.popularityCount=Integer.valueOf(o.optInt("popularityCount"));}else if(o.has("score"))p.popularityCount=Integer.valueOf(p.score);
        p.groupingVersion=o.optInt("groupingVersion");p.groupCount=o.optInt("groupCount");p.relatedQuery=o.optString("relatedQuery");
        p.visualPHash=o.optString("visualPHash");p.visualAspectRatio=o.optDouble("visualAspectRatio",0);
        if(!Double.isFinite(p.visualAspectRatio))p.visualAspectRatio=0;
        p.requiresAuthentication=o.optBoolean("requiresAuthentication");p.accessMessage=o.optString("accessMessage");
        JSONArray people=o.optJSONArray("participants");if(people!=null)for(int i=0;i<Math.min(100,people.length());i++){JSONObject person=people.optJSONObject(i);if(person!=null&&person.optString("tag").length()<=100)p.participants.put(person);}
        JSONArray members=o.optJSONArray("groupMembers");if(includeMembers&&members!=null)for(int i=0;i<Math.min(100,members.length());i++){JSONObject member=members.optJSONObject(i);if(member!=null)p.groupMembers.add(fromJson(member,false));}
        JSONArray tags=o.optJSONArray("tags");
        if(tags!=null)for(int i=0;i<Math.min(tags.length(),1000);i++)p.tags.add(tags.optString(i));
        for(String tag:strings(o.optJSONArray("allTags")))if(!p.tags.contains(tag))p.tags.add(tag);
        p.characterTags=strings(o.optJSONArray("characterTags"));p.copyrightTags=strings(o.optJSONArray("copyrightTags"));p.artistTags=strings(o.optJSONArray("artistTags"));
        if(p.artistTags.isEmpty()&&!p.artistTag.isBlank())p.artistTags.add(p.artistTag);
        p.memberKeys=strings(o.optJSONArray("memberKeys"));p.media=strings(images);
        if(p.media.isEmpty()&&!p.image.isBlank())p.media.add(p.image);
        return p;
    }
    static String participantRole(String tag,String role){String text=tag.toLowerCase(Locale.ROOT).replace('_',' '),qualifier="";int at=text.lastIndexOf('(');if(at>=0&&text.endsWith(")"))qualifier=text.substring(at+1,text.length()-1);
        return switch(qualifier){case "voice actor","voice actress"->"voice_actor";case "sound editor","sound designer","sound effects","sfx"->"sound";case "composer","musician","singer","vocalist"->"music";case "writer","scriptwriter"->"writer";case "colorist","colourist"->"colorist";case "editor","video editor"->"editor";case "translator"->"translator";case "animator"->"animator";default->Set.of("artist","animator","voice_actor","sound","music","writer","colorist","editor","translator").contains(role)?role:"artist";};}
    private static List<String> strings(JSONArray a){return strings(a,1000);}
    private static List<String> strings(JSONArray a,int limit){List<String> out=new ArrayList<>();if(a!=null)for(int i=0;i<Math.min(a.length(),limit);i++){String s=a.optString(i);if(!s.isBlank())out.add(s);}return out;}
}
