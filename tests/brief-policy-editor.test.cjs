'use strict';
// The success criteria editor in New mission and Edit brief (#35, ported from #42), rendered into a
// DOM facade: no browser or layout. It edits brief.success only. Save stays with the page, which
// blocks it while the criteria don't validate. The editor never grades, emits or records acceptance.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const B = require('../dist/brief-policy.js');
const E = require('../dist/brief-policy-editor.js');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function element(tag) {
  const node = {tagName: tag.toUpperCase(), className: '', children: [], attributes: {}, listeners: {}, parentNode: null, _text: '',
    type: '', value: '', checked: false, rows: 0, id: '',
    get textContent() { return this._text + this.children.map(c => c.textContent).join(' '); },
    set textContent(v) { this._text = String(v); this.children.forEach(c => { c.parentNode = null; }); this.children = []; },
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    append(...cs) { cs.forEach(c => this.appendChild(typeof c === 'string' ? text(c) : c)); },
    replaceChild(next, old) { const i = this.children.indexOf(old); this.children[i] = next; next.parentNode = this; old.parentNode = null; return old; },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    fire(type) { (this.listeners[type] || []).forEach(fn => fn({type, target: this})); },
    focus() { focused = this; },
    querySelector(sel) { const id = /\[data-id="([^"]+)"\]/.exec(sel)[1]; return all(this).find(n => n.attributes && n.attributes['data-id'] === id) || null; },
  };
  return node;
}
let focused = null;
const text = s => ({tagName: '#text', children: [], textContent: s, attributes: {}});
const doc = {createElement: element, createTextNode: text};
const all = (n, out = []) => { out.push(n); (n.children || []).forEach(c => all(c, out)); return out; };
const byId = (root, id) => root.querySelector('[data-id="' + id + '"]');
const words = n => n.textContent.replace(/\s+/g, ' ').trim();
const host = () => element('div');
const brief = () => ({deliver: [{kind: 'report', formats: ['md'], langs: []}], atLeast: {}, atMost: {minutes: 30, usd: 1, agents: 6}, measure: []});
function mount(b, onChange) { const h = host(); h.appendChild(E.render(doc, b, onChange, B)); return h; }

test('without criteria the editor offers to add them; Add starts from the draft and moves focus into it', () => {
  const b = brief(), calls = [], h = mount(b, () => calls.push(JSON.parse(JSON.stringify(b.success))));
  assert.match(words(h), /deliverables and floors are already required/);
  byId(h, 'bp-add').fire('click');
  assert.deepEqual(b.success, B.draftSuccess());
  assert.equal(calls.length, 1);
  assert.equal(focused, byId(h, 'bp-c-review'));
  assert.ok(byId(h, 'bp-c-review').checked && byId(h, 'bp-c-checks').checked);
  assert.equal(byId(h, 'bp-attempts').value, '3');
  assert.match(words(h), /Accuracy · 0 = Unsupported, 50 = Partly supported, 100 = Fully supported/);
});

test('each control edits brief.success and reports the change; invalid input shows its error', () => {
  const b = {...brief(), success: B.draftSuccess()}, calls = [];
  const h = mount(b, () => calls.push(B.normalizeSuccess(b.success).ok));
  const set = (id, v, type) => { const el = byId(h, id); if (type === 'change') el.checked = v; else el.value = v; el.fire(type || 'input'); };
  set('bp-c-review', false, 'change');
  assert.deepEqual(b.success.conditions, ['checks']);
  set('bp-custom', ' Changelog updated \n\n Docs reviewed ');
  assert.deepEqual(b.success.custom, ['Changelog updated', 'Docs reviewed']);
  set('bp-min', '101');
  assert.equal(b.success.rubric.minScore, 101);
  assert.equal(calls.at(-1), false);
  assert.match(words(byId(h, 'bp-editor').children.at(-1)), /minimum weighted score must be a whole percentage/);
  set('bp-min', '90');
  assert.equal(calls.at(-1), true);
  assert.equal(words(byId(h, 'bp-editor').children.at(-1)), '');
  set('bp-w-accuracy', '');
  assert.ok(Number.isNaN(b.success.rubric.criteria[0].weight), 'an empty number is invalid, never a default');
  assert.equal(calls.at(-1), false);
  set('bp-w-accuracy', '3');
  set('bp-attempts', '5');
  assert.equal(b.success.maxAttempts, 5);
  set('bp-deadline', '2026-12-01T09:30');
  assert.equal(b.success.deadline, '2026-12-01T09:30Z');
  set('bp-deadline', '');
  assert.equal(b.success.deadline, null);
  set('bp-target', true, 'change');
  assert.equal(b.success.examples, 4);
  assert.match(words(h), /aren't evaluated yet \(#37\)/);
  set('bp-examples', '7');
  assert.equal(b.success.examples, 7);
  set('bp-rubric', false, 'change');
  assert.equal(b.success.rubric, null);
  assert.equal(byId(h, 'bp-min'), null);
  assert.equal(calls.at(-1), true);
});

test('Remove deletes the criteria, leaving the Brief\'s own policy, and returns focus to Add', () => {
  const b = {...brief(), success: B.draftSuccess()}, h = mount(b, () => {});
  byId(h, 'bp-remove').fire('click');
  assert.equal(b.success, undefined);
  assert.equal(focused, byId(h, 'bp-add'));
  assert.deepEqual(B.fromBrief(b).required.map(c => c.id), ['deliver:report']);
});

test('the editor only edits: it never grades, emits, saves or records acceptance, and sets no HTML', () => {
  const src = read('dist/brief-policy-editor.js').replace(/^\s*\*.*$/gm, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(src, /innerHTML|insertAdjacentHTML|outerHTML/);
  assert.doesNotMatch(src, /evaluate\(|emit\(|accept|sessionStorage|localStorage|fetch\(/i);
});

test('the page wires the editor into New mission and Edit brief and blocks Save while criteria are invalid', () => {
  const index = read('dist/index.html');
  assert.ok(index.indexOf('<script src="brief-policy-editor.js"></script>') > index.indexOf('<script src="brief-policy.js"></script>'));
  assert.match(index, /CovenBriefPolicyEditor\.render\(document, b, \(\) => \{ nm\.briefTouched = true; nm\.tplEdited = true; drawDone\(\); drawNew\(\); \}\)/);
  assert.match(index, /\$\('raise'\)\.disabled = [^;]*!successOk\(nm\.brief\)/);
  assert.match(index, /okName = \(\) => \{ const v = inp\.value\.trim\(\); return successOk\(nm\.brief\) &&/);
  assert.match(index, /brief = normBrief\(nm\.brief\);\n  if \(!successOk\(nm\.brief\)\) return;/);
  // The fold never learns new event types for this: criteria travel inside the Brief.
  assert.doesNotMatch(index, /brief\.fixture|brief\.hold/);
});
