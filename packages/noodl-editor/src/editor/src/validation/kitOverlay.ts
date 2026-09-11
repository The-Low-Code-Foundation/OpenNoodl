/**
 * CN-003 slice 3 — the editor's half of the project catalog overlay.
 *
 * ## What this is, and what it deliberately is not
 *
 * ✅ **D3**: *the editor extracts nothing.* The viewer it is already talking to
 * has registered the project's kits and sent their definitions over
 * `sendNodeLibrary`; `NodeLibraryImporter` merges that into
 * `window.NodeLibraryData` and `NodeLibrary.instance.library` holds it. This
 * module is a **read of that state**, mapped by the same
 * `catalogNodesFromNodeLibrary` the MCP server's headless extractor feeds. One
 * mapping, two registers — which is why the agreement obligation D3 attached
 * narrows to *do the two registers agree* rather than *do two hand-written
 * mappings agree*.
 *
 * So: no `require` of project code here, no child process, no disk. If a future
 * change makes this file execute a kit, it has broken the ruling.
 *
 * ## 🔴 The one asymmetry between the routes, named rather than hidden
 *
 * A kit may register a type name that already exists — `Text`, say. The register
 * simply overwrites (`noderegister.ts:44`), so **the built-in disappears from
 * the payload** and the surviving entry carries the kit's `module`. Both routes
 * must therefore learn the built-in names from somewhere other than the entry
 * itself:
 *
 * - **MCP route**: `entry.js` snapshots `Object.keys(nodeRegister._constructors)`
 *   *before* any kit runs. Exact.
 * - **Editor route**: there is no such "before" — the payload arrives already
 *   merged. {@link builtinTypeNamesFor} therefore unions two sources that are
 *   both available here: the shipped catalog's type names, and the names of
 *   payload entries carrying no `module` (built-ins, the static cloud library,
 *   workflow step kinds). Together they are strictly more complete than either.
 *
 * The residual gap is a type that is in the viewer's register, is **not** in the
 * shipped catalog (which is a filtered view of that register), and is shadowed
 * by a kit — the MCP route calls that a collision and the editor route would
 * call it a new node. That is a real divergence, and it is exactly what
 * `compareOverlays` exists to *name*: it surfaces as `type-missing`. It is not
 * silently reconciled here, because reconciling it would mean guessing which
 * side is right.
 *
 * @module noodl-editor/validation/kitOverlay
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { catalogNodesFromNodeLibrary } = require('@nodegx/kit-catalog');
import type { NodeLibraryPayload, Overlay, OverlayCatalogNode } from '@nodegx/kit-catalog';

import { defaultCatalog } from './catalog';

export type { NodeLibraryPayload, Overlay, OverlayCatalogNode };

/**
 * The empty answer, shared so callers never build a half-populated one by hand.
 *
 * ⚠️ Empty here always means *this payload declares no kit node types*. It never
 * means "we could not tell" — the editor has no failure mode in between, unlike
 * the MCP route where a missing extractor bundle must be reported as
 * `unavailable` rather than as an answer about the project.
 */
const EMPTY: Overlay = { nodes: [], collisions: [] };

/**
 * Built-in type names, as well as the editor can know them. See the header for
 * why this is a union and what it still cannot see.
 *
 * @param payload the merged node library the editor holds
 */
export function builtinTypeNamesFor(payload: NodeLibraryPayload | null | undefined): Set<string> {
  const names = new Set<string>();
  for (const node of defaultCatalog().nodes) names.add(node.typeName);
  for (const nodeType of payload?.nodetypes ?? []) {
    if (!nodeType.module) names.add(nodeType.name);
  }
  return names;
}

/**
 * Build the project overlay from the node library the viewer already sent.
 *
 * `moduleRuntimes` is not passed: the editor's payload has no manifest in it,
 * and the entries it holds are by construction the ones a *connected runtime*
 * registered. The mapping's default (`['browser']`) is therefore right for the
 * browser viewer, which is the only client that delivers project kits today —
 * a cloud kit would arrive from a cloud client and is CN-013's to get right.
 * The MCP route reads the manifest and can be exact; that difference is
 * confined to `availableIn`, which `compareOverlays` does not compare for this
 * reason.
 */
export function overlayFromNodeLibrary(payload: NodeLibraryPayload | null | undefined): Overlay {
  if (!payload || !Array.isArray(payload.nodetypes) || payload.nodetypes.length === 0) return EMPTY;
  return catalogNodesFromNodeLibrary(payload, {
    builtinTypeNames: builtinTypeNamesFor(payload)
  }) as Overlay;
}
