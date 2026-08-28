/**
 * build-corpus — typecheck the emitted app for **every** project in a corpus.
 *
 * Session 21 shipped a slice whose export did not compile, and the reason it survived is worth
 * stating plainly: the pipeline was graded by `tsc` over **one** emitted project. Two record-verb
 * typing defects sat in a second project the whole time. Unit tests could not catch either — every
 * assertion about the generated text was correct; the text just did not typecheck together.
 *
 * So this is the grader that matches the claim. `emitApp` promises an app that builds; this runs
 * that promise against the whole corpus and prints one row per project.
 *
 *   ../../node_modules/.bin/ts-node -P tsconfig.json scripts/build-corpus.ts \
 *     --app <harnessDir> <projectDir>…
 *
 * `--app` is a scaffolded Vite app with `node_modules` already installed — the emitted files are
 * copied over its `src/` and typechecked with its own TypeScript. Build one once:
 *
 *   ts-node scripts/emit-scaffold.ts <anyProjectDir> /tmp/export-harness
 *   cd /tmp/export-harness && npm install
 *
 * `package.json` is never overwritten: the harness pins `@nodegx/core` by `file:` and clobbering
 * it silently un-pins the core the emitted app is graded against.
 *
 * Exit code is the number of projects that failed to typecheck, so it gates.
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';

const argv = process.argv.slice(2);
const appFlag = argv.indexOf('--app');
if (appFlag === -1 || argv[appFlag + 1] === undefined) {
  console.error('usage: build-corpus.ts --app <harnessDir> <projectDir>…');
  process.exit(2);
}
const appDir = path.resolve(argv[appFlag + 1]);
const projectDirs = argv.filter((_, i) => i !== appFlag && i !== appFlag + 1).map((p) => path.resolve(p));
if (projectDirs.length === 0) {
  console.error('build-corpus: no projects given');
  process.exit(2);
}

const tsc = path.join(appDir, 'node_modules', '.bin', 'tsc');
if (!fs.existsSync(tsc)) {
  console.error(`build-corpus: no TypeScript in the harness — run \`npm install\` in ${appDir}`);
  process.exit(2);
}

const catalogPath = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const catalog: Catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

type Result = { project: string; files: number; errors: string[] };
const results: Result[] = [];

for (const projectDir of projectDirs) {
  const name = path.basename(projectDir);
  let files: Record<string, string>;
  try {
    files = emitApp(parseProject(projectDir, catalog), catalog).files;
  } catch (error) {
    results.push({ project: name, files: 0, errors: [`emit threw: ${error instanceof Error ? error.message : error}`] });
    continue;
  }

  // A stale `src/` from the previous project would typecheck files this one never emitted, and
  // a stale tsbuildinfo would skip the check entirely — both read as a pass.
  fs.rmSync(path.join(appDir, 'src'), { recursive: true, force: true });
  fs.rmSync(path.join(appDir, 'tsconfig.tsbuildinfo'), { force: true });
  let written = 0;
  for (const [relativePath, content] of Object.entries(files)) {
    if (relativePath === 'package.json') continue;
    const target = path.join(appDir, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
    written++;
  }

  let errors: string[] = [];
  try {
    execFileSync(tsc, ['--noEmit', '-p', 'tsconfig.json'], { cwd: appDir, stdio: 'pipe' });
  } catch (error) {
    const out = String((error as { stdout?: Buffer }).stdout ?? '') + String((error as { stderr?: Buffer }).stderr ?? '');
    errors = out.split('\n').filter((line) => /error TS\d+/.test(line));
    if (errors.length === 0) errors = [out.trim() || 'tsc failed with no diagnostic'];
  }
  results.push({ project: name, files: written, errors });
  process.stderr.write(`${errors.length === 0 ? 'ok  ' : 'FAIL'} ${name} (${written} files)\n`);
}

const failed = results.filter((r) => r.errors.length > 0);
const width = Math.max(...results.map((r) => r.project.length));
console.log(`\n${'project'.padEnd(width)}  files  result`);
for (const r of results) {
  console.log(`${r.project.padEnd(width)}  ${String(r.files).padStart(5)}  ${r.errors.length === 0 ? 'ok' : `${r.errors.length} error(s)`}`);
}
if (failed.length > 0) {
  console.log('\n######## diagnostics');
  for (const r of failed) {
    console.log(`\n--- ${r.project}`);
    for (const line of r.errors) console.log(`  ${line}`);
  }
}
console.log(`\n${results.length - failed.length}/${results.length} projects typecheck.`);
process.exit(failed.length);
