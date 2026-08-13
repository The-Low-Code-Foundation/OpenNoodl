/**
 * VFN-009 §2 — what a Logic Builder tab is *about*.
 *
 * The window is already a tab host and the tab was already keyed by a `nodeId`. A definition tab
 * is the same window with a different subject: its blocks are `definition.body`, its title says it
 * is a saved block, and its save writes `store.save({ id, … })` rather than a node parameter.
 *
 * ## 🔴 Why `nodeId` was not widened
 *
 * The obvious change is to let `Tab.nodeId` mean "either a node id or a definition id". That is
 * one field carrying two kinds of identity, and every consumer — `BlockTraceClient`, `attachDoIt`,
 * `attachBlockValues`, `onWorkspaceChange` — would have to learn the difference or silently do the
 * wrong thing to one of them. Silently is the operative word: `attachBlockTrace(definitionId)`
 * does not throw, it arms a socket for a node that does not exist and waits forever; and
 * `onWorkspaceChange(definitionId, …)` finds no node, logs a warning nobody reads, and drops the
 * builder's edit.
 *
 * So the subject is a discriminated union, and the three questions the rest of the editor asks are
 * functions over it rather than field reads:
 *
 * - {@link liveNodeIdOf} — "is there a node here to attach to?" `undefined` on a definition tab,
 *   **even if the tab also carries a `nodeId`**. That is the property the widening would have lost,
 *   and it is the one the negative control in `tests-unit/vfn-009` convicts the widening on.
 * - {@link editTargetFor} — "where does a settled edit go?"
 * - {@link tabTravels} — "does clicking this tab take the canvas somewhere?"
 *
 * ⚠️ Nothing in this file may import anything, for the reason `tabLocation.ts` states: it is
 * reached from `tests-unit`, which is a boundary rather than a directory, and one `@noodl-core-ui`
 * import anywhere in the graph fails a suite *to run* — which counts as a failure and does not
 * look like one.
 */

/** The two things a Logic Builder tab can be editing. */
export type TabSubject =
  | { kind: 'node'; nodeId: string }
  /** A saved block, edited from the *Saved blocks* section of project settings. */
  | { kind: 'definition'; definitionId: string };

/** The half of a `Tab` this file reads. */
export interface SubjectTab {
  nodeId?: string;
  subject?: TabSubject;
}

/**
 * The tab's subject.
 *
 * 🔴 A tab with no explicit `subject` but with a `nodeId` is a **node** tab. Every tab that
 * existed before this task is that shape, and reading them as anything else would retro-fit an
 * absence of information into a claim. A tab with neither is `undefined`, and every function below
 * treats that as "there is nothing here", which is what a tab opened by a caller that predates all
 * of this deserves.
 */
export function subjectOf(tab: SubjectTab | undefined | null): TabSubject | undefined {
  if (!tab) return undefined;
  if (tab.subject) return tab.subject;
  if (tab.nodeId) return { kind: 'node', nodeId: tab.nodeId };
  return undefined;
}

export function isDefinitionTab(tab: SubjectTab | undefined | null): boolean {
  return subjectOf(tab)?.kind === 'definition';
}

/** The definition a tab is editing, or `undefined` when it is editing a node. */
export function definitionIdOf(tab: SubjectTab | undefined | null): string | undefined {
  const subject = subjectOf(tab);
  return subject?.kind === 'definition' ? subject.definitionId : undefined;
}

/**
 * The **live node** a tab is editing, if there is one.
 *
 * 🔴 This is the function the three overlays that need a node call, and it is where the
 * discrimination pays for itself: a definition tab answers `undefined` regardless of what is in
 * `tab.nodeId`. Do It, the value strip and `BlockTraceClient` were all written to explain a
 * missing node rather than vanish, so `undefined` is a path they already have.
 */
export function liveNodeIdOf(tab: SubjectTab | undefined | null): string | undefined {
  const subject = subjectOf(tab);
  return subject?.kind === 'node' ? subject.nodeId : undefined;
}

/** Where a settled edit from this tab's workspace is written. */
export type EditTarget =
  | { kind: 'node'; nodeId: string }
  | { kind: 'definition'; definitionId: string }
  /** Nowhere. A tab that knows neither what it is editing nor where to put it. */
  | { kind: 'none' };

export function editTargetFor(tab: SubjectTab | undefined | null): EditTarget {
  const subject = subjectOf(tab);
  if (!subject) return { kind: 'none' };
  return subject;
}

/**
 * Does clicking this tab take the canvas anywhere?
 *
 * Only a node tab. A definition does not live in a component — it lives on a shelf — so sending a
 * definition tab through `navigateToTabComponent` would reach `tabActivation`'s `refuse-unknown`
 * branch and put *"This tab does not know which component … came from"* on screen, which is a
 * refusal about a question nobody asked.
 */
export function tabTravels(tab: SubjectTab | undefined | null): boolean {
  return subjectOf(tab)?.kind === 'node';
}

/**
 * Does this tab's blocks want the mandatory program hat put on them?
 *
 * 🔴 **Only a node tab, and this is not a preference.** LGC-009 made the hat mandatory by
 * *supplying* one to every program on its way into the block editor. A saved block's body is not a
 * program — it is a fragment that gets spliced into one — and `ensureHatsInJson` would wrap its
 * statement stack in a hat, which the first settled edit would then write back to the shelf. Every
 * call site inlining that definition afterwards would splice a **hat block into the middle of
 * somebody else's stack**, which is not a shape Blockly's grammar has a meaning for.
 *
 * `seedEmpty` makes it worse in the empty case: a definition being edited down to nothing would
 * acquire a hat out of thin air and become a one-block definition that emits a signal handler.
 */
export function wantsProgramHat(tab: SubjectTab | undefined | null): boolean {
  return subjectOf(tab)?.kind !== 'definition';
}

/** The prefix a node tab's id carries. Unchanged — `TabType` is `'logic-builder'`. */
export const NODE_TAB_PREFIX = 'logic-builder';
/** The prefix a definition tab's id carries. */
export const DEFINITION_TAB_PREFIX = 'saved-block';

/**
 * The tab id for a subject.
 *
 * Deterministic, because that is what makes reopening a definition already open switch to it
 * rather than mount a second workspace over the same shelf entry — two workspaces on one
 * definition would each flush their own copy of the body 300 ms after they settled, and the last
 * one to settle would win silently.
 *
 * The node form is byte-identical to what `CanvasTabsProvider` computed before this task
 * (`` `${type}-${nodeId}` ``), so no existing tab id moves.
 */
export function tabIdFor(subject: TabSubject | undefined): string | undefined {
  if (!subject) return undefined;
  return subject.kind === 'node'
    ? `${NODE_TAB_PREFIX}-${subject.nodeId}`
    : `${DEFINITION_TAB_PREFIX}-${subject.definitionId}`;
}

/** What a definition tab's title says. The shape word is the tab's whole disambiguation. */
export function definitionTabLabel(name: string): string {
  return (name ?? '').trim() || 'Saved block';
}

/** Its tooltip — the sentence the label has no room for. */
export function definitionTabTooltip(name: string): string {
  const label = definitionTabLabel(name);
  return `The saved block "${label}". Editing these blocks changes every place that uses it.`;
}
