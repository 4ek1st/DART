'use strict';

const BASE_TAGS = Object.freeze(['blue sky', 'cloud', 'flower', 'forest', 'garden', 'grass', 'landscape',
  'leaf', 'mountain', 'outdoors', 'path', 'river', 'scenery', 'tree', 'water', 'wooden bridge']);

function random32(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

function hashForFamily(family, seed) {
  const next = random32((Math.imul(family + 1, 0x9e3779b1) ^ seed) >>> 0);
  return (BigInt(next()) << 32n) | BigInt(next());
}

const hex64 = value => BigInt.asUintN(64, value).toString(16).padStart(16, '0');
const changedHash = (value, bits) => hex64(value ^ ((1n << BigInt(bits)) - 1n));

function makeSampleFixture(count, { seed = 0x41c6ce57, owners = 17, dense = false } = {}) {
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('sample count must be a nonnegative integer');
  const samples = [];
  let produced = 0;
  for (let work = 0; produced < count; work++) {
    const family = Math.floor(work / 4);
    const owner = dense ? 'creator:dense-neutral' : `creator:neutral-${family % owners}`;
    const base = dense ? 0n : hashForFamily(family, seed);
    const hash = dense ? hex64(base) : changedHash(base, [0, 1, 12, 13][work % 4]);
    const tags = BASE_TAGS.slice();
    const entries = [{ hash, owner, tags, source: 'danbooru' }];
    if (!dense && work % 7 === 0) {
      entries.push({ hash, owner, tags: tags.slice(), source: 'gelbooru' });
      entries.push({ hash, owner, tags: [...tags, 'sunlight'], source: 'sankaku' });
    } else if (!dense && work % 5 === 0) {
      entries.push({ hash: changedHash(base, 2), owner, tags: tags.slice(), source: 'rule34' });
    }
    samples.push(entries.slice(0, count - produced));
    produced += samples[samples.length - 1].length;
  }
  return samples;
}

function makeWorkFixture(count, { seed = 0x41c6ce57 } = {}) {
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('work count must be a nonnegative integer');
  const sources = ['danbooru', 'gelbooru', 'rule34', 'sankaku'];
  return Array.from({ length: count }, (_, index) => {
    const family = Math.floor(index / 2);
    const scenario = family % 10;
    const partner = index % 2;
    const creatorTag = `neutral_artist_${family % 17}`;
    const source = sources[index % sources.length];
    const id = 1000000 + index * 31; // Never trigger the unrelated numeric batch fallback.
    const hash = hashForFamily(family, seed);
    const edgeBits = scenario === 5 ? 13 : scenario === 6 ? 12 : partner;
    const phash = scenario === 4 && partner ? changedHash(hash, 20) : hex64(hash);
    const originalUrl = scenario === 0 || scenario === 4 || scenario === 6
      ? `https://www.pixiv.net/artworks/${70000000 + family}`
      : scenario === 1 ? (partner ? `https://x.com/neutral_artist/status/${80000000 + family}`
        : `https://www.pixiv.net/artworks/${70000000 + family}`)
      : scenario === 2 ? `https://www.pixiv.net/artworks/${70000000 + family * 2 + partner}` : '';
    const characterTags = scenario === 3 && partner ? ['neutral second character'] : ['neutral landscape mascot'];
    const tags = scenario === 7 && partner ? [...BASE_TAGS.slice(0, 7), 'train', 'station', 'railway',
      'platform', 'clock', 'architecture', 'window', 'bench', 'ticket'] : BASE_TAGS.slice();
    const imageUrl = `https://neutral-media.invalid/${source}/${id}.jpg`;
    const published = new Date(Date.UTC(2025, 0, 1) + family * 86400000 + partner * 3600000).toISOString();
    const visualSample = {
      hash: changedHash(hash, edgeBits), owner: `creator:${creatorTag.replaceAll('_', ' ')}`,
      creator: creatorTag, source, tags: tags.slice(), characters: characterTags.slice(),
      uploader: `neutral-uploader-${family % 7}`, published, perceptualHash: phash,
      aspectRatio: scenario === 8 && partner ? 2.1 : 1.5,
    };
    // Saved evidence can have multiple sources/hash duplicates in one work.
    const visualSamples = [visualSample];
    if (index % 11 === 0) visualSamples.push({ ...visualSample,
      source: sources[(index + 1) % sources.length], tags: [...tags, 'sunlight'] });
    return {
      key: `${source}:${id}`, source, id: String(id), title: `Neutral landscape ${index}`,
      creatorTag, creatorName: `Neutral Artist ${family % 17}`, creatorTags: [creatorTag],
      artistId: creatorTag, artist: creatorTag, artistName: `Neutral Artist ${family % 17}`,
      uploaderId: visualSample.uploader, tags, characterTags, copyrightTags: ['neutral fixture'],
      rating: 'g', published, originalUrl, thumbnail: imageUrl, images: [imageUrl],
      imageRecords: [{ url: imageUrl, source, postKey: `${source}:${id}` }],
      visualHash: visualSample.hash, visualPHash: phash, visualAspectRatio: visualSample.aspectRatio,
      visualSamples,
    };
  });
}

module.exports = { BASE_TAGS, makeSampleFixture, makeWorkFixture, hashForFamily, hex64, changedHash };
