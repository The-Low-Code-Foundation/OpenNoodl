import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ComponentIR, ConnectionIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §10 — a Variable with no statically-typed writer, read into a render sink.
 *
 * The defect this closes: `typeOfSource` types a variable written from an HTTP body, a Function
 * output or an event payload as `unknown`, and Pass 4 dropped *every read* of such a variable —
 * so "fetch something, save it, show it" exported a blank element with a note. Four sessions in
 * a row each answered it by adding one more node type to `typeOfSource`, and each was found the
 * same way: by building an app and seeing a placeholder where a value should be.
 *
 * 🔴 **The subject here is the sink, not the writer.** Every case therefore names the sink it
 * lands in and what that position can hold, and every case that asserts a coercion is paired
 * with a control asserting the *typed* variable does not get one — a suite that only checked
 * `String(x ?? '')` would pass just as happily on an emitter that printed it around everything.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const baseIr = parseProject(FIXTURE, catalog);

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

/**
 * The Notes page with an HTTP request whose body is saved into `lastQuote`, plus a read node
 * for the wires each case adds. `response` is the honest untypable writer: it is whatever the
 * server sent, and no table of node types can ever say otherwise.
 */
const withUntypedVariable = (
  configure: (ir: ExportIR, notes: ComponentIR, read: NodeIR) => void
): { ir: ExportIR; app: ReturnType<typeof emitApp> } => {
  const ir: ExportIR = JSON.parse(JSON.stringify(baseIr));
  const notes = componentOf(ir, 'Pages/Notes');
  const http = addNode(notes, {
    id: 'quoteRequest',
    type: 'net.noodl.HTTP',
    authoredLabel: 'Quote',
    parameters: [
      { name: 'url', value: literal('https://api.example.com/quotes') },
      { name: 'method', value: literal('GET') }
    ],
    portKnowledge: 'partial'
  });
  connect(notes, 'addButton', 'onClick', http.id, 'fetch', 'signal');
  const set = addNode(notes, {
    id: 'saveQuote',
    type: 'Set Variable',
    authoredLabel: 'Save quote',
    parameters: [{ name: 'name', value: literal('lastQuote') }]
  });
  connect(notes, http.id, 'done', set.id, 'do', 'signal');
  connect(notes, http.id, 'response', set.id, 'value');
  const read = addNode(notes, {
    id: 'quoteRead',
    type: 'Variable2',
    authoredLabel: 'Last quote',
    parameters: [{ name: 'name', value: literal('lastQuote') }]
  });
  configure(ir, notes, read);
  return { ir, app: emitApp(ir, catalog) };
};

/** The same page, wired from a variable the analysis *can* type — the control arm. */
const withTypedVariable = (
  configure: (ir: ExportIR, notes: ComponentIR, read: NodeIR) => void
): ReturnType<typeof emitApp> => {
  const ir: ExportIR = JSON.parse(JSON.stringify(baseIr));
  const notes = componentOf(ir, 'Pages/Notes');
  // `noteDraft` is written by the page's own text input — string-typed, and typed that way
  // before this slice existed.
  const read = addNode(notes, {
    id: 'draftRead',
    type: 'Variable2',
    authoredLabel: 'Draft',
    parameters: [{ name: 'name', value: literal('noteDraft') }]
  });
  configure(ir, notes, read);
  return emitApp(ir, catalog);
};

const notesFile = (app: ReturnType<typeof emitApp>) =>
  app.files[Object.keys(app.files).find((k) => k.endsWith('Notes.tsx'))!];
const homeFile = (app: ReturnType<typeof emitApp>) =>
  app.files[Object.keys(app.files).find((k) => k.endsWith('Home.tsx'))!];

describe('EXP-011 §10 — an untyped Variable is coerced at its sink, not dropped', () => {
  describe('the variable itself is unchanged', () => {
    it('still declares value<unknown>: the fix is at the read, not a claim about the writer', () => {
      const { app } = withUntypedVariable((ir, notes, read) => {
        connect(notes, read.id, 'value', 'notesHeading', 'text');
      });
      expect(app.files['src/stores/variables.ts']).toContain('export const lastQuote = value<unknown>(undefined);');
    });
  });

  describe('the text sink', () => {
    it('coerces, as the runtime Text node coerces on its way to the DOM', () => {
      const { app } = withUntypedVariable((ir, notes, read) => {
        connect(notes, read.id, 'value', 'notesHeading', 'text');
      });
      expectParses(app);
      expect(notesFile(app)).toContain("<p className={styles.notesHeading}>{String(quote ?? '')}</p>");
    });

    it('CONTROL — a typed variable in the same sink reads bare', () => {
      const app = withTypedVariable((ir, notes, read) => {
        connect(notes, read.id, 'value', 'notesHeading', 'text');
      });
      expect(notesFile(app)).toContain('<p className={styles.notesHeading}>{draft}</p>');
      expect(notesFile(app)).not.toContain('String(draft');
    });

    it('the wire is no longer reported as dropped, in either arm', () => {
      const { app } = withUntypedVariable((ir, notes, read) => {
        connect(notes, read.id, 'value', 'notesHeading', 'text');
      });
      expect(app.notes.join('\n')).not.toContain('has no statically-typed writer');
      expect(app.notes.join('\n')).not.toContain('notesHeading.text');
    });
  });

  describe('the string-attribute sink', () => {
    it('coerces into placeholder', () => {
      const { app } = withUntypedVariable((ir, notes, read) => {
        connect(notes, read.id, 'value', 'entryInput', 'placeholder');
      });
      expectParses(app);
      expect(notesFile(app)).toContain("placeholder={String(quote ?? '')}");
    });

    it('CONTROL — a typed variable lands in placeholder bare', () => {
      const app = withTypedVariable((ir, notes, read) => {
        connect(notes, read.id, 'value', 'entryInput', 'placeholder');
      });
      expect(notesFile(app)).toContain('placeholder={draft}');
    });
  });

  describe('the truthiness sinks', () => {
    /**
     * These need no coercion at all and that is the point of grading them: `!x` and `!!x` are
     * already boolean over an `unknown`, and the runtime's own `enabled` port coerces `!!value`.
     * A slice that wrapped `String()` around these would invert them — `String(false)` is
     * `"false"`, which is truthy.
     */
    it('enabled becomes the bare negation, never a stringified one', () => {
      const { app } = withUntypedVariable((ir, notes, read) => {
        connect(notes, read.id, 'value', 'addButton', 'enabled');
      });
      expectParses(app);
      expect(notesFile(app)).toContain('disabled={!quote}');
      expect(notesFile(app)).not.toContain('String(quote');
    });

    it('mounted becomes the bare double negation', () => {
      const { app } = withUntypedVariable((ir, notes, read) => {
        connect(notes, read.id, 'value', 'notesHeading', 'mounted');
      });
      expectParses(app);
      expect(notesFile(app)).toContain('!!quote &&');
      expect(notesFile(app)).not.toContain('String(quote');
    });

    it('visible toggles the hidden class off the bare negation', () => {
      const { app } = withUntypedVariable((ir, notes, read) => {
        connect(notes, read.id, 'value', 'notesHeading', 'visible');
      });
      expectParses(app);
      expect(notesFile(app)).toContain('!quote &&');
      expect(notesFile(app)).not.toContain('String(quote');
    });
  });

  describe('a sink this slice cannot coerce to', () => {
    /**
     * 🔴 The refusal is the half that keeps the coercion honest, and it is graded on its
     * REASON. `maxLength` is a number, and `Number(whatever the server sent)` would be the
     * exporter inventing a rounding rule the runtime does not perform.
     */
    it('a number attribute refuses, and says which variable and why', () => {
      const { app } = withUntypedVariable((ir, notes, read) => {
        connect(notes, read.id, 'value', 'entryInput', 'maxLength');
      });
      expectParses(app);
      expect(notesFile(app)).not.toContain('maxLength=');
      expect(app.notes.join('\n')).toContain(
        'wire into entryInput.maxLength reads variable "lastQuote", which has no statically-typed writer, into a sink this slice cannot coerce it to'
      );
    });

    it('CONTROL — a typed variable reaches the same number attribute', () => {
      const app = withTypedVariable((ir, notes, read) => {
        connect(notes, read.id, 'value', 'entryInput', 'maxLength');
      });
      expect(notesFile(app)).toContain('maxLength={draft}');
    });

    it('the refusal does not read as a missing source — the two notes are distinguishable', () => {
      const { app } = withUntypedVariable((ir, notes, read) => {
        connect(notes, read.id, 'value', 'entryInput', 'maxLength');
      });
      expect(app.notes.join('\n')).not.toContain('entryInput.maxLength has no statically known source');
    });
  });

  describe('a component instance prop', () => {
    const onHome = (
      configure: (ir: ExportIR, home: ComponentIR, read: NodeIR) => void
    ): ReturnType<typeof emitApp> => {
      const { ir } = withUntypedVariable((inner, notes, read) => {
        connect(notes, read.id, 'value', 'notesHeading', 'text');
      });
      const home = componentOf(ir, 'Pages/Home');
      const read = addNode(home, {
        id: 'quoteReadHome',
        type: 'Variable2',
        parameters: [{ name: 'name', value: literal('lastQuote') }]
      });
      configure(ir, home, read);
      return emitApp(ir, catalog);
    };

    it('coerces into a string-typed component input', () => {
      const app = onHome((ir, home, read) => {
        connect(home, read.id, 'value', 'greetingCard', 'Name');
      });
      expectParses(app);
      expect(homeFile(app)).toContain("<GreetingCard Name={String(quote ?? '')} />");
    });

    it('refuses a number-typed component input by the type the target declares', () => {
      const app = onHome((ir, home, read) => {
        const inputs = componentOf(ir, 'Components/GreetingCard').nodes.find((n) => n.id === 'greet-inputs')!;
        inputs.declaredPorts = inputs.declaredPorts.map((p) =>
          p.name === 'Name' ? { ...p, type: 'number' } : p
        );
        connect(home, read.id, 'value', 'greetingCard', 'Name');
      });
      // ⚠️ Anchored: `className={` contains `Name={`, and the unanchored form passes on nothing.
      expect(homeFile(app)).not.toMatch(/(?<![A-Za-z])Name=/);
      expect(app.notes.join('\n')).toContain(
        'wire into greetingCard.Name reads variable "lastQuote", which has no statically-typed writer, into a sink this slice cannot coerce it to'
      );
    });

    /**
     * 🔴 **A defect this slice found on its way past, and it was never about untyped values.**
     * The instance carries an authored `Name="Ada"` *and* a wire into `Name`, which is what the
     * editor leaves behind when you wire a port that already had a value. Both printed, and
     * `<GreetingCard Name="Ada" Name={x} />` is TS17001 — the exported app did not compile. It
     * bit a `string`-typed variable exactly as hard; the type gate was simply hiding it here.
     */
    it('a wired port prints once: the wire replaces the authored value, never joins it', () => {
      const app = onHome((ir, home, read) => {
        connect(home, read.id, 'value', 'greetingCard', 'Name');
      });
      expect(homeFile(app)).not.toContain('Name="Ada"');
      expect((homeFile(app).match(/(?<![A-Za-z])Name=/g) ?? []).length).toBe(1);
    });

    it('CONTROL — an unwired authored value still prints', () => {
      const app = emitApp(JSON.parse(JSON.stringify(baseIr)), catalog);
      expect(homeFile(app)).toContain('Name="Ada"');
    });

    /**
     * 🔴 **§25 — this file's richest graph put through a compiler rather than a parser.**
     *
     * `onHome` is the widest emission this file builds: an HTTP request, a `Set Variable` writing
     * an `unknown`, a read of it into a text sink on one page, and a second read into a component
     * instance prop on another. `expectParses` grades all of that as syntax only.
     *
     * 🔴 **It is this graph rather than a fixture, and that was measured rather than reasoned.**
     * The duplicate-prop defect two rows above lived here: `<GreetingCard Name="Ada" Name={x} />`
     * is TS17001, a *compiler* error on perfectly good syntax. Deleting the instance-side dedup in
     * `src/emit/component.ts` — `if (plan.bindings[node.id]?.[param.name] !== undefined) continue;`
     * — puts it back, and with that mutant in place this row goes red naming
     * `TS17001 src/pages/Home.tsx`, while **`tests/typecheck-emitted.test.ts` stays 11/11 green and
     * `tests/emitted-syntax.test.ts` stays 16/16 green**. No fixture wires a port that already
     * carries an authored value, so compiling all seven fixture apps never meets the shape.
     *
     * The row above pins the emitter's current answer with a regex count; this asserts the general
     * thing that regex is a proxy for — that the file the export ships actually compiles. No parse
     * can: a duplicate JSX attribute yields **zero** `parseDiagnostics`, which is why every
     * `expectParses` in this file passes on the mutant.
     */
    it('the emitted app typechecks, and not merely parses', () => {
      const app = onHome((ir, home, read) => {
        connect(home, read.id, 'value', 'greetingCard', 'Name');
      });
      expect(typecheckEmittedApp(app)).toEqual([]);
    });
  });

  describe('what still defers', () => {
    /**
     * The control for the whole file: lifting the type gate must not have lifted the gate beside
     * it. A variable whose *name* is not a literal is still unreadable, for a different reason.
     */
    it('a non-literal variable name still drops the read', () => {
      const { app } = withUntypedVariable((ir, notes, read) => {
        read.parameters = [
          { name: 'name', value: { kind: 'expression', source: 'someDynamicName' } as unknown as ParamValue }
        ];
        connect(notes, read.id, 'value', 'notesHeading', 'text');
      });
      expect(app.notes.join('\n')).toContain('variable name is not a literal');
      expect(notesFile(app)).not.toContain('String(quote');
    });
  });
});
