/* Seal Lab previews the same mission seal renderer used on the map. */
(() => {
  'use strict';

  const MISSION_NAME = 'Config refactor';
  const ORDER = ['planned', 'active', 'needsYou', 'stalled', 'sealed', 'broken'];
  const COUNCIL = [
    { key: 'astra', agents: 7 },
    { key: 'cody', agents: 10 },
    { key: 'echo', agents: 6 },
    { key: 'charm', agents: 4 },
  ];
  const COPY = {
    planned: ['Planned', 'The dashed outline marks a new mission. Before assignment, council members have equal segments.'],
    active: ['Active', 'The solid outline marks an active mission. Bright arcs show progress on each familiar’s targets.'],
    needsYou: ['Needs you', 'A double pale outline marks an Inbox request.'],
    stalled: ['Stalled', 'The broken outline marks a pause in work.'],
    sealed: ['Sealed', 'The green outline and dotted inner ring mark completion. Every target arc is full.'],
    broken: ['Broken', 'The alternating short and long dashes mark a mission stopped at a limit.'],
  };
  const PRESETS = {
    planned: { progress: [0, 0, 0, 0], working: [0, 0, 0, 0], limit: 0 },
    active: { progress: [48, 82, 30, 25], working: [5, 8, 3, 2], limit: 57 },
    needsYou: { progress: [62, 92, 50, 40], working: [5, 8, 0, 2], limit: 72 },
    stalled: { progress: [62, 92, 50, 40], working: [5, 8, 3, 2], limit: 87 },
    sealed: { progress: [100, 100, 100, 100], working: [0, 0, 0, 0], limit: 72 },
    broken: { progress: [62, 92, 50, 40], working: [0, 0, 0, 0], limit: 100 },
  };
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(+n) ? +n : lo));
  let api = null;
  let dialog = null;
  let returnFocus = null;
  let state = 'active';
  let memberIndex = 0, familiarView = false;
  let values = null;
  let seal = null;
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

  function data() {
    const counts = COUNCIL.map(member => state === 'planned' ? 0 : member.agents);
    const total = counts.reduce((sum, count) => sum + count, 0);
    let angle = -90;
    const wedges = COUNCIL.map((member, i) => {
      const start = angle;
      const share = total ? counts[i] / total : 1 / counts.length;
      angle += share * 360;
      return {
        k: member.key,
        progress: values.progress[i] / 100,
        live: values.working[i],
        agents: counts[i],
        asking: state === 'needsYou' && member.key === 'echo',
        blocked: state === 'broken' && counts[i] > 0,
        a0: start,
        a1: angle,
      };
    });
    const burn = values.limit / 100;
    return {
      state, burn,
      warn: burn >= api.WARN_AT || state === 'broken',
      wedges,
    };
  }

  function refresh() {
    const specimen = data(), member = COUNCIL[memberIndex], identity = api.fam(member.key);
    const facts = specimen.wedges[memberIndex];
    const description = api.drawFamiliarRings(ui.rings, facts);
    ui.face.style.setProperty('--hue', identity.hue);
    if (ui.glyph.dataset.key !== member.key) {
      ui.glyph.innerHTML = api.sigil(member.key);
      ui.glyph.dataset.key = member.key;
    }
    ui.face.style.display = familiarView ? '' : 'none';
    ui.scene.style.display = familiarView ? 'none' : '';
    ui.face.setAttribute('aria-label', identity.name + '. ' + description + '. ' + facts.live + ' of ' + facts.agents + ' agents working.');
    dialog.dataset.view = familiarView ? 'familiar' : 'mission';
    ui.caption.textContent = familiarView ? identity.name : MISSION_NAME;
    ui.missionKey.hidden = familiarView;
    ui.familiarKey.hidden = !familiarView;
    ui.limitBlock.hidden = familiarView;
    ui.views.forEach((btn, i) => btn.setAttribute('aria-pressed', String(Boolean(i) === familiarView)));
    ui.members.forEach((btn, i) => btn.setAttribute('aria-pressed', String(i === memberIndex)));
    const warning = values.limit / 100 >= api.WARN_AT;
    const frozen = ['planned', 'sealed', 'broken'].includes(state);
    ui.stateButtons.forEach((node, i) => node.setAttribute('aria-pressed', String(ORDER[i] === state)));
    const stateName = familiarView ? description : COPY[state][0];
    const stateCopy = familiarView ? facts.live + ' of ' + facts.agents + ' assigned agents working on ' + MISSION_NAME + '.' : state === 'stalled' && warning
      ? 'The coral arc shows how much of the token limit is used.'
      : COPY[state][1];
    if (ui.stateName.textContent !== stateName) ui.stateName.textContent = stateName;
    if (ui.stateCopy.textContent !== stateCopy) ui.stateCopy.textContent = stateCopy;
    ui.stateCard.dataset.state = state;
    const council = COUNCIL.map((member, i) => {
      const assigned = state === 'planned' ? 0 : member.agents;
      return `${api.fam(member.key).name}, ${assigned} assigned, ${values.working[i]} working, ${values.progress[i]}% target progress`;
    });
    ui.scene.setAttribute('aria-label', [`${MISSION_NAME}. Mission state ${COPY[state][0]}`, ...council, `${values.limit}% of token limit used`].join('. '));
    ui.limit.value = values.limit;
    ui.limit.disabled = frozen;
    ui.limitValue.textContent = `${values.limit}%`;
    ui.limitBlock.classList.toggle('is-warning', warning);
    ui.limit.style.setProperty('--csl-progress', String(values.limit / 100));
    const threshold = Math.round(api.WARN_AT * 100);
    ui.limitNote.textContent = frozen
      ? 'Preview values are fixed in this state.'
      : state === 'needsYou'
        ? 'Echo’s Inbox request keeps the mission in Needs you.'
        : `Stalls at ${threshold}% or when no agents are working.`;
    rows.forEach((row, i) => {
      row.card.hidden = i !== memberIndex;
      const n = state === 'planned' ? 0 : COUNCIL[i].agents;
      row.count.textContent = `${n} assigned`;
      row.progress.value = values.progress[i];
      row.progress.disabled = frozen;
      row.percent.textContent = `${values.progress[i]}%`;
      row.working.textContent = values.working[i];
      row.working.setAttribute('aria-label', `${api.fam(COUNCIL[i].key).name}: ${values.working[i]} of ${n} agents working`);
      row.minus.disabled = frozen || values.working[i] === 0 || (state === 'needsYou' && i === 2);
      row.plus.disabled = frozen || values.working[i] === n || (state === 'needsYou' && i === 2);
      row.progress.style.setProperty('--csl-progress', String(values.progress[i] / 100));
    });
    api.drawSeal(seal, specimen);
  }

  function chooseState(next) {
    preset(next);
    if (familiarView && next === 'needsYou') memberIndex = COUNCIL.findIndex(m => m.key === 'echo');
    refresh();
  }

  function build() {
    dialog = el('dialog', 'csl-dialog');
    dialog.id = 'covenSealLab';
    dialog.setAttribute('aria-labelledby', 'cslTitle');
    dialog.setAttribute('aria-describedby', 'cslSubtitle');
    const header = el('header', 'csl-header');
    const titleBlock = el('div');
    const title = el('h2', '', 'Seal lab');
    title.id = 'cslTitle';
    const subtitle = el('p', 'csl-subtitle', 'Mission progress and familiar activity.');
    subtitle.id = 'cslSubtitle';
    titleBlock.append(title, subtitle);
    const close = button('csl-close', '×', () => dialog.close());
    close.setAttribute('aria-label', 'Close Seal lab');
    header.append(titleBlock, close);

    const views = el('div', 'csl-views');
    views.setAttribute('role', 'group');
    views.setAttribute('aria-label', 'Preview symbol');
    ui.views = ['Mission seal', 'Familiar rings'].map((name, i) => {
      const btn = button('', name, () => { familiarView = Boolean(i); refresh(); });
      views.append(btn);
      return btn;
    });
    const stateNav = el('div', 'csl-states');
    stateNav.setAttribute('role', 'group');
    stateNav.setAttribute('aria-labelledby', 'cslStatesLabel');
    const stateLabel = el('span', '', 'Mission state');
    stateLabel.id = 'cslStatesLabel';
    const stateOptions = el('div', 'csl-state-options');
    stateNav.append(stateLabel, stateOptions);
    ui.stateButtons = ORDER.map(key => {
      const node = button('csl-state-btn', '', () => chooseState(key));
      node.dataset.state = key;
      const mark = el('i', 'csl-state-mark');
      mark.setAttribute('aria-hidden', 'true');
      node.append(mark, el('span', '', COPY[key][0]));
      stateOptions.append(node);
      return node;
    });

    const body = el('div', 'csl-body');
    const preview = el('section', 'csl-preview');
    preview.setAttribute('aria-label', 'Mission seal preview');
    const specimen = el('figure', 'csl-specimen');
    ui.scene = api.svgEl('svg', { class: 'csl-scene', viewBox: '-50 -50 100 100', role: 'img' });
    seal = { g: api.svgEl('g', {}, ui.scene) };
    api.buildSeal(seal, data());
    ui.face = api.svgEl('svg', {class: 'csl-scene csl-face', viewBox: '-27 -27 54 54', role: 'img'});
    api.svgEl('circle', {r: 20, class: 'csl-face-base'}, ui.face);
    ui.rings = api.buildFamiliarRings(ui.face);
    ui.glyph = api.svgEl('g', {class: 'csl-face-glyph', transform: 'scale(1.25)'}, ui.face);
    ui.caption = el('figcaption', 'csl-mission-name');
    specimen.append(ui.scene, ui.face, ui.caption);
    preview.append(specimen);

    ui.stateCard = el('div', 'csl-state-card');
    ui.stateCard.setAttribute('aria-live', 'polite');
    ui.stateCard.setAttribute('aria-atomic', 'true');
    ui.stateName = el('h3');
    ui.stateCopy = el('p');
    ui.stateCard.append(ui.stateName, ui.stateCopy);
    preview.append(ui.stateCard);

    const anatomy = el('dl', 'csl-anatomy');
    [
      ['Colored slice', 'Share of assigned agents'],
      ['Bright arc', 'Progress on owned targets'],
      ['Outline', 'Mission state'],
      ['Coral arc', 'Resource limit warning'],
    ].forEach(([term, meaning]) => {
      const row = el('div');
      row.append(el('dt', '', term), el('dd', '', meaning));
      anatomy.append(row);
    });
    ui.missionKey = anatomy;
    ui.familiarKey = el('dl', 'csl-anatomy');
    for (const [term, meaning] of [['Inner arc', 'Target progress, clockwise from the top'], ['Glyph and hue', 'Identify the familiar in every state'], ['Outer rim', 'Solid while working, dotted when idle, faint dashes when unassigned'], ['Attention', 'Coral dashes mean blocked. Paired pale marks mean a request needs you.']]) {
      const row = el('div');
      row.append(el('dt', '', term), el('dd', '', meaning));
      ui.familiarKey.append(row);
    }
    preview.append(anatomy, ui.familiarKey);

    const controls = el('section', 'csl-controls');
    controls.setAttribute('aria-labelledby', 'cslCouncilTitle');
    const councilHead = el('div', 'csl-control-heading');
    const councilTitle = el('h3', '', 'Council member');
    councilTitle.id = 'cslCouncilTitle';
    const reset = button('csl-reset', 'Reset values', () => chooseState(state));
    councilHead.append(councilTitle, reset);
    controls.append(councilHead);
    const picker = el('div', 'csl-members');
    picker.setAttribute('role', 'group');
    picker.setAttribute('aria-labelledby', councilTitle.id);
    ui.members = COUNCIL.map((member, i) => {
      const identity = api.fam(member.key);
      const btn = button('', identity.name, () => { memberIndex = i; refresh(); });
      btn.style.setProperty('--csl-hue', identity.hue);
      picker.append(btn);
      return btn;
    });
    controls.append(picker);
    COUNCIL.forEach((member, i) => {
      const f = api.fam(member.key);
      const card = el('div', 'csl-familiar');
      card.style.setProperty('--csl-hue', f.hue || f.color || 'var(--primary)');
      const top = el('div', 'csl-familiar-top');
      const identity = el('div', 'csl-identity');
      const marker = el('span', 'csl-identity-mark');
      marker.setAttribute('aria-hidden', 'true');
      const glyph = api.svgEl('svg', { viewBox: '-10 -10 20 20' }, marker);
      if (typeof api.sigil === 'function') glyph.innerHTML = api.sigil(member.key);
      else api.svgEl('circle', { r: 3, fill: 'currentColor' }, glyph);
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
      progress.addEventListener('input', () => { values.progress[i] = clamp(progress.value, 0, 100); reconcile(); refresh(); });
      range.append(rangeHeading, progress);
      const workingGroup = el('div', 'csl-working-field');
      workingGroup.append(el('span', 'csl-field-label', 'Working'));
      const stepper = el('div', 'csl-stepper');
      const changeWorking = delta => { values.working[i] = clamp(values.working[i] + delta, 0, member.agents); reconcile(); refresh(); };
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
      rows.push({ card, count, progress, percent, working, minus, plus });
    });
    ui.limitBlock = el('div', 'csl-limit');
    const limitHead = el('div', 'csl-limit-head');
    const limitLabel = el('label', '', 'Tightest limit');
    limitLabel.append(el('span', '', 'Tokens'));
    limitLabel.htmlFor = 'cslLimit';
    ui.limitValue = el('output', 'csl-limit-value');
    ui.limitValue.setAttribute('for', 'cslLimit');
    limitHead.append(limitLabel, ui.limitValue);
    ui.limit = el('input', 'csl-range csl-limit-range');
    Object.assign(ui.limit, { id: 'cslLimit', type: 'range', min: 0, max: 100, step: 1 });
    ui.limit.setAttribute('aria-label', 'Percent of token limit used');
    ui.limit.addEventListener('input', () => { values.limit = clamp(ui.limit.value, 0, 100); reconcile(); refresh(); });
    const limitScale = el('div', 'csl-limit-scale');
    limitScale.style.setProperty('--csl-warning-point', String(api.WARN_AT));
    limitScale.append(ui.limit);
    ui.limitNote = el('p', 'csl-limit-note');
    ui.limitNote.id = 'cslLimitNote';
    ui.limit.setAttribute('aria-describedby', ui.limitNote.id);
    ui.limitBlock.append(limitHead, limitScale, ui.limitNote);
    controls.append(ui.limitBlock);
    body.append(preview, controls);
    dialog.append(header, views, stateNav, body);
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
      document.body.classList.remove('csl-open');
      if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
      returnFocus = null;
    });
    refresh();
  }

  function mount(renderer) {
    if (dialog) return;
    for (const key of ['svgEl', 'fam', 'sigil', 'buildSeal', 'drawSeal', 'buildFamiliarRings', 'drawFamiliarRings']) {
      if (typeof renderer[key] !== 'function') throw new Error(`Mission seal explorer needs renderer.${key}`);
    }
    api = renderer;
    preset('active');
    build();
  }

  function open(invoker) {
    if (!dialog) return;
    if (dialog.open) return;
    returnFocus = invoker || document.activeElement;
    dialog.showModal();
    document.body.classList.add('csl-open');
    refresh();
    dialog.scrollTop = 0;
    ui.stateButtons[ORDER.indexOf(state)].focus({ preventScroll: true });
  }

  window.CovenSealLab = Object.freeze({ mount, open });
})();
