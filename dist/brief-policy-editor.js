/*
 * Success criteria editor for New mission and Edit brief (#35 proposal). Ported from #42 onto
 * CovenBriefPolicy: it edits `brief.success` in place. The page derives the policy from the Brief
 * with CovenBriefPolicy.fromBrief, and that policy's summary is the preview (#nmDone).
 *
 *   CovenBriefPolicyEditor.render(doc, brief, onChange) → element
 *
 * onChange() runs after every edit, so the page can refresh its preview and its Save state. The
 * editor never saves, emits an event, grades an attempt or records acceptance. All text is set with
 * textContent.
 */
(function (root, factory) {
  var api = factory(root && root.CovenBriefPolicy);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CovenBriefPolicyEditor = api;
}(typeof window !== 'undefined' ? window : null, function (injected) {
'use strict';

function render(doc, brief, onChange, policyApi) {
  const BP = policyApi || injected || (typeof require === 'function' ? require('./brief-policy.js') : null);
  const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = text; return n; };
  const box = el('div', 'bp-editor');
  box.setAttribute('data-id', 'bp-editor');
  const changed = () => { drawErrors(); if (onChange) onChange(); };
  const button = (text, id, click) => { const b = el('button', 'btn sm', text); b.type = 'button'; b.setAttribute('data-id', id); b.addEventListener('click', click); return b; };
  const errors = el('ul', 'bp-editor-errors');
  errors.id = 'nmSuccessErrors';
  errors.setAttribute('aria-live', 'polite');
  function drawErrors() {
    errors.textContent = '';
    if (brief.success === undefined) return;
    const n = BP.normalizeSuccess(brief.success);
    if (!n.ok) n.errors.forEach(m => errors.appendChild(el('li', null, m)));
  }

  if (brief.success === undefined) {
    box.append(el('p', 'bp-fine', 'The Brief\'s deliverables and floors are already required. Add success criteria to require more evidence, a quality rubric or an attempt limit.'),
      button('Add success criteria', 'bp-add', () => { brief.success = BP.draftSuccess(); redraw('bp-c-review'); changed(); }));
    return box;
  }
  const s = brief.success;
  const head = el('div', 'bp-editor-head');
  head.append(el('h4', null, 'Success criteria · local simulation'), button('Remove success criteria', 'bp-remove', () => { delete brief.success; redraw('bp-add'); changed(); }));
  box.appendChild(head);
  const group = name => { const f = el('fieldset'); f.appendChild(el('legend', null, name)); box.appendChild(f); return f; };
  function field(parent, label, type, value, id, apply, attrs) {
    const wrap = el('label'), input = el('input');
    input.type = type; input.setAttribute('data-id', id);
    Object.keys(attrs || {}).forEach(k => input.setAttribute(k, attrs[k]));
    if (type === 'checkbox') { input.checked = !!value; wrap.append(input, label); }
    else { input.value = value === null || value === undefined ? '' : String(value); wrap.append(el('span', null, label), input); }
    input.addEventListener(type === 'checkbox' ? 'change' : 'input', () => {
      apply(type === 'checkbox' ? input.checked : type === 'number' ? (input.value.trim() === '' ? NaN : Number(input.value)) : input.value);
      changed();
    });
    parent.appendChild(wrap);
    return input;
  }

  const required = group('Required conditions');
  Object.keys(BP.SUCCESS_CONDITIONS).forEach(k => field(required, BP.SUCCESS_CONDITIONS[k], 'checkbox', s.conditions.indexOf(k) >= 0, 'bp-c-' + k, on => {
    s.conditions = Object.keys(BP.SUCCESS_CONDITIONS).filter(x => x === k ? on : s.conditions.indexOf(x) >= 0);
  }));
  const customLabel = el('label', 'bp-editor-custom'), custom = el('textarea');
  custom.rows = 2; custom.setAttribute('data-id', 'bp-custom');
  custom.value = (s.custom || []).join('\n');
  custom.addEventListener('input', () => { s.custom = custom.value.split('\n').map(t => t.trim()).filter(Boolean); changed(); });
  customLabel.append(el('span', null, 'Additional required evidence (one condition per line, up to ' + BP.SUCCESS_BOUNDS.custom + ')'), custom);
  required.appendChild(customLabel);

  const rubric = group('Optional quality rubric'), scores = el('div', 'bp-editor-scores');
  field(rubric, 'Use quality rubric', 'checkbox', !!s.rubric, 'bp-rubric', on => { s.rubric = on ? BP.draftSuccess().rubric : null; drawScores(); });
  rubric.appendChild(scores);
  function drawScores() {
    scores.textContent = '';
    if (!s.rubric) return;
    field(scores, 'Minimum weighted score (%)', 'number', s.rubric.minScore, 'bp-min', v => { s.rubric.minScore = v; }, {min: 0, max: 100, step: 1});
    s.rubric.criteria.forEach(row => {
      const c = BP.SUCCESS_CRITERIA[row.id];
      scores.appendChild(el('p', 'bp-fine', c.label + ' · 0 = ' + c.anchors[0] + ', 50 = ' + c.anchors[50] + ', 100 = ' + c.anchors[100]));
      field(scores, c.label + ' weight', 'number', row.weight, 'bp-w-' + row.id, v => { row.weight = v; }, {min: 1, max: BP.SUCCESS_BOUNDS.weight, step: 1});
      field(scores, c.label + ' floor (%)', 'number', row.floor, 'bp-f-' + row.id, v => { row.floor = v; }, {min: 0, max: 100, step: 1});
    });
  }
  drawScores();

  const limits = group('Iteration limits');
  field(limits, 'Total attempts', 'number', s.maxAttempts, 'bp-attempts', v => { s.maxAttempts = v; }, {min: 1, max: BP.SUCCESS_BOUNDS.attempts, step: 1});
  field(limits, 'Deadline (UTC, optional)', 'datetime-local', s.deadline ? s.deadline.replace(/Z$/, '') : '', 'bp-deadline', v => { s.deadline = v ? v + 'Z' : null; });
  limits.appendChild(el('p', 'bp-fine', 'Cost and time across all attempts are the Brief\'s “At most” limits above.'));

  const outcome = group('Optional outcome target'), count = el('div');
  field(outcome, 'Require verified examples', 'checkbox', s.examples !== null && s.examples !== undefined, 'bp-target', on => { s.examples = on ? 4 : null; drawTarget(); });
  outcome.appendChild(count);
  function drawTarget() {
    count.textContent = '';
    if (s.examples === null || s.examples === undefined) return;
    field(count, 'Verified examples', 'number', s.examples, 'bp-examples', v => { s.examples = v; }, {min: 1, max: BP.SUCCESS_BOUNDS.examples, step: 1});
    count.appendChild(el('p', 'bp-fine', 'Outcome targets aren\'t evaluated yet (#37), so this one stays unknown.'));
  }
  drawTarget();
  box.appendChild(errors);
  drawErrors();
  return box;

  // Add and Remove change which controls exist, so the editor is rebuilt in place and keeps focus on the next control.
  function redraw(focusId) {
    const parent = box.parentNode;
    if (!parent) return;
    const next = render(doc, brief, onChange, BP);
    parent.replaceChild(next, box);
    const target = next.querySelector && next.querySelector('[data-id="' + focusId + '"]');
    if (target) target.focus();
  }
}

return Object.freeze({render});
}));
