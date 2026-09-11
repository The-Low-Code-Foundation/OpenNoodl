/**
 * CED-002 — the code editor popout stopped opening at 400px.
 *
 * 🔴 The defect, stated so the specs below can be read against it: the popout stored its size as
 * a fraction of the viewport, measured in `onClose` from the React root's *container div*. But
 * `CodeEditorType.dispose()` unmounts that root, and a property-panel teardown can dispose the
 * view out from under an open popout — so the measurement was sometimes taken of an emptied
 * `<div>`, which is `0×0`. That was stored as a chosen size, and the restore path's
 * `Math.max(…, 400)` turned it into a 400px editor that looked deliberate. Nothing ever wrote a
 * larger value back unless the user resized by hand, so it was permanent.
 *
 * Both halves are held here: the floor, and the refusal to store a measurement that cannot be
 * real.
 */

import {
  CODE_POPOUT_DEFAULT_HEIGHT_FRACTION,
  CODE_POPOUT_DEFAULT_WIDTH_FRACTION,
  CODE_POPOUT_MIN_HEIGHT,
  CODE_POPOUT_MIN_WIDTH,
  defaultCodeEditorSize,
  restoreCodeEditorSize,
  storableCodeEditorSize
} from '../../src/editor/src/views/panels/propertyeditor/CodeEditor/popoutSize';

const LAPTOP = { width: 1440, height: 800 };

describe('CED-002 — defaultCodeEditorSize', () => {
  it('opens at a working size, not at the old 400px floor', () => {
    const size = defaultCodeEditorSize(LAPTOP);

    expect(size.width).toBe(Math.round(1440 * CODE_POPOUT_DEFAULT_WIDTH_FRACTION));
    expect(size.height).toBe(Math.round(800 * CODE_POPOUT_DEFAULT_HEIGHT_FRACTION));
  });

  it('is at least double the width the defect produced', () => {
    // The complaint, as a number: 400px was what the broken restore path handed out.
    expect(defaultCodeEditorSize(LAPTOP).width).toBeGreaterThanOrEqual(800);
  });

  it('leaves a margin rather than opening flush to the window edge', () => {
    expect(defaultCodeEditorSize(LAPTOP).width).toBeLessThan(LAPTOP.width);
    expect(defaultCodeEditorSize(LAPTOP).height).toBeLessThan(LAPTOP.height);
  });

  it('lets a small window beat the floor rather than opening wider than the screen', () => {
    // An 800px floor on a 700px window is the same class of mistake this task is fixing.
    const size = defaultCodeEditorSize({ width: 700, height: 380 });
    expect(size.width).toBeLessThanOrEqual(700);
    expect(size.height).toBeLessThanOrEqual(380);
  });
});

describe('CED-002 — restoreCodeEditorSize', () => {
  it('honours a size the user actually chose', () => {
    const size = restoreCodeEditorSize({ width: 0.75, height: 0.6 }, LAPTOP);
    expect(size).toEqual({ width: 1080, height: 480 });
  });

  it('🔴 treats the stored {0, 0} as nothing stored, rather than clamping it to a floor', () => {
    // This is the exact value the defect wrote, and the exact reading that made it invisible:
    // `Math.max(1440 * 0, 400)` is 400, which looks like a deliberate small editor.
    expect(restoreCodeEditorSize({ width: 0, height: 0 }, LAPTOP)).toEqual(defaultCodeEditorSize(LAPTOP));
  });

  it('treats every other kind of nonsense as nothing stored too', () => {
    expect(restoreCodeEditorSize(null, LAPTOP)).toEqual(defaultCodeEditorSize(LAPTOP));
    expect(restoreCodeEditorSize('0.5', LAPTOP)).toEqual(defaultCodeEditorSize(LAPTOP));
    expect(restoreCodeEditorSize({ width: 0.5 }, LAPTOP)).toEqual(defaultCodeEditorSize(LAPTOP));
    expect(restoreCodeEditorSize({ width: NaN, height: 0.5 }, LAPTOP)).toEqual(defaultCodeEditorSize(LAPTOP));
    expect(restoreCodeEditorSize({ width: -0.5, height: 0.5 }, LAPTOP)).toEqual(defaultCodeEditorSize(LAPTOP));
  });

  it('raises a genuinely-chosen-but-tiny stored size to the floor', () => {
    // Someone who really did drag it down to 420px gets a usable editor back, because the
    // component's own render minimum (400) is not the same question as what it is worth opening
    // at. Conflating those two is how a "sensible minimum" became the size everyone got.
    const size = restoreCodeEditorSize({ width: 0.29, height: 0.2 }, LAPTOP);
    expect(size.width).toBe(CODE_POPOUT_MIN_WIDTH);
    expect(size.height).toBe(CODE_POPOUT_MIN_HEIGHT);
  });

  it('shrinks a size stored on a bigger screen to fit this one', () => {
    const size = restoreCodeEditorSize({ width: 0.98, height: 0.98 }, LAPTOP);
    expect(size.width).toBeLessThan(LAPTOP.width);
    expect(size.height).toBeLessThan(LAPTOP.height);
  });
});

describe('CED-002 — storableCodeEditorSize', () => {
  it('stores a real measurement as fractions', () => {
    expect(storableCodeEditorSize({ width: 1008, height: 480 }, LAPTOP)).toEqual({ width: 0.7, height: 0.6 });
  });

  it('🔴 refuses to store a measurement of an unmounted editor', () => {
    // The producer half of the defect. `dispose()` unmounts the React root, and an emptied
    // container measures 0×0 — which is not a size anyone chose.
    expect(storableCodeEditorSize({ width: 0, height: 0 }, LAPTOP)).toBeNull();
  });

  it('refuses a sliver too, not only an exact zero', () => {
    // A measurement taken mid-teardown can be small rather than zero, and a 12px popout is
    // exactly as impossible as a 0px one. Testing against zero would have caught only one.
    expect(storableCodeEditorSize({ width: 12, height: 8 }, LAPTOP)).toBeNull();
    expect(storableCodeEditorSize({ width: 900, height: 40 }, LAPTOP)).toBeNull();
  });

  it('does store a size somebody deliberately dragged small, even though it opens larger', () => {
    // ⚠️ The threshold for *believing* a measurement is the component's own render minimum
    // (400×200), not the opening floor. Using the floor here would silently discard a size the
    // user chose — the same disrespect the defect showed from the other direction.
    expect(storableCodeEditorSize({ width: 480, height: 300 }, LAPTOP)).toEqual({ width: 480 / 1440, height: 0.375 });
  });

  it('refuses to divide by a viewport that has not been laid out', () => {
    expect(storableCodeEditorSize({ width: 900, height: 500 }, { width: 0, height: 0 })).toBeNull();
  });

  it('round-trips a real size through storage unchanged', () => {
    const chosen = { width: 1000, height: 600 };
    const stored = storableCodeEditorSize(chosen, LAPTOP);
    expect(restoreCodeEditorSize(stored, LAPTOP)).toEqual(chosen);
  });
});
