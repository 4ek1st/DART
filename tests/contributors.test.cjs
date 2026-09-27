const test = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../wwwroot/catalog-logic.js');
const fs = require('node:fs'), vm = require('node:vm');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');

const work = { key: 'danbooru:12069561', id: '12069561', source: 'danbooru',
  creatorTag: 'lilith_(voice_actor)', creatorName: 'lilith (voice actor)',
  artistId: 'lilith_(voice_actor)', artist: 'lilith (voice actor)',
  participants: [{ tag: 'lilith_(voice_actor)', name: 'lilith (voice actor)', role: 'voice_actor' },
    { tag: 'the_atko', name: 'the atko', role: 'artist' }],
  contentHash: 'a'.repeat(32), images: ['first.jpg'] };

test('artist is primary even when the first confirmed tag is a voice actor', () => {
  const attribution = logic.workAttribution(work);
  assert.equal(attribution.creator?.follow.artistId, 'the_atko');
  assert.equal(attribution.primary.name, 'the atko');
  assert.equal(attribution.participants.length, 2);
  assert.equal(attribution.participants[0].participantRole, 'artist');
  assert.equal(logic.creatorProfileRef(work, 'lilith_(voice_actor)').artist, 'lilith_(voice_actor)');
  assert.equal(logic.creatorProfileRef(work, 'lilith_(voice_actor)').participantRole, 'voice_actor');
});

test('legacy voice actors and other explicit contributor roles never become illustrators', () => {
  for (const suffix of ['voice_actor', 'voice_actress', 'sound_editor', 'composer', 'colorist', 'translator']) {
    const legacy = { source: 'danbooru', creatorTag: `person_(${suffix})`, creatorName: `person (${suffix})` };
    assert.equal(logic.workAttribution(legacy).creator, null, suffix);
    assert.equal(logic.workAttribution(legacy).participants.length, 1);
  }
});

test('all three sources keep contributor profiles independent from the uploader', () => {
  for (const source of ['danbooru', 'gelbooru', 'rule34']) {
    const attribution = logic.workAttribution({ ...work, source, uploaderName: 'reposter', uploaderId: '42' });
    assert.equal(attribution.creator.follow.artistId, 'the_atko');
    assert.equal(attribution.participants.find(person => person.participantRole === 'voice_actor').follow.artistId, 'lilith_(voice_actor)');
  }
});

test('a fresh authoritative participant list repairs an old scalar attribution, partial responses keep it', () => {
  const legacy = { ...work, participants: undefined };
  const repaired = logic.mergeWorkMetadata(legacy, work);
  assert.equal(repaired.creatorTag, 'the_atko');
  const partial = { ...work, participants: [], creatorTag: '', creatorName: '', artistId: '' };
  assert.equal(logic.mergeWorkMetadata(repaired, partial).participants.length, 2);
  const corrected = logic.mergeWorkMetadata(repaired, { ...work,
    participants: [{ tag: 'corrected_artist', name: 'corrected artist', role: 'artist' }] });
  assert.equal(corrected.creatorTag, 'corrected_artist');
  assert.equal(corrected.participants.length, 1);
});

test('grouping and detail hydration retain the artist and every contributor across mirrors', () => {
  const mirror = { ...work, key: 'gelbooru:1', source: 'gelbooru', images: ['mirror.jpg'],
    participants: [{ tag: 'the_atko', name: 'the atko', role: 'artist' },
      { tag: 'helper_(sound_editor)', name: 'helper (sound editor)', role: 'sound' }] };
  const grouped = logic.groupWorks([work, mirror])[0];
  assert.equal(grouped.creatorTag, 'the_atko');
  assert.equal(grouped.participants.length, 3);
  const hydrated = logic.mergeDetailPages(grouped, mirror);
  assert.equal(hydrated.participants.length, 3);
  assert.equal(hydrated.creatorTag, 'the_atko');
});

test('the displayed voice profile opens its own tag after a background cache update', () => {
  const calls = [];
  const context = vm.createContext({ CatalogLogic: logic, itemIndex: new Map([[work.key, work]]),
    ratingFilterFor: () => 'all', toast: message => assert.fail(message),
    createTab: (...args) => calls.push(args) });
  for (const [start, end] of [['function itemForControl(', '\nfunction saveSession('],
      ['function openCreator(', '\nfunction openUploader(']])
    vm.runInContext(app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start))), context);
  const selected = context.itemForControl({ dataset: { key: work.key, action: 'creator-profile',
    creatorId: 'lilith_(voice_actor)', creatorName: 'lilith (voice actor)',
    creatorRole: 'voice_actor', creatorSource: 'danbooru' } });
  context.openCreator(selected);
  assert.equal(calls[0][2].profileRef.artist, 'lilith_(voice_actor)');
  assert.equal(calls[0][2].profileRef.participantRole, 'voice_actor');
});
