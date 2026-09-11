/**
 * The one line under the toolbar that knows what is true right now (FUN-006).
 *
 * ## The version that is worth nothing
 *
 * A dismissable strip reading *"Use `Inputs.name` to read inputs. See the docs
 * →"*. It would be ignored on sight, it is permanent noise for everyone who
 * already knows, and it gets dismissed on day one and never helps anyone twice.
 * The task file is unusually direct about this: **build it in the stateful form
 * or do not build it.**
 *
 * So the bar names *their* ports, from the document and the node in front of
 * them, and — the part that makes it bearable — **it retires itself the moment
 * they succeed**. A bar that persists once the user is winning is a bar that
 * gets dismissed while it is still useful.
 *
 * ## The four states, in priority order
 *
 * | The document | The line |
 * |---|---|
 * | writes at least one output | **nothing** — the bar is gone |
 * | reads an input, writes no output | "this node produces nothing when it runs" |
 * | has ports, mentions none of them | "Read `Input_1` with `Inputs.Input_1`, …" |
 * | has no ports at all | "Type `Inputs.` — the name you use becomes an input port" |
 *
 * ## ⚠️ §3 — the split with FUN-004, resolved deliberately
 *
 * The bar and the lint panel read the same two lists, and *"two components
 * narrating the same fact in different words is how a help surface stops being
 * believed."* The overlap is real: FUN-004's message 4 says "`Input_1` is
 * declared but never read" and this bar's second row says "read `Input_1` with
 * `Inputs.Input_1`".
 *
 * The line drawn, which is the task's own suggested split made testable:
 *
 * - **The bar owns "you have not started"** — the document mines **no** port at
 *   all. That is the blank-page state, and a document-level statement of fact is
 *   the right register for it.
 * - **FUN-004 owns "you started and this specific thing is wrong"** — the
 *   document mines at least one port, so the author is using the notation and a
 *   *particular* port has been left behind. That is a squiggle-adjacent fact.
 *
 * `unreadPortDiagnostics` enforces the other half of this rule and cites it.
 * Neither surface tests the other's state; they test the same predicate — "does
 * this document mine anything?" — from opposite sides, which is why they cannot
 * drift into both firing.
 *
 * @module code-editor/utils
 */

import type { OpenNodeFact } from '../authoringContext';
import { modeHasDeclaredPorts, modeUsesPortNotation } from './declaredPorts';
import { barNoOutputMessage, barNoPortsMessage, barUnusedPortsMessage, type PortKind } from './notation';
import type { CodeSubject, ValidationType } from './types';
import { unionPorts, type UnionPort } from './unionPorts';

/** What the bar has to say, before it is worded. */
export type PortBarState =
  /** The node writes an output. The bar has nothing to add and disappears. */
  | { kind: 'silent' }
  /** Inputs are read, nothing is written. */
  | { kind: 'no-output' }
  /** Ports exist; the document mentions none of them. */
  | { kind: 'unused-ports'; inputs: string[]; outputs: { name: string; kind: PortKind }[] }
  /** No ports at all, from either route. */
  | { kind: 'no-ports' };

/**
 * Does this document use the notation at all?
 *
 * The predicate §3's split turns on — see the module header. A document that
 * mines nothing is the blank page the bar owns; one that mines anything is
 * FUN-004's.
 */
export function minesAnyPort(ports: { inputs: UnionPort[]; outputs: UnionPort[] }): boolean {
  return ports.inputs.some((port) => port.mined) || ports.outputs.some((port) => port.mined);
}

/**
 * What is true of this node and this document, right now.
 *
 * Returns `'silent'` for every mode without declared ports, `'expression'`
 * included: an Expression node's every identifier already *is* a port, so a bar
 * telling its author to type `Inputs.` would be telling them to create a port
 * called `Inputs`. Same gate as FUN-004 §3 and FUN-008 §3.
 *
 * ## CN-019 — `subject`, and why it is not `node != null`
 *
 * Every row of the table above is a sentence **about a node**. A file has none
 * to be about, so `'file'` is silent before anything else is asked, and the
 * node fact is not consulted at all.
 *
 * 🔴 The tempting one-liner is to treat a missing node as a missing subject.
 * It is wrong in both directions. A Function node with an empty proplist
 * publishes a real `openNode` with two empty lists — that is the blank page the
 * bar exists for, and dropping it would retire the feature. And the slot is
 * module-level state written by the property panel, so a file opened while a
 * Function popout is still live reads a **non-null** node and is handed that
 * unrelated node's ports: `node != null` silences the case that was observed
 * and keeps the worse one. Ambient state cannot answer "what am I looking at";
 * only the consumer can.
 */
export function portBarState(
  validationType: ValidationType,
  node: OpenNodeFact | null | undefined,
  code: string,
  subject: CodeSubject = 'node'
): PortBarState {
  if (subject !== 'node') return { kind: 'silent' };

  if (!modeHasDeclaredPorts(validationType)) return { kind: 'silent' };

  /*
   * FIX-016 — the Script node, and the reason this is a second gate rather than
   * a widening of the one above.
   *
   * 🔴 **Every sentence this bar can say is `Inputs.`/`Outputs.` notation, and
   * all of it is false in a Script node.** `barNoPortsMessage` says *"Type
   * `Inputs.` — the name you use becomes an input port"*; a Script node mines
   * nothing from its text, so it becomes no port and throws when it runs.
   * `barUnusedPortsMessage` says *"Read price with `Inputs.price`"* about ports
   * the author declared and is already reading correctly through
   * `define({ inputs })` — advice against working code. And the `silent` row
   * below is worse than either: `Outputs.Done()` in a Script node mines an
   * output here, so the bar reads it as **success** and stands down, on a line
   * that FIX-016's message 6 is simultaneously warning throws.
   *
   * 🔴 **Not fixed by mining nothing in script mode — that makes it worse.** With
   * an empty mined list a correct Script node falls to `unused-ports` and the bar
   * nags every author who did the right thing. The bar has no true sentence for
   * this node, so it says nothing.
   *
   * ⚠️ **What is deliberately NOT built here: a bar that teaches `define()`.**
   * That needs the node's real port list, and the editor cannot compute it — the
   * `define({ inputs, outputs })` half lives behind `parser.getPorts()`, which
   * means running the author's code. Picking a row without it would be guessing
   * which of "no ports yet" and "ports you have not used" is true, and getting it
   * wrong is how this bar was wrong in the first place.
   */
  if (!modeUsesPortNotation(validationType)) return { kind: 'silent' };

  const ports = unionPorts(node ?? null, code);

  // ⚠️ The discipline. Success is the *only* thing that silences the bar without
  // a dismissal, and it silences it immediately.
  if (ports.outputs.some((port) => port.mined)) return { kind: 'silent' };

  if (ports.inputs.some((port) => port.mined)) return { kind: 'no-output' };

  if (ports.inputs.length > 0 || ports.outputs.length > 0) {
    return {
      kind: 'unused-ports',
      inputs: ports.inputs.map((port) => port.name),
      outputs: ports.outputs.map((port) => ({ name: port.name, kind: port.kind }))
    };
  }

  return { kind: 'no-ports' };
}

/** The sentence for a state, or `null` when the bar should not be there. */
export function portBarMessage(state: PortBarState): string | null {
  switch (state.kind) {
    case 'silent':
      return null;

    case 'no-output':
      return barNoOutputMessage();

    case 'unused-ports': {
      const message = barUnusedPortsMessage(state.inputs, state.outputs);
      return message || null;
    }

    case 'no-ports':
      return barNoPortsMessage();
  }
}

/* ------------------------------------------------------------------ *
 * §2 — dismissal, and retiring on success
 * ------------------------------------------------------------------ */

/** Dismissed **per user**, not per node. */
const DISMISSED_KEY = 'codeeditor_portbar_dismissed';
/** The node ids in which the user has written a working output. */
const SUCCESS_KEY = 'codeeditor_portbar_successes';

/**
 * How many nodes the user must get an output out of before the bar stops
 * appearing by default.
 *
 * ⚠️ **The thing counted is "wrote an output", not "opened the editor".**
 * Opening the editor fifty times without succeeding is exactly when the bar
 * should keep appearing, and a counter on opens would retire it fastest for the
 * person it exists for.
 *
 * Three, because the second time could be luck and the fourth is already
 * nagging. It is a judgement, not a measurement.
 */
export const RETIRE_AFTER_SUCCESSES = 3;

function readStore(key: string): string[] {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : [];
  } catch (error) {
    // A corrupt or unavailable store must not stop the editor opening.
    return [];
  }
}

function writeStore(key: string, value: string[]): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    /* Storage full or blocked — the bar is not worth an exception. */
  }
}

/** Has the user dismissed the bar? */
export function isDismissed(): boolean {
  return readStore(DISMISSED_KEY).length > 0;
}

/** Dismiss it, or bring it back — the `?` in the toolbar is not a one-way door. */
export function setDismissed(dismissed: boolean): void {
  writeStore(DISMISSED_KEY, dismissed ? ['1'] : []);
}

/**
 * Record that this node produced an output.
 *
 * Keyed by node id and de-duplicated, so editing one working node repeatedly
 * counts once. Without that, the threshold is reached by a single node and the
 * bar retires for someone who has succeeded exactly once.
 */
export function recordSuccess(nodeId: string | undefined): void {
  if (!nodeId) return;

  const seen = readStore(SUCCESS_KEY);
  if (seen.indexOf(nodeId) !== -1) return;

  writeStore(SUCCESS_KEY, [...seen, nodeId]);
}

/** How many distinct nodes the user has got an output out of. */
export function successCount(): number {
  return readStore(SUCCESS_KEY).length;
}

/**
 * Has the user just succeeded, as opposed to opened something that already worked?
 *
 * ⚠️ The distinction is the whole of §2's *"the state to count is 'wrote an
 * output', not 'opened the editor'"*. Counting the silent **state** rather than
 * the **transition** into it also counts opening a node that already worked — so
 * a new user opening three Function nodes in an example project would retire the
 * bar having never written an output, which is the same defect the rule exists to
 * prevent, arriving by a different route. Only not-silent → silent is somebody
 * succeeding in front of us.
 */
export function shouldRecordSuccess(previous: PortBarState['kind'], next: PortBarState['kind']): boolean {
  return next === 'silent' && previous !== 'silent';
}

/**
 * Should the bar be shown, given a state and what the user has done before?
 *
 * `forced` is the `?` in the toolbar: it overrides both the dismissal and the
 * retirement, because a user asking for the help is a user who wants it whatever
 * their history says.
 */
export function shouldShowBar(state: PortBarState, forced: boolean): boolean {
  if (portBarMessage(state) === null) return false;
  if (forced) return true;

  return !isDismissed() && successCount() < RETIRE_AFTER_SUCCESSES;
}
