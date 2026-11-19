#!/usr/bin/env node
/**
 * One command for every repository check. Dependency-free (Node.js 24, Python 3.10+).
 *
 *   node scripts/verify-all.mjs
 *
 * Runs, in order: static source checks, the Node test suite, the crown check, a handoff
 * build into a temporary directory, ZIP verification, and the same checks against a
 * clean extraction of that ZIP. Every step runs even after a failure, so one run reports
 * everything; a step that depends on a failed step is reported as skipped. The exit code
 * is non-zero when any step fails or is skipped.
 *
 * Set PYTHON to choose the interpreter (default: python3).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const python = process.env.PYTHON || 'python3';
const node = process.execPath;

if (process.argv.slice(2).some(arg => arg === '--help' || arg === '-h')) {
  console.log('Usage: node scripts/verify-all.mjs\n'
    + 'Runs source, unit, crown, build, ZIP, and clean-extraction checks. Exit 0 only if all pass.');
  process.exit(0);
}

const testFiles = directory => fs.readdirSync(path.join(directory, 'tests'))
  .filter(name => name.endsWith('.test.cjs')).sort().map(name => path.join('tests', name));

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'coven-compass-verify-'));
const zip = path.join(work, 'handoff.zip');
const extracted = path.join(work, 'extracted');
const results = [];

function run(name, command, args, { cwd = root, needs = [] } = {}) {
  const blocked = needs.filter(dependency => results.find(r => r.name === dependency)?.status !== 'pass');
  if (blocked.length) {
    results.push({ name, status: 'skipped', detail: `needs ${blocked.join(', ')}` });
    console.log(`\n── ${name}: SKIPPED (needs ${blocked.join(', ')})`);
    return null;
  }
  console.log(`\n── ${name}\n$ ${[path.basename(command), ...args].join(' ')}`);
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, NODE_OPTIONS: '', PYTHONDONTWRITEBYTECODE: '1' },
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  process.stdout.write(output.endsWith('\n') || !output ? output : `${output}\n`);
  const code = result.error ? `error: ${result.error.message}` : result.status;
  const status = result.status === 0 ? 'pass' : 'fail';
  results.push({ name, status, detail: `exit ${code}, ${Date.now() - started} ms`, output });
  return result;
}

try {
  run('source', node, ['scripts/check-source.mjs']);
  run('tests', node, ['--test', ...testFiles(root)]);
  run('crown', node, ['scripts/test-atlas-crown.mjs']);
  run('build', python, ['scripts/build-handoff.py', '--output', zip]);
  run('zip', python, ['scripts/verify-handoff.py', zip], { needs: ['build'] });
  run('extract', python, ['-I', '-c',
    'import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', zip, extracted],
  { needs: ['zip'] });
  const bundle = fs.existsSync(extracted)
    ? path.join(extracted, fs.readdirSync(extracted)[0] ?? '') : extracted;
  run('extracted: manifest', python, [path.join(bundle, 'scripts/verify-handoff.py'), bundle], { needs: ['extract'] });
  run('extracted: source', node, ['scripts/check-source.mjs'], { cwd: bundle, needs: ['extract'] });
  run('extracted: tests', node, ['--test', ...(fs.existsSync(path.join(bundle, 'tests')) ? testFiles(bundle) : [])],
    { cwd: bundle, needs: ['extract'] });
  run('extracted: crown', node, ['scripts/test-atlas-crown.mjs'], { cwd: bundle, needs: ['extract'] });
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}

console.log('\n── Summary');
for (const { name, status, detail } of results) console.log(`${status.toUpperCase().padEnd(7)} ${name} (${detail})`);
const failed = results.filter(r => r.status !== 'pass');
console.log(failed.length
  ? `\nverify-all FAILED: ${failed.length} of ${results.length} steps did not pass.`
  : `\nverify-all passed: ${results.length} of ${results.length} steps.`);
process.exitCode = failed.length ? 1 : 0;
