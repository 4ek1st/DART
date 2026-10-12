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
    private int BG=Color.rgb(18,18,18),PANEL=Color.rgb(32,32,32),RAISED=Color.rgb(48,48,48),
        LINE=Color.rgb(58,58,58),TEXT=Color.rgb(243,243,243),MUTED=Color.rgb(161,161,161),
        BLUE=Color.rgb(45,156,255),PINK=Color.rgb(250,142,154);
    private boolean lightPalette;
    private void applyAppearance(String choice){
        boolean systemLight=(getResources().getConfiguration().uiMode&android.content.res.Configuration.UI_MODE_NIGHT_MASK)!=android.content.res.Configuration.UI_MODE_NIGHT_YES;
        lightPalette=choice.equals("light")||choice.equals("system")&&systemLight;
        if(lightPalette){BG=Color.rgb(246,247,248);PANEL=Color.WHITE;RAISED=Color.rgb(239,243,246);LINE=Color.rgb(204,213,221);TEXT=Color.rgb(32,40,49);MUTED=Color.rgb(82,97,110);BLUE=Color.rgb(23,107,176);PINK=Color.rgb(188,60,91);}
        else if(choice.equals("list")){BG=Color.rgb(27,32,35);PANEL=Color.rgb(41,47,50);RAISED=Color.rgb(48,55,58);LINE=Color.rgb(89,103,109);TEXT=Color.rgb(240,241,239);MUTED=Color.rgb(174,190,197);BLUE=Color.rgb(156,199,218);PINK=Color.rgb(250,142,154);}
        else{BG=Color.rgb(18,18,18);PANEL=Color.rgb(32,32,32);RAISED=Color.rgb(48,48,48);LINE=Color.rgb(58,58,58);TEXT=Color.rgb(243,243,243);MUTED=Color.rgb(161,161,161);BLUE=Color.rgb(45,156,255);PINK=Color.rgb(250,142,154);}
    }
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
    private int activeMediaIndex;private ImageView activeArt;private LinearLayout activeMediaStrip;
    private List<DetailMediaFrame> activeMediaFrames=new ArrayList<>();private int detailMediaHeight;
    private TextView activeMediaLabel,activeFullscreenStatus,activeLikeButton;
    private static final class DetailMediaFrame {
        final FrameLayout frame;final ImageView image;final int index;String url;boolean bound;
        DetailMediaFrame(FrameLayout frame,ImageView image,int index,String url,boolean bound){this.frame=frame;this.image=image;this.index=index;this.url=url;this.bound=bound;}
    }
    private final ArrayDeque<NavigationRequest> navigationQueue=new ArrayDeque<>();
    private NavigationRequest navigating;private ImageLoader.Ticket navigationPreview;
    private Screen navigationSource;private Runnable navigationCallback,navigationOldCallback;
    private int transitionDirection;private boolean navigationRendering;private AnimatorSet pageAnimator;private View outgoingPage,turnTarget;
    private ImageView outgoingMedia;
    private final class NavigationRequest {
        final int delta;final Runnable arrived;final java.util.function.BooleanSupplier alive;
        NavigationRequest(int delta,Runnable arrived,java.util.function.BooleanSupplier alive){this.delta=delta;this.arrived=arrived;this.alive=alive;}
    }
    private boolean regroupScheduled;private Screen prefetchScreen;private int prefetchFirst=-1,prefetchEnd=-1,prefetchRevision=-1,prefetchCount=-1;private long prefetchTime;
    private void scheduleRegroup(){if(regroupScheduled)return;regroupScheduled=true;main.postDelayed(()->{regroupScheduled=false;if(destroyed)return;List<Screen> affected=new ArrayList<>(Arrays.asList(screens));affected.add(activeRelated);affected.add(activeAuthor);for(Screen s:affected)if(s!=null&&!s.posts.isEmpty()){int revision=s.revision,generation=s.generation;List<Post> snapshot=new ArrayList<>(s.posts);grouping.execute(()->{List<Post> grouped=CatalogLogic.merge(snapshot,List.of());main.post(()->{if(destroyed||s.generation!=generation)return;if(s.revision!=revision){scheduleRegroup();return;}if(grouped.size()!=s.posts.size()){s.posts.clear();s.posts.addAll(screenVisible(s,grouped));s.revision++;if(s.adapter!=null)s.adapter.notifyDataSetChanged();}});});}},160);}
    private List<Post> screenVisible(Screen s,List<Post> posts){List<Post> visible=store.visible(posts,s.tab!=3&&s.tab!=6&&s.tab!=7);if(s.anchor!=null)visible=CatalogLogic.excludeSaved(visible,List.of(s.anchor));if(s.tab==0&&s.homeTab==0)visible=CatalogLogic.excludeSaved(visible,store.likes());return visible;}
    private void mergeAsync(Screen s,List<Post> base,List<Post> incoming,int generation,java.util.function.Consumer<List<Post>> apply){List<Post> first=new ArrayList<>(base),second=new ArrayList<>(incoming);long submission=++s.mergeSequence;grouping.execute(()->{if(destroyed||s.generation!=generation)return;filterMerged(s,CatalogLogic.merge(first,second),first,generation,submission,apply);});}
    private void filterMerged(Screen s,List<Post> merged,List<Post> base,int generation,long submission,java.util.function.Consumer<List<Post>> apply){
        long visibility=store.visibilityRevision();List<Post> visible=screenVisible(s,merged);
        Recommendations.Model model=s.recommendationModel;
        if(s.tab==0&&s.homeTab==0&&model!=null){
            Set<String> stableKeys=new HashSet<>();for(Post post:base)stableKeys.addAll(WorkGrouping.tokens(post));
            List<Post> stable=new ArrayList<>(),fresh=new ArrayList<>();
            for(Post post:visible){if(Collections.disjoint(stableKeys,WorkGrouping.tokens(post)))fresh.add(post);else stable.add(post);}
            List<Post> ranked=model.rank(fresh,stable,store.recentSuggestions());
            visible=new ArrayList<>(stable);visible.addAll(ranked);
        }
        List<Post> prepared=visible;
        main.post(()->{if(destroyed||s.generation!=generation||submission<s.appliedSequence)return;if(store.visibilityRevision()!=visibility){grouping.execute(()->filterMerged(s,merged,base,generation,submission,apply));return;}s.appliedSequence=submission;s.revision++;apply.accept(prepared);});
    }
    private final class Gallery {final List<Post> posts;final Screen source;int syncedRevision=-1,viewportWidth,viewportHeight;Gallery(List<Post> posts,Screen source){this.posts=new ArrayList<>(posts);this.source=source;}}
    private Bundle restored;
    private ScreenState[] retainedScreens;
    private RetainedState retainedState;
    private static final class RetainedState {ScreenState[] screens;ScreenState detail,author;GalleryState gallery;final List<ScreenState> backs=new ArrayList<>();final List<GalleryState> backGalleries=new ArrayList<>();}
    private static final class GalleryState {final List<Post> posts=new ArrayList<>();ScreenState source;int tab=-1;String query="",order="latest",scopedSource="";boolean following=true;Post anchor;}
    private static final class ScreenState {
        final List<Post> posts=new ArrayList<>();final Map<String,Integer> pages=new LinkedHashMap<>();final List<Job> jobs=new ArrayList<>();final Set<String> fingerprints=new HashSet<>(),unreadKeys=new HashSet<>();final Set<String> authRequired=new LinkedHashSet<>();String accessNotice="";boolean loaded,more,failed,authBlocked;
    }

    private static final class Job {
        String query;Map<String,Integer> pages;
        Job(String query,Map<String,Integer> pages){this.query=query;this.pages=pages;}
    }
    private final class Screen {
        final int tab;View view;FeedListView list;FeedAdapter adapter;
        final List<Post> posts=new ArrayList<>();final ArrayDeque<Job> jobs=new ArrayDeque<>();
        final Map<String,Integer> pages=new LinkedHashMap<>();
        final Set<String> fingerprints=new HashSet<>(),unreadKeys=new HashSet<>(),authRequired=new LinkedHashSet<>();String accessNotice="";
        String query="",order="latest",scopedSource="";volatile int generation;int homeTab,revision,restoreRow=-1,restoreTop;boolean loading,loaded,failed,authBlocked,more=true;Post anchor;Runnable loadedCallback;
        TextView status,rankingLabel;LinearLayout ranking,artistWorks;List<Post> pendingRanking,pendingArtistWorks;String pendingRankingLabel;Gallery pendingRankingGallery,exploreGallery,pendingArtistGallery;boolean followingMode=true;String exploreMessage="";
        Future<?> task,rankTask;long mergeSequence,appliedSequence;volatile Recommendations.Model recommendationModel;
        Screen(int tab){this.tab=tab;}
    }

    @Override public void onCreate(Bundle supplied){
        Bundle saved=readNavigationState(supplied);
        super.onCreate(saved);restored=saved;Object retained=getLastNonConfigurationInstance();if(retained instanceof RetainedState){retainedState=(RetainedState)retained;retainedScreens=retainedState.screens;}
        SharedPreferences appearance=getSharedPreferences("settings",MODE_PRIVATE);applyAppearance(appearance.getString("themePreference","dark"));
        if(appearance.getBoolean("secureCapture",false))getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        getWindow().setStatusBarColor(PANEL);getWindow().setNavigationBarColor(PANEL);
        if(saved!=null){pendingDownload=saved.getString("download");String document=saved.getString("pendingDocument");if(document!=null){pendingDocument=Uri.parse(document);pendingDocumentRequest=saved.getInt("pendingDocumentRequest");}}
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|
            (lightPalette?View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR:0));
        if(Build.VERSION.SDK_INT>=30)getWindow().setDecorFitsSystemWindows(false);
        root=column();root.setBackgroundColor(PANEL);content=new FrameLayout(this);content.setBackgroundColor(BG);
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
            if(saved!=null&&saved.containsKey("detail"))try{Gallery gallery=retainedState!=null?restoreGallery(retainedState.gallery):galleryFromBundle(saved.getBundle("galleryRoute"));renderDetail(Post.fromJson(new JSONObject(saved.getString("detail"))),false,saved.getInt("detailScroll"),saved.getInt("detailTop"),retainedState==null?null:retainedState.detail,gallery);if(activePost!=null&&saved.getInt("mediaIndex")<activePost.media.size())activeMediaIndex=Math.max(0,saved.getInt("mediaIndex"));}catch(Exception ignored){}
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
    private void settingsAction(LinearLayout body,String label,int color,Runnable action){LinearLayout.LayoutParams layout=new LinearLayout.LayoutParams(-1,dp(48));layout.setMargins(0,dp(7),0,dp(7));body.addView(button(label,color,action),layout);}
    private FrameLayout iconButton(String icon,String label,Runnable action){FrameLayout box=new FrameLayout(this);box.setContentDescription(label);box.setFocusable(true);touchBackground(box,Color.TRANSPARENT,8);box.addView(new IconView(this,icon,TEXT),new FrameLayout.LayoutParams(-1,-1));box.setOnClickListener(v->action.run());return box;}
    private FrameLayout artIconButton(String icon,String label,Runnable action){FrameLayout box=iconButton(icon,label,action);((IconView)box.getChildAt(0)).color(Color.WHITE);return box;}
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
        View previous=currentView;outgoingPage=previous;
        if(images!=null)images.cancelPrefetch();prefetchScreen=null;
        view.setVisibility(View.INVISIBLE);content.addView(view,new FrameLayout.LayoutParams(-1,-1));currentView=view;restoreCards(view);view.post(this::prepareVisibleContent);
        view.postOnAnimation(()->{
            if(currentView!=view||outgoingPage!=previous)return;
            float width=Math.max(content.getWidth(),getResources().getDisplayMetrics().widthPixels);
            view.setTranslationX(-direction*width);view.setVisibility(View.VISIBLE);
            animateTurn(previous,view,direction,()->{content.removeView(previous);releaseImages(previous);outgoingPage=null;});
        });
    }
    private void animateTurn(View previous,View next,int direction,Runnable cleanup){
        float width=Math.max(next.getWidth(),getResources().getDisplayMetrics().widthPixels);
        AnimatorSet animation=new AnimatorSet();pageAnimator=animation;turnTarget=next;
        animation.playTogether(ObjectAnimator.ofFloat(previous,View.TRANSLATION_X,0,direction*width),ObjectAnimator.ofFloat(next,View.TRANSLATION_X,-direction*width,0));
        animation.setDuration(ValueAnimator.areAnimatorsEnabled()?260:0);
        animation.setInterpolator(new android.view.animation.DecelerateInterpolator(1.5f));
        animation.addListener(new AnimatorListenerAdapter(){@Override public void onAnimationEnd(Animator ignored){if(pageAnimator!=animation)return;pageAnimator=null;turnTarget=null;next.setTranslationX(0);previous.setTranslationX(0);cleanup.run();finishNavigation(navigating);}});
        animation.start();
    }
    private void cancelNavigation(){
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
    private ScreenState snapshot(Screen s){if(s==null)return null;ScreenState state=new ScreenState();state.posts.addAll(s.posts);state.fingerprints.addAll(s.fingerprints);state.unreadKeys.addAll(s.unreadKeys);state.pages.putAll(s.pages);for(Job job:s.jobs)state.jobs.add(new Job(job.query,new LinkedHashMap<>(job.pages)));state.loaded=s.loaded||!s.posts.isEmpty();state.more=s.more;state.failed=s.failed;state.authBlocked=s.authBlocked;state.authRequired.addAll(s.authRequired);state.accessNotice=s.accessNotice;return state;}
    private GalleryState snapshotGallery(Gallery gallery){if(gallery==null)return null;GalleryState state=new GalleryState();state.posts.addAll(gallery.posts);if(gallery.source!=null){state.source=snapshot(gallery.source);state.tab=gallery.source.tab;state.query=gallery.source.query;state.order=gallery.source.order;state.scopedSource=gallery.source.scopedSource;state.following=gallery.source.followingMode;state.anchor=gallery.source.anchor;}return state;}
    private Gallery restoreGallery(GalleryState state){if(state==null)return null;Screen source=null;if(state.tab>=0&&state.tab<4){source=screens[state.tab];if(source==null){source=new Screen(state.tab);screens[state.tab]=source;initializeScreen(source);}}else if(state.source!=null){source=new Screen(state.tab);source.query=state.query;source.order=state.order;source.scopedSource=state.scopedSource;source.followingMode=state.following;source.anchor=state.anchor;source.posts.addAll(state.source.posts);source.fingerprints.addAll(state.source.fingerprints);source.unreadKeys.addAll(state.source.unreadKeys);source.pages.putAll(state.source.pages);source.jobs.addAll(state.source.jobs);source.loaded=state.source.loaded;source.more=state.source.more;source.failed=state.source.failed;}return new Gallery(state.posts,source);}
    private Gallery galleryFromJson(String json){List<Post> posts=new ArrayList<>();try{JSONArray array=new JSONArray(json);for(int i=0;i<array.length();i++)posts.add(Post.fromJson(array.getJSONObject(i)));}catch(Exception ignored){}return new Gallery(posts,null);}
    private Bundle galleryBundle(Gallery gallery,Post selected){Bundle data=new Bundle();JSONArray posts=new JSONArray();if(gallery!=null){for(Post p:gallery.source==null?gallery.posts:CatalogLogic.merge(gallery.posts,gallery.source.posts))posts.put(p.toJson());Screen source=gallery.source;if(source!=null){data.putInt("tab",source.tab);data.putString("query",source.query);data.putString("order",source.order);data.putString("scopedSource",source.scopedSource);data.putBoolean("following",source.followingMode);data.putBoolean("more",source.more);data.putString("pages",new JSONObject(source.pages).toString());data.putString("fingerprints",new JSONArray(source.fingerprints).toString());JSONArray jobs=new JSONArray();for(Job job:source.jobs)try{jobs.put(new JSONObject().put("query",job.query).put("pages",new JSONObject(job.pages)));}catch(JSONException ignored){}data.putString("jobs",jobs.toString());if(source.anchor!=null)data.putString("anchor",source.anchor.toJson().toString());}}data.putString("posts",posts.toString());return data;}
    private Map<String,Integer> pagesFromJson(JSONObject object){Map<String,Integer> pages=new LinkedHashMap<>();if(object!=null)for(String source:CatalogClient.SOURCES)if(object.has(source))pages.put(source,Math.max(0,object.optInt(source)));return pages;}
    private Gallery galleryFromBundle(Bundle data){if(data==null)return null;Gallery list=galleryFromJson(data.getString("posts","[]"));if(!data.containsKey("tab"))return list;Screen source=new Screen(data.getInt("tab"));source.query=data.getString("query","");source.order=data.getString("order","latest");source.scopedSource=data.getString("scopedSource","");source.followingMode=data.getBoolean("following",true);source.more=data.getBoolean("more");source.loaded=true;source.posts.addAll(list.posts);try{source.pages.putAll(pagesFromJson(new JSONObject(data.getString("pages","{}"))));JSONArray fingerprints=new JSONArray(data.getString("fingerprints","[]"));for(int i=0;i<fingerprints.length();i++)source.fingerprints.add(fingerprints.getString(i));JSONArray jobs=new JSONArray(data.getString("jobs","[]"));for(int i=0;i<jobs.length();i++){JSONObject job=jobs.getJSONObject(i);source.jobs.add(new Job(job.optString("query"),pagesFromJson(job.optJSONObject("pages"))));}if(data.containsKey("anchor"))source.anchor=Post.fromJson(new JSONObject(data.getString("anchor")));}catch(Exception ignored){}return new Gallery(list.posts,source);}
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
        String[] labels={"Главная","Поиск","Новое","Закладки","Моё"};String[] icons={"home","search","new","bookmark","profile"};
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
        if(cached!=null&&cached.loaded){s.posts.addAll(cached.posts);s.fingerprints.addAll(cached.fingerprints);s.unreadKeys.addAll(cached.unreadKeys);s.pages.putAll(cached.pages);s.jobs.addAll(cached.jobs);s.loaded=true;s.more=cached.more;s.failed=cached.failed;s.authBlocked=cached.authBlocked;s.authRequired.addAll(cached.authRequired);s.accessNotice=cached.accessNotice;s.adapter.notifyDataSetChanged();updateStatus(s);if(s.tab==0)loadRankings(s,s.generation,rating);
            if(personalized(s)){s.loading=true;int generation=s.generation;List<Post> liked=store.likes();Map<String,String> choices=store.recommendationTags();int seed=store.recommendationSeed();grouping.execute(()->{Recommendations.Model model=Recommendations.build(liked,choices,seed);main.post(()->{if(destroyed||s.generation!=generation)return;s.recommendationModel=model;s.loading=false;updateStatus(s);prepareVisibleContent();});});}
        }
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
                s.homeTab=index;s.order=index==1?"popular":"latest";s.query="";load(s,true);
            });tabs.addView(tab,new LinearLayout.LayoutParams(0,-2,1));}header.addView(tabs);
            LinearLayout section=section("Рейтинг","spark",Color.rgb(225,190,95));s.rankingLabel=(TextView)section.getChildAt(1);section.addView(button("Смотреть",MUTED,()->{s.query="";s.order="popular";load(s,true);}),new LinearLayout.LayoutParams(-2,dp(36)));header.addView(section);
            HorizontalScrollView carousel=new HorizontalScrollView(this);carousel.setHorizontalScrollBarEnabled(false);s.ranking=row();s.ranking.setPadding(dp(4),0,dp(4),0);carousel.addView(s.ranking);header.addView(carousel,new LinearLayout.LayoutParams(-1,dp(204)));
            for(int i=0;i<2;i++){View placeholder=new View(this);placeholder.setBackground(rounded(RAISED,8));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(dp(188),dp(198));lp.setMargins(dp(4),0,dp(4),0);s.ranking.addView(placeholder,lp);}
            header.addView(section("Рекомендации","heart",PINK));s.query="";
        }
        if(s.tab==2){
            LinearLayout tabs=row();TextView follow=button("Подписки",BLUE,()->{s.followingMode=true;load(s,true);});TextView latest=button("Все новые",MUTED,()->{s.followingMode=false;s.query="";load(s,true);});tabs.setPadding(dp(8),dp(8),dp(8),dp(8));tabs.addView(follow,new LinearLayout.LayoutParams(0,dp(44),1));tabs.addView(latest,new LinearLayout.LayoutParams(0,dp(44),1));header.addView(tabs);
            TextView manage=button("Управление подписками",MUTED,this::manageFollows);LinearLayout.LayoutParams ml=new LinearLayout.LayoutParams(-1,dp(44));ml.setMargins(dp(8),0,dp(8),dp(10));header.addView(manage,ml);
        }
        LinearLayout chips=row();chips.setPadding(dp(8),dp(4),dp(8),dp(10));
        TextView filterChip=text((sourceFilter.equals("all")?"Все источники":sourceName(sourceFilter))+"  ·  "+(rating.equals("general")?"Обычное":rating.equals("explicit")?"18+":"Всё"),12,MUTED);filterChip.setPadding(dp(12),dp(7),dp(12),dp(7));touchBackground(filterChip,RAISED,18);filterChip.setOnClickListener(v->filters());chips.addView(filterChip,new LinearLayout.LayoutParams(0,-2,1));chips.addView(iconButton("refresh","Обновить",()->{if(s.tab==0&&s.homeTab==0)store.rotateRecommendations();if(s.tab==1&&s.query.isBlank())loadExplore(s);else load(s,true);}),new LinearLayout.LayoutParams(dp(44),dp(40)));header.addView(chips);
        s.status=text("",13,MUTED);s.status.setPadding(dp(14),dp(12),dp(14),dp(20));s.status.setGravity(Gravity.CENTER);s.status.setOnClickListener(v->statusAction(s));
        list.addHeaderView(header,null,false);list.addFooterView(s.status,null,false);s.adapter=new FeedAdapter(s);list.setAdapter(s.adapter);
        list.setOnScrollListener(new FeedListView.ScrollListener(){
            public void onScrollStateChanged(FeedListView view,int state){if(state==SCROLL_STATE_TOUCH_SCROLL){s.restoreRow=-1;hideKeyboard();}}
            public void onScroll(FeedListView view,int first,int visible,int total){prefetchCards(s,Math.max(0,first-1));if(s.loaded&&!s.loading&&!s.failed&&s.more&&!s.posts.isEmpty()&&needsPage(s))load(s,false);}
        });
        shell.addView(list,new LinearLayout.LayoutParams(-1,0,1));s.view=shell;updateStatus(s);
    }
    private LinearLayout section(String title,String icon,int color){LinearLayout row=row();row.setPadding(dp(8),dp(14),dp(8),dp(8));row.addView(new IconView(this,icon,color),new LinearLayout.LayoutParams(dp(30),dp(30)));TextView label=text(title,15,TEXT);label.setTypeface(null,Typeface.BOLD);row.addView(label,new LinearLayout.LayoutParams(0,-2,1));return row;}
    private boolean personalized(Screen s){return s.tab==0&&s.homeTab==0&&!store.likes().isEmpty();}
    private void prepareRecommendations(Screen s,int generation){
        List<Post> liked=store.likes();Map<String,String> choices=store.recommendationTags();int seed=store.recommendationSeed();
        String selectedSource=sourceFilter,selectedRating=rating;
        s.loading=true;updateStatus(s);
        grouping.execute(()->{
            Recommendations.Model model=Recommendations.build(liked,choices,seed);
            List<Post> warm=new ArrayList<>();for(Post post:store.visible(store.catalogue(),true))
                if(CatalogLogic.matchesRating(post.rating,selectedRating)&&(selectedSource.equals("all")&&store.configured(post.source)||selectedSource.equals(post.source)))warm.add(post);
            warm=model.rank(warm,List.of(),store.recentSuggestions());
            List<Post> prepared=warm;
            main.post(()->{if(destroyed||s.generation!=generation)return;
                s.recommendationModel=model;
                if(!prepared.isEmpty()){s.posts.addAll(prepared);if(s.adapter!=null)s.adapter.notifyDataSetChanged();prefetchCards(s,0);}
                List<String> queries=model.queries.isEmpty()?List.of(""):model.queries;
                for(String query:queries)s.jobs.addLast(new Job(query,selectedPages()));
                 if(BuildConfig.DEBUG)android.util.Log.i("ArtCatalogQA","RECOMMEND prepared="+prepared.size()+" likes="+liked.size()+" queries="+queries.size()+" jobs="+s.jobs.size());
                s.loading=false;load(s,false);
            });
        });
    }
    private Map<String,Integer> selectedPages(){Map<String,Integer> pages=new LinkedHashMap<>();for(String source:CatalogClient.SOURCES)if((sourceFilter.equals("all")||sourceFilter.equals(source))&&store.configured(source))pages.put(source,0);if(pages.isEmpty()&&!sourceFilter.equals("all"))pages.put(sourceFilter,0);return pages;}
    private Map<String,Integer> selectedPages(Screen screen){if(screen.scopedSource.isBlank())return selectedPages();Map<String,Integer> scoped=new LinkedHashMap<>();scoped.put(screen.scopedSource,0);return scoped;}
    private void load(Screen s,boolean reset){
        if(s.tab==3){selectNav(3);return;}
        if(s.loading&&!reset)return;boolean recommendations=personalized(s),queued=s.tab==5||s.tab==2&&s.followingMode||recommendations;
        if(reset){s.loading=true;cancel(s.task);cancel(s.rankTask);s.generation++;s.recommendationModel=null;s.posts.clear();s.unreadKeys.clear();if(!queued&&!s.query.contains(":")&&(s.tab==0||s.tab==1||s.tab==6))for(Post cached:screenVisible(s,exploreCache()))if(queryMatches(cached,s.query))s.posts.add(cached);s.pages.clear();s.pages.putAll(selectedPages(s));s.jobs.clear();s.fingerprints.clear();s.more=true;s.loaded=false;s.failed=false;s.authRequired.clear();s.accessNotice="";
            if(s.tab==2&&s.followingMode)for(JSONObject f:store.follows()){String source=f.optString("source");Map<String,Integer> pages=source.isBlank()?selectedPages():new LinkedHashMap<>(Map.of(source,0));s.jobs.add(new Job(f.optString("tag"),pages));}
            if(s.tab==5&&s.anchor!=null)for(String q:CatalogLogic.relatedQueries(s.anchor))s.jobs.add(new Job(q,selectedPages()));
            if(s.adapter!=null)s.adapter.notifyDataSetChanged();if(s.list!=null)s.list.setSelection(0);
            if(recommendations){prepareRecommendations(s,s.generation);return;}
        }
        if(queued&&s.jobs.isEmpty()){s.more=false;s.loaded=true;s.loading=false;if(s.adapter!=null)s.adapter.notifyDataSetChanged();updateStatus(s);return;}
        Map<String,Integer> pages=s.pages;String query=s.query;
        if(queued){Job job=s.jobs.peekFirst();pages=job.pages;query=job.query;}
        if(pages.isEmpty()){s.more=false;s.loaded=true;s.loading=false;if(s.adapter!=null)s.adapter.notifyDataSetChanged();updateStatus(s);return;}
        if(s.tab==0&&s.ranking!=null&&!s.posts.isEmpty()&&(reset||!(s.ranking.getChildAt(0) instanceof Card)))fillRanking(s,s.posts,"Популярные в ленте");prefetchCards(s,0);int generation=s.generation;String filter=rating,order=s.tab==0||s.tab==6||s.tab==7?s.order:sort;String requestedQuery=query;Map<String,Integer> requestedPages=new LinkedHashMap<>(pages);
        List<Post> baseBefore=new ArrayList<>(s.posts),arrivals=new ArrayList<>();s.loading=true;updateStatus(s);
        s.task=submitNetwork(()->{
            CatalogClient.Page result=client.search(requestedQuery,requestedPages,filter,order,arrived->main.post(()->{if(destroyed||s.generation!=generation||s.adapter==null)return;arrivals.addAll(arrived.posts);List<Post> stable=recommendations?new ArrayList<>(s.posts):baseBefore;mergeAsync(s,stable,arrivals,generation,visible->{s.posts.clear();s.posts.addAll(visible);s.adapter.notifyDataSetChanged();prefetchCards(s,0);prefetchSourceNext(s);if(s.tab==0&&s.ranking!=null&&!(s.ranking.getChildAt(0) instanceof Card))fillRanking(s,s.posts,"Популярные в ленте");});}));
            main.post(()->{
                if(destroyed||s.generation!=generation)return;
                store.remember(result.posts);List<Post> incoming=result.posts;
                if(s.tab==2&&s.followingMode&&!incoming.isEmpty()&&result.errors.isEmpty()&&requestedPages.values().stream().allMatch(page->page==0))for(JSONObject follow:store.follows()){
                    String scope=follow.optString("source");if(follow.optString("tag").equals(requestedQuery)&&(scope.isBlank()||requestedPages.containsKey(scope)))s.unreadKeys.addAll(store.unread(incoming,requestedQuery,scope));
                }
                List<Post> base=recommendations?new ArrayList<>(s.posts):reset&&result.errors.isEmpty()?List.of():baseBefore;mergeAsync(s,base,incoming,generation,merged->{s.posts.clear();s.posts.addAll(merged);
                Map<String,Integer> next=new LinkedHashMap<>();
                for(String source:requestedPages.keySet()){String fingerprint=result.fingerprints.get(source);boolean fresh=fingerprint==null||s.fingerprints.add(requestedQuery+"|"+source+"|"+fingerprint);if(fresh&&result.more.contains(source))next.put(source,requestedPages.get(source)+1);else if(!fresh&&result.more.contains(source))result.errors.put(source,"Источник повторил страницу. Нажмите для повторной загрузки.");}
                // A failed provider should not keep the recommendation queue on the
                // same inaccessible page. Other queries and providers can continue.
                if(!queued)for(String source:result.errors.keySet())if(requestedPages.containsKey(source))next.put(source,requestedPages.get(source));
                if(queued){s.jobs.pollFirst();if(!next.isEmpty())s.jobs.addLast(new Job(requestedQuery,next));s.more=!s.jobs.isEmpty();}
                else{s.pages.clear();s.pages.putAll(next);s.more=!next.isEmpty();}
                s.loading=false;s.loaded=true;
                // One failed provider must not stop paging providers that returned work.
                s.failed=!result.errors.isEmpty()&&result.posts.isEmpty()&&(!queued||!s.more);
                if(s.tab==1&&s.query.isBlank())s.exploreMessage=s.posts.isEmpty()?(s.failed?"Не удалось загрузить каталог. Нажмите, чтобы повторить.":"Нет работ для этих фильтров. Измените настройки."):"Иллюстрации из ваших источников";
                if(BuildConfig.DEBUG&&s.tab==1&&s.query.isBlank())android.util.Log.i("ArtCatalogQA","EXPLORE page="+requestedPages+" incoming="+result.posts.size()+" posts="+s.posts.size()+" next="+next+" more="+s.more+" errors="+result.errors.keySet());
                applyAccess(s,result);if(recommendations){Set<String> old=new HashSet<>();for(Post post:baseBefore)old.addAll(WorkGrouping.tokens(post));List<Post> novel=new ArrayList<>();for(Post post:merged)if(Collections.disjoint(old,WorkGrouping.tokens(post)))novel.add(post);store.markSuggested(novel);}if(s.adapter!=null)s.adapter.notifyDataSetChanged();if(s.tab==2&&s.followingMode)refreshCards();updateStatus(s);
                if(BuildConfig.DEBUG&&recommendations)android.util.Log.i("ArtCatalogQA","RECOMMEND incoming="+result.posts.size()+" shown="+s.posts.size()+" jobs="+s.jobs.size()+" next="+next+" more="+s.more+" auth="+s.authRequired.size()+" errors="+result.errors.keySet());
                if(s.failed&&s.status!=null){StringBuilder error=new StringBuilder();for(Map.Entry<String,String> entry:result.errors.entrySet())error.append(sourceName(entry.getKey())).append(": ").append(entry.getValue()).append("\n");s.status.setText(error.toString().trim()+"\nНажмите, чтобы повторить.");s.status.setVisibility(View.VISIBLE);}
                prefetchSourceNext(s);if(s.loadedCallback!=null)s.loadedCallback.run();
                if(s.more&&!s.failed&&s.list!=null&&(s.posts.isEmpty()||needsPage(s)))main.postDelayed(()->{if(!destroyed&&s.generation==generation&&s.view==currentView&&s.list!=null&&!s.loading&&!s.failed&&s.more&&(s.posts.isEmpty()||needsPage(s)))load(s,false);},180);
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
            if(s.adapter!=null&&s.loaded&&!s.loading&&!s.failed&&s.more&&(s.posts.isEmpty()||needsPage(s)))load(s,false);
        }
    }
    private int firstCard(Screen s){if(s.list==null)return 0;int headerRows=s.tab==1&&s.query.isBlank()?6:1;return Math.max(0,(s.restoreRow>=0?s.restoreRow:s.list.getFirstVisiblePosition())-headerRows)*2;}
    private boolean needsPage(Screen s){return s.list!=null&&PreviewWindow.needsPage(firstCard(s),s.list.getVisibleCount()*2,s.posts.size());}
    private String cardPreview(Post post){
        if(post.isVideo())return post.preview;
        for(String url:new LinkedHashSet<>(List.of(post.preview,post.smallPreview,post.image,post.original)))
            if(CatalogLogic.isMediaUrl(url)&&!images.failed(url,720))return url;
        return post.preview;
    }
    private void prefetchCards(Screen screen,int ignored){
        if(screen.view!=currentView||screen.list==null)return;
        int first=firstCard(screen);PreviewWindow window=new PreviewWindow(first,screen.list.getVisibleCount()*2,screen.posts.size());long now=SystemClock.elapsedRealtime();
        if(prefetchScreen==screen&&prefetchFirst==first&&prefetchEnd==window.end&&prefetchRevision==screen.revision&&prefetchCount==screen.posts.size()&&now-prefetchTime<1500)return;
        prefetchScreen=screen;prefetchFirst=first;prefetchEnd=window.end;prefetchRevision=screen.revision;prefetchCount=screen.posts.size();prefetchTime=now;List<String> urls=new ArrayList<>();
        // Nearest cards first, then the full reserve below the screen, then a small return reserve.
        for(int i=first;i<window.end;i++)urls.add(cardPreview(screen.posts.get(i)));
        for(int i=window.start;i<first&&i<screen.posts.size();i++)urls.add(cardPreview(screen.posts.get(i)));
        images.prefetchWindow(urls.subList(0,Math.min(28,urls.size())),720);
    }
    private Gallery serverGallery(List<Post> posts,String query,String order,CatalogClient.Page result,Map<String,Integer> requestedPages){
        Screen source=new Screen(6);source.query=query;source.order=order;source.loaded=true;source.posts.addAll(posts);
        for(String name:requestedPages.keySet()){
            if(result==null||result.more.contains(name))source.pages.put(name,requestedPages.get(name)+(result==null?0:1));
            else if(result.errors.containsKey(name))source.pages.put(name,requestedPages.get(name));
            if(result!=null&&result.fingerprints.containsKey(name))source.fingerprints.add(query+"|"+name+"|"+result.fingerprints.get(name));
        }
        source.more=!source.pages.isEmpty();source.failed=result!=null&&!result.errors.isEmpty()&&result.posts.isEmpty();if(result!=null)applyAccess(source,result);return new Gallery(posts,source);
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
        boolean prepared=true;for(Post p:s.pendingRanking){String url=cardPreview(p);if(!images.prepared(url,720)){prepared=false;if(s.view==currentView)images.prefetch(url,720);}}if(!prepared)return;
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
        boolean prepared=true;for(Post p:s.pendingArtistWorks){String url=cardPreview(p);if(!images.prepared(url,720)){prepared=false;images.prefetch(url,720);}}if(!prepared)return;
        s.artistWorks.addView(section("Другие работы автора","users",MUTED));HorizontalScrollView horizontal=new HorizontalScrollView(this);horizontal.setHorizontalScrollBarEnabled(false);LinearLayout strip=row();horizontal.addView(strip);
        for(Post p:s.pendingArtistWorks){Card card=new Card();card.bind(p,false,s.pendingArtistGallery);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(dp(112),dp(112));lp.setMargins(dp(4),0,0,0);strip.addView(card,lp);}
        s.artistWorks.addView(horizontal,new LinearLayout.LayoutParams(-1,dp(118)));s.pendingArtistWorks=null;
    }
    private void updateStatus(Screen s){
        if(s.status==null)return;
        String label=s.loading||s.adapter!=null&&!s.adapter.explore()&&s.adapter.shown.size()<s.posts.size()?"Подготовка следующих иллюстраций…":s.more?s.posts.isEmpty()?"Ищем доступные работы…":"Загрузить ещё":s.posts.isEmpty()?s.tab==3?"Закладки появятся здесь.\nСохраните работу кнопкой внутри иллюстрации.":s.tab==2&&s.followingMode&&store.follows().isEmpty()?"Подпишитесь на художника, чтобы видеть его новые работы.":"Здесь пока нет работ.\nИзмените фильтры или нажмите, чтобы обновить.":s.tab==0&&s.homeTab==0?"Подборка просмотрена · нажмите, чтобы обновить рекомендации":"Пока новых результатов нет · нажмите, чтобы обновить";
        if(!s.accessNotice.isBlank()&&!s.more)label=s.accessNotice+(s.authRequired.isEmpty()?"":"\nНажмите, чтобы авторизоваться.");
        if(!TextUtils.equals(s.status.getText(),label))s.status.setText(label);s.status.setVisibility(View.VISIBLE);
    }
    private void applyAccess(Screen screen,CatalogClient.Page result){screen.authRequired.clear();screen.authRequired.addAll(result.authRequired);screen.accessNotice=String.join("\n",result.notices.values());screen.authBlocked=result.posts.isEmpty()&&!result.authRequired.isEmpty()&&!screen.more;}
    private void statusAction(Screen screen){if(screen.more){load(screen,false);return;}if(screen.authRequired.contains("sankaku")){settings("Источники");return;}if(screen.tab==0&&screen.homeTab==0)store.rotateRecommendations();load(screen,true);}
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
        s.exploreMessage="Иллюстрации из ваших источников";
        load(s,true);
    }
    private List<Post> exploreCache(){List<Post> result=new ArrayList<>();for(Post p:store.visible(store.catalogue(),false))if(CatalogLogic.matchesRating(p.rating,rating)&&(sourceFilter.equals("all")&&store.configured(p.source)||sourceFilter.equals(p.source)))result.add(p);result.sort(Comparator.comparingLong((Post p)->{try{return Long.parseLong(p.id);}catch(Exception ignored){return 0;}}).reversed());return result;}
    private final class FeedAdapter extends BaseAdapter {
        final Screen screen;final List<Post> shown=new ArrayList<>();final List<String> rowTokens=new ArrayList<>();String publishedRoute="";Gallery bindingGallery;int galleryRevision=-1,galleryCount=-1;boolean metadataDirty=true,prefixCurrent;
        final String[] topicTags={"landscape","original","sky","animal","portrait","fantasy","city","flower","pixel_art","space","ocean","nature"};
        final String[] topicNames={"Пейзажи","Оригинальное","Небо","Животные","Портреты","Фэнтези","Города","Цветы","Пиксель-арт","Космос","Море","Природа"};
        FeedAdapter(Screen s){screen=s;}
        private boolean explore(){return screen.tab==1&&screen.query.isBlank();}
        public int getCount(){return explore()?6+(shown.size()+1)/2:(shown.size()+1)/2;}
        private Post topic(List<Post> posts,int index){if(posts.isEmpty())return null;for(int offset=0;offset<posts.size();offset++){Post p=posts.get((index+offset)%posts.size());if(p.tags.contains(topicTags[index]))return p;}return posts.get(index%posts.size());}
        private String token(Post p){return p==null?"":p.key()+"|"+cardPreview(p)+"|"+p.title+"|"+p.artist+"|"+p.media.size();}
        public Object getItem(int position){return position<rowTokens.size()?rowTokens.get(position):rowToken(position);}
        private String rowToken(int position){if(explore()){if(position==0)return screen.exploreMessage+"|"+token(shown.isEmpty()?null:shown.get(0));if(position<5){String content="";for(int i=(position-1)*3;i<position*3;i++)content+="|"+token(topic(shown,i));return content;}if(position==5)return "Каталог|"+screen.exploreMessage;}int index=(explore()?position-6:position)*2;return token(shown.get(index))+"||"+token(index+1<shown.size()?shown.get(index+1):null);}
        private Gallery gallery(){if(bindingGallery==null||galleryRevision!=screen.revision||galleryCount!=screen.posts.size()){bindingGallery=new Gallery(screen.posts,screen);if(screen.loaded&&screen.revision>0)bindingGallery.syncedRevision=screen.revision;galleryRevision=screen.revision;galleryCount=screen.posts.size();}return bindingGallery;}
        @Override public void notifyDataSetChanged(){metadataDirty=true;bindingGallery=null;prefetchScreen=null;refreshPrepared();if(screen.view==currentView)prefetchCards(screen,0);}
        void refreshPrepared(){
            if(!metadataDirty&&!explore()&&prefixCurrent&&shown.size()==screen.posts.size()&&screen.restoreRow<0)return;
            String route=screen.tab+"|"+screen.query+"|"+screen.order+"|"+screen.followingMode;
            Set<String> previous=new HashSet<>();if(route.equals(publishedRoute))for(Post p:shown)previous.add(p.key());
            List<Post> ready=new ArrayList<>();
            if(explore()){
                for(int i=0;i<Math.min(13,screen.posts.size());i++){String url=cardPreview(screen.posts.get(i));if(!images.prepared(url,720)&&screen.view==currentView)images.prefetch(url,720);}
                // Publish an ordered prefix. Otherwise each finished download moves
                // cards around the discovery page while the user is scrolling.
                for(Post post:screen.posts){if(!previous.contains(post.key())&&!images.prepared(cardPreview(post),720))break;ready.add(post);}
                if(ready.isEmpty()&&route.equals(publishedRoute))ready.addAll(shown);
            }else{
                int restoring=screen.restoreRow<0?0:Math.max(0,Math.min(screen.restoreRow-1,(screen.posts.size()-1)/2))*2;
                boolean restoreReady=restoring<screen.posts.size()&&images.prepared(cardPreview(screen.posts.get(restoring)),720)&&(restoring+1>=screen.posts.size()||images.prepared(cardPreview(screen.posts.get(restoring+1)),720));
                for(int i=0;i<screen.posts.size();i+=2){Post left=screen.posts.get(i),right=i+1<screen.posts.size()?screen.posts.get(i+1):null;
                    if(!(restoreReady&&i<restoring)&&(!previous.contains(left.key())&&!images.prepared(cardPreview(left),720)||right!=null&&!previous.contains(right.key())&&!images.prepared(cardPreview(right),720)))break;
                    ready.add(left);if(right!=null)ready.add(right);
                }
                if(ready.isEmpty()&&(screen.loading||!screen.posts.isEmpty())&&route.equals(publishedRoute))ready.addAll(shown);
            }
            shown.clear();shown.addAll(ready);publishedRoute=route;metadataDirty=false;prefixCurrent=shown.size()<=screen.posts.size();for(int i=0;prefixCurrent&&i<shown.size();i++)prefixCurrent=shown.get(i)==screen.posts.get(i);List<String> nextTokens=new ArrayList<>();
            for(int position=0;position<getCount();position++)nextTokens.add(rowToken(position));
            if(!rowTokens.equals(nextTokens)){if(BuildConfig.DEBUG&&explore())android.util.Log.i("ArtCatalogQA","EXPLORE prepared="+shown.size()+" posts="+screen.posts.size()+" first="+firstCard(screen));rowTokens.clear();rowTokens.addAll(nextTokens);super.notifyDataSetChanged();}updateStatus(screen);
            if(screen.restoreRow>=0&&screen.list!=null&&!shown.isEmpty()){
                int target=Math.min(screen.restoreRow,(screen.posts.size()+1)/2);
                if(explore()||shown.size()>Math.max(0,target-1)*2){int top=screen.restoreTop,generation=screen.generation;FeedListView restoring=screen.list;restoring.post(()->{if(destroyed||screen.list!=restoring||screen.generation!=generation||screen.restoreRow<0)return;restoring.setSelectionFromTop(target,top);restoring.postOnAnimation(()->{if(!destroyed&&screen.list==restoring&&screen.generation==generation&&restoring.getFirstVisiblePosition()==target)screen.restoreRow=-1;});});}
            }
        }
        public long getItemId(int position){String key=explore()&&position<6?"explore:"+position:shown.get((explore()?position-6:position)*2).key();long hash=0xcbf29ce484222325L;for(int i=0;i<key.length();i++){hash^=key.charAt(i);hash*=0x100000001b3L;}return hash;}
        public int getViewTypeCount(){return 4;}
        public int getItemViewType(int position){return explore()&&position<6?(position==0?1:position==5?3:2):0;}
        public View getView(int position,View recycled,ViewGroup parent){
            if(explore()&&position<6){
                if(position==0){FrameLayout hero;ImageView image;TextView label;
                    if(recycled instanceof FrameLayout&&((FrameLayout)recycled).getChildCount()==2){hero=(FrameLayout)recycled;image=(ImageView)hero.getChildAt(0);label=(TextView)hero.getChildAt(1);}else{hero=new FrameLayout(MainActivity.this);image=new ImageView(MainActivity.this);image.setScaleType(ImageView.ScaleType.CENTER_CROP);hero.addView(image,new FrameLayout.LayoutParams(-1,-1));hero.setBackground(rounded(RAISED,6));label=gradientLabel("",20);hero.addView(label,new FrameLayout.LayoutParams(-1,-1));}
                    int width=getResources().getDisplayMetrics().widthPixels;hero.setLayoutParams(new ViewGroup.LayoutParams(-1,Math.min(dp(250),width*2/3)));
                    if(!shown.isEmpty())images.bind(image,cardPreview(shown.get(0)),720);else images.release(image);
                    label.setText("Найдите своё вдохновение\n"+screen.exploreMessage);hero.setContentDescription("Иллюстрации из каталога");hero.setOnClickListener(v->{if(shown.isEmpty()){if(!screen.loading)loadExplore(screen);}else openArtwork(shown.get(0),gallery());});return hero;
                }
                if(position==5){TextView section=recycled instanceof TextView?(TextView)recycled:text("Иллюстрации из каталога",16,TEXT);section.setTypeface(null,Typeface.BOLD);section.setPadding(dp(16),dp(22),dp(16),dp(10));return section;}
                LinearLayout tiles=recycled instanceof LinearLayout?(LinearLayout)recycled:row();int height=(getResources().getDisplayMetrics().widthPixels-dp(20))/3;tiles.setLayoutParams(new ViewGroup.LayoutParams(-1,height+dp(4)));
                for(int c=0;c<3;c++){
                    int index=(position-1)*3+c;FrameLayout tile;
                    if(c<tiles.getChildCount())tile=(FrameLayout)tiles.getChildAt(c);else{tile=new FrameLayout(MainActivity.this);tile.setBackground(rounded(RAISED+(index%3)*0x020202,5));ImageView image=new ImageView(MainActivity.this);image.setScaleType(ImageView.ScaleType.CENTER_CROP);tile.addView(image,new FrameLayout.LayoutParams(-1,-1));tile.addView(gradientLabel("",14),new FrameLayout.LayoutParams(-1,-1));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,height,1);lp.setMargins(dp(2),dp(2),dp(2),dp(2));tiles.addView(tile,lp);}
                    ImageView image=(ImageView)tile.getChildAt(0);Post matching=topic(shown,index);if(matching!=null)images.bind(image,cardPreview(matching),720);else images.release(image);
                    ((TextView)tile.getChildAt(1)).setText("#"+topicNames[index]);tile.setContentDescription("Тема "+topicNames[index]);tile.setOnClickListener(v->runSearch(topicTags[index]));
                }return tiles;
            }
            LinearLayout row;
            if(recycled instanceof LinearLayout&&recycled.getTag() instanceof Card[]){row=(LinearLayout)recycled;}else{
                row=row();Card[] cards={new Card(),new Card()};row.setTag(cards);for(Card card:cards){LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,-1,1);lp.setMargins(dp(2),dp(2),dp(2),dp(2));row.addView(card,lp);}
            }
            int height=(getResources().getDisplayMetrics().widthPixels-dp(20))/2;row.setLayoutParams(new ViewGroup.LayoutParams(-1,height+dp(4)));Card[] cards=(Card[])row.getTag();
            for(int col=0;col<2;col++){int index=(explore()?position-6:position)*2+col;Card card=cards[col];if(index<shown.size()){card.setVisibility(View.VISIBLE);card.bind(shown.get(index),false,gallery());card.feed=FeedAdapter.this;card.updateUnread();}else{card.setVisibility(View.INVISIBLE);images.cancel(card.image);}}
            return row;
        }
    }
    private TextView gradientLabel(String label,int size){TextView text=text(label,size,Color.WHITE);text.setGravity(Gravity.BOTTOM);text.setPadding(dp(12),dp(20),dp(12),dp(18));text.setTypeface(null,Typeface.BOLD);text.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,new int[]{Color.TRANSPARENT,Color.argb(190,0,0,0)}));return text;}
    private final class Card extends FrameLayout {
        final ImageView image;final IconView heart;final FrameLayout save;final TextView caption,newBadge;Post post;Gallery gallery;FeedAdapter feed;
        Card(){
            super(MainActivity.this);setBackground(rounded(RAISED,6));setClipToOutline(true);setFocusable(true);
            image=new ImageView(MainActivity.this);image.setScaleType(ImageView.ScaleType.CENTER_CROP);image.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);addView(image,new FrameLayout.LayoutParams(-1,-1));
            caption=gradientLabel("",12);caption.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);addView(caption,new FrameLayout.LayoutParams(-1,-1));caption.setVisibility(GONE);
            newBadge=text("Новое",11,Color.WHITE);newBadge.setTypeface(null,Typeface.BOLD);newBadge.setGravity(Gravity.CENTER);newBadge.setBackground(rounded(BLUE,13));FrameLayout.LayoutParams badgeLayout=new FrameLayout.LayoutParams(dp(64),dp(27),Gravity.TOP|Gravity.LEFT);badgeLayout.setMargins(dp(7),dp(7),0,0);addView(newBadge,badgeLayout);newBadge.setVisibility(GONE);
            save=new FrameLayout(MainActivity.this);save.setFocusable(true);touchBackground(save,Color.argb(85,0,0,0),24);heart=new IconView(MainActivity.this,"heart",TEXT);save.addView(heart,new FrameLayout.LayoutParams(-1,-1));FrameLayout.LayoutParams hp=new FrameLayout.LayoutParams(dp(44),dp(44),Gravity.BOTTOM|Gravity.RIGHT);hp.setMargins(0,0,dp(4),dp(4));addView(save,hp);
            setOnClickListener(v->{if(post!=null){Gallery source=feed==null?gallery:feed.gallery(),context=null;Post selected=resolve(source);if(source!=null){context=new Gallery(source.posts,source.source);context.syncedRevision=source.syncedRevision;}openArtwork(selected,context);}});save.setOnClickListener(v->{if(post!=null){boolean added=store.toggleLike(resolve(feed==null?gallery:feed.gallery()));likesChanged();toast(added?"Понравилось":"Убрано из понравившегося");}});
        }
        private Post resolve(Gallery context){if(context!=null)for(Post item:context.posts)if(item.key().equals(post.key())||item.memberKeys.contains(post.key()))return item;return post;}
        void bind(Post p,boolean ranking){post=p;setContentDescription("Открыть иллюстрацию "+p.id+" · "+p.title);images.bind(image,cardPreview(p),720,()->{if(post==p&&p.source.equals("rule34")&&p.visualHash.isBlank()&&image.getDrawable() instanceof BitmapDrawable){p.visualHash=ImageLoader.visualHash(((BitmapDrawable)image.getDrawable()).getBitmap());scheduleRegroup();}});heart.filled=store.liked(p);heart.color(heart.filled?PINK:Color.WHITE);save.setContentDescription(heart.filled?"Убрать из понравившегося":"Нравится");caption.setVisibility(ranking||p.media.size()>1?VISIBLE:GONE);if(!ranking&&p.media.size()>1){caption.setText("▣ "+p.media.size());caption.setGravity(Gravity.TOP|Gravity.RIGHT);caption.setPadding(dp(8),dp(8),dp(8),0);}if(ranking){caption.setGravity(Gravity.BOTTOM);caption.setText(p.title+"\n"+(!p.artistTag.isBlank()?p.artist:sourceName(p.source)));caption.setPadding(dp(12),0,dp(52),dp(12));}}
        void bind(Post p,boolean ranking,Gallery context){feed=null;gallery=context;bind(p,ranking);}
        void updateUnread(){if(post==null)return;boolean unread=false;if(feed!=null&&feed.screen.tab==2&&feed.screen.followingMode){unread=feed.screen.unreadKeys.contains(post.key());if(!unread)for(String key:post.memberKeys)if(feed.screen.unreadKeys.contains(key)){unread=true;break;}}newBadge.setVisibility(unread?VISIBLE:GONE);setContentDescription("Открыть иллюстрацию "+post.id+" · "+post.title+(unread?" · Новое":""));}
        void updateSaved(){if(post!=null){heart.filled=store.liked(post);heart.color(heart.filled?PINK:Color.WHITE);save.setContentDescription(heart.filled?"Убрать из понравившегося":"Нравится");updateUnread();}}
    }

    private View profile(){
        LinearLayout page=column();ScrollView scroll=new ScrollView(this);LinearLayout body=column();body.setPadding(dp(16),dp(20),dp(16),dp(24));scroll.addView(body);page.addView(toolbar("Моя страница",null));page.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        LinearLayout account=row();account.setPadding(dp(4),dp(6),dp(4),dp(24));TextView avatar=text("A",28,TEXT);avatar.setGravity(Gravity.CENTER);avatar.setBackground(rounded(BLUE,36));account.addView(avatar,new LinearLayout.LayoutParams(dp(60),dp(60)));
        LinearLayout label=column();label.setPadding(dp(16),0,0,0);TextView name=text("ArtCatalog",19,TEXT);name.setTypeface(null,Typeface.BOLD);label.addView(name);TextView info=text("Ваш каталог на телефоне",13,MUTED);info.setPadding(0,dp(6),0,0);label.addView(info);account.addView(label);body.addView(account);
        LinearLayout summary=row();summary.setPadding(dp(16),dp(16),dp(16),dp(16));summary.setBackground(rounded(RAISED,8));summary.addView(text(store.likes().size()+" нравится · "+store.bookmarks().size()+" закладок",14,TEXT),new LinearLayout.LayoutParams(0,-2,1));summary.addView(text(store.follows().size()+" подписок",14,MUTED));body.addView(summary);
        menuRow(body,"heart","Понравившееся",()->localGrid("Понравившееся",store.likes()));menuRow(body,"bookmark","Закладки",()->selectNav(3));menuRow(body,"clock","Недавно открытое",()->localGrid("Недавно открытое",store.history()));menuRow(body,"users","Подписки",this::manageFollows);
        TextView divider=text("Настройки",12,MUTED);divider.setPadding(dp(8),dp(24),0,dp(8));body.addView(divider);
        menuRow(body,"settings","Настройки",this::settings);menuRow(body,"bookmark","Открытые работы",this::openWorks);menuRow(body,"download","Экспорт профиля",this::exportData);menuRow(body,"bookmark","Импорт профиля с ПК",this::importData);
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
            String tag=f.optString("tag"),source=f.optString("source"),key=f.optString("key");
            LinearLayout option=row();option.setPadding(0,dp(10),0,dp(10));
            TextView title=text(source.isBlank()?tag.replace('_',' '):f.optString("name",tag)+" · "+sourceName(source),15,TEXT);
            title.setOnClickListener(v->{if(source.isBlank())authorProfile(tag);else renderUploader(source,tag.replaceFirst("^user:",""),f.optString("name",tag),true,null,0,0);});
            option.addView(title,new LinearLayout.LayoutParams(0,dp(46),1));title.setGravity(Gravity.CENTER_VERTICAL);
            option.addView(button("Отписаться",MUTED,()->{store.removeFollow(key);screens[2]=null;goBack();manageFollows();}));body.addView(option);
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
    private void recommendationTagDialog(String tag,Runnable changed,Runnable select){
        String mode=store.recommendationTagMode(tag);
        String[] choices={"Обычный тег","Приоритетный тег","Не показывать в рекомендациях",select==null?"Искать тег":"Выбрать для поиска с другими тегами"};
        new AlertDialog.Builder(this).setTitle("#"+tag.replace('_',' '))
            .setSingleChoiceItems(choices,mode.equals("priority")?1:mode.equals("disabled")?2:0,(dialog,index)->{
                dialog.dismiss();if(index==3){if(select!=null)select.run();else runSearch(tag);return;}
                store.setRecommendationTagMode(tag,index==1?"priority":index==2?"disabled":"normal");
                Screen home=screens[0];if(home!=null&&home.homeTab==0){home.loaded=false;home.recommendationModel=null;}
                if(changed!=null)changed.run();
            }).setNegativeButton("Отмена",null).show();
    }
    private void recommendationSettings(){
        LinearLayout page=column();page.setBackgroundColor(BG);page.addView(toolbar("Рекомендации",this::goBack));
        ScrollView scroll=new ScrollView(this);LinearLayout body=column();body.setPadding(dp(16),dp(18),dp(16),dp(28));scroll.addView(body);page.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));push(page);
        Runnable[] refresh={null};refresh[0]=()->{
            body.removeAllViews();body.addView(text("Настройки по понравившимся работам",19,TEXT));
            hint(body,"Жёлтый тег получает приоритет, красный исключается из рекомендаций. Нажмите на тег, чтобы изменить его. Лайки и закладки хранятся отдельно.");
            TextView loading=text("Считаем интересы…",14,MUTED);body.addView(loading);
            List<Post> likes=store.likes();Map<String,String> prefs=store.recommendationTags();int seed=store.recommendationSeed();
            grouping.execute(()->{Recommendations.Model model=Recommendations.build(likes,prefs,seed);main.post(()->{
                if(destroyed||currentView!=page)return;body.removeView(loading);
                if(likes.isEmpty())hint(body,"Отметьте несколько иллюстраций сердцем, и здесь появятся ваши интересы. До этого главная показывает общую ленту.");
                Map<String,Double> interest=new LinkedHashMap<>(model.weights);for(String tag:prefs.keySet())interest.putIfAbsent(tag,0.);
                List<String> tags=new ArrayList<>(interest.keySet());tags.sort(Comparator.comparingDouble((String tag)->interest.getOrDefault(tag,0.)).reversed().thenComparing(tag->tag));
                for(String tag:tags.subList(0,Math.min(100,tags.size()))){String mode=store.recommendationTagMode(tag);
                    int color=mode.equals("priority")?Color.rgb(255,206,74):mode.equals("disabled")?Color.rgb(243,118,119):TEXT;
                    TextView item=button((mode.equals("priority")?"★ ":mode.equals("disabled")?"✕ ":"# ")+tag.replace('_',' '),color,()->recommendationTagDialog(tag,refresh[0],null));
                    item.setGravity(Gravity.CENTER_VERTICAL);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(48));lp.setMargins(0,0,0,dp(6));body.addView(item,lp);
                }
            });});
        };refresh[0].run();
    }
    private void hiddenAuthorsSettings(){
        LinearLayout page=column();page.setBackgroundColor(BG);page.addView(toolbar("Скрытые авторы",this::goBack));
        ScrollView scroll=new ScrollView(this);LinearLayout body=column();body.setPadding(dp(16),dp(18),dp(16),dp(28));scroll.addView(body);page.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));push(page);
        Runnable[] fill={null};fill[0]=()->{body.removeAllViews();List<String> keys=store.hiddenAuthors();
            if(keys.isEmpty()){hint(body,"Скрытых авторов пока нет. Откройте профиль художника и нажмите «Скрыть автора».");return;}
            hint(body,"Работы этих художников и загрузчиков скрыты в лентах, истории, закладках и похожем. Записи не удаляются.");
            for(String key:keys){LinearLayout item=row();TextView name=text(key.replace('_',' '),14,TEXT);item.addView(name,new LinearLayout.LayoutParams(0,dp(52),1));
                item.addView(button("Показать",BLUE,()->{int separator=key.indexOf(':');store.setHiddenAuthor(key.substring(0,separator),key.substring(separator+1),false);invalidateScreens();fill[0].run();}),new LinearLayout.LayoutParams(-2,dp(44)));
                body.addView(item);
            }
        };fill[0].run();
    }
    private void appearanceSettings(){
        LinearLayout page=column();page.setBackgroundColor(BG);page.addView(toolbar("Оформление",this::goBack));
        ScrollView scroll=new ScrollView(this);LinearLayout body=column();body.setPadding(dp(16),dp(18),dp(16),dp(28));scroll.addView(body);page.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        body.addView(text("Тема оформления",20,TEXT));hint(body,"Выберите оформление для всего приложения. Системный режим следует настройке телефона.");
        RadioGroup mode=choices(body,new String[]{"Как в системе","Тёмная","Светлая","List"},new String[]{"system","dark","light","list"},store.prefs.getString("themePreference","dark"));
        body.addView(button("Применить тему",BLUE,()->{String choice=(String)mode.findViewById(mode.getCheckedRadioButtonId()).getTag();store.prefs.edit().putString("themePreference",choice).apply();recreate();}));
        push(page);
    }
    private void privacySettings(){
        LinearLayout page=column();page.setBackgroundColor(BG);page.addView(toolbar("Приватность",this::goBack));
        ScrollView scroll=new ScrollView(this);LinearLayout body=column();body.setPadding(dp(16),dp(18),dp(16),dp(28));scroll.addView(body);page.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        body.addView(text("Защита экрана",20,TEXT));CheckBox secure=check(body,"Скрывать приложение на снимках экрана",store.prefs.getBoolean("secureCapture",false));
        hint(body,"Android блокирует снимки и запись окна приложения, пока переключатель включён. Содержимое остаётся видно на самом телефоне.");
        secure.setOnCheckedChangeListener((button,enabled)->{store.prefs.edit().putBoolean("secureCapture",enabled).apply();if(enabled)getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);});
        push(page);
    }
    private void settingsSection(LinearLayout body,String section){
        if(section.equals("Контент")){
            TextView title=text("Фильтры содержимого",20,TEXT);title.setTypeface(null,Typeface.BOLD);body.addView(title);settingsAction(body,"Настроить рекомендации",BLUE,this::recommendationSettings);String ai=store.prefs.getString("aiMode","all");CheckBox generated=check(body,"Скрывать AI-generated",!ai.equals("all"));CheckBox assisted=check(body,"Скрывать также AI-assisted",ai.equals("generated-and-assisted"));assisted.setEnabled(generated.isChecked());hint(body,"Учитываются метки AI-generated, AI-art, Stable Diffusion, NovelAI и AI-assisted. Работы без этих тегов не определяются автоматически как AI.");CheckBox viewed=check(body,"Скрывать просмотренные и сохранённые работы",store.prefs.getBoolean("hideViewedAndSaved",false));hint(body,"Скрывает работы из поиска, рекомендаций и похожих, включая копии с тем же MD5. Закладки, история и профили авторов остаются доступны.");body.addView(text("Исключённые теги",17,TEXT));EditText excluded=new EditText(this);excluded.setTextColor(TEXT);excluded.setHintTextColor(MUTED);excluded.setHint("Например, 3d, ai_generated_background");excluded.setMaxLines(5);excluded.setText(store.prefs.getString("excludedTags",""));body.addView(excluded);hint(body,"Можно указать несколько тегов через запятую. Совпадение точное: latex не исключает latex_gloves.");generated.setOnCheckedChangeListener((b,checked)->assisted.setEnabled(checked));body.addView(button("Сохранить фильтры",BLUE,()->{store.prefs.edit().putString("aiMode",!generated.isChecked()?"all":assisted.isChecked()?"generated-and-assisted":"generated").putBoolean("hideViewedAndSaved",viewed.isChecked()).putString("excludedTags",String.join(", ",CatalogLogic.excludedTags(excluded.getText().toString()))).apply();preferencesChanged();}));
            CheckBox furry=check(body,"Скрывать furry и anthro",store.prefs.getBoolean("hideFurry",false));
            hint(body,"Учитываются только явные теги furry и anthro, в том числе у объединённых копий. Уши, хвосты и одежда с мехом сами по себе не скрываются.");
            furry.setOnCheckedChangeListener((view,checked)->{store.prefs.edit().putBoolean("hideFurry",checked).apply();preferencesChanged();});
            settingsAction(body,"Оформление",MUTED,this::appearanceSettings);
            settingsAction(body,"Приватность",MUTED,this::privacySettings);
        }else if(section.equals("Авторы")){
            body.addView(text("Основная подпись автора",20,TEXT));hint(body,"Художник, исходная публикация и загрузчик показаны отдельно в работе. Здесь выбирается основная подпись.");RadioGroup priority=choices(body,new String[]{"Художник","Исходная ссылка","Загрузчик"},new String[]{"creator","original","uploader"},store.prefs.getString("attributionPriority","creator"));hint(body,"Подписка создаётся на тег художника. Исходная ссылка открывает публикацию; загрузчик может быть другим человеком.");body.addView(button("Сохранить приоритет",BLUE,()->{store.prefs.edit().putString("attributionPriority",(String)priority.findViewById(priority.getCheckedRadioButtonId()).getTag()).apply();preferencesChanged();}));
            settingsAction(body,"Скрытые авторы",MUTED,this::hiddenAuthorsSettings);
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
        if(store.isHidden(p)){toast("Эта работа скрыта фильтрами содержимого");return;}hideKeyboard();cancel(detailTask);store.openWork(p);store.visit(p);store.markSeen(p);if(screens[2]!=null){screens[2].unreadKeys.remove(p.key());screens[2].unreadKeys.removeAll(p.memberKeys);}
        LinearLayout page=column();page.setBackgroundColor(BG);FeedListView list=new FeedListView(this);list.setHorizontalSwipeListener(this::navigate);list.setRecyclerListener(this::recycleImages);list.setRestoreListener(this::restoreCards);list.setVerticalScrollBarEnabled(false);list.setClipToPadding(false);page.addView(list,new LinearLayout.LayoutParams(-1,-1));
        LinearLayout header=column();int width=getResources().getDisplayMetrics().widthPixels;int height=p.width>0&&p.height>0?(int)((double)width*p.height/p.width):width;height=Math.max(width*2/3,Math.min(height,(int)(getResources().getDisplayMetrics().heightPixels*.78)));if(gallery!=null){if(gallery.viewportWidth==width)height=gallery.viewportHeight;else{gallery.viewportWidth=width;gallery.viewportHeight=height;}}
        LinearLayout mediaStrip=column();header.addView(mediaStrip);
        FrameLayout art=new FrameLayout(this);art.setBackgroundColor(Color.BLACK);ImageView image=new ImageView(this);image.setScaleType(ImageView.ScaleType.FIT_CENTER);image.setContentDescription("Открыть изображение на весь экран");art.addView(image,new FrameLayout.LayoutParams(-1,-1));
        image.setContentDescription("Изображение 1 из "+Math.max(1,p.media.size())+". Открыть на весь экран");
        if(p.isVideo()){image.setImageResource(android.R.drawable.ic_media_play);image.setOnClickListener(v->video(p));}else{images.bindProgressive(image,p.preview,p.image.isBlank()?p.preview:p.image,2000,0,null);image.setOnClickListener(v->{activeMediaIndex=0;fullscreenMedia(p,0);});}
        LinearLayout controls=row();FrameLayout back=artIconButton("back","Назад",this::goBack);touchBackground(back,Color.argb(110,0,0,0),24);controls.addView(back,new LinearLayout.LayoutParams(dp(48),dp(48)));controls.addView(new Space(this),new LinearLayout.LayoutParams(0,1,1));controls.addView(artIconButton("bookmark","Открытые работы",this::openWorks),new LinearLayout.LayoutParams(dp(48),dp(48)));FrameLayout share=artIconButton("share","Поделиться",()->share(p));controls.addView(share,new LinearLayout.LayoutParams(dp(48),dp(48)));FrameLayout.LayoutParams cl=new FrameLayout.LayoutParams(-1,dp(56),Gravity.TOP);cl.setMargins(dp(8),dp(4),dp(8),0);art.addView(controls,cl);
        TextView mediaLabel=text("",12,Color.WHITE);mediaLabel.setGravity(Gravity.CENTER);art.addView(mediaLabel,new FrameLayout.LayoutParams(-1,dp(40),Gravity.BOTTOM));mediaStrip.addView(art,new LinearLayout.LayoutParams(-1,height));
        LinearLayout info=column();info.setPadding(dp(16),dp(16),dp(16),dp(12));header.addView(info);TextView title=text(p.title,20,TEXT);title.setMaxLines(3);title.setEllipsize(TextUtils.TruncateAt.END);title.setTypeface(null,Typeface.BOLD);info.addView(title);TextView provenance=text(sourceName(p.source)+" · "+(CatalogLogic.matchesRating(p.rating,"general")?"Обычное":"18+")+(p.score>0?" · ♥ "+p.score:""),12,MUTED);provenance.setPadding(0,dp(6),0,dp(12));info.addView(provenance);
        LinearLayout actions=row();
        actions.addView(iconButton("share","Открыть источник",()->external(p.sourceUrl)),new LinearLayout.LayoutParams(dp(48),dp(48)));
        actions.addView(iconButton("download","Скачать оригинал",()->download(p)),new LinearLayout.LayoutParams(dp(48),dp(48)));
        TextView save=button(store.saved(p)?"▣ Сохранено":"▣ Закладка",BLUE,()->{});save.setTextSize(12);save.setOnClickListener(v->{boolean added=store.toggle(p);save.setText(added?"▣ Сохранено":"▣ Закладка");refreshCards();});LinearLayout.LayoutParams saveLayout=new LinearLayout.LayoutParams(0,dp(46),1);saveLayout.setMargins(dp(5),0,dp(4),0);actions.addView(save,saveLayout);
        TextView like=button(store.liked(p)?"♥ Нравится":"♡ Нравится",PINK,()->{});like.setTextSize(12);like.setOnClickListener(v->{boolean added=store.toggleLike(p);like.setText(added?"♥ Нравится":"♡ Нравится");likesChanged();});LinearLayout.LayoutParams likeLayout=new LinearLayout.LayoutParams(0,dp(46),1);likeLayout.setMargins(dp(4),0,0,0);actions.addView(like,likeLayout);info.addView(actions);
        TextView likedFeedback=likeFeedback(art);GestureDetector artGestures=new GestureDetector(this,new GestureDetector.SimpleOnGestureListener(){
            @Override public boolean onDown(MotionEvent event){return true;}
            @Override public boolean onSingleTapConfirmed(MotionEvent event){image.performClick();return true;}
            @Override public boolean onDoubleTap(MotionEvent event){likeArtwork(p,like,likedFeedback);return true;}
        });image.setOnTouchListener((v,event)->{artGestures.onTouchEvent(event);return true;});
        List<DetailMediaFrame> mediaFrames=new ArrayList<>();mediaFrames.add(new DetailMediaFrame(art,image,0,p.media.isEmpty()?p.image:p.media.get(0),true));
        for(int index=1;index<p.media.size();index++)mediaFrames.add(appendDetailMedia(p,mediaStrip,index,height,like));
        LinearLayout identities=column();identities.setPadding(0,dp(8),0,dp(8));info.addView(identities);addAttribution(identities,p);
        List<String> ordered=CatalogLogic.artworkTags(p);FlowLayout tags=new FlowLayout(this);tags.setPadding(0,dp(12),0,dp(8));info.addView(tags,new LinearLayout.LayoutParams(-1,-2));
        boolean[] expanded={false};Set<String> selected=new LinkedHashSet<>();
        TextView selectedSearch=button("Искать выбранные теги",BLUE,()->runSearch(String.join(" ",selected)));selectedSearch.setVisibility(View.GONE);
        LinearLayout.LayoutParams selectedLayout=new LinearLayout.LayoutParams(-1,dp(44));selectedLayout.setMargins(0,dp(8),0,dp(4));info.addView(selectedSearch,selectedLayout);
        TextView more=button("Ещё "+Math.max(0,ordered.size()-8)+" тегов",MUTED,()->{});
        Runnable fillTags=()->{
            tags.removeAllViews();
            for(String tag:ordered.subList(0,expanded[0]?ordered.size():Math.min(8,ordered.size()))){
                String kind=CatalogLogic.tagKind(p,tag),mode=store.recommendationTagMode(tag);
                int color=mode.equals("priority")?Color.rgb(255,206,74):mode.equals("disabled")?Color.rgb(243,118,119):
                    kind.equals("character")?Color.rgb(185,232,204):kind.equals("copyright")?Color.rgb(197,174,252):kind.equals("original")?Color.rgb(222,201,246):BLUE;
                TextView chip=button("#"+tag.replace('_',' '),color,()->runSearch(selected.isEmpty()?tag:String.join(" ",selected)));
                chip.setTextSize(12);chip.setMinHeight(dp(36));chip.setMaxWidth(width-dp(40));chip.setSingleLine(true);chip.setEllipsize(TextUtils.TruncateAt.END);chip.setPadding(dp(10),dp(7),dp(10),dp(7));
                int background=mode.equals("priority")?Color.rgb(76,58,23):mode.equals("disabled")?Color.rgb(71,33,35):kind.equals("character")?Color.rgb(34,55,46):kind.equals("copyright")?Color.rgb(51,42,72):kind.equals("original")?Color.rgb(52,42,64):RAISED;
                touchBackground(chip,selected.contains(tag)?Color.rgb(47,84,116):background,18);
                chip.setOnLongClickListener(v->{recommendationTagDialog(tag,()->{
                    String updated=store.recommendationTagMode(tag);chip.setTextColor(updated.equals("priority")?Color.rgb(255,206,74):updated.equals("disabled")?Color.rgb(243,118,119):color);
                    touchBackground(chip,updated.equals("priority")?Color.rgb(76,58,23):updated.equals("disabled")?Color.rgb(71,33,35):background,18);
                },()->{if(!selected.remove(tag))selected.add(tag);selectedSearch.setVisibility(selected.isEmpty()?View.GONE:View.VISIBLE);selectedSearch.setText("Искать выбранные · "+selected.size());chip.setAlpha(selected.contains(tag)?.65f:1f);});return true;});
                tags.addView(chip,new ViewGroup.LayoutParams(-2,-2));
            }
            more.setText(expanded[0]?"Свернуть теги":"Ещё "+Math.max(0,ordered.size()-8)+" тегов");
        };
        more.setOnClickListener(v->{expanded[0]=!expanded[0];fillTags.run();});fillTags.run();
        if(ordered.size()>8){LinearLayout.LayoutParams moreLayout=new LinearLayout.LayoutParams(-1,dp(44));moreLayout.setMargins(0,dp(12),0,dp(8));info.addView(more,moreLayout);}
        LinearLayout artistWorks=column();artistWorks.setPadding(0,dp(12),0,dp(12));header.addView(artistWorks);header.addView(section("Похожие иллюстрации","spark",BLUE));list.addHeaderView(header,null,false);
        Screen related=new Screen(5);related.restoreRow=first;related.restoreTop=top;related.artistWorks=artistWorks;related.anchor=p;related.list=list;related.view=page;related.status=text("Загрузка…",13,MUTED);related.status.setGravity(Gravity.CENTER);related.status.setPadding(dp(16),dp(18),dp(16),dp(24));related.status.setOnClickListener(v->statusAction(related));list.addFooterView(related.status,null,false);related.adapter=new FeedAdapter(related);list.setAdapter(related.adapter);
        if(addHistory)push(page);else{stopDetail();display(page);}activePost=p;activeGallery=gallery==null?findGallery(p):gallery;activeRelated=related;detailList=list;activeArt=image;activeMediaStrip=mediaStrip;activeMediaFrames=mediaFrames;detailMediaHeight=height;activeMediaLabel=mediaLabel;activeLikeButton=like;activeMediaIndex=0;authorTag="";updateMediaLabel();list.post(()->{if(activePost==p)updateDetailMediaWindow();});
        if(cached!=null&&cached.loaded){related.posts.addAll(cached.posts);related.fingerprints.addAll(cached.fingerprints);related.pages.putAll(cached.pages);related.jobs.addAll(cached.jobs);related.loaded=true;related.more=cached.more;related.failed=cached.failed;related.authBlocked=cached.authBlocked;related.authRequired.addAll(cached.authRequired);related.accessNotice=cached.accessNotice;related.adapter.notifyDataSetChanged();updateStatus(related);}else load(related,true);
        boolean[] touched={false};list.setOnTouchListener((v,e)->{if(e.getActionMasked()==MotionEvent.ACTION_MOVE)touched[0]=true;return false;});list.setOnScrollListener(new FeedListView.ScrollListener(){public void onScrollStateChanged(FeedListView v,int state){if(state==SCROLL_STATE_TOUCH_SCROLL)related.restoreRow=-1;}public void onScroll(FeedListView v,int firstVisible,int visible,int total){if(currentView==page)updateDetailMediaWindow();prefetchCards(related,Math.max(0,firstVisible-1));if(currentView==page&&related.loaded&&!related.loading&&!related.failed&&related.more&&needsPage(related))load(related,false);}});
        related.loadedCallback=()->{};
        prefetchNeighbors(p);prepareGalleryPage();
        String filter=rating;Map<String,Integer> pages=selectedPages();detailTask=submitNetwork(()->{String confirmedTag=p.artistTag;if(!p.source.equals("danbooru"))try{Post enriched=Post.fromJson(p.toJson());client.enrich(enriched);confirmedTag=enriched.artistTag;main.post(()->{if(destroyed||currentView!=page)return;p.artistTag=enriched.artistTag;p.artist=enriched.artist;p.artistTags=enriched.artistTags;p.characterTags=enriched.characterTags;p.copyrightTags=enriched.copyrightTags;p.tags=enriched.tags;if(p.source.equals("sankaku")){p.title=enriched.title;title.setText(p.title);p.originalUrl=enriched.originalUrl;CatalogLogic.refreshSignedMedia(p,enriched);syncDetailMedia(p);}ordered.clear();ordered.addAll(CatalogLogic.artworkTags(p));reseedRelated(related,p);identities.removeAllViews();addAttribution(identities,p);fillTags.run();store.refreshCachedPost(p);});}catch(SankakuApi.AccessException error){main.post(()->{if(!destroyed&&currentView==page)accessPrompt(error);});}catch(Exception error){if(p.source.equals("sankaku"))main.post(()->{if(!destroyed&&currentView==page)toast("Не удалось обновить работу Sankaku. Повторите открытие.");});}if(confirmedTag.isBlank())return;String authorQuery=confirmedTag;CatalogClient.Page authored=client.search(authorQuery,pages,filter,"latest");main.post(()->{if(destroyed||currentView!=page)return;List<Post> works=store.visible(CatalogLogic.excludeSaved(authored.posts,List.of(p)),false);if(works.isEmpty())return;related.pendingArtistWorks=new ArrayList<>(works.subList(0,Math.min(works.size(),8)));related.pendingArtistGallery=serverGallery(works,authorQuery,"latest",authored,pages);applyPreparedArtistWorks(related);});});
    }
    private DetailMediaFrame appendDetailMedia(Post post,LinearLayout strip,int index,int height,TextView like){
        FrameLayout frame=new FrameLayout(this);frame.setBackgroundColor(Color.BLACK);
        ImageView image=new ImageView(this);image.setScaleType(ImageView.ScaleType.FIT_CENTER);
        image.setContentDescription("Изображение "+(index+1)+" из "+post.media.size()+". Открыть на весь экран");
        frame.addView(image,new FrameLayout.LayoutParams(-1,-1));
        TextView feedback=likeFeedback(frame);
        image.setOnClickListener(v->{activeMediaIndex=index;Post media=mediaPost(post,index);if(media.isVideo())video(media);else fullscreenMedia(post,index);});
        GestureDetector gestures=new GestureDetector(this,new GestureDetector.SimpleOnGestureListener(){
            @Override public boolean onDown(MotionEvent event){return true;}
            @Override public boolean onSingleTapConfirmed(MotionEvent event){image.performClick();return true;}
            @Override public boolean onDoubleTap(MotionEvent event){likeArtwork(post,like,feedback);return true;}
        });
        image.setOnTouchListener((v,event)->{gestures.onTouchEvent(event);return true;});
        LinearLayout.LayoutParams layout=new LinearLayout.LayoutParams(-1,height);layout.topMargin=dp(8);strip.addView(frame,layout);
        return new DetailMediaFrame(frame,image,index,post.media.get(index),false);
    }
    private void syncDetailMedia(Post post){
        if(activePost!=post||activeMediaStrip==null||activeMediaFrames.isEmpty())return;
        String first=post.media.isEmpty()?post.image:post.media.get(0);DetailMediaFrame primary=activeMediaFrames.get(0);
        if(!primary.url.equals(first)){
            primary.url=first;
            if(post.isVideo()){images.cancel(primary.image);primary.image.setImageResource(android.R.drawable.ic_media_play);}
            else images.bindProgressive(primary.image,post.preview,post.image.isBlank()?post.preview:post.image,2000,0,null);
        }
        for(int i=1;i<post.media.size();i++){
            if(i>=activeMediaFrames.size())activeMediaFrames.add(appendDetailMedia(post,activeMediaStrip,i,detailMediaHeight,activeLikeButton));
            else{DetailMediaFrame frame=activeMediaFrames.get(i);String url=post.media.get(i);if(!frame.url.equals(url)){images.cancel(frame.image);frame.image.setImageDrawable(null);frame.url=url;frame.bound=false;}}
        }
        while(activeMediaFrames.size()>Math.max(1,post.media.size())){
            DetailMediaFrame removed=activeMediaFrames.remove(activeMediaFrames.size()-1);images.cancel(removed.image);activeMediaStrip.removeView(removed.frame);
        }
        for(DetailMediaFrame frame:activeMediaFrames)frame.image.setContentDescription("Изображение "+(frame.index+1)+" из "+activeMediaFrames.size()+". Открыть на весь экран");
        activeMediaIndex=Math.min(activeMediaIndex,activeMediaFrames.size()-1);updateDetailMediaWindow();
    }
    private void updateDetailMediaWindow(){
        if(detailList==null||activeMediaFrames.isEmpty()||!detailList.isAttachedToWindow())return;
        int[] viewport=new int[2];detailList.getLocationOnScreen(viewport);
        int top=viewport[1],bottom=top+detailList.getHeight(),lookahead=detailList.getHeight();
        int[] location=new int[2];int bestOverlap=0,bestIndex=activeMediaIndex;
        for(DetailMediaFrame media:activeMediaFrames){
            if(!media.frame.isAttachedToWindow()){
                if(media.index>0&&media.bound){images.cancel(media.image);media.image.setImageDrawable(null);media.bound=false;}
                continue;
            }
            media.frame.getLocationOnScreen(location);int imageTop=location[1],imageBottom=imageTop+media.frame.getHeight();
            int overlap=Math.max(0,Math.min(imageBottom,bottom)-Math.max(imageTop,top));
            if(overlap>bestOverlap){bestOverlap=overlap;bestIndex=media.index;}
            if(media.index==0)continue;
            boolean nearby=imageBottom>top-lookahead&&imageTop<bottom+lookahead;
            if(nearby&&!media.bound){
                Post item=mediaPost(activePost,media.index);
                if(item.isVideo())media.image.setImageResource(android.R.drawable.ic_media_play);
                else images.bindProgressive(media.image,"",media.url,2000,1,null);
                media.bound=true;
            }else if(!nearby&&media.bound){images.cancel(media.image);media.image.setImageDrawable(null);media.bound=false;}
        }
        if(bestOverlap>0)activeMediaIndex=bestIndex;
    }
    private Gallery findGallery(Post p){for(Screen s:screens)if(s!=null&&s.view==currentView)return new Gallery(s.posts,s);return new Gallery(new ArrayList<>(List.of(p)),null);}
    private void prefetchNeighbors(Post p){images.cancelPrefetch();for(int i=1;i<Math.min(p.media.size(),3);i++)if(!mediaPost(p,i).isVideo())images.prefetch(p.media.get(i),720);if(activeGallery==null)return;for(int delta:new int[]{1,2,3,-1}){Post neighbor=CatalogLogic.neighbor(activeGallery.posts,p,delta);if(neighbor!=null&&!neighbor.isVideo()){images.prefetch(cardPreview(neighbor),720);if(Math.abs(delta)==1)images.prefetch(neighbor.image.isBlank()?neighbor.preview:neighbor.image,2000);}}}
    private void prefetchSourceNext(Screen source){
        if(activeGallery==null||activeGallery.source!=source||activePost==null)return;
        int index=-1;for(int i=0;i<source.posts.size();i++){Post post=source.posts.get(i);if(post.key().equals(activePost.key())||post.memberKeys.contains(activePost.key())){index=i;break;}}
        if(index<0)return;for(int i=index+1;i<Math.min(index+4,source.posts.size());i++){
            Post next=source.posts.get(i);if(next.isVideo())continue;
            images.prefetch(cardPreview(next),720);if(i==index+1)images.prefetch(next.image.isBlank()?next.preview:next.image,2000);
        }
    }
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
        Post next=context==null?null:CatalogLogic.neighbor(context.posts,selected,request.delta);
        if(next!=null){prepareNavigation(request,next);return;}
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
    private void setNavigationLoading(){if(activeMediaLabel!=null){if(activeFullscreenStatus!=null)activeFullscreenStatus.setText("Загрузка…");activeMediaLabel.setText("Загрузка…");activeMediaLabel.setContentDescription("Подготовка следующей иллюстрации");activeMediaLabel.setVisibility(View.VISIBLE);}}
    private void finishNavigation(NavigationRequest request){
        if(request==null||navigating!=request)return;clearNavigationWait();images.cancelPreparation(navigationPreview);navigationPreview=null;navigating=null;updateMediaLabel();main.post(this::drainNavigation);
    }
    private void prepareNavigation(NavigationRequest request,Post target){
        Post previous=activePost;Gallery context=activeGallery;
        String preview=target.preview;
        Runnable ready=()->{
            if(!navigationAlive(request)||activePost!=previous||activeGallery!=context){finishNavigation(request);return;}
            navigationPreview=null;
            navigationRendering=true;transitionDirection=request.arrived==null?request.delta:0;
            try{renderDetail(target,false,0,0,null,context);if(detailList!=null)detailList.setSelectionFromTop(0,0);}finally{navigationRendering=false;transitionDirection=0;}
            if(activePost!=target){finishNavigation(request);return;}
            if(request.arrived!=null){request.arrived.run();if(pageAnimator==null)finishNavigation(request);}
        };
        String full=target.image.isBlank()?target.preview:target.image;
        if(target.isVideo()||images.hasBitmap(preview,720)||images.hasBitmap(full,720)||images.hasBitmap(full,2000)||images.hasBitmap(full,2400)){ready.run();return;}
        setNavigationLoading();navigationPreview=images.prepare(preview,720,success->{
            if(!navigationAlive(request))return;
            if(success){ready.run();return;}
            if(!full.equals(preview)&&CatalogLogic.isMediaUrl(full))navigationPreview=images.prepare(full,720,fallback->{if(!navigationAlive(request))return;if(fallback)ready.run();else navigationImageFailed(request);});
            else navigationImageFailed(request);
        });
    }
    private void navigationImageFailed(NavigationRequest request){navigationQueue.clear();finishNavigation(request);if(activeMediaLabel!=null){if(activeFullscreenStatus!=null)activeFullscreenStatus.setText("Ошибка · повторить →");activeMediaLabel.setText("Ошибка изображения · повторить →");activeMediaLabel.setContentDescription("Не удалось подготовить изображение. Повторите перелистывание.");activeMediaLabel.setVisibility(View.VISIBLE);}}
    private void applyGallerySequence(Post current,Gallery context,List<Post> sequence,int revision){
        String selected=current.media.isEmpty()?current.image:current.media.get(Math.min(activeMediaIndex,current.media.size()-1));
        context.posts.clear();context.posts.addAll(sequence);context.syncedRevision=revision;
        for(Post equivalent:sequence)if(equivalent.key().equals(current.key())||equivalent.memberKeys.contains(current.key())){
            if(CatalogLogic.updateGalleryMedia(current,equivalent)){activeMediaIndex=Math.max(0,current.media.indexOf(selected));syncDetailMedia(current);store.openWork(current);}
            break;
        }
    }
    private Post mediaPost(Post p,int index){if(index<=0||index>=p.media.size())return p;Post media=Post.fromJson(p.toJson());media.image=p.media.get(index);media.original=media.image;media.media=new ArrayList<>(List.of(media.image));for(int i=0;i<p.imageRecords.length();i++){JSONObject record=p.imageRecords.optJSONObject(i);if(record!=null&&record.optString("url").equals(media.image)&&record.optString("source").equals("sankaku")&&CatalogLogic.validId("sankaku",record.optString("id"))){media.source="sankaku";media.id=record.optString("id");media.hash=record.optString("hash");media.imageRecords=new JSONArray().put(record);break;}}return media;}
    private void updateMediaLabel(){if(activeFullscreenStatus!=null)activeFullscreenStatus.setText("");if(activeMediaLabel==null)return;activeMediaLabel.setText("");activeMediaLabel.setContentDescription("");activeMediaLabel.setVisibility(View.GONE);}
    private void addAttribution(LinearLayout info,Post p){
        String priority=store.prefs.getString("attributionPriority","creator");if(priority.equals("original")&&!p.originalUrl.isBlank())menuRow(info,"share","Исходная публикация · "+Uri.parse(p.originalUrl).getHost(),()->external(p.originalUrl));if(priority.equals("uploader")&&!p.uploaderName.isBlank())menuRow(info,"profile","Загрузчик · "+p.uploaderName,()->uploader(p));
        List<String> authors=p.artistTags.isEmpty()?(p.artistTag.isBlank()?List.of():List.of(p.artistTag)):p.artistTags;
        if(authors.isEmpty()){TextView unknown=text("Автор не указан",15,MUTED);unknown.setPadding(0,dp(20),0,dp(12));info.addView(unknown);}else for(String tag:authors){LinearLayout author=row();author.setPadding(0,dp(18),0,dp(14));TextView avatar=text(tag.substring(0,1).toUpperCase(Locale.ROOT),21,TEXT);avatar.setGravity(Gravity.CENTER);avatar.setBackground(rounded(sourceColor(p.source),28));avatar.setOnClickListener(v->authorProfile(tag));author.addView(avatar,new LinearLayout.LayoutParams(dp(44),dp(44)));LinearLayout identity=column();identity.setPadding(dp(12),0,dp(6),0);TextView name=text(tag.equals(p.artistTag)?p.artist:tag.replace('_',' '),15,TEXT);name.setTypeface(null,Typeface.BOLD);name.setMaxLines(2);identity.addView(name);identity.addView(text("Художник · открыть профиль",11,MUTED));identity.setContentDescription("Профиль художника "+tag);identity.setOnClickListener(v->authorProfile(tag));author.addView(identity,new LinearLayout.LayoutParams(0,-2,1));TextView follow=button(store.following(tag)?"Вы подписаны":"Подписаться",BLUE,()->{});follow.setTextSize(12);follow.setPadding(dp(10),0,dp(10),0);follow.setOnClickListener(v->{store.toggleFollow(tag);follow.setText(store.following(tag)?"Вы подписаны":"Подписаться");screens[2]=null;});author.addView(follow);info.addView(author);}
        if(!p.originalUrl.isBlank()&&!priority.equals("original"))menuRow(info,"share","Исходная публикация",()->external(p.originalUrl));if(!p.uploaderName.isBlank()&&!priority.equals("uploader"))menuRow(info,"profile","Загрузчик · "+p.uploaderName,()->uploader(p));
    }
    private void uploader(Post p){
        if(p.source.equals("danbooru")){external("https://danbooru.donmai.us/users/"+CatalogClient.encode(p.uploaderId));return;}
        String id=p.uploaderName.isBlank()?p.uploaderId:p.uploaderName;
        if(id.isBlank()){toast("У этой работы нет имени загрузчика");return;}
        renderUploader(p.source,id,id,true,null,0,0);
    }
    private void authorProfile(String tag){renderAuthor(tag,true,null,0,0);}
    private void renderAuthor(String tag,boolean pushPage,ScreenState cached,int first,int top){
        if(tag.startsWith("uploader|")){
            String[] route=tag.split("\\|",3);
            if(route.length==3&&Arrays.asList(CatalogClient.SOURCES).contains(route[1])){renderUploader(route[1],route[2],route[2].replace('_',' '),pushPage,cached,first,top);return;}
        }
        LinearLayout page=column();LinearLayout bar=toolbar("Художник",this::goBack);bar.addView(iconButton("bookmark","Открытые работы",this::openWorks),new LinearLayout.LayoutParams(dp(48),dp(48)));page.addView(bar);FeedListView list=new FeedListView(this);list.setRecyclerListener(this::recycleImages);list.setRestoreListener(this::restoreCards);list.setVerticalScrollBarEnabled(false);page.addView(list,new LinearLayout.LayoutParams(-1,0,1));LinearLayout header=column();header.setPadding(dp(16),dp(18),dp(16),dp(14));TextView name=text(tag.replace('_',' '),23,TEXT);name.setTypeface(null,Typeface.BOLD);header.addView(name);TextView subtitle=text("Художник · "+(rating.equals("general")?"Обычные работы":rating.equals("explicit")?"Работы 18+":"Все рейтинги")+"\nВо всех подключённых источниках",13,MUTED);subtitle.setPadding(0,dp(8),0,dp(16));header.addView(subtitle);TextView follow=button(store.following(tag)?"Вы подписаны":"Подписаться",BLUE,()->{});follow.setOnClickListener(v->{store.toggleFollow(tag);follow.setText(store.following(tag)?"Вы подписаны":"Подписаться");screens[2]=null;});header.addView(follow,new LinearLayout.LayoutParams(-1,dp(46)));header.addView(section("Иллюстрации","new",BLUE));list.addHeaderView(header,null,false);Screen screen=new Screen(6);screen.restoreRow=first;screen.restoreTop=top;screen.query=tag;screen.view=page;screen.list=list;screen.status=text("",13,MUTED);screen.status.setGravity(Gravity.CENTER);screen.status.setPadding(dp(16),dp(18),dp(16),dp(24));screen.status.setOnClickListener(v->load(screen,!screen.loaded));list.addFooterView(screen.status,null,false);screen.adapter=new FeedAdapter(screen);list.setAdapter(screen.adapter);
        TextView hidden=button(store.hiddenAuthor("artist",tag)?"Показывать автора":"Скрыть автора",MUTED,()->{});
        hidden.setOnClickListener(v->{boolean conceal=!store.hiddenAuthor("artist",tag);store.setHiddenAuthor("artist",tag,conceal);hidden.setText(conceal?"Показывать автора":"Скрыть автора");invalidateScreens();load(screen,true);});
        header.addView(hidden,new LinearLayout.LayoutParams(-1,dp(44)));
        if(pushPage)push(page);else{stopDetail();activePost=null;display(page);}authorTag=tag;activeAuthor=screen;
        if(cached!=null&&cached.loaded){screen.posts.addAll(cached.posts);screen.fingerprints.addAll(cached.fingerprints);screen.pages.putAll(cached.pages);screen.loaded=true;screen.more=cached.more;screen.failed=cached.failed;screen.authBlocked=cached.authBlocked;screen.authRequired.addAll(cached.authRequired);screen.accessNotice=cached.accessNotice;screen.adapter.notifyDataSetChanged();updateStatus(screen);}else load(screen,true);
        list.setOnScrollListener(new FeedListView.ScrollListener(){public void onScrollStateChanged(FeedListView v,int state){if(state==SCROLL_STATE_TOUCH_SCROLL)screen.restoreRow=-1;}public void onScroll(FeedListView v,int pos,int visible,int total){prefetchCards(screen,Math.max(0,pos-1));if(currentView==page&&screen.loaded&&!screen.loading&&!screen.failed&&screen.more&&needsPage(screen))load(screen,false);}});
    }
    private void renderUploader(String source,String id,String displayName,boolean pushPage,ScreenState cached,int first,int top){
        if(id.isBlank()||!Arrays.asList(CatalogClient.SOURCES).contains(source)){toast("Профиль загрузчика недоступен");return;}
        LinearLayout page=column();page.addView(toolbar("Профиль",this::goBack));
        FeedListView list=new FeedListView(this);list.setRecyclerListener(this::recycleImages);list.setRestoreListener(this::restoreCards);list.setVerticalScrollBarEnabled(false);page.addView(list,new LinearLayout.LayoutParams(-1,0,1));
        LinearLayout header=column();header.setPadding(dp(16),dp(18),dp(16),dp(14));TextView name=text(displayName,23,TEXT);name.setTypeface(null,Typeface.BOLD);header.addView(name);
        TextView subtitle=text("Загрузчик · "+sourceName(source)+"\nРаботы из этого источника",13,MUTED);subtitle.setPadding(0,dp(8),0,dp(16));header.addView(subtitle);
        TextView follow=button(store.followingUploader(source,id)?"Вы подписаны":"Подписаться",BLUE,()->{});follow.setOnClickListener(v->{store.toggleFollowUploader(source,id,displayName);follow.setText(store.followingUploader(source,id)?"Вы подписаны":"Подписаться");screens[2]=null;});header.addView(follow,new LinearLayout.LayoutParams(-1,dp(46)));
        TextView hidden=button(store.hiddenAuthor(source,id)?"Показывать загрузчика":"Скрыть загрузчика",MUTED,()->{});hidden.setOnClickListener(v->{boolean conceal=!store.hiddenAuthor(source,id);store.setHiddenAuthor(source,id,conceal);hidden.setText(conceal?"Показывать загрузчика":"Скрыть загрузчика");invalidateScreens();load(activeAuthor,true);});header.addView(hidden,new LinearLayout.LayoutParams(-1,dp(44)));
        header.addView(section("Иллюстрации","new",BLUE));list.addHeaderView(header,null,false);
        Screen screen=new Screen(7);screen.restoreRow=first;screen.restoreTop=top;screen.query="user:"+id.replace(' ','_');screen.scopedSource=source;screen.view=page;screen.list=list;screen.status=text("",13,MUTED);screen.status.setGravity(Gravity.CENTER);screen.status.setPadding(dp(16),dp(18),dp(16),dp(24));screen.status.setOnClickListener(v->load(screen,!screen.loaded));list.addFooterView(screen.status,null,false);screen.adapter=new FeedAdapter(screen);list.setAdapter(screen.adapter);
        if(pushPage)push(page);else{stopDetail();activePost=null;display(page);}authorTag="uploader|"+source+"|"+id;activeAuthor=screen;
        if(cached!=null&&cached.loaded){screen.posts.addAll(cached.posts);screen.fingerprints.addAll(cached.fingerprints);screen.pages.putAll(cached.pages);screen.loaded=true;screen.more=cached.more;screen.failed=cached.failed;screen.authBlocked=cached.authBlocked;screen.authRequired.addAll(cached.authRequired);screen.accessNotice=cached.accessNotice;screen.adapter.notifyDataSetChanged();updateStatus(screen);}else load(screen,true);
        list.setOnScrollListener(new FeedListView.ScrollListener(){public void onScrollStateChanged(FeedListView v,int state){if(state==SCROLL_STATE_TOUCH_SCROLL)screen.restoreRow=-1;}public void onScroll(FeedListView v,int pos,int visible,int total){prefetchCards(screen,Math.max(0,pos-1));if(currentView==page&&screen.loaded&&!screen.loading&&!screen.failed&&screen.more&&needsPage(screen))load(screen,false);}});
    }
    private void openWorks(){
        Dialog dialog=new Dialog(this);LinearLayout sheet=column();sheet.setPadding(dp(16),dp(16),dp(16),dp(16));sheet.setBackgroundColor(PANEL);sheet.addView(text("Открытые работы",20,TEXT));EditText search=new EditText(this);search.setSingleLine(true);search.setTextColor(TEXT);search.setHintTextColor(MUTED);search.setHint("Найти открытую работу");sheet.addView(search);ScrollView scroll=new ScrollView(this);LinearLayout entries=column();scroll.addView(entries);sheet.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));Runnable fill=()->{entries.removeAllViews();for(Post post:store.openWorks()){if(!post.title.toLowerCase(Locale.ROOT).contains(search.getText().toString().toLowerCase(Locale.ROOT)))continue;LinearLayout row=row();TextView title=text(post.title,14,TEXT);title.setMaxLines(2);title.setPadding(dp(4),dp(8),dp(4),dp(8));title.setOnClickListener(v->{dialog.dismiss();openArtwork(post,new Gallery(store.openWorks(),null));});row.addView(title,new LinearLayout.LayoutParams(0,dp(56),1));row.addView(button(store.pinned(post)?"★":"☆",BLUE,()->{store.pin(post);dialog.dismiss();openWorks();}),new LinearLayout.LayoutParams(dp(52),dp(44)));if(!store.pinned(post))row.addView(button("×",MUTED,()->{store.closeWork(post);dialog.dismiss();openWorks();}),new LinearLayout.LayoutParams(dp(44),dp(44)));entries.addView(row);}};search.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int start,int count,int after){}public void onTextChanged(CharSequence s,int start,int before,int count){fill.run();}public void afterTextChanged(Editable e){}});fill.run();sheet.addView(button("Готово",BLUE,dialog::dismiss));dialog.setContentView(sheet);dialog.show();Window w=dialog.getWindow();if(w!=null)w.setLayout(-1,(int)(getResources().getDisplayMetrics().heightPixels*.72));
    }
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
    private void fullscreenMedia(Post p,int mediaIndex){withSankakuMedia(mediaPost(p,mediaIndex),fresh->{if(fresh.source.equals("sankaku")){CatalogLogic.refreshSignedMedia(p,fresh);syncDetailMedia(p);}fullscreenMediaReady(p,mediaIndex);});}
    private void fullscreenMediaReady(Post p,int mediaIndex){
        Post selectedMedia=mediaPost(p,mediaIndex);if(selectedMedia.isVideo()){videoReady(selectedMedia);return;}Dialog dialog=new Dialog(this,android.R.style.Theme_Material_NoActionBar_Fullscreen);FrameLayout frame=new FrameLayout(this);frame.setBackgroundColor(Color.BLACK);viewerInsets(frame);ZoomImageView image=new ZoomImageView(this);frame.addView(image,new FrameLayout.LayoutParams(-1,-1));String url=mediaIndex==0?(p.original.isBlank()?p.image:p.original):p.media.get(mediaIndex);images.bindProgressive(image,mediaIndex==0?p.preview:"",url,2400,0,()->image.post(image::fit));image.setContentDescription("Иллюстрация #"+p.id+" · изображение "+(mediaIndex+1)+" из "+p.media.size()+". Свайп листает работы, двойное нажатие ставит лайк, два пальца масштабируют.");
        Runnable previous=()->navigate(-1,()->turnFullscreen(image,frame,-1),dialog::isShowing);Runnable next=()->navigate(1,()->turnFullscreen(image,frame,1),dialog::isShowing);image.onPrevious=previous;image.onNext=next;TextView likedFeedback=likeFeedback(frame);image.onDoubleTapLike=()->{if(activePost!=null)likeArtwork(activePost,null,likedFeedback);};LinearLayout bar=row();bar.setPadding(dp(8),dp(16),dp(8),0);bar.addView(artIconButton("back","Закрыть просмотр",dialog::dismiss),new LinearLayout.LayoutParams(dp(48),dp(48)));bar.addView(new Space(this),new LinearLayout.LayoutParams(0,1,1));bar.addView(artIconButton("download","Скачать оригинал",()->download(activePost)),new LinearLayout.LayoutParams(dp(48),dp(48)));frame.addView(bar,new FrameLayout.LayoutParams(-1,dp(72),Gravity.TOP));activeFullscreenStatus=text("",12,Color.WHITE);activeFullscreenStatus.setGravity(Gravity.CENTER);frame.addView(activeFullscreenStatus,new FrameLayout.LayoutParams(-1,dp(44),Gravity.BOTTOM));dialog.setContentView(frame);dialog.setOnDismissListener(v->{activeFullscreenStatus=null;cancelNavigation();images.cancel(image);});dialog.show();
    }
    private void turnFullscreen(ZoomImageView image,FrameLayout parent,int direction){
        Post p=activePost;int index=activeMediaIndex;if(p==null){finishNavigation(navigating);return;}
        ImageView previous=new ImageView(this);previous.setScaleType(image.getScaleType());previous.setImageDrawable(image.getDrawable());previous.setImageMatrix(image.getImageMatrix());outgoingMedia=previous;parent.addView(previous,1,new FrameLayout.LayoutParams(-1,-1));
        Post media=mediaPost(p,index);if(media.isVideo()){images.cancel(image);image.setScaleType(ImageView.ScaleType.FIT_CENTER);image.setImageResource(android.R.drawable.ic_media_play);image.setOnClickListener(v->video(media));}
        else{image.setScaleType(ImageView.ScaleType.MATRIX);image.setOnClickListener(null);String url=index==0?(p.original.isBlank()?p.image:p.original):p.media.get(index);images.bindProgressive(image,index==0?p.preview:"",url,2400,0,()->image.post(image::fit));image.fit();}
        image.setContentDescription("Иллюстрация #"+p.id+" · изображение "+(index+1)+" из "+p.media.size()+". Свайп листает работы, двойное нажатие ставит лайк, два пальца масштабируют.");
        animateTurn(previous,image,direction,()->{parent.removeView(previous);previous.setImageDrawable(null);outgoingMedia=null;});
    }
    private void video(Post p){withSankakuMedia(p,this::videoReady);}
    private void videoReady(Post p){if(!CatalogLogic.isMediaUrl(p.image)){toast("Видео недоступно");return;}Dialog dialog=new Dialog(this,android.R.style.Theme_Material_NoActionBar_Fullscreen);FrameLayout frame=new FrameLayout(this);frame.setBackgroundColor(Color.BLACK);viewerInsets(frame);VideoView video=new VideoView(this);FrameLayout.LayoutParams vp=new FrameLayout.LayoutParams(-1,-1,Gravity.CENTER);frame.addView(video,vp);MediaController controller=new MediaController(this);controller.setAnchorView(video);video.setMediaController(controller);video.setVideoURI(Uri.parse(p.image),Map.of("Referer",CatalogLogic.mediaReferer(p.image)));video.setOnPreparedListener(player->{player.setLooping(true);video.start();});video.setOnErrorListener((player,what,extra)->{toast("Этот формат видео не поддерживается устройством");return true;});FrameLayout close=iconButton("back","Закрыть видео",dialog::dismiss);frame.addView(close,new FrameLayout.LayoutParams(dp(52),dp(52),Gravity.TOP|Gravity.LEFT));dialog.setContentView(frame);dialog.setOnDismissListener(v->video.stopPlayback());dialog.show();}
    private TextView likeFeedback(FrameLayout parent){TextView heart=text("♥",76,Color.WHITE);heart.setGravity(Gravity.CENTER);heart.setAlpha(0);heart.setVisibility(View.GONE);heart.setShadowLayer(dp(12),0,dp(3),Color.argb(150,0,0,0));parent.addView(heart,new FrameLayout.LayoutParams(dp(130),dp(130),Gravity.CENTER));return heart;}
    private void likeArtwork(Post post,TextView action,TextView feedback){boolean added=store.like(post);if(added)likesChanged();if(action!=null)action.setText("♥ Нравится");if(activePost!=null&&activePost.key().equals(post.key())&&activeLikeButton!=null)activeLikeButton.setText("♥ Нравится");feedback.animate().cancel();feedback.setVisibility(View.VISIBLE);feedback.setAlpha(0);feedback.setScaleX(.65f);feedback.setScaleY(.65f);feedback.animate().alpha(1).scaleX(1.15f).scaleY(1.15f).setDuration(170).withEndAction(()->feedback.animate().alpha(0).scaleX(1f).scaleY(1f).setDuration(260).setStartDelay(220).withEndAction(()->feedback.setVisibility(View.GONE)).start()).start();}
    private void likesChanged(){Screen home=screens[0];if(home!=null&&home.homeTab==0){home.loaded=false;home.recommendationModel=null;}refreshCards();}
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
    private void goBack(){hideKeyboard();stopDetail();detachScreen(activeAuthor);activeAuthor=null;authorTag="";if(!backStack.isEmpty()){BackEntry entry=backStack.pop();nav=entry.nav;buildBottom();if(entry.detail!=null){renderDetail(entry.detail,false,entry.scroll,entry.top,entry.related,entry.gallery);if(activePost!=null&&entry.mediaIndex<activePost.media.size())activeMediaIndex=Math.max(0,entry.mediaIndex);}else if(entry.author!=null)renderAuthor(entry.author,false,entry.related,entry.scroll,entry.top);else{activePost=null;activeGallery=null;display(entry.view);for(Screen s:screens)if(s!=null&&s.view==entry.view&&!s.loaded&&s.tab!=3){if(s.tab==1&&s.query.isBlank())loadExplore(s);else load(s,true);break;}}refreshCards();}else selectNav(nav);}
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
