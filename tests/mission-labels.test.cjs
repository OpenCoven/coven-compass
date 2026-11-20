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

test('mission names wrap at word boundaries in the caption and retain short names on one line', () => {
  assert.deepEqual(lines('Config refactor', 9), ['Config', 'refactor']);
  assert.deepEqual(lines('Review readiness', 9), ['Review', 'readiness']);
  assert.deepEqual(lines('  Source   survey  ', 13), ['Source survey']);
  assert.deepEqual(lines('Release', 7), ['Release']);
});

test('wrapping measures each candidate at its offset in the normalized SVG run', () => {
  const original = '  👩🏽‍💻\tgo   go\nnext  phase';
  const normalized = original.trim().replace(/\s+/gu, ' ');
  const offsets = [];
  const result = Array.from(ctx.missionNameLines(original, (candidate, start) => {
    assert.equal(normalized.slice(start, start + candidate.length), candidate);
    offsets.push(start);
    return candidate.length <= 7;
  }));
  assert.deepEqual(result, ['👩🏽‍💻', 'go go', 'next', 'phase']);
  assert.deepEqual(offsets, [0, 8, 8, 14]);
});

test('long words and unlimited rows retain every word in the source name', () => {
  for (const name of ['OpenCovenCompass review', 'one two three four five six', 'release-candidate integration', '👩🏽‍💻'.repeat(10) + ' café 日本語', 'x…y']) {
    assert.equal(lines(name, 6).join(' '), name);
  }
  assert.deepEqual(lines('one two six five', 6), ['one', 'two', 'six', 'five']);
  assert.deepEqual(lines('', 6), []);
});

test('seal labels use one-third design size, a screen-pixel floor and a caption for unfit text', () => {
  const ctx = vm.createContext({
    fsz: 1,
    svgEl(_tag, _attrs, parent) {
      const span = {
        setAttribute(key, value) { this[key] = value; },
        getComputedTextLength() { return this.textContent.length * parseFloat(parent.style.fontSize) / 2; },
        getNumberOfChars() { return Array.from(this.textContent).length; },
        getSubStringLength(start, length) {
          assert.equal(this.getNumberOfChars(), this.textContent.length, 'unaddressable runs require direct measurement');
          assert.ok(start >= 0 && start + length <= this.textContent.length);
          return this.textContent.slice(start, start + length).length * parseFloat(parent.style.fontSize) / 2;
        },
      };
      parent.lines.push(span);
      return span;
    },
  });
  new vm.Script(extract('missionNameLines') + '\n' + extract('labelMission')).runInContext(ctx);
  const s = {name: {style: {}, set textContent(_) { this.lines = []; }}};
  ctx.labelMission(s, 'Source survey', 3, 2);
  assert.ok(Math.abs(s.labelUnits - 13 / 3) < .1);
  assert.equal(s.name.lines[0].textContent, 'Source survey');
  assert.ok(s.name.lines[0].y - s.labelUnits > 43, 'caption clears the lower rim');
  ctx.labelMission(s, 'Source survey', 3, 2, -1);
  assert.ok(s.name.lines[0].y + s.labelUnits / 2 < -43, 'changing sides clears the upper rim');
  ctx.labelMission(s, 'x'.repeat(90), .85, 2);
  assert.ok(s.labelUnits * .85 >= 10.5);
  assert.equal(s.needsCaption, true);
  assert.equal(s.name.lines[0].textContent, '2');
  ctx.labelMission(s, '👩🏽‍💻 ' + 'x'.repeat(90), .85, 2);
  assert.equal(s.needsCaption, true);
  assert.equal(s.name.lines[0].textContent, '2');
  ctx.labelMission(s, 'Review', .85, 2);
  assert.equal(s.needsCaption, false);
  assert.equal(s.name.lines[0].textContent, 'Review');
});

test('external caption belongs to the interactive mission while its accessible name retains the full mission name and state', () => {
  assert.match(source, /s\.name = svgEl\('text', \{class: 'lead-name', 'aria-hidden': 'true'\}, s\.face\)/);
  assert.match(source, /ms\.node\.setAttribute\('aria-label', M2\.name \+ ', ' \+ stateName/);
  assert.match(source, /labelMission\(s, mission\.name,/);
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
