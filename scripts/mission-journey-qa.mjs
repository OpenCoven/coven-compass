// Run beside the external Playwright install: node mission-journey-qa.mjs URL chromium|webkit [width]
import assert from 'node:assert/strict';
import {chromium, webkit} from 'playwright';
import {join} from 'node:path';

const [url, engine, onlyWidth] = process.argv.slice(2);
const browser = await ({chromium, webkit})[engine].launch();
try {
  for (const [width, height] of [[1440, 900], [390, 844], [844, 390]]) {
    if (onlyWidth && width !== Number(onlyWidth)) continue;
    const mobile = width < 1000;
    const page = await browser.newPage({viewport: {width, height}, hasTouch: mobile, reducedMotion: 'reduce'});
    page.setDefaultTimeout(6500);
    const loc = s => page.locator(s);
    const btn = name => page.getByRole('button', {name, exact: true});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    async function reach(target, reverse = false) {
      for (let i = 0; i < 180; i++) {
        if (await target.evaluateAll(nodes => nodes.includes(document.activeElement))) return;
        await page.keyboard.press([engine === 'webkit' && 'Alt', reverse && 'Shift', 'Tab'].filter(Boolean).join('+'));
      }
      throw Error('Keyboard could not reach ' + target);
    }
    async function activate(target) {
      await target.waitFor();
      if (mobile) return target.tap();
      await reach(target);
      await page.keyboard.press('Enter');
    }
    try {
      await page.goto(new URL('#/coven', url).href);
      await activate(loc(mobile ? '#atlasMobileMissions' : '#atlasMissions'));
      const project = loc('#atlasMissionProject');
      if (mobile) await project.selectOption('psyche-build');
      else {
        await reach(project);
        await page.keyboard.press('p');
        await reach(loc('#atlasMissionCreate'), true);
      }
      assert.equal(await project.inputValue(), 'psyche-build');
      const existing = await loc('.atlas-mission-row:visible').count();
      assert.ok(existing >= 4);
      const staffing = await loc('.atlas-mission-row:visible .atlas-mission-stats').allTextContents();
      const assigned = staffing.reduce((total, text) => total + Number.parseInt(text, 10), 0);
      assert.ok(assigned >= 70, 'a staffed, crowded Project');
      await activate(loc('#atlasMissionCreate'));
      const name = 'Check the release evidence';
      await loc('#nmName:focus').waitFor();
      await page.keyboard.type(name);
      const lead = loc('#nmLeads [data-k="cody"]');
      if (mobile) await activate(lead);
      else {
        await reach(loc('#nmLeads [aria-checked="true"]'));
        for (let i = 0; i < 4 && await lead.getAttribute('aria-checked') !== 'true'; i++) await page.keyboard.press('ArrowRight');
      }
      assert.equal(await lead.getAttribute('aria-checked'), 'true');
      await activate(loc('#nmCustomize'));
      await activate(loc('#nmBrief summary').filter({hasText:'Resource limits'}));
      const more = loc('[data-id="cp-minutes+"]');
      const time = more.locator('..').locator('output');
      const before = await time.innerText();
      await activate(more);
      const changed = await time.innerText();
      assert.notEqual(changed, before);
      await activate(loc('#raise'));
      await loc('#missionDetailTitle').filter({hasText:name}).waitFor();
      assert.ok((await loc('#inspect').innerText()).includes(changed), 'saved brief shows the chosen time limit');
      await activate(btn('Close details'));
      const floor = btn('Focus Cody group on ' + name);
      await floor.waitFor();
      // Enter the map through its single tab stop. Arrow keys traverse the painted groups even on touch screens.
      await reach(loc('#plan [data-map-item][tabindex="0"]'));
      await page.keyboard.press('Home');
      for (let i = 0; i < 200 && !await floor.evaluate(e => e === document.activeElement); i++) await page.keyboard.press('ArrowRight');
      assert.ok(await floor.evaluate(e => e === document.activeElement));
      await page.keyboard.press('Enter');
      const mission = new URL(page.url()).hash.split('/mission/')[1].split('?')[0];
      const selected = '.atlas-squad[data-m="' + mission + '"][data-fam="cody"] .squad-plane rect[aria-pressed="true"]';
      const checkFit = async () => {
        await page.waitForFunction(({selected,name}) => {
          const rect = s => document.querySelector(s)?.getBoundingClientRect();
          const floor = rect(selected), stage = rect('#stage');
          if (!floor?.width || !stage || floor.left < stage.left || floor.right > stage.right || floor.top < stage.top || floor.bottom > stage.bottom) return false;
          const details = document.querySelector('#notes .hud');
          if (details?.querySelector('h2')?.textContent !== name || !details.querySelector('.hud-group-summary')?.textContent.includes('Cody · 1 task · 6 agents')) return false;
          const group = document.querySelector(selected).closest('.atlas-squad');
          if (group.querySelector('.task-region')?.dataset.agents !== '6') return false;
          const marks = [...group.querySelectorAll('.agent-mark')].map(el => el.getBoundingClientRect());
          if (marks.length !== 6 || marks.some(r => !r.width || r.left < floor.left - 1 || r.right > floor.right + 1 || r.top < floor.top - 1 || r.bottom > floor.bottom + 1)) return false;
          const overlaps = (a,b) => a && b && a.width && b.width && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
          const hud = details.getBoundingClientRect(), rail = rect('#psyche:not([hidden])');
          return hud.width > 0 && hud.left >= 0 && hud.right <= innerWidth + 1 && hud.top >= 0 && hud.bottom <= innerHeight + 1 && !overlaps(floor,hud) && !overlaps(floor,rail) && !overlaps(hud,rail);
        }, {selected, name}, {timeout: 5000});
      };
      await checkFit();
      await page.setViewportSize({width: width - 30, height: height - 20});
      await checkFit();
      await activate(loc(mobile ? '#atlasMobileActivity' : '#launcher'));
      await loc('#psyche:not([hidden])').waitFor();
      await checkFit();
      assert.equal(await loc(selected).count(), 1);
      if (process.env.COMPASS_JOURNEY_SHOTS) await page.screenshot({path: join(process.env.COMPASS_JOURNEY_SHOTS, engine + '-' + width + '-group-and-chat.png')});
      assert.deepEqual(errors, []);
      console.log(engine, browser.version(), width, height, 'created and inspected', mission, 'among', existing + 1, 'missions with', assigned, 'existing agents;', before, '→', changed);
    } catch (error) {
      console.error(engine, width, page.url(), await page.evaluate(() => document.activeElement?.outerHTML.slice(0,180)));
      throw error;
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
