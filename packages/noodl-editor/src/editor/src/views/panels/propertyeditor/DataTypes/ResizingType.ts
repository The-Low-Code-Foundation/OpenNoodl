import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import {
  computeResizingModes,
  DimValue,
  ResizingInput,
  ResizingPins,
  RESIZING_PIN_KEYS
} from '../components/ResizingInput';
import { TypeView } from '../TypeView';
import { getEditType } from '../utils';

export class ResizingType extends TypeView {
  el: TSFixme;
  private root: Root | null = null;

  private pins: ResizingPins;
  private width: DimValue | undefined;
  private height: DimValue | undefined;
  private defaultWidth: DimValue;
  private defaultHeight: DimValue;
  private widthUnits: string[];
  private heightUnits: string[];

  static fromPort(args) {
    const view = new ResizingType();

    const p = args.port;
    const parent = args.parent;

    view.port = p;
    view.name = p.name;
    view.type = getEditType(p);
    view.group = p.group;
    view.parent = parent;

    const values = parent.model.parameters[p.name] || {};
    const defaults = p.default || p.type.defaults || {};

    view.pins = {} as ResizingPins;
    RESIZING_PIN_KEYS.forEach((key) => {
      view.pins[key] = values[key] === undefined ? !!defaults[key] : values[key];
    });

    view.defaultWidth = defaults.width || { value: 100, unit: '%' };
    view.width = values.width;

    view.defaultHeight = defaults.height || { value: 100, unit: '%' };
    view.height = values.height;

    view.widthUnits = p.type.widthUnits || p.type.units || ['%', 'px'];
    view.heightUnits = p.type.heightUnits || p.type.units || ['%', 'px'];

    return view;
  }

  render() {
    const div = document.createElement('div');
    div.style.width = '100%';

    if (!this.root) {
      this.root = createRoot(div);
    }

    this.renderReact();

    this.el = div;
    return this.el;
  }

  /** Full-object commit, disabled pins stored as false (legacy semantics) */
  private commit() {
    const modes = computeResizingModes(this.pins);

    const value: TSFixme = {};
    RESIZING_PIN_KEYS.forEach((key) => {
      value[key] = modes[key] && this.pins[key];
    });

    value.width = this.width || this.defaultWidth;
    value.height = this.height || this.defaultHeight;

    this.parent.model.setParameter(this.name, value, {
      undo: true,
      label: 'resizing changed'
    });
  }

  private renderReact() {
    if (!this.root) return;

    this.root.render(
      React.createElement(ResizingInput, {
        pins: { ...this.pins },
        width: this.width,
        height: this.height,
        defaultWidth: this.defaultWidth,
        defaultHeight: this.defaultHeight,
        widthUnits: this.widthUnits,
        heightUnits: this.heightUnits,
        onPinToggle: (pin) => {
          this.pins[pin] = !this.pins[pin];
          this.commit();
          this.renderReact();
        },
        onWidthCommit: (value) => {
          this.width = value;
          this.commit();
          this.renderReact();
        },
        onHeightCommit: (value) => {
          this.height = value;
          this.commit();
          this.renderReact();
        }
      })
    );
  }

  dispose() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    super.dispose();
  }
}
