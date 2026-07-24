import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { ContentPicker, ContentPickerItem } from '../components/ContentPicker';
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

  private contentPicker: {
    root: Root;
    items: ContentPickerItem[];
    filter: string;
    rerender: () => void;
  } | null = null;

  /**
   * Open a ContentPicker popout attached to this row. Returns an `addItems`
   * handle so async loaders can stream items in as they resolve.
   */
  protected openContentPicker(opts: { title: string; sortMode?: 'folder' | 'nameDesc' }) {
    const div = document.createElement('div');
    const root = createRoot(div);

    const state = {
      root,
      items: [] as ContentPickerItem[],
      filter: '',
      rerender: () => {
        root.render(
          React.createElement(ContentPicker, {
            title: opts.title,
            sortMode: opts.sortMode,
            items: [...state.items],
            filter: state.filter,
            onSelect: (item: ContentPickerItem) => {
              this.commit(item.fullPath);
              this.parent.hidePopout();
            }
          })
        );
      }
    };
    this.contentPicker = state;
    state.rerender();

    this.parent.showPopout({
      content: { el: [div] },
      attachTo: $(this.el),
      position: 'right',
      onClose: () => {
        root.unmount();
        if (this.contentPicker === state) this.contentPicker = null;
      }
    });

    return {
      addItems: (items: ContentPickerItem[]) => {
        state.items.push(...items);
        state.rerender();
      }
    };
  }

  protected filterPicker(text: string): void {
    // Live-filter the shared ContentPicker; subclasses with custom pickers override
    if (this.contentPicker) {
      this.contentPicker.filter = text;
      this.contentPicker.rerender();
    }
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
