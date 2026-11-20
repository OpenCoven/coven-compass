// Compare anonymous, decoded HTTP responses with the Git objects of a specific deployed revision.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const [url, ref = 'HEAD'] = process.argv.slice(2);
if (!url) throw new Error('Usage: node scripts/verify-served.mjs <site-root-url> [revision]');
const base = new URL(url);
if (!base.pathname.endsWith('/')) throw new Error('The site root must end in /');
const git = (...args) => execFileSync('git', args, {maxBuffer: 16 * 1024 * 1024});
const revision = git('rev-parse', '--verify', '--end-of-options', ref + '^{commit}').toString().trim();
const files = git('ls-tree', '-rz', '--name-only', revision, 'dist/').toString().split('\0').filter(Boolean);
if (!files.includes('dist/index.html')) throw new Error('Revision has no Compass homepage');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
console.log('Checking ' + base.href + ' against ' + revision);
for (const file of ['dist/', ...files]) {
  const pathname = file.slice('dist/'.length);
  const response = await fetch(new URL(pathname, base), {redirect: 'manual', signal: AbortSignal.timeout(15000)});
  if (response.status !== 200) throw new Error((pathname || '/') + ' returned HTTP ' + response.status);
  const expected = git('show', revision + ':' + (pathname ? file : 'dist/index.html'));
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.equals(expected)) throw new Error((pathname || '/') + ' differs from ' + revision + ' (received ' + digest(bytes) + ', expected ' + digest(expected) + ')');
  console.log('200 ' + digest(bytes) + ' ' + (pathname || '/'));
}
