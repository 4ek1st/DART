package com.artcatalog.mobile;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.graphics.drawable.StateListDrawable;
import android.text.InputType;
import android.text.method.PasswordTransformationMethod;
import android.view.Gravity;
import android.view.View;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.inputmethod.EditorInfo;
import android.widget.CompoundButton;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import java.util.function.Function;

/** Native settings surfaces, scoped to settings rather than the artwork feed. */
final class SettingsUi {
    private final Context context;
    private final int background, panel, raised, text, muted, accent;
    private final Function<String,String> translate;

    SettingsUi(Context context,int background,int panel,int raised,int text,int muted,int accent,
            Function<String,String> translate){
        this.context=context;this.background=background;this.panel=panel;this.raised=raised;
        this.text=text;this.muted=muted;this.accent=accent;this.translate=translate;
    }

    private int dp(float value){return Math.round(value*context.getResources().getDisplayMetrics().density);}
    private String tr(String value){return value==null?"":translate.apply(value);}
    private LinearLayout column(){LinearLayout view=new LinearLayout(context);view.setOrientation(LinearLayout.VERTICAL);return view;}
    private LinearLayout row(){LinearLayout view=new LinearLayout(context);view.setOrientation(LinearLayout.HORIZONTAL);view.setGravity(Gravity.CENTER_VERTICAL);return view;}
    private TextView label(String value,float size,int color,boolean bold){
        TextView view=new TextView(context);view.setText(tr(value));view.setTextSize(size);view.setTextColor(color);
        view.setLineSpacing(dp(2),1);if(bold)view.setTypeface(null,Typeface.BOLD);return view;
    }
    private static int mix(int from,int to,float amount){
        return Color.rgb(Math.round(Color.red(from)+(Color.red(to)-Color.red(from))*amount),
                Math.round(Color.green(from)+(Color.green(to)-Color.green(from))*amount),
                Math.round(Color.blue(from)+(Color.blue(to)-Color.blue(from))*amount));
    }
    private GradientDrawable rounded(int fill,int border){
        GradientDrawable shape=new GradientDrawable();shape.setColor(fill);shape.setCornerRadius(dp(14));
        if(border!=Color.TRANSPARENT)shape.setStroke(dp(1),border);return shape;
    }
    private Drawable touch(int fill,int border){
        return new RippleDrawable(ColorStateList.valueOf(Color.argb(38,Color.red(accent),Color.green(accent),Color.blue(accent))),
                rounded(fill,border),rounded(Color.WHITE,Color.TRANSPARENT));
    }
    private LinearLayout.LayoutParams full(){return new LinearLayout.LayoutParams(-1,-2);}
    private void append(LinearLayout parent,View view,int bottom){
        LinearLayout.LayoutParams layout=full();layout.setMargins(0,0,0,dp(bottom));parent.addView(view,layout);
    }

    LinearLayout body(LinearLayout page){
        page.setBackgroundColor(background);ScrollView scroll=new ScrollView(context);scroll.setFillViewport(true);
        scroll.setClipToPadding(false);scroll.setOverScrollMode(View.OVER_SCROLL_IF_CONTENT_SCROLLS);
        LinearLayout content=column();content.setPadding(dp(16),dp(16),dp(16),dp(32));
        scroll.addView(content,new ScrollView.LayoutParams(-1,-2));
        page.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));return content;
    }

    LinearLayout card(LinearLayout parent,String icon,String title,String summary){
        LinearLayout card=column();card.setPadding(dp(16),dp(17),dp(16),dp(16));
        card.setBackground(rounded(panel,mix(panel,text,.13f)));append(parent,card,14);
        LinearLayout heading=row();heading.setGravity(Gravity.TOP);IconView symbol=new IconView(context,icon,accent);
        LinearLayout.LayoutParams symbolLayout=new LinearLayout.LayoutParams(dp(24),dp(27));symbolLayout.setMargins(0,0,dp(10),0);
        heading.addView(symbol,symbolLayout);heading.addView(label(title,18,text,true),new LinearLayout.LayoutParams(0,-2,1));
        append(card,heading,summary==null||summary.isBlank()?12:0);
        if(summary!=null&&!summary.isBlank()){
            TextView description=label(summary,13,muted,false);LinearLayout.LayoutParams layout=full();layout.setMargins(0,dp(9),0,dp(13));card.addView(description,layout);
        }
        return card;
    }

    LinearLayout navigation(LinearLayout parent,String icon,String title,String summary,Runnable action){
        LinearLayout item=row();item.setMinimumHeight(dp(80));item.setPadding(dp(12),dp(12),dp(12),dp(12));
        item.setBackground(touch(panel,mix(panel,text,.1f)));item.setFocusable(true);item.setClickable(true);
        item.setDescendantFocusability(LinearLayout.FOCUS_BLOCK_DESCENDANTS);
        item.setContentDescription(tr(title)+(summary==null||summary.isBlank()?"":". "+tr(summary)));
        IconView symbol=new IconView(context,icon,accent);symbol.setBackground(rounded(mix(panel,accent,.14f),Color.TRANSPARENT));
        item.addView(symbol,new LinearLayout.LayoutParams(dp(42),dp(42)));
        LinearLayout copy=column();copy.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
        copy.addView(label(title,16,text,true),full());
        if(summary!=null&&!summary.isBlank()){
            TextView description=label(summary,12.5f,muted,false);LinearLayout.LayoutParams descriptionLayout=full();descriptionLayout.topMargin=dp(4);copy.addView(description,descriptionLayout);
        }
        LinearLayout.LayoutParams copyLayout=new LinearLayout.LayoutParams(0,-2,1);copyLayout.setMargins(dp(13),0,dp(8),0);item.addView(copy,copyLayout);
        item.addView(new IconView(context,"next",muted),new LinearLayout.LayoutParams(dp(18),dp(26)));
        item.setOnClickListener(view->action.run());append(parent,item,9);return item;
    }

    TextView action(LinearLayout parent,String value,boolean primary,Runnable action){
        int fill=primary?accent:raised;
        Button button=new Button(context);button.setAllCaps(false);button.setText(tr(value));button.setTextSize(14.5f);
        int foreground=primary?contrastText(fill):text;
        button.setTextColor(new ColorStateList(new int[][]{new int[]{-android.R.attr.state_enabled},new int[]{}},new int[]{mix(panel,muted,.8f),foreground}));
        button.setTypeface(null,Typeface.BOLD);button.setLineSpacing(dp(2),1);button.setGravity(Gravity.CENTER);button.setMinWidth(0);
        button.setMinimumHeight(dp(52));button.setPadding(dp(15),dp(12),dp(15),dp(12));
        StateListDrawable state=new StateListDrawable();state.addState(new int[]{-android.R.attr.state_enabled},rounded(mix(panel,fill,.35f),Color.TRANSPARENT));
        state.addState(new int[]{},touch(fill,primary?Color.TRANSPARENT:mix(raised,text,.14f)));button.setBackground(state);
        button.setFocusable(true);button.setOnClickListener(view->action.run());append(parent,button,9);return button;
    }

    Toggle switchRow(LinearLayout parent,String value,String summary,boolean checked){
        Switch control=new Switch(context);control.setChecked(checked);control.setSaveEnabled(false);
        control.setClickable(false);control.setFocusable(false);control.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        control.setThumbTintList(new ColorStateList(new int[][]{new int[]{-android.R.attr.state_enabled},new int[]{android.R.attr.state_checked},new int[]{}},
                new int[]{mix(raised,muted,.5f),accent,mix(raised,text,.7f)}));
        control.setTrackTintList(new ColorStateList(new int[][]{new int[]{-android.R.attr.state_enabled},new int[]{android.R.attr.state_checked},new int[]{}},
                new int[]{mix(raised,muted,.2f),mix(raised,accent,.55f),mix(raised,muted,.4f)}));
        SwitchRow item=new SwitchRow(context,control);item.setOrientation(LinearLayout.HORIZONTAL);item.setGravity(Gravity.CENTER_VERTICAL);
        item.setMinimumHeight(dp(76));item.setPadding(dp(13),dp(13),dp(10),dp(13));
        item.setBackground(touch(raised,mix(raised,text,.12f)));item.setFocusable(true);item.setClickable(true);
        item.setContentDescription(tr(value)+(summary==null||summary.isBlank()?"":". "+tr(summary)));
        LinearLayout copy=column();copy.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
        copy.addView(label(value,15.5f,text,true),full());
        if(summary!=null&&!summary.isBlank()){
            LinearLayout.LayoutParams descriptionLayout=full();descriptionLayout.topMargin=dp(5);copy.addView(label(summary,12.5f,muted,false),descriptionLayout);
        }
        LinearLayout.LayoutParams copyLayout=new LinearLayout.LayoutParams(0,-2,1);copyLayout.rightMargin=dp(12);item.addView(copy,copyLayout);
        control.setMinimumHeight(dp(48));item.addView(control,new LinearLayout.LayoutParams(-2,-2));append(parent,item,10);
        return new Toggle(item,control);
    }

    static final class Toggle {
        final Switch control;
        private final SwitchRow row;
        private Toggle(SwitchRow row,Switch control){this.row=row;this.control=control;}
        boolean checked(){return control.isChecked();}
        void listener(CompoundButton.OnCheckedChangeListener listener){
            control.setOnCheckedChangeListener((button,checked)->{
                row.sendAccessibilityEvent(AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED);
                if(listener!=null)listener.onCheckedChanged(button,checked);
            });
        }
        void enabled(boolean enabled){
            control.setEnabled(enabled);row.setEnabled(enabled);row.setClickable(enabled);row.setFocusable(enabled);row.setAlpha(enabled?1f:.5f);
        }
    }

    private static final class SwitchRow extends LinearLayout {
        private final Switch control;
        SwitchRow(Context context,Switch control){super(context);this.control=control;}
        @Override public boolean performClick(){if(!isEnabled())return false;control.toggle();super.performClick();return true;}
        @Override public void onInitializeAccessibilityNodeInfo(AccessibilityNodeInfo info){
            super.onInitializeAccessibilityNodeInfo(info);info.setClassName(Switch.class.getName());info.setCheckable(true);info.setChecked(control.isChecked());
        }
    }

    RadioGroup choices(LinearLayout parent,String[] labels,String[] values,String current){
        if(labels.length!=values.length)throw new IllegalArgumentException("Choice labels and values must match");
        RadioGroup group=new RadioGroup(context);group.setOrientation(LinearLayout.VERTICAL);
        for(int i=0;i<labels.length;i++){
            RadioButton option=new RadioButton(context);option.setId(View.generateViewId());option.setTag(values[i]);option.setText(tr(labels[i]));
            option.setTextColor(text);option.setTextSize(15);option.setLineSpacing(dp(2),1);option.setGravity(Gravity.CENTER_VERTICAL);
            option.setMinHeight(dp(56));option.setPadding(dp(12),dp(11),dp(12),dp(11));
            option.setButtonTintList(new ColorStateList(new int[][]{new int[]{-android.R.attr.state_enabled},new int[]{android.R.attr.state_checked},new int[]{}},new int[]{mix(raised,muted,.4f),accent,muted}));
            StateListDrawable selection=new StateListDrawable();selection.addState(new int[]{android.R.attr.state_checked},rounded(mix(raised,accent,.15f),mix(raised,accent,.55f)));
            selection.addState(new int[]{},rounded(raised,mix(raised,text,.12f)));
            option.setBackground(new RippleDrawable(ColorStateList.valueOf(Color.argb(38,Color.red(accent),Color.green(accent),Color.blue(accent))),selection,rounded(Color.WHITE,Color.TRANSPARENT)));
            RadioGroup.LayoutParams layout=new RadioGroup.LayoutParams(-1,-2);layout.bottomMargin=dp(8);group.addView(option,layout);
            if(values[i].equals(current))group.check(option.getId());
        }
        append(parent,group,4);return group;
    }

    EditText input(LinearLayout parent,String value,String hint,boolean multiline,boolean secret){
        TextView name=label(value,13,text,true);LinearLayout.LayoutParams nameLayout=full();nameLayout.setMargins(0,dp(7),0,dp(7));parent.addView(name,nameLayout);
        EditText field=new EditText(context);field.setId(View.generateViewId());name.setLabelFor(field.getId());field.setTextSize(15);
        field.setTextColor(text);field.setHintTextColor(muted);field.setHint(tr(hint));field.setMinHeight(dp(52));
        field.setPadding(dp(13),dp(13),dp(13),dp(13));field.setGravity(Gravity.TOP|Gravity.START);
        field.setInputType(InputType.TYPE_CLASS_TEXT|(secret?InputType.TYPE_TEXT_VARIATION_PASSWORD:InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS)
                |(multiline?InputType.TYPE_TEXT_FLAG_MULTI_LINE:0));
        field.setSingleLine(!multiline);field.setHorizontallyScrolling(!multiline);if(multiline)field.setMinLines(2);
        field.setImeOptions((multiline?EditorInfo.IME_ACTION_NONE:EditorInfo.IME_ACTION_DONE)|EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING);
        if(secret){field.setTransformationMethod(PasswordTransformationMethod.getInstance());field.setSaveEnabled(false);field.setFreezesText(false);field.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);}
        StateListDrawable states=new StateListDrawable();states.addState(new int[]{-android.R.attr.state_enabled},rounded(mix(raised,panel,.5f),mix(raised,text,.07f)));
        states.addState(new int[]{android.R.attr.state_focused},rounded(raised,accent));states.addState(new int[]{},rounded(raised,mix(raised,text,.19f)));field.setBackground(states);
        append(parent,field,12);return field;
    }

    private static int contrastText(int fill){
        double light=.2126*linear(Color.red(fill))+.7152*linear(Color.green(fill))+.0722*linear(Color.blue(fill));
        return (light+.05)/.05>=1.05/(light+.05)?Color.BLACK:Color.WHITE;
    }
    private static double linear(int value){double s=value/255.;return s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4);}
}
