/**
 * AAQ-011 F12 (editor half) — collision-proof node ids for every AI write.
 *
 * ── The finding, and how it was established ──────────────────────────────────
 *
 * `candidate.ts` mints an id only when the model omits one (`n.id ?? newId()`),
 * so every id the model *does* supply reaches the project verbatim. The register
 * row was filed as a QUESTION rather than a defect, because the editor has four
 * `rekeyAllIds()` callers and if the AI apply path reached one of them there
 * would be no bug at all. It does not: those four are `ProjectModel`'s
 * `duplicateComponent` (projectmodel.ts:341), `ComponentTemplates`,
 * `RouterAdapter` and the import engine (`import-engine/apply.ts:61`). The AI
 * path is `reconstructLegacyComponent` → `ComponentModel.fromJSON` →
 * `project.addComponent`, and none of those three touches an id.
 *
 * Measured, before this module existed, in `tests/ai/authoring-node-ids.test.ts`
 * against a real `ProjectModel` driven through the real apply path:
 *
 *  - two pages authored in ONE plan both landed carrying `page`/`layout`/`title`
 *    — the words a model writes into every page, which is F12's finding verbatim
 *    one client over;
 *  - `ProjectModel.findNodeWithId` (projectmodel.ts:428) is a project-wide,
 *    FIRST-MATCH lookup, so the second page's nodes became unreachable through
 *    it. That is not a validator complaint: `ViewerConnection`, the debug
 *    inspector and the provenance panel all resolve a runtime node id that way,
 *    so the editor highlights, inspects and labels the WRONG node;
 *  - and the write gate said the candidate was clean, because
 *    `SemanticValidator.validateComponent` filters diagnostics to one component
 *    while `duplicate-node-id`'s cross-component finding locates itself on the
 *    FIRST carrier. Exactly F12's gate-scope hole, in the editor's own gate.
 *
 * ── Allocation, not refusal ──────────────────────────────────────────────────
 *
 * The same call F12 made, for the same reason: an id is *allocated* so that it
 * cannot collide, and then the rule has nothing to report. `title` → `title-2`,
 * keeping the caller's word rather than minting a uuid — these ids are what a
 * human reads in a diff and what the next authoring turn is shown. Refusing
 * would make the agent redo a project-wide scan we have already done by the time
 * we could refuse.
 *
 * It is the editor's own mechanism, narrowed: `NodeGraphModel.rekeyAllIds()`
 * (NodeGraphModel.ts:232) is what every copy path already calls. The difference
 * is that this touches only the ids that would actually collide.
 *
 * ⚠️ **Rewriting a caller-supplied id is only safe because a node id is never
 * referenced from outside its own component**, and that was re-verified on the
 * editor side rather than inherited from the MCP row:
 *
 *  - `rekeyAllIds()` itself rewrites node ids, the children it recurses through,
 *    and `connections[].fromId/toId` — nothing else. Every editor path that
 *    copies a component depends on that closure being complete, so if a
 *    cross-component node-id reference existed, `duplicateComponent` would
 *    already be broken.
 *  - `visualRoots` is *derived* in the live model (`getVisualRootIds()` filters
 *    `roots`), and stored only in the v2 files — which this module rewrites.
 *  - Cross-component references are by component *name*: an instance node's
 *    `type`, a Router's `pages.routes`, a navigation target.
 *  - The ONE project-level pointer at a node id is `project.rootNodeId`, and it
 *    resolves through the same first-match `findNodeWithId` — which is an
 *    argument *for* project-wide uniqueness, not against this rewrite. It is
 *    never at risk here anyway: an update preserves every id the component
 *    already had (see `preserved`), and `updateAuthoredComponentInGroup`
 *    re-derives the root from the candidate's own `visualRoots[0]`.
 *
 * ── Deliberately Electron-free ───────────────────────────────────────────────
 *
 * Nothing here imports `ProjectModel`; the project arrives as {@link IdSource}s,
 * a two-field structural view every caller can produce. That is not tidiness —
 * `noodl-mcp` carries its own twin of this algorithm (`src/project/nodeIds.ts`,
 * F12), and this module is written so that twin can be replaced by an import
 * along the `plan.ts` / `editor-deps.ts` seam. ⚠️ **They are twins today, not
 * one implementation.** Converging them means editing `noodl-mcp`, which this
 * task was scoped out of; it is a two-line change there and a register row here.
 *
 * @module AiAssistant/authoring/nodeIds
 */

import type { ComponentFiles } from './types';

/** One id a write moved out of the way, and where it went. */
export interface NodeIdRemap {
  from: string;
  to: string;
}

/**
 * A component as this module needs to read it: a name and a way to walk its
 * nodes. `ComponentModel` satisfies it structurally, and so does anything else
 * that can list its nodes.
 */
export interface IdSource {
  name: string;
  graph: { forEachNode(callback: (node: { id: string }) => void): void };
}

/**
 * Every node id used by a component *other* than `exceptName`.
 *
 * The exclusion is what makes an update safe: a component's own ids are not a
 * collision with itself.
 */
export function nodeIdsInUse(components: readonly IdSource[], exceptName: string): Set<string> {
  const taken = new Set<string>();
  for (const component of components) {
    if (component.name === exceptName) continue;
    component.graph.forEachNode((node) => {
      if (typeof node.id === 'string') taken.add(node.id);
    });
  }
  return taken;
}

/**
 * Pick a free id that still reads like the one the caller asked for.
 *
 * `title` → `title-2` → `title-3`. Termination is guaranteed: the bound exceeds
 * the number of ids that exist, so some candidate in the range must be free.
 */
function mintId(base: string, unavailable: ReadonlySet<string>): string {
  const stem = base.replace(/-\d+$/, '') || 'node';
  const limit = unavailable.size + 2;
  for (let n = 2; n <= limit + 1; n++) {
    const candidate = `${stem}-${n}`;
    if (!unavailable.has(candidate)) return candidate;
  }
  // Unreachable given the bound above; a uuid is the honest fallback.
  return `${stem}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Rewrite the ids this write *introduces* that are already in use elsewhere in
 * the project, along with every reference to them inside the candidate.
 *
 * `preserved` is the set of ids the component already had (empty for a create).
 * Those are left alone whatever they collide with, deliberately: a pre-existing
 * cross-component collision is not this write's doing, and the gate's rule is
 * "don't make it worse", not "tidy the project". Churning ids the agent never
 * touched would also turn an update's diff into a wholesale rewrite.
 *
 * A duplicate *within* one candidate is not this function's problem and must not
 * be: `shapeErrors` in `candidate.ts` already refuses it, because two nodes
 * sharing an id make that component's own connections genuinely ambiguous and
 * nothing here could guess which node a wire meant.
 *
 * Returns a fresh `ComponentFiles`; the input is never mutated. When nothing
 * collides it returns the input by reference and an empty remap, so the common
 * case costs one set lookup per node.
 */
export function allocateCollisionFreeIds(
  candidate: ComponentFiles,
  taken: ReadonlySet<string>,
  preserved: ReadonlySet<string> = new Set()
): { files: ComponentFiles; remapped: NodeIdRemap[] } {
  const nodes = candidate.nodes.nodes ?? [];
  const own = new Set<string>(nodes.map((n) => n.id));

  // Everything a new id must avoid: ids elsewhere in the project, the ids this
  // component is keeping, and every id handed out during this pass.
  const unavailable = new Set<string>([...taken, ...own]);
  const rename = new Map<string, string>();

  for (const node of nodes) {
    if (!taken.has(node.id) || preserved.has(node.id) || rename.has(node.id)) continue;
    const fresh = mintId(node.id, unavailable);
    unavailable.add(fresh);
    rename.set(node.id, fresh);
  }

  if (rename.size === 0) return { files: candidate, remapped: [] };

  const files: ComponentFiles = JSON.parse(JSON.stringify(candidate));
  const to = (id: string): string => rename.get(id) ?? id;

  for (const node of files.nodes.nodes ?? []) {
    node.id = to(node.id);
    if (node.parent !== undefined) node.parent = to(node.parent);
    if (node.children) node.children = node.children.map(to);
  }
  if (files.nodes.visualRoots) files.nodes.visualRoots = files.nodes.visualRoots.map(to);
  for (const connection of files.connections.connections ?? []) {
    connection.fromId = to(connection.fromId);
    connection.toId = to(connection.toId);
  }

  return { files, remapped: [...rename].map(([from, id]) => ({ from, to: id })) };
}

/**
 * The project-bound form: work out what the rest of the project already uses,
 * then reallocate.
 *
 * `preserved` is supplied by the caller rather than derived here, because only
 * the caller knows whether this is a create (nothing preserved) or an update
 * (everything the live component currently carries).
 */
export function deconflictNodeIds(
  components: readonly IdSource[],
  legacyName: string,
  candidate: ComponentFiles,
  preserved: ReadonlySet<string> = new Set()
): { files: ComponentFiles; remapped: NodeIdRemap[] } {
  return allocateCollisionFreeIds(candidate, nodeIdsInUse(components, legacyName), preserved);
}

/** The node ids a live component currently carries — an update's `preserved`. */
export function currentNodeIds(component: IdSource): Set<string> {
  const ids = new Set<string>();
  component.graph.forEachNode((node) => {
    if (typeof node.id === 'string') ids.add(node.id);
  });
  return ids;
}

/** The one sentence to log or show when ids moved. */
export function remapNote(legacyName: string, remapped: readonly NodeIdRemap[]): string {
  const list = remapped.map((r) => `${r.from} → ${r.to}`).join(', ');
  return (
    `${remapped.length} node id(s) in "${legacyName}" were already used by another component and were ` +
    `reallocated so ids stay unique project-wide: ${list}. Connections, parent/children and visual roots ` +
    'inside that component were rewritten to match.'
  );
}
