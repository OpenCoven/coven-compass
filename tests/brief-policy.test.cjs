const test = require('node:test');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const policy = require('../dist/brief-policy.js');
const {loadSimulationModel} = require('./simulation-model-deps.cjs');

test('a perfect rubric cannot override a failed required review', () => {
  const rule = policy.example('policy-1');
  const first = policy.step(rule, [], 'A', 1000);
  const verdict = policy.evaluate(rule, first, [first], 1000);
  assert.equal(verdict.score, 100);
  assert.equal(verdict.action, 'revision');
  assert.match(verdict.reason, /Independent review/);
});

function journey(p = policy.example('policy-1')) {
  const a = policy.step(p, [], 'A', 1000);
  const b = policy.step(p, [a], 'B', 2000);
  const observed = policy.step(p, [a, b], 'observe', 3000);
  return {p, a, b, observed};
}
test('B waits for matching evidence, then qualifies against the same rule', () => {
  const {p, a, b, observed} = journey();
  assert.equal(policy.evaluate(p, b, [a, b], 2000).action, 'wait');
  for (const key of ['attempt', 'revision', 'candidate', 'seal']) {
    const wrong = structuredClone(observed);
    wrong.evidence[key] = 'other';
    assert.equal(policy.evaluate(p, wrong, [a, b], 3000).action, 'wait', key);
  }
  assert.equal(policy.evaluate(p, observed, [a, b], 3000).action, 'qualify');
  assert.deepEqual(policy.usage([a, b, observed]), {attempts: 2, cents: 20, minutes: 4});
  for (const sample of Object.values(policy.samples)) {
    const hash = s => createHash('sha256').update(s).digest('hex');
    assert.equal(hash(sample.artifact), sample.candidate);
    assert.equal(hash(JSON.stringify(sample.observation)), sample.seal);
  }
});
test('omitted gates add no threshold, and configured gates decide independently', () => {
  for (const [change, expected, reason] of [
    [p => {p.required = []; p.rubric = null; p.target = 2;}, 'qualify', /passed/],
    [p => {p.required = []; p.rubric = null; p.target = 3;}, 'revision', /below target/],
  ]) {
    const p = policy.example('v'); change(p);
    const r = policy.step(p, [], 'A', 1000);
    const result = policy.evaluate(p, r, [r], 1000);
    assert.equal(result.action, expected);
    assert.match(result.reason, reason);
  }
  for (const [change, reason] of [
    [p => {p.rubric.rows[1].floor = 75;}, /Clarity/],
    [p => {p.rubric.threshold = 90;}, /threshold/],
  ]) {
    const p = policy.example('v'); change(p);
    const {a,b,observed} = journey(p);
    assert.match(policy.evaluate(p, observed, [a,b], 3000).reason, reason);
  }
});
test('a revision invalidates the grade and retains spent attempt, cost, time and deadline limits', () => {
  const {p, a} = journey();
  for (const l of [{attempts: 1}, {cents: 19}, {minutes: 3}, {deadline: '1970-01-01T00:00Z'}]) {
    const changed = structuredClone(p); changed.revision = 'v2'; Object.assign(changed.limits, l);
    assert.equal(policy.evaluate(changed, a, [a], 2000).action, 'wait');
    assert.equal(policy.step(changed, [a], 'A', 2000), null);
  }
});
test('cancellation, prior effects and unresolved authority stop iteration', () => {
  const {p, a} = journey();
  for (const state of [{cancelled:true}, {effects:'uncertain'}, ...['denied','expired','revoked','uncertain'].map(authorization => ({authorization}))]) {
    assert.equal(policy.evaluate(p, a, [a], 1000, state).action, 'stop');
    assert.equal(policy.step(p, [a], 'B', 1000, state), null);
  }
});
test('rewinding, replay and reload preserve the original attempt across a Brief edit', () => {
  const {p, a, b, observed} = journey();
  const model = loadSimulationModel({normBrief: b => structuredClone(b)});
  const trace = [{t:0,type:'mission.opened',mission:'m',name:'Fixture',brief:{policy:p}},
    ...[a,b,observed].map(record => ({t:record.time,type:'brief.fixture',mission:'m',record})),
    {t:4000,type:'mission.briefed',mission:'m',brief:{policy:{...p,revision:'v2'}}}];
  const c = {world:model.newWorld(),applied:0,trace:JSON.parse(JSON.stringify(trace))};
  const at = t => {model.advance(c,t); return c.world.missions.get('m');};
  assert.deepEqual(at(4000).reviews,[a,b,observed]);
  assert.equal(at(4000).brief.policy.revision, 'v2');
  assert.deepEqual(at(2000).reviews, [a,b]);
  assert.deepEqual(at(4000).reviews,[a,b,observed]);
});

test('an author-defined requirement without a matching observation stays unknown', () => {
  const p = policy.example('v'); p.custom = ['Steward signs the report'];
  const {a,b,observed} = journey(p);
  assert.equal(policy.evaluate(p, a, [a], 1000).action, 'revision', 'known failure remains visible');
  const result = policy.evaluate(p, observed, [a,b], 3000);
  assert.equal(result.action, 'wait');
  assert.match(result.reason, /Steward signs the report/);
});

test('the fold rejects mismatched evidence, preserves a hold through edits, and charges each attempt once', () => {
  const {p,a,b,observed} = journey();
  const model = loadSimulationModel({normBrief:b => structuredClone(b)}), w = model.newWorld();
  model.apply(w,{type:'mission.opened',mission:'m',brief:{policy:p},t:0});
  const feed = r => model.apply(w,{type:'brief.fixture',mission:'m',record:r,t:r.time});
  feed(a); feed(a); feed(b);
  const wrong = structuredClone(observed); wrong.evidence.seal = a.evidence.seal;
  feed(wrong);
  const m = w.missions.get('m');
  assert.deepEqual(m.reviews,[a,b]);
  model.apply(w,{type:'brief.hold',mission:'m',reason:'uncertain effects',t:2500});
  feed(observed);
  assert.deepEqual(m.reviews,[a,b]);
  model.apply(w,{type:'mission.briefed',mission:'m',brief:{policy:policy.example('v2')},t:4000});
  assert.equal(policy.next(m.brief.policy,m.reviews,4000,m.reviewHold),null);
});

test('an edited imported rule cannot attach an old pending attempt to the new grade under a reused revision ID', () => {
  const {p,a,b} = journey();
  const changed = structuredClone(p); changed.rubric.threshold = 70;
  assert.equal(policy.step(changed,[a,b],'observe',4000),null);
  assert.equal(policy.step(changed,[a,b],'A',4000),null, 'a changed rule needs a fresh revision');
});
