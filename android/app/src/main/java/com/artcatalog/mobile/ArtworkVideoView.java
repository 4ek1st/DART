package com.artcatalog.mobile;

import android.content.Context;
import android.graphics.Bitmap;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.PixelCopy;
import android.view.SurfaceHolder;
import android.view.View;
import android.widget.ImageView;
import android.widget.MediaController;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.VideoView;
import java.util.Map;
import java.util.function.BooleanSupplier;
import java.util.function.Function;

/** Owns a native playback attempt without ever treating prepared as a decoded frame. */
final class ArtworkVideoView extends VideoView {
    private final VideoPlaybackState state=new VideoPlaybackState();
    private final Handler main=new Handler(Looper.getMainLooper());
    private ImageView poster;private TextView status;private ProgressBar progress;
    private BooleanSupplier alive=()->false;private Function<String,String> translate=value->value;
    private Runnable retry,playbackError,deadline,probe;private MediaPlayer activePlayer;private MediaController controls;private View.OnTouchListener videoGestures;
    private long token,preparedAt;private boolean resumeOnVisible,copying,userPaused;
    ArtworkVideoView(Context context){
        super(context);
        getHolder().addCallback(new SurfaceHolder.Callback(){
            public void surfaceCreated(SurfaceHolder holder){}
            public void surfaceChanged(SurfaceHolder holder,int format,int width,int height){}
            public void surfaceDestroyed(SurfaceHolder holder){if(valid(token)&&state.surfaceLost(token)){activePlayer=null;showPoster();loadingUi();}}
        });
    }
    long begin(ImageView poster,TextView status,ProgressBar progress,BooleanSupplier alive,
            Function<String,String> translate,Runnable retry,Runnable playbackError){
        stopSession();this.poster=poster;this.status=status;this.progress=progress;this.alive=alive;
        this.translate=translate;this.retry=retry;this.playbackError=playbackError;userPaused=false;token=state.begin();
        // ImageView.setAlpha(int) uses 0..255; use View's float opacity for the poster layer.
        poster.animate().cancel();poster.setAlpha(1f);poster.setVisibility(VISIBLE);
        poster.setOnTouchListener(videoGestures);
        status.setOnClickListener(view->{if(state.failed()&&this.retry!=null)this.retry.run();});
        loadingUi();armDeadline(token);trace("loading");return token;
    }
    boolean valid(long selected){return state.current(selected)&&alive.getAsBoolean();}
    void source(long selected,String url,Map<String,String> headers){
        if(!valid(selected))return;
        try{
            activePlayer=null;super.stopPlayback();
            // Install every callback before opening even a very fast local source.
            setOnPreparedListener(player->{
                if(!valid(selected)||!state.prepared(selected))return;
                activePlayer=player;preparedAt=SystemClock.elapsedRealtime();
                try{player.setLooping(true);player.setVideoScalingMode(MediaPlayer.VIDEO_SCALING_MODE_SCALE_TO_FIT);
                    loadingUi();trace("prepared-poster-retained");if(getWindowVisibility()==VISIBLE&&!userPaused)start();
                }catch(RuntimeException failure){failed(selected);if(playbackError!=null)playbackError.run();}
            });
            setOnInfoListener((player,what,extra)->{
                if(!valid(selected)||activePlayer!=player)return true;
                if(what==MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START)showFirstFrame(selected,"render-info");
                else if(what==MediaPlayer.MEDIA_INFO_BUFFERING_START){state.buffering(selected,true);loadingUi();}
                else if(what==MediaPlayer.MEDIA_INFO_BUFFERING_END){state.buffering(selected,false);loadingUi();}
                return true;
            });
            setOnErrorListener((player,what,extra)->{
                if(valid(selected)){failed(selected);if(playbackError!=null)playbackError.run();}
                return true;
            });
            setOnCompletionListener(player->{if(valid(selected)&&activePlayer==player&&!state.failed())start();});
            setVideoURI(Uri.parse(url),headers);setVisibility(VISIBLE);requestLayout();
        }catch(RuntimeException failure){if(valid(selected)){failed(selected);if(playbackError!=null)playbackError.run();}}
    }
    void failed(long selected){
        if(!valid(selected)||!state.fail(selected))return;
        clearTimers();try{super.stopPlayback();}catch(RuntimeException ignored){}activePlayer=null;
        showPoster();progress.setVisibility(GONE);status.setVisibility(VISIBLE);status.setText(translate.apply("Video could not load. Tap to retry."));
        status.setContentDescription(status.getText());status.setClickable(true);status.setFocusable(true);trace("failed-poster-retained");
    }
    private void showPoster(){if(poster!=null){poster.animate().cancel();poster.setAlpha(1f);poster.setVisibility(VISIBLE);}}
    private void loadingUi(){
        if(status==null||progress==null)return;
        progress.setVisibility(state.loading()&&!userPaused?VISIBLE:GONE);
        status.setVisibility(state.loading()||userPaused?VISIBLE:GONE);status.setText(translate.apply(userPaused?"Video paused":"Loading video…"));
        status.setClickable(false);status.setFocusable(false);
    }
    private void showFirstFrame(long selected,String proof){
        if(!valid(selected)||!state.rendered(selected))return;
        clearTimers();loadingUi();trace("first-frame-"+proof);
        poster.animate().cancel();poster.animate().alpha(0).setDuration(120).withEndAction(()->{
            if(valid(selected)&&state.hasFrame()){poster.setVisibility(GONE);poster.setAlpha(1f);}
        }).start();
    }
    private void armDeadline(long selected){
        deadline=()->{if(valid(selected)&&!state.hasFrame()&&!userPaused&&getWindowVisibility()==VISIBLE)failed(selected);};main.postDelayed(deadline,30000);
    }
    private void startSurfaceProbe(long selected){
        if(probe!=null)main.removeCallbacks(probe);
        probe=()->{
            if(!valid(selected)||state.hasFrame()||state.failed()||userPaused||getWindowVisibility()!=VISIBLE)return;
            boolean canCopy=false;try{canCopy=isPlaying()&&getCurrentPosition()>0&&getWidth()>0&&getHeight()>0&&getHolder().getSurface().isValid()&&SystemClock.elapsedRealtime()-preparedAt>=800;}catch(RuntimeException ignored){}
            if(canCopy&&!copying){
                Bitmap sample=Bitmap.createBitmap(24,24,Bitmap.Config.ARGB_8888);copying=true;
                try{PixelCopy.request(this,sample,result->{copying=false;sample.recycle();
                    // SUCCESS means the Surface actually contains a queued frame;
                    // playback time or a preparation timeout alone is not sufficient.
                    if(result==PixelCopy.SUCCESS)showFirstFrame(selected,"surface-copy");
                    if(valid(selected)&&!state.hasFrame()&&!state.failed()&&!userPaused&&probe!=null)main.postDelayed(probe,400);
                },main);}catch(RuntimeException ignored){copying=false;sample.recycle();if(valid(selected)&&probe!=null&&!userPaused)main.postDelayed(probe,400);}
            }else main.postDelayed(probe,400);
        };main.postDelayed(probe,400);
    }
    private void clearTimers(){if(deadline!=null)main.removeCallbacks(deadline);if(probe!=null)main.removeCallbacks(probe);deadline=null;probe=null;}
    void stopSession(){
        clearTimers();state.close();activePlayer=null;resumeOnVisible=false;
        if(poster!=null){poster.animate().cancel();poster.setAlpha(1f);poster.setOnTouchListener(null);}
        setOnPreparedListener(null);setOnInfoListener(null);setOnErrorListener(null);setOnCompletionListener(null);
        try{super.stopPlayback();}catch(RuntimeException ignored){}
        if(status!=null)status.setVisibility(GONE);if(progress!=null)progress.setVisibility(GONE);
    }
    ImageView posterView(){return poster;}
    boolean hasRenderedFrame(){return state.hasFrame();}
    boolean loadingVideo(){return state.loading();}
    boolean failedVideo(){return state.failed();}
    @Override public void setMediaController(MediaController controller){controls=controller;super.setMediaController(controller);}
    @Override public void setOnTouchListener(View.OnTouchListener listener){videoGestures=listener;super.setOnTouchListener(listener);}
    void showControls(){if(controls!=null&&state.current(token)&&!state.failed())controls.show();}
    @Override public void start(){userPaused=false;super.start();if(state!=null&&state.current(token)&&!state.failed()){loadingUi();if(!state.hasFrame()){if(deadline!=null)main.removeCallbacks(deadline);armDeadline(token);startSurfaceProbe(token);}}}
    @Override public void pause(){userPaused=true;super.pause();if(state!=null&&state.current(token)&&!state.failed()){clearTimers();loadingUi();}}
    private void trace(String event){if(BuildConfig.DEBUG)android.util.Log.i("DARTVideo",event+" session="+token+" at="+SystemClock.elapsedRealtime());}
    @Override protected void onWindowVisibilityChanged(int visibility){
        super.onWindowVisibilityChanged(visibility);if(state==null||!state.current(token))return;
        if(visibility!=View.VISIBLE){try{resumeOnVisible=!userPaused&&(isPlaying()||!state.hasFrame()&&state.loading());super.pause();clearTimers();}catch(RuntimeException ignored){}}
        else if(resumeOnVisible&&!state.failed()&&!userPaused){resumeOnVisible=false;try{start();}catch(RuntimeException ignored){}}
    }
    @Override protected void onDetachedFromWindow(){stopSession();super.onDetachedFromWindow();}
}
