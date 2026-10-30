'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const logic = require('../wwwroot/catalog-logic.js');
const work = extra => ({ key: 'danbooru:1', source: 'danbooru', creatorTag: 'first_artist',
  thumbnail: 'https://example.test/1.jpg', tags: Array.from({ length: 12 }, (_, i) => `tag_${i}`),
  images: [], ...extra });

test('warm attribution validates each watched property once without rescanning arrays', () => {
  let sourceReads = 0, participantReads = 0;
  const participants = [{ tag: 'first_artist', role: 'artist' }];
  const item = work();
  Object.defineProperties(item, { source: { get() { sourceReads++; return 'danbooru'; } },
    participants: { get() { participantReads++; return participants; } } });
  const initial = logic.workAttribution(item);
  sourceReads = participantReads = 0;
  assert.equal(logic.workAttribution(item), initial);
  assert.equal(sourceReads, 1, 'one scalar signature read for a cached result');
  assert.equal(participantReads, 1, 'one array signature read for a cached result');
});

test('visual fingerprint eligibility does not build unused external-link attribution', () => {
  let originalReads = 0;
  const item = work();
  Object.defineProperty(item, 'originalUrl', { get() { originalReads++; return 'https://example.test/post/1'; } });
  assert.equal(logic.needsVisualFingerprint(item), true);
  assert.equal(originalReads, 1, 'only the cache signature needs the external publication field');
});

test('attribution signatures retain scalar changes, array replacement, length changes and explicit invalidation', () => {
  const item = work({ participants: [{ tag: 'first_artist', role: 'artist' }] });
  assert.equal(logic.workAttribution(item).creator.tag, 'first_artist');
  item.participants = [{ tag: 'second_artist', role: 'animator' }];
  assert.equal(logic.workAttribution(item).creator.tag, 'second_artist');
  item.participants.push({ tag: 'third_artist', role: 'artist' });
  assert.equal(logic.workAttribution(item).creator.tag, 'third_artist');
  item.participants[1].tag = 'changed_artist';
  assert.equal(logic.workAttribution(item).creator.tag, 'third_artist', 'same-length nested edits retain the existing cache contract');
  logic.invalidateGrouping([item]);
  assert.equal(logic.workAttribution(item).creator.tag, 'changed_artist');
  item.participants = [];
  item.creatorTag = 'fallback_artist';
  assert.equal(logic.workAttribution(item).creator.tag, 'fallback_artist');
  item.creatorTag = 'updated_artist';
  assert.equal(logic.workAttribution(item).creator.tag, 'updated_artist');
});

test('lightweight visual creator follows the same supported roles and unknown-creator exclusions', () => {
  for (const [extra, eligible] of [
    [{ participants: [{ tag: 'voice_(voice_actor)' }] }, false],
    [{ participants: [{ tag: 'voice_(voice_actor)' }, { tag: 'animator', role: 'animator' }] }, true],
    [{ creatorTag: 'unknown_artist' }, false],
    [{ creatorTag: 'anonymous' }, false],
    [{ source: 'rule34', creatorTag: '', artistId: '77', uploaderId: '77' }, true],
    [{ source: 'sankaku', creatorTag: '', artistId: '77', uploaderId: '77' }, false],
    [{ source: 'unsupported', creatorTag: 'creator' }, false],
  ]) assert.equal(Boolean(logic.needsVisualFingerprint(work(extra))), eligible);
  const item = work();
  assert.equal(logic.needsVisualFingerprint(item), true);
  item.creatorTag = 'unknown_artist';
  assert.equal(Boolean(logic.needsVisualFingerprint(item)), false);
  item.creatorTag = 'new_artist';
  assert.equal(logic.needsVisualFingerprint(item), true);
});

test('visual sample preparation observes refreshed attribution and tag evidence on the same work', () => {
  const item = work({ visualHash: '0123456789abcdef' });
  const sample = () => logic.groupWorks([item])[0].visualSamples[0];
  assert.equal(sample().creator, 'first artist');
  item.creatorTag = 'second_artist';
  assert.equal(sample().creator, 'second artist');
  item.tags.push('extra_tag');
  assert(sample().tags.includes('extra tag'));
  item.tags[item.tags.length - 1] = 'replacement_tag';
  assert(sample().tags.includes('extra tag'), 'same-length tag edits retain the established cache contract');
  logic.invalidateGrouping([item]);
  assert(sample().tags.includes('replacement tag'));
  assert.equal(sample().tags.includes('extra tag'), false);
  item.participants = [{ tag: 'animator', role: 'animator' }];
  assert.equal(sample().creator, 'animator');
  item.participants.push({ tag: 'confirmed_artist', role: 'artist' });
  assert.equal(sample().creator, 'confirmed artist');
});
