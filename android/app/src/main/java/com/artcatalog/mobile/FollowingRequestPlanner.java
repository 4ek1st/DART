package com.artcatalog.mobile;

import java.util.*;
import java.util.function.Function;

/** Schedule shallow pages across subscriptions before spending slots on their back catalog. */
final class FollowingRequestPlanner {
    private FollowingRequestPlanner(){}
    static List<FeedRound.Request> select(List<FeedRound.Request> ready,int limit){return select(ready,limit,request->request.query.startsWith("user:")?request.source()+":"+request.query:request.query);}
    static List<FeedRound.Request> select(List<FeedRound.Request> ready,int limit,Function<FeedRound.Request,String> canonicalOwner){
        if(limit<=0||ready.isEmpty())return List.of();
        // Each depth gets complete author passes. Input order is the caller's rotating queue;
        // selected objects are retained so its source cursors and retry ownership stay intact.
        SortedMap<Integer,LinkedHashMap<String,List<FeedRound.Request>>> depths=new TreeMap<>();
        Set<FeedRound.Request> seen=Collections.newSetFromMap(new IdentityHashMap<>());
        for(FeedRound.Request request:ready)if(seen.add(request)){
            String owner=canonicalOwner.apply(request);if(owner==null||owner.isBlank())owner=request.source()+":"+request.query;
            depths.computeIfAbsent(request.pages.get(request.source()),key->new LinkedHashMap<>()).computeIfAbsent(owner,key->new ArrayList<>()).add(request);
        }
        List<FeedRound.Request> result=new ArrayList<>();Map<String,Integer> sourceSlots=new HashMap<>();
        for(LinkedHashMap<String,List<FeedRound.Request>> authors:depths.values()){
            Set<String> usedAuthors=new HashSet<>();
            while(true){boolean remaining=false,uncoveredProvider=false;
                for(List<FeedRound.Request> streams:authors.values())for(FeedRound.Request request:streams){remaining=true;if(sourceSlots.getOrDefault(request.source(),0)==0)uncoveredProvider=true;}
                if(!remaining)break;
                String chosenOwner=null;int chosenIndex=-1,best=Integer.MAX_VALUE;
                for(Map.Entry<String,List<FeedRound.Request>> entry:authors.entrySet())for(int i=0;i<entry.getValue().size();i++){
                    FeedRound.Request request=entry.getValue().get(i);int slots=sourceSlots.getOrDefault(request.source(),0);boolean repeated=usedAuthors.contains(entry.getKey());
                    if(uncoveredProvider?slots>0:repeated)continue;
                    // Cover every available provider in the first workers. If only one artist
                    // has the other services, reserve its slots; otherwise use distinct owners.
                    int priority=uncoveredProvider?(repeated?1:0):slots;
                    if(priority<best){best=priority;chosenOwner=entry.getKey();chosenIndex=i;}
                }
                if(chosenOwner==null){usedAuthors.clear();continue;}
                FeedRound.Request request=authors.get(chosenOwner).remove(chosenIndex);result.add(request);usedAuthors.add(chosenOwner);sourceSlots.merge(request.source(),1,Integer::sum);
                if(result.size()>=limit)return result;
            }
        }
        return result;
    }
}
