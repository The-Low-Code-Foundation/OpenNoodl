/**
 * BLD-011 — what a turn carries besides the words.
 *
 * Richard asked for four things: file upload, web search, headless render for
 * context, and `@` mentions. Built as four features they are four bolt-ons to a
 * composer that sends a single string — four ways to stuff a prompt, four cost
 * models, and four places to get caching wrong. Built as one mechanism they are
 * this module plus a resolver per kind: **the composer stops being an input and
 * becomes a context builder.**
 *
 * ## Why this file is pure
 *
 * Same boundary `types.ts` draws for the turn model, for the same reason: the
 * part where a mistake is invisible on screen is the *arithmetic* — a cap that
 * silently drops half a document, a carry-over rule that re-attaches something
 * the user unpinned, a cost meter that under-reports. All of that is graded in
 * `tests-unit/bld-011/` in a plain-Node runner. Anything that needs a
 * `ProjectModel` lives in `authoring/referenceSources.ts` and hands its result
 * back here as text.
 *
 * ## Rule 6 — references ride behind the cache boundary
 *
 * This is the load-bearing constraint and it is not optional. AIX-007 made the
 * prompt prefix byte-stable across every turn of every session, and `AiMessage`
 * carries an explicit `cacheBoundary` for exactly this reason. A reference is
 * per-turn content by definition, so it renders into the **variable** half of
 * the opening turn, beside `planContext` — never into the reference blocks
 * above the boundary. {@link renderReferenceBlock} produces that block and
 * nothing else; the two call sites that place it are
 * `prompts/authoring.ts:referenceBlock` and `prompts/planning.ts`, both after
 * every stable byte.
 *
 * The consequence worth stating, because it is the thing a cost meter must not
 * hide: **references are never cached.** A pinned 8k reference is 8k of fresh
 * input on every turn it rides. {@link referenceCost} reports that in those
 * terms rather than as an undifferentiated total.
 *
 * @module AiAssistant/thread/references
 */

import type { AiContentBlock, AiDocumentBlock, AiImageBlock } from '../client/content';
import { truncateDoc } from '../../ProjectDocs/docsText';

/**
 * Where a reference came from.
 *
 * One union, extended by a task at a time — each later task adds its member and
 * its resolver and touches nothing else here. `component` and `doc` are live
 * (BLD-011); the rest are declared so that the chip row, the caps, the cost
 * meter and the persistence format are written once against the whole shape
 * rather than widened four more times.
 */
export type ReferenceKind =
  /** BLD-016's `@` targets — all four resolve out of the open project. */
  | 'component'
  | 'doc'
  | 'page'
  | 'collection'
  /** BLD-013 — dropped, pasted or picked. */
  | 'file'
  /** BLD-014 — the live app or an arbitrary URL, rendered. */
  | 'capture'
  /** BLD-015 — a query and its results. */
  | 'search';

/** What a resolver produced. `chars` counts the text as it will be sent. */
export interface ReferenceResolution {
  /** Rendered for the prompt, already capped and already saying so if it was. */
  text?: string;
  /** BLD-012 blocks. Empty for every kind BLD-011 ships; filled by 013 and 014. */
  images?: AiImageBlock[];
  /** BLD-013 blocks — a dropped PDF, sent whole to a provider that takes one. */
  documents?: AiDocumentBlock[];
  /** Length of `text` as sent — post-cap, so the meter never over-promises. */
  chars: number;
  /** True when {@link capReferenceText} cut it. */
  truncated: boolean;
  /** Length before the cap, so the chip can say what fraction is present. */
  originalChars: number;
  /**
   * BLD-013 — decoded size of the media this reference carries, in bytes.
   *
   * ⚠️ A **second unit**, deliberately not folded into `chars`. A 900KB
   * screenshot and a 900k-character document cost wildly different amounts and
   * are limited by different things — one by a request-size ceiling, the other
   * by the context window — and a meter that added them would report a number
   * that is true of neither. Absent on a text-only reference, which is what
   * keeps the meter's media clause off every chip that has no media.
   */
  bytes?: number;
}

/**
 * A reference as the composer holds it.
 *
 * Resolution is eager — on attach, not on send — because build item 6 requires
 * a resolver that cannot fulfil a reference to fail **in the chip, before
 * send**. A reference that only fails at request time has already cost a
 * provider round trip to discover, and it fails at the moment the user has
 * stopped looking at the composer.
 *
 * The resolved text is then reused at send rather than re-read, which is what
 * "resolution happens once" means in practice: what the chip measured is what
 * the request carries. The one exception is a stale `capture` — see
 * {@link isStale}.
 */
export interface AttachedReference {
  /** Stable for the life of the attachment; the chip's React key. */
  id: string;
  kind: ReferenceKind;
  /** What the chip says: `Pages/Checkout`, `docs/BRIEF.md`, `brief.pdf`. */
  label: string;
  /**
   * How the resolver found it — a legacy name, a doc path, a URL.
   *
   * Carried rather than parsed back out of `id`: the picker needs to know what
   * is already attached, and deriving that from an id's shape would make the id
   * format load-bearing for a second reason and break the moment a target
   * contains the separator. A doc path never will; a BLD-015 search query
   * absolutely will.
   */
  target: string;
  /**
   * Rule 7 — rides every turn, or just this one.
   *
   * A mock you are copying should ride ten turns. A screenshot of your own app
   * is true for about one, because the agent is actively changing the thing it
   * depicts. Defaulted per kind by {@link defaultPinned}, never globally.
   */
  pinned: boolean;
  status: 'resolving' | 'ready' | 'failed';
  resolution?: ReferenceResolution;
  /** Why it could not be fulfilled. Shown on the chip; blocks send. */
  error?: string;
  /**
   * BLD-013 — something true about this reference that is **not** a failure.
   *
   * ⚠️ A separate field from `error` precisely so it cannot block the send.
   * Q5's PDF warning is the case: the attachment resolved, the bytes are real,
   * and the only thing wrong is that *this* model will be handed the twin
   * instead. Folding that into `error` would have made `blockingReferences`
   * refuse to send a turn the user deliberately composed — a warning that
   * behaves like a failure is a failure with better manners.
   */
  warning?: string;
  /**
   * BLD-014 — the project's apply-count when a `capture` was taken. Undefined
   * for every other kind, which is what makes {@link isStale} a no-op for them
   * rather than a rule they have to opt out of.
   */
  capturedAtApply?: number;
}

/**
 * Per-reference cap, by kind, in characters.
 *
 * Capping *per reference* rather than trusting a shared budget to notice is
 * `DOC_CAPS`' rule and it is here for the same reason: a single dropped
 * 200k-character file should not silently evict the four small references the
 * user actually reasoned about. The turn total is then a sum of bounded things.
 *
 * A `component` gets the most because its serialization is the densest thing
 * here and half a graph is not a graph.
 */
export const REFERENCE_CAPS: Record<ReferenceKind, number> = {
  component: 24_000,
  doc: 12_000,
  page: 12_000,
  collection: 6_000,
  file: 12_000,
  capture: 2_000,
  search: 8_000
};

/**
 * Rule 7's default, decided per kind rather than globally.
 *
 * Everything the project owns is stable while the conversation runs, so it
 * pins. A `capture` does not: it depicts a thing the agent is in the middle of
 * changing, and re-sending yesterday's screenshot as though it were today's is
 * the exact failure Rule 7 exists to prevent.
 */
export function defaultPinned(kind: ReferenceKind): boolean {
  return kind !== 'capture';
}

/**
 * Cut a reference's text to its cap, and say so in the text the model reads.
 *
 * Reuses `truncateDoc`'s heading-boundary cut rather than adding a second
 * truncator — the cut lands on a heading so the model reads whole sections, and
 * the sentence below is the same contract `renderDocForPrompt` already keeps:
 * **a silently short reference is the failure mode the docs format learned to
 * avoid.** The model is told what it is missing and where the rest lives, so it
 * can ask rather than assume the reference said nothing on the subject.
 */
export function capReferenceText(source: string, label: string, cap: number): ReferenceResolution {
  const { text, truncated, originalChars } = truncateDoc(source, cap);
  if (!truncated) return { text, chars: text.length, truncated: false, originalChars };

  const stated = [
    text,
    '',
    `[TRUNCATED — ${label} is ${originalChars} characters and only the first ${text.length} are shown here.`,
    'Do not assume the omitted part is empty or irrelevant; ask if the task depends on it.]'
  ].join('\n');
  return { text: stated, chars: stated.length, truncated: true, originalChars };
}

/** The heading a kind gets in the prompt. Stable — it is part of the format. */
const KIND_HEADINGS: Record<ReferenceKind, string> = {
  component: 'COMPONENT',
  doc: 'DOCUMENT',
  page: 'PAGE',
  collection: 'COLLECTION',
  file: 'ATTACHED FILE',
  capture: 'SCREENSHOT',
  search: 'WEB SEARCH'
};

/**
 * The references, rendered as one block for the variable half of a turn.
 *
 * Returns `undefined` — not an empty string — when there is nothing to send, so
 * that a turn with no references produces a prompt byte-identical to the one it
 * would have produced before this task existed. That absent-means-omitted
 * convention is the same one `docBlocks`, `libraryBlock` and `styleBlock` keep,
 * and it is what makes the cache-safety check in `tests-unit/bld-011/` a
 * comparison rather than an allowance.
 *
 * ⚠️ A stale reference states its age *in the text* (Rule 7: nothing stale is
 * ever sent silently). It is not dropped here — dropping it would be a silent
 * edit of what the user chose to send.
 */
export function renderReferenceBlock(refs: readonly AttachedReference[], applyCount?: number): string | undefined {
  const usable = refs.filter((r) => r.status === 'ready' && r.resolution?.text);
  if (usable.length === 0) return undefined;

  const lines: string[] = [
    '--- ATTACHED CONTEXT ---',
    'The user attached these to this message. They are context for the task, not the task itself.'
  ];
  for (const ref of usable) {
    const heading = KIND_HEADINGS[ref.kind];
    const age = staleNote(ref, applyCount);
    lines.push('', `--- ${heading}: ${ref.label} ---`, ...(age ? [age] : []), ref.resolution!.text!, `--- END ${heading} ---`);
  }
  lines.push('--- END ATTACHED CONTEXT ---');
  return lines.join('\n');
}

/**
 * BLD-013 — the binary half of what the references carry, in send order.
 *
 * ## Why this is a second function rather than more of {@link renderReferenceBlock}
 *
 * Rule 6 puts the *text* after the cache boundary, and that is a statement
 * about where a string is concatenated. Media cannot be concatenated into a
 * string at all — it has to survive as blocks all the way to the adapter, or
 * `degradeImages` has nothing to degrade and the twin contract silently stops
 * being enforceable. So a turn that carries media sends **block content**, and
 * this returns the blocks while `renderReferenceBlock` returns the prose that
 * names them.
 *
 * ⚠️ The two must be assembled in this order — media first, then the text
 * block. Anthropic's own guidance puts a document before the text that refers
 * to it, and the same order is what makes an image's caption read as a caption
 * rather than as a prediction.
 *
 * Documents lead images within a reference for the same reason: a PDF is the
 * bulky thing the request is *about*, and a screenshot is usually commentary
 * on it.
 */
export function referenceMediaBlocks(refs: readonly AttachedReference[]): AiContentBlock[] {
  const blocks: AiContentBlock[] = [];
  for (const ref of refs) {
    if (ref.status !== 'ready' || !ref.resolution) continue;
    blocks.push(...(ref.resolution.documents ?? []), ...(ref.resolution.images ?? []));
  }
  return blocks;
}

/** Whether this turn has anything that must ride as blocks rather than prose. */
export function hasReferenceMedia(refs: readonly AttachedReference[]): boolean {
  return referenceMediaBlocks(refs).length > 0;
}

/**
 * 🔴 Rule 6 for media, and it is the opposite of the order everywhere else.
 *
 * An authoring turn is one string with a **character offset** marking where the
 * cache-stable prefix ends (`AuthoringSession` → `openingTurn`). Block content
 * has no offsets, so a turn that carries media has to express the same boundary
 * as a `cache: true` marker instead — and *that is where the whole cost of this
 * feature is decided*.
 *
 * `referenceMediaBlocks` puts media first, because a document should precede
 * the prose that discusses it. Doing the same here would put a 900KB screenshot
 * **ahead of the breakpoint**, which does not merely cost the screenshot: it
 * changes the prefix, so every send carrying one silently re-bills the entire
 * AIX-007 stable half — the project overview, the node catalog, the style
 * vocabulary, the docs — uncached, on every operation of every plan. Nothing on
 * screen would change. The only symptom is the invoice.
 *
 * So media lands **after** the marked block and before the task, which is the
 * same position `renderReferenceBlock`'s prose occupies, and for the identical
 * reason. `tests-unit/bld-013/` asserts the *index* of the marked block as well
 * as its bytes: a prefix that is the same length by luck is not the same
 * prefix, and this ordering is exactly the kind of thing a later refactor
 * "tidies" into the natural reading order.
 */
export function openingTurnWithMedia(
  content: string,
  cacheBoundary: number | undefined,
  media: readonly AiContentBlock[]
): AiContentBlock[] {
  const usable = typeof cacheBoundary === 'number' && cacheBoundary > 0 && cacheBoundary < content.length;
  if (!usable) {
    // No usable prefix to protect, so recency wins and media leads — the
    // planning turn's ordering. Nothing is cached either way.
    return [...media, { type: 'text', text: content }];
  }
  return [
    { type: 'text', text: content.slice(0, cacheBoundary), cache: true },
    ...media,
    { type: 'text', text: content.slice(cacheBoundary) }
  ];
}

/**
 * BLD-014 — a capture taken before the last apply depicts a project that no
 * longer exists.
 *
 * Only ever true for a reference that recorded a `capturedAtApply`, so every
 * other kind is exempt by having no opinion rather than by an exception.
 */
export function isStale(ref: AttachedReference, applyCount?: number): boolean {
  if (ref.capturedAtApply === undefined || applyCount === undefined) return false;
  return applyCount > ref.capturedAtApply;
}

/** How many applies ago a capture was taken; `undefined` when it is current. */
export function staleAge(ref: AttachedReference, applyCount?: number): number | undefined {
  if (!isStale(ref, applyCount)) return undefined;
  return applyCount! - ref.capturedAtApply!;
}

/** Rule 7's "sent with its age stated in the text" — the sentence that states it. */
function staleNote(ref: AttachedReference, applyCount?: number): string | undefined {
  const age = staleAge(ref, applyCount);
  if (age === undefined) return undefined;
  return `[STALE — taken ${age} ${age === 1 ? 'change' : 'changes'} ago. The project has been edited since; treat this as history, not as the current state.]`;
}

/**
 * Rule 7 — what survives into the next turn.
 *
 * Pinned references carry; unpinned ones perish, having ridden exactly the turn
 * they were attached to. A failed reference never carries: it did not ride the
 * turn it was attached to either, and silently retrying it every turn is how a
 * broken attachment becomes permanent background noise.
 */
export function carryOver(refs: readonly AttachedReference[]): AttachedReference[] {
  return refs.filter((ref) => ref.pinned && ref.status === 'ready');
}

/** What the meter above the composer reports. */
export interface ReferenceCost {
  count: number;
  /** Characters that will be sent this turn, post-cap. */
  chars: number;
  /** Of those, the characters that will be sent again on every later turn. */
  pinnedChars: number;
  /** Images attached this turn. Zero for every kind BLD-011 ships. */
  images: number;
  /** BLD-013 — documents attached this turn. */
  documents: number;
  /** BLD-013 — decoded media bytes this turn. See {@link ReferenceResolution.bytes}. */
  bytes: number;
  /** True when any reference was cut, so the meter can say so. */
  truncated: boolean;
}

/**
 * The cost of what is attached, in the terms Rule 6 makes true.
 *
 * ⚠️ There is no "cached share" line to report, and that absence is the finding
 * rather than an omission: **every one of these characters lands after the
 * cache boundary, so none of them is ever cached.** A meter that folded them
 * into a percentage-cached figure would be reporting the prefix's virtue as
 * though the attachments shared it. `pinnedChars` is the number that actually
 * compounds — it is what a pinned reference costs on every subsequent turn, for
 * as long as it stays pinned.
 */
export function referenceCost(refs: readonly AttachedReference[]): ReferenceCost {
  let chars = 0;
  let pinnedChars = 0;
  let images = 0;
  let documents = 0;
  let bytes = 0;
  let truncated = false;

  for (const ref of refs) {
    if (ref.status !== 'ready' || !ref.resolution) continue;
    chars += ref.resolution.chars;
    if (ref.pinned) pinnedChars += ref.resolution.chars;
    images += ref.resolution.images?.length ?? 0;
    documents += ref.resolution.documents?.length ?? 0;
    bytes += ref.resolution.bytes ?? 0;
    if (ref.resolution.truncated) truncated = true;
  }

  return { count: refs.length, chars, pinnedChars, images, documents, bytes, truncated };
}

/**
 * Build item 6 — a reference the resolver could not fulfil blocks the send.
 *
 * Sending anyway would produce a turn whose prompt is missing something the
 * user watched themselves attach, and the only evidence would be a chip they
 * have already scrolled past. Failing closed is the same call BLD-002 made for
 * a failed submission never collapsing.
 */
export function blockingReferences(refs: readonly AttachedReference[]): AttachedReference[] {
  return refs.filter((ref) => ref.status === 'failed' || ref.status === 'resolving');
}

/**
 * BLD-006 persists turns, so it persists these — but **not their bytes.**
 *
 * The retention rule build item 5 asks for, decided here and stated in one
 * place: a thread file records *what rode along* — kind, label, size, pin state
 * — and never the resolved text. A 24k component serialization per turn would
 * make `.nodegx/threads/<id>.jsonl` unreadable within a dozen turns and would
 * put a second, silently diverging copy of the project on disk. Reopening a
 * thread therefore shows what each turn carried, which is what the acceptance
 * criterion asks for, and does not pretend to be able to replay it.
 */
export interface TurnReference {
  kind: ReferenceKind;
  label: string;
  chars: number;
  pinned: boolean;
  truncated?: boolean;
}

/** The persisted record of what a turn carried. */
export function toTurnReferences(refs: readonly AttachedReference[]): TurnReference[] {
  return refs
    .filter((ref) => ref.status === 'ready' && ref.resolution)
    .map((ref) => ({
      kind: ref.kind,
      label: ref.label,
      chars: ref.resolution!.chars,
      pinned: ref.pinned,
      ...(ref.resolution!.truncated ? { truncated: true } : {})
    }));
}
