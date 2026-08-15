import { KeyMod, KeyCode } from './keyboard/KeyCode';
import { KeyCodeUtils } from './keyboard/KeyCodeMapper';

export interface KeyboardCommand {
  handler: () => void;
  keybinding: number; //e.g. KeyMod.CtrlCmd | KeyCode.KEY_V
  weight?: number;
  type?: 'up' | 'down'; //default is down
}

function getKeyMod(evt: KeyboardEvent): number {
  let modKey = 0;
  if (evt.metaKey || evt.ctrlKey) modKey |= KeyMod.CtrlCmd; // | KeyMod.WinCtrl
  if (evt.shiftKey) modKey |= KeyMod.Shift;
  if (evt.altKey) modKey |= KeyMod.Alt;
  return modKey;
}

type KeyEventHandler = (event: KeyboardEvent) => void;
type MouseEventHandler = (event: MouseEvent) => void;

/**
 * F21: what the focused element means for a keystroke.
 *
 * The old predicate asked only "is anything focusable focused?" and declined to
 * run *any* command if so. In Chromium a `<button>` takes focus when you click
 * it, so clicking any rail icon, toolbar button or panel header silently
 * disabled every editor shortcut (⌘F, ⌘D, ⌘R, ⌘⇧X, ⌘⇧E, ⌫, arrows, …) until
 * you happened to click somewhere unfocusable. A `<button>` is not a text
 * input, so the predicate — not the individual commands — was what was wrong.
 *
 * - `text-entry`  the user is entering text. Every keystroke belongs to the
 *                 field; no command runs. Escape leaves the field.
 * - `activatable` a control the platform activates with Space/Enter (button,
 *                 link, menu item, tab, checkbox role, …). Only those two keys
 *                 belong to the control; every other shortcut runs normally.
 * - `own-surface` a surface that runs its own shortcut registry. No editor
 *                 command runs while focus is inside it, and Escape is *not*
 *                 turned into a blur — the surface handles it.
 * - `none`        nothing meaningful is focused; all commands run.
 */
export type KeyboardFocusKind = 'none' | 'text-entry' | 'activatable' | 'own-surface';

const TEXT_ENTRY_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * CodeMirror 6 puts focus on `.cm-content`, which is `contenteditable` and so
 * already caught — but `propertyeditor.ts` focuses it by selector and CM's own
 * search/goto panels host plain inputs, so match the whole editor subtree
 * rather than relying on one attribute staying put.
 */
const CODE_EDITOR_SELECTOR = '.cm-editor';

/**
 * 🔴 L30 — a surface that owns its own keystrokes declares so on its root.
 *
 * The case this exists for is the Logic Builder's floating block editor (LGC-010). Blockly runs
 * a full shortcut registry of its own — Delete, ⌘C/⌘X/⌘V, ⌘Z/⌘⇧Z — on its own document
 * listeners, and a focused Blockly workspace is an `<svg>`: not `INPUT`, not `contenteditable`,
 * not inside `.cm-editor`, no activatable role. So it read as `'none'` and **every** node graph
 * command ran beside Blockly's own. With a node selected on the canvas and a block selected in
 * the window, one Delete meant two deletions — a node the user never touched, gone.
 *
 * ⚠️ The 200 ms `lastBlocklyTabCloseTime` guard in `EditorClipboard.delete()` is the evidence
 * this had already bitten. It is left in place: it guards a different window (the moment after a
 * tab closes, when focus has left the surface and this predicate correctly answers `'none'`).
 *
 * An attribute rather than a class name because the surface is styled by a CSS module, whose
 * class names are hashed at build time and are therefore not a contract anything outside the
 * module can hold.
 */
const OWN_SURFACE_SELECTOR = '[data-keyboard-scope]';

/**
 * 🔴 FIX-003 — the node-graph shell, which is where a "selection" means nodes rather than text.
 *
 * `style.css` already declares this subtree `user-select: none` (the FIX-003 opt-out list), so it
 * is the existing, documented boundary between the two kinds of selection rather than a new one
 * invented here. Everything outside it is prose the user can highlight.
 */
const CANVAS_SELECTOR = '.nodegrapheditor-canvas';

/**
 * 🔴 FIX-003 — ⌘C's contract is about the **selection**, not about focus, and that is the one
 * question `getKeyboardFocusKind` cannot answer.
 *
 * The defect: with a node selected on the canvas and a sentence highlighted in the Explain answer
 * or the Build thread, ⌘C put `{"nodes":[…],"connections":[],"comments":[]}` on the clipboard.
 * Every panel's prose lives in a plain `<div>`, which is not focusable — so highlighting text
 * moves focus nowhere, `keyboardTargetOf` resolves `<body>`, the kind is `'none'`, and the canvas
 * copy command runs exactly as designed. The predicate was working; it was being asked the wrong
 * question.
 *
 * ⚠️ This is also why `[data-keyboard-scope]` cannot fix it. That scope keys off the element the
 * keystroke was *dispatched at*, and a text selection dispatches nothing — marking the panels as
 * their own surface would change nothing at all.
 *
 * Clicking an Explain citation selects the cited node, so "click citation → read → highlight the
 * sentence → ⌘C" reproduces it every time. It is the most natural flow in the feature.
 *
 * ⚠️ `toString().trim()` is load-bearing, not tidiness. If the selection yields no text, the
 * native copy would put nothing on the clipboard — so yielding the key there would turn a wrong
 * copy into no copy at all, which is worse. The key is only given away when there is something
 * real to give it to.
 */
export function selectionOwnsClipboardKey(): boolean {
  const selection = typeof window.getSelection === 'function' ? window.getSelection() : null;
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;
  if (selection.toString().trim().length === 0) return false;

  const container = selection.getRangeAt(0).commonAncestorContainer;
  // A text node cannot answer `closest`; its parent is the element the range lives in. The
  // *common ancestor* rather than the anchor, so a selection dragged across two panels is still
  // resolved to the subtree that actually contains it.
  const element = (
    container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement
  ) as HTMLElement | null;
  if (!element || typeof element.closest !== 'function') return false;

  return !element.closest(CANVAS_SELECTOR);
}

/**
 * ⌘C and ⌘X only. ⌘V is deliberately absent: prose is not editable, so a text selection has no
 * claim on paste, and the canvas must keep pasting while an answer happens to be highlighted.
 *
 * ⌘X is included even though a native cut on read-only prose is a no-op — the alternative is the
 * canvas *cutting nodes out of the graph* while the user believes they are cutting text.
 */
const CLIPBOARD_KEYBINDINGS = new Set([KeyMod.CtrlCmd | KeyCode.KEY_C, KeyMod.CtrlCmd | KeyCode.KEY_X]);

/** Roles whose keyboard contract includes Space and/or Enter as activation. */
const ACTIVATABLE_ROLES = new Set([
  'button',
  'link',
  'checkbox',
  'switch',
  'radio',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'tab'
]);

const ACTIVATABLE_TAGS = new Set(['BUTTON', 'SUMMARY', 'OPTION']);

/**
 * The element that currently holds focus, or null if focus is on the document.
 *
 * The old version bailed out entirely on `!document.hasFocus()`. That check
 * could never change the outcome in production — a document that is not focused
 * receives no keyboard events, so this function is not called — but it did two
 * bad things. It made the guard *inert* in any window Chromium does not report
 * as focused, where typing into a text field would then fire canvas shortcuts
 * (the exact inverse of F21); and because the spec runner's window reports
 * `hasFocus() === false`, it made the whole predicate unprovable. Found by
 * writing the test: the F21 specs passed against the *old* code for that reason
 * and nothing else.
 */
function getActiveElement(): HTMLElement | null {
  const element = document.activeElement as HTMLElement | null;
  if (!element || element === document.body || element === document.documentElement) return null;
  return element;
}

/**
 * 🔴 VFN-001 — the element a keystroke was *dispatched to*, which is not always the element
 * that holds focus by the time this handler runs.
 *
 * `KeyboardHandler` listens on `document`, so it runs last, on the way up. Blockly 12 binds its
 * own `keydown` on its **injection div** (the only such bind in `inject` is
 * `conditionalBind(d, "keydown", …)` where `d` is the container), and in Blockly 12 individual
 * blocks are focusable DOM nodes — `FocusManager`, `getFocusableElement`, `blocklyActiveFocus`.
 * So deleting the selected block *removes the focused element from the document*, and
 * `document.activeElement` falls back to `<body>` **inside the same dispatch**.
 *
 * The guard then read `'none'` and ran the node-graph Delete as well: one keypress, two
 * deletions, a node the builder never touched gone — while the predicate was working perfectly.
 * It was answering a question about a DOM that no longer existed.
 *
 * What survives that is the **composed path**: it is captured when the event is dispatched, and
 * no later handler can rewrite it. Walking it also handles a shadow root, whose `target` would
 * otherwise report the host rather than the real element.
 *
 * 🔴 `composedPath()[0]` on its own is not enough, and it fails for the same reason
 * `activeElement` did. The deleted block *is* the target, and `Element.closest()` walks the tree
 * an element is **in** — a detached element has no ancestors, so
 * `target.closest('[data-keyboard-scope]')` answers `null` on the very element whose removal
 * started this. Hence `isConnected`: take the first element of the path the document still
 * holds, which is the block's workspace — inside the scope, and never going anywhere.
 *
 * ⚠️ The `activeElement` fallback is load-bearing, not padding. A keystroke with nothing focused
 * genuinely targets `<body>`, and every canvas shortcut is supposed to run then — dropping the
 * fallback would disable ⌘F, ⌫ and the arrows on a freshly loaded editor, which is exactly the
 * F21 defect above.
 */
export function keyboardTargetOf(event: KeyboardEvent): HTMLElement | null {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  const candidates: EventTarget[] = path.length ? path : [event.target];

  for (const node of candidates) {
    const element = node as HTMLElement;
    // `document` and `window` are in the path too, and a synthesised `document.dispatchEvent`
    // carries `document` as the target outright. Neither is an element.
    if (!element || typeof element.closest !== 'function') continue;
    // `<body>` is where a keystroke with nothing focused genuinely lands, and the path is ordered
    // from the target upwards — so reaching it means no element below it answered.
    if (element === document.body || element === document.documentElement) break;
    // Removed from the document by an earlier handler on this same dispatch. It cannot answer a
    // `closest` query any more, but its ancestors in the captured path still can.
    if (element.isConnected === false) continue;
    return element;
  }

  return getActiveElement();
}

export function getKeyboardFocusKind(element: HTMLElement | null): KeyboardFocusKind {
  if (!element) return 'none';

  if (element.isContentEditable) return 'text-entry';
  if (TEXT_ENTRY_TAGS.has(element.tagName)) return 'text-entry';
  if (typeof element.closest === 'function' && element.closest(CODE_EDITOR_SELECTOR)) return 'text-entry';

  // After the text-entry checks and before the activatable ones, and both orderings matter.
  // Blockly's own field editor is a real `<input>` (`.blocklyHtmlInput`) *inside* the surface,
  // and while it is focused the user is typing — Escape must leave the field rather than reach
  // Blockly. A focused button inside the surface, by contrast, is still the surface's: the
  // browser activates it natively either way, and no editor command should run behind it.
  if (typeof element.closest === 'function' && element.closest(OWN_SURFACE_SELECTOR)) return 'own-surface';

  if (ACTIVATABLE_TAGS.has(element.tagName)) return 'activatable';
  if (element.tagName === 'A' && element.hasAttribute('href')) return 'activatable';
  const role = element.getAttribute?.('role');
  if (role && ACTIVATABLE_ROLES.has(role)) return 'activatable';

  return 'none';
}

/**
 * Space and Enter with no modifier are how the platform activates a focused
 * button, link or menu item. Those must keep belonging to the control — the
 * editor binds bare Space (canvas pan) and bare Enter (rename node), and
 * neither should fire while a button is waiting to be pressed.
 */
function isNativeActivationKey(event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;
  return event.key === ' ' || event.key === 'Spacebar' || event.key === 'Enter';
}

/**
 * Whether a keystroke belongs to the focused element rather than to a command.
 */
function keystrokeBelongsToFocus(event: KeyboardEvent, kind: KeyboardFocusKind): boolean {
  if (kind === 'text-entry') return true;
  // L30: the surface runs its own registry, so every key is its own — including Escape, which
  // it may use to dismiss a flyout or a field of its own.
  if (kind === 'own-surface') return true;
  if (kind === 'activatable') return isNativeActivationKey(event);
  return false;
}

export default class KeyboardHandler {
  static instance = new KeyboardHandler();

  commands: KeyboardCommand[];

  onKeyDown: KeyEventHandler;
  onKeyUp: KeyEventHandler;
  onMouseUp: MouseEventHandler;

  constructor() {
    this.commands = [];

    this.onKeyDown = (event) => {
      if (event.repeat) {
        return;
      }

      const code = getKeyMod(event) + KeyCodeUtils.fromString(event.key);

      const focusedElement = keyboardTargetOf(event);
      const focusKind = getKeyboardFocusKind(focusedElement);

      if (focusKind === 'text-entry') {
        // Escape leaves the field. Everything else is the user typing.
        if (code === KeyCode.Escape) focusedElement.blur?.();
        return;
      }

      // A focused button waiting for Space/Enter keeps those two keys; every
      // other shortcut runs, including Escape (which closes the popup the
      // button lives in rather than merely blurring the button).
      if (keystrokeBelongsToFocus(event, focusKind)) return;

      // FIX-003: a live text selection outside the canvas owns ⌘C/⌘X, whatever holds focus.
      // Returning without running the command leaves the event uncancelled, so Chromium's own
      // copy proceeds and the highlighted text lands on the clipboard.
      if (CLIPBOARD_KEYBINDINGS.has(code) && selectionOwnsClipboardKey()) return;

      this.executeCommandMatchingKeyEvent(event, 'down');
    };

    this.onKeyUp = (event) => {
      if (event.repeat) {
        return;
      }

      const focusKind = getKeyboardFocusKind(keyboardTargetOf(event));
      if (keystrokeBelongsToFocus(event, focusKind)) return;

      this.executeCommandMatchingKeyEvent(event, 'up');
    };

    this.onMouseUp = (event) => {
      switch (event.button) {
        case 0:
          // Left button
          break;
        case 1:
          // Middle button
          break;
        case 2:
          // Right button
          break;
        case 3:
          // Back button
          break;
        case 4:
          // Forward button
          break;
      }
    };

    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mouseup', this.onMouseUp);
  }

  dispose() {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mouseup', this.onMouseUp);
  }

  executeCommandMatchingKeyEvent(event: KeyboardEvent, type: 'down' | 'up') {
    const code = getKeyMod(event) + KeyCodeUtils.fromString(event.key);
    const command = this.findCommand(code, type);
    command?.handler();
  }

  private findCommand(code: number, type: 'up' | 'down') {
    const matchingCommands = this.commands.filter((c) => c.keybinding === code && (c.type || 'down') === type);

    if (matchingCommands.length === 0) {
      return null;
    }

    return matchingCommands.reduce((prev, curr) => (prev.weight < curr.weight ? prev : curr));
  }

  registerCommands(commands: KeyboardCommand[]) {
    commands.forEach((c) => this.commands.push(c));
  }

  deregisterCommands(commands: KeyboardCommand[]) {
    commands.forEach((c) => this.deregisterCommand(c));
  }

  private deregisterCommand(command: KeyboardCommand) {
    const index = this.commands.indexOf(command);
    if (index !== -1) {
      this.commands.splice(index, 1);
    } else {
      console.error("KeyboardHandler: Trying to deregister a command that's not registered");
    }
  }
}
