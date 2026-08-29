import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ComponentIR, ConnectionIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §10.5 — a Global Store key with no statically-typed writer, read into a render sink.
 *
 * §10 closed this for Variables and named the store-key twin as the same defect one construct
 * over: `storeKeyReadOf` refused any key not typed `string`/`number`, so a key written from an
 * HTTP body **dropped its read** with the note *"has no statically-typed value"* — the same
 * blank element §10 was about, reached through a different node.
 *
 * 🔴 **The gate was not lifted wholesale, and one describe block below is entirely about that.**
 * `storeKeyReadOf` is shared with `resolveExpr`, and an expression position is arithmetic, a
 * date argument or a url segment — none of which has a sink that can state what it holds. So
 * the widening is per call site: the render binding takes `'binding'`, `resolveExpr` keeps
 * `'expr'`, and "the gate is still shut over there" is a row, not a comment.
 *
 * Every coercion is paired with a CONTROL asserting a *string*-typed key in the same sink reads
 * bare — a suite that only looked for `String(x ?? '')` would pass on an emitter that printed it
 * around everything.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const baseIr = parseProject(FIXTURE, catalog);

const literal = (value: string | number | boolean | Record<string, unknown>): ParamValue =>
  ({ kind: 'literal', value }) as ParamValue;

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
  const full = {
    catalogRef: node.type,
    parameters: [],
    declaredPorts: [],
    portKnowledge: 'complete',
    ...node
  } as NodeIR;
  component.nodes.push(full);
  return full;
};

const componentOf = (ir: ExportIR, componentPath: string): ComponentIR =>
  ir.components.find((c) => c.path === componentPath)!;

/** Every emitted file parses — the floor beneath every `toContain` in this file. */
const expectParses = (app: ReturnType<typeof emitApp>) => {
  for (const [file, source] of Object.entries(app.files)) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
    const sf = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.ESNext,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    const diagnostics = (sf as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics ?? [];
    expect(
      diagnostics.map((d) => `${file}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`).join('\n')
    ).toBe('');
  }
};

const moodFile = (app: ReturnType<typeof emitApp>) =>
  app.files[Object.keys(app.files).find((k) => k.endsWith('Mood.tsx'))!];

/**
 * The Mood page with an HTTP request whose body is written into the store key `quote`, plus a
 * Subscribe on that key for the wires each case adds.
 *
 * `response` is the honest untypable writer, for §10's reason: it is whatever the server sent,
 * and no table of node types can ever say otherwise. `quote` is deliberately **absent** from the
 * store's `initialState`, because a key with an initial value is typed by it.
 */
const withUntypedStoreKey = (
  configure: (ir: ExportIR, mood: ComponentIR, read: NodeIR) => void
): { ir: ExportIR; app: ReturnType<typeof emitApp> } => {
  const ir: ExportIR = JSON.parse(JSON.stringify(baseIr));
  const mood = componentOf(ir, 'Pages/Mood');
  const http = addNode(mood, {
    id: 'quoteRequest',
    type: 'net.noodl.HTTP',
    authoredLabel: 'Quote',
    parameters: [
      { name: 'url', value: literal('https://api.example.com/quotes') },
      { name: 'method', value: literal('GET') }
    ],
    portKnowledge: 'partial'
  });
  connect(mood, 'themeButton', 'onClick', http.id, 'fetch', 'signal');
  const set = addNode(mood, {
    id: 'saveQuote',
    type: 'net.noodl.GlobalStore.Set',
    authoredLabel: 'Save quote',
    parameters: [
      { name: 'storeName', value: literal('mood') },
      { name: 'key', value: literal('quote') }
    ]
  });
  connect(mood, http.id, 'done', set.id, 'do', 'signal');
  connect(mood, http.id, 'response', set.id, 'value');
  const read = addNode(mood, {
    id: 'subQuote',
    type: 'net.noodl.GlobalStore.Subscribe',
    authoredLabel: 'Quote',
    parameters: [
      { name: 'storeName', value: literal('mood') },
      { name: 'keys', value: literal('quote') }
    ]
  });
  configure(ir, mood, read);
  return { ir, app: emitApp(ir, catalog) };
};

/**
 * The same page reading `note` — a key the store's own `initialState` types as `string`, and
 * typed that way before this slice existed. The control arm for every coercion below.
 */
const withTypedStoreKey = (
  configure: (ir: ExportIR, mood: ComponentIR, read: NodeIR) => void
): ReturnType<typeof emitApp> => {
  const ir: ExportIR = JSON.parse(JSON.stringify(baseIr));
  const mood = componentOf(ir, 'Pages/Mood');
  const read = addNode(mood, {
    id: 'subNoteAgain',
    type: 'net.noodl.GlobalStore.Subscribe',
    authoredLabel: 'Note again',
    parameters: [
      { name: 'storeName', value: literal('mood') },
      { name: 'keys', value: literal('note') }
    ]
  });
  configure(ir, mood, read);
  return emitApp(ir, catalog);
};

describe('EXP-011 §10.5 — an untyped store key is coerced at its sink, not dropped', () => {
  describe('the store module is unchanged', () => {
    it('still declares the key unknown: the fix is at the read, not a claim about the writer', () => {
      const { app } = withUntypedStoreKey((ir, mood, read) => {
        connect(mood, read.id, 'value', 'noteEcho', 'text');
      });
      expect(app.files['src/stores/mood.ts']).toContain('quote?: unknown;');
    });
  });

  describe('the text sink', () => {
    it('coerces, as the runtime Text node coerces on its way to the DOM', () => {
      const { app } = withUntypedStoreKey((ir, mood, read) => {
        connect(mood, read.id, 'value', 'noteEcho', 'text');
      });
      expectParses(app);
      expect(moodFile(app)).toContain("{String(quote ?? '')}");
    });

    it('CONTROL — a string-typed key in the same sink reads bare', () => {
      const app = withTypedStoreKey((ir, mood, read) => {
        connect(mood, read.id, 'value', 'noteEcho', 'text');
      });
      expect(moodFile(app)).not.toContain('String(note');
    });

    it('the wire is no longer reported as dropped', () => {
      const { app } = withUntypedStoreKey((ir, mood, read) => {
        connect(mood, read.id, 'value', 'noteEcho', 'text');
      });
      expect(app.notes.join('\n')).not.toContain('has no statically-typed value');
    });
  });

  describe('the string-attribute sink', () => {
    it('coerces into placeholder', () => {
      const { app } = withUntypedStoreKey((ir, mood, read) => {
        connect(mood, read.id, 'value', 'noteInput', 'placeholder');
      });
      expectParses(app);
      expect(moodFile(app)).toContain("placeholder={String(quote ?? '')}");
    });

    it('CONTROL — a string-typed key lands in placeholder bare', () => {
      const app = withTypedStoreKey((ir, mood, read) => {
        connect(mood, read.id, 'value', 'noteInput', 'placeholder');
      });
      expect(moodFile(app)).toContain('placeholder={note}');
    });
  });

  describe('the truthiness sinks need no coercion and must not grow one', () => {
    it('mounted reads the value as it is', () => {
      const { app } = withUntypedStoreKey((ir, mood, read) => {
        connect(mood, read.id, 'value', 'themeText', 'mounted');
      });
      expectParses(app);
      expect(moodFile(app)).toContain('!!quote &&');
      expect(moodFile(app)).not.toContain('String(quote');
    });
  });

  describe('a number sink still refuses — and says which store key, not which variable', () => {
    it('refuses rather than inventing a cast', () => {
      const { app } = withUntypedStoreKey((ir, mood, read) => {
        connect(mood, read.id, 'value', 'noteInput', 'maxLength');
      });
      expect(moodFile(app)).not.toContain('maxLength=');
    });

    /**
     * 🔴 The refusal is graded on its *reason*. "no statically known source" and "cannot coerce
     * it to this sink" have opposite fixes — §10.4's rule — and a third fix again from the
     * variable-shaped line, which is why this names the store and key.
     */
    it('the reason names the store key, and is not the variable reason', () => {
      const { app } = withUntypedStoreKey((ir, mood, read) => {
        connect(mood, read.id, 'value', 'noteInput', 'maxLength');
      });
      expect(app.notes.join('\n')).toContain('reads store key "mood.quote"');
      expect(app.notes.join('\n')).not.toContain('has no statically known source');
    });
  });

  /**
   * A key whose initial value is a boolean was refused by the old gate too — it is neither
   * `string` nor `number` — and it is not an untypable value at all, only one the render table
   * had no row for. It binds and coerces on the same table.
   */
  describe('a boolean-typed key was refused for the same reason and is now bound', () => {
    const withBooleanKey = (
      configure: (mood: ComponentIR, read: NodeIR) => void
    ): ReturnType<typeof emitApp> => {
      const ir: ExportIR = JSON.parse(JSON.stringify(baseIr));
      const mood = componentOf(ir, 'Pages/Mood');
      const store = mood.nodes.find((n) => n.id === 'moodStore')!;
      store.parameters = store.parameters.filter((p) => p.name !== 'initialState');
      // ⚠️ `initialState` parses as a `json` ParamValue, not a `literal` one — a `literal`
      // here is silently ignored and the store emits `store<MoodState>('mood', {})` with every
      // key optional, which reads exactly like a passing boolean arm and is not one.
      store.parameters.push({
        name: 'initialState',
        value: { kind: 'json', value: { note: '', theme: 'sunny', loud: true } } as ParamValue
      });
      const read = addNode(mood, {
        id: 'subLoud',
        type: 'net.noodl.GlobalStore.Subscribe',
        authoredLabel: 'Loud',
        parameters: [
          { name: 'storeName', value: literal('mood') },
          { name: 'keys', value: literal('loud') }
        ]
      });
      configure(mood, read);
      return emitApp(ir, catalog);
    };

    it('binds into a text sink instead of dropping the wire', () => {
      const app = withBooleanKey((mood, read) => {
        connect(mood, read.id, 'value', 'noteEcho', 'text');
      });
      expectParses(app);
      expect(app.files['src/stores/mood.ts']).toContain('loud: boolean;');
      expect(app.notes.join('\n')).not.toContain('has no statically-typed value');
      expect(moodFile(app)).toContain("{String(loud ?? '')}");
    });
  });

  /**
   * 🔴 The point of the slice being per call site rather than a lifted gate (§10.5's named
   * reason). These are the rows that fail if someone later "simplifies" `storeKeyReadOf` by
   * deleting the mode parameter.
   */
  describe('the gate is still shut everywhere a sink cannot answer the type question', () => {
    /**
     * ⚠️ A **fresh** String Format, not the fixture's `themeFormat` — that one already carries a
     * wire into `theme`, so wiring a second source into the same port measures the duplicate,
     * not the gate. The first version of this row did exactly that and passed for the wrong
     * reason.
     */
    const intoFormat = (mood: ComponentIR, read: NodeIR) => {
      const fmt = addNode(mood, {
        id: 'fmtQuote',
        type: 'String Format',
        authoredLabel: 'Quote line',
        parameters: [{ name: 'format', value: literal('Quote of the day: {q}') }]
      });
      connect(mood, read.id, 'value', fmt.id, 'q');
      connect(mood, fmt.id, 'formatted', 'noteEcho', 'text');
    };

    it('an expression position still defers on the untyped key', () => {
      const { app } = withUntypedStoreKey((ir, mood, read) => intoFormat(mood, read));
      expect(app.notes.join('\n')).toContain('key "quote" of store "mood" has no statically-typed value');
      expect(moodFile(app)).not.toContain('Quote of the day');
    });

    it('CONTROL — the same wire from a string-typed key inlines into the template', () => {
      const app = withTypedStoreKey((ir, mood, read) => intoFormat(mood, read));
      expect(app.notes.join('\n')).not.toContain('has no statically-typed value');
      expect(moodFile(app)).toContain('`Quote of the day: ${note}`');
    });

    /**
     * A key the store plan does not carry is a *different* refusal from an untypeable one, in
     * both modes: the emitted selector reads `s.<key>` against the generated interface, so
     * binding it would be a TS2339 in the exported app rather than a value needing a coercion.
     */
    it('a key the store does not have defers even in the binding mode, and says so differently', () => {
      const ir: ExportIR = JSON.parse(JSON.stringify(baseIr));
      const mood = componentOf(ir, 'Pages/Mood');
      const read = addNode(mood, {
        id: 'subGhost',
        type: 'net.noodl.GlobalStore.Subscribe',
        authoredLabel: 'Ghost',
        parameters: [
          { name: 'storeName', value: literal('mood') },
          { name: 'keys', value: literal('nosuchkey') }
        ]
      });
      connect(mood, read.id, 'value', 'noteEcho', 'text');
      const app = emitApp(ir, catalog);
      expect(app.notes.join('\n')).toContain('is not a key of store "mood"');
      /*
       * 🔴 **The generated *code* must not read the key — the marker naming it is not a breach.**
       * This asserted the raw file, and EXP-004's in-code markers now print the refused port by
       * name in a comment beside the element, which is what they are for. Narrowed rather than
       * deleted: comments are stripped and the claim is made against the code, so the thing it
       * always meant — no invented `s.nosuchkey` read reaches the emitted app — is still checked
       * exactly as hard. Asserting the raw file would now fail on the marker doing its job.
       */
      const code = moodFile(app)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
      expect(code).not.toContain('nosuchkey');
      // ...and the marker is the reason the raw file may mention it at all.
      expect(moodFile(app)).toContain('TODO(export)');
    });
  });

  /**
   * 🔴 **§25 — the same emission put through a compiler rather than a parser.**
   *
   * `withUntypedStoreKey` is the widest graph in this file: an HTTP request, a
   * `GlobalStore.Set` writing an `unknown` into a key the store's `initialState` does not carry,
   * and a `Subscribe` reading it back into a render sink. `expectParses` grades every row above
   * as syntax only.
   *
   * 🔴 **This file has a named reason to be compiled rather than parsed, and it is three rows
   * up.** The refusal for a key the store does not have exists because the emitted selector reads
   * `s.<key>` against the generated interface — so lifting that gate would emit a **TS2339** in
   * the exported app, which is valid syntax and invisible to every `expectParses` here. The row
   * above proves the gate is shut by reading notes and grepping for the key name; this proves the
   * complementary thing, that what the gate *does* let through compiles against the interface the
   * store module generates.
   *
   * It is this hand-built graph rather than a fixture because **no fixture writes a store key
   * from an untypable source** — `initialState` types every key the seven fixture projects use,
   * so `tests/typecheck-emitted.test.ts` never emits an `unknown`-valued key at all.
   */
  it('the emitted app typechecks, and not merely parses', () => {
    const { app } = withUntypedStoreKey((ir, mood, read) => {
      connect(mood, read.id, 'value', 'noteEcho', 'text');
    });
    expect(typecheckEmittedApp(app)).toEqual([]);
  });
});
