package com.artcatalog.mobile;

import org.json.*;
import java.net.URI;
import java.util.*;
import java.util.regex.*;

/** Evidence-first grouping, matching the desktop's publication, media and visual guards. */
final class WorkGrouping {
    private static final Set<String> SOURCES=Set.of("danbooru","gelbooru","rule34","sankaku");
    static String publication(String raw){try{URI url=URI.create(raw);String host=url.getHost().toLowerCase(Locale.ROOT).replaceFirst("^(www|mobile)\\.",""),path=url.getPath();Matcher m;
        if(host.equals("pixiv.net")){m=Pattern.compile("^/(?:en/)?artworks/(\\d{5,12})(?:/|$)").matcher(path);if(m.find())return "group:pixiv:"+m.group(1);}
        if(host.equals("i.pximg.net")){m=Pattern.compile("/(\\d{5,12})(?:-[a-f0-9]{32})?_p\\d+(?:_[^/.]+)?\\.(?:jpe?g|png|gif|webp)$").matcher(path);if(m.find())return "group:pixiv:"+m.group(1);}
        if(host.equals("x.com")||host.equals("twitter.com")){m=Pattern.compile("^/(?:[^/]+/status|i/web/status)/(\\d{5,25})(?:/|$)").matcher(path);if(m.find())return "original:x-status:"+m.group(1);}
    }catch(Exception ignored){}return "";}
    private static Set<String> publications(Post p){Set<String> result=new HashSet<>();String link=publication(p.originalUrl);if(!link.isBlank())result.add(link);if(p.pixivGroupKey.startsWith("pixiv:"))result.add("group:"+p.pixivGroupKey);if(p.groupKey.startsWith("pixiv:"))result.add("group:"+p.groupKey);return result;}
    static Set<String> tokens(Post p){Set<String> keys=new LinkedHashSet<>(p.identityKeys);keys.add("key:"+p.key());for(String key:p.memberKeys)keys.add("key:"+key);
        keys.add("group:"+p.source+":parent:"+p.id);for(String key:p.memberKeys){int colon=key.indexOf(':');if(colon>0)keys.add("group:"+key.substring(0,colon)+":parent:"+key.substring(colon+1));}
        if(!p.hash.isBlank())keys.add("hash:"+p.hash.toLowerCase(Locale.ROOT));if(!p.groupKey.isBlank())keys.add("group:"+p.groupKey);if(!p.pixivGroupKey.isBlank())keys.add("group:"+p.pixivGroupKey);keys.addAll(publications(p));
        JSONArray media=MediaIdentity.records(p);for(int i=0;i<media.length();i++){JSONObject record=media.optJSONObject(i);if(record==null)continue;String token=MediaIdentity.token(record.optString("url")),hash=record.optString("hash");if(!token.isBlank())keys.add(token);if(hash.matches("(?i)[a-f0-9]{32}"))keys.add("hash:"+hash.toLowerCase(Locale.ROOT));}return keys;}
    private static Set<String> historyTokens(Post p){Set<String> out=tokens(p);if(!publications(p).isEmpty())out.removeIf(WorkGrouping::parentToken);return out;}
    static Set<String> viewedTokens(Post p){return historyTokens(p);}
    private static boolean parentToken(String token){return token.matches("group:(?:danbooru|gelbooru|rule34|sankaku):parent:.*");}
    private static List<String> normalized(Collection<String> values){Set<String> out=new TreeSet<>();for(String value:values){String tag=CatalogLogic.normalizeTag(value);if(!tag.isBlank())out.add(tag);}return new ArrayList<>(out);}
    private static boolean overlap(Collection<String> a,Collection<String> b,int minimum,double ratio){Set<String> first=new HashSet<>(a),second=new HashSet<>(b);int common=0;for(String tag:first)if(second.contains(tag))common++;return common>=minimum&&common/(double)(first.size()+second.size()-common)>=ratio;}
    private static String creator(Post p){for(int i=0;i<p.participants.length();i++){JSONObject person=p.participants.optJSONObject(i);if(person!=null&&Set.of("artist","animator").contains(Post.participantRole(person.optString("tag"),person.optString("role"))))return knownCreator(person.optString("tag"));}
        if(Set.of("artist","animator").contains(Post.participantRole(p.artistTag,"")))return knownCreator(p.artistTag);return "";}
    private static String knownCreator(String value){String clean=CatalogLogic.normalizeTag(value);return Set.of("artist request","unknown artist","anonymous artist","anonymous","unknown").contains(clean)?"":clean;}
    private static boolean knownUploader(String value){return !value.isBlank()&&!value.matches("(?i)anonymous|unknown|none|0");}
    static boolean needsVisualFingerprint(Post p){return SOURCES.contains(p.source)&&!p.preview.isBlank()&&!p.media.stream().anyMatch(url->url.matches("(?i).*\\.(mp4|webm|m4v|ogv)(?:\\?.*)?"))&&
        ((!creator(p).isBlank()&&p.tags.size()>=12)||p.source.equals("rule34")&&knownUploader(p.uploaderId)&&p.tags.size()>=12);}
    private static long number(String value){try{return Long.parseLong(value);}catch(Exception ignored){return -1;}}
    private static long lowTime(Post p){return p.groupMinTime>=0?p.groupMinTime:Curation.published(p.published);}
    private static long highTime(Post p){return p.groupMaxTime>=0?p.groupMaxTime:Curation.published(p.published);}
    private static String rating(Post p){String value=CatalogLogic.normalizeRating(p.rating);return value.equals("g")||value.equals("s")?"general":value.equals("q")||value.equals("e")?"adult":"";}
    private static List<String> strings(JSONArray array){List<String> result=new ArrayList<>();if(array!=null)for(int i=0;i<array.length();i++){Object value=array.opt(i);if(value instanceof String)result.add((String)value);}return result;}
    private static Post copy(Post p){return Post.fromJson(p.toJson());}
    private static boolean complete(Post p){Set<String> keys=new HashSet<>(p.memberKeys);keys.add(p.key());if(p.groupingVersion!=2||p.groupMembers.size()!=keys.size())return false;
        for(Post member:p.groupMembers)if(!keys.contains(member.key())||!member.groupMembers.isEmpty()||member.memberKeys.stream().anyMatch(key->!key.equals(member.key())))return false;return true;}
    private static List<Post> inputs(List<Post> a,List<Post> b){LinkedHashMap<String,Post> works=new LinkedHashMap<>();List<Post> all=new ArrayList<>(a);all.addAll(b);
        for(Post p:all)for(Post item:complete(p)&&!p.groupMembers.isEmpty()?p.groupMembers:List.of(p)){
            Post raw=item;if(item.memberKeys.stream().allMatch(key->key.equals(item.key()))&&!item.identityKeys.isEmpty()){raw=copy(item);raw.identityKeys=List.of();}
            Post previous=works.get(raw.key());if(previous==null){works.put(raw.key(),raw);continue;}
            Post next=copy(raw);if(next.originalUrl.isBlank())next.originalUrl=previous.originalUrl;if(next.pixivGroupKey.isBlank())next.pixivGroupKey=previous.pixivGroupKey;
            JSONArray media=MediaIdentity.unique(List.of(MediaIdentity.records(previous),MediaIdentity.records(raw)));next.imageRecords=media;next.media=urls(media);works.put(raw.key(),next);
        }return new ArrayList<>(works.values());}
    private static List<String> urls(JSONArray records){List<String> urls=new ArrayList<>();for(int i=0;i<records.length();i++){JSONObject record=records.optJSONObject(i);if(record!=null)urls.add(record.optString("url"));}return urls;}
    private static final class Components {final int[] roots;final List<Set<String>> publications;Components(List<Post> works){roots=new int[works.size()];publications=new ArrayList<>();for(int i=0;i<roots.length;i++){roots[i]=i;publications.add(publications(works.get(i)));}}
        int find(int i){while(roots[i]!=i){roots[i]=roots[roots[i]];i=roots[i];}return i;}
        boolean join(int first,int second,boolean weak,boolean crossPost){int a=find(first),b=find(second);if(a==b)return true;Set<String> x=publications.get(a),y=publications.get(b);
            if(weak&&!x.isEmpty()&&!y.isEmpty()&&Collections.disjoint(x,y)&&(!crossPost||conflict(x,y)))return false;roots[a]=b;y.addAll(x);return true;}}
    private static String family(String token){return token.startsWith("group:pixiv:")?"pixiv":token.startsWith("original:x-status:")?"x":"";}
    private static boolean conflict(Set<String> a,Set<String> b){for(String kind:List.of("pixiv","x")){Set<String> first=new HashSet<>(),second=new HashSet<>();for(String p:a)if(family(p).equals(kind))first.add(p);for(String p:b)if(family(p).equals(kind))second.add(p);if(!first.isEmpty()&&!second.isEmpty()&&Collections.disjoint(first,second))return true;}return false;}
    private static boolean fitsBatch(Components c,List<Post> works,int first,int second){long minId=Long.MAX_VALUE,maxId=-1,minTime=Long.MAX_VALUE,maxTime=-1;int a=c.find(first),b=c.find(second);
        for(int i=0;i<works.size();i++)if(c.find(i)==a||c.find(i)==b){Post p=works.get(i);long id=number(p.id);if(id<1||lowTime(p)<0)return false;minId=Math.min(minId,id);maxId=Math.max(maxId,id);minTime=Math.min(minTime,lowTime(p));maxTime=Math.max(maxTime,highTime(p));
            for(String key:p.memberKeys)if(key.startsWith(p.source+":")){long member=number(key.substring(p.source.length()+1));if(member<1)return false;minId=Math.min(minId,member);maxId=Math.max(maxId,member);}}
        return maxId-minId<=12&&maxTime-minTime<=600000;}
    private static final class Sample {final int index;final String hash,creator,source,uploader,owner,published,publication,phash;final double aspect;final List<String> tags,characters;
        Sample(int index,JSONObject o){this.index=index;hash=o.optString("hash").toLowerCase(Locale.ROOT);creator=CatalogLogic.normalizeTag(o.optString("creator"));source=o.optString("source");uploader=o.optString("uploader").trim().toLowerCase(Locale.ROOT);
            owner=creator.isBlank()?source+":uploader:"+uploader:"creator:"+creator;published=o.optString("published");publication=o.optString("publication");phash=o.optString("perceptualHash");aspect=o.optDouble("aspectRatio",0);tags=normalized(strings(o.optJSONArray("tags")));characters=normalized(strings(o.optJSONArray("characters")));}
        JSONObject json(){try{return new JSONObject().put("hash",hash).put("creator",creator).put("source",source).put("uploader",uploader).put("owner",owner).put("published",published).put("publication",publication).put("perceptualHash",phash).put("aspectRatio",aspect).put("tags",new JSONArray(tags)).put("characters",new JSONArray(characters));}catch(JSONException e){throw new IllegalStateException(e);}}}
    private static boolean validHash(String hash){return hash.matches("(?i)[a-f0-9]{16}");}
    private static List<Sample> samples(Post p,int index){List<Sample> out=new ArrayList<>();String confirmed=creator(p);for(int i=0;i<p.visualSamples.length()&&out.size()<100;i++){JSONObject raw=p.visualSamples.optJSONObject(i);if(raw==null||!validHash(raw.optString("hash")))continue;
            try{JSONObject s=new JSONObject(raw.toString());String source=s.optString("source",p.source),uploader=s.optString("uploader"),owner=s.optString("owner");String known=s.optString("creator");
                if(known.isBlank()&&owner.startsWith("sankaku:creator:"))known=owner.substring("sankaku:creator:".length());if(known.isBlank()&&raw.optString("hash").equals(p.visualHash))known=confirmed;
                if(uploader.isBlank()){int at=owner.indexOf(":uploader:");if(at>=0)uploader=owner.substring(at+10);else if(source.equals("rule34")&&!owner.contains(":"))uploader=owner;}
                s.put("creator",known).put("source",source).put("uploader",uploader);Sample sample=new Sample(index,s);if(!sample.creator.isBlank()||sample.source.equals("rule34")&&knownUploader(sample.uploader))out.add(sample);
            }catch(JSONException ignored){}}
        if(validHash(p.visualHash)&&(!confirmed.isBlank()&&p.tags.size()>=12||p.source.equals("rule34")&&knownUploader(p.uploaderId)&&p.tags.size()>=3))try{
            Sample own=new Sample(index,new JSONObject().put("hash",p.visualHash).put("creator",confirmed).put("source",p.source).put("uploader",p.uploaderId).put("tags",new JSONArray(p.tags)).put("characters",new JSONArray(p.characterTags)).put("published",p.published).put("publication",publication(p.originalUrl)).put("perceptualHash",p.visualPHash).put("aspectRatio",p.visualAspectRatio));
            out.removeIf(sample->sample.hash.equals(own.hash)&&sample.source.equals(own.source));out.add(own);
        }catch(JSONException ignored){}return out;}
    private static int distance(String a,String b){try{return Long.bitCount(Long.parseUnsignedLong(a,16)^Long.parseUnsignedLong(b,16));}catch(Exception ignored){return 64;}}
    private static boolean dual(Sample a,Sample b,int d,int edge,int perceptual){return !a.creator.isBlank()&&a.creator.equals(b.creator)&&a.tags.size()>=12&&b.tags.size()>=12&&validHash(a.phash)&&validHash(b.phash)&&a.aspect>0&&b.aspect>0&&Math.abs(Math.log(a.aspect/b.aspect))<=.05&&d<=edge&&distance(a.phash,b.phash)<=perceptual;}
    private static List<String> confirmedCharacters(Sample s){List<String> out=new ArrayList<>(s.characters);out.removeAll(List.of("original character","character request"));return out;}
    private static boolean crossPost(Sample a,Sample b,int d){String f=family(a.publication),g=family(b.publication);List<String> x=confirmedCharacters(a),y=confirmedCharacters(b);return !f.isBlank()&&!g.isBlank()&&!f.equals(g)&&!x.isEmpty()&&x.equals(y)&&dual(a,b,d,2,6);}
    private static boolean compatible(Sample a,Sample b,int d){if(!overlap(a.tags,b.tags,3,.65)||!a.characters.isEmpty()&&!b.characters.isEmpty()&&Collections.disjoint(a.characters,b.characters))return false;
        if(!a.publication.isBlank()&&!b.publication.isBlank()&&!a.publication.equals(b.publication)&&!crossPost(a,b,d))return false;
        if(!a.creator.isBlank()&&a.creator.equals(b.creator)&&validHash(a.phash)&&validHash(b.phash))return dual(a,b,d,12,12);
        if(d>8||!a.source.equals(b.source))return false;if(a.source.equals("rule34")||d<=2)return true;
        long x=Curation.published(a.published),y=Curation.published(b.published);return a.tags.size()>=12&&b.tags.size()>=12&&!a.uploader.isBlank()&&a.uploader.equals(b.uploader)&&x>=0&&y>=0&&Math.abs(x-y)<=1200000;}
    private static final class HashTree {final String hash;final List<Sample> samples=new ArrayList<>();final Map<Integer,HashTree> children=new HashMap<>();HashTree(Sample s){hash=s.hash;samples.add(s);}
        void add(Sample s){HashTree n=this;while(true){int d=distance(n.hash,s.hash);if(d==0){n.samples.add(s);return;}HashTree next=n.children.get(d);if(next==null){n.children.put(d,new HashTree(s));return;}n=next;}}
        void near(Sample s,Components components){ArrayDeque<HashTree> pending=new ArrayDeque<>();pending.add(this);while(!pending.isEmpty()){HashTree n=pending.removeFirst();int d=distance(n.hash,s.hash);if(d<=12)for(Sample old:n.samples)if(old.index!=s.index&&compatible(old,s,d))components.join(old.index,s.index,true,crossPost(old,s,d));for(Map.Entry<Integer,HashTree> e:n.children.entrySet())if(e.getKey()>=d-12&&e.getKey()<=d+12)pending.add(e.getValue());}}}
    static List<Post> group(List<Post> a,List<Post> b){List<Post> works=inputs(a,b);Components components=new Components(works);Map<String,Integer> linked=new HashMap<>();Map<String,List<Integer>> parents=new LinkedHashMap<>();
        for(int i=0;i<works.size();i++)for(String token:tokens(works.get(i))){if(parentToken(token)){parents.computeIfAbsent(token,key->new ArrayList<>()).add(i);continue;}Integer previous=linked.putIfAbsent(token,i);if(previous!=null)components.join(i,previous,false,false);}
        for(List<Integer> parent:parents.values())for(int i=1;i<parent.size();i++)for(int j=0;j<i;j++)components.join(parent.get(i),parent.get(j),true,false);
        List<Integer> candidates=new ArrayList<>();for(int i=0;i<works.size();i++)candidates.add(i);candidates.sort(Comparator.comparingLong((Integer i)->number(works.get(i).id)).reversed());Map<String,List<Integer>> batches=new HashMap<>();
        for(int i:candidates){Post p=works.get(i);String creator=creator(p),rating=rating(p),uploader=p.uploaderId.trim().toLowerCase(Locale.ROOT);if(number(p.id)<1||Curation.published(p.published)<0||creator.isBlank()||!knownUploader(uploader)||rating.isBlank()||new HashSet<>(p.tags).size()<12||!p.groupKey.isBlank()||!p.pixivGroupKey.isBlank()||!publication(p.originalUrl).isBlank())continue;
            String bucket=p.source+"|"+creator+"|"+uploader+"|"+rating+"|"+normalized(p.characterTags);List<Integer> anchors=batches.computeIfAbsent(bucket,key->new ArrayList<>());boolean found=false;
            for(int previous:anchors){Post anchor=works.get(previous);if(overlap(anchor.tags,p.tags,12,.78)&&fitsBatch(components,works,i,previous)&&components.join(i,previous,true,false)){found=true;break;}}if(!found)anchors.add(i);}
        List<List<Sample>> evidence=new ArrayList<>();for(int i=0;i<works.size();i++)evidence.add(samples(works.get(i),i));
        Map<String,List<Sample>> sceneBuckets=new HashMap<>();for(int i=0;i<works.size();i++)for(Sample s:evidence.get(i)){Post p=works.get(i);List<String> characters=confirmedCharacters(s);
            if(s.creator.isBlank()||!knownUploader(s.uploader)||Curation.published(s.published)<0||!s.published.matches(".*T\\d{2}:\\d{2}:\\d{2}.*")||!s.publication.isBlank()||characters.isEmpty()||s.tags.size()<35||!p.groupKey.isBlank()||!p.pixivGroupKey.isBlank()||p.isVideo())continue;
            sceneBuckets.computeIfAbsent(s.source+"|"+s.creator+"|"+s.uploader+"|"+characters,key->new ArrayList<>()).add(s);}
        for(List<Sample> entries:sceneBuckets.values()){entries.sort(Comparator.comparingLong(s->Curation.published(s.published)));List<Sample> anchors=new ArrayList<>();for(Sample s:entries){boolean found=false;
                for(Sample anchor:anchors){long min=Long.MAX_VALUE,max=-1;int first=components.find(s.index),second=components.find(anchor.index);for(Sample member:entries)if(components.find(member.index)==first||components.find(member.index)==second){long time=Curation.published(member.published);min=Math.min(min,time);max=Math.max(max,time);}
                    boolean multi=confirmedCharacters(s).size()>1;if(max-min<=45000&&overlap(anchor.tags,s.tags,multi?35:40,multi?.58:.9)&&components.join(s.index,anchor.index,true,false)){found=true;break;}}if(!found)anchors.add(s);}}
        Map<String,HashTree> trees=new HashMap<>();for(List<Sample> list:evidence)for(Sample sample:list){HashTree tree=trees.get(sample.owner);if(tree==null)trees.put(sample.owner,new HashTree(sample));else{tree.near(sample,components);tree.add(sample);}}
        LinkedHashMap<Integer,List<Post>> groups=new LinkedHashMap<>();for(int i=0;i<works.size();i++)groups.computeIfAbsent(components.find(i),key->new ArrayList<>()).add(works.get(i));List<Post> result=new ArrayList<>();for(List<Post> members:groups.values())result.add(merge(members));return result;}
    private static Post merge(List<Post> members){Post preferred=members.get(0);for(Post p:members)if(p.source.equals("danbooru")){preferred=p;break;}Post merged=copy(preferred);List<Post> ordered=new ArrayList<>(members);ordered.remove(preferred);ordered.add(0,preferred);
        Set<String> tags=new LinkedHashSet<>(),characters=new LinkedHashSet<>(),copyrights=new LinkedHashSet<>(),artists=new LinkedHashSet<>(),uploaders=new LinkedHashSet<>(),keys=new LinkedHashSet<>(),identities=new LinkedHashSet<>(),sampleKeys=new HashSet<>(),participantKeys=new HashSet<>();List<JSONArray> media=new ArrayList<>();JSONArray visuals=new JSONArray(),people=new JSONArray();long min=Long.MAX_VALUE,max=-1;boolean complete=true;
        for(Post p:ordered){tags.addAll(p.tags);characters.addAll(p.characterTags);copyrights.addAll(p.copyrightTags);artists.addAll(p.artistTags);uploaders.addAll(p.uploaderKeys);if(!p.uploaderId.isBlank())uploaders.add(p.source+":"+p.uploaderId);keys.add(p.key());keys.addAll(p.memberKeys);identities.addAll(tokens(p));media.add(MediaIdentity.records(p));
            if(p.memberKeys.stream().anyMatch(key->!key.equals(p.key())))complete=false;if(lowTime(p)>=0){min=Math.min(min,lowTime(p));max=Math.max(max,highTime(p));}if(merged.originalUrl.isBlank())merged.originalUrl=p.originalUrl;
            if(CatalogLogic.normalizeRating(p.rating).equals("e"))merged.rating="e";else if(CatalogLogic.normalizeRating(p.rating).equals("q")&&!CatalogLogic.normalizeRating(merged.rating).equals("e"))merged.rating="q";
            List<String> artistTags=new ArrayList<>(p.artistTags);if(!p.artistTag.isBlank())artistTags.add(p.artistTag);if(p.participants.length()>0){for(int i=0;i<p.participants.length();i++){JSONObject person=p.participants.optJSONObject(i);if(person!=null&&participantKeys.add(person.optString("tag").toLowerCase(Locale.ROOT)))people.put(person);}}
            else for(String tag:artistTags)if(participantKeys.add(tag.toLowerCase(Locale.ROOT)))try{people.put(new JSONObject().put("tag",tag).put("name",tag.replace('_',' ')).put("role",Post.participantRole(tag,"")));}catch(JSONException ignored){}
            for(Sample sample:samples(p,0))if(visuals.length()<100&&sampleKeys.add(sample.json().toString()))visuals.put(sample.json());}
        List<JSONObject> sortedPeople=new ArrayList<>();for(int i=0;i<people.length();i++)sortedPeople.add(people.optJSONObject(i));sortedPeople.sort(Comparator.comparingInt(person->{String role=Post.participantRole(person.optString("tag"),person.optString("role"));return role.equals("artist")?0:role.equals("animator")?1:2;}));merged.participants=new JSONArray(sortedPeople);
        merged.artistTag="";for(JSONObject person:sortedPeople)if(Set.of("artist","animator").contains(Post.participantRole(person.optString("tag"),person.optString("role")))){merged.artistTag=person.optString("tag");merged.artist=person.optString("name",merged.artistTag.replace('_',' '));break;}
        merged.groupMinTime=max<0?-1:min;merged.groupMaxTime=max;merged.tags=new ArrayList<>(tags);merged.characterTags=new ArrayList<>(characters);merged.copyrightTags=new ArrayList<>(copyrights);merged.artistTags=new ArrayList<>(artists);merged.uploaderKeys=new ArrayList<>(uploaders);merged.memberKeys=new ArrayList<>(keys);merged.identityKeys=new ArrayList<>(identities);merged.visualSamples=visuals;
        merged.imageRecords=MediaIdentity.unique(media);merged.media=urls(merged.imageRecords);merged.groupCount=Math.max(1,merged.media.size());merged.groupingVersion=complete?2:0;merged.groupMembers=new ArrayList<>();
        if(complete&&members.size()>1)for(Post p:members){Post leaf=copy(p);leaf.memberKeys=List.of(p.key());leaf.identityKeys=List.of();leaf.groupMembers=List.of();leaf.groupingVersion=0;merged.groupMembers.add(leaf);}return merged;}
}
