import React, { CSSProperties, useMemo, useState, useEffect } from 'react';

import {
  PropertyPanelBaseInput,
  PropertyPanelBaseInputProps
} from '@noodl-core-ui/components/property-panel/PropertyPanelBaseInput';

import { linearMap } from '../../../utils/linearMap';
import css from './PropertyPanelSliderInput.module.scss';

export interface PropertyPanelSliderInputProps extends Omit<PropertyPanelBaseInputProps, 'type'> {
  properties: {
    min: number | string;
    max: number | string;
    step: number | string;
  };
}

export function PropertyPanelSliderInput({
  value,
  onChange,
  isChanged,
  isConnected,
  properties
}: PropertyPanelSliderInputProps) {
  const [numberInputValue, setNumberInputValue] = useState(value);

  useEffect(() => {
    setNumberInputValue(value);
  }, [value]);

  function handleNumberUpdate() {
    let value = numberInputValue;

    if (numberInputValue > properties.max) {
      value = properties.max;
    }

    if (numberInputValue < properties.min) {
      value = properties.min;
    }

    onChange(value);
    setNumberInputValue(value);
  }

  function handleSliderChange(value: string) {
    onChange(value);
    setNumberInputValue(value);
  }

  const thumbPercentage = useMemo(
    () => linearMap(parseInt(value.toString()), Number(properties.min), Number(properties.max), 0, 100),
    [value, properties]
  );

  // PAR-002 (mock `.slider-row`): slider first, numeric readout at the right.
  return (
    <div className={css['Root']}>
      <input
        style={
          {
            '--thumb-percentage': thumbPercentage
          } as CSSProperties
        }
        className={css['Input']}
        type="range"
        value={value}
        onChange={(e) => handleSliderChange(e.target.value)}
        min={properties.min}
        max={properties.max}
        step={properties.step}
      />

      <div className={css['NumberContainer']}>
        <PropertyPanelBaseInput
          type="text"
          isNumeric
          value={numberInputValue}
          onChange={setNumberInputValue}
          onBlur={handleNumberUpdate}
          isConnected={isConnected}
          isChanged={isChanged}
          onKeyDown={(e) => e.key === 'Enter' && handleNumberUpdate()}
        />
      </div>
    </div>
  );
}
