import Path from 'path';

import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { ProjectModel } from '@noodl-models/projectmodel';
import FileSystem from '@noodl-utils/filesystem';
import { PROJECT_ASSETS_FOLDER } from '@noodl-utils/projectAssets';

import { ContentPicker, ContentPickerAction, ContentPickerEmptyState, ContentPickerItem } from '../components/ContentPicker';
import { PickerTextInput } from '../components/PickerTextInput';
import { TypeView } from '../TypeView';
import { getConnectionSourceLabel, getConnectionSourceNavigate } from '../utils';

/**
 * Base for the property rows that pair a text input with a picker popout
 * (font, image, identifier, component). Subclasses implement `openPicker`
 * and optionally `filterPicker`.
 */
/**
 * The handle `openContentPicker` returns: how a loader reports into a picker that is already on
 * screen, and how it finds out the popout has since been closed.
 */
export interface ContentPickerHandle {
  /** Append items and clear the loading state. */
  addItems(items: ContentPickerItem[]): void;
  /** Replace the list — what a reload after an import needs, where appending would double it. */
  setItems(items: ContentPickerItem[]): void;
  /** Back to "Looking…" while a reload runs, so a slow walk does not read as an empty project. */
  setLoading(): void;
  /** False once the popout has been closed — a late callback must not touch a dead root. */
  isOpen(): boolean;
}

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
        connectionLabel: this.isConnected ? getConnectionSourceLabel(this.parent.model, this.name) : undefined,
        onConnectionClick: this.isConnected ? getConnectionSourceNavigate(this.parent.model, this.name) : undefined,
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
    isLoading: boolean;
    rerender: () => void;
  } | null = null;

  /**
   * Open a ContentPicker popout attached to this row. Returns a handle so async loaders can stream
   * items in as they resolve.
   *
   * 🔴 FB-015: a loader MUST report even when it found nothing — `addItems([])` and `setItems([])`
   * both clear the loading state. A loader that returns early instead (which is what
   * `ImageType` did) leaves the picker saying "Looking…" for the rest of its life, and before this
   * task it left it blank, which was indistinguishable from an empty project.
   */
  protected openContentPicker(opts: {
    title: string;
    sortMode?: 'folder' | 'nameDesc';
    emptyState?: ContentPickerEmptyState;
    /** Drawn in a footer that stays put whether or not the list has anything in it. */
    actions?: ContentPickerAction[];
  }): ContentPickerHandle {
    const div = document.createElement('div');
    const root = createRoot(div);

    const state = {
      root,
      items: [] as ContentPickerItem[],
      filter: '',
      isLoading: true,
      rerender: () => {
        root.render(
          React.createElement(ContentPicker, {
            title: opts.title,
            sortMode: opts.sortMode,
            items: [...state.items],
            filter: state.filter,
            isLoading: state.isLoading,
            emptyState: opts.emptyState,
            actions: opts.actions,
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
      content: { el: div },
      attachTo: this.el,
      position: 'right',
      onClose: () => {
        root.unmount();
        if (this.contentPicker === state) this.contentPicker = null;
      }
    });

    return {
      addItems: (items: ContentPickerItem[]) => {
        state.items.push(...items);
        state.isLoading = false;
        state.rerender();
      },
      setItems: (items: ContentPickerItem[]) => {
        state.items = [...items];
        state.isLoading = false;
        state.rerender();
      },
      setLoading: () => {
        state.isLoading = true;
        state.rerender();
      },
      isOpen: () => this.contentPicker === state
    };
  }

  /**
   * FB-015 — reveal the open project's directory in the OS file manager, preferring `assets/` when
   * it exists. The manual route out of an empty picker: the walk lists whatever is on disk, and
   * before this button nothing in the editor told an author where "on disk" was.
   */
  protected showProjectFolder(): void {
    const directory = ProjectModel.instance?._retainedProjectDirectory;
    if (!directory) return;

    const shell = require('@electron/remote').shell;
    const assets = `${directory}/${PROJECT_ASSETS_FOLDER}`;
    const target = Path.normalize(FileSystem.instance.fileExistsSync(assets) ? assets : directory);

    shell.openPath(target).then((failure: string) => {
      // 🔴 `openPath` resolves with a NON-EMPTY string on failure rather than rejecting, so a
      // folder the OS declined to open looks exactly like one it opened unless this is read.
      if (failure) shell.showItemInFolder(target);
    });
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
