import * as fs from 'fs';
import * as path from 'path';

import { Catalog, CatalogIndex, loadCatalog } from '../src/catalog';
import { CHILD_SLOT_TYPE, ComponentPlan, chooseChildSlot, planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { summarizePreflight } from '../src/emit/preflight';
import { exportBadgeOf, ledgerEntryOf } from '../src/ledger';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ComponentIR, ExportIR, NodeIR } from '../src/ir/types';

/**
 * EXP-011 §51 — `Component Children` (Tier 2.8 row 1).
 *
 * The runtime never creates a node for the marker: `nodescope.ts:217` makes its parent the
 * instance's child root, and `componentinstance.ts` `setChildRoot` inserts the instance's placed
 * children into that parent at the marker's index, in order. That is React's `children`, rendered
 * where the marker sits — so the wrapper declares `children?: ReactNode`, renders `{children}` at the
 * marker, and an instance passes its placed children as JSX children.
 *
 * Measured before the build (probe14-reverted.log): the placed children were dispositioned `static`,
 * listed under their instance in `childrenOf`, and never emitted — no note, no marker. The wrapper's
 * marker was refused as a visual with no generator.
 *
 * §A the wrapper · §B the instance · §C a target with no marker · §D–§G the marker's corner cases,
 * each by the runtime's own rule · §H the ledger and the pre-flight · §I the fixture typechecks.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'slot-desk');
const catalog: Catalog = loadCatalog();
const index = new CatalogIndex(catalog);
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);

const PANEL = 'Components/Panel';
const PLAIN = 'Components/Plain';
const HOME = 'Pages/Home';
const PANEL_FILE = 'src/components/Panel.tsx';
const HOME_FILE = 'src/pages/Home.tsx';

const cloneIr = (): ExportIR => structuredClone(baseIr);
const componentOf = (source: ExportIR, componentPath: string): ComponentIR =>
  source.components.find((c) => c.path === componentPath)!;
const nodeOf = (source: ExportIR, componentPath: string, id: string): NodeIR =>
  componentOf(source, componentPath).nodes.find((n) => n.id === id)!;
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
const detach = (source: ExportIR, componentPath: string, id: string) => {
  const node = nodeOf(source, componentPath, id);
  const parent = node.parent === undefined ? undefined : nodeOf(source, componentPath, node.parent);
  if (parent) parent.children = (parent.children ?? []).filter((c) => c !== id);
  delete node.parent;
};
const textNode = (id: string, text: string): Partial<NodeIR> & { id: string; type: string } => ({
  id,
  type: 'Text',
  parameters: [{ name: 'text', value: { kind: 'literal', value: text } }]
});
const planOf = (source: ExportIR, componentPath: string): ComponentPlan =>
  planProject(source, index).plans.find((p) => p.path === componentPath)!;
const dispositionOf = (source: ExportIR, componentPath: string, id: string) =>
  planOf(source, componentPath).dispositions[id] as { kind: string; reason?: string };
const notesOf = (built: ReturnType<typeof emitApp>, componentPath: string): string =>
  built.report.components.find((c) => c.path === componentPath)!.notes.join('\n');
const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

const GOLDEN_PANEL = `// @nodegx:generated (visual — provenance markers complete in EXP-007)
import { ReactNode } from 'react';

import styles from './Panel.module.css';

export interface PanelProps {
  Title?: string;
  children?: ReactNode;
}

/** Panel. */
export function Panel({ Title, children }: PanelProps) {
  return (
    <div className={styles.panelRoot}>
      <p className={styles.panel}>{Title}</p>
      {children}
      <p className={styles.panel}>— end of panel —</p>
    </div>
  );
}
`;

const GOLDEN_HOME = `// @nodegx:generated (visual — provenance markers complete in EXP-007)
import { Panel } from '../components/Panel';
import { Plain } from '../components/Plain';
import styles from './Home.module.css';

/** Home. */
export function HomePage() {
  return (
    <div className={styles.page}>
      <title>Slot Desk</title>

      <p className={styles.headline}>Slot Desk</p>

      <Panel Title="Today">
        <p className={styles.hello}>Hello there</p>
        <button>Continue</button>
      </Panel>

      <Plain>
        {/* TODO(export): Text — node orphan sits here in the
            graph and did not render. placed under instance bare of /Components/Plain, which has no Component Children node inside its tree — the running app never draws it either.
            See the export report. */}
      </Plain>
    </div>
  );
}
`;

// ---------------------------------------------------------------------------------------------
// §A — the wrapper: `children?: ReactNode`, `{children}` where the marker sits, once.
// ---------------------------------------------------------------------------------------------
describe('§A the wrapper renders {children} where its Component Children sits', () => {
  test('Panel.tsx matches the hand-written target', () => {
    expect(app.files[PANEL_FILE]).toBe(GOLDEN_PANEL);
  });

  test('{children} appears exactly once, between the title and the footer', () => {
    const file = app.files[PANEL_FILE];
    expect(count(file, '{children}')).toBe(1);
    const title = file.indexOf('{Title}</p>');
    const slot = file.indexOf('{children}');
    const footer = file.indexOf('— end of panel —');
    expect(title).toBeGreaterThan(-1);
    expect(slot).toBeGreaterThan(title);
    expect(footer).toBeGreaterThan(slot);
  });

  test('the plan: role slot, disposition static, childSlot named, no note on the wrapper', () => {
    const plan = planOf(baseIr, PANEL);
    expect(plan.childSlot).toBe('panel-slot');
    expect(plan.roleOf['panel-slot']).toBe('slot');
    expect(plan.dispositions['panel-slot']).toEqual({ kind: 'static' });
    expect(plan.childrenOf['panel-root']).toEqual(['panel-title', 'panel-slot', 'panel-footer']);
    expect(notesOf(app, PANEL)).toBe('');
  });

  test('a wrapper with no marker declares no children prop (control)', () => {
    expect(app.files['src/components/Plain.tsx']).not.toContain('children');
    expect(planOf(baseIr, PLAIN).childSlot).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------------
// §B — the instance passes its placed children, in order, as JSX children.
// ---------------------------------------------------------------------------------------------
describe('§B the instance passes its placed children', () => {
  test('Home.tsx matches the hand-written target', () => {
    expect(app.files[HOME_FILE]).toBe(GOLDEN_HOME);
  });

  test('both children sit inside <Panel>…</Panel>, in graph order, each once', () => {
    const file = app.files[HOME_FILE];
    const open = file.indexOf('<Panel Title="Today">');
    const close = file.indexOf('</Panel>');
    const hello = file.indexOf('Hello there');
    const cta = file.indexOf('>Continue</button>');
    expect(open).toBeGreaterThan(-1);
    expect(hello).toBeGreaterThan(open);
    expect(cta).toBeGreaterThan(hello);
    expect(close).toBeGreaterThan(cta);
    expect(count(file, 'Hello there')).toBe(1);
    expect(count(file, 'Continue')).toBe(1);
    expect(file).not.toContain('<Panel Title="Today" />');
  });

  test('reversing the placed order reverses the emitted order', () => {
    const mutated = cloneIr();
    nodeOf(mutated, HOME, 'panel').children = ['cta', 'hello'];
    const file = emitApp(mutated, catalog).files[HOME_FILE];
    expect(file.indexOf('>Continue</button>')).toBeLessThan(file.indexOf('Hello there'));
  });

  test('the children keep their static dispositions and their place under the instance', () => {
    const plan = planOf(baseIr, HOME);
    expect(plan.childrenOf['panel']).toEqual(['hello', 'cta']);
    expect(plan.dispositions['hello']).toEqual({ kind: 'static' });
    expect(plan.dispositions['cta']).toEqual({ kind: 'static' });
  });
});

// ---------------------------------------------------------------------------------------------
// §C — a target with no marker never draws the placed children (componentinstance.ts: no child
// root is ever set). Dropped with a note and a marker inside the element, never silently.
// ---------------------------------------------------------------------------------------------
describe('§C a target with no Component Children drops the placed children, marked', () => {
  test('the orphan is deferred with the reason, noted, and marked inside <Plain>', () => {
    expect(dispositionOf(baseIr, HOME, 'orphan')).toEqual({
      kind: 'deferred',
      to: 'EXP-003',
      reason:
        'placed under instance bare of /Components/Plain, which has no Component Children node inside its tree — the running app never draws it either'
    });
    expect(notesOf(app, HOME)).toContain('node orphan (Text) deferred: placed under instance bare of /Components/Plain');
    const file = app.files[HOME_FILE];
    expect(file).not.toContain('Never drawn');
    const open = file.indexOf('<Plain>');
    const marker = file.indexOf('node orphan sits here');
    expect(open).toBeGreaterThan(-1);
    expect(marker).toBeGreaterThan(open);
    expect(file.indexOf('</Plain>')).toBeGreaterThan(marker);
    expect(planOf(baseIr, HOME).childrenOf['bare']).toEqual([]);
  });

  test('a subtree under such an instance is named all the way down, with one marker', () => {
    const mutated = cloneIr();
    addChild(mutated, HOME, 'bare', { id: 'nest', type: 'Group' });
    addChild(mutated, HOME, 'nest', textNode('deep', 'Deeper'));
    const built = emitApp(mutated, catalog);
    expect(dispositionOf(mutated, HOME, 'nest').reason).toContain('has no Component Children node inside its tree');
    expect(dispositionOf(mutated, HOME, 'deep')).toEqual({ kind: 'deferred', to: 'EXP-003', reason: 'inside nest, which is not drawn' });
    const notes = notesOf(built, HOME);
    expect(notes).toContain('node nest (Group) deferred:');
    expect(notes).toContain('node deep (Text) deferred: inside nest, which is not drawn');
    expect(count(built.files[HOME_FILE], 'sits here')).toBe(2); // orphan and nest; deep is inside nest
    expect(built.files[HOME_FILE]).not.toContain('Deeper');
  });

  test('an instance whose target cannot be resolved says so', () => {
    const mutated = cloneIr();
    addChild(mutated, HOME, 'shell', { id: 'ghost', type: '/Components/Ghost' });
    addChild(mutated, HOME, 'ghost', textNode('haunt', 'Boo'));
    expect(dispositionOf(mutated, HOME, 'haunt').reason).toBe('placed under instance ghost of /Components/Ghost, which could not be resolved');
  });
});

// ---------------------------------------------------------------------------------------------
// §D–§G — the marker's corner cases, each by the runtime's rule (nodescope.ts:217, setChildRoot).
// ---------------------------------------------------------------------------------------------
describe('§D a parentless marker sets no child root', () => {
  test('the wrapper takes no children; the marker is refused; the instance children are dropped', () => {
    const mutated = cloneIr();
    detach(mutated, PANEL, 'panel-slot');
    const built = emitApp(mutated, catalog);
    expect(chooseChildSlot(componentOf(mutated, PANEL))).toBeNull();
    expect(planOf(mutated, PANEL).childSlot).toBeUndefined();
    expect(built.files[PANEL_FILE]).not.toContain('children');
    expect(dispositionOf(mutated, PANEL, 'panel-slot').reason).toBe(
      "a Component Children with no parent has nowhere to insert an instance's children — the runtime ignores it"
    );
    expect(notesOf(built, PANEL)).toContain('node panel-slot (Component Children) deferred: a Component Children with no parent');
    expect(dispositionOf(mutated, HOME, 'hello').reason).toContain('/Components/Panel, which has no Component Children node inside its tree');
    expect(built.files[HOME_FILE]).toContain('<Panel Title="Today">');
    expect(built.files[HOME_FILE]).not.toContain('Hello there');
    expect(typecheckEmittedApp(built)).toEqual([]);
  });
});

describe('§E two markers under one parent — the first is the position (getChildRootIndex)', () => {
  test('one {children}, at the first marker; the second is refused, naming the first', () => {
    const mutated = cloneIr();
    addChild(mutated, PANEL, 'panel-root', { id: 'panel-slot2', type: CHILD_SLOT_TYPE });
    const built = emitApp(mutated, catalog);
    expect(chooseChildSlot(componentOf(mutated, PANEL))).toEqual({ nodeId: 'panel-slot', parentId: 'panel-root' });
    const file = built.files[PANEL_FILE];
    expect(count(file, '{children}')).toBe(1);
    expect(file.indexOf('{children}')).toBeLessThan(file.indexOf('— end of panel —'));
    expect(dispositionOf(mutated, PANEL, 'panel-slot2').reason).toBe(
      "the runtime inserts an instance's children at one Component Children only — here that is panel-slot in panel-root, so this one draws nothing"
    );
    expect(file).toContain('node panel-slot2 sits here');
    expect(typecheckEmittedApp(built)).toEqual([]);
  });
});

describe('§F two markers under different parents — the last marker\'s parent wins (setChildRoot runs per node)', () => {
  test('{children} moves into the later parent; the earlier marker is refused', () => {
    const mutated = cloneIr();
    addChild(mutated, PANEL, 'panel-root', { id: 'panel-box', type: 'Group' });
    addChild(mutated, PANEL, 'panel-box', { id: 'panel-slot2', type: CHILD_SLOT_TYPE });
    const built = emitApp(mutated, catalog);
    expect(chooseChildSlot(componentOf(mutated, PANEL))).toEqual({ nodeId: 'panel-slot2', parentId: 'panel-box' });
    expect(planOf(mutated, PANEL).childSlot).toBe('panel-slot2');
    const file = built.files[PANEL_FILE];
    expect(count(file, '{children}')).toBe(1);
    expect(file.indexOf('{children}')).toBeGreaterThan(file.indexOf('— end of panel —'));
    expect(dispositionOf(mutated, PANEL, 'panel-slot').reason).toContain('here that is panel-slot2 in panel-box');
    expect(typecheckEmittedApp(built)).toEqual([]);
  });
});

describe('§G the honoured marker sits below a node that never draws', () => {
  test('the prop is declared, nothing renders it, and the instance still passes children — as the runtime inserts into an undrawn root', () => {
    const mutated = cloneIr();
    addNode(mutated, PANEL, { id: 'panel-extra', type: 'Group' });
    addChild(mutated, PANEL, 'panel-extra', { id: 'panel-slot2', type: CHILD_SLOT_TYPE });
    componentOf(mutated, PANEL).visualRoots = ['panel-root', 'panel-extra'];
    const built = emitApp(mutated, catalog);
    const plan = planOf(mutated, PANEL);
    expect(plan.childSlot).toBe('panel-slot2');
    expect(plan.roleOf['panel-slot2']).toBeUndefined();
    const file = built.files[PANEL_FILE];
    expect(file).toContain('children?: ReactNode;');
    expect(file).not.toContain('{children}');
    expect(file).toContain('export function Panel({ Title }: PanelProps)');
    expect(dispositionOf(mutated, PANEL, 'panel-slot2').reason).toContain('detached from the node tree');
    expect(dispositionOf(mutated, PANEL, 'panel-slot').reason).toContain('here that is panel-slot2 in panel-extra');
    expect(built.files[HOME_FILE]).toContain('<Panel Title="Today">');
    expect(built.files[HOME_FILE]).toContain('Hello there');
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('a wrapper with no inputs and a marker still declares the prop and a signature that names it', () => {
    const mutated = cloneIr();
    addChild(mutated, PLAIN, 'plain-root', { id: 'plain-slot', type: CHILD_SLOT_TYPE });
    const built = emitApp(mutated, catalog);
    const file = built.files['src/components/Plain.tsx'];
    expect(file).toContain('export interface PlainProps {\n  children?: ReactNode;\n}');
    expect(file).toContain('export function Plain({ children }: PlainProps)');
    expect(count(file, '{children}')).toBe(1);
    expect(built.files[HOME_FILE]).toContain('Never drawn');
    expect(built.files[HOME_FILE]).not.toContain('node orphan sits here');
    expect(typecheckEmittedApp(built)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// §H — the ledger and the pre-flight.
// ---------------------------------------------------------------------------------------------
describe('§H the ledger and the pre-flight', () => {
  test('the ledger row is translated, so the editor badge is gone by itself', () => {
    expect(ledgerEntryOf(CHILD_SLOT_TYPE)?.status).toBe('translated');
    expect(exportBadgeOf(CHILD_SLOT_TYPE)).toBeUndefined();
  });

  test('the pre-flight counts one refusal — the orphan — and none on either wrapper', () => {
    const summary = summarizePreflight(app);
    expect(summary.refusals).toBe(1);
    expect(summary.attention.map((a) => [a.path, a.refusals])).toEqual([[HOME, 1]]);
  });
});

// ---------------------------------------------------------------------------------------------
// §I — the fixture, whole, typechecks as a real program.
// ---------------------------------------------------------------------------------------------
describe('§I the emitted app typechecks', () => {
  test('slot-desk, unmodified', () => {
    expect(typecheckEmittedApp(app)).toEqual([]);
  });
});
