import * as fs from 'fs';
import * as path from 'path';

import { Catalog, CatalogIndex, loadCatalog } from '../src/catalog';
import { planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { ComponentIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * The value Variables — `String`, `Number`, `Boolean`, `Color` (EXP-011 Tier 1.4).
 *
 * ⚠️ **These tests are mutation-built, and that is a deliberate limit, not a shortcut.** The
 * corpus contains none of these four types — which is the whole reason EXP-011 exists, and
 * exactly the blindness the picker metric was built to expose (`picker-coverage.js`'s headnote).
 * A test suite that could only be written against the corpus could not have been written at all.
 * The project that answers "does it run" is a separate artefact and named in EXP-011 §2; this
 * file's job is the decision table.
 *
 * The table under test is `variablebase.setValueTo` (packages/noodl-runtime/.../variablebase.ts),
 * so every case here names the runtime behaviour it is a translation of rather than merely the
 * text it expects. The two shapes are:
 *
 *   **constant** — nothing wired into `value` or `Set`: the read folds to a literal.
 *   **mirror**   — `value` wired under Run On Value Change: a `useState` + a sync effect.
 *
 * and `Set` is deliberately out of the slice, with a named reason (§4).
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');

const catalog: Catalog = loadCatalog();
const baseIr = parseProject(FIXTURE, catalog);

const HOME = 'Pages/Home';

const componentOf = (source: ExportIR, componentPath: string): ComponentIR =>
  source.components.find((c) => c.path === componentPath)!;
const nodeOf = (source: ExportIR, componentPath: string, id: string): NodeIR =>
  componentOf(source, componentPath).nodes.find((n) => n.id === id)!;
const lit = (value: string | number | boolean): ParamValue => ({ kind: 'literal', value });

const setParam = (node: NodeIR, name: string, value: ParamValue) => {
  const existing = node.parameters.find((p) => p.name === name);
  if (existing) existing.value = value;
  else {
    node.parameters.push({ name, value });
    node.parameters.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }
};
const addNode = (source: ExportIR, componentPath: string, node: Partial<NodeIR> & { id: string; type: string }) => {
  componentOf(source, componentPath).nodes.push({
    catalogRef: node.type.startsWith('/') ? null : node.type,
    parameters: [],
    declaredPorts: [],
    portKnowledge: 'complete',
    ...node
  } as NodeIR);
};
const addChild = (
  source: ExportIR,
  componentPath: string,
  parentId: string,
  node: Partial<NodeIR> & { id: string; type: string }
) => {
  addNode(source, componentPath, { ...node, parent: parentId });
  const parent = nodeOf(source, componentPath, parentId);
  parent.children = [...(parent.children ?? []), node.id];
};
const wire = (
  source: ExportIR,
  componentPath: string,
  fromId: string,
  fromProperty: string,
  toId: string,
  toProperty: string,
  kind: 'value' | 'signal' = 'value'
) => {
  componentOf(source, componentPath).connections.push({
    key: `${fromId}:${fromProperty}->${toId}:${toProperty}`,
    fromId,
    fromProperty,
    toId,
    toProperty,
    kind
  });
};

const emit = (ir: ExportIR) => emitApp(ir, catalog);
const homeFile = (app: ReturnType<typeof emitApp>) =>
  app.files[Object.keys(app.files).find((k) => k.endsWith('Home.tsx'))!];

/**
 * A value Variable feeding a Text's `text`, which is the plainest read there is: a rendered
 * sink whose binding names the value directly, so the assertions are about the value and not
 * about a sink's own folding.
 *
 * ⚠️ The sink is a Text this helper **adds**, not one the fixture already has. Every rendered
 * text on the Cheer Home page is already bound, and a second writer onto a bound port is a
 * different rule being tested (CO §4's) — the first run of this file wired `echoText.text`,
 * which the CheerMeter already feeds, and every positive case failed for that reason rather
 * than for anything about a Variable.
 */
const withVariable = (
  type: 'String' | 'Number' | 'Boolean' | 'Color',
  opts: {
    params?: Record<string, string | number | boolean>;
    /** Wire `visitorName`'s Variable2 into this node's `value` — the mirror shape. */
    feedFromVariable?: boolean;
    /** Wire the page's text input's own event value into `value` — a handler-only read. */
    feedFromInputEvent?: boolean;
    setFrom?: string;
    label?: string;
    output?: string;
    readInto?: { id: string; property: string };
  } = {}
) => {
  const ir: ExportIR = structuredClone(baseIr);
  addChild(ir, HOME, 'shell', { id: 'varSink', type: 'Text', authoredLabel: 'Variable sink' });
  addNode(ir, HOME, { id: 'valueVar', type, authoredLabel: opts.label === undefined ? `${type} value` : opts.label });
  const node = nodeOf(ir, HOME, 'valueVar');
  for (const [name, value] of Object.entries(opts.params ?? {})) setParam(node, name, lit(value));
  if (opts.feedFromVariable) wire(ir, HOME, 'visitorVar', 'value', 'valueVar', 'value');
  if (opts.feedFromInputEvent) wire(ir, HOME, 'nameInput', 'onTextChanged', 'valueVar', 'value');
  if (opts.setFrom) wire(ir, HOME, opts.setFrom, 'onClick', 'valueVar', 'saveValue', 'signal');
  const read = opts.readInto ?? { id: 'varSink', property: 'text' };
  wire(ir, HOME, 'valueVar', opts.output ?? 'savedValue', read.id, read.property);
  return { ir, node };
};

const deferNote = (ir: ExportIR) => emit(ir).notes.find((n) => n.includes('node valueVar') && n.includes('deferred'));

// ---------------------------------------------------------------------------------------------
// The constant shape — no wire into Value, no wire into Set
// ---------------------------------------------------------------------------------------------

describe('a value Variable nothing writes is a constant, not a state row', () => {
  it('an authored String folds into the binding and mints no useState', () => {
    const out = homeFile(emit(withVariable('String', { params: { value: 'Bring cake' } }).ir));

    expect(out).toContain('Bring cake');
    expect(out).not.toContain('useState<string>');
  });

  it('an unauthored node reports its type startValue, which is the runtime’s initialize', () => {
    // `initialize` seeds `currentValue = args.startValue` and a *declared* default never runs a
    // setter (run-on-value-change.ts) — so an untouched panel reports these, not undefined.
    expect(homeFile(emit(withVariable('Number').ir))).toContain('>0</p>');
    expect(homeFile(emit(withVariable('Color').ir))).toContain('>#f1f2f4</p>');
  });

  it('the authored parameter goes through the node’s own cast', () => {
    // `Number.cast` is `Number(value)`; the panel persists "7" as text on some ports and the
    // node stores 7. A translation that kept the string would type the prop `string` where the
    // running app has a number — the §10 disagreement, one node earlier.
    const out = homeFile(emit(withVariable('Number', { params: { value: '7' } }).ir));
    expect(out).toContain('>7</p>');

    // `Boolean.cast` is `Boolean(value)` — the string "false" is truthy and stores true. This is
    // the runtime being surprising, and the export agreeing with it is the point.
    const bool = homeFile(emit(withVariable('Boolean', { params: { value: 'false' } }).ir));
    expect(bool).toContain('>true</p>');
  });

  it('a Number cast that cannot produce a real value takes Treat empty as, never NaN', () => {
    // `NaN` is banned as a stored value outright (variablebase): `NaN !== NaN` would break the
    // runtime's own `changed` guard forever. With the default null coercion there is no
    // expression for the result, so the node defers rather than printing NaN.
    expect(deferNote(withVariable('Number', { params: { value: 'abc' } }).ir)).toContain('cleared (null) value');

    // Ticking `Treat empty as: Zero` gives it one, and it is 0 — the runtime's substitution.
    const zeroed = withVariable('Number', { params: { value: 'abc', treatEmptyAs: 'zero' } });
    expect(homeFile(emit(zeroed.ir))).toContain('>0</p>');
  });

  it('Color does not coerce — its cast is the identity, and a token survives verbatim', () => {
    const out = homeFile(emit(withVariable('Color', { params: { value: 'var(--primary)' } }).ir));
    expect(out).toContain('var(--primary)');
  });

  it('String’s Length output folds over a known string, and counts a cleared one as 0', () => {
    const out = homeFile(
      emit(withVariable('String', { params: { value: 'Bring cake' }, output: 'length' }).ir)
    );
    expect(out).toContain('>10</p>');

    // `string.ts`'s getter: `typeof value === 'string' ? value.length : 0`. An unauthored String
    // starts at '' — 0 either way, but by the runtime's route rather than a guess.
    expect(homeFile(emit(withVariable('String', { output: 'length' }).ir))).toContain('>0</p>');
  });

  it('the node collapses into the file it folded into — it is not left unclassified', () => {
    const { ir } = withVariable('String', { params: { value: 'Bring cake' } });
    const plan = planProject(ir, new CatalogIndex(catalog)).byLegacyPath.get('/Pages/Home')!;

    expect(plan.dispositions['valueVar']).toEqual({ kind: 'collapsed', into: 'src/pages/Home.tsx' });
  });
});

// ---------------------------------------------------------------------------------------------
// The mirror shape — Value wired under Run On Value Change
// ---------------------------------------------------------------------------------------------

describe('a wired Value under Run On Value Change is a row plus a sync effect', () => {
  it('mints the row from the authored label and syncs it with the node’s cast', () => {
    const out = homeFile(emit(withVariable('String', { feedFromVariable: true, label: 'Shout line' }).ir));

    expect(out).toContain('const [shoutLine, setShoutLine] = useState<string | null>(\'\');');
    expect(out).toContain('const arrival = name;');
    expect(out).toContain('if (arrival === undefined) return;');
    expect(out).toContain('setShoutLine(arrival === null ? null : String(arrival));');
  });

  it('an unlabelled node falls back to a name that says what it is', () => {
    const out = homeFile(emit(withVariable('Boolean', { feedFromVariable: true, label: '' }).ir));
    expect(out).toContain('const [flag, setFlag]');
  });

  it('the boot value is the type’s startValue — what the row holds before anything arrives', () => {
    // The effect has not run at first paint, and `initialize` is what the interpreter shows
    // there too. A row booting `null` would blank a colour the running app renders.
    expect(homeFile(emit(withVariable('Color', { feedFromVariable: true }).ir))).toContain(
      "useState<string | null>('#f1f2f4')"
    );
    expect(homeFile(emit(withVariable('Number', { feedFromVariable: true }).ir))).toContain(
      'useState<number | null>(0)'
    );
  });

  it('Number bans NaN in the effect too, not only over a literal', () => {
    const out = homeFile(emit(withVariable('Number', { feedFromVariable: true }).ir));

    expect(out).toContain('const next = Number(arrival);');
    expect(out).toContain('setNumberValue(Number.isNaN(next) ? null : next);');
  });

  it('Treat empty as narrows the row’s type — a null nothing can write is not in it', () => {
    // The row is nullable exactly when the default coercion is selected. `Zero` means a null
    // arrival stores 0, and nothing else in the family produces one.
    const out = homeFile(
      emit(withVariable('Number', { feedFromVariable: true, params: { treatEmptyAs: 'zero' } }).ir)
    );

    expect(out).toContain('useState<number>(0)');
    expect(out).toContain('if (arrival === null) { setNumberValue(0); return; }');
  });

  it('Color’s sync effect performs no cast — the identity, spelled out', () => {
    const out = homeFile(emit(withVariable('Color', { feedFromVariable: true }).ir));
    expect(out).toContain('setColorValue(arrival === null ? null : arrival);');
  });

  it('the Value wire is consumed, so it is not reported as a wire nothing translated', () => {
    const app = emit(withVariable('String', { feedFromVariable: true }).ir);
    expect(app.notes.find((n) => n.includes('visitorVar:value->valueVar:value'))).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------------
// §4 — the gates, each asserting its NAMED reason
// ---------------------------------------------------------------------------------------------

describe('the gates', () => {
  it('a wired Set defers, and says what a state write has no room for', () => {
    const note = deferNote(withVariable('String', { feedFromVariable: true, setFrom: 'cheerButton' }).ir);

    expect(note).toContain('its Set commits a pending value');
    expect(note).toContain('latestValue');
  });

  it('a consumed Changed defers — the latch rule, for the latch’s reason', () => {
    const { ir } = withVariable('String', { params: { value: 'Bring cake' } });
    wire(ir, HOME, 'valueVar', 'changed', 'cheerSend', 'sendEvent', 'signal');

    expect(deferNote(ir)).toContain('change-conditional pulses are not translated in this slice');
  });

  it('an unticked Run On Value Change with no Set defers — nothing would ever store', () => {
    const { ir } = withVariable('String', { feedFromVariable: true });
    setParam(nodeOf(ir, HOME, 'valueVar'), 'runOnChange-value', { kind: 'literal', value: false });

    expect(deferNote(ir)).toContain('nothing ever stores');
  });

  it('absent means ticked — an untouched checkbox is the mirror shape, not the deferral', () => {
    // `runOnValueChange` reads *absent* as ticked (run-on-value-change.ts), and reading absent
    // as unticked would defer every node whose author never opened the panel.
    const { ir } = withVariable('String', { feedFromVariable: true });
    expect(deferNote(ir)).toBeUndefined();

    const explicit = withVariable('String', { feedFromVariable: true }).ir;
    setParam(nodeOf(explicit, HOME, 'valueVar'), 'runOnChange-value', { kind: 'literal', value: true });
    expect(deferNote(explicit)).toBeUndefined();
  });

  it('a Value read that only exists inside a handler defers', () => {
    // A text input's own event value is `input-text`, legal only inside that input's onChange.
    // The sync effect runs in render, where the name is not in scope.
    expect(deferNote(withVariable('String', { feedFromInputEvent: true }).ir)).toContain(
      'only exists inside a handler'
    );
  });

  it('a Length read of a stored string defers rather than inventing a member read', () => {
    expect(deferNote(withVariable('String', { feedFromVariable: true, output: 'length' }).ir)).toContain(
      'a member read has no shape'
    );
  });

  it('Length on a type that has no such output is not silently answered', () => {
    expect(deferNote(withVariable('Number', { output: 'length' }).ir)).toContain(
      'is not a port this slice reads'
    );
  });

  it('a node nothing reads defers — a constant no line prints was dropped, not translated', () => {
    const ir: ExportIR = structuredClone(baseIr);
    addNode(ir, HOME, { id: 'valueVar', type: 'String', authoredLabel: 'Orphan' });
    setParam(nodeOf(ir, HOME, 'valueVar'), 'value', lit('Bring cake'));

    expect(deferNote(ir)).toContain('read by nothing statically translatable');
  });

  it('a read whose sink has no static binding names the sink', () => {
    // `cheerSend.message` is an Event Sender payload key the fixture already feeds from
    // `visitorVar`; a second writer is not the case here — this reads into a port with no
    // binding at all, and the verdict has to name it rather than shrug.
    const { ir } = withVariable('String', {
      params: { value: 'x' },
      readInto: { id: 'greetingCard', property: 'notAPort' }
    });

    expect(deferNote(ir)).toContain('has no static binding in this slice');
  });

  it('a deferred node emits no state row and no effect — the speculative-resolve trap', () => {
    // `resolveExpr` runs speculatively, and a sync effect is referenced unconditionally at emit.
    // Pushing one where the read never landed would print a useState and a useEffect no line of
    // the component reads. This is the control that says it does not.
    const { ir } = withVariable('String', { feedFromVariable: true, setFrom: 'cheerButton', label: 'Shout line' });
    const out = homeFile(emit(ir));

    expect(out).not.toContain('shoutLine');
    expect(out).not.toContain('setShoutLine');
  });
});

// ---------------------------------------------------------------------------------------------
// AC3 — the picker-exercising project (EXP-011 §2), as a standing gate
// ---------------------------------------------------------------------------------------------

/**
 * `tests/fixtures/variable-dial` is the app EXP-011 §2 asks for: authored in session 35 through
 * the MCP server (not by hand-editing JSON), one routed page, every node placed on it, and it
 * exports, builds under `tsc -b && vite build`, and runs. The drive is recorded in
 * EXP-011 §6 — a real headless Chrome typing into the field and reading the DOM back.
 *
 * The golden below is byte-for-byte the file that browser executed. Its value is not that it
 * asserts more than the mutation tests above — it asserts less, in one place — but that it is the
 * artefact whose CONSEQUENCES were observed. A source-text assertion passes on dead code; this
 * text is pinned to a run where `Number("cake")` was watched to land on 0 in a live page.
 *
 * It carries all three shapes at once:
 *   - three mirrors (String/Number/Boolean) off one Variable, each with its own cast;
 *   - five constants folded away (a String, its Length, a Number, a Color token, a Boolean
 *     driving `mounted`);
 *   - one deliberate deferral — the Set-latched String, whose readout the drive confirmed
 *     stays empty rather than silently showing the wrong thing.
 */

const DIAL_FIXTURE = path.join(__dirname, 'fixtures', 'variable-dial');

const GOLDEN_HOME = `// @nodegx:generated (visual — provenance markers complete in EXP-007)
import { useEffect, useState } from 'react';
import { useValue } from '@nodegx/core/react';

import { label } from '../stores/variables';
import styles from './Home.module.css';

/** Home. */
export function HomePage() {
  const labelValue = useValue(label);
  // From the String node "Echoed label" — Value writes it under Run On Value Change, Value reads it.
  const [echoedLabel, setEchoedLabel] = useState<string | null>('');
  // From the Number node "Parsed number" — Value writes it under Run On Value Change, Value reads it.
  const [parsedNumber, setParsedNumber] = useState<number>(0);
  // From the Boolean node "Has label" — Value writes it under Run On Value Change, Value reads it.
  const [hasLabel, setHasLabel] = useState<boolean | null>(false);

  // Graph-path sync (Variable): undefined abstains, null stores null — Changed never fires.
  useEffect(() => {
    const arrival = labelValue;
    if (arrival === undefined) return;
    setEchoedLabel(arrival === null ? null : String(arrival));
  }, [labelValue]);

  // Graph-path sync (Variable): undefined abstains, null stores 0 — Changed never fires.
  useEffect(() => {
    const arrival = labelValue;
    if (arrival === undefined) return;
    if (arrival === null) { setParsedNumber(0); return; }
    const next = Number(arrival);
    setParsedNumber(Number.isNaN(next) ? 0 : next);
  }, [labelValue]);

  // Graph-path sync (Variable): undefined abstains, null stores null — Changed never fires.
  useEffect(() => {
    const arrival = labelValue;
    if (arrival === undefined) return;
    setHasLabel(arrival === null ? null : Boolean(arrival));
  }, [labelValue]);

  return (
    <div className={styles.page}>
      <title>Variable Dial</title>

      <p className={styles.headline}>Variable Dial</p>

      <input
        className={styles.labelInput}
        placeholder="Type a label, or a number"
        onChange={(event) => label.set(event.target.value)}
      />

      <p className={styles.mirror}>{echoedLabel}</p>

      <p className={styles.mirror}>{parsedNumber}</p>

      {!!hasLabel && (
        <p className={styles.mirrorFlag}>You typed something.</p>
      )}

      <p className={styles.const}>Bring cake</p>

      <p className={styles.const2}>10</p>

      <p className={styles.const}>42</p>

      <p className={styles.const2}>var(--primary)</p>

      <p className={styles.const}>Badge is on.</p>

      <button className={styles.latchButton}>Latch the label</button>

      <p className={styles.latchedText} />
    </div>
  );
}
`;

describe('the Variable Dial project (EXP-011 §2)', () => {
  const dialApp = emitApp(parseProject(DIAL_FIXTURE, catalog), catalog);

  it('emits the page the browser ran, byte for byte', () => {
    expect(dialApp.files['src/pages/Home.tsx']).toBe(GOLDEN_HOME);
  });

  it('defers exactly one node, and names why', () => {
    const deferrals = dialApp.notes.filter((n) => n.includes('deferred:') && n.includes('node '));

    expect(deferrals).toHaveLength(1);
    expect(deferrals[0]).toContain('node latched (String)');
    expect(deferrals[0]).toContain('its Set commits a pending value');
  });
});
