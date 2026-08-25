/**
 * Drawing FB-021's gated property row — the port that is secretly switched off.
 *
 * The fourth wrapper on `Ports.renderParams`, and it is a wrapper for the reason the other
 * three record: that call is the single place every row's element passes through, whatever of
 * the twenty-nine row classes produced it. `portDecoration.ts` (BCN-010), `portDescription.ts`
 * (ERG-004) and `portHint.ts` (FB-017 AC4) are the same seam; this is the fourth question asked
 * at it.
 *
 * ## Why it is a *fourth* module rather than a reuse of `portDecoration.ts`
 *
 * The shape is genuinely the same — a dimmed control with a sentence under it — and the CSS is
 * deliberately shared with it. The *type* is not. `decoratePortElement` takes a
 * `CapabilityGate` from `@noodl/backend-contract` and asks `gateSentence(gate, target)` what a
 * **backend** cannot do. A conditional port has no backend, no descriptor and no target;
 * satisfying that signature would mean minting a fake `CapabilityGate`, which is a worse
 * coupling than two small functions that agree on a stylesheet.
 *
 * ## 🔴 The difference from BCN-010 that the sentence has to carry
 *
 * A backend-gated port cannot do anything. A `conditionalports/basic` port **is live**: the wire
 * survives a reload, the value is delivered, and the layout throws it away
 * (`portGateReason.ts`'s header has the measurement). So a row that only said "unavailable"
 * would be the third wrong thing an author has been told about `width`. When the port is
 * connected, {@link applyPortGate} adds the second sentence — the dead wire — and it is
 * deliberately *not* inside the dimmed control, because it is the one part of the row that is
 * urgent.
 *
 * ## No DOM in this package's jest
 *
 * `jest.config.js` sets `testEnvironment: 'node'` for the whole package, so a suite has no
 * `document`. Hence the structural {@link GateElementLike} and the injectable `createElement` —
 * exactly the shape `portHint.ts` states and for the same reason. It also keeps this module
 * honest: needing more of the DOM than the members below stops the stub compiling, and the
 * widening has to be looked at.
 */

import type { PortGateReason } from '@noodl-models/nodelibrary/portGateReason';

/** Wrapper around a gated row. */
export const GATED_PORT_CLASS = 'property-port-gated';
/** The dimmed, inert control. */
export const GATED_PORT_CONTROL_CLASS = 'property-port-gated-control';
/** The sentence under it. */
export const GATED_PORT_REASON_CLASS = 'property-port-gate-reason';
/** The button that travels to the gating control — AC3. */
export const GATED_PORT_LINK_CLASS = 'property-port-gate-link';
/** The louder second sentence, drawn only when a live wire is being discarded. */
export const GATED_PORT_DEAD_WIRE_CLASS = 'property-port-gate-dead-wire';
/** Names the gated port on the wrapper, so a later pass can find the row without a re-render. */
export const GATED_PORT_ATTRIBUTE = 'data-gated-port';

/**
 * What a gated row says when its value is being delivered and discarded.
 *
 * Separate from the derived sentence and not derived from the declaration, because it is not a
 * fact about the declaration — it is a fact about *this* node's wiring. AC3 asks only that the
 * dead wire be visible; naming it outright costs one line and is the thing Jordan could not
 * learn from the UI at all.
 */
export const DEAD_WIRE_SENTENCE = 'A connection is delivering a value to this port, and it is being ignored.';

/** The minimum of a rendered element this module touches. */
export interface GateElementLike {
  className?: string;
  title?: string;
  textContent?: string;
  setAttribute(name: string, value: string): void;
  appendChild(child: TSFixme): TSFixme;
}

export interface PortGateOptions {
  /** Is a wire currently delivering a value into this gated port? */
  isConnected?: boolean;
  /** Travel to the gating control. Omitted → no button is drawn rather than a dead one. */
  onFocusGate?: () => void;
  createElement?: (tag: string) => TSFixme;
}

/**
 * Wrap a rendered row as *present but switched off*, or return it untouched.
 *
 * Returns the wrapper so the call site stays a one-liner in `renderParams`'s `els.push(...)`
 * chain. A row with no reason is returned exactly as it came in — this module never dims a
 * control it cannot explain, which is `portDecoration.ts`'s rule and the reason
 * `reasonsForGatedPorts` omits the ports it cannot put words to instead of inventing any.
 */
export function applyPortGate(
  element: GateElementLike | null | undefined,
  reason: PortGateReason | undefined,
  options: PortGateOptions = {}
): GateElementLike | null | undefined {
  if (!element || !reason) return element;

  const createElement = options.createElement || ((tag: string) => document.createElement(tag));

  const wrapper = createElement('div');
  wrapper.className = GATED_PORT_CLASS;
  wrapper.setAttribute(GATED_PORT_ATTRIBUTE, reason.portName);
  wrapper.setAttribute('data-test', `gated-port-${reason.portName}`);

  const control = createElement('div');
  control.className = GATED_PORT_CONTROL_CLASS;
  // `inert` would be better and is not available everywhere this runs; the pointer-events /
  // opacity pair is the precedent already in this stylesheet (`.property-capability-gated-control`).
  control.setAttribute('aria-disabled', 'true');
  control.appendChild(element);
  wrapper.appendChild(control);

  const block = createElement('div');
  block.className = GATED_PORT_REASON_CLASS;
  block.setAttribute('data-test', `gate-reason-${reason.portName}`);

  const sentence = createElement('span');
  // `textContent`, never `innerHTML` — the rule `portDecoration.ts` and `portHint.ts` both
  // state. A port's `displayName` reaches this string, and a kit node supplies its own.
  sentence.textContent = reason.sentence;
  sentence.title = reason.sentence;
  block.appendChild(sentence);

  if (options.onFocusGate) {
    const link = createElement('button');
    link.className = GATED_PORT_LINK_CLASS;
    link.setAttribute('data-test', `gate-link-${reason.portName}`);
    link.setAttribute('type', 'button');
    link.textContent = `Show ${reason.gateLabel}`;
    link.title = `Go to ${reason.gateLabel}`;
    link.onclick = (event: TSFixme) => {
      // The row underneath is inert, but the wrapper is not: without this the click also
      // reaches the group header and folds the group the author is being sent into.
      if (event && event.stopPropagation) event.stopPropagation();
      options.onFocusGate();
    };
    block.appendChild(link);
  }

  wrapper.appendChild(block);

  if (options.isConnected) {
    const dead = createElement('div');
    dead.className = GATED_PORT_DEAD_WIRE_CLASS;
    dead.setAttribute('data-test', `gate-dead-wire-${reason.portName}`);
    dead.textContent = DEAD_WIRE_SENTENCE;
    dead.title = DEAD_WIRE_SENTENCE;
    wrapper.appendChild(dead);
  }

  return wrapper;
}

/** Briefly marks the row the author was just sent to. */
export const GATE_TARGET_CLASS = 'property-port-gate-target';

/** How long that mark stays up. Long enough to find, short enough not to become chrome. */
export const GATE_TARGET_MS = 1400;

/** The minimum of a destination row {@link revealGateTarget} touches. */
export interface GateTargetElementLike {
  setAttribute(name: string, value: string): void;
  querySelector(selector: string): { focus?(): void } | null;
  focus?(options?: unknown): void;
  scrollIntoView?(options?: unknown): void;
  classList: { add(name: string): void; remove(name: string): void };
}

/**
 * Put the author in front of the control that switched a port off — FB-021 AC3.
 *
 * 🔴 **The fallback is the whole point, and driving is the only reason it exists.**
 *
 * The first version focused `el.querySelector('input, select, textarea, button')`. That is
 * right for the twenty-odd row classes built on `PropertyPanelInput` — and wrong for the one
 * node the task was filed about. `Size Mode` renders `SizeModeInput`, which is **`div`s and
 * `span`s and nothing else**: measured live on a `Group`, `focusables: 0`, `tagCensus: [DIV,
 * SPAN]`. So the jump ran, scrolled, found nothing to focus, and left `document.activeElement`
 * on `BODY`. Every assertion about the reason sentence still passed.
 *
 * ⚠️ Note how narrowly this missed being caught: `focusGatePort`'s own comment already says a
 * `data-identifier` selector would fail on `SizeModeType`. The *focus* step then failed on the
 * same node for the adjacent reason. Knowing a class is unusual is not the same as checking
 * every step against it.
 *
 * So the row itself is the destination when nothing inside it can take focus, and the highlight
 * is drawn either way: focusing a `div` produces no visible change at all, and an author sent
 * to an unlabelled icon widget needs to be shown *which* one.
 */
export function revealGateTarget(
  element: GateTargetElementLike | null | undefined,
  schedule: (fn: () => void, ms: number) => void = (fn, ms) => setTimeout(fn, ms)
): 'focused-control' | 'focused-row' | 'none' {
  if (!element) return 'none';

  if (element.scrollIntoView) element.scrollIntoView({ behavior: 'smooth', block: 'center' });

  element.classList.add(GATE_TARGET_CLASS);
  schedule(() => element.classList.remove(GATE_TARGET_CLASS), GATE_TARGET_MS);

  const control = element.querySelector('input, select, textarea, button');
  if (control && control.focus) {
    control.focus();
    return 'focused-control';
  }

  if (element.focus) {
    // `-1` rather than `0`: reachable by script, never inserted into the tab order. A property
    // row is not a stop an author should have to tab past on the way to the next field.
    element.setAttribute('tabindex', '-1');
    // Already scrolled above, deliberately smoothly; letting focus scroll again would jump it.
    element.focus({ preventScroll: true });
    return 'focused-row';
  }

  return 'none';
}
