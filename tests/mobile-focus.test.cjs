'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
const start = source.indexOf('function atlasFocusSelection(');
let implementation;
for (let end = source.indexOf('\n', start); end !== -1; end = source.indexOf('\n', end + 1)) {
  const candidate = source.slice(start, end);
  try { new vm.Script(`(${candidate}\n)`); implementation = candidate; break; }
  catch (error) { if (!(error instanceof SyntaxError)) throw error; }
}

test('leaving mission scope returns focus to an available mobile, desktop, or map action', () => {
  assert.ok(implementation, 'execute the actual selection focus helper');
  for (const available of ['atlasMobileMissions', 'atlasMissions', 'stage']) {
    const focused = [];
    const elements = Object.fromEntries(['atlasMobileMissions', 'atlasMissions', 'stage'].map(id => [id, {
      isConnected: true,
      closest: () => null,
      getClientRects: () => id === available || id === 'stage' ? [{}] : [],
      focus: () => focused.push(id),
    }]));
    const context = vm.createContext({cur: () => ({sel: null}), $: id => elements[id], document: {querySelector: () => null, querySelectorAll: () => []}});
    new vm.Script(implementation).runInContext(context);
    context.atlasFocusSelection(true);
    assert.deepEqual(focused, [available], 'CSS-hidden header controls must not receive fallback focus');
  }
});
