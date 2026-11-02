package com.artcatalog.mobile;

import org.junit.Test;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.*;
import java.lang.reflect.Field;
import static org.junit.Assert.*;

public class CurationPublishedTest {
    private long previous(String raw){try{return Instant.parse(raw).toEpochMilli();}catch(Exception ignored){}try{return OffsetDateTime.parse(raw).toInstant().toEpochMilli();}catch(Exception ignored){}try{return ZonedDateTime.parse(raw,DateTimeFormatter.ofPattern("EEE MMM dd HH:mm:ss Z yyyy",Locale.US)).toInstant().toEpochMilli();}catch(Exception ignored){}return -1;}
    @Test public void timestampCacheExactlyMatchesTheExistingParserForAllFormatsAndFailures(){List<String> values=new ArrayList<>(Arrays.asList(null,""," ","\t\n","not-a-date","0","2026-11-02","1970-01-01T00:00:00Z","1969-12-31T23:59:59.999Z","2026-11-02T12:30:45.123456789Z","2026-11-02T14:30:45+02:00","Mon Nov 02 12:30:45 +0000 2026","Mon Nov 02 12:30:45 +0200 2026"," 2026-11-02T12:30:45Z ","2026-11-02T12:30:45+25:00","x".repeat(300)));for(int i=0;i<1000;i++)values.add(Instant.ofEpochSecond(-1000000L+i*3600L).toString());for(String raw:values){assertEquals(String.valueOf(raw),previous(raw),Curation.published(raw));assertEquals(previous(raw),Curation.published(raw));}}
    @Test public void timestampsAreThreadSafeAndCacheIsBounded() throws Exception {ExecutorService workers=Executors.newFixedThreadPool(4);List<Future<?>> tasks=new ArrayList<>();try{for(int thread=0;thread<4;thread++){final int owner=thread;tasks.add(workers.submit(()->{for(int i=0;i<2200;i++){String raw=Instant.ofEpochSecond(1700000000L+owner*10000L+i).toString();assertEquals(previous(raw),Curation.published(raw));}}));}for(Future<?> task:tasks)task.get();}finally{workers.shutdownNow();}Field field=Curation.class.getDeclaredField("DATES");field.setAccessible(true);Map<?,?> values=(Map<?,?>)field.get(null);synchronized(values){assertTrue(values.size()<=8192);}}
}
