package com.artcatalog.mobile;

import org.json.*;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;

public class ProfileTransferSafetyTest {
    private JSONObject local() throws Exception {return new JSONObject("{likes:[],bookmarks:[],history:[],follows:[],viewedIdentities:[],favoriteTags:[],recommendationTags:{},preferences:{}} ");}
    private JSONObject portable() throws Exception {return new JSONObject("{format:'dart-profile',version:1,likes:[],bookmarks:[],history:[],follows:[],viewedIdentities:[],favoriteTags:[],recommendationTags:{},preferences:{}} ");}
    private JSONObject post(String source,int id) throws Exception {return new JSONObject().put("source",source).put("id",String.valueOf(id)).put("tags",new JSONArray()).put("images",new JSONArray());}
    private void reject(JSONObject profile){try{ProfileTransfer.parse(profile.toString());fail("Malformed full document was accepted");}catch(IllegalArgumentException expected){}}

    @Test public void bridgeConsolidatesAllExistingAliasesAndKeepsLocalMetadata() throws Exception {
        JSONObject current=local();current.getJSONArray("likes").put(post("danbooru",1).put("title","Local title").put("tags",new JSONArray().put("landscape"))).put(post("gelbooru",2).put("title","Other copy").put("tags",new JSONArray().put("sky")));
        JSONObject incoming=portable();incoming.getJSONArray("likes").put(post("rule34",3).put("title","Remote title").put("memberKeys",new JSONArray().put("danbooru:1").put("gelbooru:2").put("rule34:3")));
        ProfileTransfer.Merge merged=ProfileTransfer.merge(current,ProfileTransfer.parse(incoming.toString()),false);
        assertEquals(1,merged.mobile.getJSONArray("likes").length());JSONObject work=merged.mobile.getJSONArray("likes").getJSONObject(0);
        assertEquals("Local title",work.getString("title"));assertEquals(3,work.getJSONArray("memberKeys").length());assertEquals(2,work.getJSONArray("tags").length());assertEquals(0,merged.added.getInt("likes"));assertEquals(1,merged.skipped.getInt("likes"));
        ProfileTransfer.Merge repeated=ProfileTransfer.merge(merged.mobile,ProfileTransfer.parse(incoming.toString()),false);assertEquals(1,repeated.mobile.getJSONArray("likes").length());assertEquals(0,repeated.added.getInt("likes"));assertFalse(repeated.changed);
    }
    @Test public void aliasesRemainTransitiveRegardlessOfIncomingOrder() throws Exception {
        JSONObject current=local();current.getJSONArray("likes").put(post("danbooru",1));JSONObject incoming=portable();
        incoming.getJSONArray("likes").put(post("rule34",3).put("memberKeys",new JSONArray().put("gelbooru:2"))).put(post("gelbooru",2).put("memberKeys",new JSONArray().put("danbooru:1")));
        ProfileTransfer.Merge merged=ProfileTransfer.merge(current,ProfileTransfer.parse(incoming.toString()),false);assertEquals(1,merged.mobile.getJSONArray("likes").length());assertEquals(3,merged.mobile.getJSONArray("likes").getJSONObject(0).getJSONArray("memberKeys").length());assertEquals(0,merged.added.getInt("likes"));
    }
    @Test public void unrelatedPublicationsWithSameWeakParentRemainSeparate() throws Exception {
        JSONObject current=local();current.getJSONArray("likes").put(post("rule34",1).put("groupKey","rule34:parent:10").put("originalUrl","https://x.com/example/status/11111"));
        JSONObject incoming=portable();incoming.getJSONArray("likes").put(post("rule34",2).put("groupKey","rule34:parent:10").put("originalUrl","https://x.com/example/status/22222"));
        assertEquals(2,ProfileTransfer.merge(current,ProfileTransfer.parse(incoming.toString()),false).mobile.getJSONArray("likes").length());
    }
    @Test(timeout=20000) public void severalThousandAliasesMergeWithoutPairwiseGrouping() throws Exception {
        JSONObject current=local(),incoming=portable();int count=3000;
        for(int i=1;i<=count;i++){current.getJSONArray("likes").put(post("danbooru",i));incoming.getJSONArray("likes").put(post("gelbooru",count+i).put("memberKeys",new JSONArray().put("danbooru:"+i)));}
        ProfileTransfer.Merge merged=ProfileTransfer.merge(current,ProfileTransfer.parse(incoming.toString()),false);assertEquals(count,merged.mobile.getJSONArray("likes").length());assertEquals(0,merged.added.getInt("likes"));
    }
    @Test public void acceptsEveryDesktopStableViewedIdentityNamespace() throws Exception {
        JSONObject profile=portable();profile.put("viewedIdentities",new JSONArray().put("original:x-status:12345").put("original:discord-attachment:12345:67890").put("group:pixiv:12345").put("group:rule34:parent:99").put("group:media:"+"a".repeat(64)).put("hash:"+"b".repeat(32)).put("key:danbooru:1"));
        assertEquals(7,ProfileTransfer.parse(profile.toString()).getJSONArray("viewedIdentities").length());profile.getJSONArray("viewedIdentities").put("group:arbitrary");reject(profile);
    }
    @Test public void malformedNestedMetadataRejectsTheEntireDocument() throws Exception {
        for(String malformed:List.of("{imageRecords:[7]}","{imageRecords:[{url:5}]}","{participants:['wrong']}","{participants:[{tag:7}]}","{width:'900'}","{width:1.5}","{identityKeys:['untrusted:anything']}","{groupMembers:[{source:'danbooru',id:'2',groupMembers:[{source:'danbooru',id:'3'}]}]}")){
            JSONObject profile=portable();profile.getJSONArray("likes").put(post("danbooru",1));JSONObject bad=post("danbooru",2),fields=new JSONObject(malformed);for(Iterator<String> keys=fields.keys();keys.hasNext();){String key=keys.next();bad.put(key,fields.get(key));}profile.getJSONArray("likes").put(bad);reject(profile);
        }
    }
    @Test public void groupedMemberWithEmptyChildListRoundTrips() throws Exception {
        JSONObject current=local();JSONObject member=post("danbooru",1).put("groupMembers",new JSONArray());current.getJSONArray("likes").put(post("danbooru",1).put("groupingVersion",2).put("memberKeys",new JSONArray().put("danbooru:1")).put("groupMembers",new JSONArray().put(member)));
        JSONObject output=ProfileTransfer.parse(ProfileTransfer.export(current).toString());assertEquals(1,output.getJSONArray("likes").getJSONObject(0).getJSONArray("groupMembers").length());
    }
    @Test public void nativeFollowSeenStateExtendsPreviouslyImportedRatingState() throws Exception {
        JSONObject current=local();current.getJSONArray("follows").put(new JSONObject("{key:'artist:sample_artist',tag:'sample_artist',source:'',seen:['danbooru:1','rule34:2'],seenKeys:{all:['danbooru:1']}}"));
        JSONObject exported=ProfileTransfer.export(current),seen=exported.getJSONArray("follows").getJSONObject(0).getJSONObject("seenKeys");
        for(String rating:List.of("general","explicit","all"))assertEquals(2,seen.getJSONArray(rating).length());assertEquals(1,ProfileTransfer.parse(exported.toString()).getJSONArray("follows").length());
    }
    @Test public void exportScrubsEveryCredentialAndSignedUrlForm() throws Exception {
        List<String> urls=List.of("https://name:secret@cdn.donmai.us/image.jpg","https://cdn.donmai.us/image.jpg?api%5fkey=secret","https://cdn.donmai.us/image.jpg?X-Amz-Signature=secret","https://cdn.donmai.us/image.jpg?sig=secret","https://cdn.donmai.us/image.jpg?password=secret","https://v.sankakucomplex.com/image.jpg?e=123&m=secret","https://127.0.0.1/image.jpg","http://cdn.donmai.us/image.jpg");
        for(String url:urls){JSONObject current=local();current.getJSONArray("likes").put(post("danbooru",1).put("image",url).put("thumbnail",url).put("images",new JSONArray().put(url)).put("imageRecords",new JSONArray().put(new JSONObject().put("url",url))));JSONObject work=ProfileTransfer.export(current).getJSONArray("likes").getJSONObject(0);assertEquals("",work.getString("image"));assertEquals(0,work.getJSONArray("images").length());assertEquals(0,work.getJSONArray("imageRecords").length());assertFalse(work.toString().contains("secret"));}
        JSONObject current=local();current.getJSONArray("likes").put(post("danbooru",1).put("images",new JSONArray().put("https://cdn.donmai.us/image.jpg#page")));assertEquals("https://cdn.donmai.us/image.jpg",ProfileTransfer.export(current).getJSONArray("likes").getJSONObject(0).getJSONArray("images").getString(0));
    }
    @Test public void canonicalRecommendationPreferenceKeepsLocalChoiceUnlessRequested() throws Exception {
        JSONObject current=local();current.getJSONObject("recommendationTags").put("Blue_Sky","priority");JSONObject incoming=portable();incoming.getJSONObject("recommendationTags").put("blue:sky","disabled");JSONObject normalized=ProfileTransfer.parse(incoming.toString());
        assertEquals("priority",ProfileTransfer.merge(current,normalized,false).mobile.getJSONObject("recommendationTags").getString("blue sky"));assertEquals("disabled",ProfileTransfer.merge(current,normalized,true).mobile.getJSONObject("recommendationTags").getString("blue sky"));
    }
    @Test public void portableLimitsSupportOneThousandRecommendationAndExcludedTags() throws Exception {
        JSONObject profile=portable();JSONArray excluded=new JSONArray();for(int i=0;i<1000;i++){profile.getJSONObject("recommendationTags").put("tag_"+i,"priority");excluded.put("tag_"+i);}profile.getJSONObject("preferences").put("excludedTags",excluded);JSONObject normalized=ProfileTransfer.parse(profile.toString());assertEquals(1000,normalized.getJSONObject("recommendationTags").length());assertEquals(1000,normalized.getJSONObject("preferences").getJSONArray("excludedTags").length());
    }
    @Test public void exporterDropsUnsupportedLegacyHashesButKeepsRealIdentities() throws Exception {
        JSONObject current=local();current.put("viewedIdentities",new JSONArray().put("hash:old-fixture").put("key:danbooru:1").put("original:x-status:12345"));current.getJSONArray("likes").put(post("danbooru",1).put("identityKeys",new JSONArray().put("hash:old-fixture").put("key:danbooru:1")));
        JSONObject output=ProfileTransfer.parse(ProfileTransfer.export(current).toString());assertEquals(2,output.getJSONArray("viewedIdentities").length());assertEquals(1,output.getJSONArray("likes").getJSONObject(0).getJSONArray("identityKeys").length());
    }
    @Test public void unknownFormatsStringVersionsAndExcessiveDepthAreRejected() throws Exception {
        JSONObject profile=portable();profile.put("format","other");reject(profile);profile=portable();profile.put("version","1");reject(profile);
        String deeplyNested="[".repeat(80)+"0"+"]".repeat(80);try{ProfileTransfer.parse(deeplyNested);fail("Depth was not bounded before parsing");}catch(IllegalArgumentException expected){}
    }
    @Test public void metadataUpdatesCountAsChangesEvenWithoutNewLikes() throws Exception {
        JSONObject current=local();current.getJSONArray("likes").put(post("danbooru",1).put("tags",new JSONArray().put("sky")));JSONObject incoming=portable();incoming.getJSONArray("likes").put(post("danbooru",1).put("tags",new JSONArray().put("landscape")));
        ProfileTransfer.Merge merged=ProfileTransfer.merge(current,ProfileTransfer.parse(incoming.toString()),false);assertEquals(0,merged.added.getInt("likes"));assertTrue(merged.changed);assertEquals(2,merged.mobile.getJSONArray("likes").getJSONObject(0).getJSONArray("tags").length());assertFalse(ProfileTransfer.merge(merged.mobile,ProfileTransfer.parse(incoming.toString()),false).changed);
    }
    @Test public void identicalStandaloneImportDoesNotInventGroupingMetadata() throws Exception {
        JSONObject current=local(),incoming=portable();incoming.getJSONArray("likes").put(post("danbooru",1));
        ProfileTransfer.Merge first=ProfileTransfer.merge(current,ProfileTransfer.parse(incoming.toString()),false);assertFalse(ProfileTransfer.merge(first.mobile,ProfileTransfer.parse(incoming.toString()),false).changed);
    }
    @Test public void partialCurationAndExcludedTagsMergeAdditivelyAndRemainIdempotent() throws Exception {
        JSONObject current=local();current.getJSONObject("preferences").put("curation",new JSONObject("{enabled:true,popularity:false,personal:true}")).put("excludedTags","cloud");
        JSONObject incoming=portable();incoming.getJSONObject("preferences").put("curation",new JSONObject("{resolution:false}")).put("excludedTags",new JSONArray().put("blue_sky").put("CLOUD"));
        JSONObject normalized=ProfileTransfer.parse(incoming.toString());ProfileTransfer.Merge first=ProfileTransfer.merge(current,normalized,true);JSONObject settings=first.mobile.getJSONObject("preferences"),curation=settings.getJSONObject("curation");
        assertTrue(curation.getBoolean("enabled"));assertFalse(curation.getBoolean("popularity"));assertTrue(curation.getBoolean("personal"));assertFalse(curation.getBoolean("resolution"));assertEquals("cloud, blue_sky",settings.getString("excludedTags"));
        assertFalse(ProfileTransfer.merge(first.mobile,normalized,true).changed);
    }
    @Test public void portableHistoryIsNewestFirstAndNativeHistoryRemainsOldestFirst() throws Exception {
        JSONObject current=local();current.put("format","artcatalog-mobile").put("version",2);current.getJSONArray("history").put(post("danbooru",1)).put(post("danbooru",2)).put(post("danbooru",3));current.getJSONArray("likes").put(post("gelbooru",4)).put(post("gelbooru",5));
        JSONObject exported=ProfileTransfer.export(current);JSONArray history=exported.getJSONArray("history");assertEquals("3",history.getJSONObject(0).getString("id"));assertEquals("2",history.getJSONObject(1).getString("id"));assertEquals("1",history.getJSONObject(2).getString("id"));assertEquals("4",exported.getJSONArray("likes").getJSONObject(0).getString("id"));
        JSONObject normalized=ProfileTransfer.parse(exported.toString());assertEquals("3",normalized.getJSONArray("history").getJSONObject(0).getString("id"));
        ProfileTransfer.Merge merged=ProfileTransfer.merge(local(),normalized,false);JSONArray nativeHistory=merged.mobile.getJSONArray("history");assertEquals("1",nativeHistory.getJSONObject(0).getString("id"));assertEquals("2",nativeHistory.getJSONObject(1).getString("id"));assertEquals("3",nativeHistory.getJSONObject(2).getString("id"));
        JSONArray roundTrip=ProfileTransfer.export(merged.mobile).getJSONArray("history");assertEquals("3",roundTrip.getJSONObject(0).getString("id"));assertEquals("1",roundTrip.getJSONObject(2).getString("id"));assertFalse(ProfileTransfer.merge(merged.mobile,normalized,false).changed);
    }
}
