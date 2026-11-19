'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');

function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists in the actual Site source`);
  for (let end = source.indexOf('\n', start); end !== -1; end = source.indexOf('\n', end + 1)) {
    const candidate = source.slice(start, end);
    try { new vm.Script(`(${candidate}\n)`); return candidate; }
    catch (error) { if (!(error instanceof SyntaxError)) throw error; }
  }
  throw new Error(`Incomplete function ${name}`);
}

// Exercise actual clock/navigation functions with only scene/DOM boundaries
// replaced. Rendering and real event application have a separate regression.
function fixture() {
  const pending = new Map(), seeks = [], routes = [];
  let ticket = 0;
  const castles = Object.fromEntries(['build', 'cave'].map(key => [key, {
    key, recorded: false, trace: [{t: 0}, {t: 10000}], world: {t: 1000},
    sel: null, pick: null,
  }]));
  const context = vm.createContext({
    castles, active: 'build', cursor: 1000, live: false, playing: true, speed: 10,
    raf: 0, lastTs: 0, framing: false, sealAnimating: false, packets: [],
    cz: {open: false}, insp: {}, leadSig: '', needsSig: '', streamSig: '', marksSig: '', lcSig: '', wardSig: '', traceSig: '',
    cam: {px: 0, py: 0, yaw: 0, pitch: 0, locked: false}, camT: {pitch: 0}, RAD: Math.PI / 180, PAN: 12000, reduce: false,
    atlasScope: 'castle', atlasAutoFit: true, atlasFitScene() {},
    document: {querySelectorAll: () => []}, $: () => ({}),
    tEnd: castle => castle.recorded ? castle.trace.at(-1).t : 10000,
    tStart: castle => castle.trace[0].t - 15000,
    worldOf: key => key === 'build' ? [0, 0] : [100, 100],
    viewOf: () => ({px: 0, py: 0, zoom: 1}), clamp: (n, min, max) => Math.max(min, Math.min(max, n)),
    select() {}, buildScene() {}, saveView() {},
    atlasWriteRoute: () => routes.push(context.active),
    seek: (castle, t) => { castle.world.t = t; seeks.push({key: castle.key, t}); return true; },
    easeCam: () => false, stepAgents: () => false, project() {}, timelineUI() {},
    requestAnimationFrame: callback => { const id = ++ticket; pending.set(id, callback); return id; },
  });
  context.cur = () => context.castles[context.active];
  context.refresh = () => context.kick();
  const names = ['go', 'enter', 'kick', 'frame', 'seekTimeline', 'tStart', 'timelineHasEvents'];
  new vm.Script(names.map(extract).join('\n'), {filename: 'actual-site-replay-clock.js'}).runInContext(context);
  return {context, pending, seeks, routes,
    tick(ts) {
      assert.equal(pending.size, 1, 'exactly one next animation frame is queued');
      const [id, callback] = pending.entries().next().value;
      pending.delete(id); callback(ts);
    },
  };
}

test('changing focused project preserves playing replay time and seeks the new project', () => {
  const {context: c} = fixture();
  c.go('cave');
  assert.equal(c.active, 'cave');
  assert.equal(c.playing, true);
  assert.equal(c.live, false);
  assert.equal(c.cursor, 1000);
  assert.equal(c.cur().world.t, 1000);
});

test('changing project while paused preserves the position, including before its first event', () => {
  const {context: c} = fixture();
  c.playing = false; c.cursor = -500;
  c.castles.cave.trace[0].t = 5000;
  c.go('cave');
  assert.equal(c.playing, false);
  assert.equal(c.live, false);
  assert.equal(c.cursor, -500, 'focus is not a seek or Go live action');
  assert.equal(c.cur().world.t, -500);
});

test('opening a dormant project from Coven scope preserves the shared replay state', () => {
  for (const playing of [false, true]) {
    const {context: c} = fixture();
    c.atlasScope = 'coven'; c.playing = playing;
    c.castles.cave.trace = []; c.castles.cave.world.t = 9000;
    c.go('cave');
    assert.equal(c.active, 'cave'); assert.equal(c.atlasScope, 'castle');
    assert.equal(c.cursor, 1000); assert.equal(c.live, false); assert.equal(c.playing, playing);
    assert.equal(c.castles.build.world.t, 1000); assert.equal(c.castles.cave.world.t, 1000);
    assert.equal(c.timelineHasEvents(c.cur()), true, 'a dormant project still uses the workspace replay');
  }
});

test('replay continues with elapsed frame time across consecutive event refreshes', () => {
  const f = fixture(), c = f.context;
  c.kick();
  f.tick(100); // first frame uses 16ms
  assert.equal(c.cursor, 1160);
  f.tick(133); // an event refresh must not reset the previous timestamp
  assert.equal(c.cursor, 1490);
  f.tick(181);
  assert.equal(c.cursor, 1970);
  assert.equal(c.playing, true);
  assert.equal(f.pending.size, 1);
});

test('overview projects follow the same cursor while replaying and seeking', () => {
  const f = fixture(), c = f.context;
  c.castles.cave.world.t = 9000;
  c.kick(); f.tick(100);
  assert.equal(c.castles.build.world.t, c.cursor);
  assert.equal(c.castles.cave.world.t, c.cursor, 'overview must not retain future events');
  c.go('cave');
  assert.equal(c.castles.build.world.t, c.castles.cave.world.t);
});

test('live projects share timeline bounds and empty Castles can replay the workspace', () => {
  const {context: c} = fixture();
  c.castles.cave.trace[0].t = 5000;
  assert.equal(c.tStart(c.castles.build), -15000);
  assert.equal(c.tStart(c.castles.cave), -15000);
  c.castles.cave.trace = [];
  assert.equal(c.timelineHasEvents(c.castles.cave), true);
  assert.equal(c.tStart(c.castles.cave), -15000);
  c.castles.cave.recorded = true;
  assert.equal(c.timelineHasEvents(c.castles.cave), false, 'an empty recording has no replay');
  c.castles.cave.trace = [{t: 5000}, {t: 6000}];
  assert.equal(c.tStart(c.castles.cave), -10000, 'imported recordings retain their own extent');
});

test('slow frames advance replay by elapsed time while camera motion stays bounded', () => {
  const f = fixture(), c = f.context, animationDeltas = [];
  c.speed = 1; c.easeCam = dt => { animationDeltas.push(dt); return false; };
  c.kick(); f.tick(100); f.tick(1100);
  assert.equal(c.cursor, 2016, 'a delayed frame does not discard replay time');
  assert.deepEqual(animationDeltas, [16, 64]);
});

test('replay reaches the live edge, but a recording finishes paused', () => {
  for (const recorded of [false, true]) {
    const f = fixture(), c = f.context;
    c.cur().recorded = recorded; c.cursor = 9950;
    c.kick(); f.tick(100);
    assert.equal(c.cursor, 10000);
    assert.equal(c.playing, false);
    assert.equal(c.live, !recorded);
  }
});

test('explicit trace entry still resets time while focus-only entry preserves it', () => {
  const {context: c} = fixture();
  c.enter();
  assert.equal(c.cursor, 10000);
  assert.equal(c.playing, false);
  assert.equal(c.live, true);
  c.cur().recorded = true;
  c.enter();
  assert.equal(c.cursor, 10000);
  assert.equal(c.playing, false);
  assert.equal(c.live, false);
});

test('a rendering error releases the frame guard so the user can restart playback', () => {
  const f = fixture(), c = f.context;
  c.project = () => { throw new Error('render failure'); };
  c.kick();
  assert.throws(() => f.tick(100), /render failure/);
  assert.equal(c.framing, false);
  c.project = () => {};
  c.kick();
  assert.equal(f.pending.size, 1);
});
