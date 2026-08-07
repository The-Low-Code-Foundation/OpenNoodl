import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { SizeModeInput } from '../components/SizeModeInput';
import { TypeView } from '../TypeView';
import { getEditType } from '../utils';

export class SizeModeType extends TypeView {
  el: TSFixme;
  private root: Root | null = null;

  static fromPort(args) {
    const view = new SizeModeType();

    const p = args.port;
    const parent = args.parent;

    view.port = p;
    view.displayName = p.displayName ? p.displayName : p.name;
    view.name = p.name;
    view.type = getEditType(p);
    view.tooltip = p.tooltip || {};
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
      React.createElement(SizeModeInput, {
        value: this.value,
        isDefault: this.isDefault,
        tooltips: this.tooltip || {},
        onChange: (value: string) => {
          this.parent.setParameter(this.name, value);
          this.value = value;
          this.isDefault = false;
          this.renderReact();
        },
        onReset: () => {
          this.parent.model.setParameter(this.name, undefined, {
            undo: true,
            label: 'reset parameter'
          });
          this.value = this.parent.model.getParameter(this.name);
          this.isDefault = true;
          this.renderReact();
        }
      })
    );
  }

  resetToDefault() {
    this.value = this.parent.model.getParameter(this.name);
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
