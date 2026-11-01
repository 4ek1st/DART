package com.artcatalog.mobile;

import org.junit.Test;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import static org.junit.Assert.*;

public class ImageRequestSchedulerTest {
    private static final AtomicLong ORDER=new AtomicLong();
    private static final class Job implements Runnable,Comparable<Job> {
        final int priority;final long order=ORDER.incrementAndGet();final Runnable work;
        Job(int priority,Runnable work){this.priority=priority;this.work=work;}
        public void run(){work.run();}
        public int compareTo(Job other){int result=Integer.compare(priority,other.priority);return result==0?Long.compare(order,other.order):result;}
    }
    @Test public void coldForegroundRequestStartsWhileTwoVisibleImageBodiesAreHeld() throws Exception {
        coldRequestWhileBodiesHeld(1,2);
    }
    @Test public void coldPreviewCanStartWhileTheOpenedFullImageBodyIsHeld() throws Exception {
        coldRequestWhileBodiesHeld(0,1);
    }
    private void coldRequestWhileBodiesHeld(int heldPriority,int heldCount) throws Exception {
        CountDownLatch visibleBodies=new CountDownLatch(heldCount),release=new CountDownLatch(1),foregroundReachedServer=new CountDownLatch(1),foregroundDecoded=new CountDownLatch(1);List<Throwable> failures=Collections.synchronizedList(new ArrayList<>());
        CatalogTransport.Capacity capacity=new CatalogTransport.Capacity(5,4,2);ServerSocket server=new ServerSocket(0,8,InetAddress.getByName("127.0.0.1"));ExecutorService serving=Executors.newCachedThreadPool();
        serving.submit(()->{try{while(!server.isClosed()){Socket accepted=server.accept();serving.submit(()->{try(Socket socket=accepted){BufferedReader input=new BufferedReader(new InputStreamReader(socket.getInputStream(),StandardCharsets.US_ASCII));String request=input.readLine(),line;while((line=input.readLine())!=null&&!line.isEmpty()){}OutputStream output=socket.getOutputStream();output.write("HTTP/1.1 200 OK\r\nContent-Length: 1\r\nConnection: close\r\n\r\n".getBytes(StandardCharsets.US_ASCII));output.flush();if(request.contains("/visible")){visibleBodies.countDown();release.await();}else foregroundReachedServer.countDown();output.write(42);output.flush();}catch(Exception failure){if(!server.isClosed())failures.add(failure);}});}}catch(IOException stopped){if(!server.isClosed())failures.add(stopped);}});
        try(ImageRequestScheduler scheduler=new ImageRequestScheduler(r->{Thread thread=new Thread(r,"neutral-image-lane");thread.setDaemon(true);return thread;})){
            for(int i=0;i<heldCount;i++)scheduler.execute(new Job(heldPriority,()->fetch(server.getLocalPort(),"visible",heldPriority,capacity,failures,null)),heldPriority);
            assertTrue(visibleBodies.await(2,TimeUnit.SECONDS));assertEquals(heldCount,capacity.active());scheduler.execute(new Job(0,()->fetch(server.getLocalPort(),"foreground",0,capacity,failures,foregroundDecoded)),0);
            assertTrue("Foreground image should reach the server before older visible image bodies finish",foregroundReachedServer.await(700,TimeUnit.MILLISECONDS));assertTrue(foregroundDecoded.await(2,TimeUnit.SECONDS));assertEquals(1,release.getCount());assertTrue(failures.toString(),failures.isEmpty());
        }finally{release.countDown();server.close();serving.shutdownNow();}
    }
    private static void fetch(int port,String route,int priority,CatalogTransport.Capacity capacity,List<Throwable> failures,CountDownLatch settled){
        HttpURLConnection connection=null;try(CatalogTransport.Capacity.Permit permit=capacity.acquire(()->priority)){
            connection=CatalogClient.open("http://127.0.0.1:"+port+"/"+route);try(InputStream input=connection.getInputStream()){if(input.read()!=42)throw new IOException("Unexpected neutral byte");}if(settled!=null)settled.countDown();
        }catch(Throwable failure){if(!Thread.currentThread().isInterrupted())failures.add(failure);}finally{if(connection!=null){connection.disconnect();CatalogClient.NetworkTask.detach(connection);}}
    }
}
