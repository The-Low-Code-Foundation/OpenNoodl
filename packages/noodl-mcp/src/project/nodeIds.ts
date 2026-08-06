/**
 * Collision-proof node-id allocation for every write this server makes.
 *
 * ── The finding (AAQ-011/F12) ────────────────────────────────────────────────
 *
 * `duplicate-node-id` (SUB-012) is a **project-wide** rule: under `--strict` it
 * errors when one id appears in two components. The write gate is
 * **component-scoped** — `validateCandidate` calls `validateComponent(project,
 * name)`, which by construction reports on one component — so the rule cannot
 * fire at write time even though the candidate is validated inside a whole
 * project. Reproduced exactly against this package's own fixture:
 * `create_component "Pages/Dash"` with ids `page` / `layout` / `title` returned
 * `validation.summary.errors: 0`, and the very next `validate_project --strict`
 * returned **3**, all `duplicate-node-id`, because `/Pages/Home` already used
 * those three ids.
 *
 * ── Why allocation and not a refusal ─────────────────────────────────────────
 *
 * Richard's call, and the cheap correct one: an id written through this server
 * is *allocated* so that it cannot collide, and then the rule has nothing to
 * report. A refusal would be the worse tool — an agent cannot know which ids are
 * free without reading every component in the project first, so "rejected, pick
 * other ids" makes the caller do a project-wide scan that we have already done
 * by the time we could refuse. It is also what the editor does: every path that
 * copies a graph (`ProjectModel` duplicate, `ComponentTemplates`,
 * `RouterAdapter`, the import engine) calls `NodeGraphModel.rekeyAllIds()`,
 * which mints fresh ids and rewrites the connections that pointed at the old
 * ones. This is that mechanism, narrowed to the ids a single write introduces.
 *
 * ⚠️ Rewriting a caller-supplied id is only safe because **a node id is never
 * referenced from outside its own component**. Everything that resolves one
 * lives in the same three files: `connections.json` (`fromId`/`toId`),
 * `nodes.json` (`parent`, `children[]`, `visualRoots[]`). Cross-component
 * references are by component *name* (an instance node's `type`, a router's
 * `pages.routes`, a navigation target) and are untouched by this. So the rewrite
 * is closed over the candidate — which is exactly why it can be done silently.
 * It is still *reported* (`remappedNodeIds`), because a caller that plans to
 * send a follow-up `update_component` keyed on the id it just wrote needs to
 * know the id moved.
 *
 * ── What is deliberately NOT remapped ────────────────────────────────────────
 *
 * Ids the target component already had on disk. A pre-existing cross-component
 * collision is not this write's doing, and the gate's whole policy is "don't
 * make it worse" (see `validate.ts`); churning ids the caller never touched
 * would rewrite a graph it did not ask to change. Only ids **introduced by this
 * write** are candidates for reallocation.
 *
 * Duplicates *within* one payload stay a refusal (`reconcileHierarchy`): two
 * nodes sharing an id in the same component make that component's own
 * connections genuinely ambiguous, and there is no fact of the matter about
 * which node a wire attaches to. Nothing here can guess it.
 *
 * @module noodl-mcp/project/nodeIds
 */

import * as crypto from 'crypto';

import type { ComponentFiles } from '../graph';
import type { ProjectStore } from './ProjectStore';

/** One id this write moved out of the way, and where it went. */
export interface NodeIdRemap {
  from: string;
  to: string;
}

/**
 * Every node id used by a component *other* than `exceptName`.
 *
 * `overlay` (keyed by legacy name) stands in for components that are about to be
 * written but are not on disk yet — the plan-staging case, where the other
 * staged operations are as much a part of "the project" as the files are. It
 * mirrors `authoredProjectViews`, including its rule that a component the
 * registry lists but whose files will not read is skipped rather than fatal: a
 * corrupt neighbour is not a reason to refuse a write, it just means one fewer
 * id we know about.
 *
 * ⚠️ It does not *reuse* `authoredProjectViews`, because `ComponentNodesView`
 * narrows a node to `{ type, parameters }` — the precondition checks never need
 * an id, so the shared view type does not carry one.
 */
export function idsInUseElsewhere(
  store: ProjectStore,
  exceptName: string,
  overlay: ReadonlyMap<string, ComponentFiles> = new Map()
): Set<string> {
  const taken = new Set<string>();
  const seen = new Set<string>();
  const collect = (files: ComponentFiles) => {
    for (const node of files.nodes.nodes) if (typeof node.id === 'string') taken.add(node.id);
  };

  for (const row of store.listComponents()) {
    seen.add(row.legacyName);
    if (row.legacyName === exceptName) continue;
    const staged = overlay.get(row.legacyName);
    if (staged) {
      collect(staged);
      continue;
    }
    try {
      collect(store.readComponent(row.path).files);
    } catch {
      /* unreadable neighbour — skipped, as the shared views do */
    }
  }
  for (const [name, files] of overlay) {
    if (!seen.has(name) && name !== exceptName) collect(files);
  }
  return taken;
}

/**
 * Pick a free id that still reads like the one the caller asked for.
 *
 * `title` → `title-2` → `title-3`. Keeping the caller's word is not cosmetic:
 * these ids are what the next `get_component` shows an agent and what a human
 * reads in the diff, and replacing "title" with a uuid loses that for no gain.
 * Termination is guaranteed — the loop bound exceeds the number of ids that
 * exist, so some candidate in the range must be free.
 */
function mintId(base: string, unavailable: ReadonlySet<string>): string {
  const stem = base.replace(/-\d+$/, '') || 'node';
  const limit = unavailable.size + 2;
  for (let n = 2; n <= limit + 1; n++) {
    const candidate = `${stem}-${n}`;
    if (!unavailable.has(candidate)) return candidate;
  }
  /* istanbul ignore next — unreachable given the bound above; a uuid is the honest fallback. */
  return crypto.randomUUID();
}

/**
 * Rewrite the ids this write introduces that are already in use elsewhere in the
 * project, along with every reference to them inside the candidate.
 *
 * `preserved` is the set of ids the component already had on disk (empty for a
 * create) — those are left alone whatever they collide with.
 *
 * Returns a fresh `ComponentFiles`; the input is not mutated.
 */
export function allocateCollisionFreeIds(
  candidate: ComponentFiles,
  taken: ReadonlySet<string>,
  preserved: ReadonlySet<string> = new Set()
): { files: ComponentFiles; remapped: NodeIdRemap[] } {
  const nodes = candidate.nodes.nodes;
  const own = new Set<string>(nodes.map((n) => n.id));

  // Everything a new id must avoid: ids elsewhere in the project, plus the ids
  // this component is keeping, plus every id we hand out during this pass.
  const unavailable = new Set<string>([...taken, ...own]);
  const rename = new Map<string, string>();

  for (const node of nodes) {
    if (!taken.has(node.id) || preserved.has(node.id)) continue;
    const fresh = mintId(node.id, unavailable);
    unavailable.add(fresh);
    rename.set(node.id, fresh);
  }

  if (rename.size === 0) return { files: candidate, remapped: [] };

  const files: ComponentFiles = JSON.parse(JSON.stringify(candidate));
  const to = (id: string): string => rename.get(id) ?? id;

  for (const node of files.nodes.nodes) {
    node.id = to(node.id);
    if (node.parent !== undefined) node.parent = to(node.parent);
    if (node.children) node.children = node.children.map(to);
  }
  if (files.nodes.visualRoots) files.nodes.visualRoots = files.nodes.visualRoots.map(to);
  for (const connection of files.connections.connections) {
    connection.fromId = to(connection.fromId);
    connection.toId = to(connection.toId);
  }

  return { files, remapped: [...rename].map(([from, id]) => ({ from, to: id })) };
}

/**
 * The store-bound form: work out what the project already uses, then reallocate.
 *
 * `legacyName` is the component being written (excluded from the taken set),
 * `baseline` its on-disk files when this is an update, and `overlay` any other
 * in-flight candidates that must count as part of the project (plan staging).
 */
export function deconflictNodeIds(
  store: ProjectStore,
  legacyName: string,
  candidate: ComponentFiles,
  baseline?: ComponentFiles,
  overlay: ReadonlyMap<string, ComponentFiles> = new Map()
): { files: ComponentFiles; remapped: NodeIdRemap[] } {
  const taken = idsInUseElsewhere(store, legacyName, overlay);
  const preserved = new Set<string>((baseline?.nodes.nodes ?? []).map((n) => n.id));
  return allocateCollisionFreeIds(candidate, taken, preserved);
}

/** The one sentence a caller reads when ids moved. */
export function remapNote(remapped: readonly NodeIdRemap[]): string {
  const list = remapped.map((r) => `${r.from} → ${r.to}`).join(', ');
  return (
    `${remapped.length} node id(s) were already used by another component in this project and were ` +
    `reallocated so ids stay unique project-wide: ${list}. Connections, parent/children and visual roots ` +
    'in this component were rewritten to match — use these ids in follow-up calls.'
  );
}
