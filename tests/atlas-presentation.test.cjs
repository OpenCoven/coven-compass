'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {detailVisible, primaryRequest, placeAnnotation, placeMissionCaption} = require('../dist/atlas-presentation.js');

test('detail enters and exits at distinct projected sizes', () => {
  assert.equal(detailVisible(false, 8, 9, 7), false);
  assert.equal(detailVisible(true, 8, 9, 7), true);
  assert.equal(detailVisible(true, 6, 9, 7), false);
  assert.equal(detailVisible(false, 9, 9, 7), true);
});

test('one pending request is selected without mutating order or keeping resolved requests', () => {
  const pending = [{id: 'b', t: 2}, {id: 'a', t: 1}];
  assert.equal(primaryRequest(pending).id, 'a');
  assert.equal(primaryRequest(pending, 'b').id, 'b');
  assert.equal(primaryRequest(pending, 'resolved').id, 'a');
  assert.equal(primaryRequest([]), undefined);
  assert.deepEqual(pending.map(request => request.id), ['b', 'a']);
});

test('the card and its leader avoid occupied areas and stay inside the stage', () => {
  const frame = {x: 8, y: 8, width: 380, height: 240};
  const blocked = [{x: 90, y: 120, width: 220, height: 100}];
  const card = placeAnnotation({x: 200, y: 105}, {width: 150, height: 40}, frame, blocked, 12);
  assert.deepEqual(card, {x: 125, y: 53, width: 150, height: 40, end: {x: 200, y: 93}});
  assert.equal(placeAnnotation({x: 200, y: 105}, {width: 380, height: 240}, frame, blocked, 12), null);
});

test('mission captions keep their preferred stack until a familiar intersects its task hit area', () => {
  const frame = {x: 4, y: 4, width: 310, height: 225};
  const anchor = {x: 145, y: 112}, radius = 35;
  const seal = {x: 110, y: 77, width: 70, height: 70};
  const rows = [
    {x: 100, y: 152, width: 90, height: 15},
    {x: 94, y: 170, width: 102, height: 14},
    {x: 114, y: 187, width: 62, height: 38},
  ];
  assert.equal(placeMissionCaption(rows, anchor, radius, frame, [seal]), rows);
  const familiar = {x: 154, y: 210, width: 30, height: 30};
  const placed = placeMissionCaption(rows, anchor, radius, frame, [seal, familiar]);
  assert.deepEqual(placed.map(row => row.y), [104.5, 122.5, 139.5]);
  assert.ok(placed.every(row => row.x > seal.x + seal.width && row.x + row.width <= frame.x + frame.width));
  assert.equal(placeMissionCaption(rows, anchor, radius, frame, [frame]), null);
});
