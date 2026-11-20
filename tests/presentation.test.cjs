// Node unit fixtures, not browser or SVG-layout tests.
// Functions under test are extracted from the actual Site source at run time.
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const test = require('node:test');

const SITE = path.resolve(__dirname, '..');
const BASELINE = '494a08f6bf10c9a0606c82e86821fed8a253f066';
const source = fs.readFileSync(path.join(SITE, 'dist/index.html'), 'utf8');
const baselineMetadata = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/baseline.json'), 'utf8'));
const baseline = fs.readFileSync(path.join(__dirname, 'fixtures', baselineMetadata.file), 'utf8');
assert.equal(baselineMetadata.source_commit, BASELINE, 'The reference fixture must remain pinned');
assert.equal(createHash('sha256').update(baseline).digest('hex'), baselineMetadata.sha256, 'Reference fixture integrity');
const head = baselineMetadata.source_commit;
console.log(`# Node unit fixtures; source: ${SITE}/dist/index.html; comparison baseline: ${head}`);
console.log('# DOM facade only: no browser, layout engine, network, or URL access.');

function extract(text, name) {
  const marker = `function ${name}(`;
  const start = text.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist in actual source`);
  // Ask Node to parse successively complete lines. This handles templates,
  // comments and nested braces without approximating JavaScript tokenization.
  for (let end = text.indexOf('\n', start); end !== -1; end = text.indexOf('\n', end + 1)) {
    const candidate = text.slice(start, end).trimEnd();
    try {
      new vm.Script(`(${candidate}\n)`);
      return candidate;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
  throw new Error(`Could not extract complete function ${name}`);
}

class Element {
  constructor(tag) {
    this.tag = tag;
    this.attributes = {};
    this.children = [];
    this.parent = null;
    this.listeners = {};
    this._text = '';
    this.style = { setProperty(key, value) { this[key] = String(value); } };
    this.classList = {
      contains: token => this.classes().includes(token),
      toggle: (token, force) => {
        const tokens = new Set(this.classes());
        const on = force === undefined ? !tokens.has(token) : !!force;
        if (on) tokens.add(token); else tokens.delete(token);
        this.attributes.class = [...tokens].join(' ');
        return on;
      },
    };
  }
  classes() { return (this.attributes.class || '').split(/\s+/).filter(Boolean); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  appendChild(child) {
    child.remove();
    this.children.push(child);
    child.parent = this;
    return child;
  }
  remove() {
    if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  dispatch(type, extra = {}) {
    const event = { target: this, stopPropagation() {}, preventDefault() {}, ...extra };
    for (const listener of this.listeners[type] || []) listener(event);
  }
  querySelectorAll(selector) {
    assert.equal(selector, '[data-m]', 'The facade supports only the selector this unit uses');
    const found = [];
    const visit = node => {
      for (const child of node.children) {
        if (child.getAttribute('data-m') !== null) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }
  set textContent(value) {
    this.children.forEach(child => { child.parent = null; });
    this.children = [];
    this._text = String(value);
  }
  get textContent() { return this._text; }
}

function svgEl(tag, attributes = {}, parent) {
  const element = new Element(tag);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  if (parent) parent.appendChild(element);
  return element;
}

const pol = (radius, degrees) => [radius * Math.cos(degrees * Math.PI / 180), radius * Math.sin(degrees * Math.PI / 180)];
const normalize = value => JSON.parse(JSON.stringify(value));
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-10, `${message}: ${actual} vs ${expected}`);

function loadFunctions(names, globals, text = source, prelude = '') {
  const context = vm.createContext({ ...globals });
  new vm.Script(prelude + '\n' + names.map(name => extract(text, name)).join('\n'), {
    filename: 'extracted-site-functions.js',
  }).runInContext(context);
  return context;
}

function presentationFixture() {
  const plan = svgEl('svg');
  const missions = new Map([
    ['m1', { id: 'm1', name: 'Research', seats: ['astra', 'cody'] }],
    ['m2', { id: 'm2', name: 'Release', seats: ['echo', 'cody'] }],
  ]);
  const agents = new Map([
    ['a1', { id: 'a1', mission: 'm1', fam: 'astra', state: 'work' }],
    ['a2', { id: 'a2', mission: 'm1', fam: 'cody', state: 'gate' }],
    ['a3', { id: 'a3', mission: 'm2', fam: 'echo', state: 'work' }],
    ['a4', { id: 'a4', mission: 'm2', fam: 'cody', state: 'gate' }],
  ]);
  const asks = new Map([
    ['q1', { id: 'q1', mission: 'm1', gate: 'N', status: 'open' }],
    ['q2', { id: 'q2', mission: 'm2', gate: 'E', status: 'open' }],
  ]);
  const c = { sel: null, fam: null, detail: null, pick: null, composing: false, world: { missions, agents, asks } };
  const sc = { n: 4, hl: null, missions: new Map(), seats: new Map(), agents: new Map(), gateL: [] };
  missions.forEach(M => {
    const g = svgEl('g', { 'data-m': M.id }, plan);
    sc.missions.set(M.id, { g, node: svgEl('g', {}, g), court: svgEl('path', { 'data-m': M.id }, plan) });
    M.seats.forEach(k => {
      const seat = svgEl('g', { 'data-m': M.id, 'data-fam': k }, plan);
      sc.seats.set(`${M.id}:${k}`, { m: M.id, fam: k, g: seat, badge: svgEl('g', {}, seat) });
    });
  });
  agents.forEach(a => {
    const seat = sc.seats.get(`${a.mission}:${a.fam}`);
    sc.agents.set(a.id, {
      id: a.id,
      el: svgEl('g', { 'data-m': a.mission, 'data-fam': a.fam }, a.state === 'gate' ? plan : seat.g),
      ghost: a.state === 'gate' ? svgEl('ellipse', {}, seat.g) : null,
    });
  });
  ['N', 'E', 'S', 'W'].forEach((letter, k) => {
    const text = svgEl('text'); text.textContent = letter;
    sc.gateL.push({ k, t: text, mark: svgEl('g'), count: svgEl('text'), asks: [] });
  });
  const calls = { syncCoven: 0, update: 0, kick: 0 };
  const nearestGateDeclaration = source.match(/^const nearestGate =.*$/m)?.[0];
  assert.ok(nearestGateDeclaration, 'actual nearestGate declaration must exist');
  const context = loadFunctions(['applySel', 'select', 'covHl'], {
    plan, sc, cur: () => c,
    openAsks: w => [...w.asks.values()].filter(q => q.status === 'open'),
    gateAng: (n, k) => -135 + k * 360 / n + 180 / n,
    COMPASS: { N: -90, E: 0, S: 90, W: 180 },
    GATE_NAME: { N: 'north', E: 'east', S: 'south', W: 'west' },
    plural: (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`,
    clearPick: () => { c.pick = null; }, drawNew() {},
    cam: { locked: true }, camT: {}, fitTarget() { return null; },
    syncCoven: () => { calls.syncCoven++; },
    syncLeads() {}, syncInspect() {}, drawLeadCard() {}, drawComposer() {}, drawCrumb() {},
    kick: () => { calls.kick++; },
    document: {activeElement: null}, narrow: {matches: false}, atlasNavigationReady: false,
    atlasScope: 'project', atlasAutoFit: true, atlasFitScene() {}, atlasQueueFit() {},
    atlasWriteRoute() {}, atlasFocusSelection() {},
    window: { CovenAtlas: { update: () => { calls.update++; } } },
  }, source, nearestGateDeclaration);
  return { context, c, sc, plan, calls };
}

test('agents and reserved places are hidden without a selected mission', () => {
  const { context, sc, c, plan } = presentationFixture();
  context.applySel();
  for (const agent of sc.agents.values()) {
    assert.equal(agent.el.style.display, 'none');
    if (agent.ghost) assert.equal(agent.ghost.style.display, 'none');
  }
  c.sel = 'm1'; context.applySel(); c.sel = null; context.applySel();
  assert.equal(plan.classList.contains('atlas-selected'), false);
  for (const agent of sc.agents.values()) assert.equal(agent.el.style.display, 'none');
});

test('selection reveals only that mission’s agents and keeps all pending gate counts reachable', () => {
  const { context, sc, c } = presentationFixture();
  for (const mission of ['m1', 'm2']) {
    c.sel = mission; context.applySel();
    for (const [id, agent] of sc.agents) {
      const expected = c.world.agents.get(id).mission === mission ? '' : 'none';
      assert.equal(agent.el.style.display, expected, `${id} agent visibility`);
      if (agent.ghost) assert.equal(agent.ghost.style.display, expected, `${id} reserved place`);
    }
    assert.deepEqual(sc.gateL.filter(g => g.mark.style.display !== 'none').map(g => g.t.textContent), ['N', 'E']);
  }
});

test('a familiar chip highlights relevant missions and groups within project scope', () => {
  const { context, sc, calls } = presentationFixture();
  context.covHl('astra');
  assert.equal(sc.hl, 'astra');
  assert.equal(sc.missions.get('m1').g.classList.contains('dim'), false);
  assert.equal(sc.missions.get('m2').g.classList.contains('dim'), true);
  for (const seat of sc.seats.values()) assert.equal(seat.g.classList.contains('dim'), seat.fam !== 'astra');
  assert.ok(calls.syncCoven > 0 && calls.update > 0);
  context.covHl(null);
  assert.equal(sc.hl, null);
  for (const seat of sc.seats.values()) assert.equal(seat.g.classList.contains('dim'), false);
});

test('local familiar selection clears a conflicting global filter; a chip replaces local selection', () => {
  const { context, sc, c } = presentationFixture();
  context.covHl('cody');
  context.select('m1', 'astra', 'side');
  assert.equal(sc.hl, null, 'the old chip cannot override the chosen local familiar');
  assert.equal(c.fam, 'astra');
  assert.equal(c.detail, 'side');
  assert.equal(sc.seats.get('m1:astra').g.classList.contains('dim'), false);
  assert.equal(sc.seats.get('m1:cody').g.classList.contains('dim'), true);
  context.covHl('cody');
  assert.equal(c.fam, null, 'chip selection removes the old local familiar selection');
  assert.equal(c.sel, 'm1');
  assert.equal(sc.hl, 'cody');
  assert.equal(sc.seats.get('m1:cody').g.classList.contains('dim'), false);
  assert.equal(sc.seats.get('m1:astra').g.classList.contains('dim'), true);
});

const constants = text => text.slice(text.indexOf('const TARGET_ROLES ='), text.indexOf('function sealOf(')).trim();
const groundZT = text => Number(text.match(/const ZW\s*=\s*[^;]+\bZT\s*=\s*([\d.]+)/)[1]);
const familiars = {
  astra: { name: 'Astra', hue: '#9cc2f2', roles: ['Researcher'] },
  cody: { name: 'Cody', hue: '#e8c99a', roles: ['Hacker'] },
  echo: { name: 'Echo', hue: '#ebaacb', roles: ['Correspondent', 'Reviewer'] },
};
function sealContext(text) {
  return loadFunctions(['sealOf', 'buildSeal', 'drawSeal'], {
    svgEl, RAD: Math.PI / 180, ZT: groundZT(text),
    fam: key => familiars[key],
    countOf: (w, predicate) => [...w.agents.values()].filter(predicate).length,
    openAsks: w => [...w.asks.values()].filter(q => q.status === 'open'),
    briefState: (_w, M) => M.fixtureBrief,
    atlasEaseProgress: (_seal, _key, target) => target,
    sealDepth: require('../dist/atlas-presentation.js').sealDepth,
  }, text, constants(text));
}
function sealFixture(state, counts = [7, 10, 6]) {
  const keys = ['astra', 'cody', 'echo'];
  const planned = state === 'planned';
  const M = {
    id: 'mission', seats: keys, brief: true, spawned: planned ? 0 : counts.reduce((a, b) => a + b, 0),
    paused: state === 'broken' ? 'limit' : null,
    fixtureBrief: {
      floors: [{ k: 'sources', have: 2, need: 4 }, { k: 'tests', have: 4, need: 10 }, { k: 'reviews', have: 3, need: 4 }],
      deliver: [], total: 3, met: state === 'sealed' ? 3 : 0,
      caps: [{ k: 'minutes', label: 'Time', frac: .3 }, { k: 'tokens', label: 'Tokens', frac: state === 'stalled' ? .85 : state === 'broken' ? 1 : .84 }, { k: 'agents', label: 'Agents', frac: 2 }],
    },
  };
  const w = { stopped: false, agents: new Map(), asks: new Map() };
  if (!planned) keys.forEach((fam, i) => {
    for (let n = 0; n < counts[i]; n++) w.agents.set(`${fam}-${n}`, { mission: M.id, fam, state: state === 'broken' ? 'idle' : 'work' });
  });
  if (state === 'needsYou') w.asks.set('q', { mission: M.id, fam: 'echo', status: 'open' });
  return { w, M };
}
function tree(element) {
  return {
    tag: element.tag, attributes: element.attributes, text: element.textContent,
    style: Object.fromEntries(Object.entries(element.style).filter(([, value]) => typeof value !== 'function')),
    children: element.children.map(tree),
  };
}

test('seal state, numeric semantics, and configured bounds match the pinned v2 baseline', () => {
  assert.equal(extract(source, 'sealOf'), extract(baseline, 'sealOf'), 'Model source equality');
  assert.equal(constants(source), constants(baseline), 'target ownership, states, threshold, and wedge limits');
  assert.equal(groundZT(baseline), 30);
  assert.equal(groundZT(source), 0);
  const current = sealContext(source), old = sealContext(baseline);
  for (const state of ['planned', 'active', 'needsYou', 'stalled', 'sealed', 'broken']) {
    const { w, M } = sealFixture(state);
    const d = current.sealOf(w, M);
    assert.deepEqual(normalize(d), normalize(old.sealOf(w, M)), `${state} numerical semantics`);
    assert.equal(d.state, state);
  }
  const { w, M } = sealFixture('active');
  const d = current.sealOf(w, M);
  [7 / 23, 10 / 23, 6 / 23].forEach((share, i) => near(d.wedges[i].share, share, 'agent share'));
  [.5, .4, .75].forEach((progress, i) => near(d.wedges[i].progress, progress, 'role-owned progress'));
  assert.equal(d.burn, .84, 'agent cap is excluded from the resource rim');
  assert.equal(d.warn, false);
  const edge = sealFixture('active', [1000, 1, 0]);
  const small = current.sealOf(edge.w, edge.M);
  near(small.wedges[1].share * 360, 12, 'minimum Cody wedge');
  near(small.wedges[2].share * 360, 12, 'minimum Echo wedge');
});

test('rendered seals keep the same base for every Project state and selected tier', () => {
  const context = sealContext(source);
  const cp = Math.cos(.65), sp = Math.sin(.65);
  let projectBase;
  for (const state of ['planned', 'active', 'needsYou', 'stalled', 'sealed', 'broken']) {
    const fixture = sealFixture(state, [17, 2, 1]);
    const data = context.sealOf(fixture.w, fixture.M);
    for (const tier of ['coven', 'project', 'selected']) {
      const se = {g: svgEl('g')};
      context.buildSeal(se, data);
      const bounds = context.drawSeal(se, data, {x: 0, y: 0}, [0, 0], {
        P: (x, y, z) => [x, y * cp - z * sp, y * sp + z * cp],
        f: n => n.toFixed(5), cp, far: tier === 'coven', sel: tier === 'selected', noEase: true,
      });
      assert(bounds.every(Number.isFinite));
      assert.doesNotMatch(JSON.stringify(tree(se.g)), /NaN|Infinity/);
      assert(se.baseTop.getAttribute('d'));
      assert(se.selection.getAttribute('d'));
      if (tier === 'coven') assert.equal(se.baseWall.getAttribute('d'), '');
      else {
        projectBase ??= se.baseWall.getAttribute('d');
        assert(projectBase);
        assert.equal(se.baseWall.getAttribute('d'), projectBase, 'Only the wedge height varies with progress.');
      }
      if (tier !== 'selected') assert.equal(se.pipEls.length, 0);
      else if (!['planned', 'broken'].includes(state)) assert.equal(se.pipEls.length, 15);
    }
  }
});
