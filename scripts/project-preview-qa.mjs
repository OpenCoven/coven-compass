// Run alongside the external Playwright installation used by browser-qa.mjs.
import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';
import {chromium} from 'playwright';

const base = process.argv[2];
if (!base) throw new Error('Pass the URL of a running Compass preview.');
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

for (const [width, height] of [[1440, 900], [390, 844]]) {
  test(`project previews and task groups at ${width}×${height}`, async () => {
    const page = await browser.newPage({viewport: {width, height}, reducedMotion: 'reduce', hasTouch: width < 500});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(base);
      await page.locator(width < 500 ? '#atlasMobileMap' : '#atlasOverview').click();
      const project = page.locator('.ghostfort[aria-label^="psyche-build,"]');
      await project.locator('.preview-mission').first().waitFor({state: 'visible'});
      assert.equal(await project.locator('.preview-mission').count(), 4);
      assert.equal(await project.locator('.gname').textContent(), 'psyche-build');
      assert.equal(await page.locator('.ghostfort.dormant .preview-mission').count(), 0);
      assert.match(page.url(), /#\/coven/);
      if (width < 500) await project.tap();
      else {
        await page.locator('#atlasBrowse').click();
        const row = page.locator('.atlas-project[data-project="psyche-build"]');
        assert.match(await row.locator('.atlas-project-preview-names').innerText(), /Review readiness/);
        await row.click();
      }
      const trays = page.locator('#plan .mission-tasks');
      const tray = trays.first();
      await tray.waitFor();
      assert.equal(await trays.count(), 4);
      assert.equal(await page.locator('.lead-node.sel').count(), 0);
      assert.ok(await tray.locator('.task-tray-bg').isVisible());
      assert.ok(await tray.locator('.task-cog').count() > 0);
      assert.match(await tray.getAttribute('aria-label'), /tasks? on .+Open task list/);
      if (width < 500) await tray.tap();
      else { await tray.focus(); await page.keyboard.press('Enter'); }
      await page.locator('#inspect [role="tab"][aria-selected="true"]').filter({hasText: 'Tasks'}).waitFor();
      assert.ok(await page.locator('#inspect .tname').count() > 0);
      // Import tasks with zero agents through the same supported UI as a local recording.
      await page.setViewportSize({width: 1440, height: 900});
      await page.goto(new URL('#/project/psyche-build', base).href);
      await page.reload();
      await page.locator('#workspaceTools > summary').click();
      await page.locator('#traceBox > summary').click();
      await page.locator('#traceLoad > summary').click();
      const names = ['Brief', 'Review', 'Copy', 'Layout', 'Polish'];
      const event = (type, props) => JSON.stringify({t:'2026-11-18T06:20:00Z', type, mission:'solo', ...props});
      const token = 'Release/candidate-'.repeat(26) + '👩🏽‍💻';
      const missionName = token + ' review across all release channels Unstaffed mission';
      const records = [event('mission.opened', {name: missionName}), ...names.map((name, i) =>
        event('task.opened', {task: 'task-' + i, name, familiar: 'cody'}))];
      const chooser = page.waitForEvent('filechooser');
      await page.locator('#traceDrop').click();
      await (await chooser).setFiles({name:'tasks.jsonl', mimeType:'text/plain', buffer:Buffer.from(records.join('\n'))});
      const unstaffed = page.locator('.atlas-mission-group[data-m="solo"] .mission-tasks');
      await unstaffed.waitFor();
      await page.setViewportSize({width, height});
      const caption = page.locator('#missionCaptions .mission-caption').filter({hasText: token});
      await caption.waitFor();
      assert.equal(await caption.locator(':scope > span').textContent(), missionName);
      if (width < 500) {
        const bounds = await page.locator('#missionCaptions').boundingBox();
        const dock = await page.locator('#atlasMobileChrome').boundingBox();
        assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= dock.y, 'full captions clear the mobile controls');
      }
      const reference = await caption.locator('b').textContent();
      assert.equal(await unstaffed.locator('..').locator('.lead-name').textContent(), reference);
      const word = caption.locator('.mission-word').first();
      assert.ok(await word.evaluate(el => {
        el.scrollLeft = el.scrollWidth;
        return getComputedStyle(el).whiteSpace === 'nowrap' && el.scrollLeft > 0 &&
          getComputedStyle(el).textOverflow !== 'ellipsis' && el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      }), 'the last grapheme of an oversized word can be read without breaking it');
      assert.equal(await unstaffed.locator('.task-cog').count(), 3);
      assert.equal(await unstaffed.locator('.task-overflow').textContent(), '+2');
      // Start from the overview again, this time with a Project containing only unstaffed tasks.
      await page.locator(width < 500 ? '#atlasMobileMap' : '#atlasOverview').click();
      await project.locator('.preview-mission').first().waitFor();
      const item = page.locator('#plan [data-map-item]:focus');
      for (let i = 0; i < 100 && !await item.count(); i++) await page.keyboard.press('Tab');
      assert.equal(await item.count(), 1, 'Tab enters the map');
      await page.keyboard.press('Home');
      const first = await item.getAttribute('aria-label');
      await page.keyboard.press('End');
      assert.notEqual(await item.getAttribute('aria-label'), first);
      await page.keyboard.press('Home');
      const projectCount = await page.locator('.ghostfort').count();
      for (let i = 0; i < projectCount && !await project.evaluate(el => el.matches(':focus')); i++) {
        await page.keyboard.press('ArrowRight');
      }
      assert.ok(await project.evaluate(el => el.matches(':focus')), 'arrow keys reach the Project preview');
      assert.equal(await page.locator('#plan [tabindex="0"]').count(), 1);
      await page.keyboard.press('Tab');
      assert.equal(await item.count(), 0, 'one Tab leaves the map');
      await page.keyboard.press('Shift+Tab');
      assert.ok(await project.evaluate(el => el.matches(':focus')), 'Tab returns to the same Project');
      await page.keyboard.press('Enter');
      await unstaffed.waitFor();
      assert.equal(await item.count(), 1, 'opening a Project from the map keeps keyboard focus inside it');
      const itemCount = await page.locator('#plan [data-map-item]').count();
      for (let i = 0; i < itemCount && !await unstaffed.evaluate(el => el.matches(':focus')); i++) await page.keyboard.press('ArrowRight');
      assert.ok(await unstaffed.evaluate(el => el.matches(':focus')), 'arrow keys reach the unstaffed task group');
      await page.keyboard.press('Space');
      assert.deepEqual(await page.locator('#inspect .tname').allTextContents(), names);
      const heading = page.locator('#missionDetailTitle');
      assert.equal(await heading.textContent(), missionName);
      assert.ok(await heading.evaluate(el => el.scrollHeight <= el.clientHeight + 1), 'all lines of the inspector name are available');
      await page.locator('[data-focus="close-details"]').click();
      await page.keyboard.press('Escape');
      assert.ok(await unstaffed.evaluate(el => el.matches(':focus')), 'deselecting the mission returns to its task group');

      const launcher = page.locator(width < 500 ? '#atlasMobileMissions' : '#atlasMissions');
      await launcher.click();
      const search = page.locator('#atlasMissionSearch');
      await search.fill('Unstaffed');
      await search.press('ArrowDown');
      const row = page.getByRole('button', {name: /Unstaffed mission, psyche-build/});
      assert.ok(await row.evaluate(el => el.matches(':focus')));
      await page.keyboard.press('Enter');
      await page.getByRole('heading', {name: missionName, exact: true}).waitFor();
      await page.locator('[data-focus="close-details"]').click();
      assert.equal(await search.inputValue(), 'Unstaffed');
      assert.ok(await row.evaluate(el => el.matches(':focus')), 'close returns to the filtered mission');
      await page.keyboard.press('Escape');
      assert.ok(await launcher.evaluate(el => el.matches(':focus')));
      assert.match(page.url(), /#\/project\/psyche-build$/);
      await page.goto(new URL('#/castle/psyche-build', base).href);
      const notice = page.locator('#atlasNavigationNotice');
      await notice.waitFor();
      assert.match(await notice.innerText(), /navigation link is not valid/);
      assert.ok(await notice.evaluate(el => {
        const r = el.getBoundingClientRect();
        return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
      }), 'invalid-link notice fits the viewport');
      assert.match(page.url(), /#\/coven$/);
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}

test('mission browsing leaves space for the selected seal and the open Inbox review', async () => {
  const page = await browser.newPage({viewport: {width: 1908, height: 1146}, reducedMotion: 'reduce'});
  try {
    await page.goto(new URL('#/project/psyche-build', base).href);
    const launcher = page.locator('#atlasMissions');
    const drawer = page.locator('#atlasMissionBrowser');
    const row = drawer.getByRole('button', {name: /^Source survey, psyche-build,/});
    await launcher.click();
    assert.equal(await row.locator('.atlas-mission-project').isVisible(), false);
    assert.equal(await row.locator('.atlas-mission-meta').innerText(), 'Needs you');
    assert.equal(await row.locator('.atlas-pending').innerText(), '1 pending request');
    await page.locator('#atlasMissionProject').selectOption('');
    assert.equal(await row.locator('.atlas-mission-project').innerText(), 'psyche-build');
    await row.click();
    await page.locator('#mission-tab-tasks').click();
    const tasks = page.locator('#inspect .i-task');
    assert.ok(await tasks.count() > 0);
    for (const task of await tasks.all()) {
      const dots = task.locator('button.dot');
      const count = await dots.count();
      assert.equal(await task.locator('.i-assigned').innerText(), count + (count === 1 ? ' agent' : ' agents'));
      const parts = [];
      for (const [state, label] of [['gate', 'at gate'], ['work', 'working'], ['idle', 'idle']]) {
        const n = await task.locator('.dot.' + state).count();
        if (n) parts.push(n + ' ' + label);
      }
      assert.equal(await task.locator('.i-task-summary').innerText(), parts.join(' · '));
    }
    const note = page.locator('.ask-note');
    await note.click();
    await page.locator('#notif .cf').waitFor();
    await note.waitFor({state: 'hidden'});
    assert.equal(await page.getByRole('button', {name: 'Allow once', exact: true}).isVisible(), true);
    await launcher.click();
    await page.waitForFunction(() => {
      const seal = document.querySelector('.lead-node.sel .se-face')?.getBoundingClientRect();
      const drawer = document.querySelector('#atlasMissionBrowser').getBoundingClientRect();
      const inspector = document.querySelector('#inspect').getBoundingClientRect();
      return seal && seal.left > inspector.right && seal.right < drawer.left;
    });
    await page.keyboard.press('Escape');
    await page.locator('#tabChat').click();
    await note.waitFor({state: 'visible'});
  } finally {
    await page.close();
  }
});

test('Review readiness lets the keyboard switch familiar groups and return to the mission', async () => {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}, reducedMotion: 'reduce'});
  try {
    await page.goto(new URL('#/project/psyche-build', base).href);
    const mission = page.getByRole('button', {name: /^Review readiness,.*Show its agents and tasks$/});
    const group = name => page.getByRole('button', {name: `Focus ${name} group on Review readiness`, exact: true});
    const cody = group('Cody'), astra = group('Astra');
    const tabStop = page.locator('#plan [data-map-item][tabindex="0"]');
    const focused = locator => locator.evaluate(el => el === document.activeElement);

    await mission.focus();
    await page.keyboard.press('Enter');
    const bounds = await cody.boundingBox();
    assert.ok(bounds, 'the selected mission exposes Cody’s group');
    await cody.click({position: {x: bounds.width / 2, y: 3}});
    assert.ok(await focused(cody));
    assert.equal(await cody.getAttribute('aria-pressed'), 'true');
    assert.equal(await astra.getAttribute('aria-pressed'), 'false');

    // Walk the same map items a keyboard visitor encounters, including individual agents.
    const itemCount = await page.locator('#plan [data-map-item]').count();
    for (let step = 0; !(await focused(astra)); step++) {
      assert.equal(await tabStop.count(), 1);
      assert.ok(await focused(tabStop), 'arrow navigation keeps focus on the map’s single Tab stop');
      const name = await tabStop.getAttribute('aria-label');
      assert.equal(await page.getByRole('button', {name, exact: true}).and(tabStop).count(), 1, 'focused map button is exposed by name');
      assert.ok(step < itemCount, 'Astra was unreachable from ' + name);
      await page.keyboard.press('ArrowLeft');
    }
    assert.equal(await tabStop.count(), 1);
    assert.ok(await focused(tabStop));
    await page.keyboard.press('Space');
    assert.ok(await focused(astra));
    assert.equal(await astra.getAttribute('aria-pressed'), 'true');
    assert.equal(await cody.getAttribute('aria-pressed'), 'false');

    await page.keyboard.press('Escape');
    const summary = page.getByRole('heading', {name: 'Review readiness', exact: true});
    assert.ok(await focused(summary));
    assert.equal(await astra.getAttribute('aria-pressed'), 'false');
    await page.keyboard.press('Escape');
    assert.ok(await focused(mission));
    assert.equal(await tabStop.count(), 1);
    assert.ok(await focused(tabStop));
    assert.equal(await astra.count(), 0, 'closed mission group leaves the accessibility tree');
  } finally {
    await page.close();
  }
});

test('mission focus traces the seal and reveals the planes for its agents', async () => {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}, reducedMotion: 'reduce'});
  try {
    await page.goto(new URL('#/project/psyche-build', base).href);
    const mission = page.locator('.lead-node[aria-label^="Source survey,"]');
    // Enter keyboard modality and activate the real map control.
    await page.keyboard.press('Tab');
    await mission.focus();
    assert.equal(await mission.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
    assert.equal(await mission.locator('.se-selection').isVisible(), true);
    await page.keyboard.press('Enter');
    await page.locator('#plan.atlas-selected').waitFor();
    const selected = page.locator('.atlas-mission-group.atlas-mission-current');
    await selected.locator('.task-tray-well').waitFor({state: 'visible'});
    const hierarchy = await selected.evaluate(group => {
      const title = group.querySelector('.lead-name'), status = group.querySelector('.atlas-mission-state');
      const pixels = text => parseFloat(getComputedStyle(text).fontSize) * text.getScreenCTM().a;
      const bounds = node => node.getBoundingClientRect();
      const tray = group.querySelector('.task-tray-bg');
      return {title: pixels(title), status: pixels(status), warning: status.textContent,
        count: group.querySelector('.mission-tasks .task-caption').textContent,
        rowsClear: bounds(title).bottom <= bounds(status).top && bounds(status).bottom <= bounds(tray).top,
        gatesClear: [...document.querySelectorAll('.atlas-project-decision .gate-l.on')].every(label => {
          if (getComputedStyle(label).visibility === 'hidden') return true;
          const a = bounds(label), b = bounds(tray);
          return a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
        })};
    });
    assert.ok(hierarchy.title >= 14 && hierarchy.title > hierarchy.status);
    assert.match(hierarchy.warning, /Needs you · Tokens \d+%/);
    assert.equal(hierarchy.count, '3 tasks');
    assert.ok(hierarchy.rowsClear && hierarchy.gatesClear);
    const planes = page.locator('.atlas-squad:not(.dim) .squad-plane:visible');
    assert.ok(await planes.evaluateAll(items => items.some(plane => getComputedStyle(plane).display !== 'none')));
    assert.ok(await page.locator('.atlas-squad.dim .squad-plane').evaluateAll(planes =>
      planes.every(plane => getComputedStyle(plane).display === 'none')));
    for (const plane of await planes.all()) {
      // Read moving SVG geometry in one animation frame.
      assert.ok(await plane.evaluate(el => {
        const rect = el.querySelector('rect').getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && [...el.parentNode.querySelectorAll('.agent-mark,.cell-ghost')].every(mark => {
          const box = mark.getBoundingClientRect();
          return !box.width || (box.left >= rect.left - 1 && box.right <= rect.right + 1 &&
            box.top >= rect.top - 1 && box.bottom <= rect.bottom + 1);
        });
      }));
    }
    const floor = planes.first().locator('rect');
    const bounds = await floor.boundingBox();
    await floor.click({position: {x: bounds.width / 2, y: 3}});
    await page.locator('.squad-plane rect[aria-pressed="true"]').waitFor();
    // Moving past an unselected mission's task tray must skip its hidden group floors.
    const reviewTray = page.getByRole('button', {name: /tasks on Review readiness:.*Open task list/});
    await reviewTray.focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => {
      const active = document.activeElement;
      return active?.hasAttribute('data-map-item') && !active.closest('.mission-tasks') &&
        active.matches('[tabindex="0"]') && !active.closest('.squad-plane');
    }), true);
    const other = page.getByRole('button', {name: 'Focus Charm group on Source survey', exact: true});
    await other.focus();
    await other.press('Space');
    assert.equal(await other.getAttribute('aria-pressed'), 'true');
    const distant = page.locator('.atlas-mission-group.dim').first();
    assert.ok(await distant.evaluate(el => Number(getComputedStyle(el).opacity) < .5));
    await mission.focus();
    await page.keyboard.press('Escape');
    await page.locator('.atlas-squad .seat.sel').waitFor({state: 'hidden'});
    await page.keyboard.press('Escape');
    await page.locator('#plan:not(.atlas-selected)').waitFor();
    assert.ok(await page.locator('.squad-plane').evaluateAll(planes =>
      planes.every(plane => getComputedStyle(plane).display === 'none')));
    assert.ok(await mission.evaluate(el => el === document.activeElement));
  } finally {
    await page.close();
  }
});

test('mission inspector keeps identity, activity and tabs in three rows', async () => {
  for (const [width, height] of [[1440, 900], [390, 844], [320, 640], [844, 390]]) {
    const page = await browser.newPage({viewport: {width, height}, reducedMotion: 'reduce'});
    try {
      await page.goto(new URL('#/project/coven-cave/mission/m-2?view=agents&detail=side', base).href);
      const header = page.locator('.mission-header');
      await header.waitFor();
      const rows = await header.locator(':scope > *').all();
      assert.equal(rows.length, 3);
      const bounds = await header.boundingBox();
      assert.ok(bounds.height <= (width > 1100 ? 120 : 155));
      const rail = await page.locator('#inspect').boundingBox();
      assert.ok(rail.x <= 32, 'mission details open on the left');
      let previousBottom = bounds.y;
      for (const row of rows) {
        const rect = await row.boundingBox();
        assert.ok(rect.y >= previousBottom - 1);
        previousBottom = rect.y + rect.height;
      }
      for (const label of await header.locator('.mission-path, .i-counts, .i-view').all()) {
        assert.ok(await label.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'sample details fit at width ' + width);
      }
      assert.equal(await header.locator('.mission-title').innerText(), 'Changelog');
      assert.equal(await header.locator('.council-count').innerText(), '2');
      assert.equal(await header.locator('.i-counts dd').allTextContents().then(counts => counts.join('/')), '0/9/3');
      await header.getByRole('button', {name: /Previous mission/}).click();
      assert.equal(await header.locator('.mission-title').innerText(), 'Board cards');
      await header.getByRole('button', {name: /Next mission/}).click();
      assert.equal(await header.locator('.mission-title').innerText(), 'Changelog');
      await header.getByRole('tab', {name: 'Tasks'}).click();
      assert.equal(await page.locator('#mission-section').getAttribute('aria-labelledby'), 'mission-tab-tasks');
      await header.getByRole('button', {name: 'Close details'}).click();
      await header.waitFor({state: 'hidden'});
    } finally {
      await page.close();
    }
  }
});

test('Tasks identifies owners and opens agent details inside the originating group', async () => {
  for (const hasTouch of [false, true]) {
    const viewport = hasTouch ? {width: 390, height: 844} : {width: 1440, height: 900};
    const page = await browser.newPage({viewport, hasTouch, reducedMotion: 'reduce'});
    try {
      await page.goto(new URL('#/project/psyche-build/mission/m-2?view=tasks&detail=side', base).href);
      const groups = page.locator('#mission-section .i-task');
      const waiting = groups.filter({has: page.locator('button.gate')}).first();
      const agent = waiting.locator('button.gate').first();
      await agent.waitFor();
      const id = (await agent.getAttribute('aria-label')).split(',')[0];
      assert.match(await waiting.locator('.i-task-owner').innerText(), /Astra|Charm/);
      assert.match(await waiting.locator('.i-task-summary').innerText(), /at gate/);
      const hit = await agent.boundingBox();
      assert.ok(hit.width >= (hasTouch ? 44 : 28) && hit.height >= (hasTouch ? 44 : 28));
      await agent.focus();
      await page.keyboard.press('Enter');
      const details = waiting.locator('.a-info');
      assert.equal(await details.locator('.id').innerText(), 'Agent ' + id);
      assert.ok((await details.locator('h3').innerText()).length > 0);
      assert.ok(await details.locator('h3').evaluate(el => document.activeElement === el));
      await details.getByRole('button', {name: 'Close agent details'}).click();
      assert.ok(await agent.evaluate(el => document.activeElement === el));
      const other = groups.filter({hasNot: page.locator('.i-task-summary.waiting')}).last();
      await other.locator('button.dot').first().click();
      assert.equal(await other.locator('.a-info:visible').count(), 1);
      assert.equal(await waiting.locator('.a-info:visible').count(), 0);
    } finally {
      await page.close();
    }
  }
});

test('one top bar contains navigation and project actions at desktop and phone widths', async () => {
  for (const [width, height] of [[1440, 900], [390, 844], [320, 640], [844, 390]]) {
    const page = await browser.newPage({viewport: {width, height}, hasTouch: width < 1100, reducedMotion: 'reduce'});
    try {
      await page.goto(new URL('#/project/psyche-build', base).href);
      const bar = page.locator('#workspaceBar'), menu = bar.locator('#workspaceTools > summary');
      await menu.waitFor();
      const bounds = await bar.boundingBox(), stage = await page.locator('#stage').boundingBox();
      assert.ok(bounds.height <= 60 && bounds.y + bounds.height <= stage.y + 1);
      for (const control of await bar.locator('#atlasHeader :is(a,button):visible, #stopBtn:visible, #needBtn:visible, #workspaceTools > summary').all()) {
        const r = await control.boundingBox();
        assert.ok(r.x >= bounds.x && r.x + r.width <= bounds.x + bounds.width + 1);
        assert.ok(r.y >= bounds.y && r.y + r.height <= bounds.y + bounds.height);
      }
      const brand = bar.getByRole('img', {name: 'Compass', exact: true});
      assert.equal(await brand.textContent(), '');
      assert.equal(await brand.locator('svg').count(), 1);
      const scope = bar.getByRole('navigation', {name: 'Workspace scope'});
      if (await scope.isVisible()) {
        const coven = scope.locator('#atlasOverview'), project = scope.locator('#atlasProject');
        assert.deepEqual(await scope.getByRole('button').allTextContents(), ['Coven', 'Project']);
        const left = await coven.boundingBox(), right = await project.boundingBox();
        const mark = await brand.boundingBox();
        assert.equal(left.width, right.width);
        assert.equal(left.y, mark.y);
        assert.equal(left.height, mark.height);
        assert.ok(left.height >= (width < 1100 ? 44 : 36));
        await coven.focus(); await coven.press('Enter');
        assert.equal(await coven.getAttribute('aria-pressed'), 'true');
        assert.equal(await project.getAttribute('aria-pressed'), 'false');
        assert.equal((await project.boundingBox()).width, right.width);
        await project.click();
        assert.equal(await project.getAttribute('aria-pressed'), 'true');
        assert.match(await project.getAttribute('aria-label'), /psyche-build/);
      }
      await menu.focus();
      await page.keyboard.press('Enter');
      const ward = page.locator('#ward > summary');
      await ward.click();
      const panel = await page.locator('#wardBody').boundingBox();
      assert.ok(panel.x >= 0 && panel.x + panel.width <= width + 1 && panel.y > bounds.y);
      await page.keyboard.press('Escape');
      assert.ok(await ward.evaluate(el => document.activeElement === el));
      await page.keyboard.press('Escape');
      assert.ok(await menu.evaluate(el => document.activeElement === el && !el.parentElement.open));
      if (width < 1100) await page.locator('#atlasMobileView').click();
      const lock = page.locator('#atlasLock');
      await lock.click();
      assert.equal(await page.locator('#atlasZoomIn').isVisible(), false);
      assert.equal(await page.locator('#atlasFit').isVisible(), false);
      assert.ok(await lock.isVisible());
      await lock.click();
      assert.ok(await page.locator('#atlasZoomIn').isEnabled());
      assert.ok(await page.locator('#atlasFit').isVisible());
    } finally { await page.close(); }
  }
});

test('inspector actions open the brief and conversation and desktop title rows align', async () => {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const page = await browser.newPage({viewport: {width, height}, hasTouch: width < 500, reducedMotion: 'reduce'});
    try {
      await page.goto(new URL('#/project/psyche-build/mission/m-2?view=brief&detail=side', base).href);
      const actions = page.locator('.inspect-actions'), edit = actions.getByRole('button', {name: 'Edit brief', exact: true});
      const ask = actions.getByRole('button', {name: 'Ask Psyche', exact: true});
      await edit.waitFor();
      assert.deepEqual(await page.locator('.brief-heading').allTextContents(), ['Mission goalsCustom brief', 'Resource limits', 'Performance']);
      assert.ok(await page.locator('.brief-card .limit-state').count() > 0);
      if (width > 1100) {
        const scope = await page.locator('.atlas-nav').boundingBox();
        const browse = await page.locator('#atlasBrowse').boundingBox();
        assert.equal(scope.height, browse.height);
        assert.equal(scope.y, browse.y);
      }
      const a = await edit.boundingBox(), b = await ask.boundingBox();
      assert.equal(a.height, b.height);
      assert.ok(a.height >= (width < 500 ? 44 : 36));
      await edit.click();
      await page.locator('#empty').waitFor();
      assert.equal(await page.locator('#nmName').inputValue(), 'Source survey');
      assert.ok(await page.locator('#nmTitle').evaluate(el => document.activeElement === el));
      await page.locator('#emptyX').click();
      assert.ok(await edit.evaluate(el => document.activeElement === el));
      await ask.click();
      const say = page.locator('#say');
      assert.ok(await say.evaluate(el => el === document.activeElement));
      await say.press('Shift+Tab');
      const field = page.locator('#comp .field');
      const frame = () => field.evaluate(el => {
        const s = getComputedStyle(el);
        return [s.borderColor, s.boxShadow];
      });
      const buttonFrame = await frame();
      await page.keyboard.press('Tab');
      assert.ok(await say.evaluate(el => el.matches(':focus-visible') &&
        getComputedStyle(el).outlineStyle === 'none' &&
        getComputedStyle(el).borderBottomWidth === '2px' &&
        getComputedStyle(el).borderBottomColor !== 'rgba(0, 0, 0, 0)'));
      assert.deepEqual(await frame(), buttonFrame);
      await say.fill('Check this draft');
      await say.press('Tab');
      assert.ok(await page.evaluate(() => document.activeElement.matches('#comp button:focus-visible') &&
        getComputedStyle(document.activeElement).outlineStyle !== 'none'));
      if (width > 1100) {
        assert.ok(await page.locator('#app.docked').count(), 'Ask Psyche opens the dock by default');
        await page.getByRole('button', {name: 'Float Psyche as a chat window'}).click();
        await page.getByRole('button', {name: 'Dock Psyche as a side panel'}).click();
        const bar = await page.locator('#workspaceBar').boundingBox();
        const title = await page.locator('.psyche .p-h').boundingBox();
        assert.equal(bar.height, title.height);
        assert.equal(bar.y, title.y);
        await say.fill('Draft question');
        await page.locator('#tabProject').click();
        await ask.click();
        assert.equal(await say.inputValue(), 'Draft question');
        assert.ok(await say.evaluate(el => el === document.activeElement));
        await page.locator('#minBtn').click();
        await page.locator('#scrub').press('ArrowLeft');
        const history = actions.getByRole('button', {name: 'View chat'});
        await history.click();
        assert.equal(await say.isDisabled(), true);
        assert.ok(await page.locator('#tabChat').evaluate(el => document.activeElement === el));
      }
    } finally { await page.close(); }
  }
});

test('camera icons share the familiar key row on the workspace surface', async () => {
  for (const [width, height] of [[1440, 900], [320, 640], [844, 390]]) {
    const mobile = width < 1100;
    const page = await browser.newPage({viewport: {width, height}, hasTouch: mobile, reducedMotion: 'reduce'});
    try {
      await page.goto(new URL('#/project/psyche-build', base).href);
      if (mobile) await page.locator('#atlasMobileView').click();
      const dock = page.locator('#atlasCameraDock'), key = page.locator('#atlasFamiliars');
      const box = await dock.boundingBox(), legend = await key.boundingBox();
      assert.equal(box.y, legend.y);
      assert.equal(box.height, legend.height);
      assert.ok(legend.width >= 44 && legend.x + legend.width <= box.x && box.x + box.width <= width);
      const surfaces = await page.locator('#workspaceBar,#stage').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor));
      assert.equal(surfaces[0], surfaces[1]);
      for (const control of await dock.getByRole('button').all()) {
        assert.equal(await control.innerText(), '');
        assert.ok(await control.getAttribute('aria-label'));
        assert.ok(await control.getAttribute('title'));
      }
      assert.equal(await dock.getByRole('combobox').count(), 0);
      assert.equal(await dock.getByRole('button').count(), 5);
      const lock = dock.getByRole('button', {name: 'Lock the map'});
      await lock.click();
      assert.equal(await dock.getByRole('button').count(), 1);
      assert.ok(await dock.getByRole('button', {name: 'Unlock the map'}).isVisible());
      assert.equal((await dock.boundingBox()).height, (await key.boundingBox()).height);
    } finally { await page.close(); }
  }
});

test('map key topics fit desktop, tablet, phone and short landscape screens', async () => {
  for (const [width, height] of [[1440, 900], [768, 1024], [390, 844], [320, 568], [667, 320]]) {
    const page = await browser.newPage({viewport: {width, height}, reducedMotion: 'reduce'});
    try {
      await page.goto(new URL('#/project/coven-cave', base).href);
      await page.locator('#workspaceTools > summary').click();
      await page.locator('#keyBtn').click();
      const dialog = page.getByRole('dialog', {name: 'Map key'});
      const tabs = dialog.getByRole('tab');
      assert.equal(await tabs.count(), 5);
      await tabs.first().focus();
      await page.keyboard.press('End');
      assert.equal(await tabs.last().getAttribute('aria-selected'), 'true');
      await dialog.getByRole('button', {name: 'Larger text'}).click();
      for (const tab of await tabs.all()) {
        await tab.click();
        assert.equal(await tab.getAttribute('aria-selected'), 'true');
        const panel = dialog.getByRole('tabpanel');
        assert.equal(await panel.count(), 1);
        assert.equal(await panel.getAttribute('aria-labelledby'), await tab.getAttribute('id'));
        assert.ok(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
        const tabBox = await tab.boundingBox();
        assert.ok(tabBox.x >= 0 && tabBox.x + tabBox.width <= width && tabBox.height >= 44);
        const last = panel.locator('button:visible, .kz-r, .kz-k').last();
        await last.scrollIntoViewIfNeeded();
        const close = await dialog.getByRole('button', {name: 'Close', exact: true}).boundingBox();
        assert.ok(close.y >= 0 && close.y + close.height <= height);
      }
      await tabs.last().press('ArrowRight');
      assert.equal(await tabs.first().getAttribute('aria-selected'), 'true');
      await page.keyboard.press('Escape');
      await dialog.waitFor({state: 'hidden'});
    } finally {
      await page.close();
    }
  }
});

test('familiar card connector meets the painted group and stays attached on zoom', async () => {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}, reducedMotion: 'reduce'});
  try {
    await page.goto(new URL('#/project/psyche-build/mission/m-2?familiar=astra', base).href);
    const connector = page.locator('.seat-connector[data-seat="m-2/astra"]');
    await connector.locator('path').waitFor();
    const attached = () => page.waitForFunction(() => {
      const path = document.querySelector('.seat-connector[data-seat="m-2/astra"] path');
      const card = document.querySelector('.manifest .seat.on').getBoundingClientRect();
      const item = document.querySelector('.atlas-squad[data-m="m-2"][data-fam="astra"] .squad-plane rect').getBoundingClientRect();
      const matrix = path.getScreenCTM();
      const start = path.getPointAtLength(0).matrixTransform(matrix);
      const end = path.getPointAtLength(path.getTotalLength()).matrixTransform(matrix);
      return getComputedStyle(path).strokeWidth === '3px' && Math.abs(start.x - card.right) < 1 &&
        start.y > card.top && start.y < card.bottom && Math.abs(end.x - item.left) < 1 && Math.abs(end.y - (item.top + item.bottom) / 2) < 1;
    });
    await attached();
    const before = await connector.locator('path').getAttribute('d');
    await page.locator('#atlasZoomIn').click();
    await page.waitForFunction(old => document.querySelector('.seat-connector[data-seat="m-2/astra"] path').getAttribute('d') !== old, before);
    await attached();
  } finally { await page.close(); }
});

test('task areas follow replayed assignments, reservations and retirement', async () => {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}, reducedMotion: 'reduce'});
  try {
    await page.goto(new URL('#/project/psyche-build', base).href);
    await page.locator('#workspaceTools > summary').click();
    await page.locator('#traceBox > summary').click();
    await page.locator('#traceLoad > summary').click();
    const records = [];
    const add = (sec, type, properties) => records.push({t: 1800000000000 + sec * 1000, type, mission: 'sizing', familiar: 'astra', ...properties});
    add(0, 'mission.opened', {name: 'Layout'});
    add(0, 'council.seated');
    for (const task of ['A', 'B', 'Empty']) add(0, 'task.opened', {task, name: task});
    for (let i = 0; i < 5; i++) add(0, 'agent.spawned', {agent: 'agent-' + i, task: i < 3 ? 'A' : i === 3 ? 'B' : null});
    add(5, 'gate.requested', {ask: 'ask', gate: 'N', agents: ['agent-0']});
    add(60, 'agent.assigned', {agent: 'agent-2', task: 'B'});
    add(90, 'agent.retired', {agent: 'agent-4'});
    const chooser = page.waitForEvent('filechooser');
    await page.locator('#traceDrop').click();
    await (await chooser).setFiles({name:'sizing.jsonl', mimeType:'text/plain', buffer:Buffer.from(records.map(e => JSON.stringify(e)).join('\n'))});
    const squad = page.locator('.atlas-squad[data-m="sizing"][data-fam="astra"]');
    await squad.locator('.task-region').first().waitFor({state: 'attached'});
    const scrub = page.locator('#scrub');
    const verify = async (value, expected) => {
      await scrub.fill(value);
      const result = await squad.evaluate(el => {
        const floor = el.querySelector('.squad-plane > rect'), area = floor.width.baseVal.value * floor.height.baseVal.value;
        return [...el.querySelectorAll('.task-region')].map(tile => [tile.dataset.task, Number(tile.dataset.agents), tile.width.baseVal.value * tile.height.baseVal.value / area]);
      });
      const total = expected.reduce((sum, [, n]) => sum + n, 0);
      assert.deepEqual(result.map(([id, n]) => [id, n]), expected);
      for (const [, count, share] of result) assert.ok(Math.abs(count / total - share) < .00001);
      assert.equal(await squad.locator('.cell-ghost').count(), 1);
    };
    await verify('500', [['A', 3], ['B', 1], ['', 1]]);
    await verify('800', [['A', 2], ['B', 2], ['', 1]]);
    await verify('1000', [['A', 2], ['B', 2]]);
    await verify('500', [['A', 3], ['B', 1], ['', 1]]);
  } finally { await page.close(); }
});

test('agent popover keeps the selected task group visible and follows keyboard selection', async () => {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}, reducedMotion: 'reduce'});
  try {
    await page.goto(new URL('#/project/psyche-build/mission/m-3?familiar=cody', base).href);
    const group = page.locator('.atlas-squad[data-m="m-3"][data-fam="cody"]');
    const floor = group.locator('.squad-plane > rect');
    await floor.focus();
    await floor.press('Enter');
    const agent = group.locator('.agent[aria-label^="a-041"]');
    await agent.focus(); await agent.press('Enter');
    const pop = page.locator('#pop');
    await pop.getByRole('heading', {name: 'Type-checking'}).waitFor();
    assert.equal(await pop.locator('.agent-owner').innerText(), 'Led by Cody');
    assert.equal(await pop.locator('.id').innerText(), 'Agent a-041');
    assert.match(await pop.locator('.agent-status').innerText(), /Working\s+for /);
    const card = await pop.boundingBox(), plane = await floor.boundingBox();
    assert.ok(card.y >= plane.y + plane.height || plane.y >= card.y + card.height ||
      card.x >= plane.x + plane.width || plane.x >= card.x + card.width);
    const selected = group.locator('.agent.picked');
    assert.equal(await selected.count(), 1);
    const assertHalo = async () => {
      assert.equal(await selected.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
      assert.deepEqual(await selected.locator('.agent-halo').evaluate(el => {
        const style = getComputedStyle(el);
        return [el.localName, style.strokeWidth, style.strokeOpacity, style.vectorEffect, style.pointerEvents];
      }), ['circle', '1.5px', '1', 'non-scaling-stroke', 'none']);
      assert.equal(await selected.locator('.hot').evaluate(el => getComputedStyle(el).stroke), 'none');
    };
    await assertHalo();
    await pop.getByRole('button', {name: 'Close agent details'}).click();
    await pop.waitFor({state: 'hidden'});
    assert.ok(await agent.evaluate(el => el === document.activeElement));
    await agent.click();
    await pop.waitFor();
    await assertHalo();
  } finally { await page.close(); }
});

test('map keyboard focus uses a short accent and moves to the active item', async () => {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}, reducedMotion: 'reduce'});
  try {
    await page.goto(new URL('#/project/coven-cave/mission/m-1?view=tasks&detail=side', base).href);
    const stage = page.locator('#stage');
    await page.keyboard.press('Tab');
    await stage.focus();
    assert.ok(await stage.evaluate(el => {
      const cue = getComputedStyle(el, '::after');
      return el.matches(':focus-visible') && getComputedStyle(el).outlineStyle === 'none' &&
        cue.width === '36px' && cue.height === '2px' && cue.pointerEvents === 'none';
    }));
    await page.keyboard.press('Tab');
    assert.ok(await page.locator('#plan [data-map-item]:focus-visible').count());
    assert.equal(await stage.evaluate(el => getComputedStyle(el, '::after').content), 'none');
  } finally { await page.close(); }
});

test('overview preview labels match the native SVG scale at successive zoom levels', async () => {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const page = await browser.newPage({viewport: {width, height}, reducedMotion: 'reduce'});
    try {
      await page.goto(new URL('#/coven', base).href);
      const project = page.locator('.ghostfort[aria-label^="psyche-build,"]');
      await project.waitFor();
      const labels = project.locator('.preview-name');
      let measured = 0;
      for (let step = 0; step < 16 && measured < 3; step++) {
        // Anchor the wheel at the actual Project floor so the tile stays in view on narrow screens.
        await project.locator('.gfloor').evaluate(floor => {
          const rect = floor.getBoundingClientRect();
          floor.dispatchEvent(new WheelEvent('wheel', {bubbles: true, cancelable: true, ctrlKey: true, deltaY: -250, clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2}));
        });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        if (await project.getAttribute('data-preview-names') !== 'true') continue;
        const readings = await labels.evaluateAll(nodes => nodes.map(node => ({
          observed: parseFloat(node.style.fontSize),
          expected: Math.ceil(10 * Math.max(13 / 3, 10.5 / Math.max(node.getScreenCTM().a, .01))) / 10,
        })));
        assert.equal(readings.length, 4);
        for (const {observed, expected} of readings) assert.equal(observed, expected);
        measured++;
      }
      assert.equal(measured, 3, 'named previews measured at three zoom levels');
    } finally { await page.close(); }
  }
});

test('a narrow overview return fits the settled stage without rebuilding for the outgoing height', async () => {
  const page = await browser.newPage({viewport: {width: 390, height: 844}, reducedMotion: 'reduce', hasTouch: true});
  try {
    await page.goto(new URL('#/project/psyche-build', base).href);
    // Both scopes normally share a one-row header. Reserve a second Project row
    // to exercise an actual height change during the same scope transition.
    await page.addStyleTag({content: 'body[data-atlas-scope="project"] .plan-head:has(#atlasHeader) { min-height: 96px; }'});
    const map = page.locator('#atlasMobileMap');
    const tile = page.locator('.ghostfort[aria-label^="psyche-build,"]');
    await map.click();
    await page.waitForFunction(() => document.body.dataset.atlasScope === 'coven');
    await page.evaluate(async () => { for (let i = 0; i < 6; i++) await new Promise(requestAnimationFrame); });
    const overviewHeight = await page.locator('#stage').evaluate(el => el.clientHeight);
    const initialTile = await tile.boundingBox();
    await tile.tap();
    await page.locator('.mission-tasks').first().waitFor();
    await page.waitForFunction(height => document.body.dataset.atlasScope === 'project' && document.getElementById('stage').clientHeight < height, overviewHeight);
    const before = await page.locator('#stage').evaluate(el => el.clientHeight);
    await page.evaluate(() => {
      window.overviewBuilds = 0;
      const observer = new MutationObserver(changes => {
        for (const change of changes) for (const node of change.addedNodes) {
          if (node.nodeType === 1 && node.matches('.atlas-overview')) window.overviewBuilds++;
        }
      });
      observer.observe(document.getElementById('plan'), {childList: true});
    });
    await map.click();
    await tile.waitFor();
    const after = await page.evaluate(async () => {
      for (let i = 0; i < 6; i++) await new Promise(requestAnimationFrame);
      return {height: document.getElementById('stage').clientHeight, builds: window.overviewBuilds};
    });
    assert.ok(after.height > before, 'stage height should expand from ' + before + ' to the overview, observed ' + after.height);
    const returnedTile = await tile.boundingBox();
    for (const coordinate of ['x', 'y', 'width', 'height']) {
      assert.ok(Math.abs(returnedTile[coordinate] - initialTile[coordinate]) < 1, 'overview tile should return to its settled ' + coordinate);
    }
    assert.ok(after.builds <= 1, 'overview rebuilt ' + after.builds + ' times during one scope change');
  } finally { await page.close(); }
});

test('Psyche remembers rail and corner choices separately from the open panel', async () => {
  for (const [width, height] of [[1440, 900], [390, 844], [844, 390]]) {
    const mobile = width < 1100;
    const page = await browser.newPage({viewport: {width, height}, hasTouch: mobile, reducedMotion: 'reduce'});
    try {
      await page.goto(base);
      const launcher = page.getByRole('button', {name: 'Open Psyche', exact: true});
      const panel = page.locator('#psyche');
      await launcher.waitFor();
      const edge = await page.locator('.plan-body').boundingBox(), rail = await launcher.boundingBox();
      assert.equal(await launcher.getAttribute('data-placement'), 'rail');
      assert.ok(Math.abs(edge.x + edge.width - rail.x - rail.width) < 1, 'tab meets the right edge');
      assert.ok(await panel.isHidden());
      if (mobile) assert.ok(rail.width >= 44 && rail.height >= 44);
      await launcher.focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('#app.docked').count(), mobile ? 0 : 1);
      await page.locator('#say').fill('Keep this draft');
      await page.getByRole('button', {name: 'Minimize to corner'}).click();
      const corner = await launcher.boundingBox();
      assert.ok(corner.y > rail.y && corner.height < rail.height);
      assert.equal(await launcher.getAttribute('data-placement'), 'corner');
      assert.ok(await launcher.evaluate(el => el === document.activeElement));
      await launcher.click();
      assert.equal(await page.locator('#say').inputValue(), 'Keep this draft');
      await page.keyboard.press('Escape');
      assert.ok(await panel.isHidden());
      await page.reload();
      await launcher.waitFor();
      assert.equal(await launcher.getAttribute('data-placement'), 'corner');
      await launcher.click();
      await page.getByRole('button', {name: 'Collapse to rail'}).click();
      await page.reload(); await launcher.waitFor();
      assert.equal(await launcher.getAttribute('data-placement'), 'rail');
      if (mobile) {
        const activity = page.locator('#atlasMobileActivity');
        await activity.focus(); await page.keyboard.press('Enter');
        await page.keyboard.press('Escape');
        assert.ok(await activity.evaluate(el => el === document.activeElement), 'Escape returns to the opening control');
      } else {
        await launcher.click();
        await page.getByRole('button', {name: 'Float Psyche as a chat window'}).click();
        await page.getByRole('button', {name: 'Collapse to rail'}).click();
        await page.reload(); await launcher.click();
        assert.equal(await page.locator('#app.docked').count(), 0, 'floating preference survives closure');
        await page.getByRole('button', {name: 'Dock Psyche as a side panel'}).click();
        await page.setViewportSize({width: 390, height: 844});
        await page.locator('#app:not(.docked)').waitFor();
        await page.setViewportSize({width, height});
        await page.locator('#app.docked').waitFor();
      }
    } finally { await page.close(); }
  }
});

test('older Psyche settings keep a saved floating panel and its size', async () => {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}});
  try {
    await page.addInitScript(() => localStorage.setItem('coven-compass-psyche', JSON.stringify({mode: 'float', w: 460, fw: 430, fh: 580})));
    await page.goto(base);
    const panel = page.locator('#psyche');
    await panel.waitFor();
    assert.equal(await page.locator('#app.docked').count(), 0);
    await page.waitForFunction(() => Math.round(document.getElementById('psyche').getBoundingClientRect().width) === 430);
    await page.getByRole('button', {name: 'Collapse to rail'}).click();
    await page.locator('#launcher').click();
    assert.equal(await page.locator('#app.docked').count(), 0);
    await page.waitForFunction(() => Math.round(document.getElementById('psyche').getBoundingClientRect().width) === 430);
  } finally { await page.close(); }
});

test('Board cards captions and the Tasks target clear familiar badges and task groups across viewport changes', async () => {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}, reducedMotion: 'reduce'});
  const mission = page.locator('.atlas-mission-current[data-m="m-1"]');
  const caption = page.locator('#missionCaptions .mission-caption').filter({hasText: 'Board cards'});
  try {
    for (const [width, height] of [[1440, 900], [1024, 768], [390, 844], [844, 390], [320, 568]]) {
      await page.setViewportSize({width, height});
      await page.goto(new URL('#/project/coven-cave/mission/m-1?detail=card', base).href);
      await mission.waitFor();
      for (const deltaY of [0, -230, 330]) {
        const seal = await mission.locator('.se-face').boundingBox();
        if (deltaY) await page.locator('#plan').dispatchEvent('wheel', {ctrlKey: true, deltaY, clientX: seal.x + seal.width / 2, clientY: seal.y + seal.height / 2});
        await page.evaluate(async () => { for (let i = 0; i < 8; i++) await new Promise(requestAnimationFrame); });
        const fallback = await mission.evaluate(el => el.classList.contains('caption-in-list'));
        if (fallback) {
          assert.match(await caption.innerText(), /3 tasks/);
          continue;
        }
        const collisions = await mission.evaluate(group => {
          const controls = ['.lead-name', '.atlas-mission-state', '.task-tray-hit'].map(selector => group.querySelector(selector));
          const shapes = document.querySelectorAll('.atlas-project-detail .seat .familiar-disc, .squad-plane > rect');
          const result = [];
          for (const control of controls) {
            const a = control.getBoundingClientRect();
            if (!a.width || getComputedStyle(control).visibility === 'hidden') continue;
            for (const shape of shapes) {
              const b = shape.getBoundingClientRect();
              if (b.width && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) result.push(control.getAttribute('class'));
            }
          }
          return result;
        });
        assert.ok(await mission.locator('.task-tray-hit').isVisible());
        assert.deepEqual(collisions, [], width + '×' + height + ' wheel ' + deltaY);
      }
    }
  } finally { await page.close(); }
});

test('a crowded map transfers its Tasks action and keyboard focus to the caption list and back', async () => {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}, reducedMotion: 'reduce'});
  try {
    await page.goto(new URL('#/project/coven-cave/mission/m-1?detail=card', base).href);
    const tray = page.locator('.atlas-mission-current .mission-tasks');
    const caption = page.locator('#missionCaptions .mission-caption').filter({hasText: 'Board cards'});
    await tray.focus();
    // Cover the available label space using a measured toolbar, independently of the sample's geometry.
    const coverMap = () => page.addStyleTag({content: '#atlasCameraDock {position:fixed!important; inset:0!important; width:auto!important; height:auto!important; pointer-events:none}'});
    const redraw = () => page.evaluate(() => window.dispatchEvent(new Event('resize')));
    const cover = await coverMap();
    await redraw();
    await caption.waitFor();
    assert.match(await caption.innerText(), /3 tasks/);
    assert.ok(await caption.evaluate(el => el === document.activeElement));
    await cover.evaluate(el => el.remove());
    await redraw();
    await tray.waitFor();
    assert.ok(await tray.evaluate(el => el === document.activeElement));
    await coverMap();
    await redraw();
    await caption.waitFor();
    await page.keyboard.press('Enter');
    await page.locator('#inspect [role="tab"][aria-selected="true"]').filter({hasText: 'Tasks'}).waitFor();
  } finally { await page.close(); }
});

for (const [width, height] of [[1440, 900], [390, 844]]) {
  test(`mission formation on Project and Coven maps at ${width}×${height}`, async () => {
    const page = await browser.newPage({viewport: {width, height}, reducedMotion: 'reduce', hasTouch: width < 500});
    try {
      const grid = page.getByRole('button', {name: 'Mission grid'});
      const showControls = async () => {
        if (!(await grid.isVisible())) await page.locator('#atlasMobileView').click();
      };
      await page.goto(new URL('#/project/psyche-build', base).href);
      await showControls();
      const missions = page.locator('.atlas-project-detail .lead-node');
      const positions = async (marks = missions) => {
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        return marks.evaluateAll(nodes => nodes.map(n => n.getAttribute('transform')));
      };
      await missions.first().waitFor();
      const ring = await positions();
      await grid.focus();
      await grid.press('Space');
      assert.equal(await grid.getAttribute('aria-pressed'), 'true');
      assert.notDeepEqual(await positions(), ring);
      assert.equal(await missions.count(), ring.length);
      const layout = await positions();
      await page.locator('#scrub').fill('0');
      await page.locator('#scrub').fill('1000');
      await missions.first().waitFor();
      assert.deepEqual(await positions(), layout);
      await page.reload();
      await showControls();
      assert.equal(await grid.getAttribute('aria-pressed'), 'true');
      assert.deepEqual(await positions(), layout);
      if (width > 500) {
        await page.goto(new URL('#/project/psyche-build/mission/m-3?view=tasks&detail=side', base).href);
        const title = page.locator('#missionDetailTitle');
        const name = await title.innerText(), route = page.url();
        await grid.click();
        assert.equal(await title.innerText(), name);
        assert.equal(await page.locator('#mission-tab-tasks').getAttribute('aria-selected'), 'true');
        assert.equal(page.url(), route);
        assert.deepEqual(await positions(), ring);
        const seal = await page.locator('.lead-node.sel .se-face').boundingBox();
        const inspector = await page.locator('#inspect').boundingBox();
        assert.ok(seal.x >= inspector.x + inspector.width && seal.x + seal.width <= width);
        await grid.click();
      }
      await page.locator(width < 500 ? '#atlasMobileMap' : '#atlasOverview').click();
      await showControls();
      const project = page.locator('.ghostfort[aria-label^="psyche-build,"]');
      const preview = project.locator('.preview-mission');
      await preview.first().waitFor();
      const gridPreview = await positions(preview);
      await grid.click();
      assert.notDeepEqual(await positions(preview), gridPreview);
      await project.focus();
      await project.press('Enter');
      await missions.first().waitFor();
      assert.deepEqual(await positions(), ring);
      await page.locator(width < 500 ? '#atlasMobileMap' : '#atlasOverview').click();
      await showControls();
      await grid.click();
      const other = page.locator('.ghostfort[aria-label^="coven-cave,"]');
      await other.focus();
      await other.press('Enter');
      await missions.first().waitFor();
      assert.deepEqual(await positions(), ['translate(0.0,-320.0)', 'translate(0.0,320.0)']);
    } finally { await page.close(); }
  });
}

for (const [width, height] of [[1440, 900], [390, 844], [844, 390]]) {
  test(`review drawers at ${width}×${height}`, async () => {
    const mobile = width < 1100;
    const page = await browser.newPage({viewport: {width, height}, reducedMotion: 'reduce', hasTouch: mobile});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(new URL('#/project/psyche-build', base).href);
      await page.locator('#atlasBrowse').click();
      const search = page.locator('#atlasProjectSearch');
      const results = page.locator('#atlasProjects button:visible');
      await search.fill('config refactor'); // Outside the default two-mission preview.
      assert.equal(await results.count(), 1);
      assert.equal(await results.locator('.atlas-project-preview-names').innerText(), 'Config refactor');
      assert.match(await results.getAttribute('aria-label'), /Matching mission: Config refactor/);
      assert.equal(await page.locator('#atlasProjectCount').innerText(), '1 of 4 Projects');
      await search.press('ArrowDown');
      assert.ok(await results.evaluate(row => row === document.activeElement));
      await search.fill('unmatched name');
      assert.ok(await page.locator('#atlasProjectEmpty').isVisible());
      await page.locator('#atlasProjectClear').click();
      assert.ok(await search.evaluate(input => input === document.activeElement));
      assert.equal(await results.count(), 4);
      await search.press('ArrowDown');
      await page.keyboard.press('End');
      assert.ok(await results.last().evaluate(row => row === document.activeElement));
      await page.keyboard.press('Home');
      assert.ok(await results.first().evaluate(row => row === document.activeElement));
      await page.locator('#atlasNewProject').click();
      await page.locator('#projectForm').waitFor();
      await page.locator('#czX').click();

      await page.locator(mobile ? '#atlasMobileMissions' : '#atlasMissions').click();
      const missionSearch = page.locator('#atlasMissionSearch');
      const missions = page.locator('#atlasMissionList button:visible');
      await missionSearch.fill('unmatched name');
      assert.match(await page.locator('#atlasMissionEmpty').innerText(), /No matching missions/);
      await missionSearch.fill('cody readiness');
      assert.equal(await missions.count(), 1);
      assert.match(await missions.getAttribute('aria-label'), /Review readiness.*2 pending requests/);
      assert.equal(await page.locator('#atlasMissionCount').innerText(), '1 of 4 missions in psyche-build');
      const reset = page.locator('#atlasMissionReset');
      const action = await reset.boundingBox(), result = await missions.boundingBox();
      assert.ok(action.y + action.height <= result.y);
      if (mobile) assert.ok(action.height >= 44);
      await reset.click();
      assert.ok(await missionSearch.evaluate(input => input === document.activeElement));
      await page.locator('#atlasMissionProject').selectOption('brand');
      assert.match(await page.locator('#atlasMissionEmpty').innerText(), /Project has no missions/);
      await page.locator('#atlasMissionProject').selectOption('psyche-build');
      await page.locator('#atlasMissionState').selectOption('requests');
      assert.equal(await missions.count(), 2);
      assert.equal(await missions.locator('.atlas-pending:visible').count(), 2);
      await missions.first().click();
      await page.locator('#inspect .target-met').first().waitFor();
      assert.match(await page.locator('#inspect .limit-state').first().innerText(), /Near limit · 96%/);
      assert.ok(await page.getByRole('group', {name: 'Mission 1 of 2', exact: true}).isVisible());
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}
