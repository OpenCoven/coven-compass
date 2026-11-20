// Regression fixtures execute the Site's actual fold, scene sync, and seal
// render functions. The SVG facade supplies no browser layout or visual proof.
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadSimulationModel } = require('./simulation-model-deps.cjs');
const test = require('node:test');
const atlasLayout = require('../dist/atlas-layout.js');

const source = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8');

function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in the actual Site`);
  for (let end = source.indexOf('\n', start); end !== -1; end = source.indexOf('\n', end + 1)) {
    const candidate = source.slice(start, end).trimEnd();
    try {
      new vm.Script(`(${candidate}\n)`);
      return candidate;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
  throw new Error(`Could not extract ${name}`);
}

class Element {
  getAttribute(key) { return this.attributes[key] ?? null; }
  constructor() {
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.style = { setProperty(key, value) { this[key] = String(value); } };
    const classes = new Set();
    this.classList = {
      toggle(key, value) {
        const next = value === undefined ? !classes.has(key) : !!value;
        if (next) classes.add(key); else classes.delete(key);
        return next;
      },
      add(...keys) { keys.forEach(key => classes.add(key)); },
      remove(...keys) { keys.forEach(key => classes.delete(key)); },
    };
  }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  removeAttribute(key) { delete this.attributes[key]; }
  appendChild(child) {
    child.remove();
    this.children.push(child);
    child.parentNode = this;
    return child;
  }
  remove() {
    if (this.parentNode) {
      const siblings = this.parentNode.children;
      siblings.splice(siblings.indexOf(this), 1);
    }
    this.parentNode = null;
  }
  addEventListener() {}
  set textContent(value) {
    this.children.forEach(child => { child.parentNode = null; });
    this.children = [];
    this.text = String(value);
  }
  get textContent() { return this.text || ''; }
}

function svgEl(_tag, attributes = {}, parent) {
  const element = new Element();
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  if (parent) parent.appendChild(element);
  return element;
}

function world() {
  return { t: -Infinity, missions: new Map(), tasks: new Map(), agents: new Map(),
    asks: new Map(), rounds: new Map(), items: [], stopped: false };
}

function fixture(trace = []) {
  const c = { trace, world: world(), applied: 0, sel: null, fam: null, pick: null,
    layout: { lead: 100, ang: new Map(), seat: new Map([['m1/astra', {x: 120, y: 90, rot: 0, bx: 112, by: 65}]]) } };
  const sc = { missions: new Map(), seats: new Map(), agents: new Map(), colinks: new Map(),
    lines: new Element(), courts: new Element(), sorted: new Element(), glow: new Element(),
    gateL: [], ghosts: [], hl: null, layoutSignature: 'replay-render-fixture' };
  const ghost = { k: 'sample', missions: [], g: new Element(), ox: 100, oy: 100,
    runs: [], plinths: [], faces: [] };
  ghost.aggregate = svgEl('text', {}, ghost.g);
  ghost.more = svgEl('g', {}, ghost.g);
  ghost.moreLabel = svgEl('text', {}, ghost.more);
  const elements = new Map();
  const context = vm.createContext({
    sc, projects: { sample: c }, active: 'sample', cur: () => c, window: {CovenAtlasLayout: atlasLayout},
    // Project layout and density are scene boundaries; actual mission packing,
    // folding, synchronization, seal construction and rendering run below.
    atlasWorldLayout: () => ({signature: sc.layoutSignature}),
    newWorld: world, svgEl, RAD: Math.PI / 180, ZT: 0, ZPL: 6, RUNZ: [],
    plural: (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`,
    fam: key => ({ name: key, hue: '#abcdef', roles: [] }),
    countOf: (w, predicate) => [...w.agents.values()].filter(predicate).length,
    openAsks: w => [...w.asks.values()].filter(q => q.status === 'open'),
    briefState: () => null,
    seatId: (mission, familiar) => `${mission}/${familiar}`,
    missionXY: () => [80, 40],
    pol: (radius, degrees) => [radius * Math.cos(degrees * Math.PI / 180), radius * Math.sin(degrees * Math.PI / 180)],
    unit: (x, y) => { const length = Math.hypot(x, y) || 1; return [x / length, y / length]; },
    ...require('../dist/atlas-presentation.js'),
    clamp: (n, min, max) => Math.min(max, Math.max(min, n)),
    atlasFocusable() {}, sigil: () => '', SIGIL: { mission: '' },
    drawNew() {}, syncCoven() {}, applySel() {}, fxFor() {},
    $: id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
  });
  const constants = source.slice(source.indexOf('const TARGET_ROLES ='), source.indexOf('function sealOf('));
  context.SimModel = loadSimulationModel({ normBrief: () => null, fam: context.fam });
  const names = ['seek', 'sync', 'syncTaskPlane', 'syncTaskTray', 'sealOf', 'buildSeal', 'drawSeal',
    'atlasProjectGhost'];
  new vm.Script(`${constants}\n${names.map(extract).join('\n')}`, {
    filename: 'actual-replay-render-functions.js',
  }).runInContext(context);
  const P = (x, y) => [x, y];
  const f = number => number.toFixed(4);
  function renderActive() {
    context.sync();
    for (const mission of sc.missions.values()) finiteAttributes(mission.seal.g);
  }
  function renderGhost() {
    context.atlasProjectGhost(ghost, P, f, 700 / 784);
    finiteAttributes(ghost.g);
  }
  return { c, sc, ghost, context, renderActive, renderGhost };
}

function finiteAttributes(element) {
  for (const [key, value] of Object.entries(element.attributes)) {
    assert.doesNotMatch(value, /NaN|Infinity/, `${key} has finite geometry`);
  }
  element.children.forEach(finiteAttributes);
}

const opened = { t: 1000, type: 'mission.opened', mission: 'm1', name: 'Opening a mission' };

test('a planned mission renders before its first council seat', () => {
  const { c, sc, context, renderActive } = fixture([opened]);
  context.seek(c, 1000, true);
  assert.equal(c.world.missions.get('m1').seats.length, 0);
  assert.doesNotThrow(renderActive);
  const seal = sc.missions.get('m1').seal;
  assert.equal(seal.wedges.length, 0);
  assert.ok(Number(seal.face.attributes.r) > 0, 'The planned mission has a circular face before any assignments');
});

test('an overview count is available before the mission seats its first familiar', () => {
  const trace = [opened, { t: 73000, type: 'council.seated', mission: 'm1', familiar: 'astra' }];
  const { c, ghost, context, renderGhost } = fixture(trace);
  context.seek(c, 1000, true);
  assert.doesNotThrow(renderGhost);
  assert.equal(ghost.aggregate.textContent, '1');
  context.seek(c, 73000, true);
  assert.doesNotThrow(renderGhost);
  assert.equal(ghost.aggregate.textContent, '1');
});

test('replay renders through mission opening, sparse events, seating, closure, and backward seek', () => {
  const trace = [opened,
    { t: 1500, type: 'you.said', text: 'Review this work.' },
    { t: 3000, type: 'mission.progress', mission: 'm1', tests: 2 },
    { t: 73000, type: 'council.seated', mission: 'm1', familiar: 'astra' },
    { t: 74000, type: 'familiar.report', mission: 'm1', familiar: 'astra', text: 'Review complete.' },
    { t: 75000, type: 'mission.closed', mission: 'm1' },
  ];
  const { c, sc, ghost, context, renderActive, renderGhost } = fixture(trace);
  for (const time of [999, 1000, 1100, 1500, 2000, 3000, 72000, 73000, 74000, 75000, 76000]) {
    context.seek(c, time, true);
    assert.doesNotThrow(renderActive, `Active render at ${time}`);
    assert.doesNotThrow(renderGhost, `Overview render at ${time}`);
    assert.equal(c.world.t, time);
    assert.equal(c.applied, trace.filter(event => event.t <= time).length);
  }
  assert.equal(sc.missions.size, 0, 'Closed mission leaves the active map');
  assert.equal(ghost.aggregate.textContent, '0', 'Closed mission leaves the overview');
  context.seek(c, 1000, true);
  assert.doesNotThrow(renderActive, 'Backward replay recreates a planned mission');
  assert.doesNotThrow(renderGhost, 'Backward replay restores its overview count');
  assert.equal(sc.missions.get('m1').seal.wedges.length, 0);
  assert.equal(ghost.aggregate.textContent, '1');
});
