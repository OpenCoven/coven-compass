'use strict';
// Castle → Project join (#20, blocked on D01). The data below is a synthetic fixture: no issuer
// is chosen, and `fixture.invalid/projects` is not a real registry. The rule under test: a
// Castle joins a Project only on an exact {source, ref} match, and is otherwise reported as
// unlinked, invalid, ambiguous, unresolved or unknown. It is never guessed.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../dist/projection-source.js');

const SRC = 'fixture.invalid/projects';
const ref = (r, source = SRC) => ({source, ref: r});
const projects = [
  {id: 'p-north', name: 'Northwatch', root: '/work/northwatch', reference: ref('synthetic:north')},
  {id: 'p-salt', name: 'Saltmarsh', root: '/work/saltmarsh', reference: ref('synthetic:salt')},
  {id: 'p-plain', name: 'demo', root: '/work/demo'},  // no reference from its adapter
];
const status = (result) => Object.fromEntries(result.castles.map((c) => [c.key, [c.status, c.projectId]]));

test('an exact {source, ref} match links the Castle; the key keeps its backend namespace', () => {
  const r = P.joinCastles(projects, [
    {backend: 'host', id: 'demo', project: ref('synthetic:north')},
    {backend: 'castles', id: 'demo', project: ref('synthetic:north')},
    {backend: 'castles', id: 'sbx-2', project: ref('synthetic:salt')},
  ], {complete: true});
  assert.deepEqual(status(r), {
    'host:demo': ['linked', 'p-north'], 'castles:demo': ['linked', 'p-north'], 'castles:sbx-2': ['linked', 'p-salt'],
  });
  assert.deepEqual(r.byProject, {'p-north': ['host:demo', 'castles:demo'], 'p-salt': ['castles:sbx-2']});
});

test('a Castle without a reference is unlinked, even when its ID matches a Project name or root', () => {
  const r = P.joinCastles(projects, [
    {backend: 'host', id: 'demo'},
    {backend: 'host', id: 'Northwatch'},
    {backend: 'castles', id: '/work/saltmarsh'},
  ], {complete: true});
  for (const c of r.castles) assert.deepEqual([c.status, c.projectId], ['unlinked', null], c.key);
  assert.deepEqual(r.byProject, {});
});

test('comparison is exact: no trimming, case folding, bare-ref or cross-source matches', () => {
  const r = P.joinCastles(projects, [
    {backend: 'c', id: 'case', project: ref('Synthetic:North')},
    {backend: 'c', id: 'space', project: ref('synthetic:north ')},
    {backend: 'c', id: 'other-issuer', project: ref('synthetic:north', 'fixture.invalid/other')},
    {backend: 'c', id: 'source-case', project: ref('synthetic:north', SRC.toUpperCase())},
  ], {complete: true});
  for (const c of r.castles) assert.equal(c.status, 'unresolved', c.key);
  assert.deepEqual(r.byProject, {});
});

test('a malformed reference is an association diagnostic, not a join and not a failure', () => {
  const bad = [null, 'synthetic:north', 42, [], {}, {source: SRC}, {ref: 'synthetic:north'},
    {source: '', ref: 'x'}, {source: SRC, ref: ''}, {source: SRC, ref: 'a\u0000b'},
    {source: SRC, ref: 'é'.repeat(P.REFERENCE_MAX_BYTES / 2 + 1)}, {source: SRC, ref: 7}];
  const r = P.joinCastles(projects, bad.map((project, i) => ({backend: 'c', id: `bad-${i}`, project})), {complete: true});
  for (const c of r.castles) assert.deepEqual([c.status, c.projectId], ['invalid', null], c.key);
  // The byte bound is UTF-8 bytes, not characters: exactly 512 bytes is accepted.
  const edge = P.joinCastles([{id: 'p-edge', reference: ref('é'.repeat(256))}],
    [{backend: 'c', id: 'edge', project: ref('é'.repeat(256))}], {complete: true});
  assert.equal(edge.castles[0].status, 'linked');
});

test('a reference that several Projects share is ambiguous, never first-match', () => {
  const twins = [...projects, {id: 'p-twin', reference: ref('synthetic:north')}];
  const r = P.joinCastles(twins, [{backend: 'c', id: 'x', project: ref('synthetic:north')}], {complete: true});
  assert.deepEqual(status(r), {'c:x': ['ambiguous', null]});
  assert.deepEqual(r.byProject, {});
  // The same Project listed twice is not a second Project.
  const repeated = P.joinCastles([...projects, projects[0]], [{backend: 'c', id: 'x', project: ref('synthetic:north')}], {complete: true});
  assert.deepEqual(status(repeated), {'c:x': ['linked', 'p-north']});
});

test('no match is unresolved only after a complete read; a partial read reports unknown', () => {
  const castles = [{backend: 'c', id: 'lost', project: ref('synthetic:elsewhere')}];
  assert.equal(P.joinCastles(projects, castles, {complete: true}).castles[0].status, 'unresolved');
  assert.equal(P.joinCastles(projects, castles, {complete: false}).castles[0].status, 'unknown');
  assert.equal(P.joinCastles(projects, castles).castles[0].status, 'unknown', 'complete defaults to false');
});

test('a Project without a reference never collects Castles, and the join never adds a Project', () => {
  const r = P.joinCastles(projects, [{backend: 'host', id: 'demo', project: {source: SRC, ref: 'p-plain'}}], {complete: true});
  assert.deepEqual(status(r), {'host:demo': ['unresolved', null]}, 'a Project id is not a reference');
  assert.ok(!('p-plain' in r.byProject));
  assert.equal(P.joinCastles([], [], {complete: true}).castles.length, 0);
  assert.deepEqual(Object.keys(P.joinCastles(projects, [], {complete: true})), ['castles', 'byProject']);
});

test('the join is not wired into any live source or the map yet', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const index = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
  assert.ok(!index.includes('joinCastles'), 'index.html must not call joinCastles before D01');
  const src = fs.readFileSync(path.join(__dirname, '../dist/projection-source.js'), 'utf8');
  assert.equal(src.split('joinCastles(').length - 1, 2, 'defined and documented once; no source calls it');
});
