import iro from '@jaames/iro';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { ColorPickerFields } from '../../components/ColorPickerFields';

type IroColor = TSFixme;

export type ColorChangedListener = (hex: string, commit: boolean) => void;

function colorToHex(color: IroColor) {
  const hex = color.alpha === 1 ? color.hexString : color.hex8String;
  return hex.toUpperCase();
}

/**
 * The colour picker popout: an iro colour wheel plus the hex/opacity fields.
 *
 * The wheel is inherently imperative (iro owns its own canvas), so this stays a
 * small imperative shell that call sites drive with `setColor` /
 * `setColorChangedListener` right after `render()`; only the fields are React.
 */
export class ColorPicker {
  /** Raw element handed to PopupLayer as popout content */
  el: HTMLElement;
  /** Set by ColorType so it can re-bind the open picker to a re-created row */
  _propertyName: string;

  private colorPicker: TSFixme;
  private fieldsRoot: Root;
  private revision = 0;
  private colorChangedListener: ColorChangedListener;

  private onColorChanged = () => this.renderFields();
  private onColorInit = () => this.renderFields();

  private onInputMove = (color: IroColor) => {
    this.colorChangedListener && this.colorChangedListener(colorToHex(color), false);
  };

  private onInputEnd = (color: IroColor) => {
    this.colorChangedListener && this.colorChangedListener(colorToHex(color), true);
  };

  dispose() {
    this.colorChangedListener = undefined;

    this.colorPicker.off('color:change', this.onColorChanged);
    this.colorPicker.off('color:init', this.onColorInit);
    this.colorPicker.off('input:move', this.onInputMove);
    this.colorPicker.off('input:end', this.onInputEnd);

    if (this.fieldsRoot) {
      const root = this.fieldsRoot;
      this.fieldsRoot = undefined;
      // The popout is torn down inside a React commit; defer the unmount
      setTimeout(() => root.unmount(), 0);
    }
  }

  render() {
    this.el = document.createElement('div');
    this.el.className = 'color-picker-popup';

    const pickerDiv = document.createElement('div');
    this.el.appendChild(pickerDiv);

    const fieldsDiv = document.createElement('div');
    this.el.appendChild(fieldsDiv);

    // iro's widget factory works with or without `new`; its types only allow a plain call
    this.colorPicker = iro.ColorPicker(pickerDiv, {
      width: 212,
      margin: 16,
      padding: 0,
      layout: [
        {
          component: iro.ui.Box
        },
        {
          component: iro.ui.Slider,
          options: { sliderType: 'hue' }
        },
        {
          component: iro.ui.Slider,
          options: { sliderType: 'alpha' }
        }
      ]
    });

    //override the css style to remove the default corner radius
    pickerDiv.querySelectorAll<HTMLElement>('.IroBox').forEach((el) => (el.style.borderRadius = '0'));

    this.colorPicker.on('color:change', this.onColorChanged);
    this.colorPicker.on('color:init', this.onColorInit);
    this.colorPicker.on('input:move', this.onInputMove);
    this.colorPicker.on('input:end', this.onInputEnd);

    this.fieldsRoot = createRoot(fieldsDiv);
    this.renderFields();

    return this.el;
  }

  setColorChangedListener(cb: ColorChangedListener) {
    this.colorChangedListener = cb;
  }

  setColor(color: string) {
    this.colorPicker.color.set(color || '#000000');
  }

  private renderFields() {
    if (!this.fieldsRoot) return;

    const color = this.colorPicker.color;

    this.fieldsRoot.render(
      React.createElement(ColorPickerFields, {
        hex: color.hexString.toUpperCase(),
        opacity: color.alpha === 1 ? '' : Math.floor(color.alpha * 100) + '%',
        revision: this.revision++,
        onHexCommit: (value) => this.onHexInputFieldChanged(value),
        onOpacityCommit: (value) => this.onOpacityInputFieldChanged(value)
      })
    );
  }

  private onHexInputFieldChanged(value: string) {
    let color = value.toUpperCase();

    const isValid = /(^#{0,1}[0-9A-F]{6}$)|(^#{0,1}[0-9A-F]{3}$)/i.test(color);

    if (isValid) {
      if (color[0] !== '#') color = '#' + color;

      this.colorPicker.color.set(color);
      this.colorChangedListener && this.colorChangedListener(colorToHex(this.colorPicker.color), true);
    }

    //render again so the fields get the correct format
    this.renderFields();
  }

  private onOpacityInputFieldChanged(value: string) {
    const opacity = value.trim().replace('%', '');

    const isValid = !isNaN(opacity as TSFixme) && !isNaN(parseFloat(opacity));
    if (isValid) {
      this.colorPicker.color.alpha = parseFloat(opacity) / 100;
      this.colorChangedListener && this.colorChangedListener(colorToHex(this.colorPicker.color), true);
    }

    this.renderFields();
  }
}

export default ColorPicker;
