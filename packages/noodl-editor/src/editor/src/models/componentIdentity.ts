/**
 * VFN-004 — a component identity that is **always present**, for the life of the editor session.
 *
 * ## Why this exists
 *
 * `ComponentModel.id` is optional and always has been. The **v2** format assigns every component a
 * guid (measured: 0 of ~180 components missing one across every v2 project on this machine), but a
 * **v1** legacy project — a single `project.json` with a `components` array — carries ids only for
 * whichever components happened to get one, and `ProjectImporter` deliberately refuses to fabricate
 * the key (`"Many real/imported components are id-less — do not fabricate an id key"`).
 *
 * Measured on three unrelated v1 projects: **2 of 7 components had an id.** So anything that keys a
 * component by `.id` is, on a v1 project, keying most components by `undefined`.
 *
 * That is what killed VFN-004's away mark and its click-to-navigate: every layer was individually
 * correct and the field they all agreed on was absent.
 *
 * ## Why not just mint an `id`
 *
 * 🔴 **DSG-007 already ruled on this for the sibling field, and enforces it with live specs**
 * (`tests/models/ProjectIdentity.test.ts`, *"opening a legacy project mints nothing"*):
 *
 * > *"The fix must not start minting ids on load — that would write a fresh identity into every
 * > legacy project the editor opens, and two copies of one project would then diverge silently."*
 *
 * The argument transfers to components with **more** force, because copying a project directory is
 * a routine gesture in this register (`vfn64-drive` is a disk copy of `vfn64-qa`). Open both copies
 * and each would mint different guids for the same components; `ProjectMerge` keys components by
 * `id ?? name`, so the two copies would then read as delete + add on **every** component, where
 * today they key by name and match.
 *
 * A *deterministic* id derived from the name dodges that, but then a rename changes the identity —
 * which is the stale-key trap VFN-004's own task file warned against ("navigate by id, resolve the
 * name for display").
 *
 * ## What this is instead
 *
 * The identity of a **model instance**, not of a component on disk. It is:
 *
 * - **assigned lazily**, on first ask, and stable from then on for that model object;
 * - **never serialised** — it is held in a `WeakMap` keyed on the model, so there is no property on
 *   `ComponentModel` at all. It cannot be written by `toJSON`, cannot be picked up by a generic
 *   serialiser, cannot be clobbered by `Model.prototype.set` (which blindly assigns `this[i]`), and
 *   does not appear in `Object.keys`. `project.json` is byte-identical with this module present;
 * - **rename-proof**, because it is not derived from the name;
 * - **not stable across a restart**, which costs nothing here: the only consumer is the Logic
 *   Builder tab bar, whose tabs are in-memory and do not survive a reload either.
 *
 * ⚠️ **This is not a replacement for `ComponentModel.id`** and must not be persisted, compared
 * against anything read off disk, or used as a merge/ownership key. It answers exactly one
 * question — *"is the component on the canvas the same model object as the one this tab belongs
 * to?"* — and it answers it within one session, which is the only span in which that question is
 * asked.
 *
 * 🔴 A model rebuilt from JSON (version control restore, `DiffList`) is a **different object** and
 * gets a **different** identity. That is correct for the question being asked and is why this must
 * never be compared against a snapshot.
 */

/**
 * Keyed on the model object itself. Weak, so a disposed component is collectable and holding an
 * identity for it never keeps it alive.
 */
const identities = new WeakMap<object, string>();

let counter = 0;

/**
 * This component model's session identity, assigned on first ask.
 *
 * Returns `undefined` for a missing component rather than minting one, so the callers' guard —
 * *"a tab with no key is never marked away"* — still has something to guard. An absence of a
 * component is still an absence of knowledge.
 */
export function componentInstanceId(component: object | null | undefined): string | undefined {
  if (!component) return undefined;

  const existing = identities.get(component);
  if (existing !== undefined) return existing;

  const minted = `component-${++counter}`;
  identities.set(component, minted);
  return minted;
}

/**
 * Has this component been given an identity yet? Test-only, and the honest way to assert that
 * asking twice does not mint twice without reaching into the map.
 */
export function hasComponentInstanceId(component: object | null | undefined): boolean {
  return Boolean(component) && identities.has(component as object);
}
