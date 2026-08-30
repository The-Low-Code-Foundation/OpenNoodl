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
 * ## Two tables, one moment
 *
 * DEF-025 added a second kind of write to this module. `SEEDED_PARAMETER_BY_TYPE`
 * answers "what body does this node arrive with"; `CREATION_DEFAULTS_BY_TYPE`
 * answers "what parameters does this node arrive with". They share the moment
 * (creation, once, undoably) and the guards, so they share the module rather
 * than growing a second mechanism beside it — the editor already has one of
 * those (`ElementConfigRegistry.applyDefaults`) and it is reachable from only
 * ONE of the two creation paths, which is exactly the drift this avoids.
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

/**
 * DEF-025 (P78 D37) — the controls whose visible words are the tap surface,
 * and the display name each is known by.
 *
 * `Checkbox` and `Radio Button` emit their `<label for="…">` — a real click
 * target wired to the input — only when `useLabel` is on, and it defaults
 * **off**. So the obvious authoring, a `Text` beside the control, renders a
 * sentence that does nothing when tapped and a hit area of 24×24 px: WCAG 2.2
 * SC 2.5.8's minimum and no more.
 *
 * ⚠️ **This is the one copy of the list.** `validation/rules/
 * labelNotAClickTarget` imports it rather than keeping its own, because the
 * rule and the creation default are two halves of one decision: the day a
 * control joins or leaves this set, both must move together or the door
 * produces exactly what the rule warns about.
 *
 * `Text Input` and `Options` share the `useLabel: false` default and are
 * deliberately absent: the design system's own `field` composition puts a
 * separate `fieldLabel` Text above those, so including them would fire on the
 * doctrine's own recommended shape. "The label is the tap target" is a
 * semantic fact about the control that no catalog property carries, which is
 * why the list is written here and reasoned rather than derived.
 */
export const LABEL_TARGET_CONTROLS: ReadonlyMap<string, string> = new Map([
  ['net.noodl.controls.checkbox', 'Checkbox'],
  ['net.noodl.controls.radiobutton', 'Radio Button']
]);

/**
 * DEF-025 — what a brand-new node arrives with in its parameter bag.
 *
 * Richard's ruling (2026-08-30): flip at **creation**, not at runtime, and in
 * **both** doors. New work gets a control whose words are a real click target;
 * no existing rendering moves, because nothing here touches the port's
 * declared default and nothing here runs on load, paste, duplicate or import.
 *
 * ⚠️ The blunt alternative — flipping `useLabel`'s catalog default to `true` —
 * is ruled OUT permanently: every existing project's bare checkbox would
 * suddenly render the literal string `'Label'` (the `label` port's default).
 * That is a visible regression on every unlabelled box in every project.
 */
const CREATION_DEFAULTS_BY_TYPE: Record<string, Record<string, unknown>> = Object.fromEntries(
  [...LABEL_TARGET_CONTROLS.keys()].map((type) => [type, { useLabel: true }])
);

/** Structural view of a node model — deliberately not `NodeGraphNode`. */
export interface SeedableNode {
  parameters?: Record<string, unknown>;
}

/** The write a caller should make, or `null` for "leave this node alone". */
export interface NewNodeSeed {
  parameter: string;
  /** `unknown`, not `string`: a creation default may be a boolean. */
  value: unknown;
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

/**
 * Decide which parameters a just-created node of `typeName` should arrive with.
 *
 * Returns `[]` — do nothing — for every type with no creation defaults, and
 * skips any parameter the node **already carries a value for**. That guard is
 * what makes an explicit `useLabel: false` from an authoring door survive: a
 * caller who said what they wanted is never corrected, and the default only
 * fills a silence.
 *
 * ⚠️ Like {@link planNewNodeSeed}, this must reach a node only on creation.
 * That is enforced by the call sites, not by anything visible from here.
 */
export function planCreationDefaults(typeName: string, node: SeedableNode): NewNodeSeed[] {
  const defaults = CREATION_DEFAULTS_BY_TYPE[typeName];
  if (!defaults) return [];

  return Object.entries(defaults)
    .filter(([parameter]) => node?.parameters?.[parameter] === undefined)
    .map(([parameter, value]) => ({ parameter, value }));
}

/** The types this module will seed. Exported for tests and for a grep to find. */
export function seedableNodeTypes(): string[] {
  return Object.keys(SEEDED_PARAMETER_BY_TYPE);
}

/** The types that arrive with parameters. Exported for tests and for a grep. */
export function typesWithCreationDefaults(): string[] {
  return Object.keys(CREATION_DEFAULTS_BY_TYPE);
}
