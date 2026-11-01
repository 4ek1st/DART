package com.artcatalog.mobile;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** Bounded, source-relative curation factors shared with desktop recommendations. */
final class Curation {
    private Curation(){}
    private static boolean on(Map<String,Boolean> p,String key){return !Boolean.FALSE.equals(p.get(key));}
    private static double clamp(double value){return Math.max(-1,Math.min(1,value));}
    private static double log2(double value){return Math.log(value)/Math.log(2);}
    private static List<Post> members(Post p){LinkedHashMap<String,Post> out=new LinkedHashMap<>();for(Post member:p.groupMembers.isEmpty()?List.of(p):p.groupMembers)out.put(member.key(),member);return new ArrayList<>(out.values());}
    static long published(String raw){try{return Instant.parse(raw).toEpochMilli();}catch(Exception ignored){}try{return OffsetDateTime.parse(raw).toInstant().toEpochMilli();}catch(Exception ignored){}try{return ZonedDateTime.parse(raw,DateTimeFormatter.ofPattern("EEE MMM dd HH:mm:ss Z yyyy",Locale.US)).toInstant().toEpochMilli();}catch(Exception ignored){}return -1;}
    private static Map<String,Double> tasteWeights(List<Post> liked){Map<String,Map<String,Integer>> tags=new LinkedHashMap<>();Set<String> seen=new HashSet<>();
        for(Post p:liked){Set<String> identities=new HashSet<>(p.memberKeys);identities.add(p.key());if(!p.hash.isBlank())identities.add("hash:"+p.hash);if(!Collections.disjoint(identities,seen))continue;seen.addAll(identities);
            String author=Recommendations.author(p);if(author.isBlank())author=p.key();for(String tag:Recommendations.workTags(p))if(!Recommendations.broad(tag))tags.computeIfAbsent(tag,t->new LinkedHashMap<>()).merge(author,1,Integer::sum);}
        Map<String,Double> weights=new LinkedHashMap<>();for(Map.Entry<String,Map<String,Integer>> entry:tags.entrySet()){double support=0;for(int count:entry.getValue().values())support+=Math.sqrt(count);weights.put(entry.getKey(),Math.max(.25,log2(support+1)-.75)*support/(support+1));}return weights;}
    static Map<String,Double> boosts(List<Post> items,Map<String,Boolean> prefs,List<Post> liked,Map<String,String> tagPreferences,Map<String,Double> tagWeights,long now){
        LinkedHashMap<String,Double> boosts=new LinkedHashMap<>();for(Post p:items)boosts.put(p.key(),1.);if(!Boolean.TRUE.equals(prefs.get("enabled")))return boosts;
        double total=(on(prefs,"popularity")?.4:0)+(on(prefs,"personal")?.3:0)+(on(prefs,"freshness")?.15:0)+(on(prefs,"resolution")?.15:0);if(total==0)return boosts;
        Map<String,Map<String,Integer>> evidence=new HashMap<>(),votes=new HashMap<>();if(on(prefs,"popularity"))for(Post p:items){Map<String,Integer> perSource=new LinkedHashMap<>();for(Post member:members(p)){
            if(!Set.of("danbooru","gelbooru","rule34","sankaku").contains(member.source)||member.popularityCount==null)continue;String rating=CatalogLogic.normalizeRating(member.rating);if(rating.equals("s"))rating="g";
            String key=member.source+":"+rating;perSource.merge(key,member.popularityCount,Math::max);}evidence.put(p.key(),perSource);for(Map.Entry<String,Integer> e:perSource.entrySet())votes.computeIfAbsent(e.getKey(),key->new HashMap<>()).put(p.key(),e.getValue());}
        Map<String,Map<Integer,Double>> relative=new HashMap<>();for(Map.Entry<String,Map<String,Integer>> entry:votes.entrySet()){List<Integer> sorted=new ArrayList<>(entry.getValue().values());sorted.sort(Integer::compareTo);Map<Integer,Double> scores=new HashMap<>();
            for(int index=0;index<sorted.size();){int end=index+1;while(end<sorted.size()&&sorted.get(end).equals(sorted.get(index)))end++;double percentile=sorted.size()>1?(index+end-1.)/2/(sorted.size()-1):.5;
                scores.put(sorted.get(index),(percentile*2-1)*Math.min(1,(sorted.size()-1.)/7));index=end;}relative.put(entry.getKey(),scores);}
        Map<String,Double> personal=on(prefs,"personal")&&!liked.isEmpty()?tagWeights==null?tasteWeights(liked):tagWeights:null;double confidence=Math.min(1,liked.size()/8.);
        for(Post p:items){double sum=0;if(on(prefs,"popularity")){double values=0;int count=0;for(Map.Entry<String,Integer> e:evidence.getOrDefault(p.key(),Map.of()).entrySet()){double value=relative.get(e.getKey()).getOrDefault(e.getValue(),0.);if(value!=0){values+=value;count++;}}if(count>0)sum+=.4*values/count;}
            if(personal!=null){Set<String> tags=Recommendations.workTags(p);for(String tag:Recommendations.rawTags(p))if("priority".equals(tagPreferences.get(tag)))tags.add(tag);List<Double> matches=new ArrayList<>();for(String tag:tags){double weight="disabled".equals(tagPreferences.get(tag))?0:"priority".equals(tagPreferences.get(tag))?Math.max(2.5,personal.getOrDefault(tag,0.)):personal.getOrDefault(tag,0.);if(weight>0)matches.add(weight);}
                matches.sort(Comparator.reverseOrder());double score=0;for(int i=0;i<Math.min(6,matches.size());i++)score+=matches.get(i);sum+=.3*score/(score+4)*confidence;}
            List<Post> leaves=members(p);if(on(prefs,"freshness")){long oldest=Long.MAX_VALUE;for(Post member:leaves){long date=published(member.published);if(date>0&&date<=now+3600000)oldest=Math.min(oldest,date);}if(oldest<Long.MAX_VALUE){double days=Math.max(0,(now-oldest)/86400000.);sum+=.15*clamp(1-Math.log1p(days)/Math.log(91));}}
            if(on(prefs,"resolution")&&Collections.disjoint(Recommendations.rawTags(p),Set.of("pixel art","pixel perfect","sketch","lineart","line art","oekaki"))){int size=0;for(Post member:leaves)if(member.width>0&&member.height>0&&member.width<=100000&&member.height<=100000)size=Math.max(size,Math.min(member.width,member.height));if(size>0)sum+=.15*clamp(log2(size/900.)/2);}
            boosts.put(p.key(),1+.45*sum/total);}
        return boosts;
    }
    static List<Post> rank(List<Post> items,Map<String,Boolean> prefs,List<Post> liked,Map<String,String> tagPreferences,long now){if(!Boolean.TRUE.equals(prefs.get("enabled")))return items;
        Map<String,Double> scores=boosts(items,prefs,liked,tagPreferences,null,now);List<Post> result=new ArrayList<>(items);result.sort(Comparator.comparingDouble((Post p)->scores.getOrDefault(p.key(),1.)).reversed());return result;}
}
