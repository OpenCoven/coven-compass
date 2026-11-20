'use strict';

// Behavioral DOM facade: validates ownership, stacking and focus logic, not
// browser layout, native inert support, software keyboards, or device behavior.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const interactions = require('../dist/mobile-interactions.js');
const source = fs.readFileSync(path.join(__dirname, '../dist/mobile-ui.js'), 'utf8');

function fixture(width = 390, withAdaptiveChrome = false) {
  const observers = [], resizeObservers = [], documentListeners = {}, windowListeners = {}, viewportListeners = {}, frames = new Map();
  let frameId = 0;
  const document = {activeElement: null};
  const changes = [];
  function event(type, extra = {}) {
    return {type, defaultPrevented: false, stopped: false, preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.stopped = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extra};
  }
  function dispatch(listeners, type, value) {
    for (const listener of listeners[type] || []) { listener(value); if (value.stopped) break; }
    return value;
  }
  class Node {
    constructor(tag) {
      this.tagName = tag ? tag.toUpperCase() : null;
      this.parentNode = null; this.childNodes = []; this.attrs = new Map();
      this.disabled = false; this.readOnly = false; this.scrollTop = 0;
      this.type = tag === 'input' ? 'text' : '';
      this.dataset = {};
      this.listeners = {};
      const styles = new Map();
      this.style = {setProperty(k, v, priority = '') { styles.set(k, [String(v), priority]); },
        getPropertyValue(k) { return styles.get(k)?.[0] || ''; }, getPropertyPriority(k) { return styles.get(k)?.[1] || ''; }, removeProperty(k) { styles.delete(k); }};
      const classes = new Set();
      this.classList = {add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c),
        toggle: (c, on) => { if (on === undefined) on = !classes.has(c); if (on) classes.add(c); else classes.delete(c); return on; }};
    }
    get children() { return this.childNodes.filter(child => child.tagName); }
    get id() { return this.getAttribute('id') || ''; }
    set id(value) { this.setAttribute('id', value); }
    get nextSibling() { return this.parentNode?.childNodes[this.parentNode.childNodes.indexOf(this) + 1] || null; }
    get isConnected() { return this === document.documentElement || !!this.parentNode?.isConnected; }
    get hidden() { return this.hasAttribute('hidden'); }
    set hidden(value) { if (value) this.setAttribute('hidden', ''); else this.removeAttribute('hidden'); }
    get inert() { return this.hasAttribute('inert'); }
    set inert(value) { if (value) this.setAttribute('inert', ''); else this.removeAttribute('inert'); }
    get tabIndex() { return this.hasAttribute('tabindex') ? Number(this.getAttribute('tabindex')) :
      ['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'SUMMARY'].includes(this.tagName) || (this.tagName === 'A' && this.hasAttribute('href')) ? 0 : -1; }
    getAttribute(key) { return this.attrs.has(key) ? this.attrs.get(key) : null; }
    hasAttribute(key) { return this.attrs.has(key); }
    setAttribute(key, value) {
      const old = this.getAttribute(key); this.attrs.set(key, String(value));
      if (key === 'hidden' && old !== String(value)) changes.push({target: this, attributeName: key});
    }
    removeAttribute(key) { const had = this.attrs.delete(key); if (key === 'hidden' && had) changes.push({target: this, attributeName: key}); }
    appendChild(child) { return this.insertBefore(child, null); }
    insertBefore(child, reference) {
      child.remove();
      const at = reference ? this.childNodes.indexOf(reference) : this.childNodes.length;
      assert.ok(at >= 0); this.childNodes.splice(at, 0, child); child.parentNode = this; return child;
    }
    remove() { if (this.parentNode) this.parentNode.childNodes.splice(this.parentNode.childNodes.indexOf(this), 1); this.parentNode = null; }
    contains(other) { return this === other || this.childNodes.some(child => child.contains(other)); }
    matches(selector) {
      return selector.split(',').some(raw => {
        const value = raw.trim(), tag = value.match(/^[a-z][\w-]*/i)?.[0];
        if (tag && this.tagName !== tag.toUpperCase()) return false;
        const cls = value.match(/\.([\w-]+)/)?.[1];
        if (cls && !this.classList.contains(cls)) return false;
        for (const match of value.matchAll(/\[([\w-]+)(?:="?([^"\]]*)"?)?\]/g)) {
          if (!this.hasAttribute(match[1]) || (match[2] !== undefined && this.getAttribute(match[1]) !== match[2])) return false;
        }
        return true;
      });
    }
    closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) || null; }
    querySelectorAll(selector) {
      const result = [];
      const visit = el => el.children.forEach(child => { if (child.matches(selector)) result.push(child); visit(child); });
      visit(this); return result;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    getClientRects() { return this.isConnected && !this.closest('[hidden],[inert]') ? [{}] : []; }
    getBoundingClientRect() { return {width: this.bounds?.width || 0, height: this.bounds?.height || 0, top: 0, left: 0, bottom: 0, right: 0}; }
    addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
    click() { dispatch(this.listeners, 'click', event('click', {target: this})); }
    focus() {
      if (!this.getClientRects().length || this.disabled) return;
      const old = document.activeElement; document.activeElement = this;
      if (old) dispatch(documentListeners, 'focusout', event('focusout', {target: old}));
      dispatch(documentListeners, 'focusin', event('focusin', {target: this}));
    }
  }
  const add = (tag, id, parent) => { const el = new Node(tag); if (id) el.id = id; if (parent) parent.appendChild(el); return el; };
  document.documentElement = add('html');
  document.body = add('body', '', document.documentElement);
  document.activeElement = document.body;
  document.createComment = () => new Node();
  document.createElement = tag => new Node(tag);
  document.getElementById = id => document.documentElement.querySelectorAll('[id]').find(el => el.id === id) || null;
  document.querySelectorAll = selector => document.documentElement.querySelectorAll(selector);
  document.querySelector = selector => document.querySelectorAll(selector)[0] || null;
  document.addEventListener = (type, listener) => (documentListeners[type] ||= []).push(listener);
  const app = add('main', 'app', document.body), stage = add('div', 'stage', app);
  const launcher = add('button', 'launcher', app), unrelated = add('aside', 'originally-inert', document.body);
  unrelated.inert = true;
  const overlays = {};
  for (const id of ['inspect', 'psyche', 'empty', 'projectForm', 'atlasSidebar', 'atlasMissionBrowser', 'keyModal', 'cpModal']) {
    const container = add('aside', id, ['keyModal', 'cpModal'].includes(id) ? document.body : stage);
    container.hidden = true;
    let content = container;
    if (['keyModal', 'cpModal'].includes(id)) {
      content = add('section', '', container); content.classList.add('modal-card'); content.setAttribute('role', 'dialog'); content.setAttribute('aria-modal', 'true');
    }
    const heading = add('h2', id + '-heading', content), first = add('button', id + '-first', content);
    const input = add('input', id + '-input', content), last = add('button', id + '-last', content);
    overlays[id] = {container, content, heading, first, input, last};
  }
  let timeline, camera, planHead, live, familiars;
  if (withAdaptiveChrome) {
    timeline = add('div', 'timeline', app); timeline.classList.add('timeline'); timeline.bounds = {height: 52};
    add('button', 'play', timeline); add('input', 'scrub', timeline); add('button', 'speed', timeline);
    camera = add('div', 'atlasCameraDock', stage); camera.classList.add('atlas-camera-dock');
    add('button', 'atlasFit', camera);
    planHead = add('div', 'adaptive-plan-head', app); planHead.classList.add('plan-head'); planHead.bounds = {height: 96};
    const liveControl = add('div', 'live-control', planHead); liveControl.classList.add('live-ctl');
    live = add('button', 'live', liveControl); live.setAttribute('aria-pressed', 'true');
    add('i', '', live); add('span', 'live-label', live).textContent = 'Live'; add('span', 'summary', liveControl);
    familiars = add('div', 'atlasFamiliars', stage); add('button', 'familiar-filter', familiars);
    add('button', 'atlasOverview', stage);
  }
  const window = {innerWidth: width, innerHeight: 844, CovenMobileInteractions: interactions,
    matchMedia: () => ({matches: window.innerWidth <= 1100}),
    getComputedStyle: el => ({display: el.style.getPropertyValue('display') || 'block', visibility: 'visible'}),
    addEventListener: (type, listener) => (windowListeners[type] ||= []).push(listener),
    requestAnimationFrame: fn => { const id = ++frameId; frames.set(id, fn); return id; },
    visualViewport: {width, height: 844, offsetTop: 0, offsetLeft: 0, scale: 1,
      addEventListener: (type, listener) => (viewportListeners[type] ||= []).push(listener)},
    MutationObserver: class { constructor(callback) { this.callback = callback; observers.push(this); } observe(_, options) { this.options = options; } },
    ResizeObserver: class { constructor(callback) { this.callback = callback; this.targets = []; resizeObservers.push(this); } observe(target) { this.targets.push(target); } },
  };
  vm.runInNewContext(source, {window, document, Map, Set, Array, Object});
  const closed = [], viewportCalls = [], actions = [];
  window.CovenAtlas = {openMissions: () => { actions.push('missions'); overlays.atlasMissionBrowser.container.hidden = false; window.CovenMobileUI.activate('atlasMissionBrowser'); }};
  const close = Object.fromEntries(Object.entries(overlays).map(([id, ui]) => [id, () => { closed.push(id); ui.container.hidden = true; }]));
  const mount = () => window.CovenMobileUI.mount({close, fallbackFocus: () => launcher,
    openActivity: () => { actions.push('activity'); overlays.psyche.container.hidden = false; window.CovenMobileUI.activate('psyche'); },
    onViewport: (geometry, previous) => viewportCalls.push({geometry, previous})});
  const flushFrames = () => { for (let turn = 0; frames.size && turn < 20; turn++) { const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn()); } assert.equal(frames.size, 0); };
  const flushMutations = () => { const batch = changes.splice(0); observers.forEach(o => o.callback(batch)); };
  return {window, document, app, stage, launcher, unrelated, overlays, add, mount, closed, viewportCalls, frames, timeline, camera, planHead, live, familiars, actions,
    flushFrames, flushMutations, observers, resizeObservers, ui: window.CovenMobileUI,
    key: (key, extra = {}) => dispatch(documentListeners, 'keydown', event('keydown', {key, target: document.activeElement, ...extra})),
    composition: (type, target) => dispatch(documentListeners, type, event(type, {target})),
    nativeClose: dialog => { dialog.removeAttribute('open'); dispatch(documentListeners, 'close', event('close', {target: dialog})); },
    resize: (newWidth, newHeight = window.innerHeight) => { window.innerWidth = newWidth; window.innerHeight = newHeight; Object.assign(window.visualViewport, {width: newWidth, height: newHeight}); dispatch(windowListeners, 'resize', event('resize')); },
    viewportEvent: type => dispatch(viewportListeners, type, event(type)),
  };
}

test('mobile portals preserve nodes and restore their original desktop order without initial autofocus', () => {
  const f = fixture(), originalOrder = f.stage.children.slice();
  f.overlays.psyche.input.value = 'Unsent draft'; f.overlays.psyche.container.scrollTop = 123;
  f.mount();
  assert.equal(f.document.activeElement, f.document.body);
  for (const id of ['inspect', 'psyche', 'empty', 'projectForm', 'atlasSidebar', 'atlasMissionBrowser']) assert.equal(f.overlays[id].container.parentNode, f.document.body);
  f.resize(1200);
  assert.deepEqual(f.stage.children, originalOrder);
  assert.equal(f.overlays.psyche.input.value, 'Unsent draft');
  assert.equal(f.overlays.psyche.container.scrollTop, 123);
  assert.equal(f.document.body.classList.contains('atlas-mobile-overlay'), false);
});

test('only the newest overlay remains interactive and closing it restores its parent focus', () => {
  const f = fixture(); f.mount(); f.launcher.focus();
  f.overlays.inspect.container.hidden = false; f.ui.sync();
  assert.equal(f.document.body.dataset.mobileOverlay, 'inspect');
  assert.equal(f.document.activeElement, f.overlays.inspect.heading);
  assert.equal(f.app.inert, true);
  assert.equal(f.overlays.inspect.container.inert, false);
  f.overlays.inspect.first.focus();
  f.overlays.psyche.container.hidden = false; f.ui.sync();
  assert.equal(f.document.body.dataset.mobileOverlay, 'psyche');
  assert.equal(f.overlays.inspect.container.inert, true);
  assert.equal(f.overlays.psyche.container.inert, false);
  assert.equal(f.overlays.psyche.container.getAttribute('aria-modal'), 'true');
  const escape = f.key('Escape');
  assert.equal(escape.defaultPrevented, true); assert.equal(escape.stopped, true);
  assert.deepEqual(f.closed, ['psyche']);
  assert.equal(f.document.activeElement, f.overlays.inspect.first);
  assert.equal(f.document.body.dataset.mobileOverlay, 'inspect');
  f.key('Escape');
  assert.equal(f.document.activeElement, f.launcher);
  assert.equal(f.app.inert, false);
  assert.equal(f.unrelated.inert, true, 'original inert state survives all overlays');
  assert.equal(f.overlays.inspect.container.getAttribute('role'), null);
  assert.equal(f.overlays.psyche.container.getAttribute('aria-modal'), null);
});

test('Tab wraps only visible enabled controls and IME Escape does not close a dialog', () => {
  const f = fixture(); f.mount();
  const ui = f.overlays.atlasMissionBrowser;
  ui.container.hidden = false; f.ui.sync();
  ui.last.focus();
  assert.equal(f.key('Tab').defaultPrevented, true);
  assert.equal(f.document.activeElement, ui.first);
  ui.last.disabled = true;
  assert.equal(f.key('Tab', {shiftKey: true}).defaultPrevented, true);
  assert.equal(f.document.activeElement, ui.input);
  const composing = f.key('Escape', {isComposing: true});
  assert.equal(composing.defaultPrevented, false);
  assert.equal(ui.container.hidden, false);
  f.composition('compositionstart', ui.input);
  assert.equal(f.key('Escape').defaultPrevented, false, 'tracked IME state survives a key event without isComposing');
  assert.equal(ui.container.hidden, false);
  f.composition('compositionend', ui.input);
  assert.equal(f.key('Escape').defaultPrevented, true);
  assert.equal(ui.container.hidden, true, 'Escape closes the top dialog again after composition ends');
});

test('live content changes do not reorder or refocus open overlays; activate deliberately raises one', () => {
  const f = fixture(); f.mount();
  f.overlays.inspect.container.hidden = false; f.ui.sync();
  f.overlays.psyche.container.hidden = false; f.ui.sync();
  f.overlays.psyche.input.focus();
  f.overlays.inspect.heading.remove();
  f.add('h2', 'new-inspect-heading', f.overlays.inspect.container);
  f.ui.sync(); f.flushMutations();
  assert.equal(f.document.body.dataset.mobileOverlay, 'psyche');
  assert.equal(f.document.activeElement, f.overlays.psyche.input);
  f.ui.activate('inspect');
  assert.equal(f.document.body.dataset.mobileOverlay, 'inspect');
  assert.equal(f.overlays.inspect.container.inert, false);
  assert.ok(Number(f.overlays.inspect.container.style.getPropertyValue('z-index')) > Number(f.overlays.psyche.container.style.getPropertyValue('z-index')));
  f.key('Escape');
  assert.equal(f.document.activeElement, f.overlays.psyche.input);
  assert.deepEqual(Array.from(f.observers[0].options.attributeFilter), ['hidden']);
  assert.equal(f.observers[0].options.childList, undefined);
});

test('body dialogs keep their original semantics and portal styles restore on desktop', () => {
  const f = fixture(); f.overlays.inspect.container.style.setProperty('z-index', '17'); f.mount();
  f.overlays.inspect.container.hidden = false; f.ui.sync();
  f.overlays.keyModal.container.hidden = false; f.ui.sync();
  assert.equal(f.overlays.keyModal.content.getAttribute('role'), 'dialog');
  assert.equal(f.overlays.keyModal.container.getAttribute('role'), null, 'do not nest a second dialog around an existing one');
  assert.equal(f.overlays.keyModal.container.inert, false);
  f.resize(1200);
  assert.equal(f.overlays.inspect.container.getAttribute('role'), null);
  assert.equal(f.overlays.inspect.container.style.getPropertyValue('z-index'), '17');
  assert.equal(f.overlays.keyModal.content.getAttribute('aria-modal'), 'true');
  assert.equal(f.app.inert, false);
});

test('visual viewport changes update CSS and keyboard state once per frame with prior geometry', () => {
  const f = fixture(); f.mount(); f.flushFrames();
  f.overlays.psyche.container.hidden = false; f.ui.sync(); f.overlays.psyche.input.focus(); f.flushFrames();
  Object.assign(f.window.visualViewport, {height: 430, offsetTop: 50});
  f.viewportEvent('resize'); f.viewportEvent('scroll'); f.viewportEvent('resize');
  assert.equal(f.frames.size, 1);
  const before = f.viewportCalls.length; f.flushFrames();
  assert.equal(f.viewportCalls.length, before + 1);
  assert.equal(f.document.documentElement.style.getPropertyValue('--app-height'), '430px');
  assert.equal(f.document.documentElement.style.getPropertyValue('--viewport-top'), '50px');
  assert.equal(f.document.documentElement.style.getPropertyValue('--keyboard-inset'), '364px');
  assert.equal(f.document.body.classList.contains('atlas-keyboard-open'), true);
  assert.equal(f.viewportCalls.at(-1).previous.height, 844);
  f.key('Escape'); f.flushFrames();
  assert.equal(f.document.body.classList.contains('atlas-keyboard-open'), false);
});

test('the hidden-only observer picks up visibility changes without requiring explicit sync', () => {
  const f = fixture(); f.mount();
  f.overlays.atlasSidebar.container.hidden = false; f.flushMutations();
  assert.equal(f.document.body.dataset.mobileOverlay, 'atlasSidebar');
  f.overlays.atlasSidebar.container.hidden = true; f.flushMutations();
  assert.equal(f.document.body.dataset.mobileOverlay, undefined);
  assert.equal(f.app.inert, false);
});

test('an open native Seal lab keeps focus and Escape ownership when resizing over a managed panel', () => {
  const f = fixture(1200);
  const sealLab = f.add('dialog', 'seal-lab', f.document.body), nativeControl = f.add('button', 'seal-lab-close', sealLab);
  f.mount();
  f.overlays.inspect.container.hidden = false; f.ui.sync(); f.overlays.inspect.first.focus();
  sealLab.setAttribute('open', ''); nativeControl.focus();
  f.resize(390);
  assert.equal(f.overlays.inspect.container.parentNode, f.document.body, 'the underlying panel still adapts to mobile');
  assert.equal(f.document.activeElement, nativeControl, 'portalling the panel must not steal native dialog focus');
  assert.equal(sealLab.inert, false);
  assert.equal(f.app.inert, false, 'the browser owns inertness while its native dialog is open');
  assert.equal(f.document.body.dataset.mobileOverlay, undefined);
  const escape = f.key('Escape');
  assert.equal(escape.defaultPrevented, false);
  assert.equal(escape.stopped, false);
  assert.deepEqual(f.closed, [], 'Escape must not close the underlying inspector');
  f.nativeClose(sealLab);
  assert.equal(f.document.body.dataset.mobileOverlay, 'inspect');
  assert.equal(f.document.activeElement, f.overlays.inspect.first);
  assert.equal(f.app.inert, true);
  assert.equal(sealLab.inert, false, 'a closed native dialog remains available for a later showModal');
});

test('a native dialog opened between syncs is never inert and receives its own keyboard events', () => {
  const f = fixture();
  const sealLab = f.add('dialog', 'seal-lab', f.document.body), nativeControl = f.add('button', 'seal-lab-close', sealLab);
  f.mount(); f.overlays.psyche.container.hidden = false; f.ui.sync();
  assert.equal(sealLab.inert, false);
  sealLab.setAttribute('open', ''); nativeControl.focus();
  assert.equal(f.key('Escape').defaultPrevented, false);
  assert.equal(f.key('Tab').defaultPrevented, false);
  assert.equal(f.document.activeElement, nativeControl);
  assert.deepEqual(f.closed, []);
  f.ui.sync();
  assert.equal(f.document.activeElement, nativeControl);
  assert.equal(f.overlays.psyche.container.getAttribute('aria-modal'), null);
});

test('mobile workspace keeps the original replay and camera controls and restores them on desktop', () => {
  const f = fixture(390, true), originalTimelineParent = f.timeline.parentNode, originalCameraParent = f.camera.parentNode;
  const originalLiveParent = f.live.parentNode, originalLiveOrder = originalLiveParent.children.slice();
  const play = f.document.getElementById('play'); f.mount(); f.flushFrames();
  const chrome = f.document.getElementById('atlasMobileChrome');
  assert.ok(chrome, 'a mobile workspace dock is present');
  assert.equal(f.timeline.parentNode, chrome, 'move the existing timeline, never duplicate playback controls');
  assert.equal(f.camera.parentNode, originalCameraParent);
  assert.equal(f.camera.hidden, true);
  assert.equal(f.live.parentNode, f.timeline, 'the existing Live action remains available from the overview replay dock');
  assert.equal(f.document.getElementById('live'), f.live);
  f.live.setAttribute('aria-pressed', 'false'); f.live.setAttribute('aria-label', 'Replaying. Click to go live');
  f.document.getElementById('live-label').textContent = 'Go live';
  assert.equal(f.document.getElementById('play'), play);
  assert.equal(chrome.dataset.cameraOpen, 'false', 'map traversal controls start folded');
  f.resize(1280, 800); f.flushFrames();
  assert.equal(f.timeline.parentNode, originalTimelineParent);
  assert.equal(f.camera.parentNode, originalCameraParent);
  assert.equal(f.live.parentNode, originalLiveParent);
  assert.deepEqual(originalLiveParent.children, originalLiveOrder);
  assert.equal(f.live.getAttribute('aria-pressed'), 'false', 'moving the button must preserve authoritative replay updates');
  assert.equal(f.live.getAttribute('aria-label'), 'Replaying. Click to go live');
  assert.equal(f.document.getElementById('live-label').textContent, 'Go live');
  assert.equal(chrome.hidden, true);
  assert.equal(f.document.getElementById('play'), play);
  f.resize(390, 844); f.flushFrames();
  assert.equal(f.timeline.parentNode, chrome);
  assert.equal(f.live.parentNode, f.timeline);
  assert.equal(chrome.hidden, false);
});

test('adaptive layout follows available screen shape and preserves an explicit camera choice', () => {
  const f = fixture(390, true); f.mount(); f.flushFrames();
  const view = f.document.getElementById('atlasMobileView'), chrome = f.document.getElementById('atlasMobileChrome');
  assert.equal(f.document.body.dataset.mobileLayout, 'compact');
  assert.ok(parseFloat(f.document.documentElement.style.getPropertyValue('--mobile-stage-height')) < 844 - 96);
  view.click();
  assert.equal(chrome.dataset.cameraOpen, 'true');
  assert.equal(view.getAttribute('aria-expanded'), 'true');
  assert.equal(f.camera.hidden, false);
  assert.equal(f.familiars.hidden, false, 'the familiar key remains available beside the camera');
  f.resize(852, 393); f.flushFrames();
  assert.equal(f.document.body.dataset.mobileLayout, 'landscape');
  assert.equal(chrome.dataset.cameraOpen, 'true', 'rotation must not overwrite an explicit view choice');
  assert.ok(parseFloat(f.document.documentElement.style.getPropertyValue('--mobile-stage-height')) <= 393 - 96 - 70);
  f.resize(834, 1194); f.flushFrames();
  assert.equal(f.document.body.dataset.mobileLayout, 'tablet');
  f.resize(1280, 800); f.flushFrames();
  assert.equal(f.familiars.hidden, false, 'desktop restores filters when the mobile camera popup is absent');
  f.resize(834, 1194); f.flushFrames();
  assert.equal(f.camera.hidden, false, 'returning to mobile retains the explicit View choice');
  view.click();
  assert.equal(chrome.dataset.cameraOpen, 'false');
  assert.equal(f.familiars.hidden, false);
});

test('mobile task views open existing surfaces and yield to modal ownership without resetting drafts', () => {
  const f = fixture(390, true); f.mount(); f.flushFrames();
  f.overlays.psyche.input.value = 'Keep this unsent draft';
  const chrome = f.document.getElementById('atlasMobileChrome');
  const stageHeight = f.document.documentElement.style.getPropertyValue('--mobile-stage-height');
  const callbacksBefore = f.viewportCalls.length;
  f.document.getElementById('atlasMobileMissions').click();
  f.flushFrames();
  assert.deepEqual(f.actions, ['missions']);
  assert.equal(f.document.body.dataset.mobileOverlay, 'atlasMissionBrowser');
  assert.equal(chrome.inert, true, 'background workspace controls obey the active modal');
  assert.equal(f.document.documentElement.style.getPropertyValue('--mobile-stage-height'), stageHeight, 'making the map inert must not change its measured space');
  assert.equal(f.viewportCalls.length, callbacksBefore, 'modal inertness alone must not report a new viewport or refit the map');
  f.key('Escape');
  assert.equal(chrome.inert, false);
  f.document.getElementById('atlasMobileActivity').click();
  assert.deepEqual(f.actions, ['missions', 'activity']);
  assert.equal(f.document.body.dataset.mobileOverlay, 'psyche');
  assert.equal(f.overlays.psyche.input.value, 'Keep this unsent draft');
  assert.equal(f.document.activeElement, f.overlays.psyche.heading, 'opening Activity must not auto-focus its composer');
});

test('a scope header resizing recomputes available map space without a device rotation', () => {
  const f = fixture(390, true); f.mount(); f.flushFrames();
  const before = parseFloat(f.document.documentElement.style.getPropertyValue('--mobile-stage-height'));
  const callbacksBefore = f.viewportCalls.length;
  const observer = f.resizeObservers.find(item => item.targets.includes(f.planHead));
  assert.ok(observer, 'watch the real scope header size, including show/hide changes');
  f.planHead.bounds.height = 0;
  observer.callback([{target: f.planHead}]); f.flushFrames();
  assert.equal(parseFloat(f.document.documentElement.style.getPropertyValue('--mobile-stage-height')), before + 96);
  assert.equal(f.viewportCalls.length, callbacksBefore + 1, 'a scope-only stage resize must inform the camera');
  const report = f.viewportCalls.at(-1);
  assert.equal(report.geometry.stageHeight, before + 96);
  assert.equal(report.previous.stageHeight, before);
  assert.equal(report.geometry.height, report.previous.height, 'the visual viewport itself did not change');
  observer.callback([{target: f.planHead}]); f.flushFrames();
  assert.equal(f.viewportCalls.length, callbacksBefore + 1, 'unchanged measurements remain deduplicated');
});

test('Escape folds only mobile camera controls and returns to their trigger', () => {
  const f = fixture(390, true); f.mount();
  const view = f.document.getElementById('atlasMobileView'); view.click();
  f.composition('compositionstart', view);
  assert.equal(f.key('Escape', {target: view}).defaultPrevented, false, 'IME Escape keeps its existing ownership');
  assert.equal(view.getAttribute('aria-expanded'), 'true');
  f.composition('compositionend', view);
  const event = f.key('Escape');
  assert.equal(event.defaultPrevented, true);
  assert.equal(view.getAttribute('aria-expanded'), 'false');
  assert.equal(f.document.activeElement, view);
  assert.deepEqual(f.closed, []);
});
