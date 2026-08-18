/**
 * LAS-001 — an instance parameter that reaches a port.
 *
 * ## The hole
 *
 * A component's interface is the single most load-bearing mechanism in the
 * architecture doctrine: "one card, four instances" only works because the card
 * declares inputs the instances can set. Nothing checked that it did.
 *
 * Haiku's cold replay of the storefront brief produced the ideal shape —
 * `Components/ProductCard` instantiated four times with `image`, `name`,
 * `description`, `price`, `originalPrice`, `badge` — and rendered four identical
 * blocks of the literal word "Text". `validate:project`: **0 errors**. The
 * parameters named ports that do not exist, and no gate anywhere looked:
 *
 *  - `checkParameterValues` returns on its first line for a component-instance
 *    node (`!catalog.hasType(node.type)` — a component ref is not a catalog
 *    type), so the parameter-value layer never sees one;
 *  - `nonexistentPort` skips component refs outright and only reasons about
 *    *connections* in any case;
 *  - `NormNode` carried no `parameters`, so no `rules/` rule could see them.
 *
 * ⚠️ **That third bullet stopped being true on 2026-08-18 (D13)** and is kept in
 * the past tense rather than deleted, because it is the recorded reason this
 * check is shaped the way it is. `NormNode` now carries `parameters` and
 * `rules/parameterValue` reads them.
 *
 * 🔴 **The first two bullets are untouched and they are still why this check
 * exists.** `checkParameterValues` returns on its first line for a
 * component-instance node whatever calls it, so routing it through the CLI gate
 * did **not** give component-ref parameters a checker. Moving this check into
 * `rules/` is now merely possible rather than impossible — it is a decision with
 * its own evidence, not a tidy-up, and nothing here depends on it.
 *
 * ## Where a component's inputs actually come from
 *
 * A component has no port declaration of its own. `componentmodel.getPorts()`
 * walks every node with `haveComponentPorts` (only `Component Inputs` and
 * `Component Outputs` carry it) and reads `node.getPorts('input')` /
 * `node.getPorts('output')`, where `getPorts(filter)` selects on
 * `p.plug && p.plug.indexOf(filter) !== -1`. Ports collected from the *output*
 * side are republished as the component's **inputs**, which is the inversion
 * that makes this worth writing down:
 *
 *     a component input  ==  a port on a Component Inputs/Outputs node
 *                            whose own `plug` contains "output"
 *
 * The `Component Inputs` node's own `PortEditor` panel declares `plug: 'output'`,
 * so anything authored through the canvas is right by construction, and the
 * corpus agrees: **920 of 942** declared ports on `Component Inputs` nodes are
 * plugged `output`.
 *
 * The other 22 are all one component — `ecommerce-example`'s `ProductCard`, the
 * phase-54 reference build — plus its copy in `ecom-responsive-probe`. They are
 * plugged `input`, so the eleven "inputs" of the prettiest page this project has
 * produced are actually component *outputs*, and the twelve connections drawn
 * out of that node reference an output port that does not exist (the exporter
 * drops unhealthy connections, `utils/exporter/util.ts`). It renders in
 * `scripts/devtools/render-from-disk.js` only because that harness rewrites
 * every Component Inputs port to `plug: 'input'` before handing the project to
 * the viewer — a measuring instrument disagreeing with the thing it measures.
 * {@link checkComponentPortDirection} is that finding turned into a gate.
 *
 * ⚠️ `explain/graph.ts::componentPorts` has the same plug-blind derivation and
 * is a second reader of the same fact. It is not corrected here because its
 * consumers describe a graph to a model rather than gate a write, and widening
 * this task to it would change what every explanation says. Where the two
 * disagree, this module follows the runtime.
 *
 * ## Calibration
 *
 * Scanned over both corpora (`measurements/scan-interfaces.js`, 2026-08-08):
 * 107 legacy projects + 12 v2 projects, 730 component instances carrying 810
 * parameters.
 *
 *  - `InterfacelessInstance`: **2 hits, both haiku's replay.** Zero in every
 *    legacy project, zero in the prefab library, zero in the editor fixtures.
 *  - `InstanceUnknownParameter`: **65 hits** — 58 in one editor merge fixture
 *    (`tests/testfs/big-merge-test-mine`, a real app carrying stale parameters
 *    for inputs its components no longer declare), 6 sonnet, 1 supabase prefab.
 *  - `ComponentPortDirection`: **22 hits, two projects**, described above.
 *
 * So: warning severity project-wide (58 real legacy hits is a population, and
 * `UnknownParameter` set the precedent for exactly this shape), and
 * authored-blocking, because every authored hit is a page that renders dead.
 *
 * Pure — the caller supplies the nodes and the index.
 *
 * @module noodl-editor/validation/componentInterface
 */

import { nearest } from './CatalogIndex';
import { DiagnosticCode, type Diagnostic, type Severity } from './diagnostics';
import type { AuthoredPortLike } from './instancePorts';
import { isComponentRef, refToPath } from './model';
import type { ParameterizedNode } from './parameterValues';

/** Node types that carry `haveComponentPorts` — the only ones with an interface. */
export const COMPONENT_PORT_TYPES: ReadonlySet<string> = new Set(['Component Inputs', 'Component Outputs']);

/** How many input names a message will list before it stops being readable. */
const MAX_ALTERNATIVES = 24;

/** A component seen only as "what nodes, and what ports do they declare". */
export interface ComponentInterfaceView {
  /** Legacy name, e.g. `/Components/ProductCard`. */
  name: string;
  nodes: readonly { type: string; ports?: readonly AuthoredPortLike[] | null }[];
}

/** What an instance of a component may be given. */
export interface ComponentInterface {
  /** Input port names, as `componentmodel.getPorts()` publishes them. */
  inputs: readonly string[];
  /**
   * Names declared on a `Component Inputs`/`Component Outputs` node in the wrong
   * direction, so they are not part of the interface. Carried so the diagnostic
   * for an instance can say *why* the component looks empty.
   */
  backwards: readonly string[];
  /**
   * Node types that declare a port of a given name while carrying no component
   * ports at all — a `Group` with `ports: [{name: 'image'}]`. Keyed by port name
   * so a diagnostic can name the node the author actually wrote it on, which is
   * the difference between "add an interface" and "move what you already wrote".
   */
  strayedTo: ReadonlyMap<string, string>;
}

export type ComponentInterfaceIndex = ReadonlyMap<string, ComponentInterface>;

function portNames(ports: readonly AuthoredPortLike[] | null | undefined): { name: string; plug?: string }[] {
  if (!Array.isArray(ports)) return [];
  const out: { name: string; plug?: string }[] = [];
  for (const port of ports) {
    if (port === null || typeof port !== 'object') continue;
    const name = typeof port.name === 'string' && port.name.trim() ? port.name.trim() : undefined;
    if (!name) continue;
    out.push({ name, plug: typeof port.plug === 'string' ? port.plug.trim() : undefined });
  }
  return out;
}

/**
 * Build the interface index, keyed by **both** name forms — a node's type may
 * be `/Components/Card` or `Components/Card` and both resolve, exactly as
 * `buildComponentRefs` does for the semantic validator.
 */
export function componentInterfaceIndex(views: readonly ComponentInterfaceView[]): ComponentInterfaceIndex {
  const index = new Map<string, ComponentInterface>();
  for (const view of views) {
    const inputs: string[] = [];
    const backwards: string[] = [];
    const strayedTo = new Map<string, string>();

    for (const node of view.nodes) {
      const ports = portNames(node.ports);
      if (!ports.length) continue;
      if (COMPONENT_PORT_TYPES.has(node.type)) {
        for (const { name, plug } of ports) {
          if (plug === undefined) continue; // `PortWithoutPlug` owns a plugless port.
          if (plug.indexOf('output') !== -1) {
            if (!inputs.includes(name)) inputs.push(name);
          } else if (!backwards.includes(name)) {
            backwards.push(name);
          }
        }
      } else {
        for (const { name } of ports) if (!strayedTo.has(name)) strayedTo.set(name, node.type);
      }
    }

    const record: ComponentInterface = { inputs, backwards, strayedTo };
    index.set(view.name, record);
    index.set(refToPath(view.name), record);
  }
  return index;
}

export interface CheckInstanceInterfacesOptions {
  /** Component identifier for the diagnostics' location. */
  component: string;
  /** Every component's interface. A name absent from it is simply not checked. */
  interfaces: ComponentInterfaceIndex;
  /** Severity for these findings. Defaults to `warning` — see the module note. */
  severity?: Severity;
}

/** The ports a node declares on itself, which `NodeGraphNode.getPorts` also honours. */
function ownPortNames(node: ParameterizedNode & { ports?: readonly AuthoredPortLike[] | null }): Set<string> {
  return new Set(portNames(node.ports).map((p) => p.name));
}

function describeMissingInterface(target: string, iface: ComponentInterface, parameters: readonly string[]): string {
  if (iface.backwards.length > 0) {
    const shared = parameters.filter((p) => iface.backwards.includes(p));
    const shown = (shared.length ? shared : iface.backwards).slice(0, MAX_ALTERNATIVES);
    return (
      ` Its Component Inputs node declares ${shown.map((n) => `"${n}"`).join(', ')} with plug "input", ` +
      'which publishes them as component OUTPUTS — a port on a Component Inputs node must be plugged "output" ' +
      'for values to flow out of it into the graph.'
    );
  }
  const strayed = parameters.filter((p) => iface.strayedTo.has(p));
  if (strayed.length > 0) {
    const on = iface.strayedTo.get(strayed[0]);
    return (
      ` It declares ${strayed
        .slice(0, MAX_ALTERNATIVES)
        .map((n) => `"${n}"`)
        .join(', ')} as ports on a ${on} node instead. Only a Component Inputs node carries a component's ` +
      'interface; ports declared anywhere else are ordinary instance ports and never become inputs.'
    );
  }
  return '';
}

/**
 * Instance parameters against the target component's real interface.
 *
 * Two diagnostics, and which one fires is decided by whether the component has
 * an interface at all:
 *
 *  - **no inputs** → one {@link DiagnosticCode.InterfacelessInstance} per target
 *    component, listing the parameters every instance of it tried to set. One,
 *    not one per parameter per instance: haiku's page would otherwise draw 30
 *    rejections for what is a single edit to a single component, and a repair
 *    round spent reading is a repair round.
 *  - **some inputs** → one {@link DiagnosticCode.InstanceUnknownParameter} per
 *    offending parameter, carrying the component's actual input list as
 *    `alternatives` and the nearest name as `suggestion`. That is the "did you
 *    mean" shape the audit measured a 100% self-correction rate on.
 *
 * A reference the index cannot resolve is skipped: `unresolved-component-ref`
 * already owns it, and two diagnostics for one cause is a repair round spent
 * choosing between them.
 */
export function checkInstanceInterfaces(
  nodes: readonly (ParameterizedNode & { ports?: readonly AuthoredPortLike[] | null })[],
  options: CheckInstanceInterfacesOptions
): Diagnostic[] {
  const { component, interfaces, severity = 'warning' } = options;
  const diagnostics: Diagnostic[] = [];

  /** Targets with no interface, in first-seen order, with what was sent to them. */
  const interfaceless = new Map<
    string,
    { iface: ComponentInterface; node: ParameterizedNode; instances: number; parameters: string[] }
  >();

  for (const node of nodes) {
    if (!isComponentRef(node.type)) continue;
    const iface = interfaces.get(node.type) ?? interfaces.get(refToPath(node.type));
    if (!iface) continue;

    const parameters = Object.keys(node.parameters ?? {});
    if (parameters.length === 0) continue;

    if (iface.inputs.length === 0) {
      const entry = interfaceless.get(node.type) ?? { iface, node, instances: 0, parameters: [] };
      entry.instances++;
      for (const p of parameters) if (!entry.parameters.includes(p)) entry.parameters.push(p);
      interfaceless.set(node.type, entry);
      continue;
    }

    const own = ownPortNames(node);
    for (const parameter of parameters) {
      if (iface.inputs.includes(parameter)) continue;
      if (own.has(parameter)) continue;
      diagnostics.push({
        code: DiagnosticCode.InstanceUnknownParameter,
        severity,
        message:
          `"${parameter}" is not an input of ${node.type}. A component instance has only the ports its ` +
          `Component Inputs node declares — it carries no layout, style or lifecycle ports of its own — ` +
          `and this one declares ${iface.inputs.length}: ${iface.inputs
            .slice(0, MAX_ALTERNATIVES)
            .map((n) => `"${n}"`)
            .join(', ')}. The value is discarded.`,
        location: {
          component,
          nodeId: node.id,
          nodeType: node.type,
          nodeLabel: node.label,
          port: parameter,
          plug: 'input'
        },
        suggestion: nearest(parameter, [...iface.inputs]),
        alternatives: iface.inputs.slice(0, MAX_ALTERNATIVES)
      });
    }
  }

  for (const [target, { iface, node, instances, parameters }] of interfaceless) {
    const plural = instances === 1 ? '1 instance' : `${instances} instances`;
    diagnostics.push({
      code: DiagnosticCode.InterfacelessInstance,
      severity,
      message:
        `${target} declares no Component Inputs, so ${plural} of it here set ${parameters.length} ` +
        `parameter${parameters.length === 1 ? '' : 's'} that reach nothing: ${parameters
          .slice(0, MAX_ALTERNATIVES)
          .map((n) => `"${n}"`)
          .join(', ')}. Every instance renders identically, showing the component's placeholder content.` +
        describeMissingInterface(target, iface, parameters),
      location: { component, nodeId: node.id, nodeType: node.type, nodeLabel: node.label },
      suggestion:
        `Add a Component Inputs node to ${target} with ports ${parameters
          .slice(0, MAX_ALTERNATIVES)
          .map((n) => `"${n}"`)
          .join(', ')}, each with plug "output", and connect them to the Text/Image nodes that display them.`,
      alternatives: parameters.slice(0, MAX_ALTERNATIVES)
    });
  }

  return diagnostics;
}

export interface CheckComponentPortDirectionOptions {
  /** Component identifier for the diagnostics' location. */
  component: string;
  /** Severity for these findings. Defaults to `warning`. */
  severity?: Severity;
}

/** What a port on each of the two interface nodes must be plugged as. */
const REQUIRED_PLUG: Record<string, 'output' | 'input'> = {
  'Component Inputs': 'output',
  'Component Outputs': 'input'
};

/**
 * A component-interface port pointing the wrong way.
 *
 * The complement of {@link checkInstancePorts}, which asks whether a port has a
 * direction at all. This asks whether it has the *right* one, and only for the
 * two node types where the answer is not a matter of taste: on a
 * `Component Inputs` node a port must be plugged `output` (values flow out of it
 * into the graph) and on `Component Outputs`, `input`.
 *
 * Backwards, the port is inert twice over — it never joins the component's
 * interface, and every connection drawn from it names an endpoint
 * `getPorts('output')` will not return, which the exporter drops as unhealthy.
 * Nothing reported it: `nonexistentPort` accepts any name present in
 * `instancePorts`, and `instancePortNames` collects names without reading plug.
 *
 * Separate from `checkInstancePorts` rather than folded into it because that
 * check is deliberately type-agnostic — `getPorts` filters on plug for every
 * node, so a plugless port is dead wherever it is declared — while this one is
 * only meaningful for the two types that carry `haveComponentPorts`.
 */
export function checkComponentPortDirection(
  nodes: readonly { id: string; type: string; label?: string; ports?: readonly AuthoredPortLike[] | null }[],
  options: CheckComponentPortDirectionOptions
): Diagnostic[] {
  const { component, severity = 'warning' } = options;
  const diagnostics: Diagnostic[] = [];

  for (const node of nodes) {
    const required = REQUIRED_PLUG[node.type];
    if (!required) continue;
    const opposite = required === 'output' ? 'input' : 'output';

    for (const { name, plug } of portNames(node.ports)) {
      // A plugless port is `PortWithoutPlug`'s (an error, and it already says
      // exactly which direction to use). Two diagnostics for one edit is noise.
      if (plug === undefined || plug === '') continue;
      if (plug.indexOf(required) !== -1) continue;

      diagnostics.push({
        code: DiagnosticCode.ComponentPortDirection,
        severity,
        message:
          `Port "${name}" on ${node.type} is plugged "${plug}", which is backwards. ` +
          (required === 'output'
            ? `A Component Inputs port must be plugged "output" — values flow out of that node into this graph. ` +
              `Plugged "${opposite}" it becomes a component OUTPUT instead, so no instance can set it and every ` +
              'connection drawn out of it is dropped as unhealthy.'
            : `A Component Outputs port must be plugged "input" — values flow into that node from this graph. ` +
              `Plugged "${opposite}" it becomes a component INPUT instead.`),
        location: { component, nodeId: node.id, nodeType: node.type, nodeLabel: node.label, port: name },
        suggestion: `Set "plug" to "${required}".`
      });
    }
  }

  return diagnostics;
}
