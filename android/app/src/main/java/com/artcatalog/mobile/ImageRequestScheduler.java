package com.artcatalog.mobile;

import java.util.concurrent.*;

/** Bounded image execution lanes; admission through the shared transport still owns network limits. */
final class ImageRequestScheduler implements AutoCloseable {
    private final ThreadPoolExecutor visible,prefetch,foreground;
    ImageRequestScheduler(ThreadFactory factory){visible=pool(factory);prefetch=pool(factory);foreground=pool(factory);}
    private static ThreadPoolExecutor pool(ThreadFactory factory){return new ThreadPoolExecutor(2,2,20,TimeUnit.SECONDS,new CatalogTransport.BoundedPriorityQueue<Runnable>(48),factory);}
    void execute(Runnable task,int priority){(priority==0?foreground:priority>=2?prefetch:visible).execute(task);}
    boolean remove(Runnable task){return foreground.remove(task)|visible.remove(task)|prefetch.remove(task);}
    public void close(){foreground.shutdownNow();visible.shutdownNow();prefetch.shutdownNow();}
}
