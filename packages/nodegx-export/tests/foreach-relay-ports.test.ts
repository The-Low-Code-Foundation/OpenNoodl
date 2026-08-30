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

// ---------------------------------------------------------------------------------------------
// §32 — the third arm: the prefix is a claim about the template, not a fact about the runtime.
//
// §31 split the *bare* relay name off the repeater's own pulses and left `itemOutputSignal-<name>`
// trusted on sight. `_managePortsForNode` (`foreach.tsx`) mints that prefix only for a template
// output declared a **signal**; a value output becomes `itemOutput-<name>`. So a wire carrying the
// signal prefix over a value output names a port that does not exist.
//
// ⚠️ Measured in the editor, not inferred: opening `cn027-drive` raises `con-no-source-port`
// ("Source port doesn't exist.", level error) on exactly this wire, while `itemsRendered` on the
// same node in the same pass stays clean — see §32.2. The from-disk census counts **12** such
// wires across 10 project directories, though `md5` shows nine of those are one authored graph
// copied nine times.
// ---------------------------------------------------------------------------------------------

describe('a repeater wire whose prefix its template contradicts (§32)', () => {
  const desk = parseProject(path.join(__dirname, 'fixtures', 'relay-desk'), catalog);
  const app = emitApp(desk, catalog);
  const noteOut = (port: string) =>
    app.notes.find((n: string) => n.includes(`wire listRepeater:${port}->`)) ?? `(no note for "${port}")`;

  test('the template’s own declaration is the discriminator, and it reads both ways', () => {
    // The control is inside the row: NoteRow declares one signal output and one value output, so
    // this is a discriminator and not a predicate that answers the same way for everything.
    const row = desk.components.find((c) => c.path === 'Components/NoteRow');
    const ports = row?.nodes.find((n) => n.type === 'Component Outputs')?.declaredPorts ?? [];
    expect(ports.find((p) => p.name === 'removed')?.kind).toBe('signal');
    expect(ports.find((p) => p.name === 'noteId')?.kind).not.toBe('signal');
  });

  test('the signal prefix over a value output is refused as a port that does not exist', () => {
    const note = noteOut('itemOutputSignal-noteId');
    expect(note).toContain('declares "noteId" as a value');
    // The port the runtime *does* register, so the author can find it without guessing.
    expect(note).toContain('itemOutput-noteId');
    expect(note).toContain('never fires in the editor either');
  });

  test('it is not refused for a downstream reason — the sentence that sent an author to wait', () => {
    // 🔴 The point of the row. In `cn027-drive` this wire was dropped as "the script reads the
    // Noodl API — Tier B": true of its target, and it tells the author to wait for an increment of
    // this exporter after which the wire would still not fire. A dead source port outranks every
    // downstream reason.
    const note = noteOut('itemOutputSignal-noteId');
    // 🔴 The positive anchor first. Mutant A (the discriminator answers "signal" everywhere) made
    // the three `not.toContain`s below pass on a note that never fired — an absence asserted with
    // no known-firing signal beside it is not a measurement. This line is what makes them one.
    expect(note).toContain('does not exist');
    expect(note).not.toContain('Tier B');
    expect(note).not.toContain("fires from the list's own progress");
    expect(note).not.toContain('output at all');
  });

  test('the three arms get three different sentences, in one pass over one node', () => {
    const bare = noteOut('removed');
    const pulse = noteOut('itemsRendered');
    const mistyped = noteOut('itemOutputSignal-noteId');
    expect(new Set([bare, pulse, mistyped]).size).toBe(3);
    expect(bare).toContain('output at all');
    expect(pulse).toContain("fires from the list's own progress");
    expect(mistyped).toContain('as a value');
  });

  test('and the relay that does translate is still untouched by the third arm', () => {
    expect(app.files['src/pages/Home.tsx']).toContain('notes.remove(item)');
  });
});
