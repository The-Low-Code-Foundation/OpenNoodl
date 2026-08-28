import * as fs from 'fs';
import * as path from 'path';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { propIdentifier, propIdentifiers } from '../src/emit/naming';
import { ComponentIR, ExportIR } from '../src/ir/types';

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const ir = parseProject(FIXTURE, catalog);

const cloneIr = (): ExportIR => structuredClone(ir);
const componentOf = (source: ExportIR, componentPath: string): ComponentIR =>
  source.components.find((c) => c.path === componentPath)!;

/**
 * Rename one component input port everywhere the graph names it: the declaring node's port, the
 * wires leaving it, and the parameter every instance sets. This is what the editor's own rename
 * does, and doing it in one helper is the point — a test that renamed only the declaration would
 * pass while parent and child had quietly stopped agreeing.
 */
const renamePort = (source: ExportIR, componentPath: string, from: string, to: string) => {
  const component = componentOf(source, componentPath);
  for (const node of component.nodes) {
    if (node.type !== 'Component Inputs') continue;
    for (const port of node.declaredPorts) if (port.name === from) port.name = to;
  }
  for (const connection of component.connections) {
    if (connection.fromProperty === from) connection.fromProperty = to;
  }
  const legacy = `/${componentPath}`;
  for (const other of source.components) {
    for (const node of other.nodes) {
      if (node.type !== legacy) continue;
      for (const param of node.parameters) if (param.name === from) param.name = to;
    }
    for (const connection of other.connections) {
      const target = other.nodes.find((n) => n.id === connection.toId);
      if (target?.type === legacy && connection.toProperty === from) connection.toProperty = to;
    }
  }
};

// ---------------------------------------------------------------------------------------------
// §10d(1): a component input port name is user text and a TypeScript identifier is not. `Align X`
// was emitted verbatim into the Props interface and the destructuring — 558 of the corpus run's
// 593 diagnostics were the syntax errors that followed. A prop cannot be quoted the way a record
// field can, so the props path maps the name to an identifier and carries that mapping onto every
// surface at once: interface, destructuring, reader, and the caller's JSX attribute.
// ---------------------------------------------------------------------------------------------

describe('the name → identifier mapping', () => {
  test('a spaced name joins its words; the corpus names all read back as themselves', () => {
    expect(propIdentifier('Align X')).toBe('AlignX');
    expect(propIdentifier('Margin Bottom')).toBe('MarginBottom');
    expect(propIdentifier('Alternate text')).toBe('AlternateText');
    expect(propIdentifier('Filter Values')).toBe('FilterValues');
    expect(propIdentifier('Show Label')).toBe('ShowLabel');
  });

  test('a name that is already a bindable identifier is untouched', () => {
    for (const name of ['Name', 'value', 'onClick', '_private', '$ref', 'x2']) {
      expect(propIdentifier(name)).toBe(name);
    }
  });

  test('punctuation is separator, not content', () => {
    expect(propIdentifier('min-width')).toBe('minWidth');
    expect(propIdentifier('user.name')).toBe('userName');
    expect(propIdentifier('  leading and trailing  ')).toBe('leadingAndTrailing');
  });

  test('a leading digit and an empty result both fall back rather than emit an illegal name', () => {
    expect(propIdentifier('2 Column')).toBe('prop2Column');
    expect(propIdentifier('!!!')).toBe('prop');
    expect(propIdentifier('')).toBe('prop');
  });

  test('a reserved word parses as an identifier and still cannot be bound, so it is renamed', () => {
    expect(propIdentifier('class')).toBe('classProp');
    expect(propIdentifier('default')).toBe('defaultProp');
    expect(propIdentifier('new')).toBe('newProp');
    // Not reserved, and not renamed: the mapping is for names that cannot bind, not names that
    // look risky.
    expect(propIdentifier('className')).toBe('className');
  });
});

describe('collisions inside one component', () => {
  const plan = (names: string[], extra: Partial<Parameters<typeof propIdentifiers>[0]> = {}) =>
    propIdentifiers({
      props: names.map((name) => ({ name })),
      outputProps: [],
      liftedOutputProps: [],
      ...extra
    });

  test('the port that is already an identifier keeps its name; the sanitised one yields', () => {
    // Declaration order deliberately puts the sanitised port first: it must still lose.
    expect([...plan(['Align X', 'AlignX']).entries()]).toEqual([
      ['AlignX', 'AlignX'],
      ['Align X', 'AlignX2']
    ]);
  });

  test('two names mapping to one identifier are separated, first-declared first', () => {
    expect([...plan(['Align X', 'Align-X', 'align x']).values()]).toEqual(['AlignX', 'AlignX2', 'alignX']);
  });

  test('the generated callback props share the destructuring, so they reserve first', () => {
    const idents = plan(['on Waved', 'on Close'], {
      outputProps: [{ prop: 'onWaved' }],
      closesPopup: true
    });
    expect(idents.get('on Waved')).toBe('onWaved2');
    expect(idents.get('on Close')).toBe('onClose2');
  });

  test('a lifted value callback reserves too', () => {
    const idents = plan(['on Count Changed'], { liftedOutputProps: [{ prop: 'onCountChanged' }] });
    expect(idents.get('on Count Changed')).toBe('onCountChanged2');
  });
});

describe('the four surfaces agree (the emitted app)', () => {
  const renamed = () => {
    const mutated = cloneIr();
    renamePort(mutated, 'Components/GreetingCard', 'Name', 'Display Name');
    return emitApp(mutated, catalog);
  };

  test('the child declares, destructures and reads the identifier', () => {
    const card = renamed().files['src/components/GreetingCard.tsx'];
    expect(card).toContain('  DisplayName?: string;');
    expect(card).toContain('export function GreetingCard({ DisplayName }: GreetingCardProps) {');
    expect(card).toContain('{DisplayName}');
    // The port name is nowhere in the code, only in the comment that records it.
    expect(card).toContain('/** Component input `Display Name`. */');
    expect(card).not.toContain('Display Name?:');
    expect(card).not.toContain('{ Display Name }');
  });

  test('the caller writes the same identifier as the attribute', () => {
    expect(renamed().files['src/pages/Home.tsx']).toContain('<GreetingCard DisplayName="Ada" />');
  });

  test('a wire into the instance takes the identifier too', () => {
    const mutated = cloneIr();
    renamePort(mutated, 'Components/GreetingCard', 'Name', 'Display Name');
    const home = componentOf(mutated, 'Pages/Home');
    home.nodes.find((n) => n.id === 'greetingCard')!.parameters = [];
    home.connections.push({
      key: 'visitorVar:value->greetingCard:Display Name',
      fromId: 'visitorVar',
      fromProperty: 'value',
      toId: 'greetingCard',
      toProperty: 'Display Name',
      kind: 'value'
    } as ComponentIR['connections'][number]);
    const page = emitApp(mutated, catalog).files['src/pages/Home.tsx'];
    expect(page).toMatch(/<GreetingCard DisplayName=\{/);
    expect(page).not.toContain('Display Name={');
  });

  test('a repeater row maps the template input while the item field keeps the graph name', () => {
    const mutated = cloneIr();
    // A record property is user text too, so the collection key is spaced as well: rename it at
    // the NewModel that mints it, and the template input the row feeds keeps matching by name.
    const notesPage = componentOf(mutated, 'Pages/Notes');
    const makeNote = notesPage.nodes.find((n) => n.id === 'makeNote')!;
    makeNote.parameters = makeNote.parameters.map((p) =>
      p.name === 'properties'
        ? { ...p, value: { kind: 'literal' as const, value: 'Note text,mood' } }
        : p.name === 'type-text'
          ? { ...p, name: 'type-Note text' }
          : p
    );
    for (const connection of notesPage.connections) {
      if (connection.toId === 'makeNote' && connection.toProperty === 'prop-text') connection.toProperty = 'prop-Note text';
    }
    renamePort(mutated, 'Components/NoteRow', 'text', 'Note text');
    const notes = emitApp(mutated, catalog).files['src/pages/Notes.tsx'];
    expect(notes).toContain(`<NoteRow key={index} NoteText={item["Note text"]} mood={item.mood} />`);
  });

  test('nothing else in the corpus fixture moved', () => {
    const before = emitApp(cloneIr(), catalog);
    const after = renamed();
    const changed = Object.keys(before.files).filter((f) => before.files[f] !== after.files[f]);
    expect(changed.sort()).toEqual(['src/components/GreetingCard.tsx', 'src/pages/Home.tsx']);
  });
});
