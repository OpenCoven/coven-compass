// Run beside external Playwright with a preview URL and chromium or webkit.
import assert from 'node:assert/strict';
import {chromium, webkit} from 'playwright';

const [base, engine = 'chromium'] = process.argv.slice(2);
const browser = await ({chromium, webkit})[engine].launch();
try {
  const page = await browser.newPage({reducedMotion: 'reduce'});
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://fonts.**', route => route.abort());
  await page.addInitScript(() => localStorage.setItem('coven-compass-lean', 'true'));
  await page.goto(new URL('#/coven', base).href);
  for (const [width, height] of [[2560, 1440], [1440, 900], [820, 1180], [320, 640], [844, 390], [1280, 720]]) {
    await page.setViewportSize({width, height});
    // Wait for the visual viewport, dock portal and resize observers to settle.
    await page.waitForFunction(() => {
      const rect = selector => document.querySelector(selector).getBoundingClientRect();
      const stage = rect('.stage'), player = rect('#timeline');
      const mobile = document.body.classList.contains('atlas-adaptive-mobile');
      const dock = mobile ? rect('#atlasMobileChrome') : player;
      return Math.abs(stage.bottom - dock.top) <= 1 && stage.height > 0 && stage.x === 0 &&
        stage.width === innerWidth && dock.width === innerWidth && Math.abs(dock.bottom - innerHeight) <= 1 &&
        document.documentElement.scrollHeight === innerHeight && document.documentElement.scrollWidth === innerWidth;
    });
    for (const id of ['play', 'scrub', 'speed', 'live']) {
      const control = page.locator('#' + id);
      assert.equal(await control.count(), 1);
      const box = await control.boundingBox();
      assert.ok(box && box.width > 0 && box.x >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, id);
    }
    await page.locator('#scrub').focus();
    await page.keyboard.press('Home');
    await page.waitForFunction(() => document.querySelector('#live').ariaPressed === 'false' && document.querySelectorAll('.preview-mission').length === 0);
    await page.locator('#speed').click();
    await page.locator('#play').click();
    await page.waitForFunction(() => document.querySelector('#play').getAttribute('aria-label') === 'Pause');
    await page.locator('#play').click();
    await page.waitForFunction(() => document.querySelector('#play').getAttribute('aria-label') === 'Play');
    await page.locator('#live').click();
    await page.waitForFunction(() => document.querySelector('#live').ariaPressed === 'true' && document.querySelectorAll('.ghostfort .preview-mission').length > 1);
    assert.equal(await page.locator('body').getAttribute('data-atlas-scope'), 'coven');
    assert.equal(await page.locator('#scrub').getAttribute('aria-label'), 'Coven replay position');
    assert.ok(await page.locator('#marks .mk-q').count());
    console.log(engine, width, height, 'fit, scrub, speed, play, pause and restore passed');
  }
  // The Project footer preference survives a visit to the overview.
  await page.goto(new URL('#/project/psyche-build', base).href);
  await page.waitForFunction(() => document.body.dataset.atlasScope === 'project');
  assert.equal(await page.locator('#timeline').isVisible(), false);
  await page.locator('#atlasOverview').click();
  await page.locator('#timeline').waitFor();
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
