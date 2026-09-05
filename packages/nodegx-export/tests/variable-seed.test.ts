import * as fs from 'fs';
import * as path from 'path';

import { Catalog, CatalogIndex } from '../src/catalog';
import { ComponentPlan, planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ComponentIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §67 — a `Variable` node's authored `Value` is the runtime's per-mount write.
 *
 * `variablenode2.ts`: the `value` input's setter stores whatever arrives (`scheduleStore`), and the authored parameter
 * arrives at node creation — so every mount of the component holding the node rewrites the variable, and the runtime
 * reads `First note` at boot where the export read `''` (§60.4 finding 8, §60.6's drive, CONFIRMED). The translation is
 * a mount effect in the host component (`useEffect(() => note.set('First note'), [])`), never a module-level seed: a
 * seed would boot once, never reset on re-entry, and run for a component nothing ever mounted.
 *
 * Built on `tests/fixtures/panel-desk`, whose Home holds `noteVar` (`Variable2`, name `note`, value `First note`) and a
 * mirror wire reading it. Every refused shape lives here by mutation and asserts the NAMED sentence.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'panel-desk');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const index = new CatalogIndex(catalog);
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);

const HOME = 'Pages/Home';
const PANEL = 'Components/Panel';
const HOME_FILE = 'src/pages/Home.tsx';
const PANEL_FILE = 'src/components/Panel.tsx';
const STORES_FILE = 'src/stores/variables.ts';

const SEED_COMMENT =
  '  // Note variable — its authored Value is stored on every mount of this component (variablenode2.ts: the value setter runs at node creation).';
const seedEffect = (call: string) => `${SEED_COMMENT}\n  useEffect(() => {\n    ${call};\n  }, []);\n`;
const MIRROR_EFFECT = '  useEffect(() => {\n    panelState.set({ note: noteValue });\n  }, [noteValue]);';

const cloneIr = (): ExportIR => structuredClone(baseIr);
const componentOf = (source: ExportIR, componentPath: string): ComponentIR => source.components.find((c) => c.path === componentPath)!;
const nodeOf = (source: ExportIR, componentPath: string, id: string): NodeIR => componentOf(source, componentPath).nodes.find((n) => n.id === id)!;
const planOf = (source: ExportIR, componentPath: string): ComponentPlan => planProject(source, index).plans.find((p) => p.path === componentPath)!;
const setParam = (node: NodeIR, name: string, value: ParamValue) => {
  const existing = node.parameters.find((p) => p.name === name);
  if (existing) existing.value = value;
  else node.parameters.push({ name, value });
};
const dropParam = (node: NodeIR, name: string) => {
  node.parameters = node.parameters.filter((p) => p.name !== name);
};
const disconnect = (component: ComponentIR, predicate: (c: { toId: string; toProperty: string }) => boolean) => {
  component.connections = component.connections.filter((c) => !predicate(c));
};
const connect = (component: ComponentIR, fromId: string, fromProperty: string, toId: string, toProperty: string) => {
  component.connections.push({ key: `${fromId}:${fromProperty}->${toId}:${toProperty}`, fromId, fromProperty, toId, toProperty, kind: 'value' });
};
const notesOf = (source: ExportIR): string => emitApp(source, catalog).notes.join('\n');
const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

// ---------------------------------------------------------------------------------------------------
describe('§A the fixture, whole — Home seeds "note" on every mount, before the mirror that reads it', () => {
  test('A1 Home carries the mount write, exactly: the store call with the authored literal and an empty dependency list', () => {
    const src = app.files[HOME_FILE];
    expect(src).toContain(seedEffect("note.set('First note')"));
    expect(count(src, 'note.set(')).toBe(1);
  });

  test('A2 the seed precedes the mirror effect, so a mirror reading the variable follows the write', () => {
    const src = app.files[HOME_FILE];
    expect(src).toContain(MIRROR_EFFECT);
    expect(src.indexOf(SEED_COMMENT)).toBeLessThan(src.indexOf(MIRROR_EFFECT));
  });

  test('A3 the imports: useEffect once, the store once', () => {
    const src = app.files[HOME_FILE];
    expect(src).toContain("import { useEffect, useState } from 'react';");
    expect(src).toContain("import { note, status } from '../stores/variables';");
    expect(count(src, "from 'react'")).toBe(1);
  });

  test('A4 the stores module names the seed as the writer, and a string literal keeps the variable string-typed', () => {
    const stores = app.files[STORES_FILE];
    expect(stores).toContain(
      '/** Seeded with \'First note\' by "Note variable" (Variable2 `noteVar` on /Pages/Home) on every mount of its component. */\nexport const note = value<string | undefined>(undefined);'
    );
    expect(stores).not.toContain('No statically-known writer — reads stay undefined until EXP-003 translates the writing logic. */\nexport const note');
  });

  test('A5 nothing is refused and no note is written for the seed; the Variable still collapses into the stores module', () => {
    expect(app.notes).toEqual(['App: router shell — emitted as src/App.tsx by the scaffold']);
    expect(planOf(baseIr, HOME).dispositions['noteVar']).toEqual({ kind: 'collapsed', into: STORES_FILE });
    expect(planOf(baseIr, HOME).variableSeeds).toEqual([
      {
        nodeId: 'noteVar',
        variableName: 'note',
        value: 'First note',
        comment: 'Note variable — its authored Value is stored on every mount of this component (variablenode2.ts: the value setter runs at node creation).'
      }
    ]);
  });

  test('A6 the emitted app typechecks under the app\'s own strict tsconfig', () => {
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  test('A7 control: a Variable with no authored Value gets no mount write', () => {
    const src = app.files[HOME_FILE];
    expect(src).not.toContain('useEffect(() => {\n    status.set(');
    expect(planOf(baseIr, HOME).variableSeeds.map((s) => s.variableName)).toEqual(['note']);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§B the literal decides the type — a non-string seed demotes the variable to unknown, and still typechecks', () => {
  test('B1 a number literal prints as a number and the store is value<unknown>', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'noteVar'), 'value', { kind: 'literal', value: 42 });
    const out = emitApp(ir, catalog);
    expect(out.files[HOME_FILE]).toContain(seedEffect('note.set(42)'));
    expect(out.files[STORES_FILE]).toContain('Seeded with 42 by "Note variable" (Variable2 `noteVar` on /Pages/Home) on every mount of its component. */\nexport const note = value<unknown>(undefined);');
    expect(typecheckEmittedApp(out)).toEqual([]);
  });

  test('B2 a boolean literal prints as a boolean and the store is value<unknown>', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'noteVar'), 'value', { kind: 'literal', value: true });
    const out = emitApp(ir, catalog);
    expect(out.files[HOME_FILE]).toContain(seedEffect('note.set(true)'));
    expect(out.files[STORES_FILE]).toContain('export const note = value<unknown>(undefined);');
  });

  test('B3 a string the single-quote form cannot hold takes the JSON form', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'noteVar'), 'value', { kind: 'literal', value: "it's a note" });
    const out = emitApp(ir, catalog);
    expect(out.files[HOME_FILE]).toContain(seedEffect('note.set("it\'s a note")'));
    expect(out.files[STORES_FILE]).toContain('value<string | undefined>(undefined);');
  });

  test('B4 an empty string is a seed too — the runtime stores "" exactly as it stores any other value', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'noteVar'), 'value', { kind: 'literal', value: '' });
    expect(emitApp(ir, catalog).files[HOME_FILE]).toContain(seedEffect("note.set('')"));
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§C what is refused, by name — and what the seed leaves alone', () => {
  test('C1 an authored Value under a wire into Value is not seeded: the wire governs, the note says so, the writer is the wire\'s source', () => {
    const ir = cloneIr();
    connect(componentOf(ir, HOME), 'titleInput', 'onTextChanged', 'noteVar', 'value');
    const out = emitApp(ir, catalog);
    expect(out.notes).toContain(
      'Pages/Home: node noteVar (Variable2): its authored Value is not seeded — a wire into Value governs "note" (the runtime delivers the parameter first and every arrival on the wire over it)'
    );
    expect(out.files[HOME_FILE]).not.toContain(SEED_COMMENT);
    expect(out.files[HOME_FILE]).not.toContain("note.set('First note')");
    expect(out.files[STORES_FILE]).not.toContain('Seeded with');
    expect(out.files[STORES_FILE]).toContain('/** Written by "Title" (net.noodl.controls.textinput `titleInput` on /Pages/Home). */\nexport const note = value<string | undefined>(undefined);');
    expect(planOf(ir, HOME).variableSeeds).toEqual([]);
  });

  test('C2 a Value that is not a primitive literal is refused by name — an expression parameter has no store-set form', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'noteVar'), 'value', { kind: 'expression', source: 'Date.now()' });
    const out = emitApp(ir, catalog);
    expect(out.notes).toContain('Pages/Home: node noteVar (Variable2): its authored Value is not a string, number or boolean literal — not seeded into "note"');
    expect(out.files[HOME_FILE]).not.toContain(SEED_COMMENT);
    expect(out.files[STORES_FILE]).toContain('/** No statically-known writer — reads stay undefined until EXP-003 translates the writing logic. */\nexport const note');
  });

  test('C3 a logic-only component (no visual root) is refused whole before the seed pass runs — the node is a logic node, nothing seeds', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    home.nodes = home.nodes.filter((n) => n.id === 'noteVar');
    home.connections = [];
    const out = emitApp(ir, catalog);
    const plan = planOf(ir, HOME);
    expect(plan.file).toBeNull();
    expect(plan.variableSeeds).toEqual([]);
    expect(plan.dispositions['noteVar']).toEqual({ kind: 'deferred', to: 'EXP-003', reason: 'logic node (Variable2)' });
    expect(out.notes).toContain('Pages/Home: no visual root — logic-only components defer to EXP-003');
    expect(Object.values(out.files).some((f) => f.includes("note.set('First note')"))).toBe(false);
  });

  test('C4 a Variable whose name is not a literal defers on the name — the seed pass never speaks', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'noteVar'), 'name', { kind: 'expression', source: 'x' });
    const out = emitApp(ir, catalog);
    expect(out.notes).toContain('Pages/Home: node noteVar (Variable2) deferred: variable name is not a literal');
    expect(out.notes.filter((n) => n.includes('seeded'))).toEqual([]);
    expect(out.files[HOME_FILE]).not.toContain(SEED_COMMENT);
  });

  test('C6 a Set Variable\'s authored Value is not a seed — the Set writes on its pulse, not at mount (§60.4 finding 7: the export refuses it by name)', () => {
    const ir = cloneIr();
    // The fixture wires a String into the Set's value; stand the authored literal alone, as an author who typed it would.
    disconnect(componentOf(ir, HOME), (c) => c.toId === 'setStatus' && c.toProperty === 'value');
    setParam(nodeOf(ir, HOME, 'setStatus'), 'value', { kind: 'literal', value: 'Pulsed.' });
    const out = emitApp(ir, catalog);
    expect(out.files[STORES_FILE]).not.toContain("Seeded with 'Pulsed.'");
    expect(out.files[HOME_FILE]).not.toContain("status.set('Pulsed.')");
    expect(planOf(ir, HOME).variableSeeds.map((s) => s.variableName)).toEqual(['note']);
  });

  test('C5 no authored Value — no seed, no note, no writer line: today\'s shape, untouched', () => {
    const ir = cloneIr();
    dropParam(nodeOf(ir, HOME, 'noteVar'), 'value');
    const out = emitApp(ir, catalog);
    expect(out.notes).toEqual(['App: router shell — emitted as src/App.tsx by the scaffold']);
    expect(out.files[HOME_FILE]).not.toContain('useEffect(() => {\n    note.set(');
    expect(out.files[STORES_FILE]).toContain('/** No statically-known writer — reads stay undefined until EXP-003 translates the writing logic. */\nexport const note');
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§D per host, not per module — a second Variable node with its own Value seeds from its own component', () => {
  test('D1 a Variable in Panel reading "note" with an authored Value writes from Panel: its own effect, its own imports, both writers listed', () => {
    const ir = cloneIr();
    const panel = componentOf(ir, PANEL);
    panel.nodes.push({
      id: 'panelNoteVar',
      type: 'Variable2',
      catalogRef: 'Variable2',
      authoredLabel: 'Panel note variable',
      parameters: [
        { name: 'name', value: { kind: 'literal', value: 'note' } },
        { name: 'value', value: { kind: 'literal', value: 'From the panel' } }
      ],
      declaredPorts: [],
      portKnowledge: 'complete'
    } as NodeIR);
    const out = emitApp(ir, catalog);
    const panelSrc = out.files[PANEL_FILE];
    expect(panelSrc).toContain(
      "  // Panel note variable — its authored Value is stored on every mount of this component (variablenode2.ts: the value setter runs at node creation).\n  useEffect(() => {\n    note.set('From the panel');\n  }, []);\n"
    );
    expect(panelSrc).toMatch(/import \{ [^}]*useEffect[^}]* \} from 'react';/);
    expect(panelSrc).toMatch(/import \{ [^}]*\bnote\b[^}]* \} from '\.\.\/stores\/variables';/);
    expect(out.files[HOME_FILE]).toContain(seedEffect("note.set('First note')"));
    expect(out.files[STORES_FILE]).toContain(
      // Component order (Components before Pages), as every writers comment is listed.
      "/**\n * Seeded with 'From the panel' by \"Panel note variable\" (Variable2 `panelNoteVar` on /Components/Panel) on every mount of its component.\n * Seeded with 'First note' by \"Note variable\" (Variable2 `noteVar` on /Pages/Home) on every mount of its component.\n */\nexport const note"
    );
    expect(planOf(ir, PANEL).variableSeeds.map((s) => s.nodeId)).toEqual(['panelNoteVar']);
    expect(typecheckEmittedApp(out)).toEqual([]);
  });
});
