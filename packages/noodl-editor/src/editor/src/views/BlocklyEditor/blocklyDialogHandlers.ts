/**
 * VFN-003 — the callback contract Blockly's dialogs are written against.
 *
 * > *"Clicking 'create variable' does nothing."*
 *
 * Nothing in this repo ever replaced `Blockly.dialog`'s default implementations, so
 * `Blockly.Variables.createVariableButtonHandler` asked for the name through the one
 * `window.prompt` in the bundle — and **an Electron renderer does not implement `prompt()`**. It
 * opens nothing and returns nothing; the callback never receives a name and the handler returns
 * without creating a variable. Silently: nothing throws, so it reads as a dead button.
 *
 * This module is the contract half, kept free of React so it can be asserted directly. The
 * surface that actually draws something is injected — see `BlocklyDialogs.tsx`.
 *
 * ## 🔴 Three things the contract will not forgive
 *
 * 1. **`callback(null)` on cancel, never `callback('')`.** Blockly reads `null` as "the user
 *    backed out"; an empty string is a name the user chose. The same `undefined` ≠ `''`
 *    distinction the code-generation seam learned the expensive way, in a different costume.
 * 2. **Exactly once.** Twice creates two variables. Never, and the flyout is left in a state that
 *    looks exactly like this bug. A dialog that fires `onAccept` and then an `onClose` on the way
 *    out is the ordinary shape of that mistake, so the guard is here rather than in each surface.
 * 3. **The alert's callback is load-bearing, not decoration.** `createVariableButtonHandler`
 *    re-opens the prompt *from inside* the alert's callback when a name is already taken — that
 *    is how "refused, with the dialog still open" is spelled in Blockly. An alert that dismisses
 *    without calling back does not merely skip a message; it ends the whole gesture.
 *
 * @module BlocklyEditor
 */

export interface BlocklyPromptRequest {
  message: string;
  defaultValue: string;
  /** The user named it. The value is trimmed; Blockly trims again, and agrees. */
  onAccept: (value: string) => void;
  /** The user backed out — Escape, the backdrop, or Cancel. */
  onCancel: () => void;
}

export interface BlocklyConfirmRequest {
  message: string;
  onConfirm: () => void;
  onAbort: () => void;
}

export interface BlocklyAlertRequest {
  message: string;
  onDismiss: () => void;
}

/** Whatever can put a dialog on screen. The real one is `DialogLayerModel`. */
export interface BlocklyDialogSurface {
  showPrompt(request: BlocklyPromptRequest): void;
  showConfirm(request: BlocklyConfirmRequest): void;
  showAlert(request: BlocklyAlertRequest): void;
}

export interface BlocklyDialogHandlers {
  prompt: (message: string, defaultValue: string, callback: (result: string | null) => void) => void;
  confirm: (message: string, callback: (result: boolean) => void) => void;
  alert: (message: string, callback?: () => void) => void;
}

/**
 * Let a callback through once and swallow every later attempt.
 *
 * The surfaces are dialogs, and a dialog has more than one way out. Making "exactly once" the
 * property of this seam rather than of each dialog means a surface can be careless about it and
 * still be correct — which is the only version of the rule that survives a second surface.
 */
function once<T extends unknown[]>(callback: (...args: T) => void): (...args: T) => void {
  let called = false;
  return (...args: T) => {
    if (called) return;
    called = true;
    callback(...args);
  };
}

/**
 * The three functions to hand to `Blockly.dialog.setPrompt` / `setConfirm` / `setAlert`.
 *
 * They are deliberately plain: a message in, a callback out, no knowledge of what draws them.
 */
export function createBlocklyDialogHandlers(surface: BlocklyDialogSurface): BlocklyDialogHandlers {
  return {
    prompt(message, defaultValue, callback) {
      const answer = once(callback);

      surface.showPrompt({
        message,
        defaultValue: defaultValue ?? '',
        onAccept: (value) => answer(value.trim()),
        // 🔴 `null`, not `''`. See the note at the top of this file.
        onCancel: () => answer(null)
      });
    },

    confirm(message, callback) {
      const answer = once(callback);

      surface.showConfirm({
        message,
        onConfirm: () => answer(true),
        onAbort: () => answer(false)
      });
    },

    alert(message, callback) {
      // Blockly's `alert` callback is optional in the type and mandatory in practice for the
      // name-already-taken path. Normalising it here means the surface always has something to
      // call and never has to decide whether to.
      const dismissed = once(callback ?? (() => undefined));

      surface.showAlert({
        message,
        onDismiss: () => dismissed()
      });
    }
  };
}
