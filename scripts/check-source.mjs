#!/usr/bin/env node
/**
 * Buildless, dependency-free source checks. Application code is parsed, never run.
 * This is not a browser, CSS validator, CommonMark implementation, or security audit.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

function usage() {
  console.log('Usage: node scripts/check-source.mjs [--root PATH]\n'
    + 'Checks local HTML/JS/CSS structure, JSON syntax, and Markdown file links.\n'
    + 'Defaults to the bundle root containing this script. No application code runs.');
}

let root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help' || args[i] === '-h') {
    usage();
    process.exit(0);
  }
  if (args[i] === '--root' && args[i + 1]) {
    root = path.resolve(args[++i]);
  } else {
    console.error(`Unknown or incomplete argument: ${args[i]}`);
    usage();
    process.exit(2);
  }
}
try {
  root = fs.realpathSync(root);
  if (!fs.statSync(root).isDirectory()) throw new Error('not a directory');
} catch (error) {
  console.error(`Cannot read source root: ${error.message}`);
  process.exit(2);
}

const errors = [];
const counts = { html: 0, js: 0, inline: 0, css: 0, json: 0, markdown: 0, references: 0 };
const scripts = new Map();
const stylesheets = new Set();
const excludedDirectories = new Set(['.git', 'node_modules', '__pycache__', '.venv', 'venv', 'downloads']);
const relative = file => path.relative(root, file).split(path.sep).join('/') || '.';
const fail = (file, message) => errors.push(`${relative(file)}: ${message}`);
const insideRoot = file => {
  const rel = path.relative(root, file);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
};

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  if (fs.lstatSync(directory).isSymbolicLink()) {
    fail(directory, 'symlink is outside the supported standalone source layout');
    return [];
  }
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      fail(file, 'symlink is outside the supported standalone source layout');
    } else if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name) && relative(file) !== 'docs/screenshots') output.push(...walk(file));
    } else if (entry.isFile()) {
      output.push(file);
    }
  }
  return output;
}

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    fail(file, `cannot read: ${error.message}`);
    return null;
  }
}

function decodeHtml(value) {
  const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (all, entity) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()] ?? all;
    const hexadecimal = entity[1].toLowerCase() === 'x';
    const point = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
      ? String.fromCodePoint(point) : all;
  });
}

/** A small tokenizer: raw script/style/text bodies cannot create false static IDs. */
function htmlTags(source, file) {
  const tags = [];
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf('<', cursor);
    if (start < 0) break;
    if (source.startsWith('<!--', start)) {
      const end = source.indexOf('-->', start + 4);
      if (end < 0) { fail(file, 'unterminated HTML comment'); break; }
      cursor = end + 3;
      continue;
    }
    const head = /^<\s*(\/)?([a-z][\w:-]*)\b/i.exec(source.slice(start));
    if (!head) { cursor = start + 1; continue; }
    let quote = null;
    let end = start + head[0].length;
    for (; end < source.length; end++) {
      const char = source[end];
      if (quote) { if (char === quote) quote = null; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '>') break;
    }
    if (end === source.length) { fail(file, 'unterminated HTML tag'); break; }
    cursor = end + 1;
    if (head[1]) continue;
    const name = head[2].toLowerCase();
    const attrs = new Map();
    const raw = source.slice(start + head[0].length, end);
    const attrPattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    for (const match of raw.matchAll(attrPattern)) {
      const key = match[1].toLowerCase();
      if (key === 'id' && attrs.has(key)) fail(file, 'duplicate id attribute on one static element');
      attrs.set(key, decodeHtml(match[2] ?? match[3] ?? match[4] ?? ''));
    }
    let body = '';
    if (['script', 'style', 'textarea', 'title'].includes(name)) {
      const close = new RegExp(`</${name}\\s*>`, 'ig');
      close.lastIndex = cursor;
      const match = close.exec(source);
      if (!match) { fail(file, `missing closing ${name} tag`); break; }
      body = source.slice(cursor, match.index);
      cursor = close.lastIndex;
    }
    tags.push({ name, attrs, body, start });
  }
  return tags;
}

function resolveReference(from, raw, context, webRoot = false) {
  const value = decodeHtml(raw).trim();
  if (!value || value.startsWith('#') || value.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  const part = value.split(/[?#]/, 1)[0];
  if (!part) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(part).replace(/\\([\s()[\]<>])/g, '$1');
  } catch {
    fail(from, `${context} has invalid URL encoding: ${raw}`);
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) {
    fail(from, `${context} has an unsupported local path: ${raw}`);
    return null;
  }
  const target = path.resolve(decoded.startsWith('/')
    ? (webRoot ? path.join(root, 'dist') : root)
    : path.dirname(from), decoded.replace(/^\/+/, ''));
  counts.references++;
  if (!insideRoot(target)) {
    fail(from, `${context} escapes the bundle root: ${raw}`);
    return null;
  }
  try {
    const real = fs.realpathSync(target);
    if (!insideRoot(real)) throw new Error('resolved path escapes the bundle root');
    if (!fs.statSync(real).isFile() && !fs.statSync(real).isDirectory()) throw new Error('not a regular file or directory');
    return real;
  } catch (error) {
    fail(from, `${context} is missing or unsafe: ${raw} (${error.code || error.message})`);
    return null;
  }
}

function addScript(file, mode = 'auto') {
  if (!scripts.has(file)) scripts.set(file, new Set());
  scripts.get(file).add(mode);
}

function checkJavaScript(source, file, mode, label = relative(file)) {
  try {
    if (mode === 'script') {
      new vm.Script(source, { filename: label });
      return;
    }
    // --check parses without evaluation. Clear inherited Node preloads/options.
    const result = spawnSync(process.execPath,
      mode === 'module' ? ['--input-type=module', '--check'] : ['--check', file],
      { input: mode === 'module' ? source : undefined, encoding: 'utf8', timeout: 15000,
        maxBuffer: 1024 * 1024, env: { ...process.env, NODE_OPTIONS: '' } });
    if (result.error || result.status !== 0) {
      throw new Error(result.error?.message || (result.stderr || result.stdout || `exit ${result.status}`).trim());
    }
  } catch (error) {
    fail(file, `JavaScript syntax (${label}): ${error.message}`);
  }
}

function checkCss(source, file, label = relative(file)) {
  counts.css++;
  const stack = [];
  const pairs = { ')': '(', ']': '[', '}': '{' };
  let quote = null;
  let comment = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (comment) {
      if (char === '*' && source[i + 1] === '/') { comment = false; i++; }
      continue;
    }
    if (quote) {
      if (char === '\\') i++;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && source[i + 1] === '*') { comment = true; i++; }
    else if (char === '"' || char === "'") quote = char;
    else if (char === '\\') i++;
    else if ('([{'.includes(char)) stack.push({ char, index: i });
    else if (Object.hasOwn(pairs, char)) {
      const opening = stack.pop();
      if (!opening || opening.char !== pairs[char]) {
        fail(file, `CSS delimiter mismatch in ${label}, line ${source.slice(0, i).split('\n').length}`);
        return;
      }
    }
  }
  if (comment || quote || stack.length) fail(file, `unclosed CSS ${comment ? 'comment' : quote ? 'string' : 'delimiter'} in ${label}`);
}

function checkHtml(file) {
  const source = read(file);
  if (source === null) return;
  counts.html++;
  const ids = new Set();
  let inlineNumber = 0;
  for (const tag of htmlTags(source, file)) {
    if (tag.attrs.has('id')) {
      const id = tag.attrs.get('id');
      if (!id) fail(file, 'empty static HTML id');
      else if (ids.has(id)) fail(file, `duplicate static HTML id: ${id}`);
      ids.add(id);
    }
    if (tag.name === 'script') {
      const type = (tag.attrs.get('type') || '').toLowerCase().split(';', 1)[0].trim();
      const isJavaScript = !type || type === 'module' || /^(text|application)\/(java|ecma)script$/.test(type);
      if (tag.attrs.has('src')) {
        const target = resolveReference(file, tag.attrs.get('src'), 'script src', true);
        if (target && isJavaScript) addScript(target, type === 'module' ? 'module' : 'script');
      } else if (isJavaScript && tag.body.trim()) {
        counts.inline++;
        checkJavaScript(tag.body, file, type === 'module' ? 'module' : 'script', `${relative(file)} inline script ${++inlineNumber}`);
      } else if (['application/json', 'application/ld+json', 'importmap'].includes(type) && tag.body.trim()) {
        try { JSON.parse(tag.body); } catch (error) { fail(file, `inline JSON: ${error.message}`); }
      }
    }
    if (tag.name === 'style') checkCss(tag.body, file, `${relative(file)} inline style`);
    if (tag.name === 'link' && tag.attrs.has('href')) {
      const rel = (tag.attrs.get('rel') || '').toLowerCase().split(/\s+/);
      const as = (tag.attrs.get('as') || '').toLowerCase();
      const href = tag.attrs.get('href');
      if (rel.includes('stylesheet') || as === 'style' || as === 'script' || /\.(css|[cm]?js)(?:[?#]|$)/i.test(href)) {
        const target = resolveReference(file, href, 'CSS/JS link href', true);
        if (target && (rel.includes('stylesheet') || as === 'style' || /\.css$/i.test(target))) stylesheets.add(target);
        else if (target) addScript(target);
      }
    }
  }
}

function withoutMarkdownCode(source) {
  let fence = null;
  const lines = source.split('\n').map(line => {
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (match) {
      if (!fence) { fence = { char: match[1][0], length: match[1].length }; return ''; }
      if (match[1][0] === fence.char && match[1].length >= fence.length && !match[2].trim()) { fence = null; return ''; }
    }
    return fence ? '' : line;
  }).join('\n').replace(/<!--[\s\S]*?-->/g, '');
  return lines.replace(/(`+)([\s\S]*?)\1/g, match => match.replace(/[^\n]/g, ' '));
}

const normalizeLabel = label => label.trim().replace(/\s+/g, ' ').toLowerCase();

function markdownDestination(source, start) {
  let cursor = start;
  while (/\s/.test(source[cursor] || '') && cursor < source.length) cursor++;
  if (source[cursor] === '<') {
    const end = source.indexOf('>', cursor + 1);
    return end < 0 ? null : source.slice(cursor + 1, end);
  }
  const begin = cursor;
  let depth = 0;
  for (; cursor < source.length; cursor++) {
    const char = source[cursor];
    if (char === '\\') { cursor++; continue; }
    if (char === '(') depth++;
    else if (char === ')') { if (depth === 0) break; depth--; }
    else if (/\s/.test(char) && depth === 0) break;
  }
  return source.slice(begin, cursor) || null;
}

function checkMarkdown(file) {
  const original = read(file);
  if (original === null) return;
  counts.markdown++;
  let source = withoutMarkdownCode(original);
  const references = new Map();
  source = source.replace(/^ {0,3}\[([^\]\n]+)\]:[ \t]*(<[^>\n]+>|\S+).*$/gm, (line, label, destination) => {
    references.set(normalizeLabel(label), destination.startsWith('<') ? destination.slice(1, -1) : destination);
    return '';
  });
  for (const destination of references.values()) resolveReference(file, destination, 'Markdown reference');
  const used = new Set();
  const labelPattern = /\[([^\]\n]+)\]/g;
  let match;
  while ((match = labelPattern.exec(source))) {
    const next = source[labelPattern.lastIndex];
    if (next === '(') {
      const destination = markdownDestination(source, labelPattern.lastIndex + 1);
      if (destination) resolveReference(file, destination, 'Markdown link');
    } else if (next === '[') {
      const close = source.indexOf(']', labelPattern.lastIndex + 1);
      if (close < 0) continue;
      const label = normalizeLabel(source.slice(labelPattern.lastIndex + 1, close) || match[1]);
      if (!references.has(label) && !used.has(label)) fail(file, `undefined Markdown reference: ${label}`);
      used.add(label);
      labelPattern.lastIndex = close + 1;
    }
    // Shortcut references are already checked through their definitions.
  }
  for (const tag of htmlTags(source, file)) {
    if (tag.name === 'a' && tag.attrs.has('href')) resolveReference(file, tag.attrs.get('href'), 'Markdown HTML link');
    if (tag.name === 'img' && tag.attrs.has('src')) resolveReference(file, tag.attrs.get('src'), 'Markdown HTML image');
  }
}

const dist = walk(path.join(root, 'dist'));
const support = ['scripts', 'tests', 'examples', 'docs/handoff', 'docs/discovery'].flatMap(directory => walk(path.join(root, directory)));
const rootMarkdown = fs.readdirSync(root, { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.md')).map(entry => path.join(root, entry.name));
const files = [...new Set([...dist, ...support, ...rootMarkdown])].sort();

if (!fs.existsSync(path.join(root, 'dist/index.html'))) fail(root, 'required dist/index.html is missing');
for (const file of dist.filter(file => /\.html?$/i.test(file))) checkHtml(file);
for (const file of files) {
  if (/\.[cm]?js$/i.test(file)) addScript(file);
  if (/\.css$/i.test(file)) stylesheets.add(file);
  if (/\.md$/i.test(file)) checkMarkdown(file);
  if (/\.json$/i.test(file)) {
    const source = read(file);
    if (source !== null) {
      counts.json++;
      try { JSON.parse(source); } catch (error) { fail(file, `JSON syntax: ${error.message}`); }
    }
  }
}
for (const [file, modes] of scripts) {
  const source = read(file);
  if (source === null) continue;
  counts.js++;
  if (modes.has('script')) checkJavaScript(source, file, 'script');
  if (modes.has('module')) checkJavaScript(source, file, 'module');
  if (!modes.has('script') && !modes.has('module')) checkJavaScript(source, file, 'auto');
}
for (const file of stylesheets) {
  const source = read(file);
  if (source !== null) checkCss(source, file);
}

/**
 * Evidence counts live in tests/evidence/current.json (generated by scripts/verify-all.mjs)
 * and, for history, in chapter 01 and MOBILE_READINESS.md. Anywhere else a literal count
 * goes stale on the next change, so link to those instead.
 */
const countHomes = new Set(['docs/handoff/01-current-state-and-evidence.md', 'MOBILE_READINESS.md']);
const generatedHtml = new Set(['dist/handoff/guide.html']);
const countLiteral = new RegExp([
  String.raw`\b\d+(?:\/\d+)?[- ](?:(?:passing|node|source|suite|unit)\s+)*tests?\b`,
  String.raw`\b\d+[- ](?:(?:settled|chrome|layout|mobile)\s+)*audits?\b`,
  String.raw`\b\d+\s+(?:crown\s+)?view\/size\s+(?:combinations|cases)\b`,
  String.raw`\b\d+[- ]file archive\b`,
  String.raw`\b\d+\s+payload entries\b`,
  String.raw`\b\d+\s+SHA(?:-256)?\s+checks\b`,
].join('|'), 'gi');
for (const file of files) {
  const rel = relative(file);
  // docs/discovery holds digest-pinned imports that must stay byte-identical.
  if (countHomes.has(rel) || generatedHtml.has(rel) || rel.startsWith('tests/') || rel.startsWith('docs/discovery/')) continue;
  if (!rel.endsWith('.md') && !/^dist\/handoff\/.*\.html?$/i.test(rel)) continue;
  const source = read(file);
  if (source === null) continue;
  const text = rel.endsWith('.md') ? withoutMarkdownCode(source) : source;
  for (const match of text.matchAll(countLiteral)) {
    const line = text.slice(0, match.index).split('\n').length;
    fail(file, `evidence count literal "${match[0]}" on line ${line}; link tests/evidence/current.json `
      + 'or docs/handoff/01-current-state-and-evidence.md instead of repeating counts');
  }
}

const summary = `${counts.html} HTML, ${counts.js} JS files, ${counts.inline} inline scripts, `
  + `${counts.css} CSS files/blocks, ${counts.json} JSON, ${counts.markdown} Markdown, ${counts.references} local references`;
if (errors.length) {
  console.error(`Source checks failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  console.error(`Checked: ${summary}.`);
  process.exitCode = 1;
} else {
  console.log(`Source checks passed: ${summary}.`);
  console.log('Static syntax/structure only; no application execution, browser, network, Git, or build.');
}
