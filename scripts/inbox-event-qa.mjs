// Run beside the external Playwright install: node inbox-event-qa.mjs <served URL> [chromium|webkit].
import assert from 'node:assert/strict';
import {before, after, test} from 'node:test';
import {chromium, webkit} from 'playwright';

const [base, engine = 'chromium'] = process.argv.slice(2);
let browser;
before(async () => { browser = await ({chromium, webkit})[engine].launch(); });
after(async () => { await browser?.close(); });

const title = 'Check publication', mission = 'proof', id = 'same-id';
function recording(project, padding, resolves) {
  const events = [];
  const add = (s, type, props) => events.push({t: Date.UTC(2026, 10, 18, 12) + s * 1000, mission, type, ...props});
  add(0, 'mission.opened', {name: project + ' proof'});
  add(0, 'council.seated', {familiar: 'cody'});
  add(0, 'agent.spawned', {familiar: 'cody', agent: 'proofreader'});
  for (let i = 0; i < padding; i++) add(1, 'gate.requested', {ask: 'other-' + i, familiar: 'cody', title: 'Check item ' + i});
  add(resolves ? 3 : 2, 'gate.requested', {ask: id, title, familiar: 'cody', agents: ['proofreader']});
  const opening = events.length;
  if (resolves) add(3, 'gate.resolved', {ask: id, decision: 'allowed_once'});
  return {opening, file: {name: project + '.jsonl', mimeType: 'text/plain', buffer: Buffer.from(events.map(e => JSON.stringify(e)).join('\n'))}};
}
const target = 'coven-cave', other = 'psyche-build';
const first = recording(target, 27, true), second = recording(other, 0, false);
for (const width of [1440, 390]) for (const input of ['pointer', 'keyboard']) {
  test(engine + ' Inbox investigation at ' + width + 'px with ' + input, async () => {
    const mobile = width < 500;
    const page = await browser.newPage({viewport: {width, height: mobile ? 844 : 900}, reducedMotion: 'reduce', hasTouch: mobile});
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const el = sel => page.locator(sel);
    const button = name => page.getByRole('button', {name, exact: true});
    async function tabTo(locator) {
      for (let n = 0; n < 160; n++) {
        if (await locator.evaluateAll(nodes => nodes.includes(document.activeElement))) return;
        await page.keyboard.press(engine === 'webkit' ? 'Alt+Tab' : 'Tab');
      }
      assert.fail('Unreachable by Tab: ' + locator);
    }
    async function activate(locator) {
      if (input === 'keyboard') { await tabTo(locator); await page.keyboard.press('Enter'); }
      else if (mobile) await locator.tap();
      else await locator.click();
    }
    const row = project => button([title, project, project + ' proof', 'Cody'].join(', '));
    try {
      // Set the exact replay cursor through the existing History UI. A wall-clock scrub includes the resolution.
      await page.goto(new URL('#/project/' + other, base).href);
      await el('#atlasHeader').waitFor({state:'attached'});
      await el('#traceFile').setInputFiles(second.file);
      await el('#traceKind').filter({hasText: 'loaded'}).waitFor({state: 'attached'});
      await page.evaluate(project => { location.hash = '/project/' + project; }, target);
      await page.waitForFunction(key => document.querySelector('#projName').textContent === key, target);
      await el('#traceFile').setInputFiles(first.file);
      await el('#traceKind').filter({hasText: 'loaded'}).waitFor({state: 'attached'});
      await page.goto(new URL('#/project/' + target + '/mission/proof?view=brief&detail=side', base).href);
      await button('History').click();
      const entry = button('Show event ' + first.opening + ' on map');
      if (!await entry.count()) await el('#historyNext').click();
      await entry.click();
      await el(mobile ? '#atlasMobileMap' : '#atlasOverview').click();
      await activate(el('#needBtn'));
      const filter = el('#queueFilter'), list = el('#queueList');
      if (input === 'keyboard') { await tabTo(filter); await page.keyboard.type('Check'); }
      else await filter.fill('Check');
      assert.equal(await row(target).count(), 1);
      assert.equal(await row(other).count(), 1);
      if (input === 'keyboard') await tabTo(row(target));
      else await row(target).scrollIntoViewIfNeeded();
      const offset = await list.evaluate(e => e.scrollTop);
      assert.ok(offset > 0);
      await activate(row(target));
      assert.ok(await el('#queueAsk').getByRole('button', {name: 'Hold', exact: true}).isDisabled());
      const investigate = button('Inspect opening event');
      assert.equal(await investigate.count(), 1, 'the pending request must offer its exact recorded opening event');
      const map = el('#historyMapNote');
      for (const resolve of [false, true]) {
        await activate(investigate);
        assert.match(await el('#historySource').innerText(), /coven-cave · proof/);
        assert.ok(await entry.evaluate(e => e === document.activeElement));
        const source = page.locator('#historyRows li').filter({has: entry}).locator('details[open] pre');
        await source.waitFor();
        const record = JSON.parse(await source.innerText());
        assert.deepEqual([record.type, record.mission, record.ask, record.title], ['gate.requested', mission, id, title]);
        await activate(entry);
        assert.match(await map.innerText(), new RegExp('Event ' + first.opening + ' .*gate.requested'));
        const agent = el('#plan .agent[aria-label^="proofreader"]');
        assert.match(await agent.getAttribute('aria-label'), /Waiting at gate/);
        if (resolve) {
          await activate(el('#historyForwardEvent'));
          assert.match(await map.innerText(), new RegExp('Event ' + (first.opening + 1) + ' .*gate.resolved'));
          assert.match(await agent.getAttribute('aria-label'), /Working/);
        }
        await activate(el('#historyResume'));
        await activate(button('Back to Inbox'));
        const expected = row(resolve ? other : target);
        assert.ok(page.url().endsWith('#/coven'));
        assert.equal(await filter.inputValue(), 'Check');
        assert.ok(await expected.evaluate(e => e === document.activeElement));
        if (!resolve) {
          assert.equal(await list.evaluate(e => e.scrollTop), offset);
          await activate(expected);
        } else {
          assert.equal(await row(target).count(), 0);
          assert.match(await el('#queueStatus').innerText(), /no longer pending/i);
        }
      }
      // The surviving row shares both IDs and the title. Its own opening event has a different position.
      await activate(row(other));
      await activate(investigate);
      const otherEntry = button('Show event ' + second.opening + ' on map');
      assert.match(await el('#historySource').innerText(), /psyche-build · proof/);
      assert.ok(await otherEntry.evaluate(e => e === document.activeElement));
      await activate(otherEntry);
      assert.match(page.url(), /project\/psyche-build\/mission\/proof/);
      assert.match(await map.innerText(), /Event 4 · gate.requested/);
      await activate(el('#historyResume'));
      await page.keyboard.press('Escape');
      assert.ok(await row(other).evaluate(e => e === document.activeElement));
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}
