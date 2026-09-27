package com.artcatalog.mobile;

/** Bounded image preparation, measured in cards rather than list headers/rows. */
final class PreviewWindow {
    final int start,end,visibleEnd;
    PreviewWindow(int first,int visible,int total){
        first=Math.max(0,Math.min(first,total));visible=Math.max(2,visible);
        start=Math.max(0,first-4);visibleEnd=Math.min(total,first+visible);
        end=Math.min(total,visibleEnd+24);
    }
    static boolean needsPage(int first,int visible,int total){
        return total-Math.max(0,first)-Math.max(2,visible)<=24;
    }
}
