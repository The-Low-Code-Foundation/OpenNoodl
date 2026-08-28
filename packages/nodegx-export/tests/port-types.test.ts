import * as fs from 'fs';
import * as path from 'path';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { ComponentIR, ExportIR } from '../src/ir/types';

const CHEER = path.join(__dirname, 'fixtures', 'cheer');
const PUPPY = path.join(__dirname, 'fixtures', 'puppy-test-3');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const cheerIr = parseProject(CHEER, catalog);
const puppyIr = parseProject(PUPPY, catalog);

const componentOf = (source: ExportIR, componentPath: string): ComponentIR =>
  source.components.find((c) => c.path === componentPath)!;

/**
 * Re-declare one Component Inputs port's type, which is the single thing this mapping reads.
 *
 * Nothing else moves — not the wires, not the parameters the callers set, not the port's name.
 * That is the point: every test below is a one-difference pair, so a passing assertion is
 * evidence about the *declared type* and cannot be satisfied by anything else in the graph.
 */
const retypePort = (source: ExportIR, componentPath: string, portName: string, type: string | undefined) => {
  const component = componentOf(source, componentPath);
  let found = false;
  for (const node of component.nodes) {
    if (node.type !== 'Component Inputs') continue;
    for (const port of node.declaredPorts) {
      if (port.name !== portName || port.plug !== 'output') continue;
      found = true;
      if (type === undefined) delete port.type;
      else port.type = type;
    }
  }
  // A mutation that silently hit nothing would make every assertion below vacuous.
  if (!found) throw new Error(`no declared output port "${portName}" on ${componentPath}`);
};

const propsOf = (source: ExportIR, file: string, iface: string): string[] => {
  const text = emitApp(source, catalog).files[file];
  if (text === undefined) throw new Error(`${file} was not emitted`);
  const start = text.indexOf(`export interface ${iface} {`);
  if (start === -1) throw new Error(`${iface} was not emitted into ${file}`);
  const end = text.indexOf('}', start);
  return text
    .slice(text.indexOf('\n', start) + 1, end)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
};

const puppyProbeProps = (source: ExportIR = structuredClone(puppyIr)) =>
  propsOf(source, 'src/components/BenchProbe.tsx', 'BenchProbeProps');
const cheerNoteRowProps = (source: ExportIR = structuredClone(cheerIr)) =>
  propsOf(source, 'src/components/NoteRow.tsx', 'NoteRowProps');

// ---------------------------------------------------------------------------------------------
// §15: a component prop's type is what the port declares, and `any` when it declares nothing.
//
// The editor opens a new Component Inputs port as `type: { name: '*' }`, and `*` is the untyped
// wildcard — two thirds of the corpus's 714 component ports. `tsTypeOf` fell those through a
// `default:` branch to `string`, which is the emitter claiming a type the graph refused to make.
// All four of the corpus's last diagnostics were that claim being contradicted, not a real
// mismatch: the ports they named declare `*`, not `string`.
// ---------------------------------------------------------------------------------------------

describe('an undeclared port type', () => {
  test('a `*` port is `any` — the fixture declares the wildcard and every prop reads back as any', () => {
    // puppy-test-3's BenchProbe is the real artefact, not a mutation: all seven of its ports are
    // authored `*`, which is what the PortEditor writes when nobody picks a type.
    expect(puppyProbeProps()).toEqual([
      'Title?: any;',
      'Accent?: any;',
      'Align?: any;',
      'Big?: any;',
      'Start?: any;',
      'Ping?: any;',
      'Ghost?: any;'
    ]);
  });

  test('a port carrying no type field at all is `any` too, not `string`', () => {
    const mutated = structuredClone(puppyIr);
    retypePort(mutated, 'Components/BenchProbe', 'Title', undefined);
    expect(puppyProbeProps(mutated)).toContain('Title?: any;');
  });

  test('a type name outside the emitter’s vocabulary is `any` — port types are free text', () => {
    // "names are what bind" (AiAssistant/authoring/plan.ts): there is no closed vocabulary, so a
    // name the emitter does not know is a name it must not interpret. `image URL` is a real
    // corpus type name and it is not a promise of a string.
    const mutated = structuredClone(puppyIr);
    retypePort(mutated, 'Components/BenchProbe', 'Title', 'image URL');
    expect(puppyProbeProps(mutated)).toContain('Title?: any;');
  });
});

describe('a declared port type is still honoured — the negative controls', () => {
  test('a `string` port stays `string`; widening the default did not widen the 224 typed ports', () => {
    // cheer's NoteRow authors both of its ports as `string`. This is the row that would have gone
    // red had `case 'string'` been folded into the new default.
    expect(cheerNoteRowProps()).toEqual(['text?: string;', 'mood?: string;']);
  });

  test('`number` and `boolean` survive the change', () => {
    const asNumber = structuredClone(puppyIr);
    retypePort(asNumber, 'Components/BenchProbe', 'Title', 'number');
    expect(puppyProbeProps(asNumber)).toContain('Title?: number;');

    const asBoolean = structuredClone(puppyIr);
    retypePort(asBoolean, 'Components/BenchProbe', 'Title', 'boolean');
    expect(puppyProbeProps(asBoolean)).toContain('Title?: boolean;');
  });

  test('`array` keeps its `any[]` — the §10 ruling for a repeater feed is untouched', () => {
    const mutated = structuredClone(puppyIr);
    retypePort(mutated, 'Components/BenchProbe', 'Title', 'array');
    expect(puppyProbeProps(mutated)).toContain('Title?: any[];');
  });
});

describe('the mapping reads the declaration and nothing else', () => {
  // The discriminating pair. Both halves run against the same fixture, the same wires and the
  // same caller parameters; only the declared type differs, and the emission follows it both
  // ways. A mapping that read the *feed* instead — the reading §10 refused — would not move.
  test('declaring a wildcard port `string` narrows it, and only it', () => {
    const before = puppyProbeProps();
    const mutated = structuredClone(puppyIr);
    retypePort(mutated, 'Components/BenchProbe', 'Title', 'string');
    const after = puppyProbeProps(mutated);

    expect(before[0]).toBe('Title?: any;');
    expect(after[0]).toBe('Title?: string;');
    // Every other port is untouched — the mutation moved one row, not the interface.
    expect(after.slice(1)).toEqual(before.slice(1));
  });

  test('declaring a `string` port a wildcard widens it', () => {
    const mutated = structuredClone(cheerIr);
    retypePort(mutated, 'Components/NoteRow', 'text', '*');
    expect(cheerNoteRowProps(mutated)).toEqual(['text?: any;', 'mood?: string;']);
  });
});
