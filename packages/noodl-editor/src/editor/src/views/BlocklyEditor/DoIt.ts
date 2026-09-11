/**
 * LGC-002 — "Do It": every decision the feature makes, and none of the machinery.
 *
 * Four things live here and not one of them touches the DOM, the workspace model or the socket:
 *
 *  - {@link classifyBlockForDoIt} — is this block one we will evaluate, and if not, *why not*,
 *    in a sentence a builder can act on;
 *  - {@link generateFragmentForBlock} — turn one block's subtree into a `new Function` body;
 *  - {@link invalidatesBalloons} — when a balloon has become a lie about a program that no
 *    longer exists;
 *  - {@link answerForReply} and {@link wrapPreview} — what the balloon ends up saying.
 *
 * The split is deliberate and it is the same one the rest of this repo keeps re-learning: the
 * three files that need a rendered menu, an SVG root or a WebSocket are separate, so
 * everything above is graded by `tests-unit/lgc-002/` against a **real** headless workspace
 * with the **real** blocks and generator rather than against a re-implementation of them.
 *
 * ⚠️ **Generation is editor-side; execution is viewer-side.** Nothing here runs anything. The
 * body this produces goes over the relay to `logic-builder-probe.ts`, which compiles it against
 * the node's *live* inputs. Evaluating in this window would answer against `undefined` inputs —
 * the exact split that made the previous dynamic-port implementation unreachable
 * (LEARNINGS-BLOCKLY.md §1).
 *
 * @module BlocklyEditor
 */

import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';

import { HAT_BLOCK_TYPE } from '@noodl/runtime/src/nodes/std-library/logic-builder-io';

export type DoItOffer =
  /** Evaluate it. */
  | { offered: true }
  /** Show the menu item greyed, with this reason. Never hide it — a missing item teaches nothing. */
  | { offered: false; reason: string };

/**
 * Blocks that write when they run.
 *
 * The task names three — `set output`, `set variable`, `send signal`. The other two are here
 * because they are the same thing and the task's list was of examples, not of the whole set:
 * `set property on object` writes into a live `Noodl.Object`, and `add to array` mutates a live
 * `Noodl.Array`. Leaving either off would have made the rule *look* enforced while the two
 * blocks most likely to corrupt a builder's data walked through it.
 */
export const WRITING_BLOCK_TYPES = [
  'noodl_set_output',
  'noodl_set_variable',
  'noodl_send_signal',
  'noodl_set_object_property',
  'noodl_array_add'
];

/**
 * Blocks that declare a port and generate nothing at all.
 *
 * LGC-009 adds the hat. It belongs here on both counts and for both of this list's consumers:
 * its `NAME` field declares a signal input port exactly as `Define signal input` does, and its
 * generator returns `''`, so `BlockProbes` must mark it `suppressPrefixSuffix` or a block that
 * emits no code comes out as a bare `__s("id");` and is then, correctly and uselessly, reported
 * as having executed.
 */
export const DECLARATION_BLOCK_TYPES = [
  'noodl_define_input',
  'noodl_define_output',
  'noodl_define_signal_input',
  'noodl_define_signal_output',
  HAT_BLOCK_TYPE
];

/**
 * Blockly's own name for the disabled state `Blockly.Events.disableOrphans` sets.
 *
 * ⚠️ **A string literal, because the library does not export it.** `Blockly.constants` publishes
 * `MANUALLY_DISABLED` and two field names and nothing else; `ORPHANED_BLOCK` exists only inside
 * `blockly_compressed.js`. `tests-unit/lgc-009/hat-orphans.spec.ts` runs the real
 * `Events.disableOrphans` over a real headless workspace and reads the reason back off the
 * block, so a Blockly upgrade that renames it fails a spec rather than silently un-fixing the
 * behaviour below.
 */
export const ORPHANED_BLOCK_DISABLED_REASON = 'ORPHANED_BLOCK';

/** The task's own words, kept verbatim so the copy is reviewable in one place. */
export const REASON_WRITES = 'This block changes things. Run the node to see it.';
export const REASON_DECLARES = 'This block declares a port. There is nothing to work out until the node runs.';
export const REASON_NO_VALUE = 'Do It shows what a block works out. This one does something instead — run the node to see it.';
export const REASON_DISABLED = 'This block is switched off, so it has nothing to work out.';

/**
 * Is `ORPHANED_BLOCK` the *only* thing wrong with this block?
 *
 * Written against `getDisabledReasons()` rather than `hasDisabledReason()` so that a block
 * carrying the orphan reason **and** a real one is still refused: "it is not attached to
 * anything" does not cancel "the author switched it off".
 *
 * ⚠️ Both methods are Blockly 12 API. Guarded anyway, because `classifyBlockForDoIt` is called
 * from a context-menu callback where a `TypeError` would take the menu out rather than degrade.
 */
function isOnlyOrphanDisabled(block: Blockly.Block): boolean {
  if (typeof block.getDisabledReasons !== 'function') return false;
  const reasons = block.getDisabledReasons();
  return reasons.size === 1 && reasons.has(ORPHANED_BLOCK_DISABLED_REASON);
}

/**
 * Should Do It be offered on this block, and if not, what does the greyed item say?
 *
 * **The rule is: value blocks only.** A value block has an output connection — `1 + 2`,
 * `get input`, `length of array` — and evaluating it is a read. Everything else is refused,
 * with the reason chosen from what the block actually is, because "greyed" without a reason is
 * the same dead end as a hidden menu item.
 *
 * ⚠️ **This is a strong default, not a proof, and the shape of a block does not give the
 * property we want from it.** A value block can nest something impure — `length of array` fed
 * by a block a user wrote that mutates — and nothing in Blockly's model marks purity, so
 * nothing here can detect it. Two side effects are contained downstream (`Outputs` writes go
 * to a throwaway object, and signal sends are swallowed and reported); writes to
 * `Noodl.Variables`, `Noodl.Objects` and `Noodl.Arrays` are **not**, and reach the running app.
 * Say that rather than claim a safety the shape does not give.
 */
export function classifyBlockForDoIt(block: Blockly.Block): DoItOffer {
  if (!block) return { offered: false, reason: REASON_NO_VALUE };

  // A block dragged out of the flyout is a template, not a program: there is no live node
  // behind it and nothing to ask.
  if (block.isInFlyout) return { offered: false, reason: REASON_NO_VALUE };

  /**
   * ⚠️ **Disabled by the author, not disabled by Blockly's orphan bookkeeping.** LGC-009 makes
   * `Blockly.Events.disableOrphans` meaningful, and the moment that listener is registered every
   * *floating* value block — parentless, with an output plug — carries
   * `ORPHANED_BLOCK_DISABLED_REASON`. That is the drag-it-out-and-ask-it block: the one shape
   * this whole feature exists for. Refusing it as "switched off" is what the `disableOrphans`
   * finding recorded as the real blast radius, and it is a lie besides — nobody switched it off,
   * and the sentence would send its author looking for a checkbox they never ticked.
   *
   * A block disabled for any *other* reason — `MANUALLY_DISABLED`, a collapsed parent, a future
   * one — is still refused, with the sentence that is true of it.
   *
   * 🔴 This is a **no-op today**: nothing registers `disableOrphans`, so nothing ever carries
   * that reason. It is here so that re-registering the listener (LGC-009 acceptance criterion 4)
   * is one line and does not take Do It out with it.
   */
  if (!block.isEnabled() && !isOnlyOrphanDisabled(block)) return { offered: false, reason: REASON_DISABLED };

  if (block.outputConnection) return { offered: true };

  if (WRITING_BLOCK_TYPES.indexOf(block.type) !== -1) return { offered: false, reason: REASON_WRITES };
  if (DECLARATION_BLOCK_TYPES.indexOf(block.type) !== -1) return { offered: false, reason: REASON_DECLARES };

  // Every remaining statement block — `if`, `repeat`, `print`, a user procedure call. Some of
  // them write and some do not, and none of them has a value to show, so the answer is the
  // same either way and the reason does not have to guess which.
  return { offered: false, reason: REASON_NO_VALUE };
}

export interface GeneratedFragment {
  /** A complete `new Function` body: helper definitions, then `return (<expression>);`. */
  code: string;
  /** The bare expression, without the prelude. Kept for tests and for LGC-003's instrumentation. */
  expression: string;
}

/**
 * Generate a `new Function` body that evaluates one block's subtree.
 *
 * Three details, each of which breaks this if it is wrong:
 *
 * 1. **`init(workspace)` before, `finish()` after.** Blockly's JavaScript generator keeps its
 *    name database and its helper-function definitions on the generator object, populated by
 *    `init` and drained by `finish`. `workspaceToCode` does both around every generation; a
 *    bare `blockToCode` does neither, so a `random integer` block generates a call to
 *    `mathRandomInt` and the definition of `mathRandomInt` is never emitted — a `ReferenceError`
 *    at the far end of the relay, for a block that works perfectly in the real program.
 *    Confirmed in a headless workspace, not assumed.
 * 2. **`opt_thisOnly = true`.** Without it `blockToCode` walks the block's `nextConnection` and
 *    generates every statement below it too. A value block has no next connection, so this
 *    changes nothing today — but it states the intent ("this subtree") rather than relying on a
 *    shape holding.
 * 3. **`return (…)`, with the parentheses.** The generator hands back an expression at whatever
 *    operator precedence it chose. Wrapping it in parentheses is what makes the precedence of
 *    the surrounding `return` irrelevant, and it is the same detail LGC-003's `__p(…)` wrapper
 *    depends on for the opposite reason.
 *
 * Returns `null` when the block generates nothing — a disabled block, or one of the
 * declaration blocks whose generator returns `''`.
 */
export function generateFragmentForBlock(workspace: Blockly.Workspace, block: Blockly.Block): GeneratedFragment | null {
  javascriptGenerator.init(workspace);

  let expression = '';
  let prelude = '';
  try {
    const generated = javascriptGenerator.blockToCode(block, true);
    expression = Array.isArray(generated) ? String(generated[0]) : String(generated || '');
  } finally {
    // `finish` must run even if a generator throws, or the next Do It (and the next save)
    // inherits half-populated definitions.
    prelude = javascriptGenerator.finish('');
  }

  if (expression.trim() === '') return null;

  return {
    expression,
    code: prelude + 'return (' + expression + ');\n'
  };
}

/**
 * Does this event mean the balloons are now about a program that no longer exists?
 *
 * ⚠️ **A plain drag is deliberately not on this list.** The balloon is a child of the block's
 * own SVG group, so it travels with the block and stays correct; dismissing on every move would
 * make Do It unusable at exactly the moment a builder is rearranging blocks to understand them.
 * A `move` that changes the block's **parent** is a different thing — connecting or
 * disconnecting changes what every block above it computes — so that one does dismiss.
 *
 * ⚠️ **UI events are excluded for the same reason `BlocklyWorkspace`'s save listener excludes
 * them**, and it is the same trap: Blockly marks clicks, selections, viewport moves *and drags*
 * as UI, and enumerating the real changes by hand is what previously dropped block connections
 * on the floor. Here the cost of getting it wrong is milder — balloons that dismiss when you
 * click a block — but it is the same list.
 */
export function invalidatesBalloons(event: Blockly.Events.Abstract): boolean {
  if (!event || event.isUiEvent) return false;

  if (
    event.type === Blockly.Events.BLOCK_CREATE ||
    event.type === Blockly.Events.BLOCK_DELETE ||
    event.type === Blockly.Events.BLOCK_CHANGE
  ) {
    return true;
  }

  if (event.type === Blockly.Events.BLOCK_MOVE) {
    const move = event as Blockly.Events.BlockMove;
    return move.oldParentId !== move.newParentId;
  }

  return false;
}

/** What comes back over `blockFragmentResult`. Mirrors `nodecontext.ts`'s `BlockFragmentReply`. */
export interface BlockFragmentReply {
  requestId?: string;
  nodeId?: string;
  found?: boolean;
  ok?: boolean;
  value?: string;
  error?: string;
  errorPhase?: 'compile' | 'run';
  suppressedSignals?: string[];
}

export interface DoItAnswer {
  state: 'value' | 'error';
  /** The body of the balloon. In `previewValue`'s display dialect when `state` is `'value'`. */
  text: string;
  /** A quieter second line. */
  note?: string;
}

/**
 * Turn one viewer's reply into what the balloon says.
 *
 * ⚠️ **`text` is never empty, on either branch.** An error balloon with nothing in it is the
 * silence §4 exists to stop, one level further out than the runtime's own guard — and a value
 * balloon showing nothing would read as "this block computed emptiness" rather than as "we lost
 * the answer".
 */
export function answerForReply(reply: BlockFragmentReply): DoItAnswer {
  const suppressed =
    reply.suppressedSignals && reply.suppressedSignals.length
      ? 'It also tried to send signal ' +
        reply.suppressedSignals.map((name) => '"' + name + '"').join(', ') +
        ' — Do It does not send signals.'
      : undefined;

  if (reply.ok) {
    return { state: 'value', text: reply.value === undefined ? 'undefined' : reply.value, note: suppressed };
  }

  return {
    state: 'error',
    text: reply.error || 'The block failed, and the app did not say why.',
    note: suppressed
  };
}

/** Characters per line before the balloon wraps. `previewValue` caps at 200, so this bounds it. */
export const WRAP_COLUMNS = 34;
export const MAX_BALLOON_LINES = 7;

/**
 * Wrap a preview string for the balloon.
 *
 * ⚠️ Character wrapping, not word wrapping, and deliberately. The strings this shows are
 * `previewValue` output — `{a:1,b:"long"}`, `[1,2,3,…]` — which have no spaces to break at, so
 * a word wrapper would produce one enormous line and a balloon wider than the workspace.
 */
export function wrapPreview(
  text: string,
  columns: number = WRAP_COLUMNS,
  maxLines: number = MAX_BALLOON_LINES
): string[] {
  const source = text === '' ? '(empty)' : text;
  const lines: string[] = [];

  for (const paragraph of source.split('\n')) {
    if (paragraph === '') lines.push('');
    for (let i = 0; i < paragraph.length; i += columns) {
      lines.push(paragraph.slice(i, i + columns));
      if (lines.length > maxLines) break;
    }
    if (lines.length > maxLines) break;
  }

  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, Math.max(0, columns - 1)) + '…';
  }

  return lines.length ? lines : ['(empty)'];
}
