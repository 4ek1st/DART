package com.artcatalog.mobile;

import org.junit.Test;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.Assert.*;

public class TagNormalizationReuseTest {
    @Test public void repeatedFiltersAndFingerprintsKeepNormalizationSemantics(){
        String[][] cases={{" #Black_Hair ","black hair"},{"###AI--Assisted","ai assisted"},{"ＡＩ＿Ｇｅｎｅｒａｔｅｄ","ai generated"},{"a\tb\n c","a b c"},{"a\u00a0b","a b"},{"İ","i\u0307"},{"Aa","aa"},{"BB","bb"},{"x#y","x#y"},{"",""}};
        for(int round=0;round<3;round++)for(String[] pair:cases)assertEquals(pair[0],pair[1],CatalogLogic.normalizeTag(pair[0]));
    }
    @Test public void concurrentUnrelatedTagsCannotContaminateFilterValues()throws Exception{
        ExecutorService workers=Executors.newFixedThreadPool(4);List<Future<?>> tasks=new ArrayList<>();
        try{for(int worker=0;worker<4;worker++){final int slot=worker;tasks.add(workers.submit(()->{for(int i=0;i<10000;i++){String expected="neutral "+slot+" "+i;assertEquals(expected,CatalogLogic.normalizeTag("#NEUTRAL_"+slot+"-"+i));assertEquals("black hair",CatalogLogic.normalizeTag("#Black_Hair"));}}));}for(Future<?> task:tasks)task.get();}finally{workers.shutdownNow();}
    }
}
