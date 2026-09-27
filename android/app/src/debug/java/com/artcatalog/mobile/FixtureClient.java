package com.artcatalog.mobile;

import android.graphics.*;
import java.util.*;
import org.json.*;

/** Deterministic QA data. This source set is excluded from release APKs. */
final class FixtureClient extends CatalogClient {
    final ArrayList<Post> fixtures=new ArrayList<>();private int navigationRetryFailures;
    FixtureClient(Store store,ImageLoader images) throws Exception {
        super(store);
        String[] titles={"Тихое утро","За горизонтом","Лунная долина","Тёплый вечер","Небо над морем","Зелёные холмы","Дальний берег","Звёздный свет"};
        int[] colors={0xff6088a4,0xff947ab8,0xff38647e,0xffc48d81,0xff4c98aa,0xff628f80,0xff8d89ad,0xff374962};
        for(int i=0;i<8;i++){
            Bitmap bitmap=Bitmap.createBitmap(720,900,Bitmap.Config.RGB_565);Canvas canvas=new Canvas(bitmap);Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
            paint.setShader(new LinearGradient(0,0,0,900,new int[]{colors[i],0xff182536},null,Shader.TileMode.CLAMP));canvas.drawRect(0,0,720,900,paint);paint.setShader(null);
            paint.setColor(0xffefdab5);canvas.drawCircle(470-i*17,190+i*10,68,paint);
            Path mountain=new Path();mountain.moveTo(0,630);mountain.lineTo(170,350);mountain.lineTo(400,670);mountain.lineTo(580,410);mountain.lineTo(720,600);mountain.lineTo(720,900);mountain.lineTo(0,900);mountain.close();paint.setColor(0xff334959);canvas.drawPath(mountain,paint);
            Path near=new Path();near.moveTo(0,760);near.cubicTo(240,550,420,850,720,650);near.lineTo(720,900);near.lineTo(0,900);near.close();paint.setColor(0xff192f3e);canvas.drawPath(near,paint);
            paint.setColor(Color.argb(180,255,255,255));for(int star=0;star<12;star++)canvas.drawCircle(45+star*56,(star*73+i*41)%300+30,2,paint);
            String url="https://cdn.donmai.us/artcatalog-qa/landscape-"+i+".jpg";images.seed(url,bitmap);
            for(int copy=0;copy<8;copy++){
                String copyUrl="https://cdn.donmai.us/artcatalog-qa/landscape-"+(copy*8+i)+".jpg";images.seed(copyUrl,bitmap);
                Post p=new Post();p.source="danbooru";p.id=String.valueOf(9000000+copy*8+i);p.title=titles[i];p.artist=copy<4?"Test artist":"Second artist";p.artistTag=copy<4?"artcatalog_test_artist":"artcatalog_second_artist";p.artistTags=List.of(p.artistTag);p.rating="g";p.preview=copyUrl;p.image=copyUrl;p.original=copyUrl;p.sourceUrl="https://danbooru.donmai.us/posts/"+p.id;p.hash="fixture-"+p.id;p.width=720;p.height=900;p.score=100-i*7+copy;p.tags=new ArrayList<>(List.of("landscape","sky",i%2==0?"ocean":"nature",p.artistTag,"original","qa_character"));p.characterTags=List.of("qa_character");for(int t=0;t<15;t++)p.tags.add("qa_tag_"+t);p.media=List.of(copyUrl);if(i==0)p.media=List.of(copyUrl,"https://cdn.donmai.us/artcatalog-qa/landscape-1.jpg");fixtures.add(p);
            }bitmap.recycle();
        }
        fixtures.sort(Comparator.comparingInt(p->Integer.parseInt(p.id)));
    }
    @Override Page search(String query,Map<String,Integer> pages,String rating,String sort){
        if(query.equals("qa_slow_navigation"))try{Thread.sleep(650);}catch(InterruptedException e){Thread.currentThread().interrupt();}
        Page page=new Page();int offset=pages.values().stream().mapToInt(Integer::intValue).min().orElse(0)*16;
        if(query.equals("qa_navigation_retry")&&navigationRetryFailures++==0){page.errors.put("danbooru","QA transient failure");return page;}
        List<Post> matches=new ArrayList<>();if(query.equals("qa_hidden_pages")||query.equals("qa_hidden_first")){boolean first=query.equals("qa_hidden_first");for(int i=0;i<(first?32:48);i++){Post p=Post.fromJson(fixtures.get(i).toJson());if(first?i<16:i>=16&&i<32)p.tags.add("qa_hidden");matches.add(p);}}else for(Post p:fixtures)if(CatalogLogic.matchesRating(p.rating,rating)&&(query.isBlank()||query.contains("order:")||query.equals("qa_slow_navigation")||query.equals("qa_navigation_retry")||p.tags.contains(query)))matches.add(p);
        for(int i=offset;i<Math.min(offset+16,matches.size());i++)page.posts.add(matches.get(i));
        if(offset+16<matches.size())page.more.addAll(pages.keySet());return page;
    }
    @Override List<String> tags(String query){return List.of("landscape","sky","ocean","nature");}
    @Override Page search(String query,Map<String,Integer> pages,String rating,String sort,java.util.function.Consumer<Page> arrived){Page result=search(query,pages,rating,sort);if(arrived!=null)arrived.accept(result);return result;}
    @Override List<String> artistTags(Post p){return List.of("artcatalog_test_artist");}
    void benchmark() throws Exception {List<Post> works=new ArrayList<>();Random random=new Random(73);for(int i=0;i<1000;i++){Post p=new Post();p.source="rule34";p.id=String.valueOf(i*100);p.rating="g";p.uploaderId=String.valueOf(i%50);p.tags=List.of("landscape","sky","ocean","work_"+i);p.media=List.of("https://rule34.xxx/qa/"+i+".jpg");for(int j=0;j<6;j++)p.visualSamples.put(new JSONObject().put("owner",p.uploaderId).put("hash",String.format(Locale.ROOT,"%016x",random.nextLong())).put("tags",new JSONArray(p.tags)));works.add(p);}long started=android.os.SystemClock.elapsedRealtime();List<Post> result=CatalogLogic.merge(works,List.of());android.util.Log.i("ArtCatalogQA","Grouping 1000 works / 6000 samples: "+(android.os.SystemClock.elapsedRealtime()-started)+" ms, "+result.size()+" groups, thread="+Thread.currentThread().getName());}
}
