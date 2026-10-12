package com.artcatalog.mobile;

import android.content.Context;
import android.graphics.*;
import android.view.*;
import android.widget.ImageView;

final class ZoomImageView extends ImageView {
    private final Matrix matrix=new Matrix();
    private final ScaleGestureDetector scaleDetector;
    private final GestureDetector gestures;
    private float scale=1,minScale=1,x,y,lastX,lastY;
    Runnable onNext,onPrevious,onDoubleTapLike;private float downX,downY;private long downTime;private boolean multiple;
    ZoomImageView(Context context){
        super(context);setScaleType(ScaleType.MATRIX);
        scaleDetector=new ScaleGestureDetector(context,new ScaleGestureDetector.SimpleOnScaleGestureListener(){
            @Override public boolean onScale(ScaleGestureDetector detector){zoom(detector.getScaleFactor(),detector.getFocusX(),detector.getFocusY());return true;}
        });
        gestures=new GestureDetector(context,new GestureDetector.SimpleOnGestureListener(){
            @Override public boolean onDown(MotionEvent e){return true;}
            @Override public boolean onSingleTapConfirmed(MotionEvent e){performClick();return true;}
            @Override public boolean onDoubleTap(MotionEvent e){if(onDoubleTapLike!=null)onDoubleTapLike.run();return true;}
        });
        setContentDescription("Иллюстрация. Свайп вправо или влево листает работы, двойное нажатие ставит лайк, два пальца масштабируют.");
    }
    void fit(){
        if(getDrawable()==null||getWidth()==0||getHeight()==0)return;
        minScale=Math.min((float)getWidth()/getDrawable().getIntrinsicWidth(),(float)getHeight()/getDrawable().getIntrinsicHeight());
        scale=minScale;x=(getWidth()-getDrawable().getIntrinsicWidth()*scale)/2;y=(getHeight()-getDrawable().getIntrinsicHeight()*scale)/2;update();
    }
    private void zoom(float factor,float focusX,float focusY){
        if(getDrawable()==null)return;
        float next=Math.max(minScale,Math.min(minScale*6,scale*factor));factor=next/scale;
        x=focusX-(focusX-x)*factor;y=focusY-(focusY-y)*factor;scale=next;update();
    }
    private void update(){
        if(getDrawable()!=null){float w=getDrawable().getIntrinsicWidth()*scale,h=getDrawable().getIntrinsicHeight()*scale;
            x=w<=getWidth()?(getWidth()-w)/2:Math.min(0,Math.max(getWidth()-w,x));
            y=h<=getHeight()?(getHeight()-h)/2:Math.min(0,Math.max(getHeight()-h,y));}
        matrix.reset();matrix.postScale(scale,scale);matrix.postTranslate(x,y);setImageMatrix(matrix);
    }
    @Override protected void onSizeChanged(int w,int h,int oldw,int oldh){super.onSizeChanged(w,h,oldw,oldh);fit();}
    @Override public boolean onTouchEvent(MotionEvent event){
        gestures.onTouchEvent(event);scaleDetector.onTouchEvent(event);
        if(event.getActionMasked()==MotionEvent.ACTION_DOWN){lastX=event.getX();lastY=event.getY();downX=lastX;downY=lastY;downTime=event.getEventTime();multiple=false;}
        if(event.getPointerCount()>1)multiple=true;
        if(event.getActionMasked()==MotionEvent.ACTION_MOVE&&!scaleDetector.isInProgress()){x+=event.getX()-lastX;y+=event.getY()-lastY;update();}
        if(event.getActionMasked()==MotionEvent.ACTION_UP&&!multiple&&scale<=minScale*1.05f){float dx=event.getX()-downX,dy=event.getY()-downY;float density=getResources().getDisplayMetrics().density;long elapsed=Math.max(1,event.getEventTime()-downTime);if(Math.abs(dx)>Math.abs(dy)*1.15f&&(Math.abs(dx)>56*density||Math.abs(dx)>28*density&&Math.abs(dx)*1000/elapsed>550*density)){Runnable action=dx>0?onNext:onPrevious;if(action!=null)action.run();}}
        lastX=event.getX();lastY=event.getY();return true;
    }
    @Override public boolean performClick(){super.performClick();return true;}
}
