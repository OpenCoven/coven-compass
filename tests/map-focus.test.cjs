'use strict';
// The map as one Tab stop (roving tabindex), in a DOM facade: no browser or layout.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const F = require('../dist/map-focus.js');

const index = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');

function world(n, hidden = []) {
  const listeners = {};
  let active = null;
  const items = Array.from({length: n}, (_, i) => {
    const el = {id: 'i' + i, attrs: {'data-map-item': ''}, isConnected: true, hidden: hidden.includes(i),
      getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }, setAttribute(k, v) { this.attrs[k] = String(v); },
      closest(sel) { return sel === F.ITEM ? this : sel === '[aria-hidden="true"]' && this.attrs['aria-hidden'] === 'true' ? this : null; },
      getClientRects() { return this.hidden ? [] : [{}]; }, focus() { active = this; }};
    return el;
  });
  const container = {addEventListener(t, fn) { listeners[t] = fn; }, removeEventListener() {},
    querySelectorAll() { return items.filter(x => x.isConnected); }};
  const key = (target, k, mods = {}) => { let prevented = false;
    listeners.keydown({target, key: k, ...mods, preventDefault() { prevented = true; }, stopPropagation() {}}); return prevented; };
  return {items, container, key, focusin: target => listeners.focusin({target}), active: () => active};
}
const stops = items => items.filter(x => x.isConnected && x.getAttribute('tabindex') === '0').map(x => x.id);

test('exactly one map item is a Tab stop, the first eligible one by default', () => {
  const w = world(5, [0]);
  const f = F.create(w.container);
  f.sync();
  assert.deepEqual(stops(w.items), ['i1'], 'the hidden first item is skipped');
  assert.ok(w.items.every(x => x.getAttribute('tabindex') !== null));
});

test('arrow keys, Home and End move focus and carry the single Tab stop', () => {
  const w = world(4);
  const f = F.create(w.container); f.sync();
  assert.equal(w.key(w.items[0], 'ArrowRight'), true);
  assert.equal(w.active(), w.items[1]);
  assert.deepEqual(stops(w.items), ['i1']);
  w.key(w.items[1], 'ArrowDown'); assert.equal(w.active(), w.items[2]);
  w.key(w.items[2], 'ArrowLeft'); assert.equal(w.active(), w.items[1]);
  w.key(w.items[1], 'End'); assert.equal(w.active(), w.items[3]);
  w.key(w.items[3], 'ArrowRight'); assert.equal(w.active(), w.items[3], 'no wrap at the end');
  w.key(w.items[3], 'Home'); assert.equal(w.active(), w.items[0]);
  w.key(w.items[0], 'ArrowUp'); assert.equal(w.active(), w.items[0], 'no wrap at the start');
  assert.deepEqual(stops(w.items), ['i0']);
});

test('modifier arrows and other keys are left to the stage and the item', () => {
  const w = world(3);
  const f = F.create(w.container); f.sync();
  for (const mods of [{shiftKey: true}, {altKey: true}, {ctrlKey: true}, {metaKey: true}]) {
    assert.equal(w.key(w.items[0], 'ArrowRight', mods), false, JSON.stringify(mods));
  }
  assert.equal(w.key(w.items[0], 'Enter'), false, 'Enter stays with the item\'s own handler');
  assert.deepEqual(stops(w.items), ['i0']);
});

test('focusing an item by pointer or code makes it the Tab stop; losing it falls back to the first', () => {
  const w = world(4);
  const f = F.create(w.container); f.sync();
  w.focusin(w.items[2]);
  assert.deepEqual(stops(w.items), ['i2']);
  w.items[2].isConnected = false; f.sync();
  assert.deepEqual(stops(w.items), ['i0']);
  w.items[0].setAttribute('aria-hidden', 'true'); f.sync();
  assert.deepEqual(stops(w.items), ['i1'], 'an aria-hidden item is never the Tab stop');
});

test('the page routes every map item through the roving manager', () => {
  assert.ok(index.indexOf('<script src="map-focus.js"></script>') > 0);
  const helper = index.slice(index.indexOf('function atlasFocusable('), index.indexOf('function atlasFocusable(') + 400);
  assert.match(helper, /setAttribute\('tabindex', '-1'\)/);
  assert.match(helper, /data-map-item/);
  assert.doesNotMatch(index, /L\.decision\.setAttribute\('tabindex'/, 'compact decisions are skipped through aria-hidden, not a second tabindex rule');
  assert.match(index, /<svg id="plan"[^>]*role="group"[^>]*Arrow keys move between items/);
});
