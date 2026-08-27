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
// Session 11 (POPUPS-TARGET): a popup is parent-owned modal state — one useState slot per
// hosting component, a conditional createPortal render, and the reserved onClose prop on the
// popup component. The close side rides the instance-callback rail; everything the corpus does
// not exercise defers with a named reason.
// ---------------------------------------------------------------------------------------------

const GOLDEN_ABOUT_DIALOG = `// @nodegx:generated (visual — provenance markers complete in EXP-007)
import styles from './AboutDialog.module.css';

export interface AboutDialogProps {
  onClosed?: () => void;
  onClose?: (action?: string) => void;
}

/** Dialog. */
export function AboutDialog({ onClosed, onClose }: AboutDialogProps) {
  return (
    <div className={styles.aboutDialog}>
      <p className={styles.aboutTitle}>About Cheer</p>
      <p className={styles.aboutBody}>Cheer is a tiny place to collect good moments.</p>
      <button
        className={styles.aboutOkButton}
        onClick={() => {
          if (onClose) { onClose('ok'); onClosed?.(); };
        }}
      >
        OK
      </button>
    </div>
  );
}
`;

describe('the fixture pair (POPUPS-TARGET §6)', () => {
  test('AboutDialog.tsx matches the hand-written target', () => {
    expect(app.files['src/components/AboutDialog.tsx']).toBe(GOLDEN_ABOUT_DIALOG);
  });

  test('the hosting page owns the slot: state, handler, conditional portal, overlay class', () => {
    const home = app.files['src/pages/Home.tsx'];
    expect(home).toContain(`const [openPopup, setOpenPopup] = useState<'AboutDialog' | null>(null);`);
    expect(home).toContain(`onClick={() => setOpenPopup('AboutDialog')}`);
    expect(home).toContain(`{openPopup === 'AboutDialog' &&`);
    expect(home).toContain('createPortal(');
    expect(home).toContain(`<AboutDialog onClose={() => setOpenPopup(null)} />`);
    expect(home).toContain('document.body');
    expect(home).toContain(`import { createPortal } from 'react-dom';`);
    expect(app.files['src/pages/Home.module.css']).toContain('.popupLayer {\n  position: fixed;\n  inset: 0;\n}');
  });

  test('nothing on the grown fixture is dropped', () => {
    expect(app.notes).toEqual([
      'App: router shell — emitted as src/App.tsx by the scaffold',
      'Components/GreetingCard: wire greet-state:value-Draft->greet-draft:startValue: property "Draft" reads its boot value — no wire writes it (a runtime script would) — rendered as the empty/omitted form'
    ]);
  });

  test('both popup nodes collapse into their handler owners; the outputs node stays static', () => {
    const plan = planProject(ir, index);
    const home = plan.byLegacyPath.get('/Pages/Home')!;
    expect(home.dispositions['showAbout']).toEqual({ kind: 'collapsed', into: 'aboutButton' });
    expect(home.popups).toEqual([{ slotKey: 'AboutDialog', targetLegacy: '/Components/AboutDialog', params: [] }]);
    const dialog = plan.byLegacyPath.get('/Components/AboutDialog')!;
    expect(dialog.dispositions['aboutClose']).toEqual({ kind: 'collapsed', into: 'aboutOkButton' });
    expect(dialog.dispositions['aboutOutputs']).toEqual({ kind: 'static' });
    expect(dialog.closesPopup).toBe(true);
  });
});

describe('show side rulings (POPUPS-TARGET §3)', () => {
  test('a wired target defers named', () => {
    const mutated = cloneIr();
    wire(mutated, 'Pages/Home', 'visitorVar', 'value', 'showAbout', 'target', 'value');
    const plan = planProject(mutated, index);
    const disposition = plan.byLegacyPath.get('/Pages/Home')!.dispositions['showAbout'];
    expect(disposition).toEqual({
      kind: 'deferred',
      to: 'EXP-003',
      reason: 'target is wired — which component opens is not statically knowable'
    });
  });

  test('Show On Top defers — the slot is single', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Pages/Home', 'showAbout'), 'stackPolicy', 'stack');
    const plan = planProject(mutated, index);
    expect(plan.byLegacyPath.get('/Pages/Home')!.dispositions['showAbout'].kind).toBe('deferred');
    expect((plan.byLegacyPath.get('/Pages/Home')!.dispositions['showAbout'] as { reason: string }).reason).toContain(
      'Show On Top layers popups'
    );
  });

  test('a consumed close outcome defers the node — dispatch is future work', () => {
    const mutated = cloneIr();
    wire(mutated, 'Pages/Home', 'showAbout', 'Closed', 'goMood', 'navigate');
    const plan = planProject(mutated, index);
    const disposition = plan.byLegacyPath.get('/Pages/Home')!.dispositions['showAbout'] as { reason: string };
    expect(disposition.reason).toContain('its Closed output is consumed');
    expect(plan.byLegacyPath.get('/Pages/Home')!.popups).toEqual([]);
  });

  test('a page as target defers', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Pages/Home', 'showAbout'), 'target', '/Pages/Mood');
    const plan = planProject(mutated, index);
    expect((plan.byLegacyPath.get('/Pages/Home')!.dispositions['showAbout'] as { reason: string }).reason).toContain(
      'a page cannot open as a popup slot'
    );
  });

  test('a literal param the target declares becomes a prop; one it does not is dropped with a note', () => {
    const mutated = cloneIr();
    componentOf(mutated, 'Components/AboutDialog').nodes.push({
      id: 'aboutIns',
      type: 'Component Inputs',
      catalogRef: 'Component Inputs',
      parameters: [],
      declaredPorts: [{ name: 'title', plug: 'output', kind: 'value', type: 'string' }],
      portKnowledge: 'complete'
    });
    const show = nodeOf(mutated, 'Pages/Home', 'showAbout');
    setParam(show, 'popupParam-title', 'Hello');
    setParam(show, 'popupParam-ghost', 'nope');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Home.tsx']).toContain('<AboutDialog title="Hello" onClose={() => setOpenPopup(null)} />');
    expect(result.notes.join('\n')).toContain('param "ghost" names no input on /Components/AboutDialog');
  });

  test('a wired popup param defers — the runtime snapshots params at open', () => {
    const mutated = cloneIr();
    wire(mutated, 'Pages/Home', 'visitorVar', 'value', 'showAbout', 'popupParam-title', 'value');
    const plan = planProject(mutated, index);
    expect((plan.byLegacyPath.get('/Pages/Home')!.dispositions['showAbout'] as { reason: string }).reason).toContain(
      'snapshots params at open'
    );
  });

  test('two openers of one target share the slot: one render, two handlers', () => {
    const mutated = cloneIr();
    const home = componentOf(mutated, 'Pages/Home');
    home.nodes.push({
      id: 'aboutButton2',
      type: 'net.noodl.controls.button',
      catalogRef: 'net.noodl.controls.button',
      parameters: [{ name: 'label', value: { kind: 'literal', value: 'Also about' } }],
      declaredPorts: [],
      portKnowledge: 'complete',
      parent: 'shell'
    });
    nodeOf(mutated, 'Pages/Home', 'shell').children!.push('aboutButton2');
    home.nodes.push({
      id: 'showAbout2',
      type: 'NavigationShowPopup',
      catalogRef: 'NavigationShowPopup',
      parameters: [{ name: 'target', value: { kind: 'literal', value: '/Components/AboutDialog' } }],
      declaredPorts: [],
      portKnowledge: 'partial'
    });
    wire(mutated, 'Pages/Home', 'aboutButton2', 'onClick', 'showAbout2', 'show');
    const result = emitApp(mutated, catalog);
    const homeTsx = result.files['src/pages/Home.tsx'];
    expect(homeTsx.match(/setOpenPopup\('AboutDialog'\)/g)).toHaveLength(2);
    expect(homeTsx.match(/openPopup === 'AboutDialog'/g)).toHaveLength(1);
  });

  test('a second target grows the union and renders its own slot — closable only if it closes', () => {
    const mutated = cloneIr();
    const home = componentOf(mutated, 'Pages/Home');
    home.nodes.push({
      id: 'waveButton2',
      type: 'net.noodl.controls.button',
      catalogRef: 'net.noodl.controls.button',
      parameters: [{ name: 'label', value: { kind: 'literal', value: 'Farewell popup' } }],
      declaredPorts: [],
      portKnowledge: 'complete',
      parent: 'shell'
    });
    nodeOf(mutated, 'Pages/Home', 'shell').children!.push('waveButton2');
    home.nodes.push({
      id: 'showFarewell',
      type: 'NavigationShowPopup',
      catalogRef: 'NavigationShowPopup',
      parameters: [{ name: 'target', value: { kind: 'literal', value: '/Components/FarewellCard' } }],
      declaredPorts: [],
      portKnowledge: 'partial'
    });
    wire(mutated, 'Pages/Home', 'waveButton2', 'onClick', 'showFarewell', 'show');
    const homeTsx = emitApp(mutated, catalog).files['src/pages/Home.tsx'];
    expect(homeTsx).toContain(`useState<'AboutDialog' | 'FarewellCard' | null>(null)`);
    expect(homeTsx).toContain(`{openPopup === 'FarewellCard' &&`);
    // FarewellCard hosts no Close Popup: no onClose is passed — the popup never closes, which
    // is the runtime's behaviour for a popup without a close node.
    expect(homeTsx).toContain('<FarewellCard />');
  });

  test('an untranslatable trigger into show leaves the node deferred by the owner rules', () => {
    const mutated = cloneIr();
    unwire(mutated, 'Pages/Home', 'aboutButton:onClick->showAbout:show');
    wire(mutated, 'Pages/Home', 'visitorVar', 'value', 'showAbout', 'show');
    const plan = planProject(mutated, index);
    expect((plan.byLegacyPath.get('/Pages/Home')!.dispositions['showAbout'] as { reason: string }).reason).toContain(
      'not a rendered element event or a receiver'
    );
    expect(plan.byLegacyPath.get('/Pages/Home')!.popups).toEqual([]);
  });

  test('a compiled slot whose trigger never attaches leaves no state behind', () => {
    const mutated = cloneIr();
    unwire(mutated, 'Pages/Home', 'aboutButton:onClick->showAbout:show');
    const result = emitApp(mutated, catalog);
    expect(result.files['src/pages/Home.tsx']).not.toContain('openPopup');
    expect(result.files['src/pages/Home.tsx']).not.toContain('createPortal');
  });
});

describe('close side rulings (POPUPS-TARGET §4)', () => {
  test('the plain Close carries no action and still gates the done-chain', () => {
    const mutated = cloneIr();
    unwire(mutated, 'Components/AboutDialog', 'aboutOkButton:onClick->aboutClose:closeAction-ok');
    wire(mutated, 'Components/AboutDialog', 'aboutOkButton', 'onClick', 'aboutClose', 'close');
    const dialog = emitApp(mutated, catalog).files['src/components/AboutDialog.tsx'];
    expect(dialog).toContain('if (onClose) { onClose(); onClosed?.(); };');
  });

  test('with no done-chain the gate collapses to the optional call', () => {
    const mutated = cloneIr();
    unwire(mutated, 'Components/AboutDialog', 'aboutClose:done->aboutOutputs:closed');
    const dialog = emitApp(mutated, catalog).files['src/components/AboutDialog.tsx'];
    expect(dialog).toContain(`onClick={() => onClose?.('ok')}`);
  });

  test('declared results defer — close results are value outputs', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Components/AboutDialog', 'aboutClose'), 'results', 'chosen');
    const plan = planProject(mutated, index);
    const disposition = plan.byLegacyPath.get('/Components/AboutDialog')!.dispositions['aboutClose'] as {
      reason: string;
    };
    expect(disposition.reason).toContain('close results are value outputs');
  });

  test('a named Popup target defers — nested popups', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Components/AboutDialog', 'aboutClose'), 'targetComponent', '/Components/Other');
    const plan = planProject(mutated, index);
    expect(
      (plan.byLegacyPath.get('/Components/AboutDialog')!.dispositions['aboutClose'] as { reason: string }).reason
    ).toContain('nested popups are not translated');
  });

  test('a Close Popup outside every popup target defers — the ancestor walk is not threadable', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Pages/Home', 'showAbout'), 'target', '/Components/FarewellCard');
    const plan = planProject(mutated, index);
    const dialog = plan.byLegacyPath.get('/Components/AboutDialog')!;
    expect((dialog.dispositions['aboutClose'] as { reason: string }).reason).toContain('ancestor walk');
    expect(dialog.closesPopup).toBe(false);
    const emitted = emitApp(mutated, catalog).files['src/components/AboutDialog.tsx'];
    expect(emitted).not.toContain('onClose?:');
    expect(emitted).not.toContain('onClose(');
  });

  test('a declared port claiming onClose defers the Close Popup — the author renames', () => {
    const mutated = cloneIr();
    componentOf(mutated, 'Components/AboutDialog').nodes.push({
      id: 'aboutIns',
      type: 'Component Inputs',
      catalogRef: 'Component Inputs',
      parameters: [],
      declaredPorts: [{ name: 'onClose', plug: 'output', kind: 'value', type: 'string' }],
      portKnowledge: 'complete'
    });
    const plan = planProject(mutated, index);
    expect(
      (plan.byLegacyPath.get('/Components/AboutDialog')!.dispositions['aboutClose'] as { reason: string }).reason
    ).toContain('reserved prop "onClose"');
  });

  test('a consumed failure output defers the node', () => {
    const mutated = cloneIr();
    nodeOf(mutated, 'Components/AboutDialog', 'aboutOutputs').declaredPorts.push({
      name: 'failed',
      plug: 'input',
      kind: 'signal'
    });
    wire(mutated, 'Components/AboutDialog', 'aboutClose', 'failure', 'aboutOutputs', 'failed');
    const plan = planProject(mutated, index);
    expect(
      (plan.byLegacyPath.get('/Components/AboutDialog')!.dispositions['aboutClose'] as { reason: string }).reason
    ).toContain('its failure output is consumed');
  });
});
