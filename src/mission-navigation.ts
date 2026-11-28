// @generated from src/mission-navigation.ts
interface NavigationRoute {
  scope: 'coven' | 'project' | 'mission';
  project: string | null;
  mission: string | null;
  view: string | null;
  detail: string | null;
  familiar: string | null;
}
interface RecordingRoute {
  scope: 'recording';
  digest: string;
  missionPosition: number;
  position: number;
}
interface NavigationSelection {
  world?: { missions?: ReadonlyMap<string, { seats: readonly string[] }>; agents?: ReadonlyMap<string, unknown> };
  sel?: string | null;
  fam?: string | null;
  detail?: string | null;
  pick?: { id: string } | null;
  camBack?: unknown;
}
interface Window {
  CovenMissionNavigation: Readonly<{
    parse(hash: unknown): NavigationRoute | RecordingRoute | null;
    format(value: unknown): string;
    normalizeSelection(project?: NavigationSelection | null): { missionRemoved: boolean; familiarRemoved: boolean; agentRemoved: boolean };
  }>;
}

(function () {
  var VIEWS = ['brief', 'council', 'tasks', 'agents'];
  var DETAILS = ['card', 'side'];
  var QUERY_KEYS = ['view', 'familiar', 'detail'];

  function identifier(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(value);
  }

  function route(scope: NavigationRoute['scope'], project?: string, mission?: string, view?: string, detail?: string, familiar?: string): NavigationRoute {
    return {
      scope: scope,
      project: project || null,
      mission: mission || null,
      view: view || null,
      detail: detail || null,
      familiar: familiar || null
    };
  }

  function parseQuery(query: string): Partial<Record<string, string>> | null {
    const values: Partial<Record<string, string>> = Object.create(null);
    if (!query) return values;
    var pairs = query.split('&');
    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i], at = pair.indexOf('=');
      if (at < 0) return null;
      // Decode explicitly: URLSearchParams silently repairs malformed escapes.
      var key = decodeURIComponent(pair.slice(0, at).replace(/\+/g, ' '));
      var value = decodeURIComponent(pair.slice(at + 1).replace(/\+/g, ' '));
      if (QUERY_KEYS.indexOf(key) < 0 || Object.prototype.hasOwnProperty.call(values, key) || !identifier(value)) return null;
      values[key] = value;
    }
    if (values.view && VIEWS.indexOf(values.view) < 0) return null;
    if (values.detail && DETAILS.indexOf(values.detail) < 0) return null;
    return values;
  }

  function parse(hash: unknown): NavigationRoute | RecordingRoute | null {
    try {
      if (typeof hash !== 'string') return null;
      var raw = hash.charAt(0) === '#' ? hash.slice(1) : hash;
      if (!raw) return route('coven');
      if (raw.indexOf('#') >= 0) return null;
      if (raw.charAt(0) !== '/') return null;
      if (raw.startsWith('/recording/')) {
        var match = /^\/recording\/([a-f0-9]{64})\/mission\/([1-9]\d*)\/event\/([1-9]\d*)$/.exec(raw);
        if (!match || !Number.isSafeInteger(Number(match[2])) || !Number.isSafeInteger(Number(match[3]))) return null;
        return {scope: 'recording', digest: match[1], missionPosition: Number(match[2]), position: Number(match[3])};
      }
      var question = raw.indexOf('?');
      var path = question < 0 ? raw : raw.slice(0, question);
      var query = question < 0 ? '' : raw.slice(question + 1);
      if (path === '/coven') return query ? null : route('coven');
      var parts = path.split('/');
      if (parts[1] !== 'project' || (parts.length !== 3 && parts.length !== 5)) return null;
      var project = decodeURIComponent(parts[2]);
      if (!identifier(project)) return null;
      if (parts.length === 3) return query ? null : route('project', project);
      if (parts[3] !== 'mission') return null;
      var mission = decodeURIComponent(parts[4]);
      if (!identifier(mission)) return null;
      var values = parseQuery(query);
      if (!values) return null;
      return route('mission', project, mission, values.view || 'brief', values.detail || 'card', values.familiar);
    } catch (error) {
      return null;
    }
  }

  function format(input: unknown): string {
    try {
      const value = input as Record<string, unknown> | null | undefined;
      if (!value || value.scope === 'coven') return '#/coven';
      if (value.scope === 'recording') {
        var recordingHash = '#/recording/' + value.digest + '/mission/' + value.missionPosition + '/event/' + value.position;
        return parse(recordingHash)?.scope === 'recording' ? recordingHash : '#/coven';
      }
      if ((value.scope !== 'project' && value.scope !== 'mission') || !identifier(value.project)) return '#/coven';
      var hash = '#/project/' + encodeURIComponent(value.project);
      if (value.scope === 'project') return hash;
      if (!identifier(value.mission)) return '#/coven';
      var view = value.view == null ? 'brief' : value.view;
      var detail = value.detail == null ? 'card' : value.detail;
      var familiar = value.familiar == null ? null : value.familiar;
      if (typeof view !== 'string' || typeof detail !== 'string' || VIEWS.indexOf(view) < 0 || DETAILS.indexOf(detail) < 0 || (familiar !== null && !identifier(familiar))) return '#/coven';
      hash += '/mission/' + encodeURIComponent(value.mission);
      var query = [];
      if (detail === 'side' || view !== 'brief') query.push('view=' + encodeURIComponent(view));
      if (familiar !== null) query.push('familiar=' + encodeURIComponent(familiar));
      if (detail === 'side') query.push('detail=side');
      return hash + (query.length ? '?' + query.join('&') : '');
    } catch (error) {
      return '#/coven';
    }
  }

  function normalizeSelection(project?: NavigationSelection | null) {
    var result = {missionRemoved: false, familiarRemoved: false, agentRemoved: false};
    if (!project || !project.world || !project.world.missions || !project.world.agents) return result;
    var mission = project.sel ? project.world.missions.get(project.sel) : null;
    if (project.sel && !mission) {
      result.missionRemoved = true;
      result.familiarRemoved = !!project.fam;
      result.agentRemoved = !!project.pick;
      project.sel = null;
      project.fam = null;
      project.detail = null;
      project.pick = null;
      project.camBack = null;
      return result;
    }
    if (project.fam && (!mission || !mission.seats.includes(project.fam))) {
      project.fam = null;
      result.familiarRemoved = true;
    }
    if (project.pick && !project.world.agents.has(project.pick.id)) {
      project.pick = null;
      result.agentRemoved = true;
    }
    return result;
  }

  const api = Object.freeze({parse, format, normalizeSelection});
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window === 'object') window.CovenMissionNavigation = api;
})();
