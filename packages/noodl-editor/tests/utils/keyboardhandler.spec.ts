/**
 * F21 — a focused `<button>` must not disable every editor keyboard shortcut.
 *
 * `KeyboardHandler.getFocusedElement` used to treat anything focusable as "a
 * text input or similar" and decline to run *any* command while it had focus.
 * Chromium focuses a `<button>` when you click it, so ⌘F / ⌘D / ⌘R / ⌘⇧X / ⌘⇧E,
 * Backspace and the arrows all died until you happened to click something
 * unfocusable. PNL-003 papered over ⌘\ and ⌘B with an opt-in flag; the predicate
 * itself was what was wrong.
 *
 * Both directions are asserted here: a shortcut must survive a focused button,
 * and typing in a text field must not fire a canvas shortcut.
 */
import { KeyCode, KeyMod } from '../../src/editor/src/utils/keyboard/KeyCode';
import KeyboardHandler, {
  getKeyboardFocusKind,
  KeyboardCommand
} from '../../src/editor/src/utils/keyboardhandler';

describe('F21 KeyboardHandler focus predicate', () => {
  let host: HTMLElement;
  let registered: KeyboardCommand[];
  let fired: string[];

  /** A real keydown on `document`, which is where `KeyboardHandler` listens. */
  function press(key: string, opts: { meta?: boolean; shift?: boolean; type?: 'keydown' | 'keyup' } = {}) {
    document.dispatchEvent(
      new KeyboardEvent(opts.type || 'keydown', {
        key,
        metaKey: !!opts.meta,
        shiftKey: !!opts.shift,
        bubbles: true,
        cancelable: true
      })
    );
  }

  function register(commands: KeyboardCommand[]) {
    registered = commands;
    KeyboardHandler.instance.registerCommands(commands);
  }

  beforeEach(() => {
    fired = [];
    registered = [];
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    if (registered.length) KeyboardHandler.instance.deregisterCommands(registered);
    host.remove();
  });

  // ---------------------------------------------------------------- predicate --

  describe('getKeyboardFocusKind', () => {
    function el(html: string): HTMLElement {
      host.innerHTML = html;
      return host.firstElementChild as HTMLElement;
    }

    it('reports nothing focused as "none"', () => {
      expect(getKeyboardFocusKind(null)).toBe('none');
    });

    it('reports a button as "activatable", not as text entry — this is F21', () => {
      expect(getKeyboardFocusKind(el('<button>Deploy</button>'))).toBe('activatable');
    });

    it('reports a link, a menu item and a tab as "activatable"', () => {
      expect(getKeyboardFocusKind(el('<a href="#x">docs</a>'))).toBe('activatable');
      expect(getKeyboardFocusKind(el('<div role="menuitem">Float</div>'))).toBe('activatable');
      expect(getKeyboardFocusKind(el('<div role="tab">Project</div>'))).toBe('activatable');
      expect(getKeyboardFocusKind(el('<div role="button">x</div>'))).toBe('activatable');
    });

    it('reports genuine text entry as "text-entry"', () => {
      expect(getKeyboardFocusKind(el('<input type="text" />'))).toBe('text-entry');
      expect(getKeyboardFocusKind(el('<textarea></textarea>'))).toBe('text-entry');
      expect(getKeyboardFocusKind(el('<select><option>a</option></select>'))).toBe('text-entry');
      expect(getKeyboardFocusKind(el('<div contenteditable="true">x</div>'))).toBe('text-entry');
    });

    it('reports anything inside a CodeMirror editor as "text-entry"', () => {
      // CM6 focuses `.cm-content`, which is contenteditable — but the property
      // editor focuses it by selector and CM's own panels host plain inputs, so
      // the whole editor subtree counts.
      const editor = el('<div class="cm-editor"><div class="cm-content"></div></div>');
      expect(getKeyboardFocusKind(editor.querySelector('.cm-content'))).toBe('text-entry');
    });

    it('reports a plain focusable div (canvas, panel body) as "none"', () => {
      expect(getKeyboardFocusKind(el('<div tabindex="0">canvas</div>'))).toBe('none');
    });
  });

  // ------------------------------------------------------------- the two ways --

  it('runs ⌘F while a button holds focus (the F21 regression)', () => {
    register([{ handler: () => fired.push('search'), keybinding: KeyMod.CtrlCmd | KeyCode.KEY_F }]);

    const button = document.createElement('button');
    host.appendChild(button);
    button.focus();
    expect(document.activeElement).toBe(button);

    press('f', { meta: true });
    expect(fired).toEqual(['search']);
  });

  it('runs an unmodified shortcut (Backspace) while a button holds focus', () => {
    register([{ handler: () => fired.push('delete'), keybinding: KeyCode.Backspace }]);

    const button = document.createElement('button');
    host.appendChild(button);
    button.focus();

    press('Backspace');
    expect(fired).toEqual(['delete']);
  });

  it('does NOT run a canvas shortcut while you are typing in a text field', () => {
    // The inverse regression: bare `d` must reach the input, not the canvas.
    register([
      { handler: () => fired.push('canvas-d'), keybinding: KeyCode.KEY_D },
      { handler: () => fired.push('devtools'), keybinding: KeyMod.CtrlCmd | KeyCode.KEY_D }
    ]);

    const input = document.createElement('input');
    input.type = 'text';
    host.appendChild(input);
    input.focus();
    expect(document.activeElement).toBe(input);

    press('d');
    press('d', { meta: true });
    expect(fired).toEqual([]);
  });

  it('does NOT run a canvas shortcut while you are typing in a CodeMirror editor', () => {
    register([{ handler: () => fired.push('canvas-d'), keybinding: KeyCode.KEY_D }]);

    host.innerHTML = '<div class="cm-editor"><div class="cm-content" tabindex="0"></div></div>';
    const content = host.querySelector<HTMLElement>('.cm-content');
    content.focus();

    press('d');
    expect(fired).toEqual([]);
  });

  it('leaves Space and Enter to a focused button, so bare Space does not pan the canvas', () => {
    register([
      { handler: () => fired.push('pan-on'), keybinding: KeyCode.Space },
      { handler: () => fired.push('pan-off'), keybinding: KeyCode.Space, type: 'up' },
      { handler: () => fired.push('rename'), keybinding: KeyCode.Enter }
    ]);

    const button = document.createElement('button');
    host.appendChild(button);
    button.focus();

    press(' ');
    press(' ', { type: 'keyup' });
    press('Enter');
    expect(fired).toEqual([]);
  });

  it('still runs bare Space and Enter when nothing is focused', () => {
    register([
      { handler: () => fired.push('pan-on'), keybinding: KeyCode.Space },
      { handler: () => fired.push('rename'), keybinding: KeyCode.Enter }
    ]);

    (document.activeElement as HTMLElement)?.blur?.();

    press(' ');
    press('Enter');
    expect(fired).toEqual(['pan-on', 'rename']);
  });

  it('lets Escape reach the popup layer when a button holds focus, rather than only blurring it', () => {
    register([{ handler: () => fired.push('close-popup'), keybinding: KeyCode.Escape }]);

    const button = document.createElement('button');
    host.appendChild(button);
    button.focus();

    press('Escape');
    expect(fired).toEqual(['close-popup']);
  });

  it('Escape in a text field leaves the field and runs no command', () => {
    register([{ handler: () => fired.push('close-popup'), keybinding: KeyCode.Escape }]);

    const input = document.createElement('input');
    input.type = 'text';
    host.appendChild(input);
    input.focus();

    press('Escape');
    expect(fired).toEqual([]);
    expect(document.activeElement).not.toBe(input);
  });

  it('runs a keyup command while a button holds focus', () => {
    register([{ handler: () => fired.push('up'), keybinding: KeyCode.KEY_D, type: 'up' }]);

    const button = document.createElement('button');
    host.appendChild(button);
    button.focus();

    press('d', { type: 'keyup' });
    expect(fired).toEqual(['up']);
  });

  // ------------------------------------------------------ L30: own-surface --

  /**
   * 🔴 L30 — one Delete meant two deletions.
   *
   * The Logic Builder's block editor runs Blockly's own shortcut registry, and a focused Blockly
   * workspace is an `<svg>`: not `INPUT`, not `contenteditable`, not inside `.cm-editor`, no
   * activatable role. It therefore read as `'none'`, so **every** node graph command ran beside
   * Blockly's. With a node selected on the canvas and a block selected in the window — which is
   * the normal state of things now that both are on screen at once — pressing Delete deleted
   * the block *and* a node the user never touched.
   *
   * The 200 ms `lastBlocklyTabCloseTime` guard in `EditorClipboard.delete()` is the evidence
   * this had already bitten once; it guarded a tab *close*, not the whole time both surfaces
   * are on screen.
   */
  describe('L30 — a surface that owns its own keystrokes', () => {
    function overlay(inner: string): HTMLElement {
      host.innerHTML = `<div data-keyboard-scope="logic-overlay">${inner}</div>`;
      return host.firstElementChild as HTMLElement;
    }

    it('reports a focused Blockly workspace as "own-surface", not as "none"', () => {
      // The exact shape that was misread: an `<svg>` with nothing else to go on.
      const root = overlay('<svg class="blocklySvg" tabindex="0"></svg>');
      const svg = root.querySelector('svg') as unknown as HTMLElement;

      expect(getKeyboardFocusKind(svg)).toBe('own-surface');
    });

    it('reports the surface root itself as "own-surface"', () => {
      expect(getKeyboardFocusKind(overlay(''))).toBe('own-surface');
    });

    it('does NOT run Delete on the node graph while a block is selected', () => {
      register([
        { handler: () => fired.push('delete-node'), keybinding: KeyCode.Backspace },
        { handler: () => fired.push('delete-node'), keybinding: KeyCode.Delete }
      ]);

      const root = overlay('<div tabindex="0" class="blocklyWorkspace"></div>');
      const workspace = root.querySelector<HTMLElement>('.blocklyWorkspace');
      workspace.focus();
      expect(document.activeElement).toBe(workspace);

      press('Backspace');
      press('Delete');
      expect(fired).toEqual([]);
    });

    it('does NOT run ⌘C / ⌘V / ⌘Z on the node graph from inside the surface', () => {
      register([
        { handler: () => fired.push('copy'), keybinding: KeyMod.CtrlCmd | KeyCode.KEY_C },
        { handler: () => fired.push('paste'), keybinding: KeyMod.CtrlCmd | KeyCode.KEY_V },
        { handler: () => fired.push('undo'), keybinding: KeyMod.CtrlCmd | KeyCode.KEY_Z }
      ]);

      const root = overlay('<div tabindex="0"></div>');
      root.querySelector<HTMLElement>('div').focus();

      press('c', { meta: true });
      press('v', { meta: true });
      press('z', { meta: true });
      expect(fired).toEqual([]);
    });

    it('runs the node graph shortcut again the moment focus leaves the surface', () => {
      // The other half, and the one that makes this a scope rather than a mute button: closing
      // the window, or clicking the canvas, must give the keys straight back.
      register([{ handler: () => fired.push('delete-node'), keybinding: KeyCode.Backspace }]);

      const root = overlay('<div tabindex="0"></div>');
      root.querySelector<HTMLElement>('div').focus();
      press('Backspace');
      expect(fired).toEqual([]);

      const outside = document.createElement('div');
      outside.tabIndex = 0;
      host.appendChild(outside);
      outside.focus();

      press('Backspace');
      expect(fired).toEqual(['delete-node']);
    });

    it("leaves Blockly's own field editor as text entry, so Escape still leaves the field", () => {
      // ⚠️ The ordering inside `getKeyboardFocusKind` is what this holds. Blockly's field editor
      // is a real `<input class="blocklyHtmlInput">` *inside* the surface, and while it is
      // focused the user is typing a value — Escape belongs to the field, not to Blockly.
      register([{ handler: () => fired.push('close-popup'), keybinding: KeyCode.Escape }]);

      const root = overlay('<input class="blocklyHtmlInput" type="text" />');
      const input = root.querySelector<HTMLElement>('input');
      input.focus();

      expect(getKeyboardFocusKind(input)).toBe('text-entry');

      press('Escape');
      expect(fired).toEqual([]);
      expect(document.activeElement).not.toBe(input);
    });
  });
});
