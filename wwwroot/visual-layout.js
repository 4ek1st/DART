(function(root) {
  'use strict';
  // Confirmation evidence for metadata-compatible still-image candidates.
  // Callers retain creator, publication, media-type and aspect-ratio guards;
  // regional similarity alone does not establish ownership or video identity.
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
  const prefix = 'vl1:', tileSize = 19, tilesPerSide = 4;
  const evidenceLength = prefix.length + tileSize * tilesPerSide * tilesPerSide;
  const parsed = new Map();
  const quantize = value => alphabet[Math.max(0, Math.min(63, Math.round(value / 4)))];
  const decode = code => code >= 48 && code <= 57 ? code - 48 :
    code >= 65 && code <= 90 ? code - 55 : code >= 97 && code <= 122 ? code - 61 :
      code === 45 ? 62 : code === 95 ? 63 : -1;

  function statistics(values, colors, index) {
    const mean = values.reduce((sum, value) => sum + value, 0) / 16;
    let energy = 0, horizontal = 0, vertical = 0, minimum = 63, maximum = 0;
    for (let position = 0; position < 16; position++) {
      const value = values[position], centered = value - mean;
      energy += centered * centered;
      horizontal += centered * (position % 4 - 1.5);
      vertical += centered * (Math.floor(position / 4) - 1.5);
      minimum = Math.min(minimum, value); maximum = Math.max(maximum, value);
    }
    // A flat region or a smooth background gradient cannot establish a match.
    // Remove the fitted brightness plane before measuring useful local structure.
    const residual = Math.sqrt(Math.max(0,
      energy - (horizontal * horizontal + vertical * vertical) / 20) / 16);
    const informative = Math.sqrt(energy / 16) >= 3 && residual >= 1.8 && maximum - minimum >= 10;
    return { values, colors, mean, energy, informative, index };
  }

  function spread(tiles, unchangedCentralOutline = false) {
    let rows = 0, columns = 0, quadrants = 0, central = 0;
    for (const { index } of tiles) {
      const row = Math.floor(index / 4), column = index % 4;
      rows |= 1 << row; columns |= 1 << column;
      quadrants |= 1 << (Number(row >= 2) * 2 + Number(column >= 2));
      if ((row === 1 || row === 2) && (column === 1 || column === 2)) central++;
    }
    const count = bits => { let value = 0; while (bits) { bits &= bits - 1; value++; } return value; };
    return count(rows) >= 3 && count(columns) >= 3 && count(quadrants) >= 3 &&
      (central > 0 || unchangedCentralOutline);
  }

  function parse(evidence) {
    if (typeof evidence !== 'string' || evidence.length !== evidenceLength || !evidence.startsWith(prefix)) return null;
    if (parsed.has(evidence)) return parsed.get(evidence);
    const tiles = [];
    for (let index = 0; index < 16; index++) {
      const values = [], colors = [];
      for (let position = 0; position < tileSize; position++) {
        const value = decode(evidence.charCodeAt(prefix.length + index * tileSize + position));
        if (value < 0) return null;
        (position < 16 ? values : colors).push(value);
      }
      tiles.push(statistics(values, colors, index));
    }
    const information = tiles.filter(tile => tile.informative);
    const result = information.length >= 6 && spread(information) ? { tiles, information } : null;
    parsed.set(evidence, result);
    while (parsed.size > 512) parsed.delete(parsed.keys().next().value);
    return result;
  }

  function fingerprint(pixels) {
    if ((!Array.isArray(pixels) && !ArrayBuffer.isView(pixels)) || pixels.length !== 32 * 32 * 4) return '';
    let evidence = prefix;
    for (let tileY = 0; tileY < 4; tileY++) for (let tileX = 0; tileX < 4; tileX++) {
      const colors = [0, 0, 0];
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        let lightness = 0;
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
          const offset = ((tileY * 8 + y * 2 + dy) * 32 + tileX * 8 + x * 2 + dx) * 4;
          const red = pixels[offset], green = pixels[offset + 1], blue = pixels[offset + 2], opacity = pixels[offset + 3];
          if (!Number.isFinite(red) || !Number.isFinite(green) || !Number.isFinite(blue) || !Number.isFinite(opacity) ||
              Math.min(red, green, blue, opacity) < 0 || Math.max(red, green, blue, opacity) > 255) return '';
          const alpha = opacity / 255, backdrop = 127 * (1 - alpha);
          const r = red * alpha + backdrop, g = green * alpha + backdrop, b = blue * alpha + backdrop;
          colors[0] += r / 64; colors[1] += g / 64; colors[2] += b / 64;
          lightness += r * .299 + g * .587 + b * .114;
        }
        evidence += quantize(lightness / 4);
      }
      evidence += colors.map(quantize).join('');
    }
    return parse(evidence) ? evidence : '';
  }

  function matches(first, second, options = {}) {
    const a = parse(first), b = parse(second);
    if (!a || !b) return false;
    const strict = !!options?.strict, matching = [];
    let joint = 0, changed = 0, isolatedChange = false, unchangedCentralOutline = false;
    for (let index = 0; index < 16; index++) {
      const left = a.tiles[index], right = b.tiles[index];
      if (!left.informative || !right.informative) continue;
      joint++;
      let covariance = 0;
      for (let position = 0; position < 16; position++)
        covariance += (left.values[position] - left.mean) * (right.values[position] - right.mean);
      const correlation = covariance / Math.sqrt(left.energy * right.energy);
      const colorDifference = left.colors.reduce((sum, value, channel) =>
        sum + Math.abs(value - right.colors[channel]), 0) * 4 / 3;
      const central = [5, 6, 9, 10].includes(index);
      // Reused detailed scenery can dominate the global hashes and the count
      // of unchanged tiles. A changed foreground region needs its own outline
      // continuity; background votes cannot replace it. Central clothing may
      // change substantially across several supported body regions.
      if (correlation < (strict ? .90 : central ? -1 : .80)) return false;
      if (correlation < (strict ? .94 : .90) || colorDifference > (strict ? 24 : 40)) {
        changed++;
        if (correlation < .85 || colorDifference > 40) isolatedChange = true;
      }
      // Changed clothing can cover every central color region. An unchanged
      // central outline may support a distributed surround match, but it does
      // not count as another matching tile or replace its color requirements.
      if (!strict && central && correlation >= .85 && colorDifference <= 64)
        unchangedCentralOutline = true;
      if (colorDifference > (strict ? 24 : 40)) continue;
      if (correlation >= (strict ? .94 : .90)) matching.push(left);
    }
    const information = Math.max(a.information.length, b.information.length);
    return !(changed === 1 && isolatedChange) && joint >= Math.ceil(information * .7) &&
      matching.length >= Math.max(strict ? 8 : 6, Math.ceil(joint * (strict ? .8 : .65))) &&
      spread(matching, unchangedCentralOutline);
  }

  const api = { fingerprint, matches };
  root.DartVisualLayout = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
