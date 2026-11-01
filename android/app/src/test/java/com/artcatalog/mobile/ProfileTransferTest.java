package com.artcatalog.mobile;

import org.json.*;
import org.junit.Test;
import java.nio.file.*;
import static org.junit.Assert.*;

public class ProfileTransferTest {
    private JSONObject local() throws Exception{return new JSONObject("{bookmarks:[],likes:[],history:[],follows:[],preferences:{aiMode:'all'},recommendationTags:{},viewedIdentities:[]}");}
    private JSONObject profile() throws Exception{return new JSONObject("{format:'dart-profile',version:1,likes:[{key:'danbooru:1',source:'danbooru',id:'1',tags:['landscape'],images:[]}],bookmarks:[],history:[],viewedIdentities:['key:danbooru:2'],follows:[{role:'artist',source:'artist',artistId:'sample_artist',name:'Sample Artist',seenKeys:{all:['danbooru:1']}}],preferences:{aiMode:'generated',hideFollowedArtists:true},recommendationTags:{landscape:'priority'},favoriteTags:['landscape']}");}
    @Test public void addsLikesFollowsViewedWithoutTurningLikesIntoBookmarks() throws Exception{
        ProfileTransfer.Merge merged=ProfileTransfer.merge(local(),ProfileTransfer.parse(profile().toString()),false);
        assertEquals(1,merged.mobile.getJSONArray("likes").length());assertEquals(0,merged.mobile.getJSONArray("bookmarks").length());
        assertEquals("artist:sample_artist",merged.mobile.getJSONArray("follows").getJSONObject(0).getString("key"));
        assertEquals("key:danbooru:2",merged.mobile.getJSONArray("viewedIdentities").getString(0));
        assertEquals("all",merged.mobile.getJSONObject("preferences").getString("aiMode"));
        assertEquals(1,merged.added.getInt("likes"));
    }
    @Test public void repeatedImportAndCatalogAliasesAreIdempotent() throws Exception{
        JSONObject current=local();current.getJSONArray("likes").put(new JSONObject("{source:'gelbooru',id:'3',memberKeys:['gelbooru:3','danbooru:1'],tags:[],images:[]}"));
        ProfileTransfer.Merge first=ProfileTransfer.merge(current,ProfileTransfer.parse(profile().toString()),false);
        ProfileTransfer.Merge second=ProfileTransfer.merge(first.mobile,ProfileTransfer.parse(profile().toString()),false);
        assertEquals(1,second.mobile.getJSONArray("likes").length());assertEquals(0,first.added.getInt("likes"));assertEquals(0,second.added.getInt("follows"));assertEquals(0,second.added.getInt("viewedIdentities"));
    }
    @Test public void appliesSettingsOnlyWhenExplicitlySelected() throws Exception{
        ProfileTransfer.Merge merged=ProfileTransfer.merge(local(),ProfileTransfer.parse(profile().toString()),true);
        assertEquals("generated",merged.mobile.getJSONObject("preferences").getString("aiMode"));
        assertTrue(merged.mobile.getJSONObject("preferences").getBoolean("hideFollowedArtists"));
    }
    @Test public void exporterExcludesCredentialsDeviceStateAndCaches() throws Exception{
        JSONObject current=local();current.put("apiKey","secret").put("openWorks",new JSONArray()).put("catalogueCache",new JSONArray());
        current.getJSONObject("preferences").put("secureCapture",true).put("rule34.key","secret");
        JSONObject exported=ProfileTransfer.export(current);
        assertEquals("dart-profile",exported.getString("format"));assertFalse(exported.toString().contains("secret"));assertFalse(exported.has("openWorks"));assertFalse(exported.getJSONObject("preferences").has("secureCapture"));
    }
    @Test public void rejectInvalidWholeDocumentBeforeMutation() throws Exception{
        JSONObject current=local(),bad=profile();String original=current.toString();bad.getJSONArray("likes").put(new JSONObject("{source:'other',id:'9'}"));
        try{ProfileTransfer.parse(bad.toString());fail("invalid source accepted");}catch(IllegalArgumentException expected){}
        assertEquals(original,current.toString());bad=profile();bad.put("version",99);
        try{ProfileTransfer.parse(bad.toString());fail("newer version accepted");}catch(IllegalArgumentException expected){}
    }
    @Test public void recognizesLegacyPhoneProfileAndKeepsSeparateLikes() throws Exception{
        JSONObject legacy=local();legacy.put("format","artcatalog-mobile").put("version",2);
        legacy.getJSONArray("bookmarks").put(new JSONObject("{source:'rule34',id:'4',images:[],tags:[]}"));
        JSONObject normalized=ProfileTransfer.parse(legacy.toString());assertEquals(1,normalized.getJSONArray("bookmarks").length());assertEquals(0,normalized.getJSONArray("likes").length());
    }
    @Test public void roundTripPreservesUploaderRoleAndGroupedMetadata() throws Exception{
        JSONObject input=profile();input.getJSONArray("follows").put(new JSONObject("{role:'uploader',source:'rule34',artistId:'22',name:'Uploader',seenKeys:{all:['rule34:10']}}"));
        input.getJSONArray("likes").getJSONObject(0).put("memberKeys",new JSONArray().put("danbooru:1").put("sankaku:alias1")).put("popularityCount",42);
        JSONObject output=ProfileTransfer.export(ProfileTransfer.merge(local(),ProfileTransfer.parse(input.toString()),false).mobile);
        assertEquals("uploader",output.getJSONArray("follows").getJSONObject(1).getString("role"));
        assertEquals(42,output.getJSONArray("likes").getJSONObject(0).getInt("popularityCount"));
        assertEquals(2,output.getJSONArray("likes").getJSONObject(0).getJSONArray("memberKeys").length());
    }
    @Test public void privateMediaQueryCannotLeakThroughExport() throws Exception{
        JSONObject current=local();current.getJSONArray("likes").put(new JSONObject("{source:'rule34',id:'4',image:'https://example.com/a.jpg?api_key=secret',images:['https://example.com/a.jpg?api_key=secret'],tags:[]}"));
        assertFalse(ProfileTransfer.export(current).toString().contains("secret"));
    }
}
