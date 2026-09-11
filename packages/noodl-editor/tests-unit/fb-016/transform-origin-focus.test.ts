/**
 * FB-016 scope 4 — the editor's half of the crosshair: turning focus on two fields into one
 * boolean.
 *
 * Everything the box-model overlay says is read off the DOM it is drawn over. The crosshair's
 * trigger is not: *"while the transform-origin field has focus"* is a fact about the editor's
 * properties panel, in a different process from the document the crosshair paints on. This module
 * is the whole of the editor's side of that push, and it is deliberately free of React and
 * Electron so it can be graded here rather than only in a drive.
 *
 * 🔴 **The row this file exists for is `tabbing from X to Y emits nothing`.** `transform-origin`
 * is one CSS declaration split across two panel fields, the DOM fires `blur` on the field being
 * left before `focus` on the one being entered, and the obvious relay therefore sends `false` then
 * `true` for a gesture in which the answer never changed — blinking the crosshair off and on under
 * the author's hand at the exact moment they are watching it. That is a bug a drive would show and
 * no assertion about a single field would.
 */
import {
  TransformOriginFocusTracker,
  isTransformOriginPort
} from '../../src/editor/src/views/panels/propertyeditor/transformOriginFocus';

/** A scheduler the spec drives by hand, so the deferred "off" is observable rather than awaited. */
function manualScheduler() {
  let queued: Array<() => void> = [];
  return {
    schedule: (callback: () => void) => {
      queued.push(callback);
      return queued.length - 1;
    },
    cancel: (handle: unknown) => {
      queued[handle as number] = () => undefined;
    },
    run: () => {
      const due = queued;
      queued = [];
      due.forEach((callback) => callback());
    },
    get pending() {
      return queued.length;
    }
  };
}

function build() {
  const emitted: boolean[] = [];
  const clock = manualScheduler();
  const tracker = new TransformOriginFocusTracker((enabled) => emitted.push(enabled), clock.schedule, clock.cancel);
  return { tracker, emitted, clock };
}

describe('which ports the crosshair is for', () => {
  it('is both halves of the origin, because the panel splits one declaration across two fields', () => {
    expect(isTransformOriginPort('transformOriginX')).toBe(true);
    expect(isTransformOriginPort('transformOriginY')).toBe(true);
  });

  it('control — the neighbouring Placement ports are not it, so the filter is reading the name', () => {
    // These are real ports on the same group (`node-shared-port-definitions.ts`), and two of them
    // are also number-with-units rows that will call `focus` on this tracker.
    expect(isTransformOriginPort('transformX')).toBe(false);
    expect(isTransformOriginPort('transformScale')).toBe(false);
    expect(isTransformOriginPort('marginLeft')).toBe(false);
    expect(isTransformOriginPort('')).toBe(false);
  });
});

describe('turning the crosshair on', () => {
  it('says on the moment a transform-origin field takes focus, without waiting for anything', () => {
    const { tracker, emitted } = build();
    tracker.focus('transformOriginX');
    expect(emitted).toEqual([true]);
    expect(tracker.isOn).toBe(true);
  });

  it('🔴 ignores every other field — the rows all report focus and only these two mean anything', () => {
    const { tracker, emitted } = build();
    tracker.focus('marginLeft');
    tracker.focus('transformX');
    expect(emitted).toEqual([]);
    expect(tracker.isOn).toBe(false);
  });

  it('does not say on twice when focus moves within the pair', () => {
    const { tracker, emitted } = build();
    tracker.focus('transformOriginX');
    tracker.focus('transformOriginY');
    expect(emitted).toEqual([true]);
  });
});

describe('turning it off', () => {
  it('waits one turn of the scheduler before saying off', () => {
    const { tracker, emitted, clock } = build();
    tracker.focus('transformOriginX');
    tracker.blur('transformOriginX');

    expect(emitted).toEqual([true]);
    clock.run();
    expect(emitted).toEqual([true, false]);
    expect(tracker.isOn).toBe(false);
  });

  it('🔴 THE ROW — tabbing from X to Y emits nothing at all', () => {
    const { tracker, emitted, clock } = build();
    tracker.focus('transformOriginX');
    // Exactly the order the DOM uses: blur on the field being left, then focus on the next.
    tracker.blur('transformOriginX');
    tracker.focus('transformOriginY');
    clock.run();

    expect(emitted).toEqual([true]);
    expect(tracker.isOn).toBe(true);
  });

  it('control — leaving the pair entirely DOES emit off, so the row above is not just a silent tracker', () => {
    const { tracker, emitted, clock } = build();
    tracker.focus('transformOriginX');
    tracker.blur('transformOriginX');
    tracker.focus('transformOriginY');
    clock.run();
    expect(emitted).toEqual([true]);

    tracker.blur('transformOriginY');
    clock.run();
    expect(emitted).toEqual([true, false]);
  });

  it('🔴 takes the focus back on dispose, because React does not fire blur on an input it unmounts', () => {
    // A panel rebuilt under the author's cursor is the case: without this the tracker is stuck on
    // and the crosshair is painted over an element nobody is editing.
    const { tracker, emitted, clock } = build();
    tracker.focus('transformOriginX');
    tracker.release('transformOriginX');
    clock.run();
    expect(emitted).toEqual([true, false]);
  });

  it('drops it immediately on reset, without a scheduler turn — a new selection is not a tab', () => {
    const { tracker, emitted, clock } = build();
    tracker.focus('transformOriginX');
    tracker.reset();
    expect(emitted).toEqual([true, false]);
    expect(tracker.isOn).toBe(false);
    clock.run();
    expect(emitted).toEqual([true, false]);
  });

  it('reset on an already-off tracker says nothing', () => {
    const { tracker, emitted } = build();
    tracker.reset();
    expect(emitted).toEqual([]);
  });

  it('does not queue a second deferred off for a field that was never focused', () => {
    const { tracker, emitted, clock } = build();
    tracker.blur('transformOriginX');
    expect(clock.pending).toBe(0);
    clock.run();
    expect(emitted).toEqual([]);
  });

  it('survives a blur that arrives twice for the same field', () => {
    const { tracker, emitted, clock } = build();
    tracker.focus('transformOriginX');
    tracker.blur('transformOriginX');
    tracker.blur('transformOriginX');
    clock.run();
    expect(emitted).toEqual([true, false]);
  });
});
