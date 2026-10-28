#!/usr/bin/env node
// Gate G1.9 — all routes render as Arabic RTL with the Thmanyah Sans
// font variable, and no English-only user-facing JSX strings exist in source.
// Run after `next build` (prerendered HTML in .next/server/app).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROUTES = [
  'index',
  'login',
  'dashboard',
  'connections',
  'content',
  'workflows',
  'templates',
  'contacts',
  'logs',
  'settings',
  'help',
  'admin',
  'admin/orgs',
];

const failures = [];

for (const route of ROUTES) {
  const label = route === 'index' ? '/' : `/${route}`;
  const file = join(
    webRoot,
    '.next',
    'server',
    'app',
    route === 'index' ? 'index.html' : `${route}.html`,
  );
  if (!existsSync(file)) {
    failures.push(`${label}: prerendered HTML missing (run next build first)`);
    continue;
  }
  const html = readFileSync(file, 'utf8');
  if (!html.includes('lang="ar"')) failures.push(`${label}: lang="ar" missing`);
  if (!html.includes('dir="rtl"')) failures.push(`${label}: dir="rtl" missing`);
  if (!/<html[^>]*[A-Za-z0-9_-]*variable/.test(html)) {
    failures.push(`${label}: font variable class missing on <html>`);
  }
}

const chunksDir = join(webRoot, '.next', 'static', 'chunks');
const cssSubDir = join(webRoot, '.next', 'static', 'css');
const cssDirs = [chunksDir, cssSubDir].filter((d) => existsSync(d));
const css = cssDirs
  .flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(d, f), 'utf8')))
  .join('\n');
if (!css.includes('--font-thmanyah')) {
  failures.push('built CSS does not define --font-thmanyah (Thmanyah Sans)');
}

// English-only JSX text nodes are treated as user-facing strings.
const JSX_TEXT = />(\s*[A-Za-z][A-Za-z'’.,!?\s-]{3,}\s*)</g;
const srcDir = join(webRoot, 'src');
const tsxFiles = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith('.tsx')) tsxFiles.push(p);
  }
})(srcDir);

let englishStrings = 0;
for (const file of tsxFiles) {
  const src = readFileSync(file, "utf8");
  for (const match of src.matchAll(JSX_TEXT)) {
    const text = match[1].trim();
    if (!/^[A-Za-z'’.,!?\s-]+$/.test(text)) continue;
    if (!/[A-Za-z]{4,}/.test(text)) continue;
    englishStrings += 1;
    failures.push(`${relative(webRoot, file)}: English JSX text "${text}"`);
  }
}

if (failures.length > 0) {
  console.error(`Arabic/RTL verification FAILED (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `Arabic/RTL verification OK: ${ROUTES.length} routes, font var present, ${tsxFiles.length} TSX files scanned, ${englishStrings} English-only JSX strings.`,
);
