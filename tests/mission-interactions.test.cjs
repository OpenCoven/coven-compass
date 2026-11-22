'use strict';

// Regression tests execute functions extracted from the actual Site source.
// The DOM facade models connected/hidden/inert focus eligibility, node identity,
// event handlers and requested scrolling. It does not provide a browser layout
// engine, real scrolling, native keyboard behavior, Safari, or iOS emulation.
// Mobile geometry and actual device behavior still require browser/device QA.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');

function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in the Site source`);
  // Parse complete lines instead of counting braces inside strings/templates.
  for (let end = source.indexOf('\n', start); end !== -1; end = source.indexOf('\n', end + 1)) {
    const candidate = source.slice(start, end);
    try {
      new vm.Script(`(${candidate}\n)`);
      return candidate;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
  throw new Error(`Cannot extract complete function ${name}`);
}

function load(names, globals) {
  const context = vm.createContext(globals);
  new vm.Script("'use strict';\n" + names.map(extract).join('\n'), {
    filename: 'actual-site-mission-interactions.js',
  }).runInContext(context);
  return context;
}

function domFixture() {
  const calls = [], document = {activeElement: null};
  const dataKey = name => name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

  class Element {
    constructor(tag, cls = '', text = '') {
      this.tagName = tag.toUpperCase(); this.className = cls; this._text = text;
      this.children = []; this.parentNode = null; this.dataset = {}; this.attributes = {};
      this.listeners = {}; this.disabled = false; this.value = ''; this.scrollTop = 0;
      this._hidden = false; this._inert = false;
      this.style = {setProperty() {}};
      this.classList = {
        contains: name => this.className.split(/\s+/).includes(name),
        toggle: (name, on) => {
          const values = new Set(this.className.split(/\s+/).filter(Boolean));
          if (on === undefined) on = !values.has(name);
          if (on) values.add(name); else values.delete(name);
          this.className = [...values].join(' '); return on;
        },
      };
    }
    get isConnected() { return this === document.body || !!this.parentNode?.isConnected; }
    get firstElementChild() { return this.children[0] || null; }
    get hidden() { return this._hidden; }
    set hidden(value) {
      this._hidden = !!value;
      if (value && this.contains(document.activeElement)) document.activeElement = document.body;
    }
    get inert() { return this._inert; }
    set inert(value) {
      this._inert = !!value;
      if (value && this.contains(document.activeElement)) document.activeElement = document.body;
    }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    set textContent(value) {
      if (this.children.some(child => child.contains(document.activeElement))) document.activeElement = document.body;
      this.children.forEach(child => { child.parentNode = null; });
      this.children = []; this._text = String(value);
    }
    appendChild(child) {
      if (child.parentNode) child.parentNode.children.splice(child.parentNode.children.indexOf(child), 1);
      child.parentNode = this; this.children.push(child); return child;
    }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    setAttribute(name, value) {
      if (name.startsWith('data-')) this.dataset[dataKey(name)] = String(value);
      else this.attributes[name] = String(value);
    }
    getAttribute(name) {
      if (name === 'id') return this.id || null;
      if (name.startsWith('data-')) return this.dataset[dataKey(name)] ?? null;
      return this.attributes[name] ?? null;
    }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    click() {
      if (this.disabled || !this.isConnected || this.closest('[hidden],[inert]')) return;
      for (const listener of this.listeners.click || []) listener({target: this, stopPropagation() {}, preventDefault() {}});
    }
    contains(el) { return el === this || this.children.some(child => child.contains(el)); }
    matches(selector) {
      return selector.split(',').some(raw => {
        const value = raw.trim();
        if (value === '[hidden]') return this.hidden;
        if (value === '[inert]') return this.inert;
        const tag = value.match(/^[a-z][\w-]*/i)?.[0];
        if (tag && this.tagName !== tag.toUpperCase()) return false;
        const cls = value.match(/\.([\w-]+)/)?.[1];
        if (cls && !this.classList.contains(cls)) return false;
        for (const match of value.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
          if (match[1] === 'open') { if (!this.open) return false; }
          else if (this.getAttribute(match[1]) === null || (match[2] !== undefined && this.getAttribute(match[1]) !== match[2])) return false;
        }
        return true;
      });
    }
    closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) || null; }
    querySelectorAll(selector) {
      return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    focus(options) {
      if (this.disabled || !this.isConnected || this.closest('[hidden],[inert]')) return;
      document.activeElement = this; calls.push({kind: 'focus', target: this, options});
    }
    select() { this.selectionStart = 0; this.selectionEnd = this.value.length; calls.push({kind: 'select', target: this}); }
    scrollIntoView(options) { calls.push({kind: 'scroll', target: this, options}); }
  }

  document.body = new Element('body'); document.activeElement = document.body;
  document.getElementById = id => document.body.querySelectorAll('[id]').find(el => el.id === id) || null;
  document.querySelectorAll = selector => document.body.querySelectorAll(selector);
  const html = (tag, cls, text) => new Element(tag, cls, text);
  const add = (tag, id, parent = document.body) => {
    const el = html(tag); if (id) el.id = id; parent.appendChild(el); return el;
  };
  return {document, calls, html, add, $: document.getElementById};
}

function formFixture() {
  const f = domFixture(), stage = f.add('div', 'stage'), form = f.add('form', 'empty');
  for (const id of ['emptyX', 'nmLeadL', 'nmTitle', 'raise', 'nmLeadSec', 'emptyName', 'emptyState', 'nmFoot', 'nmPermissions', 'nmCustomize', 'nmPreview', 'nmBrief']) f.add('button', id, form);
  const input = f.add('input', 'nmName', form); input.value = 'Draft mission';
  const makeProject = () => ({world: {missions: new Map()}, layout: {ang: new Map()}, composing: false});
  let project = makeProject(), actionable = true;
  const nm = {edit: null, lead: 'echo', touched: true, brief: {atMost: {agents: 6}}}, cz = {open: false};
  const mobileUI = {
    activate(id) {
      f.calls.push({kind: 'activate', id});
      f.$(id).inert = false; stage.inert = true;
    },
    sync() {
      f.calls.push({kind: 'sync'});
      stage.inert = !form.hidden; form.inert = form.hidden;
    },
  };
  const context = load(['setMissionName', 'setBriefExpanded', 'drawNew', 'openNew', 'closeNew'], {
    ...f, stage, nm, cz, cur: () => project, active: 'brand', atlasScope: 'project',
    canAct: () => actionable,
    sc: {far: false}, select() {}, setView() {}, setLead() {}, drawBriefForm() {},
    window: {CovenMobileUI: mobileUI},
  });
  return {...f, stage, form, input, nm, cz, context, mobileUI, makeProject,
    get project() { return project; }, switchProject: next => { project = next; },
    setActionable: value => { actionable = value; }};
}

function agentFixture() {
  const f = domFixture(), inspect = f.add('aside', 'inspect');
  const missionTitle = f.add('h2', 'missionDetailTitle', inspect), row = f.add('button', 'agentRow', inspect);
  const slot = f.add('div', 'agentSlot', inspect), other = f.add('input', 'otherControl', inspect);
  slot.hidden = true;
  const pop = f.add('div', 'pop'), mapAgent = f.add('g', 'mapAgent'); pop.hidden = true;
  const a = {id: 'a-001', fam: 'echo', mission: 'm1', state: 'gate', ask: 'q1', task: 't1', doing: 'Drafting'};
  const q = {id: 'q1', gate: 'N', title: 'Need approval'};
  const c = {pick: null, world: {
    agents: new Map([[a.id, a]]), missions: new Map([['m1', {name: 'Research'}]]),
    asks: new Map([[q.id, q]]), tasks: new Map([['t1', {name: 'Draft brief', leads: ['echo']}]]),
  }};
  const context = load(['setMissionName', 'agentInfo', 'pick', 'clearPick', 'showPick'], {
    ...f, cur: () => c, fam: () => ({name: 'Echo', hue: '#c5a7ff'}),
    STATE: {gate: 'At a gate', work: 'Working', idle: 'Idle'}, GATE_NAME: {N: 'North'}, ago: () => '1 min',
    flashAsk: id => f.calls.push({kind: 'review', id}),
    insp: {slot, dots: new Map([[a.id, {btn: row}]])}, sc: {agents: new Map([[a.id, {el: mapAgent}]])},
    drawLeadCard() {}, placePop() {}, popAt: null,
  });
  const details = () => {
    const info = slot.firstElementChild;
    return {info, title: info.querySelector('h3'), review: info.querySelector('[data-agent-action="review"]'), close: info.querySelector('[data-agent-action="close"]')};
  };
  return {...f, context, c, a, q, inspect, missionTitle, row, slot, other, pop, details};
}

test('a dormant Project form can close and leaves a usable New mission action after rerender', () => {
  const f = formFixture(); f.context.drawNew(); f.mobileUI.activate('empty');
  assert.equal(f.form.hidden, false); assert.equal(f.$('emptyX').hidden, false);
  f.context.closeNew();
  assert.equal(f.form.hidden, true);
  assert.equal(f.stage.inert, false, 'dismissal must release background controls immediately');
  assert.equal(f.stage.classList.contains('composing'), false);
  assert.equal(f.$('emptyProjectPrompt').hidden, false);
  assert.equal(f.$('emptyNew').disabled, false);
  assert.equal(f.document.activeElement, f.$('emptyNew'));
  f.context.drawNew();
  assert.equal(f.form.hidden, true, 'live renders must not reopen the dismissed form');
});

test('the empty-state action reopens the retained draft and focuses its name after activation', () => {
  const f = formFixture(); f.context.drawNew(); f.context.closeNew();
  f.input.value = 'Finish the mobile interaction review'; f.calls.length = 0;
  f.$('emptyNew').click();
  assert.equal(f.form.hidden, false); assert.equal(f.$('emptyProjectPrompt').hidden, true);
  assert.equal(f.input.value, 'Finish the mobile interaction review');
  assert.equal(f.document.activeElement, f.input);
  assert.equal(f.input.selectionStart, 0); assert.equal(f.input.selectionEnd, f.input.value.length);
  assert.ok(f.calls.findIndex(call => call.kind === 'activate') < f.calls.findIndex(call => call.kind === 'focus' && call.target === f.input));
});

test('empty-state dismissal belongs to its Project and the prompt hides for populated or editing Projects', () => {
  const f = formFixture(), first = f.project;
  f.context.drawNew(); f.context.closeNew();
  f.switchProject(f.makeProject()); f.context.drawNew();
  assert.equal(f.form.hidden, false, 'a different dormant Project has its own initial invitation');
  f.switchProject(first); f.context.drawNew();
  assert.equal(f.form.hidden, true); assert.equal(f.$('emptyProjectPrompt').hidden, false);
  first.world.missions.set('m1', {id: 'm1'}); f.context.drawNew();
  assert.equal(f.$('emptyProjectPrompt').hidden, true);
  first.world.missions.clear(); f.cz.open = true; f.context.drawNew();
  assert.equal(f.form.hidden, true); assert.equal(f.$('emptyProjectPrompt').hidden, true);
});

test('an empty Project at a read-only replay position does not expose an enabled create action', () => {
  const f = formFixture(); f.context.drawNew(); f.context.closeNew();
  f.setActionable(false); f.context.drawNew();
  assert.equal(f.$('emptyProjectPrompt').hidden, false);
  assert.equal(f.$('emptyNew').disabled, true);
  f.$('emptyNew').click(); assert.equal(f.form.hidden, true);
  f.setActionable(true); f.context.drawNew();
  assert.equal(f.$('emptyNew').disabled, false);
});

test('Coven scope hides dormant-project forms and prompts while preserving the retained draft', () => {
  const f = formFixture(); f.context.drawNew();
  f.input.value = 'Retained local draft'; f.project.composing = true;
  f.context.atlasScope = 'coven'; f.context.drawNew();
  assert.equal(f.form.hidden, true); assert.equal(f.$('emptyProjectPrompt').hidden, true);
  assert.equal(f.stage.classList.contains('composing'), false);
  assert.equal(f.input.value, 'Retained local draft');
  f.context.atlasScope = 'project'; f.context.drawNew();
  assert.equal(f.form.hidden, false); assert.equal(f.input.value, 'Retained local draft');
  f.context.closeNew(); f.context.atlasScope = 'coven'; f.context.drawNew();
  assert.equal(f.form.hidden, true); assert.equal(f.$('emptyProjectPrompt').hidden, true);
});

test('opening Project edit releases its inert surface before focusing and selecting the name', () => {
  const f = domFixture(), launcher = f.add('button', 'editProject'), form = f.add('form', 'projectForm');
  const input = f.add('input', 'czName', form); f.add('input', 'czRepo', form); f.add('input', 'czRoot', form);
  form.hidden = true; form.inert = true; launcher.focus(); f.calls.length = 0;
  const cz = {}, project = {}, context = load(['openProjectForm'], {
    ...f, cz, cur: () => project, projects: {brand: project}, sc: {far: false}, atlasScope: 'project',
    metaOf: () => ({repo: 'https://example.test/brand', root: '~/code/brand'}),
    closeNew() {}, select() {}, setView() {},
    drawProjectForm: () => { form.hidden = !cz.open; },
    window: {CovenMobileUI: {activate: id => { f.calls.push({kind: 'activate', id}); f.$(id).inert = false; }}},
  });
  context.openProjectForm('brand');
  assert.equal(form.hidden, false); assert.equal(f.document.activeElement, input);
  assert.equal(input.value, 'brand'); assert.equal(input.selectionStart, 0); assert.equal(input.selectionEnd, 5);
  assert.equal(f.$('czRepo').value, 'https://example.test/brand'); assert.equal(f.$('czRoot').value, '~/code/brand');
  assert.ok(f.calls.findIndex(call => call.kind === 'activate') < f.calls.findIndex(call => call.kind === 'focus'));
});

test('an explicit panel-agent pick reveals named details and Close returns to its row', () => {
  const f = agentFixture(); f.row.focus(); f.calls.length = 0;
  f.context.pick(f.a.id, 'panel');
  const {info, title, close} = f.details();
  assert.equal(f.slot.hidden, false); assert.equal(f.pop.hidden, true);
  assert.equal(f.document.activeElement, title); assert.equal(title.textContent, 'Need approval');
  assert.equal(info.querySelector('.id').textContent, 'Agent a-001');
  assert.equal(info.getAttribute('aria-labelledby'), title.id);
  assert.equal(f.row.getAttribute('aria-pressed'), 'true');
  assert.ok(f.calls.some(call => call.kind === 'scroll' && call.target === f.slot));
  assert.equal(close.textContent, 'Close agent details');
  close.focus(); f.calls.length = 0; close.click();
  assert.equal(f.c.pick, null); assert.equal(f.slot.hidden, true);
  assert.equal(f.document.activeElement, f.row); assert.equal(f.row.getAttribute('aria-pressed'), 'false');
  assert.ok(f.calls.some(call => call.kind === 'scroll' && call.target === f.row));
});

test('live agent refresh keeps nodes, Review focus, and scroll position while updating content', () => {
  const f = agentFixture(); f.context.pick(f.a.id, 'panel');
  const before = f.details(); before.review.focus(); f.slot.scrollTop = 37; f.calls.length = 0;
  f.q.title = 'Updated approval request'; f.context.showPick(); f.context.showPick();
  const after = f.details();
  assert.equal(after.info, before.info); assert.equal(after.title, before.title);
  assert.equal(after.review, before.review); assert.equal(after.close, before.close);
  assert.equal(f.document.activeElement, before.review);
  assert.equal(after.info.querySelector('[data-agent-field="work"]').textContent, 'Updated approval request');
  assert.equal(f.slot.scrollTop, 37);
  assert.equal(f.calls.filter(call => call.kind === 'focus' || call.kind === 'scroll').length, 0);
});

test('a background agent refresh preserves another control focus and Review uses the current gate', () => {
  const f = agentFixture(); f.context.pick(f.a.id, 'panel'); const {review} = f.details();
  f.other.focus(); f.calls.length = 0;
  f.a.ask = 'q2'; f.c.world.asks.set('q2', {id: 'q2', gate: 'N', title: 'A later request'});
  f.context.showPick();
  assert.equal(f.document.activeElement, f.other);
  assert.equal(f.calls.filter(call => call.kind === 'focus' || call.kind === 'scroll').length, 0);
  review.click(); assert.equal(f.calls.find(call => call.kind === 'review').id, 'q2');
});

test('resolving the focused gate action moves to Close without scrolling or rebuilding details', () => {
  const f = agentFixture(); f.context.pick(f.a.id, 'panel');
  const {info, review, close} = f.details(); review.focus(); f.calls.length = 0;
  f.a.state = 'work'; f.a.ask = null; f.context.showPick();
  assert.equal(f.details().info, info); assert.equal(review.hidden, true);
  assert.equal(f.document.activeElement, close);
  assert.equal(f.calls.filter(call => call.kind === 'scroll').length, 0);
  f.calls.length = 0; f.context.showPick();
  assert.equal(f.document.activeElement, close);
  assert.equal(f.calls.filter(call => call.kind === 'focus' || call.kind === 'scroll').length, 0);
});

test('agent facts keep task ownership distinct from state and gate context', () => {
  const f = agentFixture();
  f.context.pick(f.a.id, 'panel');
  const info = f.details().info;
  const field = key => info.querySelector(`[data-agent-field="${key}"]`);
  assert.equal(field('gate').textContent, 'North gate');
  assert.equal(field('task').textContent, 'Draft brief');
  assert.equal(field('mission').textContent, 'Research');
  f.a.state = 'idle'; f.a.task = null; f.a.ask = null;
  f.context.showPick();
  assert.equal(field('gate').parentNode.hidden, true);
  assert.equal(field('task').textContent, 'Unassigned');
  assert.equal(field('leads').textContent, 'Echo');
  assert.equal(field('work').textContent, 'Waiting for work');
});

test('clearing focused agent details or toggling the same row returns to that row', () => {
  const f = agentFixture(); f.context.pick(f.a.id, 'panel');
  f.context.clearPick();
  assert.equal(f.c.pick, null); assert.equal(f.document.activeElement, f.row);
  f.context.pick(f.a.id, 'panel'); f.context.pick(f.a.id, 'panel');
  assert.equal(f.c.pick, null); assert.equal(f.document.activeElement, f.row);
  assert.equal(f.slot.hidden, true);
});

test('an agent removed by a live update returns focused details to the mission without scrolling', () => {
  const f = agentFixture(); f.context.pick(f.a.id, 'panel'); f.calls.length = 0;
  f.c.world.agents.delete(f.a.id); f.context.showPick();
  assert.equal(f.c.pick, null); assert.equal(f.slot.hidden, true);
  assert.equal(f.document.activeElement, f.missionTitle);
  assert.equal(f.calls.filter(call => call.kind === 'scroll').length, 0);
});
