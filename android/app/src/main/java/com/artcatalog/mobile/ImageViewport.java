package com.artcatalog.mobile;

/** Geometry of one media viewport, independent of Android drawing and input dispatch. */
final class ImageViewport {
    static final class State {final float minimum,scale,x,y;State(float minimum,float scale,float x,float y){this.minimum=minimum;this.scale=scale;this.x=x;this.y=y;}}
    static State fit(int width,int height,int mediaWidth,int mediaHeight){if(width<=0||height<=0||mediaWidth<=0||mediaHeight<=0)return null;float minimum=Math.min(width/(float)mediaWidth,height/(float)mediaHeight);return new State(minimum,minimum,(width-mediaWidth*minimum)/2,(height-mediaHeight*minimum)/2);}
    static State upgrade(int oldWidth,int oldHeight,int oldMediaWidth,int oldMediaHeight,State previous,int width,int height,int mediaWidth,int mediaHeight){
        State fitted=fit(width,height,mediaWidth,mediaHeight);if(fitted==null)return null;
        if(previous==null||oldWidth<=0||oldHeight<=0||oldMediaWidth<=0||oldMediaHeight<=0||previous.minimum<=0||previous.scale<=0||!Float.isFinite(previous.minimum)||!Float.isFinite(previous.scale)||!Float.isFinite(previous.x)||!Float.isFinite(previous.y))return fitted;
        if(oldWidth==width&&oldHeight==height&&oldMediaWidth==mediaWidth&&oldMediaHeight==mediaHeight)return previous;
        float zoom=Math.max(1,Math.min(6,previous.scale/previous.minimum));
        float focusX=Math.max(0,Math.min(1,(oldWidth/2f-previous.x)/(oldMediaWidth*previous.scale))),focusY=Math.max(0,Math.min(1,(oldHeight/2f-previous.y)/(oldMediaHeight*previous.scale)));
        float scale=fitted.minimum*zoom,scaledWidth=mediaWidth*scale,scaledHeight=mediaHeight*scale;
        float x=width/2f-focusX*scaledWidth,y=height/2f-focusY*scaledHeight;
        x=scaledWidth<=width?(width-scaledWidth)/2:Math.max(width-scaledWidth,Math.min(0,x));y=scaledHeight<=height?(height-scaledHeight)/2:Math.max(height-scaledHeight,Math.min(0,y));
        return new State(fitted.minimum,scale,x,y);
    }
}
