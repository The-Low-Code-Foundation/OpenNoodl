/**
 * BEN-005 — The scenario bar: four states in four seconds.
 *
 * One row above the inputs rail. Selecting a scenario applies its inputs and
 * re-renders; **Save** overwrites; the overflow renames, reorders and deletes.
 * With nothing saved yet it is a single button and not a control panel — a row
 * of empty dropdowns would read as a feature you have to configure before the
 * bench works, and the bench works without it.
 *
 * ## Typing does not save
 *
 * Nothing in this file writes anything. It calls back, and `ComponentBench` owns
 * the one `setMetaData` call in the surface (R5, and `benchScenarios.ts`'s module
 * note). Selecting a scenario, editing an input, changing the frame and closing
 * the bench all leave `project.json` alone; only Save does not.
 *
 * ## Why the menus are not portalled
 *
 * The same reason `PreviewChrome`'s picker is not: a portalled select opened by
 * a synthesised `.click()` never closes, which has cost this repo a live-QA
 * session before. These are ordinary absolutely-positioned panels inside the
 * surface, which is the form a driver can assert on.
 *
 * @module noodl-editor/views/VisualCanvas/BenchScenarioBar
 */

import classNames from 'classnames';
import React, { useEffect, useRef, useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './BenchScenarioBar.module.scss';
import type { BenchScenario } from './benchScenarios';

export interface BenchScenarioBarProps {
  scenarios: BenchScenario[];
  /** The scenario currently applied, by name. Absent when the bench is on nothing. */
  current?: string;
  /** Whether the bench has drifted from `current` — the unsaved-changes dot. */
  modified: boolean;
  /** What the last action had to say: a skipped input, or a refused value. */
  notice?: string;
  onSelect: (name: string) => void;
  /** Overwrite `current` with what is on the bench now. */
  onSave: () => void;
  onSaveAs: (name: string) => void;
  onRename: (from: string, to: string) => void;
  /** Move `current` by one place. */
  onMove: (name: string, delta: number) => void;
  onDelete: (name: string) => void;
}

/** Which inline text field is open, if any. Both commit on Enter and cancel on Escape. */
type Naming = { kind: 'save-as' | 'rename'; value: string } | undefined;

export function BenchScenarioBar({
  scenarios,
  current,
  modified,
  notice,
  onSelect,
  onSave,
  onSaveAs,
  onRename,
  onMove,
  onDelete
}: BenchScenarioBarProps) {
  const [listOpen, setListOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [naming, setNaming] = useState<Naming>(undefined);

  const rootRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const isOpen = listOpen || menuOpen;

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setListOpen(false);
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setListOpen(false);
      setMenuOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (naming) nameRef.current?.focus();
  }, [naming]);

  function beginSaveAs() {
    setMenuOpen(false);
    setListOpen(false);
    setNaming({ kind: 'save-as', value: '' });
  }

  function beginRename() {
    setMenuOpen(false);
    setNaming({ kind: 'rename', value: current ?? '' });
  }

  function commitName() {
    if (!naming) return;
    const value = naming.value.trim();
    setNaming(undefined);
    if (!value) return;

    if (naming.kind === 'save-as') onSaveAs(value);
    else if (current) onRename(current, value);
  }

  if (naming) {
    return (
      <div className={css.Root} ref={rootRef} data-test="bench-scenario-bar">
        <div className={css.Row}>
          <label className={css.Label} htmlFor="bench-scenario-name">
            {naming.kind === 'save-as' ? 'Save as' : 'Rename'}
          </label>
          <input
            id="bench-scenario-name"
            ref={nameRef}
            className={css.NameField}
            value={naming.value}
            placeholder={naming.kind === 'save-as' ? 'Loaded' : current}
            onChange={(event) => setNaming({ ...naming, value: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitName();
              // Escape has to be caught here as well as on the document: the
              // field swallows it while it has focus, which is exactly when
              // someone presses it.
              if (event.key === 'Escape') setNaming(undefined);
            }}
            data-test="bench-scenario-name"
          />
          <button type="button" className={css.Action} onClick={commitName} data-test="bench-scenario-name-confirm">
            Save
          </button>
          <button
            type="button"
            className={css.Action}
            onClick={() => setNaming(undefined)}
            data-test="bench-scenario-name-cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (scenarios.length === 0) {
    return (
      <div className={css.Root} ref={rootRef} data-test="bench-scenario-bar">
        <div className={css.Row}>
          <button type="button" className={css.Empty} onClick={beginSaveAs} data-test="bench-scenario-save-as">
            <Icon icon={IconName.Plus} size={IconSize.Tiny} />
            <span>Save as scenario</span>
          </button>
        </div>
        {notice && <Notice text={notice} />}
      </div>
    );
  }

  return (
    <div className={css.Root} ref={rootRef} data-test="bench-scenario-bar">
      <div className={css.Row}>
        <span className={css.Label}>Scenario</span>

        <div className={css.Picker}>
          <button
            type="button"
            className={css.PickerChip}
            aria-haspopup="listbox"
            aria-expanded={listOpen}
            onClick={() => {
              setMenuOpen(false);
              setListOpen((open) => !open);
            }}
            data-test="bench-scenario-chip"
          >
            <span className={css.PickerLabel}>{current ?? 'Unsaved'}</span>
            {/* The dot, not a dialog: an unsaved change is worth showing and
                never worth interrupting someone over. */}
            {modified && (
              <span className={css.Dot} title="Unsaved changes" data-test="bench-scenario-modified">
                ●
              </span>
            )}
            <Icon icon={IconName.CaretDown} size={IconSize.Tiny} />
          </button>

          {listOpen && (
            <div className={css.Menu} role="listbox" data-test="bench-scenario-list">
              {scenarios.map((scenario) => (
                <button
                  key={scenario.name}
                  type="button"
                  role="option"
                  aria-selected={scenario.name === current}
                  className={classNames(css.MenuItem, scenario.name === current && css['is-current'])}
                  onClick={() => {
                    setListOpen(false);
                    onSelect(scenario.name);
                  }}
                  data-test={`bench-scenario-option-${scenario.name}`}
                >
                  {scenario.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className={classNames(css.Action, modified && css['is-primary'])}
          disabled={!current}
          title={current ? `Overwrite “${current}” with what is on the bench now` : 'Nothing selected to overwrite'}
          onClick={onSave}
          data-test="bench-scenario-save"
        >
          Save
        </button>

        <div className={css.Picker}>
          <button
            type="button"
            className={css.Action}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Scenario options"
            onClick={() => {
              setListOpen(false);
              setMenuOpen((open) => !open);
            }}
            data-test="bench-scenario-overflow"
          >
            ⋯
          </button>

          {menuOpen && (
            <div className={classNames(css.Menu, css['is-right'])} role="menu" data-test="bench-scenario-menu">
              <button
                type="button"
                role="menuitem"
                className={css.MenuItem}
                onClick={beginSaveAs}
                data-test="bench-scenario-save-as"
              >
                Save as…
              </button>
              <button
                type="button"
                role="menuitem"
                className={css.MenuItem}
                disabled={!current}
                onClick={beginRename}
                data-test="bench-scenario-rename"
              >
                Rename
              </button>
              <button
                type="button"
                role="menuitem"
                className={css.MenuItem}
                disabled={!current}
                onClick={() => {
                  setMenuOpen(false);
                  if (current) onMove(current, -1);
                }}
                data-test="bench-scenario-move-up"
              >
                Move up
              </button>
              <button
                type="button"
                role="menuitem"
                className={css.MenuItem}
                disabled={!current}
                onClick={() => {
                  setMenuOpen(false);
                  if (current) onMove(current, 1);
                }}
                data-test="bench-scenario-move-down"
              >
                Move down
              </button>
              <button
                type="button"
                role="menuitem"
                className={classNames(css.MenuItem, css['is-danger'])}
                disabled={!current}
                onClick={() => {
                  setMenuOpen(false);
                  if (current) onDelete(current);
                }}
                data-test="bench-scenario-delete"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {notice && <Notice text={notice} />}
    </div>
  );
}

/**
 * What the last action had to say.
 *
 * On the bar rather than in a toast, because every message it carries is about
 * the thing directly below it — a value that could not be saved, an input the
 * scenario names that this component no longer has.
 */
function Notice({ text }: { text: string }) {
  return (
    <div className={css.Notice} data-test="bench-scenario-notice">
      <Text textType={TextType.Shy}>{text}</Text>
    </div>
  );
}
