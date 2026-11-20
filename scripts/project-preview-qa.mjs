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
      const token = 'Release/candidate-'.repeat(26) + '👩🏽‍💻';
      const missionName = token + ' review across all release channels Unstaffed mission';
      const records = [event('mission.opened', {name: missionName}), ...names.map((name, i) =>
        event('task.opened', {task: 'task-' + i, name, familiar: 'cody'}))];
      const chooser = page.waitForEvent('filechooser');
      await page.locator('#traceDrop').click();
      await (await chooser).setFiles({name:'tasks.jsonl', mimeType:'text/plain', buffer:Buffer.from(records.join('\n'))});
      const unstaffed = page.locator('.atlas-mission-group[data-m="solo"] .mission-tasks');
      await unstaffed.waitFor();
      await page.setViewportSize({width, height});
      const caption = page.locator('#missionCaptions .mission-caption').filter({hasText: token});
      await caption.waitFor();
      assert.equal(await caption.locator(':scope > span').textContent(), missionName);
      if (width < 500) {
        const bounds = await page.locator('#missionCaptions').boundingBox();
        const dock = await page.locator('#atlasMobileChrome').boundingBox();
        assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= dock.y, 'full captions clear the mobile controls');
      }
      const reference = await caption.locator('b').textContent();
      assert.equal(await unstaffed.locator('..').locator('.lead-name').textContent(), reference);
      const word = caption.locator('.mission-word').first();
      assert.ok(await word.evaluate(el => {
        el.scrollLeft = el.scrollWidth;
        return getComputedStyle(el).whiteSpace === 'nowrap' && el.scrollLeft > 0 &&
          getComputedStyle(el).textOverflow !== 'ellipsis' && el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      }), 'the last grapheme of an oversized word can be read without breaking it');
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
      const heading = page.locator('#missionDetailTitle');
      assert.equal(await heading.textContent(), missionName);
      assert.ok(await heading.evaluate(el => el.scrollHeight <= el.clientHeight + 1), 'all lines of the inspector name are available');
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
      await page.getByRole('heading', {name: missionName, exact: true}).waitFor();
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

test('overview preview labels match the native SVG scale at successive zoom levels', async () => {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const page = await browser.newPage({viewport: {width, height}, reducedMotion: 'reduce'});
    try {
      await page.goto(new URL('#/coven', base).href);
      const project = page.locator('.ghostfort[aria-label^="psyche-build,"]');
      await project.waitFor();
      const labels = project.locator('.preview-name');
      let measured = 0;
      for (let step = 0; step < 16 && measured < 3; step++) {
        // Anchor the wheel at the actual Project floor so the tile stays in view on narrow screens.
        await project.locator('.gfloor').evaluate(floor => {
          const rect = floor.getBoundingClientRect();
          floor.dispatchEvent(new WheelEvent('wheel', {bubbles: true, cancelable: true, ctrlKey: true, deltaY: -250, clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2}));
        });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        if (await project.getAttribute('data-preview-names') !== 'true') continue;
        const readings = await labels.evaluateAll(nodes => nodes.map(node => ({
          observed: parseFloat(node.style.fontSize),
          expected: Math.ceil(10 * Math.max(13 / 3, 10.5 / Math.max(node.getScreenCTM().a, .01))) / 10,
        })));
        assert.equal(readings.length, 4);
        for (const {observed, expected} of readings) assert.equal(observed, expected);
        measured++;
      }
      assert.equal(measured, 3, 'named previews measured at three zoom levels');
    } finally { await page.close(); }
  }
});

test('a narrow overview return fits the settled stage without rebuilding for the outgoing height', async () => {
  const page = await browser.newPage({viewport: {width: 390, height: 844}, reducedMotion: 'reduce', hasTouch: true});
  try {
    await page.goto(new URL('#/project/psyche-build', base).href);
    const map = page.locator('#atlasMobileMap');
    const tile = page.locator('.ghostfort[aria-label^="psyche-build,"]');
    await map.click();
    await page.waitForFunction(() => document.body.dataset.atlasScope === 'coven');
    await page.evaluate(async () => { for (let i = 0; i < 6; i++) await new Promise(requestAnimationFrame); });
    const overviewHeight = await page.locator('#stage').evaluate(el => el.clientHeight);
    await tile.tap();
    await page.locator('.mission-tasks').first().waitFor();
    await page.waitForFunction(height => document.body.dataset.atlasScope === 'project' && document.getElementById('stage').clientHeight < height, overviewHeight);
    const before = await page.locator('#stage').evaluate(el => el.clientHeight);
    await page.evaluate(() => {
      window.overviewBuilds = 0;
      const observer = new MutationObserver(changes => {
        for (const change of changes) for (const node of change.addedNodes) {
          if (node.nodeType === 1 && node.matches('.atlas-overview')) window.overviewBuilds++;
        }
      });
      observer.observe(document.getElementById('plan'), {childList: true});
    });
    await map.click();
    await tile.waitFor();
    const after = await page.evaluate(async () => {
      for (let i = 0; i < 6; i++) await new Promise(requestAnimationFrame);
      return {height: document.getElementById('stage').clientHeight, builds: window.overviewBuilds};
    });
    assert.ok(after.height > before, 'stage height should expand from ' + before + ' to the overview, observed ' + after.height);
    assert.ok(after.builds <= 1, 'overview rebuilt ' + after.builds + ' times during one scope change');
  } finally { await page.close(); }
});
