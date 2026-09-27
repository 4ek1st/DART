package com.artcatalog.mobile;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;
public class GalleryMediaTest {
    private Post post(String source,String url,String hash){Post p=new Post();p.source=source;p.id="1";p.image=url;p.original=url;p.media=List.of(url);p.hash=hash;return p;}
    @Test public void duplicateHashKeepsOnlyTheAlreadyOpenImage(){Post current=post("rule34","https://rule34.xxx/a.jpg","same"),newPrimary=post("danbooru","https://cdn.donmai.us/b.jpg","SAME");assertFalse(CatalogLogic.updateGalleryMedia(current,newPrimary));assertEquals(List.of(current.image),current.media);assertEquals(1,current.imageRecords.length());}
    @Test public void differentVariantAppendsWithoutChangingTheFirstImage(){Post current=post("rule34","https://rule34.xxx/a.jpg","first"),incoming=post("danbooru","https://cdn.donmai.us/b.jpg","second");assertTrue(CatalogLogic.updateGalleryMedia(current,incoming));assertEquals(List.of(current.image,incoming.image),current.media);assertFalse(CatalogLogic.updateGalleryMedia(current,incoming));assertEquals(2,current.imageRecords.length());}
}
