/**
 * VFN-010 — a project **on disk** reduced to the same {@link ProjectScan} a live project reduces to.
 *
 * VFN-009's usage scan is already a pure function of a `ProjectScan`, and `MyBlocksProjectScan.ts`
 * produces one from `ProjectModel`. The launcher has no `ProjectModel` — it has a list of folders —
 * so this is the second producer of that same shape, and everything downstream (`scanNodeUsage`,
 * `collectReferences`, the sentences, the delete refusal) is reached unchanged.
 *
 * 🔴 **One authority on what a reference is.** The cross-project count and the in-project count come
 * from the same `collectReferences` through the same `scanNodeUsage`. A launcher that parsed
 * workspaces its own way would eventually disagree with the editor about whether a block is in use,
 * and the disagreement would surface as a delete that the launcher allowed and the project refused.
 *
 * ## Two formats, because both are on disk right now
 *
 * - **legacy** — one `project.json` with `components[].graph.roots[]`, each node nesting its
 *   children. That is what every project made before v2 looks like, and what most of the recent
 *   list still is.
 * - **v2** — `nodegx.project.json` plus `components/<path>/nodes.json`, where `nodes` is a **flat**
 *   array and `children` holds ids rather than nodes. A converter written for one shape and pointed
 *   at the other finds nothing and reports zero, which is exactly the answer that makes a delete
 *   refusal stop refusing.
 *
 * Pure and format-only: the disk read is `MyBlocksRecentProjects.ts`, one directory up, for the
 * same reason `MyBlocksProjectScan.ts` is.
 *
 * @module BlocklyEditor/myblocks
 */

import type { ProjectScan, ScannedComponent, ScannedNode } from './usage';

/** The component's display name — the last segment of its path, never assembled from one. */
export function displayNameOf(path: string): string {
  const trimmed = (path ?? '').trim();
  if (!trimmed) return '';
  const segments = trimmed.split('/').filter((segment) => segment !== '');
  return segments.length > 0 ? segments[segments.length - 1] : trimmed;
}

function nodeFrom(raw: Record<string, unknown>): ScannedNode | undefined {
  const id = raw?.id;
  const typename = raw?.type;
  if (typeof id !== 'string' || typeof typename !== 'string') return undefined;

  const parameters = raw?.parameters as Record<string, unknown> | undefined;
  return {
    id,
    typename,
    label: typeof raw?.label === 'string' ? raw.label : undefined,
    // The `workspace` parameter is read by name in `usage.ts`; this only carries it across.
    workspace: parameters && typeof parameters === 'object' ? parameters['workspace'] : undefined
  };
}

/**
 * Every node in a legacy `graph.roots` tree, flattened.
 *
 * ⚠️ Depth-first over `children`, and **bounded**. A hand-edited or half-written `project.json` can
 * contain a cycle, and an unbounded walk of one in a launcher dialog is a hung launcher. The bound
 * is a visited set rather than a depth cap because a cycle is the failure, not depth.
 */
function flattenLegacyRoots(roots: unknown): ScannedNode[] {
  const nodes: ScannedNode[] = [];
  if (!Array.isArray(roots)) return nodes;

  const seen = new Set<unknown>();
  const stack = roots.slice();

  while (stack.length > 0) {
    const raw = stack.shift();
    if (!raw || typeof raw !== 'object' || seen.has(raw)) continue;
    seen.add(raw);

    const node = nodeFrom(raw as Record<string, unknown>);
    if (node) nodes.push(node);

    const children = (raw as Record<string, unknown>).children;
    if (Array.isArray(children)) stack.push(...children);
  }

  return nodes;
}

/**
 * A legacy `project.json`, as a scan.
 *
 * 🔴 Never throws and never returns a partial silence: a component that will not read contributes
 * an empty entry and the rest of the project is still scanned. A single malformed component making
 * a whole project report zero usage is the input that turns a refusal into a deletion.
 */
export function scanFromLegacyProject(json: unknown): ProjectScan {
  const project = json as { components?: unknown } | null | undefined;
  if (!project || typeof project !== 'object' || !Array.isArray(project.components)) {
    return { components: [] };
  }

  const components: ScannedComponent[] = [];
  for (const raw of project.components) {
    if (!raw || typeof raw !== 'object') continue;
    const component = raw as { name?: unknown; id?: unknown; graph?: { roots?: unknown } };

    // 🔴 In a legacy `project.json` a component's `name` **is** its full path (`/Pages/Checkout`).
    // `ComponentModel.fullName` is the same string, which is why the live scan puts it in `path`.
    const path = typeof component.name === 'string' ? component.name : undefined;

    components.push({
      id: typeof component.id === 'string' ? component.id : undefined,
      name: path ? displayNameOf(path) : undefined,
      path,
      nodes: flattenLegacyRoots(component.graph?.roots)
    });
  }

  return { components };
}

/** One v2 component's two files, as far as a usage scan cares. */
export interface V2ComponentFiles {
  /** The registry path, e.g. `Pages/Home`. */
  path: string;
  /** `component.json`, when it could be read. Only `id` and `displayName` are used. */
  component?: { id?: unknown; displayName?: unknown; name?: unknown } | null;
  /** `nodes.json`. */
  nodes?: { nodes?: unknown } | null;
}

/**
 * A v2 project, as a scan.
 *
 * ⚠️ `nodes` is a **flat** array here and `children` holds ids, so there is no tree to walk — the
 * mistake this function exists to avoid is reusing the legacy walker and silently finding only the
 * roots. Every entry in the array is a node in the component.
 */
export function scanFromV2Components(files: readonly V2ComponentFiles[]): ProjectScan {
  const components: ScannedComponent[] = [];

  for (const file of files ?? []) {
    if (!file || typeof file.path !== 'string') continue;

    const raw = file.nodes?.nodes;
    const nodes: ScannedNode[] = [];
    if (Array.isArray(raw)) {
      for (const entry of raw) {
        if (!entry || typeof entry !== 'object') continue;
        const node = nodeFrom(entry as Record<string, unknown>);
        if (node) nodes.push(node);
      }
    }

    const displayName =
      typeof file.component?.displayName === 'string'
        ? file.component.displayName
        : displayNameOf(file.path);

    components.push({
      id: typeof file.component?.id === 'string' ? file.component.id : undefined,
      name: displayName,
      path: file.path,
      nodes
    });
  }

  return { components };
}
