// Run beside Playwright: node mission-request-qa.mjs <url> <approval-replay.jsonl> <chromium|webkit> [screenshots-directory] [--baseline]
import assert from 'node:assert/strict';
import {readFile, mkdir} from 'node:fs/promises';
import {before, after, test} from 'node:test';
import {chromium, webkit} from 'playwright';
const [url, fixture, engine, shots] = process.argv.slice(2);
const baseline = process.argv.includes('--baseline');
const sample = (await readFile(fixture, 'utf8')).trim();
let browser;
before(async () => { browser = await ({chromium, webkit})[engine].launch(); if (shots) await mkdir(shots, {recursive:true}); });
after(async () => { await browser?.close(); });

for (const [entry, width, height] of [['map',1440,900], ['strip',1440,900], ['browser',390,844], ['browser',844,390]]) {
  for (const input of (baseline ? ['pointer'] : ['pointer','keyboard'])) test(`${engine} ${entry} ${width}x${height} ${input}`, async () => {
    const page = await browser.newPage({viewport:{width,height}, hasTouch:width < 1000, reducedMotion:'reduce'});
    page.setDefaultTimeout(5000);
    const el = selector => page.locator(selector);
    const button = name => page.getByRole('button', {name,exact:true});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    async function tabTo(target) {
      for (let i = 0; i < 150; i++) {
        if (await target.evaluateAll(nodes => nodes.includes(document.activeElement))) return;
        await page.keyboard.press(engine === 'webkit' ? 'Alt+Tab' : 'Tab');
      }
      assert.fail('Cannot reach ' + target + ' from ' + await page.evaluate(() => document.activeElement.outerHTML.slice(0,160)));
    }
    async function activate(target) {
      if (input === 'pointer') { if (width < 1000) await target.tap(); else await target.click(); }
      else { await tabTo(target); await page.keyboard.press('Enter'); }
    }
    async function load(text) {
      await page.goto(new URL('#/project/psyche-build',url).href);
      await el('#traceFile').setInputFiles({name:'approval-replay.jsonl',mimeType:'text/plain',buffer:Buffer.from(text)});
      await el('#traceKind').filter({hasText:'loaded'}).waitFor({state:'attached'});
    }
    const review = el('[data-focus="review-request"]:visible');
    const queue = el('#reviewQueue'), list = el('#queueList'), filter = el('#queueFilter');
    const entryButton = el('.lead-node[aria-label^="Proof review"]');
    async function selectMission() {
      if (entry === 'map') {
        if (input === 'keyboard') {
          await tabTo(el('#plan [tabindex="0"]'));
          for (let i=0;i<60 && !await entryButton.evaluate(e=>e===document.activeElement);i++) await page.keyboard.press('ArrowRight');
        }
        await activate(entryButton);
      } else if (entry === 'strip') await activate(el('#leads [data-mission="proof"]'));
      else {
        await activate(el('#atlasMobileMissions'));
        await el('#atlasMissionSearch').fill('Proof');
        const row = el('.atlas-mission-row').filter({hasText:'Proof review'});
        if (input==='keyboard') { await page.keyboard.press('ArrowDown'); }
        await activate(row);
      }
    }
    async function inspect(position, stepResolution=false) {
      await activate(button('Inspect opening event'));
      const jump = button('Show event ' + position + ' on map');
      await jump.waitFor();
      assert.ok(await jump.evaluate(e=>e===document.activeElement));
      const payload=JSON.parse(await page.locator('#historyDetail').locator('details[open] pre').innerText());
      assert.equal(payload.mission,'proof'); assert.equal(payload.type,'gate.requested');
      await activate(jump);
      assert.match(await el('#historyMapNote').innerText(),new RegExp('Event '+position+' · gate.requested'));
      const agent = el('#plan .agent[aria-label^="proofreader"]');
      await agent.waitFor({state:'visible'});
      assert.match(await agent.getAttribute('aria-label'),/Waiting at gate/);
      if (stepResolution) {
        await activate(el('#historyForwardEvent'));
        assert.match(await el('#historyMapNote').innerText(),/Event 7 · gate.resolved/);
        await agent.waitFor({state:'visible'});
        assert.match(await agent.getAttribute('aria-label'),/Working/);
      }
      await activate(el('#historyResume'));
      await activate(button('Back to Inbox'));
      await list.waitFor();
    }
    try {
      await load(sample);
      await selectMission();
      if (baseline) {
        assert.equal(await review.count(), 0);
        if (shots) await page.screenshot({path: shots + '/' + engine + '-' + entry + '-' + width + '.png'});
        if (entry === 'browser') {
          const panel = await el('#inspect').innerText();
          assert.match(panel, /At gate/);
          assert.doesNotMatch(panel, /Release proof|Review requests?/);
        } else {
          await activate(el('.ask-note'));
          await el('#notif .cf').waitFor();
          assert.equal(await el('#notif .nrow').count(), 2, 'the Inbox mixes Proof and Index requests');
          assert.equal(await button('Inspect opening event').count(), 0);
        }
        return;
      }
      assert.match(await review.innerText(),/Release proof/); assert.match(await review.innerText(),/Cody/);
      const route=page.url();
      await review.evaluate(node => node.addEventListener('click', () => {
        window.reviewOriginScroll = [
          document.getElementById('inspect').scrollTop, document.getElementById('leads').scrollLeft,
          document.querySelector('#notes .manifest')?.scrollTop || 0
        ];
      }, {once:true, capture:true}));
      if(shots && input==='pointer') await page.screenshot({path:shots+'/'+engine+'-'+entry+'-'+width+'.png'});
      await activate(review);
      assert.equal(await el('#queueHeading').innerText(),'Release proof');
      assert.match(await el('#queueStatus').innerText(),/Proof review · Cody/);
      assert.equal(await queue.getByRole('button',{name:/Hold|Allow once|Raise to/}).count(),0);
      await inspect(8);
      assert.equal(await list.locator('button').count(),1);
      await activate(el('#queueClose'));
      assert.equal(page.url(),route);assert.ok(await review.evaluate(e=>e===document.activeElement));
      assert.ok(await page.evaluate(() => {
        const values = [document.getElementById('inspect').scrollTop, document.getElementById('leads').scrollLeft,
          document.querySelector('#notes .manifest')?.scrollTop || 0];
        return values.every((value, i) => Math.abs(value - window.reviewOriginScroll[i]) <= 1);
      }), 'selection scroll restored');
      if (entry==='browser') {
        await activate(el('#inspect [data-focus="mission-back"]'));
        assert.equal(await el('#atlasMissionSearch').inputValue(),'Proof');
        assert.match(await page.evaluate(()=>document.activeElement.textContent),/Proof review/);
      }
      // Capture a replay cursor immediately before the same-timestamp resolution.
      await page.goto(new URL('#/project/psyche-build/mission/proof?view=brief&detail=side',url).href);
      await activate(button('History')); await activate(el('#historyRows [data-position="5"]'));
      await activate(button('Show event 5 on map'));
      const atFive = page.url();
      await activate(review);
      assert.equal(await el('#queueHeading').innerText(),'Approve proof');
      await inspect(5,true);
      assert.equal(await list.locator('button').count(),1);
      assert.match(await list.innerText(),/Approve proof/);
      await activate(el('#queueClose')); assert.equal(page.url(),atFive);
      assert.match(await review.innerText(),/Approve proof/);
      // The very next event opens Index review's identically titled request. At event 5 it is absent.
      await page.goto(new URL('#/project/psyche-build/mission/index?view=brief&detail=side',url).href);
      await el('#missionDetailTitle').filter({hasText:'Index review'}).waitFor();
      assert.equal(await review.count(),0);
      assert.deepEqual(errors,[]);
    } finally {await page.close();}
  });
}

// Extend the same recording with a scrollable set of requests. Index review already has
// a request with this title, so title-only scoping would accidentally include its row.
for (const [width,height] of (baseline ? [] : [[1440,900],[390,844],[844,390]])) test(engine + ' multiple pending requests at ' + width, async () => {
  const page = await browser.newPage({viewport:{width,height}, reducedMotion:'reduce',hasTouch:width<1000});
  try {
    const additions = Array.from({length:28}, (_,index) => JSON.stringify({
      t:'2026-11-18T12:00:06Z', type:'gate.requested', mission:'proof',
      familiar:'cody', ask:'item-'+index, title:'Approve proof '+index
    }));
    await page.goto(new URL('#/project/psyche-build',url).href);
    await page.locator('#traceFile').setInputFiles({name:'many.jsonl',mimeType:'text/plain',buffer:Buffer.from([sample,...additions].join('\n'))});
    await page.locator('#traceKind').filter({hasText:'loaded'}).waitFor({state:'attached'});
    await page.goto(new URL('#/project/psyche-build/mission/proof?view=brief&detail=side',url).href);
    const action = page.locator('#inspect [data-focus="review-request"]');
    assert.match(await action.innerText(),/29 pending requests/);
    await action.click();
    const filter = page.locator('#queueFilter'), list = page.locator('#queueList');
    assert.equal(await list.locator('button').count(),29);
    await filter.fill('Approve proof');
    assert.equal(await list.locator('button').count(),28);
    const last=list.getByRole('button',{name:/^Approve proof 27,/});
    await last.scrollIntoViewIfNeeded();
    const offset=await list.evaluate(el=>el.scrollTop);
    assert.ok(offset>0);
    await last.click();
    await page.getByRole('button',{name:'Inspect opening event'}).click();
    const event=page.getByRole('button',{name:'Show event 36 on map'});
    const record=JSON.parse(await page.locator('#historyDetail').locator('details[open] pre').innerText());
    assert.equal(record.ask,'item-27');
    await event.click(); await page.locator('#historyResume').click();
    await page.getByRole('button',{name:'Back to Inbox'}).click();
    assert.equal(await filter.inputValue(),'Approve proof');
    assert.ok(await last.evaluate(el=>el===document.activeElement));
    assert.equal(await list.evaluate(async el=>{await new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok)));return el.scrollTop;}),offset);
    await page.keyboard.press('Escape');
    assert.ok(await action.evaluate(el=>el===document.activeElement));
  } finally {await page.close();}
});
