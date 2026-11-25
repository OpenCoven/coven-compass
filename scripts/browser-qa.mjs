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
// Append --brief-only to exercise Brief authoring, replay and fixtures. Add --webkit for Playwright WebKit.
// Append --keyboard-only for mission discovery, inspector return, route reload and the compact-label control.
// The desktop compact check imports eight mission.opened JSON Lines via Trace > Import.
// Its negative control removes the keyboard-focus visibility selector from the disposable page.
// It checks simulation mode (default and ?source=simulation) at 1440x900, 390x844 and 844x390,
// and every ?source=fixture scenario plus ?source=live. At each viewport it also exercises the success criteria
// editor in New mission and Edit brief. It writes a JSON report and screenshots.
// Keep screenshots out of the repository; commit the dated JSON to tests/evidence/.
import { chromium, webkit } from 'playwright';
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
  // Synthetic Brief success policy cases (#35 proposal): no Projects, one policy panel each.
  ...[['rubric-pass', 'request-authorized-acceptance'], ['rubric-fail', 'request-bounded-revision'], ['hard-failure', 'stop-escalate'],
    ['missing-evidence', 'wait-for-evidence'], ['stale-evaluation', 'wait-for-evidence'], ['remediable-failure', 'request-bounded-revision'],
    ['budget-exhausted', 'stop-escalate'], ['cancelled', 'stop-escalate'], ['unresolved-effects', 'stop-escalate'],
    ['authorization-expired', 'stop-escalate']].map(([name, action]) => ({ query: '?source=fixture&scenario=brief-' + name,
    state: 'synthetic', label: 'Fixture · synthetic', rows: 0, message: /not Coven data/, brief: action })),
  { query: '?source=fixture&scenario=brief-nope', state: 'unavailable', label: 'Unavailable', rows: 0, message: /Known Brief cases/ },
];


// Mission names in project scope must not cover the local Psyche crown or each other.
// Names hidden by the map's own rules (opacity 0) don't count.
const missionNameClashes = () => {
  const box = el => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, x2: b.right, y2: b.bottom }; };
  const shown = el => { const st = getComputedStyle(el); return el.getClientRects().length && st.display !== 'none' && st.visibility !== 'hidden' && +st.opacity > 0.05; };
  const hit = (a, b) => a.x < b.x2 - 1 && b.x < a.x2 - 1 && a.y < b.y2 - 1 && b.y < a.y2 - 1;
  const psy = document.querySelector('#plan .atlas-local-psyche');
  const crownParts = psy ? [...psy.querySelectorAll('.coord-face')].filter(shown).map(box) : [];
  const trays = [...document.querySelectorAll('#plan .mission-tasks .task-tray-bg')].filter(shown).map(box);
  const labels = [...document.querySelectorAll('#plan .atlas-mission-group .lead-name')];
  const names = labels.filter(shown).map(el => {
    const face = box(el.closest('.mission-face').querySelector('.se-face')), text = box(el);
    const vertical = text.y2 <= face.y - 1 || text.y >= face.y2 + 1;
    const horizontal = text.x2 <= face.x - 1 || text.x >= face.x2 + 1;
    const centered = vertical && Math.abs((text.x + text.x2 - face.x - face.x2) / 2) < 1 ||
      horizontal && Math.abs((text.y + text.y2 - face.y - face.y2) / 2) < 2;
    const outside = (vertical || horizontal) && !trays.some(tray => hit(text, tray));
    const pixels = parseFloat(getComputedStyle(el).fontSize) * el.getScreenCTM().a;
    return { t: [...el.children].map(line => line.textContent).join(' '), centered, outside, pixels, ...text };
  });
  const crown = names.filter(n => crownParts.some(c => hit(n, c))).map(n => n.t);
  const pairs = [];
  names.forEach((a, i) => names.slice(i + 1).forEach(b => { if (hit(a, b)) pairs.push(`${a.t} / ${b.t}`); }));
  // Familiar labels on the squads: none may overlap another squad's label or a mission name.
  const squads = [...document.querySelectorAll('#plan .atlas-squad > .task-l')].filter(shown).map(el => ({ t: el.textContent, ...box(el) }));
  const squadPairs = [];
  squads.forEach((a, i) => squads.slice(i + 1).concat(names).forEach(b => { if (hit(a, b)) squadPairs.push(`${a.t} / ${b.t}`); }));
  return { total: labels.length, shown: names.length, centers: names.filter(n => n.centered && n.outside).length, smallestFont: Math.min(...names.map(n => n.pixels)), crown, pairs, squads: squads.length, squadPairs };
};

const briefOnly = process.argv.includes('--brief-only');
const engine = process.argv.includes('--webkit') ? webkit : chromium;
const browser = await engine.launch();
const report = { generated_utc: new Date().toISOString(), commit, browser: `${engine.name()} ${browser.version()}`,
  tool: 'playwright ' + createRequire(import.meta.url)('playwright/package.json').version, base, evidence_level: 'browser (headless ' + engine.name() + ')',
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
  let keys = 0;
  const press = key => { keys++; return page.keyboard.press(key); };
  const type = text => { keys += text.length; return page.keyboard.type(text); };
  async function tabTo(selector, key = 'Tab') {
    for (let i = 0; i < 100; i++) {
      if (await page.locator(selector + ':focus').count()) return i;
      await press(key);
    }
    throw new Error('Could not reach ' + selector + ' using ' + key);
  }
  async function observe(selector, role, name) {
    const target = page.locator(selector);
    const named = page.getByRole(role, { name });
    // Resolve the element and measure it in one browser task. Replay can replace an inspector heading between protocol calls.
    const indicator = await page.evaluate(selector => {
      const el = document.querySelector(selector);
      if (!el) throw new Error('Keyboard target is missing: ' + selector);
      const style = getComputedStyle(el), rect = el.getBoundingClientRect();
      const name = el.getAttribute('aria-label') || el.labels?.[0]?.innerText || el.innerText;
      return { element: el.id || el.className, name: name.trim(), focused: el === document.activeElement,
        visible: el.matches(':focus-visible') && rect.bottom > 0 && rect.top < innerHeight &&
          rect.right > 0 && rect.left < innerWidth && style.outlineStyle !== 'none' &&
          parseFloat(style.outlineWidth) > 0 && style.outlineColor !== 'rgba(0, 0, 0, 0)',
        outline: style.outline, route: location.hash };
    }, selector);
    const pass = indicator.focused && indicator.visible && await named.and(target).count() === 1;
    check(mode, vp.name, step, pass, JSON.stringify({...indicator, keys}));
    if (!pass) throw new Error('Expected visible keyboard focus and accessible name at ' + selector);
  }
  async function mission(title, project, id) {
    step = 'find ' + title;
    await type(title);
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
    const tabs = await tabTo(entry);
    check(mode, vp.name, 'Missions within five Tabs', tabs <= 5, tabs + ' Tabs to ' + entry);
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
    await type('no matching mission xyz');
    if (!await visible(page, '#atlasMissionEmpty') || await page.locator('.atlas-mission-row:visible').count()) throw new Error('Expected visible empty results');
    await observe('#atlasMissionSearch', 'searchbox', 'Find a mission');
    await tabTo('#atlasMissionReset');
    await press('Enter');
    await observe('#atlasMissionSearch', 'searchbox', 'Find a mission');
    if (await page.locator('#atlasMissionSearch').inputValue() !== '') throw new Error('Clear filters retained search text');
    await mission('Source survey', 'psyche-build', 'm-2');
    step = 'close details and return to the invoking row';
    await tabTo('[data-focus="close-details"]');
    await press('Enter');
    await observe('.atlas-mission-row:focus', 'button', /Source survey, psyche-build/);
    step = 'dismiss Missions and return to its launcher';
    await press('Escape');
    await observe(entry, 'button', /mission/i);
    check(mode, vp.name, 'original overview restored', new URL(page.url()).hash === '#/coven', page.url());
    await press('Enter');
    await press('ArrowDown');
    await press('Enter');
    step = 'reload mission permalink';
    const permalink = page.url();
    if (!permalink.includes('/project/psyche-build/mission/m-2')) throw new Error('Expected Source survey before reloading');
    await page.reload();
    await page.getByRole('heading', {name: 'Source survey', exact: true}).waitFor();
    check(mode, vp.name, step, page.url() === permalink, permalink);
    check(mode, vp.name, 'no console errors', !errors.length, errors.join(' | '));
  } catch (error) {
    check(mode, vp.name, step, false, error.message);
    await shot(page, vp.name + '-keyboard-failure');
  } finally {
    await context.close();
  }
}

async function compactMissionLabel() {
  const vp = {name: 'desktop-1920x1080', width: 1920, height: 1080, mobile: false}, mode = 'compact map';
  const { context, page, errors } = await open(vp, '');
  try {
    await page.locator('#atlasBrowse').click();
    await page.locator('.atlas-project[data-project="psyche-build"]').click();
    await page.locator('#workspaceTools > summary').click();
    await page.locator('#traceBox > summary').click();
    await page.locator('#traceImport').click();
    const fileChoice = page.waitForEvent('filechooser');
    await page.locator('#traceDrop').click();
    const recording = Array.from({length: 8}, (_, i) => JSON.stringify({
      t: '2026-11-18T06:20:00Z', type: 'mission.opened', mission: 'm-' + (i + 1), name: 'Mission ' + (i + 1)
    })).join('\n');
    await (await fileChoice).setFiles({name: 'eight-missions.jsonl', mimeType: 'text/plain', buffer: Buffer.from(recording)});
    await page.waitForFunction(() => document.getElementById('traceKind').textContent === 'loaded' &&
      document.querySelectorAll('#plan .lead-node').length === 8);
    const compact = '#plan .atlas-compact-seal .lead-node';
    for (let i = 0; i < 10 && !(await page.locator(compact).count()); i++) {
      await page.locator('#atlasZoomOut').click();
      await page.waitForTimeout(180);
    }
    await page.locator(compact).first().waitFor();
    await page.mouse.move(0, 0);
    const target = page.locator(compact + ':focus-visible');
    const mapItem = page.locator('#plan [data-map-item]:focus');
    for (let i = 0; i < 100 && !await mapItem.count(); i++) await page.keyboard.press('Tab');
    if (!await mapItem.count()) throw new Error('Tab did not enter the map');
    const itemCount = await page.locator('#plan [data-map-item]').count();
    for (let i = 0; i < itemCount && !await target.count(); i++) await page.keyboard.press('ArrowRight');
    await target.waitFor({timeout: 3000});
    const label = target.locator('.lead-name');
    const name = (await target.getAttribute('aria-label')).split(',')[0];
    if (!/^Mission [1-8]$/.test(name) || !await target.evaluate(el => !el.matches(':hover,.sel'))) throw new Error('Expected an unselected, keyboard-focused recording mission');
    const visibleLabel = () => label.evaluate(el => {
      const box = el.getBoundingClientRect(), style = getComputedStyle(el);
      return Number(style.opacity) > .9 && style.visibility === 'visible' && box.width > 0 && box.height > 0 &&
        box.bottom > 0 && box.right > 0 && box.top < innerHeight && box.left < innerWidth;
    });
    const lettering = await label.evaluate(el => {
      const face = el.closest('.mission-face').querySelector('.se-face').getBoundingClientRect();
      const box = el.getBoundingClientRect();
      const centerError = Math.abs((box.left + box.right - face.left - face.right) / 2);
      const fontPixels = parseFloat(getComputedStyle(el).fontSize) * el.getScreenCTM().a;
      return {centerError, fontPixels, outside: box.bottom <= face.top - 1 || box.top >= face.bottom + 1};
    });
    check(mode, vp.name, 'focused compact label visible and centered outside ring', await visibleLabel() &&
      lettering.centerError < 1 && lettering.fontPixels >= 10 && lettering.outside, JSON.stringify({name, ...lettering}));
    await shot(page, 'desktop-compact-keyboard-label');
    // Keep the same mission, zoom, focus and hover state. Remove only the focus visibility rule.
    await page.evaluate(() => {
      const focus = 'body.atlas-enhanced #plan .atlas-compact-seal .lead-node:focus-visible .lead-name';
      for (const sheet of document.styleSheets) {
        if (sheet.href && !sheet.href.startsWith(location.origin)) continue;
        for (const rule of sheet.cssRules) {
          if (!rule.selectorText?.includes(focus)) continue;
          rule.selectorText = rule.selectorText.replace(', ' + focus, '').replace(',\n' + focus, '');
          if (!rule.selectorText.includes(focus)) return;
        }
      }
      throw new Error('Compact label focus visibility selector was unavailable');
    });
    await page.waitForFunction(() => getComputedStyle(document.activeElement.querySelector('.lead-name')).visibility === 'hidden');
    check(mode, vp.name, 'same focused label hidden without keyboard-focus rule', await target.count() === 1 && !await visibleLabel(), name);
    check(mode, vp.name, 'no console errors', !errors.length, errors.join(' | '));
  } catch (error) {
    check(mode, vp.name, 'recording import and focus control', false, error.message);
    await shot(page, 'desktop-compact-failure');
  } finally { await context.close(); }
}

// The success criteria editor in New mission and Edit brief (#35, ported from #42): it previews the rule before
// Save, blocks Save while the criteria are invalid, and an edit derives a new policy revision. Nothing is accepted.
async function briefEditor(vp) {
  const mode = 'brief editor';
  const { context, page, errors } = await open(vp, '#/project/psyche-build');
  const done = () => page.locator('#nmDone').textContent();
  const panel = () => page.evaluate(() => { const bp = document.querySelector('#inspect .bp'); return bp && { text: bp.textContent.replace(/\s+/g, ' '),
    rev: (bp.textContent.match(/sim-[0-9a-f]{8}/) || [])[0], next: bp.querySelector('.bp-action')?.textContent, accepted: bp.querySelectorAll('.bp-step')[3]?.textContent }; });
  try {
    page.setDefaultTimeout(7000);
    const opener = vp.mobile && await visible(page, '#atlasMobileMissions') ? '#atlasMobileMissions' : '#atlasMissions';
    await page.locator(opener).click();
    await page.locator('#atlasMissionProject').selectOption('psyche-build');
    await page.locator('#atlasMissionCreate').click();
    await page.locator('#nmName').fill('Criteria check');
    await page.locator('#nmCustomize').click();
    await page.locator('[data-id="bp-add"]').click();
    const added = await done();
    check(mode, vp.name, 'adding success criteria previews the completion rule before Save',
      /all 4 required conditions pass/.test(added) && /at least 80 of 100/.test(added) && /3 attempts/.test(added) && /acceptance is a separate, authorized step/.test(added), added);
    check(mode, vp.name, 'valid criteria and a name enable Create mission', !(await page.locator('#raise').isDisabled()));
    await page.locator('[data-id="bp-min"]').fill('101');
    const blocked = await page.locator('#raise').isDisabled(), why = await page.locator('#nmSuccessErrors').textContent();
    check(mode, vp.name, 'invalid criteria block Open mission and say why', blocked && /minimum weighted score/.test(why) && /incomplete/.test(await done()), why);
    await page.locator('[data-id="bp-custom"]').fill('Signed review attached');
    await page.locator('[data-id="bp-min"]').fill('85');
    await page.locator('[data-id="bp-attempts"]').fill('4');
    await page.locator('#nmName').fill('Criteria check');
    // Measure the editor where the user can see it after the sheet settles.
    await page.locator('.bp-editor').scrollIntoViewIfNeeded();
    const fit = await page.evaluate(() => { const e = document.querySelector('.bp-editor').getBoundingClientRect(), f = document.getElementById('empty');
      return { width: e.width, right: e.right, viewport: innerWidth, scroll: f.scrollWidth, client: f.clientWidth }; });
    const fits = fit.width > 0 && fit.right <= fit.viewport + 1 && fit.scroll <= fit.client + 1;
    check(mode, vp.name, 'valid criteria re-enable Open mission, and the editor fits', !(await page.locator('#raise').isDisabled()) && fits, JSON.stringify(fit));
    await shot(page, `${vp.name}-brief-editor`);
    // After Save the page selects the mission; on a phone it opens its details. Otherwise open it from Missions.
    const reopen = async () => {
      if (!(await visible(page, '#mission-tab-brief'))) {
        await page.click(vp.mobile && await visible(page, '#atlasMobileMissions') ? '#atlasMobileMissions' : '#atlasMissions');
        await page.locator('.atlas-mission-row:not([hidden])', { hasText: 'Criteria check' }).first().click();
        await page.waitForTimeout(800);
      }
      await page.click('#mission-tab-brief');
      await page.waitForTimeout(400);
    };
    await page.locator('#raise').click();
    await page.waitForTimeout(2600);
    await reopen();
    const first = await panel();
    check(mode, vp.name, 'the saved criteria reach the inspector, waiting for evidence, not accepted',
      first && /at least 85 of 100/.test(first.text) && /4 attempts/.test(first.text) && first.next === 'Wait for evidence' && /Not recorded/.test(first.accepted) && !!first.rev,
      first ? `${first.rev}; next "${first.next}"` : 'no .bp panel');
    await page.locator('#inspect [data-focus="edit-brief"]').click();
    await page.keyboard.press('Escape');
    const edit = page.locator('#inspect [data-focus="edit-brief"]');
    check(mode, vp.name, 'dismissing the editor returns keyboard focus', await edit.evaluate(el => el === document.activeElement));
    await edit.press('Enter');
    const kept = await page.locator('[data-id="bp-attempts"]').inputValue();
    await page.locator('[data-id="bp-attempts"]').fill('6');
    const preview = await done();
    await page.locator('#raise').click();
    await page.waitForTimeout(1800);
    await reopen();
    const second = await panel();
    check(mode, vp.name, 'Edit brief keeps the criteria, previews the edit, and saving derives a new revision',
      kept === '4' && /6 attempts/.test(preview) && second && /6 attempts/.test(second.text) && second.rev && first && second.rev !== first.rev && /Not recorded/.test(second.accepted),
      `kept ${kept}; ${first && first.rev} → ${second && second.rev}`);
    await page.reload();
    await page.locator('#inspect .bp').waitFor();
    const restored = await panel();
    check(mode, vp.name, 'reload restores edited policy, required evidence and acceptance state',
      second.rev === restored.rev && restored.text.includes('Signed review attached') && /Not recorded/.test(restored.accepted));
    await page.getByRole('button', {name: 'History', exact: true}).click();
    const firstEvent = page.locator('.history-event').filter({hasText: 'Mission opened'}).first();
    await firstEvent.click();
    const jump = page.getByRole('button', {name: /Show event .* on map/});
    await jump.click();
    await page.locator('#historyReturn').waitFor();
    check(mode, vp.name, 'replay selects the opening event and leaves live mode',
      /mission.opened/.test(await page.locator('#historyMapNote').innerText()) && await page.locator('#live').getAttribute('aria-pressed') === 'false');
    if (!await visible(page, '#inspect .bp')) await page.locator('[data-focus="open-details"]:visible').click();
    const replayed = await panel();
    check(mode, vp.name, 'the opening event restores the original policy revision', replayed.rev === first.rev && /4 attempts/.test(replayed.text) && replayed.accepted.includes('Not recorded'));
    // The mobile inspector owns keyboard focus until the user dismisses it.
    if (vp.mobile) await page.getByRole('button', {name: 'Close details', exact: true}).click();
    await page.getByRole('button', {name: 'Return to History'}).press('Enter');
    check(mode, vp.name, 'returning from replay restores the event control focus', await jump.evaluate(el => el === document.activeElement));
    const fixture = async name => {
      await page.goto(new URL('?source=fixture&scenario=brief-' + name, base).href);
      await page.locator('.bp').waitFor();
      await page.locator('.bp-evals summary').click();
      return page.locator('.bp').innerText();
    };
    const missing = await fixture('missing-evidence');
    check(mode, vp.name, 'passing rubric cannot substitute for missing evidence', missing.includes('4 of 5') && missing.includes('Unknown') && missing.includes('Wait for evidence') && missing.includes('Not recorded'));
    const failed = await fixture('rubric-fail');
    check(mode, vp.name, 'first failed grade proposes a bounded retry', failed.includes('Request a bounded revision') && failed.includes('1 of 3') && failed.includes('$3 of $12'));
    const stale = await fixture('stale-evaluation');
    check(mode, vp.name, 'second attempt retains spending and excludes old grades', stale.includes('2 of 3') && stale.includes('$5 of $12') && stale.includes('45 min of 90 min') && stale.includes('another policy revision') && stale.includes('candidate') && stale.includes('Wait for evidence'));
    await page.reload();
    await page.locator('.bp-evals summary').click();
    check(mode, vp.name, 'reload preserves both evaluation records and their provenance', stale === await page.locator('.bp').innerText() && stale.includes('pol-report-r1') && stale.includes('evi_3') && stale.includes('reviewer-sage'));
    check(mode, vp.name, 'no console errors', !errors.length, errors.join(' | '));
  } catch (error) {
    check(mode, vp.name, 'brief editor journey', false, error.message.split('\n')[0]);
    await shot(page, `${vp.name}-brief-editor-failure`);
  } finally { await context.close(); }
}

if (!briefOnly) await compactMissionLabel();
for (const vp of VIEWPORTS) {
  if (!briefOnly) await keyboardJourney(vp);
  if (process.argv.includes('--keyboard-only')) continue;
  await briefEditor(vp);
  if (briefOnly) continue;
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
      const minimumText = vp.height < 400 ? 8.5 : 10;
      check(mode, vp.name, 'every sample mission name is readable outside its ring at Project fit',
        named.total > 0 && named.centers === named.total && named.smallestFont >= minimumText,
        `${named.centers} of ${named.total} centered names, smallest text ${named.smallestFont.toFixed(1)}px`);
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

      // The Brief tab carries the success policy panel (#35 proposal), labeled simulation, never accepted.
      if (inspector) {
        await page.click('#mission-tab-brief');
        await page.waitForTimeout(400);
        const bp = await page.evaluate(() => {
          const panel = document.querySelector('#inspect .bp'), box = document.getElementById('inspect');
          if (!panel) return null;
          const r = panel.getBoundingClientRect();
          return { badge: panel.querySelector('.bp-badge').textContent, steps: [...panel.querySelectorAll('.bp-step dt')].map(d => d.textContent),
            accepted: panel.querySelectorAll('.bp-step')[3].textContent, next: panel.querySelector('.bp-action').textContent,
            sections: [...panel.querySelectorAll('.bp-sec h4')].map(h => h.textContent),
            fits: r.width > 0 && box.scrollWidth <= box.clientWidth + 1 && r.right <= window.innerWidth + 1 };
        });
        check(mode, vp.name, 'Brief tab shows the success policy proposal apart from acceptance',
          bp && /Simulation · proposal/.test(bp.badge) && bp.steps.join('|') === 'Proposal|Execution|Quality qualification|Accepted completion'
            && /Not recorded/.test(bp.accepted) && bp.next === 'Wait for evidence' && bp.sections.length === 4 && bp.fits,
          bp ? `badge "${bp.badge}"; steps ${bp.steps.join(' / ')}; next "${bp.next}"; sections ${bp.sections.join(' / ')}; fits ${bp.fits}` : 'no .bp panel in #inspect');
        if (!query) {
          await page.locator('#inspect .bp').scrollIntoViewIfNeeded().catch(() => {});
          await shot(page, `${tag}-brief-policy`);
        }
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      if (await visible(page, '#atlasMissionBrowser')) await page.keyboard.press('Escape');

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
        await page.locator('.csl-state-btn[data-state="active"]').click();
        const progress = page.locator('.csl-scene .se-progress').first();
        const before = await progress.getAttribute('stroke-dasharray');
        await page.locator('#cslProgress0').press('ArrowRight');
        const after = await progress.getAttribute('stroke-dasharray');
        check(mode, vp.name, 'Seal lab extends a familiar’s progress arc', parseFloat(after) > parseFloat(before),
          `${before} to ${after}`);
        await page.getByRole('button', {name: 'Familiar rings', exact: true}).click();
        const face = page.locator('.csl-face');
        await page.getByRole('button', {name: 'Charm', exact: true}).last().click();
        const arc = face.locator('.fam-progress');
        const charmBefore = await arc.getAttribute('stroke-dasharray');
        await page.locator('#cslProgress3').press('ArrowRight');
        check(mode, vp.name, 'Charm preview updates its ring from the visible member controls',
          parseFloat(await arc.getAttribute('stroke-dasharray')) > parseFloat(charmBefore) && await page.locator('.csl-familiar:visible').count() === 1,
          await face.getAttribute('aria-label'));
        await page.locator('.csl-state-btn[data-state="needsYou"]').click();
        check(mode, vp.name, 'the familiar requesting review shows a distinct rim and accessible state',
          await face.locator('.fam-state').getAttribute('data-state') === 'Needs you' && /Echo.*Needs you/.test(await face.getAttribute('aria-label')),
          await face.getAttribute('aria-label'));
        await page.locator('.csl-state-btn[data-state="broken"]').click();
        check(mode, vp.name, 'a stopped familiar uses the blocked rim',
          await face.locator('.fam-state').getAttribute('data-state') === 'Blocked', await face.getAttribute('aria-label'));
        await page.getByRole('button', {name: 'Mission seal', exact: true}).click();
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
      if (s.brief) {
        const bp = await page.evaluate(() => {
          const panel = document.querySelector('.pv-brief .bp');
          return panel && { badge: panel.querySelector('.bp-badge').textContent, next: panel.querySelector('.bp-next').className,
            steps: panel.querySelectorAll('.bp-step').length, accepted: panel.querySelectorAll('.bp-step')[3].textContent,
            cases: document.querySelectorAll('.pv-brief nav a').length, current: document.querySelector('.pv-brief nav a[aria-current="page"]')?.textContent };
        });
        check(mode, vp.name, 'synthetic Brief case: labeled, next action, acceptance not recorded',
          bp && /Synthetic fixture/.test(bp.badge) && bp.next.includes('is-' + s.brief) && bp.steps === 4 && /Not recorded/.test(bp.accepted) && bp.cases >= 10 && !!bp.current,
          bp ? `badge "${bp.badge}"; ${bp.next}; steps ${bp.steps}; links ${bp.cases}; current ${bp.current}` : 'no .bp panel');
      }
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
