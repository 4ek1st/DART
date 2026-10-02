const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../wwwroot/app.js'),'utf8');
function fixture(kind='search') {
  let now=0,finish;
  const tab={id:7,kind,hasMore:true,relatedHasMore:true};
  const marker={isConnected:true,dataset:{tabId:'7',autoLoad:kind}};
  const main={clientHeight:1330,scrollTop:0,querySelector:()=>marker};
  const requests=[];
  class IntersectionObserver {
    constructor(callback,options){this.callback=callback;this.options=options;}
    observe(){} unobserve(){} disconnect(){}
  }
  const load=async(current,append)=>{
    requests.push({kind:current.kind,append});
    current.loading=true;
    await new Promise(resolve=>{finish=resolve;});
    current.loading=false;
  };
  const start=source.indexOf('const autoFeed = {'),end=source.indexOf('\nlet virtualScrollPending',start);
  const feed=vm.runInNewContext(source.slice(start,end)+'\nautoFeed',{
    main,IntersectionObserver,currentTab:()=>tab,Date:{now:()=>now},
    loadSearch:load,loadProfile:load,loadRelated:load,loadMoreFollows:load,loadRecommendations:load
  });
  feed.mount();
  return {feed,main,tab,marker,requests,setTime:t=>{now=t;},finish:()=>finish(),
    intersect:()=>feed.observer.callback([{isIntersecting:true,target:marker}])};
}
test('a slow pending next page is not requested again by another scroll event',async()=>{
  const f=fixture();f.intersect();f.intersect();
  assert.equal(f.requests.length,1);
  assert.equal(f.requests[0].append,true);
  f.finish();await Promise.resolve();await Promise.resolve();
});
test('pagination waits while a feed is busy, failed or exhausted',()=>{
  for(const kind of ['search','profile','recommendations','follows','related']){
    for(const status of ['busy','failed','exhausted']){
      const f=fixture(kind);
      if(kind==='related'){
        f.tab.relatedLoading=status==='busy';f.tab.relatedError=status==='failed';
        f.tab.relatedHasMore=status!=='exhausted';
      }else{
        f.tab.loading=status==='busy';f.tab.loadError=status==='failed';
        f.tab.followLoadError=status==='failed';f.tab.hasMore=status!=='exhausted';
      }
      f.intersect();assert.equal(f.requests.length,0,kind+': '+status);
    }
  }
});
test('a removed marker or another tab cannot start a page request',()=>{
  const f=fixture();f.marker.isConnected=false;f.intersect();
  f.marker.isConnected=true;f.tab.id=8;f.intersect();
  assert.equal(f.requests.length,0);
});
test('lookahead grows for fast scrolling and stays bounded after a slow response',async()=>{
  const f=fixture();
  const bottom=()=>Number(f.feed.observer.options.rootMargin.split(' ')[2].replace('px',''));
  assert.equal(bottom(),2660);
  f.setTime(200);f.main.scrollTop=300;f.feed.mount();
  assert(bottom()>2660);
  f.intersect();f.setTime(6200);f.finish();await Promise.resolve();await Promise.resolve();
  f.setTime(6300);f.main.scrollTop=600;f.feed.mount();
  assert(bottom()<=7980);
  assert(bottom()>2660);
  f.main.clientHeight=900;f.feed.mount();assert(bottom()<=5400);
});

test('returning to a buffered page does not prefetch again until the user scrolls',async()=>{
  const f=fixture();f.main.scrollHeight=5000;f.tab.resumePrefetchAt=0;
  f.intersect();assert.equal(f.requests.length,0);
  f.main.scrollTop=20;f.feed.mount();f.intersect();
  assert.equal(f.requests.length,1);assert.equal(f.tab.resumePrefetchAt,undefined);
  f.finish();await Promise.resolve();
});

test('returning to an underfilled page still loads enough content for the viewport',async()=>{
  const f=fixture();f.main.scrollHeight=1400;f.tab.resumePrefetchAt=0;
  f.intersect();assert.equal(f.requests.length,1);
  f.finish();await Promise.resolve();
});
