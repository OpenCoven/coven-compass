// Guard the canonical mark and flat badge used at both map scopes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = name => readFileSync(new URL('../dist/' + name, import.meta.url), 'utf8');
const symbol = source('index.html').match(/<symbol id="crown"[^>]*>[\s\S]*?<\/symbol>/)?.[0];
assert.match(symbol, /viewBox="409 391 1232 1137"/);
assert.match(symbol, /fill-rule="evenodd"/);
const path = symbol.match(/\bd="([^"]+)"/)[1];
assert.equal(createHash('sha256').update(path).digest('hex'), '430b74090c1e170575e26aa2c6af49e90d6a9359f1f356a4e76521266322fd32');
const context = {window: {}};
vm.runInNewContext(source('atlas-crown.js'), context);
const api = context.window.CovenAtlasCrown;
function svg(tag, attrs, parent) {
  const node = {tag, attrs, children: [], setAttribute(key, value) { this.attrs[key] = value; }};
  parent.children.push(node);
  return node;
}
const parent = {children: []}, badge = api.create(parent, svg);
assert.deepEqual(badge.children.map(el => el.tag), ['circle', 'use', 'text']);
const [circle, crown, label] = badge.children;
assert.equal(circle.attrs.r, 50);
assert.equal(crown.attrs.href, '#crown');
assert.equal(label.textContent, 'Psyche');
assert.ok(crown.attrs.y + crown.attrs.height < label.attrs.y);
assert.equal(label.attrs['text-anchor'], 'middle');
let combinations = 0;
for (const [x, y] of [[0, 0], [-400, 370], [550, -80]]) {
  for (const radius of [25, 41, 118, 440]) {
    api.draw(badge, {x, y, radius});
    assert.equal(badge.attrs.transform, `translate(${x} ${y}) scale(${radius / 50})`);
    assert.equal(badge.children.length, 3);
    combinations++;
  }
}
console.log(`Crown checks passed: canonical path digest, ${combinations} view/size combinations, single circular badge and readable lower label.`);
