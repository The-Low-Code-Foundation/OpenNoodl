/**
 * UNI-016 — the question, as the thing it is about.
 *
 * D19's ruling in one sentence: **the unit of content is not a post, it is a graph with a
 * question attached.** UNI-011 AC2/AC3 already assemble everything that sentence needs — the
 * bucketed node type, the environment, the live port values a user ticked, the count of the
 * ones they did not. Until now all of it was flattened into prose and handed to a browser,
 * because the other end could not take anything else. This module is the *other* shape of the
 * same data: the payloads `post_attachments` stores, so the structure survives the door.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 THE HAZARD THIS MODULE IS BUILT AGAINST, AND IT IS THIS FILE'S WHOLE DESIGN.
 *
 * UNI-011 AC2's criterion is *"what it will send is shown before it sends"*, and
 * `nodequestion.ts` pays for that with a rule it states three times: **there is one string,
 * and it is both shown and sent** — because *"two paths that agree today are the arrangement
 * that stops agreeing, and the failure is a user who reviewed one thing and published
 * another."*
 *
 * **A structured payload is, by construction, a second path.** The composer renders
 * `question.body`; this builds a JSON document; both describe the same ports. That is exactly
 * the arrangement the rule forbids — and it cannot be avoided, because the entire point of
 * UNI-016 is that the structure is not thrown away.
 *
 * ✅ So it is made SUBORDINATE rather than parallel. Every published string here comes from
 * {@link sharedPorts} — the *same* function `formatShareAttachment` calls to build the prose —
 * and never from `attachment.ports`, never from a re-derivation, never from the live poll.
 * A port that is not in the prose cannot be in the payload, because there is one filter and
 * both callers use it.
 *
 * 🔴 And that is asserted rather than promised: `tests-unit/uni-016/nodeartifact.test.ts`
 * takes the set of strings this module publishes and requires it to equal
 * {@link sharedStrings} — the enumeration UNI-011 AC3 already grades the *prose* against. One
 * vocabulary, two consumers, and a spec that fails the moment they diverge.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * ⚠️ TWO THINGS DELIBERATELY NOT SENT AS STRUCTURE, both recorded so that adding them later
 * is a decision rather than a drift.
 *
 * 1. **The graph excerpt stays in the body.** It is tempting to post it as a `graph_fragment`,
 *    and it would be wrong: `graph_fragment` is **UNI-018's pull unit** — the shape an answer
 *    carries so a reader can pull it *into their editor and run it*. UNI-011's excerpt is
 *    types and wiring with every name bucketed to `<component>`/`<unknown>`; it is deliberately
 *    NOT executable and not reconstructible. Filing it under the kind that means *"this can be
 *    pulled"* would hand UNI-018 a population it cannot honour, and UNI-018's own hazard note
 *    is about exactly what gets trusted from that kind. It ships as the fenced block it
 *    already is.
 *
 * 2. **No `warningCode`.** `post_attachments` derives a `warning_code` facet, and this editor
 *    has no warning *code* — `WarningsModel` yields a free-text sentence with the user's own
 *    content interpolated into it (`Component "Acme Legal Portal" not found`). Slicing a facet
 *    out of that would put project content into an indexed column that renders as a public
 *    filter chip, which is the opposite of what UNI-011's redactor spent its effort on. The
 *    warning travels where it already travels: through `tidyWarning`, redacted, in the body.
 *    🔴 The facet is left null, and null is the correct answer rather than a hole.
 *
 * Pure: no editor singletons, no React, no I/O.
 *
 * @module models/community/nodeartifact
 */

import { QuestionEnvironment } from './nodequestion';
import { ShareAttachment, sharedPorts } from './portshare';

/**
 * The attachment kinds the platform declares (`attachment_kind`, migration 0009).
 *
 * ⚠️ Only two of the four are reachable from this editor. `graph_fragment` is UNI-018's and
 * `lesson_step` is UNI-007's; both are listed because the wire vocabulary is the platform's
 * and a client that knows only its own half of an enum is a client that cannot read a reply.
 */
export type ArtifactKind = 'node_excerpt' | 'capture' | 'graph_fragment' | 'lesson_step';

/** One published port value. The field names are the platform's `AttachedPort`. */
export interface ArtifactPort {
  name: string;
  direction: 'input' | 'output';
  value: string | null;
}

/**
 * 🔴 A withheld port publishes its DIRECTION and nothing else.
 *
 * Publishing the name would defeat the withholding; publishing nothing would make the
 * redaction invisible, and UNI-016's scope is explicit that invisible redaction is *"a hole"*
 * rather than privacy — the answerer otherwise wastes a reply asking for what was deliberately
 * held back. ⚠️ The platform counts these itself: `ports_withheld` is a GENERATED column over
 * this array, so a sender cannot understate it and this editor is not trusted to try.
 */
export interface WithheldPort {
  direction: 'input' | 'output';
}

export interface NodeExcerptPayload {
  nodeType: string;
  appVersion: string;
  os: string;
  ports: ArtifactPort[];
  withheldPorts: WithheldPort[];
}

export interface CapturePayload {
  width: number;
  height: number;
  bytes: number;
  nodeType: string;
  appVersion: string;
  os: string;
}

/** What `POST /api/v1/bench/threads` takes in its `attachments` array. */
export interface PostAttachment {
  kind: ArtifactKind;
  payload: Record<string, unknown>;
  note?: string | null;
}

/**
 * FB-007 — what `POST /api/v1/bench/captures` hands back, and the only thing that may become
 * an `image` on a payload.
 *
 * 🔴 **`grant` IS NOT OURS TO INVENT, AND THAT IS THE WHOLE SHAPE OF THIS TYPE.** The platform's
 * `captureupload.ts` mints the key *and* an HMAC over `capture-grant:<key>:<accountId>`, precisely
 * because the obvious design — upload returns a key, the composer puts that key in the payload —
 * lets anybody put ANY key in a payload, including one they watched somebody else receive, and the
 * thread would then render a stranger's screenshot under their name. So there is no constructor
 * for this type in the editor: a value of it comes back from {@link CommunityApiClient.uploadCapture}
 * or it does not exist, which is what makes AC2's claim — *the editor sends only keys it was
 * granted* — a property of the type rather than a promise in a comment.
 *
 * ⚠️ `bytes` is COSMETIC on the wire (the platform's own note says so: the grant covers the key
 * and the account, not the size, and the image route serves the length the object store reports).
 * It is carried because the intake requires the field, not because anything downstream trusts it.
 */
export interface CaptureImageRef {
  key: string;
  grant: string;
  bytes: number;
  contentType: string;
}

/**
 * FB-007 — put the server's image reference on the capture attachment, and nowhere else.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔴 **A SEPARATE FUNCTION RATHER THAN A FIELD ON {@link NodeArtifactInput}, AND THE REASON IS
 * THE ORDER OF EVENTS.** The artifacts are built while the composer renders — that is UNI-011
 * AC2's *"the string shown IS the string sent"*, and the memo that holds them is what makes it
 * true. The upload cannot happen then: it is the one action that leaves the machine, and AC3's
 * second sentence is *"nothing leaves the machine before the user posts."* So the image reference
 * arrives strictly later than the thing it belongs to, and the honest shape is a transform applied
 * to what was already shown rather than a rebuild that could quietly show one thing and send
 * another.
 *
 * ⚠️ **Total on the no-image case, and that is the common path forever.** A question with no
 * capture, a capture the user untickeed, an upload that failed, a deployment with no bucket — all
 * four return the attachments unchanged, and a `capture` payload with no `image` is a complete,
 * legal attachment that the web renders as its dimensions. `acceptCaptureImage` treats absent as
 * the normal case for exactly the same reason.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
export function withCaptureImage(
  attachments: PostAttachment[],
  image: CaptureImageRef | null | undefined
): PostAttachment[] {
  if (!image) return attachments;
  return attachments.map((attachment) =>
    // 🔴 `kind === 'capture'` and not "the last one" or "the one with a `width`". The platform
    // verifies an image reference on EVERY kind, deliberately, because *"a `graph_fragment` has
    // no business carrying an `image`"* — so an editor that attached one to the excerpt would
    // have its whole post refused rather than quietly drop the picture.
    attachment.kind === 'capture'
      ? { ...attachment, payload: { ...attachment.payload, image: { ...image } } }
      : attachment
  );
}

export interface NodeArtifactInput {
  /**
   * 🔴 The BUCKETED type — `NodeQuestion.nodeType`, never `focus.typename`.
   *
   * `composeNodeQuestion` runs the raw typename through `bucketTypeName` against the library
   * table, which is what turns `com.acmelegal.internal.BillingWidget` into `<unknown>` and a
   * project component into `<component>`. Taking the raw name here would publish, in a facet
   * column that renders as a filter chip, precisely the string the composer spent its effort
   * removing from the body — and the two would sit on the same screen disagreeing.
   */
  nodeType: string;
  environment: QuestionEnvironment;
  /** UNI-011 AC3's decisions. `null` when nothing was offered or nothing was ticked. */
  attachment?: ShareAttachment | null;
}

/** `darwin arm64 (24.5.0)`, and it must read identically to the body's **OS:** line. */
function formatOs(environment: QuestionEnvironment): string {
  const base = `${environment.platform} ${environment.arch}`;
  return environment.release ? `${base} (${environment.release})` : base;
}

function formatVersion(environment: QuestionEnvironment): string {
  return environment.packaged === false ? `${environment.appVersion} (from source)` : environment.appVersion;
}

/**
 * The ports the sender chose not to publish, by direction.
 *
 * ⚠️ Derived by subtracting the shared set from the offered rows, rather than by re-running
 * the default rule. The rule ran once, in `describeSharablePorts`, and the user then
 * overrode it; a second evaluation here would report the *defaults* as the withholding and
 * would be wrong for every row anybody touched.
 */
function withheldFrom(attachment: ShareAttachment): WithheldPort[] {
  return attachment.ports
    .filter((port) => !attachment.shared.has(port.key))
    .map((port) => ({ direction: port.direction }));
}

function portsFrom(attachment: ShareAttachment | null | undefined): ArtifactPort[] {
  if (!attachment) return [];
  // 🔴 `sharedPorts`, the same call `formatShareAttachment` makes. See the header.
  return sharedPorts(attachment).map((port) => ({
    name: port.port,
    direction: port.direction,
    value: port.value
  }));
}

/**
 * Build the attachments for a node question.
 *
 * ⚠️ **Always at least one.** A question about a node carries a `node_excerpt` even when every
 * port was unticked — the type, the version and the OS are the facets the Bench filters on
 * (UNI-016 AC4), and a question that arrives with no structure at all is exactly the
 * plain-text post D19 ruled was worse than what we chose not to buy. An empty `ports` array
 * with a populated `withheldPorts` is a *legible* answer: this person asked about a For Each
 * on 0.1.7 and shared no values.
 *
 * The order is the order the composer decided them in, and `post_attachments` is read back in
 * insertion order (`seq`), so it is also the order the answerer reads them in.
 */
export function buildNodeArtifacts(input: NodeArtifactInput): PostAttachment[] {
  const appVersion = formatVersion(input.environment);
  const os = formatOs(input.environment);
  const attachment = input.attachment ?? null;

  const excerpt: NodeExcerptPayload = {
    nodeType: input.nodeType,
    appVersion,
    os,
    ports: portsFrom(attachment),
    withheldPorts: attachment ? withheldFrom(attachment) : []
  };

  const attachments: PostAttachment[] = [{ kind: 'node_excerpt', payload: excerpt as unknown as Record<string, unknown> }];

  if (attachment?.capture) {
    const capture: CapturePayload = {
      width: attachment.capture.width,
      height: attachment.capture.height,
      bytes: attachment.capture.bytes,
      // Repeated rather than referenced: an attachment is read on its own in a facet strip,
      // and one that cannot say which node it is about is a picture with no caption.
      nodeType: input.nodeType,
      appVersion,
      os
    };
    // 🔴 STILL NO IMAGE **HERE**, and after FB-007 that is a statement about this function
    // rather than about the feature. The picture is uploaded on the post path and the
    // reference is put on by {@link withCaptureImage}, because it does not exist yet at the
    // moment this runs — see that function for why the order is the design.
    //
    // ⚠️ And no path, which is unchanged and is the older rule: `saveCaptureNextTo` writes the
    // PNG to the asker's Documents folder, and where it went is a fact about their machine.
    // `redact` exists to keep exactly that out of anything outbound.
    attachments.push({ kind: 'capture', payload: capture as unknown as Record<string, unknown> });
  }

  return attachments;
}

/**
 * Every string these attachments publish that could have come from the user's project.
 *
 * Exported for the reason `sharedStrings` and `excerptStrings` are exported: the claim is
 * about *every* published string, and a claim about every string wants an enumeration rather
 * than a reader who trusts the builder above to still be complete when somebody adds a field.
 *
 * ⚠️ The numbers are not here — dimensions, byte counts and the withheld *count* are numbers,
 * and a number carries nothing of the project. `nodeType`, `appVersion` and `os` are: the
 * first is bucketed by the caller and the other two are the editor's own, but they are
 * strings on the wire and the enumeration is worth nothing if it decides for itself which
 * strings matter.
 */
export function artifactStrings(attachments: PostAttachment[]): string[] {
  const out: string[] = [];
  for (const attachment of attachments) {
    const payload = attachment.payload as Partial<NodeExcerptPayload & CapturePayload>;
    if (typeof payload.nodeType === 'string') out.push(payload.nodeType);
    if (typeof payload.appVersion === 'string') out.push(payload.appVersion);
    if (typeof payload.os === 'string') out.push(payload.os);
    for (const port of payload.ports ?? []) {
      out.push(port.name);
      if (port.value !== null) out.push(port.value);
    }
    if (attachment.note) out.push(attachment.note);
  }
  return out;
}
