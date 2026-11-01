package com.artcatalog.mobile;

import java.text.Normalizer;
import java.util.*;

/** Native implementation of DART desktop 0.2.53 recommendation mathematics.
 * Build/rank only on the grouping executor; all returned model state is a snapshot. */
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
    static String normal(String text){return spaces(Normalizer.normalize(text==null?"":text,Normalizer.Form.NFKC)
        .toLowerCase(Locale.ROOT).replace('_',' ').replace(':',' '),' ');}
    private static String query(String text){return spaces(Normalizer.normalize(text,Normalizer.Form.NFKC)
        .toLowerCase(Locale.ROOT),'_');}
    // Android's ICU regex engine does not support Java's (?U) switch. Explicit
    // Unicode spaces also keep this normalization identical in JVM and ART.
    private static String spaces(String text,char separator){StringBuilder result=new StringBuilder(text.length());boolean pending=false;
        for(int i=0;i<text.length();i++){char ch=text.charAt(i);if(Character.isWhitespace(ch)||Character.isSpaceChar(ch)||ch=='\ufeff'){pending=true;continue;}
            if(pending&&result.length()>0)result.append(separator);result.append(ch);pending=false;}return result.toString();}
    static boolean broad(String tag){return BROAD.contains(tag)||
        tag.matches("(?:(?:very|extremely|absolutely|incredibly|ridiculously|ultra) )*(?:lowres|highres|absurdres|(?:low|high|absurd|huge|original|full) resolution)")||
        tag.matches("(?:(?:very|extremely|ultra|large|huge|massive|small|medium|high|low) )*(?:filesize|file size)")||
        tag.matches("(?:black|brown|blonde|red|blue|green|grey|gray|white|pink|purple|silver|orange|yellow|golden|multicolored) (?:hair|eyes)");}
    static Set<String> rawTags(Post p){LinkedHashSet<String> out=new LinkedHashSet<>();for(List<String> source:List.of(p.tags,p.characterTags,p.copyrightTags))
        for(String tag:source)out.add(normal(tag));return out;}
    static Set<String> workTags(Post p){Set<String> authors=new HashSet<>();for(String tag:p.artistTags)authors.add(normal(tag));
        authors.add(normal(p.artistTag));for(int i=0;i<p.participants.length();i++){org.json.JSONObject person=p.participants.optJSONObject(i);if(person!=null)authors.add(normal(person.optString("tag")));}
        LinkedHashSet<String> result=new LinkedHashSet<>();for(String tag:rawTags(p))if(tag.length()>=3&&!GENERIC.contains(tag)&&
            !tag.matches("\\d+(?:girls?|boys?)")&&!tag.matches("\\d+")&&!authors.contains(tag)&&
            !tag.matches("(?:.* commentary|commission|translated|translation request|tagme|artist name|signature|watermark)"))result.add(tag);return result;}
    static String author(Post p){for(int i=0;i<p.participants.length();i++){org.json.JSONObject person=p.participants.optJSONObject(i);if(person!=null&&Post.participantRole(person.optString("tag"),person.optString("role")).equals("artist"))return normal(person.optString("tag"));}
        if(!p.artistTag.isBlank()&&Post.participantRole(p.artistTag,"").equals("artist"))return normal(p.artistTag);return "";}
    private static int minimumEvidence(int total){return total<12?1:Math.max(2,Math.min(8,(int)Math.ceil(log2(total+1)/2)));}
    private static double log2(double value){return Math.log(value)/Math.log(2);}
    private static double variety(String key,int seed){int hash=0x811c9dc5^seed;for(int i=0;i<key.length();i++)hash=(hash^key.charAt(i))*16777619;
        hash^=hash>>>16;hash*=0x7feb352d;hash^=hash>>>15;hash*=0x846ca68b;return Integer.toUnsignedLong(hash^(hash>>>16))/(double)0xffffffffL;}
    private static Set<String> keys(Post p){Set<String> keys=new LinkedHashSet<>(WorkGrouping.viewedTokens(p));keys.add(p.key());keys.addAll(p.memberKeys);return keys;}
    private static final class Interest {final String tag;String query;int count,subjectCount;double weight,support;final Map<String,Integer> authors=new LinkedHashMap<>();
        Interest(String tag,String query){this.tag=tag;this.query=query;}}
    private static final class Record {final Set<String> tags;final String author;Record(Set<String> tags,String author){this.tags=tags;this.author=author;}}
    private static final class Pair {final String a,b;int count;double support,weight;String query;final Map<String,Integer> authors=new LinkedHashMap<>();Pair(String a,String b){this.a=a;this.b=b;}}
    private static final class Profile {final LinkedHashMap<String,Interest> byTag=new LinkedHashMap<>();final List<Interest> ordered=new ArrayList<>();
        final List<Record> records=new ArrayList<>();final Set<String> names=new LinkedHashSet<>(),copyrights=new LinkedHashSet<>();int total;double supportTotal;}
    private static Profile profile(List<Post> liked){Profile profile=new Profile();Set<String> typed=new HashSet<>();Map<String,Integer> authorTotals=new LinkedHashMap<>();
        List<Post> works=CatalogLogic.merge(List.of(),liked);profile.total=works.size();
        for(Post p:works){String subject=normal(p.relatedQuery),title=normal(p.title);Set<String> tags=workTags(p);Map<String,String> spellings=new LinkedHashMap<>();
            for(List<String> source:List.of(p.tags,p.characterTags,p.copyrightTags))for(String tag:source)spellings.putIfAbsent(normal(tag),tag);
            for(String tag:p.characterTags){profile.names.add(normal(tag));typed.add(normal(tag));}for(String tag:p.copyrightTags)profile.copyrights.add(normal(tag));
            if(p.characterTags.isEmpty()&&!profile.copyrights.contains(title)&&tags.contains(title)&&p.source.equals("danbooru"))profile.names.add(title);
            String author=author(p);if(author.isBlank())author=p.key();authorTotals.merge(author,1,Integer::sum);profile.records.add(new Record(tags,author));
            for(String tag:tags){String q=query(spellings.getOrDefault(tag,tag));Interest entry=profile.byTag.computeIfAbsent(tag,value->new Interest(value,q));
                if(q.contains(":"))entry.query=q;entry.count++;entry.authors.merge(author,1,Integer::sum);entry.weight+=1+(tag.equals(subject)?4:0)+(tag.equals(title)?3:0);if(tag.equals(subject))entry.subjectCount++;}}
        for(String tag:profile.copyrights)if(!typed.contains(tag))profile.names.remove(tag);
        profile.ordered.addAll(profile.byTag.values());profile.ordered.sort(Comparator.<Interest>comparingInt(e->e.subjectCount>=2?1:0).reversed()
            .thenComparing(Comparator.comparingDouble((Interest e)->e.weight).reversed()).thenComparing(Comparator.comparingInt((Interest e)->e.count).reversed()));
        for(Interest e:profile.ordered)for(int count:e.authors.values())e.support+=Math.sqrt(count);
        for(int count:authorTotals.values())profile.supportTotal+=Math.sqrt(count);return profile;}
    private static Map<String,Double> weights(Profile profile,List<Post> liked,Map<String,String> preferences,List<Post> background){
        List<Post> ordinary=CatalogLogic.merge(List.of(),background);Map<String,Integer> prevalence=new HashMap<>();for(Post p:ordinary)for(String tag:workTags(p))prevalence.merge(tag,1,Integer::sum);
        Map<String,Double> weights=new LinkedHashMap<>();int minimum=minimumEvidence(profile.total),nameMinimum=Math.max(3,(int)Math.ceil(log2(liked.size()+1))-1);
        for(Interest e:profile.ordered){boolean priority="priority".equals(preferences.get(e.tag));if("disabled".equals(preferences.get(e.tag))||broad(e.tag)&&!priority||!priority&&e.support<minimum)continue;
            double weight=Math.max(.25,log2(e.support+1)-.75)*Math.pow(e.support/(e.support+1),2);
            weight*=profile.names.contains(e.tag)||profile.copyrights.contains(e.tag)?e.count<nameMinimum?.35:.9:1.45;
            if(ordinary.size()>=24&&!priority){double likedRate=(e.support+1)/((profile.supportTotal>0?profile.supportTotal:liked.size())+2),ordinaryRate=(prevalence.getOrDefault(e.tag,0)+1.)/(ordinary.size()+2);
                double specificity=Math.max(.08,Math.min(2.4,log2(1+likedRate/ordinaryRate)-.8)),confidence=ordinary.size()/(ordinary.size()+80.);weight*=1+(specificity-1)*confidence;}
            weights.put(e.tag,priority?Math.max(2.5,weight):weight);}
        for(Map.Entry<String,String> e:preferences.entrySet())if(e.getValue().equals("priority"))weights.putIfAbsent(e.getKey(),2.5);return weights;}
    private static List<Pair> combinations(Profile profile,List<Post> liked,Map<String,String> preferences,List<Post> background,Map<String,Double> weights){
        if(profile.total<6)return List.of();int minimum=Math.max(3,Math.min(6,(int)Math.ceil(log2(profile.total+1)/2)));List<Interest> usable=new ArrayList<>();
        for(Interest e:profile.ordered)if(e.count>=minimum&&!"disabled".equals(preferences.get(e.tag))&&(!broad(e.tag)||"priority".equals(preferences.get(e.tag))))usable.add(e);
        Comparator<Interest> strength=Comparator.comparingDouble((Interest e)->e.support).reversed().thenComparing(e->e.tag);Set<String> focused=new HashSet<>();
        for(int kind=0;kind<3;kind++){final int k=kind;List<Interest> subset=new ArrayList<>();for(Interest e:usable)if(k==0?!profile.names.contains(e.tag)&&!profile.copyrights.contains(e.tag):k==1?profile.names.contains(e.tag):profile.copyrights.contains(e.tag))subset.add(e);
            subset.sort(strength);for(int i=0;i<Math.min(k==0?128:k==1?64:32,subset.size());i++)focused.add(subset.get(i).tag);}
        for(Interest e:usable)if("priority".equals(preferences.get(e.tag)))focused.add(e.tag);
        Map<String,Pair> indexed=new LinkedHashMap<>();for(Record record:profile.records){List<String> tags=new ArrayList<>();for(String tag:record.tags)if(focused.contains(tag))tags.add(tag);
            tags.sort(Comparator.<String>comparingInt(tag->"priority".equals(preferences.get(tag))?1:0).reversed()
                .thenComparing(Comparator.comparingInt((String tag)->profile.names.contains(tag)||profile.copyrights.contains(tag)?1:0).reversed())
                .thenComparing(Comparator.comparingDouble((String tag)->profile.byTag.get(tag).support).reversed()).thenComparing(tag->tag));
            for(int i=0;i<Math.min(20,tags.size());i++)for(int j=i+1;j<Math.min(20,tags.size());j++){String a=tags.get(i),b=tags.get(j);
                if((profile.names.contains(a)||profile.copyrights.contains(a))&&(profile.names.contains(b)||profile.copyrights.contains(b)))continue;
                if((" "+a+" ").contains(" "+b+" ")||(" "+b+" ").contains(" "+a+" "))continue;if(a.compareTo(b)>0){String swap=a;a=b;b=swap;}
                String pairKey=a+"\u0000"+b;Pair pair=indexed.get(pairKey);if(pair==null){pair=new Pair(a,b);indexed.put(pairKey,pair);}pair.count++;pair.authors.merge(record.author,1,Integer::sum);}}
        List<Pair> pending=new ArrayList<>();for(Pair p:indexed.values())if(p.count>=minimum&&p.authors.size()>=2){for(int count:p.authors.values())p.support+=Math.sqrt(count);pending.add(p);}
        pending.sort(Comparator.comparingDouble((Pair p)->p.support).reversed().thenComparing(p->p.a+"\u0000"+p.b));if(pending.size()>512)pending=new ArrayList<>(pending.subList(0,512));
        List<Set<String>> ordinary=new ArrayList<>();Map<String,Integer> prevalence=new HashMap<>();for(Post post:CatalogLogic.merge(List.of(),background)){Set<String> tags=workTags(post);ordinary.add(tags);for(String tag:tags)prevalence.merge(tag,1,Integer::sum);}
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
    static final class Model {
        final List<String> queries;final Map<String,List<String>> queryGroups;final Map<String,Double> weights;final List<Pair> pairs;
        final Set<String> disabled,likedTokens,characterTags;final Map<String,String> preferences;final int seed;final List<Post> liked,background;
        Model(List<Post> liked,Map<String,String> preferences,int seed,List<Post> background){this.liked=List.copyOf(liked);this.preferences=Map.copyOf(preferences);this.seed=seed;this.background=List.copyOf(background);
            Profile profile=profile(liked);weights=Collections.unmodifiableMap(weights(profile,liked,preferences,background));pairs=List.copyOf(combinations(profile,liked,preferences,background,weights));
            queryGroups=queries(profile,liked,preferences,weights,pairs);LinkedHashSet<String> combined=new LinkedHashSet<>();for(List<String> group:queryGroups.values())combined.addAll(group);queries=List.copyOf(combined);
            characterTags=Set.copyOf(profile.names);Set<String> blocked=new HashSet<>(),tokens=new HashSet<>();for(Map.Entry<String,String> e:preferences.entrySet())if(e.getValue().equals("disabled"))blocked.add(e.getKey());
            for(Post p:liked)tokens.addAll(keys(p));disabled=Set.copyOf(blocked);likedTokens=Set.copyOf(tokens);}
        private Set<String> candidateTags(Post p){Set<String> tags=workTags(p);for(String tag:rawTags(p))if("priority".equals(preferences.get(tag)))tags.add(tag);return tags;}
        List<Post> rank(List<Post> candidates,List<Post> existing,Set<String> recent){return rank(candidates,existing,recent,"all",Map.of(),System.currentTimeMillis());}
        List<Post> rank(List<Post> candidates,List<Post> existing,Set<String> recent,String rating,Map<String,Boolean> curation,long now){
            Set<String> excluded=new HashSet<>(likedTokens),existingKeys=new HashSet<>();for(Post p:existing)existingKeys.addAll(keys(p));
            // Match native/desktop identities jointly; a mirror of a liked grouped variant remains excluded.
            for(Post p:CatalogLogic.merge(liked,candidates))if(!Collections.disjoint(keys(p),likedTokens))excluded.addAll(keys(p));
            List<Post> grouped=CatalogLogic.merge(List.of(),candidates);Map<String,Post> originals=new HashMap<>();Set<String> repeated=new HashSet<>();for(Post p:candidates)if(originals.put(p.key(),p)!=null)repeated.add(p.key());
            for(int i=0;i<grouped.size();i++){Post p=grouped.get(i);if(p.memberKeys.size()==1&&!repeated.contains(p.key()))grouped.set(i,originals.getOrDefault(p.key(),p));}
            Map<String,Double> boosts=Curation.boosts(grouped,curation,liked,preferences,weights,now);
            List<Scored> scored=new ArrayList<>();int position=0;for(Post p:grouped){Set<String> identity=keys(p);if(!Collections.disjoint(identity,excluded)||!Collections.disjoint(identity,existingKeys)||!CatalogLogic.matchesRating(p.rating,rating))continue;
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
    static Model build(List<Post> liked,Map<String,String> rawPreferences,int seed){return build(liked,rawPreferences,seed,List.of());}
    static Model build(List<Post> liked,Map<String,String> rawPreferences,int seed,List<Post> background){Map<String,String> preferences=new LinkedHashMap<>();for(Map.Entry<String,String> e:rawPreferences.entrySet())if(e.getKey()!=null&&e.getValue()!=null&&Set.of("priority","disabled").contains(e.getValue()))preferences.put(normal(e.getKey()),e.getValue());return new Model(liked,preferences,seed,background);}
}
