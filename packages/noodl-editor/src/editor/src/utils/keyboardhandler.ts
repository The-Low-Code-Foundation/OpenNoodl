import { KeyMod, KeyCode } from './keyboard/KeyCode';
import { KeyCodeUtils } from './keyboard/KeyCodeMapper';

export interface KeyboardCommand {
  handler: () => void;
  keybinding: number; //e.g. KeyMod.CtrlCmd | KeyCode.KEY_V
  weight?: number;
  type?: 'up' | 'down'; //default is down

  /**
   * PNL-003: run even when a *non-text* element holds focus.
   *
   * The default guard below declines to run any command while anything
   * focusable has focus — and in Chromium a `<button>` takes focus when you
   * click it, so clicking a rail icon or a toolbar button silently disables
   * every shortcut until you click elsewhere. Layout commands (⌘\, ⌘B) have to
   * work right after you clicked the thing they act on.
   *
   * Text entry still wins: a command with this set is *not* run while an input,
   * textarea, select or contenteditable has focus.
   */
  worksWhenFocused?: boolean;
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
 * The element that currently holds focus, or null if focus is only on the
 * document. Reproduces jQuery's `:focus`, which required the element to be
 * focusable in its own right — so `<body>` (tabIndex -1) does not count.
 */
function getFocusedElement(): HTMLElement | null {
  const element = document.activeElement as TSFixme;
  if (!element || !document.hasFocus()) return null;
  const isFocusable = !!(element.type || element.href || element.tabIndex !== -1);
  return isFocusable ? element : null;
}

/**
 * Focus that a keystroke should belong to rather than to a command: somewhere
 * the user is entering text.
 */
function isTextEntryElement(element: HTMLElement | null): boolean {
  if (!element) return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
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

      const focusedElement = getFocusedElement();

      if (code === KeyCode.Escape) {
        if (focusedElement) {
          focusedElement.blur();
          return;
        }
      }

      if (focusedElement) {
        //something else has focus, e.g. a text input or similar
        if (isTextEntryElement(focusedElement)) return;
        // ...but a button that merely took focus when it was clicked must not
        // disable every shortcut in the editor. Commands opt in explicitly.
        this.executeCommandMatchingKeyEvent(event, 'down', true);
        return;
      }

      this.executeCommandMatchingKeyEvent(event, 'down');
    };

    this.onKeyUp = (event) => {
      if (event.repeat) {
        return;
      }

      if (getFocusedElement()) return; // Only do this if no other element is currently focused

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

  executeCommandMatchingKeyEvent(event: KeyboardEvent, type: 'down' | 'up', onlyWorksWhenFocused = false) {
    const code = getKeyMod(event) + KeyCodeUtils.fromString(event.key);
    const command = this.findCommand(code, type, onlyWorksWhenFocused);
    command?.handler();
  }

  private findCommand(code: number, type: 'up' | 'down', onlyWorksWhenFocused = false) {
    const matchingCommands = this.commands.filter(
      (c) => c.keybinding === code && (c.type || 'down') === type && (!onlyWorksWhenFocused || c.worksWhenFocused)
    );

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
