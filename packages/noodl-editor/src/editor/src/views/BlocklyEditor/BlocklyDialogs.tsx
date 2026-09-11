/**
 * VFN-003 — the dialogs Electron does not have.
 *
 * `Blockly.dialog` falls back to `window.alert`, `window.confirm` and `window.prompt` unless
 * something replaces them. **An Electron renderer does not implement `prompt()`** — so *Create
 * variable* and *Rename variable* opened nothing, returned nothing and created nothing, without
 * an error or a toast. `confirm()` and `alert()` do exist, but as native OS sheets with no theme.
 *
 * All four are fixed by one seam, which is why this registers all three rather than the one the
 * report named: doing only *Create variable* would leave *Rename* dead, and a builder would
 * discover the fix was partial.
 *
 * The callback contract lives next door in `blocklyDialogHandlers.ts`, deliberately free of
 * React so it can be asserted directly. This file is the surface: what the builder sees.
 *
 * ⚠️ **Everything below is mounted twice.** `CoreBaseDialog` renders `{children}` into a
 * zero-height measuring container as well as into the visible one, so each dialog here exists as
 * two React instances with two of every control and two copies of every piece of state. The
 * measuring copy is `pointer-events: none`, so a builder cannot reach it — but anything that
 * touches a *global* on mount will do it twice, which is what `useEphemeralBlocklyFocus` had to
 * be taught. Bear it in mind before adding a control that registers something.
 *
 * That duplication is also why the callback guard lives in `blocklyDialogHandlers.ts` rather than
 * only in these components: `once()` there holds Blockly's contract no matter how many instances
 * of a dialog answer it.
 *
 * @module BlocklyEditor
 */

import React, { useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly';

import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextInput, TextInputVariant } from '@noodl-core-ui/components/inputs/TextInput';
import { CoreBaseDialog } from '@noodl-core-ui/components/layout/BaseDialog';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text } from '@noodl-core-ui/components/typography/Text';

import { DialogLayerModel } from '@noodl-models/DialogLayerModel';

import {
  BlocklyAlertRequest,
  BlocklyConfirmRequest,
  BlocklyDialogSurface,
  BlocklyPromptRequest,
  createBlocklyDialogHandlers
} from './blocklyDialogHandlers';

/**
 * Hold Blockly's `FocusManager` off while a dialog of ours is on screen.
 *
 * Blockly 12 restores focus to its active node when focus moves, which is correct for a native
 * `prompt` — the browser freezes everything behind it — and wrong for a dialog rendered into the
 * same document, whose text field it would take focus straight back from. Blockly's own note on
 * `setPrompt` says so: *"non-native prompt experiences may require managing ephemeral focus"*.
 *
 * Guarded, because a workspace does not have to exist for a dialog to be asked for, and being
 * unable to hold focus is not a reason to refuse to show the dialog.
 *
 * 🔴 **`ephemeralFocusTaken()` is not defensive tidiness — without it this throws on every open.**
 * `CoreBaseDialog` renders `{children}` **twice**: once inside a zero-height
 * `MeasuringContainer` it measures the body with, and once in the visible `ChildContainer`
 * ([`BaseDialog.tsx:330,360`](../../../../../noodl-core-ui/src/components/layout/BaseDialog/BaseDialog.tsx)).
 * So every dialog body is mounted as two React instances, this hook runs twice, and Blockly's
 * contract is explicit that *"only 1 ephemeral focus context can be active at any given time
 * (attempting to activate more than one simultaneously will result in an error being thrown)"*.
 *
 * The measuring copy renders first, so it is the one that holds the lock and the visible copy is
 * the one that threw. The `catch` below made that survivable and invisible — a thrown exception
 * and a console warning on every prompt. The guard makes it a deliberate no-op instead.
 *
 * ⚠️ Release accounting is what the guard must not break: exactly one instance ends up with a
 * `release`, and Blockly throws on a second call to it just as it does on a second take. The
 * instance that skipped has `undefined` and calls nothing, so the lambda is called exactly once —
 * which its own docs require, on pain of *"automatic focus will no longer work anywhere on the
 * page"*.
 */
function useEphemeralBlocklyFocus(element: HTMLElement | null) {
  useEffect(() => {
    if (!element) return undefined;

    let release: (() => void) | undefined;
    try {
      const focusManager = Blockly.getFocusManager();
      // The other copy of this same dialog body already holds it. See above.
      if (focusManager.ephemeralFocusTaken()) return undefined;
      release = focusManager.takeEphemeralFocus(element);
    } catch (error) {
      console.warn('[BlocklyDialogs] Could not take ephemeral focus from Blockly:', error);
    }

    return () => {
      try {
        release?.();
      } catch (error) {
        console.warn('[BlocklyDialogs] Could not return ephemeral focus to Blockly:', error);
      }
    };
  }, [element]);
}

interface BlocklyPromptDialogProps {
  request: BlocklyPromptRequest;
  onClose: () => void;
}

/**
 * The one dialog that had no equivalent: a message, a field, and two ways out.
 *
 * The message *is* the title — Blockly's prompts are questions already ("New variable name:"),
 * so a second heading above one would be a heading about a heading.
 */
export function BlocklyPromptDialog({ request, onClose }: BlocklyPromptDialogProps) {
  const [value, setValue] = useState(request.defaultValue);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const settled = useRef(false);

  useEphemeralBlocklyFocus(root);

  /**
   * Exactly one of accept and cancel, and the dialog closes either way.
   *
   * `createBlocklyDialogHandlers` guards this as well, and both guards are wanted: that one
   * keeps Blockly's contract whatever a surface does, this one keeps the dialog from acting
   * twice on its own state.
   */
  function settle(answer: 'accept' | 'cancel') {
    if (settled.current) return;
    settled.current = true;

    onClose();
    if (answer === 'accept') request.onAccept(value);
    else request.onCancel();
  }

  const canAccept = value.trim().length > 0;

  return (
    <CoreBaseDialog title={request.message} isVisible hasBackdrop onClose={() => settle('cancel')}>
      <div ref={setRoot}>
        <Box hasXSpacing hasYSpacing UNSAFE_style={{ minWidth: '320px' }}>
          <VStack hasSpacing={3}>
            <TextInput
              value={value}
              variant={TextInputVariant.InModal}
              isAutoFocus
              onChange={(event) => setValue(event.target.value)}
              onEnter={() => canAccept && settle('accept')}
              /**
               * ⚠️ Escape on the field, not on the document. The Logic Builder window carries
               * `data-keyboard-scope`, so while focus is inside it no editor command runs and
               * Escape is not turned into a blur — the surface owns it. This dialog is portalled
               * *outside* that subtree, so its Escape is its own to handle. The save dialog
               * holds the same rule for the same reason.
               */
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  settle('cancel');
                }
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {/* Button convention (UIX-004): primary on the right, cancel to its left. */}
              <HStack hasSpacing={2}>
                <PrimaryButton
                  label="Cancel"
                  variant={PrimaryButtonVariant.Muted}
                  size={PrimaryButtonSize.Small}
                  onClick={() => settle('cancel')}
                />
                <PrimaryButton
                  label="OK"
                  size={PrimaryButtonSize.Small}
                  isDisabled={!canAccept}
                  onClick={() => settle('accept')}
                />
              </HStack>
            </div>
          </VStack>
        </Box>
      </div>
    </CoreBaseDialog>
  );
}

interface BlocklyAlertDialogProps {
  request: BlocklyAlertRequest;
  onClose: () => void;
}

/**
 * A statement with one way out.
 *
 * 🔴 Dismissing it **must** call back. `createVariableButtonHandler` re-opens the prompt from
 * inside this callback when the name is already taken — that is how Blockly spells "refused,
 * with the gesture still alive". An alert that swallows its callback does not lose a message; it
 * ends the whole interaction, silently, which is the defect this task exists for.
 */
export function BlocklyAlertDialog({ request, onClose }: BlocklyAlertDialogProps) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const dismissed = useRef(false);

  useEphemeralBlocklyFocus(root);

  function dismiss() {
    if (dismissed.current) return;
    dismissed.current = true;

    onClose();
    request.onDismiss();
  }

  return (
    <CoreBaseDialog title="Blocks" isVisible hasBackdrop onClose={dismiss}>
      <div ref={setRoot}>
        <Box hasXSpacing hasYSpacing UNSAFE_style={{ maxWidth: '400px' }}>
          <VStack hasSpacing={3}>
            <Text>{request.message}</Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <PrimaryButton label="OK" size={PrimaryButtonSize.Small} onClick={dismiss} />
            </div>
          </VStack>
        </Box>
      </div>
    </CoreBaseDialog>
  );
}

/** The surface Blockly's dialogs are drawn on: this editor's own dialog layer. */
export const dialogLayerSurface: BlocklyDialogSurface = {
  showPrompt(request: BlocklyPromptRequest) {
    DialogLayerModel.instance.showDialog(
      (close) => <BlocklyPromptDialog request={request} onClose={close} />,
      // One at a time. The name-already-taken path opens a fresh prompt from inside the alert's
      // callback, and that one replaces this rather than stacking on it.
      { id: 'blockly-prompt' }
    );
  },

  showConfirm(request: BlocklyConfirmRequest) {
    DialogLayerModel.instance.showConfirm({
      id: 'blockly-confirm',
      title: 'Are you sure?',
      text: request.message,
      onConfirm: request.onConfirm,
      onAbort: request.onAbort
    });
  },

  showAlert(request: BlocklyAlertRequest) {
    DialogLayerModel.instance.showDialog((close) => <BlocklyAlertDialog request={request} onClose={close} />, {
      id: 'blockly-alert'
    });
  }
};

let dialogsRegistered = false;

/**
 * Point `Blockly.dialog` at this editor's dialog layer.
 *
 * Idempotent, like every other Blockly registry call in this directory — the registries are
 * module-global, so this runs once per renderer however many workspaces are injected.
 */
export function initBlocklyDialogs(surface: BlocklyDialogSurface = dialogLayerSurface) {
  if (dialogsRegistered) return;

  const handlers = createBlocklyDialogHandlers(surface);

  Blockly.dialog.setPrompt(handlers.prompt);
  Blockly.dialog.setConfirm(handlers.confirm);
  Blockly.dialog.setAlert(handlers.alert);

  dialogsRegistered = true;
}
