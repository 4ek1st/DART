package com.artcatalog.mobile;

import org.json.*;
import org.junit.Test;
import java.time.Instant;
import java.util.*;
import static org.junit.Assert.*;

public class FollowingOrderTest {
    private static final long NOW=Instant.parse("2026-11-01T12:00:00Z").toEpochMilli();
    private Post post(String id,String author,long age){Post p=new Post();p.source="danbooru";p.id=id;p.artistTag=author;p.published=Instant.ofEpochMilli(NOW-age).toString();return p;}
    private JSONObject follow() throws Exception{return new JSONObject().put("key","artist:landscape_artist").put("tag","landscape_artist").put("initialized",true).put("seen",new JSONArray());}
    private FollowingOrder.NewSnapshot snapshot(JSONObject f,String rating,Set<String> sources,Set<String> known){return FollowingOrder.snapshot(f,rating,NOW,sources,known);}

    @Test public void lateAuthorsEnterUnseenTailWithoutMovingExposedCards(){
        List<Post> first=new ArrayList<>();for(int i=0;i<24;i++)first.add(post(""+(i+1),"a",10000+i));
        Post b=post("100","b",100),c=post("200","c",200);List<Post> merged=new ArrayList<>(first);merged.add(b);merged.add(c);
        List<Post> ordered=FollowingOrder.arrange(first,merged,2,Set.of());
        assertEquals(List.of(first.get(0),first.get(1),b,c),ordered.subList(0,4));assertEquals(26,ordered.size());
        assertEquals(ordered,FollowingOrder.arrange(ordered,merged,4,Set.of()));
    }
    @Test public void newPrecedesOldOnlyInsideUnexposedTail(){Post old=post("1","a",100),fresh=post("2","b",1000);
        assertEquals(List.of(fresh,old),FollowingOrder.arrange(List.of(),List.of(old,fresh),0,Set.of(fresh.key())));
        assertEquals(List.of(old,fresh),FollowingOrder.arrange(List.of(old),List.of(old,fresh),1,Set.of(fresh.key())));
    }
    @Test public void equalPublicationTiesAlternateAuthorsButOlderWorkNeverLeapfrogs(){
        Post a=post("1","a",10),b=post("2","a",10),c=post("3","b",10),d=post("4","b",10),older=post("5","c",604800000);
        assertEquals(List.of(a,c,b,d,older),FollowingOrder.arrange(List.of(),List.of(a,b,c,d,older),0,Set.of()));
        assertEquals(List.of(a,c,b,d),FollowingOrder.arrange(List.of(a),List.of(a,b,c,d),1,Set.of()));
    }
    @Test public void equalDateTiesGiveEveryAuthorATurnBeforeRepeating(){Post a=post("1","a",10),aa=post("2","a",10),b=post("3","b",10),bb=post("4","b",10),c=post("5","c",10),cc=post("6","c",10);
        assertEquals(List.of(a,b,c,aa,bb,cc),FollowingOrder.arrange(List.of(),List.of(a,aa,b,bb,c,cc),0,Set.of()));
    }
    @Test public void laterMirrorUploadDoesNotBumpAnOldGroupedWork(){Post old=post("1","a",604800000),mirror=post("2","a",10),newer=post("3","b",1000);mirror.source="sankaku";mirror.groupMembers=List.of(old,Post.fromJson(mirror.toJson()));mirror.memberKeys=List.of(old.key(),mirror.key());
        assertEquals(List.of(newer,mirror),FollowingOrder.arrange(List.of(),List.of(mirror,newer),0,Set.of()));
    }
    @Test public void galleryKeepsReachedPrefixAndUsesExactCurrentTail(){Post a=post("1","a",1),b=post("2","b",2),c=post("3","c",3),d=post("4","d",4),stale=post("5","e",5);
        assertEquals(List.of(a,c,d,b),FollowingOrder.gallery(List.of(a,b,stale),List.of(a,b,c,d,stale),List.of(c,d,b),1));
    }
    @Test public void galleryEnrichesReachedAliasAndCannotExposeItAgain(){Post a=post("1","a",1),b=post("2","b",2),alias=post("3","a",1);alias.source="gelbooru";alias.memberKeys=List.of(a.key(),alias.key());
        assertEquals(List.of(alias,b),FollowingOrder.gallery(List.of(a,b),List.of(alias,b),List.of(b,alias),1));
        assertEquals(List.of(alias,b),FollowingOrder.arrange(List.of(a,b),List.of(alias,b,a),1,Set.of()));
    }
    @Test public void collapsedReachedAliasesDoNotFreezeUnseenCardsOnTheNextUpdate(){Post a=post("1","a",1000),alias=post("2","a",1000),unseen=post("3","b",10000),late=post("4","c",10);alias.source="gelbooru";Post group=Post.fromJson(a.toJson());group.memberKeys=List.of(a.key(),alias.key());
        List<Post> previous=List.of(a,alias,unseen),metadata=List.of(group,unseen);int remapped=FollowingOrder.protectedCount(previous,metadata,2);assertEquals(1,remapped);
        List<Post> first=FollowingOrder.arrange(previous,metadata,2,Set.of());assertEquals(List.of(group,unseen),first);assertEquals(List.of(group,late,unseen),FollowingOrder.arrange(first,List.of(group,unseen,late),remapped,Set.of()));
        assertEquals(List.of(group,late,unseen),FollowingOrder.gallery(first,List.of(group,late,unseen),List.of(late,unseen),remapped));
    }
    @Test public void remappedBoundaryRetainsMissingReachedWorksAndIgnoresWeakParents(){Post a=post("1","a",1),b=post("2","b",1);a.groupKey=b.groupKey="danbooru:parent:99";
        assertEquals(2,FollowingOrder.protectedCount(List.of(a,b),List.of(b),100));assertEquals(0,FollowingOrder.protectedCount(List.of(a,b),List.of(a,b),-1));
    }
    @Test public void legacyUndatedBaselineCannotMakeLaterInitialProvidersAllNew() throws Exception {JSONObject f=follow();FollowingOrder.NewSnapshot snapshot=snapshot(f,"all",Set.of("danbooru","sankaku"),Set.of());
        Post first=post("1","a",10000),later=post("2","a",20000);later.source="sankaku";
        assertTrue(FollowingOrder.unread(List.of(first),snapshot).isEmpty());assertTrue(FollowingOrder.recordSuccess(f,snapshot,"danbooru",List.of(first)));
        assertTrue(FollowingOrder.unread(List.of(later),snapshot).isEmpty());assertTrue(FollowingOrder.recordSuccess(f,snapshot,"sankaku",List.of(later)));
        assertEquals(Instant.ofEpochMilli(NOW).toString(),f.getJSONObject("seenAt").getString("all"));
    }
    @Test public void newSnapshotIsImmutableAndUsesDatedCutoffAndKnownIdentities() throws Exception {JSONObject f=follow().put("followedAt",Instant.ofEpochMilli(NOW-10000).toString());Set<String> known=new HashSet<>();known.add("hash:0123456789abcdef0123456789abcdef");FollowingOrder.NewSnapshot frozen=snapshot(f,"all",Set.of("danbooru"),known);
        known.clear();f.put("followedAt",Instant.ofEpochMilli(NOW).toString()).put("seen",new JSONArray().put("danbooru:2"));Post old=post("1","a",20000),fresh=post("2","a",1000),unknown=post("3","a",0),viewed=post("4","a",500);unknown.published="";viewed.hash="0123456789abcdef0123456789abcdef";
        assertEquals(Set.of(fresh.key()),FollowingOrder.unread(List.of(old,fresh,unknown,viewed),frozen));
        assertFalse("An in-flight result cannot mark a newly recreated follow seen",FollowingOrder.recordSuccess(f,frozen,"danbooru",List.of(fresh)));
    }
    @Test public void successAdvancesOnlyThatProviderAndWaitsForAllBeforePortableCutoff() throws Exception {JSONObject f=follow().put("seenAt",new JSONObject().put("explicit",Instant.ofEpochMilli(NOW-60000).toString()));FollowingOrder.NewSnapshot snapshot=snapshot(f,"explicit",Set.of("danbooru","sankaku"),Set.of());Post p=post("1","a",1000);
        assertTrue(FollowingOrder.recordSuccess(f,snapshot,"danbooru",List.of(p)));assertEquals(Instant.ofEpochMilli(NOW-60000).toString(),f.getJSONObject("seenAt").getString("explicit"));
        assertFalse(f.getJSONObject("seenAtSources").getJSONObject("explicit").has("sankaku"));String once=f.toString();assertFalse(FollowingOrder.recordSuccess(f,snapshot,"danbooru",List.of(p)));assertEquals(once,f.toString());
        FollowingOrder.NewSnapshot next=FollowingOrder.snapshot(f,"explicit",NOW+2000,Set.of("danbooru","sankaku"),Set.of());Post dan=post("2","a",30000),san=post("3","a",30000);san.source="sankaku";
        assertEquals(Set.of(san.key()),FollowingOrder.unread(List.of(dan,san),next));
        assertTrue(FollowingOrder.recordSuccess(f,snapshot,"sankaku",List.of()));assertEquals(Instant.ofEpochMilli(NOW).toString(),f.getJSONObject("seenAt").getString("explicit"));assertFalse(f.getJSONObject("seenAt").has("general"));
    }
    @Test public void knownGroupAliasesSuppressMirrorNewAndOldestDateWins() throws Exception {JSONObject f=follow().put("followedAt",Instant.ofEpochMilli(NOW-10000).toString()).put("seen",new JSONArray().put("danbooru:99"));FollowingOrder.NewSnapshot snapshot=snapshot(f,"all",Set.of("danbooru","sankaku"),Set.of());Post old=post("1","a",20000),mirror=post("2","a",10),alias=post("3","a",10);mirror.source="sankaku";mirror.groupMembers=List.of(old,Post.fromJson(mirror.toJson()));alias.memberKeys=List.of("danbooru:99",alias.key());
        assertTrue(FollowingOrder.unread(List.of(mirror,alias),snapshot).isEmpty());
    }
    @Test public void sharedWeakParentAloneCannotHideANewSeparatePublication() throws Exception {Post viewed=post("1","a",10000),fresh=post("2","a",100);viewed.groupKey=fresh.groupKey="danbooru:parent:77";JSONObject f=follow().put("followedAt",Instant.ofEpochMilli(NOW-1000).toString());Set<String> known=WorkGrouping.viewedTokens(viewed);
        assertTrue(Collections.disjoint(FollowingOrder.knownTokens(fresh),known));
        assertEquals(Set.of(fresh.key()),FollowingOrder.unread(List.of(fresh),snapshot(f,"all",Set.of("danbooru"),known)));
    }
    @Test public void followingKnownChecksStillRecognizeExactHashMediaAndOriginalPublication(){Post first=post("1","a",10),mirror=post("2","a",10);mirror.source="sankaku";first.hash=mirror.hash="0123456789abcdef0123456789abcdef";
        assertFalse(Collections.disjoint(FollowingOrder.knownTokens(first),FollowingOrder.knownTokens(mirror)));first.hash=mirror.hash="";first.image=mirror.image="https://img.rule34.xxx/images/100/0123456789abcdef0123456789abcdef.jpg";
        assertFalse(Collections.disjoint(FollowingOrder.knownTokens(first),FollowingOrder.knownTokens(mirror)));first.image=mirror.image="";first.originalUrl=mirror.originalUrl="https://www.pixiv.net/en/artworks/12345678";
        assertFalse(Collections.disjoint(FollowingOrder.knownTokens(first),FollowingOrder.knownTokens(mirror)));
    }
    @Test public void lateOlderVisitDoesNotRollBackSavedCutoff() throws Exception {JSONObject f=follow();FollowingOrder.NewSnapshot first=snapshot(f,"all",Set.of("danbooru"),Set.of()),newer=FollowingOrder.snapshot(f,"all",NOW+1000,Set.of("danbooru"),Set.of());
        FollowingOrder.recordSuccess(f,newer,"danbooru",List.of());FollowingOrder.recordSuccess(f,first,"danbooru",List.of());assertEquals(Instant.ofEpochMilli(NOW+1000).toString(),f.getJSONObject("seenAtSources").getJSONObject("all").getString("danbooru"));
    }
    @Test public void singleSourceFilterCannotAdvanceUnselectedProviderBaseline() throws Exception {JSONObject f=follow().put("seenAt",new JSONObject().put("all",Instant.ofEpochMilli(NOW-60000).toString()));Set<String> all=Set.of("danbooru","sankaku");
        FollowingOrder.NewSnapshot dan=FollowingOrder.snapshot(f,"all",NOW,Set.of("danbooru"),all,Set.of());FollowingOrder.recordSuccess(f,dan,"danbooru",List.of());assertEquals(Instant.ofEpochMilli(NOW-60000).toString(),f.getJSONObject("seenAt").getString("all"));
        FollowingOrder.NewSnapshot san=FollowingOrder.snapshot(f,"all",NOW+1000,Set.of("sankaku"),all,Set.of());Post fresh=post("1","a",30000);fresh.source="sankaku";assertEquals(Set.of(fresh.key()),FollowingOrder.unread(List.of(fresh),san));
    }
    @Test public void wholeVisitSharesOneImmutableKnownSetInsteadOfCopyingItPerFollow() throws Exception {JSONObject a=follow(),b=follow().put("key","artist:b");Set<String> known=new HashSet<>(Set.of("key:danbooru:1"));Map<String,FollowingOrder.NewSnapshot> snapshots=FollowingOrder.snapshots(List.of(a,b),"all",NOW,f->Set.of("danbooru"),known);known.clear();
        assertSame(snapshots.get("artist:landscape_artist").known,snapshots.get("artist:b").known);assertTrue(snapshots.get("artist:b").known.contains("key:danbooru:1"));try{snapshots.get("artist:b").known.clear();fail();}catch(UnsupportedOperationException expected){}
    }
    @Test public void largeVisitRetainsAllDistinctCardsAndTheirProtectedPrefix(){List<Post> many=new ArrayList<>();for(int i=0;i<5000;i++)many.add(post(""+(i+1),"a"+(i%20),i));List<Post> reversed=new ArrayList<>(many);Collections.reverse(reversed);
        List<Post> result=FollowingOrder.arrange(many,reversed,50,Set.of());assertEquals(5000,result.size());assertEquals(many.subList(0,50),result.subList(0,50));assertEquals(5000,new HashSet<>(result).size());
    }
}
