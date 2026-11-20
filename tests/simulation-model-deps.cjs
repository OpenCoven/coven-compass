'use strict';
// Loads dist/simulation-model.js the way dist/index.html does. ART, KIND, CAP, and GATE_NAME
// are evaluated from the page's own one-line definitions, so tests use the real constants.
// normBrief and fam can be stubbed per test, as they were when the fold lived in the page.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const model = require('../dist/simulation-model.js');

const page = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8');
function pageConst(name) {
  const match = new RegExp(`^const ${name} = (.*);$`, 'm').exec(page);
  if (!match) throw new Error(`${name} must be a one-line constant in dist/index.html`);
  return vm.runInNewContext(`(${match[1]})`);
}

function loadSimulationModel(overrides = {}) {
  return model.create({
    ART: pageConst('ART'), KIND: pageConst('KIND'), CAP: pageConst('CAP'), GATE_NAME: pageConst('GATE_NAME'),
    normBrief: () => null, fam: key => ({name: String(key)}),
    ...overrides,
  });
}

module.exports = {loadSimulationModel, pageConst};
