package com.artcatalog.mobile;

import java.util.*;

/** Locate the same visible artwork after two-column rows are regrouped. */
final class FeedViewport {
    static final class Anchor {
        final List<String> keys;final int position,top;
        Anchor(List<String> keys,int position,int top){this.keys=List.copyOf(keys);this.position=position;this.top=top;}
    }
    static Anchor restore(List<Anchor> visible,List<List<String>> rows){
        Map<String,Integer> positions=new HashMap<>();
        for(int i=0;i<rows.size();i++)for(String key:rows.get(i))positions.putIfAbsent(key,i);
        for(Anchor old:visible)for(String key:old.keys){Integer position=positions.get(key);if(position!=null)return new Anchor(old.keys,position,old.top);}
        return null;
    }
}
