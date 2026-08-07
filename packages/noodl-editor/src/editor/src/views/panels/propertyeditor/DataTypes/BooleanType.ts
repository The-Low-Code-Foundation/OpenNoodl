import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { PropertyPanelInput, PropertyPanelInputType } from '@noodl-core-ui/components/property-panel/PropertyPanelInput';

import { TypeView } from '../TypeView';
import { getEditType } from '../utils';

export class BooleanType extends TypeView {
  el: TSFixme;
  private root: Root | null = null;

  static fromPort(args) {
    const view = new BooleanType();

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

  render() {
    const div = document.createElement('div');
    div.style.width = '100%';

    if (!this.root) {
      this.root = createRoot(div);
    }

    this.el = div;
    this.renderReact();

    super.render();

    return this.el;
  }

  protected renderReact() {
    if (!this.root) return;

    this.root.render(
      React.createElement(PropertyPanelInput, {
        label: this.displayName,
        // PropertyPanelInput's value is typed for text inputs; the checkbox variant takes a boolean
        value: Boolean(this.value) as TSFixme,
        inputType: PropertyPanelInputType.Checkbox,
        properties: undefined,
        dataIdentifier: this.name,
        isChanged: !this.isDefault,
        isConnected: this.isConnected,
        supportsExpression: false,
        onChange: (value: TSFixme) => {
          this.value = Boolean(value);
          this.parent.setParameter(this.name, this.value);
          this.isDefault = this.getCurrentValue().isDefault;
          this.renderReact();
        },
        onReset: () => {
          this.parent.model.setParameter(this.name, undefined, {
            undo: true,
            label: 'reset parameter'
          });
          this.isDefault = true;
          this.resetToDefault();
        }
      })
    );
  }

  resetToDefault() {
    this.value = this.getCurrentValue().value;
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
