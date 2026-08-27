/**
 * Manual pipeline runner for the full export (scaffold + visual generator + api stubs):
 *
 *   ../../node_modules/.bin/ts-node -P tsconfig.json scripts/emit-app.ts <projectDir> <outDir>
 *
 * The emitted app should `npm install && npm run build` cleanly and render its pages — the
 * EXP-002 step 4 proof. Analysis/emission notes (dropped wires, deferred nodes) print to stderr;
 * they are the seed of EXP-004's export report.
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

const ir = parseProject(path.resolve(projectDir), catalog);
const { files, notes } = emitApp(ir, catalog);

for (const [relativePath, content] of Object.entries(files)) {
  const target = path.join(outDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

console.log(`${Object.keys(files).length} files → ${outDir}`);
for (const note of notes) console.error(`note: ${note}`);
