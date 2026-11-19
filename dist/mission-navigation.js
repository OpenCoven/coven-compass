(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CovenMissionNavigation = api;
}(typeof window === 'object' ? window : null, function () {
  'use strict';

  var VIEWS = ['brief', 'council', 'tasks', 'agents'];
  var DETAILS = ['card', 'side'];
  var QUERY_KEYS = ['view', 'familiar', 'detail'];
  var LEGACY_SEGMENT = 'castle'; // read-only alias for pre-rename bookmarks; never written

  function identifier(value) {
    return typeof value === 'string' && value.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(value);
  }

  function route(scope, project, mission, view, detail, familiar) {
    return {
      scope: scope,
      project: project || null,
      mission: mission || null,
      view: view || null,
      detail: detail || null,
      familiar: familiar || null
    };
  }

  function parseQuery(query) {
    var values = Object.create(null);
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

  function parse(hash) {
    try {
      if (typeof hash !== 'string') return null;
      var raw = hash.charAt(0) === '#' ? hash.slice(1) : hash;
      if (!raw) return route('coven');
      if (raw.indexOf('#') >= 0) return null;
      if (raw.charAt(0) !== '/') {
        // The original Site used an encoded Project name as the entire fragment.
        var legacyProject = decodeURIComponent(raw);
        return identifier(legacyProject) ? route('project', legacyProject) : null;
      }
      var question = raw.indexOf('?');
      var path = question < 0 ? raw : raw.slice(0, question);
      var query = question < 0 ? '' : raw.slice(question + 1);
      if (path === '/coven') return query ? null : route('coven');
      var parts = path.split('/');
      // Routes are written as /project/. Before the Coven Compass rename they were
      // written as /castle/, and those bookmarks still resolve to the same Project.
      if ((parts[1] !== 'project' && parts[1] !== LEGACY_SEGMENT) || (parts.length !== 3 && parts.length !== 5)) return null;
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

  function format(value) {
    try {
      if (!value || value.scope === 'coven') return '#/coven';
      if ((value.scope !== 'project' && value.scope !== 'mission') || !identifier(value.project)) return '#/coven';
      var hash = '#/project/' + encodeURIComponent(value.project);
      if (value.scope === 'project') return hash;
      if (!identifier(value.mission)) return '#/coven';
      var view = value.view == null ? 'brief' : value.view;
      var detail = value.detail == null ? 'card' : value.detail;
      var familiar = value.familiar == null ? null : value.familiar;
      if (VIEWS.indexOf(view) < 0 || DETAILS.indexOf(detail) < 0 || (familiar !== null && !identifier(familiar))) return '#/coven';
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

  function normalizeSelection(project) {
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

  return Object.freeze({parse: parse, format: format, normalizeSelection: normalizeSelection});
}));
