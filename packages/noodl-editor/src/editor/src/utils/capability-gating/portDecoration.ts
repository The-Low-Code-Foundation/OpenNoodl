/**
 * Putting a gate on a property-panel row — BCN-010 step 1, the port half.
 *
 * ## Why this is a wrapper around a rendered element and not a prop
 *
 * The obvious implementation is `isDisabled` and `caveat` on core-ui's
 * `PropertyPanelInput`, wired from each `TypeView`. That covers `BasicType` and
 * leaves twenty-eight other row classes — `BooleanType`, `PropListType`,
 * `EnumType`, `CodeEditorType`, the pickers, the popouts — each of which would
 * need the same two props threaded through its own render, and each of which is
 * a place the wiring can be forgotten. The first two ports this task needs to
 * gate are already in two different classes (`realtime` is a boolean,
 * `accessControl` is a proplist), so "start with BasicType" would have shipped
 * neither of them.
 *
 * `Ports.renderParams` is the one place every row's element passes through,
 * whatever class produced it. Wrapping there is one edit, covers every port type
 * including ones not written yet, and cannot be forgotten by the author of the
 * next row class.
 *
 * ## The failure mode this file is built around
 *
 * > **A disabled port with no reason is a bug in this task**, not a cosmetic gap
 * > — it converts "this backend cannot do that" into "this is broken."
 *
 * So {@link decoratePortElement} **refuses to disable a port it cannot explain**.
 * A gate with no reason leaves the row exactly as it was and logs loudly. The
 * contract's `gating.test.ts` makes that state impossible across every cell of
 * every descriptor, so this branch is a second lock on a door that is already
 * bolted — but the two failures are different (a table with a hole in it versus
 * a UI that silently breaks a control), and only one of them is caught by a test.
 */

import type { CapabilityGate } from '@noodl/backend-contract';

import { gateSentence, type GateTarget } from './index';

/** Class names, also used by the live-pass selectors. */
export const GATED_PORT_CLASS = 'property-capability-gated';
export const GATED_PORT_CONTROL_CLASS = 'property-capability-gated-control';
export const GATED_PORT_REASON_CLASS = 'property-capability-reason';

/**
 * Wrap a rendered row so it shows its gate, or return it untouched.
 *
 * `degraded` is deliberately **not** disabled: the operation works, with the
 * caveat the descriptor supplies. Rendering it as unavailable would take away a
 * working control on the strength of a footnote, which is the mirror of the bug
 * this task exists to fix.
 */
export function decoratePortElement(
  element: HTMLElement | null | undefined,
  gate: CapabilityGate | undefined,
  target: GateTarget,
  portName: string
): HTMLElement | null | undefined {
  if (!element || !gate) return element;
  if (gate.effective === 'supported') return element;

  const sentence = gateSentence(gate, target);

  if (!sentence) {
    // Fail open, and say so. A control the user can still operate is a smaller
    // harm than a dead one with no explanation — and this is exactly the state
    // the task calls a build failure, so it must be findable.
    // eslint-disable-next-line no-console
    console.error(
      `[capability-gating] port "${portName}" resolved to ${gate.effective} with no reason string; ` +
        'leaving it enabled. This is a hole in the capability descriptor, not a UI bug.'
    );
    return element;
  }

  const wrapper = document.createElement('div');
  wrapper.className = GATED_PORT_CLASS;
  wrapper.setAttribute('data-capability-state', gate.effective);
  wrapper.setAttribute('data-test', `capability-gated-port-${portName}`);

  if (!gate.isUsable) {
    const control = document.createElement('div');
    control.className = GATED_PORT_CONTROL_CLASS;
    // `inert` would be better and is not available everywhere this runs; the
    // pointer-events/opacity pair is the existing precedent in this stylesheet
    // (`.property-dimension-fixed-disabled`).
    control.setAttribute('aria-disabled', 'true');
    control.appendChild(element);
    wrapper.appendChild(control);
  } else {
    wrapper.appendChild(element);
  }

  const reason = document.createElement('div');
  reason.className = GATED_PORT_REASON_CLASS;
  reason.setAttribute('data-test', `capability-reason-${portName}`);
  // `textContent`, never `innerHTML`: the reason strings are ours, but a
  // `custom` backend's descriptor is filled in by the user in the Backend
  // Services panel, so one of these sentences is user input by design.
  reason.textContent = sentence;
  reason.title = sentence;
  wrapper.appendChild(reason);

  return wrapper;
}
