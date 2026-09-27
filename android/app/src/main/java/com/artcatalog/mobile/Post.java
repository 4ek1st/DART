package com.artcatalog.mobile;

import org.json.*;
import java.util.*;

public final class Post {
    public String source="", id="", title="", artist="", artistTag="", preview="",
        image="", original="", sourceUrl="", hash="", rating="", published="",smallPreview="",
        originalUrl="",uploaderId="",uploaderName="",groupKey="",pixivGroupKey="",visualHash="";
    public int width, height, score;
    public long groupMinTime=-1,groupMaxTime=-1;
    public List<String> tags=new ArrayList<>();
    public List<String> characterTags=new ArrayList<>(),artistTags=new ArrayList<>(),memberKeys=new ArrayList<>(),media=new ArrayList<>();
    public List<String> identityKeys=new ArrayList<>();public JSONArray visualSamples=new JSONArray(),imageRecords=new JSONArray();
    public String key(){return source+":"+id;}
    public boolean isVideo(){return image.toLowerCase(Locale.ROOT).matches(".*\\.(mp4|webm|m4v)(\\?.*)?$");}
    public JSONObject toJson() {
        JSONObject o=new JSONObject();
        try {
            o.put("source",source).put("id",id).put("title",title).put("artist",artist).put("creatorName",artist)
                .put("creatorTag",artistTag).put("thumbnail",preview).put("image",image)
                .put("original",original).put("sourceUrl",sourceUrl).put("contentHash",hash)
                .put("rating",rating).put("published",published).put("width",width)
                .put("height",height).put("score",score).put("tags",new JSONArray(tags))
                .put("characterTags",new JSONArray(characterTags)).put("artistTags",new JSONArray(artistTags))
                .put("memberKeys",new JSONArray(memberKeys)).put("images",new JSONArray(media))
                .put("smallPreview",smallPreview).put("originalUrl",originalUrl).put("uploaderId",uploaderId).put("uploaderName",uploaderName);
            o.put("groupKey",groupKey).put("pixivGroupKey",pixivGroupKey).put("identityKeys",new JSONArray(identityKeys)).put("visualHash",visualHash).put("visualSamples",visualSamples).put("imageRecords",imageRecords).put("groupMinTime",groupMinTime).put("groupMaxTime",groupMaxTime);
        } catch(JSONException e){throw new IllegalStateException(e);}
        return o;
    }
    public static Post fromJson(JSONObject o){
        Post p=new Post();
        p.source=o.optString("source"); p.id=o.optString("id"); p.title=o.optString("title");
        p.artistTag=o.optString("creatorTag",o.optString("artistTag"));p.artist=o.optString("creatorName",p.artistTag.isBlank()?"Автор не указан":p.artistTag.replace('_',' '));
        p.preview=o.optString("thumbnail",o.optString("preview"));
        JSONArray images=o.optJSONArray("images");
        p.image=o.optString("image",images!=null?images.optString(0):"");
        p.original=o.optString("original",p.image);
        p.smallPreview=o.optString("smallPreview",p.preview);p.originalUrl=o.optString("originalUrl");p.uploaderId=o.optString("uploaderId");p.uploaderName=o.optString("uploaderName");
        p.groupKey=o.optString("groupKey");p.pixivGroupKey=o.optString("pixivGroupKey");p.identityKeys=strings(o.optJSONArray("identityKeys"));p.visualHash=o.optString("visualHash");JSONArray samples=o.optJSONArray("visualSamples"),records=o.optJSONArray("imageRecords");if(samples!=null)p.visualSamples=samples;if(records!=null)p.imageRecords=records;
        p.sourceUrl=o.optString("sourceUrl");p.hash=o.optString("contentHash",o.optString("hash"));
        p.rating=o.optString("rating");p.published=o.optString("published");
        p.groupMinTime=o.optLong("groupMinTime",-1);p.groupMaxTime=o.optLong("groupMaxTime",-1);
        p.width=o.optInt("width");p.height=o.optInt("height");p.score=o.optInt("score");
        JSONArray tags=o.optJSONArray("tags");
        if(tags!=null)for(int i=0;i<Math.min(tags.length(),1000);i++)p.tags.add(tags.optString(i));
        for(String tag:strings(o.optJSONArray("allTags")))if(!p.tags.contains(tag))p.tags.add(tag);
        p.characterTags=strings(o.optJSONArray("characterTags"));p.artistTags=strings(o.optJSONArray("artistTags"));
        if(p.artistTags.isEmpty()&&!p.artistTag.isBlank())p.artistTags.add(p.artistTag);
        p.memberKeys=strings(o.optJSONArray("memberKeys"));p.media=strings(images);
        if(p.media.isEmpty()&&!p.image.isBlank())p.media.add(p.image);
        return p;
    }
    private static List<String> strings(JSONArray a){List<String> out=new ArrayList<>();if(a!=null)for(int i=0;i<Math.min(a.length(),1000);i++){String s=a.optString(i);if(!s.isBlank())out.add(s);}return out;}
}
