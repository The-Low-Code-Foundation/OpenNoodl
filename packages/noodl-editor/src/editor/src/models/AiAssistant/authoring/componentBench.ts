/**
 * BEN-001 — The component bench: mount one component *with its inputs set*
 *
 * `buildSandboxExport` already mounts a single component as the runtime's root,
 * which is why "preview one component" looked solved. It is not, and the reason
 * is structural: **a root component has no parent, and a `Component Inputs`
 * port is fed by its parent.** Every declared input sits at `undefined` for the
 * life of the preview, so a card previews as its empty state and a list as zero
 * rows — indistinguishable, on screen, from a component that does not work.
 * That is the phase-55 dead-placeholder failure arriving by a different route.
 *
 * The fix needs no runtime change and no new protocol message: give the
 * component a parent. A **synthetic harness component**, built in memory and
 * spliced exactly the way a candidate already is —
 *
 *   harness: one node, of type `<target legacyName>`, whose `parameters` are
 *   the static input values; `rootComponent` = the harness, `rootNode` = that
 *   node's id.
 *
 * — and the runtime then feeds the instance exactly as a page would.
 *
 * ⚠️ **A component input port is declared `plug: 'output'`** (`componentmodel`
 * `getPorts`): it is an output *of the Component Inputs node*, which is an
 * input *of the instance*. Phase-55 F8 and F23 are both this inversion and both
 * shipped. Setting values as instance `parameters` is the right side of it.
 *
 * ⚠️ **A component instance carries zero built-in ports** (LAS-001). Every
 * parameter the harness sets must name a real declared input or it is the exact
 * defect `unknown-instance-parameter` blocks — so the parameter set is built
 * *from the interface*, and a key that names nothing is dropped and said out
 * loud rather than passed through.
 *
 * ## What this module deliberately does not do
 *
 * BEN-001 §3 proposed wrapping the instance in a Group sized to the frame. It
 * does not, and the reason is the warning in that same section: `sizeMode`
 * silently voids `width`/`height`, an unsized absolute Group fills its parent
 * (phase-55 F7), and a wrapper that gets either wrong makes a correctly-built
 * component look broken — inside the tool built to tell you whether it is.
 *
 * The frame is instead the **size of the surface the export is rendered into**,
 * which is what a page gives a component anyway, is BEN-004's existing job
 * (`CanvasView.setViewportSize` displays exactly this for the app preview), and
 * is measurable in the rendered document rather than inferred from a parameter.
 * `frame` and `stretch` are carried through on the result for that surface to
 * apply. See the phase README register (B3) — whether a graph-level wrapper is
 * ever needed is a live question for BEN-007, not a thing to guess at here.
 *
 * @module AiAssistant/authoring/componentBench
 */

import { SANDBOX_METADATA_KEY, type SandboxDataset } from '@noodl/runtime/src/sandbox/types';

import * as Exporter from '../../../utils/exporter';
import { ComponentModel } from '../../componentmodel';
import type { NodeGraphNode } from '../../nodegraphmodel';
import type { ProjectModel } from '../../projectmodel';
import { componentClosure, type SandboxExport, type SandboxExportJson } from './sandboxExport';
import { buildSandboxDataset, unknownShapeNotice } from './sandboxData';
import type { AgentSampleData } from './types';

/**
 * The harness component's name.
 *
 * Prefixed out of any namespace a user can author into: component paths are
 * built from folders in the project tree, and `#` is not a legal folder
 * character. A collision would put two components with one name in the export,
 * which is a runtime coin toss — {@link buildBenchExport} therefore also
 * removes any same-named component before splicing, and a spec pins the case.
 */
export const BENCH_COMPONENT_NAME = '/#bench';

/** The id of the instance node inside the harness — stable, so `rootNode` is predictable. */
export const BENCH_NODE_ID = 'bench-subject';

/** One input the bench can offer a control for. Shaped as `getPorts()` publishes it. */
export interface BenchPort {
  name: string;
  /** `'*'` when `getPorts` could not derive one — an input wired to nothing. */
  type: unknown;
  /** Only ever present when the port has exactly one connection; see `_deriveDef`. */
  default?: unknown;
  group?: string;
  index?: number;
}

/** What a component offers a bench: the form's schema, and why it might be empty. */
export interface BenchInterface {
  /** Declared component **inputs** — `getPorts()` entries plugged `'output'`. */
  inputs: BenchPort[];
  /** Declared component **outputs** — plugged `'input'`. BEN-003's read-out reads these. */
  outputs: BenchPort[];
  /**
   * Names declared on a `Component Inputs` node the wrong way round, so they
   * are not part of the interface at all (LAS-001 / phase-55 F8).
   *
   * Carried because this is the one place a human ever sees the consequence: a
   * component with eleven "inputs" and an empty rail is not a component with no
   * interface, it is a component whose interface is backwards, and the bench is
   * where that becomes visible instead of merely true.
   */
  backwards: string[];
}

export interface BenchMount {
  /** The component to mount, by legacy name (`/Components/Card`) or path form. */
  target: string;
  /** Input values, keyed by declared input port name. */
  inputs?: Record<string, unknown>;
  /**
   * The frame the component is rendered into. Applied to the preview surface,
   * not to the graph — see the module note. Omitted = whatever the stage gives.
   */
  frame?: { width?: number; height?: number };
  /** Whether the component fills the frame or sizes to its own content. Default false. */
  stretch?: boolean;
  /** `sample_data`-shaped records for the backend the component runs against (BEN-006). */
  userData?: AgentSampleData;
  /** False for "Real backend": ship no dataset, so nothing is faked. */
  useSampleData?: boolean;
  /** Whether the bench runs signed in as the sample user. Defaults to `true`, as POL-008 settled. */
  signedIn?: boolean;
}

export interface BenchExport extends SandboxExport {
  /** The interface the parameter set was built from — the inputs rail's schema (BEN-002). */
  interface?: BenchInterface;
  /** Echoed back so the surface can size its stage without re-deriving anything. */
  frame?: { width?: number; height?: number };
  stretch?: boolean;
}

/** Both spellings of a component reference resolve, exactly as the validator's do. */
function findComponent(project: ProjectModel, target: string): ComponentModel | undefined {
  const trimmed = target.trim();
  const both = trimmed.startsWith('/') ? [trimmed, trimmed.slice(1)] : [`/${trimmed}`, trimmed];
  for (const name of both) {
    const found = project.getComponentWithName(name);
    if (found) return found;
  }
  return undefined;
}

/**
 * The ports the harness may set, read off the live component.
 *
 * `getPorts()` is the source because it is the one the runtime agrees with, and
 * because it carries the type/default/group/index the rail needs. Its honest
 * limitation is that `type` is derived from *connections*: an input wired to
 * nothing comes back `'*'` with no default, which on the corpus is the normal
 * path and not an edge case. The form degrades — it does not guess.
 *
 * `backwards` is read the way `validation/componentInterface` reads it, off the
 * raw declared ports, because a port plugged the wrong way is absent from
 * `getPorts`' input side entirely and its absence is the thing worth naming.
 */
export function benchInterface(component: ComponentModel): BenchInterface {
  const ports = component.getPorts() ?? [];
  const inputs: BenchPort[] = [];
  const outputs: BenchPort[] = [];

  for (const port of ports) {
    const entry: BenchPort = {
      name: port.name,
      type: port.type,
      default: port.default,
      group: port.group,
      index: port.index
    };
    // The inversion, and the only line in this module that depends on it.
    if (port.plug === 'output') inputs.push(entry);
    else if (port.plug === 'input') outputs.push(entry);
  }

  const declared = new Set(inputs.map((p) => p.name));
  const backwards: string[] = [];
  // NB: a truthy return from this callback ABORTS the walk. Return nothing.
  component.graph.forEachNode((node: NodeGraphNode) => {
    if (String(node.typename ?? '') !== 'Component Inputs') return;
    for (const port of (node.ports ?? []) as Array<{ name?: unknown; plug?: unknown }>) {
      const name = typeof port?.name === 'string' ? port.name.trim() : '';
      const plug = typeof port?.plug === 'string' ? port.plug : '';
      if (!name || declared.has(name) || backwards.includes(name)) continue;
      if (plug && plug.indexOf('output') === -1) backwards.push(name);
    }
  });

  return { inputs, outputs, backwards };
}

/**
 * The parameter set for the harness instance, built from the interface.
 *
 * Three rules, and the third is the one that matters:
 *
 * - an input present in `inputs` is set;
 * - an input absent from `inputs` but carrying a derived default is set to it,
 *   so a component previews the way it would in a page that leaves the port
 *   unwired rather than the way it would in a page that explicitly blanked it;
 * - a key naming no declared input is **dropped and named**. Passing it through
 *   would reproduce the phase-55 F2 defect — a parameter aimed at a port that
 *   does not exist, rendering nothing, reported as nothing — inside the tool
 *   built to expose exactly that.
 */
export function benchParameters(
  iface: BenchInterface,
  inputs: Record<string, unknown> | undefined
): { parameters: Record<string, unknown>; unknown: string[] } {
  const declared = new Map(iface.inputs.map((port) => [port.name, port]));
  const parameters: Record<string, unknown> = {};

  for (const port of iface.inputs) {
    if (inputs && Object.prototype.hasOwnProperty.call(inputs, port.name)) {
      const value = inputs[port.name];
      // `undefined` abstains, per the Empty-Value Contract: it means "I have not
      // set this", which is not the same as "set this to nothing", and letting
      // it through would shadow the default below.
      if (value !== undefined) {
        parameters[port.name] = value;
        continue;
      }
    }
    if (port.default !== undefined) parameters[port.name] = port.default;
  }

  const unknown = Object.keys(inputs ?? {}).filter((name) => !declared.has(name));
  return { parameters, unknown };
}

/** The harness: one component, one node, no connections, never owned by the project. */
export function benchHarness(targetLegacyName: string, parameters: Record<string, unknown>): ComponentModel {
  return ComponentModel.fromJSON({
    name: BENCH_COMPONENT_NAME,
    id: 'bench-harness',
    graph: {
      roots: [{ id: BENCH_NODE_ID, type: targetLegacyName, x: 0, y: 0, parameters, children: [] }],
      connections: []
    }
  });
}

function describe(component: ComponentModel, iface: BenchInterface, unknown: string[], visual: boolean): string {
  const parts: string[] = [];
  parts.push(
    iface.inputs.length === 1 ? '1 input' : `${iface.inputs.length} inputs`,
    iface.outputs.length === 1 ? '1 output' : `${iface.outputs.length} outputs`
  );
  let summary = `${component.name} on the bench — ${parts.join(', ')}.`;

  if (!visual) {
    summary +=
      ' This component has no visual root, so there is nothing to draw —' +
      ' feed it inputs and watch the outputs rail.';
  }
  if (unknown.length > 0) {
    summary += ` Ignored ${unknown.map((n) => `"${n}"`).join(', ')}: not a declared input.`;
  }
  if (iface.backwards.length > 0) {
    summary +=
      ` ${iface.backwards.map((n) => `"${n}"`).join(', ')} ` +
      (iface.backwards.length === 1 ? 'is declared' : 'are declared') +
      ' on a Component Inputs node with plug "input", which publishes it as a component OUTPUT —' +
      ' it must be plugged "output" to be settable here.';
  }
  return summary;
}

/**
 * Build the export for one bench mount.
 *
 * Returns the existing `SandboxExport` shape, deliberately, so the surfaces
 * already written for it — empty state, toolbar summary, notice chip — work
 * unchanged.
 *
 * ⚠️ Unlike `buildSandboxExport`, a component with no visual root is **not**
 * `unrenderable` here. Refusing it is right for a review document, where a
 * white rectangle is the only alternative. On the bench it is wrong: a
 * logic-only component is precisely what the outputs read-out exists to show,
 * and mounting it is the first time in this product's history that one has been
 * previewable at all. `unrenderable` stays on the interface untouched so the AI
 * preview's behaviour does not change.
 */
export function buildBenchExport({
  project,
  target,
  inputs,
  frame,
  stretch = false,
  userData,
  useSampleData = true,
  signedIn = true
}: { project: ProjectModel } & BenchMount): BenchExport {
  const component = findComponent(project, target);
  if (!component) {
    return { unrenderable: `${target} is not a component in this project, so there is nothing to mount.` };
  }

  const json = Exporter.exportToJSON(project, { useBundles: false }) as unknown as SandboxExportJson | undefined;
  if (!json) {
    return { unrenderable: 'This project has no root component yet, so the runtime has nothing to boot.' };
  }

  const iface = benchInterface(component);
  const { parameters, unknown } = benchParameters(iface, inputs);
  const harness = benchHarness(component.name, parameters);

  // Splice, never apply: nothing is added to `ProjectModel` and nothing is
  // written. Filtering by name first covers the (unreachable-by-design, pinned
  // by a spec) case of a project component sharing the harness's name.
  json.components = json.components
    .filter((c) => c.name !== BENCH_COMPONENT_NAME)
    .concat([Exporter.exportComponent(harness) as { name: string }]);
  json.rootComponent = BENCH_COMPONENT_NAME;
  json.rootNode = BENCH_NODE_ID;

  // Routes are derived from the component set, so they are re-derived from the
  // set the bench is actually running. The harness is not a page and adds none.
  json.routerIndex = Exporter.getRouterIndex([
    ...project.getComponents().filter((c) => c.name !== BENCH_COMPONENT_NAME),
    harness
  ]);

  json.metadata = { ...(json.metadata ?? {}) };

  const visual = (component.graph.roots ?? []).some((node: NodeGraphNode) => node.type?.allowAsExportRoot);
  const summary = describe(component, iface, unknown, visual);
  const result: BenchExport = { json, interface: iface, frame, stretch };

  if (!useSampleData) {
    delete json.metadata[SANDBOX_METADATA_KEY];
    return { ...result, summary: `${summary} Real backend — this bench uses your project’s live data.` };
  }

  // The closure starts at the harness, which reaches the target through its one
  // node and the target's own instances through the target — the same walk, and
  // the same depth cap, that guards a self-referencing component from hanging.
  const dataset: SandboxDataset = buildSandboxDataset({
    components: componentClosure(project, harness),
    userData,
    signedIn
  });
  json.metadata[SANDBOX_METADATA_KEY] = dataset;

  return {
    ...result,
    dataset,
    summary: `${summary} ${dataset.summary}`,
    notice: unknownShapeNotice(dataset.unknownShape)
  };
}
