/**
 * BLD-016 — `@` mentions, as one rule rather than two halves that can disagree.
 *
 * ## The whole design, in one sentence
 *
 * **The text is the source of truth, and the chip row is derived from it.**
 *
 * The obvious implementation is the other one: picking from the menu inserts a
 * token *and* attaches a reference, two writes to two stores. That version has
 * a bug the acceptance criteria name outright — "deleting the token removes the
 * chip, and vice versa" — and it is a bug you fix by adding a third mechanism to
 * keep the two in step. Here there is nothing to keep in step. A mention-origin
 * reference exists exactly while its token is in the composer text; the menu
 * does not attach anything, it inserts a token, and {@link reconcileMentions}
 * notices. Removing the chip deletes the token ({@link removeMentionToken}) and
 * the same reconciliation drops the reference on the next pass.
 *
 * That also makes **typing** a mention work for free, which matters more than it
 * sounds: AIB-010's finding was that a name typed into a parameter is never
 * checked for resolving, so a wrong name silently means nothing. A user who
 * types `@Pages/Chekcout` rather than picking it from the list must not get
 * silence, and under this design they cannot — every `@` token in the text is
 * either resolved into a chip or refused by name.
 *
 * ## Why this file is pure
 *
 * Same boundary `references.ts` draws, for the same reason: what a spec can
 * grade here is the *arithmetic* — which tokens are live, which are settled,
 * which name nothing — and none of it needs a `ProjectModel` or a renderer. The
 * halves that do live in `authoring/referenceSources.ts`.
 *
 * @module AiAssistant/thread/mentions
 */

import type { ReferenceKind } from './references';

/**
 * A thing that can be mentioned, as this layer needs it.
 *
 * Structurally a subset of `ReferenceCandidate` so the editor-side sources
 * satisfy it without a conversion, and declared here rather than imported so
 * that this module keeps importing nothing that needs Electron.
 */
export interface MentionCandidate {
  kind: ReferenceKind;
  /** What the token spells and the chip shows: `Pages/Checkout`, `docs/BRIEF.md`. */
  label: string;
  /** How the resolver finds it again. */
  target: string;
}

/**
 * A reference already on the chip row, as reconciliation needs to see it.
 *
 * `mention` is the token that put it there, and its **absence is the whole of
 * the distinction** this module draws: a reference with no `mention` came from
 * the picker, a drop, a paste or a capture, and the text has no authority over
 * it. Only mention-origin references are created and destroyed by editing.
 */
export interface AttachedForMention {
  id: string;
  label: string;
  mention?: string;
}

// ── The token grammar ─────────────────────────────────────────────────────────

/**
 * The characters a bare token may contain.
 *
 * `/` and `.` are in it because the two most-mentioned things in this product
 * are `Pages/Checkout` and `docs/BRIEF.md` — a grammar that stopped at the
 * slash would mention the folder and not the thing.
 */
const BARE_CHAR = /[A-Za-z0-9_./-]/;
const BARE_LABEL = /^[A-Za-z0-9_./-]+$/;

/**
 * ⚠️ A mention's `@` must start a word, and that is what keeps this off
 * `richard@digitalbricks.io`.
 *
 * An email is the one `@` everybody writes without meaning a mention, and it is
 * always preceded by a word character. Anything else — start of text,
 * whitespace, a bracket, a quote — may begin one.
 */
function atMentionPosition(text: string, at: number): boolean {
  if (at === 0) return true;
  return !BARE_CHAR.test(text[at - 1]);
}

/**
 * The token that names a label, quoting it when the bare grammar cannot.
 *
 * Component names are allowed spaces in this editor, so `@My Checkout Page`
 * would parse as a mention of `My` followed by two words of prose. The quoted
 * form is uglier and is used only where it has to be — a project whose names
 * have no spaces never sees a quote.
 */
export function mentionToken(label: string): string {
  return BARE_LABEL.test(label) ? `@${label}` : `@"${label}"`;
}

/** One `@` token found in the composer text. */
export interface ParsedMention {
  /** As written, including the `@` and any quotes. */
  token: string;
  /** What it names — the quoted content, or the bare run. */
  label: string;
  /** Index of the `@`. */
  start: number;
  /** Exclusive end of the token. */
  end: number;
  /**
   * False for a token that is still being typed — one that runs to the very end
   * of the text with nothing after it.
   *
   * ⚠️ This exists for exactly one reason and it is worth stating: without it,
   * typing `@Pages/Home` one character at a time refuses `@P`, then `@Pa`, then
   * `@Pag`, and the composer accuses the user of six mistakes on the way to
   * getting it right. A token is *settled* the moment any character follows it,
   * including the space the menu inserts — so a finished mention is graded
   * immediately and an in-flight one is left alone until Send.
   */
  settled: boolean;
}

/**
 * Every `@` token in the text, in order.
 *
 * Deliberately not a single regular expression: the quoted form, the
 * word-boundary rule and the settled flag are three separate conditions, and a
 * regex carrying all three is a regex nobody edits correctly later.
 */
export function parseMentions(text: string): ParsedMention[] {
  const found: ParsedMention[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '@' || !atMentionPosition(text, i)) continue;

    if (text[i + 1] === '"') {
      const close = text.indexOf('"', i + 2);
      // An unclosed quote is a mention the user is in the middle of typing, not
      // a token — it has no end, so it cannot be matched against anything.
      if (close === -1) continue;
      const label = text.slice(i + 2, close);
      if (label.length === 0) continue;
      const end = close + 1;
      found.push({ token: text.slice(i, end), label, start: i, end, settled: end < text.length });
      i = end - 1;
      continue;
    }

    let end = i + 1;
    while (end < text.length && BARE_CHAR.test(text[end])) end++;
    if (end === i + 1) continue; // a bare `@` is prose
    const label = text.slice(i + 1, end);
    found.push({ token: text.slice(i, end), label, start: i, end, settled: end < text.length });
    i = end - 1;
  }
  return found;
}

// ── The menu's half: what the caret is asking for ────────────────────────────

/** The `@` run the caret is inside, which is what the menu filters on. */
export interface MentionQuery {
  /** Index of the `@`. */
  start: number;
  /** What has been typed after it — `''` the instant `@` is pressed. */
  query: string;
}

/**
 * The mention the caret is currently inside, if it is inside one.
 *
 * Returns `undefined` the moment the caret leaves the run, which is how the
 * menu closes without a second piece of state deciding when: the caret is
 * either in a mention or it is not.
 */
export function mentionQuery(text: string, caret: number): MentionQuery | undefined {
  for (let i = Math.min(caret, text.length) - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === '@') {
      if (!atMentionPosition(text, i)) return undefined;
      return { start: i, query: text.slice(i + 1, caret) };
    }
    // A quoted run may contain spaces, so the scan may not stop at one until it
    // knows whether it is inside quotes. It is only inside quotes if the
    // character right after the `@` is one, which the branch above settles.
    if (!BARE_CHAR.test(ch) && ch !== '"') return undefined;
  }
  return undefined;
}

/** Replace the `@` run the caret is in with a finished token. */
export function insertMention(text: string, caret: number, token: string): { text: string; caret: number } {
  const query = mentionQuery(text, caret);
  const start = query ? query.start : caret;
  // A trailing space rather than nothing: it settles the token (see
  // `ParsedMention.settled`), so picking from the menu and typing the name by
  // hand converge on the same state instead of the picked one sitting
  // permanently unsettled at the end of the line.
  const inserted = `${token} `;
  const next = text.slice(0, start) + inserted + text.slice(caret);
  return { text: next, caret: start + inserted.length };
}

/**
 * Delete a token from the text — the chip's Remove button, in reverse.
 *
 * Takes one following space with it, so removing the chip for `@Pages/Home`
 * from `see @Pages/Home for the layout` leaves `see for the layout` rather than
 * a double space.
 *
 * ⚠️ **Every occurrence, not the first.** A message may name the same thing
 * twice, and those two tokens are one chip (see `reconcileMentions`' `claimed`
 * set) — so removing the first would leave the reference attached, the chip on
 * screen, and a Remove button that visibly did nothing. Removing the mention
 * from the message is the promise the control makes.
 *
 * Right to left, so that each removal cannot move the offsets of the ones not
 * yet done.
 */
export function removeMentionToken(text: string, token: string): string {
  const hits = parseMentions(text).filter((mention) => mention.token === token);
  let next = text;
  for (let i = hits.length - 1; i >= 0; i--) {
    const hit = hits[i];
    const end = next[hit.end] === ' ' ? hit.end + 1 : hit.end;
    next = next.slice(0, hit.start) + next.slice(end);
  }
  return next;
}

// ── Reconciliation: the one rule ─────────────────────────────────────────────

/** A token that names nothing, and the sentence the composer shows for it. */
export interface MentionRefusal {
  token: string;
  label: string;
  reason: string;
}

export interface MentionReconciliation {
  /** Mentions whose candidate is known and which have no chip yet. */
  attach: Array<{ candidate: MentionCandidate; token: string }>;
  /** Ids of mention-origin references whose token has left the text. */
  detach: string[];
  /** Tokens that resolve to nothing. Each blocks Send until fixed or dismissed. */
  refusals: MentionRefusal[];
}

export interface ReconcileInput {
  text: string;
  candidates: readonly MentionCandidate[];
  /** Everything on the chip row, whatever put it there. */
  attached: readonly AttachedForMention[];
  /**
   * Tokens the user has declared literal.
   *
   * ⚠️ The escape hatch, and it is not optional. Build item 4 wants an
   * unresolvable mention refused before send, which is right for `@Chekcout`
   * and wrong for somebody asking about `@media` queries — and a refusal with
   * no way out is a composer the user cannot send from. Dismissing marks the
   * token and leaves the prose alone; it never edits what they wrote.
   */
  dismissed?: ReadonlySet<string>;
  /**
   * Grade the token still being typed, too.
   *
   * False while editing (see {@link ParsedMention.settled}) and true at Send,
   * where there is no such thing as in-flight: a half-typed `@Pag` in a message
   * about to leave is a mention that names nothing.
   */
  includeUnsettled?: boolean;
}

/**
 * What the chip row should be, given what the text says.
 *
 * ⚠️ **`detach` ignores `settled` on purpose, and `attach` does not.** They look
 * like they should agree and they must not. Attaching an unsettled token would
 * read a file on every keystroke; detaching only settled ones would leave a chip
 * for `@Pages/Home` sitting above a composer that now reads `@Pages/Hom` — a
 * disagreement between the text and the row, which is the one thing this module
 * exists to make impossible. Presence is judged over every parsed token, so
 * deleting the space after a finished mention does not detach it (the token is
 * still there, merely unsettled again) while editing the *name* does.
 */
export function reconcileMentions(input: ReconcileInput): MentionReconciliation {
  const { text, candidates, attached, dismissed, includeUnsettled } = input;
  const mentions = parseMentions(text);
  const present = new Set(mentions.map((mention) => mention.token));

  const attach: MentionReconciliation['attach'] = [];
  const refusals: MentionRefusal[] = [];
  // Tokens claimed within this pass, so two identical tokens in one message
  // produce one chip rather than two attempts to attach the same thing.
  const claimed = new Set<string>();

  for (const mention of mentions) {
    if (!mention.settled && !includeUnsettled) continue;
    if (dismissed?.has(mention.token)) continue;
    if (claimed.has(mention.token)) continue;
    claimed.add(mention.token);

    // Already on the row — whether a mention put it there or the picker did.
    // The second case is BLD-016's `attachment` kind in practice: mentioning a
    // file you already dropped names it in the sentence and must not attach a
    // second copy of the bytes.
    if (attached.some((ref) => ref.mention === mention.token || labelMatches(ref.label, mention.label))) continue;

    const candidate = findCandidate(candidates, mention.label);
    if (candidate) {
      attach.push({ candidate, token: mention.token });
      continue;
    }
    refusals.push({
      token: mention.token,
      label: mention.label,
      reason: `Nothing in this project is called ${mention.label}.`
    });
  }

  const detach = attached
    .filter((ref) => ref.mention !== undefined && !present.has(ref.mention))
    .map((ref) => ref.id);

  return { attach, detach, refusals };
}

/**
 * Exact first, then a unique case-insensitive match.
 *
 * The fallback is for the typed path — `@pages/home` is unmistakably a mention
 * of `Pages/Home` and refusing it would be pedantry. It is *unique* rather than
 * first-wins because a project that really does contain `Checkout` and
 * `checkout` has an ambiguity, and picking one of them silently is how a
 * mention attaches the wrong component and nobody ever finds out.
 */
function findCandidate(candidates: readonly MentionCandidate[], label: string): MentionCandidate | undefined {
  const exact = candidates.find((candidate) => candidate.label === label);
  if (exact) return exact;
  const lower = label.toLowerCase();
  const loose = candidates.filter((candidate) => candidate.label.toLowerCase() === lower);
  return loose.length === 1 ? loose[0] : undefined;
}

function labelMatches(a: string, b: string): boolean {
  return a === b || a.toLowerCase() === b.toLowerCase();
}

// ── The menu's other half: filtering ─────────────────────────────────────────

/** How many rows one group shows before it stops. */
export const MENTION_GROUP_LIMIT = 8;

/**
 * Rank candidates against what has been typed after the `@`.
 *
 * Three tiers, and the middle one is the reason this is not a plain `filter`: a
 * project's components are `Pages/Checkout`, `Library/Layout/Row` — every useful
 * name is a *suffix* of a path, so a prefix-only match makes the menu useless
 * the moment anybody types the name of the thing rather than the folder it is
 * in. Segment matches therefore rank above bare substring hits and below whole
 * prefixes.
 */
export function filterMentionCandidates<T extends MentionCandidate>(
  candidates: readonly T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...candidates];

  const scored: Array<{ candidate: T; rank: number }> = [];
  for (const candidate of candidates) {
    const label = candidate.label.toLowerCase();
    const at = label.indexOf(q);
    if (at === -1) continue;
    const segmentStart = at === 0 || label[at - 1] === '/';
    scored.push({ candidate, rank: at === 0 ? 0 : segmentStart ? 1 : 2 });
  }
  // Stable within a rank: the sources hand these over already sorted by label,
  // and re-sorting alphabetically inside a tier would undo that for no gain.
  return scored.sort((a, b) => a.rank - b.rank).map((entry) => entry.candidate);
}
