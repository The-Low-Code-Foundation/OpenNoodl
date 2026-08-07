/**
 * SUB-007: the semantic diff the version-control panel renders alongside the
 * file-level one.
 *
 * `projectmerger.diff` answers "which components differ"; this answers "what
 * did they do to them". Both sides of the comparison are already loaded by
 * every caller, so this is a pure function over two project JSONs.
 */

import { diffProjects } from '@noodl-versioning';
import type { ComponentDiff } from '@noodl-versioning';

export interface GraphProjectDiff {
  addedComponents: string[];
  removedComponents: string[];
  changedComponents: ComponentDiff[];
}

/**
 * Never let a diff failure take down the panel: the file-level diff is the
 * load-bearing view, and this one is an enrichment of it.
 */
export function safeGraphDiff(base: unknown, target: unknown): GraphProjectDiff | undefined {
  try {
    return diffProjects(
      (base ?? {}) as Record<string, unknown>,
      (target ?? {}) as Record<string, unknown>
    ) as GraphProjectDiff;
  } catch (error) {
    console.error('Failed to compute the semantic graph diff', error);
    return undefined;
  }
}
