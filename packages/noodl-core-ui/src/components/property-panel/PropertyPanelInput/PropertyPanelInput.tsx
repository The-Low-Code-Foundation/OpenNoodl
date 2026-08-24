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
import { PropertyPanelTextArea } from '@noodl-core-ui/components/property-panel/PropertyPanelTextArea';
import { PropertyPanelTextInput } from '@noodl-core-ui/components/property-panel/PropertyPanelTextInput';
import {
  PropertyPanelTextRadioInput,
  PropertyPanelTextRadioProperties
} from '@noodl-core-ui/components/property-panel/PropertyPanelTextRadioInput';
import { Slot } from '@noodl-core-ui/types/global';

import css from './PropertyPanelInput.module.scss';

export enum PropertyPanelInputType {
  Text = 'text',
  /**
   * A multiline string — POL-011.
   *
   * Here rather than in a view of its own so a multiline property gets the same
   * row as every other string: the reset dot, the binding chip, and the `fx`
   * toggle. `TextAreaType` used to render a bare `PropertyPanelRow`, which is
   * the entire reason the Text node's `text` had no expression support while
   * Button's `label` did.
   */
  TextArea = 'text-area',
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
      case PropertyPanelInputType.TextArea:
        return PropertyPanelTextArea;
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
  // of a dead disabled input.
  //
  // ⚠️ FB-018 NARROWED THIS EXCLUSION FROM "buttons/checkboxes" TO BUTTONS. A
  // connected checkbox was the same trap as the connected Width the task was filed
  // about, and arguably a worse one: it stayed clickable, so the author could toggle
  // it, watch it move, and have the connection put it back. `Button` stays excluded
  // for a reason that is about the row rather than the styling — it fires a signal
  // and stores no value, so there is no typed value for a connection to override and
  // nothing for the chip's sentence to be true about.
  const showBindingChip = isConnected && !isExpressionMode && inputType !== PropertyPanelInputType.Button;

  // FB-018 AC3. `isChanged` means "differs from the port default", and the dot it
  // draws offers to reset it — but on a connected row the stored parameter is the
  // FALLBACK, not the value, so "changed" chrome advertises a difference the screen
  // is not showing. The parameter itself is deliberately left alone: disconnecting
  // must restore it, so this hides the dot rather than clearing the value.
  const showsChanged = isChanged && !showBindingChip;

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

  // Boolean rows read as the mock's `.toggle-row`: label takes the row,
  // the toggle sits at the right edge.
  const isToggleRow = inputType === PropertyPanelInputType.Checkbox;

  return (
    // ⚠️ `data-property` names the row, not just its input. `data-identifier`
    // is on the input and therefore **disappears in expression mode**, where
    // the input is replaced by an `ExpressionInput` — so anything outside React
    // that wanted "this port's fx toggle" had to guess by position across
    // dozens of identical toggles. Naming the row survives the mode switch.
    <div
      className={classNames(css['Root'], isToggleRow && css['is-toggle-row'])}
      data-property={dataIdentifier}
    >
      <div className={classNames(css['Label'], showsChanged && css['is-changed'])}>
        {label}
        {showsChanged && onReset && <span className={css['ResetDot']} title="Reset to default" onClick={onReset} />}
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

// FB-018. `PropertyPanelRow` moved to a module of its own and is re-exported here so that
// the nine call sites that import it from this path keep working.
//
// 🔴 THE SPLIT IS NOT TIDINESS — IT IS WHAT MAKES THE ROW GRADEABLE. The row is where the
// binding chip now arrives for every property row that is not built out of
// `PropertyPanelInput`, but this file imports the whole input zoo, and one of those pulls
// in `common/Icon`, whose `require.context` ts-jest rejects at type-check time. Importing
// the row therefore failed the SUITE TO RUN — zero assertions, an error naming a file the
// spec never mentioned. In its own module the row's imports are React, classnames, the
// stylesheet and the chip, and `tests-unit/fb-018/bindingChipRows.test.tsx` can render it.
export * from './PropertyPanelRow';
