package com.artcatalog.mobile;

import java.util.*;
import org.junit.Test;
import static org.junit.Assert.*;

public class FeedPresentationTest {
    private Post post(String source,String id,String preview,String... aliases){Post p=new Post();p.source=source;p.id=id;p.preview=preview;p.memberKeys=List.of(aliases);return p;}
    @Test public void latePreferredMirrorKeepsPublishedKeyAndPoster(){
        FeedPresentation view=new FeedPresentation();Post old=post("rule34","1","https://rule34.xxx/one.jpg");
        view.update(List.of(old),p->p.preview,url->false);String key=view.key(old);
        Post mirror=post("danbooru","2","https://cdn.donmai.us/one.jpg",old.key(),"danbooru:2");mirror.title="Enriched title";
        view.update(List.of(mirror),p->p.preview,url->false);
        assertEquals(key,view.key(mirror));assertEquals(old.preview,view.preview(mirror));assertEquals("Enriched title",mirror.title);
    }
    @Test public void oneUnreadyThumbnailDoesNotRemoveAnyMetadataSlot(){
        FeedPresentation view=new FeedPresentation();List<Post> posts=List.of(post("rule34","1","https://rule34.xxx/slow.jpg"),post("danbooru","2","https://cdn.donmai.us/ready.jpg"));
        view.update(posts,p->p.preview,url->false);
        assertEquals(2,view.size());assertNotEquals(view.key(posts.get(0)),view.key(posts.get(1)));
    }
    @Test public void signatureRenewsWithoutChangingPresentationIdentity(){
        FeedPresentation view=new FeedPresentation();Post p=post("sankaku","abc1","https://s.sankakucomplex.com/a.jpg?e=1&m=old");
        view.update(List.of(p),item->item.preview,url->false);String key=view.key(p);
        Post fresh=post("sankaku","abc1","https://s.sankakucomplex.com/a.jpg?e=999&m=new");view.update(List.of(fresh),item->item.preview,url->false);
        assertEquals(key,view.key(fresh));assertEquals(fresh.preview,view.preview(fresh));
    }
    @Test public void failedPosterCanUseWorkingMirrorButNewVisitCanChooseNewQuality(){
        FeedPresentation view=new FeedPresentation();Post old=post("rule34","1","https://rule34.xxx/broken.jpg"),mirror=post("danbooru","2","https://cdn.donmai.us/good.jpg",old.key());
        view.update(List.of(old),p->p.preview,url->false);view.update(List.of(mirror),p->p.preview,url->url.equals(old.preview));assertEquals(mirror.preview,view.preview(mirror));
        view.reset();view.update(List.of(mirror),p->p.preview,url->false);assertEquals(mirror.key(),view.key(mirror));
    }
    @Test public void recycledVisitDoesNotRetainRemovedWorksAndIdsStayUnique(){
        FeedPresentation view=new FeedPresentation();Post first=post("danbooru","1",""),duplicate=post("danbooru","1","");view.update(List.of(first,duplicate),p->p.preview,url->false);
        assertNotEquals(view.key(first),view.key(duplicate));view.update(List.of(first),p->p.preview,url->false);assertEquals(1,view.size());
    }
}
