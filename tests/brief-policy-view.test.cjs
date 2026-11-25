'use strict';
// The Brief success policy panel (#35 proposal), rendered into a DOM facade: no browser or layout.
// It checks that the four states stay separate, that acceptance is never shown as recorded, and how the
// simulation inspector and the Brief form wire the panel in.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const B = require('../dist/brief-policy.js');
const V = require('../dist/brief-policy-view.js');
const P = require('../dist/projection-source.js');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const fixture = JSON.parse(read('dist/fixtures/brief-policy-cases.json'));
const index = read('dist/index.html');

// A minimal element: enough of the DOM for the view, and a way to read the tree back as text.
function element(tag) {
  const node = {tagName: tag.toUpperCase(), className: '', children: [], attributes: {}, dataset: {}, _text: '',
    get textContent() { return this._text + this.children.map(c => c.textContent).join(' '); },
    set textContent(v) { this._text = String(v); this.children = []; },
    appendChild(c) { this.children.push(c); return c; },
    append(...cs) { cs.forEach(c => this.children.push(typeof c === 'string' ? text(c) : c)); },
    setAttribute(k, v) { this.attributes[k] = String(v); },
  };
  return node;
}
const text = s => ({tagName: '#text', children: [], textContent: s});
const doc = {createElement: element, createTextNode: text};
const all = (n, out = []) => { out.push(n); (n.children || []).forEach(c => all(c, out)); return out; };
const byClass = (n, cls) => all(n).filter(x => (' ' + (x.className || '') + ' ').includes(' ' + cls + ' '));
const words = n => n.textContent.replace(/\s+/g, ' ').trim();

function renderCase(id) {
  const p = P.fromBriefCases(fixture, id, B);
  return V.render(doc, {policy: p.brief.policy, result: p.brief.result, summary: p.brief.policySummary, origin: 'synthetic'});
}

test('every synthetic case shows the four states apart, with acceptance not recorded', () => {
  for (const id of Object.keys(fixture.cases)) {
    const panel = renderCase(id);
    const steps = byClass(panel, 'bp-step').map(s => words(s.children[0]));
    assert.deepEqual(steps, ['Proposal', 'Execution', 'Quality qualification', 'Accepted completion'], id);
    const accepted = byClass(panel, 'bp-step')[3];
    assert.match(words(accepted), /^Accepted completion Not recorded/, id);
    assert.match(words(panel), /Synthetic fixture · proposal \(#35\)/, id);
    assert.doesNotMatch(words(panel).replace(/Accepted completion/g, ''), /\bAccepted\b/, id + ' never presents acceptance as a state');
  }
});

test('the panel shows the four policy sections, the summary and the next permitted action', () => {
  const panel = renderCase('brief-rubric-fail');
  assert.deepEqual(byClass(panel, 'bp-sec').map(s => words(s.children[0].children[0])),
    ['Required conditions', 'Quality rubric', 'Iteration limits', 'Outcome targets']);
  assert.match(words(byClass(panel, 'bp-summary')[0]), /^Eligible for acceptance only when/);
  const next = byClass(panel, 'bp-next')[0];
  assert.match(next.className, /is-request-bounded-revision/);
  assert.match(words(next), /Request a bounded revision/);
  assert.match(words(next), /Display only/);
  assert.match(words(panel), /#37/);
});

test('an eligible case reads as eligible but not accepted', () => {
  const quality = byClass(renderCase('brief-rubric-pass'), 'bp-step')[2];
  assert.match(quality.className, /is-met/);
  assert.match(words(quality), /Eligible for acceptance\. Not accepted\./);
});

test('stale and ignored evaluations stay listed with why they do not count', () => {
  const panel = renderCase('brief-stale-evaluation');
  const rows = byClass(panel, 'bp-eval').map(words);
  assert.equal(rows.length, 2);
  assert.match(rows[0], /ver_1 · not counted: graded against another policy revision/);
  assert.match(rows[1], /ver_2 · not counted: graded a different candidate/);
  assert.match(words(byClass(renderCase('brief-missing-evidence'), 'bp-evals')[0]), /ver_2 · not counted: cites no sealed evidence/);
});

test('the simulation panel says its counters are not sealed evidence', () => {
  const brief = {deliver: [{kind: 'report', formats: ['md'], langs: []}], atLeast: {tests: 40}, atMost: {usd: 8}, measure: []};
  const pol = B.fromBrief(brief);
  const panel = V.render(doc, {policy: pol, result: B.evaluate(pol, {candidate: null, attempts: [], evaluations: []}, null), summary: B.summarize(pol), origin: 'simulation'});
  assert.match(words(panel), /Simulation · proposal \(#35\)/);
  assert.match(words(panel), /simulated progress, not sealed evidence/);
  assert.match(words(panel), /Wait for evidence/);
  assert.match(words(panel), /no limit set/);
  assert.match(words(byClass(panel, 'bp-step')[1]), /No attempt records/);
});

test('fixture text is never parsed as HTML', () => {
  assert.doesNotMatch(read('dist/brief-policy-view.js').replace(/^\s*\*.*$/gm, ''), /innerHTML|insertAdjacentHTML/);
});

test('the inspector and Brief form wire in the panel with no evaluations and no acceptance', () => {
  assert.ok(index.indexOf('<script src="brief-policy-view.js"></script>') > index.indexOf('<script src="brief-policy.js"></script>'));
  assert.match(index, /<link rel="stylesheet" href="brief-policy\.css">/);
  const call = index.slice(index.indexOf('const BP = window.CovenBriefPolicy'), index.indexOf("origin: 'simulation'}));") + 30);
  assert.match(call, /evaluate\(pol, \{candidate: null, attempts: \[\], evaluations: \[\], authorization: null, cancelled: false\}, null\)/);
  assert.doesNotMatch(call, /acceptance|accepted/i);
  assert.match(index, /done\.id = 'nmDone'/);
  assert.match(index, /When is it done\? /);
});
