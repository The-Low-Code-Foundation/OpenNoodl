/**
 * STYLE-002: VariantSelector
 *
 * Dropdown component for selecting a node style variant.
 * Displays the current variant name and opens a list of available variants.
 *
 * Usage:
 *   <VariantSelector
 *     variants={['primary', 'secondary', 'outline', 'ghost']}
 *     currentVariant="primary"
 *     onVariantChange={(name) => applyVariant(node, nodeType, name)}
 *   />
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import css from './VariantSelector.module.scss';

export interface VariantSelectorProps {
  /** List of available variant names to display. */
  variants: string[];

  /** Currently active variant name. */
  currentVariant: string | undefined;

  /** Called when the user picks a different variant. */
  onVariantChange: (variantName: string) => void;

  /** Disable the selector (read-only). */
  disabled?: boolean;

  /** Optional label shown above the selector. Defaults to 'Variant'. */
  label?: string;
}

/**
 * Format a variant name for display: 'heading-1' → 'Heading 1', 'flex-row' → 'Flex Row'.
 */
function formatVariantLabel(name: string): string {
  return name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function VariantSelector({
  variants,
  currentVariant,
  onVariantChange,
  disabled = false,
  label = 'Variant'
}: VariantSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => {
    if (!disabled) setIsOpen((v) => !v);
  }, [disabled]);

  const handleSelect = useCallback(
    (name: string) => {
      setIsOpen(false);
      if (name !== currentVariant) {
        onVariantChange(name);
      }
    },
    [currentVariant, onVariantChange]
  );

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  return (
    <div className={css['VariantSelector']} ref={containerRef}>
      <span className={css['VariantSelector-label']}>{label}</span>

      <button
        type="button"
        className={css['VariantSelector-trigger']}
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={currentVariant ? formatVariantLabel(currentVariant) : 'No variant'}
      >
        <span className={css['VariantSelector-triggerText']}>
          {currentVariant ? formatVariantLabel(currentVariant) : 'None'}
        </span>
        <span className={css['VariantSelector-chevron']} aria-hidden>
          ▾
        </span>
      </button>

      {isOpen && (
        <div className={css['VariantSelector-dropdown']} role="listbox">
          {variants.map((name) => (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={name === currentVariant}
              className={[
                css['VariantSelector-option'],
                name === currentVariant ? css['VariantSelector-option--active'] : ''
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleSelect(name)}
            >
              <span className={css['VariantSelector-optionLabel']}>{formatVariantLabel(name)}</span>
              {name === currentVariant && (
                <span className={css['VariantSelector-checkmark']} aria-hidden>
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
