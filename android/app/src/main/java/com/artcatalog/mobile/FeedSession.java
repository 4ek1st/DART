package com.artcatalog.mobile;

import java.util.*;
import java.util.function.Predicate;

/** Visibility changes affect new arrivals; a published prefix belongs to its visit. */
final class FeedSession {
    static Set<String> keys(Post post){Set<String> keys=new LinkedHashSet<>(post.memberKeys);keys.add(post.key());return keys;}
    static List<Post> visible(List<Post> published,List<Post> merged,Predicate<Post> allowFresh){
        Map<String,Post> byIdentity=new HashMap<>();
        for(Post p:merged)for(String key:keys(p))byIdentity.putIfAbsent(key,p);
        List<Post> result=new ArrayList<>();Set<String> used=new HashSet<>();
        for(Post original:published){
            Post current=null;for(String key:keys(original)){current=byIdentity.get(key);if(current!=null)break;}
            if(current==null)current=original;
            Set<String> tokens=keys(current);
            if(Collections.disjoint(used,tokens)){result.add(current);used.addAll(tokens);}
        }
        for(Post p:merged){Set<String> tokens=keys(p);
            if(Collections.disjoint(used,tokens)&&allowFresh.test(p)){result.add(p);used.addAll(tokens);}
        }
        return result;
    }
}
