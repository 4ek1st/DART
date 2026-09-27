package com.artcatalog.mobile;

import android.content.Context;
import android.graphics.*;
import android.view.View;

final class IconView extends View {
    private final String kind;
    private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path p=new Path();
    private int color;
    boolean filled;
    IconView(Context c,String kind,int color){super(c);this.kind=kind;this.color=color;setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);}
    void color(int c){color=c;invalidate();}
    @Override protected void onDraw(Canvas canvas){
        super.onDraw(canvas);canvas.save();float side=Math.min(getWidth(),getHeight())*.62f;
        canvas.translate((getWidth()-side)/2,(getHeight()-side)/2);canvas.scale(side/24,side/24);
        paint.setColor(color);paint.setStrokeWidth(1.8f);paint.setStrokeCap(Paint.Cap.ROUND);paint.setStrokeJoin(Paint.Join.ROUND);paint.setStyle(Paint.Style.STROKE);
        p.reset();
        switch(kind){
            case "home":p.moveTo(3,10);p.lineTo(12,3);p.lineTo(21,10);p.moveTo(5,9);p.lineTo(5,21);p.lineTo(10,21);p.lineTo(10,14);p.lineTo(14,14);p.lineTo(14,21);p.lineTo(19,21);p.lineTo(19,9);break;
            case "search":canvas.drawCircle(10.5f,10.5f,6.5f,paint);canvas.drawLine(16,16,21,21,paint);break;
            case "heart":p.moveTo(12,21);p.cubicTo(9,18,2,13,2,8);p.cubicTo(2,1,10,1,12,7);p.cubicTo(14,1,22,1,22,8);p.cubicTo(22,13,15,18,12,21);p.close();if(filled)paint.setStyle(Paint.Style.FILL);break;
            case "bookmark":p.moveTo(6,3);p.lineTo(18,3);p.lineTo(18,22);p.lineTo(12,17);p.lineTo(6,22);p.close();break;
            case "users":canvas.drawCircle(9,7,3,paint);p.moveTo(2,21);p.lineTo(2,17);p.cubicTo(2,11,16,11,16,17);p.lineTo(16,21);p.moveTo(17,4);p.cubicTo(23,5,23,11,17,11);p.moveTo(18,14);p.cubicTo(23,14,23,19,23,21);break;
            case "profile":canvas.drawCircle(12,7,4,paint);p.moveTo(4,22);p.lineTo(4,18);p.cubicTo(4,12,20,12,20,18);p.lineTo(20,22);p.close();break;
            case "new":p.moveTo(7,3);p.lineTo(17,3);p.lineTo(17,21);p.lineTo(7,21);p.close();p.moveTo(10,16);p.lineTo(10,8);p.lineTo(14,16);p.lineTo(14,8);break;
            case "bell":p.moveTo(4,17);p.cubicTo(9,13,3,6,12,4);p.cubicTo(21,6,15,13,20,17);p.close();p.moveTo(9,21);p.quadTo(12,23,15,21);break;
            case "clock":canvas.drawCircle(12,12,9,paint);p.moveTo(12,6);p.lineTo(12,12);p.lineTo(17,15);break;
            case "back":p.moveTo(15,4);p.lineTo(7,12);p.lineTo(15,20);break;
            case "menu":for(int i=6;i<=18;i+=6)canvas.drawLine(3,i,21,i,paint);break;
            case "filter":for(int i=5;i<=19;i+=7){canvas.drawLine(3,i,21,i,paint);paint.setStyle(Paint.Style.FILL);canvas.drawCircle(i==12?8:16,i,2.5f,paint);paint.setStyle(Paint.Style.STROKE);}break;
            case "refresh":p.moveTo(20,10);p.cubicTo(17,1,4,2,3,12);p.cubicTo(2,22,17,23,20,16);p.moveTo(20,4);p.lineTo(20,10);p.lineTo(14,10);break;
            case "share":canvas.drawCircle(18,4,2.5f,paint);canvas.drawCircle(5,12,2.5f,paint);canvas.drawCircle(18,20,2.5f,paint);p.moveTo(7,11);p.lineTo(15,5);p.moveTo(7,13);p.lineTo(15,19);break;
            case "download":p.moveTo(12,2);p.lineTo(12,16);p.moveTo(6,10);p.lineTo(12,16);p.lineTo(18,10);p.moveTo(3,17);p.lineTo(3,22);p.lineTo(21,22);p.lineTo(21,17);break;
            case "settings":canvas.drawCircle(12,12,4,paint);canvas.drawCircle(12,12,8,paint);for(int i=0;i<8;i++){double a=i*Math.PI/4;canvas.drawLine(12+(float)Math.cos(a)*8,12+(float)Math.sin(a)*8,12+(float)Math.cos(a)*11,12+(float)Math.sin(a)*11,paint);}break;
            case "spark":p.moveTo(12,2);p.lineTo(15,9);p.lineTo(22,12);p.lineTo(15,15);p.lineTo(12,22);p.lineTo(9,15);p.lineTo(2,12);p.lineTo(9,9);p.close();break;
            default:p.moveTo(9,4);p.lineTo(17,12);p.lineTo(9,20);
        }
        canvas.drawPath(p,paint);canvas.restore();
    }
}
