package com.artcatalog.mobile;

import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;

public class ExposureHistoryTest {
    @Test public void boundsWorksRatherThanCatalogAliasCount(){
        List<List<String>> groups=new ArrayList<>();
        for(int i=1;i<=512;i++)groups=ExposureHistory.append(groups,List.of("danbooru:"+i,"gelbooru:"+i,"rule34:"+i));
        assertEquals(512,groups.size());assertEquals(1536,ExposureHistory.keys(groups).size());
        groups=ExposureHistory.append(groups,List.of("sankaku:next513"));
        assertEquals(512,groups.size());assertFalse(ExposureHistory.keys(groups).contains("danbooru:1"));
    }
    @Test public void mergesOverlappingGroupsAndRetainsAliases(){
        List<List<String>> groups=ExposureHistory.append(List.of(List.of("danbooru:1"),List.of("gelbooru:2")),List.of("danbooru:1","gelbooru:2"));
        assertEquals(1,groups.size());assertEquals(Set.of("danbooru:1","gelbooru:2"),new HashSet<>(groups.get(0)));
    }
    @Test public void ignoresPrivateOrMalformedIdentifiers(){
        assertEquals(List.of("rule34:3"),ExposureHistory.append(List.of(),List.of("rule34:3","https://example.com/private","key:danbooru:1","bogus:1")).get(0));
    }
}
