/**
 * VFN-009 — *Saved blocks*, in project settings.
 *
 * > *"When you've saved blocks, we need a way to access them to edit them. I'm guessing this would
 * > be: some sort of global menu in your project, maybe in app settings or something? Where you can
 * > open the blockly editor of the blocks you saved and edit them, with a big warning that 'this
 * > block has already been used 5 times in your project, and your changes will propagate
 * > everywhere, are you sure?'"*
 *
 * The engine for every operation on this surface was already built and had **zero callers outside
 * its own tests** (`myblocks/store.ts`). This is the way in.
 *
 * ## 🔴 Nothing here decides anything
 *
 * Every sentence comes from `myblocks/libraryIntent.ts`; every count comes from
 * `myblocks/usage.ts`; every write goes through `MyBlocksLibrary.ts`, which goes through
 * `store.save`. Neither of this package's runners can render a React component, so a decision left
 * in this file is a decision that cannot be graded — and this feature's register is mostly made of
 * decisions that were only wrong once somebody drove them.
 *
 * ⚠️ Two `BaseDialog` facts, both live and neither fixable from here: it renders every dialog body
 * **twice** (a zero-height measuring copy), so nothing below may touch a global on mount; and the
 * measuring copy is reachable by Tab, so every button in these dialogs has an invisible twin ahead
 * of it in the tab order. Both are `BaseDialog`'s, filed, and on every dialog surface in the app.
 *
 * @module SettingsPanel
 */

import React, { useCallback, useEffect, useState } from 'react';

import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextInput, TextInputVariant } from '@noodl-core-ui/components/inputs/TextInput';
import { CoreBaseDialog } from '@noodl-core-ui/components/layout/BaseDialog';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';

import { DialogLayerModel } from '@noodl-models/DialogLayerModel';
import { ProjectModel } from '@noodl-models/projectmodel';

import { EventDispatcher } from '../../../../../../shared/utils/EventDispatcher';
import {
  detachAndRemove,
  duplicateDefinition,
  exportDefinition,
  openDefinitionTab,
  removeDefinition,
  renameDefinition,
  savedBlockRows,
  usageNow,
  type SavedBlockRow
} from '../../../BlocklyEditor/MyBlocksLibrary';
import {
  MY_BLOCKS_GLYPH,
  SHELF_LABEL,
  SHELF_NOTE,
  describeDeleteRefusal,
  describeDetachOffer,
  describeDetachResult,
  describePropagation,
  describeRegeneration,
  describeUsageShort,
  usageLines
} from '../../../BlocklyEditor/myblocks/libraryIntent';
import { ToastLayer } from '../../../ToastLayer/ToastLayer';
import css from './SavedBlocksSection.module.scss';

/**
 * A dialog body: a sentence, an optional list of named places, an optional footnote, and buttons.
 *
 * One component for the propagation warning, the delete refusal and the rename prompt, because all
 * three are the same shape and the difference between them is entirely in the words — which is the
 * point of keeping the words somewhere a runner can read them.
 */
function LibraryDialog({
  title,
  message,
  lines,
  note,
  confirmLabel,
  onConfirm,
  extraLabel,
  onExtra,
  onClose
}: {
  title: string;
  message: string;
  lines?: string[];
  note?: string;
  confirmLabel?: string;
  onConfirm?: () => void;
  extraLabel?: string;
  onExtra?: () => void;
  onClose: () => void;
}) {
  return (
    <CoreBaseDialog title={title} isVisible hasBackdrop onClose={onClose}>
      <Box hasXSpacing hasYSpacing>
        <div className={css.DialogBody}>
          <div>{message}</div>

          {lines && lines.length > 0 ? (
            <ul className={css.DialogList}>
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}

          {note ? <div className={css.DialogNote}>{note}</div> : null}

          <div className={css.DialogButtons}>
            {/* Button convention (UIX-004): primary on the right, cancel to its left. */}
            <PrimaryButton
              label="Cancel"
              variant={PrimaryButtonVariant.Muted}
              size={PrimaryButtonSize.Small}
              onClick={onClose}
            />
            {extraLabel && onExtra ? (
              <PrimaryButton
                label={extraLabel}
                variant={PrimaryButtonVariant.MutedOnLowBg}
                size={PrimaryButtonSize.Small}
                onClick={() => {
                  onClose();
                  onExtra();
                }}
              />
            ) : null}
            {confirmLabel && onConfirm ? (
              <PrimaryButton
                label={confirmLabel}
                size={PrimaryButtonSize.Small}
                onClick={() => {
                  onClose();
                  onConfirm();
                }}
              />
            ) : null}
          </div>
        </div>
      </Box>
    </CoreBaseDialog>
  );
}

/** Rename: a field and two ways out. Its own component because it holds a value. */
function RenameDialog({ current, onAccept, onClose }: { current: string; onAccept: (name: string) => void; onClose: () => void }) {
  const [value, setValue] = useState(current);
  const canAccept = value.trim().length > 0;

  return (
    <CoreBaseDialog title="Rename saved block" isVisible hasBackdrop onClose={onClose}>
      <Box hasXSpacing hasYSpacing>
        <div className={css.DialogBody}>
          <TextInput
            value={value}
            variant={TextInputVariant.InModal}
            isAutoFocus
            onChange={(event) => setValue(event.target.value)}
            onEnter={() => {
              if (!canAccept) return;
              onClose();
              onAccept(value.trim());
            }}
          />
          <div className={css.DialogNote}>
            Renaming cannot break anything that uses it — a call block stores the block’s identity,
            never its name.
          </div>
          <div className={css.DialogButtons}>
            <PrimaryButton
              label="Cancel"
              variant={PrimaryButtonVariant.Muted}
              size={PrimaryButtonSize.Small}
              onClick={onClose}
            />
            <PrimaryButton
              label="Rename"
              size={PrimaryButtonSize.Small}
              isDisabled={!canAccept}
              onClick={() => {
                onClose();
                onAccept(value.trim());
              }}
            />
          </div>
        </div>
      </Box>
    </CoreBaseDialog>
  );
}

export function SavedBlocksSection() {
  const [rows, setRows] = useState<SavedBlockRow[]>([]);

  /**
   * 🔴 Recomputed, never cached across a gesture.
   *
   * `store.graph()` refuses to read the definition graph off the stored `requires` for exactly this
   * reason, and a usage index held in React state would be that mistake one level up. `refresh` is
   * called after every write here **and** whenever the project's settings change, because the
   * project shelf lives in `project.json`'s settings bag and a definition saved from a block
   * editor lands there without this panel being told.
   */
  const refresh = useCallback(() => {
    try {
      setRows(savedBlockRows());
    } catch (error) {
      console.error('[SavedBlocks] Could not read the saved blocks', error);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    refresh();

    const group = {};
    ProjectModel.instance?.on('settingsChanged', refresh, group);
    // A backpack save does not touch the project, so the shelves are re-read when a block editor
    // says it saved one as well.
    EventDispatcher.instance.on('MyBlocks.LibraryChanged', refresh, group);

    return () => {
      // `?.` because by unmount time the singleton may be gone — leaving a project nulls
      // `ProjectModel.instance` from a `setTimeout(…, 0)`, and this panel loses that race. An
      // unguarded `.off` inside a cleanup tears down the tree and leaves the window blank.
      ProjectModel.instance?.off(group);
      EventDispatcher.instance.off(group);
    };
  }, [refresh]);

  /**
   * *Edit blocks* — the warning first, then the tab.
   *
   * ⚠️ The usage is recomputed **here**, at the moment the button is pressed, and not read off the
   * row the list rendered. A node open in a tab flushes its blocks to the model 300 ms after they
   * settle, so a count taken when this panel opened can be a count of a project that has since
   * changed.
   */
  const handleEdit = (row: SavedBlockRow) => {
    const usage = usageNow(row.definition.id);
    const name = row.definition.name;

    if (usage.total === 0) {
      openDefinitionTab(row.definition.id);
      return;
    }

    DialogLayerModel.instance.showDialog(
      (close) => (
        <LibraryDialog
          title={`Editing "${name}"`}
          message={describePropagation(name, usage)}
          lines={usageLines(usage)}
          note={describeRegeneration(usage)}
          confirmLabel="Edit blocks"
          onConfirm={() => openDefinitionTab(row.definition.id)}
          onClose={close}
        />
      ),
      { id: 'myblocks-propagation' }
    );
  };

  const handleRename = (row: SavedBlockRow) => {
    DialogLayerModel.instance.showDialog(
      (close) => (
        <RenameDialog
          current={row.definition.name}
          onAccept={(name) => {
            renameDefinition(row.definition.id, name);
            refresh();
          }}
          onClose={close}
        />
      ),
      { id: 'myblocks-rename' }
    );
  };

  const handleDuplicate = (row: SavedBlockRow) => {
    const copy = duplicateDefinition(row.definition.id);
    if (copy) ToastLayer.showSuccess(`Saved "${copy.name}".`);
    refresh();
  };

  /**
   * Delete, through the refusal that already exists.
   *
   * `removeDefinition` throws `MyBlocksInUseError` while anything still points at the definition.
   * That refusal is *rendered* rather than caught and softened, and the alternative §4 names —
   * inline-and-detach — is offered beside it, because the code for it is written and a refusal
   * with no way forward is how a builder ends up hand-editing `project.json`.
   */
  const handleDelete = (row: SavedBlockRow) => {
    const name = row.definition.name;
    const usage = usageNow(row.definition.id);

    if (usage.total === 0) {
      DialogLayerModel.instance.showConfirm({
        id: 'myblocks-delete',
        title: `Delete "${name}"?`,
        text: 'Nothing in this project uses it.',
        confirmText: 'Delete',
        onConfirm: () => {
          try {
            removeDefinition(row.definition.id);
            ToastLayer.showSuccess(`Deleted "${name}".`);
          } catch (error) {
            ToastLayer.showError(error instanceof Error ? error.message : String(error));
          }
          refresh();
        }
      });
      return;
    }

    DialogLayerModel.instance.showDialog(
      (close) => (
        <LibraryDialog
          title={`"${name}" is still in use`}
          message={describeDeleteRefusal(name, usage)}
          lines={usageLines(usage)}
          note={describeDetachOffer(name, usage)}
          extraLabel="Paste the blocks in and delete"
          onExtra={() => {
            try {
              const result = detachAndRemove(row.definition.id);
              ToastLayer.showSuccess(describeDetachResult(name, result.rewritten));
            } catch (error) {
              ToastLayer.showError(error instanceof Error ? error.message : String(error));
            }
            refresh();
          }}
          onClose={close}
        />
      ),
      { id: 'myblocks-delete' }
    );
  };

  /**
   * Export — the definition and its transitive closure, onto the clipboard.
   *
   * ⚠️ The clipboard rather than a file picker, deliberately: `exportDefinitions` already produces
   * the whole envelope and the import side already reads it, so what was missing was a way to get
   * the bytes out, and adding an Electron save-dialog surface to a settings panel is a larger
   * change than this task needs. Written down as a known shortcut rather than presented as the
   * finished export.
   */
  const handleExport = async (row: SavedBlockRow) => {
    try {
      const library = exportDefinition(row.definition.id);
      await navigator.clipboard.writeText(JSON.stringify(library, null, 2));
      ToastLayer.showSuccess(
        `Copied "${row.definition.name}" and its ${library.definitions.length - 1} dependencies to the clipboard.`
      );
    } catch (error) {
      ToastLayer.showError(`Could not copy "${row.definition.name}": ${error}`);
    }
  };

  return (
    <CollapsableSection title="Saved blocks" hasGutter hasVisibleOverflow hasTopDivider>
      <div className={css.Intro}>
        Blocks you saved from a Visual Function. Editing one changes every place that uses it.
      </div>

      {rows.length === 0 ? (
        <div className={css.Empty}>
          Nothing saved yet. In a Visual Function, right-click a block and choose <em>Save as block</em>.
        </div>
      ) : null}

      {rows.map((row) => {
        const { definition, scope, usage } = row;
        const sites = usageLines(usage);

        return (
          <div key={definition.id} className={css.Row} data-test="saved-block-row" data-definition-id={definition.id}>
            <div className={css.Head}>
              <span className={css.Glyph} aria-hidden="true">
                {MY_BLOCKS_GLYPH}
              </span>
              <span className={css.Name} title={definition.name}>
                {definition.name}
              </span>
              <span className={css.Shape}>{definition.shape}</span>
              <span className={css.Shelf} title={SHELF_NOTE[scope]}>
                {SHELF_LABEL[scope]}
              </span>
            </div>

            {definition.description ? <div className={css.Description}>{definition.description}</div> : null}

            <div className={css.Usage} data-test="saved-block-usage">
              {describeUsageShort(usage)}
            </div>

            {sites.length > 0 ? (
              <ul className={css.Sites}>
                {sites.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}

            <div className={css.Actions}>
              <button className={`${css.Action} ${css.ActionPrimary}`} onClick={() => handleEdit(row)}>
                Edit blocks
              </button>
              <button className={css.Action} onClick={() => handleRename(row)}>
                Rename
              </button>
              <button className={css.Action} onClick={() => handleDuplicate(row)}>
                Duplicate
              </button>
              <button className={css.Action} onClick={() => handleExport(row)}>
                Export
              </button>
              <button className={css.Action} onClick={() => handleDelete(row)}>
                Delete
              </button>
            </div>
          </div>
        );
      })}
    </CollapsableSection>
  );
}
