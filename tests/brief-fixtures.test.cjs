'use strict';
// The synthetic Brief policy cases (#35) and how they reach the page: through the existing projection
// seam as ?source=fixture&scenario=brief-…, labeled synthetic and never authoritative.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../dist/projection-source.js');
const B = require('../dist/brief-policy.js');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../dist/fixtures/brief-policy-cases.json'), 'utf8'));
const index = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
const read = (scenario, load = () => fixture, model = B) => P.createBriefFixtureSource({scenario, load, model}).read();

// The acceptance list of #35, each mapped to the case that demonstrates it.
const REQUIRED = {
  'hard failure': 'brief-hard-failure',
  'missing evidence': 'brief-missing-evidence',
  'rubric pass': 'brief-rubric-pass',
  'rubric fail': 'brief-rubric-fail',
  'stale candidate/policy': 'brief-stale-evaluation',
  'remediable failure': 'brief-remediable-failure',
  'exhausted cumulative budget': 'brief-budget-exhausted',
  cancellation: 'brief-cancelled',
  'unresolved prior effects': 'brief-unresolved-effects',
};

test('the fixture is marked synthetic and covers every case on the #35 acceptance list', () => {
  assert.equal(fixture.synthetic, true);
  assert.match(fixture.note, /Synthetic/);
  for (const [name, scenario] of Object.entries(REQUIRED)) assert.ok(fixture.cases[scenario], name);
  for (const [id, c] of Object.entries(fixture.cases)) {
    assert.ok(P.isBriefScenario(id), id);
    assert.ok(c.title && c.summary && c.expect, id);
    assert.ok(B.normalizePolicy(fixture.policies[c.policy]).ok, id + ' has a valid policy');
  }
});

test('each case evaluates to its expected next action, and none is ever accepted', async () => {
  for (const [id, c] of Object.entries(fixture.cases)) {
    const p = await read(id);
    assert.equal(p.availability.state, 'synthetic', id);
    assert.equal(p.source.authoritative, false, id);
    assert.equal(p.complete, true, id);
    assert.deepEqual(p.projects, [], id);
    assert.equal(p.brief.result.next.action, c.expect.action, id);
    assert.equal(p.brief.result.next.reason, c.expect.reason, id);
    assert.equal(p.brief.result.acceptance.state, 'not-recorded', id);
    assert.equal(p.brief.result.eligible, c.expect.action === 'request-authorized-acceptance', id);
    assert.match(p.availability.message, /not Coven data/, id);
    assert.equal(P.describe(p).label, 'Fixture · synthetic', id);
  }
});

test('the cases keep the four outcomes apart: eligible, revise, wait and stop', async () => {
  const actions = new Set();
  for (const id of Object.keys(fixture.cases)) actions.add((await read(id)).brief.result.next.action);
  assert.deepEqual([...actions].sort(), [...B.ACTIONS].sort());
});

test('the stale case lists both old grades with why they are not counted', async () => {
  const r = (await read('brief-stale-evaluation')).brief.result;
  assert.deepEqual(r.evaluations.map(e => [e.id, e.status, e.reason]),
    [['ver_1', 'stale', 'policy-revision'], ['ver_2', 'stale', 'other-candidate']]);
  assert.equal(r.policyRevision, 'pol-report-r2');
});

test('a case evaluates at the fixture asOf time, not the reader\'s clock', async () => {
  const late = {...fixture, asOf: '2026-12-02T00:00:00Z'};
  const r = (await read('brief-rubric-fail', () => late)).brief.result;
  assert.equal(r.next.reason, 'limits-exhausted', 'past the deadline, the revision is no longer permitted');
  assert.equal((await read('brief-rubric-fail')).brief.result.next.reason, 'remediable-failure');
});

test('failures are explicit and never substitute data', async () => {
  const unavailable = (p, reason) => {
    assert.equal(p.availability.state, 'unavailable');
    assert.equal(p.availability.reason, reason);
    assert.equal(p.brief, undefined);
    assert.deepEqual(p.projects, []);
  };
  unavailable(await read('brief-nope'), 'unknown_scenario');
  unavailable(await read('brief-rubric-pass', () => fixture, null), 'policy_model_missing');
  unavailable(await read('brief-rubric-pass', () => ({...fixture, synthetic: false})), 'brief_invalid');
  unavailable(await read('brief-rubric-pass', () => ({...fixture, asOf: 'soon'})), 'brief_invalid');
  unavailable(await read('brief-rubric-pass', () => { throw new Error('HTTP 404'); }), 'fixture_unreadable');
  const broken = {...fixture, cases: {...fixture.cases, 'brief-rubric-pass': {...fixture.cases['brief-rubric-pass'], policy: 'missing'}}};
  unavailable(await read('brief-rubric-pass', () => broken), 'brief_invalid');
});

test('Brief scenarios are selected through the existing seam and load the model first', () => {
  assert.deepEqual(P.selectMode('?source=fixture&scenario=brief-cancelled'),
    {mode: 'fixture', requested: 'fixture', scenario: 'brief-cancelled', explicit: true});
  assert.equal(P.isBriefScenario('fresh'), false);
  assert.equal(P.BRIEF_FIXTURE_URL, 'fixtures/brief-policy-cases.json');
  const model = index.indexOf('<script src="brief-policy.js"></script>'), seam = index.indexOf('<script src="projection-source.js"></script>');
  assert.ok(model > 0 && model < seam, 'brief-policy.js loads before the projection guard runs');
});
