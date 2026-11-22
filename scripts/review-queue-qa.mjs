// Copy beside the external Playwright installation and run with a local preview URL.
import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';
import {chromium, webkit} from 'playwright';

const [base, engine = 'chromium'] = process.argv.slice(2);
if (!base) throw new Error('Pass a running Compass preview URL.');
let browser;
before(async () => { browser = await ({chromium, webkit})[engine].launch(); });
after(async () => { await browser?.close(); });

for (const [width, height] of [[1440, 900], [390, 844], [844, 390]]) {
  test(`cross-Project decisions and return focus at ${width}×${height}`, async () => {
    const touch = width < 1000;
    const page = await browser.newPage({viewport: {width, height}, hasTouch: touch, reducedMotion: 'reduce'});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const activate = async element => {
      if (touch) await element.tap();
      else { await element.focus(); await page.keyboard.press('Enter'); }
    };
    try {
      await page.goto(new URL('#/coven', base).href);
      await activate(page.locator('#atlasBrowse'));
      await activate(page.locator('.atlas-layout-simulation > summary'));
      await page.locator('#atlasCustomCount').fill('8');
      await activate(page.getByRole('button', {name: 'Set total'}));
      const entry = page.locator('#needBtn'), rows = page.locator('#queueList button');
      await page.locator('#atlasSidebar').waitFor({state: 'hidden'});
      await activate(entry);
      const original = await rows.count();
      assert.ok(original >= 6);
      assert.equal(await entry.getAttribute('aria-label'), 'Needs review, ' + original + ' pending requests');
      const filter = page.locator('#queueFilter');
      await filter.fill('Write outside');
      assert.equal(await rows.count(), 2);
      const keys = await rows.evaluateAll(nodes => nodes.map(node => JSON.parse(node.dataset.key)));
      assert.notEqual(keys[0][0], keys[1][0]);
      assert.equal(keys[0][1], keys[1][1]);
      // A real tab from the filter reaches the first matching request.
      if (!touch) { await filter.press('Tab'); assert.equal(await page.locator(':focus').getAttribute('data-key'), JSON.stringify(keys[0])); }
      const scroll = await page.locator('#queueList').evaluate(list => list.scrollTop);
      await activate(rows.first());
      assert.equal(await page.locator('#queueStatus').innerText(), keys[0][0] + ' · Review readiness · Cody');
      if (touch) await page.getByRole('button', {name: 'Back to queue'}).tap();
      else await page.keyboard.press('Escape');
      assert.equal(await filter.inputValue(), 'Write outside');
      assert.equal(await page.locator(':focus').getAttribute('data-key'), JSON.stringify(keys[0]));
      assert.equal(await page.locator('#queueList').evaluate(list => list.scrollTop), scroll);
      await activate(rows.first());
      await activate(page.locator('#queueAsk').getByRole('button', {name: 'Hold', exact: true}));
      assert.equal(await rows.count(), 1);
      assert.equal(await page.locator(':focus').getAttribute('data-key'), JSON.stringify(keys[1]));
      assert.match(await page.locator('#queueStatus').innerText(), /Request held/);
      await activate(rows.first());
      assert.equal(await page.locator('#queueStatus').innerText(), keys[1][0] + ' · Review readiness · Cody');
      await activate(page.locator('#queueAsk').getByRole('button', {name: 'Allow once', exact: true}));
      assert.equal(await rows.count(), 0);
      assert.equal(await page.locator(':focus').getAttribute('id'), 'queueFilter');
      await filter.fill('');
      assert.equal(await rows.count(), original - 2);
      for (let remaining = original - 2; remaining > 0; remaining--) {
        assert.equal(await rows.count(), remaining);
        await activate(rows.first());
        await activate(page.locator('#queueAsk .cf-f > button').first());
      }
      assert.match(await page.locator('#queueStatus').innerText(), /Inbox clear/);
      assert.equal(await page.locator(':focus').getAttribute('id'), 'queueFilter');
      await activate(page.locator('#queueClose'));
      assert.equal(await page.locator(':focus').getAttribute('id'), 'needBtn');
      assert.equal(await entry.getAttribute('aria-label'), 'Needs review, 0 pending requests');
      assert.match(page.url(), /#\/coven$/);
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}

test('playing a recording retires the exact request and returns focus to the empty queue', async () => {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}, reducedMotion: 'reduce'});
  try {
    await page.goto(new URL('#/project/psyche-build', base).href);
    await page.locator('#workspaceTools > summary').click();
    await page.locator('#traceBox > summary').click();
    await page.locator('#traceLoad > summary').click();
    const events = [
      {t:'2020-01-01T00:00:00Z', type:'mission.opened', name:'Recorded survey'},
      {t:'2020-01-01T00:00:05Z', type:'gate.requested', ask:'q-1', familiar:'astra', title:'Review recorded sources'},
      {t:'2020-01-01T00:05:00Z', type:'gate.resolved', ask:'q-1', decision:'held'}
    ].map(e => JSON.stringify({mission:'m-1', ...e})).join('\n');
    const chooser = page.waitForEvent('filechooser');
    await page.locator('#traceDrop').click();
    await (await chooser).setFiles({name:'queue.jsonl', mimeType:'text/plain', buffer:Buffer.from(events)});
    await page.locator('#traceKind').filter({hasText:'loaded'}).waitFor({state:'attached'});
    await page.locator('#scrub').fill('500');
    await page.locator('#play').click();
    await page.locator('#atlasOverview').click();
    await page.locator('#needBtn').click();
    await page.getByRole('button', {name:/^Review recorded sources,/}).click();
    assert.ok(await page.locator('#queueAsk').getByRole('button', {name:'Hold', exact:true}).isDisabled());
    await page.waitForFunction(() => document.querySelector('#queueStatus').textContent.includes('no longer pending'), undefined, {timeout: 20000});
    assert.match(await page.locator('#queueStatus').innerText(), /Inbox clear/);
    assert.equal(await page.locator(':focus').getAttribute('id'), 'queueFilter');
  } finally { await page.close(); }
});
