/**
 * Manual pipeline runner — the CLI precursor (phase-7 CODE-007 arrives properly much later).
 *
 *   ../../node_modules/.bin/ts-node -P tsconfig.json scripts/emit-scaffold.ts <projectDir> <outDir>
 *
 * Parses a v2 project against the repo's node catalog and writes the scaffold to <outDir>.
 * The emitted app should `npm install && npm run build` cleanly — that is the walking-skeleton
 * proof that the pipeline holds end to end.
 */

import * as fs from 'fs';
import * as path from 'path';

import { Catalog } from '../src/catalog';
import { emitScaffold } from '../src/emit/scaffold';
import { parseProject } from '../src/parse/parseProject';

const [projectDir, outDir] = process.argv.slice(2);
if (!projectDir || !outDir) {
  console.error('usage: emit-scaffold.ts <projectDir> <outDir>');
  process.exit(1);
}

const catalogPath = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const catalog: Catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const ir = parseProject(path.resolve(projectDir), catalog);
const files = emitScaffold(ir);

for (const [relativePath, content] of Object.entries(files)) {
  const target = path.join(outDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

console.log(`${Object.keys(files).length} files → ${outDir}`);
