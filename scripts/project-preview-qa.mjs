// Run alongside the external Playwright installation used by browser-qa.mjs.
import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';
import {chromium} from 'playwright';

const base = process.argv[2];
if (!base) throw new Error('Pass the URL of a running Compass preview.');
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

for (const [width, height] of [[1440, 900], [390, 844]]) {
  test(`project previews and task groups at ${width}×${height}`, async () => {
    const page = await browser.newPage({viewport: {width, height}, reducedMotion: 'reduce', hasTouch: width < 500});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(base);
      await page.locator(width < 500 ? '#atlasMobileMap' : '#atlasOverview').click();
      const project = page.locator('.ghostfort[aria-label^="psyche-build,"]');
      await project.locator('.preview-mission').first().waitFor({state: 'visible'});
      assert.equal(await project.locator('.preview-mission').count(), 4);
      assert.equal(await project.locator('.gname').textContent(), 'psyche-build');
      assert.equal(await page.locator('.ghostfort.dormant .preview-mission').count(), 0);
      assert.match(page.url(), /#\/coven/);
      if (width < 500) await project.tap();
      else {
        await page.locator('#atlasBrowse').click();
        const row = page.locator('.atlas-project[data-project="psyche-build"]');
        assert.match(await row.locator('.atlas-project-preview-names').innerText(), /Review readiness/);
        await row.click();
      }
      const trays = page.locator('#plan .mission-tasks');
      const tray = trays.first();
      await tray.waitFor();
      assert.equal(await trays.count(), 4);
      assert.equal(await page.locator('.lead-node.sel').count(), 0);
      assert.ok(await tray.locator('.task-tray-bg').isVisible());
      assert.ok(await tray.locator('.task-cog').count() > 0);
      assert.match(await tray.getAttribute('aria-label'), /tasks? on .+Open task list/);
      if (width < 500) await tray.tap();
      else { await tray.focus(); await page.keyboard.press('Enter'); }
      await page.locator('#inspect [role="tab"][aria-selected="true"]').filter({hasText: 'Tasks'}).waitFor();
      assert.ok(await page.locator('#inspect .tname').count() > 0);
      // Import tasks with zero agents through the same supported UI as a local recording.
      await page.setViewportSize({width: 1440, height: 900});
      await page.goto(new URL('#/project/psyche-build', base).href);
      await page.reload();
      await page.locator('#traceBox > summary').click();
      await page.locator('#traceLoad > summary').click();
      const names = ['Brief', 'Review', 'Copy', 'Layout', 'Polish'];
      const event = (type, props) => JSON.stringify({t:'2026-11-18T06:20:00Z', type, mission:'solo', ...props});
      const records = [event('mission.opened', {name: 'Unstaffed mission'}), ...names.map((name, i) =>
        event('task.opened', {task: 'task-' + i, name, familiar: 'cody'}))];
      const chooser = page.waitForEvent('filechooser');
      await page.locator('#traceDrop').click();
      await (await chooser).setFiles({name:'tasks.jsonl', mimeType:'text/plain', buffer:Buffer.from(records.join('\n'))});
      const unstaffed = page.locator('.atlas-mission-group[data-m="solo"] .mission-tasks');
      await unstaffed.waitFor();
      await page.setViewportSize({width, height});
      assert.equal(await unstaffed.locator('.task-cog').count(), 3);
      assert.equal(await unstaffed.locator('.task-overflow').textContent(), '+2');
      // Start from the overview again, this time with a Project containing only unstaffed tasks.
      await page.locator(width < 500 ? '#atlasMobileMap' : '#atlasOverview').click();
      await project.locator('.preview-mission').first().waitFor();
      const item = page.locator('#plan [data-map-item]:focus');
      for (let i = 0; i < 100 && !await item.count(); i++) await page.keyboard.press('Tab');
      assert.equal(await item.count(), 1, 'Tab enters the map');
      await page.keyboard.press('Home');
      const first = await item.getAttribute('aria-label');
      await page.keyboard.press('End');
      assert.notEqual(await item.getAttribute('aria-label'), first);
      await page.keyboard.press('Home');
      const projectCount = await page.locator('.ghostfort').count();
      for (let i = 0; i < projectCount && !await project.evaluate(el => el.matches(':focus')); i++) {
        await page.keyboard.press('ArrowRight');
      }
      assert.ok(await project.evaluate(el => el.matches(':focus')), 'arrow keys reach the Project preview');
      assert.equal(await page.locator('#plan [tabindex="0"]').count(), 1);
      await page.keyboard.press('Tab');
      assert.equal(await item.count(), 0, 'one Tab leaves the map');
      await page.keyboard.press('Shift+Tab');
      assert.ok(await project.evaluate(el => el.matches(':focus')), 'Tab returns to the same Project');
      await page.keyboard.press('Enter');
      await unstaffed.waitFor();
      assert.equal(await item.count(), 1, 'opening a Project from the map keeps keyboard focus inside it');
      const itemCount = await page.locator('#plan [data-map-item]').count();
      for (let i = 0; i < itemCount && !await unstaffed.evaluate(el => el.matches(':focus')); i++) await page.keyboard.press('ArrowRight');
      assert.ok(await unstaffed.evaluate(el => el.matches(':focus')), 'arrow keys reach the unstaffed task group');
      await page.keyboard.press('Space');
      assert.deepEqual(await page.locator('#inspect .tname').allTextContents(), names);
      await page.locator('[data-focus="close-details"]').click();
      await page.keyboard.press('Escape');
      assert.ok(await unstaffed.evaluate(el => el.matches(':focus')), 'deselecting the mission returns to its task group');

      const launcher = page.locator(width < 500 ? '#atlasMobileMissions' : '#atlasMissions');
      await launcher.click();
      const search = page.locator('#atlasMissionSearch');
      await search.fill('Unstaffed');
      await search.press('ArrowDown');
      const row = page.getByRole('button', {name: /Unstaffed mission, psyche-build/});
      assert.ok(await row.evaluate(el => el.matches(':focus')));
      await page.keyboard.press('Enter');
      await page.getByRole('heading', {name: 'Unstaffed mission', exact: true}).waitFor();
      await page.locator('[data-focus="close-details"]').click();
      assert.equal(await search.inputValue(), 'Unstaffed');
      assert.ok(await row.evaluate(el => el.matches(':focus')), 'close returns to the filtered mission');
      await page.keyboard.press('Escape');
      assert.ok(await launcher.evaluate(el => el.matches(':focus')));
      assert.match(page.url(), /#\/project\/psyche-build$/);
      await page.goto(new URL('#/castle/psyche-build', base).href);
      const notice = page.locator('#atlasNavigationNotice');
      await notice.waitFor();
      assert.match(await notice.innerText(), /navigation link is not valid/);
      assert.ok(await notice.evaluate(el => {
        const r = el.getBoundingClientRect();
        return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
      }), 'invalid-link notice fits the viewport');
      assert.match(page.url(), /#\/coven$/);
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}
