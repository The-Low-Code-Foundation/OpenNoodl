/**
 * UNI-011 AC2 — *"Ask about this node"*, the composition.
 *
 * > Right-clicking a node offers "Ask about this node"; the composer opens prefilled with type,
 * > warning, version and OS; the graph excerpt is **off until enabled**, and what it will send is
 * > **shown before it sends**.
 *
 * The premise this pays off is UNI-011's own: *"the biggest reason people do not post is that
 * writing a good question is work; this does most of it, and answers improve because the context
 * is right."* So the value is in the prefill being **accurate**, and the risk is in the prefill
 * being **generous** — the editor knows a great deal about a project that its author has no
 * intention of telling a public forum.
 *
 * ## Three properties, each one testable
 *
 * 1. 🔴 **The excerpt is off unless it was asked for.** `includeExcerpt` defaults to `false` and
 *    the parameter is not optional-with-a-truthy-default anywhere downstream. AC2 words it as a
 *    property of the *composer*, not of the dialog, which is the right place for it: a default
 *    that lives in a React `useState` is one refactor away from being lost, and the thing that
 *    would be lost is silent.
 *
 * 2. 🔴 **There is one string, and it is both shown and sent.** {@link composeNodeQuestion}
 *    returns the exact text that gets posted, and the composer renders *that value*. "Shown
 *    before it sends" is not satisfied by a preview built from the same inputs by a second code
 *    path — two paths that agree today are the arrangement that stops agreeing, and the failure
 *    is a user who reviewed one thing and published another.
 *
 * 3. **Free text goes through ALPHA-007's redactor; structure goes through the allow-list.**
 *    Those are different instruments for different jobs and neither substitutes for the other.
 *    A warning message is *our* sentence with *the user's* content interpolated into it
 *    (`Component "Acme Legal Portal" not found`), so it is free text and gets
 *    [`redact`](../../utils/report/redact.ts). The graph is structure and gets
 *    [`nodeexcerpt`](./nodeexcerpt.ts)'s closed vocabulary. Running the regex over the graph
 *    instead would remove the secret *shapes* somebody thought of and leave the client's name.
 *
 * ⚠️ **What this deliberately does not carry**, because ALPHA-007 §3 already ruled on the same
 * question for the same reason: no parameter values, no project or component names, no backend
 * endpoint, no file paths. The node's *own* parameters are the most tempting field on this
 * screen — they are what the user is looking at when they hit the problem — and they are a
 * verbatim dump of things they typed.
 *
 * Pure: no editor singletons, no React, no I/O.
 *
 * @module models/community/nodequestion
 */

import { RedactorOptions, redact } from '../../utils/report/redact';
import { TYPE_COMPONENT, TYPE_UNKNOWN, bucketTypeName } from '../../utils/report/diagnostics';
import { GraphExcerpt, LibraryPorts, formatGraphExcerpt } from './nodeexcerpt';
import { ShareAttachment, formatShareAttachment, sharedPorts } from './portshare';

/** How much of a warning may be quoted. Long enough for a real message, short enough not to be a log. */
export const MAX_WARNING_CHARS = 600;

/** How a bucketed type is written in prose, when the bucket is not a real name. */
const TYPE_PROSE: Record<string, string> = {
  [TYPE_COMPONENT]: 'a component from my own project',
  [TYPE_UNKNOWN]: 'a node type the editor could not resolve'
};

export interface QuestionEnvironment {
  /** `platform.getVersion()`. */
  appVersion: string;
  /** `false` when running from source — a question from a dev build means something different. */
  packaged?: boolean;
  /** `process.platform` verbatim: `darwin` | `win32` | `linux`. */
  platform: string;
  /** `process.arch` verbatim. */
  arch: string;
  /** `os.release()`, when the caller has it. */
  release?: string;
}

export interface NodeQuestionInput {
  /** The node the question is about. Only its type name is read. */
  focus: { typename?: string };
  /** The library table, shared with the excerpt so one vocabulary decides both. */
  library?: LibraryPorts | null;
  /** What the node is complaining about, if anything. Free text — redacted, never trusted. */
  warning?: string | null;
  environment: QuestionEnvironment;
  /** Built by {@link buildGraphExcerpt}. Present or not, it is not included unless asked for. */
  excerpt?: GraphExcerpt | null;
  /** 🔴 Defaults to `false`. AC2 makes this a property of the composition. */
  includeExcerpt?: boolean;
  /**
   * UNI-011 AC3 — the capture and the ticked port values.
   *
   * 🔴 **There is no `includeAttachment` flag beside `includeExcerpt`, and its absence is the
   * design.** AC2's excerpt is one decision about a whole payload, so it needs a switch. AC3 is
   * *per row*: the attachment's `shared` set is the decision, and an empty set publishes nothing.
   * A second, outer flag would be a state that can disagree with the ticks — and a consent screen
   * whose switch and whose boxes can disagree has one of them lying.
   */
  attachment?: ShareAttachment | null;
  /** What the user typed. Their own words, and the one thing here they control completely. */
  question?: string;
  /** This machine's directories, for the redactor. */
  paths?: RedactorOptions;
}

export interface NodeQuestion {
  /** The thread title, prefilled and editable. */
  title: string;
  /** 🔴 The exact text that will be posted. Shown *as this value*, not re-rendered. */
  body: string;
  /** Whether {@link NodeQuestion.body} contains the excerpt. Reported, never inferred by a caller. */
  includesExcerpt: boolean;
  /** How many port values the body carries, and whether the capture line is in it. */
  attached: { capture: boolean; ports: number };
  /** The bucketed type, so a caption can name it without repeating the bucketing rule. */
  nodeType: string;
}

/**
 * A warning, de-marked-up, redacted, collapsed to one paragraph and capped — **in that order**.
 *
 * 🔴 **The order is the whole of this function.** `WarningsModel.getWarnings()` joins its messages
 * with `<br>` and individual warnings carry inline markup, so the tags have to go. But
 * [`redact`](../../utils/report/redact.ts) *emits* `<url>` and `<path>` — its own sentinels are
 * angle-bracketed — so a tag strip running afterwards deletes exactly the markers that say a
 * secret was removed, and the sentence reads as though nothing was there. Strip first, redact
 * second. ⚠️ The two passes look independent and are not; `tests-unit/uni-011/nodequestion.test.ts`
 * pins it with a warning containing both a tag and a path.
 *
 * This is a legibility measure, not a security one: a post body is read back through
 * `parsePostBody`, whose model has nowhere to put markup regardless.
 */
function tidyWarning(warning: string | null | undefined, paths?: RedactorOptions): string {
  if (!warning) return '';
  const withoutMarkup = warning.replace(/<[^>]*>/g, ' ');
  const cleaned = redact(withoutMarkup, paths || {})
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > MAX_WARNING_CHARS ? cleaned.slice(0, MAX_WARNING_CHARS) + '…' : cleaned;
}

/** `darwin arm64 (24.5.0)` — `process` values verbatim, which is what a maintainer can act on. */
function formatOs(environment: QuestionEnvironment): string {
  const base = `${environment.platform} ${environment.arch}`;
  return environment.release ? `${base} (${environment.release})` : base;
}

function formatVersion(environment: QuestionEnvironment): string {
  return environment.packaged === false ? `${environment.appVersion} (from source)` : environment.appVersion;
}

/**
 * The title.
 *
 * A warning makes a far better title than anything generated from a type name — it is the thing
 * the asker would have typed — so it is used when there is one, prefixed with the node type so
 * the list reads as a list of nodes. ⚠️ It is the **redacted** warning: a title is the one field
 * that shows up in search results and notification emails, where nobody re-reads it.
 */
function composeTitle(nodeType: string, warning: string): string {
  const name = nodeType === TYPE_COMPONENT || nodeType === TYPE_UNKNOWN ? 'this node' : `${nodeType} node`;
  if (!warning) return `Help with a ${name}`;
  const firstSentence = warning.split(/(?<=[.!?])\s/)[0] || warning;
  return `${name}: ${firstSentence}`;
}

/**
 * Compose the question.
 *
 * The body is assembled by naming its sections, the same discipline `diagnostics.ts` applies to
 * its payload: there is no loop over "everything we know about the node" with a filter in it.
 */
export function composeNodeQuestion(input: NodeQuestionInput): NodeQuestion {
  // An empty set, never `null` — same reasoning as `nodeexcerpt.ts`, and it has to be repeated
  // because it is the argument that decides it: `bucketTypeName(name, null)` publishes the name.
  const knownTypes = input.library ? new Set(input.library.keys()) : new Set<string>();
  const nodeType = bucketTypeName(input.focus?.typename, knownTypes);
  const warning = tidyWarning(input.warning, input.paths);

  // 🔴 The default is here, in the composition, and it is `false`.
  const includeExcerpt = input.includeExcerpt === true && Boolean(input.excerpt);

  const sections: string[] = [];

  const asked = (input.question || '').trim();
  if (asked) sections.push(asked);

  const describedType = TYPE_PROSE[nodeType] ? TYPE_PROSE[nodeType] : `a \`${nodeType}\` node`;
  const context = [`**Node:** ${describedType}`];
  if (warning) context.push(`**Warning:** ${warning}`);
  context.push(`**NodeGX:** ${formatVersion(input.environment)}`);
  context.push(`**OS:** ${formatOs(input.environment)}`);
  sections.push(context.join('\n'));

  if (includeExcerpt && input.excerpt) {
    sections.push(
      ['**Graph excerpt** (types and wiring only — no names, parameters or data):', '', '```', formatGraphExcerpt(input.excerpt), '```'].join(
        '\n'
      )
    );
  }

  // AC3. The values are already redacted by `describeSharablePorts` — redacting again here would
  // be a second pass over this module's own output, which is how `<path>` becomes `<<path>>`.
  const attachmentText = input.attachment ? formatShareAttachment(input.attachment) : '';
  if (attachmentText) sections.push(attachmentText);

  return {
    title: composeTitle(nodeType, warning),
    body: sections.join('\n\n'),
    includesExcerpt: includeExcerpt,
    attached: {
      capture: Boolean(input.attachment?.capture),
      ports: input.attachment ? sharedPorts(input.attachment).length : 0
    },
    nodeType
  };
}
