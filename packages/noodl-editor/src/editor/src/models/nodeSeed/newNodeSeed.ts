/**
 * What a node arrives with when a person makes one (FUN-002).
 *
 * A Function node's `functionScript` declares no `default`, so the first thing
 * a beginner meets after double-clicking one is a completely blank editor —
 * with the affordance that would teach them the notation (typing `Inputs.`
 * creates the port) invisible, and the one they did find, the property panel's
 * port list, teaching nothing. This module decides whether a newly created node
 * gets a body, and which parameter it goes in.
 *
 * ## Why the decision is here and the string is not
 *
 * The seed text is FUN-001's (`code-editor/utils/notation.ts`), and it is passed
 * *in* rather than imported here. That is the same shape as `refusalPlan` and
 * `wirePulse` next door, and for the same reason: it keeps this module
 * import-free, so `tests-unit/` can grade the decision — including the two
 * guards whose failure modes are silent — without starting Electron.
 *
 * ## What it must never do
 *
 * ⚠️ **Seed a node that was loaded, pasted, duplicated or imported.** That is
 * enforced by *where this is called from* — the two paths that mint a brand-new
 * node, `NodePicker.utils.createNodeFunction` and
 * `NodeOperations.createNewNode` — and by the parameter guard below, not by
 * anything this module can see. A seed that fires on load rewrites every
 * emptied Function node in an old project on open, and a `project.json` write
 * is the kind of damage noticed a week later.
 *
 * ⚠️ **Be a port `default`.** A declared default never runs its setter, so the
 * node would display a body while `_internal.func` stayed undefined and `Run`
 * did nothing — a worse first experience than the blank page. It is also not a
 * parameter: `CodeEditorType.save()` writes `undefined` when the value equals
 * the default, so a user who deliberately emptied the node and one who never
 * touched it would be indistinguishable and the seed would keep coming back.
 * The caller therefore writes it with `setParameter(..., { undo: true })`,
 * which makes it a normal undoable edit — one ⌘Z removes it, and it stays gone.
 *
 * @module models/nodeSeed
 */

/** The parameter each seedable node type carries its body in. */
const SEEDED_PARAMETER_BY_TYPE: Record<string, string> = {
  // The Script node (`Javascript2`) has the same blank page and `const
  // defaultCode = ''`, but a more complicated body shape (`define({...})`) and
  // therefore its own seed. Deliberately a follow-on, so this stays one node
  // and one string.
  JavaScriptFunction: 'functionScript'
};

/** Structural view of a node model — deliberately not `NodeGraphNode`. */
export interface SeedableNode {
  parameters?: Record<string, unknown>;
}

/** The write a caller should make, or `null` for "leave this node alone". */
export interface NewNodeSeed {
  parameter: string;
  value: string;
}

/**
 * Decide what a just-created node of `typeName` should be seeded with.
 *
 * Returns `null` — meaning do nothing — when the type has no seed, when the
 * seed text is empty, or when the node **already carries a value** in the
 * target parameter. That last guard is what keeps a drag-with-preset, a
 * template insertion or any future creation path that arrives with a body from
 * having it overwritten; it is cheap, and the failure it prevents is silent
 * destruction of the user's code.
 */
export function planNewNodeSeed(typeName: string, node: SeedableNode, seedText: string): NewNodeSeed | null {
  const parameter = SEEDED_PARAMETER_BY_TYPE[typeName];
  if (!parameter) return null;
  if (!seedText) return null;

  const existing = node?.parameters?.[parameter];
  // `''` counts as unset: an empty string is what an emptied editor writes, and
  // a node created with one has nothing to lose.
  if (existing !== undefined && existing !== null && existing !== '') return null;

  return { parameter, value: seedText };
}

/** The types this module will seed. Exported for tests and for a grep to find. */
export function seedableNodeTypes(): string[] {
  return Object.keys(SEEDED_PARAMETER_BY_TYPE);
}
