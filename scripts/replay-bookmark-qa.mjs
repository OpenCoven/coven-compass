// Run beside external Playwright. Pass the served URL, approval recording, engine and evidence directory.
// Append --baseline to verify the old mission link loses the event on a fresh tab.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium, webkit} from 'playwright';

const [base, fixture, engine, directory, mode] = process.argv.slice(2);
const bytes = await readFile(fixture);
const digest = createHash('sha256').update(bytes).digest('hex');
const phone = engine === 'webkit';
const browser = await ({chromium, webkit})[engine].launch();
const viewport = phone ? {width:390, height:844} : {width:1440, height:900};
const report = {engine, version:browser.version(), viewport, input:phone ? 'touch' : 'keyboard', observations:[]};
const urls = new Map();
const errors = [], outgoingBodies = [];
let page;
await mkdir(directory, {recursive:true});

async function newTab(url) {
  if (page) await page.close();
  // Each newPage also gets a fresh context. No browser storage carries over.
  page = await browser.newPage({viewport, hasTouch:phone, reducedMotion:'reduce'});
  page.setDefaultTimeout(6500);
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', req => {
    if (req.postDataBuffer()) outgoingBodies.push(req.method());
    // Playwright may retain a navigation fragment in the logical request URL. HTTP omits it.
    const {pathname, search} = new URL(req.url());
    if (/approval-replay|proofreader|proof-1|renamed-proof|gate\.requested/i.test(decodeURIComponent(pathname + search)))
      errors.push('Recording data in an outgoing path or query');
  });
  await page.goto(url);
}

async function activate(control) {
  await control.waitFor();
  if (phone) return control.tap();
  for (let i = 0; i < 220; i++) {
    if (await control.evaluateAll(nodes => nodes.includes(document.activeElement))) return page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
  }
  assert.fail('Unreachable with Tab: ' + control);
}

const button = name => page.getByRole('button', {name, exact:true});
const el = selector => page.locator(selector);
async function openFile() {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), activate(button('Choose recording'))]);
  return chooser;
}
function upload(name, buffer) { return {name, mimeType:'text/plain', buffer}; }

async function checkMoment(position) {
  const state = position === 5 ? 'Waiting at gate' : 'Working';
  await el('#historyMapNote').filter({hasText:'Event ' + position + ' · gate.'}).waitFor();
  await el('#plan .agent[aria-label^="proofreader"][aria-label*="' + state + '"]').waitFor();
  assert.equal(await el('#historySubject').innerText(),'Proof review · Approve proof');
  assert.match(await el('#historyMapNote').innerText(), /proof-1/);
  assert.equal(await el('#recordingPrompt').isVisible(),false);
}
async function capture(name) {
  await page.screenshot({path:join(directory,engine + '-' + name + '.png')});
}

try {
  await newTab(new URL('#/project/psyche-build',base).href);
  await el('#traceFile').setInputFiles(upload('approval-replay.jsonl',bytes));
  await el('#traceKind').filter({hasText:'loaded'}).waitFor({state:'attached'});
  await activate(el(phone ? '#atlasMobileMissions' : '#atlasMissions'));
  await el('#atlasMissionSearch').fill('Proof');
  if (!phone) await page.keyboard.press('ArrowDown');
  await activate(el('.atlas-mission-row').filter({hasText:'Proof review'}));
  await activate(button('History'));
  await activate(button('Show event 5 on map'));
  if (mode === '--baseline') {
    const old = page.url();
    await newTab(old);
    await page.waitForFunction(() => location.hash === '#/project/psyche-build');
    assert.equal(await el('#historyReturn').isVisible(), false);
    await el('#traceKind').filter({hasText:'live'}).waitFor({state:'attached'});
    report.observations.push({missionLink:new URL(old).hash, reopened:new URL(page.url()).hash, source:'live', eventVisible:false});
    await capture('before');
  } else {
    for (const position of [5,7]) {
      if (position === 7) await activate(el('#historyForwardEvent'));
      await checkMoment(position);
      await activate(button('Bookmark moment'));
      await page.waitForFunction(p => location.hash.endsWith('/event/' + p), position);
      const url = page.url();
      assert.equal(new URL(url).hash, '#/recording/' + digest + '/mission/1/event/' + position);
      urls.set(position,url);
    }
    for (const [position,url] of urls) {
      await newTab(url);
      await el('#recordingPrompt').waitFor();
      assert.equal(await el('#recordingPromptTitle').innerText(),'Resume event ' + position);
      assert.ok(await el('#chooseRecording').evaluate(node => document.activeElement === node));
      if (position === 5) {
        await capture('choose');
        const cancelled = await openFile();
        await cancelled.setFiles([]);
        assert.equal(page.url(),url);
        await el('#recordingPrompt').waitFor();
        const wrong = Buffer.from(bytes.toString().replace('Approve proof','Other proof'));
        await (await openFile()).setFiles(upload('approval-replay.jsonl', wrong));
        await el('#recordingPromptError').filter({hasText:'differs'}).waitFor();
        assert.equal(page.url(),url);
        assert.equal(await el('#historyReturn').isVisible(),false);
        await capture('mismatch');
        // Leave while the native read is outstanding. Its late result must not replace the current Project.
        await page.evaluate(() => {
          const read = File.prototype.arrayBuffer;
          File.prototype.arrayBuffer = async function () {
            const bytes = await read.call(this);
            if (this.name === 'slow.jsonl') await new Promise(resolve => { window.releaseBookmarkRead = resolve; });
            return bytes;
          };
        });
        await (await openFile()).setFiles(upload('slow.jsonl',bytes));
        await page.waitForFunction(() => typeof window.releaseBookmarkRead === 'function');
        await activate(button('Cancel'));
        await page.evaluate(() => window.releaseBookmarkRead());
        // Retry from the same saved link in this tab.
        await page.goto(url);
        await el('#recordingPrompt').waitFor();
        assert.equal(await el('#historyReturn').isVisible(),false);
        report.observations.push('Cancelled picker, same-name wrong file, and cancellation during a slow read followed by retry');
      }
      await (await openFile()).setFiles(upload('renamed-proof.jsonl',bytes));
      await checkMoment(position);
      assert.equal(page.url(),url);
      assert.ok(await el('#historyResume').evaluate(node => document.activeElement === node));
      await capture('event-' + position);
      await activate(el('#historyResume'));
      assert.equal(await el('#historyTitle').innerText(),'Proof review');
      const jump = button('Show event ' + position + ' on map');
      const row = el('#historyRows li').filter({has:jump});
      const payload = JSON.parse(await row.locator('details[open] pre').innerText());
      await activate(row.getByRole('button',{name:'Bookmark moment',exact:true}));
      assert.equal(page.url(),url);
      assert.equal(payload.ask,'proof-1');
      assert.equal(payload.type,position === 5 ? 'gate.requested' : 'gate.resolved');
      report.observations.push({position,mission:'Proof review',request:payload.ask,type:payload.type,
        agent:position === 5 ? 'Waiting at gate' : 'Working', freshContext:true});
    }
    // A genuine file cannot satisfy an event belonging to another mission.
    await newTab(urls.get(5).replace('/event/5','/event/6'));
    await (await openFile()).setFiles(upload('approval-replay.jsonl',bytes));
    await el('#recordingPromptError').filter({hasText:'does not belong'}).waitFor();
    assert.equal(await el('#historyReturn').isVisible(),false);
    await activate(button('Cancel'));
    assert.equal(await el('#recordingPrompt').isVisible(),false);
    assert.ok(!page.url().includes('#/recording/'));
    report.observations.push('Cross-mission event refused; explicit Cancel returned to navigation');
  }
  assert.deepEqual(errors,[]);
  assert.deepEqual(outgoingBodies,[]);
  report.outgoingRequestBodies = outgoingBodies.length;
  console.log(JSON.stringify(report));
  await writeFile(join(directory,engine + '.json'),JSON.stringify(report,null,2)+'\n');
} finally { await browser.close(); }
