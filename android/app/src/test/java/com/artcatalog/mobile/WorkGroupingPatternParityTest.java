package com.artcatalog.mobile;

import org.junit.Test;
import java.net.URI;
import java.util.*;
import java.util.regex.*;
import static org.junit.Assert.*;

public class WorkGroupingPatternParityTest {
    private static String previousPublication(String raw){try{URI url=URI.create(raw);String host=url.getHost().toLowerCase(Locale.ROOT).replaceFirst("^(www|mobile)\\.",""),path=url.getPath();Matcher m;
        if(host.equals("pixiv.net")){m=Pattern.compile("^/(?:en/)?artworks/(\\d{5,12})(?:/|$)").matcher(path);if(m.find())return "group:pixiv:"+m.group(1);}
        if(host.equals("i.pximg.net")){m=Pattern.compile("/(\\d{5,12})(?:-[a-f0-9]{32})?_p\\d+(?:_[^/.]+)?\\.(?:jpe?g|png|gif|webp)$").matcher(path);if(m.find())return "group:pixiv:"+m.group(1);}
        if(host.equals("x.com")||host.equals("twitter.com")){m=Pattern.compile("^/(?:[^/]+/status|i/web/status)/(\\d{5,25})(?:/|$)").matcher(path);if(m.find())return "original:x-status:"+m.group(1);}
        }catch(Exception ignored){}return "";}
    @Test public void cachedPublicationPatternsPreserveLegacyBoundaryAndMalformedUrlDecisions(){
        List<String> urls=new ArrayList<>(Arrays.asList(null,""," ","/artworks/123456","mailto:qa@example.com","https://","https://PIXIV.NET/artworks/123456","https://pixiv.net/artworks/1234","https://pixiv.net/artworks/1234567890123","https://pixiv.net/artworks/123456bad","https://x.com/qa/status/1234","https://x.com/qa/status/123456bad","https://notpixiv.net/artworks/123456"));
        for(String host:List.of("pixiv.net","www.pixiv.net","mobile.pixiv.net","x.com","twitter.com","i.pximg.net"))for(String path:List.of("/artworks/123456","/en/artworks/123456/","/qa/status/123456","/i/web/status/123456","/img/123456_p0.jpg","/img/123456-0123456789abcdef0123456789abcdef_p3_master1200.png"))for(String suffix:List.of("","?neutral=1","#neutral"))urls.add("https://"+host+path+suffix);
        for(String url:urls)assertEquals(previousPublication(url),WorkGrouping.publication(url));
    }
    @Test public void cachedParentPatternPreservesViewedTokenSafetyForEveryCatalog(){
        Post post=new Post();post.source="danbooru";post.id="1";post.originalUrl="https://pixiv.net/artworks/123456";post.identityKeys=new ArrayList<>();
        for(String source:List.of("danbooru","gelbooru","rule34","sankaku","other"))for(String suffix:List.of("1","","abc","one\ntwo"))post.identityKeys.add("group:"+source+":parent:"+suffix);
        post.identityKeys.addAll(List.of("Group:danbooru:parent:1","group:pixiv:123456","hash:neutral","group:danbooru:parents:1"));Set<String> expected=new LinkedHashSet<>(WorkGrouping.tokens(post));
        expected.removeIf(token->token.matches("group:(?:danbooru|gelbooru|rule34|sankaku):parent:.*"));assertEquals(expected,WorkGrouping.viewedTokens(post));
    }
}
