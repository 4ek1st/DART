package com.artcatalog.mobile;
import org.junit.Test;
import static org.junit.Assert.*;
public class PreviewWindowTest {
    @Test public void preparesTwentyFourCardsBelowViewport(){PreviewWindow w=new PreviewWindow(40,8,200);assertEquals(36,w.start);assertEquals(48,w.visibleEnd);assertEquals(72,w.end);}
    @Test public void nearEndClampsAndFetchesMetadataEarly(){PreviewWindow w=new PreviewWindow(90,8,100);assertEquals(100,w.end);assertTrue(PreviewWindow.needsPage(70,8,100));assertFalse(PreviewWindow.needsPage(60,8,100));}
    @Test public void emptyAndInitialWindowsStayBounded(){PreviewWindow empty=new PreviewWindow(0,0,0);assertEquals(0,empty.end);PreviewWindow initial=new PreviewWindow(0,0,150);assertEquals(0,initial.start);assertEquals(26,initial.end);}
}
