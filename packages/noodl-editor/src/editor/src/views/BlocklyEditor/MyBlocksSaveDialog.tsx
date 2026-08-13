/**
 * LGC-007 §1 — the save dialog.
 *
 * The surface, and only the surface. Every decision it shows was made elsewhere: the shape by
 * `myblocks/shape.ts`, the sentences by `myblocks/saveIntent.ts`, the write by
 * `myblocks/store.ts`. This file arranges them and holds the two bits of state a form has.
 *
 * ## What it shows before the builder commits, and why
 *
 * §1 asks for "a name, the inferred shape and its plain-English reason". It shows a fourth
 * thing as well — **how many blocks are going in** — because the gesture is one right-click and
 * it takes everything inside and below the block that was clicked. A builder who right-clicked
 * the middle of a stack has no other way to discover that before the block is on the shelf.
 *
 * ## The shelf picker defaults to the project
 *
 * See `DEFAULT_SCOPE`. The cheaper mistake is the default: a block saved to the project by
 * accident is one extra entry in `project.json`; a block saved to the backpack by accident is
 * one that works until a collaborator opens the project.
 *
 * ## ⚠️ A refused save is shown, never swallowed
 *
 * `commit` throws `MyBlocksCycleError` when the write would make the definition graph cyclic —
 * §3's save-time half, and the message names the loop. It is caught here and rendered in place,
 * with the dialog left open and nothing written. A save dialog that closed on a refusal would
 * be the same failure this feature has already shipped twice in a different costume: a refusal
 * that does not say so.
 *
 * ## 🔴 VFN-007 — the shelf picker has no native radios, and the reason is structural
 *
 * `BaseDialog` renders its children **twice**, once into a zero-height measuring container and
 * once visibly. A native radio group is document-scoped by `name`, so two options were four
 * radios in one group and the browser kept the check on the *invisible* copy — a control that
 * took the builder's decision and showed nothing. The picker is now an ARIA radiogroup of themed
 * cards, whose entire selected state is React's. See `myblocks/shelfChoice.ts` for the
 * measurement.
 *
 * @module BlocklyEditor
 */

import classNames from 'classnames';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextInput, TextInputVariant } from '@noodl-core-ui/components/inputs/TextInput';
import { CoreBaseDialog } from '@noodl-core-ui/components/layout/BaseDialog';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextSize, TextType } from '@noodl-core-ui/components/typography/Text';

import { DialogLayerModel } from '@noodl-models/DialogLayerModel';

import { ToastLayer } from '../ToastLayer';
import type { SaveBlockRequest } from './MyBlocksSave';
import css from './MyBlocksSaveDialog.module.scss';
import {
  checkBlockName,
  describeBlocksLeftBehind,
  describeCallPreview,
  describeOutlineTally,
  describeSaveSelection,
  describeShape,
  describeVariableWarning,
  MAX_BLOCK_DESCRIPTION_LENGTH,
  normaliseBlockDescription,
  normaliseBlockName
} from './myblocks/saveIntent';
import { collectVariableReferences } from './myblocks/references';
import { shelfAfterKey, SHELF_OPTIONS } from './myblocks/shelfChoice';
import type { MyBlocksScope } from './myblocks/store';

/** The group's accessible name. Also the visible caption above it — one string, so they agree. */
const SHELF_LEGEND = 'Save it in';

export interface MyBlocksSaveDialogProps {
  request: SaveBlockRequest;
  onClose: () => void;
}

export function MyBlocksSaveDialog({ request, onClose }: MyBlocksSaveDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<MyBlocksScope>(request.defaultScope);
  const [refusal, setRefusal] = useState<string | null>(null);
  const committed = useRef(false);

  /**
   * The row elements, so an arrow key can move focus to the option it just selected.
   *
   * ⚠️ Per component *instance*, which is what makes this safe under `BaseDialog`'s double
   * render: the measuring copy holds its own refs and its own focus, and neither instance can
   * reach into the other. That is precisely the property the native radio group did not have.
   */
  const rows = useRef<Partial<Record<MyBlocksScope, HTMLDivElement | null>>>({});

  const shape = useMemo(() => describeShape(request.signature), [request.signature]);
  const verdict = checkBlockName(name, request.taken);

  /**
   * VFN-008 — the variables this body uses and will not take with it.
   *
   * Computed from the body rather than remembered, because it is the body that is about to be
   * written. Said here, at save time, because it is the last moment the builder can do anything
   * about it — the alternative honest answer, silently creating the variables in whatever
   * workspace the block is later dropped into, is a definition authoring someone else's program.
   */
  const variableWarning = useMemo(
    () => describeVariableWarning(collectVariableReferences(request.body)),
    [request.body]
  );

  /** The face of the block being named: `▣ Discount   price   rate`. */
  const preview = describeCallPreview(name, request.signature.params);

  /**
   * VFN-006 — how many of the blocks going in are actually outlined on the workspace behind.
   *
   * ⚠️ **The drawn count, not the requested one.** The sentence under the shape card says
   * *"outlined behind this dialog"*, and a dialog that says that over a workspace with no
   * outline on it has replaced a vague sentence with a false one — which is worse, because it
   * sends the builder looking. `pin` answers with what it drew.
   */
  const [outlinedCount, setOutlinedCount] = useState(0);

  useEffect(() => {
    const outline = request.outline;
    if (!outline) return undefined;

    setOutlinedCount(outline.pin(request.previewBlockIds));
    /**
     * 🔴 Criterion 2, and it is one line because it has to be: *the outline disappears on save,
     * on cancel and on Escape.* All three of those are this component unmounting, and there is
     * no fourth way out — so the withdrawal is tied to the unmount rather than to three
     * handlers, one of which would eventually be added without its `unpin`.
     */
    return () => outline.unpin();
  }, [request]);

  // Every block, or the sentence does not get to claim an outline. A partial outline is a
  // different fact and does not have a sentence.
  const isOutlined = outlinedCount > 0 && outlinedCount === request.blockCount;
  const tally = describeOutlineTally(request.blockCount, isOutlined);
  const leftBehind = describeBlocksLeftBehind(request.blocksAbove);

  function chooseShelf(next: MyBlocksScope, moveFocus: boolean) {
    setScope(next);
    if (moveFocus) rows.current[next]?.focus();
  }

  // Nothing typed yet is not a mistake, it is the starting state — so the refusal message under
  // the field waits until the builder has been in there. The button is disabled either way.
  const nameMessage = name.length > 0 ? verdict.message : undefined;

  function handleSave() {
    if (!verdict.ok) return;
    /**
     * ⚠️ Once only. `commit` mints a **fresh id** on every call — it is a create, not an
     * upsert — so a double-click or an Enter landing on top of a click would put two identical
     * definitions on the shelf with different ids, and the toolbox would show both. A ref
     * rather than state: the second call happens before React has re-rendered.
     */
    if (committed.current) return;
    committed.current = true;
    try {
      const definition = request.commit({
        name: normaliseBlockName(name),
        // 🔴 `undefined` when blank, never `''` — see `normaliseBlockDescription`. Every
        // definition written before VFN-008 has this field absent, and "no description" has to
        // be one value rather than two or every reader downstream inherits the distinction.
        description: normaliseBlockDescription(description),
        scope
      });
      ToastLayer.showSuccess(
        scope === 'project'
          ? `Saved "${definition.name}". It is in the My Blocks category of every Visual Function in this project.`
          : `Saved "${definition.name}" to your backpack. It is in the My Blocks category in every project.`
      );
      onClose();
    } catch (error) {
      // §3, at save time. The message names the loop; showing it in place is the point. The
      // latch is released — nothing was written, so a second attempt is a first attempt.
      committed.current = false;
      setRefusal((error as Error)?.message || 'That could not be saved.');
    }
  }

  return (
    <CoreBaseDialog title="Save as a block" isVisible hasBackdrop onClose={onClose}>
      <Box hasXSpacing hasYSpacing UNSAFE_className={css.Root}>
        <VStack hasSpacing={3}>
          <TextInput
            label="Name"
            value={name}
            placeholder={request.suggestedName || 'What does it do?'}
            variant={TextInputVariant.InModal}
            isAutoFocus
            onChange={(event) => {
              setName(event.target.value);
              setRefusal(null);
            }}
            onEnter={handleSave}
            // Escape on the field rather than on the document: Blockly's shortcut registry
            // ignores key events whose target is an input, so this is the only handler that
            // sees it, and a dialog that traps Escape at the document level would also swallow
            // it for the workspace underneath.
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            }}
          />

          {nameMessage ? (
            <Text size={TextSize.Small} textType={verdict.ok ? TextType.Shy : TextType.Danger}>
              {nameMessage}
            </Text>
          ) : null}

          {/*
            VFN-008 §1 — the tap that was never fitted. `MyBlockDefinition.description` has been
            in the format and written by `save()` since LGC-007, and nothing ever asked for one,
            so every definition on every shelf has it `undefined`.

            Optional, and deliberately so: a required description on a save dialog is a field
            that gets filled with `x`.
          */}
          <TextInput
            label="Description (optional)"
            value={description}
            placeholder="What does it do, and when would you use it?"
            variant={TextInputVariant.InModal}
            onChange={(event) => setDescription(event.target.value.slice(0, MAX_BLOCK_DESCRIPTION_LENGTH))}
            onEnter={handleSave}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            }}
          />

          <div className={css.ShapeCard}>
            <VStack hasSpacing={2}>
              {/*
                🔴 VFN-006 — *"These 5 blocks"* was **deictic**: it pointed, and the dialog is
                modal and centred, so there was nothing on screen for it to point at. The number
                was never wrong. What follows is the same fact said definitely, plus a tally that
                hands the number to the outline now drawn on the workspace behind — and the
                tally only claims an outline when one was actually painted.
              */}
              <Text size={TextSize.Medium} textType={TextType.Proud} className={css.ShapeName}>
                {describeSaveSelection(request.blockCount, shape.shapeName)}
              </Text>
              {tally ? (
                <Text size={TextSize.Small} textType={TextType.Shy}>
                  {tally}
                </Text>
              ) : null}
              {leftBehind ? (
                // Notice and not Danger: nothing is wrong, and nothing is being refused. This is
                // the mid-stack right-click saying which half of the stack it is taking — the
                // surprise the report is actually about.
                <Text size={TextSize.Small} textType={TextType.Notice}>
                  {leftBehind}
                </Text>
              ) : null}
              <Text size={TextSize.Small}>{shape.consequence}</Text>
              <Text size={TextSize.Small} textType={TextType.Shy}>
                {shape.reason} {shape.inputs}
              </Text>
              {/*
                VFN-008 §4 — the block's actual face, so the name being typed is visibly being
                attached to a signature rather than to an abstraction. These are the resolved
                parameter names `rebuildInputs_` will render, not a restatement of the count.
              */}
              <div className={css.CallPreview}>{preview}</div>
            </VStack>
          </div>

          {variableWarning ? (
            // Notice and not Danger: the save is fine and is not being refused. What is being
            // said is that one part of it will not survive the trip.
            <Text size={TextSize.Small} textType={TextType.Notice} className={css.VariableWarning}>
              {variableWarning}
            </Text>
          ) : null}

          {/*
            🔴 VFN-007 — an ARIA radiogroup of cards, and **not** `<input type="radio">`.

            `BaseDialog` renders every dialog body twice (a zero-height measuring copy and the
            visible one), and a native radio group is scoped to the document by `name` — so the
            two options were four radios in one group and the browser kept the check on the
            invisible copy. Nothing painted, while React's state was right the whole time.

            A card owns its selected state entirely through React, so the duplicate render cannot
            reach it. It also buys the contrast the native control could not: the indicator is on
            `--theme-color-primary`, which measures 6.45:1 dark and 4.33:1 light against the card
            it sits on, where a Chromium default radio on a dark sheet had no measurable mark at
            all.

            ⚠️ The row is the control, so the whole row — including the consequence note, which
            is the entire reason this is not a `<select>` — is clickable. It is not a `<label>`
            any more, because a `<label>` with no labelable control inside it labels nothing.
          */}
          <div className={css.Shelves} role="radiogroup" aria-label={SHELF_LEGEND}>
            <Text size={TextSize.Small} textType={TextType.Shy}>
              {SHELF_LEGEND}
            </Text>
            {SHELF_OPTIONS.map((option) => {
              const isChosen = scope === option.value;
              return (
                <div
                  key={option.value}
                  ref={(element) => {
                    rows.current[option.value] = element;
                  }}
                  className={classNames(css.Shelf, isChosen && css['is-chosen'])}
                  data-shelf={option.value}
                  role="radio"
                  aria-checked={isChosen}
                  // Roving tabindex: one Tab stop for the group, arrows move within it.
                  tabIndex={isChosen ? 0 : -1}
                  onClick={() => chooseShelf(option.value, false)}
                  onKeyDown={(event) => {
                    const next = shelfAfterKey(event.key, scope);
                    // 🔴 Only ours. Returning the current scope for every unknown key would
                    // swallow Tab and Escape and trap the builder in the dialog.
                    if (!next) return;
                    event.preventDefault();
                    chooseShelf(next, true);
                  }}
                >
                  <span className={css.ShelfMark} aria-hidden="true" />
                  <span className={css.ShelfText}>
                    <Text size={TextSize.Small}>{option.label}</Text>
                    <Text size={TextSize.Small} textType={TextType.Shy}>
                      {option.note}
                    </Text>
                  </span>
                </div>
              );
            })}
          </div>

          {refusal ? (
            <Text size={TextSize.Small} textType={TextType.Danger}>
              {refusal}
            </Text>
          ) : null}

          <div className={css.Actions}>
            {/* Button convention (UIX-004): primary on the right, cancel to its left. */}
            <HStack hasSpacing={2}>
              <PrimaryButton
                label="Cancel"
                variant={PrimaryButtonVariant.Muted}
                size={PrimaryButtonSize.Small}
                onClick={onClose}
              />
              <PrimaryButton
                label="Save"
                size={PrimaryButtonSize.Small}
                isDisabled={!verdict.ok}
                onClick={handleSave}
              />
            </HStack>
          </div>
        </VStack>
      </Box>
    </CoreBaseDialog>
  );
}

/**
 * Show it.
 *
 * This is the `openDialog` seam `attachMyBlocksSave` takes — the one place React and Blockly
 * meet in this feature, and it is a function call in each direction and nothing else.
 */
export function openSaveBlockDialog(request: SaveBlockRequest): void {
  DialogLayerModel.instance.showDialog(
    (close) => <MyBlocksSaveDialog request={request} onClose={close} />,
    // One at a time: a second right-click while the dialog is open replaces it rather than
    // stacking a second sheet over the first.
    { id: 'myblocks-save' }
  );
}
