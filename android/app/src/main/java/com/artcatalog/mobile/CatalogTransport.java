package com.artcatalog.mobile;

import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.*;

/** Shared, bounded transport bookkeeping; Android views and credentials never enter this class. */
final class CatalogTransport {
    static final Capacity CAPACITY=new Capacity(5,4,2);
    static final RequestCache RESPONSES=new RequestCache(System::currentTimeMillis,
        callable->new CatalogClient.NetworkTask<>(callable),5,32,96,4*1024*1024);
    static final Backoff BACKOFF=new Backoff(System::currentTimeMillis);

    static final class BoundedPriorityQueue<E> extends PriorityBlockingQueue<E> {
        private final int maximum;
        BoundedPriorityQueue(int maximum){this.maximum=maximum;}
        @Override public synchronized boolean offer(E item){return size()<maximum&&super.offer(item);}
        @Override public void put(E item){if(!offer(item))throw new RejectedExecutionException("Image queue is full");}
        @Override public boolean offer(E item,long timeout,TimeUnit unit){return offer(item);}
        @Override public int remainingCapacity(){return Math.max(0,maximum-size());}
    }

    static final class Capacity {
        private final int maximum,ordinary,background;
        private int active,backgroundActive;
        Capacity(int maximum,int ordinary,int background){this.maximum=maximum;this.ordinary=ordinary;this.background=background;}
        synchronized Permit acquire(IntSupplier priority) throws InterruptedIOException {
            try{
                while(true){
                    if(Thread.currentThread().isInterrupted())throw new InterruptedException();
                    int selected=priority.getAsInt();
                    if(active<(selected==0?maximum:ordinary)&&(selected<2||backgroundActive<background)){
                        active++;if(selected>=2)backgroundActive++;return new Permit(this,selected>=2);
                    }
                    wait(50);
                }
            }catch(InterruptedException canceled){Thread.currentThread().interrupt();throw new InterruptedIOException("Request canceled");}
        }
        synchronized void changed(){notifyAll();}
        synchronized int active(){return active;}
        static final class Permit implements AutoCloseable {
            private Capacity owner;private final boolean background;
            Permit(Capacity owner,boolean background){this.owner=owner;this.background=background;}
            public void close(){Capacity previous=owner;if(previous==null)return;owner=null;synchronized(previous){previous.active--;if(background)previous.backgroundActive--;previous.notifyAll();}}
        }
    }

    static final class RequestCache implements AutoCloseable {
        private static final class Cached {final String value;final long until;Cached(String value,long until){this.value=value;this.until=until;}}
        interface Loader {String load(IntSupplier priority) throws Exception;}
        private static final class Pending {FutureTask<String> task;volatile int priority;int readers;Pending(int priority){this.priority=priority;}}
        private final LongSupplier clock;
        private final Function<Callable<String>,FutureTask<String>> tasks;
        private final ThreadPoolExecutor executor;
        private final ThreadPoolExecutor foreground;
        private final int maximumEntries,maximumBytes;
        private int bytes;
        private final LinkedHashMap<String,Cached> cached=new LinkedHashMap<>(16,.75f,true);
        private final Map<String,Pending> pending=new HashMap<>();
        RequestCache(LongSupplier clock,Function<Callable<String>,FutureTask<String>> tasks,int workers,int queued,int maximumEntries,int maximumBytes){
            this.clock=clock;this.tasks=tasks;this.maximumEntries=maximumEntries;this.maximumBytes=maximumBytes;
            int ordinary=Math.max(1,workers-1);
            ThreadFactory threads=r->{Thread thread=new Thread(r,"ArtCatalog-http");thread.setDaemon(true);return thread;};
            executor=new ThreadPoolExecutor(ordinary,ordinary,30,TimeUnit.SECONDS,new LinkedBlockingQueue<>(queued),threads);
            foreground=new ThreadPoolExecutor(1,1,30,TimeUnit.SECONDS,new LinkedBlockingQueue<>(queued),threads);
            executor.allowCoreThreadTimeOut(true);
            foreground.allowCoreThreadTimeOut(true);
        }
        String get(String key,long ttl,Callable<String> loader) throws IOException {
            return get(key,ttl,1,priority->loader.call());
        }
        String get(String key,long ttl,int priority,Loader loader) throws IOException {
            Pending entry;
            synchronized(this){
                Cached value=cached.get(key);
                if(value!=null){if(value.until>clock.getAsLong())return value.value;cached.remove(key);bytes-=value.value.length()*2;}
                entry=pending.get(key);
                if(entry==null){
                    entry=new Pending(priority);Pending created=entry;entry.task=tasks.apply(()->loader.load(()->created.priority));pending.put(key,entry);
                    try{(priority==0?foreground:executor).execute(entry.task);}catch(RejectedExecutionException busy){pending.remove(key);throw new IOException("Request queue is busy",busy);}
                }else if(priority<entry.priority){
                    entry.priority=priority;CAPACITY.changed();
                    if(priority==0&&executor.remove(entry.task))try{foreground.execute(entry.task);}catch(RejectedExecutionException busy){try{executor.execute(entry.task);}catch(RejectedExecutionException full){entry.task.cancel(true);}}
                }
                entry.readers++;
            }
            try{
                String value=entry.task.get();
                synchronized(this){
                    if(ttl>0&&value.length()*2<=maximumBytes){
                        Cached previous=cached.put(key,new Cached(value,clock.getAsLong()+ttl));
                        if(previous!=null)bytes-=previous.value.length()*2;bytes+=value.length()*2;
                        Iterator<Map.Entry<String,Cached>> iterator=cached.entrySet().iterator();
                        while((cached.size()>maximumEntries||bytes>maximumBytes)&&iterator.hasNext()){bytes-=iterator.next().getValue().value.length()*2;iterator.remove();}
                    }
                }
                return value;
            }catch(InterruptedException canceled){Thread.currentThread().interrupt();throw new InterruptedIOException("Request canceled");}
            catch(CancellationException canceled){throw new InterruptedIOException("Request canceled");}
            catch(ExecutionException failed){Throwable cause=failed.getCause();if(cause instanceof IOException)throw (IOException)cause;throw new IOException("Request failed",cause);}
            finally{synchronized(this){if(--entry.readers==0){pending.remove(key,entry);if(!entry.task.isDone()){entry.task.cancel(true);executor.remove(entry.task);foreground.remove(entry.task);}}}}
        }
        synchronized int cacheSize(){return cached.size();}
        synchronized int cachedBytes(){return bytes;}
        synchronized int readers(String key){Pending entry=pending.get(key);return entry==null?0:entry.readers;}
        synchronized void invalidate(){cached.clear();bytes=0;}
        public synchronized void close(){for(Pending entry:pending.values())entry.task.cancel(true);pending.clear();cached.clear();bytes=0;executor.shutdownNow();foreground.shutdownNow();}
    }

    static final class Backoff {
        private static final class State {long until;int failures;}
        private final LongSupplier clock;
        private final Map<String,State> states=new HashMap<>();
        private final Map<String,Long> revisions=new HashMap<>();
        Backoff(LongSupplier clock){this.clock=clock;}
        synchronized long retryAt(String source){State state=states.get(source);return state==null||state.until<=clock.getAsLong()?0:state.until;}
        synchronized long fail(String source,int status,long retryDelay){
            if(source.isBlank()||status==400||status==401||status==404||status==413||status==414||status==422)return 0;
            State state=states.computeIfAbsent(source,key->new State());state.failures=Math.min(6,state.failures+1);
            revisions.put(source,revision(source)+1);
            long initial=status==429?30000:status==403?30000:status>=500?10000:3000;
            long delay=Math.max(retryDelay,Math.min(120000,initial*(1L<<(state.failures-1))));
            state.until=clock.getAsLong()+Math.max(1000,Math.min(300000,delay));return state.until;
        }
        synchronized void success(String source){states.remove(source);}
        synchronized long revision(String source){return revisions.getOrDefault(source,0L);}
        synchronized void success(String source,long observed){if(revision(source)==observed)states.remove(source);}
    }
}
