import * as fs from 'fs';
import * as path from 'path';

import { Catalog, CatalogIndex } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';

const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const index = new CatalogIndex(catalog);

// ---------------------------------------------------------------------------------------------
// §31 One refusal branch was serving two populations, and its sentence was true of only one.
//
// A wire out of a `For Each` that is not an `itemOutputSignal-<name>` relay was refused as "the
// repeater's own pulse, which fires from the list's progress". That is exactly right for
// `itemsRendered` and the outcome signals. It is *false* for a bare relay name — `removed`,
// `addToBasket` — because `registerOutputIfNeeded` (`foreach.tsx`) registers only
// `itemOutputSignal-<name>` and `itemOutput-<name>` and returns having done nothing for anything
// else. There is no such port, so the wire never fires in the editor either.
//
// 🔴 The two readings ask the author for opposite things — wait for a later increment, or go and
// re-draw a wire that is already dead — which is why they now get different sentences.
//
// ⚠️ The population is real, not hypothetical: a from-disk sweep of the 8 fixtures and ~60
// projects under `NodeGX test projects` found **26** such wires in 9 projects (`cn027-drive`'s
// "add to basket" among them) and **zero** wires from a genuine list-level pulse — so every
// occurrence this branch had ever met in a real project was being told the wrong thing.
// ---------------------------------------------------------------------------------------------

describe('a repeater wire that names no port, parsed off disk (§31)', () => {
  const desk = parseProject(path.join(__dirname, 'fixtures', 'relay-desk'), catalog);
  const app = emitApp(desk, catalog);
  const noteOut = (port: string) =>
    app.notes.find((n: string) => n.includes(`wire listRepeater:${port}->`)) ?? `(no note for "${port}")`;

  test('the discriminator is read off the catalog, and reads differently for the two arms', () => {
    // The control sits in the same assertion: one of these two ports is declared and the other is
    // not, so this is a discriminator and not a predicate that answers the same way for
    // everything. `removed` is the *relay* name an author typed without the runtime's prefix.
    expect(index.portKind('For Each', 'itemsRendered', 'output')).toBe('signal');
    expect(index.portKind('For Each', 'removed', 'output')).toBeUndefined();
  });

  test('a bare relay name is refused as a port that does not exist, not as untranslated work', () => {
    expect(noteOut('removed')).toContain('a repeater has no "removed" output at all');
    expect(noteOut('removed')).toContain('never fires in the editor either');
    // 🔴 The point of the row: it must NOT claim the pulse comes from the list's progress, which
    // is what it used to say and what would send the author away to wait for an increment.
    expect(noteOut('removed')).not.toContain("fires from the list's own progress");
  });

  test('a genuine lifecycle pulse keeps the sentence that is true of it', () => {
    expect(noteOut('itemsRendered')).toContain("fires from the list's own progress");
    expect(noteOut('itemsRendered')).toContain('effect() work');
    expect(noteOut('itemsRendered')).not.toContain('output at all');
  });

  test('both reasons reach the emitted file, in the author’s own terms', () => {
    const emitted = app.files['src/components/NoteList.tsx'];
    expect(emitted).toContain('a repeater has no "removed" output at all');
    expect(emitted).toContain("fires from the list's own progress");
  });

  test('and the relay §30 does translate is untouched by the new arm', () => {
    // relay-desk carries note-desk's page verbatim; the removal must still compile to the row
    // callback, or this fixture would be grading a project that regressed underneath it.
    expect(app.files['src/pages/Home.tsx']).toContain('notes.remove(item)');
  });
});
