/**
 * ERG-003 criterion 2 — every list-shaped port uses one editor, derived from the
 * catalog rather than from the spec's table.
 *
 * The derivation is the test. `listPortTypeFor` is the same function
 * `DataTypes/Ports.ts` routes on, so a port type that stops being covered fails
 * here rather than silently losing its editor.
 *
 * ⚠️ This corrects the spec. §0 tabulated 69 ports (array 26, stringlist 25,
 * object 11, proplist 7). Those figures are exact — but they count **inputs and
 * outputs together**, and the property panel only ever builds rows for
 * `getPorts('input')`. The editable surface is the input half; the outputs have
 * no editor to give them. See ERG-003-NOTES.md.
 *
 * ⚠️ The census below is a snapshot of a library that grows, and it is meant to
 * fail when the library changes — that is what makes a catalog change legible in
 * the diff. §0's 69 was the total on 2026-08-01; ERG-004 then landed
 * `Object Changed` and `Array Changed`, each with one list-shaped input, taking
 * the surface to 48 inputs / 23 outputs / 71 total. When this fails, check that
 * the new ports still *resolve* (the invariant) before updating the numbers (the
 * snapshot) — the coverage loop below is the assertion that actually matters.
 *
 * ⚠️ 2026-08-07: the library grew further (`JWT Sign`, `Log`, `To CSV` among the
 * additions) — the invariant held (nothing fell through uncovered), so this is a
 * snapshot update, not a fix. New total: 54 inputs / 32 outputs / 86 combined.
 *
 * ⚠️ 2026-09-05, and it is TWO separate movements that happen to land together.
 *
 * 1. 🔴 **The outputs count was ALREADY wrong before this session touched anything** — measured at
 *    `bc3d033b` with the pre-session catalog and codec restored: 40, not 32, and every one of the
 *    extra 8 is an `array` output on a node the library gained (`Pattern Extractor`,
 *    `Stream Buffer`, `Text Accumulator`, `JSON Stream Parser`, `State History`, `State Snapshot`,
 *    `Global Store` and friends). The invariant held throughout, so this is the snapshot update
 *    this header describes — but note that it went unnoticed because `noodl-core-ui`'s jest is in
 *    neither `test:main` nor `test:ci`. That is worth an owner; the drift is not this session's.
 * 2. §3 of `NOTES-UNOWNED-NODE-WORK.md`: `Dropdown`'s `items` moved from `array` to the new
 *    `optionslist`, so inputs stay at 54 while `array` drops by one and `optionslist` gains one.
 *    ⚠️ The deprecated `Options` twin keeps its `array` items port and is left alone.
 *
 * New totals: 54 inputs / 40 outputs / 94 combined.
 */

import { listPortTypeFor, LIST_PORT_TYPES } from '@noodl-core-ui/components/json-editor/utils/listValueCodec';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const catalog = require('../../../noodl-types/src/node-catalog.json');

interface CatalogPort {
  name: string;
  type?: unknown;
  plug?: string;
}
interface CatalogNode {
  typeName: string;
  displayName?: string;
  inputs?: CatalogPort[];
  outputs?: CatalogPort[];
}

/** Mirrors `getEditType`: an `editAsType` overrides the declared type. */
function editType(port: CatalogPort): unknown {
  const t = port.type as { editAsType?: unknown } | undefined;
  return t && typeof t === 'object' && t.editAsType ? t.editAsType : port.type;
}

const nodes: CatalogNode[] = catalog.nodes;

function collect(which: 'inputs' | 'outputs') {
  const found: { node: string; port: string; listType: string }[] = [];
  for (const node of nodes) {
    for (const port of node[which] || []) {
      const listType = listPortTypeFor(editType(port));
      if (listType) found.push({ node: node.displayName || node.typeName, port: port.name, listType });
    }
  }
  return found;
}

const inputs = collect('inputs');
const outputs = collect('outputs');

function countBy(rows: { listType: string }[]) {
  const out: Record<string, number> = {};
  for (const t of LIST_PORT_TYPES) out[t] = 0;
  rows.forEach((r) => (out[r.listType] += 1));
  return out;
}

describe('ERG-003 criterion 2 — the list-shaped port surface, derived from the catalog', () => {
  it('the catalog declares exactly five list-shaped port types', () => {
    // If a sixth ever appears in `portTypeNames`, it needs a decision, not a
    // default — hence a failing test rather than a silent pass-through. The fifth
    // was `optionslist`, and it got that decision: §3, Richard 2026-09-04.
    const declared: string[] = catalog.portTypeNames;
    const listLike = declared.filter((n) => LIST_PORT_TYPES.includes(n as never));
    expect(listLike.sort()).toEqual([...LIST_PORT_TYPES].sort());
  });

  // The invariant, asserted before any count. A census that drifts must never be
  // able to mask a port that has silently lost its editor — which is exactly what
  // happened when ERG-004 merged: the `toBe(46)` aborted the block before this
  // loop ever ran.
  it('every list-shaped INPUT port resolves to a covered type — nothing falls through', () => {
    expect(inputs.length).toBeGreaterThan(0);
    for (const row of inputs) {
      expect(LIST_PORT_TYPES).toContain(row.listType as never);
    }
  });

  it('the input census — 54 editable ports', () => {
    // Unchanged at 54: `Dropdown.items` moved between types rather than appearing or leaving.
    expect(inputs.length).toBe(54);
    expect(countBy(inputs)).toEqual({ array: 11, object: 7, stringlist: 28, proplist: 7, optionslist: 1 });
  });

  it('the spec’s 69 was inputs + outputs, and 40 of those are outputs with no editor', () => {
    expect(outputs.length).toBe(40);
    expect(countBy(outputs)).toEqual({ array: 29, object: 11, stringlist: 0, proplist: 0, optionslist: 0 });

    // The exact arithmetic behind §0's table, so the correction stays checkable.
    const combined = countBy([...inputs, ...outputs]);
    expect(combined).toEqual({ array: 40, stringlist: 28, object: 18, proplist: 7, optionslist: 1 });
    expect(inputs.length + outputs.length).toBe(94);
  });

  it('names the nodes each type appears on, so a catalog change is legible in the diff', () => {
    const nodesFor = (t: string) => [...new Set(inputs.filter((r) => r.listType === t).map((r) => r.node))].sort();

    expect(nodesFor('proplist')).toEqual(['Component Stack', 'Create Record', 'Function', 'Script', 'Update Record']);
    expect(nodesFor('object')).toEqual([
      'Global Store',
      'JWT Sign',
      'Log',
      'Object Changed',
      'Send Email',
      'Server-Sent Events',
      'State Snapshot'
    ]);
    expect(nodesFor('array')).toEqual([
      'Array',
      'Array Changed',
      'Array Filter',
      'Array Map',
      'Create New Array',
      'Filter Records',
      // ⚠️ `Options` is the deprecated twin and keeps its `array` items port. Only the live
      // `Dropdown` moved — see below.
      'Options',
      'Repeater',
      'Run Tasks',
      'To CSV'
    ]);
    expect(nodesFor('optionslist')).toEqual(['Dropdown']);
  });
});

describe('listPortTypeFor', () => {
  it('accepts both the bare name and the { name } object the library stores', () => {
    expect(listPortTypeFor('stringlist')).toBe('stringlist');
    expect(listPortTypeFor({ name: 'proplist', allowEditOnly: true })).toBe('proplist');
  });

  it('claims nothing else', () => {
    expect(listPortTypeFor('string')).toBeUndefined();
    expect(listPortTypeFor('*')).toBeUndefined();
    expect(listPortTypeFor({ name: 'enum' })).toBeUndefined();
    expect(listPortTypeFor(undefined)).toBeUndefined();
    expect(listPortTypeFor(null)).toBeUndefined();
  });
});
