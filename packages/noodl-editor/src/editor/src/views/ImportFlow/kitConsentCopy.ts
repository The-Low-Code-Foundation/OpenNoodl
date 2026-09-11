/**
 * ✅ **CN-017 AC4 + AC5 — the consent dialog's words, in a plain module.**
 *
 * 🔴 **Extracted from the `.tsx` because markup is outside every gate but
 * `test:ci`.** A sentence living in JSX is invisible to the plain-Node jest
 * runner, so the one acceptance criterion that is entirely about wording —
 * *"no UI text claims a verified kit is safe"* — could not be graded where it
 * lives. Here it is data, and a spec reads it directly.
 *
 * ⚠️ **One home, not two.** If a second surface ever needs to say this (a
 * re-consent prompt, a settings page), it imports from here rather than
 * paraphrasing. Two paraphrases of a security-adjacent statement is how one of
 * them ends up over-claiming.
 *
 * @module noodl-editor/views/ImportFlow/kitConsentCopy
 */

export const KIT_CONSENT_COPY = {
  /**
   * ✅ **AC4: one sentence, neither minimising nor catastrophising.**
   *
   * It states the capability as a fact about how kits work, because that is what
   * it is — a kit is arbitrary JavaScript with the app's full reach *by design*,
   * and that is what makes a custom node as capable as a built-in (P1). A warning
   * tone would read as "this particular download is suspect", which is a claim
   * this dialog has no evidence for in either direction.
   */
  statement:
    'This download contains code that will run inside your app, with the same access your app has — your data, your network and the page.',

  /**
   * 🔴 **AC5, placed where a reader is most likely to infer otherwise.** A list of
   * ticks beside the word "verified" is read as an assurance; this says what the
   * check is and what it is not, immediately above the ticks.
   *
   * ⚠️ It must never say safe, trusted or secure. `verifyKitSource` runs a script
   * in a `vm` context to see what it declares — a shape smoke test, not a security
   * boundary, and `vm`'s own documentation says as much.
   */
  limits:
    'Each file below was run in an isolated context to see what it declares. That tells you what it defines — the nodes you would get — and nothing about whether its author is trustworthy or what it does once it runs.',

  /**
   * The accept button. Says what pressing it *does*, not that the thing is fine:
   * "Trust this kit" would be the same over-claim in three words.
   */
  accept: (count: number) => `Run this code in my app (${count})`,

  /** Nothing passed verification, so there is nothing to agree to. */
  acceptNothing: 'Nothing can be installed',

  cancel: 'Cancel',

  /** Heading over the modules that failed verification and will not be copied. */
  refusedHeading: 'Will not be installed'
} as const;
