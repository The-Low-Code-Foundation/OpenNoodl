import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, Root } from 'react-dom/client';

import { ComponentModel } from '@noodl-models/componentmodel';
import { ProjectModel } from '@noodl-models/projectmodel';
import {
  collectExtractDestinations,
  ExtractDestination,
  joinComponentPath,
  parentPathOf,
  suggestExtractedComponentName,
  validateExtractedComponentName
} from '@noodl-utils/ExtractToComponent';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';

import css from './ExtractToComponentPopup.module.scss';

/**
 * Ask where an extraction should go, before making it.
 *
 * Extraction used to be a single click that created
 * `<current component>/Extracted component` — nested inside whatever component
 * the nodes happened to be born in, under a name nobody chose. Both halves of
 * that are why people lost track of what they had extracted, so both are asked
 * here: a name, and a destination out of every sheet, folder and component the
 * project has.
 *
 * Destinations are filtered to the source component's runtime — the runtime of
 * a component *is* its name in this project format, so offering to drop browser
 * nodes into `#__cloud__` would offer to silently change what they are.
 */

const KIND_ICON: Record<ExtractDestination['kind'], IconName> = {
  root: IconName.FolderOpen,
  sheet: IconName.FolderClosed,
  folder: IconName.FolderClosed,
  component: IconName.Component
};

const KIND_TAG: Record<ExtractDestination['kind'], string> = {
  root: '',
  sheet: 'sheet',
  folder: 'folder',
  component: 'inside'
};

export interface ExtractToComponentPopupOptions {
  projectModel: ProjectModel;
  /** The component the selected nodes are being extracted out of. */
  sourceComponent: ComponentModel;
  /** Called with the full component name to create, e.g. `/Components/Card`. */
  onConfirm: (componentName: string) => void;
  onCancel?: () => void;
}

interface ExtractToComponentViewProps extends ExtractToComponentPopupOptions {
  nameInputRef: React.RefObject<HTMLInputElement>;
}

function ExtractToComponentView({
  projectModel,
  sourceComponent,
  nameInputRef,
  onConfirm,
  onCancel
}: ExtractToComponentViewProps) {
  const destinations = useMemo(
    () => collectExtractDestinations(projectModel, sourceComponent),
    [projectModel, sourceComponent]
  );

  /**
   * The folder the source component lives in — a *sibling*, not a child.
   *
   * The old behaviour nested inside the source component, which is still one
   * row down the list and clearly labelled; it is no longer what happens by
   * default, because a component buried under the one it came from is the thing
   * that made these hard to find again.
   */
  const defaultPath = useMemo(() => {
    const parent = parentPathOf(sourceComponent.name);
    return destinations.some((d) => d.path === parent) ? parent : destinations[0]?.path ?? '/';
  }, [destinations, sourceComponent]);

  const [selectedPath, setSelectedPath] = useState(defaultPath);
  const [name, setName] = useState(() => suggestExtractedComponentName(projectModel, defaultPath));
  const [filter, setFilter] = useState('');

  const listRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return destinations;
    return destinations.filter((d) => d.label.toLowerCase().includes(needle) || d.path.toLowerCase().includes(needle));
  }, [destinations, filter]);

  const error = validateExtractedComponentName(projectModel, selectedPath, name);

  /**
   * `path` is passed explicitly so a double-click can commit the row it landed
   * on: `setSelectedPath` does not take effect until the next render, so a
   * confirm that read state would extract into whatever was selected *before*
   * the double-click.
   */
  const confirmInto = useCallback(
    (path: string) => {
      if (validateExtractedComponentName(projectModel, path, name)) return;
      onConfirm(joinComponentPath(path, name.trim()));
    },
    [projectModel, name, onConfirm]
  );

  const confirm = useCallback(() => confirmInto(selectedPath), [confirmInto, selectedPath]);

  /**
   * Bring the pre-selected destination into view — it is rarely the first row,
   * and a picker that opens scrolled away from its own answer reads as empty.
   *
   * `scrollTop` rather than `scrollIntoView`: this runs while PopupLayer is
   * still placing the popup, and `scrollIntoView` scrolls every ancestor
   * scroller it can reach, not just this list.
   */
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector('[data-selected="true"]') as HTMLElement | null;
    if (!list || !row) return;

    // Both offsets share an offsetParent, so the difference is the row's
    // position inside the list regardless of what that parent is.
    list.scrollTop = row.offsetTop - list.offsetTop - list.clientHeight / 2 + row.clientHeight / 2;
    // Only on mount: re-running on every selection change would fight the mouse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Up/Down moves the destination without leaving the field you are typing in. */
  const handleListNavigation = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return false;
      if (visible.length === 0) return false;

      e.preventDefault();

      const current = visible.findIndex((d) => d.path === selectedPath);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const next = current === -1 ? 0 : Math.min(visible.length - 1, Math.max(0, current + step));

      setSelectedPath(visible[next].path);
      listRef.current?.querySelectorAll('[data-destination-row="true"]')[next]?.scrollIntoView({ block: 'nearest' });

      return true;
    },
    [visible, selectedPath]
  );

  /**
   * Handled on the root, not per field: Escape has to work wherever focus
   * happens to be, and Up/Down have to move the list while you are still typing
   * the name — the two decisions are made in one dialog and should not need two
   * different places to stand.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (handleListNavigation(e)) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        confirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel && onCancel();
      }
    },
    [handleListNavigation, confirm, onCancel]
  );

  const destinationLabel = destinations.find((d) => d.path === selectedPath)?.label ?? selectedPath;

  return (
    <div className={css['Root']} onKeyDown={handleKeyDown}>
      <h2 className={css['Title']}>Extract to component</h2>

      <div className={css['Field']}>
        <label className={css['FieldLabel']} htmlFor="extract-to-component-name">
          Name
        </label>
        <input
          id="extract-to-component-name"
          ref={nameInputRef}
          type="text"
          className={css['Input']}
          value={name}
          placeholder="e.g. Product card"
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className={css['Field']}>
        <label className={css['FieldLabel']} htmlFor="extract-to-component-filter">
          Put it in
        </label>
        <input
          id="extract-to-component-filter"
          type="text"
          className={css['Input']}
          value={filter}
          placeholder="Filter sheets, folders and components…"
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setFilter(e.target.value)}
        />
        {/*
          Rows are divs, not buttons: a focused button treats Enter as its own
          click, which would race the root's "Enter extracts". Arrow keys move
          the selection from wherever you are typing, so nothing here needs to
          be in the tab order to be reachable.
        */}
        <div className={css['List']} ref={listRef} role="listbox" tabIndex={0} aria-label="Destination">
          {visible.length === 0 && <div className={css['ListEmpty']}>Nothing matches “{filter}”</div>}
          {visible.map((destination) => {
            const isSelected = destination.path === selectedPath;
            const tag = destination.isCurrent ? 'current' : KIND_TAG[destination.kind];

            return (
              <div
                key={destination.path}
                role="option"
                aria-selected={isSelected}
                data-destination-row="true"
                data-selected={isSelected}
                title={destination.path}
                className={classNames(css['Row'], isSelected && css['is-selected'])}
                onClick={() => setSelectedPath(destination.path)}
                onDoubleClick={() => {
                  setSelectedPath(destination.path);
                  confirmInto(destination.path);
                }}
              >
                <Icon icon={KIND_ICON[destination.kind]} size={IconSize.Small} />
                <span className={css['RowLabel']}>{destination.label}</span>
                {tag && <span className={css['RowTag']}>{tag}</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className={classNames(css['Message'], error && css['MessageError'])}>
        {error ? (
          <span>{error}</span>
        ) : (
          <span>
            Creates <span className={css['Preview']}>{name.trim()}</span> in {destinationLabel}
          </span>
        )}
      </div>

      <div className={css['Actions']}>
        <PrimaryButton
          label="Cancel"
          variant={PrimaryButtonVariant.Muted}
          size={PrimaryButtonSize.Small}
          isFitContent
          onClick={() => onCancel && onCancel()}
        />
        <PrimaryButton
          label="Extract"
          size={PrimaryButtonSize.Small}
          isFitContent
          isDisabled={!!error}
          onClick={confirm}
        />
      </div>
    </div>
  );
}

/**
 * A class, because `PopupLayer.showPopup` takes `{ el, owner, onOpen, onClose }`
 * and assigns `owner` after construction — the same contract `StringInputPopup`
 * has always satisfied.
 */
export class ExtractToComponentPopup {
  public el: HTMLElement;
  /** Assigned by PopupLayer when the popup is shown. */
  public owner: TSFixme;

  private readonly options: ExtractToComponentPopupOptions;
  private readonly nameInputRef = React.createRef<HTMLInputElement>();
  private root: Root | null = null;

  constructor(options: ExtractToComponentPopupOptions) {
    this.options = options;
  }

  public render(): HTMLElement {
    if (!this.el) {
      this.el = document.createElement('div');
    }

    if (!this.root) {
      this.root = createRoot(this.el);
    }

    // Synchronous: `showPopup` measures this element to centre the popup, and
    // pins the shell to whatever size it finds.
    flushSync(() =>
      this.root.render(
        React.createElement(ExtractToComponentView, {
          projectModel: this.options.projectModel,
          sourceComponent: this.options.sourceComponent,
          nameInputRef: this.nameInputRef,
          onConfirm: (componentName: string) => {
            this.owner && this.owner.hidePopup();
            this.options.onConfirm(componentName);
          },
          onCancel: () => {
            this.owner && this.owner.hidePopup();
            this.options.onCancel && this.options.onCancel();
          }
        })
      )
    );

    return this.el;
  }

  /** Called by PopupLayer once the popup is attached to the document. */
  public onOpen() {
    // Selected, not just focused: the suggestion is a starting point, and the
    // whole point of the dialog is that the name is the user's to choose.
    this.nameInputRef.current?.focus();
    this.nameInputRef.current?.select();
  }

  public onClose() {
    const root = this.root;
    this.root = null;
    // Deferred: onClose runs inside the React event that triggered the close.
    root && setTimeout(() => root.unmount(), 0);
  }
}
