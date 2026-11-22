// Run from the external Playwright installation described in scripts/browser-qa.mjs.
// See docs/map-performance.md for the workload and interpretation of the clocks.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {chromium} from 'playwright';

const [base, revision, out, mode = 'matrix'] = process.argv.slice(2);
if (!out || !/^[0-9a-f]{40}$/.test(revision) || !['matrix', 'soak', 'pilot'].includes(mode)) {
  throw Error('Usage: node map-performance.mjs <local-base-url> <measured-sha> <new-output-dir> [matrix|soak|pilot]');
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const run = (...args) => execFileSync(...args, {encoding: 'utf8'}).trim();
const save = (name, data) => fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 2) + '\n');
fs.mkdirSync(out); // Keep previous runs, including partial failures.
fs.writeFileSync(path.join(out, 'served.txt'), run(process.execPath, ['scripts/verify-served.mjs', base, revision]) + '\n');
const browser = await chromium.launch();
const meta = {
  revision, base, mode, started: new Date().toISOString(), node: process.version,
  runnerSha256: hash(fs.readFileSync(fileURLToPath(import.meta.url))),
  platform: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0].model,
  logicalCpus: os.cpus().length, ramBytes: os.totalmem(), browser: browser.version(),
  playwright: createRequire(import.meta.url)('playwright/package.json').version,
};
if (os.platform() === 'darwin') Object.assign(meta, {model: run('sysctl', ['-n', 'hw.model']), macOS: run('sw_vers', ['-productVersion'])});
save('run.json', meta);

function installProbe() {
  // Capture the simulation's existing read-only worlds supplier at registration.
  // Only the explicit census below calls it. Frame sampling never walks model data.
  Object.defineProperty(window, 'CovenProjection', {configurable: true, set(api) {
    Object.defineProperty(window, 'CovenProjection', {value: {...api, createSimulationSource(options) {
      window.workloadCensus = () => {
        const worlds = options.worlds(), familiars = new Set();
        let missions = 0, agents = 0, tasks = 0;
        for (const [, world] of worlds) {
          missions += world.missions.size; agents += world.agents.size; tasks += world.tasks.size;
          for (const mission of world.missions.values()) for (const key of mission.seats) familiars.add(key);
        }
        return {projects: worlds.length, missions, agents, tasks, seatedFamiliars: [...familiars].sort()};
      };
      return api.createSimulationSource(options);
    }}});
  }});
  const frames = [], longTasks = [];
  let last, armed;
  const observer = new PerformanceObserver(list => {
    for (const e of list.getEntries()) longTasks.push([e.startTime, e.duration]);
  });
  observer.observe({type: 'longtask', buffered: true});
  const q = selector => document.querySelector(selector);
  function matches(c) {
    if (c.route && location.hash.split('?')[0] !== c.route) return false;
    if (c.focus && !document.activeElement?.matches(c.focus)) return false;
    if (c.shown && !q(c.shown)?.checkVisibility({visibilityProperty: true})) return false;
    if (c.count && document.querySelectorAll(c.count[0]).length !== c.count[1]) return false;
    if (c.text && q(c.text[0])?.textContent !== c.text[1]) return false;
    if (c.panX !== undefined && q('#plan').viewBox.baseVal.x <= c.panX + 0.1) return false;
    if (c.zoomWidth !== undefined && q('#plan').viewBox.baseVal.width >= c.zoomWidth - 0.1) return false;
    if (c.replaying && !(q('#play').ariaLabel === 'Pause' && +q('#scrub').value < 1000 && +q('#scrub').value > 0)) return false;
    return true;
  }
  function frame(t) {
    if (last !== undefined) frames.push([t, t - last]);
    last = t;
    if (armed?.start !== undefined && armed.end === undefined) {
      if (!matches(armed.check)) armed.ready = false;
      else if (armed.ready) armed.end = performance.now();
      else armed.ready = true; // One intervening rendering opportunity with the expected state.
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  for (const type of ['click', 'keydown', 'input']) window.addEventListener(type, e => {
    if (armed?.event === type && armed.start === undefined) {
      armed.start = e.timeStamp; armed.trusted = e.isTrusted;
    }
  }, true);
  window.perfProbe = {
    arm(event, check) { armed = {event, check}; },
    read() { return armed; },
    drain() { return {frames: frames.splice(0), longTasks: longTasks.splice(0)}; },
  };
}

const projectRoute = '#/project/psyche-build';
const missionRoute = projectRoute + '/mission/m-1';
const projectRow = '.atlas-project[data-project="psyche-build"]';
const missionRow = '.atlas-mission-row[data-project="psyche-build"][data-mission="m-1"]';
const tasks = ['Read the diff', 'Check sources', 'Unit tests', 'Device checks', 'Reviewer note'];
const sizes = {desktop: {width: 1440, height: 900}, narrow: {width: 390, height: 844}};
let failures = 0;
async function scenario(size, projects, trial, soak = false) {
  const id = size + '-' + projects + '-' + trial;
  const narrow = size === 'narrow';
  const context = await browser.newContext({viewport: sizes[size], isMobile: narrow, hasTouch: narrow, deviceScaleFactor: 1});
  const report = {id, viewport: sizes[size], projects, trial, soak, samples: [], checkpoints: [], errors: []};
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const cdp = await context.newCDPSession(page);
  await page.addInitScript(installProbe);
  page.on('pageerror', e => report.errors.push(e.message));
  const locator = s => page.locator(s);
  const press = key => page.keyboard.press(key);
  const fill = (s, value) => locator(s).fill(value);
  const camera = () => page.evaluate(() => {
    const {x, width} = document.querySelector('#plan').viewBox.baseVal;
    return {x, width};
  });
  const launcher = narrow ? '#atlasMobileMissions' : '#atlasMissions';
  const overview = narrow ? '#atlasMobileMap' : '#atlasOverview';
  let phase = 'setup', iteration = 0, step = 'navigation';
  async function input(name, event, action, check) {
    step = name;
    await page.evaluate(({event, check}) => perfProbe.arm(event, check), {event, check});
    const sample = {phase, iteration, name};
    report.samples.push(sample);
    if (phase === 'profile') await page.evaluate(name => performance.mark(name), 'before: ' + name);
    await action();
    await page.waitForFunction(() => perfProbe.read()?.end !== undefined, undefined, {timeout: 15000});
    const {start, end, trusted} = await page.evaluate(() => perfProbe.read());
    Object.assign(sample, {start, end, ms: end - start, trusted});
    if (phase === 'profile') await page.evaluate(name => performance.mark(name), 'after: ' + name);
  }
  async function checkpoint() {
    const counts = await cdp.send('Memory.getDOMCounters');
    const heap = await cdp.send('Runtime.getHeapUsage');
    const state = await page.evaluate(() => ({
      attachedElements: document.getElementsByTagName('*').length,
      route: location.hash, replaySpeed: document.querySelector('#speed').textContent,
      cursor: Number(document.querySelector('#scrub').value), live: document.querySelector('#live').ariaPressed,
    }));
    report.checkpoints.push({phase, iteration, elapsedMs: performance.now() - scenarioStart,
      ...state, ...counts, usedHeapBytes: heap.usedSize, totalHeapBytes: heap.totalSize});
  }
  async function drain() {
    const raw = await page.evaluate(() => perfProbe.drain());
    const name = id + '.frames.ndjson.gz';
    // Concatenated gzip members can be streamed and retain completed cycles on interruption.
    fs.appendFileSync(path.join(out, name), gzipSync(JSON.stringify({phase, iteration, ...raw}) + '\n'));
  }
  async function activate(selector) {
    if (await locator(selector).isVisible()) await locator(selector).click();
    else await locator(selector).evaluate(el => el.click()); // Desktop hides its replay controls.
  }
  async function journey(dwellMs) {
    await input('open Projects', 'click', () => locator('#atlasBrowse').click(), {shown:'#atlasProjectSearch', focus:'.atlas-project[data-active="true"]'});
    await fill('#atlasProjectSearch', '');
    assert.equal(await locator('.atlas-project:not([hidden])').count(), projects);
    await input('filter Projects', 'input', () => fill('#atlasProjectSearch', 'psyche-build'),
      {count:['.atlas-project:not([hidden])',1], shown:projectRow, focus:'#atlasProjectSearch'});
    await locator(projectRow).focus();
    await input('enter Project', 'keydown', () => press('Enter'), {route:projectRoute, shown:'.mission-tasks'});
    await locator('#stage').focus();
    // Let the automatic Project fit finish before attributing camera movement to a key.
    await page.evaluate(() => new Promise((resolve, reject) => {
      let previous, stable = 0;
      const deadline = performance.now() + 5000;
      function observe() {
        const box = document.querySelector('#plan').getAttribute('viewBox');
        stable = box === previous ? stable + 1 : 0;
        previous = box;
        if (stable >= 3) resolve();
        else if (performance.now() > deadline) reject(Error('Project camera did not settle'));
        else requestAnimationFrame(observe);
      }
      observe();
    }));
    const before = await camera();
    await input('pan', 'keydown', () => press('ArrowRight'), {panX:before.x, route:projectRoute, focus:'#stage'});
    const panned = await camera();
    await input('zoom', 'keydown', () => press('='), {zoomWidth:panned.width, route:projectRoute, focus:'#stage'});
    await input('open Missions', 'click', () => locator(launcher).click(), {shown:'#atlasMissionSearch', focus:'#atlasMissionSearch'});
    await fill('#atlasMissionSearch', '');
    assert.equal(await locator('.atlas-mission-row:not([hidden])').count(), 4);
    await input('filter missions', 'input', () => fill('#atlasMissionSearch', 'Review readiness'),
      {count:['.atlas-mission-row:not([hidden])',1], shown:missionRow, focus:'#atlasMissionSearch'});
    await input('focus mission', 'keydown', () => press('ArrowDown'), {focus:missionRow, shown:missionRow});
    await input('inspect mission', 'keydown', () => press('Enter'),
      {route:missionRoute, focus:'#missionDetailTitle', text:['#missionDetailTitle','Review readiness'], shown:'#inspect'});
    await input('inspect tasks', 'click', () => locator('#mission-tab-tasks').click(),
      {shown:'#mission-tab-tasks[aria-selected="true"]', focus:'#mission-tab-tasks', count:['#inspect .tname',tasks.length]});
    assert.deepEqual((await locator('#inspect .tname').allTextContents()).sort(), [...tasks].sort());
    await locator('#mission-tab-brief').click();
    await input('return to result', 'click', () => locator('[data-focus="close-details"]').click(),
      {route:projectRoute, shown:missionRow, focus:missionRow, count:['.atlas-mission-row:not([hidden])',1]});
    await input('return to launcher', 'keydown', () => press('Escape'), {route:projectRoute, focus:launcher, shown:launcher});
    await input('start and advance replay', 'click', () => activate('#play'), {replaying:true});
    const cursor = await locator('#scrub').inputValue();
    await page.waitForTimeout(dwellMs);
    assert.ok(Number(await locator('#scrub').inputValue()) > Number(cursor), 'replay advances during dwell');
    await input('restore live sample', 'click', () => activate('#live'), {shown:'.mission-tasks', route:projectRoute, count:['.atlas-mission-group[data-m]',4]});
    assert.equal(await locator('#live').getAttribute('aria-pressed'), 'true');
    await input('return to overview', 'click', () => locator(overview).click(),
      {route:'#/coven', shown:'.ghostfort', count:['.ghostfort',projects]});
    assert.deepEqual(report.errors, []);
  }
  const scenarioStart = performance.now();
  try {
    await page.goto(new URL('#/coven', base).href);
    await locator('.ghostfort').first().waitFor();
    assert.equal(await locator('.ghostfort').count(), 4);
    assert.equal(new URL(page.url()).hash, '#/coven');
    report.navigation = await page.evaluate(() => performance.getEntriesByType('navigation')[0].toJSON());
    if (projects > 4) {
      await locator('#atlasBrowse').click();
      await locator('#atlasOpenLayout').click();
      await input('populate overview', 'click', () => page.getByRole('button', {name:'Simulate a Coven with ' + projects + ' Projects'}).click(),
        {route:'#/coven', count:['.ghostfort',projects], shown:'.ghostfort'});
    }
    report.workload = await page.evaluate(() => workloadCensus());
    assert.equal(report.workload.projects, projects);
    assert.equal(await locator('.ghostfort').count(), projects);
    await checkpoint();
    await drain();
    phase = 'first journey';
    await journey(300);
    await drain();
    await checkpoint();
    phase = soak ? 'soak' : 'warm';
    const started = performance.now();
    do {
      iteration++;
      await journey(soak ? 8000 : 300);
      await checkpoint();
      await drain();
      if (soak) {
        report.soakElapsedMs = performance.now() - started;
        save(id + '.json', report);
        console.log(id, iteration, Math.round(report.soakElapsedMs / 1000) + 's');
      }
    } while (soak && report.soakElapsedMs < 30 * 60 * 1000);
    if (!soak && projects === 128 && trial === 1) {
      phase = 'profile';
      const traceEvents = [];
      cdp.on('Tracing.dataCollected', ({value}) => traceEvents.push(...value));
      await cdp.send('Tracing.start', {categories: 'devtools.timeline,blink.user_timing', transferMode: 'ReportEvents'});
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.start');
      try { await journey(300); } finally {
        const {profile} = await cdp.send('Profiler.stop');
        const complete = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
        await cdp.send('Tracing.end');
        await complete;
        fs.writeFileSync(path.join(out, id + '.trace.json.gz'), gzipSync(JSON.stringify({traceEvents})));
        fs.writeFileSync(path.join(out, id + '.cpuprofile.gz'), gzipSync(JSON.stringify(profile)));
        await drain();
      }
    }
    report.passed = true;
  } catch (error) {
    failures++; report.passed = false;
    report.failure = {phase, iteration, step, message:error.message, route:page.url(),
      probe:await page.evaluate(() => ({armed:window.perfProbe?.read(), focus:document.activeElement?.outerHTML.slice(0,350),
        selection:document.querySelector('#inspect')?.dataset.selection})).catch(() => null)};
    await drain().catch(() => {});
    console.error(id, JSON.stringify(report.failure));
  } finally {
    save(id + '.json', report);
    await context.close();
    console.log(id, report.passed ? 'passed' : 'failed');
  }
}
try {
  if (mode === 'soak') await scenario('narrow', 128, 1, true);
  else if (mode === 'pilot') for (const size of Object.keys(sizes)) await scenario(size,128,1);
  else for (let trial = 1; trial <= 5; trial++) {
    // Reverse order on alternate trials to distribute run-order effects.
    const cells = Object.keys(sizes).flatMap(size => [4,32,128].map(count => [size,count]));
    for (const [size,count] of trial % 2 ? cells : cells.reverse()) await scenario(size,count,trial);
  }
} finally { await browser.close(); }
save('run.json', {...meta, finished:new Date().toISOString(), failures});
if (failures) process.exitCode = 1;
