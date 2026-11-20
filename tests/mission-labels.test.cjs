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

test('a token too wide for the ring stays on one line and leaves the next line for the next word', () => {
  assert.deepEqual(lines('OpenCovenCompass', 8), ['OpenCov…']);
  assert.deepEqual(lines('OpenCovenCompass review', 8), ['OpenCov…', 'review']);
  assert.deepEqual(lines('release-candidate integration', 8), ['release…', 'integra…']);
  assert.deepEqual(lines('One two three four five', 7), ['One two', 'three…']);
  assert.deepEqual(lines('one two six five', 6), ['one', 'two…']);
  assert.deepEqual(lines('one public survey', 6), ['one', 'publi…']);
  assert.deepEqual(lines('', 7), []);
});

test('truncation keeps combining marks, emoji modifiers, ZWJ sequences and flags intact', () => {
  const segmenter = new Intl.Segmenter(undefined, {granularity: 'grapheme'});
  for (const grapheme of ['e\u0301', '👩🏽‍💻', '🇨🇦', '家']) {
    const fit = text => Array.from(segmenter.segment(text)).length <= 4;
    const label = ctx.missionNameLines(grapheme.repeat(6) + ' lab', fit);
    assert.deepEqual(Array.from(label), [grapheme.repeat(3) + '…', 'lab']);
  }
  assert.deepEqual(lines('🔬'.repeat(4), 1), ['…']);
});

test('ring text sits on the interactive face while its accessible name retains the full mission name and state', () => {
  assert.match(source, /s\.name = svgEl\('text', \{class: 'lead-name', 'aria-hidden': 'true'\}, s\.face\)/);
  assert.match(source, /ms\.node\.setAttribute\('aria-label', M2\.name \+ ', ' \+ stateName/);
  assert.match(source, /labelMission\(s, mission\.name\)/);
});

test('HTML name elements keep original text and render each whitespace-delimited token in a single box', () => {
  const parts = [];
  const element = {append(value) { parts.push(value); }};
  const context = vm.createContext({html: (tag, cls, value) => ({tag, cls, value})});
  new vm.Script(extract('setMissionName')).runInContext(context);
  const name = 'release/candidate-final  👩🏽‍💻e\u0301 日誌';
  assert.equal(context.setMissionName(element, name), element);
  assert.equal(element.title, name);
  assert.equal(parts.map(p => typeof p === 'string' ? p : p.value).join(''), name);
  const tokens = parts.filter(p => typeof p !== 'string');
  assert.deepEqual(tokens.map(token => token.value), ['release/candidate-final', '👩🏽‍💻e\u0301', '日誌']);
  assert(tokens.every(token => token.tag === 'span' && token.cls === 'mission-word'));
});
