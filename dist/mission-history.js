// One private reducer world per comparison. Event positions count the events already applied.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CovenMissionHistory = api;
}(typeof window === 'undefined' ? null : window, function () {
  'use strict';

  const sealEvents = new Set(['mission.opened', 'mission.closed', 'mission.paused', 'mission.resumed',
    'mission.briefed', 'mission.progress', 'artifact.state', 'council.seated', 'agent.spawned',
    'agent.retired', 'agent.state', 'gate.requested', 'gate.resolved', 'project.stopped', 'project.resumed']);

  function collect(model, trace, mission, readSeal) {
    const world = model.newWorld(), entries = [];
    for (const [index, event] of trace.entries()) {
      // Read both sides at the event time. Elapsed time alone has no causal event.
      world.t = event.t;
      const fields = [];
      const watch = (label, read) => fields.push({label, read, before: read()});
      const taskName = id => {
        const task = world.tasks.get(id);
        return task ? task.name + ' (' + id + ')' : 'Unknown task';
      };
      const watchTask = id => {
        const existing = world.tasks.get(id);
        if ((existing?.mission ?? event.mission) !== mission) return;
        const label = existing ? taskName(id) : (event.name || id) + ' (' + id + ')';
        watch('Task leads · ' + label, () => {
          const task = world.tasks.get(id);
          return task ? task.leads.join(', ') || 'Unknown lead' : 'No recorded task';
        });
      };
      const watchAgent = id => {
        const agent = world.agents.get(id);
        const home = agent?.mission ?? event.mission;
        if (home !== mission && world.tasks.get(agent?.task)?.mission !== mission && world.tasks.get(event.task)?.mission !== mission) return;
        watch('Assignment · ' + id, () => {
          const current = world.agents.get(id);
          if (!current) return 'No recorded agent';
          return current.task ? taskName(current.task) : 'No recorded assignment';
        });
      };
      const watchAsk = id => {
        const ask = world.asks.get(id);
        if ((ask?.mission ?? event.mission) !== mission) return;
        watch('Decision · ' + (ask?.title || event.title || 'A decision') + ' (' + id + ')', () =>
          ({open: 'Waiting for decision', held: 'Held', allowed: 'Allowed'})[world.asks.get(id)?.status] || 'No recorded request');
      };

      const projectWide = event.type === 'project.stopped' || event.type === 'project.resumed';
      const affectsSeal = projectWide || event.mission === mission || world.agents.get(event.agent)?.mission === mission ||
        world.asks.get(event.ask)?.mission === mission;
      if (readSeal && affectsSeal && sealEvents.has(event.type)) {
        watch('Mission state', () => world.missions.has(mission) ? readSeal(world, world.missions.get(mission)) : 'Absent from replay');
      }
      if (event.mission === mission || projectWide) {
        watch('Mission availability', () => {
          const m = world.missions.get(mission);
          if (!m) return 'Absent from replay';
          if (world.stopped) return 'Project stopped';
          return m.paused ? (m.paused === 'you' ? 'Paused by reviewer' : 'Paused at limit') : 'Open';
        });
        if (event.type === 'mission.renamed' || event.type === 'mission.opened')
          watch('Mission name', () => world.missions.get(mission)?.name || 'Unknown name');
      }
      if (event.type === 'mission.closed') {
        // Closing a mission also retires agents, removes tasks and holds its pending requests.
        for (const a of world.agents.values()) if (a.mission === event.mission) watchAgent(a.id);
        for (const t of world.tasks.values()) if (t.mission === event.mission) watchTask(t.id);
        for (const q of world.asks.values()) if (q.mission === event.mission && q.status === 'open') watchAsk(q.id);
      } else {
        if (['task.opened', 'task.lead.added'].includes(event.type) && event.task) watchTask(event.task);
        if (['agent.assigned', 'agent.spawned', 'agent.retired'].includes(event.type) && event.agent) watchAgent(event.agent);
        if (['gate.requested', 'gate.resolved'].includes(event.type) && event.ask) watchAsk(event.ask);
      }

      let unknown = null;
      if (event.type === 'agent.assigned' && (affectsSeal || world.tasks.get(event.task)?.mission === mission)) {
        if (!world.agents.has(event.agent)) unknown = 'Assignment unknown. This recording has no agent record for ' + (event.agent || 'this assignment') + '.';
        else if (!world.tasks.has(event.task)) unknown = 'Assignment unknown. This recording has no task record for ' + (event.task || 'this assignment') + '.';
      }
      if (event.type === 'gate.resolved' && event.mission === mission && !world.asks.has(event.ask))
        unknown = 'Decision timing and outcome unknown. The original request is missing.';
      model.apply(world, event);
      const changes = [];
      for (const field of fields) {
        const after = field.read();
        if (field.before !== after) changes.push({label: field.label, before: field.before, after});
      }
      if (changes.length || unknown) entries.push({position: index + 1, time: event.t, type: event.type, changes, unknown});
    }
    return entries;
  }

  function between(entries, start, end) {
    return entries.filter(entry => entry.position > start && entry.position <= end);
  }
  return {collect, between};
}));
