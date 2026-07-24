import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import PopupLayer from '../../../../popuplayer';
import { ToastLayer } from '../../../../ToastLayer/ToastLayer';
import { StringListInput } from '../../components/StringListInput';
import { TypeView } from '../../TypeView';
import { getEditType } from '../../utils';

// Helper to normalize list input - handles both string and array formats
function normalizeList(value): string[] {
  if (value === undefined || value === null || value === '') {
    return [];
  }
  if (Array.isArray(value)) {
    // Already an array (legacy proplist data) - extract labels if objects
    return value.map((item) => (typeof item === 'object' && item.label ? item.label : String(item)));
  }
  if (typeof value === 'string') {
    return value.split(',').filter(Boolean);
  }
  return [];
}

export class StringListType extends TypeView {
  el: TSFixme;
  private root: Root | null = null;
  private list: string[] = [];
  private listIsDefault = true;

  static fromPort(args) {
    const view = new StringListType();

    const p = args.port;
    const parent = args.parent;

    view.port = p;
    view.displayName = p.displayName ? p.displayName : p.name;
    view.name = p.name;
    view.type = getEditType(p);
    view.group = p.group;
    if (parent.model.parameters[p.name] === '') parent.model.parameters[p.name] = undefined;
    view.value = parent.model.getParameter(p.name);
    view.parent = parent;

    view.list = normalizeList(view.value);
    view.listIsDefault = parent.model.parameters[p.name] === undefined;

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

  private listUpdated() {
    let newValue: TSFixme = this.list.join(',');
    if (newValue === '') newValue = undefined;

    this.parent.setParameter(this.name, newValue);
    this.parent.notifyListeners('panelResized');

    this.list = normalizeList(this.parent.model.getParameter(this.name));
    this.listIsDefault = this.parent.model.parameters[this.name] === undefined;

    this.renderReact();
  }

  private performAdd(name: string) {
    if (name === '') {
      return { success: false, message: 'Entry name cannot be empty' };
    } else if (this.list.indexOf(name) !== -1) {
      return { success: false, message: 'Cannot create an entry with the same name as an existing one.' };
    } else {
      this.list.push(name);
      this.listUpdated();

      return { success: true };
    }
  }

  private performRename(args: { oldName: string; newName: string }) {
    if (args.newName === '') {
      return { success: false, message: 'Entry name cannot be empty' };
    } else if (this.list.indexOf(args.newName) !== -1) {
      return { success: false, message: 'Entry with that name already exists.' };
    } else {
      const idx = this.list.indexOf(args.oldName);
      this.list[idx] = args.newName;
      this.listUpdated();

      return { success: true };
    }
  }

  private performDelete(item: string): { success: boolean; message?: string } {
    const idx = this.list.indexOf(item);
    if (idx !== -1) this.list.splice(idx, 1);
    this.listUpdated();

    return { success: true };
  }

  private renderReact() {
    if (!this.root) return;

    this.root.render(
      React.createElement(StringListInput, {
        items: [...this.list],
        isDefault: this.listIsDefault,
        onAddClick: (anchor: HTMLElement) => {
          const popup = new PopupLayer.StringInputPopup({
            label: 'New entry',
            okLabel: 'Add',
            cancelLabel: 'Cancel',
            onOk: (name: string) => {
              const result = this.performAdd(name);
              if (!result.success) {
                ToastLayer.showError(result.message);
              }
            }
          });
          popup.render();

          PopupLayer.instance.showPopup({
            content: popup,
            attachTo: $(anchor),
            position: 'top'
          });
        },
        onRename: (oldName: string, newName: string) => {
          const result = this.performRename({ oldName, newName });
          if (!result.success) {
            ToastLayer.showError(result.message);
          }
        },
        onDelete: (name: string) => {
          const result = this.performDelete(name);
          if (!result.success) {
            ToastLayer.showError(result.message);
          }
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
