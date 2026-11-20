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
 * When every step passes, it writes the measured counts to tests/evidence/current.json.
 * That file is the only place current counts live; docs link to it instead of repeating
 * numbers. It holds deterministic counts only (no time or commit), so it changes only when
 * a count changes.
 *
 * It also fails (with --check) when dist/handoff/guide.html, which the build regenerates from
 * the Markdown chapters, differs from the committed copy.
 *
 *   --check          compare instead of write; fail if current.json is stale (CI uses this)
 *   --report PATH    also write a run report with commit, runtimes, time, and step results
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

const usage = 'Usage: node scripts/verify-all.mjs [--check] [--report PATH]\n'
  + 'Runs source, unit, crown, build, ZIP, and clean-extraction checks, then writes (or with\n'
  + '--check, compares) tests/evidence/current.json. Exit 0 only if every step passes.';
const options = { check: false, report: null };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--help' || argv[i] === '-h') { console.log(usage); process.exit(0); }
  else if (argv[i] === '--check') options.check = true;
  else if (argv[i] === '--report' && argv[i + 1]) options.report = path.resolve(argv[++i]);
  else { console.error(`Unknown or incomplete argument: ${argv[i]}\n${usage}`); process.exit(2); }
}
const evidencePath = path.join(root, 'tests/evidence/current.json');

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
  const guidePath = path.join(root, 'dist/handoff/guide.html');
  const guideBefore = fs.existsSync(guidePath) ? fs.readFileSync(guidePath) : null;
  run('build', python, ['scripts/build-handoff.py', '--output', zip]);
  if (results.at(-1).status === 'pass') {
    // build-handoff regenerates the reader from Markdown in place. A change means the
    // committed copy was stale.
    const fresh = guideBefore !== null && guideBefore.equals(fs.readFileSync(guidePath));
    results.push(fresh
      ? { name: 'guide', status: 'pass', detail: 'dist/handoff/guide.html matches its Markdown' }
      : options.check
        ? { name: 'guide', status: 'fail', detail: 'dist/handoff/guide.html was stale; run node scripts/verify-all.mjs and commit it' }
        : { name: 'guide', status: 'pass', detail: 'dist/handoff/guide.html regenerated; commit it' });
    console.log(`\n── guide: ${results.at(-1).detail}`);
  } else {
    results.push({ name: 'guide', status: 'skipped', detail: 'needs build' });
  }
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

const outputOf = name => results.find(r => r.name === name)?.output ?? '';
const number = (text, pattern) => { const m = pattern.exec(text); return m ? Number(m[1]) : null; };
function measure() {
  const tests = outputOf('tests');
  const zipOutput = /PASS: (\d+) files; (\d+) payload entries; (\d+) SHA-256 checks/.exec(outputOf('zip'));
  const evidence = {
    about: 'Current source/package evidence. Generated by `node scripts/verify-all.mjs`; do not edit by hand. '
      + 'CI runs `verify-all --check` and fails when this file is stale. Historical checkpoints live in '
      + 'docs/handoff/01-current-state-and-evidence.md and MOBILE_READINESS.md.',
    evidence_level: 'static + unit (Node with DOM facades). Not browser, device, daemon, packaged CLI, or remote Host.',
    tests: {
      files: testFiles(root).length,
      ...Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']
        .map(key => [key, number(tests, new RegExp(`^\\S* ?${key} (\\d+)$`, 'm'))])),
    },
    crown: { view_size_combinations: number(outputOf('crown'), /(\d+) view\/size combinations/) },
    package: zipOutput
      ? { files: Number(zipOutput[1]), payload_entries: Number(zipOutput[2]), sha256_checks: Number(zipOutput[3]) }
      : null,
    extracted_copy: 'Source, tests, crown, and manifest checks repeated in a clean extraction of the built ZIP.',
  };
  const missing = JSON.stringify(evidence).includes('null');
  return { evidence, missing };
}

const allPassed = () => results.every(r => r.status === 'pass');
const measured = allPassed() ? measure() : null;
if (!allPassed()) {
  results.push({ name: 'evidence', status: 'skipped', detail: 'needs every earlier step to pass; current.json untouched' });
} else if (measured.missing) {
  results.push({ name: 'evidence', status: 'fail', detail: 'could not parse a count from step output; current.json untouched' });
} else {
  const text = `${JSON.stringify(measured.evidence, null, 2)}\n`;
  const existing = fs.existsSync(evidencePath) ? fs.readFileSync(evidencePath, 'utf8') : null;
  if (options.check) {
    results.push(existing === text
      ? { name: 'evidence', status: 'pass', detail: 'tests/evidence/current.json is current' }
      : { name: 'evidence', status: 'fail', detail: 'tests/evidence/current.json is stale; run node scripts/verify-all.mjs and commit it' });
    if (existing !== text) console.log(`\nMeasured evidence:\n${text}`);
  } else {
    if (existing !== text) fs.writeFileSync(evidencePath, text);
    results.push({ name: 'evidence', status: 'pass', detail: existing === text ? 'current.json unchanged' : 'current.json updated' });
  }
}

if (options.report) {
  const git = args => {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() : null;
  };
  const report = {
    generated_utc: new Date().toISOString(),
    commit: git(['rev-parse', 'HEAD']),
    worktree_clean: git(['status', '--porcelain']) === '',
    node: process.version,
    python: (spawnSync(python, ['--version'], { encoding: 'utf8' }).stdout || '').trim() || null,
    platform: `${process.platform}-${process.arch}`,
    mode: options.check ? 'check' : 'write',
    steps: results.map(({ name, status, detail }) => ({ name, status, detail })),
    evidence: measured?.evidence ?? null,
  };
  fs.mkdirSync(path.dirname(options.report), { recursive: true });
  fs.writeFileSync(options.report, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nRun report: ${options.report}`);
}

console.log('\n── Summary');
for (const { name, status, detail } of results) console.log(`${status.toUpperCase().padEnd(7)} ${name} (${detail})`);
const failed = results.filter(r => r.status !== 'pass');
console.log(failed.length
  ? `\nverify-all FAILED: ${failed.length} of ${results.length} steps did not pass.`
  : `\nverify-all passed: ${results.length} of ${results.length} steps.`);
process.exitCode = failed.length ? 1 : 0;
