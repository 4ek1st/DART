const test=require('node:test'),assert=require('node:assert/strict');
const logic=require('../wwwroot/catalog-logic.js'),layout=require('../wwwroot/visual-layout.js');
function evidence(seed=1){const p=new Uint8ClampedArray(4096);for(let i=0;i<p.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;p.set([seed&255,seed>>>8&255,seed>>>16&255,255],i);}return layout.fingerprint(p);}
const tags=Array.from({length:40},(_,i)=>'neutral_tag_'+i);
const make=(id,extra={})=>({source:'rule34',id:String(id),key:`rule34:${id}`,creatorTag:'neutral_artist',uploaderId:'neutral_uploader',
 tags,characterTags:['neutral_character'],images:[`https://example.test/${id}.jpg`],
 visualHash:'0123456789abcdef',visualPHash:'0123456789abcdef',visualAspectRatio:1,visualLayout:evidence(),...extra});
test('verified unchanged regions admit clothing variants in a compact source batch without timestamps',()=>{
 const a=make(1000),b=make(1022,{visualHash:'0123456789abd210',visualPHash:'0123456789abd210',tags:[...tags.slice(0,30),...Array.from({length:20},(_,i)=>'wardrobe_'+i)]});
 const groups=logic.groupWorks([a,b]);assert.equal(groups.length,1);assert.equal(groups[0].images.length,2);
 assert.equal(logic.groupWorks(JSON.parse(JSON.stringify(groups))).length,1);
});
test('regional evidence does not bypass confirmed creator/character/batch constraints',()=>{
 for(const changes of [{creatorTag:'other_artist'},{characterTags:['other_character']},{uploaderId:'other_uploader'},{id:'9000',key:'rule34:9000'},{visualLayout:evidence(2)}]){
  const a=make(1000),b=make(1022,{visualHash:'0123456789abd210',visualPHash:'0123456789abd210',...changes});assert.equal(logic.groupWorks([a,b]).length,2);
 }
});
test('strict regional copies survive independent reposts while all original files remain',()=>{
 const a=make(1000,{originalUrl:'https://x.com/artist/status/90000001'}),b=make(9000,{originalUrl:'https://x.com/artist/status/90000002'});
 const groups=logic.groupWorks([a,b]);assert.equal(groups.length,1);assert.equal(groups[0].images.length,2);
});
