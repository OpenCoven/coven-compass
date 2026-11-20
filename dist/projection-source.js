/*
 * Projection sources: the seam where real Project data will plug in.
 *
 * Every source implements one interface:
 *
 *   source.kind            'simulation' | 'fixture' (a future live adapter adds its own kind)
 *   source.read()          Promise<Projection>
 *
 *   Projection = {
 *     schema: 'coven-compass.projection/1',
 *     source: {kind, label, authoritative: false},
 *     availability: {state, reason, message},
 *       state: 'simulated' | 'fresh' | 'stale' | 'reconciling' | 'synthetic' | 'unavailable'
 *     freshness: {observedAt, ageMs, staleAfterMs}   (null where not applicable)
 *     complete: boolean                              (every page was read)
 *     projects: [{id, name, root, missions, agents, needs}]
 *       id, name, and root stay separate (D01 proposal). A count the source can't supply is
 *       null (unknown), never 0.
 *     brief                                          (only for ?source=fixture&scenario=brief-…)
 *       {scenario, title, mission, summary, policy, policySummary, record, result}: one synthetic
 *       Brief success policy case (#35) and its evaluation by CovenBriefPolicy. Never authoritative.
 *   }
 *
 * Rules: the mode is chosen explicitly (?source=simulation | fixture). A source that fails
 * reports 'unavailable' with a reason. It never substitutes another source's data, and no
 * source is authoritative. There is no live transport here: D03 is unresolved.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CovenProjection = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var SCHEMA = 'coven-compass.projection/1';
  var MODES = ['simulation', 'fixture'];
  var FIXTURE_URL = 'fixtures/cave-projects-list.json';
  var DEFAULT_SCENARIO = 'fresh';
  var SUPPORTED_API_MAJOR = 1;
  var CLIENT_VERSION = '0.0.1';
  var MAX_PAGES = 100;
  var BRIEF_FIXTURE_URL = 'fixtures/brief-policy-cases.json';
  var BRIEF_PREFIX = 'brief-';
  var BRIEF_LABEL = 'Synthetic Brief policy cases (proposal for #35)';

  var REASONS = {
    invalid_mode: 'Unknown projection source. Use ?source=simulation or ?source=fixture.',
    unknown_scenario: 'That fixture scenario does not exist.',
    disconnected: 'The projection source is disconnected. No Projects are shown, and no sample data is substituted.',
    unsupported_version: 'The source reports an API version Compass does not support.',
    incompatible_version: 'The source requires a newer Compass client.',
    fixture_unreadable: 'The fixture could not be loaded. No Projects are shown, and no sample data is substituted.',
    fixture_invalid: 'The fixture does not have the expected projects.list shape.',
    brief_invalid: 'The Brief policy fixture does not have the expected synthetic shape.',
    policy_model_missing: 'The Brief policy model (brief-policy.js) did not load. Nothing is shown, and no sample data is substituted.',
  };

  function selectMode(search) {
    var params;
    try { params = new URLSearchParams(search || ''); } catch (error) { params = new URLSearchParams(''); }
    var requested = params.get('source');
    if (requested === null) return {mode: 'simulation', requested: null, scenario: null, explicit: false};
    var mode = requested.trim().toLowerCase();
    if (MODES.indexOf(mode) < 0) return {mode: 'invalid', requested: requested, scenario: null, explicit: true};
    return {mode: mode, requested: requested, scenario: mode === 'fixture' ? (params.get('scenario') || DEFAULT_SCENARIO) : null, explicit: true};
  }

  function base(kind, label) {
    return {schema: SCHEMA, source: {kind: kind, label: label, authoritative: false},
      availability: null, freshness: {observedAt: null, ageMs: null, staleAfterMs: null}, complete: false, projects: []};
  }

  function unavailable(kind, label, reason, detail) {
    var p = base(kind, label);
    p.availability = {state: 'unavailable', reason: reason, message: REASONS[reason] + (detail ? ' ' + detail : '')};
    return p;
  }

  // options.snapshot() returns {projects: [{key, missions, agents, needs}]}; or pass the
  // simulation model directly as options.worlds() → [[key, world]] with options.summarize(world).
  function createSimulationSource(options) {
    var snapshot = options && options.snapshot;
    if (options && typeof options.worlds === 'function' && typeof options.summarize === 'function') {
      snapshot = function () {
        return {projects: options.worlds().map(function (entry) {
          var c = options.summarize(entry[1]);
          return {key: entry[0], missions: c.missions, agents: c.agents, needs: c.needs};
        })};
      };
    }
    if (typeof snapshot !== 'function') throw new TypeError('createSimulationSource needs a snapshot function, or worlds and summarize');
    return {
      kind: 'simulation',
      read: function () {
        var s = snapshot(), p = base('simulation', 'Local simulation');
        p.availability = {state: 'simulated', reason: null,
          message: 'Sample data generated in this browser. Not connected to Coven; nothing here is authoritative.'};
        p.complete = true;
        p.projects = (s.projects || []).map(function (item) {
          return {id: item.key, name: item.key, root: null, missions: item.missions, agents: item.agents, needs: item.needs};
        });
        return Promise.resolve(p);
      },
    };
  }

  function versionParts(value) {
    if (typeof value !== 'string') return null;
    var m = /^(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?$/.exec(value);
    // Require the whole string (including no final newline) and exact numeric components.
    if (!m || m[0] !== value) return null;
    var parts = [Number(m[1]), Number(m[2]), Number(m[3] || 0)];
    return parts.every(Number.isSafeInteger) ? parts : null;
  }
  function versionAtMost(a, b) {
    for (var i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] < b[i]; }
    return true;
  }

  function validProject(item) {
    return item && typeof item.id === 'string' && item.id && typeof item.name === 'string'
      && typeof item.root === 'string' && item.root;
  }
  function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function hasOwn(value, key) { return Object.prototype.hasOwnProperty.call(value, key); }
  function validTime(value) { return Number.isFinite(value) && Math.abs(value) <= 8640000000000000; }
  function validDuration(value) { return Number.isFinite(value) && value >= 0; }

  /** Reduces projects.list pages into a Projection. Pure: time and connection come from options. */
  function fromProjectsList(pagesByCursor, options) {
    var label = 'Fixture shaped after Cave Client v1 projects.list';
    var o = options || {};
    if (o.connection === 'disconnected') return unavailable('fixture', label, 'disconnected');
    if (o.connection !== undefined && o.connection !== 'connected') {
      return unavailable('fixture', label, 'fixture_invalid', 'Connection must be connected or disconnected.');
    }
    var now = o.now, observedAt = o.observedAt, staleAfterMs = o.staleAfterMs;
    if ((now != null && !validTime(now)) || (observedAt != null && !validTime(observedAt))) {
      return unavailable('fixture', label, 'fixture_invalid', 'Observation and current times must be finite, valid Date timestamps.');
    }
    if (staleAfterMs != null && !validDuration(staleAfterMs)) {
      return unavailable('fixture', label, 'fixture_invalid', 'The freshness window must be a finite, non-negative duration.');
    }
    if (!isRecord(pagesByCursor) || !hasOwn(pagesByCursor, '')) {
      return unavailable('fixture', label, 'fixture_invalid', 'There is no first page.');
    }
    var projects = [], ids = new Set(), cursor = '', seen = new Set(), complete = false;
    for (var n = 0; n < MAX_PAGES; n++) {
      if (!hasOwn(pagesByCursor, cursor)) break;
      var page = pagesByCursor[cursor];
      if (!isRecord(page)) return unavailable('fixture', label, 'fixture_invalid', 'Each page must be an object.');
      var version = versionParts(page.apiVersion);
      if (!version || version[0] !== SUPPORTED_API_MAJOR) {
        return unavailable('fixture', label, 'unsupported_version',
          'Reported apiVersion ' + JSON.stringify(page.apiVersion) + '; supported major version ' + SUPPORTED_API_MAJOR + '.');
      }
      var minimum = versionParts(page.minimumClientVersion);
      if (page.minimumClientVersion !== undefined && !minimum) {
        return unavailable('fixture', label, 'fixture_invalid', 'minimumClientVersion must be a complete numeric version.');
      }
      if (minimum && !versionAtMost(minimum, versionParts(CLIENT_VERSION))) {
        return unavailable('fixture', label, 'incompatible_version',
          'Requires client ' + page.minimumClientVersion + '; this client is ' + CLIENT_VERSION + '.');
      }
      if (!Array.isArray(page.projects) || !page.projects.every(validProject)) {
        return unavailable('fixture', label, 'fixture_invalid', 'Each project needs a non-empty id, a name, and a non-empty root.');
      }
      for (var i = 0; i < page.projects.length; i++) {
        var item = page.projects[i];
        if (ids.has(item.id)) return unavailable('fixture', label, 'fixture_invalid', 'Duplicate project id ' + item.id + '.');
        ids.add(item.id);
        // projects.list has no mission or agent data, so those counts are unknown.
        projects.push({id: item.id, name: item.name, root: item.root, missions: null, agents: null, needs: null});
      }
      seen.add(cursor);
      if (page.nextCursor === null || page.nextCursor === undefined) { complete = true; break; }
      if (typeof page.nextCursor !== 'string') return unavailable('fixture', label, 'fixture_invalid', 'A page cursor must be a string or null.');
      cursor = page.nextCursor;
      if (seen.has(cursor)) break;
    }
    var p = base('fixture', label);
    var ageMs = now != null && observedAt != null ? Math.max(0, now - observedAt) : null;
    p.projects = projects;
    p.complete = complete;
    p.freshness = {observedAt: observedAt != null ? new Date(observedAt).toISOString() : null, ageMs: ageMs,
      staleAfterMs: staleAfterMs != null ? staleAfterMs : null};
    if (!complete) {
      p.availability = {state: 'reconciling', reason: 'incomplete', message: 'A page cursor could not be followed, so this list is incomplete. '
        + projects.length + ' Project' + (projects.length === 1 ? ' is' : 's are') + ' shown; the total is unknown.'};
    } else if (ageMs === null || p.freshness.staleAfterMs === null || ageMs > p.freshness.staleAfterMs) {
      p.availability = {state: 'stale', reason: ageMs === null ? 'unknown_age' : p.freshness.staleAfterMs === null ? 'unknown_window' : 'aged',
        message: (ageMs === null ? 'The observation time is unknown.' : p.freshness.staleAfterMs === null ? 'The freshness window is unknown.' : 'Last observed ' + formatAge(ageMs) + ' ago, outside the '
          + formatAge(p.freshness.staleAfterMs) + ' freshness window.') + ' Shown as last known, not current.'};
    } else {
      p.availability = {state: 'fresh', reason: null, message: 'Observed ' + formatAge(ageMs) + ' ago. This is static fixture data, not live Coven data.'};
    }
    return p;
  }

  function createFixtureSource(options) {
    var o = options || {}, label = 'Fixture shaped after Cave Client v1 projects.list';
    var load = o.load, now = o.now === undefined ? Date.now : o.now, scenario = o.scenario || DEFAULT_SCENARIO;
    if (typeof load !== 'function') throw new TypeError('createFixtureSource needs a load function');
    return {
      kind: 'fixture',
      scenario: scenario,
      read: function () {
        return Promise.resolve().then(load).then(function (fixture) {
          if (!isRecord(fixture) || !isRecord(fixture.scenarios)) {
            return unavailable('fixture', label, 'fixture_invalid', 'There is no scenarios object.');
          }
          if (!hasOwn(fixture.scenarios, scenario)) {
            return unavailable('fixture', label, 'unknown_scenario', 'Known scenarios: ' + Object.keys(fixture.scenarios).join(', ') + '.');
          }
          var s = fixture.scenarios[scenario];
          if (!isRecord(s)) return unavailable('fixture', label, 'fixture_invalid', 'Each scenario must be an object.');
          if (s.observedAgoMs != null && !validDuration(s.observedAgoMs)) {
            return unavailable('fixture', label, 'fixture_invalid', 'The observation age must be a finite, non-negative duration.');
          }
          var t = now();
          return fromProjectsList(s.pages, {
            connection: s.connection, now: t,
            observedAt: t != null && s.observedAgoMs != null ? t - s.observedAgoMs : undefined,
            staleAfterMs: fixture.staleAfterMs,
          });
        }, function (error) {
          return unavailable('fixture', label, 'fixture_unreadable', error && error.message ? '(' + error.message + ')' : '');
        }).catch(function (error) {
          return unavailable('fixture', label, 'fixture_invalid', error && error.message ? '(' + error.message + ')' : '');
        });
      },
    };
  }

  function isBriefScenario(scenario) { return typeof scenario === 'string' && scenario.indexOf(BRIEF_PREFIX) === 0; }

  /**
   * Reads one synthetic Brief success policy case (#35) into a Projection. Pure: the fixture and the
   * policy model come from the caller, and "now" is the fixture's own asOf time, so a case always
   * evaluates the same way. It carries no Projects and is never authoritative.
   */
  function fromBriefCases(fixture, scenario, model) {
    if (!model || typeof model.evaluate !== 'function' || typeof model.summarize !== 'function') {
      return unavailable('fixture', BRIEF_LABEL, 'policy_model_missing');
    }
    if (!isRecord(fixture) || fixture.synthetic !== true || !isRecord(fixture.cases) || !isRecord(fixture.policies)) {
      return unavailable('fixture', BRIEF_LABEL, 'brief_invalid', 'Brief cases must be marked synthetic and have cases and policies.');
    }
    if (!hasOwn(fixture.cases, scenario)) {
      return unavailable('fixture', BRIEF_LABEL, 'unknown_scenario', 'Known Brief cases: ' + Object.keys(fixture.cases).join(', ') + '.');
    }
    var asOf = typeof fixture.asOf === 'string' ? Date.parse(fixture.asOf) : NaN;
    if (!validTime(asOf)) return unavailable('fixture', BRIEF_LABEL, 'brief_invalid', 'asOf must be an ISO date and time.');
    var c = fixture.cases[scenario];
    if (!isRecord(c) || typeof c.title !== 'string' || !hasOwn(fixture.policies, c.policy) || !isRecord(c.record)) {
      return unavailable('fixture', BRIEF_LABEL, 'brief_invalid', 'Each case needs a title, a known policy, and a record.');
    }
    var policy = fixture.policies[c.policy];
    var p = base('fixture', BRIEF_LABEL);
    p.availability = {state: 'synthetic', reason: null, message: 'Synthetic Brief policy case, evaluated as of ' + fixture.asOf
      + '. This is not Coven data, and nothing here is authoritative.'};
    p.complete = true;
    p.brief = {scenario: scenario, title: c.title, mission: typeof c.mission === 'string' ? c.mission : null,
      summary: typeof c.summary === 'string' ? c.summary : '', policy: policy, policySummary: model.summarize(policy),
      record: c.record, result: model.evaluate(policy, c.record, asOf), cases: Object.keys(fixture.cases)};
    return p;
  }

  function createBriefFixtureSource(options) {
    var o = options || {}, load = o.load, scenario = o.scenario;
    if (typeof load !== 'function') throw new TypeError('createBriefFixtureSource needs a load function');
    return {
      kind: 'fixture',
      scenario: scenario,
      read: function () {
        return Promise.resolve().then(load).then(function (fixture) {
          return fromBriefCases(fixture, scenario, o.model);
        }, function (error) {
          return unavailable('fixture', BRIEF_LABEL, 'fixture_unreadable', error && error.message ? '(' + error.message + ')' : '');
        }).catch(function (error) {
          return unavailable('fixture', BRIEF_LABEL, 'brief_invalid', error && error.message ? '(' + error.message + ')' : '');
        });
      },
    };
  }

  function formatAge(ms) {
    if (ms < 1000) return 'under 1 s';
    if (ms < 60000) return Math.round(ms / 1000) + ' s';
    if (ms < 3600000) return Math.round(ms / 60000) + ' min';
    return Math.round(ms / 3600000) + ' h';
  }

  var STATE_LABELS = {simulated: 'Simulation', fresh: 'Fixture · fresh', stale: 'Fixture · stale',
    reconciling: 'Fixture · reconciling', synthetic: 'Fixture · synthetic', unavailable: 'Unavailable'};

  /** View model for a projection. Pure, and shared by the page and the tests. */
  function describe(projection) {
    var a = projection.availability;
    var unknown = function (value) { return value === null || value === undefined ? 'unknown' : String(value); };
    return {
      state: a.state,
      label: STATE_LABELS[a.state] || a.state,
      reason: a.reason,
      message: a.message,
      source: projection.source.label + ' (not authoritative)',
      complete: projection.complete,
      rows: projection.projects.map(function (p) {
        return {name: p.name, root: p.root === null ? 'none (simulation)' : p.root, id: p.id,
          missions: unknown(p.missions), agents: unknown(p.agents), needs: unknown(p.needs)};
      }),
    };
  }

  var registered = null;
  function register(source) { registered = source; return source; }
  function current() { return registered; }

  var STYLE = [
    'body[data-projection-mode]{margin:0;background:var(--background,#f6f4ef);color:var(--foreground,#1d1b16);font:15px/1.5 var(--f-body,system-ui,sans-serif)}',
    '.projection-view{box-sizing:border-box;max-width:960px;margin:0 auto;padding:24px 16px 48px}',
    '.projection-view h1{font:400 28px/1.2 var(--f-display,Georgia,serif);margin:0 0 4px}',
    '.projection-view .pv-source{color:var(--muted-foreground,#6b675e);margin:0 0 16px}',
    '.projection-view .pv-status{border:1px solid var(--border-strong,#c9c3b6);border-radius:var(--radius,10px);padding:12px 14px;margin:0 0 16px;background:var(--card,#fff)}',
    '.projection-view .pv-status[data-state=unavailable],.projection-view .pv-status[data-state=stale],.projection-view .pv-status[data-state=reconciling]{border-color:var(--attention,#c2410c)}',
    '.projection-view .pv-badge{display:inline-block;font:500 12px/1 var(--f-mono,ui-monospace,monospace);text-transform:uppercase;letter-spacing:.04em;margin-right:8px}',
    '.projection-view .pv-scroll{overflow-x:auto}',
    '.projection-view .pv-table{width:100%;border-collapse:collapse}',
    '.projection-view .pv-table caption{text-align:left;padding:0 0 6px}',
    '.projection-view th,.projection-view td{text-align:left;padding:6px 12px 6px 0;border-bottom:1px solid var(--border,#e4dfd4);vertical-align:top}',
    '.projection-view td code{font:13px var(--f-mono,ui-monospace,monospace);overflow-wrap:anywhere}',
    '@media (max-width:640px){.projection-view .pv-table,.projection-view .pv-table tbody,.projection-view .pv-table tr,.projection-view .pv-table td{display:block}'
      + '.projection-view .pv-table .pv-head{display:none}.projection-view .pv-table tr{border-bottom:1px solid var(--border,#e4dfd4);padding:8px 0}'
      + '.projection-view .pv-table td{border:0;padding:2px 0;display:grid;grid-template-columns:7.5em 1fr;gap:8px}'
      + '.projection-view .pv-table td::before{content:attr(data-label);color:var(--muted-foreground,#6b675e)}}',
    '.projection-view nav{margin:20px 0 0;color:var(--muted-foreground,#6b675e)}',
    '.projection-view nav a{color:inherit;margin-right:12px}',
  ].join('\n');

  function element(doc, tag, props, children) {
    var node = doc.createElement(tag);
    Object.keys(props || {}).forEach(function (key) {
      if (key === 'text') node.textContent = props[key];
      else node.setAttribute(key, props[key]);
    });
    (children || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }

  /** Browser only. Replaces the simulation UI with a projection view for a non-simulation mode. */
  function renderStandalone(doc, selection, options) {
    var o = options || {}, win = doc.defaultView;
    doc.body.setAttribute('data-projection-mode', selection.mode);
    var app = doc.getElementById('app');
    if (app) app.hidden = true;
    doc.head.appendChild(element(doc, 'style', {text: STYLE}));
    var status = element(doc, 'div', {'class': 'pv-status', role: 'status', 'aria-live': 'polite', 'data-state': 'unavailable'},
      [element(doc, 'span', {'class': 'pv-badge', text: 'Loading'})]);
    var table = element(doc, 'table', {'class': 'pv-table', hidden: ''});
    var scroll = element(doc, 'div', {'class': 'pv-scroll'}, [table]);
    var view = element(doc, 'main', {'class': 'projection-view', 'aria-labelledby': 'projectionTitle'}, [
      element(doc, 'h1', {id: 'projectionTitle', text: selection.mode === 'fixture' && isBriefScenario(selection.scenario) ? 'Coven Compass · Brief policy case' : 'Coven Compass · Projects'}),
      element(doc, 'p', {'class': 'pv-source', text: 'Projection source: ' + (selection.requested || selection.mode) + '. The simulation is not running in this mode.'}),
      status, scroll,
      element(doc, 'nav', {'aria-label': 'Projection sources'}, ['simulation', 'fixture&scenario=fresh', 'fixture&scenario=stale',
        'fixture&scenario=partial', 'fixture&scenario=disconnected', 'fixture&scenario=unsupported-version', 'fixture&scenario=brief-rubric-pass'].map(function (q) {
        return element(doc, 'a', {href: '?source=' + q, text: q.replace('fixture&scenario=', 'fixture: ')});
      })),
    ]);
    doc.body.appendChild(view);

    var source, briefMode = selection.mode === 'fixture' && isBriefScenario(selection.scenario);
    if (briefMode) {
      source = createBriefFixtureSource({scenario: selection.scenario, model: o.model || win.CovenBriefPolicy, load: o.load || function () {
        return win.fetch(BRIEF_FIXTURE_URL, {cache: 'no-store'}).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        });
      }});
    } else if (selection.mode === 'fixture') {
      source = createFixtureSource({scenario: selection.scenario, now: o.now, load: o.load || function () {
        return win.fetch(FIXTURE_URL, {cache: 'no-store'}).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        });
      }});
    } else {
      source = {kind: 'invalid', read: function () {
        return Promise.resolve(unavailable('invalid', 'No source', 'invalid_mode', 'Requested ' + JSON.stringify(selection.requested) + '.'));
      }};
    }
    register(source);
    return source.read().then(function (projection) {
      var d = describe(projection);
      status.setAttribute('data-state', d.state);
      status.textContent = '';
      status.appendChild(element(doc, 'span', {'class': 'pv-badge', text: d.label}));
      status.appendChild(doc.createTextNode(d.message));
      status.appendChild(element(doc, 'div', {'class': 'pv-source', text: d.source}));
      table.textContent = '';
      if (d.rows.length) {
        table.removeAttribute('hidden');
        table.appendChild(element(doc, 'caption', {'class': 'pv-source', text: d.complete ? 'Projects' : 'Projects (incomplete)'}));
        var headings = ['Name', 'Root', 'Cave id', 'Missions', 'Agents', 'Needs you'];
        table.appendChild(element(doc, 'tr', {'class': 'pv-head'}, headings.map(function (h) {
          return element(doc, 'th', {scope: 'col', text: h});
        })));
        d.rows.forEach(function (r) {
          // data-label lets narrow screens show each row as labelled lines instead of a squeezed table.
          var cell = function (i, props, children) { props['data-label'] = headings[i]; return element(doc, 'td', props, children); };
          table.appendChild(element(doc, 'tr', {}, [cell(0, {text: r.name}),
            cell(1, {}, [element(doc, 'code', {text: r.root})]), cell(2, {}, [element(doc, 'code', {text: r.id})]),
            cell(3, {text: r.missions}), cell(4, {text: r.agents}), cell(5, {text: r.needs})]));
        });
      } else {
        table.setAttribute('hidden', '');
      }
      return projection;
    });
  }

  return Object.freeze({
    SCHEMA: SCHEMA, MODES: MODES.slice(), FIXTURE_URL: FIXTURE_URL, BRIEF_FIXTURE_URL: BRIEF_FIXTURE_URL, CLIENT_VERSION: CLIENT_VERSION,
    selectMode: selectMode, createSimulationSource: createSimulationSource, createFixtureSource: createFixtureSource,
    fromProjectsList: fromProjectsList, isBriefScenario: isBriefScenario, fromBriefCases: fromBriefCases,
    createBriefFixtureSource: createBriefFixtureSource, describe: describe, register: register, current: current,
    renderStandalone: renderStandalone,
  });
}));
