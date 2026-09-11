/**
 * SIG-002 §2 — recognising the search that *is* the complaint.
 *
 * > "He was worried and confused when he wanted to set the button label and he
 * > didn't see a 'Set' signal input."
 *
 * The keystroke that expresses that confusion is typing `set` into the
 * connection popup's search and getting nothing back. `trigger`, `update` and
 * `apply` are the same question in different words. Every one of them means
 * *"how do I make this value land?"*, and the answer — the wire is already live
 * — is a sentence the popup has never said.
 *
 * ## ⚠️ Why this is a list and not "any empty search"
 *
 * SIG-002's guard: an empty search for `xyzzy` must return the ordinary empty
 * state with no advice. Attaching the explanation to *every* miss would attach
 * it to typos, and a tool that answers a question you did not ask is noise the
 * second time and distrust by the fifth.
 *
 * Import-free so `tests-unit/connection-popup/searchIntent.test.ts` grades both
 * halves — the terms that fire and the nonsense that must not.
 */

/**
 * The words that mean "make this value land".
 *
 * `run` and `fire` are here because they are what someone arriving from an
 * event-driven tool types; `bind` is not, because a builder who knows the word
 * "bind" already has the mental model this answer is trying to install.
 */
export const TIMING_INTENT_TERMS = [
  'set',
  'trigger',
  'update',
  'change',
  'apply',
  'assign',
  'fire',
  'run',
  'send',
  'push',
  'write'
] as const;

/** Below this, a prefix is a keystroke on the way somewhere, not a question. */
const MIN_PREFIX_LENGTH = 3;

/**
 * Whether a search term is asking *"where is the Set?"*.
 *
 * Prefix matching, from three characters: `trig` and `updat` are the same
 * question mid-type, and holding the answer back until the word is finished
 * means it arrives after the builder has already given up. `se` is not enough —
 * it is a prefix of half the library.
 */
export function isTimingIntentSearch(term: string | undefined): boolean {
  if (!term) return false;

  const query = term.trim().toLowerCase();
  if (query.length < MIN_PREFIX_LENGTH) return false;

  return TIMING_INTENT_TERMS.some((intent) => intent === query || intent.startsWith(query));
}

/** The shape `answersTimingIntent` needs from a port row. */
export interface SearchablePort {
  displayName: string;
  typeName?: string;
}

/**
 * Whether the popup should answer *"where is the Set?"* for this search.
 *
 * ## ⚠️ Why an empty result set is the wrong trigger
 *
 * The first build showed the answer only when the search matched nothing, which
 * is what SIG-002 §2 describes — and driven on a **Button**, searching `set`
 * matched three ports and the answer never appeared. The matches were
 * *"Box Shadow Offset X"*, *"Offset Y"* and their siblings: `set` is a substring
 * of `offset`.
 *
 * So the builder from the complaint types `set`, gets three shadow-offset ports
 * back, and is *further* from the answer than the empty list would have left
 * them — the list now looks like it worked.
 *
 * The real condition is not "nothing matched". It is **"there is no `Set` here"**:
 * no signal input whose name contains the word they typed. Incidental substring
 * hits on value ports do not make the question answered, and the answer is shown
 * beside those results rather than instead of them.
 */
export function answersTimingIntent(term: string | undefined, ports: readonly SearchablePort[]): boolean {
  if (!isTimingIntentSearch(term)) return false;

  const query = term.trim().toLowerCase();
  const hasSetLikeSignal = ports.some(
    (p) => p.typeName === 'signal' && (p.displayName || '').toLowerCase().includes(query)
  );

  return !hasSetLikeSignal;
}
