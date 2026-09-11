/**
 * UNI-011 — the boundary a stranger's post body crosses to reach the editor.
 *
 * 🔴 THE SINK, RESTATED BECAUSE IT IS THE WHOLE REASON THIS FILE EXISTS. The editor's
 * renderer is `nodeIntegration: true, contextIsolation: false` (`main/main.js`), and so is
 * the launcher — `pages/ProjectsPage` lives in the *same* `BrowserWindow`, so moving a
 * community surface there buys nothing. `require` is reachable from page script in both.
 * This phase has already been bitten once by exactly this: a `javascript:` URL in a *lesson*
 * body compiled into a live anchor and was arbitrary code with filesystem access
 * (RULINGS.md, the second amendment). A lesson is content a user chose to install. **Forum
 * posts are the same shape from strangers, unbounded, and changing daily.**
 *
 * ─────────────────────────────────────────────────────────────────────────────────
 * ## Which of UNI-011's two boundaries this is, and why it is neither exactly
 *
 * The task offers a `<webview>` island (A) or raw markdown through a sanitiser (B), and says
 * to pick one. This is B's transport — the API serves unrendered markdown — with B's *output*
 * changed, and the change is the point:
 *
 * 🔴 **This parser emits a data model. It never emits an HTML string, at any stage.** Not one
 * that is escaped, not one that is sanitised, not one that is allow-listed. `Block[]` has no
 * field that could hold markup, so there is nothing for a view to hand to `innerHTML` even by
 * mistake — the view walks the model and builds React elements, whose text children the
 * runtime escapes because they are text.
 *
 * ⚠️ **Why not reuse `renderMarkdown` from `lessonformat.ts`, which is right there and does
 * this job for lessons.** Measured rather than assumed — `tests-unit/uni-011/postbody.test.ts`
 * runs the known-bad corpus through *both* — and the honest finding is that it **holds on
 * every case in the corpus**: it escapes before it substitutes, and its hrefs go through the
 * same `safeLessonUrl` this file uses. So this is not a defect report about shipped code.
 *
 * The objection is structural, and it is exactly the one AC1 raises: the criterion asks for a
 * boundary *"proved by the chosen boundary's test, not by inspection"*, and "this string is
 * safe because `escapeHtml` runs before the regex substitutions" is an inspection argument
 * about an ordering that a future edit can reverse without any test noticing. The corpus that
 * lesson code faces is a bundle a user installed; the corpus this faces is whatever a stranger
 * typed this morning. A model with no place to put markup makes the argument unnecessary.
 *
 * ⚠️ **What this does NOT do, stated because an unstated limit reads as coverage:** it does not
 * make the renderer safe. It makes *one payload* unable to reach the sink. Any future surface
 * that fetches a body and hands it to `dangerouslySetInnerHTML` is outside this file, and no
 * test here would see it.
 */
import { safeLessonUrl } from '../lessonformat';

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  colon: ':',
  tab: '\t',
  newline: '\n',
  nbsp: ' '
};

function decodeEntitiesOnce(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[String(name).toLowerCase()] ?? m);
}

/**
 * The allow-list, asked about what the URL would MEAN after an HTML parser had read it.
 *
 * 🔴 THIS FUNCTION EXISTS BECAUSE THE FIRST DRAFT'S SAFETY RESTED ON A PROPERTY OF ITS
 * CONSUMER, which is the exact class of argument the model design was chosen to eliminate.
 *
 * `[x](&#106;avascript:alert(1))` reaches `safeLessonUrl` with no scheme — `&` fails the
 * scheme test — so it is classified *relative* and passed through verbatim. That is harmless
 * as long as the href is set the way React sets a prop, with `setAttribute`, because nothing
 * decodes the entity. Emit the same string into an HTML *string* and the parser decodes
 * `&#106;` to `j` before the URL is ever resolved, and it is `javascript:alert(1)`.
 *
 * So the first draft was safe **because of how a view happened to render it**, and every
 * sentence in this file's header about not depending on such arguments would have been
 * hollow. The probe is decoded to a fixed point and the allow-list is asked about *that*;
 * the accepted href is still the raw text, because the source here is markdown rather than
 * HTML and `&amp;` in a markdown URL is literally an ampersand-a-m-p.
 *
 * ⚠️ Found by the known-bad corpus, on the entry that looked like the most theoretical one
 * in the list. It was the cheapest-looking case and it was the one carrying the assumption.
 */
export function safeCommunityUrl(raw: string): string | undefined {
  let probe = String(raw ?? '');
  for (let i = 0; i < 3; i += 1) {
    const next = decodeEntitiesOnce(probe);
    if (next === probe) break;
    probe = next;
  }
  // Both readings must pass: what it says, and what it would say after a parser read it.
  if (!safeLessonUrl(probe)) return undefined;
  return safeLessonUrl(raw);
}

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'em'; text: string }
  | { kind: 'link'; text: string; href: string };

export type Block =
  | { kind: 'paragraph'; inlines: Inline[] }
  | { kind: 'heading'; level: 1 | 2 | 3 | 4; inlines: Inline[] }
  | { kind: 'list'; ordered: boolean; items: Inline[][] }
  | { kind: 'codeblock'; text: string };

/**
 * One pass, left to right, so a construct inside a code span is never re-read as markup.
 *
 * ⚠️ Ordering is load-bearing in the alternation: the code span comes first, which is what
 * makes `` `**not bold**` `` a code span containing asterisks rather than bold text inside
 * backticks. `lessonformat`'s `inlineMarkdown` gets the same answer by running the code-span
 * substitution first; here it falls out of the scan.
 */
const INLINE_SCAN =
  /`([^`]+)`|\[([^\]]*)\]\(([^)\s]*)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_/g;

function pushText(out: Inline[], text: string): void {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.kind === 'text') last.text += text;
  else out.push({ kind: 'text', text });
}

export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let cursor = 0;
  INLINE_SCAN.lastIndex = 0;

  for (let m = INLINE_SCAN.exec(source); m; m = INLINE_SCAN.exec(source)) {
    pushText(out, source.slice(cursor, m.index));
    cursor = m.index + m[0].length;

    const [, code, linkLabel, linkHref, strong, emStar, emUnderscore] = m;
    if (code !== undefined) {
      out.push({ kind: 'code', text: code });
    } else if (linkLabel !== undefined) {
      // 🔴 The one place a stranger's string becomes a URL. `safeLessonUrl` is the allow-list
      // the second amendment shipped — reused rather than re-derived, because a second copy of
      // a scheme allow-list is a second thing to update when the next scheme is found.
      const href = safeCommunityUrl(linkHref ?? '');
      if (href) {
        out.push({ kind: 'link', text: linkLabel, href });
      } else {
        // A refused link keeps its words and loses its href, which is what lesson rendering
        // already does: deleting the label leaves a hole in a sentence somebody wrote, and a
        // dead link is visible feedback that something was rejected.
        pushText(out, linkLabel);
      }
    } else if (strong !== undefined) {
      out.push({ kind: 'strong', text: strong });
    } else {
      out.push({ kind: 'em', text: (emStar ?? emUnderscore) as string });
    }
  }

  pushText(out, source.slice(cursor));
  return out;
}

const HEADING = /^(#{1,4})\s+(.*)$/;
const BULLET = /^\s*[-*]\s+/;
const NUMBERED = /^\s*\d+\.\s+/;

export function parsePostBody(markdown: string | null | undefined): Block[] {
  if (!markdown) return [];
  const blocks: Block[] = [];
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // A fenced code block swallows everything to its closing fence, unparsed. Nothing inside
    // is markup, and nothing inside becomes a link.
    if (/^\s*```/.test(line)) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // the closing fence, or the end of the input
      blocks.push({ kind: 'codeblock', text: body.join('\n') });
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({
        kind: 'heading',
        level: heading[1].length as 1 | 2 | 3 | 4,
        inlines: parseInline(heading[2])
      });
      i += 1;
      continue;
    }

    if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = !BULLET.test(line);
      const pattern = ordered ? NUMBERED : BULLET;
      const items: Inline[][] = [];
      while (i < lines.length && pattern.test(lines[i])) {
        items.push(parseInline(lines[i].replace(pattern, '')));
        i += 1;
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !HEADING.test(lines[i]) &&
      !BULLET.test(lines[i]) &&
      !NUMBERED.test(lines[i]) &&
      !/^\s*```/.test(lines[i])
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push({ kind: 'paragraph', inlines: parseInline(paragraph.join('\n')) });
  }

  return blocks;
}

/**
 * Every URL the model would put in an `href`, for a caller that wants to check the boundary
 * from outside rather than trust it.
 *
 * ⚠️ Exported for the suite, and that is not a euphemism for dead code: the corpus test
 * quantifies over this rather than over a hand-written list of the places a link can appear,
 * so a link inside a list item — a place the first draft of the corpus did not look — is
 * covered by the same assertion.
 */
export function hrefsIn(blocks: Block[]): string[] {
  const found: string[] = [];
  const walkInlines = (inlines: Inline[]) => {
    for (const inline of inlines) if (inline.kind === 'link') found.push(inline.href);
  };
  for (const block of blocks) {
    if (block.kind === 'paragraph' || block.kind === 'heading') walkInlines(block.inlines);
    else if (block.kind === 'list') block.items.forEach(walkInlines);
  }
  return found;
}

// ─────────────────────────────────────────────────────────────────────────────────
// NAT-007 — reading a body the PLATFORM parsed
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * A block a reader could not render, named rather than dropped.
 *
 * 🔴 NAT-007 AC3: *"Any block kind the editor cannot render is **skipped visibly**, never passed
 * through raw."* The two failure modes this sits between are both real. Passing an unknown block
 * through is how a payload reaches a sink nobody audited. Dropping it silently is how a reader is
 * shown a post with a hole in it and no way to know — they answer the question that is missing a
 * paragraph, and neither end can see why.
 *
 * ⚠️ `label` is a **wire string** and is sanitised on the way in ({@link safeBlockLabel}). It
 * reaches React as a text child, so React escapes it; the sanitising is the second belt, for the
 * case where a future renderer puts it somewhere React does not escape.
 */
export type UnsupportedBlock = { kind: 'unsupported'; label: string };

/** What a *reader* holds: everything the parser can emit, plus what it could not. */
export type PostBlock = Block | UnsupportedBlock;

const BLOCK_KINDS = new Set(['paragraph', 'heading', 'list', 'codeblock']);
const PLAIN_INLINE_KINDS = new Set(['text', 'code', 'strong', 'em']);

/**
 * A wire `kind` reduced to something safe to print back at the reader.
 *
 * ⚠️ Capped and character-filtered rather than escaped: this is a diagnostic label, so losing an
 * exotic character costs nothing, and a 4KB "kind" rendered in full is a layout attack for free.
 */
function safeBlockLabel(kind: unknown): string {
  const cleaned = String(kind ?? '')
    .replace(/[^A-Za-z0-9_ -]/g, '')
    .trim()
    .slice(0, 40);
  return cleaned || 'unknown';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Inlines off the wire.
 *
 * 🔴 **An unknown inline kind keeps its words and loses its formatting**, rather than becoming an
 * `unsupported` marker of its own. The block-level rule and this one differ on purpose: a missing
 * *block* is a missing paragraph and the reader must be told, whereas a `strikethrough` a future
 * platform adds is one sentence rendered without its line through it — legible, complete, and not
 * worth interrupting somebody's reading to announce. What is never kept is an inline with no text
 * to keep.
 */
function readInlines(value: unknown): Inline[] {
  if (!Array.isArray(value)) return [];
  const out: Inline[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const kind = String(raw.kind ?? '');
    const textValue = typeof raw.text === 'string' ? raw.text : null;
    if (textValue === null) continue;

    if (kind === 'link') {
      // 🔴 THE HREF IS RE-CHECKED HERE, against this editor's allow-list, even though the
      // platform already ran its own. Three reasons, and the third is the one that matters:
      // the two allow-lists are separate copies that can drift; a client cannot know which
      // platform version answered it; and **this renderer is the sink** — `nodeIntegration:
      // true, contextIsolation: false`. A boundary that trusts the far side is not a boundary,
      // it is a convention. See this file's header for what that cost once already.
      const href = safeCommunityUrl(String(raw.href ?? ''));
      // A refused href keeps the words, exactly as `parseInline` does for a refused markdown
      // link: deleting the label leaves a hole in somebody's sentence.
      out.push(href ? { kind: 'link', text: textValue, href } : { kind: 'text', text: textValue });
      continue;
    }

    if (PLAIN_INLINE_KINDS.has(kind)) {
      out.push({ kind, text: textValue } as Inline);
      continue;
    }

    out.push({ kind: 'text', text: textValue });
  }
  return out;
}

/**
 * A post body as it arrives from the platform: **validated, not cast**.
 *
 * The platform parses markdown at its own boundary and puts `Block[]` on the wire, so the naive
 * client does `payload.blocks as Block[]` and renders it. 🔴 **That cast is the whole risk.** It
 * is a claim about JSON a stranger's post produced on a machine this editor does not control, and
 * a type assertion is not a check — a `{kind: 'html', raw: '…'}` a future platform emits, or a
 * `href` an older platform's allow-list let through, arrives typed as safe.
 *
 * ⚠️ This does NOT distrust the platform in the sense of expecting it to be hostile. It declines
 * to make the platform's parser part of *this* renderer's safety argument, which is the same
 * reason `parsePostBody` emits a model with nowhere to put markup rather than a sanitised string.
 *
 * @param value the raw `blocks` field, `unknown` because that is what it is.
 */
export function readPostBlocks(value: unknown): PostBlock[] {
  if (!Array.isArray(value)) return [];
  const out: PostBlock[] = [];

  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const kind = String(raw.kind ?? '');

    if (!BLOCK_KINDS.has(kind)) {
      out.push({ kind: 'unsupported', label: safeBlockLabel(raw.kind) });
      continue;
    }

    if (kind === 'paragraph') {
      out.push({ kind: 'paragraph', inlines: readInlines(raw.inlines) });
    } else if (kind === 'heading') {
      // ⚠️ Clamped rather than refused. A heading that arrives as level 7 is still a heading
      // somebody wrote words in, and turning it into an `unsupported` marker would delete the
      // words to enforce a number this renderer picked.
      const level = Number(raw.level);
      const clamped = (Number.isFinite(level) ? Math.min(4, Math.max(1, Math.round(level))) : 3) as 1 | 2 | 3 | 4;
      out.push({ kind: 'heading', level: clamped, inlines: readInlines(raw.inlines) });
    } else if (kind === 'list') {
      const items = Array.isArray(raw.items) ? raw.items.map(readInlines) : [];
      out.push({ kind: 'list', ordered: raw.ordered === true, items });
    } else {
      // A codeblock with no text is an empty code block, not a missing one.
      out.push({ kind: 'codeblock', text: typeof raw.text === 'string' ? raw.text : '' });
    }
  }

  return out;
}

/**
 * Every href a *read* body would put in an anchor — {@link hrefsIn} for `PostBlock[]`.
 *
 * ⚠️ Not a convenience wrapper: `hrefsIn` takes `Block[]`, and a spec that quantified over the
 * wire path by narrowing to `Block[]` first would be quantifying over the blocks that survived,
 * which is the population the claim is not about.
 */
export function hrefsInPost(blocks: PostBlock[]): string[] {
  return hrefsIn(blocks.filter((block): block is Block => block.kind !== 'unsupported'));
}
