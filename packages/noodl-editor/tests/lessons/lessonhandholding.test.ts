/**
 * SYL-001 slice B — the learner's hand-holding preference.
 *
 * ## What these specs are guarding
 *
 * Slice A's specs graded the **compiler**: that `detail` renders at all, and that a step without
 * one did not move. These grade the **runtime half**, and the claim is narrower and easier to get
 * wrong:
 *
 * > The preference and the disclosure are a **loop**. The setting decides how the step is drawn;
 * > the learner redrawing it by hand decides the setting. A spec that only proves one direction
 * > proves nothing about the feature — an editor that applies a preference nothing can write is a
 * > preference that is always its default, which is indistinguishable from slice A.
 *
 * So the load-bearing spec here is the round trip: collapse one disclosure, render the *next*
 * step from the same store, and find it collapsed.
 *
 * ⚠️ Every DOM claim below is made against real `compileStep` output, not hand-built markup. The
 * selector this module uses (`details.lesson-detail`) is a coupling to the compiler's class name,
 * and a fixture written by hand would keep agreeing with itself after the compiler renamed it.
 */

import { compileStep } from '../../src/editor/src/models/lessonformat';
import {
  applyDetailDefaultOpen,
  applyDetailPreference,
  LESSON_DETAIL_OPEN_KEY,
  readDetailDefaultOpen,
  resolveDetailDefaultOpen
} from '../../src/editor/src/models/lessonhandholding';

const DETAIL = 'The node picker is the **+** in the top left.';

/** A stand-in for `EditorSettings.instance`, recording what was written to it. */
function fakeStore(initial?: Record<string, unknown>) {
  const values: Record<string, unknown> = { ...(initial ?? {}) };
  const writes: { key: string; value: unknown }[] = [];
  return {
    values,
    writes,
    get: (key: string) => values[key],
    set: (key: string, value: unknown) => {
      values[key] = value;
      writes.push({ key, value });
    }
  };
}

/** Render a compiled step into DOM the way `loadSteps` does. */
function render(step: Parameters<typeof compileStep>[0]): HTMLDivElement {
  const el = document.createElement('div');
  el.innerHTML = compileStep(step, 0);
  return el;
}

const stepWithDetail = { title: 'Add a Group', body: 'Drag it.', detail: DETAIL };
const stepWithout = { title: 'Add a Group', body: 'Drag it.' };

/**
 * The one disclosure in a rendered step.
 *
 * Asserted non-null rather than guarded: every caller below renders a step that *has* a `detail`,
 * so an absent disclosure is a failure of the thing under test, and a spec that quietly skipped
 * its assertions on null would report that failure as a pass.
 */
function disclosureIn(el: ParentNode): HTMLDetailsElement {
  return el.querySelector('details.lesson-detail') as HTMLDetailsElement;
}

describe('SYL-001 slice B — resolving the stored answer', () => {
  /**
   * 🔴 The asymmetry is deliberate and is the whole safety argument: only an explicit `false`
   * collapses. Unset, or anything left behind by a shape that no longer exists, means the learner
   * has not told us — and a learner we know nothing about gets slice A's behaviour.
   */
  it('only an explicit false collapses', () => {
    expect(resolveDetailDefaultOpen(false)).toBe(false);
    expect(resolveDetailDefaultOpen(true)).toBe(true);
    expect(resolveDetailDefaultOpen(undefined)).toBe(true);
    expect(resolveDetailDefaultOpen(null)).toBe(true);
    expect(resolveDetailDefaultOpen('no')).toBe(true);
    expect(resolveDetailDefaultOpen(0)).toBe(true);
  });

  it('reads that answer out of a settings store under one named key', () => {
    expect(readDetailDefaultOpen(fakeStore())).toBe(true);
    expect(readDetailDefaultOpen(fakeStore({ [LESSON_DETAIL_OPEN_KEY]: false }))).toBe(false);
    // A value under some *other* key must not be mistaken for this one.
    expect(readDetailDefaultOpen(fakeStore({ 'lessons.somethingElse': false }))).toBe(true);
  });
});

describe('SYL-001 slice B — applying it to a rendered step', () => {
  it('collapses the disclosure the compiler emitted open', () => {
    const el = render(stepWithDetail);
    expect(disclosureIn(el).hasAttribute('open')).toBe(true); // slice A's shipped default

    expect(applyDetailDefaultOpen(el, false)).toBe(1);
    expect(disclosureIn(el).hasAttribute('open')).toBe(false);
    expect(disclosureIn(el).open).toBe(false);
  });

  it('opens one that was collapsed', () => {
    const el = render(stepWithDetail);
    applyDetailDefaultOpen(el, false);

    expect(applyDetailDefaultOpen(el, true)).toBe(1);
    expect(disclosureIn(el).open).toBe(true);
  });

  /**
   * 🔴 THE CONTROL. `applyDetailDefaultOpen` walks the popup of every step in every lesson,
   * including the overwhelming majority that have no `detail` at all. This says it touches
   * nothing there — and the count is the instrument, because "0 changed" and "0 matched" read
   * identically from the outside otherwise.
   */
  it('touches nothing in a step that has no detail', () => {
    const el = render(stepWithout);
    const before = el.innerHTML;

    expect(applyDetailDefaultOpen(el, false)).toBe(0);
    expect(el.innerHTML).toBe(before);
  });

  /**
   * ⚠️ The attribute, not the property — `loadSteps` copies the popup's content through
   * `innerHTML` on its way to the screen, and a property set without its attribute would be
   * silently dropped by that copy. This is the spec that would have caught it.
   */
  it('survives the innerHTML copy the runtime makes before displaying it', () => {
    const el = render(stepWithDetail);
    applyDetailDefaultOpen(el, false);

    const copy = document.createElement('div');
    copy.innerHTML = el.innerHTML;
    expect(disclosureIn(copy).open).toBe(false);
  });
});

describe('SYL-001 slice B — the loop between the learner and the setting', () => {
  it('applies what the store says', () => {
    const store = fakeStore({ [LESSON_DETAIL_OPEN_KEY]: false });
    const el = render(stepWithDetail);

    expect(applyDetailPreference(el, store)).toBe(1);
    expect(disclosureIn(el).open).toBe(false);
  });

  it('records the learner collapsing one', () => {
    const store = fakeStore();
    const el = render(stepWithDetail);
    applyDetailPreference(el, store);

    disclosureIn(el).open = false;
    disclosureIn(el).dispatchEvent(new Event('toggle'));

    expect(store.writes.length).toBe(1);
    expect(store.writes[0].key).toBe(LESSON_DETAIL_OPEN_KEY);
    expect(store.writes[0].value).toBe(false);
  });

  it('records them opening one again — the answer is changeable, not a one-way door', () => {
    const store = fakeStore({ [LESSON_DETAIL_OPEN_KEY]: false });
    const el = render(stepWithDetail);
    applyDetailPreference(el, store);

    disclosureIn(el).open = true;
    disclosureIn(el).dispatchEvent(new Event('toggle'));

    expect(store.writes.length).toBe(1);
    expect(store.writes[0].value).toBe(true);
  });

  /**
   * 🔴 THE NEGATIVE CONTROL, and without it every spec above also passes on a handler that
   * writes the state on *every* toggle event. That handler would be wrong for a reason that
   * never shows up in a spec written forwards: `toggle` fires **asynchronously**, so the
   * listener can receive an event describing the attribute write this module just made — and the
   * editor would be recording its own guess back as though a person had said it.
   */
  it('does NOT record a toggle that merely agrees with what was applied', () => {
    const store = fakeStore();
    const el = render(stepWithDetail);
    applyDetailPreference(el, store); // applied: open

    disclosureIn(el).dispatchEvent(new Event('toggle')); // still open — our own write, echoed
    expect(store.writes.length).toBe(0);
  });

  /**
   * 🔴 THE ROUND TRIP — the one that grades the feature rather than either half of it. A learner
   * collapses the hand-holding on one step; the next step they are shown is drawn from the same
   * store, and arrives collapsed.
   */
  it('a collapse on one step is how the next step is drawn', () => {
    const store = fakeStore();

    const first = render(stepWithDetail);
    applyDetailPreference(first, store);
    expect(disclosureIn(first).open).toBe(true);

    disclosureIn(first).open = false;
    disclosureIn(first).dispatchEvent(new Event('toggle'));

    const next = render(stepWithDetail);
    applyDetailPreference(next, store);
    expect(disclosureIn(next).open).toBe(false);

    // ...and re-opening it on that step puts the next one back.
    disclosureIn(next).open = true;
    disclosureIn(next).dispatchEvent(new Event('toggle'));

    const third = render(stepWithDetail);
    applyDetailPreference(third, store);
    expect(disclosureIn(third).open).toBe(true);
  });

  /**
   * The synthetic `dispatchEvent` above is deterministic; this is the one spec that waits for the
   * browser's **real** `toggle`, so the whole file cannot be passing on an event name this DOM
   * never actually fires.
   */
  it('the real toggle event a click produces reaches the store', async () => {
    const store = fakeStore();
    const el = render(stepWithDetail);
    applyDetailPreference(el, store);

    const fired = new Promise<void>((resolve) => disclosureIn(el).addEventListener('toggle', () => resolve()));
    disclosureIn(el).querySelector('summary').click();
    await fired;

    expect(disclosureIn(el).open).toBe(false);
    expect(store.writes.length).toBe(1);
    expect(store.writes[0].value).toBe(false);
  });
});
