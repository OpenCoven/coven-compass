// Browser QA for Coven Compass (evidence level: browser; headless Chromium, not Safari or a device).
//
// Not part of verify-all, and the repository has no npm dependencies. Install Playwright OUTSIDE
// the repository, serve dist/, and run this file from that install:
//
//   mkdir -p /tmp/compass-qa && cd /tmp/compass-qa && npm init -y && npm i playwright@1.48.2
//   npx playwright install chromium
//   python3 -m http.server 18433 --bind 127.0.0.1 --directory <repo>/dist   # any free port except 8765
//   cp <repo>/scripts/browser-qa.mjs . && node browser-qa.mjs http://127.0.0.1:18433/ ./shots ./qa.json $(git -C <repo> rev-parse HEAD)
//
// Append --keyboard-only to run just the keyboard journeys.
// It checks simulation mode (default and ?source=simulation) at 1440x900, 390x844 and 844x390,
// and every ?source=fixture scenario plus ?source=live. It writes a JSON report and screenshots.
// Keep screenshots out of the repository; commit the dated JSON to tests/evidence/.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const [base, shotDir, outJson, commit] = process.argv.slice(2);
fs.mkdirSync(shotDir, { recursive: true });
const VIEWPORTS = [
  { name: 'desktop-1440x900', width: 1440, height: 900, mobile: false },
  { name: 'phone-390x844', width: 390, height: 844, mobile: true },
  { name: 'phone-landscape-844x390', width: 844, height: 390, mobile: true },
];
const SCENARIOS = [
  { query: '?source=fixture&scenario=fresh', state: 'fresh', label: 'Fixture · fresh', rows: 3, message: /not live Coven data/ },
  { query: '?source=fixture', state: 'fresh', label: 'Fixture · fresh', rows: 3, message: /not live Coven data/ },
  { query: '?source=fixture&scenario=stale', state: 'stale', label: 'Fixture · stale', rows: 1, message: /not current/ },
  { query: '?source=fixture&scenario=partial', state: 'reconciling', label: 'Fixture · reconciling', rows: 1, message: /incomplete/ },
  { query: '?source=fixture&scenario=disconnected', state: 'unavailable', label: 'Unavailable', rows: 0, message: /disconnected/ },
  { query: '?source=fixture&scenario=unsupported-version', state: 'unavailable', label: 'Unavailable', rows: 0, message: /"2\.0"/ },
  { query: '?source=live', state: 'unavailable', label: 'Unavailable', rows: 0, message: /Requested "live"/ },
];


// Mission names in project scope must not cover the local Psyche crown or each other.
// Names hidden by the map's own rules (opacity 0) don't count.
const missionNameClashes = () => {
  const box = el => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, x2: b.right, y2: b.bottom }; };
  const shown = el => { const st = getComputedStyle(el); return el.getClientRects().length && st.display !== 'none' && st.visibility !== 'hidden' && +st.opacity > 0.05; };
  const hit = (a, b) => a.x < b.x2 - 1 && b.x < a.x2 - 1 && a.y < b.y2 - 1 && b.y < a.y2 - 1;
  const psy = document.querySelector('#plan .atlas-local-psyche');
  const crownParts = psy ? [...psy.querySelectorAll('path, polygon, text')].filter(shown).map(box) : [];
  const names = [...document.querySelectorAll('#plan .atlas-mission-group > .lead-name')].filter(shown).map(el => ({ t: el.textContent, ...box(el) }));
  const crown = names.filter(n => crownParts.some(c => hit(n, c))).map(n => n.t);
  const pairs = [];
  names.forEach((a, i) => names.slice(i + 1).forEach(b => { if (hit(a, b)) pairs.push(`${a.t} / ${b.t}`); }));
  // Familiar labels on the squads: none may overlap another squad's label or a mission name.
  const squads = [...document.querySelectorAll('#plan .atlas-squad > .task-l')].filter(shown).map(el => ({ t: el.textContent, ...box(el) }));
  const squadPairs = [];
  squads.forEach((a, i) => squads.slice(i + 1).concat(names).forEach(b => { if (hit(a, b)) squadPairs.push(`${a.t} / ${b.t}`); }));
  return { shown: names.length, crown, pairs, squads: squads.length, squadPairs };
};

const browser = await chromium.launch();
const report = { generated_utc: new Date().toISOString(), commit, browser: `chromium ${browser.version()}`,
  tool: 'playwright ' + createRequire(import.meta.url)('playwright/package.json').version, base, evidence_level: 'browser (headless Chromium; not Safari, not a physical device)',
  screenshot_dir: 'kept outside the repository; see the pull request', checks: [], screenshots: [] };
const check = (mode, viewport, name, pass, detail = '') => report.checks.push({ mode, viewport, name, pass: Boolean(pass), detail: String(detail) });

async function open(viewport, query) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.mobile, hasTouch: viewport.mobile, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', r => { if (!r.url().includes('fonts.g')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
  await page.goto(base + query, { waitUntil: 'load' });
  return { context, page, errors };
}
const shot = async (page, name) => {
  const file = path.join(shotDir, `${name}.png`);
  await page.screenshot({ path: file });
  report.screenshots.push(path.basename(file));
};
const visible = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);

// Navigate the native tab order. DOM and accessibility reads observe the journey;
// every interaction after the initial navigation goes through the keyboard.
async function keyboardJourney(vp) {
  const { context, page, errors } = await open(vp, '');
  const mode = 'keyboard';
  let step = 'overview';
  const press = key => page.keyboard.press(key);
  async function tabTo(selector, key = 'Tab') {
    for (let i = 0; i < 100; i++) {
      if (await page.locator(selector + ':focus').count()) return;
      await press(key);
    }
    throw new Error('Could not reach ' + selector + ' using ' + key);
  }
  async function observe(selector, role, name) {
    const target = page.locator(selector);
    const named = page.getByRole(role, { name });
    const indicator = await target.evaluate(el => {
      const style = getComputedStyle(el), rect = el.getBoundingClientRect();
      const name = el.getAttribute('aria-label') || el.labels?.[0]?.innerText || el.innerText;
      return { element: el.id || el.className, name: name.trim(), focused: el === document.activeElement,
        visible: el.matches(':focus-visible') && rect.bottom > 0 && rect.top < innerHeight &&
          rect.right > 0 && rect.left < innerWidth && style.outlineStyle !== 'none' &&
          parseFloat(style.outlineWidth) > 0 && style.outlineColor !== 'rgba(0, 0, 0, 0)',
        outline: style.outline, route: location.hash };
    });
    const pass = indicator.focused && indicator.visible && await named.and(target).count() === 1;
    check(mode, vp.name, step, pass, JSON.stringify(indicator));
    if (!pass) throw new Error('Expected visible keyboard focus and accessible name at ' + selector);
  }
  async function mission(title, project, id) {
    step = 'find ' + title;
    await page.keyboard.type(title);
    await press('ArrowDown');
    const row = '.atlas-mission-row:focus';
    await observe(row, 'button', new RegExp(title + ', ' + project));
    if (!(await page.locator(row).innerText()).includes(project)) throw new Error('Project missing from visible result');
    await press('Enter');
    step = 'inspect ' + title;
    await page.locator('#missionDetailTitle').waitFor();
    await observe('#missionDetailTitle', 'heading', title);
    const route = page.url().split('#')[1]?.split('?')[0];
    if (route !== '/project/' + project + '/mission/' + id ||
        !(await page.locator('#inspect .mission-context').innerText()).includes(project)) throw new Error('Inspector Project or mission route mismatch');
    await shot(page, vp.name + '-keyboard-' + id + '-' + project);
  }
  try {
    const entry = vp.mobile ? '#atlasMobileMissions' : '#atlasMissions';
    step = 'reach Missions from overview';
    if (new URL(page.url()).hash !== '#/coven') throw new Error('Expected the Coven overview');
    await tabTo(entry);
    await observe(entry, 'button', /mission/i);
    await press('Enter');
    step = 'search from the Missions entry';
    await observe('#atlasMissionSearch', 'searchbox', 'Find a mission');
    await mission('Board cards', 'coven-cave', 'm-1');
    step = 'return to matching row';
    await tabTo('[data-focus="mission-back"]', vp.mobile ? 'Tab' : 'Shift+Tab');
    await observe('[data-focus="mission-back"]', 'button', /All missions/);
    await press('Enter');
    await observe('.atlas-mission-row:focus', 'button', /Board cards, coven-cave/);
    await tabTo('#atlasMissionSearch', 'Shift+Tab');
    step = 'recover from an empty search';
    await press('ControlOrMeta+a');
    await page.keyboard.type('no matching mission xyz');
    if (!await visible(page, '#atlasMissionEmpty') || await page.locator('.atlas-mission-row:visible').count()) throw new Error('Expected visible empty results');
    await observe('#atlasMissionSearch', 'searchbox', 'Find a mission');
    await tabTo('#atlasMissionReset');
    await press('Enter');
    await observe('#atlasMissionSearch', 'searchbox', 'Find a mission');
    if (await page.locator('#atlasMissionSearch').inputValue() !== '') throw new Error('Clear filters retained search text');
    await mission('Source survey', 'psyche-build', 'm-2');
    check(mode, vp.name, 'no console errors', !errors.length, errors.join(' | '));
  } catch (error) {
    check(mode, vp.name, step, false, error.message);
    await shot(page, vp.name + '-keyboard-failure');
  } finally {
    await context.close();
  }
}

for (const vp of VIEWPORTS) {
  await keyboardJourney(vp);
  if (process.argv.includes('--keyboard-only')) continue;
  for (const query of ['', '?source=simulation']) {
    const mode = query ? 'simulation (?source=simulation)' : 'simulation (default)';
    const { context, page, errors } = await open(vp, query);
    try {
      await page.waitForSelector('#atlasHeader', { timeout: 10000 });
      await page.waitForTimeout(3000);
      // Fit: every overview Project boundary should sit inside the visible stage.
      const fit = await page.evaluate(async () => {
        const names = new Set((await window.CovenProjection.current().read()).projects.map(p => p.name));
        const stage = document.getElementById('stage').getBoundingClientRect();
        const labels = [...document.querySelectorAll('#plan text')].filter(t => names.has(t.textContent.trim()));
        const out = labels.filter(t => { const r = t.getBoundingClientRect(); return r.width && (r.left < stage.left - 1 || r.right > stage.right + 1 || r.top < stage.top - 1 || r.bottom > stage.bottom + 1); });
        return { labels: labels.length, outside: out.map(t => t.textContent) };
      });
      check(mode, vp.name, 'overview fit keeps every Project in the stage', fit.labels >= 4 && fit.outside.length === 0, `${fit.labels} Project name labels; outside stage: ${fit.outside.join(', ') || 'none'}`);
      const sceneNodes = await page.evaluate(() => document.querySelectorAll('#plan *').length);
      check(mode, vp.name, 'map renders', sceneNodes > 50 && !(await page.evaluate(() => document.getElementById('app').hidden)), `${sceneNodes} SVG nodes in #plan`);
      const sim = await page.evaluate(async () => (window.CovenProjection && window.CovenProjection.current()) ? await window.CovenProjection.current().read() : null);
      check(mode, vp.name, 'simulation source registered and labelled simulated', sim && sim.source.kind === 'simulation' && sim.availability.state === 'simulated' && sim.projects.length >= 4,
        sim ? `${sim.projects.length} projects, state ${sim.availability.state}` : 'no source');
      const projectData = sim && sim.projects[0];
      const tag = `${vp.name}-${query ? 'explicit' : 'default'}`;
      if (!query) await shot(page, `${tag}-overview`);

      // Open a Project from the Projects drawer when it is reachable, otherwise by its route.
      let how = 'route';
      if (await visible(page, '#atlasBrowse')) {
        await page.click('#atlasBrowse');
        const first = page.locator('#atlasProjects button').first();
        if (await first.isVisible().catch(() => false)) { await first.click(); how = 'Projects drawer'; }
      }
      if (how === 'route') await page.evaluate(name => { location.hash = `#/project/${encodeURIComponent(name)}`; }, projectData.name);
      await page.waitForTimeout(700);
      const hash1 = await page.evaluate(() => decodeURIComponent(location.hash));
      check(mode, vp.name, 'open a Project', hash1.startsWith('#/project/'), `${how}; hash ${hash1}`);
      await page.waitForTimeout(2500);
      const named = await page.evaluate(missionNameClashes);
      check(mode, vp.name, 'mission names clear the crown and each other', !named.crown.length && !named.pairs.length,
        `${named.shown} names shown; over the crown: ${named.crown.join(', ') || 'none'}; overlapping: ${named.pairs.join('; ') || 'none'}`);
      check(mode, vp.name, 'familiar labels clear each other and the mission names', !named.squadPairs.length,
        `${named.squads} familiar labels shown; overlapping: ${named.squadPairs.slice(0, 6).join('; ') || 'none'}`);

      // Open a mission from the mission browser.
      const opener = vp.mobile && await visible(page, '#atlasMobileMissions') ? '#atlasMobileMissions' : '#atlasMissions';
      await page.click(opener);
      await page.waitForSelector('.atlas-mission-row:not([hidden])', { timeout: 5000 });
      await page.locator('.atlas-mission-row:not([hidden])').first().click();
      await page.waitForTimeout(800);
      const hash2 = await page.evaluate(() => decodeURIComponent(location.hash));
      const inspector = await visible(page, '#inspect');
      check(mode, vp.name, 'open a mission', hash2.includes('/mission/') && inspector, `via ${opener}; hash ${hash2}; inspector visible ${inspector}`);
      if (!query) await shot(page, `${tag}-mission`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Replay from the start and confirm the cursor moves.
      const before = await page.evaluate(() => ({ clock: document.getElementById('clock')?.textContent, scrub: document.getElementById('scrub')?.value }));
      const playVisible = await visible(page, '#play');
      if (playVisible) await page.click('#play'); else await page.evaluate(() => document.getElementById('play').click());
      await page.waitForTimeout(1500);
      const during = await page.evaluate(() => ({ clock: document.getElementById('clock')?.textContent, scrub: document.getElementById('scrub')?.value,
        label: document.getElementById('play')?.getAttribute('aria-label') }));
      check(mode, vp.name, 'replay starts and moves', during.scrub !== before.scrub || during.clock !== before.clock,
        `${playVisible ? 'clicked' : 'activated hidden'} #play; scrub ${before.scrub} → ${during.scrub}; clock "${before.clock}" → "${during.clock}"; button "${during.label}"`);
      const replayNamed = await page.evaluate(missionNameClashes);
      check(mode, vp.name, 'replay frame: mission names clear the crown and each other', !replayNamed.crown.length && !replayNamed.pairs.length,
        `${replayNamed.shown} names shown; over the crown: ${replayNamed.crown.join(', ') || 'none'}; overlapping: ${replayNamed.pairs.join('; ') || 'none'}`);
      check(mode, vp.name, 'replay frame: familiar labels clear each other and the mission names', !replayNamed.squadPairs.length,
        `${replayNamed.squads} familiar labels shown; overlapping: ${replayNamed.squadPairs.slice(0, 6).join('; ') || 'none'}`);
      if (!query) await shot(page, `${tag}-replay`);

      // Seal lab opens and closes.
      if (await visible(page, '#atlasLab')) {
        await page.click('#atlasLab');
        await page.waitForTimeout(500);
        const lab = await visible(page, '#covenSealLab');
        if (!query) await shot(page, `${tag}-seal-lab`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        check(mode, vp.name, 'Seal lab opens and closes', lab && !(await visible(page, '#covenSealLab')), `open ${lab}`);
      } else {
        check(mode, vp.name, 'Seal lab opens and closes', false, '#atlasLab not visible at this viewport');
      }

      // Mobile dock: present on phones, absent on desktop.
      const dock = await visible(page, '#atlasMobileChrome');
      if (vp.mobile) {
        let detail = `dock visible ${dock}`;
        if (dock) {
          await page.click('#atlasMobileMap');
          await page.waitForTimeout(500);
          const h = await page.evaluate(() => location.hash);
          detail += `; Map → hash "${h}"`;
        }
        check(mode, vp.name, 'mobile dock', dock, detail);
      } else {
        check(mode, vp.name, 'mobile dock hidden on desktop', !dock, `dock visible ${dock}`);
      }
      check(mode, vp.name, 'no console errors', errors.length === 0, errors.join(' | ') || 'none');
    } catch (error) {
      check(mode, vp.name, 'flow completed', false, error.message.split('\n')[0]);
      await shot(page, `${vp.name}-${query ? 'explicit' : 'default'}-failure`).catch(() => {});
    }
    await context.close();
  }

  for (const s of SCENARIOS) {
    const mode = s.query;
    const { context, page, errors } = await open(vp, s.query);
    try {
      await page.waitForFunction(() => {
        const n = document.querySelector('.pv-status');
        return n && n.querySelector('.pv-badge') && n.querySelector('.pv-badge').textContent !== 'Loading';
      }, null, { timeout: 8000 });
      const r = await page.evaluate(() => ({
        appHidden: document.getElementById('app').hidden,
        appVisible: !!document.getElementById('app').offsetParent,
        header: !!document.getElementById('atlasHeader'),
        sceneNodes: document.querySelectorAll('#plan *').length,
        state: document.querySelector('.pv-status').getAttribute('data-state'),
        label: document.querySelector('.pv-status .pv-badge').textContent,
        text: document.querySelector('.pv-status').textContent,
        tableHidden: document.querySelector('.pv-table').hasAttribute('hidden'),
        rows: document.querySelectorAll('.pv-table tr').length,
        kind: window.CovenProjection && window.CovenProjection.current() && window.CovenProjection.current().kind,
        overflowX: document.documentElement.scrollWidth > window.innerWidth,
        tableClipped: (() => { const w = document.querySelector('.pv-scroll') || document.querySelector('.pv-table'); return !!w && !w.hidden && !w.hasAttribute('hidden') && w.scrollWidth > w.clientWidth + 1; })(),
      }));
      check(mode, vp.name, 'simulation never boots', r.appHidden && !r.appVisible && !r.header,
        `#app hidden ${r.appHidden}; atlasHeader mounted ${r.header}; plan SVG nodes ${r.sceneNodes}`);
      check(mode, vp.name, 'state and label', r.state === s.state && r.label === s.label, `state ${r.state}; label "${r.label}"`);
      check(mode, vp.name, 'message', s.message.test(r.text), r.text.slice(0, 200));
      check(mode, vp.name, 'table', s.rows ? (!r.tableHidden && r.rows === s.rows + 1) : (r.tableHidden && r.rows === 0),
        `hidden ${r.tableHidden}; tr ${r.rows} (expected ${s.rows ? s.rows + 1 : 0})`);
      check(mode, vp.name, 'no horizontal page scroll', !r.overflowX, `scrollWidth > innerWidth: ${r.overflowX}`);
      check(mode, vp.name, 'table fits without clipping', !r.tableClipped, `table wider than its container: ${r.tableClipped}`);
      check(mode, vp.name, 'no console errors', errors.length === 0, errors.join(' | ') || 'none');
      await shot(page, `${vp.name}-${s.query.replace(/[?&=]/g, '_')}`);
    } catch (error) {
      check(mode, vp.name, 'projection view settled', false, error.message.split('\n')[0]);
    }
    await context.close();
  }
}
await browser.close();
const failed = report.checks.filter(c => !c.pass);
report.summary = { checks: report.checks.length, passed: report.checks.length - failed.length, failed: failed.length };
fs.writeFileSync(outJson, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.summary));
for (const f of failed) console.log(`FAIL [${f.viewport}] ${f.mode} :: ${f.name} :: ${f.detail}`);
process.exitCode = failed.length ? 1 : 0;
