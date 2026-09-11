/**
 * EXP-011 §74 — a value typed into a Set's port that ALSO has a wire (session 96, 2026-09-06).
 *
 * Five registers (§67.5 #1, §68.5 #1, §69.5 #1, §70.5 #1, §71.5 #1) called the shape "shadowed": the export compiled the
 * wire and never read the typed-in value. Measured in the runtime first
 * (`noodl-runtime/test/corpus/exp-011-s96-a-literal-under-a-wire.test.ts`): `nodescope.ts` queues the typed-in parameter
 * at creation; `connectInput` queues the wire's CURRENT value over it only when that value is defined; every later
 * delivery lands over it too. So at any Do a Set holds the wire's last defined delivery, else the typed-in value.
 *
 * - A source that always carries a value (a text input emits at mount; a String/Number/Boolean constant is delivered
 *   at boot) has landed before the first Do: the typed-in value is never written, in the runtime or here. A NOTE says so.
 * - A source this export reads as possibly `undefined` (a Variable nothing wrote, a store key without an initial state,
 *   a component input, a payload key, …) is the runtime's "delivers nothing until written": the handler prints
 *   `expr ?? typed`, and the typed-in value is a typed source of the variable/key (a number under a string wire makes
 *   it `unknown`, and the built app typechecks — without the registration the same handler is TS2345).
 *
 * The decision lives in two files, as every sibling's did: `plan.ts` `typedInUnderWire` (the write, on
 * `maybeUndefinedExpr`) and `appState.ts` `sourceMayBeUndefined` + `liveSources` (the type). The rows below hold both.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Catalog, CatalogIndex, loadCatalog } from '../src/catalog';
import { planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ComponentIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

const catalog: Catalog = loadCatalog();
const PROFILE = parseProject(path.join(__dirname, 'fixtures', 'profile-desk'), catalog);
const CHEER = parseProject(path.join(__dirname, 'fixtures', 'cheer'), catalog);

const HOME = 'Pages/Home';
const MOOD = 'Pages/Mood';
type Built = ReturnType<typeof emitApp>;

const componentOf = (source: ExportIR, componentPath: string): ComponentIR => source.components.find((c) => c.path === componentPath)!;
const nodeOf = (source: ExportIR, componentPath: string, id: string): NodeIR => componentOf(source, componentPath).nodes.find((n) => n.id === id)!;
const lit = (value: string | number | boolean): ParamValue => ({ kind: 'literal', value });
const setParam = (node: NodeIR, name: string, value: ParamValue) => {
  const existing = node.parameters.find((p) => p.name === name);
  if (existing) existing.value = value;
  else node.parameters.push({ name, value });
};
const dropParam = (node: NodeIR, name: string) => {
  node.parameters = node.parameters.filter((p) => p.name !== name);
};
const wire = (source: ExportIR, componentPath: string, fromId: string, fromProperty: string, toId: string, toProperty: string, kind: 'value' | 'signal' = 'value') => {
  componentOf(source, componentPath).connections.push({ key: `${fromId}:${fromProperty}->${toId}:${toProperty}`, fromId, fromProperty, toId, toProperty, kind });
};
const addNode = (component: ComponentIR, node: Partial<NodeIR> & { id: string; type: string }): NodeIR => {
  const full = { catalogRef: node.type, parameters: [], declaredPorts: [], portKnowledge: 'complete', ...node } as NodeIR;
  component.nodes.push(full);
  return full;
};
/** A `Variable` node reading `name` — nothing writes it unless a row wires something in. */
const addVariable = (source: ExportIR, componentPath: string, id: string, name: string) =>
  addNode(componentOf(source, componentPath), { id, type: 'Variable2', parameters: [{ name: 'name', value: lit(name) }] });
const onClickOf = (source: string, label: string): string => {
  const end = source.indexOf(`>${label}</button>`) >= 0 ? source.indexOf(`>${label}</button>`) : source.indexOf(`\n        ${label}\n      </button>`);
  expect(end).toBeGreaterThan(0);
  const start = source.lastIndexOf('onClick={', end);
  expect(start).toBeGreaterThan(0);
  let depth = 0;
  for (let i = start + 'onClick='.length; i < source.length; i++) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced onClick attribute');
};
const reasonFor = (source: ExportIR, componentPath: string, nodeId: string): string | undefined => {
  const plan = planProject(source, new CatalogIndex(catalog)).plans.find((p) => p.path === componentPath)!;
  const disposition = plan.dispositions[nodeId] as { kind: string; reason?: string };
  return disposition?.kind === 'deferred' ? disposition.reason : undefined;
};
const notesOf = (built: Built): string[] => built.notes.filter((n) => !n.startsWith('App:'));
const NEVER = ' is never written — the wire from ';

// profile-desk: `setStatus` writes `status` with 'Saved.' typed in (§69), `saveProfile` writes `since: '2026'` (§68).
const profile = (): ExportIR => structuredClone(PROFILE);
const homeFile = (built: Built): string => built.files['src/pages/Home.tsx'];
const variablesFile = (built: Built): string => built.files['src/stores/variables.ts'];
const profileModule = (built: Built): string => built.files['src/stores/profile.ts'];
/** profile-desk with a Variable `draft` (nothing writes it) wired into `setStatus`'s Value under the typed-in 'Saved.'. */
const profileWithDraftIntoStatus = (): ExportIR => {
  const ir = profile();
  addVariable(ir, HOME, 'draftVar', 'draft');
  wire(ir, HOME, 'draftVar', 'value', 'setStatus', 'value');
  return ir;
};

// ---------------------------------------------------------------------------------------------------
describe('§A Set Variable — the typed-in Value under a wire', () => {
  test('A1 under a wire from a Variable nothing wrote: Do writes the wire’s value, else the typed-in one — `status.set(draft.get() ?? \'Saved.\')`; the typed-in value types the variable beside the wire (both `unknown` here); the app typechecks', () => {
    const built = emitApp(profileWithDraftIntoStatus(), catalog);
    expect(onClickOf(homeFile(built), 'Save profile')).toBe("onClick={() => { profile.set({ name: name, city: city, since: '2026' }); status.set(draft.get() ?? 'Saved.'); }}");
    expect(variablesFile(built)).toContain('export const status = value<unknown>(undefined);');
    expect(notesOf(built)).toEqual([]);
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('A2 a number typed in under the same wire prints as a number: `?? 7`', () => {
    const ir = profileWithDraftIntoStatus();
    setParam(nodeOf(ir, HOME, 'setStatus'), 'value', lit(7));
    const built = emitApp(ir, catalog);
    expect(onClickOf(homeFile(built), 'Save profile')).toContain("status.set(draft.get() ?? 7); }}");
    expect(variablesFile(built)).toContain('export const status = value<unknown>(undefined);');
  });

  test('A3 the wire’s source is a string-typed Variable (written by a text input): a string typed in keeps `status` a string; a NUMBER typed in makes it `unknown` — the literal is a source — and the app typechecks (without the registration `status.set(draft.get() ?? 7)` into `value<string | undefined>` is TS2345)', () => {
    const ir = profileWithDraftIntoStatus();
    wire(ir, HOME, 'nameInput', 'onTextChanged', 'draftVar', 'value');
    const asString = emitApp(ir, catalog);
    expect(variablesFile(asString)).toContain('export const draft = value<string | undefined>(undefined);');
    expect(variablesFile(asString)).toContain('export const status = value<string | undefined>(undefined);');
    expect(onClickOf(homeFile(asString), 'Save profile')).toContain("status.set(draft.get() ?? 'Saved.'); }}");

    setParam(nodeOf(ir, HOME, 'setStatus'), 'value', lit(7));
    const asNumber = emitApp(ir, catalog);
    expect(onClickOf(homeFile(asNumber), 'Save profile')).toContain('status.set(draft.get() ?? 7); }}');
    expect(variablesFile(asNumber)).toContain('export const status = value<unknown>(undefined);');
    expect(typecheckEmittedApp(asNumber)).toEqual([]);
  });

  test('A4 under a wire from a text input — a source that emits at mount — there is no fallback and a note says the typed-in value is never written; the type is the wire’s (7 under a string wire does not demote)', () => {
    const ir = profile();
    wire(ir, HOME, 'nameInput', 'onTextChanged', 'setStatus', 'value');
    setParam(nodeOf(ir, HOME, 'setStatus'), 'value', lit(7));
    const built = emitApp(ir, catalog);
    expect(onClickOf(homeFile(built), 'Save profile')).toContain('status.set(name); }}');
    expect(onClickOf(homeFile(built), 'Save profile')).not.toContain('??');
    expect(notesOf(built)).toEqual([
      "Pages/Home: node setStatus (Set Variable): its typed-in Value 7 is never written — the wire from nameInput:onTextChanged always carries a value, so every Do writes the wire's value, in the runtime and here"
    ]);
    expect(variablesFile(built)).toContain('export const status = value<string | undefined>(undefined);');
  });

  test('A5 absence control — the same wire from a Variable nothing wrote with NOTHING typed in: no `??`, no note (the wire alone, §47’s shape)', () => {
    const ir = profileWithDraftIntoStatus();
    dropParam(nodeOf(ir, HOME, 'setStatus'), 'value');
    const built = emitApp(ir, catalog);
    expect(onClickOf(homeFile(built), 'Save profile')).toContain('status.set(draft.get()); }}');
    expect(onClickOf(homeFile(built), 'Save profile')).not.toContain('??');
    expect(notesOf(built)).toEqual([]);
  });

  test('A6 the gates in front stand: Set as Boolean under a wire is still refused by name, and no §74 note is written for it', () => {
    const ir = profileWithDraftIntoStatus();
    setParam(nodeOf(ir, HOME, 'setStatus'), 'setWith', lit('boolean'));
    expect(reasonFor(ir, HOME, 'setStatus')).toBe('setWith "boolean" conversion is not translated in step 5');
    const built = emitApp(ir, catalog);
    expect(built.notes.join('\n')).not.toContain(NEVER);
    expect(homeFile(built)).not.toContain('status.set(');
  });

  test('A7 Set as Empty string under the wire: `\'\'` is written, the wire is not read (§73) — no fallback, no §74 note', () => {
    const ir = profileWithDraftIntoStatus();
    setParam(nodeOf(ir, HOME, 'setStatus'), 'setWith', lit('emptyString'));
    const built = emitApp(ir, catalog);
    expect(onClickOf(homeFile(built), 'Save profile')).toContain("status.set(''); }}");
    expect(built.notes.join('\n')).not.toContain(NEVER);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§B Global Store Set — the typed-in Value under a wire (cheer, Pages/Mood: `setStormy` writes `theme: \'stormy\'`)', () => {
  const cheer = (): ExportIR => structuredClone(CHEER);
  const moodFile = (built: Built): string => built.files['src/pages/Mood.tsx'];

  test('B1 under a wire from a string Variable that may be unwritten (`visitorName`, written on another page): `mood.set({ theme: visitorName.get() ?? \'stormy\' })` — and the app typechecks (the key is `string` by the initial state)', () => {
    const ir = cheer();
    wire(ir, MOOD, 'readVisitor-2', 'value', 'setStormy', 'value');
    const built = emitApp(ir, catalog);
    expect(onClickOf(moodFile(built), 'Make it stormy')).toBe("onClick={() => mood.set({ theme: visitorName.get() ?? 'stormy' })}");
    expect(notesOf(built).join('\n')).not.toContain(NEVER);
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('B2 under a wire from a Subscribe of a key the initial state carries — always a value — no fallback, the note names the Set’s trigger ("every Set")', () => {
    const ir = cheer();
    wire(ir, MOOD, 'subNote', 'value', 'setStormy', 'value');
    const built = emitApp(ir, catalog);
    expect(onClickOf(moodFile(built), 'Make it stormy')).toBe('onClick={() => mood.set({ theme: mood.get().note })}');
    expect(notesOf(built)).toContain(
      "Pages/Mood: node setStormy (net.noodl.GlobalStore.Set): its typed-in Value \"stormy\" is never written — the wire from subNote:value always carries a value, so every Set writes the wire's value, in the runtime and here"
    );
  });

  test('B3 the parenthesised form — a Subscribe of a key WITHOUT an initial state into a Set Variable: `echo.set((mood.get().theme) ?? \'fallback\')`, `theme?: string` in the store, and the app typechecks', () => {
    const ir = cheer();
    setParam(nodeOf(ir, MOOD, 'moodStore'), 'initialState', { kind: 'json', value: { note: '' } });
    const mood = componentOf(ir, MOOD);
    addNode(mood, { id: 'setEcho', type: 'Set Variable', parameters: [{ name: 'name', value: lit('echo') }, { name: 'value', value: lit('fallback') }] });
    addNode(mood, { id: 'echoButton', type: 'net.noodl.controls.button', parameters: [{ name: 'label', value: lit('Echo') }], parent: 'moodShell' } as never);
    nodeOf(ir, MOOD, 'moodShell').children!.push('echoButton');
    wire(ir, MOOD, 'echoButton', 'onClick', 'setEcho', 'do', 'signal');
    wire(ir, MOOD, 'subTheme', 'value', 'setEcho', 'value');
    const built = emitApp(ir, catalog);
    expect(onClickOf(moodFile(built), 'Echo')).toBe("onClick={() => echo.set((mood.get().theme) ?? 'fallback')}");
    expect(built.files['src/stores/mood.ts']).toContain('  theme?: string;');
    expect(variablesFile(built)).toContain('export const echo = value<string | undefined>(undefined);');
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('B4 a key WITHOUT an initial state, the wire from the string Variable, a NUMBER typed in under it: the literal is a source — `quote?: unknown`; a string typed in keeps `quote?: string`', () => {
    const ir = cheer();
    setParam(nodeOf(ir, MOOD, 'setStormy'), 'key', lit('quote'));
    wire(ir, MOOD, 'readVisitor-2', 'value', 'setStormy', 'value');
    expect(emitApp(ir, catalog).files['src/stores/mood.ts']).toContain('  quote?: string;');
    setParam(nodeOf(ir, MOOD, 'setStormy'), 'value', lit(7));
    const built = emitApp(ir, catalog);
    expect(onClickOf(moodFile(built), 'Make it stormy')).toBe('onClick={() => mood.set({ quote: visitorName.get() ?? 7 })}');
    expect(built.files['src/stores/mood.ts']).toContain('  quote?: unknown;');
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§C Set Object Properties — a typed-in prop-<key> under a wire into the same prop (profile-desk: `since: \'2026\'`)', () => {
  test('C1 under a wire from a Variable nothing wrote: the patch reads `since: draft.get() ?? \'2026\'`; the key is typed by both (`unknown` here)', () => {
    const ir = profile();
    addVariable(ir, HOME, 'draftVar', 'draft');
    wire(ir, HOME, 'draftVar', 'value', 'saveProfile', 'prop-since');
    const built = emitApp(ir, catalog);
    expect(onClickOf(homeFile(built), 'Save profile')).toBe("onClick={() => { profile.set({ name: name, city: city, since: draft.get() ?? '2026' }); status.set('Saved.'); }}");
    expect(profileModule(built)).toContain('  since?: unknown;');
    expect(notesOf(built)).toEqual([]);
  });

  test('C2 the wire’s source string-typed: a string typed in keeps `since` a string; a number typed in makes it `unknown`', () => {
    const ir = profile();
    addVariable(ir, HOME, 'draftVar', 'draft');
    wire(ir, HOME, 'nameInput', 'onTextChanged', 'draftVar', 'value');
    wire(ir, HOME, 'draftVar', 'value', 'saveProfile', 'prop-since');
    expect(profileModule(emitApp(ir, catalog))).toContain('  since?: string;');
    setParam(nodeOf(ir, HOME, 'saveProfile'), 'prop-since', lit(2026));
    const built = emitApp(ir, catalog);
    expect(onClickOf(homeFile(built), 'Save profile')).toContain('since: draft.get() ?? 2026 }');
    expect(profileModule(built)).toContain('  since?: unknown;');
  });

  test('C3 under a wire from a text input: no fallback, the note names the property', () => {
    const ir = profile();
    wire(ir, HOME, 'nameInput', 'onTextChanged', 'saveProfile', 'prop-since');
    const built = emitApp(ir, catalog);
    expect(onClickOf(homeFile(built), 'Save profile')).toContain('since: name }');
    expect(notesOf(built)).toEqual([
      'Pages/Home: node saveProfile (SetModelProperties): its typed-in "since" value "2026" is never written — the wire from nameInput:onTextChanged always carries a value, so every Do writes the wire\'s value, in the runtime and here'
    ]);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§D the creation-time writers are NOT this row', () => {
  test('D1 a Variable’s authored Value under a wire keeps §67’s refusal — the runtime writes the seed and the wire over it, and the one wire the export translates (a text input) emits at mount, so the seed is dead there too', () => {
    const ir = profile();
    setParam(nodeOf(ir, HOME, 'statusVar'), 'value', lit('First'));
    wire(ir, HOME, 'nameInput', 'onTextChanged', 'statusVar', 'value');
    const built = emitApp(ir, catalog);
    expect(built.notes).toContain('Pages/Home: node statusVar (Variable2): its authored Value is not seeded — a wire into Value governs "status" (the runtime delivers the parameter first and every arrival on the wire over it)');
    expect(homeFile(built)).not.toContain("status.set('First')");
    expect(built.notes.join('\n')).not.toContain(NEVER);
  });
});
