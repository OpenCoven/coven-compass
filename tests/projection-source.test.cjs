'use strict';
// The projection seam: explicit mode selection, the simulation and fixture sources, the
// fixture's explicit fresh/stale/reconciling/unavailable states, and the index.html guard
// that stops the simulation from booting in any other mode.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../dist/projection-source.js');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../dist/fixtures/cave-projects-list.json'), 'utf8'));
const index = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
const NOW = Date.UTC(2026, 10, 19, 12, 0, 0);
const read = (scenario, load = () => fixture) => P.createFixtureSource({scenario, load, now: () => NOW}).read();

test('mode is explicit: no parameter is the simulation, unknown values are invalid, never simulation', () => {
  assert.deepEqual(P.selectMode(''), {mode: 'simulation', requested: null, scenario: null, explicit: false});
  assert.equal(P.selectMode('?source=simulation').mode, 'simulation');
  assert.deepEqual(P.selectMode('?source=fixture'), {mode: 'fixture', requested: 'fixture', scenario: 'fresh', explicit: true});
  assert.equal(P.selectMode('?source=Fixture&scenario=stale').scenario, 'stale');
  for (const value of ['live', 'daemon', '', 'simulation2']) {
    assert.equal(P.selectMode(`?source=${value}`).mode, 'invalid', value);
  }
});

test('simulation source wraps the existing snapshot and is labelled simulated, never authoritative', async () => {
  let calls = 0;
  const source = P.createSimulationSource({snapshot: () => {
    calls++;
    return {projects: [{key: 'Northwatch', missions: 3, agents: 40, needs: 1}, {key: 'Saltmarsh', missions: 0, agents: 0, needs: 0}]};
  }});
  assert.equal(calls, 0, 'creating the source must not read the simulation');
  const p = await source.read();
  assert.equal(calls, 1);
  assert.equal(p.schema, P.SCHEMA);
  assert.deepEqual(p.source, {kind: 'simulation', label: 'Local simulation', authoritative: false});
  assert.equal(p.availability.state, 'simulated');
  assert.equal(p.complete, true);
  assert.deepEqual(p.projects[0], {id: 'Northwatch', name: 'Northwatch', root: null, missions: 3, agents: 40, needs: 1});
  assert.equal(p.projects[1].missions, 0, 'a real simulated zero stays zero');
});

test('fresh fixture follows keyset pages and keeps id, name, and root separate', async () => {
  const p = await read('fresh');
  assert.equal(p.availability.state, 'fresh');
  assert.equal(p.source.authoritative, false);
  assert.equal(p.complete, true);
  assert.equal(p.freshness.ageMs, 5000);
  assert.equal(p.freshness.staleAfterMs, 60000);
  assert.equal(p.freshness.observedAt, new Date(NOW - 5000).toISOString());
  assert.deepEqual(p.projects.map(x => x.name), ['Compass', 'Cave', 'Psyche Build']);
  assert.deepEqual(p.projects[0], {id: 'fxtA1b2C3d4', name: 'Compass', root: '/fixture/workspace/coven-compass', missions: null, agents: null, needs: null});
  assert.match(p.availability.message, /not live/);
});

test('counts projects.list cannot supply are unknown, not zero', async () => {
  const d = P.describe(await read('fresh'));
  for (const row of d.rows) for (const key of ['missions', 'agents', 'needs']) assert.equal(row[key], 'unknown');
});

test('stale fixture keeps last-known Projects but says they are not current', async () => {
  const p = await read('stale');
  assert.equal(p.availability.state, 'stale');
  assert.equal(p.availability.reason, 'aged');
  assert.equal(p.projects.length, 1);
  assert.match(p.availability.message, /15 min ago/);
  assert.match(p.availability.message, /not current/);
  assert.equal(P.describe(p).label, 'Fixture · stale');
});

test('an unfollowable cursor makes the list reconciling and incomplete', async () => {
  const p = await read('partial');
  assert.equal(p.availability.state, 'reconciling');
  assert.equal(p.complete, false);
  assert.match(p.availability.message, /incomplete/);
  assert.match(p.availability.message, /total is unknown/);
});

test('disconnected and unsupported versions are unavailable, with no Projects shown', async () => {
  const disconnected = await read('disconnected');
  assert.equal(disconnected.availability.state, 'unavailable');
  assert.equal(disconnected.availability.reason, 'disconnected');
  assert.deepEqual(disconnected.projects, []);
  assert.match(disconnected.availability.message, /no sample data is substituted/);
  const version = await read('unsupported-version');
  assert.equal(version.availability.state, 'unavailable');
  assert.equal(version.availability.reason, 'unsupported_version');
  assert.match(version.availability.message, /"2\.0"/);
  assert.deepEqual(version.projects, []);
});

test('load failures, bad shapes, unknown scenarios, and version gates never yield data', async () => {
  const failed = await read('fresh', () => { throw new Error('HTTP 404'); });
  assert.equal(failed.availability.reason, 'fixture_unreadable');
  assert.match(failed.availability.message, /HTTP 404/);
  assert.equal((await read('fresh', () => ({}))).availability.reason, 'fixture_invalid');
  assert.equal((await read('nope')).availability.reason, 'unknown_scenario');
  const page = (extra) => ({'': {apiVersion: '1.0', minimumClientVersion: '0.0.1', projects: [], nextCursor: null, ...extra}});
  assert.equal(P.fromProjectsList(page({minimumClientVersion: '9.0.0'}), {}).availability.reason, 'incompatible_version');
  assert.equal(P.fromProjectsList(page({projects: [{id: 'a', name: 'A', root: ''}]}), {}).availability.reason, 'fixture_invalid');
  assert.equal(P.fromProjectsList(page({projects: [{id: 'a', name: 'A', root: '/r'}, {id: 'a', name: 'B', root: '/s'}]}), {}).availability.reason, 'fixture_invalid');
  assert.equal(P.fromProjectsList(page({apiVersion: 'one'}), {}).availability.reason, 'unsupported_version');
});

test('without an observation time a complete list is stale, not fresh', () => {
  const p = P.fromProjectsList({'': {apiVersion: '1.0', projects: [{id: 'a', name: 'A', root: '/r'}], nextCursor: null}}, {now: NOW, staleAfterMs: 60000});
  assert.equal(p.availability.state, 'stale');
  assert.equal(p.availability.reason, 'unknown_age');
});

test('a cursor cycle stops paging and reports the list as incomplete', () => {
  const pages = {
    '': {apiVersion: '1.0', projects: [{id: 'a', name: 'A', root: '/a'}], nextCursor: 'b'},
    b: {apiVersion: '1.0', projects: [{id: 'b', name: 'B', root: '/b'}], nextCursor: ''},
  };
  const p = P.fromProjectsList(pages, {now: NOW, observedAt: NOW, staleAfterMs: 60000});
  assert.equal(p.availability.state, 'reconciling');
  assert.deepEqual(p.projects.map(x => x.id), ['a', 'b']);
});

test('every fixture scenario maps to a distinct explicit state', async () => {
  const states = {};
  for (const name of Object.keys(fixture.scenarios)) states[name] = (await read(name)).availability.state;
  assert.deepEqual(states, {fresh: 'fresh', stale: 'stale', partial: 'reconciling', disconnected: 'unavailable', 'unsupported-version': 'unavailable'});
  assert.match(fixture.about, /^STATIC FIXTURE\. Not live data/);
});

test('index.html stops before the simulation boots in any non-simulation mode', () => {
  const script = index.indexOf('<script src="projection-source.js"></script>');
  const inline = index.indexOf('<script>\n(() => {');
  assert.ok(script > 0 && script < inline, 'projection-source.js loads before the inline application script');
  const body = index.slice(inline + '<script>\n(() => {'.length);
  const guard = body.indexOf("const requestedSource = new URLSearchParams(location.search).get('source');");
  const firstSimulation = body.indexOf('const NS =');
  assert.ok(guard >= 0 && guard < firstSimulation, 'the guard is the first thing the application script does');
  const block = body.slice(guard, firstSimulation);
  assert.match(block, /requestedSource !== null && requestedSource\.trim\(\)\.toLowerCase\(\) !== 'simulation'/);
  assert.match(block, /renderStandalone\(/);
  assert.match(block, /\n {2}return;\n\}/, 'non-simulation modes return before the simulation');
  assert.match(block, /did not load\. No sample data is shown\./, 'a missing module still does not fall back to the simulation');
  assert.match(index, /register\(window\.CovenProjection\.createSimulationSource\(\{snapshot: \(\) => atlasSnapshot\(false\)\}\)\)/);
});

function fakeDocument() {
  const make = tag => {
    const node = {tagName: tag.toUpperCase(), attributes: {}, children: [], hidden: false, _text: '',
      setAttribute(k, v) { this.attributes[k] = String(v); }, getAttribute(k) { return this.attributes[k]; },
      removeAttribute(k) { delete this.attributes[k]; }, appendChild(c) { this.children.push(c); return c; },
      get textContent() { return this._text + this.children.map(c => c.textContent).join(''); },
      set textContent(v) { this._text = String(v); this.children = []; }};
    return node;
  };
  const app = make('div');
  const doc = {head: make('head'), body: make('body'), createElement: make,
    createTextNode: text => ({textContent: text}), getElementById: id => (id === 'app' ? app : null), defaultView: {}};
  return {doc, app};
}
const find = (node, pred) => pred(node) ? node : (node.children || []).map(c => find(c, pred)).find(Boolean) || null;

test('the standalone view hides the simulation app and renders the state explicitly', async () => {
  for (const [scenario, state, rows] of [['fresh', 'fresh', 3], ['disconnected', 'unavailable', 0], ['partial', 'reconciling', 1]]) {
    const {doc, app} = fakeDocument();
    await P.renderStandalone(doc, P.selectMode(`?source=fixture&scenario=${scenario}`), {load: () => fixture, now: () => NOW});
    assert.equal(app.hidden, true, 'the simulation UI is hidden');
    assert.equal(doc.body.getAttribute('data-projection-mode'), 'fixture');
    const status = find(doc.body, n => n.attributes && n.attributes.role === 'status');
    assert.equal(status.getAttribute('data-state'), state, scenario);
    assert.match(status.textContent, /not authoritative/);
    const table = find(doc.body, n => n.tagName === 'TABLE');
    assert.equal(table.children.filter(c => c.tagName === 'TR').length, rows ? rows + 1 : 0, scenario);
    assert.equal(rows ? table.getAttribute('hidden') : '', rows ? undefined : '');
    assert.equal(P.current().kind, 'fixture');
  }
});

test('an invalid mode renders unavailable and never reads a source with data', async () => {
  const {doc, app} = fakeDocument();
  const p = await P.renderStandalone(doc, P.selectMode('?source=live'), {});
  assert.equal(app.hidden, true);
  assert.equal(p.availability.state, 'unavailable');
  assert.equal(p.availability.reason, 'invalid_mode');
  assert.deepEqual(p.projects, []);
  assert.match(find(doc.body, n => n.attributes && n.attributes.role === 'status').textContent, /Requested "live"/);
});
