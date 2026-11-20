// Copy beside the external Playwright installation used by browser-qa.mjs.
// node guide-qa.mjs <site-root> [screenshot-directory]
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const [root, output] = process.argv.slice(2);
if (!root) throw Error('Supply the URL of a served Compass checkout.');
if (output) await mkdir(output, {recursive: true});
const url = new URL('handoff/guide.html', root);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 2518, height: 1098}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  async function capture(name) {
    await page.evaluate(() => document.fonts.ready);
    if (output) await page.screenshot({path: path.join(output, name + '.png')});
  }
  await page.goto(url.href);
  await capture('overview-wide');
  const left = await page.locator('.brand').evaluate(e => e.getBoundingClientRect().left);
  const rail = await page.locator('.sidebar').boundingBox();
  assert(Math.abs(left - rail.x) < 2);
  const cards = await page.locator('.paths a').evaluateAll(es => es.map(e => e.offsetTop));
  assert.equal(new Set(cards).size, 1);
  await page.locator('.outline a').first().click();
  await page.waitForFunction(() => document.querySelector('.outline [aria-current]')?.hash === '#reading-paths');
  await page.locator('.paths a').nth(1).click();
  assert(await page.locator('.chapter-group[open] [aria-current="page"]').isVisible());

  await page.setViewportSize({width: 1601, height: 1098});
  await page.locator('#chapters a[href="#doc-00-handoff-index"]').click();
  const directory = page.locator('#doc-00-handoff-index--chapters + ul');
  assert.equal(await directory.locator('li > p:first-child > a').count(), 13);
  await capture('chapter-directory');
  await directory.getByRole('link', {name: /Scalable Atlas/}).click();
  await page.setViewportSize({width: 1804, height: 1098});
  await capture('atlas-layout');
  const headings = page.locator('.chapter:visible h2[id]');
  const third = await headings.nth(2).getAttribute('id');
  await headings.nth(2).evaluate(e => e.scrollIntoView());
  await page.waitForFunction(id => document.querySelector('.outline [aria-current="location"]')?.hash === '#' + id, third);
  const list = page.locator('.outline a');
  await list.nth(1).click();
  const linked = new URL(page.url()).hash;
  await page.reload();
  await page.waitForFunction(hash => document.querySelector('.outline [aria-current="location"]')?.hash === hash, linked);
  await page.getByRole('button', {name: 'Switch to light theme'}).click();
  await capture('atlas-light');
  await page.getByRole('button', {name: 'Switch to dark theme'}).click();

  await page.setViewportSize({width: 390, height: 844});
  await page.goto(url.href + '#doc-15-scalable-atlas-layout');
  await page.locator('#inline-outline summary').click();
  await page.locator('#inline-outline a').first().click();
  assert.equal(await page.locator('.outline').getAttribute('open'), null);
  const table = page.locator('.chapter:visible .table-scroll').first();
  await page.waitForFunction(() => document.querySelector('.chapter:not([hidden]) .table-scroll')?.tabIndex === 0);
  await capture('atlas-mobile');
  await table.focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.activeElement.scrollLeft > 0);
  assert(await page.locator('.chapter:visible .table-hint').first().isVisible());
  await page.goto(url.href + '#doc-00-handoff-index');
  await capture('directory-mobile');
  for (const width of [320, 390, 800, 820, 1150, 1280, 1804, 2518]) {
    await page.setViewportSize({width, height: 844});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Overflow at ' + width);
  }
  await page.locator('.brand').click();
  const broken = await page.locator('a[href^="#"]').evaluateAll(es => es.filter(e => !document.getElementById(decodeURIComponent(e.hash.slice(1)))).map(e => e.hash));
  assert.deepEqual(broken, []);
  assert.deepEqual(errors, []);
  console.log('PASS: wide layout, reading paths, chapter groups, index, scroll tracking, section reload, themes, compact outline, keyboard table scrolling and internal links in Chromium ' + browser.version());
} finally {
  await browser.close();
}
