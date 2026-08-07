/**
 * STYLE-004: ElementStyleSection
 *
 * Property panel section that surfaces the ElementConfig variant and size system.
 * Rendered at the top of the property panel for any node that has an ElementConfig
 * registered (Button, Text, Group, TextInput, Checkbox).
 *
 * The component is intentionally dumb — it receives callbacks for variant and size
 * changes so that the legacy propertyeditor.ts can manage undo grouping via
 * UndoActionGroup + UndoQueue without this component needing to import them.
 */

import React from 'react';

import { VariantSelector } from '../../inputs/VariantSelector';
import { SizePicker } from '../SizePicker';
import css from './ElementStyleSection.module.scss';

export interface ElementStyleSectionProps {
  /** Available variant names from the ElementConfig (e.g. ['primary', 'secondary', 'outline']). */
  variants: string[];

  /** Currently active variant name (from node.parameters._variant). */
  currentVariant: string | undefined;

  /** Called when the user selects a different variant. Parent handles undo. */
  onVariantChange: (variantName: string) => void;

  /**
   * Available size names from the ElementConfig sizes map (e.g. ['sm', 'md', 'lg', 'xl']).
   * Pass an empty array or omit to hide the size picker.
   */
  sizes?: string[];

  /** Currently active size name (from node.parameters._size). */
  currentSize?: string | undefined;

  /** Called when the user selects a different size. Parent handles undo. */
  onSizeChange?: (sizeName: string) => void;
}

export function ElementStyleSection({
  variants,
  currentVariant,
  onVariantChange,
  sizes = [],
  currentSize,
  onSizeChange
}: ElementStyleSectionProps) {
  const hasSizes = sizes.length > 0 && onSizeChange !== undefined;

  return (
    <div className={css['ElementStyleSection']}>
      <div className={css['ElementStyleSection-header']}>Style</div>

      <div className={css['ElementStyleSection-body']}>
        {variants.length > 0 && (
          <VariantSelector
            variants={variants}
            currentVariant={currentVariant}
            onVariantChange={onVariantChange}
            label="Variant"
          />
        )}

        {hasSizes && <SizePicker sizes={sizes} currentSize={currentSize} onSizeChange={onSizeChange} label="Size" />}
      </div>
    </div>
  );
}
