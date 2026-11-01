package com.artcatalog.mobile;

import org.junit.Test;
import static org.junit.Assert.*;

public class ImageCacheIdentityTest {
    private static final String HASH="0123456789abcdef0123456789abcdef";
    @Test public void renewedSankakuSignatureKeepsSuccessfulBitmapIdentityButNotFailureIdentity() {
        String old="https://v.sankakucomplex.com/preview/"+HASH+".jpg?e=100&m=old",fresh="https://v.sankakucomplex.com/preview/"+HASH+".jpg?e=200&m=fresh";
        assertEquals(ImageLoader.mediaKey(old,720),ImageLoader.mediaKey(fresh,720));assertNotEquals(ImageLoader.failureKey(old,720),ImageLoader.failureKey(fresh,720));
    }
    @Test public void originalFileKeepsIdentityAcrossSignedCdnMirrors() {
        String first="https://v.sankakucomplex.com/o/01/23/"+HASH+".jpg?e=100&m=old",second="https://cs.sankakucomplex.com/data/01/23/"+HASH+".jpg?e=200&m=fresh";
        assertEquals(ImageLoader.mediaKey(first,2000),ImageLoader.mediaKey(second,2000));
    }
    @Test public void changedBytesPreviewVariantAndDecodeSizesCannotCollide() {
        String original="https://v.sankakucomplex.com/o/01/23/"+HASH+".jpg?e=100&m=old";
        String different=original.replace(HASH,"abcdef0123456789abcdef0123456789"),preview=original.replace("/o/","/preview/");
        assertNotEquals(ImageLoader.mediaKey(original,720),ImageLoader.mediaKey(different,720));assertNotEquals(ImageLoader.mediaKey(original,720),ImageLoader.mediaKey(preview,720));assertNotEquals(ImageLoader.mediaKey(original,720),ImageLoader.mediaKey(original,2000));
    }
    @Test public void nonSignatureTransformArgumentsRemainPartOfTheIdentity() {
        String url="https://v.sankakucomplex.com/preview/"+HASH+".jpg?e=100&m=old&width=720";
        assertNotEquals(ImageLoader.mediaKey(url,720),ImageLoader.mediaKey(url.replace("width=720","width=360"),720));
    }
}
