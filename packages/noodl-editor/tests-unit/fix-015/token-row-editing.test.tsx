/**
 * FIX-015 slice 1 — the Design Tokens panel's rows are editable.
 *
 * 🔴 **Gap A of FIX-015 was "no human editing surface at all", and it was ONE COMPONENT DEEP.**
 * `DesignTokensTab` already passed `onTokenChange` → `styleTokensModel.setToken(name, value,
 * { undo: true })`, a real and undoable write. `TokenRow` destructured it to `_onTokenChange`
 * behind an eslint-disable and dropped it, with a comment deferring the work to "Phase 3:
 * TokenPicker".
 *
 * ⚠️ **TokenPicker was the wrong component for it.** Its callback is `onTokenSelect(cssVar)` —
 * "the full CSS `var(--token-name)` string, ready to use as a style value" — so it chooses WHICH
 * TOKEN A PROPERTY REFERENCES. It cannot change a token's own value, which is the only thing this
 * panel exists to do. Slice 1's stated mechanism did not do the job it was named for.
 *
 * ⚠️ These render assertions do NOT make the panel shipped. It is still registered only under
 * `config.devMode`; FIX-015's ruling is explicit that flipping that flag is "the wrong verb" and
 * that the first drive should be expected to produce a bug list. This closes the editing gap so
 * that a drive has something to find bugs IN.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { TokenCategorySection } from '../../src/editor/src/views/panels/DesignTokenPanel/components/TokenCategorySection/TokenCategorySection';

type Token = {
  name: string;
  value: string;
  category: string;
  isCustom?: boolean;
  description?: string;
};

const TOKENS: Token[] = [
  { name: '--primary', value: '#3b82f6', category: 'color-semantic' },
  { name: '--spacing-m', value: '16px', category: 'spacing', isCustom: true },
  { name: '--accent', value: 'var(--primary)', category: 'color-semantic' }
];

function render(tokens: Token[] = TOKENS, onTokenChange = () => undefined) {
  return renderToStaticMarkup(
    React.createElement(TokenCategorySection as never, {
      tokens,
      onTokenChange,
      onTokenReset: () => undefined
    } as never)
  );
}

describe('FIX-015 §1 — a token row offers an editable value', () => {
  it('🔴 renders an input per token, not a read-only span', () => {
    const html = render();
    // Three tokens in, three inputs out. Before this, the value was a `<span>` and the panel
    // could only be read.
    expect(html.match(/<input/g) ?? []).toHaveLength(3);
  });

  it('shows each token’s current value in its own input', () => {
    const html = render();
    expect(html).toContain('value="#3b82f6"');
    expect(html).toContain('value="16px"');
  });

  it('labels each input with the token it edits, so the row is reachable', () => {
    expect(render()).toContain('aria-label="Value for --primary"');
  });

  it('names the reference in the title when a token points at another token', () => {
    expect(render()).toContain('References var(--primary)');
  });

  it('still offers the reset button only on a customised token', () => {
    // One of the three fixtures is `isCustom`. A reset on an untouched token has nothing to undo.
    expect(render().match(/Reset to default/g) ?? []).toHaveLength(1);
  });

  it('renders nothing at all for an empty token list, without throwing', () => {
    expect(() => render([])).not.toThrow();
    expect(render([]).match(/<input/g)).toBeNull();
  });
});
