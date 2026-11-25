'use strict';
// The Brief success policy proposal (#35): eligibility and the next permitted action, from synthetic
// input only. Each hard rule in docs/handoff/16-brief-success-profile.md has a test here.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../dist/brief-policy.js');

const NOW = Date.UTC(2026, 10, 20, 12, 0, 0);
const RUBRIC = {scale: {min: 1, max: 5}, aggregation: 'weighted-mean/1', minScore: 3.5, criteria: [
  {id: 'clarity', label: 'Clarity', weight: 2, floor: 2, anchors: {1: 'Unreadable', 5: 'Clear to a newcomer'}},
  {id: 'accuracy', label: 'Accuracy', weight: 3, floor: 3, anchors: {1: 'Wrong', 5: 'Every claim sourced'}},
]};
const policy = (extra = {}) => ({revision: 'pol-r1', required: [
  {id: 'tests', label: 'Tests pass', remediable: true},
  {id: 'secrets', label: 'No secrets committed'},
], rubric: RUBRIC, limits: {maxAttempts: 3, resources: {usd: 10, minutes: 90}, deadline: '2026-12-01T00:00:00Z'}, onExhausted: 'escalate', ...extra});
const CAND = {digest: 'sha256:aaaa', attempt: 'att_1'};
const evaluation = (extra = {}) => ({id: 'ev-1', policyRevision: 'pol-r1', candidate: CAND, evaluator: {id: 'reviewer-1', method: 'rubric review'},
  evidence: [{id: 'evi_1', digest: 'sha256:e1'}], conditions: {tests: 'pass', secrets: 'pass'}, scores: {clarity: 4, accuracy: 4}, ...extra});
const attempt = (extra = {}) => ({id: 'att_1', state: 'completed', usd: 2, minutes: 20, effects: 'settled', ...extra});
const record = (extra = {}) => ({candidate: CAND, attempts: [attempt()], evaluations: [evaluation()], authorization: null, cancelled: false, ...extra});
const run = (p = policy(), r = record()) => B.evaluate(p, r, NOW);
const action = r => r.next.action;

test('the baseline synthetic record is eligible and asks for authorized acceptance, never accepted', () => {
  const r = run();
  assert.equal(r.qualification, 'met');
  assert.equal(r.eligible, true);
  assert.equal(action(r), 'request-authorized-acceptance');
  assert.equal(r.acceptance.state, 'not-recorded');
  assert.equal(r.profile, B.PROFILE);
});

test('unknown never counts as met: a missing condition or an unscored rubric waits for evidence', () => {
  const missing = run(policy(), record({evaluations: [evaluation({conditions: {tests: 'pass'}})]}));
  assert.equal(missing.conditions.find(c => c.id === 'secrets').state, 'unknown');
  assert.equal(missing.qualification, 'unknown');
  assert.equal(missing.eligible, false);
  assert.equal(action(missing), 'wait-for-evidence');
  const explicit = run(policy(), record({evaluations: [evaluation({conditions: {tests: 'pass', secrets: 'unknown'}})]}));
  assert.equal(action(explicit), 'wait-for-evidence');
  const unscored = run(policy(), record({evaluations: [evaluation({scores: {clarity: 5}})]}));
  assert.equal(unscored.rubric.state, 'unknown');
  assert.equal(action(unscored), 'wait-for-evidence');
  const none = run(policy(), record({evaluations: []}));
  assert.deepEqual(none.conditions.map(c => c.state), ['unknown', 'unknown']);
  assert.equal(none.next.reason, 'evidence-missing');
});

test('an evaluation that cites no sealed evidence, or no evaluator, is never counted', () => {
  for (const bad of [{evidence: []}, {evidence: [{id: 'evi_1'}]}, {evaluator: null}, {evaluator: {method: 'x'}}]) {
    const r = run(policy(), record({evaluations: [evaluation(bad)]}));
    assert.equal(r.qualification, 'unknown', JSON.stringify(bad));
    assert.equal(r.evaluations[0].status, 'ignored');
  }
});

test('a high weighted score cannot hide a failed required condition', () => {
  const r = run(policy(), record({evaluations: [evaluation({conditions: {tests: 'pass', secrets: 'fail'}, scores: {clarity: 5, accuracy: 5}})]}));
  assert.equal(r.rubric.state, 'pass');
  assert.equal(r.rubric.score, 5);
  assert.equal(r.qualification, 'not-met');
  assert.equal(r.eligible, false);
  assert.equal(action(r), 'stop-escalate');
  assert.equal(r.next.reason, 'hard-failure', 'secrets is not remediable by default');
});

test('a high weighted score cannot hide a criterion below its floor', () => {
  // Weighted mean (2*5 + 3*2) / 5 = 3.2 clears a minimum of 2, but accuracy 2 is under its floor of 3.
  const r = run(policy({rubric: {...RUBRIC, minScore: 2}}), record({evaluations: [evaluation({scores: {clarity: 5, accuracy: 2}})]}));
  assert.ok(r.rubric.score >= 2, 'the weighted mean alone would pass');
  assert.deepEqual(r.rubric.floorsFailed, ['accuracy']);
  assert.equal(r.rubric.state, 'fail');
  assert.equal(r.eligible, false);
});

test('a rubric below its minimum score fails the quality gate', () => {
  const r = run(policy(), record({evaluations: [evaluation({scores: {clarity: 3, accuracy: 3}})]}));
  assert.equal(r.rubric.state, 'fail');
  assert.equal(r.rubric.score, 3);
  assert.equal(action(r), 'request-bounded-revision');
  assert.equal(r.next.reason, 'remediable-failure');
});

test('an absent optional rubric adds no requirement', () => {
  const r = run(policy({rubric: null}), record({evaluations: [evaluation({scores: undefined})]}));
  assert.equal(r.rubric.state, 'absent');
  assert.equal(r.eligible, true);
});

test('candidate B cannot use candidate A\'s grade', () => {
  const b = {digest: 'sha256:bbbb', attempt: 'att_2'};
  const r = run(policy(), record({candidate: b, attempts: [attempt(), attempt({id: 'att_2'})], evaluations: [evaluation()]}));
  assert.equal(r.evaluations[0].status, 'stale');
  assert.equal(r.evaluations[0].reason, 'other-candidate');
  assert.equal(r.qualification, 'unknown');
  assert.equal(action(r), 'wait-for-evidence');
  const sameDigestOtherAttempt = run(policy(), record({candidate: {digest: CAND.digest, attempt: 'att_2'}, attempts: [attempt(), attempt({id: 'att_2'})]}));
  assert.equal(sameDigestOtherAttempt.evaluations[0].reason, 'other-attempt');
  assert.equal(sameDigestOtherAttempt.eligible, false);
});

test('a changed rubric or policy revision invalidates old evaluations but keeps their provenance', () => {
  const revised = B.revise(policy(), {rubric: {...RUBRIC, minScore: 4.5}}, 'pol-r2');
  assert.equal(revised.ok, true);
  assert.equal(revised.policy.revision, 'pol-r2');
  const r = run(revised.policy, record());
  assert.equal(r.evaluations.length, 1, 'the old evaluation is still listed');
  assert.equal(r.evaluations[0].status, 'stale');
  assert.equal(r.evaluations[0].reason, 'policy-revision');
  assert.deepEqual(r.evaluations[0].evidence, [{id: 'evi_1', digest: 'sha256:e1'}], 'its evidence references are kept');
  assert.equal(r.eligible, false);
  // Changed content under the old revision is refused, so an edit can't make old grades look current.
  const reused = B.revise(policy(), {rubric: {...RUBRIC, minScore: 4.5}}, 'pol-r1');
  assert.equal(reused.ok, false);
  // No revision given: a browser-derived sim- revision that differs from the old one.
  const derived = B.revise(policy(), {limits: {maxAttempts: 5}});
  assert.match(derived.policy.revision, /^sim-[0-9a-f]{8}$/);
  // Unchanged content keeps its revision.
  assert.equal(B.revise(policy(), {}).policy.revision, 'pol-r1');
});

test('retries never reset cumulative limits', () => {
  const failing = {evaluations: [evaluation({scores: {clarity: 3, accuracy: 3}})]};
  const one = run(policy(), record(failing));
  assert.equal(one.limits.attempts.used, 1);
  assert.equal(one.limits.resources.find(x => x.k === 'usd').used, 2);
  const three = run(policy(), record({...failing, attempts: [attempt({id: 'att_0', usd: 4}), attempt({id: 'att_0b', usd: 3}), attempt()]}));
  assert.equal(three.limits.attempts.used, 3);
  assert.equal(three.limits.resources.find(x => x.k === 'usd').used, 9, 'every attempt counts, not just the latest');
  assert.equal(action(three), 'stop-escalate');
  assert.equal(three.next.reason, 'limits-exhausted');
  // Cost reaching the cumulative ceiling stops a quality retry too.
  const costly = run(policy(), record({...failing, attempts: [attempt({id: 'att_0', usd: 8}), attempt()]}));
  assert.ok(costly.limits.exhausted.includes('usd'));
  assert.equal(action(costly), 'stop-escalate');
  // A deadline that has passed stops iteration.
  const late = B.evaluate(policy(), record(failing), Date.UTC(2026, 11, 2));
  assert.ok(late.limits.exhausted.includes('deadline'));
  assert.equal(action(late), 'stop-escalate');
  assert.equal(B.evaluate(policy(), record({evaluations: []}), Date.UTC(2026, 11, 2)).next.reason, 'deadline-passed');
});

test('a failed gate with no attempt limit, or unknown usage, cannot request a revision', () => {
  const failing = {evaluations: [evaluation({scores: {clarity: 3, accuracy: 3}})]};
  const unbounded = run(policy({limits: {resources: {usd: 10}}}), record(failing));
  assert.equal(unbounded.next.reason, 'no-attempt-limit');
  assert.equal(action(unbounded), 'stop-escalate');
  const unknownCost = run(policy(), record({...failing, attempts: [attempt({usd: undefined})]}));
  assert.equal(unknownCost.limits.usageUnknown, true);
  assert.equal(unknownCost.next.reason, 'usage-unknown');
});

test('ambiguous prior effects block a retry', () => {
  const failing = {evaluations: [evaluation({scores: {clarity: 3, accuracy: 3}})]};
  const ambiguous = run(policy(), record({...failing, attempts: [attempt({id: 'att_0', effects: 'unresolved'}), attempt()]}));
  assert.deepEqual(ambiguous.limits.unresolved, ['att_0']);
  assert.equal(action(ambiguous), 'stop-escalate');
  assert.equal(ambiguous.next.reason, 'unresolved-prior-effects');
  const neverSettled = run(policy(), record({...failing, attempts: [attempt({id: 'att_0', effects: undefined}), attempt()]}));
  assert.equal(neverSettled.next.reason, 'unresolved-prior-effects');
  // The latest attempt may still be running without blocking a wait for evidence.
  const running = run(policy(), record({attempts: [attempt({state: 'running', effects: 'pending'})], evaluations: []}));
  assert.equal(action(running), 'wait-for-evidence');
  // Even an eligible record stops while a prior effect is unresolved.
  assert.equal(action(run(policy(), record({attempts: [attempt({id: 'att_0', effects: 'unresolved'}), attempt()]}))), 'stop-escalate');
});

test('denied, expired, revoked or uncertain authorization requires resolution and is never retried', () => {
  for (const state of ['denied', 'expired', 'revoked', 'uncertain']) {
    for (const r of [record({authorization: {for: 'attempt', state}, evaluations: [evaluation({scores: {clarity: 3, accuracy: 3}})]}),
      record({authorization: {for: 'acceptance', state}})]) {
      const out = run(policy(), r);
      assert.equal(action(out), 'stop-escalate', state);
      assert.equal(out.next.reason, 'authorization-needs-resolution', state);
      assert.notEqual(action(out), 'request-bounded-revision');
    }
  }
  assert.equal(action(run(policy(), record({authorization: {for: 'acceptance', state: 'pending'}}))), 'request-authorized-acceptance');
});

test('cancellation stops, and a malformed policy fails closed', () => {
  assert.equal(run(policy(), record({cancelled: true})).next.reason, 'cancelled');
  for (const bad of [null, {}, policy({revision: ''}), policy({rubric: {...RUBRIC, aggregation: 'max/9'}}),
    policy({rubric: {...RUBRIC, criteria: [{...RUBRIC.criteria[0], anchors: {1: 'x'}}]}}), policy({limits: {maxAttempts: 0}}),
    policy({limits: {resources: {gpus: 1}}}), policy({required: [{id: 'a', label: 'A'}, {id: 'a', label: 'B'}]})]) {
    const out = B.evaluate(bad, record(), NOW);
    assert.equal(out.next.reason, 'invalid-policy', JSON.stringify(bad));
    assert.equal(out.eligible, false);
  }
});

test('grading is never acceptance: no input yields an accepted state', () => {
  const claims = [record({acceptance: {state: 'accepted'}}), record({accepted: true}), record({authorization: {for: 'acceptance', state: 'granted'}}),
    record({attempts: [attempt({state: 'accepted'})]})];
  for (const r of claims) {
    const out = run(policy(), r);
    assert.equal(out.acceptance.state, 'not-recorded');
    assert.notEqual(out.qualification, 'accepted');
    assert.ok(B.ACTIONS.includes(action(out)));
  }
  const all = JSON.stringify(Object.values(B.REASONS).concat(Object.values(B.ACTION_LABELS)));
  assert.doesNotMatch(all, /\b(is|was) accepted\b/i);
});

test('outcome targets are not supported in this slice, so a configured target stays unknown', () => {
  const r = run(policy({targets: [{id: 'revenue', label: 'Reach 500 USD'}]}), record());
  assert.equal(r.targets.state, 'unknown');
  assert.equal(r.eligible, false);
  assert.equal(r.next.reason, 'outcome-targets-not-supported');
});

test('evaluate is pure: inputs are not mutated and repeated calls agree', () => {
  const p = policy(), r = record();
  const before = JSON.stringify([p, r]);
  const a = B.evaluate(p, r, NOW), b = B.evaluate(p, r, NOW);
  assert.equal(JSON.stringify([p, r]), before);
  assert.deepEqual(a, b);
});

test('the simulation Brief maps to a policy with no rubric, no attempt limit and a derived revision', () => {
  const brief = {deliver: [{kind: 'report', formats: ['md'], langs: []}], atLeast: {tests: 40, reviews: 1}, atMost: {minutes: 60, tokens: 600000, usd: 8, agents: 24}, measure: []};
  const p = B.fromBrief(brief, {deliver: a => a.kind, floor: (k, v) => v + ' ' + k});
  assert.deepEqual(p.required.map(c => c.id), ['deliver:report', 'floor:tests', 'floor:reviews']);
  assert.deepEqual(p.limits.resources, {usd: 8, minutes: 60, tokens: 600000}, 'the subagent ceiling is concurrency, not cumulative');
  assert.equal(p.limits.maxAttempts, null);
  assert.equal(p.rubric, null);
  assert.match(p.revision, /^sim-[0-9a-f]{8}$/);
  // The simulation has no evaluations, so even met counters stay unknown.
  const r = B.evaluate(p, {candidate: null, attempts: [], evaluations: []}, NOW);
  assert.equal(r.qualification, 'unknown');
  assert.equal(r.next.action, 'wait-for-evidence');
  assert.equal(r.execution.state, 'no-attempts');
  // Editing the Brief yields a new revision and still cannot create acceptance.
  const edited = B.fromBrief({...brief, atLeast: {tests: 50, reviews: 1}});
  assert.notEqual(edited.revision, p.revision);
  assert.equal(B.evaluate(edited, {candidate: null, attempts: [], evaluations: []}, NOW).acceptance.state, 'not-recorded');
  assert.equal(B.fromBrief(null), null);
});

test('the completion summary states the gates, the limits and that acceptance is separate', () => {
  const s = B.summarize(policy());
  assert.match(s, /all 2 required conditions pass/);
  assert.match(s, /at least 3\.5 of 5, with no criterion below its floor/);
  assert.match(s, /3 attempts, \$10, 90 minutes, before 2026-12-01T00:00:00Z/);
  assert.match(s, /stop and escalate/);
  assert.match(s, /Unknown evidence never counts as met/);
  assert.match(s, /acceptance is a separate, authorized step/);
  assert.match(B.summarize(policy({limits: {}})), /No attempt limit is set/);
  assert.match(B.summarize({}), /incomplete/);
});

// Success criteria from the New mission / Edit brief editor (ported from #42) on this model.
const BRIEF = {deliver: [{kind: 'report', formats: ['md'], langs: []}], atLeast: {reviews: 1}, atMost: {minutes: 30, usd: 1, agents: 6}, measure: []};
const withSuccess = (extra = {}) => ({...BRIEF, success: {...B.draftSuccess(), ...extra}});

test('a Brief with no gate at all is never met by default: it stops and escalates', () => {
  const p = B.fromBrief({deliver: [], atLeast: {}, atMost: {minutes: 30}, measure: []});
  assert.deepEqual(p.required, []);
  const r = B.evaluate(p, {candidate: null, attempts: [], evaluations: []}, NOW);
  assert.equal(r.eligible, false);
  assert.equal(r.qualification, 'unknown');
  assert.equal(r.next.action, 'stop-escalate');
  assert.equal(r.next.reason, 'no-gates');
  assert.match(B.summarize(p), /No gate is configured/);
});

test('editor criteria validate with readable errors and fail closed on anything out of bounds', () => {
  assert.equal(B.normalizeSuccess(B.draftSuccess()).ok, true);
  const bad = extra => B.normalizeSuccess({...B.draftSuccess(), ...extra});
  const cases = [
    [{conditions: ['review', 'review']}, /twice/], [{conditions: ['deploy']}, /Unknown condition/],
    [{custom: Array.from({length: 13}, (_, i) => 'c' + i)}, /at most 12/], [{custom: ['x'.repeat(161)]}, /1 to 160/], [{custom: ['a', 'a']}, /twice/],
    [{rubric: {minScore: 101, criteria: [{id: 'accuracy', weight: 1, floor: 0}]}}, /minimum weighted score/],
    [{rubric: {minScore: 80, criteria: [{id: 'accuracy', weight: 0, floor: 0}]}}, /weight/],
    [{rubric: {minScore: 80, criteria: [{id: 'accuracy', weight: 1, floor: -1}]}}, /floor/],
    [{rubric: {minScore: 80, criteria: []}}, /at least one criterion/],
    [{maxAttempts: 0}, /Total attempts/], [{maxAttempts: 2.5}, /Total attempts/], [{maxAttempts: NaN}, /Total attempts/],
    [{deadline: '2026-12-01T00:00:00Z'}, /deadline/], [{deadline: '2026-02-30T10:00Z'}, /deadline/], [{deadline: 'soon'}, /deadline/],
    [{examples: 0}, /Verified examples/],
  ];
  for (const [extra, message] of cases) {
    const n = bad(extra);
    assert.equal(n.ok, false, JSON.stringify(extra));
    assert.ok(n.errors.some(e => message.test(e)), JSON.stringify(extra) + ' → ' + n.errors.join(' | '));
  }
  // Malformed criteria give no policy, which fails closed in the inspector and the preview.
  assert.equal(B.fromBrief(withSuccess({maxAttempts: 0})), null);
  assert.equal(B.fromBrief({...BRIEF, success: {invalid: true}}), null);
  assert.equal(B.evaluate(null, {}, NOW).next.reason, 'invalid-policy');
  assert.match(B.summarize(null), /incomplete/);
});

test('editor criteria only add gates to the Brief: deliverables and floors stay required', () => {
  const p = B.fromBrief(withSuccess({custom: ['Changelog updated'], deadline: '2026-12-01T09:30Z', examples: 4}));
  assert.deepEqual(p.required.map(c => c.id).slice(0, 4), ['deliver:report', 'floor:reviews', 'success:review', 'success:checks']);
  assert.equal(p.required[4].label, 'Changelog updated');
  assert.ok(p.required.every(c => c.remediable), 'as in #42, a failed condition may be revised within the attempt limit');
  assert.deepEqual(p.rubric.scale, {min: 0, max: 100});
  assert.equal(p.rubric.aggregation, 'weighted-mean/1');
  assert.equal(p.rubric.minScore, 80);
  assert.deepEqual(p.rubric.criteria.map(c => [c.id, c.weight, c.floor]), [['accuracy', 2, 50], ['clarity', 1, 50]]);
  assert.equal(p.rubric.criteria[0].anchors[0], 'Unsupported');
  assert.equal(p.limits.maxAttempts, 3);
  assert.equal(p.limits.deadline, '2026-12-01T09:30Z');
  assert.deepEqual(p.limits.resources, {usd: 1, minutes: 30}, 'cost and time stay the Brief\'s own ceilings');
  assert.equal(p.targets.length, 1);
  // The simulation records nothing, so the authored policy waits for evidence and never becomes eligible.
  const r = B.evaluate(p, {candidate: null, attempts: [], evaluations: [], authorization: null, cancelled: false}, null);
  assert.equal(r.eligible, false);
  assert.equal(r.next.action, 'wait-for-evidence');
  assert.equal(r.acceptance.state, 'not-recorded');
  const s = B.summarize(p);
  assert.match(s, /all 5 required conditions pass/);
  assert.match(s, /scores at least 80 of 100, with no criterion below its floor/);
  assert.match(s, /3 attempts/);
  assert.match(s, /\$1, 30 minutes, before 2026-12-01T09:30Z/);
  assert.match(s, /not supported yet, so they stay unknown/);
});

test('an outcome target from the editor stays inert: it never gates or grants eligibility (#37)', () => {
  const p = B.fromBrief(withSuccess({examples: 4}));
  const cand = {digest: 'sha256:c', attempt: 'att_1'};
  const conditions = Object.fromEntries(p.required.map(c => [c.id, 'pass']));
  const ev = {id: 'ev-1', policyRevision: p.revision, candidate: cand, evaluator: {id: 'reviewer'}, evidence: [{id: 'e1', digest: 'sha256:e'}], conditions, scores: {accuracy: 100, clarity: 100}};
  const r = B.evaluate(p, {candidate: cand, attempts: [{id: 'att_1', state: 'completed', usd: .2, minutes: 2, effects: 'settled'}], evaluations: [ev]}, NOW);
  assert.equal(r.targets.state, 'unknown');
  assert.equal(r.eligible, false);
  assert.equal(r.next.reason, 'outcome-targets-not-supported');
  // Without the target the same evidence makes it eligible, which is still only a request for acceptance.
  const q = B.fromBrief(withSuccess());
  const ok = B.evaluate(q, {candidate: cand, attempts: [{id: 'att_1', state: 'completed', usd: .2, minutes: 2, effects: 'settled'}], evaluations: [{...ev, policyRevision: q.revision}]}, NOW);
  assert.equal(ok.next.action, 'request-authorized-acceptance');
  assert.equal(ok.acceptance.state, 'not-recorded');
});

test('changing a criterion is a new revision, so an evaluation of the old criteria no longer counts', () => {
  const before = B.fromBrief(withSuccess()), after = B.fromBrief(withSuccess({rubric: {minScore: 90, criteria: [{id: 'accuracy', weight: 2, floor: 50}]}}));
  assert.notEqual(after.revision, before.revision);
  assert.equal(B.fromBrief(withSuccess()).revision, before.revision, 'the same criteria derive the same revision');
  const cand = {digest: 'sha256:c', attempt: 'att_1'};
  const ev = {id: 'ev-old', policyRevision: before.revision, candidate: cand, evaluator: {id: 'reviewer'}, evidence: [{id: 'e1', digest: 'sha256:e'}],
    conditions: Object.fromEntries(before.required.map(c => [c.id, 'pass'])), scores: {accuracy: 100, clarity: 100}};
  const r = B.evaluate(after, {candidate: cand, attempts: [{id: 'att_1', state: 'completed', usd: .2, minutes: 2, effects: 'settled'}], evaluations: [ev]}, NOW);
  assert.equal(r.evaluations[0].status, 'stale');
  assert.equal(r.evaluations[0].reason, 'policy-revision');
  assert.equal(r.next.action, 'wait-for-evidence');
});

test('a failed editor condition asks for a bounded revision until the attempt limit is used, then escalates', () => {
  const p = B.fromBrief(withSuccess({maxAttempts: 2}));
  const cand = {digest: 'sha256:c', attempt: 'att_1'};
  const conditions = Object.fromEntries(p.required.map(c => [c.id, c.id === 'success:review' ? 'fail' : 'pass']));
  const ev = {id: 'ev-1', policyRevision: p.revision, candidate: cand, evaluator: {id: 'reviewer'}, evidence: [{id: 'e1', digest: 'sha256:e'}], conditions, scores: {accuracy: 100, clarity: 100}};
  const one = [{id: 'att_1', state: 'completed', usd: .2, minutes: 2, effects: 'settled'}];
  assert.equal(B.evaluate(p, {candidate: cand, attempts: one, evaluations: [ev]}, NOW).next.action, 'request-bounded-revision');
  const two = one.concat({id: 'att_2', state: 'completed', usd: .2, minutes: 2, effects: 'settled'});
  const r = B.evaluate(p, {candidate: {...cand, attempt: 'att_2'}, attempts: two, evaluations: [{...ev, candidate: {...cand, attempt: 'att_2'}}]}, NOW);
  assert.equal(r.next.action, 'stop-escalate');
  assert.equal(r.next.reason, 'limits-exhausted');
});
