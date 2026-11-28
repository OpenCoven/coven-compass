/*
 * Brief success policy view (#35 proposal). Builds one DOM panel from a CovenBriefPolicy evaluation.
 * The mission inspector (simulation) and the standalone ?source=fixture&scenario=brief-… view share it.
 *
 *   CovenBriefPolicyView.render(doc, {policy, result, summary, origin: 'simulation' | 'synthetic', note?})
 *
 * The panel keeps four states apart: the proposal (policy revision), execution, quality qualification
 * and accepted completion. Accepted completion is always "not recorded", because no input can make it
 * otherwise. All text is set with textContent; nothing from a fixture is parsed as HTML.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CovenBriefPolicyView = api;
}(typeof window !== 'undefined' ? window : null, function () {
'use strict';

const STATE_TEXT = {pass: 'Pass', fail: 'Fail', unknown: 'Unknown'};
const QUALIFICATION_TEXT = {met: 'Met', 'not-met': 'Not met', unknown: 'Unknown'};
const EXECUTION_TEXT = {'no-attempts': 'No attempt records', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled',
  running: 'Running', unknown: 'Unknown'};
const fmt = (k, v) => v === null || v === undefined ? 'unknown' : k === 'usd' ? '$' + (v % 1 ? v.toFixed(2) : v) : k === 'minutes' ? v + ' min' : v.toLocaleString('en-US');
const LIMIT_LABEL = {usd: 'Cost', minutes: 'Time', tokens: 'Tokens'};
const round = v => String(Math.round(v * 100) / 100);

function render(doc, input) {
  const o = input || {}, r = o.result, policy = o.policy, synthetic = o.origin === 'synthetic';
  const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = text; return n; };
  const row = (parent, label, value, state) => {
    const d = el('div', 'bp-row' + (state ? ' is-' + state : '')); d.append(el('span', 'bp-k', label), el('b', 'bp-v', value)); parent.appendChild(d); return d;
  };
  const box = el('section', 'bp');
  box.setAttribute('aria-label', 'Success policy, proposal');
  box.dataset.origin = synthetic ? 'synthetic' : 'simulation';
  const head = el('div', 'bp-head');
  head.append(el('h3', 'bp-title', 'Success policy'), el('span', 'bp-badge', synthetic ? 'Synthetic fixture · proposal (#35)' : 'Simulation · proposal (#35)'));
  box.appendChild(head);
  if (!r) { box.appendChild(el('p', 'bp-note', 'No success policy could be derived.')); return box; }
  if (synthetic && o.summary) box.appendChild(el('p', 'bp-summary', o.summary));

  // Next permitted action: what the policy allows next. It is not a command, and Compass can't send it.
  const next = el('div', 'bp-next is-' + r.next.action);
  next.setAttribute('role', 'note');
  next.append(el('span', 'bp-k', synthetic ? 'Next permitted action' : 'Next step'), el('b', 'bp-action', r.next.label), el('p', 'bp-why', !synthetic && r.next.action === 'wait-for-evidence' ? 'Required conditions still need current evidence.' : r.next.text));
  if (synthetic) next.appendChild(el('p', 'bp-fine', 'Display only. Compass has no way to send this to Coven.'));
  box.appendChild(next);

  // Four states, kept apart.
  const ladder = el('dl', 'bp-ladder');
  const explanations = [];
  const step = (k, v, note, state) => { const d = el('div', 'bp-step' + (state ? ' is-' + state : '')); d.append(el('dt', null, k), el('dd', null, v)); if (note) {
    if (synthetic) d.appendChild(el('dd', 'bp-fine', note));
    else explanations.push([k, note]);
  } ladder.appendChild(d); };
  step('Proposal', r.policyRevision ? 'Policy ' + r.policyRevision : 'No valid policy',
    synthetic ? 'A synthetic revision, not owner-approved.' : 'Derived from this Brief in the browser. Not a Psyche policy revision.');
  step('Execution', EXECUTION_TEXT[r.execution.state] || r.execution.state,
    r.execution.attempts ? 'Latest of ' + r.execution.attempts + (r.execution.attempts === 1 ? ' attempt' : ' attempts') + '.' : synthetic ? null : 'The simulation records no attempts.');
  step('Quality qualification', QUALIFICATION_TEXT[r.qualification], r.eligible ? 'Eligible for acceptance. Not accepted.' : null, r.qualification);
  step('Accepted completion', 'Not recorded', r.acceptance.text.replace(/^Not recorded\.\s*/, ''), 'not-recorded');
  box.appendChild(ladder);

  const detail = synthetic ? box : el('details', 'bp-rules');
  if (!synthetic) {
    const toggle = el('summary', '', 'Policy details');
    toggle.dataset.focus = 'brief-policy-details';
    detail.appendChild(toggle);
    detail.appendChild(el('p', 'bp-fine', 'This simulation displays the policy. Only Coven can record acceptance.'));
    if (o.summary) detail.appendChild(el('p', 'bp-summary', o.summary));
    explanations.forEach(([label, note]) => detail.appendChild(el('p', 'bp-fine', label + ' · ' + note)));
    box.appendChild(detail);
  }

  const section = (title, aside) => { const s = el('div', 'bp-sec'), h = el('div', 'bp-sec-h'); h.append(el('h4', null, title)); if (aside) h.appendChild(el('em', null, aside)); s.appendChild(h); detail.appendChild(s); return s; };

  // 1. Required conditions
  const met = r.conditions.filter(c => c.state === 'pass').length;
  const req = section('Required conditions', r.conditions.length ? met + ' of ' + r.conditions.length + ' pass' : '');
  if (!r.conditions.length) req.appendChild(el('p', 'bp-note', 'None required.'));
  const commonRule = !synthetic && r.conditions.length && r.conditions.every(c => c.remediable === r.conditions[0].remediable && !c.by.length);
  const failureRule = c => c.remediable ? 'A failure may be revised.' : 'A failure stops the mission.';
  r.conditions.forEach(c => {
    const d = row(req, c.label, STATE_TEXT[c.state], c.state);
    if (!commonRule) d.appendChild(el('span', 'bp-fine', failureRule(c) + (c.by.length ? ' From ' + c.by.join(', ') + '.' : '')));
  });
  if (commonRule) req.appendChild(el('p', 'bp-fine', failureRule(r.conditions[0])));
  if (!synthetic && r.conditions.length) req.appendChild(el('p', 'bp-note', 'The Brief\'s counters are simulated progress, not sealed evidence, so each condition stays unknown.'));

  // 2. Quality rubric (optional)
  const rb = r.rubric;
  const rub = section('Quality rubric', rb.state === 'absent' ? 'optional' : STATE_TEXT[rb.state]);
  if (rb.state === 'absent') rub.appendChild(el('p', 'bp-note', 'None set. An absent rubric adds no requirement.'));
  else {
    row(rub, 'Score', (rb.score === null ? 'unknown' : round(rb.score)) + ' of ' + round(rb.scale.max) + ' · minimum ' + round(rb.minScore), rb.state);
    const pc = policy && policy.rubric ? policy.rubric.criteria : [];
    rb.criteria.forEach(c => {
      const d = row(rub, c.label, c.score === null ? 'unknown' : String(c.score), c.belowFloor ? 'fail' : c.score === null ? 'unknown' : '');
      const anchors = (pc.find(x => x.id === c.id) || {}).anchors || {};
      d.appendChild(el('span', 'bp-fine', 'Weight ' + c.weight + (c.floor !== null ? ' · floor ' + c.floor : '')
        + (c.belowFloor ? ' · below its floor' : '') + ' · ' + Object.keys(anchors).sort((a, b) => a - b).map(k => k + ': ' + anchors[k]).join('; ')));
    });
    rub.appendChild(el('p', 'bp-fine', 'Aggregation ' + rb.aggregation + (rb.by ? ', from ' + rb.by : '') + '. A score never outweighs a failed required condition or floor.'));
  }

  // 3. Iteration limits
  const L = r.limits;
  const lim = section(synthetic ? 'Iteration limits' : 'Limits across attempts', L && L.exhausted.length ? 'used up: ' + L.exhausted.join(', ') : '');
  if (L) {
    row(lim, 'Attempts', L.attempts.max === null ? L.attempts.used + ' · no limit set' : L.attempts.used + ' of ' + L.attempts.max,
      L.attempts.max !== null && L.attempts.used >= L.attempts.max ? 'fail' : '');
    if (L.attempts.max === null) lim.appendChild(el('p', 'bp-note', 'With no attempt limit, a failed gate can\'t lead to a revision.'));
    L.resources.forEach(x => row(lim, (LIMIT_LABEL[x.k] || x.k) + ', all attempts', fmt(x.k, x.used) + ' of ' + fmt(x.k, x.max),
      x.used === null ? 'unknown' : x.used >= x.max ? 'fail' : ''));
    if (L.deadline) row(lim, 'Deadline', L.deadline, L.deadlinePassed ? 'fail' : '');
    if (L.unresolved.length) row(lim, 'Unresolved effects', L.unresolved.join(', '), 'fail');
    row(lim, 'When a limit runs out', r.onExhausted === 'stop' ? 'Stop' : 'Stop and escalate');
  }

  // 4. Outcome targets: not part of this slice
  const tg = section('Outcome targets', r.targets.state === 'absent' ? 'not set' : STATE_TEXT.unknown);
  tg.appendChild(el('p', 'bp-note', r.targets.state === 'absent'
    ? 'Not part of this slice. Evidence-backed targets are proposed in #37.'
    : r.targets.count + ' configured, but this slice can\'t evaluate them (#37). They stay unknown.'));

  // Provenance: every evaluation stays listed, with why it does or doesn't count.
  if (r.evaluations.length) {
    const ev = doc.createElement('details'); ev.className = 'bp-evals';
    const sm = el('summary', null, 'Evaluations (' + r.evaluations.length + ')'); ev.appendChild(sm);
    r.evaluations.forEach(e => {
      const d = el('div', 'bp-eval is-' + e.status);
      d.append(el('b', null, e.id + ' · ' + (e.status === 'current' ? 'counted' : 'not counted: ' + e.why)));
      const facts = [];
      if (e.policyRevision) facts.push('policy ' + e.policyRevision);
      if (e.evaluator) facts.push('by ' + (e.evaluator.id || '?') + (e.evaluator.method ? ' (' + e.evaluator.method + ')' : ''));
      if (e.candidate) facts.push('candidate ' + e.candidate.digest + ' / ' + e.candidate.attempt);
      facts.push(e.evidence.length ? 'evidence ' + e.evidence.filter(Boolean).map(x => [x.id, x.digest].filter(Boolean).join(' / ')).join(', ') : 'no evidence cited');
      d.appendChild(el('span', 'bp-fine', facts.join(' · ')));
      ev.appendChild(d);
    });
    detail.appendChild(ev);
  }
  if (o.note) box.appendChild(el('p', 'bp-fine', o.note));
  return box;
}

return Object.freeze({render});
}));
