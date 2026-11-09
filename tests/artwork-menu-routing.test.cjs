const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../wwwroot/app.js'),'utf8');
const block=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
function fixture() {
 const item={key:'danbooru:1',source:'danbooru',id:'1',title:'Forest'};
 const art={dataset:{artworkTagsKey:item.key,workKey:item.key},querySelector:()=>null};
 const author={dataset:{contextAuthorSource:'artist',contextAuthorId:'test_artist',contextAuthorName:'Artist'}};
 const ctx=vm.createContext({CatalogLogic:require('../wwwroot/catalog-logic.js'),itemIndex:new Map([[item.key,item]]),quickPreviewWork:item,
   main:{contains:()=>true},currentTab:()=>({kind:'detail',item}),quickPreview:{contains:()=>false}});
 vm.runInContext(block('const contentTagSelector =','\nfunction openContentContextMenu('),ctx);
 const target=kind=>({closest:selector=>selector.includes('data-context-author-id')&&kind==='author'?author:
   (selector.includes('data-artwork-tags-key')&&kind==='author')||selector.includes('.card')?art:null});
 return{ctx,item,target};
}
test('right-clicking a standard card resolves its artwork',()=>{
 const f=fixture();assert.equal(f.ctx.contentContextTarget(f.target('card'))?.item?.key,f.item.key);
});
test('an author inside an artwork region retains its author menu',()=>{
 const f=fixture();assert.equal(f.ctx.contentContextTarget(f.target('author'))?.kind,'author');
});
test('Favorites supplies the shared renderer for entity and artwork cards',()=>{
 let deps;const cards=[];const ctx=vm.createContext({DartFavorites:{create:value=>(deps=value)},
  request(){},svg(){},currentTab(){},favoriteTags:[],recent:[],favoritesKnownWorks:()=>[],recommendationLikedWorks:()=>[],
  favoriteViewedExamples:async()=>new Map(),
  contentPreferences:{},recommendationTagPreferences:{},saveSession(){},openSearch(){},openDetail(){},toast(){},selectedRating:()=> 'all',emptyNsfwRatingsMessage:()=>'',
  DartFavoriteGroups:require('../wwwroot/favorite-groups.js'),CatalogLogic:require('../wwwroot/catalog-logic.js'),renderCard:(item,newItem,presentation)=>{cards.push({item,presentation});return 'shared-card';},
  renderGrid:()=> 'shared-grid',document:{querySelectorAll:()=>[]}});
 vm.runInContext(block('function favoritesController()','\nasync function loadViewedTokens('),ctx);ctx.favoritesController();
 assert.equal(typeof deps.renderEntityCard,'function');
 const work={key:'danbooru:1',source:'danbooru',id:'1',title:'Artwork'};
 assert.equal(deps.renderEntityCard({cover:work,tag:'fern'}),'shared-card');assert.equal(cards[0].item,work);
 assert.ok(deps.renderArtworks([work]).includes('shared-grid'));
});
test('a queued scroll from focusing a trigger does not close its newly opened menu',()=>{
 let closed=0;const ctx=vm.createContext({main:{scrollTop:120,scrollLeft:0},recommendationTagMenu:{hidden:false,sourceScrollTop:120,sourceScrollLeft:0},closeRecommendationTagMenu:()=>closed++});
 vm.runInContext(block('function handleContentMenuScroll(',"\nmain.addEventListener('scroll', handleContentMenuScroll)"),ctx);
 ctx.handleContentMenuScroll();assert.equal(closed,0);
 ctx.main.scrollTop=180;ctx.handleContentMenuScroll();assert.equal(closed,1);
});
