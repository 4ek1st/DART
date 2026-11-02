package com.artcatalog.mobile;

import org.json.*;
import org.junit.Test;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.junit.Assert.*;

public class DesktopConformanceTest {
    private static List<Post> posts(JSONArray a) throws JSONException {List<Post> out=new ArrayList<>();if(a!=null)for(int i=0;i<a.length();i++)out.add(Post.fromJson(a.getJSONObject(i)));return out;}
    private static List<String> strings(JSONArray a) throws JSONException {List<String> out=new ArrayList<>();for(int i=0;i<a.length();i++)out.add(a.getString(i));return out;}
    private static List<String> fields(JSONObject o){List<String> out=new ArrayList<>();for(Iterator<String> it=o.keys();it.hasNext();)out.add(it.next());return out;}
    private JSONObject fixtures() throws Exception {try(InputStream stream=getClass().getResourceAsStream("/desktop-recommendations-parity.json")){assertNotNull(stream);return new JSONObject(new String(stream.readAllBytes(),StandardCharsets.UTF_8));}}
    @Test public void nativeRecommendationsMatchCanonicalDesktopFixtures() throws Exception {
        String json;try(InputStream stream=getClass().getResourceAsStream("/desktop-recommendations-parity.json")){assertNotNull(stream);json=new String(stream.readAllBytes(),StandardCharsets.UTF_8);}
        JSONObject root=new JSONObject(json);assertEquals("3b08c871fb13a3a66225e2fcb4eb29253864a296cb0b8dd274c63f30318f1a27",root.getString("desktopSha256"));
        JSONArray cases=root.getJSONArray("cases");for(int i=0;i<cases.length();i++){JSONObject c=cases.getJSONObject(i),prefs=c.getJSONObject("preferences"),context=c.getJSONObject("context");Map<String,String> choices=new LinkedHashMap<>();for(String key:fields(prefs))choices.put(key,prefs.getString(key));
            Recommendations.Model model=Recommendations.build(posts(c.getJSONArray("liked")),choices,c.getInt("seed"),posts(context.optJSONArray("background")));
            JSONObject groups=c.getJSONObject("queries");for(String key:fields(groups))assertEquals(c.getString("name")+" query "+key,strings(groups.getJSONArray(key)),model.queryGroups.get(key));
            Set<String> recent=new LinkedHashSet<>();JSONArray keys=context.optJSONArray("recentKeys");if(keys!=null)recent.addAll(strings(keys));
            List<Post> ranked=model.rank(posts(c.getJSONArray("candidates")),posts(context.optJSONArray("existingWorks")),recent,c.getString("rating"),Map.of(),0);
            List<String> actual=new ArrayList<>();for(Post post:ranked)actual.add(post.key());assertEquals(c.getString("name"),strings(c.getJSONArray("expected")),actual);
        }
    }
    @Test public void nativeGroupingMatchesDesktopSafetyAndMediaFixtures() throws Exception {
        JSONArray cases=fixtures().getJSONArray("groupingCases");for(int i=0;i<cases.length();i++){JSONObject c=cases.getJSONObject(i);List<Post> groups=CatalogLogic.merge(List.of(),posts(c.getJSONArray("items")));JSONArray expected=c.getJSONArray("expected");assertEquals(c.getString("name"),expected.length(),groups.size());
            for(int j=0;j<expected.length();j++){JSONObject e=expected.getJSONObject(j);List<String> keys=new ArrayList<>(groups.get(j).memberKeys);Collections.sort(keys);assertEquals(c.getString("name")+" aliases",strings(e.getJSONArray("keys")),keys);assertEquals(c.getString("name")+" gallery",strings(e.getJSONArray("images")),groups.get(j).media);}}
    }
    @Test public void nativeCurationMatchesDesktopSourceRelativeFactors() throws Exception {
        JSONArray cases=fixtures().getJSONArray("curationCases");for(int i=0;i<cases.length();i++){JSONObject c=cases.getJSONObject(i),raw=c.getJSONObject("preferences"),tags=c.getJSONObject("tagPreferences");Map<String,Boolean> prefs=new LinkedHashMap<>();for(String key:fields(raw))prefs.put(key,raw.getBoolean(key));Map<String,String> choices=new LinkedHashMap<>();for(String key:fields(tags))choices.put(key,tags.getString(key));
            List<Post> items=posts(c.getJSONArray("items")),liked=posts(c.getJSONArray("liked"));long now=c.getLong("now");Map<String,Double> boosts=Curation.boosts(items,prefs,liked,choices,null,now);JSONObject expected=c.getJSONObject("boosts");for(String key:fields(expected))assertEquals(key,expected.getDouble(key),boosts.get(key),1e-10);
            List<String> actual=new ArrayList<>();for(Post p:CatalogLogic.rankCuratedWorks(items,prefs,liked,choices,now))actual.add(p.key());assertEquals(strings(c.getJSONArray("expected")),actual);}
    }
    @Test public void nativeDctFingerprintMatchesDesktopAcrossNeutralImages() throws Exception {
        JSONArray cases=fixtures().getJSONArray("perceptualHashes");for(int i=0;i<cases.length();i++){JSONObject c=cases.getJSONObject(i);int seed=c.getInt("seed");int[] pixels=new int[1024];for(int y=0;y<32;y++)for(int x=0;x<32;x++)pixels[y*32+x]=0xff000000|((x*7+seed*11)%256)<<16|((y*9+seed*17)%256)<<8|((x+y)*5+seed*19)%256;
            assertEquals("seed "+seed,c.getString("expected"),CatalogLogic.perceptualImageHash(pixels));}
        assertEquals("",CatalogLogic.perceptualImageHash(new int[0]));
    }
}
