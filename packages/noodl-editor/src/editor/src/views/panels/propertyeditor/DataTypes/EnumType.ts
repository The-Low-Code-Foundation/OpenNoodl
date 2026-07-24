import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { find } from 'underscore';

import { PropertyPanelInput, PropertyPanelInputType } from '@noodl-core-ui/components/property-panel/PropertyPanelInput';

import { TypeView } from '../TypeView';
import { getEditType } from '../utils';

export class EnumType extends TypeView {
  el: TSFixme;
  private root: Root | null = null;

  static fromPort(args) {
    const view = new EnumType();

    const p = args.port;
    const parent = args.parent;

    view.port = p;
    view.displayName = p.displayName ? p.displayName : p.name;
    view.name = p.name;
    view.type = getEditType(p);
    view.group = p.group;
    view.tooltip = p.tooltip;
    view.value = parent.model.getParameter(p.name);
    view.parent = parent;
    view.isConnected = parent.model.isPortConnected(p.name, 'target');
    view.isDefault = parent.model.parameters[p.name] === undefined;

    return view;
  }

  labelForValue(value) {
    if (value === undefined) return '';

    const e = find(this.type.enums, function (e) {
      return e === value || e.value === value;
    });
    if (e === undefined) return;

    return e.label ? e.label : e;
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

  renderReact() {
    if (!this.root) return;

    const options = (this.type.enums || []).map((e) => ({
      label: typeof e === 'object' ? e.label : e,
      value: typeof e === 'object' ? e.value : e
    }));

    const props = {
      label: this.displayName,
      value: this.parent.model.getParameter(this.name),
      inputType: PropertyPanelInputType.Select,
      properties: { options },
      isChanged: !this.isDefault,
      isConnected: this.isConnected,
      supportsExpression: false,
      onChange: (value: string | number) => {
        this.parent.setParameter(this.name, value);

        const current = this.getCurrentValue();
        this.isDefault = current.isDefault;
        this.renderReact();
      },
      onReset: () => {
        this.parent.model.setParameter(this.name, undefined, {
          undo: true,
          label: 'reset parameter'
        });
        this.isDefault = true;
        this.renderReact();
      }
    };

    this.root.render(React.createElement(PropertyPanelInput, props));
  }

  resetToDefault() {
    this.renderReact();
  }

  dispose() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    super.dispose();
  }
}
