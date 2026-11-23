// Run beside external Playwright: node trace-panel-qa.mjs <preview-url> chromium|webkit
import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';
import {chromium, webkit} from 'playwright';

const [base, engine = 'chromium'] = process.argv.slice(2);
let browser;
before(async () => { browser = await ({chromium, webkit})[engine].launch(); });
after(async () => { await browser?.close(); });

for (const [width, height] of [[1440, 900], [768, 1024], [390, 844], [844, 390], [320, 240], [280, 568]]) {
  test('Trace navigation, replay editor and local import at ' + width + '×' + height, async () => {
    const page = await browser.newPage({viewport: {width, height}, hasTouch: width < 1000, reducedMotion: 'reduce'});
    page.setDefaultTimeout(5000);
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    const loc = selector => page.locator(selector);
    const panel = loc('#traceBody'), trigger = loc('#traceBox > summary');
    const activate = async control => {
      if (width < 1000) await control.tap();
      else { await control.focus(); await control.press('Enter'); }
    };
    const open = async () => {
      if (!await loc('#workspaceTools').evaluate(el => el.open)) await activate(loc('#workspaceTools > summary'));
      await activate(trigger); await panel.waitFor();
    };
    const fits = async () => {
      const rect = await panel.boundingBox();
      assert.ok(rect.width > 0 && rect.height > 100 && rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width + 1 && rect.y + rect.height <= height + 1, JSON.stringify(rect));
      assert.ok(await loc('.trace-scroll').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    };
    try {
      await page.goto(new URL('#/project/psyche-build', base).href);
      await open(); await fits();
      assert.equal(await loc('#traceChip').innerText(), 'Sample');
      const counts = await loc('.trace-kind strong').allTextContents();
      assert.equal(counts.reduce((sum, n) => sum + Number(n), 0), parseInt(await loc('#traceInfo').innerText()));
      await activate(loc('.trace-kind[data-kind="Gates"]'));
      assert.equal(await loc('#traceFilter').inputValue(), 'Gates');
      assert.ok(await loc('#traceEv .ev').count() > 0);
      assert.equal(await loc('#traceEv .ev:not(.q)').count(), 0);
      await activate(loc('#traceEv summary').first());
      const editor = loc('#traceEv textarea').first();
      const original = await editor.inputValue();
      if (width === 1440) {
        await editor.focus();
        await page.keyboard.press(engine === 'webkit' ? 'Alt+Tab' : 'Tab');
        assert.equal(await editor.inputValue(), original);
        assert.ok(await panel.getByRole('button', {name: 'Format', exact: true}).evaluate(el => el.matches(':focus')));
      }
      await editor.fill('{');
      assert.equal(await editor.getAttribute('aria-invalid'), 'true');
      assert.ok(await panel.getByRole('button', {name: 'Save', exact: true}).isDisabled());
      await activate(panel.getByRole('button', {name: 'Overview', exact: true}));
      await activate(panel.getByRole('button', {name: 'Events', exact: true}));
      assert.equal(await editor.inputValue(), '{');
      await editor.fill(original + '\n');
      await activate(panel.getByRole('button', {name: 'Save', exact: true}));
      assert.match(await loc('#traceSaved').innerText(), /saved/i);
      await activate(loc('#traceImport')); await fits();
      const choose = async content => {
        const [picker] = await Promise.all([page.waitForEvent('filechooser'), activate(loc(width < 1000 ? '#traceDrop' : '#traceFile'))]);
        await picker.setFiles({name: 'trace.jsonl', mimeType: 'text/plain', buffer: Buffer.from(content)});
      };
      await choose('invalid');
      await loc('#traceErr').waitFor();
      assert.match(await loc('#traceErr').innerText(), /No recognized events/);
      await choose('{"t":1800000000,"type":"mission.opened","mission":"m","name":"Inspection"}\ninvalid');
      await panel.waitFor({state: 'hidden'});
      await open();
      assert.equal(await loc('#traceChip').innerText(), 'Recording');
      assert.match(await loc('#traceInfo').innerText(), /1 event · under 1 min/);
      assert.match(await loc('#traceSkipped').innerText(), /1 unrecognized line skipped/);
      await activate(loc('.trace-kind[data-kind="Gates"]'));
      assert.equal(await loc('#traceEv .ev').count(), 0);
      assert.match(await loc('#traceEvNote').innerText(), /No matching events/);
      await loc('#traceFilter').selectOption('');
      assert.match(await loc('#traceEv').innerText(), /Mission opened/);
      await activate(loc('#traceClose')); await panel.waitFor({state: 'hidden'});
      assert.ok(await trigger.evaluate(el => document.activeElement === el));
      assert.deepEqual(failures, []);
    } finally { await page.close(); }
  });
}

test('replay time follows the cursor between events and keeps an open draft intact', async () => {
  const page = await browser.newPage();
  try {
    await page.goto(new URL('#/project/psyche-build', base).href);
    const recording = [0, 1200].map((offset, i) => JSON.stringify({t: 1800000000 + offset, type: 'mission.opened', mission: 'm' + i, name: 'Mission ' + i})).join('\n');
    await page.locator('#traceFile').setInputFiles({name: 'spaced.jsonl', mimeType: 'text/plain', buffer: Buffer.from(recording)});
    await page.locator('#traceKind').filter({hasText: 'loaded'}).waitFor({state: 'attached'});
    await page.locator('#workspaceTools > summary').click();
    await page.locator('#traceBox > summary').click();
    await page.getByRole('button', {name: 'Events', exact: true}).click();
    const scrub = page.locator('#scrub'), note = page.locator('#traceEvNote');
    const seek = value => scrub.evaluate((el, at) => {
      el.value = at;
      el.dispatchEvent(new Event('input', {bubbles: true}));
    }, value);
    for (const position of [300, 600]) {
      await seek(position);
      const time = (await page.locator('#clock').innerText()).slice(0, 5);
      assert.equal(await note.innerText(), '1 event · newest first · through ' + time);
    }
    await page.locator('#traceEv summary').click();
    const editor = page.locator('#traceEv textarea');
    await editor.fill('{');
    await seek(1000);
    assert.equal(await editor.inputValue(), '{');
    assert.match(await note.innerText(), /List paused for inspection/);
    await page.locator('#traceEv summary').click();
    await page.locator('#traceFilter').focus();
    await note.filter({hasText: '2 events · newest first · through'}).waitFor();
  } finally { await page.close(); }
});
