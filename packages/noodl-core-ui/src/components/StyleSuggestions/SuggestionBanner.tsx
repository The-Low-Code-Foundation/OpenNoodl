/**
 * STYLE-005: SuggestionBanner
 *
 * Non-intrusive inline banner shown in the property panel when a style
 * suggestion is available. Intentionally minimal — no emojis, no clutter.
 */

import React from 'react';

import css from './SuggestionBanner.module.scss';

export interface SuggestionBannerSuggestion {
  id: string;
  message: string;
  acceptLabel: string;
}

export interface SuggestionBannerProps {
  suggestion: SuggestionBannerSuggestion;
  /** Called when the user clicks the primary action button. */
  onAccept: () => void;
  /** Called when the user clicks Ignore (dismisses for the current session). */
  onDismiss: () => void;
  /** Called when the user clicks the × (persists dismiss forever for this type). */
  onNeverShow: () => void;
}

/**
 * Renders a single style suggestion as a compact banner.
 *
 * @example
 * <SuggestionBanner
 *   suggestion={activeSuggestion}
 *   onAccept={handleAccept}
 *   onDismiss={handleDismiss}
 *   onNeverShow={handleNeverShow}
 * />
 */
export function SuggestionBanner({ suggestion, onAccept, onDismiss, onNeverShow }: SuggestionBannerProps) {
  return (
    <div className={css.Banner} role="region" aria-label="Style suggestion">
      <div className={css.Indicator} aria-hidden="true" />

      <div className={css.Body}>
        <p className={css.Message}>{suggestion.message}</p>

        <div className={css.Actions}>
          <button type="button" className={css.AcceptButton} onClick={onAccept}>
            {suggestion.acceptLabel}
          </button>

          <button type="button" className={css.DismissButton} onClick={onDismiss}>
            Ignore
          </button>
        </div>
      </div>

      <button
        type="button"
        className={css.CloseButton}
        onClick={onNeverShow}
        aria-label="Never show this suggestion type"
        title="Don't suggest this again"
      >
        ×
      </button>
    </div>
  );
}
