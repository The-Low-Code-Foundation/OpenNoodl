/**
 * DEF-002 §1(b) and §1(c) — a wire to a port the *adapter* would never create.
 *
 * The second and third of phase 78 D1's three sabotages. Each produced a run
 * **identical to the clean one** — 46 `dynamic-port-skipped` infos, no error, no
 * warning, nothing about the wire:
 *
 * | sabotaged | the door said |
 * |---|---|
 * | `send.in-name` → `send.in-nameXX` on a **CloudFunction2** | nothing |
 * | `goDetail.pm-announcementId` → `pm-noSuchParam` on a **RouterNavigate** | nothing |
 *
 * {@link checkConnectionTargets} answered the first sabotage — the component
 * instance — from `componentInterfaceIndex`. These two need a different index,
 * because their ports are not an interface: they are **minted by an editor
 * adapter** out of parameters on nodes inside the *target* component.
 *
 * ## 🔴 Derived from the adapters, not from the task file, and the difference bit
 *
 * DEF-002 §1(c) describes the `pm-` ports as coming from *"the target page's
 * `PageInputs.pathParams` and the `{braces}` in `Page.urlPath`"*. Read at HEAD,
 * `RouterNavigateAdapter.updatePortsForNode` mints one `pm-` port per name in
 * `pathParams` **and `queryParams`**, and reads `Page.urlPath` **not at all**;
 * `PageInputsAdapter` does the same two and no more. A checker built from that
 * sentence would have been wrong twice over — refusing every legitimate wire to
 * a query parameter, and accepting a wire named after a brace in a `urlPath`
 * that mints no port. **The same decay DEF-002 §3 found in D10's mechanism, in
 * the same task file.** These functions read the adapters.
 *
 * ## Why the split from `nonexistentPort` is right, and what is left over
 *
 * `rules/nonexistentPort` skips a node whose type mints ports at runtime rather
 * than guess, and both of these types do. That skip must stay — the rule cannot
 * see an adapter's output. **What was wrong was that nothing else asked**, and
 * an `info` saying "unverified" reads, to an agent, as "verified".
 *
 * ## What it deliberately does not do
 *
 * - **Only prefixed ports.** `in-`, `out-`, `pm-` are exactly the names an
 *   adapter mints; `success`, `failure`, `error`, `function`, `target` and
 *   `router` are static ports from the catalog and none of this check's
 *   business. The prefix is what makes a name decidably adapter-owned.
 * - **A target the views cannot resolve is skipped** — `unresolved-component-ref`
 *   owns an unknown component, and two diagnostics for one cause is a repair
 *   round spent choosing.
 * - **A `CloudFunction2` whose target holds no `noodl.cloud.request` is
 *   skipped.** Without a request node there is no declaration to be wrong
 *   about, and the component may simply not be a cloud function.
 *
 * ⚠️ **`parseNameList` is imported, not re-implemented.** It is the adapters'
 * own reader, it is pure by construction (AIB-001 slice 3 separated it from the
 * warnings model for exactly this), and it carries behaviour a re-derivation
 * would get wrong: a string is split on `,` **without trimming**, so
 * `"a, b"` denotes `a` and `" b"` and the port really is `pm- b`. A checker that
 * helpfully trimmed would refuse the port the editor actually made. Three copies
 * that agree are still three copies.
 *
 * Pure — the caller supplies the nodes, the wires and the index.
 *
 * @module noodl-editor/validation/derivedPortTargets
 */

import { parseNameList } from '../models/NodeTypeAdapters/nameListParameter';
import { nearest } from './CatalogIndex';
import type { ComponentNodesView } from './authoredCandidate';
import { DiagnosticCode, type Diagnostic, type Severity } from './diagnostics';
import type { ConnectionLike } from './connectionTargets';

/** How many port names a message will list before it stops being readable. */
const MAX_ALTERNATIVES = 24;

export const CLOUD_FUNCTION_TYPE = 'CloudFunction2';
export const CLOUD_REQUEST_TYPE = 'noodl.cloud.request';
export const CLOUD_RESPONSE_TYPE = 'noodl.cloud.response';
export const ROUTER_NAVIGATE_TYPE = 'RouterNavigate';
export const PAGE_INPUTS_TYPE = 'PageInputs';

/** The prefix `CloudFunctionAdapter` puts on a request parameter. */
export const CLOUD_INPUT_PREFIX = 'in-';
/** The prefix `CloudFunctionAdapter` puts on a response parameter. */
export const CLOUD_OUTPUT_PREFIX = 'out-';
/** The prefix `RouterNavigateAdapter` and `PageInputsAdapter` both put on a page parameter. */
export const PAGE_PARAM_PREFIX = 'pm-';

/**
 * The cloud-function namespace a `CloudFunction2.function` parameter is relative
 * to. `CloudFunctionAdapter` looks up `'/#__cloud__/' + parameters.function`, and
 * renames a function node's parameter by stripping the same prefix.
 */
export const CLOUD_COMPONENT_PREFIX = '/#__cloud__/';

/** What one component offers the adapters that read it. */
export interface DerivedPorts {
  /** `in-…` names, from every `noodl.cloud.request` this component holds. */
  cloudInputs: string[];
  /** `out-…` names, from every `noodl.cloud.response` this component holds. */
  cloudOutputs: string[];
  /** `pm-…` names, from every `PageInputs` this component holds. */
  pageParams: string[];
  /** Whether it holds a `noodl.cloud.request` at all — "no declaration" is not "an empty one". */
  hasCloudRequest: boolean;
  /** Whether it holds a `PageInputs` at all. */
  hasPageInputs: boolean;
}

export type DerivedPortIndex = ReadonlyMap<string, DerivedPorts>;

function namesOf(parameters: Record<string, unknown> | null | undefined, key: string): string[] {
  return parseNameList(parameters?.[key], key).names;
}

/**
 * Every component's adapter-minted port names, from the same views
 * {@link componentInterfaces} and {@link declaredUrlPaths} are built from.
 *
 * One builder from one list, so a component a plan is about to create resolves
 * here exactly when it resolves as a navigation target — the discipline LAS-001
 * established and the reason a correct multi-component plan validates instead of
 * being charged for the order its operations happened to run in.
 *
 * ⚠️ The adapters differ in reach and this deliberately does not reproduce that.
 * `CloudFunctionAdapter` collects requests with `getNodesWithType` and responses
 * with `getNodesWithTypeRecursive`; a view is a flat node list, so both are read
 * flat here. The difference can only make this index a **superset** of the
 * adapter's names, and a superset can only make the check accept a wire it might
 * have refused — never refuse one the editor accepts. That is the safe direction
 * for a gate, and it is the reason to state it rather than hide it.
 */
export function derivedPortIndex(views: readonly ComponentNodesView[]): DerivedPortIndex {
  const index = new Map<string, DerivedPorts>();
  for (const view of views) {
    const cloudInputs = new Set<string>();
    const cloudOutputs = new Set<string>();
    const pageParams = new Set<string>();
    let hasCloudRequest = false;
    let hasPageInputs = false;

    for (const node of view.nodes) {
      if (node.type === CLOUD_REQUEST_TYPE) {
        hasCloudRequest = true;
        for (const name of namesOf(node.parameters, 'params')) cloudInputs.add(name);
      } else if (node.type === CLOUD_RESPONSE_TYPE) {
        for (const name of namesOf(node.parameters, 'params')) cloudOutputs.add(name);
      } else if (node.type === PAGE_INPUTS_TYPE) {
        hasPageInputs = true;
        for (const name of namesOf(node.parameters, 'pathParams')) pageParams.add(name);
        for (const name of namesOf(node.parameters, 'queryParams')) pageParams.add(name);
      }
    }

    const entry: DerivedPorts = {
      cloudInputs: [...cloudInputs],
      cloudOutputs: [...cloudOutputs],
      pageParams: [...pageParams],
      hasCloudRequest,
      hasPageInputs
    };
    index.set(view.name, entry);
    // A cloud function is addressed by its bare name on `CloudFunction2.function`
    // and by its full legacy name everywhere else. Both spellings key the same
    // entry, the way `componentInterfaceIndex` keys both of its name forms.
    if (view.name.startsWith(CLOUD_COMPONENT_PREFIX)) {
      index.set(view.name.slice(CLOUD_COMPONENT_PREFIX.length), entry);
    }
  }
  return index;
}

/** The nodes this check reads: a type, and the parameter naming its target. */
export interface DerivedPortNodeLike {
  id: string;
  type: string;
  label?: string;
  parameters?: Record<string, unknown> | null;
  ports?: readonly { name?: unknown }[] | null;
}

export interface CheckDerivedPortTargetsOptions {
  /** Component identifier for the diagnostics' location. */
  component: string;
  /** Every component's adapter-minted ports, from {@link derivedPortIndex}. */
  derived: DerivedPortIndex;
  /**
   * The candidate's connections. **Omitted means "do not check"** — the
   * convention every option in this layer follows.
   */
  wires?: readonly ConnectionLike[];
  /** Severity for these findings. Defaults to `error`. */
  severity?: Severity;
}

/** The ports a node declares on itself, which `NodeGraphNode.getPorts` also honours. */
function ownPortNames(node: DerivedPortNodeLike): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(node.ports)) return out;
  for (const port of node.ports) {
    if (port && typeof port === 'object' && typeof port.name === 'string') out.add(port.name);
  }
  return out;
}

interface Subject {
  /** The port prefix this endpoint must carry to be this check's business. */
  prefix: string;
  /** The names the adapter would mint, without the prefix. */
  available: string[];
  /** Where the author declares them, for the message. */
  declaredBy: string;
  /** The component the names came from. */
  target: string;
  consequence: string;
}

function subjectFor(
  node: DerivedPortNodeLike,
  derived: DerivedPortIndex,
  end: 'to' | 'from'
): Subject | undefined {
  if (node.type === CLOUD_FUNCTION_TYPE) {
    const fn = node.parameters?.['function'];
    if (typeof fn !== 'string' || fn.length === 0) return undefined;
    const entry = derived.get(fn) ?? derived.get(CLOUD_COMPONENT_PREFIX + fn);
    // No declaration is not an empty declaration: without a request node there
    // is nothing here to be wrong about, and the target may not be a function.
    if (!entry || !entry.hasCloudRequest) return undefined;
    return end === 'to'
      ? {
          prefix: CLOUD_INPUT_PREFIX,
          available: entry.cloudInputs,
          declaredBy: `the "params" of its ${CLOUD_REQUEST_TYPE} node`,
          target: fn,
          consequence:
            'The value is never sent, so the function runs with that parameter undefined — and a required ' +
            'parameter missing is a failure the caller sees as a refusal it did not cause.'
        }
      : {
          prefix: CLOUD_OUTPUT_PREFIX,
          available: entry.cloudOutputs,
          declaredBy: `the "params" of its ${CLOUD_RESPONSE_TYPE} nodes`,
          target: fn,
          consequence: 'The port never fires, so whatever reads the result never updates and the screen stays as it was.'
        };
  }

  if (node.type === ROUTER_NAVIGATE_TYPE && end === 'to') {
    const target = node.parameters?.['target'];
    if (typeof target !== 'string' || target.length === 0) return undefined;
    const entry = derived.get(target);
    if (!entry || !entry.hasPageInputs) return undefined;
    return {
      prefix: PAGE_PARAM_PREFIX,
      available: entry.pageParams,
      declaredBy: `the "pathParams" and "queryParams" of its ${PAGE_INPUTS_TYPE} node`,
      target,
      consequence:
        'The parameter never reaches the page, so it opens with that value missing — typically an empty ' +
        'detail screen, because the record it was meant to look up was never named.'
    };
  }

  return undefined;
}

/**
 * Connections naming an `in-…`, `out-…` or `pm-…` port no adapter would mint.
 *
 * One diagnostic per offending endpoint, carrying the real names as
 * `alternatives` and the nearest as `suggestion` — the "did you mean" shape the
 * LAS-001 audit measured a 100% self-correction rate on.
 */
export function checkDerivedPortTargets(
  nodes: readonly DerivedPortNodeLike[],
  options: CheckDerivedPortTargetsOptions
): Diagnostic[] {
  const { component, derived, wires, severity = 'error' } = options;
  if (!wires || wires.length === 0) return [];

  const byId = new Map<string, DerivedPortNodeLike>();
  for (const node of nodes) {
    if (node.type === CLOUD_FUNCTION_TYPE || node.type === ROUTER_NAVIGATE_TYPE) byId.set(node.id, node);
  }
  if (byId.size === 0) return [];

  const diagnostics: Diagnostic[] = [];

  for (const wire of wires) {
    const endpoints: Array<{ id: string; port: string; end: 'to' | 'from'; plug: 'input' | 'output'; field: string }> = [
      { id: wire.toId, port: wire.toProperty, end: 'to', plug: 'input', field: 'toProperty' },
      { id: wire.fromId, port: wire.fromProperty, end: 'from', plug: 'output', field: 'fromProperty' }
    ];

    for (const { id, port, end, plug, field } of endpoints) {
      const node = byId.get(id);
      if (!node) continue;
      if (typeof port !== 'string' || port.length === 0) continue;

      const subject = subjectFor(node, derived, end);
      if (!subject) continue;
      // Not prefixed: a static port from the catalog, and not this check's
      // business. The prefix is what makes a name decidably adapter-owned.
      if (!port.startsWith(subject.prefix)) continue;

      const bare = port.slice(subject.prefix.length);
      if (subject.available.includes(bare)) continue;
      if (ownPortNames(node).has(port)) continue;

      const label = node.label ? `"${node.label}"` : node.type;
      const declared =
        subject.available.length === 0
          ? `${subject.target} declares none`
          : `${subject.target} declares ${subject.available.length}: ` +
            subject.available
              .slice(0, MAX_ALTERNATIVES)
              .map((n) => `"${n}"`)
              .join(', ');
      const prefixed = subject.available.map((n) => subject.prefix + n);

      diagnostics.push({
        code: DiagnosticCode.ConnectionUnknownDerivedPort,
        severity,
        message:
          `Connection names ${plug === 'input' ? 'input' : 'output'} "${port}" on ${label}, but no such port ` +
          `exists: ${node.type} takes its "${subject.prefix}…" ports from ${subject.declaredBy}, and ` +
          `${declared}. ${subject.consequence}`,
        location: {
          component,
          nodeId: id,
          nodeType: node.type,
          nodeLabel: node.label,
          port,
          plug,
          connection: {
            fromId: wire.fromId,
            fromProperty: wire.fromProperty,
            toId: wire.toId,
            toProperty: wire.toProperty
          }
        },
        suggestion:
          nearest(port, prefixed) ??
          (prefixed.length > 0
            ? `Write ${field} as one of ${prefixed.slice(0, 6).join(', ')}.`
            : `Declare "${bare}" on ${subject.declaredBy} first, or remove this connection.`),
        alternatives: prefixed.slice(0, MAX_ALTERNATIVES)
      });
    }
  }

  return diagnostics;
}
