package com.artcatalog.mobile;

import android.content.Context;
import android.graphics.*;
import android.graphics.drawable.ColorDrawable;
import android.os.*;
import android.util.LruCache;
import android.widget.ImageView;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import java.lang.ref.WeakReference;

final class ImageLoader {
    private final LruCache<String,Bitmap> memory;
    private final LruCache<String,Bitmap> fullMemory;
    private final int previewPixels;
    private final ThreadPoolExecutor pool=new ThreadPoolExecutor(4,4,20,TimeUnit.SECONDS,new PriorityBlockingQueue<>(),r->new Thread(()->{android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_BACKGROUND);r.run();},"ArtCatalog-image"));
    private final ConcurrentHashMap<String,Request> requests=new ConcurrentHashMap<>();
    private final AtomicLong sequence=new AtomicLong();
    private final Semaphore decoding=new Semaphore(1);
    private final List<Ticket> prefetches=new ArrayList<>();
    private final Map<String,Ticket> window=new LinkedHashMap<>();
    private final ConcurrentHashMap<String,Long> failures=new ConcurrentHashMap<>();
    private Runnable readyListener;private boolean readyScheduled;
    private final Handler main=new Handler(Looper.getMainLooper());
    private final File directory;private volatile long lastTrim;private volatile boolean closed;
    static final class Ticket {String key,url;int edge,priority;Runnable loaded;java.util.function.Consumer<Boolean> settled;Request request;WeakReference<ImageView> view;volatile boolean canceled,failed,completed;boolean done;}
    private final class Request implements Runnable,Comparable<Request> {
        final String url;final long order=sequence.incrementAndGet();final List<Ticket> tickets=new ArrayList<>();
        final CatalogClient.NetworkTask<Void> task;volatile int priority;volatile boolean finished;
        Request(String url,int priority){this.url=url;this.priority=priority;task=new CatalogClient.NetworkTask<>(this::fetch);}
        public int compareTo(Request other){int value=Integer.compare(priority,other.priority);return value==0?Long.compare(order,other.order):value;}
        public void run(){task.run();}
        void fetch(){
            try{File file=new File(directory,hash(url));if(!file.exists())download(url,file,order);else file.setLastModified(System.currentTimeMillis());
                while(true){List<Ticket> batch=new ArrayList<>();synchronized(this){for(Ticket t:tickets)if(!t.done&&!t.canceled){t.done=true;batch.add(t);}if(batch.isEmpty()){finished=true;break;}}
                    for(Ticket ticket:batch){if(ticket.canceled)continue;Bitmap bitmap=cache(ticket.edge).get(ticket.key);if(bitmap==null){decoding.acquire();try{if(ticket.canceled)continue;bitmap=cache(ticket.edge).get(ticket.key);if(bitmap==null){bitmap=decode(file,ticket.edge);if(bitmap!=null){bitmap.prepareToDraw();cache(ticket.edge).put(ticket.key,bitmap);}}}finally{decoding.release();}}deliver(ticket,bitmap);}
                }trimDisk();
            }catch(Exception ignored){List<Ticket> batch;synchronized(this){finished=true;batch=new ArrayList<>(tickets);}for(Ticket ticket:batch)if(!ticket.completed&&!ticket.canceled)deliver(ticket,null);}
            finally{finished=true;requests.remove(url,this);}
        }
        synchronized boolean add(Ticket ticket){if(finished||task.isCancelled())return false;tickets.add(ticket);ticket.request=this;if(ticket.priority<priority){if(pool.remove(this)){priority=ticket.priority;pool.execute(this);}else priority=ticket.priority;}return true;}
        synchronized void remove(Ticket ticket){tickets.remove(ticket);if(tickets.isEmpty()&&!finished){task.cancel(true);pool.remove(this);finished=true;requests.remove(url,this);}}
    }
    ImageLoader(Context context){
        int memoryClass=((android.app.ActivityManager)context.getSystemService(Context.ACTIVITY_SERVICE)).getMemoryClass();
        int budget=Math.max(24,Math.min(64,memoryClass/3))*1024*1024;
        memory=new LruCache<String,Bitmap>(budget){@Override protected int sizeOf(String key,Bitmap b){return b.getAllocationByteCount();}};
        fullMemory=new LruCache<String,Bitmap>(Math.max(12,Math.min(32,memoryClass/6))*1024*1024){@Override protected int sizeOf(String key,Bitmap b){return b.getAllocationByteCount();}};
        previewPixels=budget/(56*4);
        directory=new File(context.getCacheDir(),"images");directory.mkdirs();
    }
    void setReadyListener(Runnable listener){readyListener=listener;}
    private LruCache<String,Bitmap> cache(int edge){return edge<=720?memory:fullMemory;}
    boolean prepared(String url,int edge){Long failed=failures.get(url+":"+edge);return !CatalogLogic.isMediaUrl(url)||cache(edge).get(url+":"+edge)!=null||failed!=null&&SystemClock.elapsedRealtime()-failed<60000;}
    boolean hasBitmap(String url,int edge){return cache(edge).get(url+":"+edge)!=null;}
    void bind(ImageView view,String url,int edge){bind(view,url,edge,null);}
    void bind(ImageView view,String url,int edge,Runnable loaded){bind(view,url,edge,1,loaded);}
    void bindProgressive(ImageView view,String preview,String url,int edge,int priority,Runnable loaded){bind(view,url,edge,priority,loaded);if(!(view.getDrawable() instanceof android.graphics.drawable.BitmapDrawable)){Bitmap cached=cache(edge).get(url+":"+edge);if(cached==null)cached=fullMemory.get(url+":2000");if(cached==null)cached=fullMemory.get(url+":2400");if(cached==null)cached=memory.get(url+":720");if(cached==null)cached=memory.get(preview+":720");if(cached!=null)view.setImageBitmap(cached);}}
    Ticket prepare(String url,int edge,java.util.function.Consumer<Boolean> settled){Ticket ticket=prefetchTicket(url,edge);ticket.priority=0;ticket.settled=settled;enqueue(ticket);return ticket;}
    void cancelPreparation(Ticket ticket){if(ticket!=null)cancelTicket(ticket);}
    void bind(ImageView view,String url,int edge,int priority,Runnable loaded){
        Object previous=view.getTag();if(previous instanceof Ticket){Ticket t=(Ticket)previous;if(!t.failed&&t.url.equals(url)&&t.edge==edge&&(!t.canceled||t.completed&&view.getDrawable() instanceof android.graphics.drawable.BitmapDrawable)){t.canceled=false;t.loaded=loaded;if(loaded!=null&&view.getDrawable() instanceof android.graphics.drawable.BitmapDrawable)loaded.run();return;}}
        cancel(view);Ticket ticket=new Ticket();ticket.key=url+":"+edge;ticket.url=url;ticket.edge=edge;ticket.priority=priority;ticket.loaded=loaded;ticket.view=new WeakReference<>(view);view.setTag(ticket);
        Bitmap cached=cache(edge).get(ticket.key);
        if(cached!=null){ticket.completed=true;view.setImageBitmap(cached);if(loaded!=null)loaded.run();return;}
        boolean samePreview=previous instanceof Ticket&&((Ticket)previous).url.equals(url)&&view.getDrawable() instanceof android.graphics.drawable.BitmapDrawable;
        if(!samePreview)view.setImageDrawable(new ColorDrawable(0xff303030));enqueue(ticket);
    }
    void prefetch(String url,int edge){if(closed||prepared(url,edge))return;prefetches.removeIf(t->t.canceled||t.completed);for(Ticket existing:prefetches)if(existing.key.equals(url+":"+edge))return;Ticket t=prefetchTicket(url,edge);prefetches.add(t);if(prefetches.size()>16)cancelTicket(prefetches.remove(0));enqueue(t);}
    private Ticket prefetchTicket(String url,int edge){Ticket t=new Ticket();t.key=url+":"+edge;t.url=url;t.edge=edge;t.priority=2;return t;}
    private void cancelTicket(Ticket t){t.canceled=true;if(t.request!=null)t.request.remove(t);}
    void prefetchWindow(List<String> urls,int edge){
        Set<String> wanted=new LinkedHashSet<>();for(String url:urls)wanted.add(url+":"+edge);
        for(Iterator<Map.Entry<String,Ticket>> it=window.entrySet().iterator();it.hasNext();){Map.Entry<String,Ticket> e=it.next();if(!wanted.contains(e.getKey())||e.getValue().completed||e.getValue().canceled){if(!e.getValue().completed)cancelTicket(e.getValue());it.remove();}}
        for(String url:urls){String key=url+":"+edge;if(!prepared(url,edge)&&!window.containsKey(key)){Ticket t=prefetchTicket(url,edge);window.put(key,t);enqueue(t);}}
    }
    void cancelPrefetch(){for(Ticket t:prefetches)cancelTicket(t);prefetches.clear();for(Ticket t:window.values())cancelTicket(t);window.clear();}
    private synchronized void enqueue(Ticket ticket){
        Bitmap cached=cache(ticket.edge).get(ticket.key);if(cached!=null){deliver(ticket,cached);return;}if(closed||!CatalogLogic.isMediaUrl(ticket.url)){deliver(ticket,null);return;}
        Request request=requests.get(ticket.url);if(request!=null&&request.add(ticket))return;
        Request fresh=new Request(ticket.url,ticket.priority);fresh.add(ticket);requests.put(ticket.url,fresh);pool.execute(fresh);
    }
    private void deliver(Ticket ticket,Bitmap bitmap){
        ticket.failed=bitmap==null;ticket.completed=true;
        if(bitmap==null)failures.put(ticket.key,SystemClock.elapsedRealtime());else failures.remove(ticket.key);
        main.post(()->{
            if(ticket.canceled||closed)return;
            if(ticket.view!=null){ImageView current=ticket.view.get();if(current!=null&&current.getTag()==ticket){if(bitmap!=null){current.setImageBitmap(bitmap);if(ticket.loaded!=null)ticket.loaded.run();}else if(!(ticket.edge>720&&current.getDrawable() instanceof android.graphics.drawable.BitmapDrawable)){current.setImageResource(android.R.drawable.ic_menu_report_image);current.setContentDescription("Изображение недоступно. Откройте работу для повторной загрузки.");}}}
            if(ticket.edge==720&&readyListener!=null&&!readyScheduled){readyScheduled=true;main.postDelayed(()->{readyScheduled=false;if(!closed&&readyListener!=null)readyListener.run();},16);}
            if(ticket.settled!=null)ticket.settled.accept(bitmap!=null);
        });
    }
    void cancel(ImageView view){Object tag=view.getTag();if(tag instanceof Ticket){Ticket ticket=(Ticket)tag;ticket.canceled=true;if(ticket.request!=null)ticket.request.remove(ticket);}view.setTag(null);}
    void release(ImageView view){Object tag=view.getTag();cancel(view);view.setImageDrawable(null);view.setTag(tag);}
    void recycle(ImageView view){Object tag=view.getTag();cancel(view);view.setTag(tag);}
    void restore(ImageView view){Object tag=view.getTag();if(tag instanceof Ticket&&(((Ticket)tag).canceled||view.getDrawable()==null)){Ticket t=(Ticket)tag;bind(view,t.url,t.edge,t.priority,t.loaded);}}
    private void download(String url,File target,long token) throws Exception {
        HttpURLConnection connection=null;File part=new File(target.getPath()+"."+token+".part");
        try{for(int redirects=0;redirects<4;redirects++){
            if(!CatalogLogic.isMediaUrl(url))throw new IOException("Unsupported image host");connection=CatalogClient.open(url);connection.setRequestProperty("Accept-Encoding","identity");connection.setRequestProperty("Referer",CatalogLogic.mediaReferer(url));
            int code=connection.getResponseCode();if(code>=300&&code<400){url=new URL(new URL(url),connection.getHeaderField("Location")).toString();connection.disconnect();CatalogClient.NetworkTask.detach(connection);connection=null;continue;}if(code!=200)throw new IOException("Image unavailable");
            try(InputStream in=connection.getInputStream();OutputStream out=new FileOutputStream(part)){byte[] buffer=new byte[32768];int count,total=0;while((count=in.read(buffer))!=-1){if(Thread.currentThread().isInterrupted())throw new InterruptedIOException();total+=count;if(total>40*1024*1024)throw new IOException("Image too large");out.write(buffer,0,count);}}
            if(Thread.currentThread().isInterrupted())throw new InterruptedIOException();if(!target.exists()&&!part.renameTo(target))throw new IOException("Cache write failed");target.setLastModified(System.currentTimeMillis());return;
        }throw new IOException("Too many redirects");}finally{if(connection!=null){connection.disconnect();CatalogClient.NetworkTask.detach(connection);}if(part.exists())part.delete();}
    }
    private Bitmap decode(File file,int edge){
        BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;BitmapFactory.decodeFile(file.getPath(),bounds);
        if(bounds.outWidth<=0||bounds.outHeight<=0){file.delete();return null;}
        BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=1;
        while(Math.max(bounds.outWidth,bounds.outHeight)/(options.inSampleSize*2)>=edge||(long)bounds.outWidth*bounds.outHeight/options.inSampleSize/options.inSampleSize>4200000)options.inSampleSize*=2;
        options.inPreferredConfig=Bitmap.Config.ARGB_8888;
        try{Bitmap bitmap=BitmapFactory.decodeFile(file.getPath(),options);if(bitmap==null){file.delete();return null;}
            double scale=Math.min(1.0,edge/(double)Math.max(bitmap.getWidth(),bitmap.getHeight()));
            if(edge<=720)scale=Math.min(scale,Math.sqrt(previewPixels/((double)bitmap.getWidth()*bitmap.getHeight())));
            if(scale<1){Bitmap resized=Bitmap.createScaledBitmap(bitmap,Math.max(1,(int)(bitmap.getWidth()*scale)),Math.max(1,(int)(bitmap.getHeight()*scale)),true);if(resized!=bitmap)bitmap.recycle();bitmap=resized;}return bitmap;
        }catch(OutOfMemoryError exhausted){memory.evictAll();fullMemory.evictAll();options.inSampleSize*=2;try{return BitmapFactory.decodeFile(file.getPath(),options);}catch(OutOfMemoryError ignored){return null;}}
    }
    private synchronized void trimDisk(){long now=System.currentTimeMillis();if(now-lastTrim<60000)return;lastTrim=now;File[] files=directory.listFiles((dir,name)->!name.endsWith(".part"));if(files==null)return;long size=0;for(File f:files)size+=f.length();if(size<=160L*1024*1024)return;Arrays.sort(files,Comparator.comparingLong(File::lastModified));for(File f:files){if(size<=130L*1024*1024)break;long bytes=f.length();if(f.delete())size-=bytes;}}
    private String hash(String text) throws Exception {byte[] bytes=MessageDigest.getInstance("SHA-256").digest(text.getBytes(java.nio.charset.StandardCharsets.UTF_8));StringBuilder s=new StringBuilder();for(byte b:bytes)s.append(String.format(Locale.ROOT,"%02x",b));return s.toString();}
    void clearMemory(){memory.evictAll();fullMemory.evictAll();}
    static String visualHash(Bitmap bitmap){Bitmap small=Bitmap.createScaledBitmap(bitmap,9,8,true);StringBuilder hash=new StringBuilder();for(int row=0;row<8;row++)for(int col=0;col<8;col+=4){int nibble=0;for(int bit=0;bit<4;bit++){int left=small.getPixel(col+bit,row),right=small.getPixel(col+bit+1,row);double a=.299*Color.red(left)+.587*Color.green(left)+.114*Color.blue(left),b=.299*Color.red(right)+.587*Color.green(right)+.114*Color.blue(right);nibble=nibble*2+(b>a?1:0);}hash.append(Integer.toHexString(nibble));}if(small!=bitmap)small.recycle();return hash.toString();}
    void seed(String url,Bitmap bitmap) throws Exception {try(OutputStream out=new FileOutputStream(new File(directory,hash(url)))){bitmap.compress(Bitmap.CompressFormat.JPEG,88,out);}}
    void close(){closed=true;for(Request r:requests.values())r.task.cancel(true);pool.shutdownNow();main.removeCallbacksAndMessages(null);memory.evictAll();fullMemory.evictAll();}
}
