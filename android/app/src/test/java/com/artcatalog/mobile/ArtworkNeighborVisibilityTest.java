package com.artcatalog.mobile;

import org.junit.Test;
import java.util.*;
import java.util.function.Predicate;
import static org.junit.Assert.*;

public class ArtworkNeighborVisibilityTest {
    private Post post(int id){Post p=new Post();p.source="danbooru";p.id=""+id;return p;}
    private Post next(List<Post> posts,Post current,int delta,Predicate<Post> allowed)throws Exception{
        try{return (Post)CatalogLogic.class.getDeclaredMethod("neighbor",List.class,Post.class,int.class,Predicate.class).invoke(null,posts,current,delta,allowed);}
        catch(NoSuchMethodException missing){throw new AssertionError("A hidden work must not block every later gallery work",missing);}
    }
    @Test public void hiddenArtworkBetweenVisibleWorksDoesNotTrapEitherDirection()throws Exception{
        Post a=post(1),hidden=post(2),c=post(3);List<Post> gallery=List.of(a,hidden,c);
        assertSame(c,next(gallery,a,1,p->p!=hidden));assertSame(a,next(gallery,c,-1,p->p!=hidden));
    }
    @Test public void boundaryAndPreloadingCountOnlyPermittedNeighbors()throws Exception{
        Post a=post(1),hidden=post(2),c=post(3),d=post(4);List<Post> gallery=List.of(a,hidden,c,d);
        assertSame(d,next(gallery,a,2,p->p!=hidden));assertNull(next(gallery,d,1,p->p!=hidden));assertNull(next(gallery,a,1,p->false));
    }
    @Test public void groupedAliasesAndTheUnfilteredContractStillWork()throws Exception{
        Post original=post(1),group=post(9),next=post(2);group.memberKeys=List.of(original.key(),group.key());
        assertSame(next,next(List.of(group,next),original,1,p->true));assertSame(next,CatalogLogic.neighbor(List.of(group,next),original,1));
    }
}
