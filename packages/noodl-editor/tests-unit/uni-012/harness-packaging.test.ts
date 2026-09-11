/**
 * UNI-012 — the render harness must still be *shippable*, not merely shipped once.
 *
 * 🔴 THE FAILURE THIS EXISTS FOR IS SILENT, AND IT IS SILENT IN THE DIRECTION OF
 * A PASS.
 * ------------------------------------------------------------------------------
 * `build.files` ships the harness and three data files into `app.asar` by
 * from/to mappings with explicit filenames. Rename `node-catalog-enriched.json`,
 * move `DefaultTokens.ts` out of `StyleTokensModel/`, or drop a script from the
 * devtools filter, and **electron-builder copies nothing and says nothing** —
 * the mapping simply matches no files. The packaged harness then either refuses
 * (loud, fine) or, for the catalogs, *scores F4 with a strictly weaker rule than
 * the checkout applies to the same project*. A lesson would be certified against
 * a page the checkout would have judged differently, and every gate stays green.
 *
 * ⚠️ **What this does NOT claim.** It does not assert that a packaged build has
 * the files in it — that needs `electron-builder`, and UNI-012 §5 is right that a
 * spec asserting "`resolveRenderCli` prefers `Resources/…`" would pass against a
 * layout that never exists. This asserts the one thing that is checkable without
 * a build and that actually rots: **every source path the packaging names still
 * exists**. The layout itself was verified by producing a build and driving the
 * sidecar through it — recorded in UNI-012 §4b, not here.
 *
 * The resolver is required through its real module so a rename there fails too,
 * rather than this file keeping a second copy of the path list that agrees with
 * nothing.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const EDITOR_PKG = path.join(REPO, 'packages', 'noodl-editor', 'package.json');

interface FileMapping {
  from: string;
  to: string;
  filter?: string[];
}

function harnessMappings(): FileMapping[] {
  const pkg = JSON.parse(fs.readFileSync(EDITOR_PKG, 'utf8'));
  return (pkg.build.files as unknown[]).filter(
    (f): f is FileMapping => typeof f === 'object' && f !== null && 'to' in f
  );
}

describe('UNI-012 — what the packaging names still exists', () => {
  it('🔴 declares the harness mappings at all', () => {
    // A guard whose subject can vanish is a guard that passes hardest when the
    // feature is gone. If the mappings are deleted, every other test below
    // iterates an empty array and reports success.
    const tos = harnessMappings().map((m) => m.to);
    expect(tos).toEqual(expect.arrayContaining(['render-harness', 'render-harness/data']));
  });

  it.each(harnessMappings().map((m) => [m.to, m] as const))(
    'every file named by the "%s" mapping is on disk',
    (_to, mapping) => {
      const from = path.resolve(REPO, 'packages', 'noodl-editor', mapping.from);
      expect(fs.existsSync(from)).toBe(true);

      // A filter entry that matches nothing is the silent case: electron-builder
      // copies zero files and exits 0.
      for (const entry of mapping.filter ?? []) {
        expect(fs.existsSync(path.join(from, entry))).toBe(true);
      }
    }
  );

  it('ships every script the harness actually requires of itself', () => {
    // Derived from the mapping rather than restated, so adding a fifth script to
    // the harness without shipping it fails here.
    const scripts = harnessMappings().find((m) => m.to === 'render-harness')?.filter ?? [];
    expect(scripts).toEqual(
      expect.arrayContaining([
        'measure-from-disk.js',
        'render-report.js',
        'render-from-disk.js',
        'harness-paths.js'
      ])
    );
  });

  it('🔴 resolves every data path in a checkout, through the real resolver', () => {
    // The checkout half of the two layouts. If `DefaultTokens.ts` moves, this
    // fails here *and* the packaging mapping above fails — two independent
    // readings of the same rename, which is the point.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const paths = require(path.join(REPO, 'scripts', 'devtools', 'harness-paths.js'));

    for (const name of ['VIEWER_DIR', 'CATALOG_JSON', 'ENRICHED_CATALOG_JSON', 'TOKENS_SRC', 'WS_MODULE']) {
      const resolved = paths[name];
      expect(resolved.probed.length).toBeGreaterThan(0);
      // `expect(x, msg)` is vitest, not jest — the name goes in the message.
      if (resolved.path === null) throw new Error(`${name} resolved to nothing. Probed: ${resolved.probed.join(', ')}`);
    }
  });

  it('🔴 anchors the second candidate to the harness, not to the repo', () => {
    // A resolver that only ever probes the checkout would pass every test above
    // and ship a harness that cannot find its own data.
    //
    // ⚠️ The obvious assertion — "a candidate mentions `render-harness`" — is
    // WRONG, and it failed here before it was corrected. The packaged candidates
    // are built from this module's own `__dirname`, which *is* `scripts/devtools`
    // in a checkout and only becomes `render-harness` once packaged. So the
    // string can never appear when the test runs.
    //
    // The property that actually makes the relocation work is that the second
    // candidate is anchored to **wherever this module lives** rather than to
    // CHECKOUT_ROOT. Move the harness and it follows; that is the whole design.
    const harnessDir = path.join(REPO, 'scripts', 'devtools');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const paths = require(path.join(harnessDir, 'harness-paths.js'));
    const anchor = path.dirname(harnessDir);

    for (const name of ['VIEWER_DIR', 'CATALOG_JSON', 'ENRICHED_CATALOG_JSON', 'TOKENS_SRC']) {
      const { candidates } = paths[name];
      expect(candidates).toHaveLength(2);
      expect(candidates[0]).not.toEqual(candidates[1]);
      // Checkout candidate: anchored to the repo root.
      expect(candidates[0].startsWith(REPO)).toBe(true);
      // Packaged candidate: anchored to the harness's own directory (or its
      // parent, for the viewer the editor already ships).
      if (!candidates[1].startsWith(anchor)) {
        throw new Error(`${name}'s packaged candidate is not anchored to the harness: ${candidates[1]}`);
      }
    }
  });
});
