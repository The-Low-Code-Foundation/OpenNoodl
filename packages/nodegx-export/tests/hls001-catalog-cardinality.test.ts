/**
 * HLS-001 AC4 — the catalog has exactly one reader.
 *
 * It used to have twenty-eight: `scripts/emit-app.ts`, two other scripts, and twenty-five test
 * files, each computing its own `path.join(__dirname, '..', '..', 'noodl-types', 'src',
 * 'node-catalog.json')`. That is invisible while everything is in one checkout and fatal the
 * moment somebody installs the package, because `@noodl/types` is not something they have.
 *
 * 🔴 **Asserted by counting the files, not by checking a list of known callers.** A hand-kept list
 * passes forever after the twenty-ninth caller is added and nobody updates it; a count goes red on
 * the twenty-ninth caller whether or not anyone remembered this file existed.
 */
import { execFileSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { catalogPath, loadCatalog } from '../src/catalog';

const PKG = path.join(__dirname, '..');

/** Every file in the package (excluding build output) that names the catalog artefact. */
function namesTheCatalog(): string[] {
  const out = execFileSync(
    'grep',
    ['-ral', '--include=*.ts', '--include=*.mjs', 'node-catalog.json', 'src', 'tests', 'scripts'],
    { cwd: PKG, encoding: 'utf8' }
  );
  return out
    .split('\n')
    .filter(Boolean)
    // This file names the artefact too — in the search string above and in the prose explaining
    // why the search exists. Counting itself would make the gate assert `2`, and the day a real
    // caller came back it would still assert `2`. Excluded by name, which is safe precisely
    // because it is the one file the gate is not trying to police.
    .filter((f) => f !== 'tests/hls001-catalog-cardinality.test.ts')
    .sort();
}

describe('HLS-001 AC4 — one accessor, one source', () => {
  it('exactly one file in the package names the catalog artefact', () => {
    expect(namesTheCatalog()).toEqual(['src/catalog.ts']);
  });

  it('the search actually searches (the control)', () => {
    // Without this, a grep that silently matched nothing — a mistyped path, a missing --include —
    // would make the assertion above pass by finding zero files rather than by finding one.
    const anyMatch = execFileSync(
      'grep',
      ['-ral', '--include=*.ts', 'parseProject', 'src', 'tests'],
      { cwd: PKG, encoding: 'utf8' }
    ).split('\n').filter(Boolean);
    expect(anyMatch.length).toBeGreaterThan(30);
  });

  it('the accessor resolves and parses a real catalog', () => {
    const catalog = loadCatalog();
    expect(catalog.catalogFormatVersion).toBeTruthy();
    expect(catalog.nodes.length).toBeGreaterThan(100);
  });

  it('🔴 the editor bundles the same bytes the accessor reads', () => {
    // The editor imports the catalog statically (`exportReactCode.ts`), because it is bundled by
    // webpack into the renderer where there is no filesystem read to do. That is a second
    // *mechanism* and it cannot move into this package without reintroducing the outbound import
    // AC2 exists to forbid. What can be asserted is that both mechanisms land on the same file —
    // which is the drift this AC is really about.
    const editorImport = path.join(PKG, '..', 'noodl-types', 'src', 'node-catalog.json');
    const sha = (p: string) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    expect(fs.existsSync(editorImport)).toBe(true);
    expect(sha(catalogPath())).toBe(sha(editorImport));
  });
});
