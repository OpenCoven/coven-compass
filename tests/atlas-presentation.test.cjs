'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {detailVisible, primaryRequest, placeAnnotation} = require('../dist/atlas-presentation.js');

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
