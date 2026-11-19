/* Mission seal explorer. Geometry is supplied by the v27 renderer. */
(() => {
  'use strict';

  const ORDER = ['planned', 'active', 'needsYou', 'stalled', 'sealed', 'broken'];
  const COUNCIL = [
    { key: 'astra', agents: 7 },
    { key: 'cody', agents: 10 },
    { key: 'echo', agents: 6 },
  ];
  const COPY = {
    planned: ['Planned', 'The council is seated. No agents have been assigned yet.'],
    active: ['Active', 'Agents are working. Each familiar’s wedge shows its share and progress.'],
    needsYou: ['Needs you', 'Echo has a request waiting in the Inbox. The lifted signet and near-white halo call for your attention.'],
    stalled: ['Stalled', 'A limit is near, or no agents are working. The mission needs attention before it can continue normally.'],
    sealed: ['Sealed', 'Every required target is met and every deliverable is delivered. The signet sits wide and flush.'],
    broken: ['Broken', 'A limit was reached and the decision was to keep the mission stopped. The lead wedge is hollow and the signet is slashed.'],
  };
  const PRESETS = {
    planned: { progress: [0, 0, 0], working: [0, 0, 0], limit: 0 },
    active: { progress: [48, 82, 30], working: [5, 8, 3], limit: 57 },
    needsYou: { progress: [62, 92, 50], working: [5, 8, 0], limit: 72 },
    stalled: { progress: [62, 92, 50], working: [5, 8, 3], limit: 87 },
    sealed: { progress: [100, 100, 100], working: [0, 0, 0], limit: 72 },
    broken: { progress: [62, 92, 50], working: [0, 0, 0], limit: 100 },
  };
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(+n) ? +n : lo));
  let api = null;
  let dialog = null;
  let returnFocus = null;
  let view = 'selected';
  let state = 'stalled';
  let values = null;
  let seal = null;
  let frame = 0;
  let displayed = [0, 0, 0];
  const ui = {};
  const rows = [];

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function button(cls, label, action) {
    const node = el('button', cls, label);
    node.type = 'button';
    if (action) node.addEventListener('click', action);
    return node;
  }

  function preset(next) {
    state = next;
    const data = PRESETS[next];
    values = { progress: data.progress.slice(), working: data.working.slice(), limit: data.limit };
  }

  function reconcile() {
    if (['planned', 'sealed', 'broken', 'needsYou'].includes(state)) return;
    if (values.progress.every(n => n >= 100)) {
      preset('sealed');
      return;
    }
    state = values.limit / 100 >= api.WARN_AT || values.working.every(n => n === 0) ? 'stalled' : 'active';
  }

  function shares(counts) {
    const total = counts.reduce((a, b) => a + b, 0);
    const weights = counts.map(n => total ? n / total : 1 / counts.length);
    const floor = api.MIN_WEDGE / 360;
    // The same minimum-angle adjustment used by sealOf in the supplied source.
    for (let pass = 0; pass < 3; pass++) {
      const small = weights.map((n, i) => n <= floor ? i : -1).filter(i => i >= 0);
      const rest = weights.map((n, i) => n > floor ? i : -1).filter(i => i >= 0);
      const have = rest.reduce((sum, i) => sum + weights[i], 0);
      if (!rest.length || !have) break;
      small.forEach(i => { weights[i] = floor; });
      rest.forEach(i => { weights[i] *= (1 - small.length * floor) / have; });
    }
    return weights;
  }

  function data(progress) {
    const counts = COUNCIL.map(member => state === 'planned' ? 0 : member.agents);
    const weights = shares(counts);
    let angle = -90;
    const wedges = COUNCIL.map((member, i) => {
      const start = angle;
      angle += weights[i] * 360;
      return {
        k: member.key,
        share: weights[i],
        progress: (progress || values.progress)[i] / 100,
        live: values.working[i],
        agents: counts[i],
        lead: i === 0,
        blocked: state === 'broken' || (state === 'needsYou' && i === 2),
        asking: state === 'needsYou' && i === 2,
        a0: start,
        a1: angle,
      };
    });
    const burn = values.limit / 100;
    return {
      state, burn,
      warn: burn >= api.WARN_AT || state === 'broken',
      tight: { label: 'Tokens', frac: burn },
      wedges,
      sig: JSON.stringify([state, burn, values.progress, values.working]),
    };
  }

  function draw(progress) {
    const model = data(progress);
    const pitch = view === 'coven' ? 0 : 0.65;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    seal.g.setAttribute('class', `seal csl-render st-${state}${model.warn ? ' warn' : ''}`);
    seal.wedges.forEach((wedge, i) => {
      const x = model.wedges[i];
      wedge.g.setAttribute('class', 'se-w' + (x.live ? ' live' : '') + (x.blocked ? ' blocked' : '') + (x.asking ? ' asking' : '') + (x.lead ? ' lead' : ''));
    });
    api.drawSeal(seal, model, { x: 0, y: 0 }, [0, 0], {
      P: (x, y, z) => [x, y * cp - z * sp, y * sp + z * cp],
      f: n => n.toFixed(2), cp,
      sel: view === 'selected', far: view === 'coven',
      noEase: true, radius: view === 'coven' ? 32 : undefined,
    });
    ui.scene.setAttribute('viewBox', view === 'coven' ? '-47 -43 94 86' : '-55 -47 110 94');
    ui.scene.setAttribute('aria-label', `${COPY[state][0]} mission seal. ${model.wedges.map((w, i) => `${api.fam(w.k).name}: ${w.agents} agents, ${Math.round(values.progress[i])}% target progress`).join('. ')}. Tightest limit ${values.limit}%.`);
  }

  function paint(animate) {
    cancelAnimationFrame(frame);
    frame = 0;
    const target = values.progress.slice();
    if (!animate || api.reduce || !dialog.open || view === 'coven') {
      displayed = target;
      draw(displayed);
      return;
    }
    const from = displayed.slice();
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / 400);
      const eased = 1 - Math.pow(1 - t, 3);
      displayed = target.map((n, i) => from[i] + (n - from[i]) * eased);
      draw(displayed);
      if (t < 1 && dialog.open) frame = requestAnimationFrame(tick);
      else frame = 0;
    }
    frame = requestAnimationFrame(tick);
  }

  function refresh(animate) {
    const frozen = ['planned', 'sealed', 'broken'].includes(state);
    ui.stateButtons.forEach((node, i) => node.setAttribute('aria-pressed', String(ORDER[i] === state)));
    ui.modeButtons.forEach(node => node.setAttribute('aria-pressed', String(node.dataset.mode === view)));
    ui.stateName.textContent = COPY[state][0];
    ui.stateCopy.textContent = COPY[state][1];
    ui.stateCard.dataset.state = state;
    ui.mini.innerHTML = api.sealSvg(data(), 30);
    ui.total.textContent = state === 'planned' ? '3 familiars · no agents yet' : '3 familiars · 23 delegated agents';
    const modeCopy = {
      coven: 'Coven view · flat wedges and signet',
      castle: 'Castle view · progress in relief',
      selected: 'Selected mission · working agents at the edge',
    };
    ui.modeCopy.textContent = modeCopy[view];
    ui.limit.value = values.limit;
    ui.limit.disabled = frozen;
    ui.limitValue.textContent = `${values.limit}%`;
    ui.limitBlock.classList.toggle('is-warning', values.limit / 100 >= api.WARN_AT);
    ui.limitValue.classList.toggle('is-warning', values.limit / 100 >= api.WARN_AT);
    ui.limitFill.style.width = `${values.limit}%`;
    ui.limitNote.textContent = state === 'planned' ? 'No resources used yet.' : state === 'broken' ? 'Limit reached. The mission was kept stopped.' : state === 'sealed' ? 'All targets and deliverables are complete.' : values.limit / 100 >= api.WARN_AT ? `Warning begins at ${Math.round(api.WARN_AT * 100)}%.` : `Coral appears from ${Math.round(api.WARN_AT * 100)}%.`;
    rows.forEach((row, i) => {
      const n = state === 'planned' ? 0 : COUNCIL[i].agents;
      row.count.textContent = `${n} agents`;
      row.progress.value = values.progress[i];
      row.progress.disabled = frozen;
      row.percent.textContent = `${values.progress[i]}%`;
      row.working.textContent = values.working[i];
      row.working.setAttribute('aria-label', `${api.fam(COUNCIL[i].key).name}: ${values.working[i]} of ${n} agents working`);
      row.minus.disabled = frozen || values.working[i] === 0 || (state === 'needsYou' && i === 2);
      row.plus.disabled = frozen || values.working[i] === n || (state === 'needsYou' && i === 2);
      row.range.style.setProperty('--csl-progress', `${values.progress[i]}%`);
    });
    ui.rule.textContent = frozen ? 'Choose another state to explore different values.' : state === 'needsYou' ? 'Echo’s request keeps this mission in Needs you.' : 'Cross 85% to move between Active and Stalled.';
    paint(animate);
  }

  function chooseState(next) {
    preset(next);
    refresh(false);
  }

  function build() {
    dialog = el('dialog', 'csl-dialog');
    dialog.id = 'covenSealLab';
    dialog.setAttribute('aria-labelledby', 'cslTitle');
    dialog.setAttribute('aria-describedby', 'cslSubtitle');
    const header = el('header', 'csl-header');
    const titleBlock = el('div');
    const eyebrow = el('p', 'csl-eyebrow', 'THE VISUAL LANGUAGE');
    const title = el('h2', '', 'Mission seal');
    title.id = 'cslTitle';
    const subtitle = el('p', 'csl-subtitle', 'Explore how one mission tells its story.');
    subtitle.id = 'cslSubtitle';
    titleBlock.append(eyebrow, title, subtitle);
    const close = button('csl-close', '×', () => dialog.close());
    close.setAttribute('aria-label', 'Close mission seal explorer');
    header.append(titleBlock, close);

    const stateNav = el('div', 'csl-states');
    stateNav.setAttribute('role', 'group');
    stateNav.setAttribute('aria-label', 'Preview a mission state');
    ui.stateButtons = ORDER.map(key => {
      const node = button('csl-state-btn', '', () => chooseState(key));
      node.dataset.state = key;
      node.append(el('i', 'csl-state-dot'), el('span', '', COPY[key][0]));
      stateNav.append(node);
      return node;
    });

    const body = el('div', 'csl-body');
    const preview = el('section', 'csl-preview');
    preview.setAttribute('aria-label', 'Mission seal preview');
    const previewHead = el('div', 'csl-preview-head');
    previewHead.append(el('span', 'csl-section-label', 'ILLUSTRATIVE COUNCIL'));
    ui.total = el('span', 'csl-total');
    previewHead.append(ui.total);
    preview.append(previewHead);
    const mode = el('div', 'csl-modes');
    mode.setAttribute('role', 'group');
    mode.setAttribute('aria-label', 'Seal detail level');
    ui.modeButtons = [['coven', 'Coven'], ['castle', 'Castle'], ['selected', 'Selected']].map(([key, label]) => {
      const node = button('', label, () => { view = key; refresh(false); });
      node.dataset.mode = key;
      mode.append(node);
      return node;
    });
    preview.append(mode);
    const sceneWrap = el('div', 'csl-scene-wrap');
    ui.scene = api.svgEl('svg', { class: 'csl-scene', viewBox: '-55 -59 110 94', role: 'img' });
    const guides = api.svgEl('g', { class: 'csl-guides', 'aria-hidden': 'true' }, ui.scene);
    [35, 44, 52].forEach(r => api.svgEl('ellipse', { cx: 0, cy: 5, rx: r, ry: r * 0.58, fill: 'none' }, guides));
    seal = { g: api.svgEl('g', { class: 'seal' }, ui.scene), wedges: [], data: null, built: '' };
    api.buildSeal(seal, data());
    sceneWrap.append(ui.scene);
    preview.append(sceneWrap);
    ui.modeCopy = el('p', 'csl-mode-copy');
    preview.append(ui.modeCopy);
    ui.stateCard = el('div', 'csl-state-card');
    ui.mini = el('div', 'csl-mini');
    const stateText = el('div');
    ui.stateName = el('h3');
    ui.stateName.setAttribute('aria-live', 'polite');
    ui.stateCopy = el('p');
    stateText.append(ui.stateName, ui.stateCopy);
    ui.stateCard.append(ui.mini, stateText);
    preview.append(ui.stateCard);

    const anatomy = el('dl', 'csl-anatomy');
    [['Angle', 'Agents led by each familiar'], ['Height', 'Progress of its owned targets'], ['Rim', 'The tightest resource limit']].forEach(([key, explanation]) => {
      const row = el('div');
      row.append(el('dt', '', key), el('dd', '', explanation));
      anatomy.append(row);
    });
    preview.append(anatomy);

    const controls = el('section', 'csl-controls');
    const councilHead = el('div', 'csl-control-heading');
    councilHead.append(el('h3', '', 'The council'), el('span', '', 'Target progress and working agents'));
    controls.append(councilHead);
    COUNCIL.forEach((member, i) => {
      const f = api.fam(member.key);
      const card = el('div', 'csl-familiar');
      card.style.setProperty('--csl-hue', f.hue || f.color || 'var(--primary)');
      const top = el('div', 'csl-familiar-top');
      const identity = el('div', 'csl-identity');
      const marker = el('span', 'csl-identity-mark', String(i + 1).padStart(2, '0'));
      const who = el('b', '', f.name);
      identity.append(marker, who);
      if (i === 0) identity.append(el('span', 'csl-lead-label', 'Lead'));
      const count = el('span', 'csl-familiar-count');
      top.append(identity, count);
      const fields = el('div', 'csl-familiar-fields');
      const range = el('div', 'csl-range-field');
      const rangeLabel = el('label', 'csl-field-label', 'Owned targets');
      rangeLabel.htmlFor = `cslProgress${i}`;
      const percent = el('output', 'csl-field-value');
      percent.setAttribute('for', `cslProgress${i}`);
      const rangeHeading = el('div', 'csl-range-heading');
      rangeHeading.append(rangeLabel, percent);
      const progress = el('input', 'csl-range');
      Object.assign(progress, { id: `cslProgress${i}`, type: 'range', min: 0, max: 100, step: 1 });
      progress.setAttribute('aria-label', `${f.name} owned-target progress`);
      progress.addEventListener('input', () => { values.progress[i] = clamp(progress.value, 0, 100); reconcile(); refresh(true); });
      range.append(rangeHeading, progress);
      const workingGroup = el('div', 'csl-working-field');
      workingGroup.append(el('span', 'csl-field-label', 'Working'));
      const stepper = el('div', 'csl-stepper');
      const changeWorking = delta => { values.working[i] = clamp(values.working[i] + delta, 0, member.agents); reconcile(); refresh(false); };
      const minus = button('', '−', () => changeWorking(-1));
      minus.setAttribute('aria-label', `Fewer working agents for ${f.name}`);
      const working = el('output');
      const plus = button('', '+', () => changeWorking(1));
      plus.setAttribute('aria-label', `More working agents for ${f.name}`);
      stepper.append(minus, working, plus);
      workingGroup.append(stepper);
      fields.append(range, workingGroup);
      card.append(top, fields);
      controls.append(card);
      rows.push({ count, progress, percent, working, minus, plus, range });
    });
    ui.limitBlock = el('div', 'csl-limit');
    const limitHead = el('div', 'csl-limit-head');
    const limitLabel = el('label', '', 'Tightest limit');
    limitLabel.htmlFor = 'cslLimit';
    ui.limitValue = el('output', 'csl-limit-value');
    ui.limitValue.setAttribute('for', 'cslLimit');
    limitHead.append(limitLabel, ui.limitValue);
    ui.limit = el('input', 'csl-range csl-limit-range');
    Object.assign(ui.limit, { id: 'cslLimit', type: 'range', min: 0, max: 100, step: 1 });
    ui.limit.setAttribute('aria-label', 'Percent of the tightest limit used');
    ui.limit.addEventListener('input', () => { values.limit = clamp(ui.limit.value, 0, 100); reconcile(); refresh(false); });
    const limitTrack = el('div', 'csl-limit-track');
    limitTrack.setAttribute('aria-hidden', 'true');
    ui.limitFill = el('i');
    const threshold = el('b');
    threshold.style.left = `${api.WARN_AT * 100}%`;
    limitTrack.append(ui.limitFill, threshold);
    const axis = el('div', 'csl-limit-axis');
    axis.append(el('span', '', '0%'), el('span', '', '85% warning'), el('span', '', '100%'));
    ui.limitNote = el('p', 'csl-limit-note');
    ui.limitBlock.append(limitHead, ui.limit, limitTrack, axis, ui.limitNote);
    controls.append(ui.limitBlock);
    ui.rule = el('p', 'csl-rule');
    controls.append(ui.rule);
    body.append(preview, controls);

    const footer = el('footer', 'csl-footer');
    const footText = el('div');
    footText.append(el('b', '', 'Local preview'), el('span', '', `Wedges have a ${api.MIN_WEDGE}° minimum. Selected view shows up to 12 working-agent pips per familiar.`));
    const reset = button('csl-reset', 'Reset state', () => chooseState(state));
    footer.append(footText, reset);
    dialog.append(header, stateNav, body, footer);
    document.body.append(dialog);
    // The workspace also handles Escape; native dialog dismissal must stay local.
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') event.stopPropagation();
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      cancelAnimationFrame(frame);
      frame = 0;
      document.body.classList.remove('csl-open');
      if (returnFocus && returnFocus.isConnected) returnFocus.focus();
    });
    refresh(false);
  }

  function mount(renderer) {
    if (dialog) return;
    for (const key of ['svgEl', 'fam', 'sealSvg', 'buildSeal', 'drawSeal']) {
      if (typeof renderer[key] !== 'function') throw new Error(`Mission seal explorer needs renderer.${key}`);
    }
    api = renderer;
    preset('stalled');
    build();
  }

  function open() {
    if (!dialog) return;
    if (dialog.open) return;
    returnFocus = document.activeElement;
    dialog.showModal();
    document.body.classList.add('csl-open');
    refresh(false);
    ui.stateButtons[ORDER.indexOf(state)].focus();
  }

  window.CovenSealLab = Object.freeze({ mount, open });
})();
