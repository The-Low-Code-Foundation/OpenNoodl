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
 * @module BlocklyEditor
 */

import React, { useMemo, useState } from 'react';

import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Select } from '@noodl-core-ui/components/inputs/Select';
import { TextInput, TextInputVariant } from '@noodl-core-ui/components/inputs/TextInput';
import { CoreBaseDialog } from '@noodl-core-ui/components/layout/BaseDialog';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextSize, TextType } from '@noodl-core-ui/components/typography/Text';

import { DialogLayerModel } from '@noodl-models/DialogLayerModel';

import { ToastLayer } from '../ToastLayer';
import type { SaveBlockRequest } from './MyBlocksSave';
import css from './MyBlocksSaveDialog.module.scss';
import { checkBlockName, describeShape, normaliseBlockName } from './myblocks/saveIntent';
import type { MyBlocksScope } from './myblocks/store';

const SHELF_OPTIONS = [
  // "This project" first, and selected by default: it is the shelf that travels with the
  // project, and §2's whole reason for having two.
  { label: 'This project — everyone who opens it gets this block', value: 'project' },
  { label: 'My backpack — only me, but in every project', value: 'user' }
];

export interface MyBlocksSaveDialogProps {
  request: SaveBlockRequest;
  onClose: () => void;
}

export function MyBlocksSaveDialog({ request, onClose }: MyBlocksSaveDialogProps) {
  const [name, setName] = useState('');
  const [scope, setScope] = useState<MyBlocksScope>(request.defaultScope);
  const [refusal, setRefusal] = useState<string | null>(null);

  const shape = useMemo(() => describeShape(request.signature), [request.signature]);
  const verdict = checkBlockName(name, request.taken);

  // Nothing typed yet is not a mistake, it is the starting state — so the refusal message under
  // the field waits until the builder has been in there. The button is disabled either way.
  const nameMessage = name.length > 0 ? verdict.message : undefined;

  function handleSave() {
    if (!verdict.ok) return;
    try {
      const definition = request.commit({ name: normaliseBlockName(name), scope });
      ToastLayer.showSuccess(
        scope === 'project'
          ? `Saved "${definition.name}". It is in the My Blocks category of every Visual Function in this project.`
          : `Saved "${definition.name}" to your backpack. It is in the My Blocks category in every project.`
      );
      onClose();
    } catch (error) {
      // §3, at save time. The message names the loop; showing it in place is the point.
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

          <div className={css.ShapeCard}>
            <VStack hasSpacing={2}>
              <Text size={TextSize.Medium} textType={TextType.Proud} className={css.ShapeName}>
                {request.blockCount === 1 ? 'This block becomes ' : `These ${request.blockCount} blocks become `}
                {shape.shapeName}.
              </Text>
              <Text size={TextSize.Small}>{shape.consequence}</Text>
              <Text size={TextSize.Small} textType={TextType.Shy}>
                {shape.reason} {shape.inputs}
              </Text>
            </VStack>
          </div>

          <Select
            label="Save it in"
            options={SHELF_OPTIONS}
            value={scope}
            onChange={(value) => setScope(value as MyBlocksScope)}
          />

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
