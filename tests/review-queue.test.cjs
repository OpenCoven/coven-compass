const test = require('node:test');
const assert = require('node:assert/strict');
const {pending, rows} = require('../dist/review-queue.js');

function project(name, status = 'open') {
  const request = {id: 'q/1', mission: 'm/1', title: 'Send report', fam: 'echo', status};
  return {world: {asks: new Map([[request.id, request]]), missions: new Map([['m/1', {name}]])}};
}

test('request keys distinguish Projects with identical local mission and request IDs', () => {
  const projects = {beta: project('Second'), alpha: project('First')};
  const items = rows(projects, () => 'Echo');
  assert.deepEqual(items.map(r => [r.project, r.mission, r.familiar, JSON.parse(r.key)]), [
    ['alpha', 'First', 'Echo', ['alpha', 'q/1']], ['beta', 'Second', 'Echo', ['beta', 'q/1']]
  ]);
  projects.alpha.world.asks.get('q/1').status = 'held';
  assert.deepEqual(rows(projects, () => 'Echo'), items.slice(1));
  assert.equal(pending(projects.alpha.world).length, 0);
});

test('empty and unattributed requests follow the replayed worlds', () => {
  assert.deepEqual(rows({}, String), []);
  const p = project('Review');
  p.world.asks = new Map([['q', {id: 'q', title: 'Review this', status: 'open'}]]);
  const [row] = rows({p}, () => assert.fail('No familiar was supplied'));
  assert.deepEqual([row.mission, row.familiar, row.title], ['', '', 'Review this']);
  p.world = project('Review', 'allowed').world;
  assert.deepEqual(rows({p}, String), []);
});

test('mission review scopes by Project and opaque mission ID even when display names match', () => {
  const alpha = project('Proof');
  alpha.world.missions.set('other', {name: 'Proof'});
  alpha.world.asks.set('other-ask', {id: 'other-ask', mission: 'other', title: 'Send report', status: 'open'});
  const projects = {alpha, beta: project('Proof')}, scope = {project: 'alpha', mission: 'm/1'};
  assert.deepEqual(rows(projects, String, scope).map(r => [r.project, r.id]), [['alpha', 'q/1']]);
  alpha.world.asks.get('q/1').status = 'held';
  assert.deepEqual(rows(projects, String, scope), []);
});
