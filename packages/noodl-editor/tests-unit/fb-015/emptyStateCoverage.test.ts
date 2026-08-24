/**
 * FB-015 AC5 — every picker that can draw a blank panel has an empty state, or a written reason.
 *
 * ## Why this is a sweep and not a list
 *
 * FB-018 stalled at five of thirty-six row classes for three phases because nothing recorded that
 * it had: *"the chip is rolled out"* and *"rolled out to five"* were the same sentence as far as
 * the repo was concerned. The same shape is available here — four pickers share
 * `openContentPicker`, and doing one of them reads exactly like doing them all.
 *
 * So the population is **derived from the source**: every `openContentPicker(` call site under
 * `DataTypes/`. A new picker added later joins this sweep without anybody remembering to add it,
 * and it fails until it either carries an empty state or is written down below with a reason.
 *
 * 🔴 The exception list is a LITERAL. Computing it from the call sites it constrains would let it
 * grow silently to match, which is the failure FB-018 found in its own first draft.
 *
 * ⚠️ **Bound.** This reads text, so it grades that a call site *passes* `emptyState`, not that the
 * value is any good. What the empty state actually says, and that its buttons are wired, is graded
 * against the real values in `contentPickerEmptyState.test.tsx`; that it appears in the running
 * editor is AC1's drive.
 */
import fs from 'fs';
import path from 'path';

import { stripComments } from '../support/renderElements';

const DATA_TYPES_DIR = path.join(__dirname, '../../src/editor/src/views/panels/propertyeditor/DataTypes');

/**
 * A picker that opens a shared `ContentPicker` and deliberately has no empty state, with the
 * reason it does not need one. Structural only — "it cannot be empty", never "not done yet".
 */
const NO_EMPTY_STATE_NEEDED: Record<string, string> = {
  'FontType.ts':
    'The font list is never empty: `loadFontItems` pushes the eight COMMON_FONTS synchronously ' +
    'before it ever looks at the project, so the no-rows branch is unreachable.'
};

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [full] : [];
  });
}

/** Every file under DataTypes/ that opens a shared ContentPicker, by base name. */
function pickersUsingTheSharedPicker(): string[] {
  return sourceFiles(DATA_TYPES_DIR)
    .filter((file) => {
      const source = stripComments(fs.readFileSync(file, 'utf8'));
      // The base class defines it; the subclasses call it.
      if (path.basename(file) === 'PickerTypeView.ts') return false;
      return source.includes('this.openContentPicker(');
    })
    .map((file) => path.basename(file));
}

describe('FB-015 AC5 — empty-state coverage across the shared picker', () => {
  /**
   * A sweep over an empty population passes vacuously. This is the known-firing signal beside it:
   * if the parse ever stops finding call sites, this red comes first and says so.
   */
  it('finds the pickers it is meant to be sweeping', () => {
    const pickers = pickersUsingTheSharedPicker();
    expect(pickers.length).toBeGreaterThanOrEqual(4);
    expect(pickers).toContain('ImageType.ts');
    expect(pickers).toContain('FontType.ts');
    expect(pickers).toContain('IdentifierType.ts');
    expect(pickers).toContain('SourceCodeType.ts');
  });

  it('every one either passes an emptyState or is a written exception', () => {
    const missing = pickersUsingTheSharedPicker().filter((name) => {
      if (name in NO_EMPTY_STATE_NEEDED) return false;
      const file = sourceFiles(DATA_TYPES_DIR).find((f) => path.basename(f) === name);
      return !stripComments(fs.readFileSync(file, 'utf8')).includes('emptyState:');
    });

    expect(missing).toEqual([]);
  });

  it('every exception carries a reason, and no exception is a stale name', () => {
    const pickers = pickersUsingTheSharedPicker();
    Object.entries(NO_EMPTY_STATE_NEEDED).forEach(([name, reason]) => {
      expect(pickers).toContain(name);
      expect(reason.length).toBeGreaterThan(40);
    });
  });

  /**
   * 🔴 The loading state is the other half of AC1, and it lives at the call sites: a loader that
   * returns without reporting leaves the picker saying "Looking…" forever. Every picker that opens
   * one must clear it — `addItems` and `setItems` both do, and one of them has to be reachable on
   * every path out of the loader.
   *
   * ⚠️ Matched without the call parens on purpose: `FontType` hands `picker.addItems` to
   * `loadFontItems` as a reference rather than calling it here, and a check that insisted on
   * `.addItems(` would have reported the one picker that reports FASTEST — synchronously, before
   * it looks at the project at all — as the one that never reports.
   */
  it('every picker reports to its handle rather than returning silently', () => {
    const silent = pickersUsingTheSharedPicker().filter((name) => {
      const file = sourceFiles(DATA_TYPES_DIR).find((f) => path.basename(f) === name);
      const source = stripComments(fs.readFileSync(file, 'utf8'));
      return !/\.(addItems|setItems)\b/.test(source);
    });

    expect(silent).toEqual([]);
  });
});
