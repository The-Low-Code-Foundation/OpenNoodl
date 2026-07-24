import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { IconInput, IconValue } from '../components/IconInput';
import IconPicker from '../iconpicker';
import { TypeView } from '../TypeView';
import { getEditType } from '../utils';

export class IconType extends TypeView {
  el: TSFixme;
  private root: Root | null = null;
  private pickerRoot: Root | null = null;

  static fromPort(args) {
    const view = new IconType();

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

    // Make sure all icon set styles and fonts are loaded so the thumbnail can render
    IconPicker.LoadIconSets(() => {});

    this.renderReact();

    this.el = div;
    return this.el;
  }

  private renderReact() {
    if (!this.root) return;

    this.root.render(
      React.createElement(IconInput, {
        label: this.displayName,
        value: this.value as IconValue | undefined,
        isChanged: !this.isDefault,
        dataIdentifier: this.name,
        onOpenPicker: (anchor: HTMLElement) => this.openPicker(anchor),
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

  private openPicker(anchor: HTMLElement) {
    const div = document.createElement('div');
    this.pickerRoot = createRoot(div);

    this.pickerRoot.render(
      React.createElement(IconPicker, {
        value: this.value,
        onIconSelected: (icon: IconValue) => {
          this.value = { class: icon.class, code: icon.code, codeAsClass: icon.codeAsClass };
          this.parent.setParameter(this.name, this.value);
          this.isDefault = false;
          this.renderReact();
          this.parent.hidePopout();
        }
      })
    );

    this.parent.showPopout({
      content: { el: div },
      attachTo: anchor,
      position: 'right',
      onClose: () => {
        if (this.pickerRoot) {
          this.pickerRoot.unmount();
          this.pickerRoot = null;
        }
      }
    });
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
