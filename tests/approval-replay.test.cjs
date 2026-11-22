'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {collect} = require('../dist/mission-history.js');
const {loadSimulationModel} = require('./simulation-model-deps.cjs');
const trace = fs.readFileSync(path.join(__dirname, 'recordings/approval-replay.jsonl'), 'utf8').trim().split('\n')
  .map(line => { const event = JSON.parse(line); return {...event, t: Date.parse(event.t)}; });
const history = (events, mission) => collect(loadSimulationModel(), events, mission, undefined, {allEvents: true});

test('an exact event position rewinds and advances within a timestamp, then normal playback resumes', () => {
  const model = loadSimulationModel(), project = {trace, world: model.newWorld(), applied: 0};
  const time = trace[4].t;
  for (const [through, gate, agent, unrelated] of [[7, 'allowed', 'work', true], [5, 'open', 'gate', false], [6, 'open', 'gate', true]]) {
    model.advance(project, time, through);
    assert.equal(project.world.t, time);
    assert.equal(project.applied, through);
    assert.equal(project.world.asks.get('proof-1').status, gate);
    assert.equal(project.world.agents.get('proofreader').state, agent);
    assert.equal(project.world.asks.has('index-1'), unrelated);
  }
  model.advance(project, time);
  assert.equal(project.applied, 7);
  assert.equal(project.world.agents.get('proofreader').state, 'work');
});

test('approval links join the effective request and resolution by ID across interleaved missions', () => {
  const rows = history(trace, 'proof');
  assert.deepEqual(rows.map(row => row.position), [1, 3, 4, 5, 7, 8]);
  assert.equal(rows[3].relatedPosition, 7);
  assert.equal(rows[4].relatedPosition, 5);
  assert.equal(rows[3].finalStatus, 'allowed');
  assert.equal(rows[5].finalStatus, 'open');
  assert.equal(rows[5].relatedPosition, undefined);
  assert.deepEqual(history(trace, 'index').map(({position, relatedPosition}) => [position, relatedPosition]), [[2, undefined], [6, undefined]]);
});

test('late and duplicate resolutions cannot replace an earlier effective decision or a mission closure', () => {
  const extra = [{type: 'mission.closed', mission: 'proof'}, {type: 'gate.resolved', ask: 'proof-2'}, {type: 'gate.resolved', ask: 'proof-1'}];
  const rows = history([...trace, ...extra.map(e => ({...e, t: trace.at(-1).t}))], 'proof');
  const request = rows.find(row => row.position === 8);
  assert.equal(request.finalStatus, 'held');
  assert.equal(request.relatedPosition, undefined);
  assert.equal(rows.find(row => row.position === 5).relatedPosition, 7);
});
