// Copy beside an external Playwright installation. Run with <url> <webkit|chromium> <pointer|controls>.
// Each pointer trial launches a new browser. JSON on stdout includes the first failing event sequence.
import assert from 'node:assert/strict';
import {chromium, webkit} from 'playwright';

const [base, engine, suite] = process.argv.slice(2);
const browserType = {chromium, webkit}[engine];
if (!base || !browserType || !['pointer', 'controls'].includes(suite)) throw Error('Expected URL, browser engine, and pointer or controls');
const missions = ['Config refactor', 'Release note', 'Review readiness', 'Source survey'];
const route = '#/project/psyche-build';
const results = [];

async function run(input) {
  const browser = await browserType.launch();
  const touch = input === 'touch';
  const page = await browser.newPage({viewport: touch ? {width: 390, height: 844} : {width: 1440, height: 900}, hasTouch: touch, reducedMotion: 'reduce'});
  page.setDefaultTimeout(5000);
  const result = {input, version: browser.version(), errors: []};
  page.on('pageerror', error => result.errors.push(error.message));
  try {
    await page.goto(base);
    const launcher = page.locator('#atlasBrowse');
    const drawer = page.locator('#atlasSidebar');
    const row = drawer.locator('button[data-project="psyche-build"]');
    const activate = locator => touch ? locator.tap() : locator.click();
    await activate(page.locator(touch ? '#atlasMobileMap' : '#atlasOverview'));
    await page.waitForURL(url => url.hash === '#/coven');
    await activate(launcher);
    await row.waitFor();
    if (input === 'keyboard') {
      await page.keyboard.press('Escape');
      assert.ok(await drawer.isHidden());
      assert.ok(await launcher.evaluate(el => el === document.activeElement));
      await page.keyboard.press('Enter');
      await row.waitFor();
      assert.ok(await row.evaluate(el => el === document.activeElement), 'opening the drawer focuses the active Project');
    }
    await page.evaluate(() => {
      const drawer = document.getElementById('atlasSidebar');
      const target = el => el?.id || el?.closest('[data-project]')?.dataset.project || el?.tagName;
      const events = window.selectionEvents = [];
      const record = (type, el) => events.push({type, target: target(el), tag: el?.tagName, focus: target(document.activeElement), hidden: drawer.hidden, route: location.hash});
      for (const type of ['pointerdown', 'mousedown', 'focusout', 'focusin', 'pointerup', 'mouseup', 'click']) {
        document.addEventListener(type, ev => record(type, ev.target), true);
      }
      new MutationObserver(() => record('drawer visibility', drawer)).observe(drawer, {attributes: true, attributeFilter: ['hidden']});
    });
    if (input === 'outside') {
      const point = await page.locator('#stage').evaluate(stage => {
        const rect = stage.getBoundingClientRect();
        for (let x = rect.right - 20; x > rect.left; x -= 40) {
          const y = rect.top + rect.height / 2, el = document.elementFromPoint(x, y);
          if (el?.closest('#plan') && !el.closest('[role="button"],#atlasSidebar')) return {x, y};
        }
      });
      assert.ok(point, 'an uncovered point on the map');
      await page.mouse.click(point.x, point.y);
      await drawer.waitFor({state: 'hidden'});
      assert.equal(new URL(page.url()).hash, '#/coven');
    } else {
      if (input === 'keyboard') await page.keyboard.press('Enter');
      else await activate(row.locator('.atlas-project-icon'));
      await page.waitForURL(url => url.hash === route, {timeout: 2500});
      await drawer.waitFor({state: 'hidden'});
      const trays = page.locator('#plan .mission-tasks:visible');
      await trays.first().waitFor();
      const labels = await trays.evaluateAll(els => els.map(el => el.getAttribute('aria-label')));
      const captions = page.locator('#missionCaptions .mission-caption[data-tasks="true"]:visible');
      const fallbackNames = await captions.locator(':scope > span').allTextContents();
      result.missions = labels.map(label => label.match(/^\d+ tasks? on (.+?):/)?.[1]).concat(fallbackNames).sort();
      assert.deepEqual(result.missions, missions);
      if (input === 'pointer' || touch) {
        const clicks = await page.evaluate(() => window.selectionEvents.filter(event => event.type === 'click'));
        assert.notEqual(clicks[0]?.tag, 'BUTTON', 'one activation originates on a child of the Project button');
        assert.deepEqual(clicks.map(click => [click.target, click.hidden]), [['psyche-build', false]]);
      }
      if (touch && fallbackNames.length) {
        const caption = captions.first(), name = fallbackNames[0];
        const count = parseInt(await caption.locator('small').innerText());
        assert.ok(count > 0);
        await caption.tap();
        await page.locator('#inspect .tname').first().waitFor();
        assert.equal(await page.locator('#missionDetailTitle').innerText(), name);
        assert.equal(await page.locator('#inspect .tname').count(), count);
        result.captionTasks = {name, count};
      }
      if (!touch) assert.ok(await page.locator('#atlasProject').evaluate(el => el === document.activeElement));
    }
    assert.deepEqual(result.errors, []);
    result.passed = true;
  } catch (error) {
    result.passed = false;
    result.failure = error.message;
  } finally {
    result.route = new URL(page.url()).hash;
    result.events = await page.evaluate(() => window.selectionEvents || []);
    results.push(result);
    await browser.close();
  }
}
for (const input of suite === 'pointer' ? Array(5).fill('pointer') : ['keyboard', 'outside', 'touch']) await run(input);
console.log(JSON.stringify({engine, suite, results}, null, 2));
if (results.some(result => !result.passed)) process.exitCode = 1;
