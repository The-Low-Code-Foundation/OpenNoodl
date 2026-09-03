/**
 * DEF-041 (phase 80) — **the two doors that mint a brand-new node must seed it the same way.**
 *
 * Promoted from `UNOWNED-ROWS-TO-MEASURE.md`'s drag-door row. `ElementConfigRegistry.applyDefaults`
 * had exactly one call site while `seedNewNode` had two, and the row read that asymmetry as a live
 * accessibility defect: *"the same control is accessible or not depending on which gesture created
 * it."*
 *
 * 🔴 **Driven 2026-09-03, and the row is DISPROVED as a live defect.** The only drag source that
 * reaches `NodeOperations.createNewNode` is the Components panel, which carries a **project
 * component**; `ElementConfigRegistry.has('/Site/Nav')` is `false`, because the configs are keyed
 * by built-in type names. Dragging the picker's Checkbox card created **nothing** — measured
 * beside a control drag that created `/Site/Nav`, so the zero is a fact about the card and not
 * about the gesture. No gesture places a bare Checkbox.
 *
 * What survives is a **latent trap**: `DragItem.nodeType` is declared, is read by
 * `getDragItemComponent`, and is assigned by nothing. The day anything assigns it, the drag door
 * would mint untokenised controls in silence.
 *
 * ⚠️ **This gate DERIVES its population from source rather than listing the two doors**, because
 * the failure it guards is a *third* door being added that seeds one way and not the other —
 * exactly the drift `newNodeSeed.ts`'s own docstring names. A hand-written pair list would go
 * stale the moment that happened, which is the shape DEF-038 was built to avoid.
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '../../src/editor/src');

/** Every source file under the editor, minus build artefacts. */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      sourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

const FILES = sourceFiles(SRC).map((f) => ({ path: f, text: fs.readFileSync(f, 'utf8') }));

/** Files that CALL a function, ignoring the file that defines it and any import line. */
function callers(fn: string, definedIn: RegExp): string[] {
  return FILES.filter((f) => {
    if (definedIn.test(f.path)) return false;
    return new RegExp(`(?<!function\\s)\\b${fn}\\s*\\(`).test(f.text);
  }).map((f) => path.relative(SRC, f.path));
}

describe('DEF-041 — both node-creation doors seed the same way', () => {
  it('the derived population is non-empty — otherwise this whole gate reads green on nothing', () => {
    // The control for the instrument itself. A regex that matched nothing would make every
    // assertion below trivially true, which is the way a sweep like this fails silently.
    expect(FILES.length).toBeGreaterThan(100);
    expect(callers('seedNewNode', /nodeSeed[/\\]seedNewNode\.ts$/).length).toBeGreaterThan(0);
  });

  it('🔴 every door that calls seedNewNode also calls applyDefaults', () => {
    const seeders = callers('seedNewNode', /nodeSeed[/\\]seedNewNode\.ts$/).sort();
    const stampers = callers('applyDefaults', /ElementConfigs[/\\]ElementConfigRegistry\.ts$/).sort();

    // Stated as a set comparison rather than a count, so a failure names the door.
    const missing = seeders.filter((f) => !stampers.includes(f));
    expect(missing).toEqual([]);
  });

  it('and both known doors are in that population, so the sweep is looking at the right thing', () => {
    const seeders = callers('seedNewNode', /nodeSeed[/\\]seedNewNode\.ts$/);

    expect(seeders).toContain(path.join('views', 'NodePicker', 'NodePicker.utils.ts'));
    expect(seeders).toContain(path.join('views', 'nodegrapheditor', 'NodeOperations.ts'));
  });

  it('the trap that keeps this row alive: DragItem.nodeType is read but never assigned', () => {
    const dragFile = FILES.find((f) => f.path.endsWith(path.join('views', 'nodegrapheditor.drag.ts')));
    expect(dragFile).toBeDefined();

    // Read by getDragItemComponent…
    expect(dragFile!.text).toContain('dragItem.nodeType');

    // …and assigned by nothing, anywhere. If this ever goes red, a drag source has started
    // carrying a built-in node type and the door above is the one that has to have applyDefaults.
    const assigners = FILES.filter((f) => /\bnodeType\s*:/.test(f.text) && /startDragging/.test(f.text));
    expect(assigners.map((f) => path.relative(SRC, f.path))).toEqual([]);
  });
});
