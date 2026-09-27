const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function tabStripLayout('),
  source.indexOf('\nfunction alignTabStrip(')), context);
const layout = context.tabStripLayout;

test('the last tab fits a small window without leaving a clipped preceding tab on the left', () => {
  const result = layout(1089, 12, 466, 11, true);
  assert.equal(result.first, 4);
  assert.equal(result.scrollLeft, 547);
  assert.equal(result.first * (result.tabWidth + 5) - result.scrollLeft, 0);
  assert.equal((11 - result.first) * (result.tabWidth + 5) + result.tabWidth, 1089);
});

test('resizing and selecting any tab keep both edges aligned for different tab counts', () => {
  for (const width of [479, 663, 839, 1089, 2199]) {
    for (const count of [12, 24, 51]) {
      for (const active of [0, Math.floor(count / 2), count - 1]) {
        const result = layout(width, count, 892, active, true);
        if (!result.overflow) { assert.equal(result.first, 0); continue; }
        const left = (active - result.first) * (result.tabWidth + 5);
        assert.ok(left >= 0 && left + result.tabWidth <= width + 0.01);
        assert.equal(result.first * (result.tabWidth + 5) - result.scrollLeft, 0);
      }
    }
  }
});

test('background additions preserve the visible page and wide strips reset overflow', () => {
  const result = layout(1089, 13, 547, 12, false);
  assert.equal(result.first, 4);
  assert.equal(result.scrollLeft, 547);
  const wide = layout(2199, 12, result.scrollLeft, 11, true);
  assert.equal(wide.overflow, false);
  assert.equal(wide.first, 0);
});
