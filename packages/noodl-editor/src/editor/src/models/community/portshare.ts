/**
 * UNI-011 AC3 — *"share what you're seeing"*, the disclosure rule.
 *
 * > A capture from the running preview can be attached with per-port share toggles, defaulting to
 * > **off** for anything record-shaped. Nothing leaves the machine before the user posts.
 *
 * ## 🔴 The finding: AC3 cannot use AC2's instrument, and the reason generalises
 *
 * [`nodeexcerpt.ts`](./nodeexcerpt.ts) can state its safety as *"every string it emits is chosen
 * from a set the editor owns"*, and that is a strong claim precisely because a graph's **structure**
 * has an editor-owned form: our type names, our port names, our sentinels.
 *
 * A live port value has no such form. It **is** the user's data — that is the entire reason anyone
 * would attach it — so a closed vocabulary here would either publish nothing or be a vocabulary of
 * one entry per value, which is not a vocabulary. **An allow-list is not available, and reaching
 * for one anyway would produce a control that looks like AC2's and checks nothing.**
 *
 * So the instrument changes shape, from **vocabulary** to **provenance under consent**:
 *
 * | | AC2, the excerpt | AC3, the values |
 * |---|---|---|
 * | published | structure the editor names | data the user owns |
 * | one decision or many | **one** tick for the whole excerpt | **one tick per port** |
 * | what makes it safe | a closed vocabulary | the tick, and what the ticker was shown |
 * | what a test can assert | every string is in a set we own | every string traces to a port whose toggle was **on**, in the form the composer displayed |
 *
 * ⚠️ **That is why port names are not bucketed here, and it is a deliberate divergence from AC2.**
 * The excerpt rewrites a user-authored port name to `<port>` because nothing asked the user about
 * that specific port. Here the user is looking at the name and the value side by side when they
 * decide. Hiding the name would leave them consenting to a row they cannot read — and a consent
 * screen that hides the thing being consented to is worse than no consent screen. What AC2's rule
 * becomes instead is **the default**: a port name the library does not declare is one of the two
 * independent grounds for starting off.
 *
 * ## The two grounds, and why both are recorded rather than the first one found
 *
 * A row can be off by default because of its **value** (record-shaped, or free text) or because of
 * its **name** (a dynamic port, or a component input — user-authored by definition; the rule
 * `nodeexcerpt.ts` derives from `NodeGraphNode.getPorts()`). These are independent: a dynamic port
 * holding `1200` leaks a name, and a library port holding `{…}` leaks a record.
 *
 * 🔴 {@link SharablePort.offBecause} is a **list**. Collapsing it to the first reason would let a
 * fix that addresses one ground read as though it addressed the row — which is the shape this phase
 * has already paid for once, where a prose summary flattened a verdict's second branch.
 *
 * ## Three smaller things that are load-bearing
 *
 * 1. 🔴 **An unrecognised preview shape is `text`, never `scalar`.** {@link classifyPreviewValue}
 *    reads the grammar `previewValue()` in `noodl-runtime/src/tracebuffer.ts` emits, and that
 *    grammar can grow. A classifier whose fallback is the permissive class publishes every shape it
 *    fails to recognise, silently, on the day the runtime adds one.
 *
 * 2. ✅ **The runtime's 200-character cap is a privacy property as well as a memory one.** What is
 *    published is the *preview string*, not the value behind it — so what the user reviewed is
 *    exactly what ships, and a value with a long tail cannot smuggle the tail past a reader who
 *    only saw the head. This is the reason the payload is built from the reply and never from a
 *    re-read of the port.
 *
 * 3. **Every published value is redacted, whatever its shape.** The shape decides the *default*;
 *    the redactor decides the *content*. A ticked record legitimately holds an email, and a ticked
 *    string legitimately holds a bearer token — [`redact`](../../utils/report/redact.ts) is the
 *    second line ALPHA-007 built for exactly that, and the composer shows the redacted form,
 *    because the string shown must be the string sent.
 *
 * Pure: no editor models, no React, no I/O. `nodesharecontext.ts` reads the running editor.
 *
 * @module models/community/portshare
 */

import { RedactorOptions, redact } from '../../utils/report/redact';

/** Bumped when a reader of a posted attachment would misread the new shape. */
export const SHARE_SCHEMA = 1;

/**
 * Structurally identical to `PortsTab/portValues`' type of the same name, and deliberately declared
 * again rather than imported: that module is a view, and a model importing a panel's types to get a
 * two-member union is a dependency bought for nothing.
 */
export type SharePortDirection = 'input' | 'output';

/**
 * What a preview string is, as far as disclosure is concerned.
 *
 * - `empty` — the runtime answered, and the answer carries nothing of the user's: `null`,
 *   `undefined`, an unreadable getter. Publishing it discloses the *shape of the graph*, which the
 *   excerpt already covers.
 * - `scalar` — a number, a boolean, or one of the editor's own sentinels. Carries no name.
 * - `text` — anything with the user's words in it: a string, a function name, a node name.
 * - `record` — an object, an array, a `Model` or a `Collection`. A row of somebody's data.
 */
export type ValueShape = 'empty' | 'scalar' | 'text' | 'record';

/** Why a row starts unticked. Every applicable reason, not the first one found. */
export type DefaultOffReason = 'record-shaped' | 'free-text' | 'port-name-is-yours';

/** How each reason reads on the row, so the composer does not restate the rule. */
export const OFF_REASON_TEXT: Record<DefaultOffReason, string> = {
  'record-shaped': 'a record',
  'free-text': 'text you wrote or your app produced',
  'port-name-is-yours': 'a port name from your own project'
};

export interface PortValueInput {
  /** The port's real name, as the user sees it in the Ports tab. */
  port: string;
  direction: SharePortDirection;
  /** The runtime's preview string. Absent when the port answered nothing worth reporting. */
  value?: string;
  /**
   * Whether the **library** declares this port for the node's resolved type.
   *
   * 🔴 `type.ports` only — the same table `nodeexcerpt.ts` takes, for the same reason. A `false`
   * here means the name came from `node.ports` or `node.dynamicports`, which are user-authored by
   * definition, or from a component instance's `Component Inputs` declarations.
   */
  declared: boolean;
}

export interface SharablePort {
  /** Stable across a render, and the identity a toggle is held under. */
  key: string;
  port: string;
  direction: SharePortDirection;
  /** The redacted preview string — the value as it would be published, and as it is displayed. */
  value: string;
  shape: ValueShape;
  /** 🔴 The default. AC3's criterion is a claim about this field. */
  sharedByDefault: boolean;
  /** Empty exactly when {@link SharablePort.sharedByDefault} is true. */
  offBecause: DefaultOffReason[];
}

/** ⚠️ Direction is part of the key: a node may have `x` as both an input and an output. */
export function portShareKey(port: string, direction: SharePortDirection): string {
  return port + '|' + direction;
}

/** The editor's own answers — strings `previewValue` emits that contain nothing of the user's. */
const EDITOR_SENTINELS = new Set(['null', 'undefined', 'NaN', '<unreadable>', '<unpreviewable>', '[Circular]', '…']);

const NUMBER = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
/** `DOM Node <div>` — an HTML tag name is a closed vocabulary, and it is not ours or theirs. */
const DOM_NODE = /^DOM Node <[A-Za-z][A-Za-z0-9-]*>$/;

/**
 * Which class a preview string falls in.
 *
 * The grammar is `previewValue()`'s, read off `noodl-runtime/src/tracebuffer.ts`: strings are
 * quoted, objects and arrays are braced, `Model` and `Collection` print by identity, a runtime
 * `Node` prints its **name**, a function prints its **name**, and everything over the cap gains a
 * trailing `…`.
 *
 * 🔴 **The fallback is `text`.** Every branch below has to earn its class; the default is the
 * strict one. A `Date` prints as a bare ISO string and lands here — which is right, because a date
 * in an app is far more often a record's field than a constant.
 */
export function classifyPreviewValue(preview: string | undefined | null): ValueShape {
  if (preview === undefined || preview === null) return 'empty';
  const value = preview.trim();
  if (value === '') return 'empty';
  if (EDITOR_SENTINELS.has(value)) return 'empty';

  if (value === 'true' || value === 'false') return 'scalar';
  if (NUMBER.test(value)) return 'scalar';
  if (DOM_NODE.test(value)) return 'scalar';

  if (value.startsWith('{') || value.startsWith('[')) return 'record';
  if (value.startsWith('<Collection') || value.startsWith('<Model')) return 'record';

  // `"…"`, `<Node> Checkout Row`, `<function submitOrder>`, `Symbol(order)`, an ISO date, and
  // anything a future runtime emits that this function has never seen.
  return 'text';
}

/**
 * The rows the composer offers, with their defaults already decided.
 *
 * A port that answered nothing is dropped rather than listed as blank: AC3 is a consent screen, and
 * a row with nothing to consent to spends the reader's attention on nothing. The count of dropped
 * rows is not reported either, because unlike the excerpt's `omitted` it changes no reading of what
 * *is* there — a port with no live value is not a port whose value was withheld.
 */
export function describeSharablePorts(inputs: readonly PortValueInput[], paths?: RedactorOptions): SharablePort[] {
  const out: SharablePort[] = [];

  for (const input of inputs) {
    if (!input || typeof input.port !== 'string' || input.port === '') continue;
    if (typeof input.value !== 'string' || input.value === '') continue;

    const shape = classifyPreviewValue(input.value);

    // 🔴 Both grounds, independently. See the module note on why this is a list.
    const offBecause: DefaultOffReason[] = [];
    if (shape === 'record') offBecause.push('record-shaped');
    else if (shape === 'text') offBecause.push('free-text');
    if (!input.declared) offBecause.push('port-name-is-yours');

    out.push({
      key: portShareKey(input.port, input.direction),
      port: input.port,
      direction: input.direction,
      // Redacted here, once, so the value the row displays is the value the payload carries.
      value: redact(input.value, paths || {}),
      shape,
      sharedByDefault: offBecause.length === 0,
      offBecause
    });
  }

  return out;
}

/** The keys a freshly-opened composer starts with ticked. */
export function defaultSharedKeys(ports: readonly SharablePort[]): string[] {
  return ports.filter((port) => port.sharedByDefault).map((port) => port.key);
}

/** What the capture publishes about itself. 🔴 Not the file path, and not the render findings. */
export interface CaptureAttachment {
  width: number;
  height: number;
  bytes: number;
}

export interface ShareAttachment {
  /** `null` when no capture was taken, or the user unticked it. */
  capture?: CaptureAttachment | null;
  /** Every row the composer offered, ticked or not. */
  ports: readonly SharablePort[];
  /** The keys that are ticked. Nothing outside this set is published. */
  shared: ReadonlySet<string>;
}

/** The rows that will actually be published, in the order they were offered. */
export function sharedPorts(attachment: ShareAttachment): SharablePort[] {
  return attachment.ports.filter((port) => attachment.shared.has(port.key));
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${Math.round(bytes)} bytes`;
  return `${Math.round(bytes / 1024)} KB`;
}

/**
 * The attachment as the text that gets posted — empty when nothing was ticked.
 *
 * ⚠️ **This is the string the composer shows AND the string it sends**, the same contract
 * `formatGraphExcerpt` carries, for the same reason: a preview built from the same inputs by a
 * second code path is two paths that agree today.
 *
 * 🔴 **The capture's own line carries no file path.** The PNG is written to disk so the user can
 * attach it, and where it went is a fact about *their machine* — `<path>` would be all a reader got
 * anyway, so the line reports the picture's dimensions and says the picture is attached. Nor does
 * it carry the render harness's findings: those are strings read off the rendered page, which is
 * the user's content by construction, and they never went through a toggle.
 */
export function formatShareAttachment(attachment: ShareAttachment): string {
  const sections: string[] = [];

  if (attachment.capture) {
    const { width, height, bytes } = attachment.capture;
    sections.push(`**Screen capture attached** — ${width} × ${height}, ${formatBytes(bytes)}.`);
  }

  const rows = sharedPorts(attachment);
  if (rows.length) {
    const labels = rows.map((row) => `${row.port} (${row.direction})`);
    const width = labels.reduce((widest, label) => Math.max(widest, label.length), 0);
    const lines = rows.map((row, index) => `${labels[index].padEnd(width)} = ${row.value}`);
    sections.push(
      ['**Live values I chose to share:**', '', '```', ...lines, '```'].join('\n')
    );
  }

  return sections.join('\n\n');
}

/**
 * Every string the attachment publishes that could have come from the project.
 *
 * Exported for the same reason `excerptStrings` is: AC3's claim is about *every* published string,
 * and a claim about every string wants an enumeration rather than a reader who trusts the formatter
 * above to still be complete. The capture's numbers are not here — they are numbers.
 */
export function sharedStrings(attachment: ShareAttachment): string[] {
  const out: string[] = [];
  for (const row of sharedPorts(attachment)) out.push(row.port, row.value);
  return out;
}
