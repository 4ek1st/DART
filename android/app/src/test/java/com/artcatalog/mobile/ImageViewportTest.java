package com.artcatalog.mobile;

import org.junit.Test;
import static org.junit.Assert.*;

public class ImageViewportTest {
    @Test public void fullQualityUpgradeKeepsRelativeZoomAndNormalizedSubjectCenter(){
        ImageViewport.State preview=new ImageViewport.State(4,8,-400,0);
        ImageViewport.State full=ImageViewport.upgrade(400,800,100,200,preview,400,800,1000,2000);
        assertEquals(2,full.scale/full.minimum,.0001);assertEquals(.75,(200-full.x)/(1000*full.scale),.0001);assertEquals(.25,(400-full.y)/(2000*full.scale),.0001);
    }
    @Test public void foldingViewportKeepsRelativeZoomAndFocusWithinPanLimits(){
        ImageViewport.State before=new ImageViewport.State(.4f,1.2f,-520,-560);
        ImageViewport.State after=ImageViewport.upgrade(400,800,1000,2000,before,800,800,1000,2000);
        assertEquals(3,after.scale/after.minimum,.0001);assertEquals(.6,(400-after.x)/(1000*after.scale),.0001);assertEquals(.4,(400-after.y)/(2000*after.scale),.0001);
    }
    @Test public void repeatedSameGeometryCallbackDoesNotMoveOrResetUserTransform(){
        ImageViewport.State before=new ImageViewport.State(.4f,1.2f,-520,-560);
        assertSame(before,ImageViewport.upgrade(400,800,1000,2000,before,400,800,1000,2000));
    }
    @Test public void explicitNewArtworkFitResetsZoomAndCentersTheNewImage(){
        ImageViewport.State fitted=ImageViewport.fit(400,800,1000,1000);assertEquals(1,fitted.scale/fitted.minimum,0);assertEquals(0,fitted.x,0);assertEquals(200,fitted.y,0);
    }
    @Test public void placeholdersAndInvalidPreviousGeometryNeverCreateNegativeOrInfiniteScale(){
        assertNull(ImageViewport.fit(400,800,-1,-1));ImageViewport.State result=ImageViewport.upgrade(0,0,0,0,null,400,800,1000,2000);assertEquals(1,result.scale/result.minimum,0);assertTrue(Float.isFinite(result.scale));
    }
}
