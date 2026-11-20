// Presentation of the local fixture profile in the existing Brief form and inspector.
(function (policy) {
  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function button(text, click) {
    const el = node('button', text, 'btn sm');
    el.type = 'button';
    el.addEventListener('click', click);
    return el;
  }
  function editor(box, brief, changed) {
    box.replaceChildren();
    box.classList.add('brief-policy');
    if (!brief.policy || brief.policy.version !== 1) {
      if (brief.policy) box.append(node('p', 'Unsupported fixture policy. Choose new criteria to replace it.'));
      box.append(button('Add success criteria', () => {
        brief.policy = policy.example('draft');
        changed(); editor(box, brief, changed);
        box.querySelector('summary').focus();
      }));
      return;
    }
    const p = brief.policy;
    const details = node('details'), heading = node('summary', 'Success criteria · local simulation');
    details.open = box.dataset.expanded !== 'false';
    details.ontoggle = () => { if (details.isConnected) box.dataset.expanded = String(details.open); };
    const form = node('div', undefined, 'policy-fields');
    details.append(heading, form);
    const preview = node('p', undefined, 'policy-preview');
    preview.setAttribute('aria-live', 'polite');
    box.append(details, preview);
    const update = () => { preview.textContent = policy.summary(p); changed(); };
    function group(name) {
      const fieldset = node('fieldset');
      fieldset.append(node('legend', name)); form.append(fieldset);
      return fieldset;
    }
    function field(parent, label, type, value, apply, opts = {}) {
      const wrap = node('label'), input = node('input');
      input.type = type;
      Object.assign(input, opts);
      if (type === 'checkbox') { input.checked = value; wrap.append(input, label); }
      else { input.value = value; wrap.append(label, input); }
      input.addEventListener('input', () => {
        apply(type === 'checkbox' ? input.checked : type === 'number' ? input.valueAsNumber : input.value);
        update();
      });
      parent.append(wrap);
      return input;
    }
    const required = group('Required conditions');
    for (const [key,label] of Object.entries(policy.conditions)) {
      field(required, label, 'checkbox', p.required.includes(key), on => {
        p.required = Object.keys(policy.conditions).filter(k => k === key ? on : p.required.includes(k));
      });
    }
    const custom = node('textarea'), customLabel = node('label', 'Additional required evidence (one condition per line)');
    custom.rows = 2; custom.maxLength = 1931;
    custom.value = (p.custom || []).join('\n');
    custom.addEventListener('input', () => {
      p.custom = custom.value.split('\n').map(line => line.trim()).filter(Boolean);
      update();
    });
    customLabel.append(custom); required.append(customLabel);
    const rubric = group('Optional quality rubric'), scores = node('div');
    field(rubric, 'Use quality rubric', 'checkbox', !!p.rubric, on => {
      p.rubric = on ? policy.example('draft').rubric : null;
      drawScores();
    });
    rubric.append(scores);
    function drawScores() {
      scores.replaceChildren();
      if (!p.rubric) return;
      field(scores, 'Minimum weighted score (%)', 'number', p.rubric.threshold, v => p.rubric.threshold = v, {min:0,max:100});
      for (const row of p.rubric.rows) {
        const [name,low,mid,high] = policy.criteria[row.key];
        scores.append(node('p', name + ' · 0 = ' + low + ', 50 = ' + mid + ', 100 = ' + high));
        field(scores, name + ' weight', 'number', row.weight, v => row.weight = v, {min:1,max:100});
        field(scores, name + ' floor (%)', 'number', row.floor, v => row.floor = v, {min:0,max:100});
      }
    }
    drawScores();
    const limits = group('Iteration limits');
    for (const [key,label,max] of [['attempts','Total attempts',100],['cents','Total cost (USD cents)',100000000],['minutes','Total time (minutes)',1000000]]) {
      field(limits, label, 'number', p.limits[key], v => p.limits[key] = v, {min:1,max});
    }
    field(limits, 'Deadline (UTC, optional)', 'datetime-local', p.limits.deadline.replace(/Z$/, ''), v => p.limits.deadline = v ? v + 'Z' : '');
    const outcome = group('Optional outcome target');
    const countBox = node('div');
    field(outcome, 'Require verified examples', 'checkbox', p.target !== null, on => {
      p.target = on ? 4 : null; drawTarget();
    });
    outcome.append(countBox);
    function drawTarget() {
      countBox.replaceChildren();
      if (p.target !== null) field(countBox, 'Synthetic verified examples', 'number', p.target, v => p.target = v, {min:1,max:1000000});
    }
    drawTarget();
    form.append(node('p', 'This tab retains the Project trace when you save a fixture Brief.'));
    form.append(button('Remove success criteria', () => {
      delete brief.policy; changed(); editor(box, brief, changed); box.querySelector('button').focus();
    }));
    preview.textContent = policy.summary(p);
  }

  function inspector(box, mission, now, interactive, emitRecord, holdFixture, replayAt, returnToCurrent) {
    const p = mission.brief?.policy, history = mission.reviews || [];
    if (!p && !history.length) return;
    const section = node('section', undefined, 'brief-policy policy-review');
    box.append(section);
    section.append(node('h3', 'Success criteria · local simulation'), node('p', p ? policy.summary(p) : 'This Brief has no current policy.'));
    if (returnToCurrent) section.append(button('Return to current Brief', returnToCurrent));
    const used = policy.usage(history);
    section.append(node('p', 'Fixture usage across revisions: ' + used.attempts + ' attempts · ' + used.cents + ' USD cents · ' + used.minutes + ' minutes.'));
    history.forEach((r, i) => {
      const upto = history.slice(0, i + 1), verdict = policy.evaluate(r.policy, r, upto, r.time);
      const card = node('article'), label = r.phase === 'A' ? 'A' : 'B';
      card.append(node('h4', 'Attempt ' + r.attempt + ' · Candidate ' + label + (r.phase === 'observe' ? ' · Evidence received' : '')),
        node('strong', policy.actions[verdict.action]), node('p', verdict.reason));
      if (verdict.score !== null) card.append(node('p', 'Weighted score ' + Number(verdict.score.toFixed(2)) + '%.'));
      const info = node('details');
      info.append(node('summary', 'Evaluation provenance'));
      const sample = policy.samples[label];
      info.append(node('p', 'Policy ' + r.policy.revision), node('p', policy.summary(r.policy)), node('p', 'Artifact SHA-256 ' + r.candidate));
      if (r.evidence) {
        info.append(node('p', 'Evaluator: Compass fixture reviewer · method: deterministic profile v1.'),
          node('p', 'Observation SHA-256 ' + r.evidence.seal));
        for (const k of r.policy.required) info.append(node('p', policy.conditions[k] + ' · ' + (sample.observation[k] ? 'Pass' : 'Fail')));
        for (const text of r.policy.custom || []) info.append(node('p', text + ' · Unknown'));
        for (const row of r.policy.rubric?.rows || []) info.append(node('p', policy.criteria[row.key][0] + ' · ' + sample.observation[row.key] + '/100'));
        if (r.policy.target) info.append(node('p', 'Synthetic verified examples · ' + sample.observation.examples));
      } else info.append(node('p', 'Evaluator and observation pending.'));
      card.append(info, button('Replay this point', () => replayAt(r.time)));
      section.append(card);
    });
    if (!policy.valid(p)) return;
    section.append(node('p', 'Current policy ' + p.revision + ' · Execution unobserved · Protected acceptance pending.'));
    const current = history.filter(r => policy.sameRule(r.policy, p)).at(-1);
    const next = policy.next(p, history, now, mission.reviewHold);
    const block = policy.blocked(p, history, now, mission.reviewHold);
    const verdict = policy.evaluate(p, current, history, now, mission.reviewHold);
    const waitingForRevision = !current && history.length && !mission.reviewHold;
    const currentAction = !current && block ? 'stop' : verdict.action;
    const explanation = !current && block ? block : waitingForRevision ? 'Earlier evaluations belong to a different policy revision.' :
      !current && !mission.reviewHold ? 'This policy has no fixture evidence yet.' : verdict.reason;
    section.append(node('strong', 'Current next step · ' + policy.actions[currentAction]), node('p', explanation));
    if (!interactive) return;
    const labels = {A:'Inspect fixture attempt A', B:'Inspect corrected candidate B', observe:'Reveal B’s matching evidence'};
    if (next) {
      section.append(button(labels[next], () => emitRecord(next)));
      const controls = node('details');
      controls.append(node('summary', 'Fixture stop cases'));
      for (const reason of ['cancelled', 'uncertain effects', 'denied', 'expired', 'revoked', 'uncertain'])
        controls.append(button('Simulate ' + reason, () => holdFixture(reason)));
      section.append(controls);
    }
  }
  window.CompassBriefUI = {editor, inspector};
})(window.CompassBriefPolicy);
