'use strict';
// Mission names in project scope sit between each seal and Psyche, anchored away from the centre
// line so they clear the crown and the name across from them; when seals sit too close on screen,
// names hide (#plan.tight) and return on hover or selection. These run the page's own functions.
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
const constants = /^const NAME_ROOM_PX = \d+, CROWN_SIDE_PX = \d+;$/m.exec(source);
assert.ok(constants, 'the spacing constants are one line in dist/index.html');
const ctx = vm.createContext({});
new vm.Script(`${constants[0].replace(/^const /, 'var ')}\n${extract('missionLabelAt')}\n${extract('missionNamesTight')}`).runInContext(ctx);
const { missionLabelAt, missionNamesTight, NAME_ROOM_PX, CROWN_SIDE_PX } = ctx;

const pc = [0, 0], ext = [-20, 20], U = 1;

test('a name sits on the side of its seal facing Psyche', () => {
  assert.equal(missionLabelAt([-40, -30], pc, ext, U).y, -30 + 20 + 15, 'a seal above the crown has its name below it');
  assert.equal(missionLabelAt([-40, 30], pc, ext, U).y, 30 - 20 - 8, 'a seal below the crown has its name above it');
});

test('off-axis names are anchored at their seal and run away from the centre line', () => {
  assert.deepEqual(['end', 'start', 'end', 'start'], [[-40, -30], [40, -30], [-40, 30], [40, 30]].map(q => missionLabelAt(q, pc, ext, U).anchor));
  for (const q of [[-40, -30], [40, 30]]) assert.equal(missionLabelAt(q, pc, ext, U).x, q[0], 'the anchor is the seal itself');
  assert.equal(missionLabelAt([5, -60], pc, ext, U).anchor, 'middle', 'a seal on the centre line keeps a centred name');
  // An end-anchored name ends at its seal and a start-anchored one begins there, so a seal at least
  // CROWN_SIDE_PX to the side keeps its whole name off the crown's centre line.
  assert.ok(CROWN_SIDE_PX > 12 * 1.2, 'any seal the crown rule lets through is past the centred-name threshold (12U, U ≤ 1.2 px)');
});

test('names hide when seals crowd each other or the crown on screen', () => {
  const grid = d => [[-d, -d], [d, -d], [-d, d], [d, d]].map(([x, y]) => [x / 2, y / 2]);
  assert.equal(missionNamesTight(grid(80), pc, 1), false, 'a 2x2 grid 80 px apart has room');
  assert.equal(missionNamesTight(grid(80), pc, 0.25), true, 'the same grid at a quarter of the scale (20 px apart) does not');
  assert.equal(missionNamesTight(grid(NAME_ROOM_PX), pc, 1), false, 'exactly the room needed is enough');
  assert.equal(missionNamesTight(grid(NAME_ROOM_PX - 1), pc, 1), true);
  assert.equal(missionNamesTight([[-30, -20]], pc, 1), false, 'one seal well to the side of the crown keeps its name');
  assert.equal(missionNamesTight([[-6, -20]], pc, 1), true, 'one seal almost over the crown hides its name');
  assert.equal(missionNamesTight([[-6, -60]], pc, 1), false, 'unless it is far enough above it');
  assert.equal(missionNamesTight([], pc, 1), false);
});

test('the scene applies both rules, and #plan.tight hides names except on hover or selection', () => {
  assert.match(source, /const lab = missionLabelAt\(q, pc, ext, U\);\n\s+s\.name\.setAttribute\('x', f\(lab\.x\)\); s\.name\.setAttribute\('y', f\(lab\.y\)\); s\.name\.style\.textAnchor = lab\.anchor;/);
  assert.match(source, /const tight = missionNamesTight\(\[\.\.\.sc\.missions\.values\(\)\]\.map\(s => \[s\.sx, s\.sy\]\), pc, kpx\);\n\s+if \(tight !== sc\.tight\) \{ sc\.tight = tight; plan\.classList\.toggle\('tight', tight\); \}/);
  assert.match(source, /,#plan\.tight \.lead-name:not\(\.gname\)\{opacity:0\}/);
  assert.match(source, /#plan\.tight \.lead-node:hover\+\.lead-name,#plan\.tight \.lead-node\.sel\+\.lead-name\{opacity:1\}/);
});
