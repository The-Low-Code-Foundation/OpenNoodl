/**
 * FIX-021 — the wizard's Location field starts on the last folder the user chose.
 *
 * What a broken implementation scores here, which is the reason these
 * particular cells exist:
 *
 * - `() => documentsPath` — the seed that ignores the memory entirely — passes
 *   every fallback row and dies on "prefers the remembered folder".
 * - `() => String(remembered)` — the seed with no guards — passes that one row
 *   and dies on every other.
 * - `() => ''` — the behaviour this task replaces — passes only the last row.
 *
 * So no single row carries the result, and the invariant test at the bottom
 * walks the whole matrix rather than the cases that happened to occur to me.
 */

import {
  LAST_PROJECT_LOCATION_KEY,
  pickProjectLocation
} from '../../src/editor/src/pages/ProjectsPage/projectLocationMemory';

const DOCUMENTS = '/Users/someone/Documents';
const REMEMBERED = '/Volumes/work/projects';

/** `filesystem.exists` over a fixed set of folders that are on disk. */
function existsIn(...present: string[]) {
  return (path: string) => present.includes(path);
}

describe('pickProjectLocation', () => {
  it('prefers the remembered folder', () => {
    expect(
      pickProjectLocation({
        remembered: REMEMBERED,
        documentsPath: DOCUMENTS,
        exists: existsIn(REMEMBERED, DOCUMENTS)
      })
    ).toBe(REMEMBERED);
  });

  it('falls back to documents on first run, when nothing is remembered', () => {
    expect(
      pickProjectLocation({ remembered: undefined, documentsPath: DOCUMENTS, exists: existsIn(DOCUMENTS) })
    ).toBe(DOCUMENTS);
  });

  it('falls back to documents when the remembered folder is gone', () => {
    // The unmounted-volume case, and the reason the reader takes `exists` at
    // all: the basics step only checks that the string is non-empty, so seeding
    // a dead path would enable `Next` and fail at creation instead.
    expect(
      pickProjectLocation({ remembered: REMEMBERED, documentsPath: DOCUMENTS, exists: existsIn(DOCUMENTS) })
    ).toBe(DOCUMENTS);
  });

  it('falls back to documents for a setting that is not a usable path', () => {
    // Settings are JSON off disk. A hand-edited file, or a half-written one,
    // can put any of these under the key.
    const notPaths: unknown[] = [null, '', 42, true, { path: REMEMBERED }, [REMEMBERED]];
    for (const remembered of notPaths) {
      expect(
        pickProjectLocation({
          remembered,
          documentsPath: DOCUMENTS,
          // Deliberately generous: everything exists. The row still has to fall
          // back, so it is the *type* being rejected and not the existence check
          // doing the work.
          exists: () => true
        })
      ).toBe(DOCUMENTS);
    }
  });

  it('returns empty — the old behaviour — when there is no folder to offer', () => {
    // Nothing remembered and no documents folder either. Empty is not a
    // failure: it is exactly the field the wizard had before, with `Browse…`
    // the only way past the step.
    expect(pickProjectLocation({ remembered: undefined, documentsPath: '', exists: () => false })).toBe('');
    expect(
      pickProjectLocation({ remembered: REMEMBERED, documentsPath: DOCUMENTS, exists: () => false })
    ).toBe('');
  });

  it('never returns a folder that does not exist, over the whole matrix', () => {
    const rememberedValues: unknown[] = [undefined, null, '', 0, REMEMBERED, DOCUMENTS, '/gone'];
    const documentsValues = ['', DOCUMENTS, '/gone'];
    const existsSets = [existsIn(), existsIn(DOCUMENTS), existsIn(REMEMBERED), existsIn(REMEMBERED, DOCUMENTS)];

    for (const remembered of rememberedValues) {
      for (const documentsPath of documentsValues) {
        for (const exists of existsSets) {
          const picked = pickProjectLocation({ remembered, documentsPath, exists });
          // The invariant the wizard depends on: either nothing, or somewhere
          // real. Nothing in between reaches the Location field.
          expect(picked === '' || exists(picked)).toBe(true);
        }
      }
    }
  });

  it('names the settings key the writer uses', () => {
    // The reader and the writer are in two different files; this is the one
    // shared constant, and a typo in it is silent — the wizard would simply
    // never remember anything.
    expect(LAST_PROJECT_LOCATION_KEY).toBe('projects.lastCreateLocation');
  });
});
