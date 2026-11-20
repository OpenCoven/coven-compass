const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
const meshes = vm.runInNewContext(source.slice(source.indexOf('const SOLID ='), source.indexOf('function solidPreview')) + '\nSOLID');
test('familiar solids have regular faces, equal edges, and a closed surface', () => {
  const topology = {Tetrahedron: [4, 3], Cube: [6, 4], Octahedron: [8, 3], Dodecahedron: [12, 5], Icosahedron: [20, 3]};
  assert.deepEqual(Object.keys(meshes).sort(), Object.keys(topology).sort());
  for (const [name, [faces, sides]] of Object.entries(topology)) {
    const {V, F} = meshes[name];
    assert.equal(F.length, faces);
    const edges = new Map(), lengths = [];
    for (const {i: indices} of F) {
      assert.equal(indices.length, sides);
      indices.forEach((a, j) => {
        const b = indices[(j + 1) % sides], key = [Math.min(a,b), Math.max(a,b)].join(',');
        edges.set(key, (edges.get(key) || 0) + 1);
        lengths.push(Math.hypot(...V[a].map((v, k) => v - V[b][k])));
      });
    }
    assert.ok(Math.max(...lengths) - Math.min(...lengths) < 1e-8, name);
    assert.ok([...edges.values()].every(count => count === 2), name);
    assert.equal(V.length - edges.size + F.length, 2, name);
  }
});
