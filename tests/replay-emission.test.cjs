// Delayed simulator callbacks must append to history without moving a replay
// projection into the future. These fixtures execute the actual Site functions.
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { loadSimulationModel } = require('./simulation-model-deps.cjs');

const source = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8');

function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in the actual Site`);
  for (let end = source.indexOf('\n', start); end !== -1; end = source.indexOf('\n', end + 1)) {
    const candidate = source.slice(start, end).trimEnd();
    try {
      new vm.Script(`(${candidate}\n)`);
      return candidate;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
  throw new Error(`Could not extract ${name}`);
}

function fixture(playing) {
  const newWorld = () => ({ t: -Infinity, missions: new Map(), tasks: new Map(),
    agents: new Map(), asks: new Map(), rounds: new Map(), items: [], stopped: false });
  const project = (key, recorded = false) => ({
    key, recorded, world: newWorld(), applied: 0,
    trace: [
      { t: 100, type: 'mission.opened', mission: 'm1', name: 'Review' },
      { t: 200, type: 'council.seated', mission: 'm1', familiar: 'astra' },
      ...(recorded ? [{ t: 5000, type: 'familiar.report', familiar: 'astra', mission: 'm1', text: 'Recording ends here.' }] : []),
    ],
  });
  const projects = { active: project('active'), other: project('other'), recorded: project('recorded', true) };
  let refreshes = 0;
  const context = vm.createContext({
    projects, active: 'active', cursor: 1000, live: false, playing,
    newWorld, window: {}, fxFor() {}, STRUCT: new Set(),
    SimModel: loadSimulationModel({ normBrief: () => null }),
    Date: { now: () => 10000 },
    tEnd: c => c.recorded ? c.trace.at(-1).t : 10000,
    refresh: () => { refreshes++; },
  });
  context.cur = () => projects[context.active];
  new vm.Script(['seek', 'seekTimeline', 'emit', 'goLive'].map(extract).join('\n'), {
    filename: 'actual-replay-emission-functions.js',
  }).runInContext(context);
  context.seekTimeline(context.cursor, true);
  return { context, projects, refreshes: () => refreshes };
}

for (const playing of [false, true]) {
  test(`a delayed inactive report preserves ${playing ? 'playing' : 'paused'} replay until Go live`, () => {
    const { context: c, projects, refreshes } = fixture(playing);
    const target = projects.other;
    c.emit(target, { type: 'familiar.report', mission: 'm1', familiar: 'astra', text: 'Delayed result.' });

    assert.equal(target.trace.length, 3, 'The delayed event is retained in history');
    assert.equal(target.trace.at(-1).t, 10000);
    assert.equal(c.cursor, 1000, 'Receiving an event is not a seek');
    assert.equal(c.playing, playing, 'Receiving an event does not toggle playback');
    assert.equal(c.live, false);
    assert.equal(target.world.t, 1000, 'An inactive Project stays at the replay cursor');
    assert.equal(target.world.items.length, 0, 'Future reports remain out of the projected history');
    assert.equal(target.applied, 2);
    assert.equal(refreshes(), 0, 'No future projection is refreshed while replaying');

    c.goLive();
    assert.equal(c.cursor, 10000);
    assert.equal(c.live, true);
    assert.equal(c.playing, false);
    assert.equal(projects.active.world.t, 10000);
    assert.equal(target.world.t, 10000);
    assert.equal(target.applied, 3);
    assert.equal(target.world.items[0].text, 'Delayed result.');
    assert.equal(projects.recorded.world.t, 5000, 'A recorded Project stays at its final event');
    assert.equal(projects.recorded.world.items[0].text, 'Recording ends here.');
    assert.equal(refreshes(), 1);

    c.seekTimeline(c.cursor, true);
    assert.equal(target.world.items.length, 1, 'Repeated live folds do not duplicate the delayed report');
    assert.equal(projects.recorded.world.items.length, 1);
  });
}
