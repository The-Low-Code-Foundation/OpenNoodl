import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { PropertyPanelRow } from '@noodl-core-ui/components/property-panel/PropertyPanelInput';
import { PropertyPanelTextArea } from '@noodl-core-ui/components/property-panel/PropertyPanelTextArea';

import { TypeView } from '../TypeView';
import { getEditType } from '../utils';

export class TextAreaType extends TypeView {
  el: TSFixme;
  private root: Root | null = null;

  static fromPort(args) {
    const view = new TextAreaType();

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

    const current = this.getCurrentValue();

    const textArea = React.createElement(PropertyPanelTextArea, {
      value: current.value ?? '',
      isChanged: !this.isDefault,
      isConnected: this.isConnected,
      dataIdentifier: this.name,
      onChange: (value: string) => {
        // The legacy view committed on the browser change event, which only
        // fires when the content actually changed — keep that to avoid
        // spurious undo entries on every blur.
        if (value === (this.getCurrentValue().value ?? '')) return;

        this.parent.setParameter(this.name, value);
        this.isDefault = this.getCurrentValue().isDefault;
        this.renderReact();
      }
    });

    const props = {
      label: this.displayName,
      isChanged: !this.isDefault,
      children: textArea,
      onReset: () => {
        this.parent.model.setParameter(this.name, undefined, {
          undo: true,
          label: 'reset parameter'
        });
        this.isDefault = true;
        this.renderReact();
      }
    };

    this.root.render(React.createElement(PropertyPanelRow, props));
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
