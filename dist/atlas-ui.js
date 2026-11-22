(function () {
  'use strict';
  var api, lastSignature = '', projectNodes = new Map(), familiarNodes = new Map(), missionNodes = new Map();
  var missionBrowserUsed = false, missionQuery = '', missionProject = '', missionState = '', missionScroll = 0, projectQuery = '';
  var $ = function (id) { return document.getElementById(id); };
  function node(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }
  function button(id, text, fn, cls) {
    var b = node('button', cls || 'atlas-button', text);
    b.type = 'button'; if (id) b.id = id;
    b.addEventListener('click', fn); return b;
  }
  function shield(el) {
    ['pointerdown', 'pointerup', 'click', 'dblclick', 'wheel', 'touchstart', 'touchend', 'keydown'].forEach(function (type) {
      el.addEventListener(type, function (ev) { ev.stopPropagation(); });
    });
  }
  function closeBrowse(restoreFocus) {
    var drawer = $('atlasSidebar');
    if (!drawer || drawer.hidden) return;
    drawer.hidden = true;
    if (window.CovenMobileUI) window.CovenMobileUI.sync();
    document.body.classList.remove('atlas-browse-open');
    $('atlasBrowse').setAttribute('aria-expanded', 'false');
    if (restoreFocus) $('atlasBrowse').focus({ preventScroll: true });
  }
  function openBrowse() {
    closeMissions(false);
    var drawer = $('atlasSidebar');
    drawer.hidden = false;
    if (window.CovenMobileUI) window.CovenMobileUI.activate('atlasSidebar');
    document.body.classList.add('atlas-browse-open');
    $('atlasBrowse').setAttribute('aria-expanded', 'true');
    var first = drawer.querySelector('.atlas-project[data-active="true"]') || drawer.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  }
  // #atlasNavigationStatus is the only live region. With {visible: true} the same
  // message is also shown in #atlasNavigationNotice, which is deliberately not a
  // live region, so a screen reader announces it once (#45).
  var noticeTimer = 0, NOTICE_MS = 10000;
  function announce(message, options) {
    var status = $('atlasNavigationStatus');
    if (status && status.textContent !== message) status.textContent = message;
    if (options && options.visible) showNotice(message);
  }
  function showNotice(message) {
    var notice = $('atlasNavigationNotice');
    if (!notice) return;
    $('atlasNavigationNoticeText').textContent = message;
    notice.hidden = false;
    scheduleNoticeDismissal();
  }
  function scheduleNoticeDismissal() {
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(function () { dismissNotice(); }, NOTICE_MS);
  }
  function dismissNotice() {
    clearTimeout(noticeTimer); noticeTimer = 0;
    var notice = $('atlasNavigationNotice');
    if (!notice || notice.hidden) return;
    var hadFocus = notice.contains(document.activeElement);
    notice.hidden = true;
    if (hadFocus) {
      var next = Array.prototype.find.call(document.querySelectorAll('#atlasHeader button'), function (b) { return b.getClientRects().length; });
      if (next) next.focus({ preventScroll: true });
    }
  }
  function buildNotice() {
    var notice = node('div', 'atlas-notice'); notice.id = 'atlasNavigationNotice'; notice.hidden = true;
    var text = node('p'); text.id = 'atlasNavigationNoticeText';
    var dismiss = button('atlasNavigationNoticeDismiss', '×', function () { dismissNotice(); });
    dismiss.setAttribute('aria-label', 'Dismiss this notice'); dismiss.title = 'Dismiss';
    notice.append(text, dismiss);
    // Reading or reaching the notice pauses its timer; leaving it restarts the timer.
    notice.addEventListener('pointerenter', function () { clearTimeout(noticeTimer); });
    notice.addEventListener('focusin', function () { clearTimeout(noticeTimer); });
    notice.addEventListener('pointerleave', function () { if (!notice.hidden && !notice.contains(document.activeElement)) scheduleNoticeDismissal(); });
    notice.addEventListener('focusout', function (ev) { if (!notice.hidden && !notice.contains(ev.relatedTarget)) scheduleNoticeDismissal(); });
    notice.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ev.preventDefault(); dismissNotice(); } });
    shield(notice);
    return notice;
  }
  function closeMissions(restoreFocus) {
    var drawer = $('atlasMissionBrowser');
    if (!drawer || drawer.hidden) return;
    missionScroll = $('atlasMissionList').scrollTop;
    drawer.hidden = true;
    setMissionModal(false);
    $('atlasMissions').setAttribute('aria-expanded', 'false');
    if (restoreFocus) {
      var mobileEntry = $('atlasMobileMissions');
      (mobileEntry && mobileEntry.getClientRects().length ? mobileEntry : $('atlasMissions')).focus({ preventScroll: true });
    }
  }
  function setMissionModal(on) {
    if (!window.CovenMobileUI) return;
    if (on) window.CovenMobileUI.activate('atlasMissionBrowser'); else window.CovenMobileUI.sync();
  }
  function openMissions(restoreSelection, returnRow) {
    closeBrowse(false);
    var s = api.snapshot(true);
    if (!missionBrowserUsed) {
      missionProject = s.scope === 'coven' ? '' : s.active;
      missionBrowserUsed = true;
    }
    var drawer = $('atlasMissionBrowser');
    drawer.hidden = false;
    setMissionModal(window.matchMedia('(max-width: 1100px), (pointer: coarse)').matches);
    $('atlasMissions').setAttribute('aria-expanded', 'true');
    updateMissions(s);
    $('atlasMissionList').scrollTop = missionScroll;
    var selected = restoreSelection && drawer.querySelector('.atlas-mission-row[aria-current="true"]:not([hidden])');
    (returnRow && drawer.contains(returnRow) && !returnRow.hidden ? returnRow : selected || $('atlasMissionSearch')).focus({ preventScroll: true });
  }
  function updateMissions(s) {
    var filter = $('atlasMissionProject'), items = s.missionItems || [];
    if (!filter) return;
    var keys = JSON.stringify(s.projects.map(function (p) { return p.key; }));
    if (filter.dataset.keys !== keys) {
      filter.dataset.keys = keys;
      filter.textContent = '';
      var all = node('option', '', 'All Projects'); all.value = ''; filter.append(all);
      s.projects.forEach(function (p) { var option = node('option', '', p.key); option.value = p.key; filter.append(option); });
      if (missionProject && !s.projects.some(function (p) { return p.key === missionProject; })) missionProject = '';
    }
    filter.value = missionProject;
    $('atlasMissionState').value = missionState;
    var needle = missionQuery.trim().toLocaleLowerCase(), shown = 0, present = new Set();
    items.forEach(function (m) {
      var key = JSON.stringify([m.project, m.id]), row = missionNodes.get(key);
      present.add(key);
      if (!row) {
        row = button('', '', function () {
          closeMissions(false);
          if (!api.openMission(m.project, m.id, 'side', row)) {
            announce('That mission is no longer available. Choose another mission.');
            openMissions(false);
          }
        }, 'atlas-mission-row');
        row.dataset.project = m.project; row.dataset.mission = m.id;
        var emblem = node('span', 'atlas-mission-seal'); emblem.setAttribute('aria-hidden', 'true');
        var copy = node('span', 'atlas-mission-copy');
        var heading = node('span', 'atlas-mission-heading');
        heading.append(node('b', 'atlas-mission-title'), node('span', 'atlas-mission-meta'));
        copy.append(heading, node('span', 'atlas-mission-project'), node('span', 'atlas-mission-stats'));
        row.append(emblem, copy);
        $('atlasMissionList').append(row); missionNodes.set(key, row);
      }
      var match = (!missionProject || missionProject === m.project) && (!missionState || missionState === m.state) &&
        (!needle || [m.name, m.project, m.council].join(' ').toLocaleLowerCase().includes(needle));
      row.hidden = !match; if (match) shown++;
      row.dataset.state = m.state;
      row.setAttribute('aria-current', String(s.active === m.project && s.missionId === m.id));
      row.setAttribute('aria-label', m.name + ', ' + m.project + ', ' + m.stateLabel + ', ' + m.agents + ' agents' + (m.needs ? ', ' + m.needs + ' pending' : '') + '. Open mission details');
      api.setMissionName(row.querySelector('.atlas-mission-title'), m.name);
      var projectName = row.querySelector('.atlas-mission-project');
      projectName.textContent = m.project; projectName.hidden = !!missionProject;
      row.querySelector('.atlas-mission-meta').textContent = m.stateLabel + (m.needs ? ' · ' + m.needs : '');
      row.querySelector('.atlas-mission-stats').textContent = m.agents + (m.agents === 1 ? ' agent' : ' agents') + (m.council ? ' · ' + m.council : '');
      var emblem = row.querySelector('.atlas-mission-seal');
      if (emblem.dataset.seal !== m.seal) { emblem.dataset.seal = m.seal; emblem.innerHTML = m.seal; }
    });
    missionNodes.forEach(function (row, key) {
      if (!present.has(key)) {
        var focused = row.contains(document.activeElement);
        row.remove(); missionNodes.delete(key);
        if (focused && !$('atlasMissionBrowser').hidden) $('atlasMissionSearch').focus({ preventScroll: true });
      }
    });
    var count = shown + (shown === 1 ? ' mission' : ' missions') + (missionProject ? ' in ' + missionProject : ' across all Projects');
    if ($('atlasMissionCount').textContent !== count) $('atlasMissionCount').textContent = count;
    $('atlasMissionEmpty').hidden = shown > 0;
    $('atlasMissionEmpty').textContent = items.length ? 'No missions match these filters. Clear them to explore all missions.' : 'No missions at this replay position. Move forward in the timeline to explore them.';
    $('atlasMissionReset').hidden = !missionQuery && !missionProject && !missionState;
  }
  function openMissionsForProject(key) {
    missionProject = key; missionBrowserUsed = true; missionQuery = missionState = ''; missionScroll = 0;
    $('atlasMissionSearch').value = '';
    openMissions(false);
  }
  function filterProjects() {
    var needle = projectQuery.trim().toLocaleLowerCase(), count = 0;
    projectNodes.forEach(function (button, key) { button.hidden = !!needle && !key.toLocaleLowerCase().includes(needle); if (!button.hidden) count++; });
    var status = $('atlasProjectCount');
    if (status) status.textContent = count + (count === 1 ? ' Project' : ' Projects') + (needle ? ' found' : ' in this Coven');
  }
  var projectIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 5v15h6v-5a3 3 0 0 1 6 0v5h6V5h-4v4h-3V5h-4v4H7V5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
  function headerAction(control, label, drawing) {
    control.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + drawing + '</svg>';
    control.append(node('span', '', label));
    return control;
  }
  function mount(client) {
    if (api) return;
    api = client;
    document.body.classList.add('atlas-enhanced');
    document.body.dataset.atlasScope = 'coven';
    document.body.classList.remove('atlas-browse-open');
    var stage = $('stage');
    var head = node('header', 'atlas-header'); head.id = 'atlasHeader';
    var brand = node('div', 'atlas-brand');
    brand.innerHTML = '<svg viewBox="0 0 2048 1889" aria-hidden="true"><use href="#crown" width="2048" height="1889"/></svg>';
    brand.title = 'Compass';
    brand.setAttribute('role', 'img'); brand.setAttribute('aria-label', 'Compass');
    var nav = node('nav', 'atlas-nav'); nav.setAttribute('aria-label', 'Workspace scope');
    nav.append(
      button('atlasOverview', 'Coven', function () { closeBrowse(false); closeMissions(false); api.overview(); }),
      button('atlasProject', 'Project', function () { closeBrowse(false); closeMissions(false); api.openProject(api.snapshot().active); })
    );
    var browse = headerAction(button('atlasBrowse', '', function () {
      if ($('atlasSidebar').hidden) openBrowse(); else closeBrowse(false);
    }), 'Projects', '<path d="M3 4v13h5v-4a2 2 0 0 1 4 0v4h5V4h-3v3h-3V4H9v3H6V4Z"/>');
    browse.setAttribute('aria-expanded', 'false'); browse.setAttribute('aria-controls', 'atlasSidebar');
    browse.title = 'Browse Projects'; browse.setAttribute('aria-label', 'Browse Projects');
    var missions = headerAction(button('atlasMissions', '', function () {
      if ($('atlasMissionBrowser').hidden) openMissions(false); else closeMissions(false);
    }), 'Missions', '<circle cx="10" cy="6" r="3"/><circle cx="6" cy="13.5" r="3"/><circle cx="14" cy="13.5" r="3"/>');
    missions.setAttribute('aria-expanded', 'false'); missions.setAttribute('aria-controls', 'atlasMissionBrowser');
    missions.title = 'Find a mission and explore its details';
    var lab = headerAction(button('atlasLab', '', function () {
      closeBrowse(false); closeMissions(false);
      if (window.CovenSealLab) window.CovenSealLab.open(lab);
    }), 'Seal lab', '<circle cx="10" cy="10" r="7"/><circle cx="10" cy="10" r="2" fill="currentColor" stroke="none"/><path d="M10 3v5 M12 11l4 2.5 M8 11l-4 2.5"/>');
    lab.title = 'Explore the mission seals'; lab.setAttribute('aria-label', 'Open the seal lab');
    lab.setAttribute('aria-haspopup', 'dialog');
    var actions = node('div', 'atlas-actions'); actions.append(browse, missions, lab);
    head.append(brand, nav, actions); shield(head);

    var aside = node('aside', 'atlas-sidebar'); aside.id = 'atlasSidebar'; aside.hidden = true;
    aside.setAttribute('aria-labelledby', 'atlasProjectsTitle');
    var heading = node('div', 'atlas-drawer-heading');
    var title = node('h2', '', 'Projects'); title.id = 'atlasProjectsTitle';
    var close = button('atlasBrowseClose', '×', function () { closeBrowse(true); });
    close.setAttribute('aria-label', 'Close the Project browser');
    heading.append(title, close);
    var projectSearchLabel = node('label', 'atlas-project-search', 'Find a Project'), projectSearch = node('input');
    projectSearch.id = 'atlasProjectSearch'; projectSearch.type = 'search'; projectSearch.placeholder = 'Project name'; projectSearch.autocomplete = 'off';
    projectSearchLabel.append(projectSearch);
    projectSearch.addEventListener('input', function () { projectQuery = projectSearch.value; filterProjects(); });
    var projectCount = node('p', 'atlas-project-count'); projectCount.id = 'atlasProjectCount'; projectCount.setAttribute('role', 'status');
    var projects = node('div'); projects.id = 'atlasProjects';
    var newProject = button('atlasNewProject', '+ New Project', function () { closeBrowse(false); api.newProject(); });
    var simulation = node('details', 'atlas-layout-simulation'), simulationTitle = node('summary', '', 'Try a larger Coven');
    var presets = node('div', 'atlas-layout-presets');
    var custom = node('form', 'atlas-layout-custom'), label = node('label', '', 'Total Projects');
    var total = node('input'), apply = node('button', 'atlas-button', 'Set total');
    total.id = 'atlasCustomCount'; total.type = 'number'; total.min = '1'; total.step = '1'; total.required = true;
    total.addEventListener('input', function () { total.setCustomValidity(''); });
    label.htmlFor = total.id; apply.type = 'submit'; custom.append(label, total, apply);
    var progress = node('p'); progress.id = 'atlasLayoutStatus'; progress.setAttribute('role', 'status');
    async function populate(count) {
      progress.textContent = count ? 'Preparing a Coven with ' + count + ' Projects…' : 'Removing extra samples…';
      try {
        if (await api.setProjectCount(count)) { progress.textContent = ''; closeBrowse(true); }
      } catch (error) {
        progress.textContent = 'Could not finish preparing the sample Projects. ' + error.message;
      }
    }
    custom.addEventListener('submit', function (event) {
      event.preventDefault();
      var count = total.valueAsNumber;
      if (!Number.isSafeInteger(count) || count < 1) { total.setCustomValidity('Enter a positive whole number within the safe integer range.'); total.reportValidity(); return; }
      populate(count);
    });
    [8, 16, 32, 64, 128].forEach(function (count) {
      var preset = button('', String(count), function () { populate(count); });
      preset.setAttribute('aria-label', 'Simulate a Coven with ' + count + ' Projects'); presets.append(preset);
    });
    var reset = button('atlasResetLayout', 'Remove extra samples', function () { populate(0); });
    simulation.append(simulationTitle, node('p', '', 'Adds sample Projects to explore the layout. Your own projects stay intact.'), presets, custom, reset, progress);
    var legend = button('atlasLegend', 'Legend', function () { closeBrowse(true); api.legend(); });
    legend.title = 'Read the shapes, colors, and mission states';
    aside.append(heading, projectSearchLabel, projectCount, projects, newProject, simulation, legend);
    aside.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); closeBrowse(true); }
    });
    shield(aside);

    var missionBrowser = node('aside', 'atlas-mission-browser'); missionBrowser.id = 'atlasMissionBrowser'; missionBrowser.hidden = true;
    missionBrowser.setAttribute('aria-labelledby', 'atlasMissionsTitle');
    var missionHeading = node('div', 'atlas-drawer-heading'), missionTitle = node('h2', '', 'Missions'); missionTitle.id = 'atlasMissionsTitle';
    var missionClose = button('atlasMissionClose', '×', function () { closeMissions(true); });
    missionClose.setAttribute('aria-label', 'Close the mission browser'); missionHeading.append(missionTitle, missionClose);
    var missionTools = node('div', 'atlas-mission-tools');
    var searchLabel = node('label', '', 'Find a mission'), search = node('input'); search.id = 'atlasMissionSearch';
    search.type = 'search'; search.placeholder = 'Mission, Project, or familiar'; search.autocomplete = 'off';
    searchLabel.append(search);
    search.addEventListener('input', function () { missionQuery = search.value; missionScroll = 0; updateMissions(api.snapshot()); $('atlasMissionList').scrollTop = 0; });
    var projectSelectLabel = node('label', '', 'Project'), projectSelect = node('select'); projectSelect.id = 'atlasMissionProject'; projectSelectLabel.append(projectSelect);
    var stateLabel = node('label', '', 'State'), stateSelect = node('select'); stateSelect.id = 'atlasMissionState'; stateLabel.append(stateSelect);
    [['', 'All states'], ['needsYou', 'Needs you'], ['active', 'Active'], ['planned', 'Planned'], ['stalled', 'Stalled'], ['sealed', 'Sealed'], ['broken', 'Broken']].forEach(function (entry) {
      var option = node('option', '', entry[1]); option.value = entry[0]; stateSelect.append(option);
    });
    projectSelect.addEventListener('change', function () { missionProject = projectSelect.value; missionScroll = 0; updateMissions(api.snapshot()); $('atlasMissionList').scrollTop = 0; });
    stateSelect.addEventListener('change', function () { missionState = stateSelect.value; missionScroll = 0; updateMissions(api.snapshot()); $('atlasMissionList').scrollTop = 0; });
    missionTools.append(searchLabel, projectSelectLabel, stateLabel);
    var missionCount = node('p'); missionCount.id = 'atlasMissionCount'; missionCount.setAttribute('role', 'status'); missionCount.setAttribute('aria-live', 'polite');
    var missionList = node('div'); missionList.id = 'atlasMissionList'; missionList.setAttribute('role', 'group'); missionList.setAttribute('aria-label', 'Matching missions');
    var missionEmpty = node('p', 'atlas-mission-empty'); missionEmpty.id = 'atlasMissionEmpty'; missionEmpty.hidden = true;
    var missionReset = button('atlasMissionReset', 'Clear filters', function () {
      missionQuery = missionProject = missionState = ''; search.value = ''; missionScroll = 0;
      updateMissions(api.snapshot()); $('atlasMissionList').scrollTop = 0; search.focus({ preventScroll: true });
    });
    missionBrowser.append(missionHeading, missionTools, missionCount, missionList, missionEmpty, missionReset);
    var searchComposing = false;
    search.addEventListener('compositionstart', function () { searchComposing = true; });
    search.addEventListener('compositionend', function () { searchComposing = false; });
    missionBrowser.addEventListener('keydown', function (ev) {
      if (searchComposing || ev.isComposing || ev.keyCode === 229) return;
      if (ev.key === 'Escape') { ev.preventDefault(); closeMissions(true); return; }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(ev.key)) return;
      var rows = Array.from(missionList.querySelectorAll('button:not([hidden])'));
      var at = rows.indexOf(document.activeElement);
      if (!rows.length || (at < 0 && document.activeElement !== search)) return;
      if (document.activeElement === search && ev.key !== 'ArrowDown') return;
      ev.preventDefault();
      var next = ev.key === 'Home' ? 0 : ev.key === 'End' ? rows.length - 1 : at < 0 ? 0 : (at + (ev.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
      rows[next].focus();
    });
    shield(missionBrowser);
    var navigationStatus = node('span', 'sr-only'); navigationStatus.id = 'atlasNavigationStatus';
    navigationStatus.setAttribute('role', 'status'); navigationStatus.setAttribute('aria-live', 'polite');

    var familiars = node('div', 'atlas-familiar-chips'); familiars.id = 'atlasFamiliars';
    familiars.setAttribute('role', 'group'); familiars.setAttribute('aria-label', 'Filter by familiar');
    familiars.addEventListener('keydown', function (ev) {
      var buttons = Array.from(familiars.querySelectorAll('button'));
      var at = buttons.indexOf(document.activeElement), next;
      if (at < 0 || !buttons.length) return;
      if (ev.key === 'ArrowRight') next = (at + 1) % buttons.length;
      else if (ev.key === 'ArrowLeft') next = (at + buttons.length - 1) % buttons.length;
      else if (ev.key === 'Home') next = 0;
      else if (ev.key === 'End') next = buttons.length - 1;
      if (next != null) { ev.preventDefault(); buttons[next].focus({ preventScroll: true }); }
    });
    shield(familiars);
    var cameraDock = node('div', 'atlas-camera-dock'); cameraDock.id = 'atlasCameraDock';
    cameraDock.setAttribute('role', 'toolbar'); cameraDock.setAttribute('aria-label', 'Map controls');
    [
      ['atlasZoomOut', 'out', 'Zoom out', '<path d="M3 8h10"/>'],
      ['atlasZoomIn', 'in', 'Zoom in', '<path d="M3 8h10M8 3v10"/>'],
      ['atlasFit', 'fit', 'Fit view', '<path d="M2 6V2h4m4 0h4v4m0 4v4h-4m-4 0H2v-4"/><circle cx="8" cy="8" r="1.5"/>'],
      ['atlasFormation', 'formation', 'Mission grid', '<rect x="2" y="2" width="4.5" height="4.5" rx="1"/><rect x="9.5" y="2" width="4.5" height="4.5" rx="1"/><rect x="2" y="9.5" width="4.5" height="4.5" rx="1"/><rect x="9.5" y="9.5" width="4.5" height="4.5" rx="1"/>'],
      ['atlasLock', 'lock', 'Lock the map', '<rect x="3" y="7" width="10" height="7" rx="1.5"/><path class="lock-closed" d="M5 7V5a3 3 0 0 1 6 0v2"/><path class="lock-open" d="M5 7V5a3 3 0 0 1 5.7-1.3"/>']
    ].forEach(function (item) {
      var control = button(item[0], '', function () { api.camera(item[1]); });
      control.innerHTML = '<svg aria-hidden="true" viewBox="0 0 16 16">' + item[3] + '</svg>';
      control.setAttribute('aria-label', item[2]); control.title = item[2]; cameraDock.append(control);
    });
    shield(cameraDock);
    var bar = $('workspaceBar'), tools = $('workspaceTools'), toolsButton = tools.firstElementChild;
    bar.insertBefore(head, bar.firstChild);
    tools.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape' || !tools.open) return;
      var pill = tools.querySelector('.pill[open]');
      if (pill) { pill.open = false; pill.querySelector('summary').focus(); }
      else { tools.open = false; toolsButton.focus(); }
      ev.stopPropagation(); ev.preventDefault();
    });
    tools.addEventListener('toggle', function () {
      if (!tools.open) tools.querySelectorAll('.pill[open]').forEach(function (pill) { pill.open = false; });
    });
    document.addEventListener('pointerdown', function (ev) {
      if (tools.open && !tools.contains(ev.target)) tools.open = false;
    }, true);
    document.addEventListener('focusin', function (ev) {
      if (tools.open && !tools.contains(ev.target)) tools.open = false;
    });
    var footer = node('div', 'atlas-map-footer');
    footer.append(familiars, cameraDock);
    stage.append(buildNotice(), aside, missionBrowser, footer, navigationStatus);
    document.addEventListener('pointerdown', function (ev) {
      if (!aside.hidden && !aside.contains(ev.target) && !browse.contains(ev.target)) closeBrowse(false);
      if (!missionBrowser.hidden && !missionBrowser.contains(ev.target) && !missions.contains(ev.target)) closeMissions(false);
    });
    document.addEventListener('focusin', function (ev) {
      // Mobile focus belongs to the shared sheet manager. Reparenting a sheet
      // during a display change must not be interpreted as dismissing it.
      if (window.matchMedia('(max-width: 1100px), (pointer: coarse)').matches) return;
      if (!aside.hidden && !aside.contains(ev.target) && ev.target !== browse) closeBrowse(false);
      if (!missionBrowser.hidden && !missionBrowser.contains(ev.target) && ev.target !== missions) closeMissions(false);
    });
    update(true);
  }
  function update(force) {
    if (!api) return;
    var s = api.snapshot();
    if (!s) return;
    document.body.dataset.atlasScope = s.scope;
    $('atlasOverview').setAttribute('aria-pressed', String(s.scope === 'coven'));
    $('atlasProject').setAttribute('aria-pressed', String(s.scope !== 'coven'));
    $('atlasProject').title = 'Project view · ' + s.active;
    $('atlasProject').setAttribute('aria-label', 'Open current project, ' + s.active);
    $('atlasMissions').setAttribute('aria-label', 'Browse ' + s.missions + ' missions');
    if (s.scope === 'coven') $('workspaceTools').open = false;
    if (s.camera) {
      ['atlasZoomOut', 'atlasZoomIn', 'atlasFit', 'atlasFormation'].forEach(function (id) { $(id).disabled = s.camera.locked; });
      var formation = $('atlasFormation'), grid = s.camera.formation === 'grid';
      formation.setAttribute('aria-pressed', String(grid));
      formation.title = grid ? 'Switch to ring formation' : 'Switch to grid formation';
      var dock = $('atlasCameraDock'), lock = $('atlasLock');
      if (dock.dataset.locked !== String(s.camera.locked)) {
        dock.dataset.locked = String(s.camera.locked);
        lock.setAttribute('aria-pressed', String(s.camera.locked));
        lock.title = s.camera.locked ? 'Unlock the map' : 'Lock the map';
        lock.setAttribute('aria-label', lock.title);
      }
      $('atlasCameraDock').setAttribute('aria-label', s.camera.locked ? 'Map controls. Map locked.' : 'Map controls. Drag to pan. Pinch with two fingers to zoom.');
    }
    if (!$('atlasMissionBrowser').hidden) updateMissions(s);
    var signature = JSON.stringify([s.projects, s.familiars, s.highlight, s.active]);
    if (force || signature !== lastSignature) {
      lastSignature = signature;
      var currentKeys = new Set();
      s.projects.forEach(function (p) {
        currentKeys.add(p.key);
        var b = projectNodes.get(p.key);
        if (!b) {
          b = button('', '', function () {
            closeBrowse(false); api.openProject(p.key);
            $('atlasProject').focus({ preventScroll: true });
          }, 'atlas-project');
          b.dataset.project = p.key;
          var icon = node('span', 'atlas-project-icon'); icon.innerHTML = projectIcon;
          var copy = node('span', 'atlas-project-copy'); copy.append(node('b'), node('span'));
          b.append(icon, copy, node('span', 'atlas-project-state'), node('span', 'atlas-project-preview-names'));
          $('atlasProjects').append(b); projectNodes.set(p.key, b);
        }
        b.querySelector('b').textContent = p.key;
        b.querySelector('.atlas-project-copy > span').textContent = p.missions + (p.missions === 1 ? ' mission' : ' missions') + ' · ' + p.agents + ' agents';
        var state = b.querySelector('.atlas-project-state');
        state.textContent = p.needs ? p.needs + ' need you' : p.agents ? 'Open' : 'Dormant';
        state.dataset.state = p.needs ? 'attention' : p.agents ? 'active' : 'dormant';
        b.dataset.active = String(p.key === s.active);
        b.setAttribute('aria-current', p.key === s.active ? 'true' : 'false');
        var projectLabel = p.key + ', ' + p.missions + (p.missions === 1 ? ' mission' : ' missions') + ', ' + p.agents + ' agents' + (p.needs ? ', ' + p.needs + ' requests need you' : '');
        var names = p.previewNames || [], remaining = p.missions - names.length;
        var preview = b.querySelector('.atlas-project-preview-names');
        preview.hidden = !names.length;
        api.setMissionName(preview, names.join(' · ') + (names.length && remaining > 0 ? ' · +' + remaining : ''));
        if (names.length) projectLabel += '. Missions: ' + names.join(', ') + (remaining ? ', and ' + remaining + ' more' : '');
        b.setAttribute('aria-label', projectLabel); b.title = projectLabel;
      });
      projectNodes.forEach(function (b, k) { if (!currentKeys.has(k)) { b.remove(); projectNodes.delete(k); } });
      filterProjects();
      s.familiars.forEach(function (f) {
        var b = familiarNodes.get(f.key);
        if (!b) {
          b = button('', '', function () { api.highlight(api.snapshot().highlight === f.key ? null : f.key); }, 'atlas-familiar');
          b.dataset.familiar = f.key;
          var mark = node('span', 'atlas-familiar-mark'); mark.setAttribute('aria-hidden', 'true');
          b.append(mark, node('span', 'atlas-familiar-name'));
          $('atlasFamiliars').append(b); familiarNodes.set(f.key, b);
        }
        b.style.setProperty('--hue', f.color);
        b.querySelector('.atlas-familiar-mark').innerHTML = f.avatar;
        b.querySelector('.atlas-familiar-name').textContent = f.name;
        b.setAttribute('aria-pressed', String(s.highlight === f.key));
        var description = f.name + ', ' + f.agents + ' delegated agents across ' + f.projects + (f.projects === 1 ? ' Project' : ' Projects');
        b.title = description + (s.highlight === f.key ? '. Select again to show all familiars.' : '. Follow this familiar.');
        b.setAttribute('aria-label', description + (s.highlight === f.key ? '. Clear familiar filter' : '. Highlight assignments'));
      });
      familiarNodes.forEach(function (b, k) { if (!s.familiars.some(function (f) { return f.key === k; })) { b.remove(); familiarNodes.delete(k); } });
    }
  }
  window.CovenAtlas = { mount: mount, update: update, openMissions: openMissions, openMissionsForProject: openMissionsForProject, closeMissions: closeMissions, closeBrowse: closeBrowse, announce: announce, dismissNotice: dismissNotice };
}());
