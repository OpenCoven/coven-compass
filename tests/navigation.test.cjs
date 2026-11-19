'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const navigation = require('../dist/mission-navigation.js');

const empty = {missionRemoved: false, familiarRemoved: false, agentRemoved: false};
const coven = {scope: 'coven', castle: null, mission: null, view: null, detail: null, familiar: null};
const mission = (castle, id = 'm-1', extra = {}) => ({scope: 'mission', castle, mission: id, view: 'brief', detail: 'card', familiar: null, ...extra});

test('overview, Castle routes, and legacy bookmarks resolve without collisions', () => {
  for (const hash of ['', '#', '#/coven']) assert.deepEqual(navigation.parse(hash), coven);
  assert.deepEqual(navigation.parse('#psyche-build'), {
    scope: 'castle', castle: 'psyche-build', mission: null, view: null, detail: null, familiar: null,
  });
  assert.equal(navigation.format(navigation.parse('#psyche-build')), '#/castle/psyche-build');
  assert.equal(navigation.parse('#coven').castle, 'coven', 'a legacy Castle called coven is not the overview');
  assert.equal(navigation.parse('#Research%20%26%20Design').castle, 'Research & Design');
  assert.equal(navigation.parse('#/castle/Research%20%26%20Design').castle, 'Research & Design');
});

test('mission routes keep their Castle identity when mission IDs repeat', () => {
  const first = mission('psyche-build');
  const second = mission('coven-cave');
  assert.notEqual(navigation.format(first), navigation.format(second));
  assert.deepEqual(navigation.parse(navigation.format(first)), first);
  assert.deepEqual(navigation.parse(navigation.format(second)), second);
  assert.equal(navigation.format(first), '#/castle/psyche-build/mission/m-1');
});

test('all sections and both detail modes round-trip with a canonical query order', () => {
  for (const view of ['brief', 'council', 'tasks', 'agents']) {
    for (const detail of ['card', 'side']) {
      const selected = mission('coven-cave', 'm-2', {view, detail, familiar: 'astra'});
      const hash = navigation.format(selected);
      assert.deepEqual(navigation.parse(hash), selected);
      assert.equal(navigation.format(navigation.parse(hash)), hash);
    }
  }
  assert.equal(navigation.format(navigation.parse('#/castle/psyche-build/mission/m-1?detail=side&familiar=astra&view=brief')),
    '#/castle/psyche-build/mission/m-1?view=brief&familiar=astra&detail=side');
});

test('encoded names and identifiers survive without becoming path or query separators', () => {
  const selected = mission('Research / notes #1', 'mission/?&=雪', {
    view: 'tasks', detail: 'side', familiar: 'Astra + Echo / Δ',
  });
  const hash = navigation.format(selected);
  assert.deepEqual(navigation.parse(hash), selected);
  assert.equal(hash.includes('Research%20%2F%20notes%20%231'), true);
  assert.equal(navigation.parse('#/castle/ui/mission/m-1?familiar=Astra+Echo').familiar, 'Astra Echo');
});

test('malformed fragments and ambiguous or unsupported queries fail without throwing', () => {
  const invalid = [
    null, undefined, 7, {}, '#%', '#/castle/%E0%A4%A', '#/castle/',
    '#/castle/ui/mission/', '#/castle/ui/mission/m-1/extra', '#/project/ui',
    '#/castle/ui?view=brief', '#/coven?detail=side', '#/castle/ui/mission/m-1#other',
    '#/castle/ui/mission/m-1?view=unknown', '#/castle/ui/mission/m-1?detail=popup',
    '#/castle/ui/mission/m-1?familiar=', '#/castle/ui/mission/m-1?view=brief&view=tasks',
    '#/castle/ui/mission/m-1?view=brief&%76iew=tasks',
    '#/castle/ui/mission/m-1?view=brief&unexpected=value',
    '#/castle/ui/mission/m-1?familiar=%E0%A4%A', '#/castle/ui/mission/m-1?familiar=%00',
    '#/castle/ui/mission/m-1?view', '#/castle/ui/mission/m-1?view=brief&',
    '#/castle/%0A/mission/m-1', '#/castle/ui/mission/%20',
  ];
  for (const hash of invalid) {
    assert.doesNotThrow(() => navigation.parse(hash));
    assert.equal(navigation.parse(hash), null, `invalid route: ${String(hash)}`);
  }
});

test('format safely rejects invalid routes and supplies documented mission defaults', () => {
  for (const selected of [
    null, {}, {scope: 'elsewhere'}, {scope: 'castle', castle: ''},
    mission('ui', ''), mission('ui', 'm-1', {view: 'unknown'}),
    mission('ui', 'm-1', {detail: 'popup'}), mission('ui', 'm-1', {familiar: ''}),
    mission('ui', 'm-1', {familiar: '\u0000'}), mission('\ud800'),
  ]) {
    assert.doesNotThrow(() => navigation.format(selected));
    assert.equal(navigation.format(selected), '#/coven');
  }
  assert.equal(navigation.format({scope: 'mission', castle: 'ui', mission: 'm-1'}), '#/castle/ui/mission/m-1');
  assert.deepEqual(navigation.parse('#/castle/ui/mission/m-1'), mission('ui'));
});

function fixture() {
  return {
    key: 'ui',
    world: {
      missions: new Map([['m-1', {id: 'm-1', seats: ['cody', 'charm']}]]),
      agents: new Map([['a-1', {id: 'a-1', mission: 'm-1', fam: 'charm'}]]),
      t: 25,
    },
    sel: 'm-1', fam: 'charm', detail: 'side', pick: {id: 'a-1', via: 'panel'},
    camBack: {zoom: 1, px: 10, py: 20},
    composing: false, trace: [], applied: 4,
  };
}

test('replaying before a selected mission clears its whole selection without altering world or replay data', () => {
  const castle = fixture();
  const world = castle.world, trace = castle.trace;
  castle.world.missions.clear();
  assert.deepEqual(navigation.normalizeSelection(castle), {
    missionRemoved: true, familiarRemoved: true, agentRemoved: true,
  });
  for (const key of ['sel', 'fam', 'detail', 'pick', 'camBack']) assert.equal(castle[key], null);
  assert.equal(castle.world, world);
  assert.equal(castle.trace, trace);
  assert.equal(castle.applied, 4);
  assert.equal(castle.world.t, 25);
  assert.equal(castle.world.agents.size, 1, 'reconciliation must not retire agents');
  castle.world.missions.set('m-1', {id: 'm-1', seats: ['cody', 'charm']});
  assert.deepEqual(navigation.normalizeSelection(castle), empty);
  assert.equal(castle.sel, null, 'a mission reappearing later must not silently reselect itself');
});

test('replaying before a familiar seat clears only that scope and retains the selected mission', () => {
  const castle = fixture(), originalPick = castle.pick, originalCamera = castle.camBack;
  castle.world.missions.get('m-1').seats = ['cody'];
  assert.deepEqual(navigation.normalizeSelection(castle), {...empty, familiarRemoved: true});
  assert.equal(castle.fam, null);
  assert.equal(castle.sel, 'm-1');
  assert.equal(castle.detail, 'side');
  assert.equal(castle.pick, originalPick);
  assert.equal(castle.camBack, originalCamera);
});

test('an unavailable picked agent is cleared without losing mission, familiar, or camera state', () => {
  const castle = fixture(), originalCamera = castle.camBack;
  castle.world.agents.clear();
  assert.deepEqual(navigation.normalizeSelection(castle), {...empty, agentRemoved: true});
  assert.equal(castle.pick, null);
  assert.equal(castle.sel, 'm-1');
  assert.equal(castle.fam, 'charm');
  assert.equal(castle.detail, 'side');
  assert.equal(castle.camBack, originalCamera);
});

test('a valid selection is untouched and repeated reconciliation is idempotent', () => {
  const castle = fixture(), before = {...castle};
  assert.deepEqual(navigation.normalizeSelection(castle), empty);
  for (const key of Object.keys(before)) assert.equal(castle[key], before[key]);
  assert.deepEqual(navigation.normalizeSelection(castle), empty);
});

test('the same implementation exposes the browser API without CommonJS', () => {
  const window = {};
  const code = fs.readFileSync(path.join(__dirname, '../dist/mission-navigation.js'), 'utf8');
  vm.runInNewContext(code, {window});
  assert.equal(typeof window.CovenMissionNavigation.parse, 'function');
  assert.equal(typeof window.CovenMissionNavigation.format, 'function');
  assert.equal(typeof window.CovenMissionNavigation.normalizeSelection, 'function');
  assert.equal(window.CovenMissionNavigation.parse('#/castle/ui').castle, 'ui');
});
