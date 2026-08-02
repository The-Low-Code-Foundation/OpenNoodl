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
 * `getPorts('input')`. The editable surface is 46 input ports; the other 23 are
 * outputs and have no editor to give them. See ERG-003-NOTES.md.
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
  it('the catalog declares exactly four list-shaped port types', () => {
    // If a fifth ever appears in `portTypeNames`, it needs a decision, not a
    // default — hence a failing test rather than a silent pass-through.
    const declared: string[] = catalog.portTypeNames;
    const listLike = declared.filter((n) => LIST_PORT_TYPES.includes(n as never));
    expect(listLike.sort()).toEqual([...LIST_PORT_TYPES].sort());
  });

  it('every list-shaped INPUT port resolves to a covered type — 46 of them', () => {
    expect(inputs.length).toBe(46);
    expect(countBy(inputs)).toEqual({ array: 10, object: 4, stringlist: 25, proplist: 7 });

    // The routing function must claim every one of them; nothing falls through.
    for (const row of inputs) {
      expect(LIST_PORT_TYPES).toContain(row.listType as never);
    }
  });

  it('the spec’s 69 is inputs + outputs, and 23 of those are outputs with no editor', () => {
    expect(outputs.length).toBe(23);
    expect(countBy(outputs)).toEqual({ array: 16, object: 7, stringlist: 0, proplist: 0 });

    // The exact arithmetic behind §0's table, so the correction is checkable.
    const combined = countBy([...inputs, ...outputs]);
    expect(combined).toEqual({ array: 26, stringlist: 25, object: 11, proplist: 7 });
    expect(inputs.length + outputs.length).toBe(69);
  });

  it('names the nodes each type appears on, so a catalog change is legible in the diff', () => {
    const nodesFor = (t: string) => [...new Set(inputs.filter((r) => r.listType === t).map((r) => r.node))].sort();

    expect(nodesFor('proplist')).toEqual(['Component Stack', 'Create Record', 'Function', 'Script', 'Update Record']);
    expect(nodesFor('object')).toEqual(['Global Store', 'Send Email', 'Server-Sent Events', 'State Snapshot']);
    expect(nodesFor('array')).toEqual([
      'Array',
      'Array Filter',
      'Array Map',
      'Create New Array',
      'Dropdown',
      'Filter Records',
      'Options',
      'Repeater',
      'Run Tasks'
    ]);
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
