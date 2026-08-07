/**
 * STYLE-001: TokenCategorySection
 *
 * Renders a list of token rows within a category section.
 * Each row shows a color swatch (for colors) or a text preview, the token name,
 * current value, and a reset button if overridden.
 */

import React from 'react';

import { StyleTokenRecord, TokenResolver } from '@noodl-models/StyleTokensModel';

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

// onTokenChange is passed for future inline editing (Phase 3: TokenPicker)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TokenRow({ token, onTokenChange: _onTokenChange, onTokenReset }: TokenRowProps) {
  const isColor = token.category === 'color-semantic' || token.category === 'color-palette';
  const isRef = TokenResolver.isReference(token.value);
  // Resolved display value — show raw value if it's a reference
  const displayValue = isRef ? token.value : token.value;

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
        <span className={css.TokenValue}>{displayValue}</span>
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
