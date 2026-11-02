package com.artcatalog.mobile;

import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;

public class CurationTasteTest {
    private static final class Tags extends ArrayList<String> {int reads;@Override public Iterator<String> iterator(){reads++;return super.iterator();}}
    private static Post work(int id,String artist,String... tags){Post p=new Post();p.source="danbooru";p.id=""+id;p.artistTag=artist;p.tags=new ArrayList<>(List.of(tags));p.rating="g";return p;}
    @Test public void capturedTasteMatchesExistingFactorsWithoutReadingLikesOnEachPage(){List<Post> likes=new ArrayList<>();List<Tags> observed=new ArrayList<>();for(int i=0;i<128;i++){Post p=work(i+1,"artist_"+i,"landscape","forest","watercolor");Tags tags=new Tags();tags.addAll(p.tags);p.tags=tags;likes.add(p);observed.add(tags);}List<Post> page=List.of(work(1001,"new_a","forest","watercolor"),work(1002,"new_b","landscape"));Map<String,Boolean> prefs=Map.of("enabled",true);Map<String,String> choices=Map.of("watercolor","priority");long now=1700000000000L;Map<String,Double> expected=Curation.boosts(page,prefs,likes,choices,null,now);List<Post> order=Curation.rank(page,prefs,likes,choices,now);Curation.Taste taste=Curation.prepare(likes);for(Tags tags:observed)tags.reads=0;assertEquals(expected,Curation.boosts(page,prefs,taste,choices,now));assertEquals(order,Curation.rank(page,prefs,taste,choices,now));assertEquals(0,observed.stream().mapToInt(tags->tags.reads).sum());}
    @Test public void visitTasteIsImmutableAndEmptyOrDisabledFactorsRemainNeutral(){Post liked=work(1,"artist_a","landscape","forest");List<Post> page=List.of(work(2,"artist_b","forest"),work(3,"artist_c","clouds"));Curation.Taste snapshot=Curation.prepare(List.of(liked));Map<String,Boolean> enabled=Map.of("enabled",true,"popularity",false,"freshness",false,"resolution",false);Map<String,Double> before=Curation.boosts(page,enabled,snapshot,Map.of(),0);liked.tags.clear();liked.tags.add("clouds");assertEquals(before,Curation.boosts(page,enabled,snapshot,Map.of(),0));assertSame(page,Curation.rank(page,Map.of(),snapshot,Map.of(),0));assertEquals(Map.of(page.get(0).key(),1.,page.get(1).key(),1.),Curation.boosts(page,enabled,Curation.prepare(List.of()),Map.of(),0));}
}
