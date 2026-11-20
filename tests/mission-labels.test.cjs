'use strict';
// Run the Site's own line fitting algorithm against a deterministic glyph-width model.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8');
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in the actual Site`);
  for (let end = source.indexOf('\n', start); end !== -1; end = source.indexOf('\n', end + 1)) {
    const candidate = source.slice(start, end).trimEnd();
    try { new vm.Script(`(${candidate}\n)`); return candidate; } catch (error) { if (!(error instanceof SyntaxError)) throw error; }
  }
  throw new Error(`Could not extract ${name}`);
}
const ctx = vm.createContext({});
new vm.Script(extract('missionNameLines')).runInContext(ctx);
const lines = (name, width) => Array.from(ctx.missionNameLines(name, text => Array.from(text).length <= width));

test('mission names wrap at word boundaries within the ring and retain short names on one line', () => {
  assert.deepEqual(lines('Config refactor', 9), ['Config', 'refactor']);
  assert.deepEqual(lines('Review readiness', 9), ['Review', 'readiness']);
  assert.deepEqual(lines('  Source   survey  ', 13), ['Source survey']);
  assert.deepEqual(lines('Release', 7), ['Release']);
});

test('unbroken, international and long user-supplied mission names fit two lines', () => {
  assert.deepEqual(lines('OpenCovenCompass', 8), ['OpenCove', 'nCompass']);
  assert.deepEqual(lines('One two three four five', 7), ['One two', 'three…']);
  assert.deepEqual(lines('🪐'.repeat(18), 6), ['🪐'.repeat(6), '🪐'.repeat(5) + '…']);
  assert.deepEqual(lines('', 7), []);
});

test('ring text sits on the interactive face while its accessible name retains the full mission name and state', () => {
  assert.match(source, /s\.name = svgEl\('text', \{class: 'lead-name', 'aria-hidden': 'true'\}, s\.face\)/);
  assert.match(source, /ms\.node\.setAttribute\('aria-label', M2\.name \+ ', ' \+ stateName/);
  assert.match(source, /labelMission\(s, mission\.name\)/);
});
