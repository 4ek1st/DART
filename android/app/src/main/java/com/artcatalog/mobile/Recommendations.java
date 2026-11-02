package com.artcatalog.mobile;

import java.text.Normalizer;
import java.util.*;
import java.util.function.BooleanSupplier;
import java.util.regex.Pattern;

/** Native implementation of DART desktop 0.2.53 recommendation mathematics.
 * Build/rank off the UI thread. Taste is a visit snapshot; the bounded identity
 * index also observes asynchronous enrichment of saved artwork metadata. */
final class Recommendations {
    private static final Set<String> GENERIC=Set.of("1girl","2girls","1boy","solo","multiple girls","original","female",
        "male","art","illustration","anime","hentai","sfw","nsfw","r 18","rating general","rating explicit","highres",
        "absurdres","commentary","alt text","commentary request","english text","japanese text","color","full color");
    private static final Set<String> BROAD=Set.of("sex","breasts","nipples","nude","blush","pussy","penis","hetero",
        "looking at viewer","long hair","short hair","open mouth","red eyes","blue eyes","navel","ass","smile","uncensored",
        "censored","completely nude","ai generated","english commentary","anus","small breasts","medium breasts","large breasts",
        "very large breasts","huge breasts","thighs","feet","tongue","gloves","sweat","animal ears","male only","female only",
        "heart","solo focus","lying","simple background","stomach","hair ornament","bar censor","mosaic censoring","ahoge",
        "tail","very long hair","barefoot","pointy ears","tongue out","teeth","on back","hair between eyes","white background",
        "toes","collarbone","dark skin","clothing","clothes","busty","vagina","bodily fluids","straight","female focus",
        "male focus","legwear","flat chest");
    private static final Map<String,String> NORMAL_CACHE=new LinkedHashMap<>(256,.75f,true);
    private static final Map<String,Integer> TAG_RULES=new LinkedHashMap<>(256,.75f,true);
    private static final Pattern RESOLUTION=Pattern.compile("(?:(?:very|extremely|absolutely|incredibly|ridiculously|ultra) )*(?:lowres|highres|absurdres|(?:low|high|absurd|huge|original|full) resolution)"),
        FILESIZE=Pattern.compile("(?:(?:very|extremely|ultra|large|huge|massive|small|medium|high|low) )*(?:filesize|file size)"),
        COLOR=Pattern.compile("(?:black|brown|blonde|red|blue|green|grey|gray|white|pink|purple|silver|orange|yellow|golden|multicolored) (?:hair|eyes)"),
        NUMBER=Pattern.compile("\\d+(?:girls?|boys?)|\\d+"),IGNORED=Pattern.compile("(?:.* commentary|commission|translated|translation request|tagme|artist name|signature|watermark)");
    private static String nfkc(String text){for(int i=0;i<text.length();i++)if(text.charAt(i)>127)return Normalizer.normalize(text,Normalizer.Form.NFKC);return text;}
    private static <T> T cached(Map<String,T> cache,String key){synchronized(cache){return cache.get(key);}}
    private static <T> T remember(Map<String,T> cache,String key,T value){synchronized(cache){T known=cache.get(key);if(known!=null)return known;cache.put(key,value);while(cache.size()>8192)cache.remove(cache.keySet().iterator().next());return value;}}
    static String normal(String text){String raw=text==null?"":text,cached=raw.length()<=200?cached(NORMAL_CACHE,raw):null;if(cached!=null)return cached;
        String result=spaces(nfkc(raw).toLowerCase(Locale.ROOT).replace('_',' ').replace(':',' '),' ');
        return raw.length()<=200?remember(NORMAL_CACHE,raw,result):result;}
    private static String query(String text){return spaces(nfkc(text)
        .toLowerCase(Locale.ROOT),'_');}
    // Android's ICU regex engine does not support Java's (?U) switch. Explicit
    // Unicode spaces also keep this normalization identical in JVM and ART.
    private static String spaces(String text,char separator){StringBuilder result=new StringBuilder(text.length());boolean pending=false;
        for(int i=0;i<text.length();i++){char ch=text.charAt(i);if(Character.isWhitespace(ch)||Character.isSpaceChar(ch)||ch=='\ufeff'){pending=true;continue;}
            if(pending&&result.length()>0)result.append(separator);result.append(ch);pending=false;}return result.toString();}
    private static int rules(String tag){Integer known=tag.length()<=200?cached(TAG_RULES,tag):null;if(known!=null)return known;int value=tag.length()>=3&&!GENERIC.contains(tag)&&!NUMBER.matcher(tag).matches()&&!IGNORED.matcher(tag).matches()?1:0;
        if(BROAD.contains(tag)||RESOLUTION.matcher(tag).matches()||FILESIZE.matcher(tag).matches()||COLOR.matcher(tag).matches())value|=2;return tag.length()<=200?remember(TAG_RULES,tag,value):value;}
    static boolean broad(String tag){return (rules(tag)&2)!=0;}
    /** Per-build string memoization, released when the profile/taste pass ends. */
    static final class TagReader {
        private final Map<String,String> normalized=new HashMap<>(),queries=new HashMap<>();private final Map<String,Integer> decisions=new HashMap<>();
        private static <T> T put(Map<String,T> cache,String key,T value){if(cache.size()>=16384)cache.clear();cache.put(key,value);return value;}
        String normal(String raw){String key=raw==null?"":raw,known=normalized.get(key);return known!=null?known:put(normalized,key,Recommendations.normal(key));}
        String query(String raw){String known=queries.get(raw);return known!=null?known:put(queries,raw,Recommendations.query(raw));}
        int rules(String tag){Integer known=decisions.get(tag);return known!=null?known:put(decisions,tag,Recommendations.rules(tag));}
        boolean broad(String tag){return (rules(tag)&2)!=0;}
    }
    static Set<String> rawTags(Post p){LinkedHashSet<String> out=new LinkedHashSet<>();for(List<String> source:List.of(p.tags,p.characterTags,p.copyrightTags))
        for(String tag:source)out.add(normal(tag));return out;}
    static Set<String> workTags(Post p){return workTags(p,null);}
    static Set<String> workTags(Post p,TagReader reader){Set<String> authors=new HashSet<>();for(String tag:p.artistTags)authors.add(reader==null?normal(tag):reader.normal(tag));
        authors.add(reader==null?normal(p.artistTag):reader.normal(p.artistTag));for(int i=0;i<p.participants.length();i++){org.json.JSONObject person=p.participants.optJSONObject(i);if(person!=null)authors.add(reader==null?normal(person.optString("tag")):reader.normal(person.optString("tag")));}
        LinkedHashSet<String> result=new LinkedHashSet<>();for(List<String> source:List.of(p.tags,p.characterTags,p.copyrightTags))for(String raw:source){String tag=reader==null?normal(raw):reader.normal(raw);if(((reader==null?rules(tag):reader.rules(tag))&1)!=0&&!authors.contains(tag))result.add(tag);}return result;}
    static String author(Post p){for(int i=0;i<p.participants.length();i++){org.json.JSONObject person=p.participants.optJSONObject(i);if(person!=null&&Post.participantRole(person.optString("tag"),person.optString("role")).equals("artist"))return normal(person.optString("tag"));}
        if(!p.artistTag.isBlank()&&Post.participantRole(p.artistTag,"").equals("artist"))return normal(p.artistTag);return "";}
    private static int minimumEvidence(int total){return total<12?1:Math.max(2,Math.min(8,(int)Math.ceil(log2(total+1)/2)));}
    private static double log2(double value){return Math.log(value)/Math.log(2);}
    private static double variety(String key,int seed){int hash=0x811c9dc5^seed;for(int i=0;i<key.length();i++)hash=(hash^key.charAt(i))*16777619;
        hash^=hash>>>16;hash*=0x7feb352d;hash^=hash>>>15;hash*=0x846ca68b;return Integer.toUnsignedLong(hash^(hash>>>16))/(double)0xffffffffL;}
    private static Set<String> keys(Post p){Set<String> keys=new LinkedHashSet<>(WorkGrouping.viewedTokens(p));keys.add(p.key());keys.addAll(p.memberKeys);return keys;}
    private static final class Canceled extends RuntimeException {Canceled(){super(null,null,false,false);}}
    private static void check(BooleanSupplier alive){if(Thread.currentThread().isInterrupted()||!alive.getAsBoolean())throw new Canceled();}
    private static final class Interest {final String tag;String query;int count,subjectCount;double weight,support;final Map<String,Integer> authors=new LinkedHashMap<>();
        Interest(String tag,String query){this.tag=tag;this.query=query;}}
    private static final class Record {final Set<String> tags;final String author;Record(Set<String> tags,String author){this.tags=tags;this.author=author;}}
    private static final class Pair {final String a,b;int count;double support,weight;String query;final Map<String,Integer> authors=new LinkedHashMap<>();Pair(String a,String b){this.a=a;this.b=b;}}
    private static final class Profile {final LinkedHashMap<String,Interest> byTag=new LinkedHashMap<>();final List<Interest> ordered=new ArrayList<>();
        final List<Record> records=new ArrayList<>();final Set<String> names=new LinkedHashSet<>(),copyrights=new LinkedHashSet<>();List<Post> grouped;int total;double supportTotal;}
    private static Profile profile(List<Post> liked,BooleanSupplier alive){Profile profile=new Profile();TagReader reader=new TagReader();Set<String> typed=new HashSet<>();Map<String,Integer> authorTotals=new LinkedHashMap<>();check(alive);
        List<Post> works=CatalogLogic.merge(List.of(),liked);profile.grouped=works;profile.total=works.size();int step=0;
        for(Post p:works){if((step++&31)==0)check(alive);String subject=reader.normal(p.relatedQuery),title=reader.normal(p.title);Set<String> tags=workTags(p,reader);Map<String,String> spellings=new LinkedHashMap<>();
            for(List<String> source:List.of(p.tags,p.characterTags,p.copyrightTags))for(String tag:source)spellings.putIfAbsent(reader.normal(tag),tag);
            for(String tag:p.characterTags){profile.names.add(reader.normal(tag));typed.add(reader.normal(tag));}for(String tag:p.copyrightTags)profile.copyrights.add(reader.normal(tag));
            if(p.characterTags.isEmpty()&&!profile.copyrights.contains(title)&&tags.contains(title)&&p.source.equals("danbooru"))profile.names.add(title);
            String author=author(p);if(author.isBlank())author=p.key();authorTotals.merge(author,1,Integer::sum);profile.records.add(new Record(tags,author));
            for(String tag:tags){String q=reader.query(spellings.getOrDefault(tag,tag));Interest entry=profile.byTag.computeIfAbsent(tag,value->new Interest(value,q));
                if(q.contains(":"))entry.query=q;entry.count++;entry.authors.merge(author,1,Integer::sum);entry.weight+=1+(tag.equals(subject)?4:0)+(tag.equals(title)?3:0);if(tag.equals(subject))entry.subjectCount++;}}
        for(String tag:profile.copyrights)if(!typed.contains(tag))profile.names.remove(tag);
        profile.ordered.addAll(profile.byTag.values());profile.ordered.sort(Comparator.<Interest>comparingInt(e->e.subjectCount>=2?1:0).reversed()
            .thenComparing(Comparator.comparingDouble((Interest e)->e.weight).reversed()).thenComparing(Comparator.comparingInt((Interest e)->e.count).reversed()));
        for(Interest e:profile.ordered)for(int count:e.authors.values())e.support+=Math.sqrt(count);
        for(int count:authorTotals.values())profile.supportTotal+=Math.sqrt(count);return profile;}
    private static Map<String,Double> weights(Profile profile,List<Post> liked,Map<String,String> preferences,List<Post> background){
        List<Post> ordinary=background;Map<String,Integer> prevalence=new HashMap<>();for(Post p:ordinary)for(String tag:workTags(p))prevalence.merge(tag,1,Integer::sum);
        Map<String,Double> weights=new LinkedHashMap<>();int minimum=minimumEvidence(profile.total),nameMinimum=Math.max(3,(int)Math.ceil(log2(liked.size()+1))-1);
        for(Interest e:profile.ordered){boolean priority="priority".equals(preferences.get(e.tag));if("disabled".equals(preferences.get(e.tag))||broad(e.tag)&&!priority||!priority&&e.support<minimum)continue;
            double weight=Math.max(.25,log2(e.support+1)-.75)*Math.pow(e.support/(e.support+1),2);
            weight*=profile.names.contains(e.tag)||profile.copyrights.contains(e.tag)?e.count<nameMinimum?.35:.9:1.45;
            if(ordinary.size()>=24&&!priority){double likedRate=(e.support+1)/((profile.supportTotal>0?profile.supportTotal:liked.size())+2),ordinaryRate=(prevalence.getOrDefault(e.tag,0)+1.)/(ordinary.size()+2);
                double specificity=Math.max(.08,Math.min(2.4,log2(1+likedRate/ordinaryRate)-.8)),confidence=ordinary.size()/(ordinary.size()+80.);weight*=1+(specificity-1)*confidence;}
            weights.put(e.tag,priority?Math.max(2.5,weight):weight);}
        for(Map.Entry<String,String> e:preferences.entrySet())if(e.getValue().equals("priority"))weights.putIfAbsent(e.getKey(),2.5);return weights;}
    private static List<Pair> combinations(Profile profile,List<Post> liked,Map<String,String> preferences,List<Post> background,Map<String,Double> weights,BooleanSupplier alive){
        if(profile.total<6)return List.of();int minimum=Math.max(3,Math.min(6,(int)Math.ceil(log2(profile.total+1)/2)));List<Interest> usable=new ArrayList<>();
        for(Interest e:profile.ordered)if(e.count>=minimum&&!"disabled".equals(preferences.get(e.tag))&&(!broad(e.tag)||"priority".equals(preferences.get(e.tag))))usable.add(e);
        Comparator<Interest> strength=Comparator.comparingDouble((Interest e)->e.support).reversed().thenComparing(e->e.tag);Set<String> focused=new HashSet<>();
        for(int kind=0;kind<3;kind++){final int k=kind;List<Interest> subset=new ArrayList<>();for(Interest e:usable)if(k==0?!profile.names.contains(e.tag)&&!profile.copyrights.contains(e.tag):k==1?profile.names.contains(e.tag):profile.copyrights.contains(e.tag))subset.add(e);
            subset.sort(strength);for(int i=0;i<Math.min(k==0?128:k==1?64:32,subset.size());i++)focused.add(subset.get(i).tag);}
        for(Interest e:usable)if("priority".equals(preferences.get(e.tag)))focused.add(e.tag);
        Map<String,String> phrases=new HashMap<>();for(String tag:focused)phrases.put(tag," "+tag+" ");Map<String,Map<String,Pair>> indexed=new HashMap<>();List<Pair> inserted=new ArrayList<>();int step=0;for(Record record:profile.records){if((step++&31)==0)check(alive);List<String> tags=new ArrayList<>();for(String tag:record.tags)if(focused.contains(tag))tags.add(tag);
            tags.sort(Comparator.<String>comparingInt(tag->"priority".equals(preferences.get(tag))?1:0).reversed()
                .thenComparing(Comparator.comparingInt((String tag)->profile.names.contains(tag)||profile.copyrights.contains(tag)?1:0).reversed())
                .thenComparing(Comparator.comparingDouble((String tag)->profile.byTag.get(tag).support).reversed()).thenComparing(tag->tag));
            for(int i=0;i<Math.min(20,tags.size());i++)for(int j=i+1;j<Math.min(20,tags.size());j++){String a=tags.get(i),b=tags.get(j);
                if((profile.names.contains(a)||profile.copyrights.contains(a))&&(profile.names.contains(b)||profile.copyrights.contains(b)))continue;
                if(phrases.get(a).contains(phrases.get(b))||phrases.get(b).contains(phrases.get(a)))continue;if(a.compareTo(b)>0){String swap=a;a=b;b=swap;}
                Map<String,Pair> seconds=indexed.computeIfAbsent(a,key->new HashMap<>());Pair pair=seconds.get(b);if(pair==null){pair=new Pair(a,b);seconds.put(b,pair);inserted.add(pair);}pair.count++;pair.authors.merge(record.author,1,Integer::sum);}}
        List<Pair> pending=new ArrayList<>();for(Pair p:inserted)if(p.count>=minimum&&p.authors.size()>=2){for(int count:p.authors.values())p.support+=Math.sqrt(count);pending.add(p);}
        pending.sort(Comparator.comparingDouble((Pair p)->p.support).reversed().thenComparing(p->p.a+"\u0000"+p.b));if(pending.size()>512)pending=new ArrayList<>(pending.subList(0,512));
        List<Set<String>> ordinary=new ArrayList<>();Map<String,Integer> prevalence=new HashMap<>();for(Post post:background){Set<String> tags=workTags(post);ordinary.add(tags);for(String tag:tags)prevalence.merge(tag,1,Integer::sum);}
        List<Pair> result=new ArrayList<>();for(Pair p:pending){if(!weights.containsKey(p.a)||!weights.containsKey(p.b))continue;Interest a=profile.byTag.get(p.a),b=profile.byTag.get(p.b);
            double expected=a.support*b.support/profile.supportTotal,association=log2((p.support+1)/(expected+1));
            if(ordinary.size()>=24&&prevalence.getOrDefault(p.a,0)>=3&&prevalence.getOrDefault(p.b,0)>=3){int together=0;for(Set<String> tags:ordinary)if(tags.contains(p.a)&&tags.contains(p.b))together++;
                double ordinaryExpected=prevalence.get(p.a)*(double)prevalence.get(p.b)/ordinary.size();association-=Math.max(0,log2((together+1)/(ordinaryExpected+1)))*ordinary.size()/(ordinary.size()+80.);}
            if(association<=.2)continue;double extra=Math.max(.2,Math.min(1,(1-p.count/(double)Math.min(a.count,b.count))*2));
            p.weight=extra*Math.sqrt(weights.get(p.a)*weights.get(p.b))*Math.min(2,association)*p.support/(p.support+4)*.55;p.query=a.query+" "+b.query;if(p.query.length()<=200)result.add(p);}
        result.sort(Comparator.comparingDouble((Pair p)->p.weight).reversed().thenComparing(Comparator.comparingInt((Pair p)->p.count).reversed()).thenComparing(p->p.query));
        return result.size()>256?new ArrayList<>(result.subList(0,256)):result;}
    private static Map<String,List<String>> queries(Profile profile,List<Post> liked,Map<String,String> preferences,Map<String,Double> weights,List<Pair> pairs){
        LinkedHashMap<String,List<Interest>> grouped=new LinkedHashMap<>();for(String k:List.of("priority","names","copyright","other"))grouped.put(k,new ArrayList<>());
        List<Interest> entries=new ArrayList<>(profile.ordered);for(Map.Entry<String,String> e:preferences.entrySet())if(!profile.byTag.containsKey(e.getKey()))entries.add(new Interest(e.getKey(),e.getKey().replace(' ','_')));
        boolean usableAtTwo=false;for(Interest e:entries)if((e.count>=2||preferences.containsKey(e.tag))&&weights.containsKey(e.tag)&&!"disabled".equals(preferences.get(e.tag))&&(!broad(e.tag)||"priority".equals(preferences.get(e.tag))))usableAtTwo=true;
        int nameMinimum=Math.max(3,(int)Math.ceil(log2(liked.size()+1))-1),contentMinimum=minimumEvidence(liked.size());
        List<Interest> fallbackNames=new ArrayList<>();for(Interest e:entries){if(e.count<(usableAtTwo?2:1)&&!preferences.containsKey(e.tag)||!weights.containsKey(e.tag)||"disabled".equals(preferences.get(e.tag))||broad(e.tag)&&!"priority".equals(preferences.get(e.tag)))continue;
            if("priority".equals(preferences.get(e.tag)))grouped.get("priority").add(e);
            else if(profile.names.contains(e.tag)){fallbackNames.add(e);if(e.count>=nameMinimum)grouped.get("names").add(e);}
            else if(profile.copyrights.contains(e.tag)){if(e.count>=nameMinimum)grouped.get("copyright").add(e);}
            else if(e.count>=contentMinimum)grouped.get("other").add(e);}
        grouped.get("priority").sort(Comparator.comparingInt((Interest e)->e.count).reversed());grouped.get("other").sort(Comparator.comparingDouble((Interest e)->weights.getOrDefault(e.tag,0.)).reversed().thenComparing(Comparator.comparingInt((Interest e)->e.count).reversed()));
        if(grouped.values().stream().allMatch(List::isEmpty)&&!fallbackNames.isEmpty())grouped.get("names").add(fallbackNames.get(0));
        Map<String,List<String>> result=new LinkedHashMap<>();for(Map.Entry<String,List<Interest>> e:grouped.entrySet()){List<String> values=new ArrayList<>();for(Interest i:e.getValue())values.add(i.query);result.put(e.getKey(),List.copyOf(values));}
        List<Pair> remaining=new ArrayList<>(pairs);Map<String,Integer> used=new HashMap<>();List<String> combinations=new ArrayList<>();while(!remaining.isEmpty()&&combinations.size()<24){int best=0;double bestScore=-1;
            for(int i=0;i<remaining.size();i++){Pair p=remaining.get(i);double score=p.weight/(1+(used.getOrDefault(p.a,0)+used.getOrDefault(p.b,0))*1.5);if(score>bestScore){best=i;bestScore=score;}}
            Pair p=remaining.remove(best);combinations.add(p.query);used.merge(p.a,1,Integer::sum);used.merge(p.b,1,Integer::sum);}result.put("combinations",List.copyOf(combinations));return Collections.unmodifiableMap(result);}
    private static final class Scored {final Post post;final double score,priority,variety;final int position;final String author;final Set<String> characters;
        Scored(Post p,double score,double priority,double variety,int position,Set<String> characters){post=p;this.score=score;this.priority=priority;this.variety=variety;this.position=position;this.characters=characters;author=author(p);}}
    /** Selects only possible grouping neighbors; WorkGrouping still decides every actual match. */
    private static final class KnownWorks {
        private static final class Entry {final List<Post> inputs;final Set<String> originalKeys;Set<String> indexKeys;Entry(List<Post> inputs,Set<String> keys){this.inputs=inputs;originalKeys=Set.copyOf(keys);indexKeys=originalKeys;}}
        private static final class State {final Post post;long signature;Set<String> tokens;Entry entry;State(Post post){this.post=post;signature=signature(post,0);tokens=keys(post);}}
        private static final class Evidence {final Set<String> liked,extra;Evidence(Set<String> liked,Set<String> extra){this.liked=liked;this.extra=extra;}}
        private Set<String> tokens;final Map<String,Set<Entry>> lookup=new HashMap<>();final IdentityHashMap<Post,Integer> positions=new IdentityHashMap<>();private final List<State> states=new ArrayList<>();
        KnownWorks(List<Post> liked,List<Post> grouped,BooleanSupplier alive){Set<String> tokens=new HashSet<>();Map<String,List<Post>> byKey=new HashMap<>();IdentityHashMap<Post,State> byPost=new IdentityHashMap<>();int i=0;
            for(Post post:liked){if((i&31)==0)check(alive);positions.put(post,i++);State state=new State(post);states.add(state);byPost.put(post,state);tokens.addAll(state.tokens);for(String key:FeedSession.keys(post))byKey.computeIfAbsent(key,k->new ArrayList<>()).add(post);}this.tokens=Set.copyOf(tokens);
            i=0;for(Post group:grouped){if((i++&31)==0)check(alive);Set<Post> inputs=new LinkedHashSet<>();for(String key:FeedSession.keys(group))inputs.addAll(byKey.getOrDefault(key,List.of()));Entry entry=new Entry(List.copyOf(inputs),potential(group,false,0));
                for(Post post:inputs)byPost.get(post).entry=entry;for(String key:entry.indexKeys)lookup.computeIfAbsent(key,k->new LinkedHashSet<>()).add(entry);}
        }
        private static void creator(Set<String> out,String tag){String value=CatalogLogic.normalizeTag(tag);if(!value.isBlank()&&!Set.of("artist request","unknown artist","anonymous artist","anonymous","unknown").contains(value))out.add("match.creator:"+value);}
        private static boolean hasCreator(Post post){for(int i=0;i<post.participants.length();i++){org.json.JSONObject person=post.participants.optJSONObject(i);if(person!=null&&Set.of("artist","animator").contains(Post.participantRole(person.optString("tag"),person.optString("role")))){Set<String> known=new HashSet<>();creator(known,person.optString("tag"));return !known.isEmpty();}}
            Set<String> known=new HashSet<>();if(Set.of("artist","animator").contains(Post.participantRole(post.artistTag,"")))creator(known,post.artistTag);return !known.isEmpty();}
        private static void sampleCreator(Set<String> out,String tag){String value=CatalogLogic.normalizeTag(tag);if(!value.isBlank())out.add("match.creator:"+value);}
        // This is a conservative lookup bucket. Grouping itself checks whether a
        // legacy uploader spelling is eligible, including padded old values.
        private static void uploader(Set<String> out,String source,String id){String value=id.trim().toLowerCase(Locale.ROOT);if(!value.isBlank())out.add("match.uploader:"+source+":"+value);}
        private static Set<String> potential(Post post,boolean candidate,int depth){Set<String> out=new HashSet<>(candidate?WorkGrouping.tokens(post):post.identityKeys);
            for(String key:FeedSession.keys(post))out.add("key:"+key);if(!post.hash.isBlank())out.add("hash:"+post.hash.toLowerCase(Locale.ROOT));
            if(Set.of("artist","animator").contains(Post.participantRole(post.artistTag,"")))creator(out,post.artistTag);
            for(String tag:post.artistTags)if(Set.of("artist","animator").contains(Post.participantRole(tag,"")))creator(out,tag);
            for(int i=0;i<post.participants.length();i++){org.json.JSONObject person=post.participants.optJSONObject(i);if(person!=null&&Set.of("artist","animator").contains(Post.participantRole(person.optString("tag"),person.optString("role"))))creator(out,person.optString("tag"));}
            if(!hasCreator(post)&&post.source.equals("rule34")&&post.visualHash.matches("(?i)[a-f0-9]{16}"))uploader(out,post.source,post.uploaderId);
            for(int i=0;i<post.visualSamples.length();i++){org.json.JSONObject sample=post.visualSamples.optJSONObject(i);if(sample==null)continue;sampleCreator(out,sample.optString("creator"));String owner=sample.optString("owner"),source=sample.optString("source",post.source),id=sample.optString("uploader");
                int at=owner.indexOf(":creator:");if(at>=0)sampleCreator(out,owner.substring(at+9));else if(owner.startsWith("creator:"))sampleCreator(out,owner.substring(8));
                at=owner.indexOf(":uploader:");if(id.isBlank()&&at>=0)id=owner.substring(at+10);else if(id.isBlank()&&source.equals("rule34")&&!owner.contains(":"))id=owner;if(source.equals("rule34"))uploader(out,source,id);}
            if(depth<1)for(Post member:post.groupMembers)out.addAll(potential(member,candidate,depth+1));return out;
        }
        private static long mix(long value,String text){value=(value^text.length())*1099511628211L;for(int i=0;i<text.length();i++)value=(value^text.charAt(i))*1099511628211L;return value;}
        /** Only lookup-relevant metadata: unchanged pages never rescan liked tags or serialize Posts. */
        private static long signature(Post p,int depth){long h=1469598103934665603L;for(String value:List.of(p.source,p.id,p.hash,p.groupKey,p.pixivGroupKey,p.originalUrl,p.image,p.artistTag,p.uploaderId,p.visualHash))h=mix(h,value);
            for(List<String> list:List.of(p.memberKeys,p.identityKeys,p.media,p.artistTags)){h=h*31+list.size();for(String value:list)h=mix(h,value);}h=h*31+p.tags.size();
            h=h*31+p.participants.length();for(int i=0;i<p.participants.length();i++){org.json.JSONObject person=p.participants.optJSONObject(i);if(person!=null){h=mix(h,person.optString("tag"));h=mix(h,person.optString("role"));}}
            h=h*31+p.imageRecords.length();for(int i=0;i<p.imageRecords.length();i++){org.json.JSONObject record=p.imageRecords.optJSONObject(i);if(record!=null){h=mix(h,record.optString("url"));h=mix(h,record.optString("hash"));}}
            h=h*31+p.visualSamples.length();for(int i=0;i<p.visualSamples.length();i++){org.json.JSONObject sample=p.visualSamples.optJSONObject(i);if(sample!=null)for(String name:List.of("hash","creator","owner","source","uploader"))h=mix(h,sample.optString(name));}
            if(depth<1)for(Post member:p.groupMembers)h=h*31+signature(member,depth+1);return h;}
        private void refresh(){Set<Entry> changed=new LinkedHashSet<>();boolean newTokens=false;for(State state:states){long signature=signature(state.post,0);if(signature==state.signature)continue;state.signature=signature;Set<String> next=keys(state.post);if(!next.equals(state.tokens)){state.tokens=next;newTokens=true;}if(state.entry!=null)changed.add(state.entry);}
            for(Entry entry:changed){Set<String> next=new HashSet<>(entry.originalKeys);for(Post post:entry.inputs)next.addAll(potential(post,true,0));for(String key:entry.indexKeys)if(!next.contains(key)){Set<Entry> old=lookup.get(key);old.remove(entry);if(old.isEmpty())lookup.remove(key);}for(String key:next)if(!entry.indexKeys.contains(key))lookup.computeIfAbsent(key,k->new LinkedHashSet<>()).add(entry);entry.indexKeys=next;}
            if(newTokens){Set<String> next=new HashSet<>();for(State state:states)next.addAll(state.tokens);tokens=Set.copyOf(next);}}
        List<Post> possible(List<Post> candidates){Set<Post> selected=new LinkedHashSet<>();Set<Entry> encountered=new LinkedHashSet<>();ArrayDeque<Entry> pending=new ArrayDeque<>();for(Post candidate:candidates)for(String key:potential(candidate,true,0))for(Entry entry:lookup.getOrDefault(key,Set.of()))if(encountered.add(entry))pending.add(entry);
            // A newly enriched publication can bridge previously separate liked
            // groups. Include its possible neighbors before applying the guards.
            while(!pending.isEmpty()){Entry entry=pending.removeFirst();selected.addAll(entry.inputs);for(String key:entry.indexKeys)for(Entry next:lookup.getOrDefault(key,Set.of()))if(encountered.add(next))pending.add(next);}
            List<Post> result=new ArrayList<>(selected);result.sort(Comparator.comparingInt(post->positions.get(post)));return result;}
        synchronized Evidence match(List<Post> candidates){refresh();List<Post> possible=possible(candidates);if(possible.isEmpty())return new Evidence(tokens,Set.of());Set<String> excluded=new HashSet<>();
            for(Post group:CatalogLogic.merge(possible,candidates)){Set<String> identity=keys(group);if(!Collections.disjoint(identity,tokens))excluded.addAll(identity);}return new Evidence(tokens,excluded);}
    }
    static final class Model {
        final List<String> queries;final Map<String,List<String>> queryGroups;final Map<String,Double> weights;final List<Pair> pairs;
        final Set<String> disabled,characterTags;final Map<String,String> preferences;final int seed;final List<Post> liked,background;private final Profile profile;private final KnownWorks known;
        Model(List<Post> liked,Map<String,String> preferences,int seed,List<Post> background,BooleanSupplier alive,Profile reused,KnownWorks known){this.liked=List.copyOf(liked);this.preferences=Map.copyOf(preferences);this.seed=seed;this.background=List.copyOf(background);
            check(alive);this.profile=reused==null?profile(liked,alive):reused;check(alive);this.known=known==null?new KnownWorks(liked,profile.grouped,alive):known;if(reused==null)profile.grouped=List.of();
            List<Post> ordinary=background.isEmpty()?List.of():CatalogLogic.merge(List.of(),background);check(alive);weights=Collections.unmodifiableMap(weights(profile,liked,preferences,ordinary));check(alive);pairs=List.copyOf(combinations(profile,liked,preferences,ordinary,weights,alive));check(alive);
            queryGroups=queries(profile,liked,preferences,weights,pairs);LinkedHashSet<String> combined=new LinkedHashSet<>();for(List<String> group:queryGroups.values())combined.addAll(group);queries=List.copyOf(combined);
            characterTags=Set.copyOf(profile.names);Set<String> blocked=new HashSet<>();for(Map.Entry<String,String> e:preferences.entrySet())if(e.getValue().equals("disabled"))blocked.add(e.getKey());
            disabled=Set.copyOf(blocked);}
        Model recalibrate(List<Post> background,BooleanSupplier alive){try{return new Model(liked,preferences,seed,background,alive,profile,known);}catch(Canceled stale){return null;}}
        List<Post> excludeLiked(List<Post> candidates){KnownWorks.Evidence evidence=known.match(candidates);List<Post> result=new ArrayList<>();for(Post post:candidates){Set<String> identity=keys(post);if(Collections.disjoint(identity,evidence.liked)&&Collections.disjoint(identity,evidence.extra))result.add(post);}return result;}
        private Set<String> candidateTags(Post p){Set<String> tags=workTags(p);for(String tag:rawTags(p))if("priority".equals(preferences.get(tag)))tags.add(tag);return tags;}
        List<Post> rank(List<Post> candidates,List<Post> existing,Set<String> recent){return rank(candidates,existing,recent,"all",Map.of(),System.currentTimeMillis());}
        List<Post> rank(List<Post> candidates,List<Post> existing,Set<String> recent,String rating,Map<String,Boolean> curation,long now){
            KnownWorks.Evidence evidence=known.match(candidates);Set<String> excluded=evidence.extra,likedTokens=evidence.liked,existingKeys=new HashSet<>();for(Post p:existing)existingKeys.addAll(keys(p));
            // Match native/desktop identities jointly; a mirror of a liked grouped variant remains excluded.
            List<Post> grouped=CatalogLogic.merge(List.of(),candidates);Map<String,Post> originals=new HashMap<>();Set<String> repeated=new HashSet<>();for(Post p:candidates)if(originals.put(p.key(),p)!=null)repeated.add(p.key());
            for(int i=0;i<grouped.size();i++){Post p=grouped.get(i);if(p.memberKeys.size()==1&&!repeated.contains(p.key()))grouped.set(i,originals.getOrDefault(p.key(),p));}
            Map<String,Double> boosts=Curation.boosts(grouped,curation,liked,preferences,weights,now);
            List<Scored> scored=new ArrayList<>();int position=0;for(Post p:grouped){Set<String> identity=keys(p);if(!Collections.disjoint(identity,likedTokens)||!Collections.disjoint(identity,excluded)||!Collections.disjoint(identity,existingKeys)||!CatalogLogic.matchesRating(p.rating,rating))continue;
                if(!Collections.disjoint(rawTags(p),disabled)||CatalogLogic.hidden(p,"all",disabled))continue;
                Set<String> tags=candidateTags(p);List<Double> contributions=new ArrayList<>();double priority=0;for(String tag:tags){double value=weights.getOrDefault(tag,0.);if(value>0)contributions.add(value);if("priority".equals(preferences.get(tag)))priority+=value;}
                contributions.sort(Comparator.reverseOrder());double single=0;for(int i=0;i<contributions.size();i++)single+=contributions.get(i)*(i<6?1:.1);if(single<=0)continue;
                double pairBonus=0;int pairCount=0;Set<String> paired=new HashSet<>();for(Pair pair:pairs)if(tags.contains(pair.a)&&tags.contains(pair.b)&&!paired.contains(pair.a)&&!paired.contains(pair.b)){pairBonus+=pair.weight*(pairCount++==0?1:.35);paired.add(pair.a);paired.add(pair.b);if(pairCount==3)break;}
                double score=single+Math.min(single*.05,pairBonus),v=seed==0?0:variety(p.key(),seed);score*=boosts.getOrDefault(p.key(),1.);
                if(!Collections.disjoint(identity,recent))score*=.2;if(seed!=0)score*=.6+v*.8;
                Set<String> characters=new HashSet<>();for(String tag:tags)if(characterTags.contains(tag)&&!"priority".equals(preferences.get(tag)))characters.add(tag);
                scored.add(new Scored(p,score,priority,v,position++,characters));}
            scored.sort(Comparator.<Scored>comparingInt(s->s.priority>0?1:0).reversed().thenComparing(Comparator.comparingDouble((Scored s)->s.score).reversed()).thenComparing(Comparator.comparingDouble((Scored s)->s.variety).reversed()).thenComparingInt(s->s.position));
            Map<String,Integer> authors=new HashMap<>(),characters=new HashMap<>();for(Post p:existing){String a=author(p);if(!a.isBlank())authors.merge(a,1,Integer::sum);for(String tag:candidateTags(p))if(characterTags.contains(tag))characters.merge(tag,1,Integer::sum);}
            List<Post> result=new ArrayList<>();while(!scored.isEmpty()){int best=0,bestPriority=-1;double bestScore=-1;for(int i=0;i<Math.min(256,scored.size());i++){Scored s=scored.get(i);int repeat=0;for(String tag:s.characters)repeat=Math.max(repeat,characters.getOrDefault(tag,0));
                    double adjusted=s.score/(1+repeat*1.8)/(1+(s.author.isBlank()?0:authors.getOrDefault(s.author,0))*.65);int priority=s.priority>0?1:0;if(priority>bestPriority||priority==bestPriority&&adjusted>bestScore){best=i;bestPriority=priority;bestScore=adjusted;}}
                Scored s=scored.remove(best);result.add(s.post);if(!s.author.isBlank())authors.merge(s.author,1,Integer::sum);for(String tag:s.characters)characters.merge(tag,1,Integer::sum);}return result;}
    }
    static Model build(List<Post> liked,Map<String,String> rawPreferences,int seed){return build(liked,rawPreferences,seed,List.of(),()->true);}
    static Model build(List<Post> liked,Map<String,String> rawPreferences,int seed,List<Post> background){return build(liked,rawPreferences,seed,background,()->true);}
    static Model build(List<Post> liked,Map<String,String> rawPreferences,int seed,BooleanSupplier alive){return build(liked,rawPreferences,seed,List.of(),alive);}
    static Model build(List<Post> liked,Map<String,String> rawPreferences,int seed,List<Post> background,BooleanSupplier alive){try{check(alive);Map<String,String> preferences=new LinkedHashMap<>();for(Map.Entry<String,String> e:rawPreferences.entrySet())if(e.getKey()!=null&&e.getValue()!=null&&Set.of("priority","disabled").contains(e.getValue()))preferences.put(normal(e.getKey()),e.getValue());return new Model(liked,preferences,seed,background,alive,null,null);}catch(Canceled stale){return null;}}
}
