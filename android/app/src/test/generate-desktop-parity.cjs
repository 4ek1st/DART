'use strict';
// Pass the canonical desktop checkout. Never reads a personal profile or network.
const fs=require('node:fs'),path=require('node:path');
const desktop=process.argv[2];if(!desktop)throw Error('Pass canonical desktop source directory');
const logicPath=path.join(desktop,'wwwroot/catalog-logic.js'),logic=require(logicPath);
function work(id,artist,tags,extra={}){return {key:`danbooru:${id}`,source:'danbooru',id:String(id),
  creatorTag:artist,creatorName:artist,title:`Work ${id}`,rating:'g',tags,images:[],...extra};}
const cases=[];
const add=(name,liked,candidates,preferences={},context={},seed=0)=>{
  const queryGroups=logic.recommendationQueryGroups(liked,preferences,context.background||[]);
  cases.push({name,liked,candidates,preferences,context,seed,rating:'all',
    queries:Object.fromEntries(Object.entries(queryGroups).map(([kind,entries])=>[kind,entries.map(entry=>entry.query||entry.tag.replaceAll(' ','_'))])),
    expected:logic.rankRecommendations(liked,candidates,'all',1000,preferences,seed,context).map(item=>item.key)});
};
add('manual priority without likes',[],[work(1,'alice',['forest']),work(2,'bob',['city'])],{forest:'priority'});
const liked=Array.from({length:20},(_,i)=>work(i+1,`artist_${i}`,['landscape',i%3===0?'forest':'mountain',i===0?'incidental':'sunlight'],
  {characterTags:i<8?['alice_(sample)']:[],copyrightTags:i<9?['sample_series']:[]}));
const candidates=[work(100,'fresh_a',['incidental']),work(101,'fresh_b',['landscape','mountain']),
  work(102,'fresh_b',['landscape','forest','sunlight']),work(103,'fresh_c',['landscape','forest','sunlight']),
  work(104,'fresh_d',['landscape','alice_(sample)'],{characterTags:['alice_(sample)']}),
  work(105,'fresh_e',['landscape','sample_series'],{copyrightTags:['sample_series']}),
  work(106,'fresh_f',['landscape','city']),work(107,'fresh_a',['landscape','mountain','blue_eyes','long_hair'])];
add('evidence, character and artist diversity',liked,candidates);
add('seed and recent catalog aliases',liked,candidates,{}, {recentKeys:['danbooru:102','danbooru:103'],existingWorks:[candidates[1]]},17);
add('priority and disabled normalized punctuation',liked,candidates.concat(work(110,'new',['landscape','alternate:costume'])),
  {'alternate costume':'priority',forest:'disabled'});
const background=Array.from({length:36},(_,i)=>work(1000+i,`ordinary_${i}`,['landscape','mountain',i%2?'forest':'city']));
add('local prevalence calibration',liked,candidates,{}, {background},29);
const pairs=Array.from({length:16},(_,i)=>work(200+i,`pair_artist_${i}`,
  i<6?['sunset','mountain']:i<12?['forest','waterfall']:['city','rain']));
add('independent tag combinations',pairs,[work(300,'a',['sunset','mountain']),work(301,'b',['sunset']),work(302,'c',['forest','waterfall']),work(303,'d',['rain','city'])]);
const groupingCases=[];function grouping(name,items){groupingCases.push({name,items,expected:logic.groupWorks(items).map(p=>({keys:[...p.memberKeys].sort(),images:p.images}))});}
const scenery=['landscape','mountain','forest','waterfall','grass','cloud','sky','sunlight','lake','rocks','river','tree'];
const ga=work(500,'alice',scenery,{uploaderId:'uploader',published:'2026-11-01T00:00:00Z'});
grouping('parent cannot bridge different publications',[{...ga,key:'danbooru:501',id:'501',originalUrl:'https://www.pixiv.net/artworks/123456',groupKey:'danbooru:parent:501'},
  {...ga,key:'danbooru:502',id:'502',groupKey:'danbooru:parent:501'}, {...ga,key:'danbooru:503',id:'503',originalUrl:'https://www.pixiv.net/artworks/123457',groupKey:'danbooru:parent:501'}]);
grouping('parent response omits has children',[ga,{...ga,key:'danbooru:504',id:'504',groupKey:'danbooru:parent:500'}]);
grouping('typed characters constrain batch',[{...ga,characterTags:['alice_character']},{...ga,key:'danbooru:505',id:'505',characterTags:['bob_character']}]);
grouping('same artist dual visual copies across sources',[{...ga,visualHash:'0123456789abcdef',visualPHash:'fedcba9876543210',visualAspectRatio:1.2},
  {...ga,key:'sankaku:sampleOpaque',source:'sankaku',id:'sampleOpaque',visualHash:'0123456789abcdef',visualPHash:'fedcba9876543210',visualAspectRatio:1.2}]);
grouping('uploader does not establish creator',[{...ga,key:'rule34:501',source:'rule34',id:'501',visualHash:'0000000000000000'},
  {...ga,key:'rule34:502',source:'rule34',id:'502',creatorTag:'bob',visualHash:'0000000000000000'}]);
const mh='0123456789abcdef0123456789abcdef';grouping('signed CDN renewal is one image',[
  {...ga,key:'sankaku:sampleA',source:'sankaku',id:'sampleA',images:[`https://s.sankakucomplex.com/o/01/23/${mh}.jpg?e=1&m=old`]},
  {...ga,key:'sankaku:sampleB',source:'sankaku',id:'sampleB',images:[`https://v.sankakucomplex.com/data/01/23/${mh}.jpg?expires=9&token=new`]}]);
const curationNow=Date.parse('2026-11-01T00:00:00Z');const curated=Array.from({length:12},(_,i)=>work(600+i,`curation_artist_${i}`,i%3?['landscape','mountain']:['forest','pixel_art'],{
  source:i<6?'danbooru':i<10?'gelbooru':'sankaku',key:`${i<6?'danbooru':i<10?'gelbooru':'sankaku'}:${600+i}`,popularityCount:(i%6)*10,
  width:i*130+350,height:i*90+300,published:new Date(curationNow-i*86400000*9).toISOString()}));
const curationCases=[];for(const prefs of [{enabled:true},{enabled:true,popularity:false,personal:false},{enabled:true,freshness:false,resolution:false},{enabled:true,popularity:false,personal:false,freshness:false,resolution:false}]){
  const context={liked,now:curationNow,tagPreferences:{forest:'priority'}};
  curationCases.push({items:curated,liked,preferences:prefs,tagPreferences:context.tagPreferences,now:curationNow,
    boosts:Object.fromEntries(logic.curationBoosts(curated,prefs,context)),expected:logic.rankCuratedWorks(curated,prefs,context).map(p=>p.key)});}
const perceptualHashes=[];for(let seed=0;seed<8;seed++){const pixels=new Uint8Array(32*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const at=(y*32+x)*4;pixels[at]=(x*7+seed*11)%256;pixels[at+1]=(y*9+seed*17)%256;pixels[at+2]=((x+y)*5+seed*19)%256;pixels[at+3]=255;}
  perceptualHashes.push({seed,expected:logic.perceptualImageHash(pixels)});}
const result={desktopSha256:require('node:crypto').createHash('sha256').update(fs.readFileSync(logicPath,'utf8').replace(/\r\n/g,'\n')).digest('hex'),cases,groupingCases,curationCases,perceptualHashes};
fs.mkdirSync(path.join(__dirname,'resources'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'resources/desktop-recommendations-parity.json'),JSON.stringify(result,null,2)+'\n');
console.log(`Generated ${cases.length} neutral recommendation cases from ${result.desktopSha256}`);
