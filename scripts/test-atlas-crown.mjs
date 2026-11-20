// Focused geometric checks for the decorative SVG sculpture. No DOM dependency.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const source = readFileSync(new URL('dist/atlas-crown.js', root), 'utf8');
const html = readFileSync(new URL('dist/index.html', root), 'utf8');
const symbol = html.match(/<symbol id="crown"[^>]*>[\s\S]*?<\/symbol>/)?.[0];
assert(symbol, 'Canonical crown must exist.');
assert.match(symbol, /viewBox="409 391 1232 1137"/);
assert.match(symbol, /fill-rule="evenodd"/);
const canonicalPath = symbol.match(/\bd="([^"]+)"/)[1];
assert.equal((canonicalPath.match(/\bM\b/g) || []).length, 2, 'Outer mark and aperture stay distinct.');
const expectedDigest = source.match(/Canonical d SHA-256: ([a-f0-9]{64})/)[1];
assert.equal(createHash('sha256').update(canonicalPath).digest('hex'), expectedDigest,
  'Canonical mark changed: regenerate side samples without replacing the exact front.');

class Element {
  constructor(tag, attributes = {}) {
    this.tagName = tag;
    this.attributes = new Map(Object.entries(attributes).map(([k, v]) => [k, String(v)]));
    this.children = [];
    this.parentNode = null;
  }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  appendChild(node) {
    if (node.parentNode) node.parentNode.children.splice(node.parentNode.children.indexOf(node), 1);
    this.children.push(node);
    node.parentNode = this;
    return node;
  }
}
const make = (tag, attrs, parent) => {
  const node = new Element(tag, attrs);
  if (parent) parent.appendChild(node);
  return node;
};
const context = { window: {} };
vm.runInNewContext(source, context, { filename: fileURLToPath(new URL('dist/atlas-crown.js', root)) });
const api = context.window.CovenAtlasCrown;
assert.equal(typeof api.create, 'function');
assert.equal(typeof api.draw, 'function');
const parent = new Element('g');
const crown = api.create(parent, make);
const all = node => [node, ...node.children.flatMap(all)];
const originalCount = all(parent).length;
assert.equal(crown.g.getAttribute('pointer-events'), 'none');
assert.equal(crown.g.getAttribute('aria-hidden'), 'true');
assert.equal(crown.front.getAttribute('href'), '#psyche-crown');
const faceted = html.match(/<symbol id="psyche-crown"[^>]*>[\s\S]*?<\/symbol>/)?.[0];
assert.match(faceted, /<use href="#crown"/, 'The projected crown retains the canonical silhouette.');
assert.match(faceted, /mask="url\(#psyche-silhouette\)"/, 'Facet ink stays inside the silhouette.');
assert.match(html, /<mask id="psyche-silhouette"[^>]*>\s*<use href="#crown"/);
assert.equal(crown.back.getAttribute('href'), '#crown');
assert.equal(all(parent).filter(node => node.tagName === 'use').length, 2);
assert(crown.edges.some(edge => edge.hole), 'The aperture has its own walls.');
assert(crown.edges.some(edge => !edge.hole), 'The leaves retain their outer walls.');

const numbers = text => (text.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) || []).map(Number);
const matrix = el => numbers(el.getAttribute('transform'));
const project = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
function inside(polygon, point) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > point[1]) !== (yj > point[1]) &&
      point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
const hole = crown.edges.filter(edge => edge.hole).map(edge => edge.a);
const holeCenter = [0, 1].map(axis =>
  (Math.min(...hole.map(p => p[axis])) + Math.max(...hole.map(p => p[axis]))) / 2);
let views = 0;
for (const size of [38, 118, 440]) {
  for (const pitch of [0, 25, 60, 90]) {
    for (const yaw of [-360, -90, 0, 90, 180, 270, 360]) {
      api.draw(crown, { x: 50, y: -30, size, pitch, yaw });
      views++;
      assert.equal(all(parent).length, originalCount, 'Redraw reuses the mesh.');
      assert(crown.bounds.width > 0 && crown.bounds.width <= size * 1.3);
      assert(crown.bounds.height > 0 && crown.bounds.height <= size * 1.3);
      for (const node of all(parent)) {
        for (const [key, value] of node.attributes) {
          if (['d', 'transform', 'x', 'y', 'width', 'height', 'stroke-width'].includes(key)) {
            assert(!/NaN|Infinity|undefined/.test(value), `${key} must be finite.`);
            assert(numbers(value).every(Number.isFinite));
          }
        }
      }
      const front = matrix(crown.front), back = matrix(crown.back);
      assert.deepEqual(front.slice(0, 5), [size, 0, 0, size, 0], 'The front uses the canonical proportions and stays upright.');
      assert.deepEqual(back.slice(0, 5), front.slice(0, 5), 'Depth has no sideways offset.');
      const depth = (back[5] - front[5]) / size;
      assert(depth > 0 && depth <= 0.035, 'Visible depth is shallow at every crown size.');
      const frontCenter = project(front, holeCenter), backCenter = project(back, holeCenter);
      const clearPoint = frontCenter.map((v, i) => (v + backCenter[i]) / 2);
      assert(inside(hole.map(p => project(front, p)), clearPoint));
      assert(inside(hole.map(p => project(back, p)), clearPoint));
      for (const edge of crown.edges.filter(e => e.el.getAttribute('display') !== 'none')) {
        const coords = numbers(edge.el.getAttribute('d'));
        const polygon = [];
        for (let i = 0; i < coords.length; i += 2) polygon.push([coords[i], coords[i + 1]]);
        assert(!inside(polygon, clearPoint), 'The extrusion must leave the central aperture open.');
      }
    }
  }
}
api.draw(crown, { x: 0, y: 0, size: 118, pitch: 0, yaw: 0 });
const faces = [matrix(crown.front), matrix(crown.back)];
const visibleWalls = crown.edges.filter(edge => edge.el.getAttribute('display') === 'inline');
assert(visibleWalls.length > 0);
assert.match(crown.front.getAttribute('fill'), /var\(--primary[,) ]/);
for (const edge of visibleWalls) {
  assert.equal(edge.el.getAttribute('fill'), crown.back.getAttribute('fill'), 'The rim keeps a single rear-face shade.');
  assert.equal(edge.el.getAttribute('stroke'), edge.el.getAttribute('fill'), 'Wall seams use the same color.');
}
api.draw(crown, { x: 20, y: -18, size: 118, pitch: 90, yaw: 90 });
assert.deepEqual([matrix(crown.front), matrix(crown.back)], faces, 'Orbit preserves depth and orientation.');
assert.equal(crown.g.getAttribute('transform'), 'translate(20 -18)', 'The crown still follows the projected scene center.');
for (const view of [{}, { size: 0 }, { size: -1 }, { size: Infinity, pitch: NaN, yaw: Infinity },
  { x: Number.MAX_VALUE, y: -Number.MAX_VALUE, size: Number.MAX_VALUE }]) {
  api.draw(crown, view);
  for (const node of all(parent)) {
    for (const value of node.attributes.values()) assert(!/NaN|Infinity|undefined/.test(value));
  }
  assert(Object.values(crown.bounds).every(Number.isFinite));
}
assert.equal(all(parent).length, originalCount);
assert(!all(parent).some(node => /gradient|filter|animate/i.test(node.tagName)));
console.log(`Crown checks passed: canonical path digest, ${views} view/size combinations, open aperture, finite fallback geometry, stable SVG nodes.`);
