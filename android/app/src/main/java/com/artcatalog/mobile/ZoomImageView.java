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
    Runnable onNext,onPrevious;private float downX,downY;private boolean multiple;
    ZoomImageView(Context context){
        super(context);setScaleType(ScaleType.MATRIX);
        scaleDetector=new ScaleGestureDetector(context,new ScaleGestureDetector.SimpleOnScaleGestureListener(){
            @Override public boolean onScale(ScaleGestureDetector detector){zoom(detector.getScaleFactor(),detector.getFocusX(),detector.getFocusY());return true;}
        });
        gestures=new GestureDetector(context,new GestureDetector.SimpleOnGestureListener(){
            @Override public boolean onDown(MotionEvent e){return true;}
            @Override public boolean onSingleTapConfirmed(MotionEvent e){performClick();return true;}
            @Override public boolean onDoubleTap(MotionEvent e){if(scale>minScale*1.3f)fit();else zoom(2.5f,e.getX(),e.getY());return true;}
        });
        setContentDescription("Иллюстрация. Масштабирование двумя пальцами или двойным нажатием.");
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
        if(event.getActionMasked()==MotionEvent.ACTION_DOWN){lastX=event.getX();lastY=event.getY();downX=lastX;downY=lastY;multiple=false;}
        if(event.getPointerCount()>1)multiple=true;
        if(event.getActionMasked()==MotionEvent.ACTION_MOVE&&!scaleDetector.isInProgress()){x+=event.getX()-lastX;y+=event.getY()-lastY;update();}
        if(event.getActionMasked()==MotionEvent.ACTION_UP&&!multiple&&scale<=minScale*1.05f){float dx=event.getX()-downX,dy=event.getY()-downY;if(Math.abs(dx)>64*getResources().getDisplayMetrics().density&&Math.abs(dx)>Math.abs(dy)*1.4f){Runnable action=dx>0?onNext:onPrevious;if(action!=null)action.run();}}
        lastX=event.getX();lastY=event.getY();return true;
    }
    @Override public boolean performClick(){super.performClick();return true;}
}
