// Copy beside the external Playwright installation used by scripts/browser-qa.mjs.
// Run node filtered-review-qa.mjs <served URL>. The JSONL recording is local to each page.
import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';
import {chromium} from 'playwright';

const base = process.argv[2];
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

const start = Date.UTC(2026, 10, 21);
function event(seconds, type, mission, props = {}) {
  return JSON.stringify({t: start + seconds * 1000, type, mission, ...props});
}
const recording = [
  event(0, 'mission.opened', 'first', {name: 'Launch alpha'}),
  event(1, 'mission.opened', 'middle', {name: 'Launch beta'}),
  event(2, 'mission.opened', 'third', {name: 'Launch gamma'}),
  event(3, 'gate.requested', 'first', {ask: 'a', familiar: 'cody'}),
  event(4, 'gate.requested', 'third', {ask: 'c', familiar: 'cody'}),
  event(60, 'gate.resolved', 'third', {ask: 'c', decision: 'held'}),
  event(90, 'mission.closed', 'first'),
].join('\n');

async function tabTo(page, target, key = 'Tab') {
  for (let i = 0; i < 120; i++) {
    if (await target.evaluate(el => el === document.activeElement)) return;
    await page.keyboard.press(key);
  }
  assert.fail('Tab could not reach ' + await target.getAttribute('aria-label'));
}

for (const width of [1440, 390]) for (const formation of ['ring', 'grid']) for (const input of ['pointer', 'keyboard']) {
  test(`filtered review at ${width}px with ${formation} and ${input}`, async () => {
    const mobile = width === 390;
    const page = await browser.newPage({viewport: {width: 1440, height: 900}, reducedMotion: 'reduce', hasTouch: mobile});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(5000);
    try {
      const activate = async target => {
        if (input === 'keyboard') { await tabTo(page, target); await page.keyboard.press('Enter'); }
        else if (mobile) await target.tap();
        else await target.click();
      };
      await page.goto(new URL('#/project/psyche-build', base).href);
      const grid = page.getByRole('button', {name: 'Mission grid'});
      if (!await grid.isVisible()) await activate(page.locator('#atlasMobileView'));
      if (formation === 'grid') await activate(grid);
      assert.equal(await grid.getAttribute('aria-pressed'), String(formation === 'grid'));
      await page.locator('#traceFile').setInputFiles({name: 'review.jsonl', mimeType: 'text/plain', buffer: Buffer.from(recording)});
      const scrub = page.locator('#scrub');
      await page.waitForFunction(() => document.querySelector('#plan [data-m="third"]'));
      await scrub.fill('500');
      await page.setViewportSize({width, height: mobile ? 844 : 900});
      await activate(page.locator(mobile ? '#atlasMobileMap' : '#atlasOverview'));
      await activate(page.locator('#atlasBrowse'));
      const projectSearch = page.locator('#atlasProjectSearch');
      if (input === 'keyboard') {
        await tabTo(page, projectSearch, 'Shift+Tab');
        await page.keyboard.type('Launch gamma');
        await page.keyboard.press('ArrowDown');
      } else await projectSearch.fill('Launch gamma');
      await activate(page.locator('#atlasProjects button:visible'));
      await activate(page.locator(mobile ? '#atlasMobileMissions' : '#atlasMissions'));
      const query = page.locator('#atlasMissionSearch'), filter = page.locator('#atlasMissionState');
      if (input === 'keyboard') {
        await tabTo(page, query);
        await page.keyboard.type('Launch');
        await tabTo(page, filter);
        await page.keyboard.type('Pending');
      } else {
        await query.fill('Launch');
        await filter.selectOption('requests');
      }
      const rows = page.locator('#atlasMissionList button:visible');
      assert.deepEqual(await rows.evaluateAll(items => items.map(row => row.dataset.mission)), ['first', 'third']);
      const scroll = await page.locator('#atlasMissionList').evaluate(el => el.scrollTop);
      await activate(rows.first());
      const title = page.locator('#missionDetailTitle'), next = page.getByRole('button', {name: 'Next mission'});
      assert.equal(await title.textContent(), 'Launch alpha');
      await activate(next);
      assert.equal(await title.textContent(), 'Launch gamma', 'Next skips the nonmatching middle mission');
      assert.equal(await page.locator('.mission-stepper').getAttribute('aria-label'), 'Mission 2 of 2');
      assert.equal((await page.accessibility.snapshot({root: await title.elementHandle()})).description, 'Mission details. Mission 2 of 2');
      assert.match(await page.locator('#atlasNavigationStatus').textContent(), /2 of 2/);
      assert.ok(await next.isDisabled());
      if (input === 'keyboard') await page.keyboard.press('Escape');
      else await activate(page.getByRole('button', {name: 'Close details', exact: true}));
      assert.equal(await query.inputValue(), 'Launch');
      assert.equal(await filter.inputValue(), 'requests');
      assert.equal(await page.locator('#atlasMissionList').evaluate(el => el.scrollTop), scroll);
      assert.ok(await rows.last().evaluate(el => el === document.activeElement));
      // A narrow modal owns the screen. Exercise replay controls on the desktop where they remain visible.
      if (mobile) { assert.deepEqual(errors, []); return; }
      await activate(rows.last());
      await scrub.fill('800'); // Third mission still exists but its last pending request has cleared.
      await rows.first().waitFor();
      assert.equal(await rows.count(), 1);
      assert.ok(await rows.first().evaluate(el => el === document.activeElement));
      await activate(rows.first());
      await scrub.fill('1000'); // The last matching mission disappears.
      await page.locator('#atlasMissionEmpty').waitFor();
      assert.equal(await rows.count(), 0);
      assert.ok(await query.evaluate(el => el === document.activeElement));
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}

test('All Projects preserves row identity across Projects and a fresh permalink uses its own Project', async () => {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}, reducedMotion: 'reduce'});
  try {
    await page.goto(new URL('#/coven', base).href);
    await page.locator('#atlasMissions').click();
    const rows = page.locator('#atlasMissionList button:visible');
    const order = await rows.evaluateAll(items => items.map(row => ({project: row.dataset.project, id: row.dataset.mission})));
    const boundary = order.findIndex((m, i) => i > 0 && m.project !== order[i - 1].project);
    assert.ok(boundary > 0);
    await rows.nth(boundary - 1).click();
    const next = page.getByRole('button', {name: 'Next mission'});
    await next.click();
    const target = order[boundary];
    const permalink = page.url();
    assert.ok(permalink.includes('/project/' + target.project + '/mission/' + target.id + '?'));
    assert.equal(await page.locator('.mission-stepper').getAttribute('aria-label'), 'Mission ' + (boundary + 1) + ' of ' + order.length);
    const fresh = await browser.newPage();
    try {
      await fresh.goto(permalink);
      await fresh.reload();
      assert.equal(await fresh.locator('#missionDetailTitle').textContent(), await page.locator('#missionDetailTitle').textContent());
      assert.equal(await fresh.locator('.mission-stepper').getAttribute('aria-label'), 'Mission 1 of ' + order.filter(m => m.project === target.project).length);
    } finally { await fresh.close(); }
    await page.getByRole('button', {name: 'Previous mission'}).click();
    await next.click();
    await page.keyboard.press('Escape');
    assert.ok(page.url().endsWith('#/coven'));
    assert.ok(await rows.nth(boundary).evaluate(el => el === document.activeElement));
  } finally { await page.close(); }
});

test('return keeps a nonzero scroll position in a long filtered list', async () => {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}, reducedMotion: 'reduce'});
  try {
    await page.goto(new URL('#/project/psyche-build', base).href);
    const events = Array.from({length: 32}, (_, i) => event(i, 'mission.opened', 'r-' + i, {name: 'Queue ' + i}));
    await page.locator('#traceFile').setInputFiles({name: 'queue.jsonl', mimeType: 'text/plain', buffer: Buffer.from(events.join('\n'))});
    await page.locator('#atlasMissions').click();
    await page.locator('#atlasMissionSearch').fill('Queue');
    const list = page.locator('#atlasMissionList'), rows = list.locator('button:visible');
    await rows.nth(19).scrollIntoViewIfNeeded();
    const original = await list.evaluate(el => el.scrollTop);
    assert.ok(original > 0);
    await rows.nth(19).click();
    await page.getByRole('button', {name: 'Next mission'}).click();
    await page.keyboard.press('Escape');
    const offset = await list.evaluate(el => el.scrollTop);
    assert.equal(offset, original);
    assert.ok(await rows.nth(20).evaluate(el => el === document.activeElement));
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    assert.equal(await list.evaluate(el => el.scrollTop), offset);
  } finally { await page.close(); }
});
