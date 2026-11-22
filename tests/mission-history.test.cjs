const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const history = require('../dist/mission-history.js');
const {loadSimulationModel} = require('./simulation-model-deps.cjs');
const trace = fs.readFileSync(path.join(__dirname, 'recordings/mission-history.jsonl'), 'utf8').trim().split('\n')
  .map(line => { const e = JSON.parse(line); return {...e, t: Date.parse(e.t)}; });
const collect = (events, id = 'release') => history.collect(loadSimulationModel(), events, id);
const rows = collect(trace);

test('a task move references the recorded agent, old task and new task across a rename', () => {
  assert.deepEqual(rows.find(r => r.position === 6).changes, [{label: 'Assignment · worker-1', before: 'Draft notes (draft)', after: 'Check sources (check)'}]);
  assert.deepEqual(rows.at(-1).changes, [{label: 'Mission name', before: 'Release review', after: 'Publication review'}]);
  assert.deepEqual(collect(trace, 'other'), []);
});

test('ordered event boundaries keep a decision opening and resolution even with matching endpoint counts', () => {
  assert.equal(rows.find(r => r.position === 6).time, rows.find(r => r.position === 7).time);
  const interval = history.between(rows, 6, 8);
  assert.deepEqual(interval.map(r => [r.position, r.type, r.changes[0].before, r.changes[0].after]), [
    [7, 'gate.requested', 'No recorded request', 'Waiting for decision'],
    [8, 'gate.resolved', 'Waiting for decision', 'Allowed']
  ]);
  assert.deepEqual(history.between(rows, 1, 2), []);
  assert.deepEqual(history.between(rows, 7, 7), []);
});

test('incomplete records leave assignments unknown and mission close retains the reducer’s cascade', () => {
  const extra = [
    {type: 'agent.assigned', agent: 'missing', task: 'draft'},
    {type: 'gate.resolved', ask: 'unknown'},
    {type: 'task.lead.added', task: 'draft', familiar: 'astra'},
    {type: 'mission.paused', mission: 'release', reason: 'you'},
    {type: 'mission.closed', mission: 'release'}
  ];
  const extended = collect([...trace.slice(0, 7), ...extra]);
  const unknown = extended.find(r => r.position === 8);
  assert.match(unknown.unknown, /no agent record for missing/);
  assert.deepEqual(unknown.changes, []);
  assert.ok(!extended.some(r => r.position === 9), 'a request with no mission link stays unattributed');
  assert.deepEqual(extended.slice(-3).map(r => r.position), [10, 11, 12]);
  assert.equal(extended.at(-3).changes[0].after, 'cody, astra');
  assert.equal(extended.at(-2).changes[0].after, 'Paused by reviewer');
  const changes = extended.at(-1).changes;
  assert.ok(changes.some(c => c.before === 'Waiting for decision' && c.after === 'Held'));
  assert.ok(changes.some(c => c.before === 'Check sources (check)' && c.after === 'No recorded agent'));
  assert.ok(changes.some(c => c.before === 'Paused by reviewer' && c.after === 'Absent from replay'));
});
