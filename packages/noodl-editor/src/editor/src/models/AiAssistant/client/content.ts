/**
 * Multimodal message content — the closed union, and the four operations every
 * provider needs to consume it.
 *
 * BLD-012. `AiMessage.content` was a string. Widening it is the narrow-waist
 * change that unblocks every image-carrying feature in Track B (an uploaded
 * mock, a capture of the running app), because the machinery one layer down —
 * Anthropic's block arrays — has always been able to carry them.
 *
 * Two rules shape everything here.
 *
 * **A block union is closed, unlike a provider's.** `AnthropicRequestBlock` is
 * deliberately open (`[field: string]: unknown`) because it models someone
 * else's wire format, which grows without asking us. This one is ours: a new
 * kind is a decision, made here, with every provider updated in the same
 * commit. An open union would let a block reach an adapter that has no case for
 * it and be dropped on the floor.
 *
 * **An image always carries its text twin, and the twin is not optional.**
 * Phase 55's standing rule is that a support system which only works with the
 * strongest frontier model is a demo. Most mid-tier open-weight models cannot
 * take an image at all, and LAS-009 shipped per-role providers — so Anthropic
 * on `design` and Ollama on `act`, in one build, is a configuration a user can
 * legitimately have. Requiring the twin at the type level is what makes
 * `degrade` total: there is no image this module can be handed that it cannot
 * render as text, so no adapter ever needs a silent-drop branch.
 *
 * @module AiAssistant/client/content
 */

/** What the providers below can actually encode. Not an open set. */
export type AiImageMediaType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

export const AI_IMAGE_MEDIA_TYPES: readonly AiImageMediaType[] = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp'
] as const;

interface AiBlockBase {
  /**
   * Marks this block as the end of the cache-stable prefix — the block form of
   * `AiMessage.cacheBoundary`. Providers with prefix caching set a breakpoint
   * on the last block carrying it; everyone else ignores it.
   *
   * See `cacheBlockIndex` for why this is a marker rather than an index.
   */
  cache?: boolean;
}

export interface AiTextBlock extends AiBlockBase {
  type: 'text';
  text: string;
}

export interface AiImageBlock extends AiBlockBase {
  type: 'image';
  /** Raw base64. No `data:` prefix — adapters that want a data URL build one. */
  data: string;
  mediaType: AiImageMediaType;
  /**
   * The text twin: what a model without vision is told instead.
   *
   * Required, not optional. LAS-005 made this argument for the render report —
   * it returns the numbers *and* the screenshots, because "the JSON report is
   * what a text-only agent can act on". The worst available failure mode is an
   * agent confidently discussing a picture it never received, and an optional
   * twin is how you get one.
   */
  text: string;
}

export type AiContentBlock = AiTextBlock | AiImageBlock;

/** Message content in either form. String remains the overwhelmingly common case. */
export type AiContent = string | AiContentBlock[];

export function isBlockContent(content: AiContent): content is AiContentBlock[] {
  return Array.isArray(content);
}

/**
 * Content as blocks. An empty string yields no blocks rather than one empty
 * text block, because the Anthropic API rejects an empty text block outright.
 */
export function asBlocks(content: AiContent): AiContentBlock[] {
  if (isBlockContent(content)) return content;
  return content ? [{ type: 'text', text: content }] : [];
}

/**
 * Wrapper for a degraded image, stated in the text so the model knows it is
 * reading a description rather than looking at a picture.
 *
 * The wording is deliberately blunt and deliberately stable: it is a contract
 * with the model, and it is asserted byte-for-byte by the BLD-012 specs.
 */
export function degradedImageText(block: AiImageBlock): string {
  return [
    `[image omitted — the model serving this request cannot receive images. What follows is a description of it, not the image itself.]`,
    block.text,
    `[end of image description]`
  ].join('\n');
}

/**
 * Content as one plain string, with every image replaced by its declared twin.
 *
 * This is the degrade path, and it is the *only* way an adapter without vision
 * is allowed to render content — which is what makes "no image is ever dropped
 * silently" a property of the module rather than a promise in four adapters.
 */
export function asText(content: AiContent): string {
  if (!isBlockContent(content)) return content;
  return content
    .map((block) => (block.type === 'image' ? degradedImageText(block) : block.text))
    .filter((text) => text.length > 0)
    .join('\n\n');
}

/**
 * Replace every image with a text block carrying its declared twin, leaving the
 * array a block array.
 *
 * This is the degrade path for a provider that speaks blocks but is pointed at
 * a model without vision (Anthropic on a hypothetical text-only id). Flattening
 * all the way to a string would work too — and would throw away the `cache`
 * marker with it, silently moving the breakpoint. So the marker is carried onto
 * the substituted block: degrading an image must not change where the prefix
 * ends.
 */
export function degradeImages(content: AiContent): AiContent {
  if (!isBlockContent(content) || !hasImage(content)) return content;
  return content.map<AiContentBlock>((block) =>
    block.type === 'image'
      ? { type: 'text', text: degradedImageText(block), ...(block.cache ? { cache: true } : {}) }
      : block
  );
}

export function hasImage(content: AiContent): boolean {
  return isBlockContent(content) && content.some((block) => block.type === 'image');
}

/**
 * Index of the block that ends the cache-stable prefix, or -1.
 *
 * ⚠️ Why a marker on the block and not an index into the array — the decision
 * BLD-012 had to make, and the one that fails silently if it is wrong.
 *
 * `cacheBoundary` is a *character offset* into string content
 * (`types.ts`), which is meaningless against blocks. Of the two ways to
 * redefine it, an explicit `cache: true` on the last stable block wins over a
 * block index on three counts:
 *
 * 1. **It leaves the string path untouched.** Offset semantics keep their exact
 *    meaning for string content, so a text-only turn produces a byte-identical
 *    request to before this task — pinned by the golden in
 *    `tests-unit/bld-012/anthropicRequest.golden.test.ts`. A block index would
 *    have meant one field with two meanings.
 * 2. **It cannot drift.** An index is positional: insert a reference block
 *    ahead of the boundary and the index silently points at the wrong block,
 *    moving the breakpoint with no error and no visible symptom — the exact
 *    failure this task was warned about. A marker travels with its block.
 * 3. **It matches the wire.** Anthropic's own form is a marker on a block
 *    (`cache_control`), so this maps 1:1 with no arithmetic in between.
 *
 * The last marked block wins, mirroring `markCacheBreakpoint`, which marks the
 * last block of a message.
 */
/**
 * Reject the one combination that would silently cost money: a character
 * offset handed to block content.
 *
 * Every adapter mapper calls this on every message. It throws rather than
 * ignoring, because ignoring is precisely the failure this task was warned
 * about — prompt caching stops working, nothing on screen says so, and the only
 * evidence is the invoice a month later. A thrown error in a jest run is
 * cheaper than that by every measure.
 *
 * A plain `Error`, not an `AiClientError`: this is a caller bug, not something
 * a provider did, and `types.ts` imports this module so the error class is not
 * reachable from here anyway.
 */
export function assertCacheBoundary(message: { content: AiContent; cacheBoundary?: number }): void {
  if (typeof message.cacheBoundary === 'number' && isBlockContent(message.content)) {
    throw new Error(
      'cacheBoundary is a character offset and applies to string content only. ' +
        'For block content, set `cache: true` on the last cache-stable block instead.'
    );
  }
}

export function cacheBlockIndex(content: AiContent): number {
  if (!isBlockContent(content)) return -1;
  for (let i = content.length - 1; i >= 0; i--) {
    if (content[i].cache) return i;
  }
  return -1;
}
