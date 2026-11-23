// Run beside pinned Playwright with the local preview URL. Times use the browser's clock.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser = await chromium.launch();
const trials = [];
try {
  for (let i = 0; i < 5; i++) {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}, reducedMotion: 'reduce'});
    // Observe the same simulation worlds as map-performance.mjs without adding an application API.
    await page.addInitScript(() => {
      Object.defineProperty(window, 'CovenProjection', {configurable: true, set(api) {
        const wrapped = {...api, createSimulationSource(options) {
          window.census = () => {
            const worlds = options.worlds();
            let missions = 0, tasks = 0, agents = 0;
            for (const [, world] of worlds) {
              missions += world.missions.size;
              tasks += world.tasks.size;
              agents += world.agents.size;
            }
            return {projects: worlds.length, missions, tasks, agents};
          };
          return api.createSimulationSource(options);
        }};
        Object.defineProperty(window, 'CovenProjection', {value: wrapped});
      }});
    });
    await page.goto(new URL('#/coven', process.argv[2]).href);
    await page.locator('#atlasBrowse').click();
    await page.locator('#atlasOpenLayout').click();
    await page.getByRole('button', {name: 'Simulate a Coven with 128 Projects'}).click();
    assert.equal(await page.locator('.ghostfort').count(), 128);
    await page.locator('.ghostfort[aria-label^="psyche-build,"]').focus();
    await page.keyboard.press('Enter');
    await page.locator('.atlas-mission-group[data-m="m-1"] .mission-tasks').focus();
    await page.keyboard.press('Enter');
    await page.evaluate(() => {
      const original = window.CovenMissionHistory.collect;
      window.CovenMissionHistory.collect = (...args) => {
        const start = performance.now();
        const entries = original(...args);
        window.measure = {foldMs: performance.now() - start, traceEvents: args[1].length, mission: args[2], changeEvents: entries.length};
        return entries;
      };
      document.querySelector('[data-focus="mission-history"]').addEventListener('click', () => {
        const start = performance.now();
        requestAnimationFrame(() => requestAnimationFrame(() => { window.measure.openMs = performance.now() - start; }));
      }, {once: true, capture: true});
    });
    await page.getByRole('button', {name: 'History', exact: true}).click();
    await page.waitForFunction(() => window.measure?.openMs && document.querySelector('#missionHistory').open);
    assert.match(await page.locator('#historySource').innerText(), /Local simulation/);
    trials.push(await page.evaluate(() => ({...census(), ...window.measure})));
    await page.close();
  }
  console.log(JSON.stringify({browser: browser.version(), trials}, null, 2));
} finally {
  await browser.close();
}
