/**
 * FB-018 AC2 — every property row class either chips or has a recorded reason.
 *
 * 🔴 THE POPULATION COMES FROM `Ports.ts`, NOT FROM THE TABLE UNDER TEST. The dispatch
 * chain at the bottom of `Ports.getTypeView` is what actually decides which row class a
 * port gets, so it is parsed out of the real file here. A sweep that took its list of
 * classes from `connectedRowPolicy.ts` would be checking that file against itself and
 * would pass forever — including on the exact failure this task exists to prevent, which
 * is a row class nobody thought about.
 *
 * ⚠️ WHAT THIS FILE DOES NOT DO. It grades the RECORD, not the RENDERING. A `chip` entry
 * here passing proves somebody wrote `chip`; `bindingChipRows.test.tsx` is what renders
 * the components and proves a chip appears. Both are needed and neither substitutes: this
 * one catches the row nobody decided about, that one catches the decision that was never
 * implemented.
 */
import * as fs from 'fs';
import * as path from 'path';

import {
  CONNECTED_ROW_POLICY,
  DEFERRED_ROW_CLASSES
} from '../../src/editor/src/views/panels/propertyeditor/DataTypes/connectedRowPolicy';

const PORTS_TS = path.join(
  __dirname,
  '../../src/editor/src/views/panels/propertyeditor/DataTypes/Ports.ts'
);

/**
 * The class names `getTypeView`'s dispatch chain can return.
 *
 * ⚠️ `ByobFilterType` is returned by two different branches (the query filter port and the
 * byob filter port both render the one builder — BCN-003b), so the raw match list is
 * longer than the set. Deduplicating is correct; asserting on the raw length would break
 * the next time two port shapes share a row, which is a thing this codebase does on
 * purpose.
 */
function dispatchedRowClasses(): string[] {
  const source = fs.readFileSync(PORTS_TS, 'utf8');
  const matches = source.match(/(?:if|else if)\s*\(isOf\w+\(\)\)\s*return\s+(\w+);/g) || [];
  const names = matches.map((m) => /return\s+(\w+);/.exec(m)[1]);
  return Array.from(new Set(names)).sort();
}

describe('FB-018 — the connected-row policy covers every row class', () => {
  // A parser that silently matched nothing would make every "no missing rows" assertion
  // below pass on an empty set. So the population is checked for plausibility first, and
  // for a landmark that must be in it: `Dimension` is the row the task was filed about.
  it('parses a plausible dispatch chain out of Ports.ts', () => {
    const classes = dispatchedRowClasses();
    expect(classes.length).toBeGreaterThan(25);
    expect(classes).toContain('Dimension');
    expect(classes).toContain('BasicType');
  });

  it('records a decision for every class the dispatch chain returns', () => {
    const undecided = dispatchedRowClasses().filter((name) => !CONNECTED_ROW_POLICY[name]);
    expect(undecided).toEqual([]);
  });

  // The other direction. An entry for a class the chain can no longer return is a
  // decision about nothing — it reads as coverage while covering a deleted row.
  it('has no entry for a class the dispatch chain cannot return', () => {
    const dispatched = new Set(dispatchedRowClasses());
    const stale = Object.keys(CONNECTED_ROW_POLICY).filter((name) => !dispatched.has(name));
    expect(stale).toEqual([]);
  });

  it('gives every non-chip row a non-empty reason', () => {
    const unreasoned = Object.entries(CONNECTED_ROW_POLICY)
      .filter(([, policy]) => policy.kind !== 'chip')
      .filter(([, policy]) => !(policy as { reason?: string }).reason?.trim())
      .map(([name]) => name);
    expect(unreasoned).toEqual([]);
  });

  // AC2's cardinality: chip + exception + deferred accounts for all of them, with nothing
  // counted twice and nothing falling through a fourth kind added later.
  it('partitions the dispatch chain exactly — chip + exception + deferred = all', () => {
    const dispatched = dispatchedRowClasses();
    const byKind = { chip: 0, exception: 0, deferred: 0 };
    for (const name of dispatched) {
      const kind = CONNECTED_ROW_POLICY[name].kind;
      byKind[kind] += 1;
    }
    expect(byKind.chip + byKind.exception + byKind.deferred).toBe(dispatched.length);
    // The rollout that stalled at five is the reason this task exists; it must not be
    // able to quietly return to five.
    expect(byKind.chip).toBeGreaterThanOrEqual(16);
  });

  // The pinned list is a literal in the source file precisely so that it cannot agree
  // with the table by construction. This asserts the two match in BOTH directions, so a
  // row that becomes deferred without being named here fails.
  it('pins the deferred list against the table, both ways', () => {
    const derived = Object.entries(CONNECTED_ROW_POLICY)
      .filter(([, policy]) => policy.kind === 'deferred')
      .map(([name]) => name)
      .sort();
    expect(derived).toEqual([...DEFERRED_ROW_CLASSES].sort());
  });

  it('does not defer the row the task was filed about', () => {
    expect(CONNECTED_ROW_POLICY.Dimension.kind).toBe('chip');
    expect(DEFERRED_ROW_CLASSES).not.toContain('Dimension');
  });
});
