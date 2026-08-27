import * as fs from 'fs';
import * as path from 'path';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { ComponentIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const ir = parseProject(FIXTURE, catalog);
const app = emitApp(ir, catalog);

const cloneIr = (): ExportIR => structuredClone(ir);
const componentOf = (source: ExportIR, componentPath: string): ComponentIR =>
  source.components.find((c) => c.path === componentPath)!;
const nodeOf = (source: ExportIR, componentPath: string, id: string): NodeIR =>
  componentOf(source, componentPath).nodes.find((n) => n.id === id)!;
const setParam = (node: NodeIR, name: string, value: ParamValue) => {
  const existing = node.parameters.find((p) => p.name === name);
  if (existing) existing.value = value;
  else {
    node.parameters.push({ name, value });
    node.parameters.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }
};
const lit = (value: string | number | boolean): ParamValue => ({ kind: 'literal', value });
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
const unwire = (source: ExportIR, componentPath: string, key: string) => {
  const component = componentOf(source, componentPath);
  component.connections = component.connections.filter((c) => c.key !== key);
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

const HOME = 'Pages/Home';
const METER = 'Components/CheerMeter';

// ---------------------------------------------------------------------------------------------
// Session 16 (EXP-002-CONTROLLED-STATE-TARGET-OUTPUT.md): the five state rows — a state var,
// state reads, state writes (with functional updates), the sync effect (the graph path of a
// wired control input, per §1's coercion table), and the push effect (lifted value outputs).
// The CheerMeter fixture carries the §9 shapes; the mutations below hold each rule alone.
// ---------------------------------------------------------------------------------------------

const GOLDEN_CHEER_METER = `// @nodegx:generated (visual — provenance markers complete in EXP-007)
import { useEffect, useState } from 'react';
import { useValue } from '@nodegx/core/react';

import { draftCopy, visitorName } from '../stores/variables';
import styles from './CheerMeter.module.css';

function joinClasses(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export interface CheerMeterProps {
  onDraftChanged?: (value: string) => void;
}

/** Cheer meter. */
export function CheerMeter({ onDraftChanged }: CheerMeterProps) {
  const name = useValue(visitorName);
  // The input's local state (§4c) — the graph path syncs it without firing Changed; the user path writes it and runs the Changed chain.
  const [draft, setDraft] = useState<string>('');
  // From the Switch node "Show Details" — a latch: On/Off/Flip write it, Current State reads it.
  const [showDetails, setShowDetails] = useState<boolean>(false);

  // Graph-path sync (text input): undefined abstains, null clears (FB-026) — Changed never fires.
  useEffect(() => {
    if (name === undefined) return;
    setDraft(name === null ? '' : String(name));
  }, [name]);

  useEffect(() => {
    onDraftChanged?.(draft);
  }, [draft, onDraftChanged]);

  return (
    <div className={styles.meterRoot}>
      <input
        className={styles.meterInput}
        placeholder="Draft a cheer"
        value={draft}
        onChange={(event) => { setDraft(event.target.value); draftCopy.set(event.target.value); }}
      />
      <button className={styles.toggleButton} onClick={() => setShowDetails((v) => !v)}>
        Details
      </button>
      {showDetails && (
        <p className={styles.detailsText}>The crowd goes wild</p>
      )}
      <div className={joinClasses(styles.badge, !showDetails && styles.hiddenKeepSpace)}>
        <p className={styles.badgeText}>Live</p>
      </div>
    </div>
  );
}
`;

describe('the CheerMeter fixture (§9)', () => {
  test('CheerMeter.tsx matches the hand-written target — latch, controlled input, sinks, push', () => {
    expect(app.files['src/components/CheerMeter.tsx']).toBe(GOLDEN_CHEER_METER);
  });

  test('the hidden-keep-space rule is one class per module (§4b)', () => {
    expect(app.files['src/components/CheerMeter.module.css']).toContain(
      '.hiddenKeepSpace {\n  visibility: hidden;\n}'
    );
  });

  test('Home consumes the lifted draft: parent state + callback + folded read (§4d)', () => {
    const home = app.files['src/pages/Home.tsx'];
    expect(home).toContain('const [draft, setDraft] = useState<string | undefined>();');
    expect(home).toContain('<CheerMeter onDraftChanged={setDraft} />');
    expect(home).toContain("{draft ?? ''}");
  });

  test('the ledger flips Switch and Counter in the same commit as the slice (EXP-008)', () => {
    const ledger = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'coverage-ledger.json'), 'utf8')
    );
    const entries = ledger.entries as Array<{ typeName: string; status: string }>;
    expect(entries.find((e) => e.typeName === 'Switch')!.status).toBe('translated');
    // Counter flips too: the audit re-run showed its instances actually translating
    // (one per cn-family project; the wired-Start-Value ones defer named).
    expect(entries.find((e) => e.typeName === 'Counter')!.status).toBe('translated');
  });
});

describe('the latch and the chain-local snapshot rule (§3, §4a)', () => {
  const withGate = () => {
    const mutated = cloneIr();
    addChild(mutated, HOME, 'shell', { id: 'snapBtn', type: 'net.noodl.controls.button' });
    setParam(nodeOf(mutated, HOME, 'snapBtn'), 'label', lit('Snap'));
    addNode(mutated, HOME, { id: 'gate', type: 'Switch', authoredLabel: 'Gate', portKnowledge: 'partial' });
    addNode(mutated, HOME, { id: 'snapSend', type: 'Event Sender' });
    setParam(nodeOf(mutated, HOME, 'snapSend'), 'channelName', lit('celebrate'));
    setParam(nodeOf(mutated, HOME, 'snapSend'), 'payload', lit('message'));
    return mutated;
  };

  test('a read after a state-set inlines the written expression — never the stale closure', () => {
    const mutated = withGate();
    wire(mutated, HOME, 'snapBtn', 'onClick', 'gate', 'on', 'signal');
    wire(mutated, HOME, 'gate', 'state', 'snapSend', 'message');
    wire(mutated, HOME, 'snapBtn', 'onClick', 'snapSend', 'sendEvent', 'signal');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Home.tsx']).toContain(
      'onClick={() => { setGate(true); celebrate.emit({ message: true }); }}'
    );
  });

  test('a read after a functional update defers the reading node — not statically expressible', () => {
    const mutated = withGate();
    wire(mutated, HOME, 'snapBtn', 'onClick', 'gate', 'flip', 'signal');
    wire(mutated, HOME, 'gate', 'state', 'snapSend', 'message');
    wire(mutated, HOME, 'snapBtn', 'onClick', 'snapSend', 'sendEvent', 'signal');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('functional update earlier in the chain');
    expect(result.files['src/pages/Home.tsx']).toContain('onClick={() => setGate((v) => !v)}');
  });

  test('a consumed switched pulse defers the latch, named (§4a gate)', () => {
    const mutated = withGate();
    wire(mutated, HOME, 'snapBtn', 'onClick', 'gate', 'on', 'signal');
    wire(mutated, HOME, 'gate', 'switched', 'snapSend', 'sendEvent', 'signal');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain(
      'its switched signal is consumed — change-conditional pulses are not translated in this slice'
    );
  });

  test('a wired State input defers — its setter announces a switch even though nothing switched', () => {
    const mutated = withGate();
    wire(mutated, HOME, 'snapBtn', 'onClick', 'gate', 'on', 'signal');
    wire(mutated, HOME, 'visitorVar', 'value', 'gate', 'onFromStart');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('announces a switch even though nothing switched');
  });

  test('a literal State parameter is the boot value', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, METER, 'showDetails'), 'onFromStart', lit(true));
    const result = emitApp(mutated, catalog);
    expect(result.files['src/components/CheerMeter.tsx']).toContain(
      'const [showDetails, setShowDetails] = useState<boolean>(true);'
    );
  });
});

describe('Counter — the same shape in number (§4a)', () => {
  const withTally = () => {
    const mutated = cloneIr();
    addChild(mutated, HOME, 'shell', { id: 'incBtn', type: 'net.noodl.controls.button' });
    setParam(nodeOf(mutated, HOME, 'incBtn'), 'label', lit('More'));
    addChild(mutated, HOME, 'shell', { id: 'resetBtn', type: 'net.noodl.controls.button' });
    setParam(nodeOf(mutated, HOME, 'resetBtn'), 'label', lit('Reset'));
    addChild(mutated, HOME, 'shell', { id: 'tallyText', type: 'Text' });
    addNode(mutated, HOME, { id: 'tally', type: 'Counter', authoredLabel: 'Tally', portKnowledge: 'partial' });
    setParam(nodeOf(mutated, HOME, 'tally'), 'startValue', lit(5));
    wire(mutated, HOME, 'incBtn', 'onClick', 'tally', 'increase', 'signal');
    wire(mutated, HOME, 'resetBtn', 'onClick', 'tally', 'reset', 'signal');
    wire(mutated, HOME, 'tally', 'currentCount', 'tallyText', 'text');
    return mutated;
  };

  test('increase is a functional update, reset writes the literal start, the count renders', () => {
    const result = emitApp(withTally(), catalog);
    const home = result.files['src/pages/Home.tsx'];
    expect(home).toContain('const [tally, setTally] = useState<number>(5);');
    expect(home).toContain('onClick={() => setTally((v) => v + 1)}');
    expect(home).toContain('onClick={() => setTally(5)}');
    expect(home).toContain('{tally}');
  });

  test('enabled limits defer the counter — clamped counting is not translated', () => {
    const mutated = withTally();
    setParam(nodeOf(mutated, HOME, 'tally'), 'limitsEnabled', lit(true));
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('its limits gate the mutations');
  });

  test('a consumed countChanged defers, named', () => {
    const mutated = withTally();
    wire(mutated, HOME, 'tally', 'countChanged', 'cheerSend', 'sendEvent', 'signal');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('its countChanged signal is consumed');
  });

  test('a wired Start Value defers — the first arrival seeds the count', () => {
    const mutated = withTally();
    wire(mutated, HOME, 'visitorVar', 'value', 'tally', 'startValue');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('its Start Value is wired');
  });
});

describe("the sync effect runs §1's coercion table, per control (§4c)", () => {
  test('checkbox: !!value, applied always — no abstain', () => {
    const mutated = cloneIr();
    addChild(mutated, HOME, 'shell', { id: 'ck', type: 'net.noodl.controls.checkbox' });
    wire(mutated, HOME, 'visitorVar', 'value', 'ck', 'checked');
    const result = emitApp(mutated, catalog);
    const home = result.files['src/pages/Home.tsx'];
    expect(home).toContain('const [checked, setChecked] = useState<boolean>(false);');
    expect(home).toContain('setChecked(!!name);');
    expect(home).toContain('checked={checked}');
    expect(home).toContain('onChange={(event) => setChecked(event.target.checked)}');
  });

  test('slider: abstain on empty, non-finite abstains, clamp to [min, max]', () => {
    const mutated = cloneIr();
    addChild(mutated, HOME, 'shell', { id: 'vol', type: 'net.noodl.controls.range' });
    setParam(nodeOf(mutated, HOME, 'vol'), 'min', lit(10));
    setParam(nodeOf(mutated, HOME, 'vol'), 'max', lit(50));
    wire(mutated, HOME, 'visitorVar', 'value', 'vol', 'value');
    const result = emitApp(mutated, catalog);
    const home = result.files['src/pages/Home.tsx'];
    expect(home).toContain("if (arrival === undefined || arrival === null || arrival === '') return;");
    expect(home).toContain('if (!Number.isFinite(next)) return;');
    expect(home).toContain('setRangeValue(Math.min(50, Math.max(10, next)));');
    expect(home).toContain('value={rangeValue}');
    expect(home).toContain('onChange={(event) => setRangeValue(Number(event.target.value))}');
  });

  test('dropdown: toString when non-string, undefined applies (deselects), null abstains', () => {
    const mutated = cloneIr();
    addChild(mutated, HOME, 'shell', { id: 'pick', type: 'net.noodl.controls.options' });
    setParam(nodeOf(mutated, HOME, 'pick'), 'items', { kind: 'json', value: [{ Label: 'Alpha', Value: 'a' }] });
    wire(mutated, HOME, 'visitorVar', 'value', 'pick', 'value');
    const result = emitApp(mutated, catalog);
    const home = result.files['src/pages/Home.tsx'];
    expect(home).toContain('if (name === null) return;');
    expect(home).toContain("setSelected(name === undefined ? '' : String(name));");
    expect(home).toContain('value={selected}');
  });

  test('text input honours Run On Value Change: unticked, arrivals wait for a Set pulse', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, METER, 'meterInput'), 'runOnChange-startValue', lit(false));
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain(
      'Value is unticked under Run On Value Change — arrivals wait for a Set pulse'
    );
    const meter = result.files['src/components/CheerMeter.tsx'];
    // The lifted output still demands the state row; only the graph feed is gone.
    expect(meter).toContain('value={draft}');
    expect(meter).not.toContain('Graph-path sync');
  });

  test("clear is a state-set to the field's empty value (FB-026)", () => {
    const mutated = cloneIr();
    addChild(mutated, METER, 'meterRoot', { id: 'clearBtn', type: 'net.noodl.controls.button' });
    setParam(nodeOf(mutated, METER, 'clearBtn'), 'label', lit('Clear'));
    wire(mutated, METER, 'clearBtn', 'onClick', 'meterInput', 'clear', 'signal');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/components/CheerMeter.tsx']).toContain("onClick={() => setDraft('')}");
  });

  test('checkbox check/uncheck are state writes; a consumed outcome defers', () => {
    const mutated = cloneIr();
    addChild(mutated, HOME, 'shell', { id: 'ck', type: 'net.noodl.controls.checkbox' });
    addChild(mutated, HOME, 'shell', { id: 'ckBtn', type: 'net.noodl.controls.button' });
    setParam(nodeOf(mutated, HOME, 'ckBtn'), 'label', lit('Tick'));
    wire(mutated, HOME, 'ckBtn', 'onClick', 'ck', 'check', 'signal');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Home.tsx']).toContain('onClick={() => setChecked(true)}');

    const outcome = cloneIr();
    addChild(outcome, HOME, 'shell', { id: 'ck', type: 'net.noodl.controls.checkbox' });
    addChild(outcome, HOME, 'shell', { id: 'ckBtn', type: 'net.noodl.controls.button' });
    wire(outcome, HOME, 'ckBtn', 'onClick', 'ck', 'check', 'signal');
    wire(outcome, HOME, 'ck', 'done', 'cheerSend', 'sendEvent', 'signal');
    expect(emitApp(outcome, catalog).notes.join('\n')).toContain('its done outcome is consumed');
  });
});

describe('the visibility sinks (§4b)', () => {
  test('authored Mounted false removes the element with a comment — authored state, not dead code', () => {
    const mutated = cloneIr();
    addChild(mutated, METER, 'meterRoot', { id: 'ghost', type: 'Text' });
    setParam(nodeOf(mutated, METER, 'ghost'), 'text', lit('Never'));
    setParam(nodeOf(mutated, METER, 'ghost'), 'mounted', lit(false));
    const result = emitApp(mutated, catalog);
    expect(result.files['src/components/CheerMeter.tsx']).toContain(
      '{/* node ghost: authored Mounted false — removed from the tree */}'
    );
  });

  test('authored visible false folds to the static hidden class — the layout space stays', () => {
    const mutated = cloneIr();
    addChild(mutated, METER, 'meterRoot', { id: 'shy', type: 'Text' });
    setParam(nodeOf(mutated, METER, 'shy'), 'text', lit('Shy'));
    setParam(nodeOf(mutated, METER, 'shy'), 'visible', lit(false));
    const result = emitApp(mutated, catalog);
    expect(result.files['src/components/CheerMeter.tsx']).toContain(
      'className={joinClasses(styles.shy, styles.hiddenKeepSpace)}'
    );
  });

  test('a boolean expression lands in visible — the truthiness admission list grew (§4b)', () => {
    const mutated = cloneIr();
    wire(mutated, HOME, 'hasName', 'result', 'echoText', 'visible');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Home.tsx']).toContain(
      'className={joinClasses(styles.echoText, !name && styles.hiddenKeepSpace)}'
    );
  });

  test('a mounted wire into the component root defers — a router concern', () => {
    const mutated = cloneIr();
    wire(mutated, METER, 'showDetails', 'state', 'meterRoot', 'mounted');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain(
      'a mounted wire into the component root is a router concern'
    );
  });

  test('a non-boolean mounted source is coerced — a number 0 can never render itself', () => {
    const mutated = cloneIr();
    addChild(mutated, HOME, 'shell', { id: 'maybe', type: 'Text' });
    setParam(nodeOf(mutated, HOME, 'maybe'), 'text', lit('Maybe'));
    wire(mutated, HOME, 'visitorVar', 'value', 'maybe', 'mounted');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Home.tsx']).toContain('{!!name && (');
  });
});

describe('For Each over a prop-fed list (§4e)', () => {
  test('an array-typed prop renders (links ?? []).map with index keys', () => {
    const mutated = cloneIr();
    addNode(mutated, METER, {
      id: 'meterInputs',
      type: 'Component Inputs',
      declaredPorts: [{ name: 'links', plug: 'output', kind: 'value', type: 'array' }]
    });
    addChild(mutated, METER, 'meterRoot', { id: 'linkRows', type: 'For Each' });
    setParam(nodeOf(mutated, METER, 'linkRows'), 'template', lit('/Components/NoteRow'));
    wire(mutated, METER, 'meterInputs', 'links', 'linkRows', 'items');
    const result = emitApp(mutated, catalog);
    const meter = result.files['src/components/CheerMeter.tsx'];
    expect(meter).toContain('links?: any[];');
    expect(meter).toContain('{(links ?? []).map((item, index) => (');
    expect(meter).toContain('<NoteRow key={index} text={item.text} mood={item.mood} />');
  });
});

describe('lifted value outputs — the collision gate (§4d)', () => {
  test('a prop-name collision fails the port, never silently renames', () => {
    const mutated = cloneIr();
    addNode(mutated, METER, {
      id: 'meterInputs',
      type: 'Component Inputs',
      declaredPorts: [{ name: 'onDraftChanged', plug: 'output', kind: 'value', type: 'string' }]
    });
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('would collide with prop "onDraftChanged"');
    // The child's feed drops named, and the parent's consuming wire cannot bind a port the
    // child did not lift — it is reported, never silently attached.
    expect(result.notes.join('\n')).toContain('value output that did not lift');
    expect(result.notes.join('\n')).toContain(
      'wire cheerMeter:draft->echoText:text has no deterministic translation'
    );
    expect(result.files['src/pages/Home.tsx']).not.toContain('onDraftChanged={setDraft}');
  });
});
