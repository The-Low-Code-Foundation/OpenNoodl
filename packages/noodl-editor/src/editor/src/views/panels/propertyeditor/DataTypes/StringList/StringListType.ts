import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { decodeStringList, encodeStringList } from '@noodl-core-ui/components/json-editor/utils/listValueCodec';

import { ToastLayer } from '../../../../ToastLayer/ToastLayer';
import { openListValueEditor } from '../../components/ListValueEditor';
import { StringListInput } from '../../components/StringListInput';
import { TypeView } from '../../TypeView';
import { getConnectionSourceLabel, getConnectionSourceNavigate, getEditType } from '../../utils';

/**
 * ERG-003 — the `stringlist` row.
 *
 * Storage is unchanged and deliberately so: a `stringlist` is a comma-separated
 * string, and twenty-nine files under `noodl-runtime/src/nodes` and
 * `noodl-viewer-react/src/nodes` independently `split(',')` it. The measurement
 * and the decision are in ERG-003-NOTES.md. What changed is that the format's
 * one real failure — an entry containing a comma — is now refused instead of
 * silently becoming two entries, and that the list can also be edited as JSON.
 *
 * `decodeStringList`/`encodeStringList` are the only code that knows the format;
 * this class no longer splits or joins anything itself.
 */
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

    view.list = decodeStringList(view.value);
    view.listIsDefault = parent.model.parameters[p.name] === undefined;
    view.isConnected = parent.model.isPortConnected(p.name, 'target');

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
   * rejected, in which case nothing is stored — the caller shows the message
   * next to the field rather than the value quietly changing shape.
   */
  private commit(next: string[]): string | undefined {
    const encoded = encodeStringList(next);
    if (!encoded.ok) return encoded.error;

    this.parent.setParameter(this.name, encoded.value);
    this.parent.notifyListeners('panelResized');

    this.list = decodeStringList(this.parent.model.getParameter(this.name));
    this.listIsDefault = this.parent.model.parameters[this.name] === undefined;

    this.renderReact();
    return undefined;
  }

  private performAdd(name: string): string | undefined {
    return this.commit([...this.list, name]);
  }

  private performRename(oldName: string, newName: string): string | undefined {
    const idx = this.list.indexOf(oldName);
    if (idx === -1) return undefined;
    const next = [...this.list];
    next[idx] = newName;
    return this.commit(next);
  }

  private performDelete(item: string): void {
    const error = this.commit(this.list.filter((x) => x !== item));
    if (error) ToastLayer.showError(error);
  }

  private renderReact() {
    if (!this.root) return;

    this.isConnected = this.parent.model.isPortConnected(this.name, 'target');

    this.root.render(
      React.createElement(StringListInput, {
        items: [...this.list],
        isDefault: this.listIsDefault,
        isConnected: this.isConnected,
        connectionLabel: this.isConnected ? getConnectionSourceLabel(this.parent.model, this.name) : undefined,
        onConnectionClick: this.isConnected ? getConnectionSourceNavigate(this.parent.model, this.name) : undefined,
        onAdd: (name: string) => this.performAdd(name),
        onRename: (oldName: string, newName: string) => this.performRename(oldName, newName),
        onDelete: (name: string) => this.performDelete(name),
        onOpenCode: (anchor: HTMLElement) => this.openEditor(anchor)
      })
    );
  }

  private openEditor(anchor: HTMLElement) {
    this.parent.hidePopout();

    openListValueEditor({
      parent: this.parent,
      anchor,
      portType: 'stringlist',
      displayName: this.displayName,
      stored: this.parent.model.getParameter(this.name),
      onCommit: (value) => {
        this.parent.setParameter(this.name, value);
        this.parent.notifyListeners('panelResized');
        this.list = decodeStringList(this.parent.model.getParameter(this.name));
        this.listIsDefault = this.parent.model.parameters[this.name] === undefined;
        this.renderReact();
      }
    });
  }

  /** Re-read the model — the parameter can change under us (undo, variants). */
  resetToDefault() {
    this.list = decodeStringList(this.parent.model.getParameter(this.name));
    this.listIsDefault = this.parent.model.parameters[this.name] === undefined;
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
