'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require(process.env.DART_PLAYWRIGHT_PATH||'playwright');
const web=path.resolve(__dirname,'../../wwwroot'),app=fs.readFileSync(path.join(web,'app.js'),'utf8');
const output=process.env.DART_QA_OUTPUT||path.join(os.tmpdir(),'dart-recent-search-remove');
fs.mkdirSync(output,{recursive:true});
const block=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));
const fixtureScript=`
const searchInput=document.getElementById('search-input'),popover=document.getElementById('search-popover');
const tagSuggestions=[],favoriteTags=['neutral_favorite'];const names={};window.searches=[];window.saved=[];
function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function currentSearchOptions(){return{};}function openSearch(query){searches.push(query);}
function saveSession(){saved.push({searchHistory:getSearchHistory()});}function toast(message){document.getElementById('status').textContent=message;}
if(!localStorage.getItem('fixture-seeded')){localStorage.setItem('fixture-seeded','1');localStorage.setItem('artcatalog-search-history',JSON.stringify(['neutral_one','neutral_two','neutral_very_long_'+('query_'.repeat(40))]));}
${block('function getSearchHistory(','\nfunction scheduleRule34Recovery(')}
${block('function renderPopover(','\nfunction showPopover(')}
${block("popover.addEventListener('click'",'\ndocument.addEventListener(\'contextmenu\'')}
searchInput.addEventListener('focus',renderPopover);searchInput.addEventListener('input',renderPopover);renderPopover();`;
let browser;const checks=[],errors=[];
const check=(condition,label)=>{assert(condition,label);checks.push(label);};
(async()=>{try{
 browser=await chromium.launch({headless:true,executablePath:process.env.DART_BROWSER_EXE});
 for(const language of ['en','ru','de'])for(const small of [false,true]){
  const context=await browser.newContext({viewport:small?{width:360,height:800}:{width:2560,height:1440},reducedMotion:'reduce'});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await context.route('http://dart.search-remove.test/**',async route=>{const url=new URL(route.request().url());
   if(url.pathname==='/')return route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/themes.css"></head><body style="padding:20px"><div class="search-form" style="position:relative;width:600px;max-width:calc(100vw - 40px)"><input id="search-input" placeholder="Search"><div class="search-popover" id="search-popover"></div></div><div id="status"></div><script src="/catalog-logic.js"></script><script src="/locales.js"></script><script src="/i18n.js"></script><script src="/fixture.js"></script></body></html>'});
   if(url.pathname==='/fixture.js')return route.fulfill({contentType:'application/javascript',body:fixtureScript});
   const file=path.join(web,url.pathname.slice(1));if(!fs.existsSync(file))return route.abort();
   return route.fulfill({contentType:file.endsWith('.css')?'text/css':'application/javascript',body:fs.readFileSync(file)});
  });
  await page.goto('http://dart.search-remove.test/');
  await page.evaluate(({language,small})=>{DartI18n.setLanguage(language);document.documentElement.dataset.theme=small?'light':'dark';},{language,small});
  const tooltip={en:'Remove from recent searches',ru:'Удалить из недавних запросов',de:'Aus letzten Suchanfragen entfernen'}[language];
  await page.waitForFunction(tooltip=>document.querySelector('[data-history-remove]').title===tooltip,tooltip);
  check(await page.locator('[data-history-remove]').count()===3,language+': every recent row has X');
  check(await page.locator('button button').count()===0,language+': controls are independent sibling buttons');
  const geometry=await page.locator('.popover-history-row').evaluateAll(rows=>rows.map(row=>{const q=row.querySelector('[data-query]').getBoundingClientRect(),x=row.querySelector('[data-history-remove]').getBoundingClientRect(),r=row.getBoundingClientRect();return {overlap:q.right>x.left,outside:x.right>r.right+1||x.left<r.left,width:x.width};}));
  check(geometry.every(g=>!g.overlap&&!g.outside&&g.width>=30),language+': X stays at right edge without text overlap '+(small?'small':'1440p'));
  if(language==='en')await page.screenshot({path:path.join(output,small?'recent-search-small.png':'recent-search-1440p.png')});
  await page.locator('[data-history-remove="neutral_two"]').click();
  check(await page.evaluate(()=>!getSearchHistory().includes('neutral_two')&&searches.length===0&&saved.length===1),language+': mouse X deletes only selected query without search');
  check(await page.locator('[data-history-remove]').last().evaluate(node=>node===document.activeElement),language+': focus moves to next X');
  await page.keyboard.press('Enter');await page.keyboard.press('Space');
  check(await page.evaluate(()=>getSearchHistory().length===0&&searches.length===0&&document.activeElement===searchInput),language+': Enter/Space remove remaining rows and return focus to input');
  check(await page.locator('[data-query="neutral_favorite"]').count()===1,language+': favorite tag preserved');
  await page.reload();
  check(await page.locator('[data-history-remove]').count()===0,language+': deletion persists after reopening');
  await context.close();
 }
 check(!errors.length,'no browser errors');console.log(JSON.stringify({checks,errors,output}));
}finally{await browser?.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
