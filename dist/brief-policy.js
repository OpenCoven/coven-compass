/*
 * Brief success policy: a PROPOSAL model for issue #35. It's pure: no DOM, no timers, no clock.
 *
 * It answers one question for display: given a mission's success policy and the evidence-bound
 * evaluations recorded against it, is the mission eligible for acceptance, and what is the next
 * permitted action? It never answers "accepted". Acceptance is an authorized Coven transition
 * that Compass has no way to make or verify (docs/handoff/16-brief-success-profile.md, D13–D15).
 *
 *   policy = {revision, required: [{id, label, remediable?}],
 *             rubric: null | {scale: {min, max}, criteria: [{id, label, weight, floor?, anchors}],
 *                             minScore, aggregation: 'weighted-mean/1'},
 *             limits: {maxAttempts?, resources: {usd?, minutes?, tokens?}, deadline?},
 *             onExhausted: 'stop' | 'escalate', targets?: []}
 *   record = {candidate: {digest, attempt} | null,
 *             attempts: [{id, state, usd?, minutes?, tokens?, effects: 'settled' | 'unresolved'}],
 *             evaluations: [{id, policyRevision, candidate: {digest, attempt}, evaluator: {id, method},
 *                            evidence: [{id, digest}], conditions: {[id]: 'pass' | 'fail' | 'unknown'},
 *                            scores: {[criterionId]: number}}],
 *             authorization: null | {for: 'attempt' | 'acceptance', state}, cancelled: boolean}
 *   evaluate(policy, record, now) → {eligible, qualification, conditions, rubric, targets, limits,
 *             evaluations, execution, next: {action, reason, text}, acceptance: {state: 'not-recorded'}}
 *
 * The field names are this proposal's own. They are not a wire schema and don't widen any
 * Psyche or Coven record. Inputs are only ever synthetic fixtures or the local simulation.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CovenBriefPolicy = api;
}(typeof window !== 'undefined' ? window : null, function () {
'use strict';

const PROFILE = 'coven-compass.brief-policy/proposal-0';
const ACTIONS = Object.freeze(['wait-for-evidence', 'request-bounded-revision', 'request-authorized-acceptance', 'stop-escalate']);
const ACTION_LABELS = Object.freeze({
  'wait-for-evidence': 'Wait for evidence',
  'request-bounded-revision': 'Request a bounded revision',
  'request-authorized-acceptance': 'Request authorized acceptance',
  'stop-escalate': 'Stop and escalate',
});
const REASONS = Object.freeze({
  'invalid-policy': 'The success policy is incomplete or malformed, so nothing can be judged against it.',
  cancelled: 'The mission was cancelled. Nothing more is attempted.',
  'unresolved-prior-effects': 'An earlier attempt has external effects nobody has resolved. No new attempt starts until they are.',
  'authorization-needs-resolution': 'Authorization was denied, expired, revoked or is uncertain. Someone must resolve it; it is never retried automatically.',
  'hard-failure': 'A required condition failed, and the policy doesn\'t allow a revision for it.',
  'limits-exhausted': 'A quality gate failed, but the attempt, cost, time or deadline limits are used up.',
  'no-attempt-limit': 'A quality gate failed, but no attempt limit is set, so a bounded revision can\'t be requested.',
  'usage-unknown': 'A quality gate failed, but the attempts so far don\'t report their full cost or time, so staying within the limits can\'t be shown.',
  'remediable-failure': 'A quality gate failed and the limits allow another attempt.',
  'deadline-passed': 'The deadline passed before the conditions were shown to be met.',
  'evidence-missing': 'Some conditions have no current, evidence-backed evaluation yet. Unknown never counts as met.',
  'no-gates': 'The policy names no required condition, rubric or target, so there is nothing to show it met. It never counts as met.',
  'outcome-targets-not-supported': 'The policy names outcome targets, which this slice can\'t evaluate (#37), so they stay unknown.',
  eligible: 'Every configured gate is met by current evidence. Acceptance is still a separate, authorized step.',
});
const AUTH_STOPS = new Set(['denied', 'expired', 'revoked', 'uncertain']);
const RESOURCES = ['usd', 'minutes', 'tokens'];
const ACCEPTANCE = Object.freeze({state: 'not-recorded',
  text: 'Not recorded. Only an authorized Coven transition can record acceptance, and Compass has none.'});

// Versioned rules for turning criterion scores into one rubric score. Unknown rules fail closed.
const AGGREGATIONS = Object.freeze({
  'weighted-mean/1': (criteria, scores) => {
    let sum = 0, weight = 0;
    criteria.forEach(c => { sum += c.weight * scores[c.id]; weight += c.weight; });
    return sum / weight;
  },
});

const isRecord = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = v => typeof v === 'number' && Number.isFinite(v);
const positive = v => finite(v) && v > 0;
const text = v => typeof v === 'string' && v.trim().length > 0;

// Canonical JSON (sorted keys) and a short FNV-1a digest. The digest only labels a policy derived
// in the browser; it is not a Psyche policy revision and not a security property.
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (isRecord(value)) return '{' + Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value === undefined ? null : value);
}
function shortDigest(value) {
  let h = 0x811c9dc5;
  const s = canonical(value);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ('0000000' + h.toString(16)).slice(-8);
}
const contentOf = p => ({required: p.required, rubric: p.rubric, limits: p.limits, onExhausted: p.onExhausted, targets: p.targets});
const derivedRevision = p => 'sim-' + shortDigest(contentOf(p));

/** Validates and normalizes a policy. Fails closed: anything malformed is an error, never a default. */
function normalizePolicy(input) {
  const errors = [], fail = m => { errors.push(m); };
  if (!isRecord(input)) return {ok: false, errors: ['The policy must be an object.']};
  if (!text(input.revision)) fail('A policy needs a non-empty revision.');
  const required = Array.isArray(input.required) ? input.required : (fail('required must be a list.'), []);
  const ids = new Set();
  required.forEach((r, i) => {
    if (!isRecord(r) || !text(r.id) || !text(r.label)) return fail('Required condition ' + i + ' needs an id and a label.');
    if (ids.has(r.id)) fail('Duplicate required condition ' + r.id + '.');
    ids.add(r.id);
    if (r.remediable !== undefined && typeof r.remediable !== 'boolean') fail('remediable must be true or false on ' + r.id + '.');
  });
  let rubric = null;
  if (input.rubric !== null && input.rubric !== undefined) {
    const rb = input.rubric;
    if (!isRecord(rb)) fail('rubric must be an object or null.');
    else {
      const sc = rb.scale;
      if (!isRecord(sc) || !finite(sc.min) || !finite(sc.max) || !(sc.max > sc.min)) fail('The rubric needs a numeric scale with max above min.');
      if (!Object.prototype.hasOwnProperty.call(AGGREGATIONS, rb.aggregation)) fail('Unknown aggregation rule ' + JSON.stringify(rb.aggregation) + '.');
      const inScale = v => isRecord(sc) && finite(v) && v >= sc.min && v <= sc.max;
      if (!inScale(rb.minScore)) fail('The rubric minimum score must lie on its scale.');
      const criteria = Array.isArray(rb.criteria) && rb.criteria.length ? rb.criteria : (fail('The rubric needs at least one criterion.'), []);
      const cids = new Set();
      criteria.forEach((c, i) => {
        if (!isRecord(c) || !text(c.id) || !text(c.label)) return fail('Criterion ' + i + ' needs an id and a label.');
        if (cids.has(c.id)) fail('Duplicate criterion ' + c.id + '.');
        cids.add(c.id);
        if (!positive(c.weight)) fail('Criterion ' + c.id + ' needs a positive weight.');
        if (c.floor !== undefined && c.floor !== null && !inScale(c.floor)) fail('Criterion ' + c.id + ' has a floor off its scale.');
        // Anchored: each end of the scale says in words what that score means.
        if (!isRecord(c.anchors) || !isRecord(sc) || !text(c.anchors[String(sc.min)]) || !text(c.anchors[String(sc.max)])) {
          fail('Criterion ' + c.id + ' needs anchors for both ends of the scale.');
        }
      });
      rubric = {scale: isRecord(sc) ? {min: sc.min, max: sc.max} : null, aggregation: rb.aggregation, minScore: rb.minScore,
        criteria: criteria.filter(isRecord).map(c => ({id: c.id, label: c.label, weight: c.weight,
          floor: c.floor === undefined ? null : c.floor, anchors: isRecord(c.anchors) ? Object.assign({}, c.anchors) : {}}))};
    }
  }
  const lim = input.limits === undefined ? {} : input.limits;
  const limits = {maxAttempts: null, resources: {}, deadline: null};
  if (!isRecord(lim)) fail('limits must be an object.');
  else {
    if (lim.maxAttempts !== undefined && lim.maxAttempts !== null) {
      if (!Number.isSafeInteger(lim.maxAttempts) || lim.maxAttempts < 1) fail('maxAttempts must be a whole number of at least 1.');
      else limits.maxAttempts = lim.maxAttempts;
    }
    const res = lim.resources === undefined ? {} : lim.resources;
    if (!isRecord(res)) fail('limits.resources must be an object.');
    else Object.keys(res).forEach(k => {
      if (RESOURCES.indexOf(k) < 0) fail('Unknown cumulative limit ' + k + '.');
      else if (!positive(res[k])) fail('The ' + k + ' limit must be positive.');
      else limits.resources[k] = res[k];
    });
    if (lim.deadline !== undefined && lim.deadline !== null) {
      if (!text(lim.deadline) || !Number.isFinite(Date.parse(lim.deadline))) fail('deadline must be an ISO date and time.');
      else limits.deadline = lim.deadline;
    }
  }
  const onExhausted = input.onExhausted === undefined ? 'escalate' : input.onExhausted;
  if (onExhausted !== 'stop' && onExhausted !== 'escalate') fail('onExhausted must be stop or escalate.');
  const targets = input.targets === undefined ? [] : input.targets;
  if (!Array.isArray(targets)) fail('targets must be a list.');
  if (errors.length) return {ok: false, errors};
  return {ok: true, policy: {revision: input.revision, required: required.map(r => ({id: r.id, label: r.label, remediable: r.remediable === true})),
    rubric, limits, onExhausted, targets: targets.slice()}};
}

/**
 * A changed policy is a new revision. Supply the owner's new revision string, or omit it to get a
 * browser-derived `sim-` revision. Reusing the old revision for different content is refused, so an
 * edit can never make an old evaluation look current. Evaluations are never touched here.
 */
function revise(policy, patch, revision) {
  const before = normalizePolicy(policy);
  if (!before.ok) return before;
  const draft = Object.assign({}, before.policy, patch || {});
  draft.revision = 'pending';
  const shaped = normalizePolicy(draft);
  if (!shaped.ok) return shaped;
  const changed = canonical(contentOf(shaped.policy)) !== canonical(contentOf(before.policy));
  const next = revision === undefined ? derivedRevision(shaped.policy) : revision;
  if (changed && next === before.policy.revision) return {ok: false, errors: ['Changed content needs a new policy revision.']};
  shaped.policy.revision = changed ? next : before.policy.revision;
  return normalizePolicy(shaped.policy);
}

// Which evaluations may be counted, and why the others may not. Every evaluation is kept.
function classify(policy, record) {
  const cand = isRecord(record.candidate) ? record.candidate : null;
  return (Array.isArray(record.evaluations) ? record.evaluations : []).map((e, i) => {
    const id = isRecord(e) && text(e.id) ? e.id : 'evaluation-' + i;
    const out = (status, reason) => ({id, status, reason, evaluation: e});
    if (!isRecord(e)) return out('ignored', 'malformed');
    if (e.policyRevision !== policy.revision) return out('stale', 'policy-revision');
    if (!cand || !text(cand.digest) || !isRecord(e.candidate) || e.candidate.digest !== cand.digest) return out('stale', 'other-candidate');
    if (e.candidate.attempt !== cand.attempt) return out('stale', 'other-attempt');
    const ev = Array.isArray(e.evidence) ? e.evidence : [];
    if (!ev.length || !ev.every(x => isRecord(x) && text(x.id) && text(x.digest))) return out('ignored', 'no-evidence');
    if (!isRecord(e.evaluator) || !text(e.evaluator.id)) return out('ignored', 'no-evaluator');
    return out('current', null);
  });
}
const EVALUATION_REASONS = Object.freeze({
  'policy-revision': 'graded against another policy revision',
  'other-candidate': 'graded a different candidate',
  'other-attempt': 'graded a different attempt',
  'no-evidence': 'cites no sealed evidence',
  'no-evaluator': 'names no evaluator',
  malformed: 'is malformed',
});

function conditionStates(policy, current) {
  return policy.required.map(r => {
    const said = current.map(c => ({id: c.id, v: isRecord(c.evaluation.conditions) ? c.evaluation.conditions[r.id] : undefined}));
    const fails = said.filter(x => x.v === 'fail'), passes = said.filter(x => x.v === 'pass');
    // Conservative: any current failure wins over a pass; nothing current means unknown.
    const state = fails.length ? 'fail' : passes.length ? 'pass' : 'unknown';
    return {id: r.id, label: r.label, remediable: r.remediable, state, by: (fails.length ? fails : passes).map(x => x.id)};
  });
}

function rubricState(policy, current) {
  const rb = policy.rubric;
  if (!rb) return {state: 'absent', score: null, minScore: null, floorsFailed: [], by: null, criteria: []};
  const scored = current.filter(c => isRecord(c.evaluation.scores)).pop();
  const scores = scored ? scored.evaluation.scores : {};
  const criteria = rb.criteria.map(c => {
    const v = scores[c.id], valid = finite(v) && v >= rb.scale.min && v <= rb.scale.max;
    return {id: c.id, label: c.label, weight: c.weight, floor: c.floor, score: valid ? v : null,
      belowFloor: valid && c.floor !== null && v < c.floor};
  });
  const base = {minScore: rb.minScore, scale: rb.scale, aggregation: rb.aggregation, by: scored ? scored.id : null, criteria};
  if (!scored || criteria.some(c => c.score === null)) return Object.assign(base, {state: 'unknown', score: null, floorsFailed: []});
  const score = AGGREGATIONS[rb.aggregation](rb.criteria, scores);
  const floorsFailed = criteria.filter(c => c.belowFloor).map(c => c.id);
  return Object.assign(base, {state: floorsFailed.length || score < rb.minScore ? 'fail' : 'pass', score, floorsFailed});
}

// Limits are cumulative over every recorded attempt. Nothing in a record can reset them.
function limitState(policy, record, now) {
  const attempts = Array.isArray(record.attempts) ? record.attempts.filter(isRecord) : [];
  const l = policy.limits, exhausted = [];
  const resources = Object.keys(l.resources).map(k => {
    const known = attempts.every(a => finite(a[k]) && a[k] >= 0);
    const used = known ? attempts.reduce((s, a) => s + a[k], 0) : null;
    if (used !== null && used >= l.resources[k]) exhausted.push(k);
    return {k, used, max: l.resources[k]};
  });
  if (l.maxAttempts !== null && attempts.length >= l.maxAttempts) exhausted.push('attempts');
  const deadlinePassed = l.deadline !== null && finite(now) && now >= Date.parse(l.deadline);
  if (deadlinePassed) exhausted.push('deadline');
  // An attempt with effects marked unresolved blocks a retry. So does any earlier attempt whose effects were
  // never shown to be settled. Only the latest attempt may still be in progress.
  const unresolved = attempts.filter((a, i) => a.effects === 'unresolved' || (i < attempts.length - 1 && a.effects !== 'settled'));
  return {attempts: {used: attempts.length, max: l.maxAttempts}, resources, deadline: l.deadline, deadlinePassed, exhausted,
    usageUnknown: resources.some(r => r.used === null), unresolved: unresolved.map(a => a.id || '?')};
}

/** Eligibility and the next permitted action. Pure; `now` is a millisecond timestamp the caller supplies. */
function evaluate(policyInput, recordInput, now) {
  const record = isRecord(recordInput) ? recordInput : {};
  const attempts = Array.isArray(record.attempts) ? record.attempts.filter(isRecord) : [];
  const execution = {state: attempts.length ? String(attempts[attempts.length - 1].state || 'unknown') : 'no-attempts', attempts: attempts.length};
  const n = normalizePolicy(policyInput);
  const result = (fields, action, reason) => Object.assign({profile: PROFILE, eligible: false, qualification: 'unknown',
    conditions: [], rubric: {state: 'absent', score: null, floorsFailed: [], criteria: []}, targets: {state: 'absent', count: 0},
    limits: null, evaluations: [], execution, acceptance: ACCEPTANCE}, fields,
  {next: {action, reason, label: ACTION_LABELS[action], text: REASONS[reason]}});
  if (!n.ok) return result({policyRevision: null, errors: n.errors}, 'stop-escalate', 'invalid-policy');
  const policy = n.policy;
  const evaluations = classify(policy, record);
  const current = evaluations.filter(e => e.status === 'current');
  const conditions = conditionStates(policy, current);
  const rubric = rubricState(policy, current);
  const targets = policy.targets.length ? {state: 'unknown', count: policy.targets.length} : {state: 'absent', count: 0};
  const limits = limitState(policy, record, now);
  const failed = conditions.some(c => c.state === 'fail') || rubric.state === 'fail';
  const unknown = conditions.some(c => c.state === 'unknown') || rubric.state === 'unknown' || targets.state === 'unknown';
  const qualification = failed ? 'not-met' : unknown ? 'unknown' : 'met';
  const shown = evaluations.map(e => ({id: e.id, status: e.status, reason: e.reason, why: e.reason ? EVALUATION_REASONS[e.reason] : null,
    evaluator: isRecord(e.evaluation) && isRecord(e.evaluation.evaluator) ? e.evaluation.evaluator : null,
    candidate: isRecord(e.evaluation) && isRecord(e.evaluation.candidate) ? e.evaluation.candidate : null,
    evidence: isRecord(e.evaluation) && Array.isArray(e.evaluation.evidence) ? e.evaluation.evidence.slice() : []}));
  const base = {policyRevision: policy.revision, qualification, conditions, rubric, targets, limits, evaluations: shown,
    onExhausted: policy.onExhausted, candidate: isRecord(record.candidate) ? record.candidate : null};
  const auth = isRecord(record.authorization) ? record.authorization : null;
  if (record.cancelled === true) return result(base, 'stop-escalate', 'cancelled');
  if (limits.unresolved.length) return result(base, 'stop-escalate', 'unresolved-prior-effects');
  if (auth && AUTH_STOPS.has(auth.state)) return result(base, 'stop-escalate', 'authorization-needs-resolution');
  // Fail closed: a policy with no gate at all is never "met" by default.
  if (!policy.required.length && !policy.rubric && !policy.targets.length) return result(Object.assign(base, {qualification: 'unknown'}), 'stop-escalate', 'no-gates');
  if (qualification === 'met') return result(Object.assign(base, {eligible: true}), 'request-authorized-acceptance', 'eligible');
  if (failed) {
    if (conditions.some(c => c.state === 'fail' && !c.remediable)) return result(base, 'stop-escalate', 'hard-failure');
    if (limits.exhausted.length) return result(base, 'stop-escalate', 'limits-exhausted');
    if (policy.limits.maxAttempts === null) return result(base, 'stop-escalate', 'no-attempt-limit');
    if (limits.usageUnknown) return result(base, 'stop-escalate', 'usage-unknown');
    return result(base, 'request-bounded-revision', 'remediable-failure');
  }
  if (limits.deadlinePassed) return result(base, 'stop-escalate', 'deadline-passed');
  const onlyTargets = targets.state === 'unknown' && conditions.every(c => c.state === 'pass') && rubric.state !== 'unknown';
  return result(base, 'wait-for-evidence', onlyTargets ? 'outcome-targets-not-supported' : 'evidence-missing');
}

/*
 * Author-chosen success criteria on a Brief (`brief.success`), set in New mission and Edit brief.
 * This is the editor ported from #42. The catalog is the editor's own, not a wire schema.
 *   {conditions: ['review'|'checks'], custom: [text], rubric: {minScore, criteria: [{id, weight, floor}]} | null,
 *    maxAttempts, deadline: 'YYYY-MM-DDTHH:MMZ' | null, examples: count | null}
 * Percentages are whole numbers on a 0–100 scale. Cost and time stay the Brief's own "at most" ceilings.
 */
const SUCCESS_CONDITIONS = Object.freeze({review: 'Independent review passes', checks: 'Artifact checks pass'});
const SUCCESS_CRITERIA = Object.freeze({
  accuracy: Object.freeze({label: 'Accuracy', anchors: Object.freeze({0: 'Unsupported', 50: 'Partly supported', 100: 'Fully supported'})}),
  clarity: Object.freeze({label: 'Clarity', anchors: Object.freeze({0: 'Unusable', 50: 'Needs explanation', 100: 'Reproducible'})}),
});
const SUCCESS_BOUNDS = Object.freeze({custom: 12, customLength: 160, attempts: 100, weight: 100, examples: 1000000});
const whole = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
const DEADLINE = /^\d{4}-\d\d-\d\dT\d\d:\d\dZ$/;

/** The criteria a new editor starts from: both conditions, both criteria and three attempts. */
function draftSuccess() {
  return {conditions: ['review', 'checks'], custom: [], rubric: {minScore: 80, criteria: [{id: 'accuracy', weight: 2, floor: 50}, {id: 'clarity', weight: 1, floor: 50}]},
    maxAttempts: 3, deadline: null, examples: null};
}

/** Validates the editor's criteria. Fails closed: each problem is an error a person can read, never a default. */
function normalizeSuccess(input) {
  const errors = [], fail = m => { errors.push(m); };
  if (!isRecord(input)) return {ok: false, errors: ['The success criteria must be an object.']};
  const conditions = Array.isArray(input.conditions) ? input.conditions : (fail('conditions must be a list.'), []);
  conditions.forEach(k => { if (!Object.prototype.hasOwnProperty.call(SUCCESS_CONDITIONS, k)) fail('Unknown condition ' + JSON.stringify(k) + '.'); });
  if (new Set(conditions).size !== conditions.length) fail('A condition is listed twice.');
  const custom = input.custom === undefined ? [] : input.custom;
  if (!Array.isArray(custom)) fail('Additional evidence must be a list.');
  else {
    if (custom.length > SUCCESS_BOUNDS.custom) fail('Use at most ' + SUCCESS_BOUNDS.custom + ' additional conditions.');
    custom.forEach(t => { if (!text(t) || t.trim() !== t || t.length > SUCCESS_BOUNDS.customLength) fail('Each additional condition needs 1 to ' + SUCCESS_BOUNDS.customLength + ' characters.'); });
    if (new Set(custom).size !== custom.length) fail('An additional condition is listed twice.');
  }
  let rubric = null;
  if (input.rubric !== null && input.rubric !== undefined) {
    const rb = input.rubric;
    if (!isRecord(rb)) fail('rubric must be an object or null.');
    else {
      if (!whole(rb.minScore, 0, 100)) fail('The minimum weighted score must be a whole percentage from 0 to 100.');
      const rows = Array.isArray(rb.criteria) && rb.criteria.length ? rb.criteria : (fail('The rubric needs at least one criterion.'), []);
      rows.forEach(c => {
        if (!isRecord(c) || !Object.prototype.hasOwnProperty.call(SUCCESS_CRITERIA, c.id)) return fail('Unknown rubric criterion.');
        const name = SUCCESS_CRITERIA[c.id].label;
        if (!whole(c.weight, 1, SUCCESS_BOUNDS.weight)) fail(name + ' needs a whole-number weight from 1 to ' + SUCCESS_BOUNDS.weight + '.');
        if (!whole(c.floor, 0, 100)) fail(name + ' needs a floor from 0 to 100%.');
      });
      if (new Set(rows.filter(isRecord).map(c => c.id)).size !== rows.length) fail('A rubric criterion is listed twice.');
      rubric = {minScore: rb.minScore, criteria: rows.filter(isRecord).map(c => ({id: c.id, weight: c.weight, floor: c.floor}))};
    }
  }
  if (!whole(input.maxAttempts, 1, SUCCESS_BOUNDS.attempts)) fail('Total attempts must be a whole number from 1 to ' + SUCCESS_BOUNDS.attempts + '.');
  const deadline = input.deadline === undefined || input.deadline === '' ? null : input.deadline;
  if (deadline !== null && !(typeof deadline === 'string' && DEADLINE.test(deadline) && Number.isFinite(Date.parse(deadline))
    && new Date(deadline).toISOString().slice(0, 16) + 'Z' === deadline)) fail('The deadline must be a UTC date and time (YYYY-MM-DDTHH:MMZ).');
  const examples = input.examples === undefined ? null : input.examples;
  if (examples !== null && !whole(examples, 1, SUCCESS_BOUNDS.examples)) fail('Verified examples must be a whole number from 1 to ' + SUCCESS_BOUNDS.examples.toLocaleString('en-US') + '.');
  if (errors.length) return {ok: false, errors};
  return {ok: true, success: {conditions: conditions.slice(), custom: custom.slice(), rubric, maxAttempts: input.maxAttempts, deadline, examples}};
}

/**
 * The success policy the simulation's Brief implies: each deliverable and "at least" floor is a required
 * condition, and the cumulative "at most" ceilings are limits. The subagent ceiling is concurrency, not a
 * cumulative limit, so it isn't carried over. Without `brief.success` there is no rubric and no attempt
 * limit. Criteria the author added in the editor (`brief.success`) only add gates: extra required
 * conditions, a rubric, an attempt limit, a deadline and an inert outcome target. Malformed criteria
 * yield no policy (null), which fails closed downstream. The revision is derived from the content
 * (`sim-…`), so editing the Brief or its criteria yields a new one.
 */
function fromBrief(brief, labels) {
  if (!isRecord(brief)) return null;
  const L = labels || {};
  const deliverLabel = L.deliver || (a => a.kind), floorLabel = L.floor || ((k, v) => v + ' ' + k);
  const required = (Array.isArray(brief.deliver) ? brief.deliver : []).map(a => ({id: 'deliver:' + a.kind, label: 'Deliver ' + deliverLabel(a), remediable: true}))
    .concat(Object.keys(isRecord(brief.atLeast) ? brief.atLeast : {}).map(k => ({id: 'floor:' + k, label: 'At least ' + floorLabel(k, brief.atLeast[k]), remediable: true})));
  const resources = {};
  RESOURCES.forEach(k => { if (isRecord(brief.atMost) && positive(brief.atMost[k])) resources[k] = brief.atMost[k]; });
  const policy = {revision: 'pending', required, rubric: null, limits: {maxAttempts: null, resources, deadline: null}, onExhausted: 'escalate', targets: []};
  if (brief.success !== undefined) {
    const s = normalizeSuccess(brief.success);
    if (!s.ok) return null;
    const x = s.success;
    // As in #42, a failed condition may be revised within the attempt limit.
    x.conditions.forEach(k => required.push({id: 'success:' + k, label: SUCCESS_CONDITIONS[k], remediable: true}));
    x.custom.forEach(t => required.push({id: 'custom:' + shortDigest(t), label: t, remediable: true}));
    if (x.rubric) policy.rubric = {scale: {min: 0, max: 100}, aggregation: 'weighted-mean/1', minScore: x.rubric.minScore,
      criteria: x.rubric.criteria.map(c => ({id: c.id, label: SUCCESS_CRITERIA[c.id].label, weight: c.weight, floor: c.floor, anchors: Object.assign({}, SUCCESS_CRITERIA[c.id].anchors)}))};
    policy.limits.maxAttempts = x.maxAttempts;
    policy.limits.deadline = x.deadline;
    if (x.examples !== null) policy.targets.push({id: 'verified-examples', label: 'At least ' + x.examples.toLocaleString('en-US') + ' verified examples', count: x.examples});
  }
  policy.revision = derivedRevision(policy);
  const n = normalizePolicy(policy);
  return n.ok ? n.policy : null;
}

const fmtLimit = (k, v) => k === 'usd' ? '$' + (v % 1 ? v.toFixed(2) : v) : k === 'minutes' ? v + ' minutes' : v.toLocaleString('en-US') + ' tokens';
const fmtScore = v => String(Math.round(v * 100) / 100);
/** The plain-language completion summary of a policy, shown before a Brief is saved. */
function summarize(policyInput) {
  const n = normalizePolicy(policyInput);
  if (!n.ok) return 'This success policy is incomplete, so no completion rule can be stated.';
  const p = n.policy, out = [], gates = [];
  if (p.required.length) gates.push(p.required.length === 1 ? 'its one required condition passes' : 'all ' + p.required.length + ' required conditions pass');
  if (p.rubric) gates.push('the quality rubric scores at least ' + fmtScore(p.rubric.minScore) + ' of ' + fmtScore(p.rubric.scale.max)
    + (p.rubric.criteria.some(c => c.floor !== null) ? ', with no criterion below its floor' : ''));
  if (p.targets.length) gates.push('its outcome targets are verified (not supported yet, so they stay unknown)');
  out.push(gates.length ? 'Eligible for acceptance only when ' + gates.join(' and ') + ', each shown by current evidence for the same candidate.'
    : 'No gate is configured, so there is nothing to judge eligibility against.');
  const caps = [];
  if (p.limits.maxAttempts !== null) caps.push(p.limits.maxAttempts === 1 ? '1 attempt' : p.limits.maxAttempts + ' attempts');
  Object.keys(p.limits.resources).forEach(k => caps.push(fmtLimit(k, p.limits.resources[k])));
  if (caps.length || p.limits.deadline) out.push('All attempts together may use at most ' + (caps.length ? caps.join(', ') : 'no fixed amount')
    + (p.limits.deadline ? ', before ' + p.limits.deadline : '') + '.');
  if (p.limits.maxAttempts === null) out.push('No attempt limit is set, so a failed gate can\'t lead to a revision.');
  out.push('When a limit runs out: ' + (p.onExhausted === 'stop' ? 'stop.' : 'stop and escalate.'));
  out.push('Unknown evidence never counts as met. Meeting every gate makes the mission eligible; acceptance is a separate, authorized step.');
  return out.join(' ');
}

return Object.freeze({PROFILE, ACTIONS, ACTION_LABELS, REASONS, EVALUATION_REASONS, ACCEPTANCE, AGGREGATIONS,
  SUCCESS_CONDITIONS, SUCCESS_CRITERIA, SUCCESS_BOUNDS,
  normalizePolicy, revise, evaluate, fromBrief, normalizeSuccess, draftSuccess, summarize, canonical, shortDigest});
}));
