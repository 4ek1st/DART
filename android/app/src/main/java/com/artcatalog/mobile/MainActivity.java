package com.artcatalog.mobile;

import android.app.*;
import android.animation.*;
import android.content.*;
import android.graphics.*;
import android.graphics.drawable.*;
import android.net.Uri;
import android.os.*;
import android.text.*;
import android.text.style.ForegroundColorSpan;
import android.view.*;
import android.view.inputmethod.*;
import android.widget.*;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

public final class MainActivity extends Activity {
    static final int BG=Color.rgb(18,18,18),PANEL=Color.rgb(32,32,32),RAISED=Color.rgb(48,48,48),
        LINE=Color.rgb(58,58,58),TEXT=Color.rgb(243,243,243),MUTED=Color.rgb(161,161,161),
        BLUE=Color.rgb(45,156,255),PINK=Color.rgb(250,142,154);
    private final Handler main=new Handler(Looper.getMainLooper());
    private static Thread backgroundThread(String name,Runnable work){return new Thread(()->{android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_BACKGROUND);work.run();},name);}
    private final ThreadPoolExecutor work=new ThreadPoolExecutor(3,3,30,TimeUnit.SECONDS,new LinkedBlockingQueue<>(24),r->backgroundThread("ArtCatalog-network",r),new ThreadPoolExecutor.DiscardOldestPolicy());
    private final ExecutorService io=Executors.newSingleThreadExecutor(r->backgroundThread("ArtCatalog-io",r));
    private final ExecutorService grouping=Executors.newSingleThreadExecutor(r->backgroundThread("ArtCatalog-grouping",r));
    private Store store;private CatalogClient client;private ImageLoader images;
    private LinearLayout root,bottom;private FrameLayout content;
    private final Screen[] screens=new Screen[4];
    private final class BackEntry {View view;Post detail;Gallery gallery;ScreenState related;int scroll,top,nav,mediaIndex;String author;}
    private final ArrayDeque<BackEntry> backStack=new ArrayDeque<>();
    private int nav;private volatile boolean destroyed;private int navigationGeneration;
    private String rating="general",sourceFilter="all",sort="latest";
    private EditText searchInput;private LinearLayout suggestions;
    private int suggestGeneration;private Runnable suggestRunnable;
    private String pendingDownload;private Post activePost;
    private Uri pendingDocument;private int pendingDocumentRequest;
    private Future<?> suggestTask,detailTask;
    private View currentView;
    private Gallery activeGallery;private Screen activeRelated,activeAuthor;private String authorTag="";private FeedListView detailList;
    private int activeMediaIndex;private ImageView activeArt;
    private TextView activeMediaLabel,activeFullscreenStatus;
    private final ArrayDeque<NavigationRequest> navigationQueue=new ArrayDeque<>();
    private NavigationRequest navigating;private ImageLoader.Ticket navigationPreview;
    private Screen navigationSource;private Runnable navigationCallback,navigationOldCallback;
    private int transitionDirection;private boolean navigationRendering;private AnimatorSet pageAnimator;private View outgoingPage,turnTarget;
    private ImageView outgoingMedia;
    private View previousArtworkButton,nextArtworkButton;
    private ArtworkContent fullscreenContent;
    /** Keeps a tap stream owned by the stable content container while detail headers are replaced. */
    private final class ArtworkContent extends FrameLayout {
        private int tappedDirection;private float downX,downY;private boolean validTap;
        private MotionEvent savedDown;private boolean viewer;private View previousButton,nextButton;
        private Runnable previousAction,nextAction;private final Rect previousHit=new Rect(),nextHit=new Rect();
        ArtworkContent(){super(MainActivity.this);}
        void viewerPager(View previous,View next,Runnable before,Runnable after){viewer=true;previousButton=previous;nextButton=next;previousAction=before;nextAction=after;}
        void cancelTap(){tappedDirection=0;validTap=false;if(savedDown!=null){savedDown.recycle();savedDown=null;}}
        private void updateHits(){
            if(!viewer&&(currentView==null||currentView.getVisibility()!=View.VISIBLE))return;
            int[] origin=new int[2];getLocationOnScreen(origin);
            for(int i=0;i<2;i++){View button=viewer?(i==0?previousButton:nextButton):(i==0?previousArtworkButton:nextArtworkButton);Rect hit=i==0?previousHit:nextHit;
                if(button==null||button.getWidth()==0)continue;Rect visible=new Rect();if(button.getGlobalVisibleRect(visible)){visible.offset(-origin[0],-origin[1]);hit.set(visible);}else hit.setEmpty();}
        }
        @Override public boolean dispatchTouchEvent(MotionEvent event){
            int action=event.getActionMasked();
            if(action==MotionEvent.ACTION_DOWN&&activePost!=null){
                cancelTap();updateHits();int x=(int)event.getX(),y=(int)event.getY();
                tappedDirection=previousHit.contains(x,y)?-1:nextHit.contains(x,y)?1:0;
                if(tappedDirection!=0){downX=event.getX();downY=event.getY();validTap=true;savedDown=MotionEvent.obtain(event);return true;}
            }
            if(tappedDirection!=0){
                if(event.getPointerCount()>1)validTap=false;
                if(action==MotionEvent.ACTION_MOVE&&(Math.abs(event.getX()-downX)>dp(12)||Math.abs(event.getY()-downY)>dp(12))){
                    MotionEvent down=savedDown;savedDown=null;tappedDirection=0;validTap=false;
                    if(down!=null){super.dispatchTouchEvent(down);down.recycle();}return super.dispatchTouchEvent(event);
                }
                if(action==MotionEvent.ACTION_UP||action==MotionEvent.ACTION_CANCEL){int direction=tappedDirection;boolean commit=action==MotionEvent.ACTION_UP&&validTap&&activePost!=null;cancelTap();if(commit){if(viewer){Runnable operation=direction<0?previousAction:nextAction;if(operation!=null)operation.run();}else navigate(direction);}}
                return true;
            }
            return super.dispatchTouchEvent(event);
        }
    }
    private final class NavigationRequest {
        final int delta;final Runnable arrived;final java.util.function.BooleanSupplier alive;
        NavigationRequest(int delta,Runnable arrived,java.util.function.BooleanSupplier alive){this.delta=delta;this.arrived=arrived;this.alive=alive;}
    }
    private boolean regroupScheduled;private Screen prefetchScreen;private int prefetchFirst=-1,prefetchEnd=-1,prefetchRevision=-1,prefetchCount=-1;private long prefetchTime;
    private void scheduleRegroup(){if(regroupScheduled)return;regroupScheduled=true;main.postDelayed(()->{regroupScheduled=false;if(destroyed)return;List<Screen> affected=new ArrayList<>(Arrays.asList(screens));affected.add(activeRelated);affected.add(activeAuthor);for(Screen s:affected)if(s!=null&&!s.posts.isEmpty()){int revision=s.revision,generation=s.generation;List<Post> snapshot=new ArrayList<>(s.posts);grouping.execute(()->{List<Post> grouped=CatalogLogic.merge(snapshot,List.of());main.post(()->{if(destroyed||s.generation!=generation)return;if(s.revision!=revision){scheduleRegroup();return;}if(grouped.size()!=s.posts.size()){s.posts.clear();s.posts.addAll(screenVisible(s,grouped));s.revision++;if(s.adapter!=null)s.adapter.notifyDataSetChanged();}});});}},160);}
    private List<Post> screenVisible(Screen s,List<Post> posts){List<Post> visible=store.visible(posts,s.tab!=3&&s.tab!=6);if(s.anchor!=null)visible=CatalogLogic.excludeSaved(visible,List.of(s.anchor));if(s.tab==0&&!s.query.isBlank())visible=CatalogLogic.excludeSaved(visible,store.bookmarks());return visible;}
    private void mergeAsync(Screen s,List<Post> base,List<Post> incoming,int generation,java.util.function.Consumer<List<Post>> apply){List<Post> first=new ArrayList<>(base),second=new ArrayList<>(incoming);long submission=++s.mergeSequence;grouping.execute(()->{if(destroyed||s.generation!=generation)return;filterMerged(s,CatalogLogic.merge(first,second),generation,submission,apply);});}
    private void filterMerged(Screen s,List<Post> merged,int generation,long submission,java.util.function.Consumer<List<Post>> apply){
        long visibility=store.visibilityRevision();List<Post> visible=screenVisible(s,merged);
        main.post(()->{if(destroyed||s.generation!=generation||submission<s.appliedSequence)return;if(store.visibilityRevision()!=visibility){grouping.execute(()->filterMerged(s,merged,generation,submission,apply));return;}s.appliedSequence=submission;s.revision++;apply.accept(visible);});
    }
    private final class Gallery {final List<Post> posts;final Screen source;int syncedRevision=-1,viewportWidth,viewportHeight;Gallery(List<Post> posts,Screen source){this.posts=new ArrayList<>(posts);this.source=source;}}
    private Bundle restored;
    private ScreenState[] retainedScreens;
    private RetainedState retainedState;
    private static final class RetainedState {ScreenState[] screens;ScreenState detail,author;GalleryState gallery;final List<ScreenState> backs=new ArrayList<>();final List<GalleryState> backGalleries=new ArrayList<>();}
    private static final class GalleryState {final List<Post> posts=new ArrayList<>();ScreenState source;int tab=-1;String query="",order="latest";boolean following=true;Post anchor;}
    private static final class ScreenState {
        final List<Post> posts=new ArrayList<>();final Map<String,Integer> pages=new LinkedHashMap<>();final List<Job> jobs=new ArrayList<>();final Set<String> fingerprints=new HashSet<>();final Set<String> authRequired=new LinkedHashSet<>();String accessNotice="";boolean loaded,more,failed,authBlocked;
    }

    private static final class Job {
        String query;Map<String,Integer> pages;
        Job(String query,Map<String,Integer> pages){this.query=query;this.pages=pages;}
    }
    private final class Screen {
        final int tab;View view;FeedListView list;FeedAdapter adapter;
        final List<Post> posts=new ArrayList<>();final ArrayDeque<Job> jobs=new ArrayDeque<>();
        final Map<String,Integer> pages=new LinkedHashMap<>();
        final Set<String> fingerprints=new HashSet<>(),authRequired=new LinkedHashSet<>();String accessNotice="";
        String query="",order="latest";volatile int generation;int homeTab,revision,restoreRow=-1,restoreTop;boolean loading,loaded,failed,authBlocked,more=true;Post anchor;Runnable loadedCallback;
        TextView status,rankingLabel;LinearLayout ranking,artistWorks;List<Post> pendingRanking,pendingArtistWorks;String pendingRankingLabel;Gallery pendingRankingGallery,exploreGallery,pendingArtistGallery;boolean followingMode=true;String exploreMessage="";
        Future<?> task,rankTask;long mergeSequence,appliedSequence;
        Screen(int tab){this.tab=tab;}
    }

    @Override public void onCreate(Bundle supplied){
        Bundle saved=readNavigationState(supplied);
        super.onCreate(saved);restored=saved;Object retained=getLastNonConfigurationInstance();if(retained instanceof RetainedState){retainedState=(RetainedState)retained;retainedScreens=retainedState.screens;}
        if(saved!=null){pendingDownload=saved.getString("download");String document=saved.getString("pendingDocument");if(document!=null){pendingDocument=Uri.parse(document);pendingDocumentRequest=saved.getInt("pendingDocumentRequest");}}
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        if(Build.VERSION.SDK_INT>=30)getWindow().setDecorFitsSystemWindows(false);
        root=column();root.setBackgroundColor(PANEL);content=new ArtworkContent();content.setBackgroundColor(BG);
        root.addView(content,new LinearLayout.LayoutParams(-1,0,1));bottom=row();root.addView(bottom,new LinearLayout.LayoutParams(-1,dp(64)));
        root.setOnApplyWindowInsetsListener((v,insets)->{
            int top=insets.getSystemWindowInsetTop(),below=insets.getSystemWindowInsetBottom();
            if(Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars());top=bars.top;below=bars.bottom;
                boolean keyboard=insets.isVisible(WindowInsets.Type.ime());if(keyboard)below=Math.max(below,insets.getInsets(WindowInsets.Type.ime()).bottom);
                bottom.setVisibility(keyboard?View.GONE:View.VISIBLE);
            }
            root.setPadding(0,top,0,below);return insets;
        });
        setContentView(root);buildBottom();showLoading();images=new ImageLoader(getApplicationContext());images.setReadyListener(this::prepareVisibleContent);
        Store data=Store.get(getApplicationContext());
        io.execute(()->{data.load();CatalogClient prepared=makeClient(data);main.post(()->{
            if(destroyed){prepared.close();return;}store=data;client=prepared;
            rating=store.prefs.getString("rating","general");sourceFilter=store.prefs.getString("source","all");sort=store.prefs.getString("sort","latest");
            nav=saved==null?0:saved.getInt("nav",0);selectNav(nav);
            if(BuildConfig.DEBUG&&getIntent().getBooleanExtra("qaStableRendering",false))try{Class.forName("com.artcatalog.mobile.RenderingChecks").getDeclaredMethod("run",Activity.class,ImageLoader.class).invoke(null,this,images);}catch(Exception error){android.util.Log.e("ArtCatalogQA","Rendering checks unavailable",error);}
            if(BuildConfig.DEBUG&&getIntent().getBooleanExtra("qaPerformance",false))try{Class.forName("com.artcatalog.mobile.PerformanceChecks").getDeclaredMethod("run",Activity.class,ImageLoader.class).invoke(null,this,images);}catch(Exception error){android.util.Log.e("ArtCatalogQA","Performance checks unavailable",error);}
            if(BuildConfig.DEBUG&&getIntent().getBooleanExtra("qaPerformanceState",false))try{Class.forName("com.artcatalog.mobile.PerformanceStateChecks").getDeclaredMethod("run",Activity.class,ImageLoader.class).invoke(null,this,images);}catch(Exception error){android.util.Log.e("ArtCatalogQA","Performance state checks unavailable",error);}
            if(BuildConfig.DEBUG&&getIntent().getBooleanExtra("qaSankaku",false))try{Class.forName("com.artcatalog.mobile.SankakuChecks").getDeclaredMethod("run",Activity.class).invoke(null,this);}catch(Exception error){android.util.Log.e("ArtCatalogQA","Sankaku checks unavailable",error);}
            if(BuildConfig.DEBUG&&getIntent().getBooleanExtra("qaNavigation",false))try{Class.forName("com.artcatalog.mobile.NavigationChecks").getDeclaredMethod("run",Activity.class,ImageLoader.class).invoke(null,this,images);}catch(Exception error){android.util.Log.e("ArtCatalogQA","Navigation checks unavailable",error);}
            if(BuildConfig.DEBUG&&getIntent().getBooleanExtra("qaNavigationManual",false))try{Class.forName("com.artcatalog.mobile.NavigationChecks").getDeclaredMethod("manual",Activity.class,ImageLoader.class).invoke(null,this,images);}catch(Exception error){android.util.Log.e("ArtCatalogQA","Manual navigation checks unavailable",error);}
            if(saved!=null&&saved.containsKey("detail"))try{Gallery gallery=retainedState!=null?restoreGallery(retainedState.gallery):galleryFromBundle(saved.getBundle("galleryRoute"));renderDetail(Post.fromJson(new JSONObject(saved.getString("detail"))),false,saved.getInt("detailScroll"),saved.getInt("detailTop"),retainedState==null?null:retainedState.detail,gallery);if(activePost!=null&&saved.getInt("mediaIndex")<activePost.media.size())chooseMedia(activePost,saved.getInt("mediaIndex"));}catch(Exception ignored){}
            else if(saved!=null&&!saved.getString("author","").isBlank())renderAuthor(saved.getString("author"),false,retainedState==null?null:retainedState.author,saved.getInt("authorFirst"),saved.getInt("authorTop"));
            if(saved!=null)restoreBackStack(saved);
            if(pendingDocument!=null){Uri document=pendingDocument;int request=pendingDocumentRequest;pendingDocument=null;processDocument(request,document);}
            if(!store.warning.isBlank())new AlertDialog.Builder(this).setTitle("Профиль").setMessage(store.warning).setPositiveButton("Понятно",null).show();
        });});
    }
    private CatalogClient makeClient(Store store){
        if(BuildConfig.DEBUG&&getIntent().getBooleanExtra("qaFixtures",false)){
            try{CatalogClient fixture=(CatalogClient)Class.forName("com.artcatalog.mobile.FixtureClient").getDeclaredConstructor(Store.class,ImageLoader.class).newInstance(store,images);if(getIntent().getBooleanExtra("qaGroupingBenchmark",false))fixture.getClass().getDeclaredMethod("benchmark").invoke(fixture);return fixture;}
            catch(Exception e){android.util.Log.e("ArtCatalog","QA fixture initialization failed",e);}
        }
        return new CatalogClient(store);
    }
    private void showLoading(){LinearLayout loading=column();loading.setGravity(Gravity.CENTER);loading.addView(new ProgressBar(this));TextView label=text("ArtCatalog",20,TEXT);label.setPadding(0,dp(20),0,0);loading.addView(label);display(loading);}
    private int dp(float value){return Math.round(value*getResources().getDisplayMetrics().density);}
    private LinearLayout column(){LinearLayout view=new LinearLayout(this);view.setOrientation(LinearLayout.VERTICAL);return view;}
    private LinearLayout row(){LinearLayout view=new LinearLayout(this);view.setOrientation(LinearLayout.HORIZONTAL);view.setGravity(Gravity.CENTER_VERTICAL);return view;}
    private TextView text(String label,float size,int color){TextView v=new TextView(this);v.setText(label);v.setTextSize(size);v.setTextColor(color);return v;}
    private GradientDrawable rounded(int color,float radius){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));return d;}
    private void touchBackground(View v,int color,float radius){v.setBackground(new RippleDrawable(android.content.res.ColorStateList.valueOf(Color.argb(45,255,255,255)),rounded(color,radius),rounded(Color.WHITE,radius)));}
    private TextView button(String label,int color,Runnable action){TextView v=text(label,14,color);v.setGravity(Gravity.CENTER);v.setPadding(dp(16),0,dp(16),0);v.setMinHeight(dp(44));touchBackground(v,RAISED,22);v.setOnClickListener(x->action.run());return v;}
    private FrameLayout iconButton(String icon,String label,Runnable action){FrameLayout box=new FrameLayout(this);box.setContentDescription(label);box.setFocusable(true);touchBackground(box,Color.TRANSPARENT,8);box.addView(new IconView(this,icon,TEXT),new FrameLayout.LayoutParams(-1,-1));box.setOnClickListener(v->action.run());return box;}
    private void display(View view){
        if(transitionDirection!=0&&currentView!=null&&currentView!=view){displayTransition(view,transitionDirection);return;}
        if(!navigationRendering)cancelNavigation();
        if(currentView==view&&view.getParent()==content){restoreCards(view);view.post(this::prepareVisibleContent);return;}
        if(images!=null)images.cancelPrefetch();prefetchScreen=null;if(currentView!=null&&currentView!=view)releaseImages(currentView);
        if(view.getParent() instanceof ViewGroup)((ViewGroup)view.getParent()).removeView(view);
        content.removeAllViews();content.addView(view,new FrameLayout.LayoutParams(-1,-1));currentView=view;
        restoreCards(view);view.post(this::prepareVisibleContent);
    }
    private void displayTransition(View view,int direction){
        View previous=currentView;ImageView previousArt=activeArt;outgoingPage=previous;
        if(images!=null)images.cancelPrefetch();prefetchScreen=null;
        view.setVisibility(View.INVISIBLE);content.addView(view,new FrameLayout.LayoutParams(-1,-1));currentView=view;restoreCards(view);view.post(this::prepareVisibleContent);
        view.postOnAnimation(()->{
            if(currentView!=view||outgoingPage!=previous)return;
            ImageView next=activeArt;FrameLayout parent=next!=null&&next.getParent() instanceof FrameLayout?(FrameLayout)next.getParent():null;
            if(parent!=null&&previousArt!=null){
                ImageView snapshot=new ImageView(this);snapshot.setScaleType(previousArt.getScaleType());snapshot.setImageDrawable(previousArt.getDrawable());snapshot.setImageMatrix(previousArt.getImageMatrix());outgoingMedia=snapshot;parent.addView(snapshot,1,new FrameLayout.LayoutParams(-1,-1));
                next.setTranslationX(-direction*Math.max(content.getWidth(),getResources().getDisplayMetrics().widthPixels));view.setVisibility(View.VISIBLE);
                content.removeView(previous);releaseImages(previous);outgoingPage=null;
                animateTurn(snapshot,next,direction,()->{parent.removeView(snapshot);snapshot.setImageDrawable(null);outgoingMedia=null;});
            }else{view.setVisibility(View.VISIBLE);content.removeView(previous);releaseImages(previous);outgoingPage=null;finishNavigation(navigating);}
        });
    }
    private void animateTurn(View previous,View next,int direction,Runnable cleanup){
        float width=Math.max(next.getWidth(),getResources().getDisplayMetrics().widthPixels);
        AnimatorSet animation=new AnimatorSet();pageAnimator=animation;turnTarget=next;
        animation.playTogether(ObjectAnimator.ofFloat(previous,View.TRANSLATION_X,0,direction*width),ObjectAnimator.ofFloat(next,View.TRANSLATION_X,-direction*width,0));
        animation.setDuration(ValueAnimator.areAnimatorsEnabled()?220:0);
        animation.setInterpolator(new android.view.animation.DecelerateInterpolator(1.5f));
        animation.addListener(new AnimatorListenerAdapter(){@Override public void onAnimationEnd(Animator ignored){if(pageAnimator!=animation)return;pageAnimator=null;turnTarget=null;next.setTranslationX(0);previous.setTranslationX(0);cleanup.run();finishNavigation(navigating);}});
        animation.start();
    }
    private void cancelNavigation(){
        if(content instanceof ArtworkContent)((ArtworkContent)content).cancelTap();if(fullscreenContent!=null)fullscreenContent.cancelTap();
        navigationGeneration++;navigationQueue.clear();navigating=null;clearNavigationWait();
        if(images!=null)images.cancelPreparation(navigationPreview);navigationPreview=null;
        AnimatorSet animation=pageAnimator;pageAnimator=null;if(animation!=null)animation.cancel();
        if(turnTarget!=null){turnTarget.setTranslationX(0);turnTarget=null;}
        if(outgoingPage!=null){content.removeView(outgoingPage);releaseImages(outgoingPage);outgoingPage=null;}
        if(outgoingMedia!=null){if(outgoingMedia.getParent() instanceof ViewGroup)((ViewGroup)outgoingMedia.getParent()).removeView(outgoingMedia);outgoingMedia=null;}
        if(currentView!=null){currentView.setTranslationX(0);currentView.setVisibility(View.VISIBLE);}if(activeArt!=null)activeArt.setTranslationX(0);
    }
    private void push(View view){
        if(currentView!=null){BackEntry entry=new BackEntry();entry.nav=nav;
            if(activePost!=null){entry.detail=activePost;entry.gallery=activeGallery;entry.mediaIndex=activeMediaIndex;entry.related=snapshot(activeRelated);if(detailList!=null){entry.scroll=detailList.getFirstVisiblePosition();View first=detailList.getChildAt(0);entry.top=first==null?0:first.getTop();}}
            else if(!authorTag.isBlank()){entry.author=authorTag;if(activeAuthor!=null){entry.related=snapshot(activeAuthor);if(activeAuthor.list!=null){entry.scroll=activeAuthor.list.getFirstVisiblePosition();View first=activeAuthor.list.getChildAt(0);entry.top=first==null?0:first.getTop();}}}
            else entry.view=currentView;
            backStack.push(entry);while(backStack.size()>32)backStack.removeLast();
        }
        stopDetail();detachScreen(activeAuthor);activeAuthor=null;activePost=null;authorTag="";display(view);
    }
    private ScreenState snapshot(Screen s){if(s==null)return null;ScreenState state=new ScreenState();state.posts.addAll(s.posts);state.fingerprints.addAll(s.fingerprints);state.pages.putAll(s.pages);for(Job job:s.jobs)state.jobs.add(new Job(job.query,new LinkedHashMap<>(job.pages)));state.loaded=s.loaded||!s.posts.isEmpty();state.more=s.more;state.failed=s.failed;state.authBlocked=s.authBlocked;state.authRequired.addAll(s.authRequired);state.accessNotice=s.accessNotice;return state;}
    private GalleryState snapshotGallery(Gallery gallery){if(gallery==null)return null;GalleryState state=new GalleryState();state.posts.addAll(gallery.posts);if(gallery.source!=null){state.source=snapshot(gallery.source);state.tab=gallery.source.tab;state.query=gallery.source.query;state.order=gallery.source.order;state.following=gallery.source.followingMode;state.anchor=gallery.source.anchor;}return state;}
    private Gallery restoreGallery(GalleryState state){if(state==null)return null;Screen source=null;if(state.tab>=0&&state.tab<4){source=screens[state.tab];if(source==null){source=new Screen(state.tab);screens[state.tab]=source;initializeScreen(source);}}else if(state.source!=null){source=new Screen(state.tab);source.query=state.query;source.order=state.order;source.followingMode=state.following;source.anchor=state.anchor;source.posts.addAll(state.source.posts);source.fingerprints.addAll(state.source.fingerprints);source.pages.putAll(state.source.pages);source.jobs.addAll(state.source.jobs);source.loaded=state.source.loaded;source.more=state.source.more;source.failed=state.source.failed;}return new Gallery(state.posts,source);}
    private Gallery galleryFromJson(String json){List<Post> posts=new ArrayList<>();try{JSONArray array=new JSONArray(json);for(int i=0;i<array.length();i++)posts.add(Post.fromJson(array.getJSONObject(i)));}catch(Exception ignored){}return new Gallery(posts,null);}
    private Bundle galleryBundle(Gallery gallery,Post selected){Bundle data=new Bundle();JSONArray posts=new JSONArray();if(gallery!=null){for(Post p:gallery.source==null?gallery.posts:CatalogLogic.merge(gallery.posts,gallery.source.posts))posts.put(p.toJson());Screen source=gallery.source;if(source!=null){data.putInt("tab",source.tab);data.putString("query",source.query);data.putString("order",source.order);data.putBoolean("following",source.followingMode);data.putBoolean("more",source.more);data.putString("pages",new JSONObject(source.pages).toString());data.putString("fingerprints",new JSONArray(source.fingerprints).toString());JSONArray jobs=new JSONArray();for(Job job:source.jobs)try{jobs.put(new JSONObject().put("query",job.query).put("pages",new JSONObject(job.pages)));}catch(JSONException ignored){}data.putString("jobs",jobs.toString());if(source.anchor!=null)data.putString("anchor",source.anchor.toJson().toString());}}data.putString("posts",posts.toString());return data;}
    private Map<String,Integer> pagesFromJson(JSONObject object){Map<String,Integer> pages=new LinkedHashMap<>();if(object!=null)for(String source:CatalogClient.SOURCES)if(object.has(source))pages.put(source,Math.max(0,object.optInt(source)));return pages;}
    private Gallery galleryFromBundle(Bundle data){if(data==null)return null;Gallery list=galleryFromJson(data.getString("posts","[]"));if(!data.containsKey("tab"))return list;Screen source=new Screen(data.getInt("tab"));source.query=data.getString("query","");source.order=data.getString("order","latest");source.followingMode=data.getBoolean("following",true);source.more=data.getBoolean("more");source.loaded=true;source.posts.addAll(list.posts);try{source.pages.putAll(pagesFromJson(new JSONObject(data.getString("pages","{}"))));JSONArray fingerprints=new JSONArray(data.getString("fingerprints","[]"));for(int i=0;i<fingerprints.length();i++)source.fingerprints.add(fingerprints.getString(i));JSONArray jobs=new JSONArray(data.getString("jobs","[]"));for(int i=0;i<jobs.length();i++){JSONObject job=jobs.getJSONObject(i);source.jobs.add(new Job(job.optString("query"),pagesFromJson(job.optJSONObject("pages"))));}if(data.containsKey("anchor"))source.anchor=Post.fromJson(new JSONObject(data.getString("anchor")));}catch(Exception ignored){}return new Gallery(list.posts,source);}
    private String galleryJson(){JSONArray posts=new JSONArray();if(activeGallery!=null&&activePost!=null){int index=0;for(int i=0;i<activeGallery.posts.size();i++)if(activeGallery.posts.get(i).key().equals(activePost.key()))index=i;for(int i=Math.max(0,index-5);i<Math.min(activeGallery.posts.size(),index+6);i++)posts.put(activeGallery.posts.get(i).toJson());}return posts.toString();}
    private void stopDetail(){cancel(detailTask);detachScreen(activeRelated);activeRelated=null;detailList=null;}
    private void detachScreen(Screen screen){if(screen==null)return;cancel(screen.task);screen.generation++;screen.loading=false;screen.view=null;screen.list=null;screen.adapter=null;screen.status=null;screen.loadedCallback=null;screen.artistWorks=null;screen.pendingArtistWorks=null;screen.pendingArtistGallery=null;}
    private void recycleImages(View view){if(view instanceof ImageView)images.recycle((ImageView)view);if(view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++)recycleImages(((ViewGroup)view).getChildAt(i));}
    private void releaseImages(View view){
        boolean keep=false;for(Screen s:screens)if(s!=null&&s.view==view)keep=true;for(BackEntry entry:backStack)if(entry.view==view)keep=true;
        releaseImages(view,keep);
    }
    private void releaseImages(View view,boolean keep){
        if(view instanceof FeedListView){FeedListView list=(FeedListView)view;list.suspend();if(!keep&&list.headerContent()!=null)releaseImages(list.headerContent(),false);}
        if(view instanceof ImageView){if(keep)images.recycle((ImageView)view);else images.release((ImageView)view);}
        if(view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++)releaseImages(((ViewGroup)view).getChildAt(i),keep);
    }
    private void restoreCards(View view){if(view instanceof FeedListView)((FeedListView)view).resume();if(view instanceof Card)((Card)view).updateSaved();if(view instanceof ImageView)images.restore((ImageView)view);if(view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++)restoreCards(((ViewGroup)view).getChildAt(i));}
    private void cancel(Future<?> task){if(task!=null){task.cancel(true);if(task instanceof Runnable)work.remove((Runnable)task);}}
    private Future<?> submitNetwork(Runnable runnable){CatalogClient.NetworkTask<Void> task=new CatalogClient.NetworkTask<>(runnable);work.execute(task);return task;}
    private void invalidateScreens(){for(Screen s:screens)if(s!=null){s.generation++;cancel(s.task);cancel(s.rankTask);}Arrays.fill(screens,null);retainedScreens=null;restored=null;}
    private void restoreBackStack(Bundle saved){ArrayList<Bundle> entries=saved.getParcelableArrayList("backStack");if(entries==null)return;backStack.clear();for(int i=entries.size()-1;i>=0;i--){Bundle item=entries.get(i);BackEntry entry=new BackEntry();entry.nav=item.getInt("nav");entry.scroll=item.getInt("scroll");entry.top=item.getInt("top");entry.mediaIndex=item.getInt("mediaIndex");entry.gallery=galleryFromBundle(item.getBundle("galleryRoute"));if(retainedState!=null&&i<retainedState.backs.size()){entry.related=retainedState.backs.get(i);entry.gallery=restoreGallery(retainedState.backGalleries.get(i));}try{if(item.containsKey("detail"))entry.detail=Post.fromJson(new JSONObject(item.getString("detail")));else if(item.containsKey("author"))entry.author=item.getString("author");else{int tab=item.getInt("tab",entry.nav);if(tab==4)entry.view=profile();else{Screen s=screens[tab];if(s==null){s=new Screen(tab);screens[tab]=s;initializeScreen(s);}entry.view=s.view;}}backStack.push(entry);}catch(Exception ignored){}}retainedState=null;}
    private LinearLayout toolbar(String title,Runnable back){
        LinearLayout bar=row();bar.setBackgroundColor(PANEL);bar.setPadding(dp(8),0,dp(8),0);bar.setMinimumHeight(dp(56));
        bar.addView(iconButton(back==null?"menu":"back",back==null?"Меню":"Назад",back==null?()->selectNav(4):back),new LinearLayout.LayoutParams(dp(48),dp(48)));
        TextView label=text(title,19,TEXT);label.setSingleLine(true);label.setEllipsize(TextUtils.TruncateAt.END);label.setPadding(dp(6),0,dp(8),0);label.setTypeface(null,Typeface.BOLD);bar.addView(label,new LinearLayout.LayoutParams(0,dp(48),1));label.setGravity(Gravity.CENTER_VERTICAL);
        return bar;
    }
    private void buildBottom(){
        bottom.removeAllViews();bottom.setBackgroundColor(PANEL);
        String[] labels={"Главная","Поиск","Новое","Закладки","Моё"};String[] icons={"home","search","new","heart","profile"};
        for(int i=0;i<labels.length;i++){
            int index=i;LinearLayout item=column();item.setGravity(Gravity.CENTER);item.setContentDescription(labels[i]);item.setFocusable(true);
            touchBackground(item,Color.TRANSPARENT,0);item.addView(new IconView(this,icons[i],i==nav?BLUE:MUTED),new LinearLayout.LayoutParams(dp(32),dp(32)));
            TextView label=text(labels[i],11,i==nav?BLUE:MUTED);label.setGravity(Gravity.CENTER);label.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);item.addView(label);
            item.setOnClickListener(v->{if(store!=null)selectNav(index);});bottom.addView(item,new LinearLayout.LayoutParams(0,-1,1));
        }
    }
    private void selectNav(int index){
        if(store==null)return;hideKeyboard();stopDetail();images.cancelPrefetch();detachScreen(activeAuthor);activeAuthor=null;backStack.clear();activePost=null;activeGallery=null;authorTag="";nav=index;buildBottom();
        if(index==4){display(profile());return;}
        Screen screen=screens[index];if(screen==null){screen=new Screen(index);screens[index]=screen;initializeScreen(screen);}
        if(index==3){screen.posts.clear();screen.more=false;screen.loaded=true;for(Post p:store.visible(store.bookmarks(),false))if(CatalogLogic.matchesRating(p.rating,rating))screen.posts.add(p);screen.adapter.notifyDataSetChanged();updateStatus(screen);}
        display(screen.view);
        if(!screen.loaded&&index!=3){if(index==1&&screen.query.isBlank())loadExplore(screen);else load(screen,true);}
    }
    private void initializeScreen(Screen s){
        Bundle state=restored==null?null:restored.getBundle("screen"+s.tab);
        if(state!=null){s.homeTab=state.getInt("homeTab");s.followingMode=state.getBoolean("following",true);s.restoreRow=state.getInt("first");s.restoreTop=state.getInt("top");}
        buildFeed(s);
        if(state!=null){s.query=state.getString("query","");s.order=state.getString("order","latest");if(s.tab==1)searchInput.setText(state.getString("input",s.query));}
        ScreenState cached=retainedScreens==null?null:retainedScreens[s.tab];
        if(retainedScreens!=null)retainedScreens[s.tab]=null;
        if(cached!=null&&cached.loaded){s.posts.addAll(cached.posts);s.fingerprints.addAll(cached.fingerprints);s.pages.putAll(cached.pages);s.jobs.addAll(cached.jobs);s.loaded=true;s.more=cached.more;s.failed=cached.failed;s.authBlocked=cached.authBlocked;s.authRequired.addAll(cached.authRequired);s.accessNotice=cached.accessNotice;s.adapter.notifyDataSetChanged();updateStatus(s);if(s.tab==0)loadRankings(s,s.generation,rating);}
        if(state!=null)restored.remove("screen"+s.tab);
    }
    private void brand(TextView v){android.text.SpannableString title=new android.text.SpannableString("artcatalog");title.setSpan(new ForegroundColorSpan(BLUE),3,10,0);v.setText(title);v.setTextSize(23);}
    private void buildFeed(Screen s){
        LinearLayout shell=column();shell.setBackgroundColor(BG);
        LinearLayout bar=toolbar(s.tab==0?"artcatalog":s.tab==1?"Поиск":s.tab==2?"Новое":"Закладки",null);
        if(s.tab==0)brand((TextView)bar.getChildAt(1));
        if(s.tab!=1)bar.addView(iconButton("search","Найти иллюстрации",()->{selectNav(1);focusSearch();}),new LinearLayout.LayoutParams(dp(48),dp(48)));
        bar.addView(iconButton("filter","Фильтры",this::filters),new LinearLayout.LayoutParams(dp(48),dp(48)));shell.addView(bar);
        if(s.tab==1)buildSearch(shell,s);
        FeedListView list=new FeedListView(this);list.setRecyclerListener(this::recycleImages);list.setRestoreListener(this::restoreCards);list.setClipToPadding(false);list.setPadding(dp(6),0,dp(6),dp(12));list.setVerticalScrollBarEnabled(false);s.list=list;
        LinearLayout header=column();
        if(s.tab==0){
            LinearLayout tabs=row();String[] titles={"Для вас","Популярное","Новые"};
            for(int i=0;i<titles.length;i++){final int index=i;LinearLayout tab=column();TextView label=text(titles[i],14,i==s.homeTab?TEXT:MUTED);label.setGravity(Gravity.CENTER);label.setTypeface(null,Typeface.BOLD);tab.addView(label,new LinearLayout.LayoutParams(-1,dp(44)));View line=new View(this);line.setBackgroundColor(i==s.homeTab?BLUE:Color.TRANSPARENT);tab.addView(line,new LinearLayout.LayoutParams(-1,dp(3)));touchBackground(tab,Color.TRANSPARENT,0);tab.setOnClickListener(v->{
                for(int j=0;j<tabs.getChildCount();j++){LinearLayout t=(LinearLayout)tabs.getChildAt(j);((TextView)t.getChildAt(0)).setTextColor(j==index?TEXT:MUTED);t.getChildAt(1).setBackgroundColor(j==index?BLUE:Color.TRANSPARENT);}
                s.homeTab=index;s.order=index==1?"popular":"latest";s.query=index==0?recommendationQuery():"";load(s,true);
            });tabs.addView(tab,new LinearLayout.LayoutParams(0,-2,1));}header.addView(tabs);
            LinearLayout section=section("Рейтинг","spark",Color.rgb(225,190,95));s.rankingLabel=(TextView)section.getChildAt(1);section.addView(button("Смотреть",MUTED,()->{s.query="";s.order="popular";load(s,true);}),new LinearLayout.LayoutParams(-2,dp(36)));header.addView(section);
            HorizontalScrollView carousel=new HorizontalScrollView(this);carousel.setHorizontalScrollBarEnabled(false);s.ranking=row();s.ranking.setPadding(dp(4),0,dp(4),0);carousel.addView(s.ranking);header.addView(carousel,new LinearLayout.LayoutParams(-1,dp(204)));
            for(int i=0;i<2;i++){View placeholder=new View(this);placeholder.setBackground(rounded(RAISED,8));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(dp(188),dp(198));lp.setMargins(dp(4),0,dp(4),0);s.ranking.addView(placeholder,lp);}
            header.addView(section("Рекомендации","heart",PINK));s.query=s.homeTab==0?recommendationQuery():"";
        }
        if(s.tab==2){
            LinearLayout tabs=row();TextView follow=button("Подписки",BLUE,()->{s.followingMode=true;load(s,true);});TextView latest=button("Все новые",MUTED,()->{s.followingMode=false;s.query="";load(s,true);});tabs.setPadding(dp(8),dp(8),dp(8),dp(8));tabs.addView(follow,new LinearLayout.LayoutParams(0,dp(44),1));tabs.addView(latest,new LinearLayout.LayoutParams(0,dp(44),1));header.addView(tabs);
            TextView manage=button("Управление подписками",MUTED,this::manageFollows);LinearLayout.LayoutParams ml=new LinearLayout.LayoutParams(-1,dp(44));ml.setMargins(dp(8),0,dp(8),dp(10));header.addView(manage,ml);
        }
        LinearLayout chips=row();chips.setPadding(dp(8),dp(4),dp(8),dp(10));
        TextView filterChip=text((sourceFilter.equals("all")?"Все источники":sourceName(sourceFilter))+"  ·  "+(rating.equals("general")?"Обычное":rating.equals("explicit")?"18+":"Всё"),12,MUTED);filterChip.setPadding(dp(12),dp(7),dp(12),dp(7));touchBackground(filterChip,RAISED,18);filterChip.setOnClickListener(v->filters());chips.addView(filterChip,new LinearLayout.LayoutParams(0,-2,1));chips.addView(iconButton("refresh","Обновить",()->{if(s.tab==1&&s.query.isBlank())loadExplore(s);else load(s,true);}),new LinearLayout.LayoutParams(dp(44),dp(40)));header.addView(chips);
        s.status=text("",13,MUTED);s.status.setPadding(dp(14),dp(12),dp(14),dp(20));s.status.setGravity(Gravity.CENTER);s.status.setOnClickListener(v->statusAction(s));
        list.addHeaderView(header,null,false);list.addFooterView(s.status,null,false);s.adapter=new FeedAdapter(s);list.setAdapter(s.adapter);
        list.setOnScrollListener(new FeedListView.ScrollListener(){
            public void onScrollStateChanged(FeedListView view,int state){if(state==SCROLL_STATE_TOUCH_SCROLL){s.restoreRow=-1;hideKeyboard();}}
            public void onScroll(FeedListView view,int first,int visible,int total){prefetchCards(s,Math.max(0,first-1));if(s.loaded&&!s.loading&&!s.failed&&s.more&&!s.posts.isEmpty()&&needsPage(s)&&!(s.tab==1&&s.query.isBlank()))load(s,false);}
        });
        shell.addView(list,new LinearLayout.LayoutParams(-1,0,1));s.view=shell;updateStatus(s);
    }
    private LinearLayout section(String title,String icon,int color){LinearLayout row=row();row.setPadding(dp(8),dp(14),dp(8),dp(8));row.addView(new IconView(this,icon,color),new LinearLayout.LayoutParams(dp(30),dp(30)));TextView label=text(title,15,TEXT);label.setTypeface(null,Typeface.BOLD);row.addView(label,new LinearLayout.LayoutParams(0,-2,1));return row;}
    private String recommendationQuery(){List<String> tags=CatalogLogic.recommendationTags(store.bookmarks());return tags.isEmpty()?"":tags.get(new Random().nextInt(Math.min(tags.size(),6)));}
    private Map<String,Integer> selectedPages(){Map<String,Integer> pages=new LinkedHashMap<>();for(String source:CatalogClient.SOURCES)if((sourceFilter.equals("all")||sourceFilter.equals(source))&&store.configured(source))pages.put(source,0);if(pages.isEmpty()&&!sourceFilter.equals("all"))pages.put(sourceFilter,0);return pages;}
    private void load(Screen s,boolean reset){
        if(s.tab==3){selectNav(3);return;}
        if(s.loading&&!reset)return;boolean queued=s.tab==5||s.tab==2&&s.followingMode;
        if(reset){s.loading=true;cancel(s.task);cancel(s.rankTask);s.generation++;s.posts.clear();if(!queued&&!s.query.contains(":")&&(s.tab==0||s.tab==1||s.tab==6))for(Post cached:screenVisible(s,exploreCache()))if(queryMatches(cached,s.query))s.posts.add(cached);s.pages.clear();s.pages.putAll(selectedPages());s.jobs.clear();s.fingerprints.clear();s.more=true;s.loaded=false;s.failed=false;s.authRequired.clear();s.accessNotice="";
            if(s.tab==2&&s.followingMode)for(JSONObject f:store.follows())s.jobs.add(new Job(f.optString("tag"),selectedPages()));
            if(s.tab==5&&s.anchor!=null)for(String q:CatalogLogic.relatedQueries(s.anchor))s.jobs.add(new Job(q,selectedPages()));
            if(s.adapter!=null)s.adapter.notifyDataSetChanged();if(s.list!=null)s.list.setSelection(0);
        }
        if(queued&&s.jobs.isEmpty()){s.more=false;s.loaded=true;s.loading=false;if(s.adapter!=null)s.adapter.notifyDataSetChanged();updateStatus(s);return;}
        Map<String,Integer> pages=s.pages;String query=s.query;
        if(queued){Job job=s.jobs.peekFirst();pages=job.pages;query=job.query;}
        if(pages.isEmpty()){s.more=false;s.loaded=true;s.loading=false;if(s.adapter!=null)s.adapter.notifyDataSetChanged();updateStatus(s);return;}
        if(s.tab==0&&s.ranking!=null&&!s.posts.isEmpty()&&(reset||!(s.ranking.getChildAt(0) instanceof Card)))fillRanking(s,s.posts,"Популярные в ленте");prefetchCards(s,0);int generation=s.generation;String filter=rating,order=s.tab==0||s.tab==6?s.order:sort;String requestedQuery=query;Map<String,Integer> requestedPages=new LinkedHashMap<>(pages);
        List<Post> baseBefore=new ArrayList<>(s.posts),arrivals=new ArrayList<>();s.loading=true;updateStatus(s);
        s.task=submitNetwork(()->{
            CatalogClient.Page result=client.search(requestedQuery,requestedPages,filter,order,arrived->main.post(()->{if(destroyed||s.generation!=generation||s.adapter==null)return;arrivals.addAll(arrived.posts);mergeAsync(s,baseBefore,arrivals,generation,visible->{s.posts.clear();s.posts.addAll(visible);s.adapter.notifyDataSetChanged();prefetchCards(s,0);if(s.tab==0&&s.ranking!=null&&!(s.ranking.getChildAt(0) instanceof Card))fillRanking(s,s.posts,"Популярные в ленте");});}));
            main.post(()->{
                if(destroyed||s.generation!=generation)return;
                store.remember(result.posts);List<Post> incoming=result.posts;
                List<Post> base=reset&&result.errors.isEmpty()?List.of():baseBefore;mergeAsync(s,base,incoming,generation,merged->{s.posts.clear();s.posts.addAll(merged);
                Map<String,Integer> next=new LinkedHashMap<>();
                for(String source:requestedPages.keySet()){String fingerprint=result.fingerprints.get(source);boolean fresh=fingerprint==null||s.fingerprints.add(requestedQuery+"|"+source+"|"+fingerprint);if(fresh&&result.more.contains(source))next.put(source,requestedPages.get(source)+1);else if(!fresh&&result.more.contains(source))result.errors.put(source,"Источник повторил страницу. Нажмите для повторной загрузки.");}
                for(String source:result.errors.keySet())if(requestedPages.containsKey(source))next.put(source,requestedPages.get(source));
                if(queued){s.jobs.pollFirst();if(!next.isEmpty())s.jobs.addLast(new Job(requestedQuery,next));s.more=!s.jobs.isEmpty();}
                else{s.pages.clear();s.pages.putAll(next);s.more=!next.isEmpty();}
                s.loading=false;s.loaded=true;s.failed=!result.errors.isEmpty();applyAccess(s,result);if(s.adapter!=null)s.adapter.notifyDataSetChanged();updateStatus(s);
                if(!result.errors.isEmpty()&&s.status!=null){StringBuilder error=new StringBuilder();for(Map.Entry<String,String> entry:result.errors.entrySet())error.append(sourceName(entry.getKey())).append(": ").append(entry.getValue()).append("\n");s.status.setText(error.toString().trim()+"\nНажмите, чтобы повторить.");s.status.setVisibility(View.VISIBLE);}
                if(s.loadedCallback!=null)s.loadedCallback.run();
                if(s.more&&result.errors.isEmpty()&&s.authRequired.isEmpty()&&s.list!=null&&(s.posts.isEmpty()||needsPage(s)))main.postDelayed(()->{if(!destroyed&&s.generation==generation&&s.view==currentView&&s.list!=null&&!s.loading&&!s.failed&&s.more&&(s.posts.isEmpty()||needsPage(s)))load(s,false);},180);
                if(s.tab==0&&reset)loadRankings(s,generation,filter);
                prefetchCards(s,0);
                });
            });
        });
    }
    private boolean queryMatches(Post p,String query){for(String tag:query.split(" "))if(!tag.isBlank()&&!tag.contains(":")&&(tag.startsWith("-")?p.tags.contains(tag.substring(1)):!p.tags.contains(tag)))return false;return true;}
    private void prepareVisibleContent(){
        if(destroyed||store==null)return;
        List<Screen> candidates=new ArrayList<>(Arrays.asList(screens));candidates.add(activeRelated);candidates.add(activeAuthor);
        for(Screen s:candidates)if(s!=null&&s.view==currentView){
            if(s.adapter!=null)s.adapter.refreshPrepared();prefetchCards(s,0);applyPreparedRanking(s);applyPreparedArtistWorks(s);
            if(s.adapter!=null&&!s.adapter.explore()&&s.loaded&&!s.loading&&!s.failed&&s.more&&(s.posts.isEmpty()||needsPage(s)))load(s,false);
        }
    }
    private int firstCard(Screen s){return s.list==null?0:Math.max(0,(s.restoreRow>=0?s.restoreRow:s.list.getFirstVisiblePosition())-1)*2;}
    private boolean needsPage(Screen s){return s.list!=null&&PreviewWindow.needsPage(firstCard(s),s.list.getVisibleCount()*2,s.posts.size());}
    private void prefetchCards(Screen screen,int ignored){
        if(screen.view!=currentView||screen.list==null)return;
        int first=firstCard(screen);PreviewWindow window=new PreviewWindow(first,screen.list.getVisibleCount()*2,screen.posts.size());long now=SystemClock.elapsedRealtime();
        if(prefetchScreen==screen&&prefetchFirst==first&&prefetchEnd==window.end&&prefetchRevision==screen.revision&&prefetchCount==screen.posts.size()&&now-prefetchTime<1500)return;
        prefetchScreen=screen;prefetchFirst=first;prefetchEnd=window.end;prefetchRevision=screen.revision;prefetchCount=screen.posts.size();prefetchTime=now;List<String> urls=new ArrayList<>();
        // Nearest cards first, then the full reserve below the screen, then a small return reserve.
        for(int i=first;i<window.end;i++)urls.add(screen.posts.get(i).preview);
        for(int i=window.start;i<first&&i<screen.posts.size();i++)urls.add(screen.posts.get(i).preview);
        images.prefetchWindow(urls.subList(0,Math.min(48,urls.size())),720);
    }
    private Gallery serverGallery(List<Post> posts,String query,String order,CatalogClient.Page result,Map<String,Integer> requestedPages){
        Screen source=new Screen(6);source.query=query;source.order=order;source.loaded=true;source.posts.addAll(posts);
        for(String name:requestedPages.keySet()){
            if(result==null||result.more.contains(name))source.pages.put(name,requestedPages.get(name)+(result==null?0:1));
            else if(result.errors.containsKey(name))source.pages.put(name,requestedPages.get(name));
            if(result!=null&&result.fingerprints.containsKey(name))source.fingerprints.add(query+"|"+name+"|"+result.fingerprints.get(name));
        }
        source.more=!source.pages.isEmpty();source.failed=result!=null&&!result.errors.isEmpty();if(result!=null)applyAccess(source,result);return new Gallery(posts,source);
    }
    private void fillRanking(Screen s,List<Post> posts,String label){fillRanking(s,posts,label,new Gallery(posts,s));}
    private void fillRanking(Screen s,List<Post> posts,String label,Gallery context){
        if(s.ranking==null||posts.isEmpty())return;List<Post> ranked=new ArrayList<>(store.visible(posts,true));if(ranked.stream().noneMatch(p->p.source.equals("sankaku")))ranked.sort(Comparator.comparingInt((Post p)->p.score).reversed());
        s.pendingRanking=new ArrayList<>(ranked.subList(0,Math.min(6,ranked.size())));s.pendingRankingLabel=label;
        // The carousel is a subset; swiping retains the entire server buffer and its cursor.
        s.pendingRankingGallery=new Gallery(ranked,context.source);applyPreparedRanking(s);
    }
    private void applyPreparedRanking(Screen s){
        if(s.ranking==null||s.pendingRanking==null)return;
        boolean prepared=true;for(Post p:s.pendingRanking)if(!images.prepared(p.preview,720)){prepared=false;if(s.view==currentView)images.prefetch(p.preview,720);}if(!prepared)return;
        List<Card> existing=new ArrayList<>();for(int i=0;i<s.ranking.getChildCount();i++)if(s.ranking.getChildAt(i) instanceof Card)existing.add((Card)s.ranking.getChildAt(i));
        for(int i=0;i<s.pendingRanking.size();i++){
            Post p=s.pendingRanking.get(i);Card card=null;for(Card old:existing)if(old.post.key().equals(p.key())){card=old;break;}
            if(card==null)card=new Card();card.bind(p,true,s.pendingRankingGallery);
            if(s.ranking.getChildAt(i)!=card){if(card.getParent()==s.ranking)s.ranking.removeView(card);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(dp(188),dp(198));lp.setMargins(dp(4),0,dp(4),0);s.ranking.addView(card,Math.min(i,s.ranking.getChildCount()),lp);}
        }
        while(s.ranking.getChildCount()>s.pendingRanking.size())s.ranking.removeViewAt(s.ranking.getChildCount()-1);
        s.rankingLabel.setText(s.pendingRankingLabel);s.pendingRanking=null;
    }
    private void applyPreparedArtistWorks(Screen s){
        if(s.artistWorks==null||s.pendingArtistWorks==null||s.view!=currentView)return;
        boolean prepared=true;for(Post p:s.pendingArtistWorks)if(!images.prepared(p.preview,720)){prepared=false;images.prefetch(p.preview,720);}if(!prepared)return;
        s.artistWorks.addView(section("Другие работы автора","users",MUTED));HorizontalScrollView horizontal=new HorizontalScrollView(this);horizontal.setHorizontalScrollBarEnabled(false);LinearLayout strip=row();horizontal.addView(strip);
        for(Post p:s.pendingArtistWorks){Card card=new Card();card.bind(p,false,s.pendingArtistGallery);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(dp(112),dp(112));lp.setMargins(dp(4),0,0,0);strip.addView(card,lp);}
        s.artistWorks.addView(horizontal,new LinearLayout.LayoutParams(-1,dp(118)));s.pendingArtistWorks=null;
    }
    private void updateStatus(Screen s){
        if(s.status==null)return;
        String label=s.loading||s.adapter!=null&&!s.adapter.explore()&&s.adapter.shown.size()<s.posts.size()?"Подготовка следующих иллюстраций…":s.posts.isEmpty()?s.tab==3?"Сохранённые работы появятся здесь.\nНажмите сердечко на любой иллюстрации.":s.tab==2&&s.followingMode&&store.follows().isEmpty()?"Подпишитесь на художника, чтобы видеть его новые работы.":"Здесь пока нет работ.\nИзмените фильтры или нажмите, чтобы обновить.":s.more?"Загрузить ещё":"Вы посмотрели все доступные работы";
        if(!s.loading&&!s.accessNotice.isBlank())label=s.accessNotice+(s.authRequired.isEmpty()?"":"\nНажмите, чтобы авторизоваться.")+(s.more&&!s.posts.isEmpty()?"\nДоступные работы подгружаются при прокрутке.":"");
        if(!TextUtils.equals(s.status.getText(),label))s.status.setText(label);s.status.setVisibility(View.VISIBLE);
    }
    private void applyAccess(Screen screen,CatalogClient.Page result){screen.authRequired.clear();screen.authRequired.addAll(result.authRequired);screen.accessNotice=String.join("\n",result.notices.values());screen.authBlocked=result.posts.isEmpty()&&!result.authRequired.isEmpty();}
    private void statusAction(Screen screen){if(screen.authRequired.contains("sankaku")){settings("Источники");return;}if(screen.tab==1&&screen.query.isBlank())loadExplore(screen);else load(screen,screen.posts.isEmpty());}
    private void accessPrompt(SankakuApi.AccessException error){
        AlertDialog.Builder dialog=new AlertDialog.Builder(this).setTitle(error.loginRequired?"Авторизуйтесь в Sankaku":"Доступ Sankaku ограничен").setMessage(error.getMessage()).setNegativeButton("Закрыть",null);
        if(error.loginRequired)dialog.setPositiveButton("Авторизоваться",(d,w)->settings("Источники"));else dialog.setPositiveButton("Открыть Sankaku",(d,w)->external("https://sankaku.app/"));dialog.show();
    }
    private void loadRankings(Screen s,int generation,String filter){
        Map<String,Integer> pages=selectedPages();s.rankTask=submitNetwork(()->{CatalogClient.Page result=client.search("",pages,filter,"popular");main.post(()->{
            if(destroyed||s.generation!=generation)return;applyAccess(s,result);updateStatus(s);List<Post> visibleRanking=store.visible(result.posts,true);result.posts.clear();result.posts.addAll(visibleRanking);
            if(result.posts.isEmpty()&&!s.posts.isEmpty()){result.posts.addAll(s.posts);result.posts.sort(Comparator.comparingInt((Post p)->p.score).reversed());s.rankingLabel.setText("Популярные в ленте");}else s.rankingLabel.setText("Рейтинг");
            if(!result.posts.isEmpty())fillRanking(s,result.posts,s.rankingLabel.getText().toString(),serverGallery(result.posts,"","popular",result,pages));
        });});
    }
    private void buildSearch(LinearLayout shell,Screen s){
        LinearLayout search=row();search.setPadding(dp(16),dp(8),dp(12),dp(10));search.setBackgroundColor(PANEL);
        searchInput=new EditText(this);searchInput.setSingleLine(true);searchInput.setTextColor(TEXT);searchInput.setHintTextColor(MUTED);searchInput.setTextSize(15);searchInput.setHint("Поиск иллюстраций по тегам");searchInput.setPadding(dp(12),0,dp(8),0);searchInput.setBackground(rounded(RAISED,7));searchInput.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);searchInput.setImeOptions(EditorInfo.IME_ACTION_SEARCH);searchInput.setSelectAllOnFocus(true);searchInput.setText(s.query);
        search.addView(searchInput,new LinearLayout.LayoutParams(0,dp(46),1));search.addView(iconButton("search","Искать",()->runSearch(searchInput.getText().toString())),new LinearLayout.LayoutParams(dp(48),dp(48)));shell.addView(search);
        suggestions=column();suggestions.setBackgroundColor(PANEL);shell.addView(suggestions);
        searchInput.setOnEditorActionListener((v,action,event)->{if(action==EditorInfo.IME_ACTION_SEARCH||event!=null&&event.getKeyCode()==KeyEvent.KEYCODE_ENTER){runSearch(v.getText().toString());return true;}return false;});
        searchInput.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence t,int start,int count,int after){}public void onTextChanged(CharSequence t,int start,int before,int count){suggest(t.toString());}public void afterTextChanged(Editable e){}});
        searchInput.setOnFocusChangeListener((v,hasFocus)->{if(hasFocus)suggest(searchInput.getText().toString());else suggestions.removeAllViews();});
    }
    private void focusSearch(){if(searchInput!=null){searchInput.requestFocus();((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).showSoftInput(searchInput,InputMethodManager.SHOW_IMPLICIT);}}
    private void hideKeyboard(){View focus=getCurrentFocus();if(focus!=null){((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(focus.getWindowToken(),0);focus.clearFocus();}}
    private void suggest(String query){
        int generation=++suggestGeneration;cancel(suggestTask);if(suggestRunnable!=null)main.removeCallbacks(suggestRunnable);if(suggestions==null)return;suggestions.removeAllViews();
        if(query.isBlank()){for(String q:store.searches().subList(0,Math.min(4,store.searches().size())))suggestion(q,"clock");return;}
        if(query.contains(" ")||query.length()<2)return;
        suggestRunnable=()->{suggestTask=submitNetwork(()->{try{List<String> tags=client.tags(query);main.post(()->{if(destroyed||generation!=suggestGeneration||nav!=1||!searchInput.hasFocus())return;suggestions.removeAllViews();for(String tag:tags.subList(0,Math.min(4,tags.size())))suggestion(tag,"search");});}catch(Exception ignored){}});};main.postDelayed(suggestRunnable,350);
    }
    private void suggestion(String query,String icon){LinearLayout option=row();option.setPadding(dp(12),0,dp(12),0);option.addView(new IconView(this,icon,MUTED),new LinearLayout.LayoutParams(dp(36),dp(40)));TextView t=text(query.replace('_',' '),14,TEXT);option.addView(t,new LinearLayout.LayoutParams(0,dp(44),1));t.setGravity(Gravity.CENTER_VERTICAL);option.setContentDescription("Найти "+query);touchBackground(option,Color.TRANSPARENT,0);option.setOnClickListener(v->runSearch(query));suggestions.addView(option);}
    private void runSearch(String query){
        query=CatalogLogic.cleanQuery(query);if(query.length()>200){toast("Запрос слишком длинный");return;}
        Screen s=screens[1];if(s==null){s=new Screen(1);screens[1]=s;initializeScreen(s);}if(currentView!=s.view){push(s.view);nav=1;buildBottom();}
        s.query=query;if(!query.isBlank())store.search(query);if(searchInput!=null)searchInput.setText(query);hideKeyboard();suggestGeneration++;suggestions.removeAllViews();s.adapter.notifyDataSetChanged();if(query.isBlank())loadExplore(s);else load(s,true);
    }
    private void loadExplore(Screen s){
        cancel(s.task);s.generation++;int generation=s.generation;s.posts.clear();s.posts.addAll(exploreCache());s.loading=true;s.loaded=false;s.more=false;s.authRequired.clear();s.accessNotice="";s.exploreMessage=s.posts.isEmpty()?"Загрузка изображений из каталога…":"Иллюстрации из ваших источников";s.exploreGallery=serverGallery(s.posts,"","latest",null,selectedPages());s.adapter.notifyDataSetChanged();updateStatus(s);
        Map<String,Integer> pages=selectedPages();String filter=rating;s.task=submitNetwork(()->{CatalogClient.Page result=client.search("",pages,filter,"latest");main.post(()->{if(destroyed||s.generation!=generation)return;store.remember(result.posts);List<Post> available=store.visible(result.posts,false);if(!available.isEmpty()){s.posts.clear();s.posts.addAll(available);}s.exploreGallery=serverGallery(s.posts,"","latest",result,pages);applyAccess(s,result);s.loading=false;s.loaded=true;s.failed=!result.errors.isEmpty();s.exploreMessage=s.posts.isEmpty()?(s.failed?"Не удалось загрузить каталог. Нажмите, чтобы повторить.":"Нет работ для этих фильтров. Измените настройки."):s.failed?"Из сохранённого каталога · нажмите для повтора":"Иллюстрации из ваших источников";s.adapter.notifyDataSetChanged();s.status.setText(result.errors.isEmpty()?"Ищите по тегам, персонажам и художникам":String.join("\n",result.errors.values())+"\nНажмите, чтобы повторить.");if(!s.accessNotice.isBlank())updateStatus(s);});});
    }
    private List<Post> exploreCache(){List<Post> result=new ArrayList<>();for(Post p:store.visible(store.catalogue(),false))if(CatalogLogic.matchesRating(p.rating,rating)&&(sourceFilter.equals("all")&&store.configured(p.source)||sourceFilter.equals(p.source)))result.add(p);result.sort(Comparator.comparingLong((Post p)->{try{return Long.parseLong(p.id);}catch(Exception ignored){return 0;}}).reversed());return result;}
    private final class FeedAdapter extends BaseAdapter {
        final Screen screen;final List<Post> shown=new ArrayList<>();final List<String> rowTokens=new ArrayList<>();String publishedRoute="";Gallery bindingGallery;int galleryRevision=-1,galleryCount=-1;boolean metadataDirty=true,prefixCurrent;
        final String[] topicTags={"landscape","original","sky","animal","portrait","fantasy","city","flower","pixel_art","space","ocean","nature"};
        final String[] topicNames={"Пейзажи","Оригинальное","Небо","Животные","Портреты","Фэнтези","Города","Цветы","Пиксель-арт","Космос","Море","Природа"};
        FeedAdapter(Screen s){screen=s;}
        private boolean explore(){return screen.tab==1&&screen.query.isBlank();}
        public int getCount(){return explore()?5:(shown.size()+1)/2;}
        private Post topic(List<Post> posts,int index){for(Post p:posts)if(p.tags.contains(topicTags[index]))return p;return posts.isEmpty()?null:posts.get(index%posts.size());}
        private String token(Post p){return p==null?"":p.key()+"|"+p.preview+"|"+p.title+"|"+p.artist+"|"+p.media.size();}
        public Object getItem(int position){return position<rowTokens.size()?rowTokens.get(position):rowToken(position);}
        private String rowToken(int position){if(explore()){String content=position==0?screen.exploreMessage+"|"+token(shown.isEmpty()?null:shown.get(0)):"";if(position>0)for(int i=(position-1)*3;i<position*3;i++)content+="|"+token(topic(shown,i));return content;}int index=position*2;return token(shown.get(index))+"||"+token(index+1<shown.size()?shown.get(index+1):null);}
        private Gallery gallery(){if(bindingGallery==null||galleryRevision!=screen.revision||galleryCount!=screen.posts.size()){bindingGallery=new Gallery(screen.posts,screen);if(screen.loaded&&screen.revision>0)bindingGallery.syncedRevision=screen.revision;galleryRevision=screen.revision;galleryCount=screen.posts.size();}return bindingGallery;}
        @Override public void notifyDataSetChanged(){metadataDirty=true;bindingGallery=null;prefetchScreen=null;refreshPrepared();if(screen.view==currentView)prefetchCards(screen,0);}
        void refreshPrepared(){
            if(!metadataDirty&&!explore()&&prefixCurrent&&shown.size()==screen.posts.size()&&screen.restoreRow<0)return;
            String route=screen.tab+"|"+screen.query+"|"+screen.order+"|"+screen.followingMode;
            Set<String> previous=new HashSet<>();if(route.equals(publishedRoute))for(Post p:shown)previous.add(p.key());
            List<Post> ready=new ArrayList<>();
            if(explore()){
                boolean prepared=true;for(int i=-1;i<12;i++){Post p=i<0?(screen.posts.isEmpty()?null:screen.posts.get(0)):topic(screen.posts,i);if(p!=null&&!images.prepared(p.preview,720)){prepared=false;if(screen.view==currentView)images.prefetch(p.preview,720);}}
                if(prepared)ready.addAll(screen.posts);else if(route.equals(publishedRoute))ready.addAll(shown);
            }else{
                int restoring=screen.restoreRow<0?0:Math.max(0,Math.min(screen.restoreRow-1,(screen.posts.size()-1)/2))*2;
                boolean restoreReady=restoring<screen.posts.size()&&images.prepared(screen.posts.get(restoring).preview,720)&&(restoring+1>=screen.posts.size()||images.prepared(screen.posts.get(restoring+1).preview,720));
                for(int i=0;i<screen.posts.size();i+=2){Post left=screen.posts.get(i),right=i+1<screen.posts.size()?screen.posts.get(i+1):null;
                    if(!(restoreReady&&i<restoring)&&(!previous.contains(left.key())&&!images.prepared(left.preview,720)||right!=null&&!previous.contains(right.key())&&!images.prepared(right.preview,720)))break;
                    ready.add(left);if(right!=null)ready.add(right);
                }
                if(ready.isEmpty()&&(screen.loading||!screen.posts.isEmpty())&&route.equals(publishedRoute))ready.addAll(shown);
            }
            shown.clear();shown.addAll(ready);publishedRoute=route;metadataDirty=false;prefixCurrent=shown.size()<=screen.posts.size();for(int i=0;prefixCurrent&&i<shown.size();i++)prefixCurrent=shown.get(i)==screen.posts.get(i);List<String> nextTokens=new ArrayList<>();
            for(int position=0;position<getCount();position++)nextTokens.add(rowToken(position));
            if(!rowTokens.equals(nextTokens)){rowTokens.clear();rowTokens.addAll(nextTokens);super.notifyDataSetChanged();}updateStatus(screen);
            if(screen.restoreRow>=0&&screen.list!=null&&!shown.isEmpty()){
                int target=Math.min(screen.restoreRow,(screen.posts.size()+1)/2);
                if(explore()||shown.size()>Math.max(0,target-1)*2){int top=screen.restoreTop,generation=screen.generation;FeedListView restoring=screen.list;restoring.post(()->{if(destroyed||screen.list!=restoring||screen.generation!=generation||screen.restoreRow<0)return;restoring.setSelectionFromTop(target,top);restoring.postOnAnimation(()->{if(!destroyed&&screen.list==restoring&&screen.generation==generation&&restoring.getFirstVisiblePosition()==target)screen.restoreRow=-1;});});}
            }
        }
        public long getItemId(int position){String key=explore()?"explore:"+position:shown.get(position*2).key();long hash=0xcbf29ce484222325L;for(int i=0;i<key.length();i++){hash^=key.charAt(i);hash*=0x100000001b3L;}return hash;}
        public int getViewTypeCount(){return 3;}
        public int getItemViewType(int position){return explore()?(position==0?1:2):0;}
        public View getView(int position,View recycled,ViewGroup parent){
            if(explore()){
                if(position==0){FrameLayout hero;ImageView image;TextView label;
                    if(recycled instanceof FrameLayout&&((FrameLayout)recycled).getChildCount()==2){hero=(FrameLayout)recycled;image=(ImageView)hero.getChildAt(0);label=(TextView)hero.getChildAt(1);}else{hero=new FrameLayout(MainActivity.this);image=new ImageView(MainActivity.this);image.setScaleType(ImageView.ScaleType.CENTER_CROP);hero.addView(image,new FrameLayout.LayoutParams(-1,-1));hero.setBackground(rounded(RAISED,6));label=gradientLabel("",20);hero.addView(label,new FrameLayout.LayoutParams(-1,-1));}
                    int width=getResources().getDisplayMetrics().widthPixels;hero.setLayoutParams(new ViewGroup.LayoutParams(-1,Math.min(dp(250),width*2/3)));
                    if(!shown.isEmpty())images.bind(image,shown.get(0).preview,720);else images.release(image);
                    label.setText("Найдите своё вдохновение\n"+screen.exploreMessage);hero.setContentDescription("Иллюстрации из каталога");hero.setOnClickListener(v->{if(screen.failed||shown.isEmpty())loadExplore(screen);else openArtwork(shown.get(0),screen.exploreGallery==null?serverGallery(shown,"","latest",null,selectedPages()):screen.exploreGallery);});return hero;
                }
                LinearLayout tiles=recycled instanceof LinearLayout?(LinearLayout)recycled:row();int height=(getResources().getDisplayMetrics().widthPixels-dp(20))/3;tiles.setLayoutParams(new ViewGroup.LayoutParams(-1,height+dp(4)));
                for(int c=0;c<3;c++){
                    int index=(position-1)*3+c;FrameLayout tile;
                    if(c<tiles.getChildCount())tile=(FrameLayout)tiles.getChildAt(c);else{tile=new FrameLayout(MainActivity.this);tile.setBackground(rounded(RAISED+(index%3)*0x020202,5));ImageView image=new ImageView(MainActivity.this);image.setScaleType(ImageView.ScaleType.CENTER_CROP);tile.addView(image,new FrameLayout.LayoutParams(-1,-1));tile.addView(gradientLabel("",14),new FrameLayout.LayoutParams(-1,-1));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,height,1);lp.setMargins(dp(2),dp(2),dp(2),dp(2));tiles.addView(tile,lp);}
                    ImageView image=(ImageView)tile.getChildAt(0);Post matching=topic(shown,index);if(matching!=null)images.bind(image,matching.preview,720);else images.release(image);
                    ((TextView)tile.getChildAt(1)).setText("#"+topicNames[index]);tile.setContentDescription("Тема "+topicNames[index]);tile.setOnClickListener(v->runSearch(topicTags[index]));
                }return tiles;
            }
            LinearLayout row;
            if(recycled instanceof LinearLayout&&recycled.getTag() instanceof Card[]){row=(LinearLayout)recycled;}else{
                row=row();Card[] cards={new Card(),new Card()};row.setTag(cards);for(Card card:cards){LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,-1,1);lp.setMargins(dp(2),dp(2),dp(2),dp(2));row.addView(card,lp);}
            }
            int height=(getResources().getDisplayMetrics().widthPixels-dp(20))/2;row.setLayoutParams(new ViewGroup.LayoutParams(-1,height+dp(4)));Card[] cards=(Card[])row.getTag();
            for(int col=0;col<2;col++){int index=position*2+col;Card card=cards[col];if(index<shown.size()){card.setVisibility(View.VISIBLE);card.bind(shown.get(index),false,gallery());card.feed=FeedAdapter.this;}else{card.setVisibility(View.INVISIBLE);images.cancel(card.image);}}
            return row;
        }
    }
    private TextView gradientLabel(String label,int size){TextView text=text(label,size,TEXT);text.setGravity(Gravity.BOTTOM);text.setPadding(dp(12),dp(20),dp(12),dp(18));text.setTypeface(null,Typeface.BOLD);text.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,new int[]{Color.TRANSPARENT,Color.argb(190,0,0,0)}));return text;}
    private final class Card extends FrameLayout {
        final ImageView image;final IconView heart;final FrameLayout save;final TextView caption;Post post;Gallery gallery;FeedAdapter feed;
        Card(){
            super(MainActivity.this);setBackground(rounded(RAISED,6));setClipToOutline(true);setFocusable(true);
            image=new ImageView(MainActivity.this);image.setScaleType(ImageView.ScaleType.CENTER_CROP);image.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);addView(image,new FrameLayout.LayoutParams(-1,-1));
            caption=gradientLabel("",12);caption.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);addView(caption,new FrameLayout.LayoutParams(-1,-1));caption.setVisibility(GONE);
            save=new FrameLayout(MainActivity.this);save.setFocusable(true);touchBackground(save,Color.argb(85,0,0,0),24);heart=new IconView(MainActivity.this,"heart",TEXT);save.addView(heart,new FrameLayout.LayoutParams(-1,-1));FrameLayout.LayoutParams hp=new FrameLayout.LayoutParams(dp(44),dp(44),Gravity.BOTTOM|Gravity.RIGHT);hp.setMargins(0,0,dp(4),dp(4));addView(save,hp);
            setOnClickListener(v->{if(post!=null){Gallery source=feed==null?gallery:feed.gallery(),context=null;Post selected=resolve(source);if(source!=null){context=new Gallery(source.posts,source.source);context.syncedRevision=source.syncedRevision;}openArtwork(selected,context);}});save.setOnClickListener(v->{if(post!=null){boolean added=store.toggle(resolve(feed==null?gallery:feed.gallery()));refreshCards();toast(added?"Сохранено в закладки":"Убрано из закладок");}});
        }
        private Post resolve(Gallery context){if(context!=null)for(Post item:context.posts)if(item.key().equals(post.key())||item.memberKeys.contains(post.key()))return item;return post;}
        void bind(Post p,boolean ranking){post=p;setContentDescription("Открыть иллюстрацию "+p.id+" · "+p.title);images.bind(image,p.preview,720,()->{if(post==p&&p.source.equals("rule34")&&p.visualHash.isBlank()&&image.getDrawable() instanceof BitmapDrawable){p.visualHash=ImageLoader.visualHash(((BitmapDrawable)image.getDrawable()).getBitmap());scheduleRegroup();}});heart.filled=store.saved(p);heart.color(heart.filled?PINK:TEXT);save.setContentDescription(heart.filled?"Убрать из закладок":"Добавить в закладки");caption.setVisibility(ranking||p.media.size()>1?VISIBLE:GONE);if(!ranking&&p.media.size()>1){caption.setText("▣ "+p.media.size());caption.setGravity(Gravity.TOP|Gravity.RIGHT);caption.setPadding(dp(8),dp(8),dp(8),0);}if(ranking){caption.setGravity(Gravity.BOTTOM);caption.setText(p.title+"\n"+(!p.artistTag.isBlank()?p.artist:sourceName(p.source)));caption.setPadding(dp(12),0,dp(52),dp(12));}}
        void bind(Post p,boolean ranking,Gallery context){feed=null;gallery=context;bind(p,ranking);}
        void updateSaved(){if(post!=null){heart.filled=store.saved(post);heart.color(heart.filled?PINK:TEXT);save.setContentDescription(heart.filled?"Убрать из закладок":"Добавить в закладки");}}
    }

    private View profile(){
        LinearLayout page=column();ScrollView scroll=new ScrollView(this);LinearLayout body=column();body.setPadding(dp(16),dp(20),dp(16),dp(24));scroll.addView(body);page.addView(toolbar("Моя страница",null));page.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        LinearLayout account=row();account.setPadding(dp(4),dp(6),dp(4),dp(24));TextView avatar=text("A",28,TEXT);avatar.setGravity(Gravity.CENTER);avatar.setBackground(rounded(BLUE,36));account.addView(avatar,new LinearLayout.LayoutParams(dp(60),dp(60)));
        LinearLayout label=column();label.setPadding(dp(16),0,0,0);TextView name=text("ArtCatalog",19,TEXT);name.setTypeface(null,Typeface.BOLD);label.addView(name);TextView info=text("Ваш каталог на телефоне",13,MUTED);info.setPadding(0,dp(6),0,0);label.addView(info);account.addView(label);body.addView(account);
        LinearLayout summary=row();summary.setPadding(dp(16),dp(16),dp(16),dp(16));summary.setBackground(rounded(RAISED,8));summary.addView(text(store.bookmarks().size()+" закладок",14,TEXT),new LinearLayout.LayoutParams(0,-2,1));summary.addView(text(store.follows().size()+" подписок",14,MUTED));body.addView(summary);
        menuRow(body,"heart","Закладки",()->selectNav(3));menuRow(body,"clock","Недавно открытое",()->localGrid("Недавно открытое",store.history()));menuRow(body,"users","Подписки",this::manageFollows);
        TextView divider=text("Настройки",12,MUTED);divider.setPadding(dp(8),dp(24),0,dp(8));body.addView(divider);
        menuRow(body,"settings","Настройки",this::settings);menuRow(body,"bookmark","Открытые работы",this::openWorks);menuRow(body,"download","Экспорт закладок и подписок",this::exportData);menuRow(body,"bookmark","Импорт закладок с ПК",this::importData);
        TextView note=text("ArtCatalog Mobile "+BuildConfig.VERSION_NAME+"\nДанные хранятся на этом телефоне",12,MUTED);note.setPadding(dp(8),dp(30),0,0);body.addView(note);return page;
    }
    private void menuRow(LinearLayout parent,String icon,String label,Runnable action){LinearLayout option=row();option.setPadding(dp(4),0,dp(4),0);option.addView(new IconView(this,icon,MUTED),new LinearLayout.LayoutParams(dp(44),dp(60)));TextView title=text(label,15,TEXT);title.setPadding(dp(10),0,0,0);option.addView(title,new LinearLayout.LayoutParams(0,-2,1));option.addView(new IconView(this,"next",MUTED),new LinearLayout.LayoutParams(dp(26),dp(40)));touchBackground(option,Color.TRANSPARENT,7);option.setContentDescription(label);option.setOnClickListener(v->action.run());parent.addView(option,new LinearLayout.LayoutParams(-1,dp(60)));}
    private void localGrid(String title,List<Post> posts){
        Screen screen=new Screen(3);buildFeed(screen);screen.more=false;screen.loaded=true;screen.posts.clear();for(Post p:posts)if(CatalogLogic.matchesRating(p.rating,rating))screen.posts.add(p);screen.adapter.notifyDataSetChanged();updateStatus(screen);LinearLayout shell=(LinearLayout)screen.view;shell.removeViewAt(0);shell.addView(toolbar(title,this::goBack),0);push(shell);
    }
    private void manageFollows(){
        LinearLayout page=column();page.addView(toolbar("Подписки",this::goBack));ScrollView scroll=new ScrollView(this);LinearLayout body=column();body.setPadding(dp(16),dp(16),dp(16),dp(24));scroll.addView(body);page.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        body.addView(button("Добавить художника по тегу",BLUE,()->followDialog(null,()->{goBack();manageFollows();})),new LinearLayout.LayoutParams(-1,dp(46)));
        for(JSONObject f:store.follows()){
            String tag=f.optString("tag");LinearLayout option=row();option.setPadding(0,dp(10),0,dp(10));TextView title=text(tag.replace('_',' '),15,TEXT);title.setOnClickListener(v->authorProfile(tag));option.addView(title,new LinearLayout.LayoutParams(0,dp(46),1));title.setGravity(Gravity.CENTER_VERTICAL);
            option.addView(button("Отписаться",MUTED,()->{store.toggleFollow(tag);screens[2]=null;goBack();manageFollows();}));body.addView(option);
        }
        if(store.follows().isEmpty()){TextView note=text("Откройте иллюстрацию и подпишитесь на художника.\nЗдесь можно добавить его тег вручную.",14,MUTED);note.setPadding(0,dp(24),0,0);body.addView(note);}push(page);
    }
    private void followDialog(Post p,Runnable after){
        EditText input=new EditText(this);input.setSingleLine();input.setHint("Тег художника, например artist_name");input.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);input.setText(p==null?"":p.artistTag);input.setPadding(dp(20),dp(16),dp(20),dp(16));
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Подписка на художника").setMessage("Укажите тег художника из источника. Один тег ищется во всех подключённых каталогах.").setView(input).setNegativeButton("Отмена",null).setPositiveButton("Подписаться",null).create();dialog.setOnShowListener(v->dialog.getButton(-1).setOnClickListener(x->{String tag=input.getText().toString().trim().replace(' ','_');if(!tag.matches("[a-zA-Z0-9_().!+\\-]{1,100}")){input.setError("Введите один тег художника");return;}if(!store.following(tag))store.toggleFollow(tag);if(p!=null)p.artistTag=tag;screens[2]=null;dialog.dismiss();after.run();}));dialog.show();
    }
    private void filters(){
        Dialog dialog=new Dialog(this);LinearLayout sheet=column();sheet.setPadding(dp(20),dp(18),dp(20),dp(24));sheet.setBackground(rounded(PANEL,18));TextView title=text("Фильтры",20,TEXT);title.setTypeface(null,Typeface.BOLD);sheet.addView(title);
        sheet.addView(text("Источники",13,MUTED));RadioGroup sources=new RadioGroup(this);String[] ids={"all","danbooru","gelbooru","rule34","sankaku"};
        for(int i=0;i<ids.length;i++){RadioButton b=new RadioButton(this);b.setId(View.generateViewId());b.setTag(ids[i]);b.setText(i==0?"Все подключённые источники":sourceName(ids[i])+(store.configured(ids[i])?"":" · нужен API key"));b.setTextSize(14);sources.addView(b);if(sourceFilter.equals(ids[i]))sources.check(b.getId());}sheet.addView(sources);
        sheet.addView(text("Рейтинг",13,MUTED));RadioGroup ratings=new RadioGroup(this);ratings.setOrientation(LinearLayout.HORIZONTAL);String[] rs={"general","explicit","all"},rl={"Обычное","18+","Всё"};for(int i=0;i<3;i++){RadioButton b=new RadioButton(this);b.setId(View.generateViewId());b.setTag(rs[i]);b.setText(rl[i]);b.setTextSize(13);ratings.addView(b,new RadioGroup.LayoutParams(0,dp(48),1));if(rating.equals(rs[i]))ratings.check(b.getId());}sheet.addView(ratings);
        RadioGroup orders=new RadioGroup(this);orders.setOrientation(LinearLayout.HORIZONTAL);String[] sorts={"latest","popular"};for(int i=0;i<2;i++){RadioButton b=new RadioButton(this);b.setId(View.generateViewId());b.setTag(sorts[i]);b.setText(i==0?"Новые":"Популярные");orders.addView(b,new RadioGroup.LayoutParams(0,dp(48),1));if(sort.equals(sorts[i]))orders.check(b.getId());}sheet.addView(orders);
        sheet.addView(button("Применить",BLUE,()->{sourceFilter=(String)sources.findViewById(sources.getCheckedRadioButtonId()).getTag();rating=(String)ratings.findViewById(ratings.getCheckedRadioButtonId()).getTag();sort=(String)orders.findViewById(orders.getCheckedRadioButtonId()).getTag();store.prefs.edit().putString("source",sourceFilter).putString("rating",rating).putString("sort",sort).apply();String query=screens[1]==null?"":screens[1].query;invalidateScreens();searchInput=null;suggestions=null;dialog.dismiss();selectNav(nav);if(nav==1&&!query.isBlank())runSearch(query);}),new LinearLayout.LayoutParams(-1,dp(48)));
        dialog.setContentView(sheet);Window w=dialog.getWindow();if(w!=null){w.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));w.setLayout(-1,-2);w.setGravity(Gravity.BOTTOM);}dialog.show();if(w!=null)w.setLayout(-1,-2);
    }
    private void settings(){settings("Контент");}
    private void settings(String initial){
        LinearLayout page=column();page.addView(toolbar("Настройки",this::goBack));LinearLayout tabs=row();page.addView(tabs);ScrollView scroll=new ScrollView(this);LinearLayout body=column();body.setPadding(dp(16),dp(16),dp(16),dp(24));scroll.addView(body);page.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));String[] sections={"Контент","Авторы","Источники","Вкладки"};for(String section:sections){TextView tab=button(section,BLUE,()->{body.removeAllViews();settingsSection(body,section);scroll.scrollTo(0,0);for(int i=0;i<tabs.getChildCount();i++)((TextView)tabs.getChildAt(i)).setTextColor(sections[i].equals(section)?BLUE:MUTED);});tab.setTextSize(12);tab.setPadding(dp(4),0,dp(4),0);tabs.addView(tab,new LinearLayout.LayoutParams(0,dp(46),1));}settingsSection(body,initial);for(int i=0;i<tabs.getChildCount();i++)((TextView)tabs.getChildAt(i)).setTextColor(sections[i].equals(initial)?BLUE:MUTED);push(page);if(initial.equals("Источники"))body.post(()->{View auth=body.findViewWithTag("sankaku-auth");if(auth!=null)scroll.smoothScrollTo(0,Math.max(0,auth.getTop()-dp(50)));});
    }
    private void hint(LinearLayout body,String value){TextView label=text(value,13,MUTED);label.setPadding(0,dp(6),0,dp(18));body.addView(label);}
    private void sankakuSettings(LinearLayout body){
        TextView status=text(store.sankakuAuthenticated()?"Вход сохранён: "+store.loginName():"Без авторизации · доступны публичные работы",13,MUTED);status.setContentDescription("Статус авторизации Sankaku");status.setTag("sankaku-auth");body.addView(status);
        hint(body,"Для ограниченных работ авторизуйтесь в Sankaku. Популярные загружаются в порядке сайта. Отдельные функции и работы могут требовать подписку Plus.");
        EditText login=new EditText(this);login.setSingleLine();login.setTextColor(TEXT);login.setHintTextColor(MUTED);login.setHint("Логин или email Sankaku");login.setContentDescription("Логин Sankaku");login.setText(store.loginName());login.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);body.addView(login);
        EditText password=new EditText(this);password.setSingleLine();password.setTextColor(TEXT);password.setHintTextColor(MUTED);password.setHint("Пароль Sankaku");password.setContentDescription("Пароль Sankaku");password.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);password.setImeOptions(EditorInfo.IME_ACTION_DONE|EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING);password.setSaveEnabled(false);body.addView(password);
        TextView signIn=button("Войти в Sankaku",BLUE,()->{}),signOut=button("Выйти из Sankaku",MUTED,()->{});body.addView(signIn);body.addView(signOut);signOut.setVisibility(store.sankakuAuthenticated()?View.VISIBLE:View.GONE);
        signIn.setOnClickListener(v->{String name=login.getText().toString().trim(),secret=password.getText().toString();if(name.isBlank()||secret.isBlank()){status.setText("Введите логин и пароль Sankaku");return;}password.setText("");hideKeyboard();signIn.setEnabled(false);signOut.setEnabled(false);status.setText("Авторизация в Sankaku…");submitNetwork(()->{
            try{client.loginSankaku(name,secret);main.post(()->{if(destroyed)return;status.setText("Вход выполнен: "+store.loginName());signIn.setEnabled(true);signOut.setEnabled(true);signOut.setVisibility(View.VISIBLE);invalidateScreens();toast("Sankaku подключён");});}
            catch(Exception error){String message=error instanceof java.net.SocketTimeoutException?"Sankaku не ответил. Повторите вход.":error instanceof IOException||error instanceof org.json.JSONException?error.getMessage():"Не удалось сохранить вход. Повторите авторизацию.";main.post(()->{if(destroyed)return;status.setText(message==null?"Не удалось войти в Sankaku":message);signIn.setEnabled(true);signOut.setEnabled(true);});}
        });});
        signOut.setOnClickListener(v->{signIn.setEnabled(false);signOut.setEnabled(false);io.execute(()->{client.logoutSankaku();main.post(()->{if(destroyed)return;status.setText("Вы вышли · доступны публичные работы");signIn.setEnabled(true);signOut.setEnabled(true);signOut.setVisibility(View.GONE);password.setText("");invalidateScreens();toast("Вы вышли из Sankaku");});});});
        hint(body,"Пароль отправляется по HTTPS только в Sankaku и не сохраняется. Токены входа зашифрованы Android Keystore и не входят в экспорт профиля.");
        body.addView(button("Открыть сайт Sankaku",MUTED,()->external("https://sankaku.app/")));
    }
    private CheckBox check(LinearLayout body,String label,boolean selected){CheckBox box=new CheckBox(this);box.setText(label);box.setTextColor(TEXT);box.setTextSize(15);box.setChecked(selected);box.setMinHeight(dp(50));body.addView(box);return box;}
    private RadioGroup choices(LinearLayout body,String[] labels,String[] values,String current){RadioGroup group=new RadioGroup(this);for(int i=0;i<labels.length;i++){RadioButton option=new RadioButton(this);option.setId(View.generateViewId());option.setTag(values[i]);option.setText(labels[i]);option.setTextColor(TEXT);option.setMinHeight(dp(48));group.addView(option);if(values[i].equals(current))group.check(option.getId());}body.addView(group);return group;}
    private void preferencesChanged(){invalidateScreens();toast("Настройки сохранены");}
    private void settingsSection(LinearLayout body,String section){
        if(section.equals("Контент")){
            TextView title=text("Фильтры содержимого",20,TEXT);title.setTypeface(null,Typeface.BOLD);body.addView(title);String ai=store.prefs.getString("aiMode","all");CheckBox generated=check(body,"Скрывать AI-generated",!ai.equals("all"));CheckBox assisted=check(body,"Скрывать также AI-assisted",ai.equals("generated-and-assisted"));assisted.setEnabled(generated.isChecked());hint(body,"Учитываются метки AI-generated, AI-art, Stable Diffusion, NovelAI и AI-assisted. Работы без этих тегов не определяются автоматически как AI.");CheckBox viewed=check(body,"Скрывать просмотренные и сохранённые работы",store.prefs.getBoolean("hideViewedAndSaved",false));hint(body,"Скрывает работы из поиска, рекомендаций и похожих, включая копии с тем же MD5. Закладки, история и профили авторов остаются доступны.");body.addView(text("Исключённые теги",17,TEXT));EditText excluded=new EditText(this);excluded.setTextColor(TEXT);excluded.setHintTextColor(MUTED);excluded.setHint("Например, 3d, ai_generated_background");excluded.setText(store.prefs.getString("excludedTags",""));excluded.setMaxLines(5);body.addView(excluded);hint(body,"Можно указать несколько тегов через запятую. Совпадение точное: latex не исключает latex_gloves.");generated.setOnCheckedChangeListener((b,checked)->assisted.setEnabled(checked));body.addView(button("Сохранить фильтры",BLUE,()->{store.prefs.edit().putString("aiMode",!generated.isChecked()?"all":assisted.isChecked()?"generated-and-assisted":"generated").putBoolean("hideViewedAndSaved",viewed.isChecked()).putString("excludedTags",String.join(", ",CatalogLogic.excludedTags(excluded.getText().toString()))).apply();preferencesChanged();}));
        }else if(section.equals("Авторы")){
            body.addView(text("Основная подпись автора",20,TEXT));hint(body,"Художник, исходная публикация и загрузчик показаны отдельно в работе. Здесь выбирается основная подпись.");RadioGroup priority=choices(body,new String[]{"Художник","Исходная ссылка","Загрузчик"},new String[]{"creator","original","uploader"},store.prefs.getString("attributionPriority","creator"));hint(body,"Подписка создаётся на тег художника. Исходная ссылка открывает публикацию; загрузчик может быть другим человеком.");body.addView(button("Сохранить приоритет",BLUE,()->{store.prefs.edit().putString("attributionPriority",(String)priority.findViewById(priority.getCheckedRadioButtonId()).getTag()).apply();preferencesChanged();}));
        }else if(section.equals("Вкладки")){
            body.addView(text("Открытие иллюстраций",20,TEXT));RadioGroup mode=choices(body,new String[]{"Один временный просмотр","Каждая работа в отдельной вкладке"},new String[]{"preview","new"},store.prefs.getString("artworkTabs","preview"));hint(body,"Временная работа заменяется следующей. Открытые работы доступны через кнопку в просмотре или на моей странице. Закрепите работу звёздочкой, чтобы сохранить её среди открытых; закреплённая работа не заменяется и не закрывается.");body.addView(button("Сохранить режим",BLUE,()->{store.prefs.edit().putString("artworkTabs",(String)mode.findViewById(mode.getCheckedRadioButtonId()).getTag()).apply();toast("Режим сохранён");}));body.addView(button("Открытые работы",MUTED,this::openWorks));
        }else{
            hint(body,"Поиск работает на этом телефоне без включённого ПК. API-ключи хранятся в Android Keystore и не попадают в экспорт.");for(String source:CatalogClient.SOURCES){TextView name=text(sourceName(source),18,TEXT);name.setTypeface(null,Typeface.BOLD);name.setPadding(0,dp(18),0,dp(8));body.addView(name);if(source.equals("danbooru")){hint(body,"Публичный поиск доступен без API key.");continue;}if(source.equals("sankaku")){sankakuSettings(body);continue;}TextView status=text(store.configured(source)?"Источник подключён":"Источник не подключён",13,MUTED);body.addView(status);EditText user=new EditText(this);user.setSingleLine();user.setHint("User ID");user.setTextColor(TEXT);user.setHintTextColor(MUTED);user.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);body.addView(user);EditText key=new EditText(this);key.setSingleLine();key.setHint("API key · оставить пустым для сохранения текущего");key.setTextColor(TEXT);key.setHintTextColor(MUTED);key.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);body.addView(key);boolean[] credentialsReady={false};user.setEnabled(false);key.setEnabled(false);io.execute(()->{try{String id=store.credential(source,"user");main.post(()->{if(!destroyed){user.setText(id);credentialsReady[0]=true;user.setEnabled(true);key.setEnabled(true);}});}catch(Exception ignored){main.post(()->status.setText("Не удалось прочитать подключение. Существующие ключи сохранены."));}});hint(body,"Пустой API key сохраняет существующий ключ. Очистите User ID и сохраните, чтобы отключить источник.");body.addView(button("Сохранить "+sourceName(source),BLUE,()->{if(!credentialsReady[0]){toast("Подождите загрузки настроек подключения");return;}String id=user.getText().toString().trim(),token=key.getText().toString().trim();if(!id.isBlank()&&!id.matches("[0-9]{1,20}")||!token.isBlank()&&(token.length()<8||token.length()>300)){toast("Проверьте User ID и API key");return;}io.execute(()->{try{String savedToken=id.isBlank()?"":token.isBlank()?store.credential(source,"key"):token;if(!id.isBlank()&&savedToken.isBlank()){main.post(()->toast("Введите API key для первого подключения"));return;}store.credentials(source,id,savedToken);main.post(()->{if(destroyed)return;key.setText("");status.setText(id.isBlank()?"Источник отключён":"Источник подключён");invalidateScreens();toast("Настройки источника сохранены");});}catch(Exception e){main.post(()->toast("Не удалось сохранить ключи"));}});}));body.addView(button("Открыть сайт "+sourceName(source),MUTED,()->external(source.equals("gelbooru")?"https://gelbooru.com/index.php?page=account&s=options":"https://rule34.xxx/index.php?page=account&s=options")));}body.addView(button("Импорт профиля",BLUE,this::importData));body.addView(button("Экспорт профиля",MUTED,this::exportData));
        }
    }
    private void openDetail(Post p){openDetail(p,true,0);}
    private void openArtwork(Post p,Gallery gallery){
        if(gallery!=null&&gallery.posts.stream().noneMatch(item->item.key().equals(p.key())||item.memberKeys.contains(p.key()))){List<Post> sequence=new ArrayList<>();sequence.add(p);sequence.addAll(gallery.posts);gallery=new Gallery(sequence,gallery.source);}
        renderDetail(p,true,0,0,null,gallery);
    }
    private void openDetail(Post p,boolean addHistory,int scrollPosition){renderDetail(p,addHistory,scrollPosition,0,null,activeGallery);}
    private void renderDetail(Post p,boolean addHistory,int first,int top,ScreenState cached,Gallery gallery){
        if(CatalogLogic.hidden(p,store.prefs.getString("aiMode","all"),CatalogLogic.excludedTags(store.prefs.getString("excludedTags","")))){toast("Эта работа скрыта фильтрами содержимого");return;}hideKeyboard();cancel(detailTask);store.openWork(p);store.visit(p);store.markSeen(p);
        LinearLayout page=column();page.setBackgroundColor(BG);FeedListView list=new FeedListView(this);list.setRecyclerListener(this::recycleImages);list.setRestoreListener(this::restoreCards);list.setVerticalScrollBarEnabled(false);list.setClipToPadding(false);page.addView(list,new LinearLayout.LayoutParams(-1,-1));
        LinearLayout header=column();int width=getResources().getDisplayMetrics().widthPixels;int height=p.width>0&&p.height>0?(int)((double)width*p.height/p.width):width;height=Math.max(width*2/3,Math.min(height,(int)(getResources().getDisplayMetrics().heightPixels*.78)));if(gallery!=null){if(gallery.viewportWidth==width)height=gallery.viewportHeight;else{gallery.viewportWidth=width;gallery.viewportHeight=height;}}
        FrameLayout art=new FrameLayout(this);art.setBackgroundColor(Color.BLACK);ImageView image=new ImageView(this);image.setScaleType(ImageView.ScaleType.FIT_CENTER);image.setContentDescription("Открыть изображение на весь экран");art.addView(image,new FrameLayout.LayoutParams(-1,-1));
        if(p.isVideo()){image.setImageResource(android.R.drawable.ic_media_play);image.setOnClickListener(v->video(p));}else{images.bindProgressive(image,p.preview,p.image.isBlank()?p.preview:p.image,2000,0,null);image.setOnClickListener(v->fullscreen(p));}
        image.setOnTouchListener(new View.OnTouchListener(){float x,y;boolean moved;public boolean onTouch(View v,MotionEvent e){if(e.getActionMasked()==MotionEvent.ACTION_DOWN){x=e.getX();y=e.getY();moved=false;}if(e.getActionMasked()==MotionEvent.ACTION_MOVE&&Math.abs(e.getX()-x)>dp(24)&&Math.abs(e.getX()-x)>Math.abs(e.getY()-y)*1.4){v.getParent().requestDisallowInterceptTouchEvent(true);moved=true;}if(e.getActionMasked()==MotionEvent.ACTION_UP&&moved){if(Math.abs(e.getX()-x)>dp(64))navigate(e.getX()>x?1:-1);return true;}return false;}});
        LinearLayout controls=row();FrameLayout back=iconButton("back","Назад",this::goBack);touchBackground(back,Color.argb(110,0,0,0),24);controls.addView(back,new LinearLayout.LayoutParams(dp(48),dp(48)));controls.addView(new Space(this),new LinearLayout.LayoutParams(0,1,1));controls.addView(iconButton("bookmark","Открытые работы",this::openWorks),new LinearLayout.LayoutParams(dp(48),dp(48)));FrameLayout share=iconButton("share","Поделиться",()->share(p));controls.addView(share,new LinearLayout.LayoutParams(dp(48),dp(48)));FrameLayout.LayoutParams cl=new FrameLayout.LayoutParams(-1,dp(56),Gravity.TOP);cl.setMargins(dp(8),dp(4),dp(8),0);art.addView(controls,cl);
        LinearLayout pager=row();pager.setPadding(dp(8),0,dp(8),dp(4));pager.addView(iconButton("back","Предыдущая иллюстрация",()->navigate(-1)),new LinearLayout.LayoutParams(dp(48),dp(48)));TextView mediaLabel=text("",12,TEXT);mediaLabel.setGravity(Gravity.CENTER);pager.addView(mediaLabel,new LinearLayout.LayoutParams(0,dp(40),1));pager.addView(iconButton("next","Следующая иллюстрация",()->navigate(1)),new LinearLayout.LayoutParams(dp(48),dp(48)));art.addView(pager,new FrameLayout.LayoutParams(-1,dp(52),Gravity.BOTTOM));header.addView(art,new LinearLayout.LayoutParams(-1,height));
        LinearLayout info=column();info.setPadding(dp(16),dp(16),dp(16),dp(12));header.addView(info);TextView title=text(p.title,20,TEXT);title.setMaxLines(3);title.setEllipsize(TextUtils.TruncateAt.END);title.setTypeface(null,Typeface.BOLD);info.addView(title);TextView provenance=text(sourceName(p.source)+" · "+(CatalogLogic.matchesRating(p.rating,"general")?"Обычное":"18+")+(p.score>0?" · ♥ "+p.score:""),12,MUTED);provenance.setPadding(0,dp(6),0,dp(12));info.addView(provenance);
        LinearLayout actions=row();TextView save=button(store.saved(p)?"♥ Сохранено":"♡ В закладки",PINK,()->{});save.setOnClickListener(v->{boolean added=store.toggle(p);save.setText(added?"♥ Сохранено":"♡ В закладки");refreshCards();});actions.addView(save,new LinearLayout.LayoutParams(0,dp(46),1));actions.addView(iconButton("download","Скачать оригинал",()->download(p)),new LinearLayout.LayoutParams(dp(48),dp(48)));actions.addView(iconButton("share","Открыть источник",()->external(p.sourceUrl)),new LinearLayout.LayoutParams(dp(48),dp(48)));info.addView(actions);
        LinearLayout identities=column();identities.setPadding(0,dp(8),0,dp(8));info.addView(identities);addAttribution(identities,p);
        List<String> ordered=CatalogLogic.artworkTags(p);FlowLayout tags=new FlowLayout(this);tags.setPadding(0,dp(12),0,dp(8));info.addView(tags,new LinearLayout.LayoutParams(-1,-2));boolean[] expanded={false};Set<String> selected=new LinkedHashSet<>();TextView selectedSearch=button("Искать выбранные теги",BLUE,()->runSearch(String.join(" ",selected)));selectedSearch.setVisibility(View.GONE);LinearLayout.LayoutParams selectedLayout=new LinearLayout.LayoutParams(-1,dp(44));selectedLayout.setMargins(0,dp(8),0,dp(4));info.addView(selectedSearch,selectedLayout);TextView more=button("Ещё "+Math.max(0,ordered.size()-8)+" тегов",MUTED,()->{});Runnable fillTags=()->{tags.removeAllViews();for(String tag:ordered.subList(0,expanded[0]?ordered.size():Math.min(8,ordered.size()))){String kind=CatalogLogic.tagKind(p,tag);int color=kind.equals("character")?Color.rgb(185,232,204):kind.equals("original")?Color.rgb(222,201,246):BLUE;TextView chip=button("#"+tag.replace('_',' '),color,()->runSearch(selected.isEmpty()?tag:String.join(" ",selected)));chip.setTextSize(12);chip.setMinHeight(dp(36));chip.setMaxWidth(width-dp(40));chip.setSingleLine(true);chip.setEllipsize(TextUtils.TruncateAt.END);chip.setPadding(dp(10),dp(7),dp(10),dp(7));touchBackground(chip,selected.contains(tag)?Color.rgb(47,84,116):kind.equals("character")?Color.rgb(34,55,46):kind.equals("original")?Color.rgb(52,42,64):RAISED,18);chip.setOnLongClickListener(v->{if(!selected.remove(tag))selected.add(tag);selectedSearch.setVisibility(selected.isEmpty()?View.GONE:View.VISIBLE);selectedSearch.setText("Искать выбранные · "+selected.size());v.setAlpha(selected.contains(tag)?.65f:1f);return true;});tags.addView(chip,new ViewGroup.LayoutParams(-2,-2));}more.setText(expanded[0]?"Свернуть теги":"Ещё "+Math.max(0,ordered.size()-8)+" тегов");};more.setOnClickListener(v->{expanded[0]=!expanded[0];fillTags.run();});fillTags.run();if(ordered.size()>8){LinearLayout.LayoutParams moreLayout=new LinearLayout.LayoutParams(-1,dp(44));moreLayout.setMargins(0,dp(12),0,dp(8));info.addView(more,moreLayout);}
        LinearLayout artistWorks=column();artistWorks.setPadding(0,dp(12),0,dp(12));header.addView(artistWorks);header.addView(section("Похожие иллюстрации","spark",BLUE));list.addHeaderView(header,null,false);
        Screen related=new Screen(5);related.restoreRow=first;related.restoreTop=top;related.artistWorks=artistWorks;related.anchor=p;related.list=list;related.view=page;related.status=text("Загрузка…",13,MUTED);related.status.setGravity(Gravity.CENTER);related.status.setPadding(dp(16),dp(18),dp(16),dp(24));related.status.setOnClickListener(v->statusAction(related));list.addFooterView(related.status,null,false);related.adapter=new FeedAdapter(related);list.setAdapter(related.adapter);
        if(addHistory)push(page);else{stopDetail();display(page);}activePost=p;activeGallery=gallery==null?findGallery(p):gallery;activeRelated=related;detailList=list;activeArt=image;previousArtworkButton=pager.getChildAt(0);nextArtworkButton=pager.getChildAt(pager.getChildCount()-1);activeMediaLabel=mediaLabel;activeMediaIndex=0;authorTag="";updateMediaLabel();
        if(cached!=null&&cached.loaded){related.posts.addAll(cached.posts);related.fingerprints.addAll(cached.fingerprints);related.pages.putAll(cached.pages);related.jobs.addAll(cached.jobs);related.loaded=true;related.more=cached.more;related.failed=cached.failed;related.authBlocked=cached.authBlocked;related.authRequired.addAll(cached.authRequired);related.accessNotice=cached.accessNotice;related.adapter.notifyDataSetChanged();updateStatus(related);}else load(related,true);
        boolean[] touched={false};list.setOnTouchListener((v,e)->{if(e.getActionMasked()==MotionEvent.ACTION_MOVE)touched[0]=true;return false;});list.setOnScrollListener(new FeedListView.ScrollListener(){public void onScrollStateChanged(FeedListView v,int state){if(state==SCROLL_STATE_TOUCH_SCROLL)related.restoreRow=-1;}public void onScroll(FeedListView v,int firstVisible,int visible,int total){prefetchCards(related,Math.max(0,firstVisible-1));if(currentView==page&&related.loaded&&!related.loading&&!related.failed&&related.more&&needsPage(related))load(related,false);}});
        related.loadedCallback=()->{};
        prefetchNeighbors(p);prepareGalleryPage();
        String filter=rating;Map<String,Integer> pages=selectedPages();detailTask=submitNetwork(()->{String confirmedTag=p.artistTag;if(!p.source.equals("danbooru"))try{Post enriched=Post.fromJson(p.toJson());client.enrich(enriched);confirmedTag=enriched.artistTag;main.post(()->{if(destroyed||currentView!=page)return;p.artistTag=enriched.artistTag;p.artist=enriched.artist;p.artistTags=enriched.artistTags;p.characterTags=enriched.characterTags;p.tags=enriched.tags;if(p.source.equals("sankaku")){p.title=enriched.title;title.setText(p.title);p.originalUrl=enriched.originalUrl;CatalogLogic.refreshSignedMedia(p,enriched);if(activeMediaIndex==0){if(p.isVideo())image.setImageResource(android.R.drawable.ic_media_play);else images.bindProgressive(image,p.preview,p.image,2000,0,null);}updateMediaLabel();}ordered.clear();ordered.addAll(CatalogLogic.artworkTags(p));reseedRelated(related,p);identities.removeAllViews();addAttribution(identities,p);fillTags.run();store.refreshCachedPost(p);});}catch(SankakuApi.AccessException error){main.post(()->{if(!destroyed&&currentView==page)accessPrompt(error);});}catch(Exception error){if(p.source.equals("sankaku"))main.post(()->{if(!destroyed&&currentView==page)toast("Не удалось обновить работу Sankaku. Повторите открытие.");});}if(confirmedTag.isBlank())return;String authorQuery=confirmedTag;CatalogClient.Page authored=client.search(authorQuery,pages,filter,"latest");main.post(()->{if(destroyed||currentView!=page)return;List<Post> works=store.visible(CatalogLogic.excludeSaved(authored.posts,List.of(p)),false);if(works.isEmpty())return;related.pendingArtistWorks=new ArrayList<>(works.subList(0,Math.min(works.size(),8)));related.pendingArtistGallery=serverGallery(works,authorQuery,"latest",authored,pages);applyPreparedArtistWorks(related);});});
    }
    private Gallery findGallery(Post p){for(Screen s:screens)if(s!=null&&s.view==currentView)return new Gallery(s.posts,s);return new Gallery(new ArrayList<>(List.of(p)),null);}
    private void prefetchNeighbors(Post p){images.cancelPrefetch();if(activeGallery==null)return;for(int delta:new int[]{1,2,3,-1}){Post neighbor=CatalogLogic.neighbor(activeGallery.posts,p,delta);if(neighbor!=null&&!neighbor.isVideo()){images.prefetch(neighbor.preview,720);if(Math.abs(delta)==1)images.prefetch(neighbor.image.isBlank()?neighbor.preview:neighbor.image,2000);}}for(int i=activeMediaIndex+1;i<Math.min(p.media.size(),activeMediaIndex+3);i++)if(!mediaPost(p,i).isVideo())images.prefetch(p.media.get(i),720);}
    private void reseedRelated(Screen screen,Post post){if(screen!=activeRelated)return;List<String> queries=CatalogLogic.relatedQueries(post);Map<String,Job> existing=new LinkedHashMap<>();for(Job job:screen.jobs)existing.put(job.query,job);cancel(screen.task);screen.generation++;screen.loading=false;screen.jobs.clear();for(String query:queries)screen.jobs.add(existing.containsKey(query)?existing.get(query):new Job(query,selectedPages()));screen.more=!screen.jobs.isEmpty();if(screen.more)load(screen,false);else updateStatus(screen);}
    private void prepareGalleryPage(){
        if(activeGallery==null||activeGallery.source==null||activePost==null)return;Screen source=activeGallery.source;
        int index=-1;for(int i=0;i<activeGallery.posts.size();i++)if(activeGallery.posts.get(i).key().equals(activePost.key())||activeGallery.posts.get(i).memberKeys.contains(activePost.key())){index=i;break;}
        if(index>=0&&activeGallery.posts.size()-index<=8&&source.more&&!source.loading&&!source.failed&&!source.authBlocked)load(source,false);
    }
    private void navigate(int delta){navigate(delta,null);}
    private void navigate(int delta,Runnable arrived){navigate(delta,arrived,()->true);}
    private void navigate(int delta,Runnable arrived,java.util.function.BooleanSupplier alive){
        if(activePost==null||!alive.getAsBoolean()||delta==0)return;
        if(BuildConfig.DEBUG&&getIntent().getBooleanExtra("qaNavigationManual",false))android.util.Log.i("ArtCatalogQA","NAV input delta="+delta+" post="+activePost.id+" queued="+navigationQueue.size()+" busy="+(navigating!=null));
        navigationQueue.addLast(new NavigationRequest(delta>0?1:-1,arrived,alive));drainNavigation();
    }
    private void drainNavigation(){
        if(navigating!=null||destroyed)return;
        while(!navigationQueue.isEmpty()){NavigationRequest request=navigationQueue.removeFirst();if(!request.alive.getAsBoolean())continue;navigating=request;navigationGeneration++;continueNavigation(request);break;}
    }
    private boolean navigationAlive(NavigationRequest request){return !destroyed&&request!=null&&navigating==request&&activePost!=null&&request.alive.getAsBoolean();}
    private void continueNavigation(NavigationRequest request){
        if(!navigationAlive(request)){finishNavigation(request);return;}
        Gallery context=activeGallery;Post selected=activePost;Screen source=context==null?null:context.source;
        if(source!=null&&context.syncedRevision!=source.revision){
            int revision=source.revision;List<Post> first=new ArrayList<>(context.posts),second=new ArrayList<>(source.posts);
            grouping.execute(()->{List<Post> sequence=CatalogLogic.merge(first,second);main.post(()->{
                if(!navigationAlive(request)||activePost!=selected||activeGallery!=context){finishNavigation(request);return;}
                applyGallerySequence(selected,context,sequence,revision);continueNavigation(request);
            });});return;
        }
        int mediaIndex=activeMediaIndex+request.delta;
        if(mediaIndex>=0&&mediaIndex<selected.media.size()){prepareNavigation(request,selected,mediaIndex,true);return;}
        Post next=context==null?null:CatalogLogic.neighbor(context.posts,selected,request.delta);
        if(next!=null){prepareNavigation(request,next,request.delta<0?Math.max(0,next.media.size()-1):0,false);return;}
        if(request.delta>0&&source!=null&&source.authBlocked){navigationQueue.clear();finishNavigation(request);accessPrompt(new SankakuApi.AccessException(true));return;}
        if(request.delta>0&&source!=null&&(source.loading||source.more)){
            setNavigationLoading();clearNavigationWait();navigationSource=source;navigationOldCallback=source.loadedCallback;
            Runnable old=navigationOldCallback;
            navigationCallback=()->{clearNavigationWait();if(old!=null)old.run();if(!navigationAlive(request)){finishNavigation(request);return;}if(source.failed){navigationQueue.clear();finishNavigation(request);if(activeMediaLabel!=null){if(activeFullscreenStatus!=null)activeFullscreenStatus.setText("Ошибка · повторить →");activeMediaLabel.setText("Ошибка загрузки · повторить →");activeMediaLabel.setContentDescription("Не удалось загрузить продолжение. Нажмите вправо, чтобы повторить.");}return;}continueNavigation(request);};
            source.loadedCallback=navigationCallback;if(!source.loading)load(source,false);if(!source.loading&&navigationCallback!=null&&source.loadedCallback==navigationCallback)navigationCallback.run();return;
        }
        // A confirmed boundary is quiet. Loading and a failed request are never treated as an end.
        finishNavigation(request);
    }
    private void clearNavigationWait(){if(navigationSource!=null&&navigationSource.loadedCallback==navigationCallback)navigationSource.loadedCallback=navigationOldCallback;navigationSource=null;navigationCallback=null;navigationOldCallback=null;}
    private void setNavigationLoading(){if(activeMediaLabel!=null){if(activeFullscreenStatus!=null)activeFullscreenStatus.setText("Загрузка…");activeMediaLabel.setText("Загрузка…");activeMediaLabel.setContentDescription("Подготовка следующей иллюстрации");}}
    private void finishNavigation(NavigationRequest request){
        if(request==null||navigating!=request)return;clearNavigationWait();images.cancelPreparation(navigationPreview);navigationPreview=null;navigating=null;updateMediaLabel();main.post(this::drainNavigation);
    }
    private void prepareNavigation(NavigationRequest request,Post target,int index,boolean variant){
        Post previous=activePost;Gallery context=activeGallery;
        String preview=index==0?target.preview:target.media.get(index);
        Runnable ready=()->{
            if(!navigationAlive(request)||activePost!=previous||activeGallery!=context){finishNavigation(request);return;}
            navigationPreview=null;
            if(variant){
                if(request.arrived==null)animateMediaTurn(target,index,request.delta);
                else{chooseMedia(target,index);request.arrived.run();if(pageAnimator==null)finishNavigation(request);}
            }else{
                navigationRendering=true;transitionDirection=request.arrived==null?request.delta:0;
                int top=detailList!=null&&detailList.getFirstVisiblePosition()==0&&detailList.getChildAt(0)!=null?detailList.getChildAt(0).getTop():0;
                try{renderDetail(target,false,0,top,null,context);if(detailList!=null)detailList.setSelectionFromTop(0,top);if(index>0)chooseMedia(target,index);}finally{navigationRendering=false;transitionDirection=0;}
                if(activePost!=target){finishNavigation(request);return;}
                if(request.arrived!=null){request.arrived.run();if(pageAnimator==null)finishNavigation(request);}
            }
        };
        String full=index==0?(target.image.isBlank()?target.preview:target.image):target.media.get(index);
        if(mediaPost(target,index).isVideo()||images.hasBitmap(preview,720)||images.hasBitmap(full,720)||images.hasBitmap(full,2000)||images.hasBitmap(full,2400)){ready.run();return;}
        setNavigationLoading();navigationPreview=images.prepare(preview,720,success->{
            if(!navigationAlive(request))return;
            if(success){ready.run();return;}
            if(!full.equals(preview)&&CatalogLogic.isMediaUrl(full))navigationPreview=images.prepare(full,720,fallback->{if(!navigationAlive(request))return;if(fallback)ready.run();else navigationImageFailed(request);});
            else navigationImageFailed(request);
        });
    }
    private void navigationImageFailed(NavigationRequest request){navigationQueue.clear();finishNavigation(request);if(activeMediaLabel!=null){if(activeFullscreenStatus!=null)activeFullscreenStatus.setText("Ошибка · повторить →");activeMediaLabel.setText("Ошибка изображения · повторить →");activeMediaLabel.setContentDescription("Не удалось подготовить изображение. Повторите перелистывание.");}}
    private void animateMediaTurn(Post target,int index,int direction){
        ImageView next=activeArt;if(next==null||!(next.getParent() instanceof FrameLayout)){chooseMedia(target,index);finishNavigation(navigating);return;}
        FrameLayout parent=(FrameLayout)next.getParent();ImageView previous=new ImageView(this);previous.setScaleType(next.getScaleType());previous.setImageDrawable(next.getDrawable());previous.setImageMatrix(next.getImageMatrix());outgoingMedia=previous;
        parent.addView(previous,1,new FrameLayout.LayoutParams(-1,-1));chooseMedia(target,index);
        animateTurn(previous,next,direction,()->{parent.removeView(previous);previous.setImageDrawable(null);outgoingMedia=null;});
    }
    private void applyGallerySequence(Post current,Gallery context,List<Post> sequence,int revision){
        String selected=current.media.isEmpty()?current.image:current.media.get(Math.min(activeMediaIndex,current.media.size()-1));
        context.posts.clear();context.posts.addAll(sequence);context.syncedRevision=revision;
        for(Post equivalent:sequence)if(equivalent.key().equals(current.key())||equivalent.memberKeys.contains(current.key())){
            if(CatalogLogic.updateGalleryMedia(current,equivalent)){activeMediaIndex=Math.max(0,current.media.indexOf(selected));updateMediaLabel();store.openWork(current);}
            break;
        }
    }
    private Post mediaPost(Post p,int index){if(index<=0||index>=p.media.size())return p;Post media=Post.fromJson(p.toJson());media.image=p.media.get(index);media.original=media.image;media.media=new ArrayList<>(List.of(media.image));for(int i=0;i<p.imageRecords.length();i++){JSONObject record=p.imageRecords.optJSONObject(i);if(record!=null&&record.optString("url").equals(media.image)&&record.optString("source").equals("sankaku")&&CatalogLogic.validId("sankaku",record.optString("id"))){media.source="sankaku";media.id=record.optString("id");media.hash=record.optString("hash");media.imageRecords=new JSONArray().put(record);break;}}return media;}
    private void updateMediaLabel(){if(activeFullscreenStatus!=null)activeFullscreenStatus.setText("");if(activePost==null||activeMediaLabel==null)return;activeMediaLabel.setText(activePost.media.size()>1?(activeMediaIndex+1)+" / "+activePost.media.size():"");activeMediaLabel.setContentDescription(activePost.media.size()>1?"Вариант "+(activeMediaIndex+1)+" из "+activePost.media.size():"");}
    private void chooseMedia(Post p,int index){if(activePost!=p||activeArt==null||index<0||index>=p.media.size())return;activeMediaIndex=index;updateMediaLabel();Post media=mediaPost(p,index);if(media.isVideo()){images.cancel(activeArt);activeArt.setImageResource(android.R.drawable.ic_media_play);activeArt.setOnClickListener(v->video(media));}else{images.bindProgressive(activeArt,p.preview,index==0?(p.image.isBlank()?p.preview:p.image):p.media.get(index),2000,0,null);activeArt.setOnClickListener(v->fullscreenMedia(p,index));}}
    private void addAttribution(LinearLayout info,Post p){
        String priority=store.prefs.getString("attributionPriority","creator");if(priority.equals("original")&&!p.originalUrl.isBlank())menuRow(info,"share","Исходная публикация · "+Uri.parse(p.originalUrl).getHost(),()->external(p.originalUrl));if(priority.equals("uploader")&&!p.uploaderName.isBlank())menuRow(info,"profile","Загрузчик · "+p.uploaderName,()->uploader(p));
        List<String> authors=p.artistTags.isEmpty()?(p.artistTag.isBlank()?List.of():List.of(p.artistTag)):p.artistTags;
        if(authors.isEmpty()){TextView unknown=text("Автор не указан",15,MUTED);unknown.setPadding(0,dp(20),0,dp(12));info.addView(unknown);}else for(String tag:authors){LinearLayout author=row();author.setPadding(0,dp(18),0,dp(14));TextView avatar=text(tag.substring(0,1).toUpperCase(Locale.ROOT),21,TEXT);avatar.setGravity(Gravity.CENTER);avatar.setBackground(rounded(sourceColor(p.source),28));avatar.setOnClickListener(v->authorProfile(tag));author.addView(avatar,new LinearLayout.LayoutParams(dp(44),dp(44)));LinearLayout identity=column();identity.setPadding(dp(12),0,dp(6),0);TextView name=text(tag.equals(p.artistTag)?p.artist:tag.replace('_',' '),15,TEXT);name.setTypeface(null,Typeface.BOLD);name.setMaxLines(2);identity.addView(name);identity.addView(text("Художник · открыть профиль",11,MUTED));identity.setContentDescription("Профиль художника "+tag);identity.setOnClickListener(v->authorProfile(tag));author.addView(identity,new LinearLayout.LayoutParams(0,-2,1));TextView follow=button(store.following(tag)?"Вы подписаны":"Подписаться",BLUE,()->{});follow.setTextSize(12);follow.setPadding(dp(10),0,dp(10),0);follow.setOnClickListener(v->{store.toggleFollow(tag);follow.setText(store.following(tag)?"Вы подписаны":"Подписаться");screens[2]=null;});author.addView(follow);info.addView(author);}
        if(!p.originalUrl.isBlank()&&!priority.equals("original"))menuRow(info,"share","Исходная публикация",()->external(p.originalUrl));if(!p.uploaderName.isBlank()&&!priority.equals("uploader"))menuRow(info,"profile","Загрузчик · "+p.uploaderName,()->uploader(p));
    }
    private void uploader(Post p){String url=p.source.equals("sankaku")?"https://sankaku.app/?tab=explore&tags="+CatalogClient.encode("user:"+p.uploaderName):p.source.equals("danbooru")?"https://danbooru.donmai.us/users/"+p.uploaderId:p.source.equals("gelbooru")?"https://gelbooru.com/index.php?page=account&s=profile&uname="+CatalogClient.encode(p.uploaderName):"https://rule34.xxx/index.php?page=account&s=profile&uname="+CatalogClient.encode(p.uploaderName);external(url);}
    private void authorProfile(String tag){renderAuthor(tag,true,null,0,0);}
    private void renderAuthor(String tag,boolean pushPage,ScreenState cached,int first,int top){
        LinearLayout page=column();LinearLayout bar=toolbar("Художник",this::goBack);bar.addView(iconButton("bookmark","Открытые работы",this::openWorks),new LinearLayout.LayoutParams(dp(48),dp(48)));page.addView(bar);FeedListView list=new FeedListView(this);list.setRecyclerListener(this::recycleImages);list.setRestoreListener(this::restoreCards);list.setVerticalScrollBarEnabled(false);page.addView(list,new LinearLayout.LayoutParams(-1,0,1));LinearLayout header=column();header.setPadding(dp(16),dp(18),dp(16),dp(14));TextView name=text(tag.replace('_',' '),23,TEXT);name.setTypeface(null,Typeface.BOLD);header.addView(name);TextView subtitle=text("Художник · "+(rating.equals("general")?"Обычные работы":rating.equals("explicit")?"Работы 18+":"Все рейтинги")+"\nВо всех подключённых источниках",13,MUTED);subtitle.setPadding(0,dp(8),0,dp(16));header.addView(subtitle);TextView follow=button(store.following(tag)?"Вы подписаны":"Подписаться",BLUE,()->{});follow.setOnClickListener(v->{store.toggleFollow(tag);follow.setText(store.following(tag)?"Вы подписаны":"Подписаться");screens[2]=null;});header.addView(follow,new LinearLayout.LayoutParams(-1,dp(46)));header.addView(section("Иллюстрации","new",BLUE));list.addHeaderView(header,null,false);Screen screen=new Screen(6);screen.restoreRow=first;screen.restoreTop=top;screen.query=tag;screen.view=page;screen.list=list;screen.status=text("",13,MUTED);screen.status.setGravity(Gravity.CENTER);screen.status.setPadding(dp(16),dp(18),dp(16),dp(24));screen.status.setOnClickListener(v->load(screen,!screen.loaded));list.addFooterView(screen.status,null,false);screen.adapter=new FeedAdapter(screen);list.setAdapter(screen.adapter);
        if(pushPage)push(page);else{stopDetail();activePost=null;display(page);}authorTag=tag;activeAuthor=screen;
        if(cached!=null&&cached.loaded){screen.posts.addAll(cached.posts);screen.fingerprints.addAll(cached.fingerprints);screen.pages.putAll(cached.pages);screen.loaded=true;screen.more=cached.more;screen.failed=cached.failed;screen.authBlocked=cached.authBlocked;screen.authRequired.addAll(cached.authRequired);screen.accessNotice=cached.accessNotice;screen.adapter.notifyDataSetChanged();updateStatus(screen);}else load(screen,true);
        list.setOnScrollListener(new FeedListView.ScrollListener(){public void onScrollStateChanged(FeedListView v,int state){if(state==SCROLL_STATE_TOUCH_SCROLL)screen.restoreRow=-1;}public void onScroll(FeedListView v,int pos,int visible,int total){prefetchCards(screen,Math.max(0,pos-1));if(currentView==page&&screen.loaded&&!screen.loading&&!screen.failed&&screen.more&&needsPage(screen))load(screen,false);}});
    }
    private void openWorks(){
        Dialog dialog=new Dialog(this);LinearLayout sheet=column();sheet.setPadding(dp(16),dp(16),dp(16),dp(16));sheet.setBackgroundColor(PANEL);sheet.addView(text("Открытые работы",20,TEXT));EditText search=new EditText(this);search.setSingleLine(true);search.setTextColor(TEXT);search.setHintTextColor(MUTED);search.setHint("Найти открытую работу");sheet.addView(search);ScrollView scroll=new ScrollView(this);LinearLayout entries=column();scroll.addView(entries);sheet.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));Runnable fill=()->{entries.removeAllViews();for(Post post:store.openWorks()){if(!post.title.toLowerCase(Locale.ROOT).contains(search.getText().toString().toLowerCase(Locale.ROOT)))continue;LinearLayout row=row();TextView title=text(post.title,14,TEXT);title.setMaxLines(2);title.setPadding(dp(4),dp(8),dp(4),dp(8));title.setOnClickListener(v->{dialog.dismiss();openArtwork(post,new Gallery(store.openWorks(),null));});row.addView(title,new LinearLayout.LayoutParams(0,dp(56),1));row.addView(button(store.pinned(post)?"★":"☆",BLUE,()->{store.pin(post);dialog.dismiss();openWorks();}),new LinearLayout.LayoutParams(dp(52),dp(44)));if(!store.pinned(post))row.addView(button("×",MUTED,()->{store.closeWork(post);dialog.dismiss();openWorks();}),new LinearLayout.LayoutParams(dp(44),dp(44)));entries.addView(row);}};search.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int start,int count,int after){}public void onTextChanged(CharSequence s,int start,int before,int count){fill.run();}public void afterTextChanged(Editable e){}});fill.run();sheet.addView(button("Готово",BLUE,dialog::dismiss));dialog.setContentView(sheet);dialog.show();Window w=dialog.getWindow();if(w!=null)w.setLayout(-1,(int)(getResources().getDisplayMetrics().heightPixels*.72));
    }
    private void fullscreen(Post p){fullscreenMedia(p,activeMediaIndex);}
    private void viewerInsets(FrameLayout frame){frame.setOnApplyWindowInsetsListener((v,insets)->{
        if(Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());frame.setPadding(bars.left,bars.top,bars.right,bars.bottom);}
        else frame.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;
    });frame.requestApplyInsets();}
    private void withSankakuMedia(Post post,java.util.function.Consumer<Post> action){
        if(!post.source.equals("sankaku")){action.accept(post);return;}int generation=navigationGeneration;View view=currentView;toast("Проверка доступа Sankaku…");
        submitNetwork(()->{try{Post fresh=Post.fromJson(post.toJson());client.enrich(fresh);main.post(()->{if(destroyed||currentView!=view||navigationGeneration!=generation)return;CatalogLogic.refreshSignedMedia(post,fresh);if(activePost!=null){CatalogLogic.refreshSignedMedia(activePost,fresh);store.refreshCachedPost(activePost);}action.accept(fresh);});}
        catch(SankakuApi.AccessException error){main.post(()->{if(!destroyed&&currentView==view)accessPrompt(error);});}
        catch(Exception error){main.post(()->{if(!destroyed&&currentView==view)toast("Не удалось загрузить работу Sankaku. Повторите позже.");});}});
    }
    private void fullscreenMedia(Post p,int mediaIndex){withSankakuMedia(mediaPost(p,mediaIndex),fresh->{CatalogLogic.refreshSignedMedia(p,fresh);fullscreenMediaReady(p,mediaIndex);});}
    private void fullscreenMediaReady(Post p,int mediaIndex){
        Post selectedMedia=mediaPost(p,mediaIndex);if(selectedMedia.isVideo()){videoReady(selectedMedia);return;}Dialog dialog=new Dialog(this,android.R.style.Theme_Material_NoActionBar_Fullscreen);ArtworkContent frame=new ArtworkContent();fullscreenContent=frame;frame.setBackgroundColor(Color.BLACK);viewerInsets(frame);ZoomImageView image=new ZoomImageView(this);frame.addView(image,new FrameLayout.LayoutParams(-1,-1));String url=mediaIndex==0?(p.original.isBlank()?p.image:p.original):p.media.get(mediaIndex);images.bindProgressive(image,p.preview,url,2400,0,()->image.post(image::fit));
        Runnable previous=()->navigate(-1,()->turnFullscreen(image,frame,-1),dialog::isShowing);Runnable next=()->navigate(1,()->turnFullscreen(image,frame,1),dialog::isShowing);image.onPrevious=previous;image.onNext=next;LinearLayout bar=row();bar.setPadding(dp(8),dp(16),dp(8),0);bar.addView(iconButton("back","Закрыть просмотр",dialog::dismiss),new LinearLayout.LayoutParams(dp(48),dp(48)));bar.addView(new Space(this),new LinearLayout.LayoutParams(0,1,1));bar.addView(iconButton("download","Скачать оригинал",()->download(activePost)),new LinearLayout.LayoutParams(dp(48),dp(48)));frame.addView(bar,new FrameLayout.LayoutParams(-1,dp(72),Gravity.TOP));LinearLayout pager=row();pager.setPadding(dp(8),0,dp(8),dp(18));pager.addView(iconButton("back","Предыдущая иллюстрация",previous),new LinearLayout.LayoutParams(dp(52),dp(52)));activeFullscreenStatus=text("",12,TEXT);activeFullscreenStatus.setGravity(Gravity.CENTER);pager.addView(activeFullscreenStatus,new LinearLayout.LayoutParams(0,dp(44),1));pager.addView(iconButton("next","Следующая иллюстрация",next),new LinearLayout.LayoutParams(dp(52),dp(52)));frame.addView(pager,new FrameLayout.LayoutParams(-1,dp(76),Gravity.BOTTOM));frame.viewerPager(pager.getChildAt(0),pager.getChildAt(pager.getChildCount()-1),previous,next);dialog.setContentView(frame);dialog.setOnDismissListener(v->{frame.cancelTap();fullscreenContent=null;activeFullscreenStatus=null;cancelNavigation();images.cancel(image);});dialog.show();
    }
    private void turnFullscreen(ZoomImageView image,FrameLayout parent,int direction){
        Post p=activePost;int index=activeMediaIndex;if(p==null){finishNavigation(navigating);return;}
        ImageView previous=new ImageView(this);previous.setScaleType(image.getScaleType());previous.setImageDrawable(image.getDrawable());previous.setImageMatrix(image.getImageMatrix());outgoingMedia=previous;parent.addView(previous,1,new FrameLayout.LayoutParams(-1,-1));
        Post media=mediaPost(p,index);if(media.isVideo()){images.cancel(image);image.setScaleType(ImageView.ScaleType.FIT_CENTER);image.setImageResource(android.R.drawable.ic_media_play);image.setOnClickListener(v->video(media));}
        else{image.setScaleType(ImageView.ScaleType.MATRIX);image.setOnClickListener(null);String url=index==0?(p.original.isBlank()?p.image:p.original):p.media.get(index);images.bindProgressive(image,p.preview,url,2400,0,()->image.post(image::fit));image.fit();}
        image.setContentDescription("Иллюстрация #"+p.id+" · вариант "+(index+1)+" из "+p.media.size()+". Масштабирование двумя пальцами или двойным нажатием.");
        animateTurn(previous,image,direction,()->{parent.removeView(previous);previous.setImageDrawable(null);outgoingMedia=null;});
    }
    private void video(Post p){withSankakuMedia(p,this::videoReady);}
    private void videoReady(Post p){if(!CatalogLogic.isMediaUrl(p.image)){toast("Видео недоступно");return;}Dialog dialog=new Dialog(this,android.R.style.Theme_Material_NoActionBar_Fullscreen);FrameLayout frame=new FrameLayout(this);frame.setBackgroundColor(Color.BLACK);viewerInsets(frame);VideoView video=new VideoView(this);FrameLayout.LayoutParams vp=new FrameLayout.LayoutParams(-1,-1,Gravity.CENTER);frame.addView(video,vp);MediaController controller=new MediaController(this);controller.setAnchorView(video);video.setMediaController(controller);video.setVideoURI(Uri.parse(p.image),Map.of("Referer",CatalogLogic.mediaReferer(p.image)));video.setOnPreparedListener(player->{player.setLooping(true);video.start();});video.setOnErrorListener((player,what,extra)->{toast("Этот формат видео не поддерживается устройством");return true;});FrameLayout close=iconButton("back","Закрыть видео",dialog::dismiss);frame.addView(close,new FrameLayout.LayoutParams(dp(52),dp(52),Gravity.TOP|Gravity.LEFT));dialog.setContentView(frame);dialog.setOnDismissListener(v->video.stopPlayback());dialog.show();}
    private void refreshCards(){if(currentView!=null)updateCardHearts(currentView);}
    private void updateCardHearts(View view){if(view instanceof Card)((Card)view).updateSaved();if(view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++)updateCardHearts(((ViewGroup)view).getChildAt(i));}
    private void share(Post p){Intent send=new Intent(Intent.ACTION_SEND);send.setType("text/plain");send.putExtra(Intent.EXTRA_TEXT,p.sourceUrl);startActivity(Intent.createChooser(send,"Поделиться иллюстрацией"));}
    private void external(String url){try{Uri uri=Uri.parse(url);if(!"https".equals(uri.getScheme())){toast("Неподдерживаемая ссылка");return;}startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(ActivityNotFoundException e){toast("На устройстве не установлен браузер");}}
    private void download(Post p){withSankakuMedia(p==activePost?mediaPost(p,activeMediaIndex):p,this::downloadReady);}
    private void downloadReady(Post p){String url=p.original.isBlank()?p.image:p.original;if(!CatalogLogic.isMediaUrl(url)){toast("Оригинал недоступен");return;}pendingDownload=url;String path=Uri.parse(url).getPath();String ext=path!=null&&path.contains(".")?path.substring(path.lastIndexOf('.')):".jpg";if(ext.length()>6)ext=".jpg";Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType(p.isVideo()?"video/*":"image/*");intent.putExtra(Intent.EXTRA_TITLE,"ArtCatalog-"+p.source+"-"+p.id+ext);startActivityForResult(intent,3);}
    private void exportData(){Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("application/json");intent.putExtra(Intent.EXTRA_TITLE,"ArtCatalog-profile.json");startActivityForResult(intent,1);}
    private void importData(){Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("*/*");intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"application/json","text/plain"});startActivityForResult(intent,2);}
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(result!=RESULT_OK||data==null||data.getData()==null)return;if(store==null){pendingDocument=data.getData();pendingDocumentRequest=request;return;}processDocument(request,data.getData());}
    private void processDocument(int request,Uri uri){String url=pendingDownload;io.execute(()->{try{
        if(request==1){String json=store.export().toString(2);try(OutputStream out=getContentResolver().openOutputStream(uri)){if(out==null)throw new IOException();out.write(json.getBytes(StandardCharsets.UTF_8));}main.post(()->toast("Профиль экспортирован"));}
        else if(request==2){String json;try(InputStream in=getContentResolver().openInputStream(uri);ByteArrayOutputStream out=new ByteArrayOutputStream()){if(in==null)throw new IOException();byte[] b=new byte[8192];int n,total=0;while((n=in.read(b))!=-1){total+=n;if(total>20*1024*1024)throw new IOException("Файл слишком большой");out.write(b,0,n);}json=out.toString(StandardCharsets.UTF_8.name());}int count=store.importJson(json);main.post(()->{if(destroyed)return;invalidateScreens();selectNav(3);toast("Добавлено закладок: "+count);});}
        else if(request==3&&CatalogLogic.isMediaUrl(url)){java.net.HttpURLConnection connection=CatalogClient.open(url);connection.setRequestProperty("Accept-Encoding","identity");try{if(connection.getResponseCode()!=200)throw new IOException("Оригинал недоступен");try(InputStream in=connection.getInputStream();OutputStream out=getContentResolver().openOutputStream(uri)){if(out==null)throw new IOException();byte[] b=new byte[32768];int n;long total=0;while((n=in.read(b))!=-1){total+=n;if(total>512L*1024*1024)throw new IOException("Файл слишком большой");out.write(b,0,n);}}main.post(()->toast("Оригинал сохранён"));}finally{connection.disconnect();}}
    }catch(Exception e){main.post(()->toast("Не удалось выполнить действие. Проверьте файл и подключение."));}});}
    private String sourceName(String source){return switch(source){case "gelbooru"->"Gelbooru";case "rule34"->"Rule34";case "sankaku"->"Sankaku";default->"Danbooru";};}
    private int sourceColor(String source){return switch(source){case "gelbooru"->Color.rgb(111,196,174);case "rule34"->Color.rgb(153,190,89);case "sankaku"->Color.rgb(240,157,66);default->BLUE;};}
    private void toast(String message){if(!destroyed)Toast.makeText(this,message,Toast.LENGTH_SHORT).show();}
    private void goBack(){hideKeyboard();stopDetail();detachScreen(activeAuthor);activeAuthor=null;authorTag="";if(!backStack.isEmpty()){BackEntry entry=backStack.pop();nav=entry.nav;buildBottom();if(entry.detail!=null){renderDetail(entry.detail,false,entry.scroll,entry.top,entry.related,entry.gallery);if(activePost!=null&&entry.mediaIndex<activePost.media.size())chooseMedia(activePost,entry.mediaIndex);}else if(entry.author!=null)renderAuthor(entry.author,false,entry.related,entry.scroll,entry.top);else{activePost=null;activeGallery=null;display(entry.view);for(Screen s:screens)if(s!=null&&s.view==entry.view&&!s.loaded&&s.tab!=3){if(s.tab==1&&s.query.isBlank())loadExplore(s);else load(s,true);break;}}refreshCards();}else selectNav(nav);}
    @Override public void onBackPressed(){if(!backStack.isEmpty()||activePost!=null||!authorTag.isBlank())goBack();else if(nav!=0)selectNav(0);else super.onBackPressed();}
    private Bundle readNavigationState(Bundle supplied){if(supplied==null)return null;String token=supplied.getString("navigationState","");if(!token.matches("[a-f0-9-]{36}\\.bin"))return supplied;File file=new File(new File(getFilesDir(),"navigation"),token);Parcel parcel=Parcel.obtain();try{if(file.length()>16*1024*1024)return supplied;byte[] bytes;try(InputStream input=new FileInputStream(file);ByteArrayOutputStream buffer=new ByteArrayOutputStream()){byte[] chunk=new byte[8192];int count;while((count=input.read(chunk))!=-1){if(buffer.size()+count>16*1024*1024)throw new IOException("Navigation state too large");buffer.write(chunk,0,count);}bytes=buffer.toByteArray();}parcel.unmarshall(bytes,0,bytes.length);parcel.setDataPosition(0);Bundle state=parcel.readBundle(getClassLoader());file.delete();return state==null?supplied:state;}catch(Exception ignored){return supplied;}finally{parcel.recycle();}}
    private void writeNavigationState(Bundle out){Parcel parcel=Parcel.obtain();File directory=new File(getFilesDir(),"navigation");directory.mkdirs();String token=UUID.randomUUID()+".bin";File file=new File(directory,token);try{parcel.writeBundle(out);byte[] bytes=parcel.marshall();try(OutputStream output=new FileOutputStream(file)){output.write(bytes);}out.clear();out.putInt("nav",nav);out.putString("navigationState",token);File[] old=directory.listFiles();if(old!=null&&old.length>4){Arrays.sort(old,Comparator.comparingLong(File::lastModified).reversed());for(int i=4;i<old.length;i++)old[i].delete();}}catch(Exception ignored){file.delete();out.remove("galleryRoute");out.remove("backStack");}finally{parcel.recycle();}}
    @Override public void onSaveInstanceState(Bundle out){
        super.onSaveInstanceState(out);out.putInt("nav",nav);
        for(int i=0;i<screens.length;i++){Screen s=screens[i];if(s==null)continue;Bundle state=new Bundle();state.putString("query",s.query);state.putString("order",s.order);state.putInt("homeTab",s.homeTab);state.putBoolean("following",s.followingMode);state.putInt("first",s.list.getFirstVisiblePosition());View first=s.list.getChildAt(0);state.putInt("top",first==null?0:first.getTop());if(i==1&&searchInput!=null)state.putString("input",searchInput.getText().toString());out.putBundle("screen"+i,state);}
        if(activePost!=null){out.putString("detail",activePost.toJson().toString());out.putBundle("galleryRoute",galleryBundle(activeGallery,activePost));out.putInt("mediaIndex",activeMediaIndex);if(detailList!=null){out.putInt("detailScroll",detailList.getFirstVisiblePosition());View first=detailList.getChildAt(0);out.putInt("detailTop",first==null?0:first.getTop());}}
        if(!authorTag.isBlank()&&activeAuthor!=null&&activeAuthor.list!=null){out.putString("author",authorTag);out.putInt("authorFirst",activeAuthor.list.getFirstVisiblePosition());View first=activeAuthor.list.getChildAt(0);out.putInt("authorTop",first==null?0:first.getTop());}
        ArrayList<Bundle> entries=new ArrayList<>();for(BackEntry entry:backStack){Bundle item=new Bundle();item.putInt("nav",entry.nav);item.putInt("scroll",entry.scroll);item.putInt("top",entry.top);item.putInt("mediaIndex",entry.mediaIndex);if(entry.gallery!=null)item.putBundle("galleryRoute",galleryBundle(entry.gallery,entry.detail));if(entry.detail!=null)item.putString("detail",entry.detail.toJson().toString());else if(entry.author!=null)item.putString("author",entry.author);else{for(Screen s:screens)if(s!=null&&s.view==entry.view)item.putInt("tab",s.tab);}entries.add(item);}out.putParcelableArrayList("backStack",entries);
        if(pendingDownload!=null)out.putString("download",pendingDownload);if(pendingDocument!=null){out.putString("pendingDocument",pendingDocument.toString());out.putInt("pendingDocumentRequest",pendingDocumentRequest);}
        writeNavigationState(out);
    }
    @Override public Object onRetainNonConfigurationInstance(){RetainedState state=new RetainedState();state.screens=new ScreenState[4];for(int i=0;i<screens.length;i++)state.screens[i]=snapshot(screens[i]);state.detail=snapshot(activeRelated);state.author=snapshot(activeAuthor);state.gallery=snapshotGallery(activeGallery);for(BackEntry entry:backStack){state.backs.add(entry.related);state.backGalleries.add(snapshotGallery(entry.gallery));}return state;}
    @Override public void onTrimMemory(int level){super.onTrimMemory(level);if(images!=null&&level>=TRIM_MEMORY_RUNNING_LOW){images.clearMemory();prefetchScreen=null;}}
    @Override public void onDestroy(){destroyed=true;cancelNavigation();main.removeCallbacksAndMessages(null);work.shutdownNow();grouping.shutdownNow();io.shutdown();if(client!=null)client.close();if(images!=null)images.close();super.onDestroy();}
}
