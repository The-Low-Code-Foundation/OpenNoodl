import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import PopupLayer from '../../../popuplayer';
import { ToastLayer } from '../../../ToastLayer/ToastLayer';
import { PropListInput, PropListItem } from '../components/PropListInput';
import { TypeView } from '../TypeView';
import { getEditType } from '../utils';

// Styles
require('../../../../styles/propertyeditor/proplist.css');

export class PropListType extends TypeView {
  childViews: TSFixme[];
  el: TSFixme;
  private root: Root | null = null;
  private list: PropListItem[] = [];
  private listIsDefault = true;

  constructor() {
    super();

    this.childViews = [];
  }

  static fromPort(args) {
    const view = new PropListType();

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

    view.list = view.value || [];
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
    let newValue: TSFixme = this.list;
    if (newValue.length === 0) newValue = undefined;

    this.parent.setParameter(this.name, newValue);
    this.parent.notifyListeners('panelResized');

    this.list = this.parent.model.getParameter(this.name) || [];
    this.listIsDefault = this.parent.model.parameters[this.name] === undefined;

    this.renderReact();
  }

  private _guid() {
    while (true) {
      const uid = ('0000' + ((Math.random() * Math.pow(36, 4)) | 0).toString(36)).slice(-4);
      if (this.list.find((item) => item.id === uid) === undefined) {
        return uid;
      }
    }
  }

  private performAdd(name: string, _makeUnique?: boolean) {
    if (_makeUnique) {
      // Find a unique name by adding index at the end
      let idx = 2,
        uniqueName = name + ' ' + 1;
      while (this.list.find((item) => item.label === uniqueName) !== undefined) {
        uniqueName = name + ' ' + idx;
        idx++;
      }
      name = uniqueName;
    }

    if (name === '') {
      return { success: false, message: 'Entry name cannot be empty' };
    } else if (this.list.find((item) => item.label === name) !== undefined) {
      return { success: false, message: 'Cannot create an entry with the same name as an existing one.' };
    } else {
      this.list.push({
        id: this._guid(),
        label: name
      });
      this.listUpdated();

      return { success: true };
    }
  }

  private performRename(args: { oldName: string; newName: string }) {
    if (args.newName === '') {
      return { success: false, message: 'Entry name cannot be empty' };
    } else if (this.list.find((item) => item.label === args.newName) !== undefined) {
      return { success: false, message: 'Entry with that name already exists.' };
    } else {
      const item = this.list.find((item) => item.label === args.oldName);
      item.label = args.newName;
      this.listUpdated();

      return { success: true };
    }
  }

  private performDelete(itemId: string): { success: boolean; message?: string } | undefined {
    const item = this.list.find((i) => i.id === itemId);
    if (item === undefined) return;
    const idx = this.list.indexOf(item);
    if (idx !== -1) this.list.splice(idx, 1);
    this.listUpdated();

    return { success: true };
  }

  private renderReact() {
    if (!this.root) return;

    this.root.render(
      React.createElement(PropListInput, {
        items: [...this.list],
        isDefault: this.listIsDefault,
        childElsForItem: (id: string) =>
          this.childViews.filter((view) => view.port.parentItemId === id).map((view) => view.el),
        onAddClick: (anchor: HTMLElement) => {
          if (this.type.autoName !== undefined) {
            const result = this.performAdd(this.type.autoName, true);
            if (!result.success) {
              ToastLayer.showError(result.message);
            }
            return;
          }

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
        onDelete: (id: string) => {
          const result = this.performDelete(id);
          if (result && !result.success) {
            ToastLayer.showError(result.message);
          }
        },
        onReorder: (source: PropListItem, target: PropListItem, below: boolean) => {
          const sourceIdx = this.list.indexOf(source);
          if (sourceIdx === -1) return;
          this.list.splice(sourceIdx, 1);

          const targetIdx = this.list.indexOf(target);
          this.list.splice(below ? targetIdx + 1 : targetIdx, 0, source);
          this.listUpdated();
        }
      })
    );
  }

  addChildTypeView(child) {
    this.childViews.push(child);
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
