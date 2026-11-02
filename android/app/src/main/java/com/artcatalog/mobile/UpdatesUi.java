package com.artcatalog.mobile;

import android.content.Context;
import android.content.res.ColorStateList;
import android.os.Build;
import android.graphics.Color;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import java.util.Locale;
import java.util.function.Function;

/** A stable native update panel; progress changes never rebuild the settings page. */
final class UpdatesUi {
    private final Context context;private final int text,muted,accent;
    private final Function<String,String> translate;private final Locale locale;
    private final TextView installed,available,status,notes,progressText,permission,check,download,cancel,install;
    private final ProgressBar progress;

    UpdatesUi(Context context,LinearLayout body,SettingsUi ui,int text,int muted,int accent,
            Function<String,String> translate,String language,Runnable onCheck,Runnable onDownload,Runnable onCancel,Runnable onInstall){
        this.context=context;this.text=text;this.muted=muted;this.accent=accent;this.translate=translate;locale=Locale.forLanguageTag(language);
        LinearLayout card=ui.card(body,"download","DART updates","Download and install the latest Android version.");card.setTag(this);
        installed=label(card,14,text,"updates-installed");available=label(card,15,text,"updates-available");
        status=label(card,14,muted,"updates-status");status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        progress=new ProgressBar(context,null,android.R.attr.progressBarStyleHorizontal);progress.setMax(100);progress.setProgressTintList(ColorStateList.valueOf(accent));progress.setIndeterminateTintList(ColorStateList.valueOf(accent));progress.setTag("updates-progress");
        LinearLayout.LayoutParams progressLayout=new LinearLayout.LayoutParams(-1,dp(8));progressLayout.setMargins(0,dp(7),0,dp(8));card.addView(progress,progressLayout);
        progressText=label(card,13,muted,"updates-progress-text");progressText.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        notes=label(card,13,text,"updates-notes");notes.setTextIsSelectable(true);
        permission=label(card,13,muted,"updates-permission");
        check=ui.action(card,"Check for updates",false,onCheck);check.setTag("updates-check");
        download=ui.action(card,"Download update",true,onDownload);download.setTag("updates-download");
        cancel=ui.action(card,"Cancel download",false,onCancel);cancel.setTag("updates-cancel");
        install=ui.action(card,"Install update",true,onInstall);install.setTag("updates-install");
    }
    private int dp(float value){return Math.round(value*context.getResources().getDisplayMetrics().density);}
    private String tr(String value){return translate.apply(value);}
    private TextView label(LinearLayout parent,float size,int color,String tag){TextView value=new TextView(context);value.setTextSize(size);value.setTextColor(color);value.setLineSpacing(dp(2),1);value.setPadding(0,dp(5),0,dp(10));value.setTag(tag);parent.addView(value,new LinearLayout.LayoutParams(-1,-2));return value;}
    static boolean badgeVisible(AppUpdates.State state,int sdk){return state!=null&&state.update!=null&&state.update.versionCode>state.currentVersionCode&&state.update.minSdk<=sdk&&state.status!=AppUpdates.Status.UNSUPPORTED;}
    private static boolean busy(AppUpdates.State state){return state.status==AppUpdates.Status.CHECKING||state.status==AppUpdates.Status.DOWNLOADING||state.status==AppUpdates.Status.VERIFYING;}
    static boolean downloadVisible(AppUpdates.State state,int sdk){return badgeVisible(state,sdk)&&!busy(state)&&state.status!=AppUpdates.Status.READY;}
    static boolean installVisible(AppUpdates.State state,int sdk){return badgeVisible(state,sdk)&&state.status==AppUpdates.Status.READY;}
    void render(AppUpdates.State state,boolean canInstall){
        installed.setText(tr("Installed version")+": "+state.currentVersion);
        boolean newer=badgeVisible(state,Build.VERSION.SDK_INT);available.setVisibility(newer?View.VISIBLE:View.GONE);if(newer)available.setText(tr("Available version")+": "+state.update.versionName);
        int errorColor=Color.red(text)+Color.green(text)+Color.blue(text)>384?0xfff2a5a5:0xffa82424;
        status.setText(tr(statusMessage(state)));status.setTextColor(state.error!=AppUpdates.Error.NONE?errorColor:muted);
        boolean transferring=state.status==AppUpdates.Status.DOWNLOADING,verifying=state.status==AppUpdates.Status.VERIFYING;
        progress.setVisibility(transferring||verifying?View.VISIBLE:View.GONE);progress.setIndeterminate(verifying||state.totalBytes<=0);if(transferring&&state.totalBytes>0)progress.setProgress(state.progressPercent());
        progressText.setVisibility(transferring?View.VISIBLE:View.GONE);if(transferring)progressText.setText(state.totalBytes>0?String.format(locale,tr("%s of %s"),bytes(state.downloadedBytes),bytes(state.totalBytes)):bytes(state.downloadedBytes));
        notes.setVisibility(newer?View.VISIBLE:View.GONE);if(newer)notes.setText(tr("Release notes")+"\n"+(state.update.releaseNotes.isBlank()?tr("No release notes provided."):state.update.releaseNotes));
        boolean ready=installVisible(state,Build.VERSION.SDK_INT);permission.setVisibility(ready&&!canInstall?View.VISIBLE:View.GONE);permission.setText(tr("Allow DART to install this update in Android settings, then return."));
        check.setText(tr(state.status==AppUpdates.Status.ERROR?"Retry":"Check for updates"));check.setEnabled(!busy(state));
        download.setVisibility(downloadVisible(state,Build.VERSION.SDK_INT)?View.VISIBLE:View.GONE);cancel.setVisibility(transferring?View.VISIBLE:View.GONE);
        install.setVisibility(ready?View.VISIBLE:View.GONE);install.setText(tr(canInstall?"Install update":"Allow installation"));
    }
    private String bytes(long value){return String.format(locale,"%.1f MB",Math.max(0,value)/1048576.);}
    static String statusMessage(AppUpdates.State state){if(state.error!=AppUpdates.Error.NONE)return errorMessage(state.error);return switch(state.status){
        case CHECKING->"Checking for updates…";case UP_TO_DATE->"Your app is up to date.";case AVAILABLE->"Update available";
        case DOWNLOADING->"Downloading update…";case VERIFYING->"Verifying update…";case READY->"Ready to install";
        case UNSUPPORTED->"This update requires a newer Android version.";case ERROR->errorMessage(state.error);default->"Check for Android updates.";};}
    private static String errorMessage(AppUpdates.Error error){return switch(error){
        case NETWORK->"Update check failed. Check your connection and try again.";
        case INVALID_METADATA->"The update information could not be verified. Try again later.";
        case UNSUPPORTED_ANDROID->"This update requires a newer Android version.";
        case STORAGE->"There is not enough free storage to download the update.";
        case DOWNLOAD->"The update download failed. Try again.";
        case SIZE_MISMATCH,HASH_MISMATCH->"The downloaded file did not pass verification. Download it again.";
        case INVALID_APK,PACKAGE_MISMATCH,VERSION_MISMATCH,SIGNATURE_MISMATCH->"The downloaded update does not match this app. Download it again.";
        case INSTALL_PERMISSION_REQUIRED->"Allow DART to install this update in Android settings, then return.";
        case INSTALL_FAILED->"Android could not open the installer. Try again.";default->"Unknown update error. Try again.";};}
}
