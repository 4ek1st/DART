package com.artcatalog.mobile;

import org.junit.Test;
import static org.junit.Assert.*;

public class UpdatesUiTest {
    private AppUpdates.State state(String status,int installed,int offered,int minimumSdk){AppUpdates.Descriptor update=offered==0?null:new AppUpdates.Descriptor("com.artcatalog.mobile",offered,"0.1.15",minimumSdk,"https://github.com/4ek1st/DART/releases/download/android-v0.1.15/DART.apk","0".repeat(64),1024L,"Neutral update notes");return new AppUpdates.State(AppUpdates.Status.valueOf(status),status.equals("ERROR")?AppUpdates.Error.NETWORK:AppUpdates.Error.NONE,update,"0.1.14",installed,0,1024,0);}
    private boolean policy(String method,String status,int installed,int offered,int minimumSdk,int deviceSdk){AppUpdates.State data=state(status,installed,offered,minimumSdk);return method.equals("downloadVisible")?UpdatesUi.downloadVisible(data,deviceSdk):method.equals("installVisible")?UpdatesUi.installVisible(data,deviceSdk):UpdatesUi.badgeVisible(data,deviceSdk);}
    @Test public void knownNewerReleaseRemainsVisibleThroughCheckingAndTemporaryOfflineState()throws Exception{
        for(String state:new String[]{"AVAILABLE","CHECKING","DOWNLOADING","VERIFYING","READY","ERROR"})assertTrue(state,policy("badgeVisible",state,14,15,26,35));
    }
    @Test public void currentMissingAndUnsupportedVersionsNeverShowAnUpdateAction()throws Exception{
        assertFalse(policy("badgeVisible","UP_TO_DATE",14,14,26,35));assertFalse(policy("badgeVisible","AVAILABLE",14,13,26,35));assertFalse(policy("badgeVisible","ERROR",14,0,26,35));assertFalse(policy("badgeVisible","AVAILABLE",14,15,36,35));assertFalse(policy("badgeVisible","UNSUPPORTED",14,15,26,35));
    }
    @Test public void downloadRetryAndInstallActionsRespectVerificationAndCurrentVersion()throws Exception{
        assertTrue(policy("downloadVisible","AVAILABLE",14,15,26,35));assertTrue(policy("downloadVisible","ERROR",14,15,26,35));assertFalse(policy("downloadVisible","DOWNLOADING",14,15,26,35));assertFalse(policy("downloadVisible","VERIFYING",14,15,26,35));assertFalse(policy("downloadVisible","READY",14,15,26,35));assertTrue(policy("installVisible","READY",14,15,26,35));assertFalse(policy("installVisible","VERIFYING",14,15,26,35));assertFalse(policy("installVisible","READY",15,15,26,35));
    }
    @Test public void installerFailureIsShownEvenWhenVerifiedDownloadRemainsReady(){AppUpdates.State ready=state("READY",14,15,26);AppUpdates.State failure=new AppUpdates.State(AppUpdates.Status.READY,AppUpdates.Error.INSTALL_FAILED,ready.update,ready.currentVersion,ready.currentVersionCode,1024,1024,0);assertEquals("Android could not open the installer. Try again.",UpdatesUi.statusMessage(failure));assertTrue(UpdatesUi.installVisible(failure,35));}
}
