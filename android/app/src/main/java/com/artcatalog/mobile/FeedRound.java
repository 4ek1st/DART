package com.artcatalog.mobile;

import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;

/** A bounded, cancellable round of independent catalog streams, with no cursor mutations. */
final class FeedRound {
    static final int MAX_STREAMS=12,WORKERS=4;
    static final long DEADLINE_MILLIS=22000;
    static final class Request {
        final String query;final Map<String,Integer> pages;
        Request(String query,Map<String,Integer> pages){if(query==null||pages==null||pages.size()!=1)throw new IllegalArgumentException("One source per stream is required");
            Map.Entry<String,Integer> entry=pages.entrySet().iterator().next();if(!Set.of("danbooru","gelbooru","rule34","sankaku").contains(entry.getKey())||entry.getValue()==null||entry.getValue()<0)throw new IllegalArgumentException("Invalid catalog cursor");
            this.query=query;this.pages=Collections.unmodifiableMap(new LinkedHashMap<>(pages));}
        String source(){return pages.keySet().iterator().next();}
    }
    static final class Result {final Request request;final CatalogClient.Page page;Result(Request request,CatalogClient.Page page){this.request=request;this.page=page;}}
    interface Loader {CatalogClient.Page load(Request request) throws Exception;}
    private FeedRound(){}
    static List<Request> fair(List<Request> input){Map<String,ArrayDeque<Request>> queues=new LinkedHashMap<>();for(Request request:input)queues.computeIfAbsent(request.source(),source->new ArrayDeque<>()).add(request);
        List<Request> ordered=new ArrayList<>();boolean remaining=true;while(remaining){remaining=false;for(ArrayDeque<Request> queue:queues.values())if(!queue.isEmpty()){ordered.add(queue.removeFirst());remaining|=!queue.isEmpty();}}return ordered;}
    static List<Result> run(List<Request> requests,Loader loader,Consumer<Result> settled) throws InterruptedException {return run(requests,loader,settled,DEADLINE_MILLIS);}
    static List<Result> run(List<Request> requests,Loader loader,Consumer<Result> settled,long timeoutMillis) throws InterruptedException {
        if(requests==null||requests.size()>MAX_STREAMS||timeoutMillis<1||loader==null||settled==null)throw new IllegalArgumentException("Invalid feed round");
        if(Thread.currentThread().isInterrupted())throw new InterruptedException();if(requests.isEmpty())return List.of();
        ExecutorService workers=Executors.newFixedThreadPool(WORKERS,r->{Thread thread=new Thread(r,"DART-feed-stream");thread.setPriority(Math.max(Thread.MIN_PRIORITY,Thread.NORM_PRIORITY-1));thread.setDaemon(true);return thread;});
        Map<Request,CatalogClient.NetworkTask<Result>> running=new LinkedHashMap<>();BlockingQueue<Result> completed=new LinkedBlockingQueue<>();List<Result> results=new ArrayList<>();Set<Request> delivered=Collections.newSetFromMap(new IdentityHashMap<>());
        long deadline=System.nanoTime()+TimeUnit.MILLISECONDS.toNanos(timeoutMillis);
        try{
            for(Request request:fair(requests)){CatalogClient.NetworkTask<Result> task=new CatalogClient.NetworkTask<>(()->{
                CatalogClient.Page page;try{page=loader.load(request);if(page==null)page=failed(request,false);}
                catch(InterruptedException canceled){Thread.currentThread().interrupt();throw canceled;}
                catch(Exception failure){page=failed(request,false);}
                Result result=new Result(request,page);if(!Thread.currentThread().isInterrupted())completed.offer(result);return result;
            });running.put(request,task);workers.execute(task);}
            while(delivered.size()<requests.size()){
                if(Thread.currentThread().isInterrupted())throw new InterruptedException();long left=deadline-System.nanoTime();if(left<=0)break;
                Result result=completed.poll(left,TimeUnit.NANOSECONDS);if(result==null)break;deliver(result,delivered,results,settled);
            }
            if(Thread.currentThread().isInterrupted())throw new InterruptedException();
            Result result;while((result=completed.poll())!=null)deliver(result,delivered,results,settled);
            for(Request request:requests)if(!delivered.contains(request)){CatalogClient.NetworkTask<Result> task=running.get(request);task.cancel(true);deliver(new Result(request,failed(request,true)),delivered,results,settled);}
            return results;
        }finally{for(CatalogClient.NetworkTask<Result> task:running.values())if(!task.isDone())task.cancel(true);workers.shutdownNow();}
    }
    private static void deliver(Result result,Set<Request> delivered,List<Result> results,Consumer<Result> settled) throws InterruptedException {if(Thread.currentThread().isInterrupted())throw new InterruptedException();if(delivered.add(result.request)){results.add(result);settled.accept(result);}}
    private static CatalogClient.Page failed(Request request,boolean timeout){CatalogClient.Page result=new CatalogClient.Page();result.errors.put(request.source(),timeout?"Источник не ответил. Повторите загрузку.":"Источник сейчас недоступен. Повторите загрузку.");result.retryAt.put(request.source(),System.currentTimeMillis()+15000);return result;}
}
