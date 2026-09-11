/**
 * SB-001 — the runtime-context check: does this component's runtime register
 * every node its graph uses?
 *
 * A component's runtime is its name: `/#__cloud__/…` runs in the cloud runtime,
 * everything else in the browser. The catalog records each node type's
 * registrations as `availableIn` — derived at build time by actually
 * registering every node in every runtime (`scripts/node-catalog`), so it is a
 * measurement, not a declaration. A node outside its list does not error at run
 * time; the runtime simply has no such node, and the graph does nothing where
 * it should act.
 *
 * The editor's interactive surfaces all enforce this (picker, paste,
 * extraction — see {@link DiagnosticCode.WrongRuntimeNode}); this check brings
 * the authored write gates to parity. Three deliberate skips, each because
 * another check owns the case: a node with no `type` (`MalformedNode`), a type
 * the catalog cannot resolve (`UnknownNodeType`/`NodeUncheckable` — a kit node
 * this project has not registered must not be re-reported here), and the
 * `%rootcomponent` marker, which is not a placeable node.
 */

import type { CatalogIndex } from './CatalogIndex';
import { DiagnosticCode, type Diagnostic } from './diagnostics';

/**
 * The strict runtime boundary — `startsWith`, never `includes`.
 * `refFromComponentName` (`functionRefResolution.ts`) and its specs pin that
 * `/Utils/#__cloud__/x` is NOT a cloud component; `inferComponentType`'s bare
 * `includes('__cloud__')` is the known-wrong precedent, not the rule.
 */
export const CLOUD_COMPONENT_PREFIX = '/#__cloud__/';

export type ComponentRuntime = 'browser' | 'cloud';

/** The runtime a component's graph is registered against, from its legacy name. */
export function componentRuntimeOf(legacyName: string): ComponentRuntime {
  return legacyName.startsWith(CLOUD_COMPONENT_PREFIX) ? 'cloud' : 'browser';
}

export interface RuntimeContextNode {
  id: string;
  type: string;
  label?: string;
}

export interface CheckRuntimeContextOptions {
  /** Legacy name of the component being submitted. */
  component: string;
  catalog: CatalogIndex;
  severity?: Diagnostic['severity'];
}

export function checkRuntimeContext(
  nodes: readonly RuntimeContextNode[],
  options: CheckRuntimeContextOptions
): Diagnostic[] {
  const { component, catalog, severity = 'warning' } = options;
  const runtime = componentRuntimeOf(component);
  const diagnostics: Diagnostic[] = [];

  for (const node of nodes) {
    if (typeof node.type !== 'string' || !node.type) continue;
    const where = node.label ? `"${node.label}" (${node.type})` : node.type;

    // A component instance: its runtime is its name, same rule as ours.
    if (node.type.startsWith('/')) {
      if (node.type.startsWith('/%rootcomponent')) continue;
      const instanceRuntime = componentRuntimeOf(node.type);
      if (instanceRuntime === runtime) continue;
      diagnostics.push({
        code: DiagnosticCode.WrongRuntimeNode,
        severity,
        message:
          `${where} is a ${instanceRuntime} component instantiated inside a ${runtime} component — ` +
          `the ${runtime} runtime cannot instantiate it, so nothing renders or runs where it is placed.`,
        location: { component, nodeId: node.id },
        suggestion:
          runtime === 'cloud'
            ? 'A cloud graph can only instantiate other cloud components (under "#__cloud__/"). Move the shared logic into a cloud helper component and instantiate that.'
            : 'Call a cloud function with the "Cloud Function" node instead of instantiating the component.'
      });
      continue;
    }

    const catalogNode = catalog.getNode(node.type);
    if (!catalogNode) continue; // unknown-node-type / node-uncheckable own this.
    const availableIn = (catalogNode as { availableIn?: readonly string[] }).availableIn;
    if (!availableIn || availableIn.length === 0) continue;
    if (availableIn.includes(runtime)) continue;

    diagnostics.push({
      code: DiagnosticCode.WrongRuntimeNode,
      severity,
      message:
        runtime === 'cloud'
          ? `${where} exists only in the ${availableIn.join('/')} runtime, and "${component}" is a cloud ` +
            'component — the cloud runtime has no such node, so the function cannot use it.'
          : `${where} exists only in the ${availableIn.join('/')} runtime, and "${component}" is a browser ` +
            'component — it would ship in the app bundle where no such node exists.',
      location: { component, nodeId: node.id },
      suggestion:
        runtime === 'cloud'
          ? 'Cloud graphs are Request → logic → Response. Use the cloud-capable nodes (records, HTTP, Expression, JavaScriptFunction…) — no visual nodes.'
          : 'Cloud-only nodes belong in a component under "#__cloud__/". Create the logic there and call it with the "Cloud Function" node.'
    });
  }

  return diagnostics;
}
