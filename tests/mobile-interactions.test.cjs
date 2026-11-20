'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mobile = require('../dist/mobile-interactions.js');
const p = (id, x, y) => ({id, x, y});
const pose = {zoom: 1, px: 40, py: -20};
const rect = {left: 10, top: 120, width: 392, height: 588};
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} must equal ${b}`);

function worldAt(camera, point) {
  const k = Math.min(rect.width, rect.height) * camera.zoom / 784;
  return {x: camera.px + (point.x - rect.left - rect.width / 2) / k,
    y: camera.py + (point.y - rect.top - rect.height / 2) / k};
}

test('one pointer produces screen deltas; adding, removing, or replacing a pointer rebases', () => {
  const single = mobile.gestureDelta([p(1, 20, 30)], [p(1, 35, 45)]);
  assert.deepEqual({count: single.count, reset: single.reset, dx: single.dx, dy: single.dy, scale: single.scale},
    {count: 1, reset: false, dx: 15, dy: 15, scale: 1});
  for (const [before, after] of [
    [[], [p(1, 20, 30)]],
    [[p(1, 20, 30)], [p(1, 20, 30), p(2, 180, 200)]],
    [[p(1, 20, 30), p(2, 180, 200)], [p(2, 180, 200)]],
    [[p(1, 20, 30)], [p(3, 180, 200)]],
    [[p(1, 20, 30), p(2, 180, 200)], [p(1, 20, 30), p(3, 180, 200)]],
  ]) {
    const delta = mobile.gestureDelta(before, after);
    assert.equal(delta.reset, true);
    assert.equal(delta.dx, 0);
    assert.equal(delta.dy, 0);
    assert.equal(delta.scale, 1);
    assert.deepEqual(mobile.applyCameraGesture(pose, delta, rect), pose);
  }
});

test('two-pointer ordering does not change centroid translation or pinch scale', () => {
  const before = [p(7, 100, 150), p(9, 200, 150)];
  const after = [p(9, 250, 190), p(7, 50, 190)];
  const delta = mobile.gestureDelta(before, after);
  assert.equal(delta.reset, false);
  assert.equal(delta.dx, 0);
  assert.equal(delta.dy, 40);
  assert.equal(delta.scale, 2);
  assert.deepEqual(delta.previousCenter, {x: 150, y: 150});
  assert.deepEqual(delta.center, {x: 150, y: 190});
});

test('simultaneous pinch and pan preserve the world point under the moving centroid', () => {
  const delta = mobile.gestureDelta([p(1, 80, 220), p(2, 180, 220)], [p(1, 60, 270), p(2, 260, 270)]);
  const next = mobile.applyCameraGesture(pose, delta, rect);
  const originalAnchor = worldAt(pose, delta.previousCenter), movedAnchor = worldAt(next, delta.center);
  assert.equal(next.zoom, 2);
  near(originalAnchor.x, movedAnchor.x);
  near(originalAnchor.y, movedAnchor.y);
  assert.deepEqual(pose, {zoom: 1, px: 40, py: -20}, 'input camera is not mutated');
});

test('centroid anchoring still holds when zoom reaches its upper or lower bound', () => {
  for (const scale of [100, .0001]) {
    const delta = {count: 2, reset: false, scale, dx: 15, dy: 20, previousCenter: {x: 190, y: 380}, center: {x: 205, y: 400}};
    const next = mobile.applyCameraGesture(pose, delta, rect, {minZoom: .25, maxZoom: 2});
    assert.equal(next.zoom, scale > 1 ? 2 : .25);
    const before = worldAt(pose, delta.previousCenter), after = worldAt(next, delta.center);
    near(before.x, after.x);
    near(before.y, after.y);
  }
});

test('one-finger and mouse drags translate the map in screen units', () => {
  const delta = mobile.gestureDelta([p(1, 100, 200)], [p(1, 140, 180)]);
  assert.deepEqual(mobile.applyCameraGesture(pose, delta, rect), {px: -40, py: 20, zoom: 1});
  assert.deepEqual(mobile.applyCameraGesture({...pose, zoom: 2}, delta, rect), {px: 0, py: 0, zoom: 2});
});

test('obsolete gesture preferences cannot change the plane', () => {
  const delta = {count: 1, reset: false, dx: 10, dy: -30};
  const oldCamera = {...pose, yaw: 145, pitch: 78};
  assert.deepEqual(mobile.applyCameraGesture(oldCamera, delta, rect, {mode: 'orbit'}), {px: 20, py: 40, zoom: 1});
});

test('pan limits, camera lock, and a collapsed map prevent runaway movement', () => {
  const delta = {count: 1, reset: false, dx: -100000, dy: 100000};
  const bounded = mobile.applyCameraGesture(pose, delta, rect, {panLimit: 100});
  assert.equal(bounded.px, 100);
  assert.equal(bounded.py, -100);
  assert.deepEqual(mobile.applyCameraGesture(pose, delta, rect, {locked: true}), pose);
  assert.deepEqual(mobile.applyCameraGesture({...pose, locked: true}, delta, rect), pose);
  assert.deepEqual(mobile.applyCameraGesture(pose, delta, {...rect, width: 0}), pose);
});

test('invalid or degenerate pointers reset without NaN or a synthetic gesture', () => {
  for (const points of [null, [], [p(1, NaN, 20)], [p(1, 0, Infinity)],
    [p(1, 0, 0), p(1, 50, 50)], [p(1, 0, 0), p(2, 0, 0)],
    [p(1, 0, 0), p(2, 50, 50), p(3, 100, 100)]]) {
    const delta = mobile.gestureDelta([p(1, 20, 20), p(2, 50, 50)], points);
    assert.equal(delta.reset, true);
    assert.equal(delta.scale, 1);
    for (const key of ['count', 'dx', 'dy', 'scale']) assert.equal(Number.isFinite(delta[key]), true);
  }
  const invalidPose = mobile.applyCameraGesture({zoom: -100, px: Infinity, py: NaN},
    {count: 2, reset: false, scale: Infinity, center: {x: NaN, y: 0}, previousCenter: {x: 0, y: 0}}, rect,
    {minZoom: NaN, maxZoom: Infinity, panLimit: Infinity});
  for (const value of Object.values(invalidPose)) assert.equal(Number.isFinite(value), true);
  assert.ok(invalidPose.zoom >= .04 && invalidPose.zoom <= 6);
});

test('visible viewport geometry accounts for keyboard height and visual viewport offset', () => {
  const geometry = mobile.visualViewportGeometry({width: 390, height: 430, offsetTop: 50, offsetLeft: 0, scale: 1},
    {width: 390, height: 844, editable: true});
  assert.deepEqual(geometry, {left: 0, top: 50, width: 390, height: 430, scale: 1, right: 390, bottom: 480,
    keyboardInset: 364, keyboardOpen: true});
  assert.equal(mobile.visualViewportGeometry({width: 390, height: 760, scale: 1}, {width: 390, height: 844, editable: true}).keyboardOpen, false,
    'a small browser-toolbar height change is not classified as a keyboard');
});

test('pinch zoom and noneditable focus do not report a keyboard despite a smaller visual viewport', () => {
  const fallback = {width: 390, height: 844, editable: true};
  const zoomed = mobile.visualViewportGeometry({width: 195, height: 422, offsetTop: 100, scale: 2}, fallback);
  assert.equal(zoomed.keyboardInset, 322);
  assert.equal(zoomed.keyboardOpen, false);
  assert.equal(mobile.visualViewportGeometry({width: 390, height: 420, scale: 1}, {...fallback, editable: false}).keyboardOpen, false);
});

test('viewport fallback and extreme inputs always produce finite bounded geometry', () => {
  const fallback = {width: 390, height: 844, editable: true};
  assert.deepEqual(mobile.visualViewportGeometry(null, fallback), {
    left: 0, top: 0, width: 390, height: 844, scale: 1, right: 390, bottom: 844, keyboardInset: 0, keyboardOpen: false,
  });
  for (const geometry of [mobile.visualViewportGeometry(),
    mobile.visualViewportGeometry({width: Infinity, height: NaN, offsetLeft: -100, offsetTop: 1e300, scale: NaN}, fallback),
    mobile.visualViewportGeometry({width: -10, height: -10, scale: 1e300}, {width: NaN, height: Infinity})]) {
    for (const [key, value] of Object.entries(geometry)) if (key !== 'keyboardOpen') assert.equal(Number.isFinite(value), true, key);
    assert.ok(geometry.left >= 0 && geometry.top >= 0 && geometry.width >= 1 && geometry.height >= 1);
    assert.ok(geometry.keyboardInset >= 0);
  }
});

test('browser and CommonJS share the same three-function API', () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/mobile-interactions.js'), 'utf8'), {window});
  assert.deepEqual(Object.keys(window.CovenMobileInteractions), ['gestureDelta', 'applyCameraGesture', 'visualViewportGeometry']);
  assert.equal(window.CovenMobileInteractions.gestureDelta([], [p(1, 0, 0)]).reset, true);
});
