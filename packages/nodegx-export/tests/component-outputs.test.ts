import * as fs from 'fs';
import * as path from 'path';

import { Catalog, CatalogIndex } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { componentOutputInterface, planProject } from '../src/analyze/plan';
import { ComponentIR, ExportIR, NodeIR } from '../src/ir/types';

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const index = new CatalogIndex(catalog);
const ir = parseProject(FIXTURE, catalog);
const app = emitApp(ir, catalog);

const cloneIr = (): ExportIR => structuredClone(ir);
const componentOf = (source: ExportIR, componentPath: string): ComponentIR =>
  source.components.find((c) => c.path === componentPath)!;
const nodeOf = (source: ExportIR, componentPath: string, id: string): NodeIR =>
  componentOf(source, componentPath).nodes.find((n) => n.id === id)!;
const wire = (
  source: ExportIR,
  componentPath: string,
  fromId: string,
  fromProperty: string,
  toId: string,
  toProperty: string,
  kind: 'value' | 'signal' = 'signal'
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

// ---------------------------------------------------------------------------------------------
// Session 10 (COMPONENT-OUTPUTS-TARGET): a signal output becomes a callback prop, fired by the
// same handler machinery every other action uses; the parent passes the arrow the compiled
// action list builds. Value outputs are the component-state slice's work and defer named.
// ---------------------------------------------------------------------------------------------

const GOLDEN_FAREWELL = `// @nodegx:generated (visual — provenance markers complete in EXP-007)
import styles from './FarewellCard.module.css';

export interface FarewellCardProps {
  onWaved?: () => void;
}

/** Card. */
export function FarewellCard({ onWaved }: FarewellCardProps) {
  return (
    <div className={styles.card}>
      <p className={styles.farewellText}>Waving goodbye</p>
      <button className={styles.waveButton} onClick={() => onWaved?.()}>Wave</button>
    </div>
  );
}
`;

describe('the fixture pair (COMPONENT-OUTPUTS-TARGET §3)', () => {
  test('FarewellCard.tsx matches the hand-written target', () => {
    expect(app.files['src/components/FarewellCard.tsx']).toBe(GOLDEN_FAREWELL);
  });

  test('the parent passes the compiled action as the callback prop', () => {
    expect(app.files['src/pages/Home.tsx']).toContain(`<FarewellCard onWaved={() => navigate('/mood')} />`);
  });

  test('nothing on the grown fixture is dropped', () => {
    expect(app.notes).toEqual([
      'App: router shell — emitted as src/App.tsx by the scaffold',
      'Components/GreetingCard: wire greet-state:value-Draft->greet-draft:startValue: property "Draft" reads its boot value — no wire writes it (a runtime script would) — rendered as the empty/omitted form'
    ]);
  });

  test('the outputs node and the parent-side RouterNavigate both count translated', () => {
    const plan = planProject(ir, index);
    const farewell = plan.byLegacyPath.get('/Components/FarewellCard')!;
    expect(farewell.dispositions['farewellOutputs']).toEqual({ kind: 'static' });
    const home = plan.byLegacyPath.get('/Pages/Home')!;
    expect(home.dispositions['goMood']).toEqual({ kind: 'collapsed', into: 'farewell' });
  });
});

describe('prop naming (§2)', () => {
  const interfaceOf = (ports: Array<{ name: string; kind?: 'signal' | 'value' }>, inputNames: string[] = []) => {
    const component: ComponentIR = {
      path: 'Components/Probe',
      role: 'component',
      nodes: [
        {
          id: 'ins',
          type: 'Component Inputs',
          catalogRef: 'Component Inputs',
          parameters: [],
          declaredPorts: inputNames.map((name) => ({ name, plug: 'output', kind: 'value' })),
          portKnowledge: 'complete'
        },
        {
          id: 'outs',
          type: 'Component Outputs',
          catalogRef: 'Component Outputs',
          parameters: [],
          declaredPorts: ports.map((p) => ({ name: p.name, plug: 'input', kind: p.kind ?? 'signal' })),
          portKnowledge: 'complete'
        }
      ],
      connections: [],
      intent: null
    } as unknown as ComponentIR;
    return componentOutputInterface(component);
  };

  test('a plain name earns the on-prefix; a spaced name PascalCases; an onX identifier is kept', () => {
    const result = interfaceOf([{ name: 'waved' }, { name: 'Filter Values Changed' }, { name: 'onClick' }]);
    expect(result.props).toEqual([
      { port: 'waved', prop: 'onWaved' },
      { port: 'Filter Values Changed', prop: 'onFilterValuesChanged' },
      { port: 'onClick', prop: 'onClick' }
    ]);
    expect(result.failed).toEqual([]);
  });

  test('a collision with an input prop fails the port instead of renaming it', () => {
    const result = interfaceOf([{ name: 'waved' }], ['onWaved']);
    expect(result.props).toEqual([]);
    expect(result.failed[0].reason).toContain('would collide with prop "onWaved"');
  });

  test('two outputs mangling to one prop keep the first and fail the second', () => {
    const result = interfaceOf([{ name: 'waved' }, { name: 'Waved' }]);
    expect(result.props).toEqual([{ port: 'waved', prop: 'onWaved' }]);
    expect(result.failed[0].port).toBe('Waved');
  });

  test('a value port never becomes a prop — it is recorded for the component-state slice', () => {
    const result = interfaceOf([{ name: 'count', kind: 'value' }, { name: 'waved' }]);
    expect(result.valuePorts).toEqual(['count']);
    expect(result.props).toEqual([{ port: 'waved', prop: 'onWaved' }]);
  });
});

describe('child-side shapes (§4)', () => {
  test('an unfed declared signal port still declares its prop, and nothing calls it', () => {
    const mutated = cloneIr();
    nodeOf(mutated, 'Components/FarewellCard', 'farewellOutputs').declaredPorts.push({
      name: 'ignored',
      plug: 'input',
      kind: 'signal'
    });
    const result = emitApp(mutated, catalog);
    const card = result.files['src/components/FarewellCard.tsx'];
    expect(card).toContain('onIgnored?: () => void;');
    expect(card).not.toContain('onIgnored?.()');
  });

  test('a receiver-fired output calls the callback from the useSignal handler', () => {
    const mutated = cloneIr();
    componentOf(mutated, 'Components/FarewellCard').nodes.push({
      id: 'onCelebrate',
      type: 'Event Receiver',
      catalogRef: 'Event Receiver',
      parameters: [{ name: 'channelName', value: { kind: 'literal', value: 'celebrate' } }],
      declaredPorts: [],
      portKnowledge: 'partial'
    });
    wire(mutated, 'Components/FarewellCard', 'onCelebrate', 'eventReceived', 'farewellOutputs', 'waved');
    const card = emitApp(mutated, catalog).files['src/components/FarewellCard.tsx'];
    expect(card).toContain('useSignal(celebrate, () => {');
    expect(card).toContain('onWaved?.();');
  });

  test('two outputs fired by one click share the handler', () => {
    const mutated = cloneIr();
    nodeOf(mutated, 'Components/FarewellCard', 'farewellOutputs').declaredPorts.push({
      name: 'left',
      plug: 'input',
      kind: 'signal'
    });
    wire(mutated, 'Components/FarewellCard', 'waveButton', 'onClick', 'farewellOutputs', 'left');
    const card = emitApp(mutated, catalog).files['src/components/FarewellCard.tsx'];
    expect(card).toContain('onClick={() => { onWaved?.(); onLeft?.(); }}');
  });

  test('a Condition arm fires the callback inside the branch', () => {
    const mutated = cloneIr();
    componentOf(mutated, 'Components/FarewellCard').nodes.push({
      id: 'gate',
      type: 'Condition',
      catalogRef: 'Condition',
      parameters: [
        { name: 'condition', value: { kind: 'literal', value: true } },
        { name: 'runOnChange-condition', value: { kind: 'literal', value: false } }
      ],
      declaredPorts: [],
      portKnowledge: 'partial'
    });
    unwire(mutated, 'Components/FarewellCard', 'waveButton:onClick->farewellOutputs:waved');
    wire(mutated, 'Components/FarewellCard', 'waveButton', 'onClick', 'gate', 'eval');
    wire(mutated, 'Components/FarewellCard', 'gate', 'ontrue', 'farewellOutputs', 'waved');
    const card = emitApp(mutated, catalog).files['src/components/FarewellCard.tsx'];
    expect(card).toContain('if (true) onWaved?.();');
  });

  test('a wire into a value port drops named, and the good port keeps firing (the mixed rule)', () => {
    const mutated = cloneIr();
    nodeOf(mutated, 'Components/FarewellCard', 'farewellOutputs').declaredPorts.push({
      name: 'count',
      plug: 'input',
      kind: 'value'
    });
    wire(mutated, 'Components/FarewellCard', 'waveButton', 'onClick', 'farewellOutputs', 'count');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain(
      'value output "count" is fed by net.noodl.controls.button — no statically known source in the emit vocabulary'
    );
    expect(result.files['src/components/FarewellCard.tsx']).toContain('onClick={() => onWaved?.()}');
    const plan = planProject(mutated, index);
    const disposition = plan.byLegacyPath.get('/Components/FarewellCard')!.dispositions['farewellOutputs'];
    expect(disposition.kind).toBe('deferred');
  });

  /**
   * 🔴 The sentence this test used to assert — "which row fired is not statically expressible" —
   * was wrong about the runtime and about the emitted code, and it hid a silent loss for ten
   * sessions (EXP-011 §29). A *relayed row* signal now translates; what still defers is a port
   * that is not a relayed row signal at all, and `waved` (unprefixed) is exactly that: the
   * runtime registers a row's relay as `itemOutputSignal-waved`, so a bare `waved` on a repeater
   * can only be one of its own pulses.
   */
  test('a repeater port that is not a relayed row signal defers named', () => {
    const mutated = cloneIr();
    componentOf(mutated, 'Components/FarewellCard').nodes.push({
      id: 'rows',
      type: 'For Each',
      catalogRef: 'For Each',
      parameters: [],
      declaredPorts: [],
      portKnowledge: 'partial'
    });
    wire(mutated, 'Components/FarewellCard', 'rows', 'waved', 'farewellOutputs', 'waved', 'value');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain("is not a row's relayed signal");
    expect(result.notes.join('\n')).toContain('itemOutputSignal-<name>');
  });

  test('a wire into a port nothing declares drops alone — the node stays translated', () => {
    const mutated = cloneIr();
    wire(mutated, 'Components/FarewellCard', 'waveButton', 'onClick', 'farewellOutputs', 'ghost');
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('no Component Outputs declaration names port "ghost"');
    const plan = planProject(mutated, index);
    expect(plan.byLegacyPath.get('/Components/FarewellCard')!.dispositions['farewellOutputs']).toEqual({
      kind: 'static'
    });
  });
});

describe('parent-side shapes (§5)', () => {
  test('a collided output never reaches the parent: the sink defers instead of guessing a prop', () => {
    const mutated = cloneIr();
    componentOf(mutated, 'Components/FarewellCard').nodes.push({
      id: 'ins',
      type: 'Component Inputs',
      catalogRef: 'Component Inputs',
      parameters: [],
      declaredPorts: [{ name: 'onWaved', plug: 'output', kind: 'value' }],
      portKnowledge: 'complete'
    });
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Home.tsx']).not.toContain('onWaved={');
    expect(result.notes.join('\n')).toContain('would collide with prop "onWaved"');
    expect(result.notes.join('\n')).toContain('trigger is not a rendered element event or a receiver');
  });

  test('an instance value output into a trigger port is not a signal — the sink defers', () => {
    const mutated = cloneIr();
    const outs = nodeOf(mutated, 'Components/FarewellCard', 'farewellOutputs');
    outs.declaredPorts.find((p) => p.name === 'waved')!.kind = 'value';
    unwire(mutated, 'Components/FarewellCard', 'waveButton:onClick->farewellOutputs:waved');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Home.tsx']).not.toContain('FarewellCard onWaved');
    expect(result.notes.join('\n')).toContain(
      'feeds an unrendered sink — lifted values land only in rendered sinks in this slice'
    );
  });
});
