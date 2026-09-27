package com.artcatalog.mobile;

import android.content.Context;
import android.view.*;

final class FlowLayout extends ViewGroup {
    private final int gap;
    FlowLayout(Context context){super(context);gap=(int)(8*getResources().getDisplayMetrics().density);}
    @Override protected void onMeasure(int ws,int hs){
        int width=MeasureSpec.getSize(ws),x=getPaddingLeft(),y=getPaddingTop(),row=0;
        for(int i=0;i<getChildCount();i++){
            View child=getChildAt(i);measureChild(child,ws,hs);
            if(x+child.getMeasuredWidth()>width-getPaddingRight()&&x>getPaddingLeft()){x=getPaddingLeft();y+=row+gap;row=0;}
            x+=child.getMeasuredWidth()+gap;row=Math.max(row,child.getMeasuredHeight());
        }
        setMeasuredDimension(width,y+row+getPaddingBottom());
    }
    @Override protected void onLayout(boolean changed,int l,int t,int r,int b){
        int x=getPaddingLeft(),y=getPaddingTop(),row=0,width=r-l;
        for(int i=0;i<getChildCount();i++){
            View child=getChildAt(i);int w=child.getMeasuredWidth(),h=child.getMeasuredHeight();
            if(x+w>width-getPaddingRight()&&x>getPaddingLeft()){x=getPaddingLeft();y+=row+gap;row=0;}
            child.layout(x,y,x+w,y+h);x+=w+gap;row=Math.max(row,h);
        }
    }
}
