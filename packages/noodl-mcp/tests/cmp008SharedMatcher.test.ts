/**
 * CMP-008 AC1 — the export side and the install side read ONE definition of
 * what counts as a `var(--token)` reference.
 *
 * CMP-007 put the reason in a comment and kept a second copy of the regex under
 * it: *"The export decides what counts as a token reference; the install decides
 * which of those the host project cannot resolve. If the two ever disagreed, the
 * install would report a SUBSET and read exactly like a clean part — an
 * under-report is invisible, unlike a crash."* A shared reason with two copies
 * is the shape that drifts, and this is the half of the pair that lives here:
 * `libraryExport` now reads `collectTokenReferences` through `editor-deps`, and
 * the editor's `import-engine/tokenGap` reads the same module directly.
 *
 * 🔴 **The control arm for AC1 spans two packages and cannot be written inside
 * either.** Breaking the pattern in
 * `noodl-editor/src/editor/src/models/StyleTokensModel/TokenReferences.ts` must
 * turn this suite AND `noodl-editor/tests-unit/cmp-008/` red together; that is
 * what "one definition" means, and it was exercised by doing it.
 *
 * ⚠️ What is deliberately NOT re-asserted here: the unresolved-token plumbing on
 * `get_library_entry` and `install_prefab`, which is CMP-007's and is graded by
 * `cmp007TokensAcrossTheShelf.test.ts`. This file grades only the matcher they
 * now share.
 */

import * as fs from 'fs';
import * as path from 'path';

import { collectTokenReferences } from '../src/editor-deps';
import { entryTokens } from '../src/libraryExport';

const LIBRARY = path.resolve(__dirname, '../../../library');

/** Every shipped entry directory that has a graph behind it. */
function shelfEntries(): { slug: string; entryDir: string; projectJson: string }[] {
  const found: { slug: string; entryDir: string; projectJson: string }[] = [];
  for (const kind of ['prefabs', 'modules']) {
    const base = path.join(LIBRARY, kind);
    if (!fs.existsSync(base)) continue;
    for (const name of fs.readdirSync(base)) {
      const entryDir = path.join(base, name);
      const projectJson = path.join(entryDir, 'project', 'project.json');
      if (fs.existsSync(projectJson)) found.push({ slug: `${kind}/${name}`, entryDir, projectJson });
    }
  }
  return found;
}

describe('CMP-008 AC1 — one matcher, both sides', () => {
  it('the export side reads the shared definition rather than its own copy', () => {
    // Asserted on the SOURCE because the alternative — a behavioural check —
    // passes on two identical copies, which is precisely the state being
    // removed. A local `const TOKEN = /var\(/` here is the defect.
    const source = fs.readFileSync(path.resolve(__dirname, '../src/libraryExport.ts'), 'utf8');
    expect(source).toContain('collectTokenReferences');
    expect(source).not.toMatch(/const\s+TOKEN\s*=\s*\/var/);
  });

  it('entryTokens returns exactly what the shared matcher reads off the same bytes', () => {
    // Agreement by construction, over the real shelf rather than a fixture.
    const entries = shelfEntries();
    expect(entries.length).toBeGreaterThan(50);
    for (const entry of entries) {
      const direct = collectTokenReferences(fs.readFileSync(entry.projectJson, 'utf8'));
      expect({ slug: entry.slug, tokens: entryTokens(entry.entryDir) }).toEqual({
        slug: entry.slug,
        tokens: direct
      });
    }
  });

  it('entryTokens reads nothing for an entry with no graph, rather than throwing', () => {
    expect(entryTokens(path.join(LIBRARY, 'no-such-entry'))).toEqual([]);
  });

  it('⚠️ MEASUREMENT, not a gate: every shipped entry is a legacy single-file project', () => {
    /*
     * 🔴 This is the fact that makes `entryTokens`' `project.json` scan correct
     * HERE and wrong in the editor. A v2-format project keeps its components in
     * `components/**`, and scanning its `project.json` would return an empty
     * list — a silent zero. Every one of the shipped entries is legacy, so the
     * shelf never exercises that path, which is exactly why the editor's
     * install side scans the loaded `ProjectModel.toJSON()` instead of reusing
     * this function.
     *
     * Recorded as a measurement so that the day a v2 entry lands on the shelf,
     * this turns red and somebody reads the paragraph above rather than
     * discovering it as a part that quietly reports no tokens.
     */
    const v2 = shelfEntries().filter((e) => fs.existsSync(path.join(e.entryDir, 'project', 'components')));
    // eslint-disable-next-line no-console
    console.log(`[cmp-008] shelf: ${shelfEntries().length} entries with a graph, ${v2.length} in v2 format`);
    expect(v2).toEqual([]);
  });
});
