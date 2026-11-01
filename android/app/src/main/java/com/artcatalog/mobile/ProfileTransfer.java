package com.artcatalog.mobile;

import org.json.*;
import java.time.Instant;
import java.util.*;
import java.nio.charset.StandardCharsets;
import java.net.URI;
import java.net.URLDecoder;
import java.text.Normalizer;
import java.util.regex.Pattern;

/** Portable, additive profile exchange. This class has no Android or file-system side effects. */
final class ProfileTransfer {
    static final int MAX_BYTES=20*1024*1024;
    static final class Merge {
        final JSONObject mobile,added,skipped;
        final boolean changed;
        Merge(JSONObject mobile,JSONObject added,JSONObject skipped,boolean changed){this.mobile=mobile;this.added=added;this.skipped=skipped;this.changed=changed;}
    }
    private static List<Object> values(JSONArray array){List<Object> result=new ArrayList<>();for(int i=0;i<array.length();i++)result.add(array.opt(i));return result;}
    /** Native insertion history is oldest first; the portable history contract is newest first. */
    private static JSONArray reversed(JSONArray array){JSONArray result=new JSONArray();for(int i=array.length()-1;i>=0;i--)result.put(array.opt(i));return result;}
    private static List<String> keys(JSONObject object){List<String> result=new ArrayList<>();Iterator<String> keys=object.keys();while(keys.hasNext())result.add(keys.next());return result;}
    private static IllegalArgumentException invalid(String field){return new IllegalArgumentException("Некорректный профиль: "+field);}
    private static JSONObject copy(JSONObject value) throws JSONException {return new JSONObject(value.toString());}
    private static boolean equal(Object first,Object second){
        if(first==second)return true;if(first==null||second==null)return false;
        if(first instanceof JSONObject&&second instanceof JSONObject){JSONObject a=(JSONObject)first,b=(JSONObject)second;if(a.length()!=b.length())return false;for(String key:keys(a))if(!b.has(key)||!equal(a.opt(key),b.opt(key)))return false;return true;}
        if(first instanceof JSONArray&&second instanceof JSONArray){JSONArray a=(JSONArray)first,b=(JSONArray)second;if(a.length()!=b.length())return false;for(int i=0;i<a.length();i++)if(!equal(a.opt(i),b.opt(i)))return false;return true;}
        if(first instanceof Number&&second instanceof Number)return first.toString().equals(second.toString());return first.equals(second);
    }
    private static JSONObject choices(JSONObject raw) throws JSONException {JSONObject result=new JSONObject();if(raw==null)return result;if(raw.length()>1000)throw invalid("recommendationTags");for(String key:keys(raw)){String normalized=recommendationTag(key),mode=text(raw,key,20);if(!tag(normalized)||!Set.of("priority","disabled").contains(mode))throw invalid("recommendationTags");if(!result.has(normalized))result.put(normalized,mode);}return result;}
    private static JSONArray array(JSONObject root,String field,int limit){
        Object value=root.opt(field);if(value==null)return new JSONArray();
        if(!(value instanceof JSONArray)||((JSONArray)value).length()>limit)throw invalid(field);
        return (JSONArray)value;
    }
    private static String string(Object value,String field,int max){if(!(value instanceof String)||((String)value).length()>max)throw invalid(field);return (String)value;}
    private static final Pattern WORK_KEY=Pattern.compile("(?:danbooru|gelbooru|rule34|sankaku):[a-zA-Z0-9]{1,100}");
    private static final Pattern IDENTITY=Pattern.compile("(?:hash:[a-fA-F0-9]{32}|group:(?:media:[a-fA-F0-9]{64}|pixiv:[0-9]{5,12}|(?:danbooru|gelbooru|rule34|sankaku):[a-zA-Z0-9:_-]{1,180})|original:(?:x-status:[0-9]{5,25}|discord-attachment:[0-9]{5,25}:[0-9]{5,25}))");
    private static final Pattern SECRET_QUERY=Pattern.compile("(?:user_?id|api_?key|access_?token|refresh_?token|token|authorization|password|key|signature|sig|policy|key-pair-id|x-amz-.+)",Pattern.CASE_INSENSITIVE);
    private static boolean controls(String value){for(int i=0;i<value.length();i++)if(Character.isISOControl(value.charAt(i)))return true;return false;}
    private static boolean catalogKey(String key){return WORK_KEY.matcher(key).matches();}
    private static boolean identity(String key){return !controls(key)&&(key.startsWith("key:")?catalogKey(key.substring(4)):IDENTITY.matcher(key).matches());}
    // Portable tags are plain metadata, not paths or URLs; match the desktop contract.
    private static boolean tag(String value){return value.length()>0&&value.length()<=100&&!controls(value)&&!value.codePoints().allMatch(c->Character.isWhitespace(c)||Character.isSpaceChar(c));}
    private static String recommendationTag(String value){return Normalizer.normalize(value,Normalizer.Form.NFKC).toLowerCase(Locale.ROOT).trim().replaceAll("[_:]+"," ").replaceAll("\\s+"," ");}
    private static String text(JSONObject object,String field,int maximum){Object raw=object.opt(field);return raw==null||raw==JSONObject.NULL?"":string(raw,field,maximum);}
    private static long integer(JSONObject object,String field,boolean wide){Object raw=object.opt(field);if(!(raw instanceof Integer||raw instanceof Long||raw instanceof Short||raw instanceof Byte))throw invalid(field);long value=((Number)raw).longValue();if(!wide&&(value<Integer.MIN_VALUE||value>Integer.MAX_VALUE))throw invalid(field);return value;}
    private static void preflightDepth(String json){int level=0;char quote=0;boolean escaped=false;for(int i=0;i<json.length();i++){char c=json.charAt(i);if(quote!=0){if(escaped)escaped=false;else if(c=='\\')escaped=true;else if(c==quote)quote=0;}else if(c=='\"'||c=='\'')quote=c;else if(c=='{'||c=='['){if(++level>32)throw invalid("слишком большая вложенность");}else if(c=='}'||c==']')level--;}}
    private static String portableUrl(String value,boolean media){
        try{URI uri=URI.create(value);String host=uri.getHost();if(!"https".equalsIgnoreCase(uri.getScheme())||host==null||uri.getUserInfo()!=null)return "";host=host.toLowerCase(Locale.ROOT);
            if(host.equals("localhost")||host.endsWith(".localhost")||host.indexOf(':')>=0||host.matches("[0-9.]+"))return "";
            if(media&&!Set.of("donmai.us","gelbooru.com","rule34.xxx","sankakucomplex.com").stream().anyMatch(root->hostEquals(uri.getHost(),root)))return "";
            Set<String> names=new HashSet<>();if(uri.getRawQuery()!=null)for(String pair:uri.getRawQuery().split("&")){String name=URLDecoder.decode(pair.split("=",2)[0],StandardCharsets.UTF_8.name()).toLowerCase(Locale.ROOT);if(SECRET_QUERY.matcher(name).matches())return "";names.add(name);}if(names.contains("e")&&names.contains("m"))return "";
            int fragment=value.indexOf('#');return fragment<0?value:value.substring(0,fragment);
        }catch(Exception invalid){return "";}
    }
    private static boolean hostEquals(String host,String root){String value=host.toLowerCase(Locale.ROOT);return value.equals(root)||value.endsWith("."+root);}
    private static JSONArray strings(JSONArray source,String field,int length,java.util.function.Predicate<String> valid){
        JSONArray result=new JSONArray();Set<String> seen=new LinkedHashSet<>();
        for(int i=0;i<source.length();i++){String value=string(source.opt(i),field,length);if(!valid.test(value))throw invalid(field);if(seen.add(value))result.put(value);}return result;
    }
    private static void depth(Object value,int level){
        if(level>32)throw invalid("слишком большая вложенность");
        if(value instanceof JSONObject){JSONObject o=(JSONObject)value;for(String key:keys(o))depth(o.opt(key),level+1);}
        else if(value instanceof JSONArray){JSONArray a=(JSONArray)value;for(int i=0;i<a.length();i++)depth(a.opt(i),level+1);}
    }
    static JSONObject parse(String json){
        if(json==null||json.getBytes(StandardCharsets.UTF_8).length>MAX_BYTES)throw invalid("размер файла");
        preflightDepth(json);
        try{
            JSONTokener tokener=new JSONTokener(json);Object parsed=tokener.nextValue();if(tokener.nextClean()!=0)throw invalid("лишние данные после JSON");depth(parsed,0);
            JSONObject input;
            if(parsed instanceof JSONArray){JSONObject legacy=new JSONObject().put("bookmarks",parsed);input=export(legacy);}
            else if(parsed instanceof JSONObject){input=(JSONObject)parsed;
                if("artcatalog-mobile".equals(input.optString("format"))){if(!Set.of(1,2).contains(input.optInt("version")))throw invalid("версия");input=export(input);}
                else if(!"dart-profile".equals(input.optString("format"))){if(!input.optString("format").isBlank()||!input.has("bookmarks")&&!input.has("likes"))throw invalid("формат");input=export(input);}
            }else throw invalid("формат");
            if(!"dart-profile".equals(input.optString("format"))||integer(input,"version",false)!=1)throw invalid("версия");
            JSONObject result=new JSONObject().put("format","dart-profile").put("version",1);
            int total=0;for(String field:List.of("likes","bookmarks","history")){
                JSONArray values=array(input,field,100000);total+=values.length();if(total>100000)throw invalid("слишком много работ");
                JSONArray records=new JSONArray();for(int i=0;i<values.length();i++){JSONObject post=values.optJSONObject(i);if(post==null)throw invalid(field);records.put(post(post));}result.put(field,records);
            }
            result.put("viewedIdentities",strings(array(input,"viewedIdentities",200000),"viewedIdentities",250,ProfileTransfer::identity));
            result.put("favoriteTags",strings(array(input,"favoriteTags",100),"favoriteTags",100,ProfileTransfer::tag));
            JSONArray follows=new JSONArray();for(Object raw:values(array(input,"follows",2000))){if(!(raw instanceof JSONObject))throw invalid("follows");follows.put(follow((JSONObject)raw));}result.put("follows",follows);
            Object rawTags=input.opt("recommendationTags");if(rawTags==JSONObject.NULL)rawTags=null;if(rawTags!=null&&!(rawTags instanceof JSONObject))throw invalid("recommendationTags");
            result.put("recommendationTags",choices((JSONObject)rawTags));
            Object rawPrefs=input.opt("preferences");if(rawPrefs==JSONObject.NULL)rawPrefs=null;if(rawPrefs!=null&&!(rawPrefs instanceof JSONObject))throw invalid("preferences");result.put("preferences",preferences(rawPrefs==null?new JSONObject():(JSONObject)rawPrefs));
            JSONArray exposures=new JSONArray();for(Object raw:values(array(input,"recommendationExposureGroups",512))){
                if(!(raw instanceof JSONArray)||((JSONArray)raw).length()>32)throw invalid("recommendationExposureGroups");exposures.put(strings((JSONArray)raw,"recommendationExposureGroups",120,ProfileTransfer::catalogKey));}
            result.put("recommendationExposureGroups",exposures);return result;
        }catch(IllegalArgumentException e){throw e;}catch(Exception e){throw invalid("JSON");}
    }
    private static JSONObject post(JSONObject raw) throws JSONException {return post(raw,0);}
    private static JSONObject post(JSONObject raw,int depth) throws JSONException {
        String source=string(raw.opt("source"),"источник работы",20).toLowerCase(Locale.ROOT),id=string(raw.opt("id"),"ID работы",100),key=source+":"+id;
        if(!catalogKey(key)||!source.equals("sankaku")&&!id.matches("[0-9]+"))throw invalid("источник или ID работы");
        if(raw.has("key")&&!key.equals(string(raw.opt("key"),"key",120)))throw invalid("ключ работы");
        JSONObject result=new JSONObject().put("key",key).put("source",source).put("id",id);
        for(String field:List.of("title","artist","artistId","creatorName","creatorTag","artistTag","uploaderName","uploaderId","groupKey","pixivGroupKey","contentHash","hash","visualHash","visualPHash","rating","published","relatedQuery","accessMessage"))if(raw.has(field))result.put(field,text(raw,field,field.equals("title")?999:250));
        if(!result.has("creatorName")&&result.has("artist"))result.put("creatorName",result.get("artist"));
        for(String field:List.of("width","height","score","popularityCount","groupingVersion","groupCount"))if(raw.has(field)&&!raw.isNull(field))result.put(field,integer(raw,field,false));
        for(String field:List.of("groupMinTime","groupMaxTime"))if(raw.has(field))result.put(field,integer(raw,field,true));
        if(raw.has("visualAspectRatio")){Object value=raw.opt("visualAspectRatio");if(!(value instanceof Number)||!Double.isFinite(((Number)value).doubleValue())||((Number)value).doubleValue()<0||((Number)value).doubleValue()>10000)throw invalid("visualAspectRatio");result.put("visualAspectRatio",value);}
        if(raw.has("requiresAuthentication")){if(!(raw.opt("requiresAuthentication") instanceof Boolean))throw invalid("requiresAuthentication");result.put("requiresAuthentication",raw.getBoolean("requiresAuthentication"));}
        for(String field:List.of("tags","allTags","artistTags","characterTags","copyrightTags"))result.put(field,strings(array(raw,field,1000),field,200,s->!controls(s)));
        result.put("memberKeys",strings(array(raw,"memberKeys",1000),"memberKeys",120,ProfileTransfer::catalogKey));
        result.put("identityKeys",strings(array(raw,"identityKeys",2000),"identityKeys",250,ProfileTransfer::identity));
        result.put("uploaderKeys",strings(array(raw,"uploaderKeys",1000),"uploaderKeys",200,s->!controls(s)));
        for(String field:List.of("thumbnail","preview","smallPreview","image","original","originalUrl","sourceUrl"))if(raw.has(field))result.put(field,portableUrl(text(raw,field,4096),!field.equals("originalUrl")&&!field.equals("sourceUrl")));
        JSONArray images=new JSONArray();Set<String> urls=new LinkedHashSet<>();for(Object value:values(array(raw,"images",100))){String url=portableUrl(string(value,"images",4096),true);if(!url.isBlank())urls.add(url);}if(urls.isEmpty()&&result.has("image")&&!result.optString("image").isBlank())urls.add(result.getString("image"));for(String url:urls)images.put(url);result.put("images",images);
        JSONArray records=new JSONArray();for(Object value:values(array(raw,"imageRecords",100))){if(!(value instanceof JSONObject))throw invalid("imageRecords");JSONObject record=(JSONObject)value;String url=portableUrl(text(record,"url",4096),true);JSONObject cleaned=new JSONObject().put("url",url).put("hash",text(record,"hash",64));String owner=text(record,"owner",120);if(!owner.isBlank()){if(!catalogKey(owner))throw invalid("imageRecords.owner");cleaned.put("owner",owner);}if(!url.isBlank())records.put(cleaned);}result.put("imageRecords",records);
        JSONArray people=new JSONArray();for(Object value:values(array(raw,"participants",100))){if(!(value instanceof JSONObject))throw invalid("participants");JSONObject person=(JSONObject)value;String name=text(person,"tag",100);if(!tag(name))throw invalid("participants.tag");people.put(new JSONObject().put("tag",name).put("name",text(person,"name",200)).put("role",text(person,"role",32)));}result.put("participants",people);
        JSONArray members=array(raw,"groupMembers",100),cleanedMembers=new JSONArray();if(depth>0&&members.length()>0)throw invalid("groupMembers");for(Object member:values(members)){if(!(member instanceof JSONObject))throw invalid("groupMembers");cleanedMembers.put(post((JSONObject)member,depth+1));}result.put("groupMembers",cleanedMembers);
        JSONArray samples=new JSONArray();for(Object value:values(array(raw,"visualSamples",100))){if(!(value instanceof JSONObject))throw invalid("visualSamples");JSONObject sample=(JSONObject)value,cleaned=new JSONObject();for(String field:List.of("hash","pHash","perceptualHash","creator","source","owner","publication","rating","uploader","published"))if(sample.has(field))cleaned.put(field,text(sample,field,250));for(String field:List.of("tags","characters"))cleaned.put(field,strings(array(sample,field,1000),field,200,s->!controls(s)));if(sample.has("aspectRatio")){Object valueRatio=sample.opt("aspectRatio");if(!(valueRatio instanceof Number)||!Double.isFinite(((Number)valueRatio).doubleValue())||((Number)valueRatio).doubleValue()<0||((Number)valueRatio).doubleValue()>10000)throw invalid("visualSamples.aspectRatio");cleaned.put("aspectRatio",valueRatio);}samples.put(cleaned);}result.put("visualSamples",samples);
        return result;
    }
    private static JSONObject follow(JSONObject value) throws JSONException {
        String role=text(value,"role",20),source=text(value,"source",20).toLowerCase(Locale.ROOT),id=text(value,"artistId",100).trim().toLowerCase(Locale.ROOT).replace(' ','_');
        if(!Set.of("artist","uploader").contains(role)||role.equals("artist")&&!source.equals("artist")||role.equals("uploader")&&!Arrays.asList(CatalogClient.SOURCES).contains(source))throw invalid("тип подписки");
        if(!artistId(id))throw invalid("автор подписки");
        JSONObject result=new JSONObject().put("role",role).put("source",source).put("artistId",id).put("name",value.has("name")?text(value,"name",160):id);
        if(value.has("gelbooruTag"))result.put("gelbooruTag",text(value,"gelbooruTag",100));
        if(value.has("followedAt"))result.put("followedAt",iso(text(value,"followedAt",64)));
        JSONObject seenKeys=new JSONObject(),seenAt=new JSONObject();
        for(String field:List.of("seenAt","seenKeys")){
            Object raw=value.opt(field);if(raw==JSONObject.NULL)raw=null;if(raw!=null&&!(raw instanceof JSONObject))throw invalid(field);if(raw==null)continue;
            JSONObject seen=(JSONObject)raw;if(seen.length()>4)throw invalid(field);
            for(String rating:keys(seen)){if(!Set.of("general","explicit","all").contains(rating))throw invalid(field);
                if(field.equals("seenKeys"))seenKeys.put(rating,strings(array(seen,rating,4000),field,120,ProfileTransfer::catalogKey));else seenAt.put(rating,iso(string(seen.opt(rating),field,64)));}
        }
        return result.put("seenKeys",seenKeys).put("seenAt",seenAt);
    }
    private static boolean artistId(String value){if(value.isBlank()||value.length()>100)return false;for(int i=0;i<value.length();i++){char c=value.charAt(i);if(!Character.isLetterOrDigit(c)&&"_-.() ".indexOf(c)<0)return false;}return true;}
    private static String iso(String value){if(value.isBlank())return "";try{return java.time.OffsetDateTime.parse(value).toInstant().toString();}catch(Exception invalid){throw invalid("дата");}}
    private static JSONObject preferences(JSONObject raw) throws JSONException {
        JSONObject result=new JSONObject();
        for(String field:List.of("aiMode","attributionPriority"))if(raw.has(field)){
            String value=string(raw.opt(field),field,32);Set<String> supported=field.equals("aiMode")?Set.of("all","generated","generated-and-assisted"):Set.of("creator","original","uploader");if(!supported.contains(value))throw invalid(field);result.put(field,value);
        }
        for(String field:List.of("hideFurry","hideViewedAndSaved","hideFollowedArtists"))if(raw.has(field)){if(!(raw.opt(field) instanceof Boolean))throw invalid(field);result.put(field,raw.getBoolean(field));}
        if(raw.has("excludedTags"))result.put("excludedTags",strings(array(raw,"excludedTags",1000),"excludedTags",100,ProfileTransfer::tag));
        if(raw.has("hiddenAuthors")){
            JSONArray hidden=new JSONArray();for(Object value:values(array(raw,"hiddenAuthors",500))){if(!(value instanceof JSONObject))throw invalid("hiddenAuthors");JSONObject author=(JSONObject)value;
                String source=text(author,"source",20),id=text(author,"artistId",100);if(!source.equals("artist")&&!Arrays.asList(CatalogClient.SOURCES).contains(source)||!artistId(id))throw invalid("hiddenAuthors");hidden.put(new JSONObject().put("source",source).put("artistId",id).put("name",author.has("name")?text(author,"name",160):id));}result.put("hiddenAuthors",hidden);
        }
        if(raw.has("curation")){if(!(raw.opt("curation") instanceof JSONObject))throw invalid("curation");JSONObject curation=new JSONObject();for(String field:List.of("enabled","popularity","personal","freshness","resolution"))if(raw.getJSONObject("curation").has(field)){
            Object value=raw.getJSONObject("curation").opt(field);if(!(value instanceof Boolean))throw invalid("curation");curation.put(field,value);}result.put("curation",curation);}
        return result;
    }
    private static JSONArray portableIdentities(JSONArray source){JSONArray out=new JSONArray();for(Object value:values(source)){if(!(value instanceof String))throw invalid("identityKeys");String key=(String)value;if(key.length()<=250&&identity(key))out.put(key);}return out;}
    private static JSONObject localPost(JSONObject source) throws JSONException {JSONObject result=copy(source);if(result.has("identityKeys"))result.put("identityKeys",portableIdentities(array(result,"identityKeys",2000)));JSONArray members=new JSONArray();for(Object member:values(array(result,"groupMembers",100))){if(!(member instanceof JSONObject))throw invalid("groupMembers");members.put(localPost((JSONObject)member));}result.put("groupMembers",members);return result;}
    private static JSONArray recentKeys(Collection<String> keys){List<String> list=new ArrayList<>(keys);return new JSONArray(list.subList(Math.max(0,list.size()-4000),list.size()));}
    static JSONObject export(JSONObject mobile) throws JSONException {
        JSONObject result=new JSONObject().put("format","dart-profile").put("version",1).put("createdAt",Instant.now().toString()).put("platform","android");
        for(String field:List.of("likes","bookmarks","history")){JSONArray values=new JSONArray();JSONArray nativeOrder=array(mobile,field,100000);if(field.equals("history"))nativeOrder=reversed(nativeOrder);for(Object raw:values(nativeOrder)){
            if(!(raw instanceof JSONObject))throw invalid(field);JSONObject item=localPost((JSONObject)raw);
            item.put("key",item.optString("source")+":"+item.optString("id"));if(!item.has("popularityCount"))item.put("popularityCount",item.optInt("score"));values.put(post(item));}result.put(field,values);}
        if("artcatalog-mobile".equals(mobile.optString("format"))&&mobile.optInt("version")==1&&!mobile.has("likes"))result.put("likes",new JSONArray(result.getJSONArray("bookmarks").toString()));
        result.put("viewedIdentities",portableIdentities(array(mobile,"viewedIdentities",200000))).put("favoriteTags",array(mobile,"favoriteTags",100)).put("recommendationTags",choices(mobile.optJSONObject("recommendationTags")));
        JSONArray follows=new JSONArray();for(Object raw:values(array(mobile,"follows",2000))){
            if(!(raw instanceof JSONObject))throw invalid("follows");JSONObject value=(JSONObject)raw;String source=value.optString("source"),id=value.optString("tag",value.optString("artistId"));
            boolean uploader=!source.isBlank()&&!source.equals("artist");if(uploader)id=id.replaceFirst("^user:","");
            JSONObject f=new JSONObject().put("role",uploader?"uploader":"artist").put("source",uploader?source:"artist").put("artistId",id).put("name",value.optString("name",id)).put("followedAt",value.optString("followedAt"));
            f.put("gelbooruTag",value.optString("gelbooruTag"));JSONObject keys=value.optJSONObject("seenKeys");keys=keys==null?new JSONObject():copy(keys);JSONArray nativeSeen=value.optJSONArray("seen");if(nativeSeen!=null)for(String rating:List.of("general","explicit","all")){LinkedHashSet<String> merged=new LinkedHashSet<>();JSONArray old=keys.optJSONArray(rating);if(old!=null)for(Object key:values(old))merged.add(String.valueOf(key));for(Object key:values(nativeSeen))merged.add(String.valueOf(key));keys.put(rating,recentKeys(merged));}f.put("seenKeys",keys);
            f.put("seenAt",value.optJSONObject("seenAt")==null?new JSONObject():value.getJSONObject("seenAt"));follows.put(follow(f));
        }result.put("follows",follows);
        JSONObject prefs=mobile.optJSONObject("preferences")==null?new JSONObject():copy(mobile.getJSONObject("preferences"));
        if(prefs.opt("excludedTags") instanceof String)prefs.put("excludedTags",new JSONArray(CatalogLogic.excludedTags(prefs.getString("excludedTags"))));
        JSONArray hidden=new JSONArray();for(Object value:values(array(mobile,"hiddenAuthors",500)))if(value instanceof String){String key=(String)value;int at=key.indexOf(':');if(at>0)hidden.put(new JSONObject().put("source",key.substring(0,at)).put("artistId",key.substring(at+1)));}
        if(!prefs.has("hiddenAuthors"))prefs.put("hiddenAuthors",hidden);result.put("preferences",preferences(prefs));
        JSONArray groups=mobile.optJSONArray("recommendationExposureGroups");if(groups==null){groups=new JSONArray();for(Object key:values(array(mobile,"recentSuggestions",200000))){String normalized=String.valueOf(key).replaceFirst("^key:","");if(catalogKey(normalized))groups.put(new JSONArray().put(normalized));}while(groups.length()>512)groups.remove(0);}
        result.put("recommendationExposureGroups",groups);return result;
    }
    static JSONObject counts(JSONObject document) throws JSONException {JSONObject result=new JSONObject();for(String field:List.of("likes","bookmarks","history","follows","viewedIdentities","favoriteTags"))result.put(field,document.optJSONArray(field)==null?0:document.getJSONArray(field).length());result.put("recommendationTags",document.optJSONObject("recommendationTags")==null?0:document.getJSONObject("recommendationTags").length());return result;}
    private static int root(int[] roots,int index){while(roots[index]!=index){roots[index]=roots[roots[index]];index=roots[index];}return index;}
    private static final class SavedMerge {final JSONArray records;final int added;SavedMerge(JSONArray records,int added){this.records=records;this.added=added;}}
    private static SavedMerge mergeSaved(JSONArray current,JSONArray incoming) throws JSONException {
        List<Post> posts=new ArrayList<>(current.length()+incoming.length());for(Object value:values(current))posts.add(Post.fromJson((JSONObject)value));int localCount=posts.size();for(Object value:values(incoming))posts.add(Post.fromJson((JSONObject)value));
        int[] roots=new int[posts.size()],sizes=new int[posts.size()];Map<String,Integer> aliases=new HashMap<>();
        for(int i=0;i<posts.size();i++){roots[i]=i;sizes[i]=1;for(String identity:WorkGrouping.viewedTokens(posts.get(i))){Integer previous=aliases.putIfAbsent(identity,i);if(previous==null)continue;int first=root(roots,i),second=root(roots,previous);if(first!=second){if(sizes[first]<sizes[second]){int swap=first;first=second;second=swap;}roots[second]=first;sizes[first]+=sizes[second];}}}
        LinkedHashMap<Integer,List<Post>> groups=new LinkedHashMap<>();Set<Integer> localGroups=new HashSet<>();
        for(int i=0;i<posts.size();i++){int root=root(roots,i);groups.computeIfAbsent(root,key->new ArrayList<>()).add(posts.get(i));if(i<localCount)localGroups.add(root);}
        JSONArray records=new JSONArray();int added=0;for(Map.Entry<Integer,List<Post>> entry:groups.entrySet()){records.put(mergeSavedGroup(entry.getValue()).toJson());if(!localGroups.contains(entry.getKey()))added++;}return new SavedMerge(records,added);
    }
    /** A connected exact-identity component preserves local scalar metadata and unions its aliases. */
    private static Post mergeSavedGroup(List<Post> records) throws JSONException {
        if(records.size()==1)return records.get(0);
        JSONObject merged=records.get(0).toJson();boolean identical=true;for(int i=1;i<records.size();i++)if(!equal(merged,records.get(i).toJson())){identical=false;break;}if(identical)return records.get(0);
        Map<String,LinkedHashSet<String>> arrays=new LinkedHashMap<>();
        for(String field:List.of("tags","artistTags","characterTags","copyrightTags","memberKeys","identityKeys","uploaderKeys"))arrays.put(field,new LinkedHashSet<>());
        List<JSONArray> media=new ArrayList<>();Map<String,JSONObject> people=new LinkedHashMap<>();Map<String,Post> provenance=new LinkedHashMap<>();boolean complete=true;
        for(Post post:records){JSONObject json=post.toJson();
            for(String field:arrays.keySet()){JSONArray values=json.optJSONArray(field);if(values!=null)for(Object raw:values(values))arrays.get(field).add(String.valueOf(raw));}
            arrays.get("memberKeys").add(post.key());media.add(MediaIdentity.records(post));
            for(Object raw:values(post.participants)){JSONObject person=(JSONObject)raw;people.putIfAbsent(person.optString("tag")+"\u0000"+person.optString("role"),person);}
            Set<String> members=new HashSet<>(post.memberKeys);members.add(post.key());
            if(post.groupMembers.isEmpty()){
                if(members.size()>1)complete=false;else provenance.putIfAbsent(post.key(),post);
            }else for(Post member:post.groupMembers)provenance.putIfAbsent(member.key(),member);
            for(String field:List.of("title","creatorName","creatorTag","artist","originalUrl","uploaderId","uploaderName","thumbnail","image","original","sourceUrl","published","relatedQuery"))if(merged.optString(field).isBlank()&&!json.optString(field).isBlank())merged.put(field,json.get(field));
            if((!merged.has("popularityCount")||merged.isNull("popularityCount"))&&json.has("popularityCount")&&!json.isNull("popularityCount"))merged.put("popularityCount",json.get("popularityCount"));
        }
        for(Map.Entry<String,LinkedHashSet<String>> entry:arrays.entrySet()){int limit=entry.getKey().equals("identityKeys")?2000:1000;if(entry.getValue().size()>limit)throw invalid(entry.getKey());merged.put(entry.getKey(),new JSONArray(entry.getValue()));}
        if(people.size()>100)throw invalid("participants");merged.put("participants",new JSONArray(people.values()));JSONArray unique=MediaIdentity.unique(media),urls=new JSONArray();for(Object raw:values(unique))urls.put(((JSONObject)raw).getString("url"));merged.put("imageRecords",unique).put("images",urls);
        JSONArray members=new JSONArray();if(complete&&provenance.keySet().containsAll(arrays.get("memberKeys"))){if(provenance.size()>100)throw invalid("groupMembers");for(Post member:provenance.values()){JSONObject item=member.toJson();item.put("groupMembers",new JSONArray()).put("memberKeys",new JSONArray().put(member.key()));members.put(item);}merged.put("groupingVersion",2);}else merged.put("groupingVersion",0);
        merged.put("groupMembers",members);return Post.fromJson(merged);
    }
    static Merge merge(JSONObject local,JSONObject incoming,boolean applySettings) throws JSONException {
        JSONObject next=copy(local),added=new JSONObject(),skipped=new JSONObject();
        for(String field:List.of("likes","bookmarks","history")){
            JSONArray current=next.optJSONArray(field);if(current==null)current=new JSONArray();JSONArray arriving=incoming.getJSONArray(field);if(field.equals("history"))arriving=reversed(arriving);SavedMerge merged=mergeSaved(current,arriving);next.put(field,merged.records);added.put(field,merged.added);skipped.put(field,incoming.getJSONArray(field).length()-merged.added);
        }
        for(String field:List.of("viewedIdentities","favoriteTags")){
            LinkedHashSet<String> values=new LinkedHashSet<>();JSONArray current=next.optJSONArray(field);if(current!=null)for(Object raw:values(current))values.add(String.valueOf(raw));int before=values.size();for(Object raw:values(incoming.getJSONArray(field)))values.add(String.valueOf(raw));next.put(field,new JSONArray(values));added.put(field,values.size()-before);skipped.put(field,incoming.getJSONArray(field).length()-(values.size()-before));
        }
        LinkedHashSet<String> viewed=new LinkedHashSet<>();for(Object key:values(next.getJSONArray("viewedIdentities")))viewed.add(String.valueOf(key));for(Object raw:values(next.getJSONArray("history")))viewed.addAll(WorkGrouping.viewedTokens(Post.fromJson((JSONObject)raw)));next.put("viewedIdentities",new JSONArray(viewed));
        JSONObject tags=choices(next.optJSONObject("recommendationTags"));int beforeTags=tags.length();for(String tag:keys(incoming.getJSONObject("recommendationTags")))if(!tags.has(tag)||applySettings)tags.put(tag,incoming.getJSONObject("recommendationTags").getString(tag));if(tags.length()>1000)throw invalid("recommendationTags");next.put("recommendationTags",tags);added.put("recommendationTags",tags.length()-beforeTags);skipped.put("recommendationTags",incoming.getJSONObject("recommendationTags").length()-(tags.length()-beforeTags));
        LinkedHashMap<String,JSONObject> authors=new LinkedHashMap<>();JSONArray currentFollows=next.optJSONArray("follows");if(currentFollows!=null)for(Object raw:values(currentFollows)){JSONObject f=(JSONObject)raw;authors.put(f.optString("key"),copy(f));}int before=authors.size();
        for(Object raw:values(incoming.getJSONArray("follows"))){
            JSONObject f=(JSONObject)raw;boolean artist=f.getString("role").equals("artist");String source=artist?"":f.getString("source"),id=f.getString("artistId"),key=(artist?"artist":source)+":"+(artist?id.trim().toLowerCase(Locale.ROOT).replace(' ','_'):CatalogLogic.normalizeTag(id));
            JSONObject saved=authors.get(key);if(saved==null){saved=new JSONObject().put("key",key).put("tag",artist?id:"user:"+id).put("source",source).put("name",f.optString("name",id)).put("initialized",true);authors.put(key,saved);}
            JSONObject seenKeys=saved.optJSONObject("seenKeys");if(seenKeys==null)seenKeys=new JSONObject();LinkedHashSet<String> seen=new LinkedHashSet<>();JSONArray own=saved.optJSONArray("seen");if(own!=null)for(Object k:values(own))seen.add(String.valueOf(k));
            for(String rating:keys(f.getJSONObject("seenKeys"))){
                LinkedHashSet<String> keys=new LinkedHashSet<>();JSONArray old=seenKeys.optJSONArray(rating);if(old!=null)for(Object k:values(old))keys.add(String.valueOf(k));for(Object k:values(f.getJSONObject("seenKeys").getJSONArray(rating))){keys.add(String.valueOf(k));seen.add(String.valueOf(k));}seenKeys.put(rating,new JSONArray(keys));}
            saved.put("seen",new JSONArray(seen)).put("seenKeys",seenKeys);if(!saved.has("seenAt"))saved.put("seenAt",copy(f.getJSONObject("seenAt")));if(!saved.has("followedAt"))saved.put("followedAt",f.optString("followedAt"));if(!saved.has("gelbooruTag"))saved.put("gelbooruTag",f.optString("gelbooruTag"));
        }
        next.put("follows",new JSONArray(authors.values()));added.put("follows",authors.size()-before);skipped.put("follows",incoming.getJSONArray("follows").length()-(authors.size()-before));
        List<List<String>> groups=new ArrayList<>();JSONArray oldGroups=next.optJSONArray("recommendationExposureGroups");if(oldGroups!=null)for(Object raw:values(oldGroups)){List<String> keys=new ArrayList<>();for(Object key:values((JSONArray)raw))keys.add(String.valueOf(key));groups=ExposureHistory.append(groups,keys);}for(Object raw:values(incoming.getJSONArray("recommendationExposureGroups"))){List<String> keys=new ArrayList<>();for(Object key:values((JSONArray)raw))keys.add(String.valueOf(key));groups=ExposureHistory.append(groups,keys);}next.put("recommendationExposureGroups",new JSONArray(groups));
        if(applySettings){JSONObject prefs=next.optJSONObject("preferences");if(prefs==null)prefs=new JSONObject();JSONObject incomingPrefs=incoming.getJSONObject("preferences");for(String field:keys(incomingPrefs))if(!Set.of("hiddenAuthors","curation","excludedTags").contains(field))prefs.put(field,incomingPrefs.get(field));
            if(incomingPrefs.has("curation")){JSONObject curation=prefs.optJSONObject("curation");curation=curation==null?new JSONObject():copy(curation);JSONObject selected=incomingPrefs.getJSONObject("curation");for(String field:keys(selected))curation.put(field,selected.get(field));prefs.put("curation",curation);}
            if(incomingPrefs.has("excludedTags")){LinkedHashMap<String,String> excluded=new LinkedHashMap<>();Object old=prefs.opt("excludedTags");if(old instanceof String){for(String raw:((String)old).split("[,\\r\\n]+")){String tag=raw.trim();if(!tag.isBlank())excluded.putIfAbsent(CatalogLogic.normalizeTag(tag),tag);}}else if(old instanceof JSONArray)for(Object raw:values((JSONArray)old)){String tag=String.valueOf(raw);excluded.putIfAbsent(CatalogLogic.normalizeTag(tag),tag);}for(Object raw:values(incomingPrefs.getJSONArray("excludedTags"))){String tag=String.valueOf(raw);excluded.putIfAbsent(CatalogLogic.normalizeTag(tag),tag);}if(excluded.size()>1000)throw invalid("excludedTags");prefs.put("excludedTags",String.join(", ",excluded.values()));}
            next.put("preferences",prefs);
            LinkedHashSet<String> hidden=new LinkedHashSet<>();JSONArray old=next.optJSONArray("hiddenAuthors");if(old!=null)for(Object key:values(old))hidden.add(String.valueOf(key));JSONArray importHidden=incomingPrefs.optJSONArray("hiddenAuthors");if(importHidden!=null)for(Object raw:values(importHidden)){JSONObject a=(JSONObject)raw;hidden.add(a.getString("source")+":"+a.getString("artistId"));}next.put("hiddenAuthors",new JSONArray(hidden));
        }
        return new Merge(next,added,skipped,!equal(local,next));
    }
}
