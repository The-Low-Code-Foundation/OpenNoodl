/**
 * ✅ CN-016 AC3 — whether a library entry can be installed into this editor,
 * and the sentence that says why not.
 *
 * **Deliberately import-free.** `modulelibrarymodel.ts` reaches
 * `@electron/remote` (through `getContentEndpoint`), the editor's `Model` base
 * and a view tree, none of which start under a plain-Node runner. The rule this
 * file holds is pure — two version strings and an entry's declared floor — so it
 * lives where a jest spec can reach it and the model wraps it with the one
 * impure thing it needs, `platform.getVersion()`.
 *
 * ⚠️ `scripts/library/verify-dist.ts` bundles `modulelibrarymodel.ts` with every
 * non-entry import replaced by a no-op Proxy. This module must be **exempted**
 * from that stubbing, because a stubbed `isModuleCompatible` returns a truthy
 * Proxy — every entry would read as compatible and the check would pass
 * vacuously. That is the same shape of silent failure the `getContentEndpoint`
 * stub caused for a year, so verify-dist now also self-tests that the compat
 * helper it loaded actually says *no* to something.
 */

/** Parses a "x.y.z" string into a comparable triple; missing/odd input sorts as 0.0.0. */
function parseVersion(v: string | undefined): [number, number, number] {
  const parts = (v || '').split('.').map((n) => parseInt(n, 10));
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

/** true if `current` is >= `minRequired` (both "x.y.z"). No `minRequired` means always compatible. */
export function isVersionAtLeast(current: string, minRequired: string | undefined): boolean {
  if (!minRequired) return true;
  const a = parseVersion(current);
  const b = parseVersion(minRequired);
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}

/** The fields of a library entry this rule reads. Structural, so no import is needed. */
export interface CompatibilityCandidate {
  label?: string;
  minEditorVersion?: string;
  /** Read for documentation only — see the note in `describeIncompatibilityFor`. */
  runtimeVersion?: string;
}

export interface Incompatibility {
  /** One line, for the card's badge. */
  short: string;
  /** The refusal: names the entry, the field, the requirement, what you have, and what to do. */
  full: string;
}

/**
 * Why `entry` cannot be installed into an editor at `editorVersion`, or `null`.
 *
 * AC3 asks that compat gating "refuse an incompatible kit **with a message
 * naming why**". Both the refusal thrown by `installModule`/`installPrefab` and
 * the badge the card renders come from here, so they cannot drift into two
 * accounts of one problem — the card used to carry its own wording. The old
 * refusal read *"This module requires editor version 0.1.0 or newer"*: it named
 * the requirement and neither the entry nor the running version, which is the
 * half that tells a user whether the problem is theirs or the author's.
 *
 * ## 🔴 What this deliberately does NOT gate, and why
 *
 * CN-016 item 3 notes that *"`minEditorVersion` and `runtimeVersion` exist in
 * the schema"* and infers that a kit built against newer runtime semantics
 * should be refused at install. Both fields do exist. Only one is
 * **comparable**, and the difference decides the design:
 *
 *   - `minEditorVersion` is a **floor** with a real comparand —
 *     `platform.getVersion()`. Gating on it compares two versions the product
 *     actually knows. Gated.
 *   - `runtimeVersion` is defined by `scripts/library/schema.json` as the
 *     runtime an entry was *"authored/verified against"* — **descriptive
 *     provenance, not a requirement.** Reading it as a floor would make a field
 *     mean more than its own definition says.
 *   - 🔴 **And the editor has no runtime version to compare it with.** Measured
 *     2026-08-18: no constant, no generated file, no dependency edge from
 *     `noodl-editor` to `noodl-runtime`. A gate would have to invent its
 *     comparand, and a comparison against an invented value is a hazard wearing
 *     a check's clothes.
 *
 * A `minRuntimeVersion` floor was considered and **not added**: a schema field
 * nothing can evaluate is worse than an absent one, because `library:check`
 * would accept it while every consumer ignored it in silence. It becomes worth
 * adding the day the editor knows its runtime version.
 *
 * ⚠️ This is CN-017 §9b's lesson applied where §9b predicted it would return.
 * Refusing on a declared version contract is defensible. Refusing on a
 * heuristic about React semantics — or on a field whose comparand is guessed —
 * is the same mistake in a new costume, and it costs the user the feature.
 */
export function describeIncompatibilityFor(
  editorVersion: string,
  entry: CompatibilityCandidate
): Incompatibility | null {
  if (!isVersionAtLeast(editorVersion, entry.minEditorVersion)) {
    const name = entry.label ? `"${entry.label}"` : 'This library entry';
    return {
      short: `Requires editor v${entry.minEditorVersion} — this is v${editorVersion}`,
      full:
        `${name} declares minEditorVersion ${entry.minEditorVersion} in its library entry, ` +
        `and this editor is version ${editorVersion}. Update NodeGX to install it, or ask the ` +
        `entry's author whether that requirement is still accurate.`
    };
  }
  return null;
}
