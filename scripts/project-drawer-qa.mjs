// Run beside external Playwright with the preview URL, chromium|webkit, and optional screenshot directory.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium, webkit} from 'playwright';

const [url, engine, shots] = process.argv.slice(2);
const browser = await ({chromium, webkit})[engine].launch();
if (shots) await mkdir(shots, {recursive: true});
try {
  for (const [width, height] of [[320, 240], [280, 540], [320, 568], [390, 844], [667, 320], [844, 390], [768, 1024], [1024, 600], [1440, 900], [1920, 1080]]) {
    const page = await browser.newPage({viewport: {width, height}, hasTouch: width <= 1100, reducedMotion: 'reduce'});
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    const loc = s => page.locator(s);
    const drawer = loc('#atlasSidebar'), search = loc('#atlasProjectSearch'), layoutButton = loc('#atlasOpenLayout');
    const bounds = async () => {
      const r = await drawer.boundingBox();
      assert.ok(r && r.x >= -1 && r.y >= -1 && r.x + r.width <= width + 1 && r.y + r.height <= height + 1, 'drawer fits the viewport: ' + JSON.stringify(r));
      assert.ok(await drawer.evaluate(el => [el, ...el.querySelectorAll('.atlas-directory-results, #atlasLayoutPage')].every(node => node.scrollWidth <= node.clientWidth + 1)), 'content fits its width');
    };
    try {
      if (width === 320) await page.addInitScript(() => localStorage.setItem('coven-compass-fs', '1.35'));
      await page.goto(new URL('#/project/psyche-build', url).href);
      await loc('#atlasBrowse').click();
      await bounds();
      assert.equal(await loc('#atlasProjectBadge').innerText(), '4');
      await search.fill('config refactor');
      assert.equal(await loc('#atlasProjectBadge').innerText(), '1/4');
      await search.press('ArrowDown');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.project), 'psyche-build');
      if (shots && [390,1440].includes(width)) {
        await loc('#atlasProjectClear').click();
        await drawer.screenshot({path:join(shots, engine + '-' + width + '-projects.png')});
        await search.fill('config refactor');
      }
      await layoutButton.click();
      assert.equal(await loc('#atlasProjectsTitle').innerText(), 'Sample layout');
      assert.ok(await loc('#atlasLayoutBack').evaluate(el => el === document.activeElement));
      assert.ok(await loc('#atlasProjectDirectory').isHidden());
      assert.ok(await loc('#atlasResetLayout').isHidden());
      await bounds();
      const custom = loc('#atlasCustomCount');
      await custom.fill('3');
      await custom.press('Enter');
      assert.equal(await custom.evaluate(el => el.validity.rangeUnderflow), true);
      await custom.fill('');
      if (shots && [390,1440].includes(width)) await drawer.screenshot({path:join(shots, engine + '-' + width + '-samples.png')});
      await page.keyboard.press('Escape');
      assert.ok(await layoutButton.evaluate(el => el === document.activeElement));
      assert.equal(await search.inputValue(), 'config refactor');
      await layoutButton.click();
      await drawer.locator('[data-total="8"]').click();
      await drawer.waitFor({state:'hidden'});
      await loc('#atlasBrowse').click();
      await layoutButton.click();
      assert.equal(await drawer.locator('[aria-pressed="true"]').innerText(), '8');
      assert.equal(await loc('#atlasLayoutSize').innerText(), '8 projects on the map');
      assert.equal(await loc('#atlasSampleCount').innerText(), '4 temporary');
      await loc('#atlasResetLayout').click();
      await drawer.waitFor({state:'hidden'});
      await loc('#atlasBrowse').click();
      await loc('#atlasProjectClear').click();
      assert.equal(await drawer.locator('.atlas-project:visible').count(), 4);
      await drawer.locator('.atlas-project[data-project="coven-cave"] .atlas-project-icon').click();
      await page.waitForURL(/#\/project\/coven-cave$/);
      assert.deepEqual(errors, []);
      console.log(engine, browser.version(), width + '×' + height, 'passed');
    } catch (error) {
      console.error(engine, width, height, await drawer.getAttribute('aria-label'));
      throw error;
    } finally { await page.close(); }
  }
  const page = await browser.newPage({viewport: {width: 1440, height: 900}});
  try {
    const drawer = page.locator('#atlasSidebar'), search = page.locator('#atlasProjectSearch');
    await page.goto(new URL('#/coven', url).href);
    await page.locator('#atlasBrowse').click();
    await page.locator('#atlasOpenLayout').click();
    await drawer.locator('[data-total="128"]').click();
    await drawer.waitFor({state:'hidden'});
    await page.locator('#atlasBrowse').click();
    assert.equal(await drawer.locator('.atlas-project').count(), 128);
    await search.focus(); await search.press('ArrowDown'); await page.keyboard.press('End');
    const last = await page.evaluate(() => document.activeElement.dataset.project);
    assert.ok(last);
    await search.fill(last);
    await page.setViewportSize({width: 320, height: 568});
    assert.equal(await search.inputValue(), last);
    await drawer.locator('.atlas-project:visible').click();
    assert.equal(new URL(page.url()).hash, '#/project/' + encodeURIComponent(last));
    console.log(engine, '128 projects, keyboard navigation and live resize passed');
  } finally { await page.close(); }
} finally { await browser.close(); }
