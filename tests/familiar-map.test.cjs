const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
const fragment = (a, b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
const deps = fragment('const NS =', 'const $ =');
const layout = vm.runInNewContext(deps + '\n' + fragment('const pol =','const unit =') + '\n' +
  'const seatId = (m,k) => m + ":" + k;\n' + fragment('function layoutOf(', 'function makeProject(') + '\nlayoutOf');

test('each council badge sits between its mission and its own agent cluster', () => {
  const trace = [{type: 'mission.opened', mission: 'm'}];
  for (const familiar of ['astra','cody','echo','charm']) trace.push({type: 'council.seated', mission: 'm', familiar});
  const world = layout(trace);
  const angle = world.ang.get('m') * Math.PI / 180;
  const mission = [world.lead * Math.cos(angle), world.lead * Math.sin(angle)];
  const positions = [...world.seat.values()];
  for (const seat of positions) {
    const dx = seat.bx - mission[0], dy = seat.by - mission[1];
    assert.ok(Math.hypot(dx, dy) > 65, 'badge clears the mission ring');
    assert.ok(dx * (seat.x - seat.bx) + dy * (seat.y - seat.by) > 0, 'agents sit outward');
    for (const other of positions) if (seat !== other) assert.ok(Math.hypot(seat.bx - other.bx, seat.by - other.by) > 32);
  }
});

test('a legacy saved familiar keeps its valid symbol, color and roles', () => {
  const FAM = Object.fromEntries(['astra','cody','echo','charm'].map(k => [k, {}]));
  const context = {FAM, ROLES: {Researcher: 1, Hacker: 1, Correspondent: 1, Reviewer: 1, Recorder: 1},
    document: {documentElement: {style: {setProperty() {}}}}};
  vm.runInNewContext(fragment('const SYMS =','applyFams(store.get') + '\napplyFams({cody:{solid:"Cube",sym:"hex",roles:["Reviewer"],color:"#6FCFB8"}});', context);
  assert.equal(FAM.cody.sym, 'hex');
  assert.equal(FAM.cody.color, '#6FCFB8');
  assert.equal(FAM.cody.role, 'Reviewer');
  assert.equal(FAM.cody.solid, undefined);
});
