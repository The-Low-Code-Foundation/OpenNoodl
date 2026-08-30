/**
 * DEF-012 §2 (P76 SB-011 §2) — a cloud query that fetches before its filter can arrive.
 *
 * A Query Records node runs the instant the graph is built: `setCollectionName` and
 * `setVisualFilter` each call `scheduleFetch` when their run-on-change box is ticked, and
 * *absent means ticked* (`run-on-value-change.ts::runOnValueChange`). Both are parameters,
 * applied at node-creation time — so in a cloud function the query fires before any request
 * value can have reached a `qp-` port. A rule whose connected value is missing is DROPPED
 * rather than failed (`queryutils.ts` — `dropUnresolvedConnected: true`, the optional-filter
 * contract every graph relies on), so that first fetch returns **every row in the class**,
 * fires `fetched`, and whatever is wired downstream acts on the unfiltered result. The
 * narrowed re-query arrives a pass later, after the damage. Measured on a real backend
 * (SB-004 §7): publishing one page flipped the access rules on every Section in the site,
 * with the correct filter sitting in the file.
 *
 * The repair is SB-004's own workaround, pinned in `sb004Authoring.test.ts`: set
 * `runOnChange-collectionName: false` and `runOnChange-querySettings: false`, leaving the
 * filter parameter's own arrival as the only trigger — the one ordering that cannot invert.
 * The `qp-` port's own run-on-change box stays ON; it *is* the trigger.
 *
 * ## Why this is a door precondition and not a runtime change
 *
 * SB-011 §2's candidate — "wait until the parameters have been supplied" — collides with the
 * optional-filter contract: the runtime cannot distinguish *not yet arrived* from
 * *deliberately absent*, so waiting would leave an optional-filter query never running at
 * all. What CAN be decided is decidable from the authored graph, at authoring time, where
 * the fix is two properties.
 *
 * ## The predicate, and why each abstention abstains
 *
 * Fires when ALL of:
 *  - the component is a cloud function (`/#__cloud__/` name) — in a browser graph the same
 *    first fetch is long-standing behaviour whose result is usually re-rendered a moment
 *    later, and rewiring that is a corpus decision this rule does not claim;
 *  - the node is a `DbCollection2` whose `collectionName` is an authored parameter — a
 *    WIRED collection name means the fetch fires on that wire's arrival, and whether the
 *    filter values land in the same update pass is not decidable from the graph → abstain;
 *  - its `visualFilter` parameter names at least one connected value (either saved shape),
 *    and at least one such `qp-` port actually carries a wire — a filter of static values
 *    narrows the load-time fetch correctly, and a connected rule with NO wire never narrows
 *    anything in any pass (a different absence, not a timing inversion, not claimed here);
 *  - either run-on-change box is not authored `false` — the exact runtime contract
 *    (`state[input] !== false` means run).
 *
 * With both boxes `false` the rule is silent whatever else is wired: a `Do` wire beside the
 * workaround is an authored trigger whose ordering the author owns.
 *
 * ## Severity
 *
 * A **warning**, deliberately not in `AUTHORED_BLOCKING_WARNINGS` on first ship — the
 * layout pair's argument: promotion is earned on corpus evidence
 * (`npm run calibrate:query-timing`), and the population includes graphs that tolerate the
 * extra fetch. The non-promotion is pinned in the spec so a later edit cannot promote
 * silently.
 *
 * The filter-parameter traversal below is duplicated from `@noodl/runtime`'s
 * `queryutils.ts::collectFilterParameters` rather than imported, for the reason
 * `CatalogIndex`'s `runOnChange-` prefix is copied: this layer runs in the editor, in the
 * MCP server and in a CLI, and must not pull the runtime in. Both saved filter shapes are
 * read for the reason that function reads both — a deployed project may still hold the
 * pre-BCN-003b `{combinator, rules}` shape. `queryBeforeFilter.test.ts` runs both
 * implementations over the same shapes and fails the day they disagree.
 *
 * Pure: the caller supplies nodes and the component's wires.
 *
 * @module noodl-editor/validation/queryBeforeFilter
 */

import type { CatalogIndex } from './CatalogIndex';
import { DiagnosticCode, type Diagnostic } from './diagnostics';
import type { FunctionWireLike } from './functionPorts';
import type { ParameterizedNode } from './parameterValues';

/** The cloud component name prefix, as `componentRuntimeOf` reads it. */
const CLOUD_PREFIX = '/#__cloud__/';

/** The Query Records node's stored type name. The spec pins it against the real catalog. */
export const QUERY_NODE_TYPE = 'DbCollection2';

/** The Query Records family's filter-parameter port prefix (`collectFilterParameters`' caller). */
const QUERY_PARAM_PREFIX = 'qp-';

/** The two parameter-applied inputs whose ticked box schedules the load-time fetch. */
const FETCH_TRIGGER_BOXES = ['collectionName', 'querySettings'] as const;

/**
 * The connected filter-parameter names of a `visualFilter` value, in either saved shape —
 * duplicated from `collectFilterParameters` (see the module docblock for why). Unlike the
 * runtime's copy this collects only CONNECTED values: in the old visual shape a leaf's
 * `input` exists exactly when the rule reads a port; in the new saved shape the leaf says
 * `valueSource: 'connected'` and carries the prefixed port name.
 */
export function connectedFilterParameterNames(visualFilter: unknown): string[] {
  const names: string[] = [];
  const add = (name: string) => {
    if (name && !names.includes(name)) names.push(name);
  };

  function walkVisual(node: Record<string, unknown> | undefined): void {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.rules)) node.rules.forEach((r) => walkVisual(r as Record<string, unknown>));
    else if (typeof node.input === 'string') add(node.input);
  }

  function walkSaved(item: Record<string, unknown> | undefined): void {
    if (!item || typeof item !== 'object') return;
    if (item.type === 'and' || item.type === 'or') {
      const conditions = Array.isArray(item.conditions) ? item.conditions : [];
      conditions.forEach((c) => walkSaved(c as Record<string, unknown>));
      return;
    }
    if (item.valueSource !== 'connected' || typeof item.valuePortName !== 'string') return;
    const port = item.valuePortName;
    add(port.startsWith(QUERY_PARAM_PREFIX) ? port.slice(QUERY_PARAM_PREFIX.length) : port);
  }

  if (!visualFilter || typeof visualFilter !== 'object') return names;
  const query = visualFilter as Record<string, unknown>;
  // `isVisualQueryFormat`: an array `conditions` is the new shape regardless of other keys.
  const isVisual =
    !Array.isArray(query.conditions) &&
    (query.combinator !== undefined || query.property !== undefined || query.operator !== undefined);
  if (isVisual) walkVisual(query);
  else walkSaved(query);
  return names;
}

export interface CheckQueryBeforeFilterOptions {
  /** Legacy name of the component being submitted. */
  component: string;
  /** Every connection in the component; the rule reads which `qp-` ports carry a wire. */
  wires?: readonly FunctionWireLike[];
  /** Used only to age {@link QUERY_NODE_TYPE} loudly — a renamed type stops the rule firing. */
  catalog?: CatalogIndex;
}

/**
 * DEF-012 §2 — a cloud Query Records node whose filter reads connected parameters, but whose
 * run-on-change boxes (at the default) fetch the moment the graph is built, before any
 * parameter value can exist. The first result is every row in the class.
 */
export function checkQueryBeforeFilter(
  nodes: readonly ParameterizedNode[],
  options: CheckQueryBeforeFilterOptions
): Diagnostic[] {
  const { component, wires, catalog } = options;
  if (!component.startsWith(CLOUD_PREFIX)) return [];
  if (!wires || wires.length === 0) return [];
  if (catalog && !catalog.getNode(QUERY_NODE_TYPE)) return [];

  const diagnostics: Diagnostic[] = [];
  for (const node of nodes) {
    if (node.type !== QUERY_NODE_TYPE) continue;
    const parameters = node.parameters ?? {};

    // A wired collection name fetches on the wire's arrival — ordering unknowable, abstain.
    const collection = parameters['collectionName'];
    if (typeof collection !== 'string' || collection.length === 0) continue;

    const filterNames = connectedFilterParameterNames(parameters['visualFilter']);
    const connected = filterNames.filter((name) =>
      wires.some((w) => w.toId === node.id && w.toProperty === QUERY_PARAM_PREFIX + name)
    );
    if (connected.length === 0) continue;

    // The exact runtime contract: absent means ticked (`runOnValueChange`).
    const openBoxes = FETCH_TRIGGER_BOXES.filter((input) => parameters['runOnChange-' + input] !== false);
    if (openBoxes.length === 0) continue;

    const ports = connected.map((name) => QUERY_PARAM_PREFIX + name).join(', ');
    diagnostics.push({
      code: DiagnosticCode.QueryFetchesBeforeItsFilter,
      severity: 'warning',
      message:
        `This Query Records node filters "${collection}" on connected parameters (${ports}), but its ` +
        'run-on-change boxes are at the default, so it fetches the moment the graph is built — before any ' +
        'value can have reached those ports. An unsupplied connected rule is dropped rather than failed, so ' +
        `that first fetch returns every row in "${collection}" and fires fetched on the unfiltered result; ` +
        'the narrowed re-query arrives a pass later, after downstream nodes have already acted. Set ' +
        '"runOnChange-collectionName": false and "runOnChange-querySettings": false, so the filter ' +
        "parameter's own arrival is the only trigger — an ordering that cannot invert. Leave the " +
        'parameter port\'s own run-on-change box on; no Do wire is needed.',
      location: {
        component,
        nodeId: node.id,
        nodeType: node.type,
        ...(node.label ? { nodeLabel: node.label } : {}),
        port: 'runOnChange-' + openBoxes[0],
        plug: 'input' as const
      },
      suggestion: '"runOnChange-collectionName": false, "runOnChange-querySettings": false'
    });
  }

  return diagnostics;
}
