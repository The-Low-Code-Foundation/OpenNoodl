import * as fs from 'fs';
import * as path from 'path';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { ComponentIR, ExportIR } from '../src/ir/types';

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const ir = parseProject(FIXTURE, catalog);

const cloneIr = (): ExportIR => structuredClone(ir);
const componentOf = (source: ExportIR, componentPath: string): ComponentIR =>
  source.components.find((c) => c.path === componentPath)!;

// ---------------------------------------------------------------------------------------------
// §13: the missing interface. A component's interface is what its `Component Inputs` node
// *declares*: `ComponentModel.getPorts()` inverts the plug, so a port plugged `output` on that
// node is an input on an instance. The corpus carries both ways of getting it wrong —
//
//   * `ecommerce-example` / `ecom-responsive-probe`: `ProductCard`'s eleven ports are all plugged
//     `input`, so the component advertises eleven outputs and no inputs (22 of the corpus's 736
//     such ports, one component cloned twice). Nothing arrives; the card renders its authored
//     placeholders. The export emitted `{image}` and eleven names failed to resolve.
//   * `phase55-replay-haiku`: `ProductCard`/`CategoryCard` have no `Component Inputs` node at all,
//     while the sections place them with six and two parameters each. The export wrote those
//     attributes onto a component with no props, and thirty of them landed on
//     `IntrinsicAttributes`.
//
// The ruling (§13b) is to refuse and name, at both ends. Minting the props from the wires would
// make `ProductCard` render — and would make the exported app disagree with the running one,
// which is the one thing this phase does not do.
//
// The two ends never meet in one corpus project, so each is pinned separately below. In this
// fixture they do meet, which is why the "both ends of one component" case can be stated at all.
// ---------------------------------------------------------------------------------------------

/**
 * The `ecommerce-example` defect: the node is there and the ports are there, plugged `input` —
 * so `getPorts()` publishes them as component *outputs* and the component declares no inputs.
 * Named for what it does to the graph, not for the outcome it produces here, because the same
 * mutation is the control for `plugComponentInputsForwards` below.
 */
const plugComponentInputsBackwards = (source: ExportIR, componentPath: string, portName?: string) => {
  for (const node of componentOf(source, componentPath).nodes) {
    if (node.type !== 'Component Inputs') continue;
    for (const port of node.declaredPorts) {
      if (portName === undefined || port.name === portName) port.plug = 'input';
    }
  }
};

/**
 * The `phase55-replay-haiku` defect: no `Component Inputs` node in the component at all. The wires
 * that left it go with it, as they do when the editor deletes a node — and that is the corpus
 * shape too: haiku's cards declare nothing *and* read nothing, so this defect only ever shows at
 * the parent end, where the sections place them with parameters anyway.
 */
const deleteComponentInputsNode = (source: ExportIR, componentPath: string) => {
  const component = componentOf(source, componentPath);
  const removed = new Set(component.nodes.filter((n) => n.type === 'Component Inputs').map((n) => n.id));
  component.nodes = component.nodes.filter((n) => !removed.has(n.id));
  component.connections = component.connections.filter((c) => !removed.has(c.fromId) && !removed.has(c.toId));
};

const notesMatching = (app: { notes: string[] }, needle: string) => app.notes.filter((n) => n.includes(needle));

describe('the interface as authored — the control the refusals below are measured against', () => {
  const app = emitApp(cloneIr(), catalog);

  test('a declared port reaches all three surfaces: the interface, the read, and the attribute', () => {
    const card = app.files['src/components/GreetingCard.tsx'];
    expect(card).toContain('export interface GreetingCardProps {');
    expect(card).toContain('  Name?: string;');
    expect(card).toContain('{Name}');
    expect(app.files['src/pages/Home.tsx']).toContain('<GreetingCard Name="Ada" />');
  });

  test('nothing is refused while the interface is right', () => {
    expect(notesMatching(app, 'does not declare it as a component input')).toEqual([]);
    expect(notesMatching(app, 'nothing is delivered to it at runtime')).toEqual([]);
  });
});

describe('the child end — a read of a port the interface does not declare', () => {
  test('the plugs backwards: the read is dropped and named, and no prop is minted from the wire', () => {
    const mutated = cloneIr();
    plugComponentInputsBackwards(mutated, 'Components/GreetingCard');
    const app = emitApp(mutated, catalog);
    const card = app.files['src/components/GreetingCard.tsx'];
    // Refused, not inferred: no interface, no parameter, no bare identifier — the TS2304 the
    // corpus reported eleven times per clone was the identifier this branch no longer writes.
    expect(card).not.toContain('GreetingCardProps');
    expect(card).not.toContain('{Name}');
    expect(card).toContain('export function GreetingCard() {');
    expect(notesMatching(app, 'nothing is delivered to it at runtime')).toEqual([
      'Components/GreetingCard: node greet-state (net.noodl.ComponentObject) deferred: "Name" is read from Component Inputs, which declares no component inputs at all — nothing is delivered to it at runtime'
    ]);
  });

  test('one port plugged backwards drops that read only — its declared sibling is untouched', () => {
    const mutated = cloneIr();
    plugComponentInputsBackwards(mutated, 'Components/NoteRow', 'mood');
    const app = emitApp(mutated, catalog);
    const row = app.files['src/components/NoteRow.tsx'];
    expect(row).toContain('  text?: string;');
    expect(row).toContain('{text}');
    expect(row).not.toContain('mood?: string;');
    expect(row).not.toContain('{mood}');
    // The reason names what the component *does* declare: a reader who sees this note can tell
    // "one port is plugged the wrong way" from "this component declares nothing at all".
    expect(notesMatching(app, 'nothing is delivered to it at runtime')).toEqual([
      'Components/NoteRow: wire rowInputs:mood->moodTag:text dropped: "mood" is not one of this component\'s declared inputs (text) — nothing is delivered to it at runtime'
    ]);
  });

  test('with no Component Inputs node there is nothing to refuse — the component just declares nothing', () => {
    // Stated so the two defects are not conflated: haiku's end has no reads to drop, and its
    // whole cost lands on the parent, below. A test that expected a child-end note here would be
    // asserting an absence that the *mutation* removed, not one the ruling refused.
    const mutated = cloneIr();
    deleteComponentInputsNode(mutated, 'Components/NoteRow');
    const app = emitApp(mutated, catalog);
    const row = app.files['src/components/NoteRow.tsx'];
    expect(row).not.toContain('NoteRowProps');
    expect(row).not.toContain('{text}');
    expect(row).not.toContain('{mood}');
    expect(notesMatching(app, 'nothing is delivered to it at runtime')).toEqual([]);
  });
});

describe('the parent end — an attribute the target does not declare', () => {
  test('a literal parameter is dropped and named, not written onto IntrinsicAttributes', () => {
    const mutated = cloneIr();
    deleteComponentInputsNode(mutated, 'Components/GreetingCard');
    const app = emitApp(mutated, catalog);
    expect(app.files['src/pages/Home.tsx']).toContain('<GreetingCard />');
    expect(app.files['src/pages/Home.tsx']).not.toContain('Name="Ada"');
    expect(notesMatching(app, 'does not declare it as a component input')).toEqual([
      'Pages/Home: instance greetingCard sets "Name" on /Components/GreetingCard, which does not declare it as a component input — dropped, reported'
    ]);
  });

  test('a wire into the instance is dropped the same way — the source resolves, the port does not', () => {
    const mutated = cloneIr();
    const home = componentOf(mutated, 'Pages/Home');
    home.nodes.find((n) => n.id === 'greetingCard')!.parameters = [];
    home.connections.push({
      key: 'visitorVar:value->greetingCard:Name',
      fromId: 'visitorVar',
      fromProperty: 'value',
      toId: 'greetingCard',
      toProperty: 'Name',
      kind: 'value'
    } as ComponentIR['connections'][number]);
    // The wire alone must still land — otherwise the refusal below would be proving nothing.
    expect(emitApp(structuredClone(mutated), catalog).files['src/pages/Home.tsx']).toMatch(/<GreetingCard Name=\{/);

    deleteComponentInputsNode(mutated, 'Components/GreetingCard');
    const app = emitApp(mutated, catalog);
    expect(app.files['src/pages/Home.tsx']).toContain('<GreetingCard />');
    expect(notesMatching(app, 'does not declare it as a component input')).toEqual([
      'Pages/Home: the wire into greetingCard.Name sets "Name" on /Components/GreetingCard, which does not declare it as a component input — dropped, reported'
    ]);
  });

  test("a repeater row's mapped input is refused too, and its declared sibling still rides", () => {
    // An authored `map({…})` names the template inputs itself, so it is the one parent-end site
    // that can write an undeclared attribute while the template declares others. No corpus
    // project does this; the row path is pinned here rather than left to the next one that does.
    const mutated = cloneIr();
    const notes = componentOf(mutated, 'Pages/Notes');
    const list = notes.nodes.find((n) => n.id === 'notesList')!;
    list.parameters = [
      ...list.parameters.filter((p) => p.name !== 'inputMappingScript'),
      {
        name: 'inputMappingScript',
        value: { kind: 'script', source: `map({'text': 'text', 'colour': 'mood'})` }
      }
    ] as ComponentIR['nodes'][number]['parameters'];
    const app = emitApp(mutated, catalog);
    expect(app.files['src/pages/Notes.tsx']).toContain('<NoteRow key={index} text={item.text} />');
    expect(notesMatching(app, 'does not declare it as a component input')).toEqual([
      'Pages/Notes: For Each notesList sets "colour" on /Components/NoteRow, which does not declare it as a component input — dropped, reported'
    ]);
  });

  test('the refusal touches the two files it names, the report, and nothing else', () => {
    const before = emitApp(cloneIr(), catalog);
    const mutated = cloneIr();
    deleteComponentInputsNode(mutated, 'Components/GreetingCard');
    const after = emitApp(mutated, catalog);
    const changed = Object.keys(before.files).filter((f) => before.files[f] !== after.files[f]);
    // 🔴 `EXPORT-REPORT.md` moving is the point of it, not blast radius. EXP-004's report is the
    // written record of what the export refused, so a new refusal that left it unchanged would be
    // the defect — it would mean the app shipped with a report that did not describe it. The
    // *code* claim is unweakened and is the line below.
    expect(changed.sort()).toEqual([
      'EXPORT-REPORT.md',
      'src/components/GreetingCard.tsx',
      'src/pages/Home.tsx'
    ]);
    expect(changed.filter((f) => f.startsWith('src/')).sort()).toEqual([
      'src/components/GreetingCard.tsx',
      'src/pages/Home.tsx'
    ]);
  });
});
