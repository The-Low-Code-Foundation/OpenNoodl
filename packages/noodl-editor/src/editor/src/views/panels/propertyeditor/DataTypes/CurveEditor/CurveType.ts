import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { PropertyPanelButton } from '@noodl-core-ui/components/property-panel/PropertyPanelButton';
import { PropertyPanelRow } from '@noodl-core-ui/components/property-panel/PropertyPanelInput';

import { TypeView } from '../../TypeView';
import { getEditType } from '../../utils';

export class CurveType extends TypeView {
  propertyName: TSFixme;
  el: TSFixme;
  private root: Root | null = null;

  static fromPort(args: TSFixme) {
    const view = new CurveType();

    const p = args.port;
    const parent = args.parent;

    view.port = p;
    view.displayName = p.displayName ? p.displayName : p.name;
    view.name = p.name;
    view.type = getEditType(p);
    view.default = p.default;
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

    this.root.render(
      React.createElement(PropertyPanelRow, {
        label: this.displayName,
        isChanged: !this.isDefault,
        children: React.createElement(PropertyPanelButton, {
          properties: {
            buttonLabel: 'Edit',
            dataIdentifier: this.name,
            onClick: () => this.openCurveEditor()
          }
        }),
        onReset: () => {
          this.parent.model.setParameter(this.name, undefined, {
            undo: true,
            label: 'reset parameter'
          });
          this.value = undefined;
          this.isDefault = true;
          this.renderReact();
        }
      })
    );
  }

  private openCurveEditor() {
    this.propertyName = this.name;

    this.parent.hidePopout();

    const props = {
      value: this.value,
      default: this.default || { curve: [0.0, 0.0, 0.58, 1.0], dur: 300, delay: 0 },
      onUpdate: (curve, drag) => {
        const undoArgs = { undo: true, label: 'curve changed', oldValue: this.value };
        if (!drag) this.value = curve;
        this.parent.model.setParameter(this.name, curve, drag ? undefined : undoArgs);
        this.isDefault = false;
      }
    };
    const div = document.createElement('div');
    const root = createRoot(div);
    root.render(React.createElement(require('./curveeditor.jsx'), props));

    this.parent.showPopout({
      content: { el: $(div) },
      attachTo: $(this.el),
      position: 'right'
    });
  }

  resetToDefault() {
    this.value = undefined;
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
