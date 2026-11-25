'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const navigation = require('../dist/mission-navigation.js');

const empty = {missionRemoved: false, familiarRemoved: false, agentRemoved: false};
const coven = {scope: 'coven', project: null, mission: null, view: null, detail: null, familiar: null};
const mission = (project, id = 'm-1', extra = {}) => ({scope: 'mission', project, mission: id, view: 'brief', detail: 'card', familiar: null, ...extra});

test('overview and Project routes resolve without collisions', () => {
  for (const hash of ['', '#', '#/coven']) assert.deepEqual(navigation.parse(hash), coven);
  assert.deepEqual(navigation.parse('#/project/psyche-build'), {
    scope: 'project', project: 'psyche-build', mission: null, view: null, detail: null, familiar: null,
  });
  assert.equal(navigation.format(navigation.parse('#/project/psyche-build')), '#/project/psyche-build');
  assert.equal(navigation.parse('#/project/coven').project, 'coven', 'a Project called coven is not the overview');
  assert.equal(navigation.parse('#/project/Research%20%26%20Design').project, 'Research & Design');
});

test('only #/project/ routes are accepted; Castle-era and bare-name fragments are not', () => {
  for (const hash of ['#psyche-build', '#coven', '#Research%20%26%20Design', '#/castle/psyche-build',
    '#/castle/psyche-build/mission/m-1', '#/castle/ui/mission/m-1?view=tasks&detail=side']) {
    assert.doesNotThrow(() => navigation.parse(hash));
    assert.equal(navigation.parse(hash), null, `retired route format: ${hash}`);
  }
  for (const selected of [mission('ui'), {scope: 'project', project: 'ui'}]) {
    assert.equal(navigation.format(selected).startsWith('#/project/'), true);
  }
});

test('mission routes keep their Project identity when mission IDs repeat', () => {
  const first = mission('psyche-build');
  const second = mission('coven-cave');
  assert.notEqual(navigation.format(first), navigation.format(second));
  assert.deepEqual(navigation.parse(navigation.format(first)), first);
  assert.deepEqual(navigation.parse(navigation.format(second)), second);
  assert.equal(navigation.format(first), '#/project/psyche-build/mission/m-1');
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
  assert.equal(navigation.format(navigation.parse('#/project/psyche-build/mission/m-1?detail=side&familiar=astra&view=brief')),
    '#/project/psyche-build/mission/m-1?view=brief&familiar=astra&detail=side');
});

test('encoded names and identifiers survive without becoming path or query separators', () => {
  const selected = mission('Research / notes #1', 'mission/?&=雪', {
    view: 'tasks', detail: 'side', familiar: 'Astra + Echo / Δ',
  });
  const hash = navigation.format(selected);
  assert.deepEqual(navigation.parse(hash), selected);
  assert.equal(hash.includes('Research%20%2F%20notes%20%231'), true);
  assert.equal(navigation.parse('#/project/ui/mission/m-1?familiar=Astra+Echo').familiar, 'Astra Echo');
});

test('malformed fragments and ambiguous or unsupported queries fail without throwing', () => {
  const invalid = [
    null, undefined, 7, {}, '#%', '#/project/%E0%A4%A', '#/project/',
    '#/project/ui/mission/', '#/project/ui/mission/m-1/extra', '#/workspace/ui', '#/projects/ui', '#/Castle/ui',
    '#/project/ui?view=brief', '#/coven?detail=side', '#/project/ui/mission/m-1#other',
    '#/project/ui/mission/m-1?view=unknown', '#/project/ui/mission/m-1?detail=popup',
    '#/project/ui/mission/m-1?familiar=', '#/project/ui/mission/m-1?view=brief&view=tasks',
    '#/project/ui/mission/m-1?view=brief&%76iew=tasks',
    '#/project/ui/mission/m-1?view=brief&unexpected=value',
    '#/project/ui/mission/m-1?familiar=%E0%A4%A', '#/project/ui/mission/m-1?familiar=%00',
    '#/project/ui/mission/m-1?view', '#/project/ui/mission/m-1?view=brief&',
    '#/project/%0A/mission/m-1', '#/project/ui/mission/%20',
  ];
  for (const hash of invalid) {
    assert.doesNotThrow(() => navigation.parse(hash));
    assert.equal(navigation.parse(hash), null, `invalid route: ${String(hash)}`);
  }
});

test('format safely rejects invalid routes and supplies documented mission defaults', () => {
  for (const selected of [
    null, {}, {scope: 'elsewhere'}, {scope: 'project', project: ''},
    mission('ui', ''), mission('ui', 'm-1', {view: 'unknown'}),
    mission('ui', 'm-1', {detail: 'popup'}), mission('ui', 'm-1', {familiar: ''}),
    mission('ui', 'm-1', {familiar: '\u0000'}), mission('\ud800'),
  ]) {
    assert.doesNotThrow(() => navigation.format(selected));
    assert.equal(navigation.format(selected), '#/coven');
  }
  assert.equal(navigation.format({scope: 'mission', project: 'ui', mission: 'm-1'}), '#/project/ui/mission/m-1');
  assert.deepEqual(navigation.parse('#/project/ui/mission/m-1'), mission('ui'));
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
  const project = fixture();
  const world = project.world, trace = project.trace;
  project.world.missions.clear();
  assert.deepEqual(navigation.normalizeSelection(project), {
    missionRemoved: true, familiarRemoved: true, agentRemoved: true,
  });
  for (const key of ['sel', 'fam', 'detail', 'pick', 'camBack']) assert.equal(project[key], null);
  assert.equal(project.world, world);
  assert.equal(project.trace, trace);
  assert.equal(project.applied, 4);
  assert.equal(project.world.t, 25);
  assert.equal(project.world.agents.size, 1, 'reconciliation must not retire agents');
  project.world.missions.set('m-1', {id: 'm-1', seats: ['cody', 'charm']});
  assert.deepEqual(navigation.normalizeSelection(project), empty);
  assert.equal(project.sel, null, 'a mission reappearing later must not silently reselect itself');
});

test('replaying before a familiar seat clears only that scope and retains the selected mission', () => {
  const project = fixture(), originalPick = project.pick, originalCamera = project.camBack;
  project.world.missions.get('m-1').seats = ['cody'];
  assert.deepEqual(navigation.normalizeSelection(project), {...empty, familiarRemoved: true});
  assert.equal(project.fam, null);
  assert.equal(project.sel, 'm-1');
  assert.equal(project.detail, 'side');
  assert.equal(project.pick, originalPick);
  assert.equal(project.camBack, originalCamera);
});

test('an unavailable picked agent is cleared without losing mission, familiar, or camera state', () => {
  const project = fixture(), originalCamera = project.camBack;
  project.world.agents.clear();
  assert.deepEqual(navigation.normalizeSelection(project), {...empty, agentRemoved: true});
  assert.equal(project.pick, null);
  assert.equal(project.sel, 'm-1');
  assert.equal(project.fam, 'charm');
  assert.equal(project.detail, 'side');
  assert.equal(project.camBack, originalCamera);
});

test('a valid selection is untouched and repeated reconciliation is idempotent', () => {
  const project = fixture(), before = {...project};
  assert.deepEqual(navigation.normalizeSelection(project), empty);
  for (const key of Object.keys(before)) assert.equal(project[key], before[key]);
  assert.deepEqual(navigation.normalizeSelection(project), empty);
});

test('the same implementation exposes the browser API without CommonJS', () => {
  const window = {};
  const code = fs.readFileSync(path.join(__dirname, '../dist/mission-navigation.js'), 'utf8');
  vm.runInNewContext(code, {window});
  assert.equal(typeof window.CovenMissionNavigation.parse, 'function');
  assert.equal(typeof window.CovenMissionNavigation.format, 'function');
  assert.equal(typeof window.CovenMissionNavigation.normalizeSelection, 'function');
  assert.equal(window.CovenMissionNavigation.parse('#/project/ui').project, 'ui');
});

test('recording bookmarks encode the file digest and exact mission and event positions', () => {
  const digest = '9f'.repeat(32);
  const hash = '#/recording/' + digest + '/mission/1/event/5';
  const bookmark = {scope: 'recording', digest, missionPosition: 1, position: 5};
  assert.equal(navigation.format(bookmark), hash);
  assert.deepEqual(navigation.parse(hash), bookmark);
  for (const invalid of [hash + '?x=1', hash.replace('/1/', '/0/'), hash.replace('event/5', 'event/05'),
    hash.slice(0, -1) + '9007199254740992', hash.replace(digest, 'file.jsonl')]) {
    assert.equal(navigation.parse(invalid), null);
  }
});
