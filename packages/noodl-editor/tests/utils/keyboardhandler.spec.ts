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
  keyboardTargetOf,
  selectionOwnsClipboardKey,
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

  // ------------------------------------------- VFN-001: the read that was already stale --

  /**
   * 🔴 VFN-001 — L30's fix was correct and insufficient, and its negative control could not
   * see why.
   *
   * `KeyboardHandler` listens on `document`, so it runs last. Blockly binds `keydown` on its own
   * injection div and, in Blockly 12, individual blocks are focusable DOM nodes. So Blockly's
   * handler deletes the focused block *first*, `document.activeElement` falls back to `<body>`
   * inside the same dispatch, and the guard then reads `'none'` and deletes a canvas node too.
   *
   * One keypress, two deletions — with the predicate working perfectly the whole time. It was
   * answering about a DOM that no longer existed.
   *
   * These specs press the key the way the browser does: **dispatched at an element**, with that
   * element removed mid-dispatch. A spec that only checks `activeElement` proves nothing here —
   * that is the value that lies.
   */
  describe('VFN-001 — the keystroke belongs to where it was dispatched', () => {
    /** A keydown dispatched at an element, as the browser does it — not at `document`. */
    function pressOn(element: HTMLElement, key: string, type: 'keydown' | 'keyup' = 'keydown') {
      element.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }));
    }

    function overlay(inner: string): HTMLElement {
      host.innerHTML = `<div data-keyboard-scope="logic-overlay">${inner}</div>`;
      return host.firstElementChild as HTMLElement;
    }

    function registerDelete() {
      register([
        { handler: () => fired.push('delete-node'), keybinding: KeyCode.Backspace },
        { handler: () => fired.push('delete-node'), keybinding: KeyCode.Delete }
      ]);
    }

    it('resolves the dispatched element, not the focused one', () => {
      const root = overlay('<div id="block" tabindex="0"></div>');
      const block = root.querySelector<HTMLElement>('#block');

      const outside = document.createElement('input');
      host.appendChild(outside);
      outside.focus();
      expect(document.activeElement).toBe(outside);

      let resolved: HTMLElement | null = null;
      const listener = (e: Event) => (resolved = keyboardTargetOf(e as KeyboardEvent));
      document.addEventListener('keydown', listener);
      pressOn(block, 'Backspace');
      document.removeEventListener('keydown', listener);

      expect(resolved).toBe(block);
    });

    it('still answers "own-surface" for a block removed from the document mid-dispatch', () => {
      // The mechanism, in one assertion. Blockly's handler runs on the injection div, below us,
      // and deletes the block — so by the time we are reached the target is detached and
      // `activeElement` is `<body>`. The captured path still names the surface.
      const root = overlay('<div id="workspace"><div id="block" tabindex="0"></div></div>');
      const block = root.querySelector<HTMLElement>('#block');
      block.focus();

      // Stand in for Blockly: an earlier handler in the same dispatch removes the focused block.
      root.addEventListener('keydown', () => block.remove());

      let kind: string | null = null;
      let activeWhenWeRan: Element | null = null;
      const listener = (e: Event) => {
        activeWhenWeRan = document.activeElement;
        kind = getKeyboardFocusKind(keyboardTargetOf(e as KeyboardEvent));
      };
      document.addEventListener('keydown', listener);
      pressOn(block, 'Backspace');
      document.removeEventListener('keydown', listener);

      // The precondition — without this the test proves nothing, because the old read would
      // have been correct.
      expect(block.isConnected).toBe(false);
      expect(activeWhenWeRan).toBe(document.body);

      expect(kind).toBe('own-surface');
    });

    it('does not delete a canvas node when Blockly deletes the focused block', () => {
      registerDelete();

      const root = overlay('<div id="workspace"><div id="block" tabindex="0"></div></div>');
      const block = root.querySelector<HTMLElement>('#block');
      block.focus();
      root.addEventListener('keydown', () => block.remove());

      pressOn(block, 'Backspace');

      expect(fired).toEqual([]);
    });

    it('holds for the second and third consecutive press — this is the criterion the old fix failed', () => {
      // After the first deletion focus is gone, so a press-once test passes vacuously. Blockly
      // keeps dispatching from the workspace it still owns; the guard must keep saying so.
      registerDelete();

      const root = overlay('<div id="workspace" tabindex="0"><div id="block"></div></div>');
      const workspace = root.querySelector<HTMLElement>('#workspace');
      const block = root.querySelector<HTMLElement>('#block');
      workspace.focus();
      root.addEventListener('keydown', () => block.remove(), { once: true });

      pressOn(block, 'Backspace');
      pressOn(workspace, 'Backspace');
      pressOn(workspace, 'Delete');

      expect(document.activeElement).toBe(workspace);
      expect(fired).toEqual([]);
    });

    it('NEGATIVE CONTROL — the same keystroke from outside the surface still deletes the node', () => {
      // Without this the suite above is "nothing happened", which is also what a broken
      // instrument reports.
      registerDelete();

      overlay('<div id="block" tabindex="0"></div>');
      const outside = document.createElement('div');
      outside.tabIndex = 0;
      host.appendChild(outside);

      pressOn(outside, 'Backspace');

      expect(fired).toEqual(['delete-node']);
    });

    it('runs every shortcut on a freshly loaded editor with nothing focused (the F21 fallback)', () => {
      // ⚠️ The `activeElement` fallback is not padding: a keystroke with nothing focused targets
      // `<body>`, and dropping it would disable ⌘F, ⌫ and the arrows outright.
      register([
        { handler: () => fired.push('search'), keybinding: KeyMod.CtrlCmd | KeyCode.KEY_F },
        { handler: () => fired.push('delete-node'), keybinding: KeyCode.Backspace },
        { handler: () => fired.push('left'), keybinding: KeyCode.LeftArrow }
      ]);

      (document.activeElement as HTMLElement)?.blur?.();
      expect(document.activeElement).toBe(document.body);

      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'f', metaKey: true, bubbles: true, cancelable: true })
      );
      pressOn(document.body, 'Backspace');
      pressOn(document.body, 'ArrowLeft');

      expect(fired).toEqual(['search', 'delete-node', 'left']);
    });

    it('keeps typing in a text field to the field, dispatched at the field', () => {
      register([{ handler: () => fired.push('canvas-d'), keybinding: KeyCode.KEY_D }]);

      const input = document.createElement('input');
      input.type = 'text';
      host.appendChild(input);
      input.focus();

      pressOn(input, 'd');
      expect(fired).toEqual([]);
    });
  });

  // ------------------------------------- FIX-003: ⌘C belongs to the selection, not to focus --

  /**
   * 🔴 FIX-003 — ⌘C copied the selected canvas node instead of the selected text.
   *
   * With a node selected on the canvas and a sentence highlighted in the Explain answer or the
   * Build thread, ⌘C put `{"nodes":[…],"connections":[],"comments":[]}` on the clipboard. The
   * whole lane was about making that prose *selectable*, and it succeeded — the text selects
   * fine, and `execCommand('copy')` on the same selection returns it correctly. What failed was
   * purely which handler wins the key.
   *
   * ⚠️ Neither of the two existing scopes could have caught it. Panel prose lives in a plain
   * `<div>`: not focusable, so highlighting it moves focus nowhere, the target resolves to
   * `<body>`, and the kind is a perfectly correct `'none'`. `[data-keyboard-scope]` keys off the
   * dispatched element and would have changed nothing either. The selection is a third thing.
   *
   * The negative controls are the point of this block. "No copy ran" is also what a broken
   * keybinding looks like, so every suppression below is paired with something that must still
   * fire.
   */
  describe('FIX-003 — a live text selection owns ⌘C', () => {
    function selectContentsOf(element: HTMLElement) {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }

    /** The Explain answer / Build thread shape: prose in a plain, unfocusable div. */
    function prose(text: string): HTMLElement {
      const panel = document.createElement('div');
      panel.textContent = text;
      host.appendChild(panel);
      return panel;
    }

    /** The node-graph shell, whose whole subtree is `user-select: none`. */
    function canvas(text: string): HTMLElement {
      const shell = document.createElement('div');
      shell.className = 'nodegrapgeditor-bg nodegrapheditor-canvas';
      shell.textContent = text;
      host.appendChild(shell);
      return shell;
    }

    function registerClipboard() {
      register([
        { handler: () => fired.push('copy-nodes'), keybinding: KeyMod.CtrlCmd | KeyCode.KEY_C },
        { handler: () => fired.push('cut-nodes'), keybinding: KeyMod.CtrlCmd | KeyCode.KEY_X },
        { handler: () => fired.push('paste-nodes'), keybinding: KeyMod.CtrlCmd | KeyCode.KEY_V }
      ]);
    }

    afterEach(() => window.getSelection()?.removeAllRanges());

    it('does NOT copy the canvas node while a sentence is highlighted in a panel', () => {
      registerClipboard();
      selectContentsOf(prose('A Group node lays its children out in a row.'));

      press('c', { meta: true });
      expect(fired).toEqual([]);
    });

    it('NEGATIVE CONTROL — with nothing highlighted, ⌘C still copies the node', () => {
      // Without this the spec above is "nothing happened", which is also what a dead keybinding
      // reports. This is the behaviour the fix must not cost.
      registerClipboard();
      window.getSelection().removeAllRanges();

      press('c', { meta: true });
      expect(fired).toEqual(['copy-nodes']);
    });

    it('NEGATIVE CONTROL — a collapsed caret is not a selection', () => {
      registerClipboard();
      const panel = prose('A Group node lays its children out in a row.');
      const range = document.createRange();
      range.setStart(panel.firstChild, 4);
      range.collapse(true);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      press('c', { meta: true });
      expect(fired).toEqual(['copy-nodes']);
    });

    it('NEGATIVE CONTROL — a selection inside the canvas shell still copies nodes', () => {
      // The boundary itself. That subtree is `user-select: none`, so a range landing in it is
      // not prose the user is trying to copy — it must not disarm the canvas command.
      registerClipboard();
      selectContentsOf(canvas('Group'));

      expect(selectionOwnsClipboardKey()).toBe(false);
      press('c', { meta: true });
      expect(fired).toEqual(['copy-nodes']);
    });

    it('NEGATIVE CONTROL — a whitespace-only selection still copies nodes', () => {
      // ⚠️ Yielding the key to a selection with no text would turn a wrong copy into no copy at
      // all: the native copy writes nothing and the canvas command never ran.
      registerClipboard();
      selectContentsOf(prose('   \n  '));

      expect(selectionOwnsClipboardKey()).toBe(false);
      press('c', { meta: true });
      expect(fired).toEqual(['copy-nodes']);
    });

    it('does NOT cut nodes out of the graph while text is highlighted', () => {
      // The destructive half. A native cut on read-only prose is a no-op, which is a far better
      // outcome than the canvas silently removing nodes the user was not looking at.
      registerClipboard();
      selectContentsOf(prose('A Group node lays its children out in a row.'));

      press('x', { meta: true });
      expect(fired).toEqual([]);
    });

    it('still pastes onto the canvas while text is highlighted', () => {
      // ⌘V is deliberately not in the set: prose is not editable, so a selection has no claim
      // on paste and the canvas must keep it.
      registerClipboard();
      selectContentsOf(prose('A Group node lays its children out in a row.'));

      press('v', { meta: true });
      expect(fired).toEqual(['paste-nodes']);
    });

    it('leaves every non-clipboard shortcut alone while text is highlighted', () => {
      // The guard is scoped to two keys. If highlighting an answer disabled ⌘F or Backspace,
      // this fix would have re-created F21 on a different trigger.
      register([
        { handler: () => fired.push('search'), keybinding: KeyMod.CtrlCmd | KeyCode.KEY_F },
        { handler: () => fired.push('delete-node'), keybinding: KeyCode.Backspace },
        { handler: () => fired.push('undo'), keybinding: KeyMod.CtrlCmd | KeyCode.KEY_Z }
      ]);
      selectContentsOf(prose('A Group node lays its children out in a row.'));

      press('f', { meta: true });
      press('Backspace');
      press('z', { meta: true });
      expect(fired).toEqual(['search', 'delete-node', 'undo']);
    });

    it('resolves a selection dragged across two panels to prose, not to the canvas', () => {
      // `commonAncestorContainer` rather than `anchorNode`: a range that starts in one panel and
      // ends in another still has to answer "where does this selection live".
      const first = prose('The Explain answer says this.');
      const second = prose('And the Build thread says this.');

      const range = document.createRange();
      range.setStart(first.firstChild, 0);
      range.setEnd(second.firstChild, 10);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      expect(selectionOwnsClipboardKey()).toBe(true);
    });
  });
});
