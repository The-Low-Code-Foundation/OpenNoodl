import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import {
  decodeForEditor,
  listPortTypeFor,
  type ListPortType
} from '@noodl-core-ui/components/json-editor/utils/listValueCodec';

import { ListInputRow } from '../components/ListInputRow';
import { openListValueEditor } from '../components/ListValueEditor';
import { TypeView } from '../TypeView';
import { getConnectionSourceLabel, getConnectionSourceNavigate, getEditType } from '../utils';

/**
 * ERG-003 — the property row for `array` and `object` ports.
 *
 * These two used to route to `CodeEditorType`, i.e. a Monaco popout with
 * JavaScript-expression validation and no visual mode at all: the only way to
 * give a Global Store its initial state or an SSE call its headers was to type a
 * literal. They now open the same `JSONEditor` every other list port opens, so
 * the visual builder is available on them for the first time.
 *
 * What is *stored* does not change — a string holding the literal, exactly what
 * `CodeEditorType` wrote and what `setInputValue` parses. See ERG-003-NOTES.md
 * for why that was left alone rather than migrated to a real array/object.
 */
export class ListValueType extends TypeView {
  el: TSFixme;
  private root: Root | null = null;
  private portType: ListPortType;
  private readOnly: boolean;

  static fromPort(args) {
    const view = new ListValueType();

    const p = args.port;
    const parent = args.parent;

    view.port = p;
    view.displayName = p.displayName ? p.displayName : p.name;
    view.name = p.name;
    view.type = getEditType(p);
    view.group = p.group;
    view.tooltip = p.tooltip;
    view.parent = parent;
    view.value = parent.model.getParameter(p.name);
    view.isConnected = parent.model.isPortConnected(p.name, 'target');
    view.isDefault = parent.model.parameters[p.name] === undefined;
    view.readOnly = p.readOnly || p.type?.readOnly || getEditType(p)?.readOnly || false;

    // 🔴 The port type is RESOLVED, not collapsed to array/object. It used to be the latter,
    // which was correct while this row served exactly those two — but the codec dispatches on it,
    // and an `optionslist` narrowed to `'array'` would be decoded and encoded as a raw JSON blob,
    // which is the very thing §3 added the type to stop.
    view.portType = listPortTypeFor(view.type) ?? 'array';

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
    return this.el;
  }

  /** A one-line description of the value, so the row says something without being opened. */
  private summary(): string {
    const stored = this.parent.model.getParameter(this.name);
    if (stored === undefined || stored === null || stored === '') {
      // Only `object` is object-shaped; everything else this row serves is a list.
      return this.portType === 'object' ? 'Empty object' : 'Empty list';
    }

    const decoded = decodeForEditor(this.portType, stored);
    if (decoded.unparseable) return 'Unreadable value';

    try {
      const parsed = JSON.parse(decoded.json);
      if (Array.isArray(parsed)) return parsed.length === 1 ? '1 item' : `${parsed.length} items`;
      if (parsed && typeof parsed === 'object') {
        const n = Object.keys(parsed).length;
        return n === 1 ? '1 property' : `${n} properties`;
      }
      return String(parsed);
    } catch {
      return 'Unreadable value';
    }
  }

  renderReact() {
    if (!this.root) return;

    this.isConnected = this.parent.model.isPortConnected(this.name, 'target');
    this.isDefault = this.parent.model.parameters[this.name] === undefined;

    this.root.render(
      React.createElement(ListInputRow, {
        label: this.displayName,
        tooltip: this.tooltip,
        summary: this.summary(),
        isChanged: !this.isDefault,
        isConnected: this.isConnected,
        connectionLabel: this.isConnected ? getConnectionSourceLabel(this.parent.model, this.name) : undefined,
        onConnectionClick: this.isConnected ? getConnectionSourceNavigate(this.parent.model, this.name) : undefined,
        onEdit: (anchor: HTMLElement) => this.openEditor(anchor),
        onReset: this.isDefault
          ? undefined
          : () => {
              this.parent.model.setParameter(this.name, undefined, { undo: true, label: 'reset parameter' });
              this.renderReact();
            }
      })
    );
  }

  private openEditor(anchor: HTMLElement) {
    this.parent.hidePopout();

    openListValueEditor({
      parent: this.parent,
      anchor,
      portType: this.portType,
      displayName: this.displayName,
      stored: this.parent.model.getParameter(this.name),
      disabled: this.readOnly,
      onCommit: (value) => {
        this.parent.setParameter(this.name, value);
        this.renderReact();
      }
    });
  }

  dispose() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    super.dispose();
  }
}
