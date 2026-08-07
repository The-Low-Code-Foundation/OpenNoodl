/**
 * STYLE-001 Phase 3: TokenPicker
 *
 * Reusable dropdown component for selecting a design token to bind to a CSS property.
 * Displays the current token (with colour swatch preview for colour tokens) and opens
 * a searchable, grouped list of all available tokens.
 *
 * This component is fully dumb — it receives tokens as plain data and fires callbacks.
 * Token resolution (var() → actual CSS value) must be done by the caller before passing
 * items in. This keeps noodl-core-ui free of editor-specific model dependencies.
 *
 * Usage:
 *   <TokenPicker
 *     tokens={allTokens.map(t => ({ ...t, resolvedValue: model.resolveToken(t.name) }))}
 *     selectedToken="--primary"
 *     onTokenSelect={(cssVar) => applyValue(cssVar)}
 *     onClear={() => applyValue('')}
 *     filterCategories={['color-semantic', 'color-palette']}
 *     label="Background Color"
 *   />
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import css from './TokenPicker.module.scss';

// ─── Public types (no editor dependencies) ───────────────────────────────────

export interface TokenPickerItem {
  /** CSS custom property name, e.g. '--primary' */
  name: string;
  /** Raw token value — may be a var() reference */
  value: string;
  /** Resolved CSS value for preview rendering, e.g. '#3b82f6'. Pre-resolved by caller. */
  resolvedValue?: string;
  /** Category string matching TokenCategory in the editor, e.g. 'color-semantic' */
  category: string;
  /** Whether this token has been customised from the project defaults */
  isCustom?: boolean;
  /** Optional description shown in the dropdown */
  description?: string;
}

export interface TokenPickerGroup {
  /** Display label for the group header */
  label: string;
  /** Tokens belonging to this group */
  tokens: TokenPickerItem[];
}

export interface TokenPickerProps {
  /** All available tokens to show in the dropdown. */
  tokens: TokenPickerItem[];

  /**
   * Groups to use for displaying tokens in the dropdown.
   * If provided, overrides the auto-grouping from `groupBy`.
   */
  groups?: TokenPickerGroup[];

  /**
   * Derive the display group label from a category string.
   * Defaults to capitalising the category's prefix (e.g. 'color-semantic' → 'Colors').
   */
  groupBy?: (category: string) => string;

  /**
   * Currently selected token name (CSS custom property name, without var() wrapper).
   * Pass null or undefined if no token is currently selected.
   */
  selectedToken: string | null | undefined;

  /**
   * Called when the user picks a token.
   * The argument is the full CSS `var(--token-name)` string, ready to use as a style value.
   */
  onTokenSelect: (cssVar: string) => void;

  /**
   * Called when the user clears the token selection.
   * If not provided, the clear button is hidden.
   */
  onClear?: () => void;

  /** Filter to specific category strings. When empty/undefined, all tokens are shown. */
  filterCategories?: string[];

  /** Label shown above the trigger button. */
  label?: string;

  /** Placeholder text when no token is selected. Defaults to 'Choose token'. */
  placeholder?: string;

  /** Disable the picker. */
  disabled?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Detect whether a value (or category) represents a colour. */
function isColorCategory(category: string): boolean {
  return category.startsWith('color');
}

/** Check whether a resolved CSS value looks like a colour (hex, rgb, hsl, named). */
function looksLikeColor(value: string): boolean {
  const v = value.trim();
  return (
    v.startsWith('#') || v.startsWith('rgb') || v.startsWith('hsl') || /^[a-z]+$/.test(v) // css named colours
  );
}

/**
 * Format a token name for display.
 * '--color-primary' → 'color-primary'
 * '--space-4' → 'space-4'
 */
function formatTokenLabel(name: string): string {
  return name.replace(/^--/, '');
}

/**
 * Derive a group label from a category string.
 * 'color-semantic' → 'Colors'
 * 'typography-size' → 'Typography'
 * 'border-radius' → 'Borders'
 */
function defaultGroupBy(category: string): string {
  const prefix = category.split('-')[0];
  const map: Record<string, string> = {
    color: 'Colors',
    spacing: 'Spacing',
    typography: 'Typography',
    border: 'Borders',
    shadow: 'Effects',
    animation: 'Animation'
  };
  return map[prefix] ?? prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

/** Group a flat token list into labelled groups, preserving insertion order. */
function buildGroups(tokens: TokenPickerItem[], groupBy: (cat: string) => string): TokenPickerGroup[] {
  const map = new Map<string, TokenPickerItem[]>();
  for (const token of tokens) {
    const label = groupBy(token.category);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(token);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, tokens: items }));
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TokenPicker({
  tokens,
  groups: groupsProp,
  groupBy = defaultGroupBy,
  selectedToken,
  onTokenSelect,
  onClear,
  filterCategories,
  label,
  placeholder = 'Choose token',
  disabled = false
}: TokenPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Resolve the currently selected token item
  const selectedItem = useMemo(
    () => (selectedToken ? tokens.find((t) => t.name === selectedToken) ?? null : null),
    [tokens, selectedToken]
  );

  // Filter & group tokens for the dropdown
  const visibleGroups = useMemo<TokenPickerGroup[]>(() => {
    // Start from explicit groups or auto-build them
    const source = groupsProp ?? buildGroups(tokens, groupBy);

    // Apply category filter
    const categorized =
      filterCategories && filterCategories.length > 0
        ? source.map((g) => ({ ...g, tokens: g.tokens.filter((t) => filterCategories.includes(t.category)) }))
        : source;

    // Apply search filter
    const q = search.trim().toLowerCase();
    if (!q) return categorized.filter((g) => g.tokens.length > 0);

    return categorized
      .map((g) => ({
        ...g,
        tokens: g.tokens.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            (t.description ?? '').toLowerCase().includes(q) ||
            (t.resolvedValue ?? t.value).toLowerCase().includes(q)
        )
      }))
      .filter((g) => g.tokens.length > 0);
  }, [tokens, groupsProp, groupBy, filterCategories, search]);

  // ── Event handlers ──────────────────────────────────────────────────────

  const open = useCallback(() => {
    if (!disabled) {
      setIsOpen(true);
      setSearch('');
    }
  }, [disabled]);

  const close = useCallback(() => {
    setIsOpen(false);
    setSearch('');
  }, []);

  const handleSelect = useCallback(
    (item: TokenPickerItem) => {
      close();
      onTokenSelect(`var(${item.name})`);
    },
    [close, onTokenSelect]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      close();
      onClear?.();
    },
    [close, onClear]
  );

  // Focus search on open
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen, close]);

  // Close on Escape, navigate with keyboard
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, close]);

  // ── Trigger swatch ─────────────────────────────────────────────────────
  const triggerSwatch =
    selectedItem && isColorCategory(selectedItem.category) && selectedItem.resolvedValue
      ? selectedItem.resolvedValue
      : null;

  const totalTokenCount = visibleGroups.reduce((n, g) => n + g.tokens.length, 0);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className={css['TokenPicker']} ref={containerRef}>
      {label && <span className={css['TokenPicker-label']}>{label}</span>}

      {/* Trigger */}
      <button
        type="button"
        className={[css['TokenPicker-trigger'], selectedItem ? css['TokenPicker-trigger--hasValue'] : '']
          .filter(Boolean)
          .join(' ')}
        onClick={open}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={selectedItem ? formatTokenLabel(selectedItem.name) : placeholder}
      >
        {triggerSwatch && (
          <span className={css['TokenPicker-swatch']} style={{ background: triggerSwatch }} aria-hidden />
        )}
        <span className={css['TokenPicker-triggerText']}>
          {selectedItem ? formatTokenLabel(selectedItem.name) : placeholder}
        </span>
        {selectedItem && onClear && (
          <button
            type="button"
            className={css['TokenPicker-clearBtn']}
            onClick={handleClear}
            title="Clear token"
            aria-label="Clear token selection"
          >
            ×
          </button>
        )}
        {!selectedItem && (
          <span className={css['TokenPicker-chevron']} aria-hidden>
            ▾
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className={css['TokenPicker-dropdown']} role="listbox">
          {/* Search */}
          <div className={css['TokenPicker-searchRow']}>
            <input
              ref={searchRef}
              type="text"
              className={css['TokenPicker-search']}
              placeholder="Search tokens..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search tokens"
            />
          </div>

          {/* Groups */}
          <div className={css['TokenPicker-list']}>
            {totalTokenCount === 0 && <p className={css['TokenPicker-empty']}>No tokens match</p>}
            {visibleGroups.map((group) => (
              <div key={group.label} className={css['TokenPicker-group']}>
                <span className={css['TokenPicker-groupLabel']}>{group.label}</span>
                {group.tokens.map((item) => {
                  const isSelected = item.name === selectedToken;
                  const swatch =
                    isColorCategory(item.category) && item.resolvedValue && looksLikeColor(item.resolvedValue)
                      ? item.resolvedValue
                      : null;

                  return (
                    <button
                      key={item.name}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={[
                        css['TokenPicker-option'],
                        isSelected ? css['TokenPicker-option--active'] : '',
                        item.isCustom ? css['TokenPicker-option--custom'] : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => handleSelect(item)}
                      title={item.description ?? item.resolvedValue ?? item.value}
                    >
                      {/* Colour swatch or value preview */}
                      <span className={css['TokenPicker-optionPreview']} aria-hidden>
                        {swatch ? (
                          <span className={css['TokenPicker-optionSwatch']} style={{ background: swatch }} />
                        ) : (
                          <span className={css['TokenPicker-optionValueBadge']}>
                            {(item.resolvedValue ?? item.value).slice(0, 4)}
                          </span>
                        )}
                      </span>

                      <span className={css['TokenPicker-optionBody']}>
                        <span className={css['TokenPicker-optionName']}>{formatTokenLabel(item.name)}</span>
                        {item.resolvedValue && (
                          <span className={css['TokenPicker-optionValue']}>{item.resolvedValue}</span>
                        )}
                      </span>

                      {item.isCustom && (
                        <span className={css['TokenPicker-customBadge']} title="Custom token" aria-hidden>
                          ★
                        </span>
                      )}
                      {isSelected && (
                        <span className={css['TokenPicker-checkmark']} aria-hidden>
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
