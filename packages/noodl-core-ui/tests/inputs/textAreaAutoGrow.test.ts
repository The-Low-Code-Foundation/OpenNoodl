/**
 * FIX-002 criterion 2 — "a newline can be inserted and is visible; the composer grows to show it".
 *
 * Ruled 2026-08-15: **auto-grow to a max height**, capped in rows. Before this the composer had a
 * fixed `min-height: 51px` and no JS growth, so a second line pushed the first out of view — the
 * newline went in, and you could not see what you had written.
 *
 * Same two-part shape as {@link ./textAreaKeys.test}, and for the same reason: both jest runners
 * here are **node-env, no jsdom**, so the arithmetic is graded behaviourally in isolation and the
 * wiring is graded structurally against the source. A pure function nobody calls is decoration,
 * and the auto-grow half of this fix is *entirely* wiring — the sizing rule is worthless if
 * `useLayoutEffect` never releases the height, or if the composer never passes `autoGrowMaxRows`.
 */

import * as fs from 'fs';
import * as path from 'path';

import { autoGrowHeight } from '@noodl-core-ui/components/inputs/TextArea/TextArea.autogrow';

/** The composer's real geometry: `.Input` is `line-height: 20px` with `8px` padding, no border. */
const COMPOSER = { lineHeight: 20, verticalChrome: 16, maxRows: 8 };
/** The cap those numbers produce: 8 rows of 20px plus the border-box chrome. */
const CAP = 176;

const readSource = (relative: string) =>
  fs.readFileSync(path.join(__dirname, '../../src/components/inputs/TextArea', relative), 'utf8');

describe('FIX-002 — autoGrowHeight', () => {
  it('grows to fit a single line', () => {
    expect(autoGrowHeight({ ...COMPOSER, scrollHeight: 36 })).toEqual({ height: 36, overflowY: 'hidden' });
  });

  it('grows when a newline is added — the criterion, in one assertion', () => {
    const oneLine = autoGrowHeight({ ...COMPOSER, scrollHeight: 36 });
    const twoLines = autoGrowHeight({ ...COMPOSER, scrollHeight: 56 });
    expect(twoLines.height).toBeGreaterThan(oneLine.height);
    expect(twoLines.height).toBe(56);
  });

  it('shrinks again when the line is deleted', () => {
    // Only reachable because the effect releases `height` to `auto` before measuring; the
    // structural spec below is what holds that.
    expect(autoGrowHeight({ ...COMPOSER, scrollHeight: 36 }).height).toBe(36);
  });

  it('stops at the cap and hands over to scrolling', () => {
    expect(autoGrowHeight({ ...COMPOSER, scrollHeight: 400 })).toEqual({ height: CAP, overflowY: 'auto' });
  });

  it('includes the border-box chrome in the cap, so eight rows means eight visible rows', () => {
    // ⚠️ `.Input` is `box-sizing: border-box`, so the height set includes the padding. A cap of
    // `lineHeight * maxRows` alone would show seven rows and a sliver.
    expect(autoGrowHeight({ ...COMPOSER, scrollHeight: 9999 }).height).toBe(20 * 8 + 16);
  });

  it('does NOT scroll content that measures exactly the cap', () => {
    // Strictly-greater, not greater-or-equal: everything fits, so a scrollbar would be a lie.
    expect(autoGrowHeight({ ...COMPOSER, scrollHeight: CAP })).toEqual({ height: CAP, overflowY: 'hidden' });
  });

  it('scrolls one pixel past the cap', () => {
    expect(autoGrowHeight({ ...COMPOSER, scrollHeight: CAP + 1 }).overflowY).toBe('auto');
  });

  it('honours a different row count', () => {
    expect(autoGrowHeight({ ...COMPOSER, maxRows: 3, scrollHeight: 9999 }).height).toBe(20 * 3 + 16);
  });
});

describe('FIX-002 — the auto-grow is actually wired up', () => {
  const component = readSource('TextArea.tsx');

  it('TextArea calls autoGrowHeight', () => {
    expect(component).toContain('autoGrowHeight');
  });

  it('releases the height before measuring, so the composer can shrink as well as grow', () => {
    // 🔴 The one line the whole shrink case rests on. `scrollHeight` never reports less than the
    // height already set, so without this the composer sticks at its high-water mark forever and
    // every spec above still passes.
    expect(component).toMatch(/style\.height = 'auto'/);
  });

  it('measures in a layout effect, not a passive one', () => {
    // A passive effect paints one frame at the old height — visible as a flicker on every
    // keystroke that changes the line count.
    expect(component).toContain('useLayoutEffect');
  });

  it('leaves the height alone once the user has dragged the resize corner', () => {
    expect(component).toContain('userHasResized');
  });

  it('forwards the caller ref rather than replacing it (BLD-016 reads selectionStart)', () => {
    // The auto-grow needs the element, and so does the mention menu. Taking the ref for itself
    // would break completions in the Build composer — a different panel entirely.
    expect(component).toContain('setRefs');
    expect(component).toMatch(/inputRef\(node\)/);
  });

  it('is opt-in — no default row count, so other consumers are untouched', () => {
    // ⚠️ `TextArea` has consumers well beyond the AI composers, and the Build composer carries
    // *driven* acceptance (BLD-010). A default would resize all of them silently.
    expect(component).not.toMatch(/autoGrowMaxRows\s*=\s*\d/);
  });
});

describe('FIX-002 — the Explain composer opts in', () => {
  it('passes a row cap', () => {
    const panel = fs.readFileSync(
      path.join(__dirname, '../../../noodl-editor/src/editor/src/views/panels/ExplainPanel/ExplainPanel.tsx'),
      'utf8'
    );
    expect(panel).toMatch(/autoGrowMaxRows=\{8\}/);
  });

  it('the stylesheet sets an explicit line-height for the cap to be exact', () => {
    // `getComputedStyle` reports `normal` verbatim rather than resolving it to a number, so
    // without this the row cap would have to guess a multiplier.
    expect(readSource('TextArea.module.scss')).toMatch(/line-height:\s*20px/);
  });
});
