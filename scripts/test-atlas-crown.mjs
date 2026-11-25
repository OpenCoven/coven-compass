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
  const node = {tag, attrs, children: [], setAttribute(key, value) { this.attrs[key] = String(value); }};
  parent.children.push(node);
  return node;
}
const parent = {children: [], setAttribute(key, value) { this[key] = value; }};
const marker = api.create(parent, svg), crown = marker.artwork.children.find(el => el.tag === 'use');
assert.equal(crown.attrs.href, '#crown');
assert.ok(marker.work.attrs.r < marker.attention.attrs.r);
for (const [work, agents, waiting, missions, inner, outer] of [[0, 0, 0, 0, 0, 0], [3, 4, 1, 2, 75, 50], [4, 4, 0, 2, 100, 0]]) {
  api.update(marker, 'Project', work, agents, waiting, missions);
  assert.equal(parseFloat(marker.work.attrs['stroke-dasharray']), inner);
  assert.equal(parseFloat(marker.attention.attrs['stroke-dasharray']), outer);
  assert.ok(parent['aria-label'].includes(waiting + ' of ' + missions + ' missions waiting'));
}
let combinations = 0;
for (const [x, y] of [[0, 0], [-400, 370], [550, -80]]) {
  for (const screenScale of [.03, .5, 1, 5]) {
    const radius = 36 * screenScale;
    api.draw(marker, {x, y, screenScale, radius});
    assert.equal(marker.badge.attrs.transform, `translate(${x} ${y}) scale(${1 / screenScale})`);
    assert.equal(marker.artwork.attrs.transform, `scale(${radius / 32})`);
    assert.equal(marker.hit.attrs.r, String(Math.max(22, radius)));
    assert.equal(marker.artwork.children.length, 6);
    combinations++;
  }
}
console.log(`Crown checks passed: canonical path digest, ${combinations} view/size combinations, activity and attention fractions, target and accessible description.`);
