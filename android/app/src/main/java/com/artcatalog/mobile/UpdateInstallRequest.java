package com.artcatalog.mobile;

/** One user-authorized continuation from Android's app-install permission screen. */
final class UpdateInstallRequest {
    private boolean pending;
    void begin(){pending=true;}
    void restore(boolean value){pending=value;}
    boolean pending(){return pending;}
    void cancel(){pending=false;}
    boolean finish(boolean allowed,boolean ready){boolean resume=pending&&allowed&&ready;pending=false;return resume;}
}
