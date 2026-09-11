/**
 * FB-022 AC2 and AC5 — what a press does when it is a click, and what a release leaves behind.
 *
 * ## Why this is a spec and not only a drive
 *
 * Both criteria are about bookkeeping that is invisible until it is wrong. A stuck drag —
 * AC5's failure — does not look like anything: the field is fine, the panel is fine, and then
 * every subsequent mouse movement anywhere on screen quietly writes a parameter. It is not
 * something a drive notices unless the drive is looking for it, and by then the mechanism has
 * shipped. So the controller takes its document as an argument and the fake below counts what
 * is attached, which turns "no stuck drag" into an assertion about a number.
 *
 * ⚠️ What this cannot see: that a real `<input>` receives focus from an un-prevented
 * mousedown, that `user-select` actually stops a selection being painted, or that a real
 * mouseup outside the window arrives at all. Those are the drive, and they are named in the
 * task file rather than assumed here.
 */
import {
  ScrubBinding,
  ScrubDocument,
  ScrubPointerEvent,
  createScrubController
} from '@noodl-core-ui/components/property-panel/scrub/scrubController';
import { SCRUB_THRESHOLD_PX } from '@noodl-core-ui/components/property-panel/scrub/scrubGesture';

/** A document that remembers exactly what is attached to it, which is the thing under test. */
function fakeDocument() {
  const handlers = new Map<string, Set<(event: never) => void>>();
  const body = { style: { userSelect: 'text', cursor: 'auto' } };

  const doc: ScrubDocument & {
    attachedCount(): number;
    fire(type: string, event: ScrubPointerEvent): void;
    body: typeof body;
  } = {
    body,
    addEventListener(type, handler) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      handlers.get(type)?.delete(handler);
    },
    attachedCount() {
      let total = 0;
      for (const set of handlers.values()) total += set.size;
      return total;
    },
    fire(type, event) {
      for (const handler of Array.from(handlers.get(type) ?? [])) {
        (handler as (e: ScrubPointerEvent) => void)(event);
      }
    }
  };
  return doc;
}

interface Recorder {
  begins: number;
  scrubs: number[];
  ends: { value: number; startValue: number }[];
  binding: ScrubBinding;
}

function recorder(step = 1, value = 50): Recorder {
  const rec: Recorder = { begins: 0, scrubs: [], ends: [], binding: null };
  rec.binding = {
    step,
    value,
    onScrubBegin: () => {
      rec.begins += 1;
    },
    onScrub: (v) => rec.scrubs.push(v),
    onScrubEnd: (v, startValue) => rec.ends.push({ value: v, startValue })
  };
  return rec;
}

function press(clientX: number): ScrubPointerEvent & { prevented: number } {
  const event = { clientX, button: 0, prevented: 0, preventDefault: () => (event.prevented += 1) };
  return event;
}

function harness(step = 1, value = 50) {
  const rec = recorder(step, value);
  const doc = fakeDocument();
  const controller = createScrubController({ getBinding: () => rec.binding, getDocument: () => doc });
  return { rec, doc, controller };
}

describe('FB-022 AC2 — a press that does not move is still a click', () => {
  // 🔴 THIS IS THE ONE THAT BREAKS THE FEATURE IF IT REGRESSES. `preventDefault` on mousedown
  // is what stops the browser focusing the input; a controller that called it would turn every
  // numeric field into a drag-only control that can no longer be typed into.
  it('never prevents the default on the press itself', () => {
    const { rec, controller } = harness();
    const down = press(100);
    controller.onMouseDown(down);
    expect(down.prevented).toBe(0);
    expect(rec.begins).toBe(0);
    expect(rec.scrubs).toEqual([]);
  });

  it('writes nothing at all for a press and release with no movement', () => {
    const { rec, doc, controller } = harness();
    controller.onMouseDown(press(100));
    doc.fire('mouseup', press(100));
    expect(rec.scrubs).toEqual([]);
    expect(rec.ends).toEqual([]);
    expect(rec.begins).toBe(0);
  });

  it('writes nothing for the hand-tremor a press picks up below the threshold', () => {
    const { rec, doc, controller } = harness();
    controller.onMouseDown(press(100));
    doc.fire('mousemove', press(100 + (SCRUB_THRESHOLD_PX - 1)));
    doc.fire('mouseup', press(100 + (SCRUB_THRESHOLD_PX - 1)));
    expect(rec.scrubs).toEqual([]);
    expect(rec.ends).toEqual([]);
  });

  // 🔴 The control arm. Every "nothing was written" claim above is only worth something beside
  // an arm where the same controller demonstrably DOES write — one pixel further.
  it('but a press one pixel past the threshold does write', () => {
    const { rec, doc, controller } = harness();
    controller.onMouseDown(press(100));
    doc.fire('mousemove', press(100 + SCRUB_THRESHOLD_PX));
    doc.fire('mouseup', press(100 + SCRUB_THRESHOLD_PX));
    expect(rec.begins).toBe(1);
    expect(rec.scrubs).toEqual([53]);
    expect(rec.ends).toEqual([{ value: 53, startValue: 50 }]);
  });

  it('ignores a press from any button but the left one', () => {
    const { rec, doc, controller } = harness();
    controller.onMouseDown({ clientX: 100, button: 2 });
    doc.fire('mousemove', press(200));
    expect(rec.scrubs).toEqual([]);
    expect(doc.attachedCount()).toBe(0);
  });

  it('does nothing when the row supplied no binding', () => {
    const doc = fakeDocument();
    const controller = createScrubController({ getBinding: () => undefined, getDocument: () => doc });
    controller.onMouseDown(press(100));
    expect(doc.attachedCount()).toBe(0);
  });
});

describe('FB-022 — a drag writes continuously and ends once', () => {
  it('emits one live value per move and exactly one end', () => {
    const { rec, doc, controller } = harness();
    controller.onMouseDown(press(100));
    for (const x of [110, 120, 130]) doc.fire('mousemove', press(x));
    doc.fire('mouseup', press(130));

    expect(rec.scrubs).toEqual([60, 70, 80]);
    expect(rec.ends).toEqual([{ value: 80, startValue: 50 }]);
    expect(rec.begins).toBe(1);
  });

  it('announces the start of the drag once, not once per move', () => {
    const { rec, doc, controller } = harness();
    controller.onMouseDown(press(100));
    for (const x of [110, 120, 130, 140]) doc.fire('mousemove', press(x));
    expect(rec.begins).toBe(1);
  });

  // 🔴 The row re-renders after every live write, so the binding it hands down is a NEW object
  // each time. A controller that captured the binding at mousedown would write the whole drag
  // through the row as it was before the drag started — including its stale `value`.
  it('reads the binding fresh on every event rather than capturing it at the press', () => {
    const doc = fakeDocument();
    const seen: string[] = [];
    let generation = 0;
    const controller = createScrubController({
      getBinding: () => {
        const id = `gen${generation}`;
        return { step: 1, value: 50, onScrub: () => seen.push(id), onScrubEnd: () => seen.push(`${id}-end`) };
      },
      getDocument: () => doc
    });

    controller.onMouseDown(press(100));
    generation = 1;
    doc.fire('mousemove', press(110));
    generation = 2;
    doc.fire('mousemove', press(120));
    doc.fire('mouseup', press(120));

    expect(seen).toEqual(['gen1', 'gen2', 'gen2-end']);
  });

  it('suppresses text selection only once the press has become a drag', () => {
    const { doc, controller } = harness();
    controller.onMouseDown(press(100));
    expect(doc.body.style.userSelect).toBe('text');

    doc.fire('mousemove', press(140));
    expect(doc.body.style.userSelect).toBe('none');
    expect(doc.body.style.cursor).toBe('ew-resize');
  });
});

describe('FB-022 AC5 — nothing is left attached', () => {
  it('attaches exactly two handlers for the life of a gesture and no more', () => {
    const { doc, controller } = harness();
    expect(doc.attachedCount()).toBe(0);
    controller.onMouseDown(press(100));
    expect(doc.attachedCount()).toBe(2);
    doc.fire('mousemove', press(140));
    expect(doc.attachedCount()).toBe(2);
  });

  it('detaches on mouseup, including one that never moved', () => {
    const { doc, controller } = harness();
    controller.onMouseDown(press(100));
    doc.fire('mouseup', press(100));
    expect(doc.attachedCount()).toBe(0);
  });

  it('detaches on a mouseup after a real drag', () => {
    const { doc, controller } = harness();
    controller.onMouseDown(press(100));
    doc.fire('mousemove', press(200));
    doc.fire('mouseup', press(200));
    expect(doc.attachedCount()).toBe(0);
    expect(controller.isScrubbing()).toBe(false);
  });

  // 🔴 THE STUCK DRAG, STATED. After the release, movement on the page must reach nothing —
  // this is the arm that fails if `release()` is ever moved below a line that can throw.
  it('writes nothing on movement after the button has come up', () => {
    const { rec, doc, controller } = harness();
    controller.onMouseDown(press(100));
    doc.fire('mousemove', press(150));
    doc.fire('mouseup', press(150));

    const after = rec.scrubs.length;
    doc.fire('mousemove', press(400));
    doc.fire('mousemove', press(900));
    expect(rec.scrubs.length).toBe(after);
  });

  it('restores the body styles it changed', () => {
    const { doc, controller } = harness();
    controller.onMouseDown(press(100));
    doc.fire('mousemove', press(200));
    doc.fire('mouseup', press(200));
    expect(doc.body.style.userSelect).toBe('text');
    expect(doc.body.style.cursor).toBe('auto');
  });

  // The half a mouseup cannot cover: the panel rebuilds on every committed parameter and on
  // undo, so the row under the cursor can be unmounted with the button still down.
  it('detaches and restores the body when disposed mid-drag', () => {
    const { rec, doc, controller } = harness();
    controller.onMouseDown(press(100));
    doc.fire('mousemove', press(200));
    expect(doc.body.style.cursor).toBe('ew-resize');

    controller.dispose();
    expect(doc.attachedCount()).toBe(0);
    expect(doc.body.style.cursor).toBe('auto');

    const after = rec.scrubs.length;
    doc.fire('mousemove', press(400));
    expect(rec.scrubs.length).toBe(after);
  });

  it('does not stack listeners when a second press arrives without a release', () => {
    const { doc, controller } = harness();
    controller.onMouseDown(press(100));
    controller.onMouseDown(press(200));
    expect(doc.attachedCount()).toBe(2);
  });

  it('is safe to dispose twice, and when nothing was ever pressed', () => {
    const { doc, controller } = harness();
    controller.dispose();
    controller.dispose();
    expect(doc.attachedCount()).toBe(0);
  });
});
