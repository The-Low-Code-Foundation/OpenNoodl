import classNames from 'classnames';
import React, { useMemo } from 'react';

import { BindingChip } from '@noodl-core-ui/components/property-panel/BindingChip';
import { ExpressionInput } from '@noodl-core-ui/components/property-panel/ExpressionInput';
import { ExpressionToggle } from '@noodl-core-ui/components/property-panel/ExpressionToggle';
import { PropertyPanelBaseInputProps } from '@noodl-core-ui/components/property-panel/PropertyPanelBaseInput';
import {
  PropertyPanelButton,
  PropertyPanelButtonProps
} from '@noodl-core-ui/components/property-panel/PropertyPanelButton';
import { PropertyPanelCheckbox } from '@noodl-core-ui/components/property-panel/PropertyPanelCheckbox';
import {
  PropertyPanelIconRadioInput,
  PropertyPanelIconRadioProperties
} from '@noodl-core-ui/components/property-panel/PropertyPanelIconRadioInput';
import { PropertyPanelLengthUnitInput } from '@noodl-core-ui/components/property-panel/PropertyPanelLengthUnitInput';
import { PropertyPanelNumberInput } from '@noodl-core-ui/components/property-panel/PropertyPanelNumberInput';
import {
  PropertyPanelSelectInput,
  PropertyPanelSelectProperties
} from '@noodl-core-ui/components/property-panel/PropertyPanelSelectInput';
import {
  PropertyPanelSliderInput,
  PropertyPanelSliderInputProps
} from '@noodl-core-ui/components/property-panel/PropertyPanelSliderInput';
import { PropertyPanelTextInput } from '@noodl-core-ui/components/property-panel/PropertyPanelTextInput';
import {
  PropertyPanelTextRadioInput,
  PropertyPanelTextRadioProperties
} from '@noodl-core-ui/components/property-panel/PropertyPanelTextRadioInput';
import { Slot } from '@noodl-core-ui/types/global';

import css from './PropertyPanelInput.module.scss';

export enum PropertyPanelInputType {
  Text = 'text',
  Number = 'number',
  LengthUnit = 'length-unit',
  Slider = 'slider',
  Select = 'select',
  Color = 'color',
  TextRadio = 'text-radio',
  IconRadio = 'icon-radio',
  Checkbox = 'checkbox',
  Button = 'button'

  // MarginPadding = 'margin-padding',
  // SizeMode = 'size-mode',
}

export type PropertyPanelProps =
  | undefined
  | PropertyPanelIconRadioProperties
  | PropertyPanelButtonProps['properties']
  | PropertyPanelSliderInputProps['properties']
  | PropertyPanelSelectProperties
  | PropertyPanelTextRadioProperties;

export interface PropertyPanelInputProps extends Omit<PropertyPanelBaseInputProps, 'type'> {
  label: string;
  inputType: PropertyPanelInputType;
  properties: PropertyPanelProps;

  // Expression support
  /** Whether this input type supports expression mode (default: true for most types) */
  supportsExpression?: boolean;
  /** Current mode: 'fixed' for static values, 'expression' for dynamic expressions */
  expressionMode?: 'fixed' | 'expression';
  /** The expression string (when in expression mode) */
  expression?: string;
  /** Callback when expression mode changes */
  onExpressionModeChange?: (mode: 'fixed' | 'expression') => void;
  /** Callback when expression text changes */
  onExpressionChange?: (expression: string) => void;
  /** Whether the expression has an error */
  expressionError?: string;
  /** Callback when expand button is clicked (opens expression in full editor) */
  onExpressionExpand?: () => void;

  /** When set and the value is changed from its default, a dot is shown that resets the value on click */
  onReset?: () => void;

  /**
   * Label for the connection source (e.g. "CallCF · Result"). When `isConnected`
   * is true, the dead input is replaced by an accent-soft binding chip naming this.
   */
  connectionLabel?: string;
  /** Optional click-to-navigate handler on the binding chip. */
  onConnectionClick?: () => void;
}

export function PropertyPanelInput({
  label,
  value,
  inputType = PropertyPanelInputType.Text,
  properties,
  isChanged,
  isConnected,
  onChange,
  // Expression props
  supportsExpression = true,
  expressionMode = 'fixed',
  expression = '',
  onExpressionModeChange,
  onExpressionChange,
  expressionError,
  onExpressionExpand,
  onReset,
  connectionLabel,
  onConnectionClick,
  dataIdentifier
}: PropertyPanelInputProps) {
  const Input = useMemo(() => {
    switch (inputType) {
      case PropertyPanelInputType.Text:
        return PropertyPanelTextInput;
      case PropertyPanelInputType.Number:
        return PropertyPanelNumberInput;
      case PropertyPanelInputType.LengthUnit:
        return PropertyPanelLengthUnitInput;
      case PropertyPanelInputType.Select:
        return PropertyPanelSelectInput;
      case PropertyPanelInputType.Slider:
        return PropertyPanelSliderInput;
      case PropertyPanelInputType.TextRadio:
        return PropertyPanelTextRadioInput;
      case PropertyPanelInputType.IconRadio:
        return PropertyPanelIconRadioInput;
      case PropertyPanelInputType.Checkbox:
        return PropertyPanelCheckbox;
      case PropertyPanelInputType.Button:
        return PropertyPanelButton;
    }
  }, [inputType]);

  // Determine if we should show expression UI
  const showExpressionToggle = supportsExpression && !isConnected;
  const isExpressionMode = expressionMode === 'expression';

  // Handle toggle between fixed and expression modes
  const handleToggleMode = () => {
    if (onExpressionModeChange) {
      const newMode = isExpressionMode ? 'fixed' : 'expression';
      onExpressionModeChange(newMode);
    }
  };

  // A connection-driven property shows a binding chip naming the source instead
  // of a dead disabled input (buttons/checkboxes keep their own affordance).
  const showBindingChip =
    isConnected &&
    !isExpressionMode &&
    inputType !== PropertyPanelInputType.Button &&
    inputType !== PropertyPanelInputType.Checkbox;

  // Render the appropriate input based on mode
  const renderInput = () => {
    if (showBindingChip) {
      return <BindingChip source={connectionLabel} onClick={onConnectionClick} />;
    }

    if (isExpressionMode && onExpressionChange) {
      return (
        <ExpressionInput
          expression={expression}
          onChange={onExpressionChange}
          hasError={!!expressionError}
          errorMessage={expressionError}
          onExpand={onExpressionExpand}
          UNSAFE_style={{ flex: 1 }}
        />
      );
    }

    // Standard input rendering
    return (
      // FIXME: fix below ts-ignore with better typing
      // this is caused by PropertyPanelBaseInputProps having a generic for "value"
      // i want to pass a boolan to the checkbox value that will be used in checked for a better API
      <Input
        // @ts-expect-error
        value={value}
        // @ts-expect-error
        onChange={onChange}
        // @ts-expect-error
        isChanged={isChanged}
        // @ts-expect-error
        isConnected={isConnected}
        // @ts-expect-error
        properties={properties}
        // @ts-expect-error
        dataIdentifier={dataIdentifier}
      />
    );
  };

  return (
    <div className={css['Root']}>
      <div className={classNames(css['Label'], isChanged && css['is-changed'])}>
        {label}
        {isChanged && onReset && <span className={css['ResetDot']} title="Reset to default" onClick={onReset} />}
      </div>
      <div className={css['InputContainer']}>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', minWidth: 0 }}>
          {renderInput()}
          {showExpressionToggle && (
            <ExpressionToggle mode={expressionMode} isConnected={isConnected} onToggle={handleToggleMode} />
          )}
        </div>
      </div>
    </div>
  );
}

export interface PropertyPanelRowProps {
  isChanged?: boolean;
  label: string;
  children: Slot;
  /** When set and the value is changed from its default, a dot is shown that resets the value on click */
  onReset?: () => void;
}

export function PropertyPanelRow({ isChanged, label, children, onReset }: PropertyPanelRowProps) {
  return (
    <div className={css['Root']}>
      <div className={classNames(css['Label'], isChanged && css['is-changed'])}>
        {label}
        {isChanged && onReset && <span className={css['ResetDot']} title="Reset to default" onClick={onReset} />}
      </div>
      <div className={css['InputContainer']}>{children}</div>
    </div>
  );
}
