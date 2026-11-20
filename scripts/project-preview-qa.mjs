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
    assert.match(await row.locator('.atlas-mission-meta').innerText(), /Needs you · 1/);
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
    const otherName = await page.locator('.atlas-squad.dim .squad-plane:visible rect').first().getAttribute('aria-label');
    const other = page.getByRole('button', {name: otherName, exact: true});
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
      assert.equal(await details.locator('h3').innerText(), 'Agent ' + id);
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
      assert.ok(await page.getByRole('combobox', {name: 'Psyche marker'}).isVisible());
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
        await page.locator('#dockBtn').click();
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
      const picker = dock.getByRole('combobox', {name: 'Psyche marker'});
      await picker.selectOption('point');
      assert.match(await picker.getAttribute('title'), /Point/);
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
