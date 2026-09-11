/**
 * HLS-001 AC3 — the safety net for a packaging change.
 *
 * Emits every project in the corpus that already exists (`tests/fixtures/*`, 42 of them) and
 * prints a sha256 per emitted file. HLS-001 moves two modules out of two other packages and adds
 * a build; none of that is allowed to change a single emitted byte, and this is what says so.
 *
 * 🔴 **Measured on the artefacts that already exist, never on a fixture minted for the task** —
 * a budget measured on a fixture bounds the fixture. Every project here predates HLS-001 and was
 * put there by the task that needed it.
 *
 * The `notes` and `report` channels are hashed alongside `files`, because a packaging change that
 * silently changed what the export *said* while emitting identical code would pass a files-only
 * comparison. `copies` is a list of paths, so it is hashed as its sorted destinations.
 *
 *   ../../node_modules/.bin/ts-node -P tsconfig.json scripts/corpus-hashes.ts
 *
 * Writes nothing. The gate that consumes it is `tests/hls001-corpus-identity.test.ts`.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { Catalog, loadCatalog } from '../src/catalog';
import { errorMessage } from '../src/errorMessage';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';

const FIXTURES = path.join(__dirname, '..', 'tests', 'fixtures');

const sha = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

export interface CorpusHashes {
  /** `<project>` → `<emitted path>` → sha256 of the contents. */
  [project: string]: Record<string, string>;
}

export function corpusProjects(): string[] {
  return fs
    .readdirSync(FIXTURES)
    .filter((name) => fs.existsSync(path.join(FIXTURES, name, 'nodegx.project.json')))
    .sort();
}

export function corpusHashes(): CorpusHashes {
  const catalog: Catalog = loadCatalog();
  const out: CorpusHashes = {};

  for (const name of corpusProjects()) {
    const dir = path.join(FIXTURES, name);
    const entry: Record<string, string> = {};
    try {
      const app = emitApp(parseProject(dir, catalog), catalog);
      for (const [file, contents] of Object.entries(app.files).sort(([a], [b]) => (a < b ? -1 : 1))) {
        entry[file] = sha(contents);
      }
      entry['@copies'] = sha(app.copies.map((c) => c.to).sort().join('\n'));
      entry['@notes'] = sha(app.notes.join('\n'));
      entry['@report'] = sha(JSON.stringify(app.report));
    } catch (err) {
      // A project the exporter refuses is still a reading: the refusal has to survive the change
      // byte-for-byte too, and swallowing it here would hide a project dropping out of the corpus.
      entry['@threw'] = sha(errorMessage(err));
    }
    out[name] = entry;
  }

  return out;
}

if (require.main === module) {
  process.stdout.write(JSON.stringify(corpusHashes(), null, 2) + '\n');
}
