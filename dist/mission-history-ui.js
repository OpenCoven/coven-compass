// The inspector owns the entry point. Playback remains in charge of map selection and time.
window.CovenHistoryView = function ({model, current, readSeal, showMoment, restoreInspector}) {
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
      updateRange(key, current().applied);
    };
  }
  function show(entry) {
    state.selected = entry.position;
    dialog.close();
    const exists = showMoment(state.mission, entry.time);
    const trace = state.project.trace;
    const shared = trace[entry.position]?.t === entry.time || trace[entry.position - 2]?.t === entry.time;
    byId('historyMapNote').textContent = 'Event ' + entry.position + ' · ' + time(entry.time) +
      (shared ? ' · Map includes all events at this time.' : '') + (exists ? '' : ' · Mission absent at this position.');
    back.hidden = false;
    byId('historyResume').focus();
  }
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
      entries.length ? (offset + 1) + '–' + Math.min(offset + pageSize, entries.length) + ' of ' + entries.length + ' relevant recorded events' :
      'No recorded changes to this mission in the interval.';
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
      const jump = button('Show on map', () => show(entry));
      jump.dataset.position = entry.position;
      jump.setAttribute('aria-label', 'Show event ' + entry.position + ' on map');
      const actions = element('div', null, 'history-actions');
      actions.append(jump, button('Start here', () => { updateRange('start', entry.position); byId('history-start').focus(); }),
        button('End here', () => { updateRange('end', entry.position); byId('history-end').focus(); }));
      const source = element('details', null, 'history-source-event');
      const json = element('pre');
      source.append(element('summary', 'Recorded event'), json);
      source.addEventListener('toggle', () => {
        if (source.open && !json.textContent) json.textContent = JSON.stringify(at(entry.position), null, 2);
      });
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
    state.entries = window.CovenMissionHistory.collect(model, project.trace, mission, readSeal);
    state.length = project.trace.length;
  }
  function open(project, mission, name) {
    if (!state || state.project !== project || state.mission !== mission) {
      state = {project, mission, start: 0, end: project.trace.length, page: 0, selected: null, length: -1};
    }
    refreshEntries();
    state.name = name;
    byId('historyTitle').textContent = name;
    byId('historySource').textContent = (project.recorded ? 'Imported recording' : 'Local simulation') + ' · ' + project.key + ' · ' + mission +
      (project.skippedEvents ? ' · Incomplete recording (' + project.skippedEvents + ' unrecognized). Changes in skipped records are unknown.' : '');
    back.hidden = true;
    render();
    dialog.showModal();
    window.CovenMobileUI?.sync();
    const target = list.querySelector('button[data-position="' + state.selected + '"]') || byId('historyTitle');
    target.focus();
  }
  function close() {
    dialog.close();
    restoreInspector(state.mission);
  }
  byId('historyClose').onclick = close;
  dialog.addEventListener('cancel', ev => { ev.preventDefault(); close(); });
  dialog.addEventListener('keydown', ev => ev.stopPropagation());
  byId('historyResume').onclick = () => open(state.project, state.mission, state.name);
  for (const [id, delta] of [['historyPrev', -1], ['historyNext', 1]]) {
    byId(id).onclick = () => { state.page += delta; render(); list.querySelector('button')?.focus(); };
  }
  function reset() {
    if (dialog.open) dialog.close();
    back.hidden = true;
    state = null;
  }
  return {open, reset};
};
