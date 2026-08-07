import classNames from 'classnames';
import React, { useRef, useState } from 'react';

import { BaseDialog, DialogBackground, BaseDialogVariant } from '@noodl-core-ui/components/layout/BaseDialog';
import {
  PropertyPanelBaseInput,
  PropertyPanelBaseInputProps
} from '@noodl-core-ui/components/property-panel/PropertyPanelBaseInput';

import { ReactComponent as CaretIcon } from '../../../assets/icons/caret-down.svg';
import css from './PropertyPanelSelectInput.module.scss';

export interface PropertyPanelSelectProperties {
  options: {
    label: string;
    value: string | number;
    isDisabled?: boolean;
  }[];
}

export interface PropertyPanelSelectInputProps extends Omit<PropertyPanelBaseInputProps, 'type' | 'onClick'> {
  onChange?: (value: string | number) => void;
  properties: PropertyPanelSelectProperties;
  hasSmallText?: boolean;
}

export function PropertyPanelSelectInput({
  value,
  properties,

  isFauxFocused,

  onChange,
  onFocus,
  onBlur,

  hasHiddenCaret,

  hasSmallText
}: PropertyPanelSelectInputProps) {
  const [isSelectCollapsed, setIsSelectCollapsed] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  const displayValue = properties?.options.find((option) => option.value === value)?.label;

  return (
    <div className={classNames(css['Root'], !hasHiddenCaret && css['has-caret'])} ref={rootRef}>
      <PropertyPanelBaseInput
        type="text"
        value={displayValue}
        hasHiddenCaret
        onClick={() => {
          setIsSelectCollapsed((prev) => !prev);
        }}
        onBlur={(e) => {
          setTimeout(() => {
            setIsSelectCollapsed(true);
          }, 250);
          if (onBlur) onBlur(e);
        }}
        onFocus={onFocus}
        isFauxFocused={isFauxFocused}
        hasSmallText={hasSmallText}
      />

      {!hasHiddenCaret && (
        <div
          className={classNames(css['Caret'], !isSelectCollapsed && css['is-indicating-close'])}
          onClick={() => {
            setIsSelectCollapsed((prev) => !prev);
          }}
        >
          <CaretIcon />
        </div>
      )}

      <BaseDialog
        isVisible={!isSelectCollapsed}
        triggerRef={rootRef}
        background={DialogBackground.Transparent}
        variant={BaseDialogVariant.Select}
      >
        <ul className={css['Options']}>
          {/* FH-014. This list used to `return null` for the option matching the
              current value, so every select hid its own current value — and a
              single-option select (21 unit-bearing ports declare only ['px'])
              opened as an empty ~40x6px bordered sliver. The selected option now
              renders, marked. */}
          {properties?.options?.map((option) => {
            const isSelected = option.value === value;

            return (
              <li
                key={option.value}
                className={classNames(
                  css['Option'],
                  option.isDisabled && css['is-disabled'],
                  isSelected && css['is-selected'],
                  hasSmallText && css['has-small-text']
                )}
                aria-selected={isSelected}
                onClick={() => {
                  setIsSelectCollapsed(true);

                  if (option.isDisabled) return null;
                  // Re-picking the current value is a no-op, not a change: firing
                  // onChange here would write the same parameter again and push a
                  // pointless undo entry.
                  if (isSelected) return null;

                  onChange && onChange(option.value);
                }}
              >
                {option.label}
              </li>
            );
          })}
        </ul>
      </BaseDialog>
    </div>
  );
}
