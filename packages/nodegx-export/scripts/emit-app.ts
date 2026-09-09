/**
 * Manual pipeline runner for the full export (scaffold + visual generator + api stubs):
 *
 *   ../../node_modules/.bin/ts-node -P tsconfig.json scripts/emit-app.ts <projectDir> <outDir>
 *
 * The emitted app should `npm install && npm run build` cleanly and render its pages — the
 * EXP-002 step 4 proof.
 *
 * Analysis/emission notes (dropped wires, deferred nodes) still print to stderr, and since EXP-004
 * they are also written into the app as `EXPORT-REPORT.md` — which is the copy that survives the
 * scrollback, and the one the generated `TODO(export)` markers point at.
 *
 * ## `--preflight`, and why it lives here
 *
 *   ../../node_modules/.bin/ts-node -P tsconfig.json scripts/emit-app.ts --preflight <projectDir>
 *
 * EXP-004's before-you-export surface: what this project will produce, printed to stdout, with
 * **no directory chosen and nothing written**. It is hosted in this script rather than in a
 * script of its own because the decision it supports is *"do I run the export?"* — and this is
 * the command that runs the export. A pre-flight the author has to know a second command to reach
 * is not one they will read.
 *
 * 🔴 **In this mode the runner must not touch the filesystem for output at all** — not the write
 * loop, not the asset copies, and above all not `mkdirSync`. "Nothing has been written yet" is the
 * first sentence the summary prints, and a runner that created an empty output tree while saying
 * it would be the one file in this package whose job is not to mislead getting it wrong. There is
 * a row for exactly that in `tests/preflight.test.ts`, and it drives this script rather than the
 * library, because this is where the mistake would be.
 */

import * as fs from 'fs';
import * as path from 'path';

import { Catalog, loadCatalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { renderPreflight, summarizePreflight } from '../src/emit/preflight';
import { parseProject } from '../src/parse/parseProject';

const argv = process.argv.slice(2);
const preflightOnly = argv[0] === '--preflight';
const [projectDir, outDir] = preflightOnly ? [argv[1], undefined] : argv;
if (!projectDir || (!preflightOnly && !outDir)) {
  console.error('usage: emit-app.ts <projectDir> <outDir>');
  console.error('       emit-app.ts --preflight <projectDir>');
  process.exit(1);
}

const catalog: Catalog = loadCatalog();

const projectRoot = path.resolve(projectDir);
const ir = parseProject(projectRoot, catalog);
const app = emitApp(ir, catalog);
const { files, copies, notes } = app;

if (preflightOnly) {
  // Every `return` out of this branch happens before the first write, which is the point of the
  // branch. The summary goes to stdout because it is the answer to the question that was asked;
  // the notes stay on stderr, where the other mode leaves them.
  process.stdout.write(renderPreflight(summarizePreflight(app)) + '\n');
  process.exit(0);
}

for (const [relativePath, content] of Object.entries(files)) {
  const target = path.join(outDir as string, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

/*
 * 🔴 **`copies` is a second channel and this runner used to drop it on the floor.**
 *
 * `emitApp` returns two things to write: `files`, which are generated strings, and `copies`,
 * which are the `noodl_modules` assets that travel byte-for-byte (EXP-010 AC5) — a kit's script,
 * an icon set's `.woff2`, Inter's four `.ttf`. They are separate precisely *because* a font is not
 * a string: reading one into UTF-8 to put it in `files` corrupts it silently, and the failure
 * renders as blank glyphs rather than as an error.
 *
 * ⚠️ Writing only `files` reintroduced, one layer up, the exact defect `kits.ts` closed and
 * documents at its own copy sites: *"a file the author wrote, silently absent from their exported
 * repo."* Every gate stayed green throughout, because no test drives this script.
 */
for (const copy of copies) {
  const source = path.join(projectRoot, copy.from);
  const target = path.join(outDir as string, copy.to);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

console.log(`${Object.keys(files).length} files, ${copies.length} copied assets → ${outDir}`);
for (const note of notes) console.error(`note: ${note}`);
