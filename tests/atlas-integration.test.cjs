'use strict';

// Source-extracted Node integration fixtures. The DOM below supplies specified
// rectangles and event listeners; it is not a browser, layout engine, screenshot
// check, performance benchmark, or proof of native mobile gesture behavior.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadSimulationModel } = require('./simulation-model-deps.cjs');
const test = require('node:test');
const layout = require('../dist/atlas-layout.js');
const viewport = require('../dist/atlas-viewport.js');
const navigation = require('../dist/mission-navigation.js');
const source = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
const EPS = 1e-7;
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < EPS, `${message}: ${actual} vs ${expected}`);
const plain = value => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function extract(name) {
  let start = source.indexOf(`function ${name}(`);
  if (source.slice(start - 6, start) === 'async ') start -= 6;
  assert.notEqual(start, -1, `${name} must exist in the actual Site source`);
  for (let end = source.indexOf('\n', start); end !== -1; end = source.indexOf('\n', end + 1)) {
    const candidate = source.slice(start, end).trimEnd();
    try { new vm.Script(`(${candidate}\n)`); return candidate; }
    catch (error) { if (!(error instanceof SyntaxError)) throw error; }
  }
  throw new Error(`Cannot extract ${name}`);
}

function load(names, globals = {}, prelude = '') {
  const context = vm.createContext({...globals});
  new vm.Script(`${prelude}\n${names.map(extract).join('\n')}`, {
    filename: 'actual-site-atlas-integration.js',
  }).runInContext(context);
  return context;
}

class Element {
  constructor(tag = 'g') {
    this.tag = tag; this.attributes = {}; this.children = []; this.parent = null;
    this.listeners = {}; this.style = {setProperty(key, value) { this[key] = value; }}; this.hidden = false; this._text = '';
  }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  appendChild(child) { child.remove(); this.children.push(child); child.parent = this; return child; }
  insertBefore(child, next) {
    if (!next) return this.appendChild(child);
    child.remove();
    this.children.splice(this.children.indexOf(next), 0, child); child.parent = this; return child;
  }
  remove() {
    if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
  addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
  dispatch(type, extra = {}) {
    const event = {target: this, preventDefault() {}, stopPropagation() {}, ...extra};
    (this.listeners[type] || []).forEach(handler => handler(event));
  }
  set textContent(value) {
    this.children.forEach(child => { child.parent = null; });
    this.children = []; this._text = String(value);
  }
  get textContent() { return this._text; }
}

function svgEl(tag, attributes = {}, parent) {
  const el = new Element(tag);
  Object.entries(attributes).forEach(([key, value]) => el.setAttribute(key, value));
  if (parent) parent.appendChild(el);
  return el;
}

function scopeFixture() {
  const first = {id: 'same/id', name: 'Sources', seats: ['astra']};
  const second = {id: 'same/id', name: 'Release', seats: ['echo']};
  const worlds = [
    {missions: new Map([[first.id, first]]), agents: new Map([
      ['a1', {mission: first.id, fam: 'astra'}], ['a2', {mission: first.id, fam: 'astra'}],
    ]), asks: [{status: 'open', mission: first.id}]},
    {missions: new Map([[second.id, second]]), agents: new Map([
      ['a3', {mission: second.id, fam: 'echo'}],
    ]), asks: [{status: 'open', mission: second.id}, {status: 'closed', mission: second.id}]},
  ];
  const projects = {
    'a / project': {world: worlds[0], sel: null, fam: null, detail: null},
    other: {world: worlds[1], sel: null, fam: null, detail: null},
  };
  const families = {astra: {name: 'Astra', hue: '#aabbcc'}, echo: {name: 'Echo', hue: '#ccaabb'}};
  const location = {hash: ''}, writes = [];
  const history = Object.fromEntries(['pushState', 'replaceState'].map(kind => [kind, (state, title, hash) => {
    writes.push({kind, state, title, hash}); location.hash = hash;
  }]));
  let context;
  context = load(['atlasSnapshot', 'atlasWriteRoute'], {
    projects, active: 'a / project', cur: () => projects[context.active],
    FAM: families, fam: key => families[key], avatar: key => `<svg data-family="${key}"></svg>`,
    openAsks: world => world.asks.filter(ask => ask.status === 'open'),
    countOf: (world, predicate) => [...world.agents.values()].filter(predicate).length,
    sealOf: () => ({state: 'planned'}), SEAL_STATE: {planned: ['Planned']}, sealSvg: () => '<svg></svg>',
    $: () => null, sc: {hl: null, g: 1}, cam: {zoom: 1, locked: false}, camT: {zoom: 1},
    atlasScope: 'coven', panelView: 'agents',
    atlasNavigationReady: true, atlasRestoringRoute: false, atlasLastRoute: null,
    window: {CovenMissionNavigation: navigation}, history, location,
  });
  return {context, projects, writes, location};
}

test('actual snapshot and hash writer keep explicit scope at extreme and mismatched zoom', () => {
  const {context, projects, writes, location} = scopeFixture();
  const project = projects['a / project'];
  for (const [scope, selection, expected] of [
    ['coven', null, 'coven'], ['coven', 'same/id', 'coven'],
    ['project', null, 'project'], ['project', 'same/id', 'mission'], ['project', 'removed', 'project'],
  ]) for (const zoom of [0.00001, 0.03, 1, 6]) {
    context.atlasScope = scope; project.sel = selection; project.fam = 'astra'; project.detail = 'side';
    context.camT.zoom = zoom; context.cam.zoom = 6.00001 - zoom; context.sc.g = zoom * 17;
    location.hash = '#force-a-new-write';
    const snapshot = context.atlasSnapshot(true);
    context.atlasWriteRoute();
    const route = navigation.parse(writes.at(-1).hash);
    assert.equal(snapshot.scope, expected, `${scope}/${selection}/${zoom} snapshot`);
    assert.equal(route.scope, expected, `${scope}/${selection}/${zoom} hash`);
    assert.equal(snapshot.missions, 2); assert.equal(snapshot.agents, 3); assert.equal(snapshot.needs, 2);
    assert.equal(snapshot.missionItems.length, 2, 'the mission browser keeps full project-qualified records');
    assert.deepEqual(Array.from(snapshot.missionItems, item => [item.project, item.id]), [
      ['a / project', 'same/id'], ['other', 'same/id'],
    ]);
    if (expected === 'mission') {
      assert.equal(route.project, snapshot.active); assert.equal(route.mission, snapshot.missionId);
      assert.equal(route.familiar, 'astra'); assert.equal(route.view, 'agents'); assert.equal(route.detail, 'side');
    }
  }
  context.active = 'other'; projects.other.sel = 'same/id'; context.atlasScope = 'project';
  context.atlasWriteRoute(true);
  assert.equal(writes.at(-1).kind, 'replaceState');
  assert.equal(navigation.parse(location.hash).project, 'other', 'equal mission ids remain Project-qualified');
  const n = writes.length;
  context.atlasWriteRoute(); assert.equal(writes.length, n, 'identical routes do not grow browser history');
  context.atlasRestoringRoute = true; context.atlasScope = 'coven'; context.atlasWriteRoute();
  assert.equal(writes.length, n, 'Back/Forward restoration does not push another route');
});

test('overview keeps an exact accessible mission total across preview densities', () => {
  const world = {missions: new Map(), agents: new Map()};
  const gh = {k: 'demo', g: svgEl('g'), ox: 0, oy: 0};
  const aggregate = gh.aggregate = svgEl('text', {}, gh.g);
  const cam = {zoom: 1};
  const context = load(['atlasProjectGhost'], {
    projects: {demo: {world}}, stage: {clientWidth: 1000, clientHeight: 700}, cam,
    ZPL: 14, ZT: 0, clamp, openAsks: () => [],
    detailVisible: require('../dist/atlas-presentation.js').detailVisible,
    plural: (n, noun) => n + ' ' + noun + (n === 1 ? '' : 's'),
  });
  const project = () => context.atlasProjectGhost(gh, (x, y, z) => [x, y, z], n => n.toFixed(2));
  for (const count of [...Array.from({length: 129}, (_, i) => i), 2, 0, 128]) {
    world.missions = new Map(Array.from({length: count}, (_, i) => [i, {}]));
    for (const [zoom, density] of [[1, 'full'], [0.04, 'tiny']]) {
      cam.zoom = zoom; project();
      assert.equal(gh.density, density);
      assert.equal(aggregate.textContent, String(count));
      assert.equal(gh.g.getAttribute('aria-label'), `demo, ${count} mission${count === 1 ? '' : 's'}, 0 agents. Open project`);
      assert.deepEqual(gh.g.children, [aggregate], 'density changes reuse the single count element');
    }
  }
});

test('miniatures retain Project-scoped mission, council and task identities as replay changes', () => {
  const fam = k => ({name: k, hue: k === 'astra' ? '#9cc2f2' : '#e8c99a', roles: []});
  const fixture = load(['createProjectPreview', 'syncProjectPreview', 'updateVisibleProjectPreviews', 'sealOf', 'buildSeal', 'drawSeal'], {
    window: {CovenAtlasLayout: layout}, svgEl, fam, MAX_WEDGES: 8, MIN_WEDGE: 12, WARN_AT: .85,
    pol: (r, a) => [r * Math.cos(a * Math.PI / 180), r * Math.sin(a * Math.PI / 180)],
    countOf: (w, pred) => [...w.agents.values()].filter(pred).length, openAsks: w => [...w.asks.values()],
  });
  const world = {missions: new Map(), tasks: new Map(), agents: new Map(), asks: new Map(), t: 0};
  const project = {world, applied: 0, layout: {n: 4, ang: new Map([['m1', -135]])}};
  const gh = {g: svgEl('g'), ox: 21, oy: -15};
  const preview = fixture.createProjectPreview(gh);
  const sync = () => { project.applied++; fixture.syncProjectPreview(preview, project); };
  sync();
  assert.equal(preview.graph.style.display, 'none');
  assert.equal(preview.empty.style.display, '');
  const M = {id: 'm1', name: 'Source survey', seats: ['astra', 'cody'], spawned: 1};
  world.missions.set(M.id, M);
  world.agents.set('a1', {mission: 'm1', fam: 'astra', state: 'work'});
  world.tasks.set('t1', {mission: 'm1', leads: ['astra']});
  sync();
  const item = preview.missions.get('m1');
  assert.equal(item.fullName, M.name);
  assert.equal(item.seal.g.getAttribute('class'), 'seal st-active');
  assert.equal(item.node.getAttribute('data-preview-mission'), 'm1');
  assert.deepEqual([...item.members.keys()], ['astra', 'cody']);
  const astra = item.members.get('astra');
  assert.equal(astra.task.style.display, '');
  assert.equal(item.members.get('cody').task.style.display, 'none');
  world.asks.set('gate', {mission: 'm1', fam: 'cody'});
  M.name = 'Renamed';
  world.tasks.get('t1').leads.push('cody');
  sync();
  assert.equal(preview.missions.get('m1'), item);
  assert.equal(item.members.get('astra'), astra);
  assert.equal(item.seal.g.getAttribute('class'), 'seal st-needsYou');
  assert.equal(item.fullName, M.name);
  assert.equal(item.members.get('cody').task.style.display, '');
  project.layout.n = 128;
  for (let i = 2; i <= 128; i++) world.missions.set('m' + i, {id: 'm' + i, name: 'Mission ' + i, seats: [], spawned: 0});
  sync();
  assert.equal(preview.missions.size, 8);
  assert.equal(preview.moreLabel.textContent, '+120');
  assert.equal(preview.more.style.display, '');
  assert.equal(preview.links.children.length, 8);
  assert.equal(preview.nodes.children.length, 8);
  world.missions.delete('m1');
  sync();
  assert.equal(item.node.parent, null);
  assert.equal(item.link.parent, null);
  assert.ok(preview.missions.has('m9'));
  assert.equal(preview.moreLabel.textContent, '+119');
  fixture.projects = {demo: project};
  gh.k = 'demo'; gh.preview = preview;
  const camera = {px: 0, py: 0};
  const update = scale => fixture.updateVisibleProjectPreviews([gh], camera, scale, 320, 200);
  update(.15);
  assert.equal(gh.preview.missions.get('m2'), preview.missions.get('m2'));
  const detailed = gh.preview.missions.get('m2');
  update(.05);
  assert.equal(gh.preview.missions.get('m2'), detailed);
  assert.deepEqual(detailed.node.children.map(el => el.getAttribute('class')), ['preview-compact-ring']);
  update(.15);
  assert.equal(gh.preview.missions.get('m2'), detailed);
  assert.ok(detailed.seal.g.children.length > 1);
  camera.px = 5000;
  update(.15);
  assert.equal(gh.preview, null);
  assert.equal(preview.group.parent, null);
  camera.px = 0;
  update(.01);
  assert.equal(gh.preview, null, 'count-only tiles allocate no miniature');
  update(.15);
  assert.equal(gh.preview.missions.size, 8);
  assert.equal(gh.preview.moreLabel.textContent, '+119');
});

function rectangle(left, top, width, height) { return {left, top, width, height, right: left + width, bottom: top + height}; }
function measuredElement(rect, hidden = false) {
  return {rect, hidden, laidOut: true, computedStyle: {display: 'block', visibility: 'visible'}, getBoundingClientRect() { return this.rect; },
    getClientRects() { return this.laidOut ? [this.rect] : []; }};
}

function frameFixture(width = 1000, height = 700) {
  const left = 100, top = 200, stage = measuredElement(rectangle(left, top, width, height));
  stage.clientWidth = width; stage.clientHeight = height;
  const box = (x, y, w, h, hidden) => measuredElement(rectangle(left + x, top + y, w, h), hidden);
  const elements = {
    atlasHeader: box(16, 14, width - 32, 44),
    atlasFamiliars: box(16, height - 80, width - 32, 60),
    atlasCameraDock: box(Math.max(16, width - 480), height - 152, Math.min(width - 32, 464), 62),
    inspect: box(12, 80, 308, height - 180, true),
  };
  const queries = {'#notes .manifest': box(12, 70, 344, height - 230, true), '#notes > .hud': box(80, 70, 240, 90, true)};
  const globals = {stage, $: id => elements[id] || null,
    document: {body: {classList: {contains: () => false}}, querySelector: selector => queries[selector] || null},
    window: {CovenAtlasViewport: viewport, CovenAtlasLayout: layout, getComputedStyle: element => element.computedStyle}};
  return {stage, elements, queries, globals, box};
}

test('actual viewport measurement reserves visible header, chips, dock, manifest, HUD and inspector', () => {
  const f = frameFixture(), context = load(['atlasViewportFrame'], f.globals);
  assert.deepEqual(plain(context.atlasViewportFrame(false)), {x: 28, y: 86, width: 944, height: 434, cx: 500, cy: 303});
  f.queries['#notes .manifest'].hidden = false;
  assert.deepEqual(plain(context.atlasViewportFrame(true)), {x: 384, y: 86, width: 588, height: 434, cx: 678, cy: 303});
  f.elements.inspect.hidden = false;
  f.queries['#notes .manifest'] = f.box(644, 70, 344, 470, false);
  assert.deepEqual(plain(context.atlasViewportFrame(true)), {x: 348, y: 86, width: 268, height: 434, cx: 482, cy: 303});
  f.queries['#notes > .hud'].hidden = false;
  assert.equal(context.atlasViewportFrame(true).y, 188, 'the measured HUD lower edge is reserved');
  f.elements.atlasCameraDock.hidden = true;
  assert.equal(context.atlasViewportFrame(false).height, 506, 'hidden dock releases its reservation');
  f.elements.atlasHeader.rect = rectangle(-1000, -1000, 40, 20);
  assert.equal(context.atlasViewportFrame(false).y, 28, 'offstage elements do not reserve space');
  f.elements.atlasFamiliars.laidOut = false;
  assert.equal(context.atlasViewportFrame(false).height, 644, 'elements with no layout rectangles are ignored');
  const mobile = frameFixture(390, 844), narrow = load(['atlasViewportFrame'], mobile.globals);
  mobile.elements.inspect = mobile.box(12, 520, 366, 312, false);
  const mobileFrame = narrow.atlasViewportFrame(true);
  assert.equal(mobileFrame.x, 16); assert.equal(mobileFrame.width, 358);
  assert.equal(mobileFrame.y + mobileFrame.height, 504, 'a wide inspector sheet reserves the bottom edge');
});

test('adaptive mobile fitting reserves the nested HUD at the bottom and ignores CSS-hidden chrome', () => {
  const f = frameFixture(390, 844);
  f.globals.document.body.classList.contains = name => name === 'atlas-adaptive-mobile';
  f.queries['#notes .hud'] = f.box(12, 500, 366, 200, false);
  f.queries['#notes > .hud'] = f.box(12, 70, 366, 90, false);
  const context = load(['atlasViewportFrame'], f.globals);
  const frame = context.atlasViewportFrame(true);
  assert.equal(frame.y, 74, 'the nested mobile HUD must not reserve the top edge');
  assert.equal(frame.y + frame.height, 484, 'the mobile HUD reserves its measured upper edge plus bottom padding');

  f.queries['#notes .hud'].computedStyle.visibility = 'hidden';
  f.elements.atlasHeader.computedStyle.visibility = 'collapse';
  f.elements.atlasFamiliars.computedStyle.display = 'none';
  f.elements.atlasCameraDock.computedStyle.visibility = 'hidden';
  f.queries['#notes .manifest'].hidden = false;
  f.queries['#notes .manifest'].computedStyle.visibility = 'hidden';
  f.elements.inspect.hidden = false; f.elements.inspect.computedStyle.display = 'none';
  assert.ok(Object.values(f.elements).every(element => element.getClientRects().length), 'visibility-hidden elements may retain rectangles');
  assert.deepEqual(plain(context.atlasViewportFrame(true)), {x: 16, y: 16, width: 358, height: 812, cx: 195, cy: 422});
});

test('a mobile modal inspector does not collapse the inert map frame; desktop inspector space stays reserved', () => {
  const mobile = frameFixture(390, 844), classes = new Set(['atlas-adaptive-mobile', 'atlas-mobile-overlay']);
  mobile.globals.document.body.classList.contains = name => classes.has(name);
  mobile.elements.inspect = mobile.box(12, 400, 366, 400, false);
  const context = load(['atlasViewportFrame'], mobile.globals);
  assert.deepEqual(plain(context.atlasViewportFrame(true)), plain(context.atlasViewportFrame(false)),
    'a modal inspector covers an inert map and is not a safe-frame reservation, even during direct mission fitting');
  classes.delete('atlas-mobile-overlay');
  const nonmodal = context.atlasViewportFrame(true);
  assert.equal(nonmodal.y + nonmodal.height, 384, 'a visible nonmodal mobile inspector still reserves the bottom edge');

  const desktop = frameFixture(); desktop.elements.inspect.hidden = false;
  desktop.globals.document.body.classList.contains = name => name === 'atlas-mobile-overlay';
  const wide = load(['atlasViewportFrame'], desktop.globals).atlasViewportFrame(true);
  assert.equal(wide.x, 348, 'desktop inspection reserves the left-hand column');
});

function fitFixture(width, height, count) {
  const f = frameFixture(width, height), keys = Array.from({length: count}, (_, index) => `project-${index}`);
  const projects = Object.fromEntries(keys.map(key => [key, {layout: {n: 4}, sel: null}]));
  const calls = {save: 0, kick: 0, build: 0, sync: 0};
  let context;
  const worldOf = source.match(/^const worldOf = .*$/m)?.[0];
  assert.ok(worldOf, 'extract the real world-origin lookup');
  context = load(['atlasViewportFrame', 'atlasWorldLayout', 'atlasFitScene'], {
    ...f.globals, projects, active: keys.at(-1), cur: () => projects[context.active],
    atlasScope: 'coven', atlasLayoutCache: null, atlasAutoFit: false,
    camT: {zoom: 1, px: 0, py: 0}, sc: null,
    clamp, RAD: Math.PI / 180, ZMIN: 0.00001,
    saveView() { calls.save++; }, kick() { calls.kick++; },
    buildScene() { calls.build++; context.sc.layoutSignature = context.atlasLayoutCache.signature; },
    sync() { calls.sync++; },
  }, worldOf);
  return {...f, context, calls, projects};
}

function projectToScreen(point, origin, camera, stage) {
  const px = point[0] - origin[0], py = point[1] - origin[1];
  const scale = Math.min(stage.clientWidth, stage.clientHeight) * camera.zoom / 784;
  return [stage.clientWidth / 2 + (px - camera.px) * scale, stage.clientHeight / 2 + (py - camera.py) * scale];
}

test('actual Coven fit contains every project reservation and branch inside measured chrome through 2,049 projects', () => {
  for (const [width, height] of [[1600, 900], [390, 844], [1100, 460]]) for (const count of [1, 4, 16, 128, 2049]) {
    const f = fitFixture(width, height, count), {context} = f;
    context.atlasFitScene(true);
    const snapshot = context.atlasWorldLayout(), active = snapshot.byKey.get(context.active);
    const frame = context.atlasViewportFrame(false), points = [];
    const addRect = (x0, y0, x1, y1) => { for (const x of [x0, x1]) for (const y of [y0, y1]) points.push([x, y]); };
    snapshot.nodes.forEach(node => addRect(node.x - node.width / 2, node.y - node.height / 2, node.x + node.width / 2, node.y + node.height / 2));
    addRect(-500, -575, 500, 575);
    snapshot.routes.forEach(route => route.points.forEach(point => addRect(point[0] - 60, point[1] - 60, point[0] + 60, point[1] + 60)));
    points.forEach(point => {
      const screen = projectToScreen(point, [active.x, active.y], context.camT, f.stage);
      assert.ok(screen[0] >= frame.x - EPS && screen[0] <= frame.x + frame.width + EPS, `${width}×${height}/${count} horizontal containment`);
      assert.ok(screen[1] >= frame.y - EPS && screen[1] <= frame.y + frame.height + EPS, `${width}×${height}/${count} vertical containment`);
    });
    assert.ok(['zoom', 'px', 'py'].every(key => Number.isFinite(context.camT[key])));
    assert.equal(context.atlasAutoFit, true); assert.equal(f.calls.save, 1); assert.equal(f.calls.kick, 1);
  }
});

test('Project fit frames actual content for empty, single-mission, and dense projects', () => {
  for (const [width, height] of [[1600, 900], [390, 844]]) for (const count of [0, 1, 4, 128]) {
    const f = fitFixture(width, height, 1), {context} = f;
    context.atlasScope = 'project';
    const missions = new Map(), seats = new Map(), points = [[-49, -49], [49, 49]];
    for (let i = 0; i < count; i++) {
      const x = i % 8 * 170, y = Math.floor(i / 8) * 195;
      missions.set(i, {x, y}); points.push([x - 43, y - 43], [x + 43, y + 60]);
      seats.set(i, {bx: x + 74, by: y - 78}); points.push([x + 48, y - 93], [x + 100, y - 46]);
    }
    const gateL = [{x: 180, y: 0, asks: count ? [{}] : []}, {x: 9e4, y: 8e4, asks: []}];
    if (count) points.push([166, -14], [194, 14]);
    context.sc = {missions, seats, gateL};
    context.atlasFitScene(false);
    const frame = context.atlasViewportFrame(false);
    const screen = points.map(p => projectToScreen(p, [0, 0], context.camT, f.stage));
    for (const [x, y] of screen) {
      assert.ok(x >= frame.x - EPS && x <= frame.x + frame.width + EPS);
      assert.ok(y >= frame.y - EPS && y <= frame.y + frame.height + EPS);
    }
    const xs = screen.map(p => p[0]), ys = screen.map(p => p[1]);
    const fill = Math.max((Math.max(...xs) - Math.min(...xs)) / frame.width, (Math.max(...ys) - Math.min(...ys)) / frame.height);
    assert.ok(fill >= .9 || context.camT.zoom === 6, 'content fills the limiting safe-frame dimension');
  }
});

test('landscape Project uses the full map height beside its left-hand controls', () => {
  const f = frameFixture(820, 292);
  f.globals.document.body.dataset = {mobileLayout: 'landscape', atlasScope: 'project'};
  f.elements.atlasHeader = f.box(10, 8, 314, 56);
  f.elements.atlasFamiliars = f.box(10, 230, 322, 52);
  f.elements.atlasCameraDock.hidden = true;
  const context = load(['atlasViewportFrame'], f.globals);
  assert.deepEqual(plain(context.atlasViewportFrame(false)), {x: 342, y: 10, width: 468, height: 272, cx: 576, cy: 146});
});

test('saved views retain pan, zoom and lock across a legacy preference migration', () => {
  const camT = {px: 0, py: 0, zoom: 1}, cam = {...camT, locked: false}, writes = [];
  const context = load(['saveView', 'restoreView'], {
    cam, camT, clamp, PAN: 1000, ZMIN: .1,
    store: {set: (key, value) => writes.push([key, plain(value)])},
    setLock: on => { cam.locked = on; context.saveView(); }
  });
  context.restoreView({yaw: 62, pitch: 71, zoom: 4, px: -20, py: 53, locked: true});
  assert.deepEqual(cam, {px: -20, py: 53, zoom: 4, locked: true});
  assert.deepEqual(writes.at(-1), ['coven-compass-view', cam]);
  context.restoreView({zoom: 100, px: 4000, py: -8000, locked: false});
  assert.deepEqual(cam, {px: 1000, py: -1000, zoom: 6, locked: false});
  context.restoreView({zoom: Infinity, px: 80, py: 90});
  assert.deepEqual(camT, {px: 1000, py: -1000, zoom: 6});
});

test('layout cache retains mission-only changes and rebuilds the scene on topology changes', () => {
  const f = fitFixture(1200, 800, 4), {context} = f;
  const first = context.atlasWorldLayout();
  f.projects['project-0'].world = {missions: new Map([['new', {}]])};
  assert.equal(context.atlasWorldLayout(), first, 'mission changes do not reorder project geometry');
  context.sc = {layoutSignature: first.signature};
  f.projects['new-project'] = {layout: {n: 4}, sel: null};
  context.atlasFitScene(false);
  const second = context.atlasWorldLayout();
  assert.notEqual(second, first); assert.equal(second.nodes.length, 5);
  assert.equal(f.calls.build, 1); assert.equal(f.calls.sync, 1);
  delete f.projects['new-project']; context.atlasFitScene(false);
  assert.equal(context.atlasWorldLayout().nodes.length, 4); assert.equal(f.calls.build, 2);
});

test('selected-mission fit remains centered in its asymmetric safe frame after the zoom cap', () => {
  const f = frameFixture(); f.queries['#notes .manifest'].hidden = false;
  const M = {id: 'm1', seats: []}, project = {sel: M.id, world: {missions: new Map([[M.id, M]]), agents: new Map()}};
  const position = {x: 200, y: -100};
  const context = load(['atlasViewportFrame', 'fitTarget'], {
    ...f.globals, sc: {missions: new Map([[M.id, position]]), seats: new Map(), agents: new Map()},
    clamp, ZMIN: 0.00001, PAN: 1000000,
  });
  const camera = context.fitTarget(project), frame = context.atlasViewportFrame(true);
  assert.equal(camera.zoom, 2.3, 'this mission exercises the upper zoom cap');
  const screen = projectToScreen([position.x, position.y], [0, 0], camera, f.stage);
  near(screen[0], frame.cx, 'capped mission horizontal center'); near(screen[1], frame.cy, 'capped mission vertical center');
  M.seats.push('astra');
  context.seatId = (m, k) => m + '/' + k;
  const seat = {x: 365, y: -170, R: 35, bx: 292, by: -140};
  context.sc.seats.set('m1/astra', seat);
  for (const [familiar, anchor] of [[null, [position.x, position.y]], ['astra', [seat.bx, seat.by]]]) {
    project.fam = familiar;
    const fitted = context.fitTarget(project);
    const center = projectToScreen(anchor, [0, 0], fitted, f.stage);
    near(center[0], frame.cx, 'selected item stays horizontally centered with an off-center squad');
    near(center[1], frame.cy, 'selected item stays vertically centered with an off-center squad');
  }
  project.sel = 'removed'; assert.equal(context.fitTarget(project), null, 'replay removal has no stale fit target');
});

test('replay removal restores the pre-selection manual camera and automatic-fit preference', () => {
  const newWorld = () => ({t: -Infinity, missions: new Map(), agents: new Map()});
  const project = {
    world: {t: 1000, missions: new Map([['m1', {id: 'm1', seats: ['astra']}]]), agents: new Map()},
    trace: [{t: 1000, type: 'mission.opened', mission: 'm1'}], applied: 1,
    sel: 'm1', fam: 'astra', detail: 'card', pick: null,
    camBack: {zoom: 0.4, px: 17, py: -20, autoFit: false},
  };
  const context = load(['seek'], {
    newWorld, SimModel: loadSimulationModel(), window: {CovenMissionNavigation: navigation}, atlasNavigationReady: true,
    atlasAutoFit: true, cam: {locked: false}, camT: {zoom: 2.3, px: 5, py: 9},
    cur: () => project, projects: {sample: project}, active: 'sample',
  });
  assert.equal(context.seek(project, 500, true), true);
  assert.equal(project.sel, null); assert.equal(project.camBack, null);
  assert.equal(context.atlasAutoFit, false, 'replay removal must restore manual framing, just as deselection does');
  assert.deepEqual(plain(context.camT), {zoom: 0.4, px: 17, py: -20}, 'position and zoom return');
});

test('actual rounded branch paths keep finite endpoints and cap corners to adjacent segment lengths', () => {
  const context = load(['atlasRoutePath']);
  assert.equal(context.atlasRoutePath([], 12), '');
  assert.equal(context.atlasRoutePath([[0, 0], [10, 0], [10, 10]], 100), 'M0.0,0.0L5.0,0.0Q10.0,0.0 10.0,5.0L10.0,10.0');
  assert.doesNotMatch(context.atlasRoutePath([[0, 0], [0, 0], [10, 0]], 12), /NaN|Infinity/);
  for (const count of [1, 4, 16, 128]) {
    const snapshot = layout.layout(Array.from({length: count}, (_, i) => `p${i}`));
    snapshot.routes.forEach(route => {
      const result = context.atlasRoutePath(route.points, snapshot.maxCornerRadius);
      const format = point => point.map(n => n.toFixed(1)).join(',');
      assert.ok(result.startsWith('M' + format(route.points[0])));
      assert.ok(result.endsWith('L' + format(route.points.at(-1))));
      assert.doesNotMatch(result, /NaN|Infinity|undefined/);
      assert.ok((result.match(/-?\d+(?:\.\d+)?/g) || []).map(Number).every(Number.isFinite));
    });
  }
});

test('manual zoom and camera lock suppress queued automatic fitting without changing scope', () => {
  const callbacks = [], fits = [], calls = {draw: 0}, bodyClasses = new Set();
  const context = load(['atlasQueueFit', 'zoomBy'], {
    atlasResizeFrame: 0, atlasAutoFit: true, atlasScope: 'coven',
    requestAnimationFrame: callback => { callbacks.push(callback); return callbacks.length; },
    cam: {locked: false, zoom: 1}, camT: {zoom: 1}, ZMIN: 0.00001, clamp,
    atlasFitScene: remeasure => fits.push(remeasure),
    drawLeadCard: () => { calls.draw++; }, kick() {}, saveView() {}, atlasWriteRoute() {}, window: {},
    document: {body: {classList: {contains: name => bodyClasses.has(name)}}},
  });
  context.atlasQueueFit(); context.atlasQueueFit();
  assert.equal(callbacks.length, 1, 'resize updates coalesce'); callbacks[0]();
  assert.deepEqual(fits, [true]); assert.equal(context.atlasResizeFrame, 0);
  context.zoomBy(0.1); assert.equal(context.atlasAutoFit, false); assert.equal(context.atlasScope, 'coven');
  context.atlasQueueFit(); callbacks[1](); assert.equal(fits.length, 1, 'a resize respects the manual camera');
  context.atlasAutoFit = true; context.cam.locked = true;
  context.atlasQueueFit(); callbacks[2](); assert.equal(fits.length, 1, 'a locked camera is not reframed');
  const before = context.camT.zoom; context.zoomBy(2); assert.equal(context.camT.zoom, before);
  context.cam.locked = false; context.atlasScope = 'project'; context.atlasQueueFit(); callbacks[3]();
  assert.deepEqual(fits, [true, false]); assert.equal(calls.draw, 4, 'cards still refresh after suppressed fitting');
  bodyClasses.add('atlas-keyboard-open'); context.atlasQueueFit(); callbacks[4]();
  assert.equal(fits.length, 2, 'the ResizeObserver path must not fit to a keyboard-shrunken viewport');
  bodyClasses.delete('atlas-keyboard-open'); context.atlasQueueFit(); callbacks[5]();
  assert.deepEqual(fits, [true, false, false], 'closing the keyboard resumes automatic fitting');
  assert.equal(calls.draw, 6);
});

test('queued fitting measures the current mission-card structure after a responsive transition', () => {
  const calls = []; let callback, cardMode = 'old direct HUD';
  const context = load(['atlasQueueFit'], {
    atlasResizeFrame: 0, atlasAutoFit: true, atlasScope: 'project', cam: {locked: false},
    document: {body: {classList: {contains: () => false}}},
    requestAnimationFrame: fn => { callback = fn; return 1; },
    drawLeadCard: () => { cardMode = 'new manifest'; calls.push('card'); },
    atlasFitScene: () => { assert.equal(cardMode, 'new manifest', 'camera fit must measure the new card layout'); calls.push('fit'); },
    kick: () => calls.push('kick'),
  });
  context.atlasQueueFit(); callback();
  assert.deepEqual(calls, ['card', 'fit', 'kick']);
});

test('layout simulation counts preserve user Projects beyond the presets and reset only generated samples', async () => {
  const real = {name: 'real', trace: [{type: 'user-content'}]}, collision = {name: 'atlas-001', sample: true};
  const projects = {real, 'atlas-001': collision}, calls = {enter: 0, overview: 0, seek: 0, announcements: []};
  const context = load(['atlasSetProjectCount'], {
    projects, active: 'real', atlasSampleRequest: 0, Date: {now: () => 123456}, performance: {now: () => 0},
    makeProject: (key, trace, recorded) => ({key, trace, recorded}), sampleTrace: (key, time) => [{key, time}],
    seek: (project, time, quiet) => { assert.equal(time, 123456); assert.equal(quiet, true); calls.seek++; },
    enter: () => { calls.enter++; }, atlasOverview: () => { calls.overview++; },
    window: {CovenAtlas: {announce: text => calls.announcements.push(text)}},
  });
  for (const invalid of [-1, Number.MAX_SAFE_INTEGER + 1, 2.5, 'invalid', Infinity]) {
    assert.equal(await context.atlasSetProjectCount(invalid), false); assert.equal(Object.keys(projects).length, 2);
  }
  assert.equal(calls.enter, 0, 'invalid values cause no topology change');
  for (const count of [16, 64, 128, 1025]) {
    assert.equal(await context.atlasSetProjectCount(count), true); assert.equal(Object.keys(projects).length, count);
    assert.equal(projects.real, real); assert.equal(projects['atlas-001'], collision);
    Object.entries(projects).filter(([key]) => key !== 'real' && key !== 'atlas-001').forEach(([, project]) => {
      assert.equal(project.layoutDemo, true); assert.equal(project.sample, true); assert.equal(project.recorded, false);
    });
  }
  const generated = Object.keys(projects).find(key => projects[key].layoutDemo);
  context.active = generated;
  assert.equal(await context.atlasSetProjectCount(0), true);
  assert.deepEqual(Object.keys(projects), ['real', 'atlas-001']); assert.equal(context.active, 'real');
  assert.deepEqual(real.trace, [{type: 'user-content'}]);
  assert.equal(calls.seek, 1023); assert.equal(calls.enter, 5); assert.equal(calls.overview, 5);
  assert.match(calls.announcements.at(-1), /^2 Projects/);
});

test('scope and navigation do not retain the obsolete zoom-to-scope threshold', () => {
  assert.doesNotMatch(source, /cam(?:T)?\.zoom\s*[<>]\s*\.?6\s*\/\s*sc\.g/);
  for (const name of ['atlasSnapshot', 'atlasWriteRoute', 'atlasOpenProject', 'atlasOpenMission', 'openNew', 'openProjectForm']) {
    assert.doesNotMatch(extract(name), /sc\.far|cam(?:T)?\.zoom\s*[<>]/, `${name} must use explicit scope`);
  }
});

test('Project events use project.* types and castle.* types are not accepted', () => {
  const known = source.match(/^const KNOWN = (new Set\(\[[^\]]*\]\));$/m);
  assert.ok(known, 'KNOWN event types must exist in the actual Site source');
  const context = load(['parseTrace'], {}, `var KNOWN = ${known[1]};`);
  const T0 = Date.UTC(2026, 10, 19); // milliseconds, so parseTrace keeps t as written
  for (const [i, type] of ['founded', 'moved', 'renamed', 'stopped', 'resumed'].entries()) {
    assert.equal(context.KNOWN.has(`project.${type}`), true, `project.${type} is a known event`);
    assert.equal(context.KNOWN.has(`castle.${type}`), false, `castle.${type} is not an event type`);
    const {events, bad} = context.parseTrace([
      JSON.stringify({t: T0 + i, type: `project.${type}`, name: 'ui'}),
      JSON.stringify({t: T0 + i, type: `castle.${type}`, name: 'ui'}),
    ].join('\n'));
    assert.deepEqual(plain(events), [{t: T0 + i, type: `project.${type}`, name: 'ui'}]);
    assert.equal(bad, 1, `castle.${type} is rejected`);
  }
  assert.doesNotMatch(source, /'castle\./, 'the Site never writes castle.* events');
  assert.doesNotMatch(source, /coven-castles-/, 'browser storage uses coven-compass-* keys');
});

test('large sample setup yields with all Projects intact and a newer request cancels the pending batch', async () => {
  let tick = 0, resume, entered = 0;
  const projects = {real: {key: 'real'}};
  const context = load(['atlasSetProjectCount'], {
    projects, active: 'real', atlasSampleRequest: 0, Date, performance: {now: () => tick += 20},
    setTimeout: fn => { resume = fn; }, makeProject: key => ({key}), sampleTrace: () => [], seek() {},
    enter: () => entered++, atlasOverview() {}, window: {},
  });
  const first = context.atlasSetProjectCount(999);
  assert.equal(typeof resume, 'function');
  assert.deepEqual(Object.keys(projects), ['real']);
  assert.equal(await context.atlasSetProjectCount(0), true);
  resume();
  assert.equal(await first, false);
  assert.deepEqual(Object.keys(projects), ['real']); assert.equal(entered, 1);
});
