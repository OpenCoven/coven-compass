// Browser regression for the sample psyche-build Project. Use the external Playwright
// install described in browser-qa.mjs, serve dist/, and copy this file into that
// install. Run node plan-qa.mjs http://127.0.0.1:<port>/.
import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';
import {chromium} from 'playwright';

const base = process.argv[2];
if (!base) throw new Error('Pass the local Site URL as the first argument.');
const url = new URL('#/project/psyche-build', base).href;
const viewKey = 'coven-compass-view';
const obsolete = /\b(?:2d|3d|orbit|pitch|yaw|tilt|perspective)\b/i;
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function verifyControls(page, root) {
  const names = await page.locator(root).locator('button, [role=button], input, select, label').evaluateAll(els =>
    els.map(el => [el.id, el.getAttribute('aria-label'), el.title, el.textContent].filter(Boolean).join(' ')));
  assert.ok(names.length > 0, 'the tested region has controls');
  assert.deepEqual(names.filter(name => obsolete.test(name)), []);
}

async function verifyGeometry(page) {
  const observed = await page.evaluate(() => {
    const missions = [...document.querySelectorAll('.atlas-project-detail .lead-node')];
    const labels = [...document.querySelectorAll('.atlas-project-detail .gate-l, .atlas-project-detail .lead-name, .atlas-project-detail .task-l')]
      .filter(el => el.textContent && el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility === 'visible' && Number(getComputedStyle(el).opacity) > 0);
    const points = missions.map(node => new DOMPoint(0, 0).matrixTransform(node.getScreenCTM()));
    return {
      columns: new Set(points.map(p => Math.round(p.x))).size,
      rows: new Set(points.map(p => Math.round(p.y))).size,
      width: Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)),
      height: Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)),
      labels: labels.map(el => {
        const {a, b, c, d} = el.getScreenCTM();
        return {name: el.textContent, upright: a > 0 && Math.abs(a - d) < .001 && Math.abs(b) < .001 && Math.abs(c) < .001};
      })
    };
  });
  assert.ok(observed.width > 10 && observed.height > 10);
  assert.deepEqual([observed.columns, observed.rows], [2, 2], 'four sample mission centers align on both screen axes');
  assert.ok(Math.abs(observed.width - observed.height) < .1, 'mission centers keep the sample Project’s square arrangement');
  assert.ok(observed.labels.length > 0, 'visible map labels were measured');
  assert.deepEqual(observed.labels.filter(label => !label.upright), []);
}

async function readView(page) {
  // All camera input schedules a frame. Reduced motion makes the next frame
  // settle at the target, so read the rendered SVG after its paint.
  return page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => {
    const box = document.querySelector('#plan').viewBox.baseVal;
    resolve({x: box.x, y: box.y, width: box.width, height: box.height});
  }))));
}

async function freeMapPoint(page) {
  return page.evaluate(() => {
    const stage = document.querySelector('#plan').getBoundingClientRect();
    for (let y = Math.max(stage.top, 0) + 48; y < Math.min(stage.bottom, innerHeight) - 48; y += 12) {
      for (let x = Math.max(stage.left, 0) + 48; x < Math.min(stage.right, innerWidth) - 48; x += 12) {
        const clear = [-38, 0, 38].every(dx => [-32, 0, 32].every(dy => {
          const target = document.elementFromPoint(x + dx, y + dy);
          return target?.closest('#plan') && !target.closest('[role=button],.lead-node,.agent,.seat');
        }));
        if (clear) return {x, y};
      }
    }
    throw new Error('No unobstructed map surface');
  });
}

async function touchGesture(session, center, pinch) {
  const {x, y} = center;
  const points = (dx, distance) => pinch
    ? [{id: 1, x: x + dx - distance, y}, {id: 2, x: x + dx + distance, y}]
    : [{id: 1, x: x + dx, y}];
  await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: points(0, 12)});
  for (const step of [1, 2, 3, 4]) {
    await session.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: points(step * 4, 12 + step * 4)});
  }
  await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
}

for (const [name, width, height, mobile] of [['desktop', 1440, 900, false], ['phone', 390, 844, true]]) {
  test(name + ' restores a flat map and keeps it flat through input, fitting and locking', async () => {
    const context = await browser.newContext({viewport: {width, height}, reducedMotion: 'reduce', isMobile: mobile, hasTouch: mobile});
    try {
      await context.addInitScript(key => localStorage.setItem(key, JSON.stringify({yaw: 37, pitch: 65, zoom: .9, px: 20, py: -30, locked: true})), viewKey);
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      await page.locator('.atlas-project-detail .lead-node[transform]').first().waitFor({state: 'visible'});
      await verifyGeometry(page);
      const names = await page.locator('.atlas-project-detail .lead-name').evaluateAll(els => els.filter(el => el.checkVisibility({opacityProperty: true, visibilityProperty: true})).map(el => el.textContent));
      assert.equal(names.length, 4, 'all four sample mission names are visible in the fitted Project');
      const storage = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), viewKey);
      assert.deepEqual(Object.keys(storage).sort(), ['locked', 'px', 'py', 'zoom']);
      assert.equal(storage.locked, true);
      await verifyControls(page, '#stage');
      await verifyControls(page, '.plan-head');
      if (mobile && !(await page.locator('#atlasLock').isVisible())) await page.locator('#atlasMobileView').click();
      const lock = page.locator('#atlasLock'), fit = page.locator('#atlasFit');
      assert.equal(await lock.getAttribute('aria-pressed'), 'true');
      assert.equal(await fit.isDisabled(), true);
      await lock.click();
      await fit.click();
      const fitted = await readView(page);
      await page.locator('#stage').focus();
      await page.keyboard.press('Shift+ArrowRight');
      const sideways = await readView(page);
      assert.ok(sideways.x > fitted.x);
      assert.equal(sideways.width, fitted.width);
      await page.keyboard.press('ArrowDown');
      assert.ok((await readView(page)).y > sideways.y);
      const beforeDrag = await readView(page), point = await freeMapPoint(page);
      if (mobile) {
        const session = await context.newCDPSession(page);
        await touchGesture(session, point, false);
        assert.ok((await readView(page)).x < beforeDrag.x);
        await touchGesture(session, await freeMapPoint(page), true);
      } else {
        await page.keyboard.down('Shift');
        await page.mouse.move(point.x, point.y);
        await page.mouse.down();
        await page.mouse.move(point.x + 30, point.y, {steps: 6});
        await page.mouse.up();
        await page.keyboard.up('Shift');
        assert.ok((await readView(page)).x < beforeDrag.x);
        await page.mouse.wheel(0, -120);
      }
      assert.ok((await readView(page)).width < fitted.width, 'pinch or wheel zooms the rendered map');
      await verifyGeometry(page);
      await fit.click();
      assert.deepEqual(await readView(page), fitted, 'Fit restores the map frame');
      await page.locator('#atlasZoomIn').click();
      const zoomed = await readView(page);
      assert.ok(zoomed.width < fitted.width);
      await lock.click();
      assert.equal(await fit.isDisabled(), true);
      await page.locator('#stage').focus();
      await page.keyboard.press('Shift+ArrowLeft');
      await page.keyboard.press('-');
      assert.deepEqual(await readView(page), zoomed, 'locked camera resists keyboard movement');
      await lock.click();
      await page.locator('#atlasZoomOut').click();
      await verifyGeometry(page);
      assert.equal(new URL(page.url()).hash, '#/project/psyche-build');
      await page.locator('#atlasLab').click();
      await page.locator('#covenSealLab').waitFor({state: 'visible'});
      await verifyControls(page, '#covenSealLab');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#covenSealLab').isVisible(), false);
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  });
}

test('landscape Project makes use of the map height alongside its controls', async () => {
  const page = await browser.newPage({viewport: {width: 844, height: 390}, reducedMotion: 'reduce', isMobile: true, hasTouch: true});
  try {
    await page.goto(url);
    await page.locator('.atlas-project-detail .lead-node[transform]').first().waitFor({state: 'visible'});
    await readView(page);
    await verifyGeometry(page);
    const observed = await page.evaluate(() => {
      const stage = document.querySelector('#plan').getBoundingClientRect();
      const controls = ['#atlasHeader', '#atlasFamiliars'].map(id => document.querySelector(id).getBoundingClientRect());
      const discs = [...document.querySelectorAll('.atlas-project-detail .familiar-disc')].map(el => el.getBoundingClientRect());
      const left = Math.min(...discs.map(r => r.left)), right = Math.max(...discs.map(r => r.right));
      const top = Math.min(...discs.map(r => r.top)), bottom = Math.max(...discs.map(r => r.bottom));
      return {clear: left > Math.max(...controls.map(r => r.right)) && right <= stage.right && top >= stage.top && bottom <= stage.bottom,
        heightUsed: (bottom - top) / stage.height};
    });
    assert.equal(observed.clear, true);
    assert.ok(observed.heightUsed > .65, 'familiar branches use most of the stage height');
  } finally {
    await page.close();
  }
});
