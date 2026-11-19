'use strict';

// Finite geometry and camera arithmetic, not browser rendering/text metrics.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { safeFrame, fit, projectedBounds } = require('../dist/atlas-viewport.js');
const { layout } = require('../dist/atlas-layout.js');
const EPS = 1e-7;
const near = (a, b, label) => assert.ok(Math.abs(a - b) < EPS, (label || 'close') + ': ' + a + ' vs ' + b);

function assertFrame(f, width, height) {
  assert.ok(Object.values(f).every(Number.isFinite));
  assert.ok(f.width >= 1 && f.height >= 1);
  assert.ok(f.x >= -EPS && f.y >= -EPS);
  assert.ok(f.x + f.width <= width + EPS && f.y + f.height <= height + EPS);
  near(f.cx, f.x + f.width / 2);
  near(f.cy, f.y + f.height / 2);
}

function groundProjection(x, y, options) {
  const yaw = options.yaw * Math.PI / 180, pitch = options.pitch * Math.PI / 180;
  const dx = x - options.originX, dy = y - options.originY;
  return [dx * Math.cos(yaw) - dy * Math.sin(yaw), (dx * Math.sin(yaw) + dy * Math.cos(yaw)) * Math.cos(pitch)];
}

test('safe frame reserves maximum clipped intrusion plus padding independently per edge', () => {
  const f = safeFrame({ width: 1000, height: 800, padding: 24, occluders: [
    { x: 100, y: 10, width: 200, height: 70, edge: 'top' },
    { x: 400, y: 30, width: 100, height: 30, edge: 'top' },
    { x: 0, y: 200, width: 120, height: 300, edge: 'left' },
    { x: 600, y: 730, width: 200, height: 100, edge: 'bottom' },
    { x: 950, y: 100, width: 100, height: 300, edge: 'right' }
  ] });
  assert.deepEqual(f, { x: 144, y: 104, width: 782, height: 602, cx: 535, cy: 405 });
  assertFrame(f, 1000, 800);
});

test('edge tags are explicit; untagged, malformed, empty and offscreen occluders are ignored', () => {
  const base = { width: 1000, height: 800, padding: 24 };
  assert.deepEqual(safeFrame(Object.assign({}, base, { occluders: [
    { x: 0, y: 0, width: 1000, height: 800 },
    { x: 0, y: 0, width: 1000, height: 800, edge: 'center' },
    { x: -50, y: -100, width: 30, height: 40, edge: 'top' },
    { x: 0, y: 0, width: 0, height: 300, edge: 'left' },
    { x: NaN, y: 0, width: 300, height: 300, edge: 'right' },
    null
  ] })), safeFrame(base));
  const tagged = safeFrame(Object.assign({}, base, { occluders: [{ x: 300, y: 200, width: 100, height: 100, edge: 'top' }] }));
  assert.equal(tagged.y, 324);
  assert.equal(tagged.x, 24, 'one tag does not reserve other edges');
  assert.equal(tagged.width, 952);
  const clipped = safeFrame({ width: 500, height: 400, padding: 10, occluders: [{ x: -50, y: -40, width: 100, height: 70, edge: 'top' }] });
  assert.equal(clipped.y, 40, 'only the visible30px intrusion counts');
});

test('tiny displays retain a centered finite pixel and overloaded asymmetric reservations relax proportionally', () => {
  const tiny = safeFrame({ width: 20, height: 12, padding: 24 });
  assert.deepEqual(tiny, { x: 9.5, y: 5.5, width: 1, height: 1, cx: 10, cy: 6 });
  const covered = safeFrame({ width: 100, height: 50, padding: 10, occluders: [{ x: 0, y: 0, width: 90, height: 50, edge: 'left' }] });
  assertFrame(covered, 100, 50);
  near(covered.width, 1);
  near(covered.x, 90, '100:10 requested reservations share the99px budget');
  const invalid = safeFrame({ width: NaN, height: -8, padding: Infinity });
  assertFrame(invalid, 1, 1);
  assert.deepEqual(invalid, { x: 0, y: 0, width: 1, height: 1, cx: 0.5, cy: 0.5 });
});

test('fit matches full-stage square SVG units and centers content in an asymmetric frame', () => {
  const b = { x0: -80, y0: -20, x1: 120, y1: 80 };
  const f = { x: 100, y: 150, width: 500, height: 400, cx: 350, cy: 350 };
  const camera = fit(b, { width: 1000, height: 800, frame: f, fill: 1 });
  near(camera.scale, 2.5);
  near(camera.zoom, 2.45);
  near(camera.px, 80);
  near(camera.py, 50);
  near(500 + (20 - camera.px) * camera.scale, f.cx);
  near(400 + (30 - camera.py) * camera.scale, f.cy);
  const inset = fit(b, { width: 1000, height: 800, frame: f, padding: 20, fill: 1 });
  near(inset.scale, 2.3, 'padding is an extra screen-pixel inset');
});

test('camera mapping round-trips projected points through zoom and offsets', () => {
  const width = 390, height = 844;
  const f = safeFrame({ width, height, occluders: [{ x: 0, y: 0, width, height: 116, edge: 'top' }] });
  const camera = fit({ x0: -2000, y0: -500, x1: 400, y1: 700 }, { width, height, frame: f });
  const k = camera.zoom * Math.min(width, height) / 784;
  near(k, camera.scale);
  for (const point of [[-2000, -500], [-700, 300], [400, 700], [0, 0]]) {
    const screen = [width / 2 + (point[0] - camera.px) * k, height / 2 + (point[1] - camera.py) * k];
    near((screen[0] - width / 2) / k + camera.px, point[0], 'round-trip x');
    near((screen[1] - height / 2) / k + camera.py, point[1], 'round-trip y');
  }
});

test('ground projection matches yaw/pitch convention and subtracts the origin before rotation', () => {
  const b = projectedBounds([{ x0: 10, y0: 20, x1: 30, y1: 40 }], { yaw: 90, pitch: 60, originX: 10, originY: 20 });
  near(b.x0, -20); near(b.x1, 0); near(b.y0, 0); near(b.y1, 10);
  const defaultPitch = projectedBounds([{ x0: -10, y0: -20, x1: 10, y1: 20 }]);
  near(defaultPitch.y1, 20 * Math.cos(24 * Math.PI / 180));
  assert.deepEqual(projectedBounds([]), { x0: 0, y0: 0, x1: 0, y1: 0 });
  assert.deepEqual(projectedBounds([{}, { x0: Infinity, y0: 1, x1: 2, y1: 3 }]), projectedBounds([]));
});

const COUNTS = [0, 1, 2, 4, 8, 12, 24, 64, 128];
const VIEWPORTS = [[390, 844], [768, 1024], [1440, 900], [2560, 1080], [160, 120]];
const ANGLES = [[0, 24], [37, 55], [-60, 0]];
for (const [width, height] of VIEWPORTS) {
  for (const count of COUNTS) {
    test('layout N=' + count + ' fits safe screen bounds at ' + width + 'x' + height, () => {
      const f = safeFrame({ width, height, padding: width < 200 ? 4 : 24, occluders: [
        { x: 0, y: 0, width, height: width < 200 ? 20 : 76, edge: 'top' },
        { x: width / 4, y: height - (width < 200 ? 14 : 48), width: width / 2, height: 48, edge: 'bottom' },
        ...(width >= 1000 ? [{ x: width - 320, y: 100, width: 320, height: height - 150, edge: 'right' }] : [])
      ] });
      const keys = Array.from({ length: count }, (_, i) => 'castle-' + i);
      const scene = layout(keys, { aspect: f.width / f.height, nodeWidth: 1000, nodeHeight: 1150, gap: 200, hubRadius: 360, gateOffset: 280, padding: 80 });
      const rectangles = scene.nodes.map(node => ({ x0: node.x - node.width / 2, y0: node.y - node.height / 2, x1: node.x + node.width / 2, y1: node.y + node.height / 2 }));
      // Crown/hub and routes are explicitly included, rather than silently
      // assuming that the layout's node footprints contain everything drawn.
      rectangles.push({ x0: -360, y0: -360, x1: 360, y1: 360 });
      for (const route of scene.routes) for (const [x, y] of route.points) rectangles.push({ x0: x, y0: y, x1: x, y1: y });
      for (const [yaw, pitch] of ANGLES) {
        const origin = scene.nodes[0] || { x: 0, y: 0 };
        const projection = { yaw, pitch, originX: origin.x, originY: origin.y };
        const b = projectedBounds(rectangles, projection);
        const camera = fit(b, { width, height, frame: f, fill: 0.94 });
        assert.ok(Object.values(camera).every(Number.isFinite));
        assert.ok(camera.zoom > 0 && camera.scale > 0);
        const k = camera.zoom * Math.min(width, height) / 784;
        near(width / 2 + ((b.x0 + b.x1) / 2 - camera.px) * k, f.cx, 'projected center aligns with safe center');
        near(height / 2 + ((b.y0 + b.y1) / 2 - camera.py) * k, f.cy, 'projected center aligns vertically');
        for (const r of rectangles) for (const x of [r.x0, r.x1]) for (const y of [r.y0, r.y1]) {
          const point = groundProjection(x, y, projection);
          const sx = width / 2 + (point[0] - camera.px) * k;
          const sy = height / 2 + (point[1] - camera.py) * k;
          assert.ok(sx >= f.x - EPS && sx <= f.x + f.width + EPS, 'all projected corners fit horizontally');
          assert.ok(sy >= f.y - EPS && sy <= f.y + f.height + EPS, 'all projected corners fit vertically');
        }
      }
    });
  }
}

test('degenerate and malformed fit inputs stay finite with a positive scale', () => {
  for (const b of [{ x0: 0, y0: 0, x1: 0, y1: 0 }, { x0: 10, y0: 20, x1: -10, y1: -20 }, {}, null, { x0: -1e300, y0: -1e300, x1: 1e300, y1: 1e300 }]) {
    for (const options of [{ width: 0, height: 0 }, { width: NaN, height: Infinity, fill: NaN }, { width: 10, height: 10, padding: 999, fill: 0 }, { width: 100, height: 80, frame: { x: 400, y: -200, width: 0, height: -2 } }]) {
      const result = fit(b, options);
      assert.ok(Object.values(result).every(Number.isFinite));
      assert.ok(result.scale > 0 && result.zoom > 0);
    }
  }
});

test('helpers leave caller inputs unchanged and expose dependency-free browser/CommonJS APIs', () => {
  const occluder = Object.freeze({ x: 0, y: 0, width: 600, height: 60, edge: 'top' });
  const input = Object.freeze({ width: 600, height: 400, occluders: Object.freeze([occluder]) });
  const f = Object.freeze(safeFrame(input));
  const rect = Object.freeze({ x0: -50, y0: -40, x1: 70, y1: 80 });
  const b = Object.freeze(projectedBounds(Object.freeze([rect]), Object.freeze({ yaw: 10, pitch: 24 })));
  const camera = fit(b, Object.freeze({ width: 600, height: 400, frame: f }));
  assert.ok(Object.values(camera).every(Number.isFinite));
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/atlas-viewport.js'), 'utf8'), context);
  const api = context.window.CovenAtlasViewport;
  assert.deepEqual(Object.keys(api).sort(), ['fit', 'projectedBounds', 'safeFrame']);
  assert.equal(JSON.stringify(api.safeFrame(input)), JSON.stringify(safeFrame(input)));
  assert.equal(JSON.stringify(api.fit(b, { width: 600, height: 400, frame: f })), JSON.stringify(camera));
});
