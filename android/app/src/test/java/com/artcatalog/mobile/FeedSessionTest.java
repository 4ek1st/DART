package com.artcatalog.mobile;

import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;

public class FeedSessionTest {
    private Post post(String id){Post p=new Post();p.source="danbooru";p.id=id;return p;}
    @Test public void publishedWorkSurvivesNewViewedFilterAndKeepsItsPosition(){
        Post first=post("1"),second=post("2"),third=post("3");
        List<Post> result=FeedSession.visible(List.of(first,second),List.of(second,third,first),p->!p.id.equals("1"));
        assertEquals(List.of(first,second,third),result);
    }
    @Test public void filtersApplyOnlyToNewArrivals(){
        Post first=post("1"),second=post("2");
        assertEquals(List.of(first),FeedSession.visible(List.of(first),List.of(first,second),p->false));
    }
    @Test public void catalogAliasCannotAppendAnotherCopy(){
        Post first=post("1"),alias=post("2");alias.source="gelbooru";alias.memberKeys=List.of(first.key(),alias.key());
        List<Post> result=FeedSession.visible(List.of(first),List.of(alias),p->true);
        assertEquals(1,result.size());assertSame(alias,result.get(0));
    }
    @Test public void explicitNewVisitMayFilterPreviousWorks(){
        Post first=post("1");assertTrue(FeedSession.visible(List.of(),List.of(first),p->false).isEmpty());
    }
    @Test public void commonWeakParentDoesNotCollapseSeparatePublications(){
        Post first=post("1"),second=post("2");first.groupKey=second.groupKey="danbooru:parent:77";first.pixivGroupKey="pixiv:100";second.pixivGroupKey="pixiv:200";
        assertEquals(2,FeedSession.visible(List.of(first),List.of(first,second),p->true).size());
    }
}
