package com.artcatalog.mobile;

import android.content.Context;
import android.graphics.*;
import android.graphics.drawable.Drawable;
import android.view.*;
import android.widget.ImageView;
import java.util.Objects;

final class ZoomImageView extends ImageView {
    private final Matrix matrix=new Matrix();
    private final ScaleGestureDetector scaleDetector;
    private final GestureDetector gestures;
    private float scale=1,minScale=1,x,y,lastX,lastY,pinchX,pinchY;
    private int activePointer=-1;
    private int mediaWidth,mediaHeight,viewportWidth,viewportHeight;
    private Object mediaIdentity;
    Runnable onNext,onPrevious,onDoubleTapLike;private float downX,downY;private long downTime;private boolean multiple;
    ZoomImageView(Context context){
        super(context);setScaleType(ScaleType.MATRIX);
        scaleDetector=new ScaleGestureDetector(context,new ScaleGestureDetector.SimpleOnScaleGestureListener(){
            @Override public boolean onScaleBegin(ScaleGestureDetector detector){pinchX=detector.getFocusX();pinchY=detector.getFocusY();return true;}
            @Override public boolean onScale(ScaleGestureDetector detector){zoom(detector.getScaleFactor(),detector.getFocusX(),detector.getFocusY());return true;}
        });
        scaleDetector.setQuickScaleEnabled(false);scaleDetector.setStylusScaleEnabled(false);
        gestures=new GestureDetector(context,new GestureDetector.SimpleOnGestureListener(){
            @Override public boolean onDown(MotionEvent e){return true;}
            @Override public boolean onSingleTapConfirmed(MotionEvent e){performClick();return true;}
            @Override public boolean onDoubleTap(MotionEvent e){if(onDoubleTapLike!=null)onDoubleTapLike.run();return true;}
        });
        setContentDescription("Иллюстрация. Свайп вправо или влево листает работы, двойное нажатие ставит лайк, два пальца масштабируют.");
    }
    void fit(){
        Drawable drawable=getDrawable();int width=drawable==null?0:drawable.getIntrinsicWidth(),height=drawable==null?0:drawable.getIntrinsicHeight();ImageViewport.State fitted=ImageViewport.fit(getWidth(),getHeight(),width,height);
        mediaIdentity=identity();viewportWidth=getWidth();viewportHeight=getHeight();mediaWidth=Math.max(0,width);mediaHeight=Math.max(0,height);
        if(fitted==null){minScale=scale=1;x=y=0;matrix.reset();setImageMatrix(matrix);return;}apply(fitted);
    }
    /** Quality upgrades keep the user's zoom and subject; explicit artwork navigation still calls fit(). */
    void fitSameMedia(){
        Drawable drawable=getDrawable();if(drawable==null||drawable.getIntrinsicWidth()<=0||drawable.getIntrinsicHeight()<=0)return;
        if(!Objects.equals(mediaIdentity,identity())||mediaWidth<=0||mediaHeight<=0){fit();return;}
        int width=drawable.getIntrinsicWidth(),height=drawable.getIntrinsicHeight();if(viewportWidth==getWidth()&&viewportHeight==getHeight()&&mediaWidth==width&&mediaHeight==height)return;
        ImageViewport.State next=ImageViewport.upgrade(viewportWidth,viewportHeight,mediaWidth,mediaHeight,new ImageViewport.State(minScale,scale,x,y),getWidth(),getHeight(),width,height);
        if(next==null)return;viewportWidth=getWidth();viewportHeight=getHeight();mediaWidth=width;mediaHeight=height;apply(next);
    }
    private Object identity(){Object tag=getTag();return tag instanceof ImageLoader.Ticket?((ImageLoader.Ticket)tag).identity:tag;}
    private void apply(ImageViewport.State state){minScale=state.minimum;scale=state.scale;x=state.x;y=state.y;update();}
    @Override public void setImageDrawable(Drawable drawable){Object identity=identity();boolean same=identity!=null&&Objects.equals(mediaIdentity,identity);super.setImageDrawable(drawable);if(matrix==null)return;if(same)fitSameMedia();else fit();}
    private void zoom(float factor,float focusX,float focusY){
        if(getDrawable()==null||getDrawable().getIntrinsicWidth()<=0||getDrawable().getIntrinsicHeight()<=0||!Float.isFinite(factor)||factor<=0)return;
        float next=Math.max(minScale,Math.min(minScale*6,scale*factor));factor=next/scale;
        x=focusX-(pinchX-x)*factor;y=focusY-(pinchY-y)*factor;pinchX=focusX;pinchY=focusY;scale=next;update();
    }
    private void update(){
        if(getDrawable()!=null&&getDrawable().getIntrinsicWidth()>0&&getDrawable().getIntrinsicHeight()>0){float w=getDrawable().getIntrinsicWidth()*scale,h=getDrawable().getIntrinsicHeight()*scale;
            x=w<=getWidth()?(getWidth()-w)/2:Math.min(0,Math.max(getWidth()-w,x));
            y=h<=getHeight()?(getHeight()-h)/2:Math.min(0,Math.max(getHeight()-h,y));}
        matrix.reset();matrix.postScale(scale,scale);matrix.postTranslate(x,y);setImageMatrix(matrix);
    }
    @Override protected void onSizeChanged(int w,int h,int oldw,int oldh){super.onSizeChanged(w,h,oldw,oldh);fitSameMedia();}
    @Override public boolean onTouchEvent(MotionEvent event){
        gestures.onTouchEvent(event);scaleDetector.onTouchEvent(event);
        int action=event.getActionMasked();
        if(action==MotionEvent.ACTION_DOWN){activePointer=event.getPointerId(0);lastX=event.getX();lastY=event.getY();downX=lastX;downY=lastY;downTime=event.getEventTime();multiple=false;}
        if(event.getPointerCount()>1)multiple=true;
        if(action==MotionEvent.ACTION_POINTER_UP){
            int lifted=event.getActionIndex(),remaining=lifted==0?1:0;
            if(event.getPointerId(lifted)==activePointer)activePointer=event.getPointerId(remaining);
            int index=event.findPointerIndex(activePointer);if(index>=0){lastX=event.getX(index);lastY=event.getY(index);}return true;
        }
        int index=event.findPointerIndex(activePointer);
        if(action==MotionEvent.ACTION_MOVE&&index>=0&&event.getPointerCount()==1&&!scaleDetector.isInProgress()){x+=event.getX(index)-lastX;y+=event.getY(index)-lastY;update();}
        if(action==MotionEvent.ACTION_UP&&!multiple&&scale<=minScale*1.05f){float dx=event.getX()-downX,dy=event.getY()-downY;float density=getResources().getDisplayMetrics().density;long elapsed=Math.max(1,event.getEventTime()-downTime);if(Math.abs(dx)>Math.abs(dy)*1.15f&&(Math.abs(dx)>56*density||Math.abs(dx)>28*density&&Math.abs(dx)*1000/elapsed>550*density)){Runnable turn=dx<0?onNext:onPrevious;if(turn!=null)turn.run();}}
        if(index>=0){lastX=event.getX(index);lastY=event.getY(index);}if(action==MotionEvent.ACTION_UP||action==MotionEvent.ACTION_CANCEL)activePointer=-1;return true;
    }
    @Override public boolean performClick(){super.performClick();return true;}
}
