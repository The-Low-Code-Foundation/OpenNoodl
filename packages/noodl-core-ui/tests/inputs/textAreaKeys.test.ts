/**
 * FIX-002 — the send key, graded where a node-env runner can reach it.
 *
 * Ruled 2026-08-14: Enter sends, Shift+Enter inserts a newline, in both AI
 * composers. `TextArea` historically did the opposite (Shift+Enter submitted),
 * so this suite exists for two reasons:
 *
 *   1. **Behavioural** — `shouldSubmitOnKey` is the whole policy, extracted to
 *      a pure module precisely so these cases are checkable without jsdom.
 *   2. **Structural** — a pure function nobody calls is decoration. The
 *      component source must delegate to it, and the old inverted condition
 *      must be gone. A spec asserting only (1) would stay green if TextArea
 *      quietly kept `ev.shiftKey && ev.key === 'Enter'`.
 */

import * as fs from 'fs';
import * as path from 'path';

import { shouldSubmitOnKey } from '@noodl-core-ui/components/inputs/TextArea/TextArea.keys';

const key = (overrides: Partial<{ key: string; shiftKey: boolean; defaultPrevented: boolean }> = {}) => ({
  key: 'Enter',
  shiftKey: false,
  defaultPrevented: false,
  ...overrides
});

describe('FIX-002 — shouldSubmitOnKey', () => {
  it('submits on plain Enter', () => {
    expect(shouldSubmitOnKey(key(), true)).toBe(true);
  });

  it('does NOT submit on Shift+Enter — that is the newline', () => {
    expect(shouldSubmitOnKey(key({ shiftKey: true }), true)).toBe(false);
  });

  it('does NOT submit an Enter a completion menu already consumed (BLD-016)', () => {
    expect(shouldSubmitOnKey(key({ defaultPrevented: true }), true)).toBe(false);
  });

  it('does nothing when no onEnter is bound', () => {
    expect(shouldSubmitOnKey(key(), false)).toBe(false);
  });

  it('ignores every other key, shifted or not', () => {
    expect(shouldSubmitOnKey(key({ key: 'a' }), true)).toBe(false);
    expect(shouldSubmitOnKey(key({ key: 'Escape' }), true)).toBe(false);
    expect(shouldSubmitOnKey(key({ key: 'a', shiftKey: true }), true)).toBe(false);
  });
});

describe('FIX-002 — TextArea.tsx actually uses the policy', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'src', 'components', 'inputs', 'TextArea', 'TextArea.tsx'),
    'utf8'
  );

  it('delegates the keydown decision to shouldSubmitOnKey', () => {
    expect(source).toContain("import { shouldSubmitOnKey } from './TextArea.keys';");
    expect(source).toContain('shouldSubmitOnKey(ev, Boolean(onEnter))');
  });

  it('no longer carries the inverted Shift+Enter submit condition', () => {
    expect(source).not.toMatch(/ev\.shiftKey\s*&&\s*ev\.key\s*===\s*'Enter'/);
  });

  it('documents onEnter as plain Enter, not Shift+Enter', () => {
    expect(source).not.toContain('Occurs when Shift+Enter is pressed.');
    expect(source).toContain('Occurs when plain Enter is pressed');
  });
});
