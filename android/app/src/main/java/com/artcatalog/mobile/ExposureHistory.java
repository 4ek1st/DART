package com.artcatalog.mobile;

import java.util.*;

/** Shares the desktop's 512-work, 32-catalog-alias exposure budget. */
final class ExposureHistory {
    static final int MAX_WORKS=512,MAX_ALIASES=32;
    static boolean valid(String key){return key!=null&&key.matches("(?:(?:danbooru|gelbooru|rule34):[0-9]{1,24}|sankaku:[a-zA-Z0-9_-]{1,64})");}
    static List<List<String>> clean(Collection<? extends Collection<String>> values){
        List<List<String>> result=new ArrayList<>();
        for(Collection<String> group:values)result=append(result,group);
        return result;
    }
    static List<List<String>> append(List<List<String>> current,Collection<String> aliases){
        LinkedHashSet<String> keys=new LinkedHashSet<>();for(String key:aliases)if(valid(key)&&keys.size()<MAX_ALIASES)keys.add(key);
        if(keys.isEmpty())return new ArrayList<>(current);
        List<List<String>> next=new ArrayList<>();
        // An alias may bridge older groups. Repeat until all connected aliases are merged.
        Set<Integer> joined=new HashSet<>();boolean changed;
        do{changed=false;for(int i=0;i<current.size();i++)if(!joined.contains(i)&&!Collections.disjoint(keys,current.get(i))){
            joined.add(i);for(String key:current.get(i))if(valid(key)&&keys.size()<MAX_ALIASES)keys.add(key);changed=true;
        }}while(changed);
        for(int i=0;i<current.size();i++)if(!joined.contains(i))next.add(new ArrayList<>(current.get(i)));
        next.add(new ArrayList<>(keys));while(next.size()>MAX_WORKS)next.remove(0);return next;
    }
    static Set<String> keys(List<List<String>> groups){Set<String> keys=new LinkedHashSet<>();for(List<String> group:groups)keys.addAll(group);return keys;}
}
