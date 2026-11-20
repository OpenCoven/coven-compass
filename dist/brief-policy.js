// Compass-local fixture profile. No command, permission or mission transition is emitted here.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CompassBriefPolicy = api;
})(globalThis, function () {
  const conditions = {review: 'Independent review passes', checks: 'Artifact checks pass'};
  const criteria = {
    accuracy: ['Accuracy', 'Unsupported', 'Partly supported', 'Fully supported'],
    clarity: ['Clarity', 'Unusable', 'Needs explanation', 'Reproducible'],
  };
  const actions = {wait: 'Wait for evidence', revision: 'Request bounded revision', qualify: 'Request authorized acceptance', stop: 'Stop and escalate'};
  const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
  const example = revision => ({
    version: 1, revision, required: ['review', 'checks'],
    rubric: {threshold: 80, rows: [{key: 'accuracy', weight: 2, floor: 50}, {key: 'clarity', weight: 1, floor: 50}]},
    limits: {attempts: 3, cents: 100, minutes: 30, deadline: ''}, target: null,
  });
  function valid(p) {
    if (!p || p.version !== 1 || typeof p.revision !== 'string' || !p.revision.length || p.revision.length > 100) return false;
    if (!Array.isArray(p.required) || p.required.some(k => typeof k !== 'string' || !Object.hasOwn(conditions, k)) || new Set(p.required).size !== p.required.length) return false;
    if (p.custom !== undefined && (!Array.isArray(p.custom) || p.custom.length > 12 ||
      p.custom.some(value => typeof value !== 'string' || !value.trim() || value.length > 160))) return false;
    const r = p.rubric, l = p.limits;
    if (r !== null && (!r || !integer(r.threshold, 0, 100) || !Array.isArray(r.rows) || !r.rows.length || r.rows.length > 2 ||
      r.rows.some(row => !row || typeof row.key !== 'string' || !Object.hasOwn(criteria, row.key) || !integer(row.floor, 0, 100) || !integer(row.weight, 1, 100)) ||
      new Set(r.rows.map(row => row.key)).size !== r.rows.length)) return false;
    if (!l || !integer(l.attempts, 1, 100) || !integer(l.minutes, 1, 1000000) || !integer(l.cents, 1, 100000000)) return false;
    if (l.deadline !== '' && !(typeof l.deadline === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\dZ$/.test(l.deadline) && Number.isFinite(Date.parse(l.deadline)) && new Date(l.deadline).toISOString().slice(0,16) + 'Z' === l.deadline)) return false;
    return (p.target === null || integer(p.target, 1, 1000000)) && !!(p.required.length || p.custom?.length || r || p.target);
  }
  function sameRule(a, b) {
    if (!valid(a) || !valid(b)) return false;
    const fields = p => [p.version, p.revision, p.required, p.custom || [], p.target, p.rubric?.threshold,
      p.rubric?.rows.map(r => [r.key, r.weight, r.floor]), p.limits.attempts, p.limits.minutes, p.limits.cents, p.limits.deadline];
    return JSON.stringify(fields(a)) === JSON.stringify(fields(b));
  }
  function summary(p) {
    if (!valid(p)) return 'Check the gates and limits. Choose at least one condition, rubric or target. Use up to twelve additional conditions of 160 characters each.';
    const gates = [...p.required.map(k => conditions[k]), ...(p.custom || [])];
    if (p.rubric) gates.push('weighted quality ≥ ' + p.rubric.threshold + '% with ' + p.rubric.rows.map(r => criteria[r.key][0] + ' ≥ ' + r.floor + '% (weight ' + r.weight + ')').join(' and '));
    if (p.target) gates.push('at least ' + p.target + ' synthetic verified examples');
    const l = p.limits;
    return 'Eligible when ' + gates.join(' and ') + '. Revision limits across attempts: ' + l.attempts + ' attempts, ' + l.cents + ' USD cents and ' + l.minutes + ' minutes' + (l.deadline ? ', before ' + l.deadline : '') + '. Acceptance requires authority.';
  }
  // Digests cover UTF-8 artifact text and the compact JSON observation respectively.
  const samples = {
    A: {
      artifact: 'Compass fixture candidate A\n',
      candidate: 'c4bfc23d08c55305a8d59deb7d18438a8230a0edad328a4deb963008fc0face2',
      observation: {review: false, checks: true, accuracy: 100, clarity: 100, examples: 2},
      seal: 'e7cf95c370e06b4565712823577f5e30ca341148e53c0aada6c5642d3740e2b4',
    },
    B: {
      artifact: 'Compass fixture candidate B\n',
      candidate: 'b09757e39a9aa8cfa06eae72744d8401a744db22759faef1aebdbc65e0afc385',
      observation: {review: true, checks: true, accuracy: 100, clarity: 50, examples: 4},
      seal: '41bc94f85e3598eee966c2b11a868bf24c8ff34b705ca7d32cf9f09135a7dd16',
    },
  };
  const usage = history => {
    const attempts = history.filter(r => r.phase === 'A' || r.phase === 'B');
    return {attempts: attempts.length, cents: attempts.length * 10, minutes: attempts.length * 2};
  };
  function disposition(state) {
    if (state.cancelled) return 'The mission was cancelled.';
    if (state.effects && state.effects !== 'resolved') return 'Prior effects require reconciliation.';
    if (state.authorization && state.authorization !== 'available') return 'Authorization requires resolution: ' + state.authorization + '.';
    return '';
  }
  function blocked(p, history, now, state = {}) {
    const hold = disposition(state);
    if (hold) return hold;
    if (history.some(r => r.policy.revision === p.revision && !sameRule(p, r.policy))) return 'The changed rule needs a fresh policy revision.';
    if (p.limits.deadline && now >= Date.parse(p.limits.deadline)) return 'The deadline has passed.';
    const u = usage(history);
    if (u.attempts >= p.limits.attempts || u.cents + 10 > p.limits.cents || u.minutes + 2 > p.limits.minutes) return 'The remaining cumulative budget cannot cover another fixture attempt.';
    return '';
  }
  function evaluate(p, record, history, now, state = {}) {
    const result = (action, reason, score = null) => ({action, reason, score});
    if (!valid(p)) return result('stop', 'Invalid or unsupported policy.');
    const hold = blocked(p, history, now, state);
    if (disposition(state)) return result('stop', hold);
    if (!record || !sameRule(p, record.policy)) return result('wait', 'This policy revision needs its own evaluation.');
    const evidence = record.evidence;
    if (!evidence || record.phase === 'B' || evidence.attempt !== record.attempt || evidence.revision !== p.revision || evidence.candidate !== record.candidate)
      return result('wait', 'Matching evidence for this candidate, attempt and policy is missing.');
    const sample = samples[record.phase === 'A' ? 'A' : 'B'];
    if (record.candidate !== sample.candidate || evidence.seal !== sample.seal) return result('wait', 'The sealed fixture observation does not match.');
    const obs = sample.observation;
    const rows = p.rubric?.rows || [];
    const score = rows.length ? rows.reduce((n, r) => n + obs[r.key] * r.weight, 0) / rows.reduce((n, r) => n + r.weight, 0) : null;
    const failed = p.required.find(k => obs[k] === false);
    const floor = rows.find(r => obs[r.key] < r.floor);
    let reason = '';
    if (failed) reason = 'Required condition failed: ' + conditions[failed] + '.';
    else if (floor) reason = criteria[floor.key][0] + ' is below its floor.';
    else if (p.rubric && score < p.rubric.threshold) reason = 'Weighted quality is below threshold.';
    else if (p.target && obs.examples < p.target) reason = 'Synthetic verified examples are below target.';
    if (reason) return result(hold ? 'stop' : 'revision', [reason, hold].filter(Boolean).join(' '), score);
    if (p.custom?.length) return result('wait', 'Missing evidence for: ' + p.custom.join(', ') + '.', score);
    return result('qualify', 'All configured gates passed. Protected acceptance is pending.', score);
  }
  function next(p, history, now, state = {}) {
    if (!valid(p)) return null;
    const current = history.filter(r => r.policy.revision === p.revision);
    const last = current.at(-1);
    if (disposition(state)) return null;
    if (current.some(r => !sameRule(p, r.policy))) return null;
    if (last?.phase === 'B') return 'observe';
    if (blocked(p, history, now, state)) return null;
    if (!last) return 'A';
    return last.phase === 'A' && evaluate(p, last, history, now, state).action === 'revision' ? 'B' : null;
  }
  function step(p, history, phase, now, state) {
    if (!phase || phase !== next(p, history, now, state)) return null;
    const sample = samples[phase === 'A' ? 'A' : 'B'];
    const attempt = phase === 'observe' ? history.findLast(r => sameRule(p, r.policy)).attempt : usage(history).attempts + 1;
    const candidate = sample.candidate;
    const evidence = phase === 'B' ? null : {attempt, candidate, revision: p.revision, seal: sample.seal};
    return {phase, attempt, candidate, evidence, policy: structuredClone(p), time: now};
  }
  return {example, valid, sameRule, summary, step, next, usage, blocked, evaluate, conditions, criteria, actions, samples};
});
