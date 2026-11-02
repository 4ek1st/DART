package com.artcatalog.mobile;

import org.json.*;
import org.junit.Test;
import java.lang.reflect.*;
import java.util.*;
import static org.junit.Assert.*;

public class PostCopyTest {
    private static Post copy(Post post) throws Exception {
        Method method;
        try { method=Post.class.getDeclaredMethod("copy"); }
        catch(NoSuchMethodException missing) { fail("Post.copy must avoid the grouping JSON round trip");return null; }
        method.setAccessible(true);
        try { return (Post)method.invoke(post); }
        catch(InvocationTargetException failure) { if(failure.getCause() instanceof RuntimeException)throw (RuntimeException)failure.getCause();throw failure; }
    }
    private static Post fixture(int index) throws Exception {
        Post p=new Post();for(Field field:Post.class.getFields())if(field.getType()==String.class)field.set(p,field.getName()+"_"+index);
        p.source="danbooru";p.id=String.valueOf(index);p.artist="Neutral artist";p.artistTag="qa_artist";p.rating="g";
        p.width=1800;p.height=2400;p.score=-7;p.groupingVersion=2;p.groupCount=99;p.popularityCount=12;
        p.groupMinTime=11;p.groupMaxTime=22;p.visualAspectRatio=.75;p.requiresAuthentication=true;
        p.tags=new ArrayList<>(List.of("qa_content","","qa_other"));p.characterTags=new ArrayList<>(List.of("qa_character",""));p.copyrightTags=new ArrayList<>(List.of("qa_series"));
        p.artistTags=new ArrayList<>(List.of("qa_artist","qa_animator_(animator)"));p.memberKeys=new ArrayList<>(List.of("danbooru:"+index));
        p.media=new ArrayList<>(List.of("https://cdn.donmai.us/qa/"+index+".jpg"));p.identityKeys=new ArrayList<>(List.of("hash:qa"));p.uploaderKeys=new ArrayList<>(List.of("danbooru:qa"));
        p.participants.put(new JSONObject().put("tag","qa_artist").put("name","Neutral artist").put("role","artist").put("extra",new JSONObject().put("values",new JSONArray().put(1).put(true).put(JSONObject.NULL))));
        p.visualSamples.put(new JSONObject().put("hash","0000000000000000").put("tags",new JSONArray().put("qa_content")));
        p.imageRecords.put(new JSONObject().put("url",p.media.get(0)).put("hash",p.hash).put("owner",p.key()));return p;
    }
    private static void equivalent(Post input,Post actual) {
        JSONObject expected=Post.fromJson(input.toJson()).toJson();assertTrue("copy differs from existing round-trip value",equalJson(expected,actual.toJson()));
    }
    private static boolean equalJson(Object a,Object b){
        if(a instanceof JSONObject&&b instanceof JSONObject){JSONObject first=(JSONObject)a,second=(JSONObject)b;if(first.length()!=second.length())return false;Iterator<String> keys=first.keys();while(keys.hasNext()){String key=keys.next();if(!second.has(key)||!equalJson(first.opt(key),second.opt(key)))return false;}return true;}
        if(a instanceof JSONArray&&b instanceof JSONArray){JSONArray first=(JSONArray)a,second=(JSONArray)b;if(first.length()!=second.length())return false;for(int i=0;i<first.length();i++)if(!equalJson(first.opt(i),second.opt(i)))return false;return true;}
        if(a instanceof Number&&b instanceof Number)return Double.compare(((Number)a).doubleValue(),((Number)b).doubleValue())==0;return Objects.equals(a,b);
    }
    @Test public void copiesEverySerializedFieldAndSynthesizesParticipants() throws Exception {
        Post p=fixture(1);p.groupMembers.add(fixture(2));p.groupMembers.get(0).groupMembers.add(fixture(3));Post result=copy(p);equivalent(p,result);
        assertEquals(1,result.groupMembers.size());assertTrue(result.groupMembers.get(0).groupMembers.isEmpty());assertEquals(2,result.participants.length());
        assertEquals("animator",result.participants.getJSONObject(1).getString("role"));assertEquals(1,result.groupCount);
    }
    @Test public void preservesBlankFilteringLimitsFallbacksAndNullablePopularity() throws Exception {
        Post p=fixture(4);p.popularityCount=null;p.artistTags.clear();p.media=List.of(" ","");p.tags=new ArrayList<>();p.identityKeys=new ArrayList<>();
        p.memberKeys=new ArrayList<>();for(int i=0;i<2100;i++){p.tags.add("tag_"+i);p.identityKeys.add("identity_"+i);p.memberKeys.add("member_"+i);}Post result=copy(p);equivalent(p,result);
        assertNull(result.popularityCount);assertEquals(1000,result.tags.size());assertEquals(2000,result.identityKeys.size());assertEquals(1000,result.memberKeys.size());assertEquals(List.of(p.image),result.media);assertEquals(List.of(p.artistTag),result.artistTags);
    }
    @Test public void participantSlotLimitsMatchRoundTripBeforeInvalidEntriesAreRemoved() throws Exception {
        Post p=fixture(5);p.participants=new JSONArray().put("ignored").put(new JSONObject().put("tag","x".repeat(101)));for(int i=2;i<102;i++)p.participants.put(new JSONObject().put("tag","qa_person_"+i));
        for(int i=0;i<102;i++)p.groupMembers.add(fixture(100+i));Post result=copy(p);equivalent(p,result);assertEquals(98,result.participants.length());assertEquals(100,result.groupMembers.size());
    }
    @Test public void copiedMutableContainersCannotModifySavedArtwork() throws Exception {
        Post p=fixture(6);p.groupMembers.add(fixture(7));Post result=copy(p);result.tags.set(0,"changed");result.artistTags.add("changed");result.memberKeys.clear();result.media.clear();result.identityKeys.clear();result.uploaderKeys.clear();
        result.participants.getJSONObject(0).getJSONObject("extra").getJSONArray("values").put(0,99);result.visualSamples.getJSONObject(0).getJSONArray("tags").put(0,"changed");result.imageRecords.getJSONObject(0).put("url","changed");result.groupMembers.get(0).tags.clear();
        assertEquals("qa_content",p.tags.get(0));assertEquals(2,p.artistTags.size());assertEquals(1,p.memberKeys.size());assertEquals(1,p.media.size());assertEquals(1,p.identityKeys.size());assertEquals(1,p.uploaderKeys.size());
        assertEquals(1,p.participants.getJSONObject(0).getJSONObject("extra").getJSONArray("values").getInt(0));assertEquals("qa_content",p.visualSamples.getJSONObject(0).getJSONArray("tags").getString(0));assertTrue(p.imageRecords.getJSONObject(0).getString("url").startsWith("https://"));assertFalse(p.groupMembers.get(0).tags.isEmpty());
    }
    @Test public void neutralSchemaCombinationsRetainRoundTripValues() throws Exception {
        Random random=new Random(736420);for(int i=1;i<=100;i++){Post p=fixture(i);if(random.nextBoolean())p.participants=new JSONArray();if(random.nextBoolean())p.artistTags=List.of();if(random.nextBoolean())p.artistTag="";if(random.nextBoolean())p.media=List.of();if(random.nextBoolean())p.popularityCount=null;if(random.nextBoolean())p.groupMembers=List.of(fixture(1000+i));equivalent(p,copy(p));}
    }
}
