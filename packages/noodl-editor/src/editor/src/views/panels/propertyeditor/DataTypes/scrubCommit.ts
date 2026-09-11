/**
 * FB-022 AC1 — a whole drag is one undo entry.
 *
 * ## The contract, and why it is two functions rather than one
 *
 * A scrub writes the model on every mousemove so the element moves under the cursor, and a
 * 200-pixel drag is therefore something like 200 writes. If each of those recorded undo, one
 * ctrl-Z would step back a single pixel, and the history would be so deep that every other
 * action in it — the node that was added, the connection that was made — would be pushed out
 * of reach. So the two halves are split at the seam where undo happens:
 *
 * - {@link writeScrubStep} applies a value and records **nothing**;
 * - {@link commitScrub} records **one** entry for the whole gesture and applies nothing new.
 *
 * 🔴 **The old value is the one captured at the press.** By the time `commitScrub` runs, the
 * model already holds the dragged value, so an entry built from "what the model says now"
 * would restore the *end* of the drag and undo would appear to do nothing. This is the trap
 * `MarginPaddingInput` records against its own drag, hit again here.
 *
 * ## 🔴 Why this does not use `setParameter`'s own `args.oldValue`
 *
 * `NodeGraphNode.setParameter` accepts an `oldValue` override, which is how the margin/padding
 * drag commits — and the check it makes is `if (args.oldValue)`. **Falsy.** A drag that starts
 * on a port with no parameter set has `undefined` for its old value, which that check cannot
 * distinguish from "not supplied", so it falls through to the current parameter: the dragged
 * value. The undo would restore the drag. Margin/padding never meets this because it seeds its
 * start value from the port default and therefore always has an object — the bug is real and
 * simply unreachable from there.
 *
 * The group is built here instead, in the form `UndoActionGroup` documents for a change that
 * has *already been applied*: constructed with a label alone, `push`ed (which advances the
 * pointer without executing), and handed to `UndoQueue.push`. The constructor's `do`/`undo`
 * form leaves the pointer at 0 and produces a group that cannot be undone at all.
 *
 * ⚠️ The closures re-notify `modelParameterUndo`/`modelParameterRedo` by hand, exactly as
 * `setParameter`'s own undo closures do. Those two events are what `Ports.ts` and
 * `propertyeditor.ts` listen to in order to rebuild the panel — a group that only called
 * `setParameter` would restore the value in the model and leave the field on screen showing
 * the dragged number.
 */
import { UndoActionGroup, UndoQueue } from '@noodl-models/undo-queue-model';

/** The slice of `NodeGraphNode` a scrub needs. Narrow so the specs need no graph. */
export interface ScrubTarget {
  setParameter(name: string, value: unknown, args?: unknown): void;
  notifyListeners(event: string, ...args: unknown[]): unknown;
}

/** A live write during the drag. Records no undo — see the module note. */
export function writeScrubStep(model: ScrubTarget, name: string, value: unknown): void {
  model.setParameter(name, value);
}

export interface CommitScrubArgs {
  model: ScrubTarget;
  /** The port name. */
  name: string;
  /** What the parameter held when the press landed — possibly `undefined`. */
  startValue: unknown;
  /** What it holds now, at the end of the drag. */
  finalValue: unknown;
  /** The history label, e.g. `change Width`. */
  label: string;
}

/**
 * Record the one undo entry for a finished drag.
 *
 * @returns whether an entry was pushed. A drag that ends where it started records nothing:
 *   the value is unchanged, so an entry for it would be a history row that does nothing when
 *   undone — the same reason `PropertyPanelNumberInput` refuses to commit an unchanged edit.
 */
export function commitScrub({ model, name, startValue, finalValue, label }: CommitScrubArgs): boolean {
  if (sameParameterValue(startValue, finalValue)) return false;

  const group = new UndoActionGroup({ label });
  group.push({
    do: () => {
      model.setParameter(name, finalValue);
      model.notifyListeners('modelParameterRedo');
    },
    undo: () => {
      // `undefined` is a real answer here and the reason this is not `args.oldValue`: it
      // deletes the parameter, restoring a port that was on its default before the drag.
      model.setParameter(name, startValue);
      model.notifyListeners('modelParameterUndo');
    }
  });
  UndoQueue.instance.push(group);
  return true;
}

/**
 * Whether two stored parameter values are the same edit.
 *
 * ⚠️ Structural, not `===`: the unit-bearing rows store `{ value, unit }` and rebuild that
 * object on every write, so reference equality says "changed" for a drag that ended exactly
 * where it began. Only the fields these rows actually store are compared — a bare number, or
 * the `value`/`unit`/`isFixed` triple.
 */
export function sameParameterValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined || a === null || b === null) return false;
  if (typeof a === 'number' || typeof b === 'number') return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  return left.value === right.value && left.unit === right.unit && Boolean(left.isFixed) === Boolean(right.isFixed);
}
