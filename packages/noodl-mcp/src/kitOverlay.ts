/**
 * CN-003 slice 2b — installing the project overlay into *this server's* catalog.
 *
 * The reading is `kitExtract/extract.ts`, which knows nothing about any catalog
 * because two pipelines consume it (see its header). This module is the MCP
 * server's half: it holds the session's overlay and hands the node list to
 * `catalog.ts`, so `catalogIndex()` — and therefore validation, `visualRoots`,
 * `get_node_type`, `list_node_types` and the write gate — knows the bound
 * project's own node types.
 *
 * @module noodl-mcp/kitOverlay
 */

import { setCatalogOverlay } from './catalog';
import { extractProjectOverlay } from './kitExtract/extract';
import type { ProjectKitOverlay } from './kitExtract/extract';

// Re-exported so callers have one import for "the kit overlay" and the split
// between reading and installing stays an implementation detail.
export { extractProjectOverlay, resolveKitExtractEntry } from './kitExtract/extract';
export type { KitFailure, KitSummary, ProjectKitOverlay } from './kitExtract/extract';

/**
 * The overlay this server session is serving, or null before one is installed.
 *
 * Held here rather than in `catalog.ts` because everything but the node list is
 * provenance — which kits loaded, which failed, whether extraction ran at all —
 * and the catalog has no business carrying it. `get_project_info` reads this.
 */
let installed: ProjectKitOverlay | null = null;

export function currentKitOverlay(): ProjectKitOverlay | null {
  return installed;
}

/**
 * Extract for `projectDir` and make the result the catalog's overlay.
 *
 * Called once when a project is bound — at server construction, and again from
 * `create_project` when that binds a fresh one (BST-002). Idempotent for the
 * same directory: re-installing would re-run the child for an answer we already
 * have, and D3's "only one process ever executes project kit code" is easier to
 * keep true by not doing it twice.
 */
export function installProjectOverlay(projectDir: string): ProjectKitOverlay {
  if (installed && installed.projectDir === projectDir) return installed;
  installed = extractProjectOverlay(projectDir);
  setCatalogOverlay(installed.nodes);
  return installed;
}

/** For the suite: forget the session's overlay and put the catalog back to built-ins only. */
export function clearProjectOverlay(): void {
  installed = null;
  setCatalogOverlay([]);
}
