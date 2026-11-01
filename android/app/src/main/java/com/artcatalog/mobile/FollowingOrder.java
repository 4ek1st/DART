package com.artcatalog.mobile;

import org.json.*;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;

/** Publication chronology and visit boundaries shared by the Following list and its gallery. */
final class FollowingOrder {
    private static final Set<String> SOURCES=Set.of("danbooru","gelbooru","rule34","sankaku");
    private FollowingOrder(){}

    private static Set<String> tokens(Post post){
        Set<String> tokens=new LinkedHashSet<>();for(String key:FeedSession.keys(post))tokens.add("key:"+key);
        for(Post member:post.groupMembers)for(String key:FeedSession.keys(member))tokens.add("key:"+key);
        if(post.hash.matches("(?i)[0-9a-f]{32}"))tokens.add("hash:"+post.hash.toLowerCase(Locale.ROOT));
        // Matching published cards uses existing aliases and strong cached identities, without
        // reparsing or hashing media on the rendering thread. A parent alone is never identity.
        for(String token:post.identityKeys)if(strongIdentity(token))tokens.add(token);
        return tokens;
    }
    private static boolean strongIdentity(String token){return token.startsWith("key:")||token.matches("(?i)hash:[0-9a-f]{32}|group:media:[0-9a-f]{64}")||token.matches("group:pixiv:[0-9]+|original:x-status:[0-9]{5,25}|original:discord-attachment:[0-9]+:[0-9]+");}
    static Set<String> knownTokens(Post post){Set<String> strong=new HashSet<>();for(String token:WorkGrouping.viewedTokens(post))if(strongIdentity(token))strong.add(token);return strong;}
    private static final class Index {
        final Map<String,Post> posts=new HashMap<>();final IdentityHashMap<Post,Set<String>> identities=new IdentityHashMap<>();
        Index(List<Post> items){for(Post post:items)for(String token:keys(post))posts.putIfAbsent(token,post);}
        Set<String> keys(Post post){return identities.computeIfAbsent(post,FollowingOrder::tokens);}
        Post current(Post previous){for(String token:keys(previous)){Post current=posts.get(token);if(current!=null)return current;}return previous;}
    }
    private static boolean add(List<Post> result,Set<String> used,Post post,Set<String> identities){if(!Collections.disjoint(used,identities))return false;result.add(post);used.addAll(identities);return true;}
    private static boolean isNew(Post post,Set<String> newKeys){for(String key:FeedSession.keys(post))if(newKeys.contains(key))return true;return false;}
    static long published(Post post){long oldest=Long.MAX_VALUE;
        long own=Curation.published(post.published);if(own>0)oldest=own;if(post.groupMinTime>0)oldest=Math.min(oldest,post.groupMinTime);
        for(Post member:post.groupMembers){long date=Curation.published(member.published);if(date>0)oldest=Math.min(oldest,date);if(member.groupMinTime>0)oldest=Math.min(oldest,member.groupMinTime);}
        return oldest==Long.MAX_VALUE?-1:oldest;
    }
    static List<Post> arrange(List<Post> previous,List<Post> merged,int protectedCount,Set<String> newKeys){
        Index index=new Index(merged);List<Post> result=new ArrayList<>(),tail=new ArrayList<>();Set<String> used=new HashSet<>();
        int boundary=Math.max(0,Math.min(protectedCount,previous.size()));
        for(int i=0;i<boundary;i++){Post old=previous.get(i),current=index.current(old);if(add(result,used,current,index.keys(current)))used.addAll(index.keys(old));}
        // Visibility already admits the whole visit, but retaining absent previous records here
        // also makes metadata-only regrouping safe for liked/viewed cards.
        List<Post> retained=new ArrayList<>(merged);retained.addAll(previous);
        for(Post post:retained){Post current=index.current(post);if(Collections.disjoint(used,index.keys(current))){tail.add(current);used.addAll(index.keys(current));used.addAll(index.keys(post));}}
        IdentityHashMap<Post,Long> dates=new IdentityHashMap<>();for(Post post:tail)dates.put(post,published(post));
        tail.sort(Comparator.<Post>comparingInt(post->isNew(post,newKeys)?1:0).reversed().thenComparing(Comparator.comparingLong((Post post)->dates.get(post)).reversed()));
        // Diversity only breaks identical-date ties. It never pulls old work above newer work.
        String last=result.isEmpty()?"":Recommendations.author(result.get(result.size()-1));
        for(int start=0;start<tail.size();){int end=start+1;Post first=tail.get(start);while(end<tail.size()&&isNew(first,newKeys)==isNew(tail.get(end),newKeys)&&dates.get(first).equals(dates.get(tail.get(end))))end++;
            LinkedHashMap<String,ArrayDeque<Post>> authors=new LinkedHashMap<>();for(int i=start;i<end;i++){Post post=tail.get(i);String author=Recommendations.author(post);if(author.isBlank())author="work:"+post.key();authors.computeIfAbsent(author,key->new ArrayDeque<>()).add(post);}
            while(!authors.isEmpty()){String chosen=null;for(String author:authors.keySet())if(!author.equals(last)){chosen=author;break;}if(chosen==null)chosen=authors.keySet().iterator().next();ArrayDeque<Post> works=authors.remove(chosen);result.add(works.removeFirst());if(!works.isEmpty())authors.put(chosen,works);last=chosen;}
            start=end;
        }
        return result;
    }
    static List<Post> gallery(List<Post> previous,List<Post> mergedMetadata,List<Post> currentSourceOrder,int protectedCount){
        Index index=new Index(mergedMetadata);List<Post> result=new ArrayList<>();Set<String> used=new HashSet<>();int boundary=Math.max(0,Math.min(protectedCount,previous.size()));
        for(int i=0;i<boundary;i++){Post old=previous.get(i),current=index.current(old);if(add(result,used,current,index.keys(current)))used.addAll(index.keys(old));}
        for(Post ordered:currentSourceOrder){Post current=index.current(ordered);if(add(result,used,current,index.keys(current)))used.addAll(index.keys(ordered));}
        return result;
    }
    /** Rebase an end-exclusive visit boundary after reached aliases collapse to one card. */
    static int protectedCount(List<Post> previous,List<Post> currentMetadata,int oldCount){
        Index index=new Index(currentMetadata);Set<String> used=new HashSet<>();int count=0,boundary=Math.max(0,Math.min(oldCount,previous.size()));
        for(int i=0;i<boundary;i++){Post old=previous.get(i),current=index.current(old);Set<String> identities=index.keys(current);if(Collections.disjoint(used,identities))count++;used.addAll(identities);used.addAll(index.keys(old));}
        return count;
    }

    static final class NewSnapshot {
        final String key,rating,followedAt;final long startedAt;final Set<String> sources,completionSources,seen,known;
        final Map<String,Long> cutoffs;final long fallbackCutoff;
        private NewSnapshot(String key,String rating,String followedAt,long startedAt,Set<String> sources,Set<String> completionSources,Set<String> seen,Set<String> known,Map<String,Long> cutoffs,long fallbackCutoff){
            this.key=key;this.rating=rating;this.followedAt=followedAt;this.startedAt=startedAt;this.sources=Set.copyOf(sources);this.completionSources=Set.copyOf(completionSources);this.seen=Set.copyOf(seen);this.known=known;this.cutoffs=Map.copyOf(cutoffs);this.fallbackCutoff=fallbackCutoff;
        }
    }
    static String followKey(JSONObject follow){String key=follow.optString("key");if(!key.isBlank())return key;String source=follow.optString("source"),tag=follow.optString("tag");return source.isBlank()?"artist:"+tag:source+":"+CatalogLogic.normalizeTag(tag.replaceFirst("^user:",""));}
    static NewSnapshot snapshot(JSONObject follow,String rating,long startedAt,Set<String> sources,Set<String> known){
        return snapshot(follow,rating,startedAt,sources,sources,known);
    }
    static NewSnapshot snapshot(JSONObject follow,String rating,long startedAt,Set<String> sources,Set<String> completionSources,Set<String> known){
        return snapshotWithKnown(follow,rating,startedAt,sources,completionSources,Set.copyOf(known));
    }
    static Map<String,NewSnapshot> snapshots(Collection<JSONObject> follows,String rating,long startedAt,Function<JSONObject,Set<String>> sources,Set<String> known){
        return snapshots(follows,rating,startedAt,sources,sources,known);
    }
    static Map<String,NewSnapshot> snapshots(Collection<JSONObject> follows,String rating,long startedAt,Function<JSONObject,Set<String>> sources,Function<JSONObject,Set<String>> completionSources,Set<String> known){
        Set<String> frozenKnown=Set.copyOf(known);Map<String,NewSnapshot> snapshots=new LinkedHashMap<>();
        for(JSONObject follow:follows){NewSnapshot snapshot=snapshotWithKnown(follow,rating,startedAt,sources.apply(follow),completionSources.apply(follow),frozenKnown);snapshots.put(snapshot.key,snapshot);}return Collections.unmodifiableMap(snapshots);
    }
    private static NewSnapshot snapshotWithKnown(JSONObject follow,String rating,long startedAt,Set<String> sources,Set<String> completionSources,Set<String> known){
        String selected=Set.of("general","explicit","all").contains(rating)?rating:"all";String followedAt=follow.optString("followedAt");
        long cutoff=Curation.published(followedAt);JSONObject seenAt=follow.optJSONObject("seenAt");long previous=seenAt==null?-1:Curation.published(seenAt.optString(selected));if(previous>0)cutoff=previous;if(cutoff<=0)cutoff=startedAt;
        Set<String> expected=new LinkedHashSet<>();for(String source:sources)if(SOURCES.contains(source))expected.add(source);
        Set<String> completion=new LinkedHashSet<>();for(String source:completionSources)if(SOURCES.contains(source))completion.add(source);completion.addAll(expected);
        Map<String,Long> cutoffs=new LinkedHashMap<>();JSONObject allSources=follow.optJSONObject("seenAtSources"),perSource=allSources==null?null:allSources.optJSONObject(selected);
        for(String source:completion){long date=perSource==null?-1:Curation.published(perSource.optString(source));cutoffs.put(source,date>0?date:cutoff);}
        Set<String> seen=new LinkedHashSet<>();readKeys(follow.optJSONArray("seen"),seen);JSONObject perRating=follow.optJSONObject("seenKeys");if(perRating!=null)readKeys(perRating.optJSONArray(selected),seen);
        return new NewSnapshot(followKey(follow),selected,followedAt,startedAt,expected,completion,seen,known,cutoffs,cutoff);
    }
    static Set<String> unread(List<Post> posts,NewSnapshot snapshot){Set<String> unread=new LinkedHashSet<>();
        for(Post post:posts){Set<String> aliases=FeedSession.keys(post);if(!Collections.disjoint(aliases,snapshot.seen)||!Collections.disjoint(knownTokens(post),snapshot.known))continue;
            long date=published(post),cutoff=snapshot.cutoffs.getOrDefault(post.source,snapshot.fallbackCutoff);boolean selected=snapshot.sources.contains(post.source);
            for(Post member:post.groupMembers){selected|=snapshot.sources.contains(member.source);cutoff=Math.max(cutoff,snapshot.cutoffs.getOrDefault(member.source,snapshot.fallbackCutoff));}
            if(selected&&date>cutoff&&date<=snapshot.startedAt+3600000)unread.addAll(aliases);
        }return unread;
    }
    /** Called only for a successful initial provider response, including a successful empty page. */
    static boolean recordSuccess(JSONObject follow,NewSnapshot snapshot,String source,List<Post> posts){
        if(!followKey(follow).equals(snapshot.key)||!follow.optString("followedAt").equals(snapshot.followedAt)||!snapshot.sources.contains(source))return false;
        try{boolean changed=false;Set<String> seen=new LinkedHashSet<>();JSONArray oldSeen=follow.optJSONArray("seen");readKeys(oldSeen,seen);int previousSize=seen.size();
            for(Post post:posts)if(post.source.equals(source)||post.groupMembers.stream().anyMatch(member->member.source.equals(source)))seen.addAll(FeedSession.keys(post));
            if(seen.size()!=previousSize||seen.size()>4000){List<String> bounded=new ArrayList<>(seen);if(bounded.size()>4000)bounded=bounded.subList(bounded.size()-4000,bounded.size());follow.put("seen",new JSONArray(bounded));changed=true;}
            JSONObject sources=follow.optJSONObject("seenAtSources");if(sources==null)sources=new JSONObject();JSONObject rating=sources.optJSONObject(snapshot.rating);if(rating==null)rating=new JSONObject();
            long old=Curation.published(rating.optString(source));if(old<snapshot.startedAt){rating.put(source,Instant.ofEpochMilli(snapshot.startedAt).toString());sources.put(snapshot.rating,rating);follow.put("seenAtSources",sources);changed=true;}
            boolean complete=true;for(String expected:snapshot.completionSources)if(Curation.published(rating.optString(expected))<snapshot.startedAt){complete=false;break;}
            if(complete){JSONObject seenAt=follow.optJSONObject("seenAt");if(seenAt==null)seenAt=new JSONObject();if(Curation.published(seenAt.optString(snapshot.rating))<snapshot.startedAt){seenAt.put(snapshot.rating,Instant.ofEpochMilli(snapshot.startedAt).toString());follow.put("seenAt",seenAt);changed=true;}if(!follow.optBoolean("initialized")){follow.put("initialized",true);changed=true;}}
            return changed;
        }catch(JSONException invalid){throw new IllegalStateException(invalid);}
    }
    private static void readKeys(JSONArray array,Set<String> target){if(array!=null)for(int i=0;i<array.length();i++){String key=array.optString(i);if(!key.isBlank())target.add(key);}}
}
