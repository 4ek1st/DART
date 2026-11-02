package com.artcatalog.mobile;

import org.json.*;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;

public class WorkGroupingSamplesTest {
    private static final class ObservedJson extends JSONObject {int encodings;@Override public String toString(){encodings++;return super.toString();}}
    private static final class ObservedTags extends ArrayList<String> {int reads;@Override public Iterator<String> iterator(){reads++;return super.iterator();}@Override public Object[] toArray(){reads++;return super.toArray();}}
    private Post artwork(){Post p=new Post();p.source="danbooru";p.id="1";p.rating="g";p.artistTag="qa_artist";for(int i=0;i<12;i++)p.tags.add("qa_content_"+i);return p;}
    @Test public void existingVisualEvidenceNeverNeedsJsonEncodingToBePrepared()throws Exception{
        Post p=artwork();ObservedJson evidence=new ObservedJson();evidence.put("hash","0000000000000000").put("creator","qa_artist").put("source","danbooru").put("tags",new JSONArray(p.tags)).put("aspectRatio",1.2);p.visualSamples.put(evidence);
        Post grouped=CatalogLogic.merge(List.of(),List.of(p)).get(0);assertEquals("Visual evidence is already structured JSON",0,evidence.encodings);assertEquals(1,grouped.visualSamples.length());assertEquals("qa artist",grouped.visualSamples.getJSONObject(0).getString("creator"));
    }
    @Test public void ownSampleTagsArePreparedOnceForDecisionsAndGalleryMaterialization(){
        Post p=artwork();ObservedTags tags=new ObservedTags();tags.addAll(p.tags);p.tags=tags;p.visualHash="0000000000000000";p.visualAspectRatio=1.2;
        CatalogLogic.merge(List.of(),List.of(p));assertEquals("One sample preparation and one output-tag union",2,tags.reads);
    }
    @Test public void anotherGroupingCallSeesFreshArtworkMetadata()throws Exception{
        Post p=artwork();p.visualHash="0000000000000000";Post first=CatalogLogic.merge(List.of(),List.of(p)).get(0);p.artistTag="qa_other_artist";p.tags=new ArrayList<>(p.tags);p.tags.set(0,"qa_replaced");
        Post next=CatalogLogic.merge(List.of(),List.of(p)).get(0);assertEquals("qa artist",first.visualSamples.getJSONObject(0).getString("creator"));assertEquals("qa other artist",next.visualSamples.getJSONObject(0).getString("creator"));assertTrue(next.visualSamples.getJSONObject(0).getJSONArray("tags").toString().contains("qa replaced"));
    }
    @Test public void legacyNumericVisualFieldsRetainTheirFormerParsedSpellings()throws Exception{
        Post p=artwork();JSONObject evidence=new JSONObject().put("hash","0000000000000000").put("creator",2.0).put("source",1.0).put("uploader",0.0).put("published",1000.0).put("perceptualHash",1234.0).put("aspectRatio",-0.0).put("tags",new JSONArray(p.tags));p.visualSamples.put(evidence);
        JSONObject oldParsed=new JSONObject(evidence.toString()),sample=CatalogLogic.merge(List.of(),List.of(p)).get(0).visualSamples.getJSONObject(0);
        for(String field:List.of("creator","source","uploader","published","perceptualHash"))assertEquals(oldParsed.optString(field),sample.optString(field));assertEquals(Double.doubleToRawLongBits(oldParsed.optDouble("aspectRatio")),Double.doubleToRawLongBits(sample.optDouble("aspectRatio")));
    }
}
