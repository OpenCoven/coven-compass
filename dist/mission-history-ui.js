// The inspector owns the entry point. Playback remains in charge of map selection and time.
window.CovenHistoryView = function ({model, current, readSeal, showMoment, restoreInspector, importRecording}) {
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
  function updateRange(key, value) {
    if (!Number.isInteger(value) || value < 0 || value > state.length) return render();
    state[key] = value;
    state.page = 0;
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
    const index = state.entries.indexOf(entry);
    const previous = byId('historyBackEvent'), next = byId('historyForwardEvent');
    previous.disabled = index === 0;
    next.disabled = index === state.entries.length - 1;
    back.hidden = false;
    if (wasModal || document.activeElement === document.body) byId('historyResume').focus();
  }
  for (const [id, delta] of [['historyBackEvent', -1], ['historyForwardEvent', 1]]) {
    byId(id).onclick = () => {
      const index = state.entries.findIndex(entry => entry.position === state.selected);
      const next = state.entries[index + delta];
      if (next) show(next);
    };
  }
  byId('historyFile').onchange = async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (file) await importRecording(file);
  };
  function render() {
    for (const key of ['start', 'end']) {
      const input = byId('history-' + key);
      input.max = state.length;
      input.value = state[key];
      byId('history-' + key + '-note').textContent = moment(state[key]);
    }
    const entries = window.CovenMissionHistory.between(state.entries, state.start, state.end);
    const offset = state.page * pageSize;
    byId('historyCount').textContent = state.end < state.start ? 'End must be at or after start.' :
      entries.length ? (offset + 1) + '–' + Math.min(offset + pageSize, entries.length) + ' of ' + entries.length + ' mission events' :
      'No recorded events for this mission in the interval.';
    list.replaceChildren();
    for (const entry of entries.slice(offset, offset + pageSize)) {
      const row = element('li');
      const head = element('div', null, 'history-event-head');
      head.append(element('strong', 'Event ' + entry.position), element('time', time(entry.time)));
      row.append(head, element('code', entry.type));
      if (entry.unknown) row.append(element('p', entry.unknown));
      for (const {label, before, after} of entry.changes) {
        const change = element('div', null, 'history-change');
        change.append(element('strong', label), element('span', before + ' → ' + after));
        row.append(change);
      }
      if (entry.details) row.append(element('p', entry.details));
      if (entry.finalStatus === 'open') {
        const status = state.project.skippedEvents ? 'Open after the last recognized event' :
          state.project.recorded ? 'Open at end of recording' : 'Open at latest event';
        row.append(element('strong', status));
      }
      if (entry.finalStatus === 'held' && !entry.relatedPosition) row.append(element('p', 'Held when the mission closed'));
      const jump = button('Show on map', () => show(entry));
      jump.dataset.position = entry.position;
      jump.setAttribute('aria-label', 'Show event ' + entry.position + ' on map');
      const actions = element('div', null, 'history-actions');
      actions.append(jump, button('Start here', () => { updateRange('start', entry.position); byId('history-start').focus(); }),
        button('End here', () => { updateRange('end', entry.position); byId('history-end').focus(); }));
      if (entry.relatedPosition) {
        const position = entry.relatedPosition;
        const label = entry.type === 'gate.requested' ? 'Show resolution' : 'Show request';
        actions.append(button(label + ' · event ' + position, () => show(state.entries.find(item => item.position === position))));
      }
      const source = element('details', null, 'history-source-event');
      const json = element('pre');
      source.append(element('summary', 'Recorded event'), json);
      source.addEventListener('toggle', () => {
        if (source.open && !json.textContent) json.textContent = JSON.stringify(at(entry.position), null, 2);
      });
      if (state.origin?.position === entry.position) {
        json.textContent = JSON.stringify(at(entry.position), null, 2);
        source.open = true;
      }
      row.append(source, actions);
      list.append(row);
    }
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
    byId('historySource').textContent = (project.recorded ? 'Imported recording' : project.sample ? 'Built-in sample · Local simulation' : 'Local simulation') + ' · ' + project.key + ' · ' + mission +
      (project.skippedEvents ? ' · Incomplete recording (' + project.skippedEvents + ' unrecognized). Changes in skipped records are unknown.' : '');
    back.hidden = true;
    render();
    const target = list.querySelector('button[data-position="' + state.selected + '"]') || byId('historyTitle');
    target.autofocus = true;
    dialog.showModal();
    target.autofocus = false;
    window.CovenMobileUI?.sync();
    target.focus();
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
    byId(id).onclick = () => { state.page += delta; render(); list.querySelector('button')?.focus(); };
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
  return {open, reset, syncPosition};
};
