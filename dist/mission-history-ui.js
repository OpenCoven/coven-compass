// The inspector owns the entry point. Playback remains in charge of map selection and time.
window.CovenHistoryView = function ({model, current, familiar, eventIcon, readSeal, showMoment, restoreInspector, importRecording, bookmark}) {
  const byId = id => document.getElementById(id);
  const dialog = byId('missionHistory'), back = byId('historyReturn'), list = byId('historyRows');
  const at = pos => state.project.trace[pos - 1];
  function time(t) {
    const date = new Date(t);
    return Number.isFinite(date.getTime()) ? date.toISOString().replace('T', ' ').replace('.000Z', 'Z') : 'Unknown time';
  }
  const moment = pos => pos === 0 ? 'Before the first event' : time(at(pos).t) + ' · ' + at(pos).type;
  const pageSize = 25;
  let state = null;

  function element(tag, text, cls) {
    const el = document.createElement(tag);
    if (text != null) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  }
  function button(label, action) {
    const b = element('button', label, 'btn sm');
    b.type = 'button';
    b.addEventListener('click', action);
    return b;
  }
  const detail = byId('historyDetail'), workspace = dialog.querySelector('.history-workspace');
  const feed = dialog.querySelector('.history-feed'), content = dialog.querySelector('.history-content');
  const wide = matchMedia('(min-width: 860px) and (min-height: 520px)');
  const titles = {
    'mission.opened': 'Mission opened', 'mission.closed': 'Mission closed', 'mission.renamed': 'Mission renamed',
    'mission.briefed': 'Brief updated', 'mission.paused': 'Mission paused', 'mission.resumed': 'Mission resumed',
    'mission.progress': 'Progress recorded', 'task.opened': 'Task opened', 'task.lead.added': 'Task lead added',
    'agent.assigned': 'Agent assignment recorded', 'agent.spawned': 'Agent joined', 'agent.retired': 'Agent retired',
    'agent.state': 'Agent activity updated', 'artifact.state': 'Deliverable updated', 'gate.requested': 'Decision requested',
    'gate.resolved': 'Decision recorded', 'familiar.report': 'Familiar reported', 'psyche.said': 'Psyche replied',
    'psyche.routed': 'Psyche routed a message', 'you.said': 'You sent a message', 'round.closed': 'Conversation closed',
    'project.stopped': 'Project stopped', 'project.resumed': 'Project resumed', 'project.renamed': 'Project renamed',
    'project.moved': 'Project moved', 'project.founded': 'Project created',
  };
  function eventTitle(event) { return titles[event.type] || (event.type === 'council.seated' ? 'Council seat recorded' : event.type); }
  function headline(event) {
    if (event.type === 'council.seated') return event.familiar ? familiar(event.familiar).name + ' joined the council' : 'Council seat recorded';
    const title = eventTitle(event);
    const subject = event.type === 'task.opened' ? event.name : event.type === 'gate.requested' ? event.title : event.agent;
    return subject ? title + ' · ' + subject : title;
  }
  function setRangeOpen(open) {
    byId('historyRange').hidden = !open;
    const toggle = byId('historyRangeToggle');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Hide range' : 'Edit range';
  }
  byId('historyRangeToggle').onclick = () => setRangeOpen(byId('historyRange').hidden);
  function placeDetail() {
    const selected = list.querySelector('[aria-expanded="true"]');
    const parent = wide.matches || !selected ? workspace : selected.parentElement;
    if (detail.parentElement !== parent) {
      const focused = detail.contains(document.activeElement) && document.activeElement;
      parent.append(detail);
      if (focused) focused.focus({preventScroll: true});
    }
  }
  wide.addEventListener('change', () => {
    if (dialog.open && wide.matches && detail.hidden) render();
    else placeDetail();
  });
  function updateRange(key, value) {
    if (!Number.isInteger(value) || value < 0 || value > state.length) return render();
    state[key] = value;
    state.page = 0;
    state.scroll = null;
    state.selected = null;
    render();
  }
  for (const key of ['start', 'end']) {
    const input = byId('history-' + key);
    input.addEventListener('change', () => updateRange(key, input.valueAsNumber));
    byId('history-' + key + '-cursor').onclick = () => {
      refreshEntries();
      updateRange(key, state.project.applied);
    };
  }
  function show(entry) {
    if (dialog.open) state.scroll = entry.position === state.selected ? {feed: feed.scrollTop, content: content.scrollTop, detail: detail.scrollTop} : null;
    else if (entry.position !== state.selected) state.scroll = null;
    state.selected = entry.position;
    const wasModal = dialog.open;
    if (wasModal) dialog.close();
    // Opening another Project on the map clears its previous inspector. Keep this investigation through that transition.
    const investigation = state;
    const exists = showMoment(investigation.project, investigation.mission, entry.time, entry.position);
    state = investigation;
    const summary = entry.changes.map(change => change.label + ' · ' + change.after).join('; ');
    byId('historyMapNote').textContent = 'Event ' + entry.position + ' · ' + entry.type + ' · ' +
      (summary || entry.details || time(entry.time)) + (exists ? '' : ' · Mission absent at this position.');
    const subject = byId('historySubject');
    const missionName = state.project.world.missions.get(state.mission)?.name || state.name || state.mission;
    const request = state.project.world.asks.get(at(entry.position).ask);
    subject.textContent = [missionName, request?.title].filter(Boolean).join(' · ');
    subject.hidden = !state.project.recorded;
    const index = state.entries.indexOf(entry);
    const previous = byId('historyBackEvent'), next = byId('historyForwardEvent');
    previous.disabled = index === 0;
    next.disabled = index === state.entries.length - 1;
    back.hidden = false;
    byId('historyBookmark').hidden = !state.project.recordingDigest;
    byId('bookmarkStatus').hidden = true;
    if (wasModal || document.activeElement === document.body) byId('historyResume').focus();
  }
  async function bookmarkMoment(position, status) {
    if (!state?.project.recordingDigest || !position) return;
    const {project, mission} = state;
    const missionPosition = project.trace.findIndex(event => event.type === 'mission.opened' && event.mission === mission) + 1;
    if (!missionPosition) return;
    const url = bookmark({scope: 'recording', digest: project.recordingDigest, missionPosition, position});
    status.hidden = false;
    status.textContent = 'Save the address in your browser bookmarks to return to this event.';
    try {
      await navigator.clipboard.writeText(url);
      if (location.href === url && status.isConnected) status.textContent = 'Moment link copied. Reopen it with the same recording.';
    } catch { /* The address bar remains usable when clipboard access is unavailable. */ }
  }
  byId('historyBookmark').onclick = () => bookmarkMoment(state?.selected, byId('bookmarkStatus'));
  function findBookmark(project, route) {
    const opener = project.trace[route.missionPosition - 1];
    if (opener?.type !== 'mission.opened' || !opener.mission || route.position > project.trace.length) return null;
    const entries = window.CovenMissionHistory.collect(model, project.trace, opener.mission, readSeal, {allEvents: true});
    const entry = entries.find(item => item.position === route.position);
    return entry && {mission: opener.mission, entries, entry};
  }
  function resumeBookmark(project, {mission, entries, entry}) {
    state = {project, mission, entries, length: project.trace.length, start: 0, end: project.trace.length,
      page: 0, selected: entry.position, bookmarkPosition: entry.position};
    show(entry);
    state.name = project.world.missions.get(mission)?.name || mission;
    byId('historyResume').focus();
  }
  for (const [id, delta] of [['historyBackEvent', -1], ['historyForwardEvent', 1]]) {
    byId(id).onclick = () => {
      const index = state.entries.findIndex(entry => entry.position === state.selected);
      const next = state.entries[index + delta];
      if (next) show(next);
    };
  }
  byId('historyLoad').onclick = () => byId('historyFile').click();
  byId('historyFile').onchange = async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (file) await importRecording(file);
  };
  function selectEvent(entry, focusDetail = false) {
    const previous = list.querySelector('[aria-expanded="true"]');
    if (previous) previous.setAttribute('aria-expanded', 'false');
    const trigger = list.querySelector('[data-position="' + entry.position + '"]');
    trigger.setAttribute('aria-expanded', 'true');
    state.selected = entry.position;
    const event = at(entry.position);
    const heading = element('h3', headline(event));
    heading.id = 'historyEventTitle'; heading.tabIndex = -1;
    const stamp = element('time', time(entry.time));
    if (stamp.textContent !== 'Unknown time') stamp.dateTime = new Date(entry.time).toISOString();
    const meta = element('div', null, 'history-detail-meta');
    meta.append(element('span', 'Event ' + entry.position), stamp);
    detail.replaceChildren(meta, heading);
    if (entry.unknown) detail.append(element('p', entry.unknown, 'history-notice'));
    if (entry.changes.length) {
      const changes = element('dl', null, 'history-changes');
      for (const {label, before, after} of entry.changes) {
        const value = element('dd');
        value.append(element('span', before), document.createTextNode(' → '), element('b', after));
        changes.append(element('dt', label), value);
      }
      detail.append(changes);
    }
    if (entry.details) detail.append(element('p', entry.details, 'history-fields'));
    if (entry.finalStatus === 'open') detail.append(element('p', state.project.skippedEvents ? 'Open after the last recognized event' :
      state.project.recorded ? 'Open at end of recording' : 'Open at latest event', 'history-notice'));
    if (entry.finalStatus === 'held' && !entry.relatedPosition) detail.append(element('p', 'Held when the mission closed'));
    const jump = button('Show on map', () => show(entry));
    jump.classList.add('history-map-action');
    jump.setAttribute('aria-label', 'Show event ' + entry.position + ' on map');
    const actions = element('div', null, 'history-actions');
    actions.append(jump);
    if (entry.relatedPosition) {
      const target = entry.relatedPosition;
      const link = button(entry.type === 'gate.requested' ? 'View resolution' : 'View request', () => show(state.entries.find(item => item.position === target)));
      link.title = 'Event ' + target;
      actions.append(link);
    }
    const source = element('details', null, 'history-source-event');
    const json = element('pre');
    source.append(element('summary', 'Recorded event'), element('code', entry.type), json);
    const loadSource = () => { if (source.open && !json.textContent) json.textContent = JSON.stringify(event, null, 2); };
    source.addEventListener('toggle', loadSource);
    if (state.project.recordingDigest) {
      const status = element('p');
      status.hidden = true;
      status.setAttribute('role', 'status');
      source.append(button('Bookmark moment', () => bookmarkMoment(entry.position, status)), status);
    }
    source.open = state.origin?.position === entry.position || state.bookmarkPosition === entry.position;
    loadSource();
    const bounds = element('div', null, 'history-bounds');
    for (const key of ['start', 'end']) {
      bounds.append(button(key === 'start' ? 'Start here' : 'End here', () => {
        setRangeOpen(true); updateRange(key, entry.position); byId('history-' + key).focus();
      }));
    }
    detail.append(actions, source, bounds);
    detail.hidden = false;
    placeDetail();
    detail.scrollTop = 0;
    if (focusDetail) heading.focus();
  }
  function render() {
    for (const key of ['start', 'end']) {
      const input = byId('history-' + key);
      input.max = state.length;
      input.value = state[key];
      byId('history-' + key + '-note').textContent = moment(state[key]);
    }
    const entries = window.CovenMissionHistory.between(state.entries, state.start, state.end);
    const offset = state.page * pageSize, page = entries.slice(offset, offset + pageSize);
    byId('historyCount').textContent = state.end < state.start ? 'End must be at or after start.' :
      entries.length > pageSize ? (offset + 1) + '–' + (offset + page.length) + ' of ' + entries.length + ' events' :
      entries.length ? entries.length + (entries.length === 1 ? ' event' : ' events') : 'No mission events in this range.';
    workspace.append(detail); detail.hidden = true;
    list.replaceChildren();
    for (const entry of page) {
      const event = at(entry.position), group = entry.type.split('.')[0];
      const row = element('li');
      const trigger = button('', () => selectEvent(entry, true));
      trigger.className = 'history-event'; trigger.dataset.position = entry.position;
      trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-controls', 'historyDetail');
      const mark = element('span', null, 'history-mark');
      mark.setAttribute('aria-hidden', 'true'); mark.innerHTML = eventIcon(group, event.familiar);
      if ((entry.type === 'mission.paused' && event.reason === 'limit') || (entry.type === 'gate.requested' && event.limit)) mark.classList.add('history-limit');
      const copy = element('span', null, 'history-event-copy');
      const metadata = element('span', null, 'history-event-meta');
      const exact = time(entry.time);
      const clock = element('time', exact === 'Unknown time' ? exact : exact.split(' ')[1].slice(0, 8) + ' UTC');
      if (exact !== 'Unknown time') clock.dateTime = new Date(entry.time).toISOString();
      clock.title = exact;
      metadata.append(element('span', '#' + entry.position), clock);
      copy.append(element('strong', headline(event)), metadata);
      trigger.append(mark, copy); row.append(trigger); list.append(row);
    }
    const selected = page.find(entry => entry.position === state.selected) || (wide.matches && page[0]);
    if (selected) selectEvent(selected);
    byId('historyPrev').disabled = state.page === 0;
    byId('historyNext').disabled = offset + pageSize >= entries.length;
    byId('historyPages').hidden = entries.length <= pageSize;
  }
  function refreshEntries() {
    const {project, mission} = state;
    if (state.length === project.trace.length) return;
    state.entries = window.CovenMissionHistory.collect(model, project.trace, mission, readSeal, {allEvents: true});
    state.length = project.trace.length;
  }
  function open(project, mission, name, origin = null) {
    const returning = !back.hidden && state?.project === project && state.mission === mission;
    if (!state || state.project !== project || state.mission !== mission) {
      state = {project, mission, start: 0, end: project.trace.length, page: 0, selected: null, length: -1};
    }
    if (origin && origin !== state.origin) {
      state.selected = origin.position;
      state.start = 0; state.end = project.trace.length;
    }
    state.origin = origin;
    refreshEntries();
    if (state.selected != null) {
      state.start = Math.min(state.start, state.selected - 1);
      state.end = Math.max(state.end, state.selected);
      const visible = window.CovenMissionHistory.between(state.entries, state.start, state.end);
      state.page = Math.max(0, Math.floor(visible.findIndex(entry => entry.position === state.selected) / pageSize));
    }
    state.name = name;
    byId('historyClose').textContent = origin ? 'Back to Inbox' : 'Close';
    dialog.querySelector('.history-import').hidden = !!origin;
    byId('historyError').hidden = true;
    byId('historyTitle').textContent = name;
    if (!returning) {
      setRangeOpen(false);
      dialog.querySelector('.history-import').open = false;
      state.scroll = null;
    }
    byId('historySource').textContent = (project.recorded ? 'Imported recording' : project.sample ? 'Built-in sample · Local simulation' : 'Local simulation') + ' · ' + project.key + ' · ' + mission;
    byId('historyWarning').hidden = !project.skippedEvents;
    byId('historyWarning').textContent = project.skippedEvents ? 'Incomplete recording · ' + project.skippedEvents + ' unrecognized. Changes in skipped records are unknown.' : '';
    back.hidden = true;
    render();
    const target = (origin || returning) && detail.querySelector('.history-map-action') || byId('historyTitle');
    target.autofocus = true;
    dialog.showModal();
    target.autofocus = false;
    window.CovenMobileUI?.sync();
    target.focus({preventScroll: true});
    if (returning && state.scroll) {
      feed.scrollTop = state.scroll.feed; content.scrollTop = state.scroll.content; detail.scrollTop = state.scroll.detail;
    } else if (origin || returning) {
      list.querySelector('[aria-expanded="true"]')?.scrollIntoView({block: 'nearest'});
      target.scrollIntoView({block: 'nearest'});
    } else { feed.scrollTop = 0; content.scrollTop = 0; }
  }
  function close() {
    dialog.close();
    if (state.origin) {
      const {resume} = state.origin;
      reset();
      resume();
    } else restoreInspector(state.mission);
  }
  byId('historyClose').onclick = close;
  dialog.addEventListener('cancel', ev => { ev.preventDefault(); close(); });
  dialog.addEventListener('keydown', ev => ev.stopPropagation());
  byId('historyResume').onclick = () => open(state.project, state.mission, state.name, state.origin);
  for (const [id, delta] of [['historyPrev', -1], ['historyNext', 1]]) {
    byId(id).onclick = () => { state.page += delta; state.selected = null; state.scroll = null; render(); list.querySelector('button')?.focus(); };
  }
  function reset() {
    if (dialog.open) dialog.close();
    back.hidden = true;
    state = null;
  }
  function syncPosition() {
    if (back.hidden || !state) return;
    const project = current();
    if (project !== state.project || project.applied !== state.selected || project.world.t !== at(state.selected).t ||
        project.sel !== (project.world.missions.has(state.mission) ? state.mission : null)) back.hidden = true;
  }
  return {open, reset, syncPosition, findBookmark, resumeBookmark, eventTitle};
};
