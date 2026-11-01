'use strict';
// This test intentionally runs the *current* desktop code against the Android
// reference cases. Updating only one platform must not silently change behavior.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const android=process.env.DART_ANDROID_SOURCE||path.join(root,'android');
const fixturePath=path.join(android,'app/src/test/resources/desktop-recommendations-parity.json');
const fixtures=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
const logicPath=path.join(root,'wwwroot/catalog-logic.js');
const logic=require(logicPath);

test('Android reference scenarios match the canonical desktop source revision',()=>{
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(logicPath,'utf8').replace(/\r\n/g,'\n')).digest('hex'),fixtures.desktopSha256,
    'Catalog logic changed: regenerate the offline Android fixtures and run native conformance before accepting new behavior.');
  assert.equal(fixtures.cases.length,6);assert.equal(fixtures.groupingCases.length,6);
  assert.equal(fixtures.curationCases.length,4);assert.equal(fixtures.perceptualHashes.length,8);
});
for(const fixture of fixtures.cases){
  test(`Android recommendation queries and ranking: ${fixture.name}`,()=>{
    const groups=logic.recommendationQueryGroups(fixture.liked,fixture.preferences,fixture.context.background||[]);
    const actual=Object.fromEntries(Object.entries(groups).map(([kind,entries])=>[kind,entries.map(entry=>entry.query||entry.tag.replaceAll(' ','_'))]));
    assert.deepEqual(actual,fixture.queries);
    assert.deepEqual(logic.rankRecommendations(fixture.liked,fixture.candidates,fixture.rating,1000,
      fixture.preferences,fixture.seed,fixture.context).map(item=>item.key),fixture.expected);
  });
}
for(const fixture of fixtures.groupingCases){
  test(`Android grouping: ${fixture.name}`,()=>{
    const actual=logic.groupWorks(fixture.items).map(item=>({keys:[...item.memberKeys].sort(),images:item.images}));
    assert.deepEqual(actual,fixture.expected);
  });
}
fixtures.curationCases.forEach((fixture,index)=>{
  test(`Android curation factors and order: ${index+1}`,()=>{
    const context={liked:fixture.liked,now:fixture.now,tagPreferences:fixture.tagPreferences};
    const boosts=logic.curationBoosts(fixture.items,fixture.preferences,context);
    for(const [key,expected] of Object.entries(fixture.boosts))assert.ok(Math.abs(boosts.get(key)-expected)<1e-10,key);
    assert.deepEqual(logic.rankCuratedWorks(fixture.items,fixture.preferences,context).map(item=>item.key),fixture.expected);
  });
});
for(const fixture of fixtures.perceptualHashes){
  test(`Android perceptual fingerprint: neutral pattern ${fixture.seed}`,()=>{
    const pixels=new Uint8Array(32*32*4),seed=fixture.seed;
    for(let y=0;y<32;y++)for(let x=0;x<32;x++){
      const at=(y*32+x)*4;pixels[at]=(x*7+seed*11)%256;pixels[at+1]=(y*9+seed*17)%256;
      pixels[at+2]=((x+y)*5+seed*19)%256;pixels[at+3]=255;
    }
    assert.equal(logic.perceptualImageHash(pixels),fixture.expected);
  });
}
