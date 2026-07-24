import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { PickerTextInput } from '../components/PickerTextInput';
import { TypeView } from '../TypeView';

/**
 * Base for the property rows that pair a text input with a picker popout
 * (font, image, identifier, component). Subclasses implement `openPicker`
 * and optionally `filterPicker`.
 */
export abstract class PickerTypeView extends TypeView {
  el: TSFixme;
  protected root: Root | null = null;

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

  protected renderReact() {
    if (!this.root) return;

    const current = this.getCurrentValue();

    this.root.render(
      React.createElement(PickerTextInput, {
        label: this.displayName,
        value: current.value ?? '',
        isChanged: !this.isDefault,
        isConnected: this.isConnected,
        dataIdentifier: this.name,
        onCommit: (value: string) => this.commit(value),
        onOpenPicker: (anchor: HTMLElement) => this.openPicker(anchor),
        onFilter: (text: string) => this.filterPicker(text),
        onEnter: () => this.onEnterPressed(),
        onReset: () => {
          this.parent.model.setParameter(this.name, undefined, {
            undo: true,
            label: 'reset parameter'
          });
          this.isDefault = true;
          this.renderReact();
        }
      })
    );
  }

  /** The legacy rows commit '' as undefined */
  protected commit(value: string) {
    this.parent.setParameter(this.name, value === '' ? undefined : value);
    this.isDefault = this.getCurrentValue().isDefault;
    this.renderReact();
  }

  protected abstract openPicker(anchor: HTMLElement): void;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected filterPicker(text: string): void {
    // Overridden by subclasses whose picker supports live filtering
  }

  protected onEnterPressed(): void {
    // Overridden by subclasses that close their popout on Enter
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
