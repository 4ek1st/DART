'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync(require.resolve('../wwwroot/app.js'),'utf8');
const block=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));
function fixture(history=['neutral_one','neutral_two','neutral_three']){
 const data=new Map([['artcatalog-search-history',JSON.stringify(history)]]),events={},saved=[],searches=[],focus=[];
 const controls=()=>JSON.parse(data.get('artcatalog-search-history')).slice(0,6).map(value=>({dataset:{historyRemove:value},focus(){focus.push(value);}}));
 const popover={innerHTML:'',hidden:false,children:[],addEventListener(name,fn){events[name]=fn;},querySelectorAll:()=>controls()};
 const context=vm.createContext({CatalogLogic:{normalizeSearch:value=>value.trim().toLowerCase()},searchInput:{value:'',focus(){focus.push('input');}},
  localStorage:{getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)},saveSession(){saved.push(JSON.parse(data.get('artcatalog-search-history')));},
  popover,tagSuggestions:[],favoriteTags:['neutral_favorite'],escapeHtml:text=>text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
  currentSearchOptions:()=>({}),openSearch:query=>searches.push(query),toast:message=>saved.push(message)});
 vm.runInContext(block('function getSearchHistory(','\nfunction scheduleRule34Recovery(')+'\n'+
  block('function renderPopover(','\nfunction showPopover(')+'\n'+
  block("popover.addEventListener('click'",'\ndocument.addEventListener(\'contextmenu\''),context);
 return {context,data,saved,searches,focus,click(query){const control={dataset:{historyRemove:query},focus(){focus.push(query);}},flags={prevented:false,stopped:false};
  events.click({target:{closest:selector=>selector==='[data-history-remove]'?control:null},preventDefault(){flags.prevented=true;},stopPropagation(){flags.stopped=true;}});return flags;}};
}
test('removing one recent query persists only its deletion and keeps favorites and search input',()=>{
 const f=fixture();f.context.searchInput.value='neutral';assert.equal(f.context.removeSearchHistory('neutral_two'),true);
 assert.deepEqual(JSON.parse(f.data.get('artcatalog-search-history')),['neutral_one','neutral_three']);
 assert.deepEqual(f.saved,[['neutral_one','neutral_three']]);assert.equal(f.context.searchInput.value,'neutral');
 assert.deepEqual(Array.from(f.context.favoriteTags),['neutral_favorite']);assert.deepEqual(f.searches,[]);
});
test('the row X prevents search navigation and restores keyboard focus to a remaining removal control',()=>{
 const f=fixture(),flags=f.click('neutral_two');assert.equal(flags.prevented,true);assert.equal(flags.stopped,true);
 assert.deepEqual(f.searches,[]);assert.equal(f.focus.at(-1),'neutral_three');
 assert.equal(JSON.parse(f.data.get('artcatalog-search-history')).includes('neutral_two'),false);
});
test('removing the final recent query returns focus to search without clearing favorite tags',()=>{
 const f=fixture(['neutral_last']);f.click('neutral_last');assert.deepEqual(JSON.parse(f.data.get('artcatalog-search-history')),[]);
 assert.equal(f.focus.at(-1),'input');assert.match(f.context.popover.innerHTML,/neutral_favorite/);
});
test('a failed persistence write keeps the existing history and reports the failure',()=>{
 const f=fixture(),previous=f.data.get('artcatalog-search-history');
 f.context.localStorage.setItem=()=>{throw new Error('fixture storage unavailable');};
 assert.equal(f.context.removeSearchHistory('neutral_two'),false);
 assert.equal(f.data.get('artcatalog-search-history'),previous);assert.deepEqual(f.searches,[]);
 assert.deepEqual(f.saved,['Could not remove this search. Try again.']);
});
test('recent-query markup has an independent accessible X and escapes the query in both controls',()=>{
 const f=fixture(['a"<b']);f.context.renderPopover();const html=f.context.popover.innerHTML;
 assert.match(html,/data-history-remove="a&quot;&lt;b/);
 assert.match(html,/aria-label="Remove from recent searches"/);assert.match(html,/title="Remove from recent searches"/);
 assert.match(html,/<\/button>\s*<button[^>]*data-history-remove=/,'removal button is a sibling of the search button');
});
