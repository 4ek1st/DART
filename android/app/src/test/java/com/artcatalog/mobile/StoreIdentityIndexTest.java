package com.artcatalog.mobile;

import org.junit.Test;
import java.lang.reflect.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;
import static org.junit.Assert.*;

/** The store's index is pure so large-library updates can be checked without Android IO. */
public class StoreIdentityIndexTest {
    private Object index(Function<Post,Set<String>> resolver) throws Exception {
        Class<?> type;
        try { type=Class.forName("com.artcatalog.mobile.Store$SavedIdentityIndex"); }
        catch(ClassNotFoundException missing){throw new AssertionError("The store still rescans the complete saved library instead of indexing individual records",missing);}
        Constructor<?> constructor=type.getDeclaredConstructor(Function.class);constructor.setAccessible(true);return constructor.newInstance(resolver);
    }
    private Object invoke(Object index,String name,Class<?> type,Object value) throws Exception {
        Method method=index.getClass().getDeclaredMethod(name,type);method.setAccessible(true);return method.invoke(index,value);
    }
    @SuppressWarnings("unchecked") private Set<String> tokens(Object index) throws Exception {
        Method method=index.getClass().getDeclaredMethod("tokens");method.setAccessible(true);return (Set<String>)method.invoke(index);
    }
    private Post post(int id,String hash){Post p=new Post();p.source="danbooru";p.id=String.valueOf(id);p.hash=hash;return p;}
    @Test public void updatingOneRecordDoesNotRecomputeThousandsOfOtherRecords() throws Exception {
        AtomicInteger resolutions=new AtomicInteger();Object index=index(p->{resolutions.incrementAndGet();return WorkGrouping.viewedTokens(p);});
        for(int i=0;i<10000;i++)invoke(index,"put",Post.class,post(i,""));
        resolutions.set(0);invoke(index,"put",Post.class,post(2,"a".repeat(32)));
        assertEquals("One metadata update resolves only that record",1,resolutions.get());assertTrue(tokens(index).contains("hash:"+"a".repeat(32)));
        invoke(index,"remove",String.class,"danbooru:2");assertEquals("Removing a record uses its indexed snapshot",1,resolutions.get());assertFalse(tokens(index).contains("key:danbooru:2"));
    }
    @Test public void sharedAliasSurvivesUntilItsLastSavedOwnerIsRemoved() throws Exception {
        Object index=index(WorkGrouping::viewedTokens);String hash="b".repeat(32);invoke(index,"put",Post.class,post(1,hash));invoke(index,"put",Post.class,post(2,hash));
        invoke(index,"remove",String.class,"danbooru:1");assertTrue(tokens(index).contains("hash:"+hash));assertFalse(tokens(index).contains("key:danbooru:1"));
        invoke(index,"remove",String.class,"danbooru:2");assertTrue(tokens(index).isEmpty());
    }
    @Test public void mutableMetadataRemovesThePreviousIdentitySnapshot() throws Exception {
        Object index=index(WorkGrouping::viewedTokens);Post p=post(1,"c".repeat(32));invoke(index,"put",Post.class,p);
        p.hash="d".repeat(32);p.memberKeys.add("gelbooru:2");invoke(index,"put",Post.class,p);
        assertFalse(tokens(index).contains("hash:"+"c".repeat(32)));assertTrue(tokens(index).contains("hash:"+"d".repeat(32)));assertTrue(tokens(index).contains("key:gelbooru:2"));
    }
    @Test public void matchingIndexedAliasesDoesNotReparseSavedRecords() throws Exception {
        AtomicInteger resolutions=new AtomicInteger();Object index=index(p->{resolutions.incrementAndGet();return WorkGrouping.viewedTokens(p);});Post first=post(1,"e".repeat(32));first.memberKeys.add("rule34:7");invoke(index,"put",Post.class,first);invoke(index,"put",Post.class,post(2,"e".repeat(32)));
        Object result=invoke(index,"matchingKeys",Set.class,Set.of("key:rule34:7","hash:"+"e".repeat(32)));
        assertEquals(Set.of("danbooru:1","danbooru:2"),new HashSet<>((Collection<?>)result));assertEquals(2,resolutions.get());
    }
}
