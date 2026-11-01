package com.artcatalog.mobile;

import java.net.URI;
import java.util.List;

/** A preparation callback is not evidence that a video frame has reached its surface. */
final class VideoPlaybackState {
    enum Phase { IDLE,LOADING,PREPARED,PLAYING,BUFFERING,FAILED,CLOSED }
    private long generation;private Phase phase=Phase.IDLE;private boolean frame;
    long begin(){generation++;phase=Phase.LOADING;frame=false;return generation;}
    boolean current(long token){return token==generation&&phase!=Phase.IDLE&&phase!=Phase.CLOSED;}
    private boolean accepts(long token){return current(token)&&phase!=Phase.FAILED;}
    boolean prepared(long token){if(!accepts(token))return false;phase=Phase.PREPARED;return true;}
    boolean rendered(long token){if(!accepts(token)||frame)return false;frame=true;phase=Phase.PLAYING;return true;}
    boolean buffering(long token,boolean active){if(!accepts(token))return false;phase=active?Phase.BUFFERING:frame?Phase.PLAYING:Phase.PREPARED;return true;}
    boolean fail(long token){if(!accepts(token))return false;phase=Phase.FAILED;return true;}
    boolean surfaceLost(long token){if(!accepts(token))return false;frame=false;phase=Phase.PREPARED;return true;}
    void close(){generation++;phase=Phase.CLOSED;frame=false;}
    boolean posterVisible(){return !frame||phase==Phase.FAILED;}
    boolean loading(){return phase==Phase.LOADING||phase==Phase.PREPARED||phase==Phase.BUFFERING;}
    boolean failed(){return phase==Phase.FAILED;}
    boolean hasFrame(){return frame;}
    /** A group's primary thumbnail says nothing about a different variant's video. */
    static String[] posterFor(Post owner,String selected){
        if(owner!=null&&selected!=null&&!selected.isBlank()){
            String identity=MediaIdentity.cacheKey(selected);
            for(Post leaf:owner.groupMembers)for(String primary:List.of(leaf.image,leaf.original))
                if(!primary.isBlank()&&identity.equals(MediaIdentity.cacheKey(primary)))return new String[]{leaf.preview,leaf.smallPreview};
        }
        return new String[]{"",""};
    }
    static int selectedIndex(List<String> media,String clicked,int fallback){int found=media.indexOf(clicked);return found>=0?found:Math.max(0,Math.min(Math.max(0,media.size()-1),fallback));}
    static boolean expiring(String raw,long now){try{String query=URI.create(raw).getRawQuery();if(query!=null)for(String argument:query.split("&")){String[] parts=argument.split("=",2);if(parts.length==2&&(parts[0].equals("e")||parts[0].equals("expires")))return Long.parseLong(parts[1])<=now/1000+15;}}catch(Exception ignored){return true;}return false;}
}
