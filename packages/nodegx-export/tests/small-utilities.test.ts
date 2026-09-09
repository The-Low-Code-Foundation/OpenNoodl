/**
 * EXP-011 §38 — `Boolean To String` and `Color Blend`, the two "small ordinary nodes with no
 * design question" the ledger had scheduled since session 35. Each is one pure call into
 * `src/lib/util.ts`, the shape Tier 2.7 established (`string-math-utilities.test.ts`).
 *
 * §A grades the emitted helpers against the interpreter's own node code, loaded from source —
 * `booleantostring.ts` from noodl-runtime and `colorblend.ts` from noodl-viewer-react, with the
 * one module it imports (`easecurves`) stubbed to the same two-line `linear` it exports.
 *
 * §B grades the translation: what the planner prints, including the sparse numbered family, and
 * what it refuses.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { Catalog, loadCatalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { utilLibSource } from '../src/emit/utilLib';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ExportIR, ComponentIR, ConnectionIR, NodeIR, ParamValue } from '../src/ir/types';

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
const MOOD_DESK = path.join(__dirname, 'fixtures', 'mood-desk');
const RUNTIME_NODES = path.join(__dirname, '..', '..', 'noodl-runtime', 'src', 'nodes', 'std-library');
const VIEWER_NODES = path.join(__dirname, '..', '..', 'noodl-viewer-react', 'src', 'nodes', 'std-library');

const catalog: Catalog = loadCatalog();
const baseIr = parseProject(FIXTURE, catalog);

// ---- §A the emitted module, against the interpreter it has to agree with --------------------

interface UtilLib {
  booleanToString(selector: unknown, whenTrue: unknown, whenFalse: unknown): string;
  blendColor(blend: unknown, ...colors: unknown[]): string;
}

const loadUtilLib = (source = utilLibSource()): UtilLib => {
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const exported: Record<string, unknown> = {};
  const module = { exports: exported };
  // eslint-disable-next-line no-new-func
  new Function('exports', 'module', js)(exported, module);
  return module.exports as unknown as UtilLib;
};

const lib = loadUtilLib();

interface RuntimeNodeDefinition {
  initialize?: (this: unknown) => void;
  inputs: Record<string, { set?: (this: unknown, value: unknown) => void }>;
  numberedInputs?: Record<string, { createSetter: (this: unknown, index: number) => (this: unknown, value: unknown) => void }>;
  outputs: Record<string, { getter?: (this: unknown) => unknown }>;
  methods?: Record<string, unknown>;
}

/** `EaseCurves.linear`, the one thing colorblend.ts imports — two lines in easecurves.ts. */
const easeCurvesStub = { linear: (start: number, end: number, t: number) => start + (end - start) * t };

const loadNode = (dir: string, file: string): RuntimeNodeDefinition => {
  const source = fs.readFileSync(path.join(dir, file), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const exported: Record<string, unknown> = {};
  const module = { exports: exported };
  const require = (specifier: string) =>
    specifier.endsWith('easecurves') ? { default: easeCurvesStub, ...easeCurvesStub } : {};
  // eslint-disable-next-line no-new-func
  new Function('exports', 'module', 'require', js)(exported, module, require);
  const out = module.exports as { node?: RuntimeNodeDefinition; default?: { node: RuntimeNodeDefinition } };
  return (out.node ?? out.default!.node) as RuntimeNodeDefinition;
};

const booleanNode = loadNode(RUNTIME_NODES, 'booleantostring.ts');
const blendNode = loadNode(VIEWER_NODES, 'colorblend.ts');

const instanceFor = (definition: RuntimeNodeDefinition) => {
  const instance: Record<string, unknown> = {
    _internal: {} as Record<string, unknown>,
    flagOutputDirty: () => undefined,
    sendSignalOnOutput: () => undefined
  };
  for (const [name, member] of Object.entries(definition.methods ?? {})) {
    instance[name] = (member as (this: unknown) => unknown).bind(instance);
  }
  definition.initialize?.call(instance);
  return instance;
};

const runtimeBooleanToString = (selector: unknown, whenTrue?: unknown, whenFalse?: unknown): string => {
  const instance = instanceFor(booleanNode);
  if (whenTrue !== undefined) booleanNode.inputs.trueString.set!.call(instance, whenTrue);
  if (whenFalse !== undefined) booleanNode.inputs.falseString.set!.call(instance, whenFalse);
  if (selector !== undefined) booleanNode.inputs.input.set!.call(instance, selector);
  return booleanNode.outputs.currentValue.getter!.call(instance) as string;
};

/** Colours by index, sparse — `[, '#ff0000']` leaves index 0 unset, as an author can. */
const runtimeBlend = (blend: unknown, colors: Array<string | undefined>): string => {
  const instance = instanceFor(blendNode);
  colors.forEach((color, index) => {
    if (color !== undefined) blendNode.numberedInputs!.color.createSetter.call(instance, index).call(instance, color);
  });
  if (blend !== undefined) blendNode.inputs.blendValue.set!.call(instance, blend);
  return blendNode.outputs.result.getter!.call(instance) as string;
};

describe('EXP-011 §38 §A — the emitted helpers against the interpreter', () => {
  it('the module the export ships parses, loads, and exports both helpers', () => {
    const sf = ts.createSourceFile('util.ts', utilLibSource(), ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
    const diagnostics = (sf as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics ?? [];
    expect(diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('\n')).toBe('');
    expect(typeof lib.booleanToString).toBe('function');
    expect(typeof lib.blendColor).toBe('function');
  });

  it('booleanToString agrees with the interpreter over truthy, falsy and unset selectors', () => {
    const disagreements: string[] = [];
    let compared = 0;
    const selectors: unknown[] = [true, false, 1, 0, 'yes', '', null, undefined, {}, NaN];
    for (const selector of selectors) {
      for (const [whenTrue, whenFalse] of [
        ['Open', 'Closed'],
        ['', 'Closed'],
        ['Open', ''],
        ['yes', 'yes']
      ]) {
        compared += 1;
        const mine = lib.booleanToString(selector, whenTrue, whenFalse);
        const theirs = runtimeBooleanToString(selector, whenTrue, whenFalse);
        if (mine !== theirs) disagreements.push(`${String(selector)} → "${mine}" vs "${theirs}"`);
      }
    }
    expect(disagreements).toEqual([]);
    expect(compared).toBe(40);
  });

  it('an untouched panel is two empty strings in both', () => {
    expect(runtimeBooleanToString(true)).toBe('');
    expect(runtimeBooleanToString(false)).toBe('');
    expect(lib.booleanToString(true, '', '')).toBe('');
    // What the emitted call prints for an unopened panel — initialize's fallbacks, not undefined.
    expect(lib.booleanToString(false, '', '')).toBe(runtimeBooleanToString(false));
  });

  it('blendColor agrees with the interpreter over a grid of lists and blend values', () => {
    const disagreements: string[] = [];
    let compared = 0;
    const lists: Array<Array<string | undefined>> = [
      ['#ff0000', '#00ff00', '#0000ff'],
      ['#000000', '#ffffff'],
      ['#123456'],
      ['#ff0000', undefined, '#0000ff'], // a hole — the sparse array
      [undefined, '#0000ff'],
      ['#ff8800', '#0088ff', '#88ff00', '#ffffff']
    ];
    const blends = [-1, 0, 0.25, 0.5, 0.999, 1, 1.5, 2, 2.75, 3, 10, NaN];
    for (const list of lists) {
      for (const blend of blends) {
        compared += 1;
        const mine = lib.blendColor(blend, ...list);
        const theirs = runtimeBlend(blend, list);
        if (mine !== theirs) disagreements.push(`${JSON.stringify(list)} @ ${blend}: "${mine}" vs "${theirs}"`);
      }
    }
    expect(disagreements).toEqual([]);
    expect(compared).toBe(72);
  });

  it('no colours at all is the #000000 initialize wrote, in both', () => {
    expect(runtimeBlend(0.5, [])).toBe('#000000');
    expect(lib.blendColor(0.5)).toBe('#000000');
  });

  /*
   * P79 E2/E5 — this pair used to read:
   *
   *   expect(lib.blendColor(0.5, 'red', 'blue')).toBe('#NaNNaNNaN');
   *
   * and it was right at the time: both copies parsed six hex digits blindly, so a token colour
   * painted the literal string `#NaNNaNNaN` and the transcription faithfully reproduced it. The
   * runtime was fixed first, and THIS SUITE IS WHAT CAUGHT the day the two disagreed — which is
   * the argument for grading the emitted helper against the interpreter's own source rather than
   * against a second description of it.
   */
  it('a colour neither copy can read falls back to the nearest authored one, in both', () => {
    expect(lib.blendColor(0.5, 'red', 'blue')).toBe(runtimeBlend(0.5, ['red', 'blue']));
    // t = 0.5 rounds to the upper endpoint, verbatim — a colour the author chose, which the DOM
    // may itself resolve, rather than a string that can only ever be wrong.
    expect(lib.blendColor(0.5, 'red', 'blue')).toBe('blue');
    expect(lib.blendColor(0.25, 'red', 'blue')).toBe(runtimeBlend(0.25, ['red', 'blue']));
    expect(lib.blendColor(0.25, 'red', 'blue')).toBe('red');
  });

  it('a token colour blends in both, and neither invents one it cannot resolve', () => {
    // Both copies read `var()` off the document; there is none in this runner, so both take the
    // author's own var() fallback where there is one and refuse where there is not.
    expect(lib.blendColor(0.5, '#000000', 'var(--accent, #ffffff)')).toBe(
      runtimeBlend(0.5, ['#000000', 'var(--accent, #ffffff)'])
    );
    expect(lib.blendColor(0.5, '#000000', 'var(--accent, #ffffff)')).toBe('#7f7f7f');

    expect(lib.blendColor(0.5, '#000000', 'var(--nope)')).toBe(runtimeBlend(0.5, ['#000000', 'var(--nope)']));
    expect(lib.blendColor(0.5, '#000000', 'var(--nope)')).toBe('var(--nope)');
  });

  it('three-digit hex blends on all three channels, in both', () => {
    expect(lib.blendColor(0.5, '#000', '#fff')).toBe(runtimeBlend(0.5, ['#000', '#fff']));
    expect(lib.blendColor(0.5, '#000', '#fff')).toBe('#7f7f7f');
  });

  it('the control: a helper that rounds instead of flooring disagrees with the interpreter', () => {
    const sabotaged = loadUtilLib(utilLibSource().replace('part(Math.floor(from[i]', 'part(Math.round(from[i]'));
    expect(sabotaged.blendColor(0.5, '#000000', '#ffffff')).not.toBe(runtimeBlend(0.5, ['#000000', '#ffffff']));
  });
});

// ---- §B the translation ---------------------------------------------------------------------

const literal = (value: string | number | boolean): ParamValue => ({ kind: 'literal', value });

const connect = (
  component: ComponentIR,
  from: string,
  fromProperty: string,
  to: string,
  toProperty: string,
  kind: ConnectionIR['kind'] = 'value'
) => {
  component.connections.push({
    key: `${from}:${fromProperty}->${to}:${toProperty}`,
    fromId: from,
    fromProperty,
    toId: to,
    toProperty,
    kind
  });
};

const addNode = (component: ComponentIR, node: Partial<NodeIR> & { id: string; type: string }): NodeIR => {
  const full: NodeIR = {
    catalogRef: node.type,
    parameters: [],
    declaredPorts: [],
    portKnowledge: 'complete',
    ...node
  } as NodeIR;
  component.nodes.push(full);
  return full;
};

const notesOf = (ir: ExportIR) => ir.components.find((c) => c.path === 'Pages/Notes')!;
const notesFile = (app: ReturnType<typeof emitApp>) =>
  app.files[Object.keys(app.files).find((k) => k.endsWith('Notes.tsx'))!];

const withNotes = (build: (notes: ComponentIR) => void): ReturnType<typeof emitApp> => {
  const ir: ExportIR = JSON.parse(JSON.stringify(baseIr));
  build(notesOf(ir));
  return emitApp(ir, catalog);
};

describe('EXP-011 §38 §B — the translation', () => {
  it('Boolean To String renders through the emitted helper, with the panel’s two strings', () => {
    const app = withNotes((notes) => {
      addNode(notes, {
        id: 'openLabel',
        type: 'Boolean To String',
        parameters: [
          { name: 'falseString', value: literal('Closed') },
          { name: 'input', value: literal(true) },
          { name: 'trueString', value: literal('Open') }
        ]
      });
      connect(notes, 'openLabel', 'currentValue', 'notesHeading', 'text');
    });
    const page = notesFile(app);
    expect(page).toContain("import { booleanToString } from '../lib/util';");
    expect(page).toContain("booleanToString(true, 'Open', 'Closed')");
    expect(app.files['src/lib/util.ts']).toContain('export function booleanToString');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('an unopened panel exports initialize’s empty strings, and an unset Selector prints undefined', () => {
    const app = withNotes((notes) => {
      addNode(notes, { id: 'openLabel', type: 'Boolean To String' });
      connect(notes, 'openLabel', 'currentValue', 'notesHeading', 'text');
    });
    expect(notesFile(app)).toContain("booleanToString(undefined, '', '')");
  });

  it('the Selector Changed signal is not read by this slice, and the note says so', () => {
    const app = withNotes((notes) => {
      addNode(notes, { id: 'openLabel', type: 'Boolean To String' });
      connect(notes, 'openLabel', 'inputChanged', 'notesHeading', 'text');
    });
    expect(app.notes.join('\n')).toContain('its inputChanged output is not a port this slice reads');
  });

  it('Color Blend prints its colours as arguments in index order', () => {
    const app = withNotes((notes) => {
      addNode(notes, {
        id: 'moodBlend',
        type: 'Color Blend',
        parameters: [
          { name: 'blendValue', value: literal(1.5) },
          { name: 'color 0', value: literal('#ff0000') },
          { name: 'color 1', value: literal('#00ff00') },
          { name: 'color 2', value: literal('#0000ff') }
        ]
      });
      connect(notes, 'moodBlend', 'result', 'notesHeading', 'text');
    });
    const page = notesFile(app);
    expect(page).toContain("import { blendColor } from '../lib/util';");
    expect(page).toContain("blendColor(1.5, '#ff0000', '#00ff00', '#0000ff')");
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('a hole in the numbered family prints as undefined, so the list keeps its length', () => {
    const app = withNotes((notes) => {
      addNode(notes, {
        id: 'moodBlend',
        type: 'Color Blend',
        parameters: [
          { name: 'color 0', value: literal('#ff0000') },
          { name: 'color 2', value: literal('#0000ff') }
        ]
      });
      connect(notes, 'moodBlend', 'result', 'notesHeading', 'text');
    });
    // `blendValue` unset prints initialize's 0, which is also what the port declares.
    expect(notesFile(app)).toContain("blendColor(0, '#ff0000', undefined, '#0000ff')");
  });

  it('no colours at all is a call with only the blend value', () => {
    const app = withNotes((notes) => {
      addNode(notes, { id: 'moodBlend', type: 'Color Blend' });
      connect(notes, 'moodBlend', 'result', 'notesHeading', 'text');
    });
    expect(notesFile(app)).toContain('blendColor(0)');
  });

  it('a wired colour is an argument, not a deferral — unlike String Mapper’s table', () => {
    const app = withNotes((notes) => {
      addNode(notes, { id: 'tint', type: 'String', parameters: [{ name: 'value', value: literal('#00ff00') }] });
      addNode(notes, {
        id: 'moodBlend',
        type: 'Color Blend',
        parameters: [
          { name: 'blendValue', value: literal(0.5) },
          { name: 'color 0', value: literal('#ff0000') }
        ]
      });
      connect(notes, 'tint', 'savedValue', 'moodBlend', 'color 1');
      connect(notes, 'moodBlend', 'result', 'notesHeading', 'text');
    });
    const page = notesFile(app);
    expect(page).toMatch(/blendColor\(0\.5, '#ff0000', [^)]+\)/);
    expect(page).not.toContain("blendColor(0.5, '#ff0000')");
    expect(app.notes.join('\n')).not.toContain('moodBlend');
  });

  it('two wires into one colour port defer the read, with the reason the family shares', () => {
    const app = withNotes((notes) => {
      addNode(notes, { id: 'tintA', type: 'String', parameters: [{ name: 'value', value: literal('#00ff00') }] });
      addNode(notes, { id: 'tintB', type: 'String', parameters: [{ name: 'value', value: literal('#0000ff') }] });
      addNode(notes, { id: 'moodBlend', type: 'Color Blend' });
      connect(notes, 'tintA', 'savedValue', 'moodBlend', 'color 0');
      connect(notes, 'tintB', 'savedValue', 'moodBlend', 'color 0');
      connect(notes, 'moodBlend', 'result', 'notesHeading', 'text');
    });
    expect(app.notes.join('\n')).toContain('two wires feed its color 0 input');
  });
});

// ---- §C the picker-exercising project (EXP-011 AC3) ------------------------------------------

describe('EXP-011 §38 §C — tests/fixtures/mood-desk', () => {
  const ir = parseProject(MOOD_DESK, catalog);
  const app = emitApp(ir, catalog);
  const page = app.files['src/pages/Mood.tsx'];

  it('exports whole — beyond the scaffold’s own note, the only notes are §74’s four "typed-in Value … is never written" sentences (pinned by name in object-store.test.ts F8)', () => {
    const rest = app.notes.filter((n) => !n.startsWith('App:'));
    expect(rest).toHaveLength(4);
    expect(rest.every((n) => n.includes(' is never written — the wire from '))).toBe(true);
  });

  it('renders both calls', () => {
    expect(page).toContain("booleanToString(");
    expect(page).toContain("blendColor(");
    expect(page).toContain("'#ff0000', '#00ff00', '#0000ff'");
  });

  it('typechecks', () => {
    expect(typecheckEmittedApp(app)).toEqual([]);
  });
});
