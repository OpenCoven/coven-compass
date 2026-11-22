// @generated from src/simulation-model.ts
// The page normalizes recording timestamps and injects its constants. This fold is local to a Project.
(function () {
  type Ref = string | undefined;
  type Metric = 'tokens' | 'usd' | 'sources' | 'tests' | 'reviews';
  type Mode = 'agent' | 'familiar' | 'council' | 'broadcast';
  interface Target {
    mission: string;
    familiar: string;
    agent?: string;
  }
  interface Dependencies<Brief> {
    normBrief(raw: unknown): Brief;
    fam(key: string): { name: string };
    ART: Record<string, unknown>;
    KIND: Record<string, unknown>;
    GATE_NAME: Record<string, unknown>;
    CAP: Record<string, unknown>;
  }

  // Payload fields can be absent even in a recognized recording event.
  type EventPayload =
    | {
        type: 'mission.opened' | 'mission.briefed';
        mission?: string;
        name?: string;
        template?: unknown;
        brief?: unknown;
      }
    | { type: 'mission.paused' | 'mission.resumed' | 'mission.closed'; mission?: string; reason?: string }
    | { type: 'project.stopped' | 'project.resumed' }
    | { type: 'project.founded' | 'project.moved'; repo?: unknown; root?: unknown }
    | { type: 'project.renamed' | 'mission.renamed'; mission?: string; name?: string }
    | ({ type: 'mission.progress'; mission?: string } & Partial<Record<Metric, unknown>>)
    | { type: 'artifact.state'; mission?: string; artifact?: string; state?: string }
    | { type: 'council.seated'; mission?: string; familiar?: string }
    | {
        type: 'task.opened' | 'task.lead.added';
        task?: string;
        familiar?: string;
        leads?: string[];
        mission?: string;
        name?: string;
      }
    | {
        type: 'agent.assigned' | 'agent.spawned' | 'agent.state' | 'agent.retired';
        agent?: string;
        mission?: string;
        familiar?: string;
        task?: string;
        doing?: string;
        state?: string;
      }
    | {
        type: 'gate.requested';
        ask?: string;
        mission?: string;
        familiar?: string;
        agents?: string[];
        gate?: string;
        limit?: string;
        title?: string;
        detail?: string;
        reply?: string;
      }
    | { type: 'gate.resolved'; ask?: string; decision?: string }
    | {
        type: 'familiar.report' | 'psyche.said' | 'you.said';
        text?: unknown;
        mission?: string;
        familiar?: string;
        round?: string;
        agent?: string;
        replaces?: number;
      }
    | { type: 'round.closed'; round?: string }
    | {
        type: 'psyche.routed';
        mission?: string;
        round?: string;
        mode?: Mode;
        why?: unknown;
        to?: string[];
        targets?: (Target | null)[];
      };
  type RecordedEvent = EventPayload & { t: number };

  interface Mission<Brief> {
    id: string;
    name: string;
    seats: string[];
    t0: number;
    brief: Brief;
    tpl: string | null;
    prog: Partial<Record<Metric, number>>;
    art: Record<string, string>;
    spawned: number;
    paused: 'you' | 'limit' | null;
  }
  interface Task {
    id: string;
    mission: Ref;
    fam: Ref;
    leads: string[];
    name: string;
  }
  interface Agent {
    id: Ref;
    mission: Ref;
    fam: Ref;
    seat: string;
    task: Ref | null;
    state: 'idle' | 'work' | 'gate';
    doing: string;
    since: number;
    ask: Ref | null;
    held?: boolean;
  }
  interface Ask {
    id: string;
    mission: Ref;
    fam: Ref;
    gate: string;
    agents: string[];
    title: string;
    detail: string;
    reply: Ref;
    limit: string | null;
    status: 'open' | 'held' | 'allowed';
    t: number;
  }
  interface Round {
    id: string;
    mode: Mode;
    why: string;
    targets: Target[];
    t: number;
    done: number | null;
  }
  interface Item {
    kind: 'note' | 'psyche' | 'you';
    t: number;
    text: string;
    round?: string;
    from?: string;
    mission?: string;
    agent?: string;
    fam?: string;
    tries?: number;
  }
  interface World<Brief> {
    t: number;
    missions: Map<Ref, Mission<Brief>>;
    tasks: Map<Ref, Task>;
    agents: Map<Ref, Agent>;
    asks: Map<Ref, Ask>;
    rounds: Map<Ref, Round>;
    items: Item[];
    stopped: boolean;
    meta?: { repo: string; root: string };
  }
  interface Cursor<Brief> {
    trace: RecordedEvent[];
    applied: number;
    world: World<Brief>;
  }

  function create<Brief>(deps: Dependencies<Brief>) {
    const missing = (['normBrief', 'ART', 'KIND', 'GATE_NAME', 'CAP', 'fam'] as const).filter(
      (k) => !deps || deps[k] == null,
    );
    if (missing.length) throw new TypeError('CovenSimulationModel.create is missing ' + missing.join(', '));
    const { normBrief, ART, KIND, GATE_NAME, CAP, fam } = deps;

    const newWorld = (): World<Brief> => ({
      t: -Infinity,
      missions: new Map(),
      tasks: new Map(),
      agents: new Map(),
      asks: new Map(),
      rounds: new Map(),
      items: [],
      stopped: false,
    });
    const seatId = (m: Ref, f: Ref) => m + '/' + f;
    // how a message travels: to one agent through its lead, to a familiar, to a whole council, or to everyone at once
    const ROUTE = { agent: 'direct', familiar: 'direct', council: 'direct', broadcast: 'cast' };
    function routeLabel(w: World<Brief>, r: Pick<Round, 'targets' | 'mode'>) {
      const tg = r.targets,
        fs = [...new Set(tg.map((x) => x.familiar))],
        ms = [...new Set(tg.map((x) => x.mission))],
        mn = (id: string) => (w.missions.get(id) || { name: 'a closed mission' }).name;
      const names = (ks: string[]) => ks.map((k) => fam(k).name).join(ks.length === 2 ? ' and ' : ', ');
      if (r.mode === 'agent')
        return tg.length === 1
          ? `${tg[0].agent} through ${fam(tg[0].familiar).name}`
          : `${tg.length} agents through ${names(fs)}`;
      if (r.mode === 'broadcast')
        return `${tg.length === ms.length ? 'the lead of ' : ''}${ms.length === 1 ? 'the ' + mn(ms[0]) + ' council' : 'all ' + ms.length + ' councils'}${tg.length !== ms.length ? ', ' + tg.length + ' seats' : ''}`;
      if (r.mode === 'council') return ms.length === 1 ? `the ${mn(ms[0])} council` : `${ms.length} councils`;
      return `${names(fs)} on ${ms.length === 1 ? mn(ms[0]) : ms.length + ' missions'}`;
    }
    function apply(w: World<Brief>, e: RecordedEvent) {
      switch (e.type) {
        case 'mission.opened':
          if (e.mission && !w.missions.has(e.mission))
            w.missions.set(e.mission, {
              id: e.mission,
              name: e.name || String(e.mission),
              seats: [],
              t0: e.t,
              brief: normBrief(e.brief),
              tpl: e.template ? String(e.template).slice(0, 48) : null,
              prog: {},
              art: {},
              spawned: 0,
              paused: null,
            });
          break;
        case 'mission.paused': {
          const m = w.missions.get(e.mission);
          if (!m) break;
          m.paused = e.reason === 'you' ? 'you' : 'limit'; // nothing in it works until it is let on
          w.agents.forEach((a) => {
            if (a.mission === m.id && a.state === 'work') {
              a.state = 'idle';
              a.held = true;
              a.since = e.t;
            }
          });
          break;
        }
        case 'mission.resumed': {
          const m = w.missions.get(e.mission);
          if (!m) break;
          m.paused = null; // whoever was stopped mid-work picks it up again
          if (!w.stopped)
            w.agents.forEach((a) => {
              if (a.mission === m.id && a.held && a.state === 'idle') {
                a.state = 'work';
                a.held = false;
                a.since = e.t;
              }
            });
          break;
        }
        case 'project.stopped':
          w.stopped = true;
          w.agents.forEach((a) => {
            if (a.state === 'work') {
              a.state = 'idle';
              a.held = true;
              a.since = e.t;
            }
          });
          w.items.push({ kind: 'note', t: e.t, text: 'You stopped every agent in this project' });
          break;
        case 'project.resumed':
          if (w.stopped) {
            w.stopped = false;
            w.items.push({ kind: 'note', t: e.t, text: 'You let this project run again' });
            w.agents.forEach((a) => {
              const m = w.missions.get(a.mission);
              if (a.held && a.state === 'idle' && !(m && m.paused)) {
                a.state = 'work';
                a.held = false;
                a.since = e.t;
              }
            });
          }
          break;
        case 'project.founded':
        case 'project.moved': {
          const o = w.meta || { repo: '', root: '' };
          w.meta = {
            repo: typeof e.repo === 'string' && e.repo ? e.repo : o.repo,
            root: typeof e.root === 'string' && e.root ? e.root : o.root,
          };
          if (e.type === 'project.moved')
            w.items.push({
              kind: 'note',
              t: e.t,
              text:
                'This project now ' +
                [e.repo ? 'works on ' + e.repo : '', e.root ? 'is rooted at ' + e.root : '']
                  .filter(Boolean)
                  .join(' and '),
            });
          break;
        }
        case 'project.renamed':
          if (e.name) w.items.push({ kind: 'note', t: e.t, text: `This project is now called ${e.name}` });
          break;
        case 'mission.renamed': {
          const m = w.missions.get(e.mission);
          if (m && e.name) {
            w.items.push({
              kind: 'note',
              t: e.t,
              text: `${m.name} is now called ${String(e.name).slice(0, 60)}`,
            });
            m.name = String(e.name).slice(0, 60);
          }
          break;
        }
        case 'mission.closed': {
          const m = w.missions.get(e.mission);
          if (!m) break; // its agents are retired, what it asked is held, its bastion stands empty
          w.agents.forEach((a, id) => {
            if (a.mission === m.id) w.agents.delete(id);
          });
          w.tasks.forEach((t, id) => {
            if (t.mission === m.id) w.tasks.delete(id);
          });
          w.asks.forEach((q) => {
            if (q.mission === m.id && q.status === 'open') q.status = 'held';
          });
          w.missions.delete(m.id);
          w.items.push({ kind: 'note', t: e.t, text: `You closed ${m.name}` });
          break;
        }
        case 'mission.briefed': {
          const m = w.missions.get(e.mission);
          if (m) {
            m.brief = normBrief(e.brief);
            if ('template' in e) m.tpl = e.template ? String(e.template).slice(0, 48) : null;
          }
          break;
        }
        case 'mission.progress': {
          const m = w.missions.get(e.mission);
          if (m)
            (['tokens', 'usd', 'sources', 'tests', 'reviews'] as const).forEach((k) => {
              if (typeof e[k] === 'number' && isFinite(e[k])) m.prog[k] = Math.max(0, e[k]);
            });
          break;
        }
        case 'artifact.state': {
          const m = w.missions.get(e.mission);
          if (m && e.state !== undefined && ART[e.state] && e.artifact !== undefined && KIND[e.artifact])
            m.art[e.artifact] = e.state;
          break;
        }
        case 'council.seated': {
          const m = w.missions.get(e.mission);
          if (m && e.familiar && !m.seats.includes(e.familiar)) m.seats.push(e.familiar);
          break;
        }
        case 'task.opened':
          if (e.task && !w.tasks.has(e.task))
            w.tasks.set(e.task, {
              id: e.task,
              mission: e.mission,
              fam: e.familiar,
              leads: [
                ...new Set(
                  [e.familiar]
                    .concat(Array.isArray(e.leads) ? e.leads : [])
                    .filter((key): key is string => Boolean(key)),
                ),
              ],
              name: e.name || String(e.task),
            });
          break;
        case 'task.lead.added': {
          const t = w.tasks.get(e.task);
          if (t && e.familiar && !t.leads.includes(e.familiar)) t.leads.push(e.familiar);
          break;
        }
        case 'agent.assigned': {
          const a = w.agents.get(e.agent);
          if (a && w.tasks.has(e.task)) a.task = e.task;
          break;
        }
        case 'agent.spawned': {
          const m = w.missions.get(e.mission);
          if (!m || e.familiar === undefined || !m.seats.includes(e.familiar) || w.agents.has(e.agent)) break;
          m.spawned++;
          w.agents.set(e.agent, {
            id: e.agent,
            mission: e.mission,
            fam: e.familiar,
            seat: seatId(e.mission, e.familiar),
            task: w.tasks.has(e.task) ? e.task : null,
            state: 'work',
            doing: e.doing || 'Working',
            since: e.t,
            ask: null,
          });
          break;
        }
        case 'agent.state': {
          const a = w.agents.get(e.agent);
          if (!a || a.state === 'gate') break;
          const m = w.missions.get(a.mission),
            blocked = w.stopped || (m && m.paused);
          a.state = e.state === 'idle' || blocked ? 'idle' : 'work';
          if (e.doing) a.doing = e.doing;
          a.since = e.t;
          break;
        }
        case 'agent.retired':
          w.agents.delete(e.agent);
          break;
        case 'gate.requested': {
          if (!e.ask || w.asks.has(e.ask)) break;
          const ids = (Array.isArray(e.agents) ? e.agents : []).filter((id) => w.agents.has(id));
          w.asks.set(e.ask, {
            id: e.ask,
            mission: e.mission,
            fam: e.familiar,
            gate: e.gate !== undefined && GATE_NAME[e.gate] ? e.gate : 'N',
            agents: ids,
            title: e.title || 'A decision',
            detail: e.detail || '',
            reply: e.reply,
            limit: e.limit !== undefined && CAP[e.limit] ? e.limit : null,
            status: 'open',
            t: e.t,
          });
          ids.forEach((id) => {
            const a = w.agents.get(id)!;
            a.state = 'gate';
            a.ask = e.ask;
            a.since = e.t;
          });
          break;
        }
        case 'gate.resolved': {
          const q = w.asks.get(e.ask);
          if (!q || q.status !== 'open') break;
          q.status = e.decision === 'held' ? 'held' : 'allowed';
          const qm = w.missions.get(q.mission),
            run = q.status === 'allowed' && !w.stopped && !(qm && qm.paused);
          q.agents.forEach((id) => {
            const a = w.agents.get(id);
            if (!a) return;
            a.state = run ? 'work' : 'idle';
            a.ask = null;
            a.since = e.t;
          });
          w.items.push({
            kind: 'note',
            t: e.t,
            text: `${q.status === 'allowed' ? 'Allowed once' : 'Held'} · ${q.title}`,
          });
          break;
        }
        case 'familiar.report': {
          const prev =
            e.replaces != null
              ? w.items.find((it) => it.kind === 'psyche' && it.t === e.replaces && it.from === e.familiar)
              : null;
          if (prev) {
            prev.text = String(e.text || '');
            prev.tries = (prev.tries || 1) + 1;
          } else
            w.items.push({
              kind: 'psyche',
              t: e.t,
              text: String(e.text || ''),
              from: e.familiar,
              mission: e.mission,
              round: e.round,
              agent: e.agent,
            });
          break;
        }
        case 'psyche.said':
          w.items.push({ kind: 'psyche', t: e.t, text: String(e.text || '') });
          break;
        case 'round.closed': {
          const r = w.rounds.get(e.round);
          if (r && !r.done) r.done = e.t;
          break;
        }
        case 'psyche.routed': {
          const m = w.missions.get(e.mission),
            to = Array.isArray(e.to) ? e.to : [];
          if (e.round != null && Array.isArray(e.targets)) {
            // a round: who it went to, and why Psyche chose them
            const tg = e.targets.filter((x): x is Target =>
              Boolean(x && w.missions.has(x.mission) && x.familiar),
            );
            if (!tg.length || w.rounds.has(e.round)) break;
            const r: Round = {
              id: e.round,
              mode: e.mode !== undefined && ROUTE[e.mode] ? e.mode : 'council',
              why: String(e.why || ''),
              targets: tg,
              t: e.t,
              done: null,
            };
            w.rounds.set(r.id, r);
            w.items.push({
              kind: 'note',
              t: e.t,
              round: r.id,
              text: `Psyche ${r.mode === 'broadcast' ? 'broadcast this to' : 'passed this to'} ${routeLabel(w, r)}${r.why ? ' · ' + r.why : ''}`,
            });
            break;
          }
          if (!to.length) break;
          const whole = m && to.length > 1 && to.length === m.seats.length;
          w.items.push({
            kind: 'note',
            t: e.t,
            text: whole
              ? `Psyche passed this to the ${m.name} council.`
              : `Psyche passed this to ${to.map((k) => fam(k).name).join(' and ')}${m ? ' on ' + m.name : ''}.`,
          });
          break;
        }
        case 'you.said':
          w.items.push({
            kind: 'you',
            t: e.t,
            text: String(e.text || ''),
            mission: e.mission,
            fam: e.familiar,
            round: e.round,
          });
          break;
      }
    }

    // The fold half of seek(): rebuild from the start when moving backwards, then apply every
    // event up to t. An optional event count separates successive events at the same time.
    function advance(c: Cursor<Brief>, t: number, through = c.trace.length) {
      let changed = false,
        reset = false;
      const fresh: RecordedEvent[] = [];
      if (t < c.world.t || c.applied > through) {
        c.world = newWorld();
        c.applied = 0;
        changed = reset = true;
      }
      const tr = c.trace;
      while (c.applied < through && c.applied < tr.length && tr[c.applied].t <= t) {
        const e = tr[c.applied++];
        apply(c.world, e);
        fresh.push(e);
        changed = true;
      }
      c.world.t = t;
      return { changed, reset, fresh };
    }
    // The trace half of emit(): stamp the event no earlier than now or the last event, then record it.
    function append<E extends EventPayload & { t?: number }>(c: { trace: RecordedEvent[] }, e: E, now: number) {
      e.t = Math.max(now, c.trace.length ? c.trace[c.trace.length - 1].t : 0);
      const stamped = e as E & { t: number };
      c.trace.push(stamped);
      return stamped;
    }
    // Per-Project counts at the current replay position.
    function summarize(w: World<Brief>) {
      let needs = 0;
      w.asks.forEach((q) => {
        if (q.status === 'open') needs++;
      });
      return { missions: w.missions.size, agents: w.agents.size, needs };
    }
    return Object.freeze({ newWorld, seatId, ROUTE, routeLabel, apply, advance, append, summarize });
  }
  const api = Object.freeze({ create });
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined')
    (window as Window & { CovenSimulationModel?: typeof api }).CovenSimulationModel = api;
})();
