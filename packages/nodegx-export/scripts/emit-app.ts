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
 */

import * as fs from 'fs';
import * as path from 'path';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';

const [projectDir, outDir] = process.argv.slice(2);
if (!projectDir || !outDir) {
  console.error('usage: emit-app.ts <projectDir> <outDir>');
  process.exit(1);
}

const catalogPath = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const catalog: Catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const projectRoot = path.resolve(projectDir);
const ir = parseProject(projectRoot, catalog);
const { files, copies, notes } = emitApp(ir, catalog);

for (const [relativePath, content] of Object.entries(files)) {
  const target = path.join(outDir, relativePath);
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
  const target = path.join(outDir, copy.to);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

console.log(`${Object.keys(files).length} files, ${copies.length} copied assets → ${outDir}`);
for (const note of notes) console.error(`note: ${note}`);
