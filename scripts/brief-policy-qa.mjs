// Run a copy from an external Playwright installation. Arguments: served dist URL, receipt path.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';

const [base, output] = process.argv.slice(2);
const browser = await chromium.launch();
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const receipt = {browser: 'Chromium ' + browser.version(), playwright: createRequire(import.meta.url)('playwright/package.json').version,
  capturedAt: new Date().toISOString(), evidence: 'Local simulation in headless Chromium', sources: {}, runs: []};
try {
  for (const file of ['index.html','brief-policy.js','brief-policy-ui.js','brief-policy.css','simulation-model.js']) {
    const response = await fetch(new URL(file, base));
    assert.equal(response.status, 200);
    receipt.sources[file] = digest(Buffer.from(await response.arrayBuffer()));
  }
  for (const width of [1440,390]) {
    const height = width === 390 ? 844 : 900;
    const context = await browser.newContext({viewport:{width,height},isMobile:width === 390,hasTouch:width === 390});
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    const errors = [], checks = [];
    page.on('pageerror', e => errors.push(e.message));
    const run = {width,height,checks};
    receipt.runs.push(run);
    const click = name => page.getByRole('button',{name,exact:true}).click();
    const review = page.locator('.policy-review');
    const cards = review.locator('article');
    const check = async (name, fn) => {await fn(); checks.push(name);};
    try {
      await page.goto(base);
      await page.locator('#atlasBrowse').click();
      await page.locator('#atlasNewProject').click();
      await page.locator('#czName').fill('brief-fixture');
      await page.locator('#czRepo').fill('https://github.com/example/brief-fixture');
      await page.locator('#czRoot').fill('~/code/brief-fixture');
      await page.locator('#czGo').click();
      await page.locator('#nmName').fill('Qualify the report');
      await click('Add success criteria');
      await page.getByLabel('Require verified examples').check();
      await check('Author sees the required review, weighted rubric and target before saving', async () => {
        const preview = await page.locator('.policy-preview').innerText();
        for (const word of ['Independent review','weighted quality ≥ 80%','4 synthetic verified examples','3 attempts']) assert.ok(preview.includes(word), preview);
        assert.equal(await page.locator('#raise').isEnabled(),true);
      });
      await page.locator('#raise').click();
      const more = page.getByRole('button',{name:'Open details',exact:true});
      await Promise.race([more.waitFor(),review.waitFor()]);
      if (!(await review.isVisible())) await more.click();
      await click('Inspect fixture attempt A');
      await check('A scores 100% and a failed independent review requires revision', async () => {
        const text = await cards.first().innerText();
        for (const word of ['Candidate A','Request bounded revision','Required condition failed: Independent review passes','100%']) assert.ok(text.includes(word),text);
      });
      await click('Inspect corrected candidate B');
      await check('B waits for its own evidence', async () => {
        assert.match(await cards.nth(1).innerText(),/Wait for evidence/);
        assert.equal(await cards.count(),2);
      });
      await click('Reveal B’s matching evidence');
      await check('B qualifies with protected acceptance pending and cumulative usage retained', async () => {
        assert.match(await cards.nth(2).innerText(),/Request authorized acceptance/);
        assert.match(await cards.nth(2).innerText(),/Protected acceptance is pending/);
        assert.match(await review.innerText(),/2 attempts · 20 USD cents · 4 minutes/);
        await cards.nth(2).locator('summary').click();
        const text = await cards.nth(2).innerText();
        assert.match(text,/Observation SHA-256 [a-f0-9]{64}/);
        assert.match(text,/Fixture reviewer|fixture reviewer/);
        run.provenance = text.match(/Policy ([a-z0-9-]+)/)[1];
      });
      await cards.nth(1).getByRole('button',{name:'Replay this point'}).click();
      await check('Actual timeline rewind removes the later observation', async () => {
        assert.equal(await cards.count(),2);
        assert.match(await cards.last().innerText(),/Wait for evidence/);
      });
      await click('Return to current Brief');
      await check('Returning to current time restores the matching observation', async () => {
        assert.equal(await cards.count(),3);
        assert.match(await cards.last().innerText(),/Request authorized acceptance/);
      });
      await page.reload();
      await review.waitFor();
      await check('Reload restores all three historical observations with the original revision', async () => {
        assert.equal(await cards.count(),3);
        assert.match(await review.innerText(),new RegExp(run.provenance));
      });
      await click('Edit brief');
      const threshold = page.getByLabel('Minimum weighted score (%)',{exact:true});
      await threshold.fill('101');
      await check('An invalid edited threshold prevents saving', async () => assert.equal(await page.locator('#raise').isEnabled(),false));
      await threshold.fill('90');
      await check('Edit previews the new 90% rule', async () => assert.match(await page.locator('.policy-preview').innerText(),/weighted quality ≥ 90%/));
      await page.locator('#raise').click();
      await review.getByText(/Earlier evaluations belong/).waitFor();
      await page.reload();
      await check('Edited policy survives reload, retaining historical B and its old grade', async () => {
        await review.getByText(/Earlier evaluations belong/).waitFor();
        assert.match(await review.innerText(),/weighted quality ≥ 90%/);
        const old = cards.nth(2);
        await old.locator('summary').click();
        assert.match(await old.innerText(),new RegExp(run.provenance));
        assert.match(await old.innerText(),/weighted quality ≥ 80%/);
        assert.equal(await cards.count(),3);
      });
      await click('Inspect fixture attempt A');
      await check('The third attempt exhausts the cumulative limit after an edit', async () => {
        assert.match(await cards.last().innerText(),/Stop and escalate/);
        assert.match(await review.innerText(),/3 attempts · 30 USD cents · 6 minutes/);
        assert.equal(await review.getByRole('button',{name:'Inspect corrected candidate B'}).count(),0);
      });
      await check('Inspector fits the viewport and emits no page errors', async () => {
        const rect = await review.boundingBox();
        assert.ok(rect.x >= -1 && rect.x + rect.width <= width + 1, JSON.stringify(rect));
        assert.deepEqual(errors,[]);
      });
    } catch (err) {
      console.error(width,checks,(await page.locator('body').innerText()).slice(-2000));
      await page.screenshot({path: output + '.failure.png'});
      throw err;
    } finally { await context.close(); }
  }
  await fs.writeFile(output,JSON.stringify(receipt,null,2)+'\n');
  console.log(receipt.runs.map(r => r.width + 'px: ' + r.checks.length + ' checks passed').join('\n'));
} finally {await browser.close();}
