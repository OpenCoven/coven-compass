'use strict';

// #45: an invalid link is announced once (the sr-only live region) and also shown
// on screen in a notice that is not a live region. The DOM below is a facade with
// event listeners and a hidden flag; it is not a browser, layout engine, or
// screen reader. Browser evidence for placement lives in the PR.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const navigation = require('../dist/mission-navigation.js');

const INVALID = 'That navigation link is not valid. Showing the Coven overview.';
const atlasSource = fs.readFileSync(path.join(__dirname, '../dist/atlas-ui.js'), 'utf8');
const site = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');

function extract(name) {
  const start = site.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in the actual Site source`);
  for (let end = site.indexOf('\n', start); end !== -1; end = site.indexOf('\n', end + 1)) {
    const candidate = site.slice(start, end).trimEnd();
    try { new vm.Script(`(${candidate}\n)`); return candidate; }
    catch (error) { if (!(error instanceof SyntaxError)) throw error; }
  }
  throw new Error(`Cannot extract ${name}`);
}

class Element {
  constructor(document, tag) {
    this.ownerDocument = document; this.tagName = tag.toUpperCase(); this.id = ''; this.className = '';
    this.hidden = false; this.children = []; this.parent = null; this.attributes = {}; this.listeners = {};
    this.dataset = {}; this.style = {setProperty() {}}; this._text = '';
    const classes = new Set();
    this.classList = {add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c), toggle: (c, on) => (on ?? !classes.has(c)) ? classes.add(c) : classes.delete(c)};
  }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  hasAttribute(key) { return key in this.attributes; }
  append(...nodes) { nodes.forEach(n => { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = this; this.children.push(n); }); }
  get firstChild() { return this.children[0] || null; }
  insertBefore(child, reference) {
    if (!reference) { this.append(child); return child; }
    child.remove();
    this.children.splice(this.children.indexOf(reference), 0, child);
    child.parent = this;
    return child;
  }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
  set innerHTML(value) { this.children = []; this._text = ''; }
  set textContent(value) { this.children = []; this._text = String(value); }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  dispatch(type, extra = {}) {
    const ev = {type, target: this, preventDefault() {}, stopPropagation() {}, ...extra};
    for (let el = this; el; el = el.parent) (el.listeners[type] || []).forEach(fn => fn(ev));
  }
  click() { this.dispatch('click'); }
  focus() {
    const previous = this.ownerDocument.activeElement;
    if (previous && previous !== this) previous.dispatch('focusout', {relatedTarget: this});
    this.ownerDocument.activeElement = this; this.dispatch('focusin');
  }
  contains(other) { for (let el = other; el; el = el.parent) if (el === this) return true; return false; }
  getClientRects() { for (let el = this; el; el = el.parent) if (el.hidden) return []; return [{}]; }
  *walk() { yield this; for (const child of this.children) yield* child.walk(); }
  querySelector() { return null; }
}

function mountAtlas() {
  const timers = new Map(); let nextTimer = 1;
  const document = {
    activeElement: null, listeners: {},
    createElement: tag => new Element(document, tag),
    getElementById: id => { for (const el of document.body.walk()) if (el.id === id) return el; return null; },
    querySelectorAll: selector => {
      const [, id, tag] = /^#(\S+) (\w+)$/.exec(selector) || [];
      const root = id && document.getElementById(id);
      return root ? [...root.walk()].filter(el => el !== root && el.tagName === tag.toUpperCase()) : [];
    },
    addEventListener: (type, fn) => { (document.listeners[type] ||= []).push(fn); },
  };
  document.body = new Element(document, 'body');
  const bar = new Element(document, 'div'); bar.id = 'workspaceBar'; document.body.append(bar);
  const tools = new Element(document, 'details'); tools.id = 'workspaceTools'; bar.append(tools);
  tools.append(new Element(document, 'summary'));
  const stage = new Element(document, 'div'); stage.id = 'stage'; document.body.append(stage);
  const window = {matchMedia: () => ({matches: false})};
  const context = vm.createContext({
    window, document,
    setTimeout: (fn, ms) => { const id = nextTimer++; timers.set(id, {fn, ms}); return id; },
    clearTimeout: id => { timers.delete(id); },
  });
  new vm.Script(atlasSource, {filename: 'atlas-ui.js'}).runInContext(context);
  const snapshot = {scope: 'coven', active: 'psyche-build', projects: [], familiars: [], missions: 0, highlight: null, camera: null};
  window.CovenAtlas.mount({snapshot: () => snapshot});
  const $ = id => document.getElementById(id);
  const runTimers = () => { const due = [...timers.values()]; timers.clear(); due.forEach(t => t.fn()); return due.map(t => t.ms); };
  // Every element a screen reader would announce from on change.
  const liveWith = text => [...document.body.walk()].filter(el => (el.hasAttribute('aria-live') || ['status', 'alert', 'log'].includes(el.getAttribute('role'))) && el.textContent.includes(text));
  // No CSS here: .sr-only (atlas.css) is the only visually hidden class involved.
  const shownWith = text => [...document.body.walk()].filter(el => el.getClientRects().length && el.className.split(' ').indexOf('sr-only') < 0 && el._text.includes(text));
  return {atlas: window.CovenAtlas, document, $, timers, runTimers, liveWith, shownWith};
}

test('the visible notice is not a second live region and starts hidden', () => {
  const {$} = mountAtlas();
  const notice = $('atlasNavigationNotice');
  assert.ok(notice, 'the map chrome includes a visible notice');
  assert.equal(notice.hidden, true);
  for (const el of notice.walk()) {
    assert.equal(el.hasAttribute('aria-live'), false, `${el.id || el.tagName} must not be a live region`);
    assert.equal(['status', 'alert', 'log'].includes(el.getAttribute('role')), false, `${el.id || el.tagName} must not have a live role`);
    assert.equal(el.getAttribute('aria-hidden'), null, 'the notice and its dismiss button stay reachable');
  }
  assert.equal($('atlasNavigationStatus').getAttribute('aria-live'), 'polite');
  assert.equal($('atlasNavigationNoticeDismiss').getAttribute('aria-label'), 'Dismiss this notice');
});

test('a visible announcement is shown on screen and announced exactly once', () => {
  const {atlas, $, liveWith, shownWith} = mountAtlas();
  atlas.announce(INVALID, {visible: true});
  assert.equal($('atlasNavigationNotice').hidden, false);
  assert.equal($('atlasNavigationNoticeText').textContent, INVALID);
  assert.deepEqual(liveWith(INVALID).map(el => el.id), ['atlasNavigationStatus'], 'one live region carries the message');
  assert.deepEqual(shownWith(INVALID).map(el => el.id), ['atlasNavigationNoticeText'], 'sighted users see the message');
});

test('ordinary announcements stay screen-reader only', () => {
  const {atlas, $} = mountAtlas();
  atlas.announce('That Project is not available in this simulation. Showing the Coven overview.');
  assert.equal($('atlasNavigationNotice').hidden, true);
  assert.match($('atlasNavigationStatus').textContent, /not available/);
});

test('the notice can be dismissed, hides itself, and pauses while it is being read', () => {
  const {atlas, $, timers, runTimers, document} = mountAtlas();
  atlas.announce(INVALID, {visible: true});
  $('atlasNavigationNoticeDismiss').focus();
  assert.equal(timers.size, 0, 'focus inside the notice pauses its timer');
  $('atlasNavigationNoticeDismiss').click();
  assert.equal($('atlasNavigationNotice').hidden, true);
  assert.equal(document.activeElement.id, 'atlasOverview', 'focus moves to the first shown header control, not to the page');

  atlas.announce(INVALID, {visible: true});
  assert.deepEqual(runTimers(), [10000]);
  assert.equal($('atlasNavigationNotice').hidden, true, 'it hides on its own');

  atlas.announce(INVALID, {visible: true});
  $('atlasNavigationNotice').dispatch('keydown', {key: 'Escape'});
  assert.equal($('atlasNavigationNotice').hidden, true, 'Escape dismisses it');

  atlas.announce(INVALID, {visible: true});
  atlas.dismissNotice();
  assert.equal($('atlasNavigationNotice').hidden, true);
  assert.equal(timers.size, 0);
});

function routeHarness(hash, projects = {'psyche-build': {}}) {
  const calls = {announce: [], dismiss: 0, overview: 0, opened: []};
  const location = {hash};
  const world = {missions: new Map()};
  const context = vm.createContext({
    window: {
      CovenMissionNavigation: navigation,
      CovenAtlas: {
        closeMissions() {}, closeBrowse() {}, update() {},
        announce: (message, options) => calls.announce.push({message, visible: !!(options && options.visible)}),
        dismissNotice: () => { calls.dismiss++; },
      },
    },
    location, history: {replaceState: (state, title, next) => { location.hash = next; }, pushState: (state, title, next) => { location.hash = next; }},
    projects, cam: {locked: false}, setLock() {}, active: 'psyche-build', atlasScope: 'coven', panelView: 'brief', store: {set() {}},
    atlasNavigationReady: false, atlasRestoringRoute: false, atlasLastRoute: '',
    cur: () => ({sel: null, fam: null, detail: null, world}),
    go() {}, select() {},
    atlasOverview: () => { calls.overview++; context.atlasScope = 'coven'; },
    atlasOpenProject: key => { calls.opened.push(key); context.atlasScope = 'project'; context.active = key; },
  });
  new vm.Script(`${extract('atlasWriteRoute')}\n${extract('atlasRestoreRoute')}`).runInContext(context);
  return {context, calls, location};
}

test('opening an unreadable link shows the notice; valid and unavailable-Project links do not', () => {
  for (const hash of ['#/castle/psyche-build', '#psyche-build', '#/castle/psyche-build/mission/m-1', '#%']) {
    const {context, calls, location} = routeHarness(hash);
    context.atlasRestoreRoute(true);
    assert.deepEqual(calls.announce, [{message: INVALID, visible: true}], hash);
    assert.equal(location.hash, '#/coven', `${hash} falls back to the overview`);
  }
  for (const hash of ['#/project/psyche-build', '', '#/coven']) {
    const {context, calls} = routeHarness(hash);
    context.atlasRestoreRoute(true);
    assert.deepEqual(calls.announce.filter(a => a.visible), [], `${hash || '(empty)'} shows no notice`);
  }
  const {context, calls} = routeHarness('#/project/elsewhere');
  context.atlasRestoreRoute(true);
  assert.deepEqual(calls.announce.map(a => a.visible), [false], 'other route notices keep their existing screen-reader-only behaviour');
});

test('later valid navigation removes the notice and does not bring it back', () => {
  const {context, calls, location} = routeHarness('#/castle/psyche-build');
  context.atlasRestoreRoute(true);
  const shown = calls.announce.length, dismissedOnLoad = calls.dismiss;

  context.atlasWriteRoute(true);
  assert.equal(calls.dismiss, dismissedOnLoad, 'rewriting the same route (camera, resize) leaves the notice alone');

  location.hash = '#/project/psyche-build';
  context.atlasRestoreRoute(false);
  assert.ok(calls.dismiss > dismissedOnLoad, 'following a link dismisses it');
  assert.equal(calls.announce.length, shown, 'a valid link announces nothing new');

  const before = calls.dismiss;
  context.atlasOverview = () => { context.atlasScope = 'coven'; context.atlasWriteRoute(); };
  context.atlasOverview();
  assert.equal(location.hash, '#/coven');
  assert.ok(calls.dismiss > before, 'in-app navigation that changes the route dismisses it too');
  assert.equal(calls.announce.filter(a => a.visible).length, 1, 'the notice was shown once, for the invalid link only');
});
