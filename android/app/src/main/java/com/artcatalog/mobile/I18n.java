package com.artcatalog.mobile;

import android.content.Context;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Exact UI-message lookup. Never translate tags, artwork titles or artist identifiers. */
final class I18n {
    private static volatile Map<String,String[]> shared;
    private final Map<String,String[]> messages;
    final String language;
    I18n(Context context,String preference){this.language=normalizeLanguage(preference);Map<String,String[]> cached=shared;
        if(cached==null)synchronized(I18n.class){cached=shared;if(cached==null){try(InputStream input=context.getAssets().open("dart-messages.json")){cached=parse(new JSONArray(new String(read(input),StandardCharsets.UTF_8)));}catch(Exception failure){cached=Map.of();}shared=cached;}}
        this.messages=cached;
    }
    private static byte[] read(InputStream input) throws IOException {ByteArrayOutputStream output=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int count;while((count=input.read(buffer))!=-1){if(output.size()+count>1024*1024)throw new IOException("Translation table is too large");output.write(buffer,0,count);}return output.toByteArray();}
    I18n(String preference,JSONArray rows){language=normalizeLanguage(preference);messages=parse(rows);}
    static String normalizeLanguage(String preference){return preference!=null&&Set.of("en","ru","de").contains(preference)?preference:"en";}
    private static Map<String,String[]> parse(JSONArray rows){Map<String,String[]> result=new HashMap<>();for(int i=0;i<rows.length();i++){JSONArray row=rows.optJSONArray(i);if(row==null||row.length()<3)continue;String[] values={row.optString(0),row.optString(1),row.optString(2)};for(String alias:values)if(!alias.isEmpty()){result.putIfAbsent(alias,values);result.putIfAbsent(alias.trim(),values);}}return Collections.unmodifiableMap(result);}
    String text(String message){if(message==null)return "";String[] row=messages.get(message);return row==null?message:row[language.equals("ru")?1:language.equals("de")?2:0];}
}
