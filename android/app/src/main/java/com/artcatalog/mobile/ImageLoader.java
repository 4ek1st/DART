package com.artcatalog.mobile;

import android.content.Context;
import android.graphics.*;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.BitmapDrawable;
import android.content.res.Resources;
import android.animation.ValueAnimator;
import android.os.*;
import android.util.LruCache;
import android.widget.ImageView;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicBoolean;
import java.lang.ref.WeakReference;
import java.util.function.IntSupplier;

final class ImageLoader {
    interface Connections {HttpURLConnection open(String url) throws IOException;}
    private final Connections connections;
    private final LruCache<String,Bitmap> memory;
    private final LruCache<String,Bitmap> fullMemory;
    private final int previewPixels;
    private final ImageRequestScheduler scheduler=new ImageRequestScheduler(r->new Thread(()->{android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_BACKGROUND);r.run();},"ArtCatalog-image"));
    private final ConcurrentHashMap<String,Request> requests=new ConcurrentHashMap<>();
    private final AtomicLong sequence=new AtomicLong();
    private final Semaphore decoding=new Semaphore(2);
    private final List<Ticket> prefetches=new ArrayList<>();
    private final Map<String,Ticket> window=new LinkedHashMap<>();
    private final ConcurrentHashMap<String,Long> failures=new ConcurrentHashMap<>();
    private Runnable readyListener;private boolean readyScheduled;
    private final Handler main=new Handler(Looper.getMainLooper());
    private final File directory;private volatile long lastTrim;private volatile boolean closed;
    static final class Ticket {String key,url,identity;int edge,priority;Runnable loaded,whenAdmitted;java.util.function.Consumer<Boolean> settled;Request request;WeakReference<ImageView> view;volatile boolean canceled,failed,completed;volatile Ticket preview;final AtomicBoolean fullQueued=new AtomicBoolean();boolean done;}
    static String mediaKey(String url,int edge){return CatalogLogic.mediaCacheKey(url)+":"+edge;}
    static String failureKey(String url,int edge){return url+":"+edge;}
    private final class Request implements Runnable,Comparable<Request> {
        final String key;final long order=sequence.incrementAndGet();final List<Ticket> tickets=new ArrayList<>();final LinkedHashSet<String> urls=new LinkedHashSet<>();
        final CatalogClient.NetworkTask<Void> task;volatile int priority;volatile boolean finished;boolean admitted;
        Request(String url,int priority){this.key=CatalogLogic.mediaCacheKey(url);urls.add(url);this.priority=priority;task=new CatalogClient.NetworkTask<>(this::fetch);}
        public int compareTo(Request other){int value=Integer.compare(priority,other.priority);return value==0?Long.compare(order,other.order):value;}
        public void run(){try{task.run();}finally{finished=true;requests.remove(key,this);}}
        void fetch(){
            Set<String> attempted=new HashSet<>();
            try{String raw=nextUrl(Set.of());File file=new File(directory,hash(key));
                if(!file.exists()){File legacy=new File(directory,hash(raw));if(legacy.exists()&&!legacy.equals(file)&&!legacy.renameTo(file))file=legacy;}
                if(!file.exists()){while(true){String selected=nextUrl(attempted);if(selected==null)throw new IOException("Image unavailable");attempted.add(selected);try{download(selected,file,order,()->priority,this::admitted);break;}catch(Exception failed){synchronized(this){if(Thread.currentThread().isInterrupted()||attempted.size()>=4||nextUrl(attempted)==null){finished=true;throw failed;}}}}}else{file.setLastModified(System.currentTimeMillis());admitted();}
                while(true){List<Ticket> batch=new ArrayList<>();synchronized(this){for(Ticket t:tickets)if(!t.done&&!t.canceled){t.done=true;batch.add(t);}if(batch.isEmpty()){finished=true;break;}}
                    for(Ticket ticket:batch){if(ticket.canceled)continue;Bitmap bitmap=cache(ticket.edge).get(ticket.key);if(bitmap==null){decoding.acquire();try{if(ticket.canceled)continue;bitmap=cache(ticket.edge).get(ticket.key);if(bitmap==null){bitmap=decode(file,ticket.edge);if(bitmap!=null){bitmap.prepareToDraw();cache(ticket.edge).put(ticket.key,bitmap);}}}finally{decoding.release();}}deliver(ticket,bitmap);}
                }trimDisk();
            }catch(Exception ignored){List<Ticket> batch;synchronized(this){finished=true;batch=new ArrayList<>(tickets);}for(Ticket ticket:batch)if(!ticket.completed&&!ticket.canceled){if(!Thread.currentThread().isInterrupted()&&!attempted.isEmpty()&&!attempted.contains(ticket.url))enqueue(ticket);else deliver(ticket,null);}}
            finally{finished=true;requests.remove(key,this);}
        }
        synchronized String nextUrl(Set<String> attempted){String selected=null;long latest=-1;for(String url:urls)if(!attempted.contains(url)){long expires=expiry(url);if(selected==null||expires>=latest){selected=url;latest=expires;}}return selected;}
        synchronized void renew(String url){urls.remove(url);urls.add(url);while(urls.size()>4)urls.remove(urls.iterator().next());}
        void admitted(){List<Runnable> callbacks=new ArrayList<>();synchronized(this){if(admitted)return;admitted=true;for(Ticket ticket:tickets)if(!ticket.canceled&&ticket.whenAdmitted!=null)callbacks.add(ticket.whenAdmitted);}for(Runnable callback:callbacks)callback.run();}
        synchronized boolean add(Ticket ticket){if(finished||task.isCancelled()||ticket.canceled)return false;tickets.add(ticket);renew(ticket.url);ticket.request=this;promote(ticket.priority);if(admitted&&ticket.whenAdmitted!=null)main.post(ticket.whenAdmitted);return true;}
        synchronized void promote(int selected){if(selected>=priority)return;boolean queued=scheduler.remove(this);priority=selected;CatalogTransport.CAPACITY.changed();if(queued)submit(this);}
        synchronized void remove(Ticket ticket){tickets.remove(ticket);if(tickets.isEmpty()&&!finished){task.cancel(true);scheduler.remove(this);finished=true;requests.remove(key,this);}}
    }
    private static long expiry(String raw){try{String query=URI.create(raw).getRawQuery();if(query!=null)for(String pair:query.split("&")){String[] parts=pair.split("=",2);if(parts.length==2&&(parts[0].equals("e")||parts[0].equals("expires")))return Long.parseLong(parts[1]);}}catch(Exception ignored){}return -1;}
    ImageLoader(Context context){this(context,CatalogClient::open);}
    ImageLoader(Context context,Connections connections){
        this.connections=Objects.requireNonNull(connections);
        int memoryClass=((android.app.ActivityManager)context.getSystemService(Context.ACTIVITY_SERVICE)).getMemoryClass();
        int budget=Math.max(24,Math.min(64,memoryClass/3))*1024*1024;
        memory=new LruCache<String,Bitmap>(budget){@Override protected int sizeOf(String key,Bitmap b){return b.getAllocationByteCount();}};
        fullMemory=new LruCache<String,Bitmap>(Math.max(12,Math.min(32,memoryClass/6))*1024*1024){@Override protected int sizeOf(String key,Bitmap b){return b.getAllocationByteCount();}};
        // Two-column cards stay sharp without filling the bitmap cache with
        // more decoded previews than it can retain on a low-memory phone.
        previewPixels=Math.max(160000,Math.min(512*512,budget/(24*4)));
        directory=new File(context.getCacheDir(),"images");directory.mkdirs();
    }
    void setReadyListener(Runnable listener){readyListener=listener;}
    private LruCache<String,Bitmap> cache(int edge){return edge<=720?memory:fullMemory;}
    boolean failed(String url,int edge){Long failed=failures.get(failureKey(url,edge));return failed!=null&&SystemClock.elapsedRealtime()-failed<60000;}
    boolean prepared(String url,int edge){return !CatalogLogic.isMediaUrl(url)||cache(edge).get(mediaKey(url,edge))!=null||failed(url,edge);}
    boolean hasBitmap(String url,int edge){return cache(edge).get(mediaKey(url,edge))!=null;}
    void bind(ImageView view,String url,int edge){bind(view,url,edge,null);}
    void bind(ImageView view,String url,int edge,Runnable loaded){bind(view,url,edge,1,loaded);}
    void bindProgressive(ImageView view,String preview,String url,int edge,int priority,Runnable loaded){bindProgressive(view,preview,url,edge,priority,loaded,"");}
    /** A supplied identity may retain a shown bitmap only when the caller proved it is the same media. */
    void bindProgressive(ImageView view,String preview,String url,int edge,int priority,Runnable loaded,String sameMediaIdentity){
        Ticket full=target(view,url,edge,priority,loaded,sameMediaIdentity);if(full==null)return;
        if(!(view.getDrawable() instanceof BitmapDrawable)){Bitmap cached=fullMemory.get(mediaKey(url,2000));if(cached==null)cached=fullMemory.get(mediaKey(url,2400));if(cached==null)cached=memory.get(mediaKey(url,720));if(cached==null)cached=memory.get(mediaKey(preview,720));if(cached!=null){show(view,cached,false);if(loaded!=null)loaded.run();}}
        if(view.getDrawable() instanceof BitmapDrawable||!CatalogLogic.isMediaUrl(preview)||CatalogLogic.mediaCacheKey(preview).equals(CatalogLogic.mediaCacheKey(url))){startFull(full);return;}
        Ticket thumbnail=prefetchTicket(preview,720);thumbnail.priority=priority;full.preview=thumbnail;
        thumbnail.whenAdmitted=()->startFull(full);
        thumbnail.settled=success->{
            if(!full.canceled&&!closed&&view.getTag()==full&&!(full.completed&&!full.failed)){Bitmap bitmap=memory.get(mediaKey(preview,720));if(bitmap!=null){show(view,bitmap,true);if(full.loaded!=null)full.loaded.run();}}
            full.preview=null;startFull(full);
        };
        enqueue(thumbnail);
    }
    private void startFull(Ticket ticket){if(!ticket.canceled&&!closed&&ticket.fullQueued.compareAndSet(false,true))enqueue(ticket);}
    Ticket prepare(String url,int edge,java.util.function.Consumer<Boolean> settled){Ticket ticket=prefetchTicket(url,edge);ticket.priority=0;ticket.settled=settled;enqueue(ticket);return ticket;}
    void cancelPreparation(Ticket ticket){if(ticket!=null)cancelTicket(ticket);}
    void bind(ImageView view,String url,int edge,int priority,Runnable loaded){
        Ticket ticket=target(view,url,edge,priority,loaded,"");if(ticket!=null)startFull(ticket);
    }
    private Ticket target(ImageView view,String url,int edge,int priority,Runnable loaded,String sameMediaIdentity){
        Object previous=view.getTag();if(previous instanceof Ticket){Ticket t=(Ticket)previous;if(!t.failed&&t.key.equals(mediaKey(url,edge))&&(!t.canceled||t.completed&&view.getDrawable() instanceof BitmapDrawable)){t.canceled=false;t.url=url;t.loaded=loaded;t.priority=Math.min(t.priority,priority);if(t.request!=null){t.request.renew(url);t.request.promote(priority);}if(loaded!=null&&view.getDrawable() instanceof BitmapDrawable)loaded.run();return null;}}
        String identity=sameMediaIdentity==null||sameMediaIdentity.isBlank()?CatalogLogic.mediaCacheKey(url):sameMediaIdentity;boolean retain=previous instanceof Ticket&&identity.equals(((Ticket)previous).identity)&&view.getDrawable() instanceof BitmapDrawable;
        cancel(view);Ticket ticket=new Ticket();ticket.key=mediaKey(url,edge);ticket.url=url;ticket.identity=identity;ticket.edge=edge;ticket.priority=priority;ticket.loaded=loaded;ticket.view=new WeakReference<>(view);view.setTag(ticket);
        Bitmap cached=cache(edge).get(ticket.key);
        if(cached!=null){ticket.completed=true;show(view,cached,false);if(loaded!=null)loaded.run();return null;}
        if(!retain)view.setImageDrawable(new ColorDrawable(0xff303030));return ticket;
    }
    void prefetch(String url,int edge){if(closed||prepared(url,edge))return;prefetches.removeIf(t->t.canceled||t.completed);for(Ticket existing:prefetches)if(existing.key.equals(mediaKey(url,edge))){existing.url=url;if(existing.request!=null)existing.request.renew(url);return;}Ticket t=prefetchTicket(url,edge);prefetches.add(t);if(prefetches.size()>16)cancelTicket(prefetches.remove(0));enqueue(t);}
    private Ticket prefetchTicket(String url,int edge){Ticket t=new Ticket();t.key=mediaKey(url,edge);t.url=url;t.edge=edge;t.priority=2;return t;}
    private void cancelTicket(Ticket t){t.canceled=true;Ticket preview=t.preview;t.preview=null;if(preview!=null)cancelTicket(preview);if(t.request!=null)t.request.remove(t);}
    void prefetchWindow(List<String> urls,int edge){
        Set<String> wanted=new LinkedHashSet<>();for(String url:urls)wanted.add(mediaKey(url,edge));
        for(Iterator<Map.Entry<String,Ticket>> it=window.entrySet().iterator();it.hasNext();){Map.Entry<String,Ticket> e=it.next();if(!wanted.contains(e.getKey())||e.getValue().completed||e.getValue().canceled){if(!e.getValue().completed)cancelTicket(e.getValue());it.remove();}}
        for(String url:urls){String key=mediaKey(url,edge);Ticket previous=window.get(key);if(previous!=null){previous.url=url;if(previous.request!=null)previous.request.renew(url);}else if(!prepared(url,edge)){Ticket t=prefetchTicket(url,edge);window.put(key,t);enqueue(t);}}
    }
    void cancelPrefetch(){for(Ticket t:prefetches)cancelTicket(t);prefetches.clear();for(Ticket t:window.values())cancelTicket(t);window.clear();}
    private synchronized void enqueue(Ticket ticket){
        if(ticket.canceled)return;
        Bitmap cached=cache(ticket.edge).get(ticket.key);if(cached!=null){deliver(ticket,cached);return;}if(closed||!CatalogLogic.isMediaUrl(ticket.url)){deliver(ticket,null);return;}
        if(ticket.edge<=720&&ticket.priority>0&&failed(ticket.url,ticket.edge)){deliver(ticket,null);return;}
        String key=CatalogLogic.mediaCacheKey(ticket.url);Request request=requests.get(key);if(request!=null&&request.add(ticket))return;
        Request fresh=new Request(ticket.url,ticket.priority);if(!fresh.add(ticket))return;requests.put(key,fresh);if(ticket.canceled||fresh.finished||fresh.task.isCancelled()){requests.remove(key,fresh);return;}submit(fresh);
    }
    private void submit(Request request){try{scheduler.execute(request,request.priority);}catch(RejectedExecutionException busy){request.finished=true;requests.remove(request.key,request);List<Ticket> tickets;synchronized(request){tickets=new ArrayList<>(request.tickets);}for(Ticket ticket:tickets)if(!ticket.canceled)deliver(ticket,null);}}
    private void deliver(Ticket ticket,Bitmap bitmap){
        ticket.failed=bitmap==null;ticket.completed=true;
        if(bitmap!=null&&ticket.preview!=null){Ticket preview=ticket.preview;ticket.preview=null;cancelTicket(preview);}
        String failedKey=failureKey(ticket.url,ticket.edge);synchronized(failures){if(bitmap==null){long now=SystemClock.elapsedRealtime();Long previous=failures.get(failedKey);if(previous==null||now-previous>=60000)failures.put(failedKey,now);if(failures.size()>512){failures.entrySet().removeIf(entry->now-entry.getValue()>=60000);while(failures.size()>512){String oldest=failures.keySet().iterator().next();failures.remove(oldest);}}}else failures.remove(failedKey);}
        main.post(()->{
            if(ticket.canceled||closed)return;
            if(ticket.view!=null){ImageView current=ticket.view.get();if(current!=null&&current.getTag()==ticket){if(bitmap!=null){show(current,bitmap,true);if(ticket.loaded!=null)ticket.loaded.run();}else if(!(ticket.edge>720&&current.getDrawable() instanceof BitmapDrawable)){current.setImageResource(android.R.drawable.ic_menu_report_image);current.setContentDescription("Изображение недоступно. Откройте работу для повторной загрузки.");}}}
            if(ticket.edge==720&&readyListener!=null&&!readyScheduled){readyScheduled=true;main.postDelayed(()->{readyScheduled=false;if(!closed&&readyListener!=null)readyListener.run();},16);}
            if(ticket.settled!=null)ticket.settled.accept(bitmap!=null);
        });
    }
    void cancel(ImageView view){Object tag=view.getTag();if(tag instanceof Ticket)cancelTicket((Ticket)tag);view.setTag(null);}
    void release(ImageView view){Object tag=view.getTag();cancel(view);view.setImageDrawable(null);view.setTag(tag);}
    void recycle(ImageView view){Object tag=view.getTag();cancel(view);view.setTag(tag);}
    void restore(ImageView view){Object tag=view.getTag();if(tag instanceof Ticket&&(((Ticket)tag).canceled||view.getDrawable()==null)){Ticket t=(Ticket)tag;bind(view,t.url,t.edge,t.priority,t.loaded);}}
    private void download(String url,File target,long token,IntSupplier priority,Runnable admitted) throws Exception {
        HttpURLConnection connection=null;File part=new File(target.getPath()+"."+token+".part");
        try(CatalogTransport.Capacity.Permit permit=CatalogTransport.CAPACITY.acquire(priority)){
        admitted.run();
        try{for(int redirects=0;redirects<4;redirects++){
            if(!CatalogLogic.isMediaUrl(url))throw new IOException("Unsupported image host");connection=connections.open(url);connection.setRequestProperty("Accept-Encoding","identity");connection.setRequestProperty("Referer",CatalogLogic.mediaReferer(url));
            int code=connection.getResponseCode();if(code>=300&&code<400){url=new URL(new URL(url),connection.getHeaderField("Location")).toString();connection.disconnect();CatalogClient.NetworkTask.detach(connection);connection=null;continue;}if(code!=200)throw new IOException("Image unavailable");
            try(InputStream in=connection.getInputStream();OutputStream out=new FileOutputStream(part)){byte[] buffer=new byte[32768];int count,total=0;while((count=in.read(buffer))!=-1){if(Thread.currentThread().isInterrupted())throw new InterruptedIOException();total+=count;if(total>40*1024*1024)throw new IOException("Image too large");out.write(buffer,0,count);}}
            if(Thread.currentThread().isInterrupted())throw new InterruptedIOException();if(!target.exists()&&!part.renameTo(target))throw new IOException("Cache write failed");target.setLastModified(System.currentTimeMillis());return;
        }throw new IOException("Too many redirects");}finally{if(connection!=null){connection.disconnect();CatalogClient.NetworkTask.detach(connection);}if(part.exists())part.delete();}
        }
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
    void seed(String url,Bitmap bitmap) throws Exception {try(OutputStream out=new FileOutputStream(new File(directory,hash(CatalogLogic.mediaCacheKey(url))))){bitmap.compress(Bitmap.CompressFormat.JPEG,88,out);}}
    private void show(ImageView view,Bitmap bitmap,boolean animate){Drawable current=view.getDrawable();if(current instanceof BitmapDrawable&&((BitmapDrawable)current).getBitmap()==bitmap)return;if(animate&&ValueAnimator.areAnimatorsEnabled()&&view.isShown()&&view.getWidth()>0&&view.getHeight()>0&&current!=null){ArrivalDrawable next=new ArrivalDrawable(view.getResources(),bitmap,current);view.setImageDrawable(next);main.postDelayed(next::finish,160);}else view.setImageBitmap(bitmap);}
    private static final class ArrivalDrawable extends BitmapDrawable {
        private Drawable previous;private final long started=SystemClock.uptimeMillis();private final Runnable tick=this::invalidateSelf;
        ArrivalDrawable(Resources resources,Bitmap bitmap,Drawable previous){super(resources,bitmap);this.previous=previous;}
        void finish(){previous=null;unscheduleSelf(tick);invalidateSelf();}
        @Override public void draw(Canvas canvas){float progress=Math.min(1,(SystemClock.uptimeMillis()-started)/150f);if(previous==null||progress>=1){previous=null;super.draw(canvas);return;}previous.setBounds(getBounds());previous.draw(canvas);int alpha=getAlpha();super.setAlpha(Math.round(alpha*progress));super.draw(canvas);super.setAlpha(alpha);scheduleSelf(tick,SystemClock.uptimeMillis()+16);}
    }
    void close(){closed=true;for(Request r:requests.values())r.task.cancel(true);scheduler.close();main.removeCallbacksAndMessages(null);memory.evictAll();fullMemory.evictAll();}
}
