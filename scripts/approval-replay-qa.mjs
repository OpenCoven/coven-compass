// Run beside the external Playwright installation described in browser-qa.mjs.
// node approval-replay-qa.mjs <served-dist-url> <path-to-tests/recordings/approval-replay.jsonl>
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {after, before, test} from 'node:test';
import {chromium} from 'playwright';

const [base, fixture] = process.argv.slice(2);
const recording = await readFile(fixture);
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function tabTo(page, target) {
  for (let i = 0; i < 180; i++) {
    if (await target.evaluateAll(nodes => nodes.includes(document.activeElement))) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('Unreachable by Tab: ' + target);
}
async function activate(page, target) {
  await tabTo(page, target);
  await page.keyboard.press('Enter');
}
async function chooseRecording(page, name, buffer) {
  await tabTo(page, page.locator('#historyFile'));
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await (await chooser).setFiles({name, mimeType: 'text/plain', buffer});
}
async function openMission(page, width, name) {
  if (!await page.locator('#atlasMissionBrowser').isVisible()) await activate(page, page.locator(width < 500 ? '#atlasMobileMissions' : '#atlasMissions'));
  await page.locator('#atlasMissionSearch:focus').waitFor();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(name);
  await page.keyboard.press('ArrowDown');
  await page.locator('.atlas-mission-row:focus').waitFor();
  await page.keyboard.press('Enter');
  await page.getByRole('heading', {name, exact: true}).waitFor();
}

for (const [width, height] of [[1440, 900], [390, 844]]) {
  test('approval replay by keyboard at ' + width + '×' + height, async () => {
    const page = await browser.newPage({viewport: {width, height}, reducedMotion: 'reduce'});
    page.setDefaultTimeout(6000);
    const errors = [], uploads = [];
    page.on('request', request => { if (request.postData() != null) uploads.push(request.method()); });
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(base);
      await openMission(page, width, 'Source survey');
      const history = page.locator('#missionHistory');
      await activate(page, page.getByRole('button', {name: 'History', exact: true}));
      await history.waitFor();
      assert.match(await page.locator('#historySource').innerText(), /Built-in sample/);
      await activate(page, history.getByRole('button', {name: /Show event .* on map/}).first());
      await page.locator('#historyReturn').waitFor();
      await activate(page, page.locator('#historyResume'));

      await chooseRecording(page, 'review.jsonl', recording);
      await page.locator('#atlasMissionSearch:focus').waitFor();
      await openMission(page, width, 'Proof review');
      await activate(page, page.getByRole('button', {name: 'History', exact: true}));
      assert.match(await page.locator('#historySource').innerText(), /Imported recording/);
      const rows = page.locator('#historyRows li');
      const before = await rows.allInnerTexts();
      const positions = await rows.locator('button[data-position]').evaluateAll(buttons => buttons.map(b => Number(b.dataset.position)));
      assert.deepEqual(positions, [1, 3, 4, 5, 7, 8], 'only events belonging to Proof review');
      const pending = rows.filter({hasText: 'proof-1'}).filter({hasText: 'gate.requested'});
      const resolved = rows.filter({hasText: 'proof-1'}).filter({hasText: 'gate.resolved'});
      const open = rows.filter({hasText: 'proof-2'});
      assert.match(await open.innerText(), /Open at end of recording/);
      assert.equal(await open.getByRole('button', {name: /Show resolution/}).count(), 0);

      await chooseRecording(page, 'invalid.jsonl', Buffer.from('invalid recording'));
      await page.locator('#historyError').waitFor();
      assert.match(await page.locator('#historyError').innerText(), /No recognized events/);
      assert.deepEqual(await rows.allInnerTexts(), before, 'rejection preserves the recording and selection');

      const note = page.locator('#historyMapNote');
      const agent = page.locator('#plan .agent[aria-label^="proofreader"]');
      async function checkMap(position, state) {
        await page.locator('#historyReturn').waitFor();
        assert.match(await note.innerText(), new RegExp('Event ' + position + ' '));
        assert.match(await agent.getAttribute('aria-label'), new RegExp(state));
        assert.equal(await agent.isVisible(), true);
        assert.match(page.url(), /mission\/proof/);
      }
      await activate(page, pending.getByRole('button', {name: 'Show event 5 on map'}));
      await checkMap(5, 'Waiting at gate');
      await activate(page, page.locator('#historyForwardEvent'));
      await checkMap(7, 'Working');
      await activate(page, page.locator('#historyBackEvent'));
      await checkMap(5, 'Waiting at gate');
      await activate(page, page.locator('#historyResume'));
      await activate(page, pending.getByRole('button', {name: /Show resolution/}));
      await checkMap(7, 'Working');
      await activate(page, page.locator('#historyResume'));
      await activate(page, resolved.getByRole('button', {name: /Show request/}));
      await checkMap(5, 'Waiting at gate');
      await activate(page, page.locator('#historyResume'));
      await activate(page, open.getByRole('button', {name: 'Show event 8 on map'}));
      await checkMap(8, 'Waiting at gate');
      assert.equal(await page.locator('#historyForwardEvent').isDisabled(), true);
      assert.deepEqual(uploads, [], 'recording bytes stayed in the browser');
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}

test('a slower file read cannot replace the newer recording', async () => {
  const page = await browser.newPage();
  try {
    // Hold the older native File read until the second import has reached the mission drawer.
    await page.addInitScript(() => {
      const read = File.prototype.text;
      File.prototype.text = async function () {
        const text = await read.call(this);
        if (this.name === 'older.jsonl') await new Promise(resolve => { window.finishOlderRead = resolve; });
        return text;
      };
    });
    await page.goto(base);
    await openMission(page, 1280, 'Source survey');
    await activate(page, page.getByRole('button', {name: 'History', exact: true}));
    await chooseRecording(page, 'older.jsonl', Buffer.from('{"t":1700000000,"type":"mission.opened","mission":"older","name":"Older recording"}'));
    await page.waitForFunction(() => typeof window.finishOlderRead === 'function');
    await chooseRecording(page, 'review.jsonl', recording);
    await page.locator('#atlasMissionSearch:focus').waitFor();
    await page.evaluate(() => window.finishOlderRead());
    await openMission(page, 1280, 'Proof review');
  } finally { await page.close(); }
});
