package com.artcatalog.mobile;

import java.util.*;

/** Local recommendation model. Build and rank it on the grouping executor. */
final class Recommendations {
    private static final Set<String> BROAD=Set.of("1girl","1boy","solo","2girls","multiple girls",
        "highres","absurdres","original","commentary","commentary request","artist name",
        "signature","watermark","rating safe","rating explicit","tagme","artist request",
        "source request","looking at viewer","smile","standing","breasts");
    private static final class Interest {
        final String tag;String query;int count;double support;boolean character,copyright;
        final Map<String,Integer> authors=new HashMap<>();
        Interest(String tag,String query){this.tag=tag;this.query=query;}
    }
    private static final class Pair {
        final String a,b;final Map<String,Integer> authors=new HashMap<>();int count;double weight;
        Pair(String a,String b){this.a=a;this.b=b;}
    }
    private static final class Record {
        final Set<String> tags;final String author;
        Record(Set<String> tags,String author){this.tags=tags;this.author=author;}
    }
    private static final class Scored {
        final Post post;final double score,priority;final int position;final String author;
        final Set<String> characters;
        Scored(Post post,double score,double priority,int position,Set<String> characters){
            this.post=post;this.score=score;this.priority=priority;this.position=position;
            this.author=author(post);this.characters=characters;
        }
    }
    static final class Model {
        final List<String> queries;final Map<String,Double> weights;final List<Pair> pairs;
        final Set<String> disabled,likedTokens,characterTags;final Map<String,String> preferences;
        final int seed;
        Model(List<String> queries,Map<String,Double> weights,List<Pair> pairs,Set<String> disabled,
              Set<String> likedTokens,Set<String> characterTags,Map<String,String> preferences,int seed){
            this.queries=List.copyOf(queries);this.weights=Map.copyOf(weights);this.pairs=List.copyOf(pairs);
            this.disabled=Set.copyOf(disabled);this.likedTokens=Set.copyOf(likedTokens);
            this.characterTags=Set.copyOf(characterTags);this.preferences=Map.copyOf(preferences);this.seed=seed;
        }
        List<Post> rank(List<Post> candidates,List<Post> existing,Set<String> recentlySuggested){
            Set<String> usedTokens=new HashSet<>(likedTokens);
            for(Post post:existing)usedTokens.addAll(WorkGrouping.tokens(post));
            Set<String> seenTokens=new HashSet<>();List<Scored> scored=new ArrayList<>();int position=0;
            for(Post post:candidates){
                Set<String> identity=WorkGrouping.tokens(post);
                if(!Collections.disjoint(usedTokens,identity)||!Collections.disjoint(seenTokens,identity))continue;
                seenTokens.addAll(identity);
                Set<String> tags=tags(post);if(!Collections.disjoint(tags,disabled))continue;
                List<Double> matches=new ArrayList<>();double priority=0;
                for(String tag:tags){Double value=weights.get(tag);if(value==null)continue;matches.add(value);
                    if("priority".equals(preferences.get(tag)))priority+=value;}
                if(matches.isEmpty()&&!weights.isEmpty())continue;
                matches.sort(Comparator.reverseOrder());double single=0;
                for(int i=0;i<matches.size();i++)single+=matches.get(i)*(i<6?1:.1);
                double pairBonus=0;int pairCount=0;Set<String> paired=new HashSet<>();
                for(Pair pair:pairs)if(tags.contains(pair.a)&&tags.contains(pair.b)&&
                    !paired.contains(pair.a)&&!paired.contains(pair.b)){
                    pairBonus+=pair.weight*(pairCount++==0?1:.35);paired.add(pair.a);paired.add(pair.b);
                    if(pairCount==3)break;
                }
                double score=weights.isEmpty()?1:single+Math.min(single*.05,pairBonus);
                if(!Collections.disjoint(identity,recentlySuggested))score*=.2;
                if(seed!=0)score*=.6+variety(post.key(),seed)*.8;
                Set<String> characters=new HashSet<>(tags);characters.retainAll(characterTags);
                scored.add(new Scored(post,score,priority,position++,characters));
            }
            scored.sort(Comparator.<Scored>comparingDouble(item->item.priority>0?1:0).reversed()
                .thenComparing(Comparator.comparingDouble((Scored item)->item.score).reversed())
                .thenComparingInt(item->item.position));
            Map<String,Integer> authorCount=new HashMap<>(),characterCount=new HashMap<>();
            for(Post post:existing){authorCount.merge(author(post),1,Integer::sum);
                Set<String> matching=tags(post);matching.retainAll(characterTags);
                for(String tag:matching)characterCount.merge(tag,1,Integer::sum);}
            List<Post> result=new ArrayList<>();
            while(!scored.isEmpty()){
                int best=0;double bestValue=-1;boolean havePriority=scored.get(0).priority>0;
                for(int i=0;i<Math.min(256,scored.size());i++){
                    Scored entry=scored.get(i);if(havePriority&&entry.priority==0)break;
                    int repeat=0;for(String tag:entry.characters)repeat=Math.max(repeat,characterCount.getOrDefault(tag,0));
                    double value=entry.score/(1+repeat*1.8)/(1+authorCount.getOrDefault(entry.author,0)*.65);
                    if(value>bestValue){best=i;bestValue=value;}
                }
                Scored selected=scored.remove(best);result.add(selected.post);
                authorCount.merge(selected.author,1,Integer::sum);
                for(String tag:selected.characters)characterCount.merge(tag,1,Integer::sum);
            }
            return result;
        }
    }
    private static String normal(String tag){return CatalogLogic.normalizeTag(tag);}
    private static String query(String tag){return tag.trim().toLowerCase(Locale.ROOT).replace(' ','_');}
    private static Set<String> tags(Post post){Set<String> result=new LinkedHashSet<>();
        for(String tag:post.tags)result.add(normal(tag));for(String tag:post.characterTags)result.add(normal(tag));
        for(String tag:post.copyrightTags)result.add(normal(tag));return result;}
    private static String author(Post post){return !post.artistTag.isBlank()?normal(post.artistTag):post.key();}
    private static double variety(String key,int seed){long hash=(2166136261L^seed)&0xffffffffL;
        for(int i=0;i<key.length();i++)hash=((hash^key.charAt(i))*16777619L)&0xffffffffL;
        return hash/(double)0xffffffffL;}

    static Model build(List<Post> liked,Map<String,String> rawPreferences,int seed){
        Map<String,String> preferences=new LinkedHashMap<>();
        for(Map.Entry<String,String> entry:rawPreferences.entrySet())if(Set.of("priority","disabled").contains(entry.getValue()))
            preferences.put(normal(entry.getKey()),entry.getValue());
        Set<String> disabled=new HashSet<>(),likedTokens=new HashSet<>(),characterTags=new HashSet<>();
        for(Map.Entry<String,String> entry:preferences.entrySet())if(entry.getValue().equals("disabled"))disabled.add(entry.getKey());
        LinkedHashMap<String,Interest> profile=new LinkedHashMap<>();List<Record> records=new ArrayList<>();
        Set<String> authors=new HashSet<>();
        for(Post post:liked){Set<String> identity=WorkGrouping.tokens(post);
            if(!Collections.disjoint(identity,likedTokens))continue;likedTokens.addAll(identity);
            String author=author(post);authors.add(author);Set<String> workTags=tags(post);
            for(String tag:post.characterTags)characterTags.add(normal(tag));
            for(String artist:post.artistTags)workTags.remove(normal(artist));
            workTags.remove(normal(post.artistTag));
            records.add(new Record(workTags,author));
            for(String tag:workTags){if(tag.length()<3||tag.length()>100)continue;
                boolean broad=BROAD.contains(tag)||tag.endsWith(" resolution");
                if(broad&&!"priority".equals(preferences.get(tag)))continue;
                Interest entry=profile.computeIfAbsent(tag,name->new Interest(name,query(name)));
                String original=post.tags.stream().filter(value->normal(value).equals(tag)).findFirst().orElse(tag);
                if(original.contains(":"))entry.query=query(original);
                entry.count++;entry.authors.merge(author,1,Integer::sum);
                if(post.characterTags.stream().anyMatch(value->normal(value).equals(tag)))entry.character=true;
                if(post.copyrightTags.stream().anyMatch(value->normal(value).equals(tag)))entry.copyright=true;
            }
        }
        for(Interest entry:profile.values())for(int count:entry.authors.values())entry.support+=Math.sqrt(count);
        int likedCount=records.size();double totalSupport=authors.size();
        Map<String,Double> weights=new HashMap<>();
        for(Interest entry:profile.values()){
            if(disabled.contains(entry.tag))continue;
            double value=entry.support/Math.sqrt(Math.max(1,totalSupport));
            value*=entry.character?1.8:entry.copyright?1.4:1;
            if("priority".equals(preferences.get(entry.tag)))value*=2.5;
            weights.put(entry.tag,value);
        }
        List<Interest> selected=new ArrayList<>(profile.values());selected.removeIf(item->disabled.contains(item.tag)||
            item.count<Math.max(1,Math.min(3,likedCount/6))&&!"priority".equals(preferences.get(item.tag)));
        selected.sort(Comparator.<Interest>comparingInt(item->"priority".equals(preferences.get(item.tag))?1:0).reversed()
            .thenComparing(Comparator.comparingDouble((Interest item)->weights.getOrDefault(item.tag,0.)).reversed()));
        List<Pair> pairs=new ArrayList<>();
        if(likedCount>=6){Map<String,Pair> indexed=new HashMap<>();Set<String> focused=new HashSet<>();
            for(int i=0;i<Math.min(96,selected.size());i++)focused.add(selected.get(i).tag);
            for(Record record:records){List<String> common=new ArrayList<>(record.tags);common.removeIf(tag->!focused.contains(tag));
                common.sort(Comparator.comparingDouble((String tag)->weights.getOrDefault(tag,0.)).reversed());
                if(common.size()>20)common=common.subList(0,20);
                for(int i=0;i<common.size();i++)for(int j=i+1;j<common.size();j++){
                    String a=common.get(i),b=common.get(j);if(characterTags.contains(a)&&characterTags.contains(b))continue;
                    if(a.contains(b)||b.contains(a))continue;if(a.compareTo(b)>0){String swap=a;a=b;b=swap;}
                    String key=a+"\u0000"+b;Pair pair=indexed.get(key);
                    if(pair==null){pair=new Pair(a,b);indexed.put(key,pair);}
                    pair.count++;pair.authors.merge(record.author,1,Integer::sum);
                }
            }
            int minimum=Math.max(3,Math.min(6,(int)Math.ceil(Math.log(likedCount+1)/Math.log(2)/2)));
            for(Pair pair:indexed.values()){
                if(pair.count<minimum||pair.authors.size()<2)continue;
                Interest a=profile.get(pair.a),b=profile.get(pair.b);if(a==null||b==null)continue;
                double support=0;for(int count:pair.authors.values())support+=Math.sqrt(count);
                double expected=a.support*b.support/Math.max(1,totalSupport);
                double association=Math.log((support+1)/(expected+1))/Math.log(2);
                if(association<=.2)continue;
                double distinct=Math.max(.2,Math.min(1,(1-pair.count/(double)Math.min(a.count,b.count))*2));
                pair.weight=distinct*Math.sqrt(weights.getOrDefault(pair.a,0.)*weights.getOrDefault(pair.b,0.))
                    *Math.min(2,association)*support/(support+4)*.55;
                if(pair.weight>0)pairs.add(pair);
            }
            pairs.sort(Comparator.comparingDouble((Pair item)->item.weight).reversed());
        }
        LinkedHashSet<String> queries=new LinkedHashSet<>();
        for(int i=0;i<Math.min(24,selected.size());i++)queries.add(selected.get((i+Math.floorMod(seed,selected.size()))%selected.size()).query);
        for(int i=0;i<Math.min(12,pairs.size());i++){
            Pair pair=pairs.get(i);String combined=profile.get(pair.a).query+" "+profile.get(pair.b).query;
            if(combined.length()<=200)queries.add(combined);
        }
        return new Model(new ArrayList<>(queries),weights,pairs,disabled,likedTokens,characterTags,preferences,seed);
    }
}
