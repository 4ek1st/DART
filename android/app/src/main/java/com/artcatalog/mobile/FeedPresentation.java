package com.artcatalog.mobile;

import java.util.*;
import java.util.function.Function;
import java.util.function.Predicate;

/** One visit's visual identity. Catalog enrichment must not replace a visible card. */
final class FeedPresentation {
    private static final class Card {
        final String key;final long order;String preview;
        Card(String key,long order,String preview){this.key=key;this.order=order;this.preview=preview;}
    }
    private Map<String,Card> aliases=new HashMap<>();
    private final IdentityHashMap<Post,Card> current=new IdentityHashMap<>();
    private long sequence;
    void reset(){aliases.clear();current.clear();sequence=0;}
    void update(List<Post> posts,Function<Post,String> preview,Predicate<String> failed){
        Map<String,Card> next=new HashMap<>();Set<String> used=new HashSet<>();current.clear();
        for(Post post:posts){
            Card card=null;for(String key:FeedSession.keys(post)){Card existing=aliases.get(key);if(existing!=null&&(card==null||existing.order<card.order))card=existing;}
            String candidate=preview.apply(post);if(candidate==null)candidate="";
            if(card==null||used.contains(card.key)){
                String key=post.key();long order=sequence++;if(used.contains(key))key+="@slot:"+order;
                card=new Card(key,order,candidate);
            }else if(card.preview.isBlank()||failed.test(card.preview)||sameMedia(card.preview,candidate)){
                if(!candidate.isBlank())card.preview=candidate;
            }
            used.add(card.key);current.put(post,card);for(String key:FeedSession.keys(post))next.putIfAbsent(key,card);
        }
        aliases=next;
    }
    private static boolean sameMedia(String first,String second){return !first.isBlank()&&!second.isBlank()&&CatalogLogic.mediaCacheKey(first).equals(CatalogLogic.mediaCacheKey(second));}
    String key(Post post){Card card=current.get(post);return card==null?post.key():card.key;}
    String preview(Post post){Card card=current.get(post);return card==null?post.preview:card.preview;}
    int size(){return current.size();}
}
