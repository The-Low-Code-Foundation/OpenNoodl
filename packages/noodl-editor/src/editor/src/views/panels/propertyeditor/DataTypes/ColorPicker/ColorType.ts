import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { ProjectModel } from '@noodl-models/projectmodel';

import { EventDispatcher } from '../../../../../../../shared/utils/EventDispatcher';
import { ColorInput } from '../../components/ColorInput';
import { TypeView } from '../../TypeView';
import { getEditType } from '../../utils';
import ColorPicker from './colorpicker';
import ColorStylePicker from './colorstylepicker';

//Note: this entire property can be re-created by events such as undo
//so the color picker can be left open, but now need a new callback to set
//values on the new property.
let colorPicker;

//The property panel might rerender, and recreate all the PropertyEditors, while the Color Picker is open.
//When this happens, the color picker need new callbacks to update the new view instance — this is called
//whenever a ColorType is re-rendered while the color picker is active.
function bindColorPickerToView(view) {
  const initialColor = view.getCurrentValue();

  colorPicker.setColor(ProjectModel.instance.resolveColor(initialColor.value));
  colorPicker.setColorChangedListener((color, commit) => {
    //commit is true when the value should be added to the undo queue
    view.parent.setParameterEx(view.name, color, initialColor.value, !commit);
    view.updateCurrentValue();
  });

  colorPicker._propertyName = view.name;
}

export class ColorType extends TypeView {
  propertyName: TSFixme;
  el: TSFixme;
  private root: Root | null = null;
  private stylePickerRoot: Root | null = null;
  private stylePickerProps: TSFixme = {};

  static fromPort(args) {
    const view = new ColorType();

    const p = args.port;
    const parent = args.parent;

    view.port = p;
    view.displayName = p.displayName ? p.displayName : p.name;
    view.name = p.name;
    view.type = getEditType(p);
    view.group = p.group;
    view.value = parent.model.getParameter(p.name);
    view.parent = parent;
    view.isConnected = parent.model.isPortConnected(p.name, 'target');
    view.isDefault = parent.model.parameters[p.name] === undefined;

    return view;
  }

  dispose() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    TypeView.prototype.dispose.call(this);

    EventDispatcher.instance.off(this);

    if (colorPicker) {
      colorPicker.dispose();
      colorPicker = null;
    }
  }

  render() {
    const div = document.createElement('div');
    div.style.width = '100%';

    if (!this.root) {
      this.root = createRoot(div);
    }

    EventDispatcher.instance.on(
      'Model.stylesChanged',
      (event) => {
        if (event.args.type === 'colors') {
          this.updateCurrentValue();
        }
      },
      this
    );

    if (colorPicker && colorPicker._propertyName === this.name) {
      bindColorPickerToView(this);
    }

    this.renderReact();

    this.el = div;
    return this.el;
  }

  private displayString(value: TSFixme): string {
    let stringColor = value;

    if (stringColor && stringColor[0] === '#') {
      //only display the RGB part of a color in the input field
      //so if the color has a #RRGGBBAA format, strip away the alpha
      const hasAlpha = stringColor.length === 9;
      stringColor = hasAlpha ? stringColor.slice(0, 7) : stringColor;
      stringColor = stringColor.toUpperCase();
    }

    return stringColor ?? '';
  }

  renderReact() {
    if (!this.root) return;

    const current = this.getCurrentValue();

    this.root.render(
      React.createElement(ColorInput, {
        label: this.displayName,
        value: this.displayString(current.value),
        resolvedColor: ProjectModel.instance.resolveColor(current.value),
        isChanged: !this.isDefault,
        isConnected: this.isConnected,
        dataIdentifier: this.name,
        onCommit: (text: string) => {
          let value: TSFixme = text.trim();
          if (value === '') value = undefined;

          const isHex = value !== undefined && /[0-9A-F]{6}$/i.test(value);
          if (isHex === true && value[0] !== '#') {
            value = '#' + value;
          }

          this.parent.setParameter(this.name, value);
          this.updateCurrentValue();
        },
        onOpenColorPicker: (anchor: HTMLElement) => this.openColorPicker(anchor),
        onOpenStylePicker: (anchor: HTMLElement) => this.openStylePicker(anchor),
        onFilter: (text: string) => {
          if (!this.stylePickerRoot) return;
          this.stylePickerProps.filter = text;
          this.stylePickerRoot.render(React.createElement(ColorStylePicker, this.stylePickerProps));
        },
        onEnter: () => {
          if (this.stylePickerRoot) this.parent.hidePopout();
        },
        onReset: () => {
          this.parent.model.setParameter(this.name, undefined, {
            undo: true,
            label: 'reset parameter'
          });
          this.isDefault = true;
          this.updateCurrentValue();
        }
      })
    );
  }

  private openColorPicker(anchor: HTMLElement) {
    this.propertyName = this.name;

    if (!colorPicker) {
      colorPicker = new ColorPicker();
      colorPicker.render();
    }

    bindColorPickerToView(this);

    this.parent.showPopout({
      content: colorPicker,
      attachTo: anchor,
      position: 'right',
      onClose: () => {
        colorPicker && colorPicker.dispose();
        colorPicker = null;
      }
    });
  }

  private openStylePicker(anchor: HTMLElement) {
    const props = this.stylePickerProps;
    delete props.filter; //delete filter in case the user opens/closes multiple times

    props.onItemSelected = (name: string) => {
      this.parent.setParameter(this.name, name);
      this.updateCurrentValue();
      this.parent.hidePopout();
    };
    props.inputValue = this.getCurrentValue().value;

    const div = document.createElement('div');
    this.stylePickerRoot = createRoot(div);
    this.stylePickerRoot.render(React.createElement(ColorStylePicker, props));

    this.parent.showPopout({
      content: { el: div },
      attachTo: this.el,
      position: 'right',
      onClose: () => {
        if (this.stylePickerRoot) {
          this.stylePickerRoot.unmount();
          this.stylePickerRoot = null;
        }
      }
    });
  }

  updateCurrentValue() {
    this.isDefault = this.getCurrentValue().isDefault;
    this.renderReact();
  }

  resetToDefault() {
    this.updateCurrentValue();
  }
}
