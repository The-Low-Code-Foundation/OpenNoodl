/**
 * DEF-010 (SB-009) — a component named in a `component`-typed PARAMETER resolves,
 * or the author is told.
 *
 * A component can be named two ways. As a node **type** (`/Card` as an instance),
 * which `unresolved-component-ref` and `checkRuntimeContext` have gated since
 * SB-001. And as the **value of a `component`-typed parameter** — `Run Tasks`'
 * `taskTemplate`, `Show Popup`'s `target`, the seven `repeaterComponent` ports —
 * which, before this check, was gated for exactly one of the catalog's thirteen
 * such ports (`For Each.template`, by `checkRepeaterTemplate`).
 *
 * The consequence of the gap is the silent kind, measured by SB-009 s2: a cloud
 * `Run Tasks` naming a helper that does not exist validates `0/0/0`, deploys,
 * iterates over nothing and reports success having done no work — `publishPage`
 * returning 200 having published no sections.
 *
 * ## The population is the catalog, not a list of node types
 *
 * The check asks `portTypeShape(catalog.getPort(type, 'input', key)).name ===
 * 'component'` for every authored parameter, so port fourteen is covered on the
 * day it is added. Two node populations are deliberately NOT here:
 *
 *  - 🔴 **(`For Each`, `template`) is skipped.** It has a dedicated owner with
 *    better messages and the children logic (`checkRepeaterTemplate`), and a
 *    second producer over one population is a duplicate first — counts double,
 *    suites stay green. The spec asserts cardinality: exactly one diagnostic
 *    for the `For Each` case.
 *  - `RouterNavigate`/`PageStackNavigate` targets are router-driven dynamic
 *    ports with **no static catalog port**, so a catalog-typed sweep cannot see
 *    them — `checkNavigation` owns those by hardcoded type set, and that split
 *    is why both checks exist.
 *
 * Two findings:
 *
 *  - names a component the project does not have →
 *    {@link DiagnosticCode.ComponentParameterUnresolved} (severity from options,
 *    default `warning` — the blocking decision is a corpus measurement, SB-009 §"Open decision")
 *  - names one whose runtime differs from the owning component's →
 *    {@link DiagnosticCode.WrongRuntimeNode} (reuse: identical concept, already
 *    blocking for the instance case since SB-001)
 *
 * Wired ports are skipped (`connectedInputs`, the convention every value check
 * here follows), and a node whose type the catalog does not know is skipped —
 * `checkParameterValues` already emits an `unknownTypeSkip` naming it, and two
 * notices for one fact is what CN-002 forbids.
 *
 * @module noodl-editor/validation/componentRefParameters
 */

import type { CatalogIndex } from './CatalogIndex';
import { DiagnosticCode, type Diagnostic, type Severity } from './diagnostics';
import { refToPath } from './model';
import { portTypeShape, type ParameterizedNode } from './parameterValues';
import { REPEATER_TYPE } from './repeaterTemplate';
import { componentRuntimeOf } from './runtimeContext';

export interface CheckComponentRefParametersOptions {
  /** Legacy name of the component being submitted, e.g. `/#__cloud__/publishPage`. */
  component: string;
  /**
   * Every component name a `component`-typed parameter could legitimately name.
   * **Omitted means "do not check resolution"** — the convention
   * `checkRepeaterTemplate.components` follows; the runtime comparison still
   * runs, because it needs only the value's own spelling.
   */
  components?: readonly string[];
  /** The catalog the port types are read from. */
  catalog: CatalogIndex;
  /** Input ports carrying a wire, as `` `${nodeId}::${port}` ``. */
  connectedInputs?: ReadonlySet<string>;
  /** Severity for the unresolved finding. Defaults to `warning`. */
  severity?: Severity;
}

/** How many alternatives a message will offer before it stops being readable. */
const MAX_ALTERNATIVES = 24;

/** The runtime a component reference would resolve into, from its spelling alone. */
function runtimeOfRef(ref: string): 'browser' | 'cloud' {
  return refToPath(ref).startsWith('__cloud__/') ? 'cloud' : 'browser';
}

export function checkComponentRefParameters(
  nodes: readonly ParameterizedNode[],
  options: CheckComponentRefParametersOptions
): Diagnostic[] {
  const { component, components, catalog, connectedInputs, severity = 'warning' } = options;
  const diagnostics: Diagnostic[] = [];
  const known = components ? new Set(components.flatMap((name) => [name, refToPath(name)])) : undefined;
  const hostRuntime = componentRuntimeOf(component);

  for (const node of nodes) {
    if (typeof node.type !== 'string' || !node.parameters) continue;
    // The owner of (`For Each`, `template`) — and of nothing else — is
    // checkRepeaterTemplate. Skipping the node rather than the port keeps the
    // cardinality argument simple: `For Each` has exactly one component-typed
    // port, so node and pair are the same population.
    if (node.type === REPEATER_TYPE) continue;
    if (!catalog.hasType(node.type)) continue;

    for (const [key, raw] of Object.entries(node.parameters)) {
      if (typeof raw !== 'string' || raw.trim() === '') continue;
      const port = catalog.getPort(node.type, 'input', key);
      if (portTypeShape(port)?.name !== 'component') continue;
      if (connectedInputs?.has(`${node.id}::${key}`)) continue;

      const value = raw.trim();
      const location = {
        component,
        nodeId: node.id,
        nodeType: node.type,
        ...(node.label ? { nodeLabel: node.label } : {}),
        port: key,
        plug: 'input' as const
      };

      if (known && !known.has(value) && !known.has(refToPath(value))) {
        diagnostics.push({
          code: DiagnosticCode.ComponentParameterUnresolved,
          severity,
          message:
            `This node's "${key}" names ${JSON.stringify(value)}, which is not a component in this project, ` +
            'so at run time it resolves to nothing and the node silently does no work per item. ' +
            'It may have been renamed, moved, or not created yet.',
          location,
          alternatives: [...(known ?? [])].filter((n) => n.startsWith('/')).slice(0, MAX_ALTERNATIVES)
        });
        continue;
      }

      const targetRuntime = runtimeOfRef(value);
      if (targetRuntime !== hostRuntime) {
        diagnostics.push({
          code: DiagnosticCode.WrongRuntimeNode,
          severity: 'warning',
          message:
            `This node's "${key}" names ${JSON.stringify(value)}, a ${targetRuntime} component, from a ` +
            `${hostRuntime} graph. The ${hostRuntime} runtime cannot register it, so the node finds no ` +
            'component at run time and silently does no work. Name a component on the same side of the ' +
            '`/#__cloud__/` boundary as this graph.',
          location
        });
      }
    }
  }

  return diagnostics;
}
