(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CovenMobileInteractions = api;
}(typeof window === 'object' ? window : null, function () {
  'use strict';

  var MAX_COORDINATE = 1000000;

  function bounded(value, fallback, min, max) {
    return Math.max(min, Math.min(max, typeof value === 'number' && Number.isFinite(value) ? value : fallback));
  }

  function point(value) {
    if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
    return {x: bounded(value.x, 0, -MAX_COORDINATE, MAX_COORDINATE), y: bounded(value.y, 0, -MAX_COORDINATE, MAX_COORDINATE)};
  }

  function pointers(values) {
    if (!Array.isArray(values) || values.length < 1 || values.length > 2) return null;
    var seen = new Set(), result = [];
    for (var i = 0; i < values.length; i++) {
      var value = values[i], position = point(value);
      if (!position || (typeof value.id !== 'string' && !Number.isFinite(value.id)) || seen.has(value.id)) return null;
      seen.add(value.id);
      result.push({id: value.id, x: position.x, y: position.y});
    }
    return result;
  }

  function center(points) {
    if (!points || !points.length) return {x: 0, y: 0};
    return {
      x: points.reduce(function (sum, p) { return sum + p.x; }, 0) / points.length,
      y: points.reduce(function (sum, p) { return sum + p.y; }, 0) / points.length
    };
  }

  // Coordinates are client CSS pixels. Changing pointer identity or count rebases
  // the gesture: a second finger must not become a large one-finger drag.
  function gestureDelta(previousPoints, currentPoints) {
    var previous = pointers(previousPoints), current = pointers(currentPoints);
    var previousCenter = center(previous), currentCenter = center(current);
    var result = {count: current ? current.length : 0, reset: true, dx: 0, dy: 0, scale: 1, previousCenter: previousCenter, center: currentCenter};
    if (!previous || !current || previous.length !== current.length) return result;
    if (!current.every(function (p) { return previous.some(function (old) { return old.id === p.id; }); })) return result;
    if (current.length === 2) {
      var before = Math.hypot(previous[1].x - previous[0].x, previous[1].y - previous[0].y);
      var after = Math.hypot(current[1].x - current[0].x, current[1].y - current[0].y);
      if (before < .001 || after < .001) return result;
      result.scale = bounded(after / before, 1, .0001, 10000);
    }
    result.dx = currentCenter.x - previousCenter.x;
    result.dy = currentCenter.y - previousCenter.y;
    result.reset = false;
    return result;
  }

  function optionsOf(options) {
    options = options || {};
    var minZoom = bounded(options.minZoom, .04, .00001, 1000);
    var minPitch = bounded(options.minPitch, 0, 0, 89);
    return {
      minZoom: minZoom,
      maxZoom: bounded(options.maxZoom, 6, minZoom, 1000),
      minPitch: minPitch,
      maxPitch: bounded(options.maxPitch, 78, minPitch, 89),
      panLimit: bounded(options.panLimit, 12000, 0, MAX_COORDINATE),
      baseSize: bounded(options.baseSize, 784, 1, MAX_COORDINATE),
      yawPerPixel: bounded(options.yawPerPixel, .4, 0, 10),
      pitchPerPixel: bounded(options.pitchPerPixel, .3, 0, 10),
      mode: options.mode === 'pan' ? 'pan' : 'orbit',
      locked: options.locked === true
    };
  }

  function wrapYaw(yaw) {
    return ((yaw + 180) % 360 + 360) % 360 - 180;
  }

  // Return a new camera pose. The viewport is the map's client bounding rectangle.
  // For two pointers, zoom and translation are computed together so the world
  // point beneath the old centroid lands beneath the new centroid, even at a
  // zoom limit. Rotation is reserved for one-finger orbit mode.
  function applyCameraGesture(camera, delta, rect, options) {
    camera = camera || {};
    var limits = optionsOf(options);
    var pose = {
      yaw: wrapYaw(bounded(camera.yaw, 0, -MAX_COORDINATE, MAX_COORDINATE)),
      pitch: bounded(camera.pitch, 0, limits.minPitch, limits.maxPitch),
      zoom: bounded(camera.zoom, 1, limits.minZoom, limits.maxZoom),
      px: bounded(camera.px, 0, -limits.panLimit, limits.panLimit),
      py: bounded(camera.py, 0, -limits.panLimit, limits.panLimit)
    };
    if (!delta || delta.reset || (delta.count !== 1 && delta.count !== 2) || limits.locked || camera.locked) return pose;
    if (!rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) return pose;
    var width = bounded(rect.width, 1, 1, MAX_COORDINATE), height = bounded(rect.height, 1, 1, MAX_COORDINATE);
    var left = bounded(rect.left, 0, -MAX_COORDINATE, MAX_COORDINATE), top = bounded(rect.top, 0, -MAX_COORDINATE, MAX_COORDINATE);
    var dx = bounded(delta.dx, 0, -MAX_COORDINATE * 2, MAX_COORDINATE * 2);
    var dy = bounded(delta.dy, 0, -MAX_COORDINATE * 2, MAX_COORDINATE * 2);
    var k0 = Math.min(width, height) * pose.zoom / limits.baseSize;
    if (delta.count === 2) {
      var from = point(delta.previousCenter), to = point(delta.center);
      if (!from || !to) return pose;
      var zoom = bounded(pose.zoom * bounded(delta.scale, 1, .0001, 10000), pose.zoom, limits.minZoom, limits.maxZoom);
      var k1 = Math.min(width, height) * zoom / limits.baseSize;
      var cx = left + width / 2, cy = top + height / 2;
      pose.px = bounded(pose.px + (from.x - cx) / k0 - (to.x - cx) / k1, pose.px, -limits.panLimit, limits.panLimit);
      pose.py = bounded(pose.py + (from.y - cy) / k0 - (to.y - cy) / k1, pose.py, -limits.panLimit, limits.panLimit);
      pose.zoom = zoom;
    } else if (limits.mode === 'pan') {
      pose.px = bounded(pose.px - dx / k0, pose.px, -limits.panLimit, limits.panLimit);
      pose.py = bounded(pose.py - dy / k0, pose.py, -limits.panLimit, limits.panLimit);
    } else {
      pose.yaw = wrapYaw(pose.yaw + dx * limits.yawPerPixel);
      pose.pitch = bounded(pose.pitch - dy * limits.pitchPerPixel, pose.pitch, limits.minPitch, limits.maxPitch);
    }
    return pose;
  }

  // fallback = {width: innerWidth, height: innerHeight, editable: boolean}.
  // keyboardInset is the occluded lower layout edge, in CSS pixels; keyboardOpen
  // is deliberately a heuristic gated by an editable focus and a scale near 1.
  function visualViewportGeometry(viewport, fallback) {
    fallback = fallback || {};
    var layoutWidth = bounded(fallback.width, 1, 1, MAX_COORDINATE);
    var layoutHeight = bounded(fallback.height, 1, 1, MAX_COORDINATE);
    viewport = viewport || {};
    var width = bounded(viewport.width, layoutWidth, 1, layoutWidth);
    var height = bounded(viewport.height, layoutHeight, 1, layoutHeight);
    var left = bounded(viewport.offsetLeft, 0, 0, layoutWidth - width);
    var top = bounded(viewport.offsetTop, 0, 0, layoutHeight - height);
    var scale = bounded(viewport.scale, 1, .1, 10);
    var loss = Math.max(0, layoutHeight - height);
    return {
      left: left,
      top: top,
      width: width,
      height: height,
      scale: scale,
      right: left + width,
      bottom: top + height,
      keyboardInset: Math.max(0, layoutHeight - (top + height)),
      keyboardOpen: fallback.editable === true && Math.abs(scale - 1) <= .05 && loss >= Math.max(120, layoutHeight * .2)
    };
  }

  return Object.freeze({gestureDelta: gestureDelta, applyCameraGesture: applyCameraGesture, visualViewportGeometry: visualViewportGeometry});
}));
