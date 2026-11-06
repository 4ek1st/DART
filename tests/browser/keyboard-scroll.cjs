'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require(process.env.DART_PLAYWRIGHT_PATH||'playwright');
const gallery=require('./preview-gallery.cjs');
const output=process.env.DART_QA_OUTPUT||path.join(os.tmpdir(),'dart-keyboard-scroll');
const report={viewport:{width:2560,height:1440},checks:[],errors:[],performance:[]};
const check=(value,label)=>{report.checks.push({label,passed:!!value});assert(value,label);};
let browser;
const position=page=>page.evaluate(()=>main.scrollTop);
async function keyScroll(page,key,direction,label){
 await page.evaluate(()=>{main.scrollTop=Math.min(180,(main.scrollHeight-main.clientHeight)/2);main.focus({preventScroll:true});});
 const before=await position(page),began=performance.now();await page.keyboard.press(key);
 await page.waitForFunction(({before,direction})=>direction>0?main.scrollTop>before+2:main.scrollTop<before-2,{before,direction},{timeout:1500});
 check(true,label);await page.waitForTimeout(220);
 report.performance.push({label,settledMs:Math.round(performance.now()-began),delta:Math.round((await position(page))-before)});
}
(async()=>{fs.mkdirSync(output,{recursive:true});
 try{browser=await chromium.launch({headless:true,executablePath:process.env.DART_BROWSER_EXE});gallery.useBrowser(browser);
  for(const surface of (process.argv.includes('--likes-only')?['likes']:['related','home','search','recommendations','follows','likes','bookmarks','recent','favorites','profile','settings'])){
   const f=await gallery.fixture(surface,{large:surface==='likes',dimensions:surface==='related'?{width:900,height:3000}:{width:800,height:600}}),{page}=f;
   page.setDefaultTimeout(5000);page.on('pageerror',e=>report.errors.push({surface,error:e.message}));
   try{
    if(surface==='settings')await page.setViewportSize({width:1100,height:700});
    await page.waitForFunction(()=>main.scrollHeight>main.clientHeight+100);
    const art=surface==='related'?page.locator('.detail-image img').first():page.locator('.card-art').first();
    if(await art.count())await art.hover();
    if(surface==='likes')await page.evaluate(()=>{
      window.__keyboardTiming={keys:[],longTasks:[]};let began;
      document.addEventListener('keydown',e=>{if(['KeyS','KeyW','ArrowDown','ArrowUp'].includes(e.code))began={at:performance.now(),top:main.scrollTop};},true);
      main.addEventListener('scroll',()=>{if(began&&main.scrollTop!==began.top){__keyboardTiming.keys.push(performance.now()-began.at);began=undefined;}});
      new PerformanceObserver(list=>{for(const t of list.getEntries())__keyboardTiming.longTasks.push(t.duration);}).observe({type:'longtask'});
    });
    await keyScroll(page,'s',1,surface+': S scrolls down over the artwork/page');
    await keyScroll(page,'w',-1,surface+': W scrolls up');
    await keyScroll(page,'ArrowDown',1,surface+': down arrow scrolls down');
    await keyScroll(page,'ArrowUp',-1,surface+': up arrow scrolls up');
    if(surface==='likes'){
      const data=await page.evaluate(()=>({...__keyboardTiming,likes:likes.length,viewed:viewedTokens.size,tabs:tabs.length}));
      check(data.likes>=2400&&data.viewed>=100000&&data.tabs>=16,'large fixture retains library/history/mixed tabs');report.largeFixture=data;
      await page.evaluate(()=>{main.scrollTop=500;main.focus();});
      for(let i=0;i<10;i++){await page.keyboard.down('s');await page.waitForTimeout(18);}await page.keyboard.up('s');
      await page.waitForTimeout(230);const stopped=await position(page);await page.waitForTimeout(230);
      report.held={stopped,after:await position(page)};
      check(stopped>500&&Math.abs(report.held.after-stopped)<1,'held S moves continuously then stops');
      await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{main.scrollTop=300;main.focus();});await page.keyboard.press('s');
      check((await position(page))>300,'reduced motion scrolls without an animation delay');await page.emulateMedia({reducedMotion:'no-preference'});
      await page.evaluate(()=>{main.scrollTop=0;main.focus();});await page.keyboard.press('w');await page.waitForTimeout(60);check(await position(page)===0,'top boundary stays at the current page');
      const scrollable=page.locator('.card-art').first();await scrollable.hover();await page.keyboard.press('Space');await page.waitForFunction(()=>quickPreview.open);
      const prior=await position(page);await page.keyboard.press('s');await page.waitForFunction(()=>quickPreviewGallery?.state.index===1);
      check((await position(page))===prior,'Space gallery S changes its image without scrolling the page behind it');
      await page.keyboard.press('w');await page.waitForFunction(()=>quickPreviewGallery.state.index===0);await page.keyboard.press('Escape');
      check(await page.evaluate(()=>!quickPreview.open),'Escape still closes Space gallery');
      await page.evaluate(()=>{const panel=document.createElement('div');panel.id='keyboard-panel';panel.style.cssText='position:fixed;top:200px;left:500px;width:250px;height:150px;overflow:auto;z-index:4;background:#222';panel.innerHTML='<div style="height:1200px">Neutral scrollable panel</div>';main.append(panel);main.scrollTop=0;main.focus();});
      await page.locator('#keyboard-panel').hover();await page.keyboard.press('s');await page.waitForFunction(()=>document.getElementById('keyboard-panel').scrollTop>10);
      check((await position(page))===0,'nested panel owns scrolling while the main page keeps its position');await page.evaluate(()=>document.getElementById('keyboard-panel').remove());
      await page.evaluate(()=>{const d=document.createElement('dialog');d.id='keyboard-dialog';d.style.cssText='width:450px;height:300px;overflow:auto';d.innerHTML='<button>Neutral button</button><div style="height:1500px">Neutral dialog contents</div>';document.body.append(d);d.showModal();d.querySelector('button').focus();});
      await page.locator('#keyboard-dialog').hover();const underneath=await position(page);await page.keyboard.press('s');await page.waitForFunction(()=>document.getElementById('keyboard-dialog').scrollTop>10);
      check((await position(page))===underneath,'a scrollable dialog moves without moving the underlying page');await page.evaluate(()=>document.getElementById('keyboard-dialog').remove());
      await page.evaluate(()=>{main.scrollTop=200;const area=document.createElement('div');area.id='keyboard-input';area.innerHTML='<input><textarea></textarea><select><option>One</option><option>Two</option></select><input type="range"><div contenteditable="true"></div><video controls tabindex="0"></video>';main.prepend(area);});
      for(const selector of ['input:not([type])','textarea','select','input[type="range"]','[contenteditable]','video']){
        await page.locator('#keyboard-input '+selector).focus();const top=await position(page);await page.keyboard.press('s');await page.keyboard.press('ArrowDown');await page.waitForTimeout(150);
        check(Math.abs((await position(page))-top)<1,'native controls keep vertical keys: '+selector);
      }
      check(await page.locator('#keyboard-input input:not([type])').inputValue()==='s','S remains text in the input');await page.evaluate(()=>document.getElementById('keyboard-input').remove());
      await page.evaluate(()=>{main.scrollTop=0;main.focus();});await page.locator('.card-art').first().click({button:'right'});
      await page.waitForFunction(()=>!recommendationTagMenu.hidden);const menuTop=await position(page);await page.keyboard.press('s');await page.keyboard.press('ArrowDown');await page.waitForTimeout(180);
      check((await position(page))===menuTop,'context-menu keys cannot scroll the background page');await page.keyboard.press('Escape');
      await page.locator('#tab-list-button').click();const tabsTop=await position(page);await page.keyboard.press('ArrowDown');await page.waitForTimeout(180);
      check((await position(page))===tabsTop,'the tab list keeps its arrow navigation');await page.keyboard.press('Escape');
      await page.evaluate(()=>{main.scrollTop=200;main.focus();});const cdp=await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyS',key:'ы',windowsVirtualKeyCode:83,nativeVirtualKeyCode:83});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyS',key:'ы',windowsVirtualKeyCode:83,nativeVirtualKeyCode:83});
      await page.waitForFunction(()=>main.scrollTop>205);check(true,'physical S works in the Russian keyboard layout');await cdp.detach();
      await page.evaluate(()=>{main.focus();main.scrollTop=200;});await page.keyboard.down('s');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('s');
      const blurred=await position(page);await page.waitForTimeout(180);check((await position(page))===blurred,'window blur cancels queued scrolling');
      const original=await page.evaluate(()=>activeId);await page.evaluate(()=>{main.scrollTop=200;main.focus();});await page.keyboard.down('s');
      await page.evaluate(()=>activate(tabs.find(tab=>tab.id!==activeId).id));await page.keyboard.up('s');await page.waitForFunction(()=>currentTab()?.loading===false);
      const switched=await position(page);await page.waitForTimeout(200);check((await position(page))===switched,'tab switching cancels pending movement in the reused main element');
      await page.evaluate(id=>activate(id),original);await page.waitForFunction(()=>currentTab()?.loading===false);
      await page.evaluate(()=>{main.scrollTop=0;main.focus();});await page.screenshot({path:path.join(output,'keyboard-scroll-1440p.png')});
    }
   }finally{await f.context.close();}
  }
  check(!report.errors.length,'no browser runtime errors');
 }catch(e){report.failure={message:e.message,stack:e.stack};throw e;}
 finally{await browser?.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks.length,errors:report.errors,failure:report.failure,output}));}
})().catch(e=>{console.error(e);process.exitCode=1;});
