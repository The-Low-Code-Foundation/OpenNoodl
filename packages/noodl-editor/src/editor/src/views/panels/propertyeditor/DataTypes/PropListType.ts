import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { decodePropList, encodePropList } from '@noodl-core-ui/components/json-editor/utils/listValueCodec';

import { ToastLayer } from '../../../ToastLayer/ToastLayer';
import { PropListInput, PropListItem } from '../components/PropListInput';
import { openListValueEditor } from '../components/ListValueEditor';
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

    view.list = decodePropList(view.value);
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

  /**
   * Write `next` through the codec. Returns an error message when the list was
   * rejected, in which case nothing is stored. The codec is also what keeps each
   * entry's `id` stable, which is what the runtime hangs the entry's child ports
   * off (`parentItemId`) — see ERG-003-NOTES.md.
   */
  private commit(next: TSFixme[]): string | undefined {
    const previous = this.parent.model.getParameter(this.name);
    const encoded = encodePropList(next, previous);
    if (!encoded.ok) return encoded.error;

    this.parent.setParameter(this.name, encoded.value);
    this.parent.notifyListeners('panelResized');

    this.list = decodePropList(this.parent.model.getParameter(this.name));
    this.listIsDefault = this.parent.model.parameters[this.name] === undefined;

    this.renderReact();
    return undefined;
  }

  private performAdd(name: string, _makeUnique?: boolean): string | undefined {
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

    return this.commit([...this.list, { id: '', label: name }]);
  }

  private performRename(args: { oldName: string; newName: string }): string | undefined {
    const idx = this.list.findIndex((item) => item.label === args.oldName);
    if (idx === -1) return undefined;

    const next = this.list.map((item, i) => (i === idx ? { id: item.id, label: args.newName } : item));
    return this.commit(next);
  }

  private performDelete(itemId: string): string | undefined {
    if (this.list.find((i) => i.id === itemId) === undefined) return undefined;
    return this.commit(this.list.filter((i) => i.id !== itemId));
  }

  private renderReact() {
    if (!this.root) return;

    this.root.render(
      React.createElement(PropListInput, {
        items: [...this.list],
        isDefault: this.listIsDefault,
        childElsForItem: (id: string) =>
          this.childViews.filter((view) => view.port.parentItemId === id).map((view) => view.el),
        onAdd: (name: string) => this.performAdd(name),
        // `autoName` ports (Create Record / Update Record `accessControl`) never
        // ask for a name, so they get no inline field at all.
        onAutoAdd:
          this.type.autoName !== undefined
            ? () => {
                const error = this.performAdd(this.type.autoName, true);
                if (error) ToastLayer.showError(error);
              }
            : undefined,
        onOpenCode: (anchor: HTMLElement) => this.openEditor(anchor),
        onRename: (oldName: string, newName: string) => {
          const error = this.performRename({ oldName, newName });
          if (error) ToastLayer.showError(error);
        },
        onDelete: (id: string) => {
          const error = this.performDelete(id);
          if (error) ToastLayer.showError(error);
        },
        onReorder: (source: PropListItem, target: PropListItem, below: boolean) => {
          const next = [...this.list];
          const sourceIdx = next.findIndex((i) => i.id === source.id);
          if (sourceIdx === -1) return;
          const [moved] = next.splice(sourceIdx, 1);

          const targetIdx = next.findIndex((i) => i.id === target.id);
          if (targetIdx === -1) return;
          next.splice(below ? targetIdx + 1 : targetIdx, 0, moved);

          const error = this.commit(next);
          if (error) ToastLayer.showError(error);
        }
      })
    );
  }

  private openEditor(anchor: HTMLElement) {
    this.parent.hidePopout();

    openListValueEditor({
      parent: this.parent,
      anchor,
      portType: 'proplist',
      displayName: this.displayName,
      stored: this.parent.model.getParameter(this.name),
      onCommit: (value) => {
        this.parent.setParameter(this.name, value);
        this.parent.notifyListeners('panelResized');
        this.list = decodePropList(this.parent.model.getParameter(this.name));
        this.listIsDefault = this.parent.model.parameters[this.name] === undefined;
        this.renderReact();
      }
    });
  }

  /** Re-read the model — the parameter can change under us (undo, variants). */
  resetToDefault() {
    this.list = decodePropList(this.parent.model.getParameter(this.name));
    this.listIsDefault = this.parent.model.parameters[this.name] === undefined;
    this.renderReact();
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
