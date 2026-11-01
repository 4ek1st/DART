package com.artcatalog.mobile;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;
public class GalleryMediaTest {
    private Post post(String source,String url,String hash){Post p=new Post();p.source=source;p.id="1";p.image=url;p.original=url;p.media=List.of(url);p.hash=hash;return p;}
    @Test public void duplicateHashKeepsOnlyTheAlreadyOpenImage(){Post current=post("rule34","https://rule34.xxx/a.jpg","same"),newPrimary=post("danbooru","https://cdn.donmai.us/b.jpg","SAME");assertFalse(CatalogLogic.updateGalleryMedia(current,newPrimary));assertEquals(List.of(current.image),current.media);assertEquals(1,current.imageRecords.length());}
    @Test public void differentVariantAppendsWithoutChangingTheFirstImage(){Post current=post("rule34","https://rule34.xxx/a.jpg","first"),incoming=post("danbooru","https://cdn.donmai.us/b.jpg","second");assertTrue(CatalogLogic.updateGalleryMedia(current,incoming));assertEquals(List.of(current.image,incoming.image),current.media);assertFalse(CatalogLogic.updateGalleryMedia(current,incoming));assertEquals(2,current.imageRecords.length());}
    @Test public void importedEmptySankakuMediaHydratesFromFreshDetail(){Post current=post("sankaku","","");current.media=List.of("");current.originalUrl="https://example.com/original";current.sourceUrl="https://sankaku.app/posts/1";
        Post fresh=post("sankaku","https://s.sankakucomplex.com/o/01/23/0123456789abcdef0123456789abcdef.jpg?e=9&m=new","0123456789abcdef0123456789abcdef");fresh.preview="https://s.sankakucomplex.com/preview.jpg";
        CatalogLogic.refreshSignedMedia(current,fresh);assertEquals(fresh.media,current.media);assertEquals(1,current.imageRecords.length());assertEquals(fresh.preview,current.preview);assertEquals("https://example.com/original",current.originalUrl);assertEquals("https://sankaku.app/posts/1",current.sourceUrl);
    }
    @Test public void signedRenewalPreservesOtherGroupedVariants(){String hash="0123456789abcdef0123456789abcdef";Post current=post("sankaku","https://s.sankakucomplex.com/o/01/23/"+hash+".jpg?e=1&m=old",hash);current.media=List.of(current.image,"https://cdn.donmai.us/another.jpg");
        Post fresh=post("sankaku","https://v.sankakucomplex.com/data/01/23/"+hash+".jpg?expires=9&token=new",hash);CatalogLogic.refreshSignedMedia(current,fresh);assertEquals(List.of(fresh.image,"https://cdn.donmai.us/another.jpg"),current.media);assertEquals(2,current.imageRecords.length());
    }
}
