const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const file=require('node:path').join(__dirname,'../wwwroot/keyboard-scroll.js');
const Scroll=fs.existsSync(file)?require(file):null;
const event=(code,extra={})=>({code,key:code,...extra});
test('one shared vertical keyboard-scroll owner is available',()=>assert(Scroll));
test('physical W/S and arrows work with Russian, German, uppercase and key-only events',()=>{
 assert(Scroll);
 for(const e of [event('KeyS',{key:'ы'}),event('ArrowDown'),{key:'S'},{key:'s'}])assert.equal(Scroll.direction(e),1);
 for(const e of [event('KeyW',{key:'ц'}),event('ArrowUp'),{key:'W'},{key:'w'}])assert.equal(Scroll.direction(e),-1);
 for(const e of [event('KeyA'),event('KeyD'),event('Space'),event('KeyB'),event('KeyF'),event('ArrowLeft'),event('ArrowRight')])assert.equal(Scroll.direction(e),0);
});
test('modified, composing, consumed and native-control events are preserved',()=>{
 assert(Scroll);
 for(const change of [{ctrlKey:true},{metaKey:true},{altKey:true},{isComposing:true},{defaultPrevented:true}])assert.equal(Scroll.direction(event('KeyS',change)),0);
 for(const selector of ['input','textarea','select','video','audio','iframe','[role="slider"]','[role="combobox"]','[role="listbox"]','[role="menu"]','[role="tablist"]']){
  const target={closest:query=>query.includes(selector)?{}:null};assert.equal(Scroll.direction(event('KeyS'),target),0);
 }
 assert.equal(Scroll.direction(event('ArrowDown',{shiftKey:true})),0);
 assert.equal(Scroll.direction(event('KeyS'),{isContentEditable:true}),0);
 assert.equal(Scroll.direction(event('KeyS'),{closest:()=>null}),1,'ordinary image/button focus permits page scrolling');
});
function fixture({instant=false}={}){
 assert(Scroll);const pending=new Map();let time=0,id=0,scope={},valid=true;
 const element={scrollTop:300,scrollHeight:5000,clientHeight:1000,isConnected:true,scrollTo({top}){this.scrollTop=top;}};
 const controller=Scroll.create({requestFrame:callback=>{pending.set(++id,callback);return id;},cancelFrame:id=>pending.delete(id),
  now:()=>time,allowed:owner=>owner===scope&&valid,reducedMotion:()=>instant});
 const frame=(dt=16)=>{time+=dt;const jobs=[...pending.values()];pending.clear();for(const callback of jobs)callback(time);};
 return{controller,element,pending,frame,get scope(){return scope;},switch(){scope={};},block(){valid=false;},finish(){for(let i=0;i<40&&pending.size;i++)frame();}};
}
test('one press scrolls smoothly by a bounded distance and stops scheduling frames',()=>{
 const f=fixture();assert(f.controller.step(f.element,1,f.scope));assert.equal(f.element.scrollTop,300);
 f.frame();assert(f.element.scrollTop>300&&f.element.scrollTop<400);f.finish();assert.equal(f.element.scrollTop,400);assert.equal(f.pending.size,0);
});
test('repeat uses one animation, caps queued travel and reverses immediately',()=>{
 const f=fixture();for(let i=0;i<100;i++)f.controller.step(f.element,1,f.scope);
 assert.equal(f.pending.size,1);f.finish();assert(f.element.scrollTop<=800);
 f.controller.step(f.element,1,f.scope);f.frame();const before=f.element.scrollTop;
 f.controller.step(f.element,-1,f.scope);f.frame();assert(f.element.scrollTop<before);f.finish();assert.equal(f.pending.size,0);
});
test('boundaries, smaller windows and changing content heights stay within the current page',()=>{
 const f=fixture();f.element.scrollTop=0;assert.equal(f.controller.step(f.element,-1,f.scope),false);assert.equal(f.pending.size,0);
 f.element.clientHeight=500;f.controller.step(f.element,1,f.scope);f.finish();assert.equal(f.element.scrollTop,50);
 f.element.scrollTop=4490;f.controller.step(f.element,1,f.scope);f.finish();assert.equal(f.element.scrollTop,4500);
 f.element.scrollTop=300;f.controller.step(f.element,1,f.scope);f.element.scrollHeight=550;f.finish();assert(f.element.scrollTop<=50);
});
test('reduced motion scrolls immediately without animation',()=>{
 const f=fixture({instant:true});f.controller.step(f.element,-1,f.scope);assert.equal(f.element.scrollTop,200);assert.equal(f.pending.size,0);
});
test('a delayed frame finishes the short scroll instead of creating a trailing input queue',()=>{
 const f=fixture();f.controller.step(f.element,1,f.scope);f.frame(300);
 assert.equal(f.element.scrollTop,400);assert.equal(f.pending.size,0);
});
test('blur, manual scrolling, disconnected nodes and page/modal changes cancel pending movement',()=>{
 for(const action of [f=>f.controller.cancel(),f=>f.switch(),f=>f.block(),f=>f.element.isConnected=false]){
  const f=fixture();f.controller.step(f.element,1,f.scope);f.frame();const before=f.element.scrollTop;action(f);f.finish();assert.equal(f.element.scrollTop,before);assert.equal(f.pending.size,0);
 }
});
test('scroll target prefers the nearest actual scrollable panel inside its owner',()=>{
 assert(Scroll);const root={scrollHeight:3000,clientHeight:1000,contains:n=>[panel,leaf].includes(n)},
  panel={parentElement:root,scrollHeight:500,clientHeight:100},leaf={parentElement:panel};
 const style=node=>({overflowY:node===panel?'auto':'visible'});
 assert.equal(Scroll.target(leaf,root,style),panel);
 panel.scrollHeight=100;assert.equal(Scroll.target(leaf,root,style),root);
 assert.equal(Scroll.target({parentElement:null},root,style),root,'outside pointer cannot select another page');
});
