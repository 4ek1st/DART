const test = require('node:test'), assert = require('node:assert/strict');
const logic = require('../wwwroot/catalog-logic.js');
const frames = Array.from({length:5}, (_,i) => ({hash:['0123456789abcdef','fedcba9876543210','3333ccccaaaa5555','c3c35a5af0f00f0f','b4b4969669694b4b'][i],perceptualHash:'96695aa53cc3f00f'}));
const make = (id,duration=26.8667, changes={}) => ({key:`gelbooru:${id}`,source:'gelbooru',id:String(id),
  creatorTag:'neutral_animator',uploaderId:'neutral_uploader',characterTags:[],tags:Array.from({length:24},(_,i)=>`neutral_tag_${i}`),
  originalUrl:`https://x.com/neutral/status/${90000000+id}`,images:[`https://example.test/${id}.mp4`],
  videoSamples:[{url:`https://example.test/${id}.mp4`,duration,aspectRatio:16/9,frames:structuredClone(frames)}],...changes});
test('five-frame evidence groups two video version pairs while retaining the longer separate film',()=>{
 const items=[make(101,55.25),make(102,20.3167),make(103,20.3167),make(104),make(105)];
 const groups=logic.groupWorks(items);assert.equal(groups.length,3);
 assert.deepEqual(groups.map(i=>i.images.length).sort(),[1,2,2]);
 assert.equal(new Set(groups.flatMap(i=>i.memberKeys)).size,5);
 assert.equal(logic.groupWorks(JSON.parse(JSON.stringify(groups))).length,3);
});
test('a shared poster or intro does not group videos with different contents',()=>{
 const a=make(1),b=make(2);for(const f of b.videoSamples[0].frames.slice(1))f.hash='ffffffff00000000';
 assert.equal(logic.groupWorks([a,b]).length,2);
});
test('legacy still-poster fingerprints cannot bypass video sequence validation',()=>{
 const a=make(1,20,{visualHash:'0123456789abcdef',visualPHash:'96695aa53cc3f00f',visualAspectRatio:1}),b=make(2,55,{visualHash:'0123456789abcdef',visualPHash:'96695aa53cc3f00f',visualAspectRatio:1});
 a.originalUrl=b.originalUrl='';a.videoSamples=b.videoSamples=[];
 assert.equal(logic.groupWorks([a,b]).length,2);
});

test('a sparse preferred mirror retains tagged leaf video evidence during incremental merges', () => {
  const a = make(201, 26.8667, { key: 'danbooru:201', source: 'danbooru',
    tags: ['neutral_tag_0', 'neutral_tag_1', 'neutral_tag_2'], contentHash: 'a'.repeat(32), originalUrl: '' });
  const b = make(202, 26.8667, { contentHash: 'a'.repeat(32), originalUrl: '' });
  const c = make(203, 26.8667, { contentHash: 'b'.repeat(32), originalUrl: '' });
  const previous = logic.groupWorks([a, b]);
  assert.equal(previous.length, 1);
  assert.equal(previous[0].tags.length, 3);
  const actual = logic.mergeGroupedWorks(previous, [c]);
  assert.equal(actual.length, 1);
  assert.deepEqual(actual, logic.groupWorks(structuredClone([a, b, c])));
});
test('four identical poster frames cannot outweigh the different body of a clip',()=>{
 const a=make(1),b=make(2);
 for(const item of [a,b])item.videoSamples[0].frames=item.videoSamples[0].frames.map(()=>({...frames[0]}));
 a.videoSamples[0].frames[2]={...frames[1]};b.videoSamples[0].frames[2]={...frames[2]};
 assert.equal(logic.groupWorks([a,b]).length,2);
});
test('video evidence requires duration, five nonblank frames, the same artist and owned media URL',()=>{
 for(const change of [b=>b.videoSamples[0].duration=0,b=>b.videoSamples[0].frames.pop(),
  b=>b.creatorTag='another_animator',b=>b.videoSamples[0].url='https://example.test/old.mp4',
  b=>b.videoSamples[0].frames.forEach(f=>f.hash='0000000000000000'),
  b=>b.videoSamples[0].aspectRatio=1]){const a=make(1),b=make(2);change(b);assert.equal(logic.groupWorks([a,b]).length,2);}
});
