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
  const start = source.indexOf(`function ${name}(`);
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
    this.listeners = {}; this.style = {}; this.hidden = false; this._text = '';
  }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  appendChild(child) { child.remove(); this.children.push(child); child.parent = this; return child; }
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
    $: () => null, sc: {hl: null, g: 1}, cam: {zoom: 1, locked: false}, camT: {zoom: 1, pitch: 24},
    atlasScope: 'coven', atlasGestureMode: 'pan', panelView: 'agents',
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

test('overview keeps a single exact and accessible count as replay and density change', () => {
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
    inspect: box(width - 320, 80, 308, height - 180, true),
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
  assert.deepEqual(plain(context.atlasViewportFrame(true)), {x: 384, y: 86, width: 268, height: 434, cx: 518, cy: 303});
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
  assert.equal(wide.x + wide.width, 652, 'desktop inspection still reserves the right-hand column');
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
    camT: {yaw: 17, pitch: 24, zoom: 1, px: 0, py: 0}, sc: null,
    clamp, RAD: Math.PI / 180, ZMIN: 0.00001,
    saveView() { calls.save++; }, kick() { calls.kick++; },
    buildScene() { calls.build++; context.sc.layoutSignature = context.atlasLayoutCache.signature; },
    sync() { calls.sync++; },
  }, worldOf);
  return {...f, context, calls, projects};
}

function projectToScreen(point, origin, camera, stage) {
  const yaw = camera.yaw * Math.PI / 180, pitch = camera.pitch * Math.PI / 180;
  const x = point[0] - origin[0], y = point[1] - origin[1];
  const px = x * Math.cos(yaw) - y * Math.sin(yaw);
  const py = (x * Math.sin(yaw) + y * Math.cos(yaw)) * Math.cos(pitch);
  const scale = Math.min(stage.clientWidth, stage.clientHeight) * camera.zoom / 784;
  return [stage.clientWidth / 2 + (px - camera.px) * scale, stage.clientHeight / 2 + (py - camera.py) * scale];
}

test('actual Coven fit contains every project reservation and branch inside measured chrome at 1–128 projects', () => {
  for (const [width, height] of [[1600, 900], [390, 844], [1100, 460]]) for (const count of [1, 4, 16, 128]) {
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

test('Coven fit caps an incoming 78-degree orbit and contains the screen-facing hub; project pitch remains independent', () => {
  for (const [width, height] of [[1600, 900], [390, 844]]) {
    const f = fitFixture(width, height, 4), {context} = f;
    context.camT.pitch = 78; context.atlasFitScene(true);
    assert.equal(context.camT.pitch, 45, 'Coven pitch retains clearance for screen-facing labels');
    const snapshot = context.atlasWorldLayout(), active = snapshot.byKey.get(context.active);
    const frame = context.atlasViewportFrame(false);
    const center = projectToScreen([0, 0], [active.x, active.y], context.camT, f.stage);
    const scale = Math.min(width, height) * context.camT.zoom / 784;
    for (const dx of [-500, 500]) for (const dy of [-350, 560]) {
      const x = center[0] + dx * scale, y = center[1] + dy * scale;
      assert.ok(Number.isFinite(x) && Number.isFinite(y));
      assert.ok(x >= frame.x - EPS && x <= frame.x + frame.width + EPS, 'uncompressed hub horizontal bounds');
      assert.ok(y >= frame.y - EPS && y <= frame.y + frame.height + EPS, 'uncompressed crown and label vertical bounds');
    }
    context.atlasScope = 'project'; context.camT.pitch = 78;
    context.atlasFitScene(false);
    assert.equal(context.camT.pitch, 78, 'project detail may keep its steeper orbit');
  }
});

test('packed agents keep distinct stable slots beyond the original three rings', () => {
  const constants = source.slice(source.indexOf('const hexDirections'), source.indexOf('const seatR'));
  const context = load(['slotXY'], {HEX_D:13.6, RAD:Math.PI / 180}, constants);
  const seat = {x:30, y:40, rot:25};
  const positions = Array.from({length:128}, (_,i) => context.slotXY(seat, i));
  assert.deepEqual(Array.from(positions[0]), [30,40]);
  assert.equal(new Set(positions.map(p => p.map(n => n.toFixed(4)).join(','))).size, positions.length);
  for (const [index,p] of positions.entries()) assert.deepEqual(context.slotXY(seat, index), p);
});

test('Project fit follows visible content and reserves only gates with pending requests', () => {
  const {context} = fitFixture(1200, 800, 1);
  context.atlasScope = 'project';
  context.camT.yaw = context.camT.pitch = 0;
  const gate = {x: 560, y: 0, asks: []};
  context.sc = {missions: new Map(), seats: new Map(), gateL: [gate]};
  context.atlasFitScene(false);
  const emptyZoom = context.camT.zoom;
  context.sc.seats.set('a', {bx:-280, by:0});
  context.atlasFitScene(false);
  assert.ok(context.camT.px < 0);
  gate.asks.push({id:'q1'});
  context.atlasFitScene(false);
  assert.ok(context.camT.px > 0);
  assert.ok(context.camT.zoom < emptyZoom);
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
    camT: {yaw: 0, pitch: 0}, clamp, RAD: Math.PI / 180, ZL: 0, ZT: 0, ZS: 0, ZMIN: 0.00001, PAN: 1000000,
  });
  const camera = context.fitTarget(project), frame = context.atlasViewportFrame(true);
  assert.equal(camera.zoom, 2.3, 'this mission exercises the upper zoom cap');
  const screen = projectToScreen([position.x, position.y], [0, 0], {...camera, yaw: 0, pitch: 0}, f.stage);
  near(screen[0], frame.cx, 'capped mission horizontal center'); near(screen[1], frame.cy, 'capped mission vertical center');
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
    atlasAutoFit: true, cam: {locked: false}, camT: {zoom: 2.3, px: 5, py: 9, yaw: 17, pitch: 24},
    cur: () => project, projects: {sample: project}, active: 'sample',
  });
  assert.equal(context.seek(project, 500, true), true);
  assert.equal(project.sel, null); assert.equal(project.camBack, null);
  assert.equal(context.atlasAutoFit, false, 'replay removal must restore manual framing, just as deselection does');
  assert.deepEqual(plain(context.camT), {zoom: 0.4, px: 17, py: -20, yaw: 17, pitch: 24}, 'only position and zoom return; orbit is unchanged');
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

test('layout simulation counts preserve user Projects and reset only generated samples', () => {
  const real = {name: 'real', trace: [{type: 'user-content'}]}, collision = {name: 'atlas-001', sample: true};
  const projects = {real, 'atlas-001': collision}, calls = {enter: 0, overview: 0, seek: 0, announcements: []};
  const context = load(['atlasSetProjectCount'], {
    projects, active: 'real', Date: {now: () => 123456},
    makeProject: (key, trace, recorded) => ({key, trace, recorded}), sampleTrace: (key, time) => [{key, time}],
    seek: (project, time, quiet) => { assert.equal(time, 123456); assert.equal(quiet, true); calls.seek++; },
    enter: () => { calls.enter++; }, atlasOverview: () => { calls.overview++; },
    window: {CovenAtlas: {announce: text => calls.announcements.push(text)}},
  });
  for (const invalid of [-1, 129, 2.5, 'invalid', Infinity]) {
    assert.equal(context.atlasSetProjectCount(invalid), false); assert.equal(Object.keys(projects).length, 2);
  }
  assert.equal(calls.enter, 0, 'invalid values cause no topology change');
  for (const count of [16, 64, 128]) {
    assert.equal(context.atlasSetProjectCount(count), true); assert.equal(Object.keys(projects).length, count);
    assert.equal(projects.real, real); assert.equal(projects['atlas-001'], collision);
    Object.entries(projects).filter(([key]) => key !== 'real' && key !== 'atlas-001').forEach(([, project]) => {
      assert.equal(project.layoutDemo, true); assert.equal(project.sample, true); assert.equal(project.recorded, false);
    });
  }
  const generated = Object.keys(projects).find(key => projects[key].layoutDemo);
  context.active = generated;
  assert.equal(context.atlasSetProjectCount(0), true);
  assert.deepEqual(Object.keys(projects), ['real', 'atlas-001']); assert.equal(context.active, 'real');
  assert.deepEqual(real.trace, [{type: 'user-content'}]);
  assert.equal(calls.seek, 126); assert.equal(calls.enter, 4); assert.equal(calls.overview, 4);
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
