package com.artcatalog.mobile;

import android.content.Context;
import android.database.DataSetObserver;
import android.view.*;
import android.widget.*;
import androidx.recyclerview.widget.*;
import java.util.*;
import java.util.function.Consumer;
import java.util.function.IntConsumer;

/** Native feed shared by every gallery. Data changes touch only changed rows. */
final class FeedListView extends RecyclerView {
    interface ScrollListener {
        int SCROLL_STATE_TOUCH_SCROLL=1;
        void onScrollStateChanged(FeedListView view,int state);
        void onScroll(FeedListView view,int first,int visible,int total);
    }
    private final LinearLayoutManager layout;
    private View header,footer;
    private Bridge bridge;
    private ScrollListener listener;
    private Consumer<View> recycler,restorer;
    private IntConsumer horizontalSwipe;
    private float swipeDownX,swipeDownY;private long swipeDownTime;private boolean swiping,multiTouch;
    FeedListView(Context context){
        super(context);layout=new LinearLayoutManager(context);layout.setInitialPrefetchItemCount(8);
        setLayoutManager(layout);setItemAnimator(null);setItemViewCacheSize(12);
        addOnScrollListener(new OnScrollListener(){
            @Override public void onScrollStateChanged(RecyclerView view,int state){if(listener!=null)listener.onScrollStateChanged(FeedListView.this,state);}
            @Override public void onScrolled(RecyclerView view,int dx,int dy){dispatchScroll();}
        });
    }
    void addHeaderView(View view,Object ignored,boolean selectable){header=view;}
    void addFooterView(View view,Object ignored,boolean selectable){footer=view;}
    void setRecyclerListener(Consumer<View> listener){recycler=listener;}
    void setRestoreListener(Consumer<View> listener){restorer=listener;}
    void setOnScrollListener(ScrollListener listener){this.listener=listener;post(this::dispatchScroll);}
    void setHorizontalSwipeListener(IntConsumer listener){horizontalSwipe=listener;}
    @Override public boolean onInterceptTouchEvent(MotionEvent event){
        if(horizontalSwipe==null)return super.onInterceptTouchEvent(event);
        int action=event.getActionMasked();
        if(action==MotionEvent.ACTION_DOWN){swipeDownX=event.getX();swipeDownY=event.getY();swipeDownTime=event.getEventTime();swiping=false;multiTouch=false;}
        else if(event.getPointerCount()>1)multiTouch=true;
        else if(action==MotionEvent.ACTION_MOVE&&!multiTouch){float dx=Math.abs(event.getX()-swipeDownX),dy=Math.abs(event.getY()-swipeDownY);
            float density=getResources().getDisplayMetrics().density;
            if(dx>12*density&&dx>dy*1.15f){swiping=true;getParent().requestDisallowInterceptTouchEvent(true);return true;}}
        return swiping||super.onInterceptTouchEvent(event);
    }
    @Override public boolean onTouchEvent(MotionEvent event){
        if(!swiping||horizontalSwipe==null)return super.onTouchEvent(event);
        int action=event.getActionMasked();
        if(action==MotionEvent.ACTION_UP){float dx=event.getX()-swipeDownX,dy=event.getY()-swipeDownY;
            long elapsed=Math.max(1,event.getEventTime()-swipeDownTime);float density=getResources().getDisplayMetrics().density;
            if(!multiTouch&&Math.abs(dx)>Math.abs(dy)*1.15f&&(Math.abs(dx)>56*density||Math.abs(dx)>28*density&&Math.abs(dx)*1000/elapsed>550*density))horizontalSwipe.accept(dx>0?1:-1);
            swiping=false;return true;}
        if(action==MotionEvent.ACTION_CANCEL){swiping=false;return true;}return true;
    }
    int getFirstVisiblePosition(){return Math.max(0,layout.findFirstVisibleItemPosition());}
    int getVisibleCount(){int first=layout.findFirstVisibleItemPosition(),last=layout.findLastVisibleItemPosition();return first<0?0:last-first+1;}
    void setSelection(int position){setSelectionFromTop(position,0);}
    void setSelectionFromTop(int position,int top){layout.scrollToPositionWithOffset(position,top-getPaddingTop());}
    void setAdapter(BaseAdapter source){bridge=new Bridge(source);super.setAdapter(bridge);}
    void suspend(){setItemViewCacheSize(0);getRecycledViewPool().clear();if(header!=null&&recycler!=null)recycler.accept(header);}
    View headerContent(){return header;}
    void resume(){setItemViewCacheSize(12);if(header!=null&&restorer!=null)restorer.accept(header);}
    private void dispatchScroll(){if(listener!=null&&bridge!=null)listener.onScroll(this,getFirstVisiblePosition(),getVisibleCount(),bridge.getItemCount());}
    private static final class Entry {
        final long id;final int type,index;final Object content;
        Entry(long id,int type,int index,Object content){this.id=id;this.type=type;this.index=index;this.content=content;}
    }
    private static final class Holder extends ViewHolder {
        final FrameLayout box;
        Holder(FrameLayout box){super(box);this.box=box;}
    }
    private final class Bridge extends Adapter<Holder> {
        final BaseAdapter source;List<Entry> rows=new ArrayList<>();boolean scheduled;
        Bridge(BaseAdapter source){this.source=source;setHasStableIds(true);rows=snapshot();source.registerDataSetObserver(new DataSetObserver(){@Override public void onChanged(){update();}@Override public void onInvalidated(){update();}});}
        List<Entry> snapshot(){List<Entry> result=new ArrayList<>();if(header!=null)result.add(new Entry(Long.MIN_VALUE,100,-1,header));for(int i=0;i<source.getCount();i++)result.add(new Entry(source.getItemId(i),source.getItemViewType(i),i,source.getItem(i)));if(footer!=null)result.add(new Entry(Long.MIN_VALUE+1,101,-1,footer));return result;}
        void update(){
            if(isComputingLayout()){if(!scheduled){scheduled=true;post(()->{scheduled=false;update();});}return;}
            List<Entry> before=rows,after=snapshot();
            // Prepared images and page lookahead normally append complete rows.
            // Keep the already visible holders in place instead of diffing and
            // rebinding the whole feed for each prepared preview.
            int oldBody=before.size()-(footer==null?0:1),newBody=after.size()-(footer==null?0:1);
            int common=Math.min(oldBody,newBody);boolean unchanged=true;
            for(int i=0;i<common;i++){
                Entry old=before.get(i),next=after.get(i);
                if(old.id!=next.id||old.type!=next.type||!Objects.equals(old.content,next.content)){unchanged=false;break;}
            }
            if(unchanged){
                rows=after;
                if(newBody>oldBody)notifyItemRangeInserted(oldBody,newBody-oldBody);
                else if(newBody<oldBody)notifyItemRangeRemoved(newBody,oldBody-newBody);
                post(FeedListView.this::dispatchScroll);return;
            }
            DiffUtil.DiffResult diff=DiffUtil.calculateDiff(new DiffUtil.Callback(){
                public int getOldListSize(){return before.size();}public int getNewListSize(){return after.size();}
                public boolean areItemsTheSame(int old,int next){Entry a=before.get(old),b=after.get(next);return a.id==b.id&&a.type==b.type;}
                public boolean areContentsTheSame(int old,int next){return Objects.equals(before.get(old).content,after.get(next).content);}
            },false);rows=after;diff.dispatchUpdatesTo(this);post(FeedListView.this::dispatchScroll);
        }
        @Override public long getItemId(int position){return rows.get(position).id;}
        @Override public int getItemViewType(int position){return rows.get(position).type;}
        @Override public int getItemCount(){return rows.size();}
        @Override public Holder onCreateViewHolder(ViewGroup parent,int type){FrameLayout box=new FrameLayout(getContext());box.setLayoutParams(new RecyclerView.LayoutParams(-1,-2));return new Holder(box);}
        @Override public void onBindViewHolder(Holder holder,int position){
            Entry entry=rows.get(position);View old=holder.box.getChildAt(0),view=entry.type==100?header:entry.type==101?footer:source.getView(entry.index,old,holder.box);
            int height=view.getLayoutParams()==null?-2:view.getLayoutParams().height;
            if(view!=old){if(old!=null&&recycler!=null)recycler.accept(old);holder.box.removeAllViews();if(view.getParent() instanceof ViewGroup)((ViewGroup)view.getParent()).removeView(view);holder.box.addView(view,new FrameLayout.LayoutParams(-1,height));}
            else view.setLayoutParams(new FrameLayout.LayoutParams(-1,height));
            holder.box.getLayoutParams().height=height;
            if(entry.type==100&&restorer!=null)restorer.accept(view);
        }
        @Override public void onViewRecycled(Holder holder){if(holder.getItemViewType()<100&&recycler!=null&&holder.box.getChildCount()>0)recycler.accept(holder.box.getChildAt(0));}
    }
}
