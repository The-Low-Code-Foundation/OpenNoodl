/**
 * D54 / REL-011b AC1 — **the chip a person presses is the preset they get.**
 *
 * ## What was measured, and what it overturned
 *
 * D54 recorded the theme presets as *"dead on the deployed site"*: `Studio`,
 * `Press` and `Night` each clicked, **0 of 7 fields changed, 0 requests**, on
 * enabled buttons with `onclick`, while `Save theme` on the same screen fired
 * its `PUT`. It was filed as a preview-versus-deploy defect and left undiagnosed.
 *
 * 🔴 **Both halves of that were wrong, and the fields are what say so.** Driven
 * on the real deployed bundle (`deploy-from-disk` → `drive-deployed`) at
 * `/admin/theme`, from an EMPTY form so a change cannot hide:
 *
 * | click | the five token fields afterwards |
 * |---|---|
 * | Studio | `#d9a441 #14161a #eceae5 "Helvetica Neue"… 10px` |
 * | Press  | the same |
 * | Night  | the same |
 *
 * Those are **`night`'s** values. The presets were never dead — they fire on
 * every click and publish the wrong palette. D54's screen already held `night`,
 * so *"0 of 7 changed"* was the same preset arriving twice. And s46's *"picking
 * Night in preview filled every field"* is the one chip that was ever right, so
 * there is no preview/deploy difference to explain.
 *
 * ## The mechanism
 *
 * All three chip placements wire their `name` — a `Component Inputs` constant,
 * published at MOUNT — into the SAME `presets.in-name` port. Three producers,
 * one port, **last placement wins**, and `night` is the third. `run` carries no
 * payload, so the click only says *now*, never *which*.
 *
 * The fix is in `/Admin/PresetChip`: a `pick` script republishes that chip's own
 * `name` at the moment of the press and fires `Picked` after it, in one run.
 *
 * ## What this file grades, and on what
 *
 * The **shipped artefact** — `site-builder.content.json` — instantiated in the
 * **real runtime**, with the button stubbed because it lives in the viewer
 * package. Not the source constants: a spec over the arguments the door is sent
 * cannot see a generator that stopped regenerating.
 *
 * 🔴 The **reverted arm** is the load-bearing part. It rebuilds the pre-fix chip
 * (`inputs.name → outputs.name`, `chip.onClick → outputs.Picked`) beside the
 * shipped one, on the same picker, and asserts it answers `night` for all three.
 * Without it, three green readings are equally consistent with a harness that
 * cannot tell the presets apart at all.
 */
import * as fs from 'fs';
import * as path from 'path';

/**
 * The runtime is untyped CommonJS from another package, so the node instances
 * this file holds have no declared shape. `Loose` is an editor-side global and
 * is not in this program.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

const NodeContext = require('../../noodl-runtime/src/nodecontext');
const NodeDefinition = require('../../noodl-runtime/src/nodedefinition');
const ComponentInstance = require('../../noodl-runtime/src/nodes/componentinstance');
const ComponentModel = require('../../noodl-runtime/src/models/componentmodel');
const GraphModel = require('../../noodl-runtime/src/models/graphmodel');
const ComponentInputs = require('../../noodl-runtime/src/nodes/componentinputs');
const ComponentOutputs = require('../../noodl-runtime/src/nodes/componentoutputs');
const SimpleJavascript = require('../../noodl-runtime/src/nodes/std-library/simplejavascript');

// ── the artefact ─────────────────────────────────────────────────────────────

type ArtefactNode = {
  id: string;
  type: string;
  label?: string;
  parameters?: Record<string, unknown>;
  ports?: Record<string, unknown>[];
  children?: ArtefactNode[];
};
type ArtefactWire = { fromId: string; fromProperty: string; toId: string; toProperty: string };
type ArtefactComponent = { name: string; graph: { roots: ArtefactNode[]; connections: ArtefactWire[] } };

const TEMPLATE = path.join(
  __dirname,
  '..',
  '..',
  'noodl-editor',
  'src',
  'editor',
  'src',
  'models',
  'template',
  'templates',
  'site-builder.content.json'
);

const ARTEFACT = JSON.parse(fs.readFileSync(TEMPLATE, 'utf8')) as { components: ArtefactComponent[] };
const componentNamed = (name: string) => {
  const c = ARTEFACT.components.find((x) => x.name === name);
  if (!c) throw new Error(`the artefact has no ${name}`);
  return c;
};

function* walk(nodes: ArtefactNode[]): Generator<ArtefactNode> {
  for (const n of nodes) {
    yield n;
    if (n.children) yield* walk(n.children);
  }
}
const flatNodes = (nodes: ArtefactNode[]) => Array.from(walk(nodes));
const flat = (c: ArtefactComponent) => flatNodes(c.graph.roots);
const nodeLabelled = (c: ArtefactComponent, label: string) => {
  const n = flat(c).find((x) => x.label === label);
  if (!n) throw new Error(`${c.name} has no node labelled ${label}`);
  return n;
};

/** The export shape the runtime reads: `{sourceId, sourcePort, targetId, targetPort}`. */
const asConnection = (w: ArtefactWire) => ({
  sourceId: w.fromId,
  sourcePort: w.fromProperty,
  targetId: w.toId,
  targetPort: w.toProperty
});

/** A node, stripped to what the runtime needs — the artefact carries editor geometry too. */
const asNode = (n: ArtefactNode) => ({
  id: n.id,
  type: n.type,
  parameters: n.parameters ?? {},
  ports: n.ports ?? []
});

/**
 * A component's own interface, derived the way the exporter derives it: a
 * `Component Inputs` port plugged `output` inside the component is an INPUT of
 * every instance, and a `Component Outputs` port plugged `input` is an OUTPUT.
 */
function interfaceOf(nodes: ArtefactNode[]) {
  const ports: Record<string, unknown>[] = [];
  for (const n of nodes) {
    if (n.type === 'Component Inputs') for (const p of n.ports ?? []) ports.push({ ...p, plug: 'input' });
    if (n.type === 'Component Outputs') for (const p of n.ports ?? []) ports.push({ ...p, plug: 'output' });
  }
  return ports;
}

// ── the runtime ──────────────────────────────────────────────────────────────

/**
 * Stands in for `net.noodl.controls.button`, which lives in the viewer package.
 *
 * ⚠️ `click` is a value input whose setter sends the signal, and `press()` below
 * queues a fresh number into it. The obvious shape — a `signal` input with
 * `valueChangedToTrue` — cannot press the SAME chip twice: the input is already
 * `true`, so the second press never fires and the re-press specs below would
 * have failed on the instrument rather than on the graph. A real Button sends
 * `onClick` once per DOM click, which is what this reproduces.
 */
const buttonStub = NodeDefinition.defineNode({
  name: 'net.noodl.controls.button',
  category: 'test',
  initialize() {
    this._internal.label = undefined;
  },
  inputs: {
    label: { type: 'string', set(this: Loose, v: unknown) { this._internal.label = v; } },
    click: { type: '*', set(this: Loose) { this.sendSignalOnOutput('onClick'); } }
  },
  outputs: { onClick: { type: 'signal', displayName: 'Click' } }
});

/** Records what the picker published, and how many times. */
const sink = NodeDefinition.defineNode({
  name: 'D54 Sink',
  category: 'test',
  initialize() {
    this._internal.seen = {} as Record<string, unknown>;
    this._internal.picked = 0;
  },
  inputs: {
    primary: { type: '*', set(this: Loose, v: unknown) { this._internal.seen.primary = v; } },
    background: { type: '*', set(this: Loose, v: unknown) { this._internal.seen.background = v; } },
    radius: { type: '*', set(this: Loose, v: unknown) { this._internal.seen.radius = v; } },
    picked: { type: 'signal', valueChangedToTrue(this: Loose) { this._internal.picked++; } }
  },
  outputs: {}
});

const CHIP_NAME = '/Admin/PresetChip';
const REVERTED_CHIP_NAME = '/Admin/PresetChipAsItShipped';
const BARE_NAME_CHIP_NAME = '/Admin/PresetChipPublishingABareName';

/**
 * The chip and the picker as they SHIPPED before the fix — derived from the
 * artefact, not retyped, so the arm cannot drift away from what it reverts.
 *
 * The chip loses its `pick` script and wires the `Component Inputs` constant
 * straight at the `Component Outputs`; the picker's port and script go back to
 * reading a bare `name`. 🔴 Both halves, because reverting one and keeping the
 * other measures a graph that never existed.
 */
function revertedPair(chip: ArtefactComponent, picker: ArtefactNode) {
  const nodes = flatNodes(chip.graph.roots);
  const idOf = (type: string) => nodes.find((n) => n.type === type)!.id;
  const ports = interfaceOf(nodes).map((p) => (p.name === 'pick' ? { ...p, name: 'name', type: 'string' } : p));

  const revertedPicker = {
    ...asNode(picker),
    id: picker.id,
    parameters: {
      ...picker.parameters,
      'runOnChange-in-pick': undefined,
      'runOnChange-in-name': false,
      functionScript: String(picker.parameters?.functionScript ?? '').replace('(Inputs.pick || {}).name', 'Inputs.name')
    },
    ports: (picker.ports ?? []).map((p) =>
      p.name === 'in-pick' ? { ...p, name: 'in-name', displayName: 'name' } : p
    )
  };

  return {
    component: {
      name: REVERTED_CHIP_NAME,
      nodes: nodes.filter((n) => n.type !== 'JavaScriptFunction').map(asNode),
      ports,
      connections: [
        { sourceId: idOf('Component Inputs'), sourcePort: 'label', targetId: idOf('net.noodl.controls.button'), targetPort: 'label' },
        { sourceId: idOf('Component Inputs'), sourcePort: 'name', targetId: idOf('Component Outputs'), targetPort: 'name' },
        { sourceId: idOf('net.noodl.controls.button'), sourcePort: 'onClick', targetId: idOf('Component Outputs'), targetPort: 'Picked' }
      ]
    },
    picker: revertedPicker,
    /** The port the placements wire into, which the revert moves back. */
    valuePort: { from: 'name', to: 'in-name' }
  };
}

const PRESET_ORDER = ['studio', 'press', 'night'] as const;

/**
 * The FIRST DRAFT of this fix: the chip publishes its `name` at the press — the
 * right chip, at the right moment — as a bare string.
 *
 * 🔴 Kept as a MUTANT because it is the shape anybody simplifying this would
 * reach for, and it is right for exactly as long as nobody presses the same chip
 * twice. A Function's `Outputs` proxy publishes only when the value CHANGES, so
 * a chip re-pressed after another one sends nothing and the picker answers with
 * whatever the other chip left behind. Measured on the deployed bundle before
 * this arm existed: Studio, Press, Night read correctly, and **Studio again read
 * Night**.
 *
 * It runs against the pre-object picker (`in-name`), because that is the pair it
 * was: reverting one half and keeping the other measures a graph nobody built.
 */
function bareNamePressChip(chip: ArtefactComponent) {
  const nodes = flatNodes(chip.graph.roots);
  const idOf = (type: string) => nodes.find((n) => n.type === type)!.id;
  return {
    name: BARE_NAME_CHIP_NAME,
    nodes: nodes.map((n) =>
      n.type === 'JavaScriptFunction'
        ? { ...asNode(n), parameters: { ...n.parameters, functionScript: 'Outputs.name = Inputs.name;\nOutputs.picked();' } }
        : n.type === 'Component Outputs'
          ? { ...asNode(n), ports: (n.ports ?? []).map((p) => (p.name === 'pick' ? { ...p, name: 'name', type: 'string' } : p)) }
          : asNode(n)
    ),
    ports: interfaceOf(nodes).map((p) => (p.name === 'pick' ? { ...p, name: 'name', type: 'string' } : p)),
    connections: [
      { sourceId: idOf('Component Inputs'), sourcePort: 'label', targetId: idOf('net.noodl.controls.button'), targetPort: 'label' },
      { sourceId: idOf('Component Inputs'), sourcePort: 'name', targetId: idOf('JavaScriptFunction'), targetPort: 'in-name' },
      { sourceId: idOf('net.noodl.controls.button'), sourcePort: 'onClick', targetId: idOf('JavaScriptFunction'), targetPort: 'run' },
      { sourceId: idOf('JavaScriptFunction'), sourcePort: 'out-name', targetId: idOf('Component Outputs'), targetPort: 'name' },
      { sourceId: idOf('JavaScriptFunction'), sourcePort: 'out-picked', targetId: idOf('Component Outputs'), targetPort: 'Picked' }
    ]
  };
}

/** One page: three chips, the picker, and a sink on three of its outputs. */
async function pageWith(shape: 'shipped' | 'reverted' | 'bare-name') {
  const themeEditor = componentNamed('/Pages/ThemeEditor');
  const shippedPicker = nodeLabelled(themeEditor, 'The three presets');
  const chip = componentNamed(CHIP_NAME);
  const reverted = revertedPair(chip, shippedPicker);

  const chipName =
    shape === 'shipped' ? CHIP_NAME : shape === 'reverted' ? REVERTED_CHIP_NAME : BARE_NAME_CHIP_NAME;
  const picker = shape === 'shipped' ? asNode(shippedPicker) : reverted.picker;
  const valuePort = shape === 'shipped' ? { from: 'pick', to: 'in-pick' } : reverted.valuePort;

  const graphModel = new GraphModel();
  (graphModel as Loose).variants = [];
  const context = new NodeContext({ graphModel });
  for (const def of [ComponentInputs.node, ComponentOutputs.node, SimpleJavascript.node]) {
    context.nodeRegister.register(NodeDefinition.defineNode(def));
  }
  context.nodeRegister.register(buttonStub);
  context.nodeRegister.register(sink);

  const register = async (data: Loose) => {
    const model = await ComponentModel.createFromExportData(data);
    graphModel.addComponent(model);
    context.componentModels[data.name] = model;
  };

  await register({
    name: CHIP_NAME,
    nodes: flatNodes(chip.graph.roots).map(asNode),
    ports: interfaceOf(flatNodes(chip.graph.roots)),
    connections: chip.graph.connections.map(asConnection)
  });
  await register(reverted.component);
  await register(bareNamePressChip(chip));

  // The placements, verbatim: the parameters are the whole difference between them.
  const placements = PRESET_ORDER.map((name) => {
    const placed = flat(themeEditor).find((n) => n.type === CHIP_NAME && n.parameters?.name === name);
    if (!placed) throw new Error(`the theme editor places no chip for ${name}`);
    return { id: placed.id, type: chipName, parameters: placed.parameters, ports: [] };
  });

  const page = await ComponentModel.createFromExportData({
    name: '/Pages/D54Probe',
    nodes: [...placements, picker, { id: 'sink', type: 'D54 Sink', parameters: {}, ports: [] }],
    ports: [],
    connections: [
      ...placements.flatMap((p) => [
        { sourceId: p.id, sourcePort: valuePort.from, targetId: picker.id, targetPort: valuePort.to },
        { sourceId: p.id, sourcePort: 'Picked', targetId: picker.id, targetPort: 'run' }
      ]),
      { sourceId: picker.id, sourcePort: 'out-primary', targetId: 'sink', targetPort: 'primary' },
      { sourceId: picker.id, sourcePort: 'out-background', targetId: 'sink', targetPort: 'background' },
      { sourceId: picker.id, sourcePort: 'out-radius', targetId: 'sink', targetPort: 'radius' },
      { sourceId: picker.id, sourcePort: 'out-picked', targetId: 'sink', targetPort: 'picked' }
    ]
  });
  graphModel.addComponent(page);

  const instance = new ComponentInstance(context);
  await instance.setComponentModel(page);
  context.update();

  const sinkNode = instance.nodeScope.getNodeWithId('sink');
  let presses = 0;
  return {
    sink: sinkNode,
    press(preset: (typeof PRESET_ORDER)[number]) {
      const placed = placements.find((p) => p.parameters?.name === preset)!;
      instance.nodeScope.getNodeWithId(placed.id).nodeScope.getNodeWithId('chip').queueInput('click', ++presses);
      context.update();
    }
  };
}

/** The three palettes, read out of the shipped picker's own script — not retyped. */
function presetTable(): Record<string, Record<string, string>> {
  const picker = nodeLabelled(componentNamed('/Pages/ThemeEditor'), 'The three presets');
  const script = String(picker.parameters?.functionScript ?? '');
  return JSON.parse(script.slice(script.indexOf('{'), script.indexOf(';')));
}

describe('D54 — the chip a person presses is the preset they get', () => {
  const PRESETS = presetTable();

  it('the three palettes differ, so a wrong one cannot read as a right one', () => {
    const primaries = PRESET_ORDER.map((n) => PRESETS[n].colorPrimary);
    expect(new Set(primaries).size).toBe(3);
  });

  it.each(PRESET_ORDER)('pressing the %s chip publishes the studio/press/night palette it names', async (preset) => {
    const page = await pageWith('shipped');
    expect(page.sink._internal.picked).toBe(0); // nothing is picked until somebody presses
    page.press(preset);
    expect(page.sink._internal.picked).toBe(1);
    expect(page.sink._internal.seen).toEqual({
      primary: PRESETS[preset].colorPrimary,
      background: PRESETS[preset].colorBackground,
      radius: PRESETS[preset].radius
    });
  });

  it('three presses in a row leave the LAST one pressed, not the last one placed', async () => {
    const page = await pageWith('shipped');
    page.press('night');
    page.press('press');
    page.press('studio');
    expect(page.sink._internal.picked).toBe(3);
    expect(page.sink._internal.seen.primary).toBe(PRESETS.studio.colorPrimary);
  });

  it('a chip pressed AGAIN after another one still answers with itself', async () => {
    const page = await pageWith('shipped');
    page.press('studio');
    page.press('night');
    page.press('studio');
    expect(page.sink._internal.picked).toBe(3);
    expect(page.sink._internal.seen.primary).toBe(PRESETS.studio.colorPrimary);
  });

  /**
   * 🔴 MUTANT. The first draft of the fix — a bare name rather than an object.
   * It reads correctly until a chip is pressed a second time. See
   * {@link bareNamePressChip}.
   */
  it('MUTANT: a chip publishing a bare name is swallowed on the re-press', async () => {
    const page = await pageWith('bare-name');
    page.press('studio');
    expect(page.sink._internal.seen.primary).toBe(PRESETS.studio.colorPrimary);
    page.press('night');
    expect(page.sink._internal.seen.primary).toBe(PRESETS.night.colorPrimary);
    page.press('studio');
    expect(page.sink._internal.seen.primary).toBe(PRESETS.night.colorPrimary);
  });

  /**
   * 🔴 The control. On the shape that shipped, every chip answers `night` — the
   * third placement — and that is the whole of D54.
   */
  it.each(PRESET_ORDER)('REVERTED: pressing the %s chip answered night — the third placement, whichever was pressed', async (preset) => {
    const page = await pageWith('reverted');
    page.press(preset);
    expect(page.sink._internal.picked).toBe(1);
    expect(page.sink._internal.seen.primary).toBe(PRESETS.night.colorPrimary);
  });
});
