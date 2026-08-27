import * as fs from 'fs';
import * as path from 'path';

import { Catalog, CatalogIndex } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { planProject } from '../src/analyze/plan';
import { ComponentIR, ExportIR, NodeIR } from '../src/ir/types';

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const index = new CatalogIndex(catalog);
const ir = parseProject(FIXTURE, catalog);
const app = emitApp(ir, catalog);

const CARD = 'Components/GreetingCard';
const CARD_LEGACY = '/Components/GreetingCard';

const cloneIr = (): ExportIR => structuredClone(ir);
const componentOf = (source: ExportIR, componentPath: string): ComponentIR =>
  source.components.find((c) => c.path === componentPath)!;
const nodeOf = (source: ExportIR, componentPath: string, id: string): NodeIR =>
  componentOf(source, componentPath).nodes.find((n) => n.id === id)!;
const setParam = (node: NodeIR, name: string, value: string | number | boolean) => {
  node.parameters = node.parameters.filter((p) => p.name !== name);
  node.parameters.push({ name, value: { kind: 'literal', value } });
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
const unwire = (source: ExportIR, componentPath: string, key: string) => {
  const component = componentOf(source, componentPath);
  component.connections = component.connections.filter((c) => c.key !== key);
};
const addNode = (source: ExportIR, componentPath: string, node: Partial<NodeIR> & { id: string; type: string }) => {
  componentOf(source, componentPath).nodes.push({
    catalogRef: node.type.startsWith('/') ? null : node.type,
    parameters: [],
    declaredPorts: [],
    portKnowledge: 'partial',
    ...node
  } as NodeIR);
};
const addChild = (source: ExportIR, componentPath: string, parentId: string, node: Partial<NodeIR> & { id: string; type: string }) => {
  addNode(source, componentPath, { ...node, parent: parentId });
  const parent = nodeOf(source, componentPath, parentId);
  parent.children = [...(parent.children ?? []), node.id];
};
const cardDisposition = (source: ExportIR) =>
  planProject(source, index).byLegacyPath.get(CARD_LEGACY)!.dispositions['greet-state'] as {
    kind: string;
    reason?: string;
  };

// ---------------------------------------------------------------------------------------------
// Session 12 (COMPONENT-OBJECT-TARGET): the record compiles away. Every statically-visible
// write is a continuous mirror (value-X has no trigger), so a single-writer property reads its
// writer's source and an unwritten one reads its boot value, `undefined`. The node's verdict is
// strict-mixed — the Component Outputs precedent.
// ---------------------------------------------------------------------------------------------

const GOLDEN_GREETING_CARD = `// @nodegx:generated (visual — provenance markers complete in EXP-007)
import styles from './GreetingCard.module.css';

export interface GreetingCardProps {
  Name?: string;
}

/** Card. */
export function GreetingCard({ Name }: GreetingCardProps) {
  return (
    <div className={styles.greetRoot}>
      <p className={styles.greetName}>{Name}</p>
      <input placeholder="Write a note" />
    </div>
  );
}
`;

describe('the record compiles away (COMPONENT-OBJECT-TARGET §3)', () => {
  test('GreetingCard.tsx matches the hand-written target: mirror reads the prop, boot value omits the attr', () => {
    expect(app.files['src/components/GreetingCard.tsx']).toBe(GOLDEN_GREETING_CARD);
  });

  test('no state, no hooks: the record leaves nothing behind', () => {
    const tsx = app.files['src/components/GreetingCard.tsx'];
    expect(tsx).not.toContain('useState');
    expect(tsx).not.toContain('useEffect');
  });

  test('the Component Object node collapses into the component file', () => {
    const plan = planProject(ir, index).byLegacyPath.get(CARD_LEGACY)!;
    expect(plan.dispositions['greet-state']).toEqual({ kind: 'collapsed', into: 'src/components/GreetingCard.tsx' });
  });

  test('the boot-value read is reported, never silent', () => {
    expect(app.notes.some((n) => n.includes('property "Draft" reads its boot value'))).toBe(true);
  });

  test('a handler read aliases through the record: .set(Name), no record in sight', () => {
    const mutated = cloneIr();
    addChild(mutated, CARD, 'greet-root', { id: 'gc-button', type: 'net.noodl.controls.button' });
    setParam(nodeOf(mutated, CARD, 'gc-button'), 'label', 'Save');
    addNode(mutated, CARD, { id: 'gc-set', type: 'Set Variable' });
    setParam(nodeOf(mutated, CARD, 'gc-set'), 'name', 'visitorName');
    wire(mutated, CARD, 'gc-button', 'onClick', 'gc-set', 'do', 'signal');
    wire(mutated, CARD, 'greet-state', 'value-DisplayName', 'gc-set', 'value');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/components/GreetingCard.tsx']).toContain('onClick={() => visitorName.set(Name)}');
    expect(cardDisposition(mutated).kind).toBe('collapsed');
  });

  test("a format placeholder fed a boot value substitutes the runtime's ''", () => {
    const mutated = cloneIr();
    unwire(mutated, CARD, 'greet-state:value-DisplayName->greet-name:text');
    addNode(mutated, CARD, { id: 'gc-fmt', type: 'String Format' });
    setParam(nodeOf(mutated, CARD, 'gc-fmt'), 'format', 'Draft: {d}');
    wire(mutated, CARD, 'greet-state', 'value-Draft', 'gc-fmt', 'd');
    wire(mutated, CARD, 'gc-fmt', 'formatted', 'greet-name', 'text');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/components/GreetingCard.tsx']).toContain('Draft:');
    expect(result.files['src/components/GreetingCard.tsx']).not.toContain('undefined');
    // The dead mirror is elided with a note; the node still collapses (§5).
    expect(cardDisposition(mutated).kind).toBe('collapsed');
    expect(result.notes.some((n) => n.includes('mirrors into property "DisplayName", which nothing reads'))).toBe(true);
  });

  test("enabled ← boot value is the runtime's own !!undefined: statically disabled", () => {
    const mutated = cloneIr();
    wire(mutated, CARD, 'greet-state', 'value-Draft', 'greet-draft', 'enabled');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/components/GreetingCard.tsx']).toContain('<input placeholder="Write a note" disabled />');
    expect(cardDisposition(mutated).kind).toBe('collapsed');
  });
});

describe('the node gates (COMPONENT-OBJECT-TARGET §4)', () => {
  test('a consumed changed-X signal defers: signal-on-write is the component-state slice', () => {
    const mutated = cloneIr();
    wire(mutated, CARD, 'greet-state', 'changed-DisplayName', 'greet-name', 'text');
    const disposition = cardDisposition(mutated);
    expect(disposition.kind).toBe('deferred');
    expect(disposition.reason).toContain('changed-DisplayName');
  });

  test('Run On Value Change unticked defers: the outputs freeze between Fetch pulses', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, CARD, 'greet-state'), 'runOnChange-object', false);
    const disposition = cardDisposition(mutated);
    expect(disposition.kind).toBe('deferred');
    expect(disposition.reason).toContain('Run On Value Change');
  });

  test('a wired Fetch defers: batch republish is signal semantics', () => {
    const mutated = cloneIr();
    wire(mutated, CARD, 'greet-inputs', 'Name', 'greet-state', 'fetch', 'signal');
    const disposition = cardDisposition(mutated);
    expect(disposition.kind).toBe('deferred');
    expect(disposition.reason).toContain('Fetch');
  });

  test('two Component Object nodes share one record — both defer', () => {
    const mutated = cloneIr();
    addNode(mutated, CARD, { id: 'gc-state2', type: 'net.noodl.ComponentObject' });
    setParam(nodeOf(mutated, CARD, 'gc-state2'), 'properties', 'Other');
    const plan = planProject(mutated, index).byLegacyPath.get(CARD_LEGACY)!;
    expect((plan.dispositions['greet-state'] as { reason: string }).reason).toContain('two Component Object nodes');
    expect((plan.dispositions['gc-state2'] as { reason: string }).reason).toContain('two Component Object nodes');
  });

  test('a Set Component Object Properties beside it defers: an imperative writer of the same record', () => {
    const mutated = cloneIr();
    addNode(mutated, CARD, { id: 'gc-setprops', type: 'net.noodl.SetComponentObjectProperties' });
    const disposition = cardDisposition(mutated);
    expect(disposition.kind).toBe('deferred');
    expect(disposition.reason).toContain('Set Component Object Properties');
  });

  test('a descendant with Parent Component Object defers: the walk reaches this record from below', () => {
    const mutated = cloneIr();
    addChild(mutated, CARD, 'greet-root', { id: 'gc-badge', type: '/Components/GreetingBadge' });
    addNode(mutated, 'Components/GreetingBadge', { id: 'badge-pco', type: 'net.noodl.ParentComponentObject' });
    const disposition = cardDisposition(mutated);
    expect(disposition.kind).toBe('deferred');
    expect(disposition.reason).toContain('Parent Component Object');
  });
});

describe('strict-mixed, the Component Outputs precedent (COMPONENT-OBJECT-TARGET §5)', () => {
  test('two writers on one property defer: last-writer-wins is not statically ordered', () => {
    const mutated = cloneIr();
    wire(mutated, CARD, 'greet-state', 'value-Draft', 'greet-state', 'value-DisplayName');
    const disposition = cardDisposition(mutated);
    expect(disposition.kind).toBe('deferred');
    expect(disposition.reason).toContain('two wires write property "DisplayName"');
  });

  test('a dotted property defers: the record would path-resolve it', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, CARD, 'greet-state'), 'properties', 'DisplayName,Draft,user.name');
    unwire(mutated, CARD, 'greet-state:value-DisplayName->greet-name:text');
    wire(mutated, CARD, 'greet-state', 'value-user.name', 'greet-name', 'text');
    const disposition = cardDisposition(mutated);
    expect(disposition.kind).toBe('deferred');
    expect(disposition.reason).toContain('dotted path');
  });

  test('a self-mirror is a wire cycle, named as one', () => {
    const mutated = cloneIr();
    unwire(mutated, CARD, 'greet-inputs:Name->greet-state:value-DisplayName');
    wire(mutated, CARD, 'greet-state', 'value-DisplayName', 'greet-state', 'value-DisplayName');
    const disposition = cardDisposition(mutated);
    expect(disposition.kind).toBe('deferred');
    expect(disposition.reason).toContain('cycle');
  });

  test('an out-of-vocabulary sink defers the node; the good read keeps its behaviour', () => {
    const mutated = cloneIr();
    wire(mutated, CARD, 'greet-state', 'value-Draft', 'greet-root', 'marginLeft');
    const disposition = cardDisposition(mutated);
    expect(disposition.kind).toBe('deferred');
    expect(disposition.reason).toContain('Group.marginLeft');
    // Behaviour kept: the mirror still renders as the prop read.
    const result = emitApp(mutated, catalog);
    expect(result.files['src/components/GreetingCard.tsx']).toContain('{Name}');
  });

  test('a read into a deferred sink defers the node with that collateral named', () => {
    const mutated = cloneIr();
    addChild(mutated, CARD, 'greet-root', { id: 'gc-check', type: 'net.noodl.controls.checkbox' });
    wire(mutated, CARD, 'greet-state', 'value-Draft', 'gc-check', 'checked');
    const disposition = cardDisposition(mutated);
    expect(disposition.kind).toBe('deferred');
    expect(disposition.reason).toContain('itself deferred');
  });

  test('a mirror nothing reads is elided with a note; the node still collapses', () => {
    const mutated = cloneIr();
    unwire(mutated, CARD, 'greet-state:value-DisplayName->greet-name:text');
    const result = emitApp(mutated, catalog);
    expect(cardDisposition(mutated).kind).toBe('collapsed');
    expect(result.notes.some((n) => n.includes('mirrors into property "DisplayName", which nothing reads'))).toBe(true);
  });

  test('only written, never read: nothing observable, deferred honestly', () => {
    const mutated = cloneIr();
    unwire(mutated, CARD, 'greet-state:value-DisplayName->greet-name:text');
    unwire(mutated, CARD, 'greet-state:value-Draft->greet-draft:startValue');
    const disposition = cardDisposition(mutated);
    expect(disposition.kind).toBe('deferred');
    expect(disposition.reason).toContain('only written, never read');
  });
});
