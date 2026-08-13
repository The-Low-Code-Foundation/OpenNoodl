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
 * ## VFN-010 — 🔴 one component, two instances
 *
 * The launcher's backpack manager is **this component with `shelf="user"`**, not a second one.
 * VFN-010 is explicit that a second Blockly host with its own save path is *"the one-fact-two-stores
 * shape"*, and the same argument applies one level up: two managers over one shelf would be two
 * places for rename to be wrong, and this register already carries a finding that parallel agents
 * solve the same problem twice.
 *
 * Exactly three things differ between the instances, and each is a fact about the surface rather
 * than a preference:
 *
 * 1. **Which shelf** — `backpackRows()` reads the user shelf directly, so a backpack definition
 *    that a project happens to shadow is still managed from the launcher.
 * 2. **Where the count comes from** — the project instance walks the open project (`usageNow`,
 *    cheap, on render). The launcher has no open project, so its count is a walk of every recent
 *    project **off disk**, behind an explicit action, with a timestamp and a stated scope.
 * 3. **Editing the blocks** — the launcher has no canvas. VFN-010's option 2: it manages the
 *    metadata and says, in words, that the blocks are opened from a project.
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
  backpackRows,
  detachAndRemove,
  duplicateDefinition,
  exportDefinition,
  importDefinitions,
  openDefinitionTab,
  removeBackpackDefinition,
  removeDefinition,
  renameDefinition,
  savedBlockRows,
  usageNow,
  type SavedBlockRow
} from '../../../BlocklyEditor/MyBlocksLibrary';
import { backpackUsageNow } from '../../../BlocklyEditor/MyBlocksRecentProjects';
import {
  noCrossProjectCheck,
  wasChecked,
  type CrossProjectUsage
} from '../../../BlocklyEditor/myblocks/crossProjectUsage';
import type { MyBlocksScope } from '../../../BlocklyEditor/myblocks/store';
import {
  BACKPACK_EDIT_NOTE,
  BACKPACK_EMPTY,
  BACKPACK_INTRO,
  MY_BLOCKS_GLYPH,
  SHELF_LABEL,
  SHELF_NOTE,
  crossProjectLines,
  describeCheckedAt,
  describeCrossProjectRefusal,
  describeCrossProjectUsage,
  describeDeleteRefusal,
  describeDetachOffer,
  describeDetachResult,
  describeExportResult,
  describeImportResult,
  describePropagation,
  describeRegeneration,
  describeUncheckedUsage,
  describeUsageShort,
  exportSucceeded,
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

export interface SavedBlocksSectionProps {
  /**
   * Which shelf this instance manages.
   *
   * Omitted — the project surface: **both** shelves, because a backpack block that a project uses
   * has to be visible from that project. `'user'` — the launcher surface: the backpack alone, with
   * a cross-project usage check in place of the project walk.
   */
  shelf?: MyBlocksScope;
}

export function SavedBlocksSection({ shelf }: SavedBlocksSectionProps = {}) {
  const isBackpack = shelf === 'user';
  const [rows, setRows] = useState<SavedBlockRow[]>([]);

  /**
   * VFN-010 — the cross-project answers, keyed by definition id.
   *
   * 🔴 Held here rather than on the row because it is **not** a property of the definition: it is
   * the result of a scan that ran at a particular moment over a particular list of projects, and
   * a definition with no entry has not been checked rather than being unused. `wasChecked` is that
   * distinction and every read below goes through it.
   */
  const [checks, setChecks] = useState<Record<string, CrossProjectUsage>>({});
  const [checking, setChecking] = useState<string | null>(null);

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
      setRows(isBackpack ? backpackRows() : savedBlockRows());
    } catch (error) {
      console.error('[SavedBlocks] Could not read the saved blocks', error);
      setRows([]);
    }
  }, [isBackpack]);

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

  /**
   * VFN-010 — *"check where this is used"*, as an action rather than a render.
   *
   * ⚠️ Scanning N projects off disk is I/O in a dialog, which is why this is a button and why the
   * answer arrives with a timestamp beside it. The result is stored under the definition's id and
   * `wasChecked` keeps "checked, found nothing" apart from "never asked" — rendering the two the
   * same way is how *"not used anywhere"* gets said about a check that never ran.
   */
  const runCheck = async (definitionId: string): Promise<CrossProjectUsage> => {
    setChecking(definitionId);
    try {
      const usage = await backpackUsageNow(definitionId);
      setChecks((previous) => ({ ...previous, [definitionId]: usage }));
      return usage;
    } catch (error) {
      ToastLayer.showError(`Could not read your recent projects: ${error}`);
      return noCrossProjectCheck(definitionId);
    } finally {
      setChecking(null);
    }
  };

  /**
   * Import — a library file's worth of definitions onto this surface's shelf.
   *
   * ⚠️ The clipboard, matching Export beside it: `exportDefinitions` already produces the whole
   * envelope and `importLibrary` already reads it, so what was missing was a way to move the bytes,
   * and an Electron file-dialog surface is a larger change than this task needs. A known shortcut,
   * written down rather than presented as the finished import.
   */
  const handleImport = async () => {
    const target: MyBlocksScope = shelf ?? 'project';
    try {
      const text = await navigator.clipboard.readText();
      const result = importDefinitions(JSON.parse(text), target);
      ToastLayer.showSuccess(describeImportResult(result.imported.length, result.rejected.length, target));
    } catch (error) {
      // A parse failure and a cycle refusal both land here, and both are reported: an import that
      // announced nothing would leave a builder believing the clipboard was empty.
      ToastLayer.showError(error instanceof Error ? error.message : String(error));
    }
    refresh();
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
    if (isBackpack) {
      void handleBackpackDelete(row);
      return;
    }

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
   * VFN-010 criterion 5 — delete from the backpack, refusing while a scanned project uses it.
   *
   * 🔴 **The scan is run here, not read off a previous check.** A builder who pressed *Check where
   * this is used* five minutes ago and then presses Delete is entitled to a refusal about the
   * project as it is now, and this is the one gesture where a stale answer is destructive. It is
   * the same rule VFN-009's `usageNow` follows for the open project, at the cost this surface has.
   *
   * ⚠️ **No inline-and-detach here.** The project surface offers it because it can rewrite the
   * bodies it is about to break; the launcher cannot — those bodies are in other projects, on disk,
   * possibly open in another window. Offering a repair this surface cannot perform would be worse
   * than refusing, so the refusal names where to go and does that instead.
   */
  const handleBackpackDelete = async (row: SavedBlockRow) => {
    const name = row.definition.name;
    const usage = await runCheck(row.definition.id);

    if (usage.siteCount > 0) {
      DialogLayerModel.instance.showDialog(
        (close) => (
          <LibraryDialog
            title={`"${name}" is still in use`}
            message={describeCrossProjectRefusal(name, usage)}
            lines={crossProjectLines(usage)}
            note={BACKPACK_EDIT_NOTE}
            onClose={close}
          />
        ),
        { id: 'myblocks-delete' }
      );
      return;
    }

    DialogLayerModel.instance.showConfirm({
      id: 'myblocks-delete',
      title: `Delete "${name}" from your backpack?`,
      text: describeCrossProjectUsage(name, usage),
      confirmText: 'Delete',
      onConfirm: () => {
        try {
          // Still through the store's refusal: another saved block on either shelf can call this
          // one, and that edge is one `referencesTo` away and has nothing to do with projects.
          removeBackpackDefinition(row.definition.id, usage);
          ToastLayer.showSuccess(`Deleted "${name}".`);
        } catch (error) {
          ToastLayer.showError(error instanceof Error ? error.message : String(error));
        }
        refresh();
      }
    });
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
    const name = row.definition.name;
    try {
      const library = exportDefinition(row.definition.id);

      /**
       * 🔴 A defect in VFN-009's merged section, found and fixed by VFN-010: the message was
       * written inline here and read `its ${library.definitions.length - 1} dependencies`, which
       * is **-1** for a definition that has left the shelf since this row was rendered — announced
       * as a *success* for a copy of nothing. Both halves are addressed: the arithmetic is in
       * `libraryIntent.ts` where a runner can grade it, and an empty export reports as a failure.
       */
      if (!exportSucceeded(library.definitions.length)) {
        ToastLayer.showError(describeExportResult(name, library.definitions.length));
        refresh();
        return;
      }

      await navigator.clipboard.writeText(JSON.stringify(library, null, 2));
      ToastLayer.showSuccess(describeExportResult(name, library.definitions.length));
    } catch (error) {
      ToastLayer.showError(`Could not copy "${name}": ${error}`);
    }
  };

  return (
    <CollapsableSection
      title={isBackpack ? 'My backpack' : 'Saved blocks'}
      hasGutter
      hasVisibleOverflow
      hasTopDivider
    >
      <div className={css.Intro}>
        {isBackpack ? BACKPACK_INTRO : 'Blocks you saved from a Visual Function. Editing one changes every place that uses it.'}
      </div>

      {/* 🔴 The launcher's limitation, stated in the UI rather than worked around. VFN-010 option 2. */}
      {isBackpack ? <div className={css.Intro}>{BACKPACK_EDIT_NOTE}</div> : null}

      {rows.length === 0 ? (
        <div className={css.Empty}>
          {isBackpack ? (
            BACKPACK_EMPTY
          ) : (
            <>
              Nothing saved yet. In a Visual Function, right-click a block and choose <em>Save as block</em>.
            </>
          )}
        </div>
      ) : null}

      {rows.map((row) => {
        const { definition, scope, usage } = row;
        const check = checks[definition.id] ?? noCrossProjectCheck(definition.id);
        const checked = wasChecked(check);

        // 🔴 Two different questions, and never the same answer rendered for both. `usage` is the
        // open project's census; `check` is a sample of the recent projects taken on demand. A row
        // with neither has not been asked, and says so.
        const sites = usage ? usageLines(usage) : checked ? crossProjectLines(check) : [];

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
              {usage
                ? describeUsageShort(usage)
                : checked
                ? describeCrossProjectUsage(definition.name, check)
                : describeUncheckedUsage(definition.name)}
            </div>

            {checked ? (
              <div className={css.Description} data-test="saved-block-checked-at">
                {describeCheckedAt(check)}
              </div>
            ) : null}

            {sites.length > 0 ? (
              <ul className={css.Sites}>
                {sites.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}

            <div className={css.Actions}>
              {isBackpack ? (
                <button
                  className={`${css.Action} ${css.ActionPrimary}`}
                  disabled={checking === definition.id}
                  onClick={() => void runCheck(definition.id)}
                >
                  {checking === definition.id ? 'Checking…' : 'Check where this is used'}
                </button>
              ) : (
                <button className={`${css.Action} ${css.ActionPrimary}`} onClick={() => handleEdit(row)}>
                  Edit blocks
                </button>
              )}
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

      {/* Import sits below the list rather than on a row: it is about the shelf, not a definition. */}
      <div className={css.Actions}>
        <button className={css.Action} onClick={() => void handleImport()}>
          Import from clipboard
        </button>
      </div>
    </CollapsableSection>
  );
}
