'use strict';

// Pure world-geometry tests. They do not emulate a browser, evaluate SVG text
// metrics, or prove that rendering every possible project is inexpensive.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { layout, missionGrid, missionPacking, taskPacking } = require('../dist/atlas-layout.js');

const COUNTS = [0, 1, 2, 4, 8, 12, 24, 64, 128];
const ASPECTS = [0.4, 0.7, 1, 1.6, 2.5];
const PRODUCTION_GEOMETRY = Object.freeze({ nodeWidth: 1000, nodeHeight: 1150, gap: 200, hubRadius: 360, gateOffset: 280, padding: 80 });
const EPSILON = 1e-7;
const keysFor = count => Array.from({ length: count }, (_, i) => 'project-' + (i + 1));

function box(node) {
  return { x0: node.x - node.width / 2, x1: node.x + node.width / 2, y0: node.y - node.height / 2, y1: node.y + node.height / 2 };
}

// Open-interior intersection: aisle centerlines may touch the edge when gap=0.
// The implementation emits cardinal segments, so this independent predicate
// covers the whole segment rather than sampling a few potentially lucky points.
function crossesInterior(a, b, rectangle) {
  if (Math.abs(a[0] - b[0]) < EPSILON) {
    return a[0] > rectangle.x0 + EPSILON && a[0] < rectangle.x1 - EPSILON &&
      Math.max(a[1], b[1]) > rectangle.y0 + EPSILON && Math.min(a[1], b[1]) < rectangle.y1 - EPSILON;
  }
  if (Math.abs(a[1] - b[1]) < EPSILON) {
    return a[1] > rectangle.y0 + EPSILON && a[1] < rectangle.y1 - EPSILON &&
      Math.max(a[0], b[0]) > rectangle.x0 + EPSILON && Math.min(a[0], b[0]) < rectangle.x1 - EPSILON;
  }
  assert.fail('Aisle routes must use cardinal segments');
}

function near(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < EPSILON, message + ': ' + actual + ' vs ' + expected);
}

function assertValid(result, keys) {
  const { nodes, routes, hub, bounds, config } = result;
  assert.deepEqual(nodes.map(node => node.key), keys, 'assignment retains caller order');
  assert.deepEqual(routes.map(route => route.key), keys, 'one route per key');
  assert.equal(new Set(nodes.map(node => node.x + ',' + node.y)).size, keys.length, 'unique coordinates');
  assert.equal(hub.x, 0);
  assert.equal(hub.y, 0);
  assert.ok(Object.values(bounds).every(Number.isFinite));
  assert.ok(bounds.x0 <= -hub.radius - config.padding + EPSILON);
  assert.ok(bounds.y0 <= -hub.radius - config.padding + EPSILON);
  assert.ok(bounds.x1 >= hub.radius + config.padding - EPSILON);
  assert.ok(bounds.y1 >= hub.radius + config.padding - EPSILON);
  const rectangles = nodes.map(box);
  nodes.forEach((node, i) => {
    assert.ok([node.x, node.y, node.width, node.height, node.gate.x, node.gate.y].every(Number.isFinite));
    const a = rectangles[i];
    assert.ok(bounds.x0 <= a.x0 - config.padding + EPSILON && bounds.x1 >= a.x1 + config.padding - EPSILON, 'padded horizontal reservation');
    assert.ok(bounds.y0 <= a.y0 - config.padding + EPSILON && bounds.y1 >= a.y1 + config.padding - EPSILON, 'padded vertical reservation');
    // Nearest point of a rectangle to the central circle; this includes labels.
    const nearX = Math.max(a.x0, Math.min(0, a.x1));
    const nearY = Math.max(a.y0, Math.min(0, a.y1));
    assert.ok(Math.hypot(nearX, nearY) >= hub.radius + config.gap - EPSILON, 'hub has its reserved clearance');
    for (let j = i + 1; j < nodes.length; j++) {
      const b = rectangles[j];
      assert.ok(a.x1 <= b.x0 + EPSILON || b.x1 <= a.x0 + EPSILON || a.y1 <= b.y0 + EPSILON || b.y1 <= a.y0 + EPSILON, 'Project and label reservations do not overlap');
    }
    const route = routes[i];
    assert.ok(route.points.length >= 2);
    const first = route.points[0], last = route.points[route.points.length - 1];
    near(Math.hypot(first[0] - hub.x, first[1] - hub.y), hub.radius, 'route begins exactly on hub edge');
    assert.deepEqual(last, [node.gate.x, node.gate.y], 'route ends at its selected gate');
    near(Math.hypot(last[0] - node.x, last[1] - node.y), config.gateOffset, 'exact gate offset');
    const gateDirections = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
    const direction = gateDirections[node.gate.side];
    assert.ok(direction, 'gate is cardinal');
    assert.ok(direction[0] * -node.x + direction[1] * -node.y > 0, 'gate faces hub');
    assert.deepEqual([node.gate.dx, node.gate.dy], direction.map(value => value * config.gateOffset));
    for (let k = 0; k < route.points.length; k++) {
      const point = route.points[k];
      assert.ok(point.every(Number.isFinite));
      assert.ok(point[0] >= bounds.x0 + config.padding - EPSILON && point[0] <= bounds.x1 - config.padding + EPSILON);
      assert.ok(point[1] >= bounds.y0 + config.padding - EPSILON && point[1] <= bounds.y1 - config.padding + EPSILON);
      if (!k) continue;
      assert.notDeepEqual(route.points[k - 1], point, 'no zero-length route segment');
      for (let j = 0; j < nodes.length; j++) {
        if (j === i) continue; // Entering the target's own gate is intentional.
        assert.equal(crossesInterior(route.points[k - 1], point, rectangles[j]), false, 'route to ' + node.key + ' crosses ' + nodes[j].key);
      }
    }
  });
}

test('large Covens keep one stable, clear route to each Project as the population grows', () => {
  const keys = keysFor(4097), options = {aspect: 2.3, nodeWidth: 1000, nodeHeight: 1150, gap: 200};
  const all = layout(keys, options), prefix = layout(keys.slice(0, 1537), options);
  assert.deepEqual(all.nodes.slice(0, prefix.nodes.length), prefix.nodes);
  assert.deepEqual(all.routes.slice(0, prefix.routes.length), prefix.routes);
  assert.deepEqual(all.nodes.map(n => n.key), keys);
  assert.deepEqual(all.routes.map(r => r.key), keys);
  const reserved = all.nodes.map(box);
  // Compare widely separated routes, including the last one, against every other reservation.
  for (let index = 0; index < keys.length; index += 128) {
    const points = all.routes[index].points;
    points.slice(1).forEach((b, j) => reserved.forEach((r, k) => {
      if (k !== index) assert.equal(crossesInterior(points[j], b, r), false);
    }));
  }
});

for (const count of COUNTS) {
  for (const aspect of ASPECTS) {
    test('layout N=' + count + ' aspect=' + aspect + ' preserves clear geometry', () => {
      const keys = keysFor(count);
      const options = Object.assign({ aspect }, PRODUCTION_GEOMETRY);
      const result = layout(keys, options);
      assertValid(result, keys);
      assert.deepEqual(layout(keys, options), result, 'same inputs yield the same snapshot');
    });
  }
}

test('default geometry is also safe when the hub is larger than half a Project', () => {
  const keys = keysFor(24);
  assertValid(layout(keys), keys);
});

test('appending keys preserves the position prefix at a fixed aspect', () => {
  for (const aspect of [0.4, 1, 2.5]) {
    const keys = keysFor(128);
    const full = layout(keys, { aspect }).nodes;
    for (const count of COUNTS) assert.deepEqual(layout(keys.slice(0, count), { aspect }).nodes, full.slice(0, count));
  }
});

test('opposite pairs keep the hub centered without assigning semantic order', () => {
  const result = layout(keysFor(128));
  for (let i = 0; i < result.nodes.length; i += 2) {
    near(result.nodes[i].x + result.nodes[i + 1].x, 0, 'paired x');
    near(result.nodes[i].y + result.nodes[i + 1].y, 0, 'paired y');
  }
  const reordered = ['last', 'first', 'middle'];
  assert.deepEqual(layout(reordered).nodes.map(node => node.key), reordered, 'caller order is not alphabetically or semantically ranked');
});

test('wide and portrait snapshots use compact two-dimensional groups at scale', () => {
  const keys = keysFor(128);
  const portrait = layout(keys, { aspect: 0.4 });
  const wide = layout(keys, { aspect: 2.5 });
  const ratio = result => (result.bounds.x1 - result.bounds.x0) / (result.bounds.y1 - result.bounds.y0);
  assert.ok(ratio(portrait) < 0.7, 'portrait grows chiefly vertically');
  assert.ok(ratio(wide) > 1.7, 'wide grows chiefly horizontally');
  for (const result of [portrait, wide]) {
    const area = (result.bounds.x1 - result.bounds.x0) * (result.bounds.y1 - result.bounds.y0);
    const occupied = result.nodes.length * result.config.nodeWidth * result.config.nodeHeight;
    assert.ok(occupied / area > 0.35, 'large layout does not leave an ever-growing empty ring interior');
    assert.ok(new Set(result.nodes.map(node => node.column)).size > 4);
    assert.ok(new Set(result.nodes.map(node => node.row)).size > 4);
  }
});

test('custom small geometry scales only the implicit gate and accepts zero gap', () => {
  const keys = keysFor(12);
  const result = layout(keys, { nodeWidth: 200, nodeHeight: 160, gap: 0, hubRadius: 30, padding: 0 });
  assert.equal(result.config.gateOffset, 80);
  assert.equal(result.maxCornerRadius, 0);
  assertValid(result, keys);
});

test('inputs remain untouched and output snapshots do not share mutable state', () => {
  const keys = Object.freeze(keysFor(8));
  const options = Object.freeze({ aspect: 0.7, nodeWidth: 1000 });
  const a = layout(keys, options);
  a.nodes[0].x = 999999;
  a.routes[0].points[0][0] = 999999;
  a.config.nodeWidth = 1;
  const b = layout(keys, options);
  assert.notEqual(b.nodes[0].x, 999999);
  assert.notEqual(b.routes[0].points[0][0], 999999);
  assert.equal(b.config.nodeWidth, 1000);
  assert.deepEqual(keys, keysFor(8));
});

test('invalid keys and geometry fail explicitly', () => {
  assert.throws(() => layout('project'), TypeError);
  assert.throws(() => layout(['a', 'a']), RangeError);
  assert.throws(() => layout([{}]), TypeError);
  assert.throws(() => layout([NaN]), TypeError);
  for (const options of [{ aspect: 0 }, { aspect: Infinity }, { gap: -1 }, { hubRadius: NaN }, { padding: -1 }, { nodeWidth: 0 }, { nodeHeight: '900' }, { gateOffset: 501, nodeWidth: 1000 }]) {
    assert.throws(() => layout(['a'], options), RangeError);
  }
  assert.throws(() => layout([], null), TypeError);
});

test('browser global and CommonJS expose the same dependency-free API', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/atlas-layout.js'), 'utf8'), context);
  assert.deepEqual(Object.keys(context.window.CovenAtlasLayout).sort(), ['layout', 'missionGrid', 'missionPacking', 'taskPacking']);
  assert.equal(JSON.stringify(context.window.CovenAtlasLayout.layout(['a', 'b'])), JSON.stringify(layout(['a', 'b'])));
});

for (const count of [0, 1, 2, 3, 4, 7, 8, 9, 24, 128, 1000000]) {
  test('mission packing N=' + count + ' bounds visual detail without losing counts', () => {
    const result = missionPacking(count);
    assert.equal(result.total, count);
    assert.equal(result.visible + result.hidden, count);
    assert.equal(result.items.length, Math.min(count, 8));
    assert.ok(result.items.length <= 8);
    assert.deepEqual(result.items.map(item => item.index), Array.from({ length: result.visible }, (_, i) => i));
    if (count > 8) assert.equal(result.more.count, count - 8);
    else assert.equal(result.more, null);
    const positions = result.items.concat(result.more ? [result.more] : []);
    for (let i = 0; i < positions.length; i++) {
      const a = positions[i];
      assert.ok([a.x, a.y, result.sealRadius].every(Number.isFinite));
      assert.ok(Math.hypot(a.x, a.y) <= 150 + EPSILON, 'centers stay in the requested packing radius');
      for (let j = i + 1; j < positions.length; j++) {
        assert.ok(Math.hypot(a.x - positions[j].x, a.y - positions[j].y) > result.sealRadius * 2 + EPSILON, 'recommended seal discs have a real gap');
      }
    }
    assert.deepEqual(missionPacking(count), result);
  });
}

test('mission packing supports a stricter visual limit but never exceeds eight', () => {
  assert.equal(missionPacking(40, { limit: 4 }).hidden, 36);
  assert.equal(missionPacking(40, { limit: 100 }).visible, 8);
  const onlyMore = missionPacking(40, { limit: 0 });
  assert.equal(onlyMore.items.length, 0);
  assert.deepEqual(onlyMore.more, { count: 40, x: 0, y: 0 });
  assert.throws(() => missionPacking(-1), RangeError);
  assert.throws(() => missionPacking(1.5), RangeError);
  assert.throws(() => missionPacking(Number.MAX_SAFE_INTEGER + 1), RangeError);
  assert.throws(() => missionPacking(3, { radius: 0 }), RangeError);
});

test('task regions tile the whole plane in proportion to staffing and contain every agent', () => {
  const bounds = {x: -30, y: 80, width: 72, height: 59};
  for (const counts of [[], [1], [7, 5], [1, 30, 2, 1], Array(64).fill(1), [256, 1]]) {
    const regions = taskPacking(counts, bounds), total = counts.reduce((sum, count) => sum + count, 0);
    assert.equal(regions.length, counts.length);
    assert.deepEqual(regions, taskPacking(counts, bounds));
    regions.forEach((r, i) => {
      assert.ok(Math.abs(r.width * r.height / (bounds.width * bounds.height) - counts[i] / total) < 1e-10);
      assert.ok(r.x >= bounds.x && r.x + r.width <= bounds.x + bounds.width + 1e-8);
      assert.ok(r.y >= bounds.y && r.y + r.height <= bounds.y + bounds.height + 1e-8);
      for (const other of regions.slice(0, i)) {
        const overlapX = Math.min(r.x + r.width, other.x + other.width) - Math.max(r.x, other.x);
        const overlapY = Math.min(r.y + r.height, other.y + other.height) - Math.max(r.y, other.y);
        assert.ok(overlapX < 1e-8 || overlapY < 1e-8);
      }
      assert.equal(r.cells.length, counts[i]);
      assert.equal(new Set(r.cells.map(cell => cell.radius)).size, 1, 'a short row keeps the same agent size');
      const positions = new Set();
      for (const c of r.cells) {
        assert.ok(c.radius > 0 && c.x - c.radius >= r.x && c.x + c.radius <= r.x + r.width);
        assert.ok(c.y - c.radius >= r.y + r.labelHeight && c.y + c.radius <= r.y + r.height);
        positions.add(c.x + ',' + c.y);
      }
      assert.equal(positions.size, counts[i]);
    });
  }
});

test('mission grid reserves Psyche and preserves occupied cells as missions are added', () => {
  const full = missionGrid(128);
  assert.equal(new Set(full.map(p => p.x + ',' + p.y)).size, full.length);
  assert.ok(full.every(p => (p.x || p.y) && Number.isInteger(p.x) && Number.isInteger(p.y)));
  for (const count of COUNTS) assert.deepEqual(missionGrid(count), full.slice(0, count));
  assert.throws(() => missionGrid(-1), RangeError);
});

test('node and route gates can be updated independently for mixed Project keys', () => {
  const world = layout([1, '1']);
  assert.deepEqual(world.routes.map(route => route.key), [1, '1']);
  for (const [index, node] of world.nodes.entries()) {
    assert.deepEqual(node.gate, world.routes[index].gate);
    assert.notEqual(node.gate, world.routes[index].gate);
  }
});
