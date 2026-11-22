// Compile into a temporary directory so checking a stale asset preserves the diff.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('.', import.meta.url));
const compiler = createRequire(import.meta.url).resolve('typescript/bin/tsc');
const output = mkdtempSync(join(tmpdir(), 'compass-typescript-'));
try {
  execFileSync(process.execPath, [compiler, '-p', source, '--outDir', output], { stdio: 'inherit' });
  for (const name of readdirSync(output)) {
    const actual = readFileSync(join(source, '..', 'dist', name));
    if (!actual.equals(readFileSync(join(output, name)))) {
      throw new Error(`dist/${name} is stale. Run npm --prefix src run build.`);
    }
    console.log(`Verified dist/${name}`);
  }
} finally {
  rmSync(output, { recursive: true, force: true });
}
