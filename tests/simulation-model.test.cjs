'use strict';
// The simulation model (dist/simulation-model.js): the pure fold over a Project's trace that
// dist/index.html used to define inline. These tests run the module the page loads.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../dist/simulation-model.js');
const { loadSimulationModel, pageConst } = require('./simulation-model-deps.cjs');

const index = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8');
const project = trace => { const m = loadSimulationModel(); return { m, c: { trace, world: m.newWorld(), applied: 0 } }; };

test('create names every missing dependency instead of failing later inside the fold', () => {
  assert.throws(() => M.create({}), /missing normBrief, ART, KIND, GATE_NAME, CAP, fam/);
  assert.throws(() => M.create({ normBrief() {}, ART: {}, KIND: {}, GATE_NAME: {}, CAP: {} }), /missing fam$/);
  assert.deepEqual(Object.keys(loadSimulationModel()).sort(),
    ['ROUTE', 'advance', 'append', 'apply', 'newWorld', 'routeLabel', 'seatId', 'summarize']);
});

test('every event type the page accepts folds with the real constants and no missing names', () => {
  const known = [...pageConst('KNOWN')];
  const m = loadSimulationModel({ normBrief: b => (b ? { ...b } : null) });
  const w = m.newWorld();
  const base = { mission: 'm-1', familiar: 'astra', agent: 'a1', task: 'k1', ask: 'q-1', round: 'r1' };
  const order = ['project.founded', 'mission.opened', 'council.seated', 'task.opened', 'agent.spawned', 'gate.requested'];
  for (const type of [...order, ...known.filter(t => !order.includes(t) && t !== 'mission.closed'), 'mission.closed']) {
    const extra = type === 'psyche.routed' ? { targets: [{ mission: 'm-1', familiar: 'astra', agent: 'a1' }], mode: 'agent' } : {};
    assert.doesNotThrow(() => m.apply(w, { t: 1000, type, ...base, name: 'N', text: 'x', state: 'idle', gate: 'N', ...extra }), type);
  }
  assert.equal(w.missions.size, 0, 'mission.closed retires the mission');
  assert.ok(w.items.some(it => /through astra/.test(it.text)), 'routeLabel ran with the injected fam');
});

test('advance folds forward, rebuilds when moving backwards, and reports what changed', () => {
  const trace = [{ t: 100, type: 'mission.opened', mission: 'm1', name: 'One' }, { t: 200, type: 'council.seated', mission: 'm1', familiar: 'astra' }];
  const { m, c } = project(trace);
  let r = m.advance(c, 150);
  assert.deepEqual([r.changed, r.reset, r.fresh.length, c.applied, c.world.t], [true, false, 1, 1, 150]);
  assert.deepEqual(c.world.missions.get('m1').seats, []);
  r = m.advance(c, 300);
  assert.deepEqual([r.changed, r.reset, r.fresh.length, c.applied], [true, false, 1, 2]);
  assert.deepEqual(c.world.missions.get('m1').seats, ['astra']);
  r = m.advance(c, 300);
  assert.deepEqual([r.changed, r.reset, r.fresh.length], [false, false, 0], 'seeking to the same time is a no-op');
  const before = c.world;
  r = m.advance(c, 150);
  assert.deepEqual([r.changed, r.reset, c.applied], [true, true, 1]);
  assert.notEqual(c.world, before, 'moving backwards starts from a new world');
  assert.deepEqual(c.world.missions.get('m1').seats, []);
});

test('append stamps no earlier than now or the last event, and never moves the world', () => {
  const { m, c } = project([{ t: 5000, type: 'mission.opened', mission: 'm1' }]);
  assert.equal(m.append(c, { type: 'psyche.said', text: 'a' }, 1000).t, 5000);
  assert.equal(m.append(c, { type: 'psyche.said', text: 'b' }, 9000).t, 9000);
  assert.equal(m.append({ trace: [] }, { type: 'psyche.said' }, 42).t, 42);
  assert.equal(c.trace.length, 3);
  assert.equal(c.applied, 0, 'appending is not a seek');
});

test('summarize counts missions, agents, and only the open gates', () => {
  const { m, c } = project([
    { t: 1, type: 'mission.opened', mission: 'm1' }, { t: 2, type: 'council.seated', mission: 'm1', familiar: 'astra' },
    { t: 3, type: 'agent.spawned', mission: 'm1', familiar: 'astra', agent: 'a1' },
    { t: 4, type: 'agent.spawned', mission: 'm1', familiar: 'astra', agent: 'a2' },
    { t: 5, type: 'gate.requested', ask: 'q1', mission: 'm1', familiar: 'astra', agents: ['a1'] },
    { t: 6, type: 'gate.requested', ask: 'q2', mission: 'm1', familiar: 'astra', agents: ['a2'] },
    { t: 7, type: 'gate.resolved', ask: 'q2', decision: 'allowed' },
  ]);
  m.advance(c, 10);
  assert.deepEqual(m.summarize(c.world), { missions: 1, agents: 2, needs: 1 });
  assert.deepEqual(m.summarize(m.newWorld()), { missions: 0, agents: 0, needs: 0 }, 'an empty world is zero, not unknown');
});

test('index.html loads the model before its inline script and no longer defines the fold', () => {
  const model = index.indexOf('<script src="simulation-model.js"></script>');
  const seam = index.indexOf('<script src="projection-source.js"></script>');
  assert.ok(model > 0 && model < seam && seam < index.indexOf('<script>\n(() => {'));
  for (const gone of ['const newWorld = () =>', 'function apply(w, e)', 'function routeLabel(', 'const ROUTE = {']) {
    assert.equal(index.includes(gone), false, `${gone} moved to simulation-model.js`);
  }
  assert.match(index, /const SimModel = window\.CovenSimulationModel\.create\(\{normBrief, ART, KIND, GATE_NAME, CAP, fam\}\);/);
  assert.match(index, /function seek\(c, t, quiet, through\) \{\n {2}const \{changed, reset, fresh\} = SimModel\.advance\(c, t, through\);/);
  assert.match(index, /function emit\(c, e\) \{\n {2}SimModel\.append\(c, e, Date\.now\(\)\);/);
});

test('append and same-time replay preserve event identity and order', () => {
  const {m, c} = project([]);
  const first = {type: 'you.said', text: 'one'};
  const second = {type: 'future.event', t: -1};
  for (const event of [first, second]) {
    assert.strictEqual(m.append(c, event, 7), event);
    assert.strictEqual(c.trace.at(-1), event);
    assert.equal(event.t, 7);
  }
  assert.strictEqual(m.advance(c, 7, 1).fresh[0], first);
  const world = c.world;
  assert.strictEqual(m.advance(c, 7, 2).fresh[0], second);
  assert.strictEqual(c.world, world);
  assert.equal(world.items.length, 1);
  const rewind = m.advance(c, 7, 1);
  assert.equal(rewind.reset, true);
  assert.strictEqual(rewind.fresh[0], first);
  assert.notStrictEqual(c.world, world);
  assert.deepEqual(c.world, world);
  assert.ok(Object.isFrozen(m) && Object.isFrozen(M));
});

test('sparse recordings retain orphan tasks, first openings and routed target identity', () => {
  const {m, c} = project([]);
  const w = c.world;
  const fold = event => m.apply(w, {t: 1, ...event});
  fold({type: 'task.opened', task: 'orphan'});
  assert.equal(w.tasks.get('orphan').mission, undefined);
  assert.deepEqual(w.tasks.get('orphan').leads, []);
  fold({type: 'agent.spawned', mission: 'missing', agent: 'ghost'});
  assert.equal(w.agents.size, 0);
  fold({type: 'mission.opened', mission: 'm'});
  const mission = w.missions.get('m');
  fold({type: 'mission.opened', mission: 'm', name: 'second'});
  assert.strictEqual(w.missions.get('m'), mission);
  assert.equal(mission.name, 'm');
  const target = {mission: 'm', familiar: 'astra'};
  fold({type: 'psyche.routed', round: 'r', targets: [null, {mission: 'missing'}, target]});
  assert.strictEqual(w.rounds.get('r').targets[0], target);
  assert.equal(m.routeLabel(w, w.rounds.get('r')), 'the m council');
  assert.equal(m.seatId('m', 'astra'), 'm/astra');
});
