// @ts-check
/**
 * Keyboard Shortcuts — a NodeGX node kit.
 *
 * One logic node, `Keyboard Shortcut`: the author writes a key combination on a
 * port ("mod+k", "shift+?", "escape") and the node pulses `Pressed` when that
 * combination is typed anywhere on the page.
 *
 * Hand-written from `@nodegx/kit-scaffold`'s output. No SDK, no bundler, no npm
 * install, no build step — the file the editor installs is the file that runs.
 *
 * ── The two things this node is really about ────────────────────────────────
 *
 * 1. 🔴 **The listener must not outlive the node.** A global `keydown` listener
 *    added on mount and never removed is the defining defect of a shortcut
 *    node: navigate away and back, and the shortcut fires twice; do it four
 *    times and it fires four times, from node instances whose graph no longer
 *    exists. Every registration below goes through `attach`, every removal
 *    through `detach`, and `detach` is wired into the runtime's own teardown
 *    with `addDeleteListener` — the same call `Screen Resolution` uses, and the
 *    hook `Node.prototype._onNodeDeleted` runs on delete, on unmount and on
 *    navigate-away. `detach` is idempotent, and it also sets a `detached` flag
 *    the handler checks first, so a listener that somehow survived removal is
 *    still silent rather than merely quieter.
 *
 * 2. 🔴 **A shortcut that fires while you are typing is a bug, not a feature.**
 *    `?` must open the help sheet — but not in the middle of a sentence in a
 *    search box. The rule is in `suppressedByTextEntry` below and it is stated
 *    in full in README.md, because it is a rule an app builder has to be able
 *    to predict without reading this file.
 *
 * ── Ports are the product ───────────────────────────────────────────────────
 *
 * Nothing here decides *what a shortcut should do*, and nothing here decides
 * which combination is right for an app. Both are decisions, so both are ports:
 * `Shortcut` is text on the property panel, and `Pressed` is a signal the graph
 * wires wherever it likes.
 *
 * ── Autocomplete ────────────────────────────────────────────────────────────
 *
 * The `@type` annotations point at `types/node-kit`, the copy of the published
 * definition types the scaffold wrote next to this file. No npm install and no
 * tsconfig: open this folder in an editor that speaks TypeScript and the fields,
 * port types and callback signatures are all there.
 */
(function () {
  /** Used when `Shortcut` is unset or blank. */
  var DEFAULT_SHORTCUT = 'mod+k';

  // ── Parsing ────────────────────────────────────────────────────────────────

  /**
   * Modifier spellings, all folded onto four canonical names plus `mod`.
   *
   * 🔴 **`cmd` and `ctrl` are NOT interchangeable here, on purpose.** A node
   * that silently rewrote `cmd` to `ctrl` off macOS would make the property
   * panel lie about what the app does. So all three spellings mean exactly
   * what they say, and the *portable* one has its own name:
   *
   * - `cmd` (`command`, `meta`, `super`, `win`) — the Command/Meta key, always.
   * - `ctrl` (`control`) — the Control key, always.
   * - `mod` (`cmdorctrl`) — Command on macOS, Control everywhere else.
   *
   * `mod` is the default because it is almost always the one an author wants.
   */
  var MODIFIER_ALIASES = {
    cmd: 'meta',
    command: 'meta',
    meta: 'meta',
    super: 'meta',
    win: 'meta',
    windows: 'meta',
    ctrl: 'ctrl',
    control: 'ctrl',
    alt: 'alt',
    option: 'alt',
    opt: 'alt',
    shift: 'shift',
    mod: 'mod',
    cmdorctrl: 'mod',
    commandorcontrol: 'mod'
  };

  /**
   * Key spellings, folded onto the lower-cased `KeyboardEvent.key` they match.
   *
   * ⚠️ `plus` and `comma` exist because `+` separates a combo and `,` separates
   * one combo from the next: there is no way to write those two keys literally.
   */
  var KEY_ALIASES = {
    esc: 'escape',
    escape: 'escape',
    enter: 'enter',
    return: 'enter',
    space: ' ',
    spacebar: ' ',
    up: 'arrowup',
    down: 'arrowdown',
    left: 'arrowleft',
    right: 'arrowright',
    del: 'delete',
    plus: '+',
    comma: ','
  };

  /** `<input type>` values that are buttons and sliders rather than text entry. */
  var NON_TEXT_INPUT_TYPES = [
    'button',
    'checkbox',
    'color',
    'file',
    'hidden',
    'image',
    'radio',
    'range',
    'reset',
    'submit'
  ];

  /**
   * One authored combination, parsed.
   *
   * `source` is the author's own text rather than a normalised form, because it
   * is what comes back out on the `Matched Shortcut` output and the author has
   * to recognise it.
   *
   * @typedef {{ source: string, key: string, meta: boolean, ctrl: boolean, alt: boolean, shift: boolean, mod: boolean }} ParsedCombo
   */

  /**
   * Parse one combination, e.g. `"mod+shift+k"`.
   *
   * @param {string} text
   * @returns {ParsedCombo | null} `null` when the text names no key, or names a
   *   modifier twice with nothing after it — both of which are author errors
   *   worth reporting rather than silently ignoring.
   */
  /**
   * ⚠️ `hasOwnProperty`, not a truthiness test on the lookup. A bare
   * `MODIFIER_ALIASES[token]` answers `"constructor"` and `"__proto__"` out of
   * `Object.prototype`, and both answers are truthy — so an author who typed
   * either would have got a modifier named after a function.
   *
   * @param {Record<string, string>} table
   * @param {string} token
   */
  function lookup(table, token) {
    return Object.prototype.hasOwnProperty.call(table, token) ? table[token] : null;
  }

  function parseCombo(text) {
    var source = String(text == null ? '' : text).trim();
    if (source.length === 0) return null;

    var parts = source.split('+');
    /** @type {Record<string, boolean>} */
    var mods = { meta: false, ctrl: false, alt: false, shift: false, mod: false };
    var key = '';

    for (var i = 0; i < parts.length; i++) {
      var token = parts[i].trim().toLowerCase();

      // `a++` and `mod + k` both land here; an empty token is just spacing.
      if (token.length === 0) continue;

      var modifier = lookup(MODIFIER_ALIASES, token);
      if (modifier) {
        mods[modifier] = true;
        continue;
      }

      // Anything that is not a modifier is the key, and there is exactly one.
      // A second one means the author wrote "k+j", which no keyboard can send.
      if (key.length > 0) return null;
      key = lookup(KEY_ALIASES, token) || token;
    }

    if (key.length === 0) return null;

    return {
      source: source,
      key: key,
      meta: mods.meta,
      ctrl: mods.ctrl,
      alt: mods.alt,
      shift: mods.shift,
      mod: mods.mod
    };
  }

  /**
   * Parse the whole `Shortcut` value — one combination, or several separated by
   * commas.
   *
   * @param {string} text
   * @returns {{ combos: ParsedCombo[], rejected: string[] }}
   */
  function parseShortcutList(text) {
    var pieces = String(text == null ? '' : text).split(',');
    var combos = [];
    var rejected = [];

    for (var i = 0; i < pieces.length; i++) {
      if (pieces[i].trim().length === 0) continue;
      var combo = parseCombo(pieces[i]);
      if (combo) combos.push(combo);
      else rejected.push(pieces[i].trim());
    }

    return { combos: combos, rejected: rejected };
  }

  // ── Platform ───────────────────────────────────────────────────────────────

  var macAnswer = null;

  /**
   * Is `mod` Command on this machine?
   *
   * Read lazily and cached: this file is evaluated on the SSR server too, where
   * there is no `navigator` at all.
   */
  function isMac() {
    if (macAnswer !== null) return macAnswer;
    if (typeof navigator === 'undefined') {
      macAnswer = false;
      return macAnswer;
    }
    var uaData = /** @type {any} */ (navigator).userAgentData;
    var platform = (uaData && uaData.platform) || navigator.platform || navigator.userAgent || '';
    macAnswer = /mac|iphone|ipad|ipod/i.test(String(platform));
    return macAnswer;
  }

  // ── Matching ───────────────────────────────────────────────────────────────

  /**
   * Does this event's key press the combination's key?
   *
   * ⚠️ **`event.code` is consulted only when Alt is part of the combination**,
   * and that narrowness is the point. On macOS, Alt is a compose key:
   * `alt+k` arrives with `event.key === '˚'`, so a key-only comparison can
   * never match an Alt shortcut on a Mac. `event.code` names the physical key
   * and matches. Using it everywhere would be worse, not better — on a
   * non-QWERTY layout it would make `mod+a` fire from *two* different keys, the
   * one that types "a" and the one sitting where "a" is on a US keyboard.
   *
   * @param {ParsedCombo} combo
   * @param {KeyboardEvent} event
   */
  function keyMatches(combo, event) {
    var key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
    if (key === combo.key) return true;
    if (!combo.alt) return false;

    var code = typeof event.code === 'string' ? event.code : '';
    if (combo.key.length !== 1) return false;
    if (combo.key >= 'a' && combo.key <= 'z') return code === 'Key' + combo.key.toUpperCase();
    if (combo.key >= '0' && combo.key <= '9') return code === 'Digit' + combo.key;
    return false;
  }

  /**
   * Does this event press exactly this combination?
   *
   * ⚠️ Modifiers are matched **exactly**, in both directions: `cmd+k` does not
   * fire on Cmd+Shift+K. An author who wants both writes both, separated by a
   * comma. The alternative — "at least these modifiers" — makes every plain
   * shortcut fire during every chord that contains it, which is unfixable from
   * the graph.
   *
   * @param {ParsedCombo} combo
   * @param {KeyboardEvent} event
   */
  function comboMatches(combo, event) {
    var wantMeta = combo.meta;
    var wantCtrl = combo.ctrl;
    if (combo.mod) {
      if (isMac()) wantMeta = true;
      else wantCtrl = true;
    }

    if (!!event.metaKey !== !!wantMeta) return false;
    if (!!event.ctrlKey !== !!wantCtrl) return false;
    if (!!event.altKey !== !!combo.alt) return false;
    if (!!event.shiftKey !== !!combo.shift) return false;
    return keyMatches(combo, event);
  }

  // ── The text-entry rule ────────────────────────────────────────────────────

  /**
   * The element the key actually went to.
   *
   * `composedPath()[0]` rather than `target`, because an event that crosses a
   * shadow root is retargeted: `target` becomes the host element, and a text
   * field inside a web component would read as "not a text field".
   *
   * @param {KeyboardEvent} event
   */
  function eventTarget(event) {
    if (typeof event.composedPath === 'function') {
      var path = event.composedPath();
      if (path && path.length > 0) return path[0];
    }
    return event.target;
  }

  /**
   * Is the user typing into this element?
   *
   * @param {any} element
   */
  function isTextEntry(element) {
    if (!element || typeof element !== 'object') return false;
    if (element.isContentEditable) return true;

    var tag = element.tagName ? String(element.tagName).toUpperCase() : '';
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag === 'INPUT') {
      var type = String(element.type || 'text').toLowerCase();
      return NON_TEXT_INPUT_TYPES.indexOf(type) === -1;
    }

    // A custom widget that says it is a text box is one.
    var role = typeof element.getAttribute === 'function' ? element.getAttribute('role') : null;
    return role === 'textbox' || role === 'searchbox' || role === 'combobox';
  }

  /**
   * 🔴 **The rule that separates a usable shortcut node from an annoying one.**
   *
   * With `Ignore In Text Fields` on (the default), a combination is suppressed
   * while focus is in a text field — but only when suppressing it is what an
   * app builder would actually want. Three carve-outs, and each one is a real
   * application:
   *
   * - **Escape always gets through.** "Close this" has to work from inside the
   *   field you are typing in; that is most of what Escape is for.
   * - **A Cmd / Ctrl / Alt chord always gets through.** Cmd+K in a search box
   *   is the normal, expected behaviour of every app that has Cmd+K.
   * - **Everything else is suppressed**, and that includes Shift. `?` and
   *   `shift+?` are plain typing, and a node that fired on them would make
   *   every text field in the app unusable.
   *
   * @param {ParsedCombo} combo
   * @param {KeyboardEvent} event
   */
  function suppressedByTextEntry(combo, event) {
    if (combo.key === 'escape') return false;
    if (combo.meta || combo.ctrl || combo.alt || combo.mod) return false;
    return isTextEntry(eventTarget(event));
  }

  // ── Reading the ports ──────────────────────────────────────────────────────

  /**
   * The parsed combinations for a node's current `Shortcut` value.
   *
   * ⚠️ Parsed here rather than in the input's `set`, and cached against the raw
   * text. An unconnected input has **no default at runtime** — `set` is never
   * called at all — so a node whose parse only happened in the setter would
   * have no shortcut until somebody touched the port. Caching on the raw string
   * keeps the per-keystroke cost at one string comparison.
   *
   * @param {any} node
   * @returns {ParsedCombo[]}
   */
  function combosFor(node) {
    var raw = node._internal.shortcut;
    if (raw === undefined || raw === null || String(raw).trim().length === 0) raw = DEFAULT_SHORTCUT;
    raw = String(raw);

    if (node._internal.parsedFrom !== raw) {
      var parsed = parseShortcutList(raw);
      node._internal.parsedFrom = raw;
      node._internal.parsed = parsed.combos;

      // Reported once per change, not once per keystroke. A combination nobody
      // can type is the single likeliest reason a shortcut "does nothing", and
      // without this it looks like a runtime fault rather than a typo.
      if (parsed.rejected.length > 0 && typeof node.raiseRuntimeError === 'function') {
        node.raiseRuntimeError(
          'Keyboard Shortcut could not read ' +
            parsed.rejected.map(function (piece) {
              return '"' + piece + '"';
            }).join(', ') +
            '. A shortcut is modifiers and one key joined by "+", e.g. "mod+k" or "shift+?".'
        );
      }
    }

    return node._internal.parsed;
  }

  /** An unset boolean port reads as its documented default, not as `undefined`. */
  function flag(node, name, whenUnset) {
    var value = node._internal[name];
    if (value === undefined || value === null) return whenUnset;
    return value === true;
  }

  // ── Registration and — the point — deregistration ──────────────────────────

  /**
   * @param {any} node
   * @param {KeyboardEvent} event
   */
  function handleKeyDown(node, event) {
    // Belt and braces. `detach` removes the listener; this makes a listener
    // that somehow outlived its node silent as well as unreachable, which is
    // the difference between a leak you can see and a shortcut that fires
    // twice after navigating.
    if (node._internal.detached) return;
    if (!event) return;
    if (!flag(node, 'enabled', true)) return;

    // Somebody else already acted on this key. Firing anyway is how two
    // shortcuts end up both handling one press.
    if (event.defaultPrevented) return;

    // A held-down key repeats ~30 times a second. Firing a signal on each is
    // almost never what an author means, so it is opt-in.
    if (event.repeat && !flag(node, 'allowRepeat', false)) return;

    var combos = combosFor(node);
    for (var i = 0; i < combos.length; i++) {
      var combo = combos[i];
      if (!comboMatches(combo, event)) continue;

      if (flag(node, 'ignoreInTextFields', true) && suppressedByTextEntry(combo, event)) {
        // Said out loud rather than swallowed: "my shortcut does nothing while
        // I am typing" is the question this node gets asked, and this output
        // answers it from the graph without reading this file.
        node.sendSignalOnOutput('blockedInTextField');
        return;
      }

      if (flag(node, 'preventDefault', true)) event.preventDefault();

      // ⚠️ Value first, signal last. A `Pressed` that arrives before the
      // `Matched Shortcut` it describes is read by the graph one press late.
      node._internal.matched = combo.source;
      node.flagOutputDirty('combo');
      node.sendSignalOnOutput('pressed');
      return;
    }
  }

  /** @param {any} node */
  function attach(node) {
    node._internal.detached = false;
    node._internal.handler = null;

    // No document on the SSR server, and none in a cloud function. `ssr.compat`
    // below already says so; this is the guard that makes it true.
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;

    var handler = function (event) {
      handleKeyDown(node, event);
    };
    node._internal.handler = handler;

    // Bubble phase, not capture: a dialog that has already handled Escape gets
    // to call `preventDefault`, and the `defaultPrevented` check above then
    // keeps this node quiet. Capturing would put this node ahead of the app's
    // own components, which is the opposite of what an app builder expects.
    document.addEventListener('keydown', handler);
  }

  /**
   * 🔴 The whole reason this file has a lifecycle section. Idempotent: the
   * handler reference is cleared as it is used, so a second call is a no-op
   * rather than a `removeEventListener` on `null`.
   *
   * @param {any} node
   */
  function detach(node) {
    node._internal.detached = true;

    var handler = node._internal.handler;
    node._internal.handler = null;
    if (!handler) return;

    if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
      document.removeEventListener('keydown', handler);
    }
  }

  // ── The node ───────────────────────────────────────────────────────────────

  /** @type {import('./types/node-kit').LogicNodeDefinition} */
  var KeyboardShortcut = {
    name: 'keyboard-shortcuts.KeyboardShortcut',
    displayNodeName: 'Keyboard Shortcut',
    category: 'Keyboard Shortcuts',
    color: 'data',

    docs:
      'Fires a signal when a key combination is typed anywhere on the page. Write the combination on Shortcut ' +
      '("mod+k", "shift+?", "escape"); "mod" is Command on macOS and Control elsewhere. The listener is removed ' +
      'when the node unmounts, so a shortcut cannot survive navigating away.',

    searchTags: ['keyboard', 'shortcut', 'hotkey', 'hot key', 'keybinding', 'accelerator', 'cmd+k', 'key press'],

    ssr: {
      compat: 'client-only',
      note: 'There is no keyboard server-side; the node registers nothing until the browser runs it.'
    },

    // The shortcut itself is what tells one of these nodes from another on a
    // canvas with six of them.
    usePortAsLabel: 'shortcut',

    initialize: function () {
      this._internal.matched = '';
      attach(this);

      // 🔴 THE line. `addDeleteListener` is the runtime's own teardown hook —
      // `Node.prototype._onNodeDeleted` calls it on delete, on unmount, and on
      // navigating away from the page this node lives on. Registering the
      // removal in the same breath as the registration is what makes it
      // impossible to add one without the other.
      this.addDeleteListener(
        function () {
          detach(this);
        }.bind(this)
      );
    },

    getInspectInfo: function () {
      var raw = this._internal.shortcut;
      var shortcut = raw === undefined || raw === null || String(raw).trim().length === 0 ? DEFAULT_SHORTCUT : String(raw);
      if (!flag(this, 'enabled', true)) return shortcut + ' (disabled)';
      if (this._internal.detached) return shortcut + ' (not listening)';
      return shortcut;
    },

    inputs: {
      shortcut: {
        type: 'string',
        displayName: 'Shortcut',
        group: 'Shortcut',
        default: DEFAULT_SHORTCUT,
        description:
          'The key combination, e.g. "mod+k", "shift+?", "escape". "mod" is Command on macOS and Control elsewhere; ' +
          '"cmd" and "ctrl" mean exactly those keys on every platform. Several combinations may be separated by commas.',
        set: function (value) {
          this._internal.shortcut = value;
        }
      },
      enabled: {
        type: 'boolean',
        displayName: 'Enabled',
        group: 'Shortcut',
        default: true,
        description: 'Set false to make the node ignore the keyboard without unmounting it.',
        set: function (value) {
          this._internal.enabled = value;
        }
      },
      ignoreInTextFields: {
        type: 'boolean',
        displayName: 'Ignore In Text Fields',
        group: 'Behaviour',
        default: true,
        description:
          'Suppress the shortcut while focus is in a text input, textarea or contenteditable. Escape and any ' +
          'Cmd/Ctrl/Alt chord are never suppressed. When a press is suppressed, Blocked In Text Field fires instead.',
        set: function (value) {
          this._internal.ignoreInTextFields = value;
        }
      },
      preventDefault: {
        type: 'boolean',
        displayName: 'Prevent Default',
        group: 'Behaviour',
        default: true,
        description:
          "Call preventDefault on a matched press, so the browser's own handling of that combination does not also " +
          'run. Some combinations are reserved by the browser and cannot be prevented.',
        set: function (value) {
          this._internal.preventDefault = value;
        }
      },
      allowRepeat: {
        type: 'boolean',
        displayName: 'Allow Auto-Repeat',
        group: 'Behaviour',
        default: false,
        description: 'Fire repeatedly while the combination is held down. Off by default — a held key repeats ~30 times a second.',
        set: function (value) {
          this._internal.allowRepeat = value;
        }
      }
    },

    outputs: {
      pressed: {
        type: 'signal',
        displayName: 'Pressed',
        group: 'Events',
        description: 'The shortcut was typed.'
      },
      blockedInTextField: {
        type: 'signal',
        displayName: 'Blocked In Text Field',
        group: 'Events',
        description:
          'The shortcut was typed while focus was in a text field and Ignore In Text Fields suppressed it. Wire it ' +
          'to nothing, or to a hint that says why the shortcut did not work.'
      },
      combo: {
        type: 'string',
        displayName: 'Matched Shortcut',
        group: 'Events',
        description:
          'The combination that matched, exactly as it is written on Shortcut. Only useful when Shortcut lists ' +
          'several; empty until the first press.',
        get: function () {
          return this._internal.matched || '';
        }
      }
    }
  };

  /** @type {import('./types/node-kit').NodeKitModule} */
  var kit = {
    nodes: [KeyboardShortcut]
  };

  Noodl.defineModule(kit);
})();
