// Run beside external Playwright. Pass the served URL, engine, desktop|keyboard|touch|landscape, recording and screenshot directory.
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {chromium, webkit} from 'playwright';

const [url, engine, mode, recording, shots] = process.argv.slice(2);
const browser = await ({chromium, webkit}[engine]).launch();
const touch = mode === 'touch' || mode === 'landscape', keyboard = mode === 'keyboard';
try {
  const viewport = mode === 'landscape' ? {width: 844, height: 390} : touch ? {width: 390, height: 844} : {width: 1440, height: 900};
  const page = await browser.newPage({viewport, hasTouch: touch, reducedMotion: 'reduce'});
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const loc = s => page.locator(s);
  const btn = name => page.getByRole('button', {name, exact: true});
  const focused = locator => locator.evaluate(el => el === document.activeElement);
  async function tabTo(target) {
    for (let i = 0; i < 160; i++) {
      if (await target.count() && await focused(target)) return;
      await page.keyboard.press(engine === 'webkit' ? 'Alt+Tab' : 'Tab');
    }
    throw Error('Tab could not reach ' + target);
  }
  async function activate(target) {
    if (keyboard) { await tabTo(target); await page.keyboard.press('Enter'); }
    else if (touch) await target.tap();
    else await target.click();
  }
  const shot = name => page.screenshot({path: join(shots, engine + '-' + mode + '-' + name + '.png')});
  // The short landscape and small phone layouts previously opened below the first event.
  for (const [width, height] of [[320,568], [844,390], [1440,900]]) {
    await page.setViewportSize({width, height});
    await page.goto(new URL('#/project/psyche-build/mission/m-3?view=brief&detail=side', url).href);
    await activate(btn('History'));
    const first = loc('.history-event').first();
    assert.match(await first.innerText(), /Mission opened/);
    const bounds = await first.boundingBox();
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= height);
    assert.ok(await loc('#missionHistory').evaluate(el => el.scrollWidth <= el.clientWidth));
    await activate(loc('.history-event').nth(2));
    assert.equal(await loc('#historyDetail').evaluate(el => el.parentElement.tagName === 'LI'), width < 860);
    await activate(btn('Close'));
  }
  await page.setViewportSize(viewport);
  await page.goto(new URL('#/project/psyche-build', url).href);
  await page.reload();
  for (const id of ['workspaceTools', 'traceBox']) await activate(loc('#' + id + ' > summary'));
  await activate(loc('#traceImport'));
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), activate(loc(keyboard ? '#traceFile' : '#traceDrop'))]);
  await chooser.setFiles(recording);
  const tray = loc('.atlas-mission-group[data-m="release"] .mission-tasks');
  await tray.waitFor();
  await activate(loc(touch ? '#atlasMobileMissions' : '#atlasMissions'));
  assert.ok(await loc('#atlasMissionCreate').isDisabled());
  assert.match(await loc('#atlasMissionCreateHint').innerText(), /read-only/);
  if (keyboard) await page.keyboard.press('Escape'); else await activate(loc('#atlasMissionClose'));
  if (keyboard) {
    const mapStop = loc('#plan [data-map-item][tabindex="0"]');
    await tabTo(mapStop);
    await page.keyboard.press('Home');
    for (let i = 0; i < 60 && !await focused(tray); i++) await page.keyboard.press('ArrowRight');
    assert.ok(await focused(tray));
    await page.keyboard.press('Enter');
  } else await activate(tray);
  await activate(btn('History'));
  const dialog = page.getByRole('dialog', {name:'Mission history Publication review', exact:true});
  await dialog.waitFor();
  assert.match(await loc('#historySource').innerText(), /Imported recording.*release/);
  const detail = loc('#historyDetail');
  const row = n => loc('#historyRows [data-position="' + n + '"]');
  async function inspect(n) { await activate(row(n)); return detail.innerText(); }
  assert.equal(await loc('#historyRange').isVisible(), false);
  await activate(loc('#historyRangeToggle'));
  const range = async (which, n) => {
    const input = loc('#history-' + which);
    if (keyboard) {
      await tabTo(input);
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.type(String(n));
      await page.keyboard.press('Tab');
    } else { await input.fill(String(n)); await input.press('Tab'); }
  };
  await range('start', 1);
  await range('end', 2);
  assert.match(await inspect(2), /Cody joined the council/);
  await activate(btn('Set end to current replay position'));
  assert.equal(await loc('#history-end').inputValue(), '9');
  assert.match(await inspect(9), /Release review → Publication review/);
  await inspect(8); await activate(btn('End here'));
  await range('start', 4);
  assert.match(await inspect(5), /worker-1[\s\S]*No recorded agent → Draft notes \(draft\)/);
  assert.match(await inspect(6), /worker-1[\s\S]*Draft notes \(draft\) → Check sources \(check\)/);
  assert.match(await inspect(7), /06:20:05Z[\s\S]*Approve publication[\s\S]*Waiting for decision/);
  assert.match(await inspect(8), /Waiting for decision → Allowed/);
  assert.match(await inspect(7), /Active → Needs you/);
  assert.match(await inspect(8), /Needs you → Active/);
  await inspect(7);
  const pending = btn('Show event 7 on map');
  await activate(pending);
  await loc('#historyReturn').waitFor();
  assert.match(await loc('#historyMapNote').innerText(), /Event 7 .*gate.requested/);
  assert.match(await loc('#plan .lead-node.sel').getAttribute('aria-label'), /Release review, Needs you/);
  await activate(btn('Return to History'));
  assert.ok(await focused(pending));
  await inspect(6);
  const disclosure = detail.locator('summary');
  await activate(disclosure);
  const payload = detail.locator('pre').filter({hasText:'agent.assigned'});
  await payload.waitFor();
  const raw = JSON.parse(await payload.innerText());
  assert.deepEqual([raw.type, raw.agent, raw.task], ['agent.assigned', 'worker-1', 'check']);
  await activate(disclosure);
  await row(6).scrollIntoViewIfNeeded();
  await shot('history');
  const event = btn('Show event 6 on map');
  const scroll = () => loc('.history-content').evaluate(content => [content.scrollTop, content.querySelector('.history-feed').scrollTop]);
  await event.scrollIntoViewIfNeeded();
  const beforeMap = await scroll();
  await activate(event);
  await loc('#historyReturn').waitFor();
  assert.match(await loc('#historyMapNote').innerText(), /Event 6 .*agent.assigned/);
  assert.equal(await loc('#live').getAttribute('aria-pressed'), 'false');
  assert.match(await loc('#plan .lead-node.sel').getAttribute('aria-label'), /Release review, Active/);
  assert.equal(await loc('#plan [data-map-item][tabindex="0"]').count(), 1);
  assert.ok(await focused(btn('Return to History')));
  await shot('map');
  await activate(btn('Return to History'));
  assert.ok(await focused(event));
  const afterMap = await scroll();
  assert.ok(afterMap.every((value, i) => Math.abs(value - beforeMap[i]) < 2), 'history restores its scroll position');
  assert.deepEqual(await Promise.all(['start','end'].map(k => loc('#history-' + k).inputValue())), ['4','8']);
  await activate(btn('Set start to current replay position'));
  assert.equal(await loc('#history-start').inputValue(), '6');
  assert.match(await loc('#historyRows').innerText(), /Decision recorded/);
  if (keyboard) await page.keyboard.press('Escape'); else await activate(btn('Close'));
  assert.ok(await focused(btn('History')));
  if (mode === 'desktop') {
    // Replacing the active recording preserves its Project key, so exercise the normal import again.
    for (const id of ['workspaceTools', 'traceBox']) {
      if (!await loc('#' + id).evaluate(el => el.open)) await activate(loc('#' + id + ' > summary'));
    }
    await activate(loc('#traceImport'));
    const [replacement] = await Promise.all([page.waitForEvent('filechooser'), activate(loc('#traceDrop'))]);
    await replacement.setFiles(recording);
    await loc('#inspect').waitFor({state: 'hidden'});
    await tray.focus(); await page.keyboard.press('Enter');
    await activate(btn('History'));
    assert.deepEqual(await Promise.all(['start','end'].map(k => loc('#history-' + k).inputValue())), ['0','9']);
  }
  assert.deepEqual(errors, []);
  console.log(engine, browser.version(), mode, 'passed');
} finally { await browser.close(); }
