/**
 * STYLE-001: TokenCategorySection
 *
 * Renders a list of token rows within a category section.
 * Each row shows a color swatch (for colors) or a text preview, the token name,
 * current value, and a reset button if overridden.
 */

import React, { useEffect, useState } from 'react';

/**
 * ⚠️ **The two leaf modules, not the barrel.** `@noodl-models/StyleTokensModel`'s `index.ts` also
 * re-exports `StyleTokensModel`, which imports `projectmodel` → `bugtracker`, which reads
 * `platform.getUserDataPath()` at module scope. Importing the barrel therefore drags an editor
 * singleton chain into anything that touches this component — and that is why this file had no
 * test coverage: the suite failed to RUN, reporting `Tests: 0 total`. Both `TokenResolver` and
 * `StyleTokenRecord` live in self-contained files, and this row needs nothing else.
 */
import { StyleTokenRecord } from '@noodl-models/StyleTokensModel/TokenCategories';
import { TokenResolver } from '@noodl-models/StyleTokensModel/TokenResolver';

import css from './TokenCategorySection.module.scss';

interface TokenCategorySectionProps {
  tokens: StyleTokenRecord[];
  onTokenChange: (name: string, value: string) => void;
  onTokenReset: (name: string) => void;
}

export function TokenCategorySection({ tokens, onTokenChange, onTokenReset }: TokenCategorySectionProps) {
  return (
    <div className={css.TokenList}>
      {tokens.map((token) => (
        <TokenRow key={token.name} token={token} onTokenChange={onTokenChange} onTokenReset={onTokenReset} />
      ))}
    </div>
  );
}

interface TokenRowProps {
  token: StyleTokenRecord;
  onTokenChange: (name: string, value: string) => void;
  onTokenReset: (name: string) => void;
}

/**
 * One token, and — since FIX-015 slice 1 — an editable one.
 *
 * 🔴 **`onTokenChange` used to be accepted and thrown away.** The parameter was destructured to
 * `_onTokenChange` behind an eslint-disable, with a comment deferring the work to "Phase 3:
 * TokenPicker". The write path was never the missing piece: `DesignTokensTab` already passes
 * `styleTokensModel.setToken(name, value, { undo: true })`, a real, undoable write — it arrived
 * here and stopped. That is gap A of FIX-015 ("no human editing surface at all"), and it was one
 * component deep, not a phase away.
 *
 * ⚠️ **And it is NOT TokenPicker, which is what slice 1 assumed.** `TokenPicker` chooses *which
 * token a property references* — its callback is `onTokenSelect(cssVar)`, "the full CSS
 * `var(--token-name)` string, ready to use as a style value". It cannot change a token's own
 * value, which is the whole of what this panel is for. Editing `--primary` from `#3b82f6` to
 * `#ff0000` needs a value input, so that is what this is.
 */
function TokenRow({ token, onTokenChange, onTokenReset }: TokenRowProps) {
  const isColor = token.category === 'color-semantic' || token.category === 'color-palette';
  const isRef = TokenResolver.isReference(token.value);

  /**
   * Edited locally, committed on blur or Enter.
   *
   * 🔴 **Not committed per keystroke.** `setToken` writes through to the project with `undo: true`,
   * so a keystroke-per-write would put one undo entry on the stack for every character and
   * re-render every subscriber mid-word. The same reason `PropertyPanelNumberInput` commits on
   * blur.
   */
  const [draft, setDraft] = useState(token.value);

  // A token changed from elsewhere — a reset, an undo, an AI edit — must show here. Keyed on the
  // token's own value so an external write wins over a stale draft.
  useEffect(() => setDraft(token.value), [token.value]);

  function commit() {
    const next = draft.trim();
    // ⚠️ An empty value is not an edit, it is a half-typed one. Reverting the draft rather than
    // writing `''` keeps the token at its last good value — clearing is what the reset button is
    // for, and it restores the DEFAULT rather than leaving the token undefined.
    if (next === '' || next === token.value) {
      setDraft(token.value);
      return;
    }
    onTokenChange(token.name, next);
  }

  return (
    <div className={`${css.TokenRow} ${token.isCustom ? css.isOverridden : ''}`}>
      {/* Preview swatch for colors */}
      {isColor && (
        <div
          className={css.ColorSwatch}
          style={{ backgroundColor: isRef ? `var(${token.name})` : token.value }}
          title={token.value}
        />
      )}

      {/* Non-color preview (spacing bar, font weight number, etc.) */}
      {!isColor && <TokenPreview token={token} />}

      {/* Token name + value */}
      <div className={css.TokenInfo}>
        <span className={css.TokenName} title={token.description}>
          {token.name}
        </span>
        <input
          className={css.TokenValue}
          value={draft}
          spellCheck={false}
          aria-label={`Value for ${token.name}`}
          title={isRef ? `References ${token.value}` : token.value}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              setDraft(token.value);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      </div>

      {/* Override indicator + reset */}
      {token.isCustom && (
        <button className={css.ResetButton} onClick={() => onTokenReset(token.name)} title="Reset to default">
          ↺
        </button>
      )}
    </div>
  );
}

function TokenPreview({ token }: { token: StyleTokenRecord }) {
  const cat = token.category;

  if (cat === 'spacing') {
    // Render a bar whose width reflects the spacing value
    const px = parseInt(token.value, 10);
    const clampedWidth = Math.min(Math.max(px / 2, 1), 48);
    return (
      <div className={css.SpacingPreview}>
        <div className={css.SpacingBar} style={{ width: `${clampedWidth}px` }} />
      </div>
    );
  }

  if (cat === 'border-radius') {
    return <div className={css.RadiusPreview} style={{ borderRadius: token.value }} title={token.value} />;
  }

  if (cat === 'gradient') {
    // VIB-002. The swatch is the only readable preview a gradient has: its value
    // is a whole `linear-gradient(...)` referencing other tokens, so the text
    // column beside it shows a declaration nobody can picture.
    return <div className={css.ShadowPreview} style={{ backgroundImage: token.value }} title={token.value} />;
  }

  if (cat === 'shadow') {
    return (
      <div
        className={css.ShadowPreview}
        style={{ boxShadow: token.value === 'none' ? 'none' : token.value }}
        title={token.value}
      />
    );
  }

  if (cat === 'typography-size') {
    return (
      <span className={css.FontSizePreview} style={{ fontSize: token.value }}>
        Aa
      </span>
    );
  }

  // Fallback: dot
  return <div className={css.DotPreview} />;
}
