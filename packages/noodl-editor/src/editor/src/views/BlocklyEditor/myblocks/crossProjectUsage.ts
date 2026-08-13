/**
 * VFN-010 — where a backpack block is used, across the projects the launcher can actually see.
 *
 * ## 🔴 The number is real, its scope is stated, and the warning does not depend on it
 *
 * The report asked for *"this block is placed in 2 projects in 8 places"*. That number requires
 * opening and parsing every project the builder has, and the launcher only knows the ones in its
 * **recent-projects store** — which is a list of places it has been, not an inventory of everywhere
 * the block is.
 *
 * So this counts what it can count, records **which projects it counted**, and the sentences in
 * `libraryIntent.ts` say both. A count presented as a total when it is a sample is a warning that
 * teaches the builder to distrust warnings, and this register already carries a guard that was
 * decoration and a cost model that argued against its own best feature.
 *
 * Three properties, all deliberate and all held by `tests-unit/vfn-010`:
 *
 * 1. `scanned` lists every project that was read, by name — so the sentence can name them.
 * 2. `unreadable` lists every project that was **not** read, and why — a project that was skipped
 *    is not a project where the block is absent, and silently folding the two together is how a
 *    sample starts looking like a census.
 * 3. `siteCount` and `projectCount` describe `scanned` only, and nothing else.
 *
 * ## One authority, again
 *
 * `scanNodeUsage` — VFN-009's, unchanged — does the actual reference finding, once per project.
 * The alternative is a second parser that eventually disagrees with the editor about whether a
 * block is in use, and a disagreement in that direction is a delete the launcher allowed.
 *
 * @module BlocklyEditor/myblocks
 */

import { distinctSites, scanNodeUsage, type DefinitionUsage, type ProjectScan, type UsageSite } from './usage';

/** One project the launcher managed to read, reduced to what a usage scan needs. */
export interface ProjectSnapshot {
  /** `ProjectItem.id` from the recent-projects store, when there is one. */
  id?: string;
  name: string;
  /** The folder on disk. The identity that survives two projects sharing a name. */
  path: string;
  scan: ProjectScan;
}

/** One project the launcher could **not** read, and why. Never counted as an absence. */
export interface UnreadableProject {
  name: string;
  path: string;
  /** In the builder's words, not an exception's. */
  reason: string;
}

/** Where a definition is used inside one project. */
export interface ProjectUsage {
  projectId?: string;
  projectName: string;
  projectPath: string;
  /** Distinct nodes, in scan order. One node calling a block twice is one site. */
  sites: UsageSite[];
}

export interface CrossProjectUsage {
  definitionId: string;
  /** Every project that was read, in the order it was read. */
  scanned: { id?: string; name: string; path: string }[];
  /** Every project that was not read. Reported, never folded into `scanned`. */
  unreadable: UnreadableProject[];
  /** Only the projects where the definition was actually found. */
  projects: ProjectUsage[];
  /** How many of `scanned` use it. */
  projectCount: number;
  /** How many distinct nodes across all of them. The "8 places" of the report. */
  siteCount: number;
  /** When the check ran. Shown beside the answer, because the answer goes stale. */
  checkedAt: string;
}

/**
 * The definition's usage across a set of project snapshots.
 *
 * @param scannedAt injectable so a spec asserts on the timestamp rather than around it.
 */
export function crossProjectUsage(
  definitionId: string,
  snapshots: readonly ProjectSnapshot[],
  unreadable: readonly UnreadableProject[] = [],
  scannedAt: () => string = () => new Date().toISOString()
): CrossProjectUsage {
  const scanned: CrossProjectUsage['scanned'] = [];
  const projects: ProjectUsage[] = [];

  for (const snapshot of snapshots ?? []) {
    if (!snapshot) continue;
    scanned.push({ id: snapshot.id, name: snapshot.name, path: snapshot.path });

    const byDefinition = scanNodeUsage(snapshot.scan);
    const raw = byDefinition.get(definitionId) ?? [];
    if (raw.length === 0) continue;

    // Deduplicated through VFN-009's own helper, so "8 places" means eight nodes and not eight
    // call blocks — a node that calls the same saved block three times is one place to go and look.
    const sites = distinctSites({ nodes: raw } as DefinitionUsage);

    projects.push({
      projectId: snapshot.id,
      projectName: snapshot.name,
      projectPath: snapshot.path,
      sites
    });
  }

  return {
    definitionId,
    scanned,
    unreadable: Array.from(unreadable ?? []),
    projects,
    projectCount: projects.length,
    siteCount: projects.reduce((total, project) => total + project.sites.length, 0),
    checkedAt: scannedAt()
  };
}

/**
 * The node ids for `MyBlocksStore.remove`'s refusal.
 *
 * ⚠️ **Node ids are unique within a project and not across projects.** They are only ever handed
 * to `remove`, which counts them and names nothing, so a collision would over-count a refusal that
 * was going to refuse anyway. The *names* in the refusal come from {@link CrossProjectUsage}, which
 * keeps its sites grouped by project precisely so that the sentence can say which project.
 */
export function crossProjectNodeIds(usage: CrossProjectUsage): string[] {
  const ids: string[] = [];
  for (const project of usage.projects) {
    for (const site of project.sites) ids.push(site.nodeId);
  }
  return ids;
}

/** An empty result for a definition nothing has been checked for yet. Never a *found nothing*. */
export function noCrossProjectCheck(definitionId: string): CrossProjectUsage {
  return {
    definitionId,
    scanned: [],
    unreadable: [],
    projects: [],
    projectCount: 0,
    siteCount: 0,
    checkedAt: ''
  };
}

/**
 * Whether a result is an answer at all.
 *
 * 🔴 The distinction the whole surface rests on: `siteCount === 0` after scanning four projects is
 * a **finding**; `siteCount === 0` before scanning anything is an **absence of a finding**, and
 * rendering the two the same way is how "Not used anywhere" gets said about a check that never ran.
 */
export function wasChecked(usage: CrossProjectUsage): boolean {
  return usage.checkedAt !== '' && (usage.scanned.length > 0 || usage.unreadable.length > 0);
}
