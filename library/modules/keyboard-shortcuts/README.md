# Keyboard Shortcuts

One node that turns a key combination into a signal. No dependencies, no
network, no build step.

After installing you get the **Keyboard Shortcut** node (category *Keyboard
Shortcuts*) and a demo component, `/Keyboard Shortcuts Demo`, that wires three
of them to a States node.

## Keyboard Shortcut (`keyboard-shortcuts.KeyboardShortcut`)

| Port | Direction | Type | Description |
|---|---|---|---|
| Shortcut | input | string | The combination, e.g. `mod+k`, `shift+?`, `escape`. Several may be listed, separated by commas. Default `mod+k`. |
| Enabled | input | boolean | Set false to ignore the keyboard without unmounting the node. Default true. |
| Ignore In Text Fields | input | boolean | Suppress the shortcut while focus is in a text field. Default true. See below. |
| Prevent Default | input | boolean | Call `preventDefault()` on a matched press. Default true. |
| Allow Auto-Repeat | input | boolean | Keep firing while the combination is held down. Default false. |
| Pressed | output | signal | The shortcut was typed. |
| Blocked In Text Field | output | signal | The shortcut was typed, but focus was in a text field and it was suppressed. |
| Matched Shortcut | output | string | The combination that matched, exactly as written on **Shortcut**. Only interesting when Shortcut lists several. Empty until the first press. |

## Writing a shortcut

Modifiers and one key, joined by `+`:

```
mod+k          shift+?          escape          ctrl+alt+delete
```

### `cmd`, `ctrl`, and `mod` — which one to use

This node does **not** silently rewrite `cmd` into `ctrl` off macOS. Doing that
makes the property panel lie about what the app does. Instead all three
spellings mean exactly what they say, and the portable one has its own name:

| You write | It means |
|---|---|
| `cmd` (also `command`, `meta`, `super`, `win`) | The Command / Meta key, on every platform. |
| `ctrl` (also `control`) | The Control key, on every platform. |
| **`mod`** (also `cmdorctrl`) | **Command on macOS, Control on Windows and Linux.** |

`mod` is what you almost always want, and it is the default. Use `cmd` or
`ctrl` only when you specifically mean that physical key on every machine.

Also accepted: `alt` (`option`, `opt`) and `shift`.

### Key names

Anything `KeyboardEvent.key` produces, lower-cased — `a`, `7`, `/`, `f1`,
`arrowup`. Plus these spellings, because the obvious ones are easier to type:

`esc`/`escape`, `enter`/`return`, `space`, `up`/`down`/`left`/`right`,
`del`/`delete`, `plus`, `comma`.

`plus` and `comma` exist because `+` joins a combination and `,` separates one
from the next, so those two keys cannot be written literally.

### Several combinations at once

```
mod+k, ctrl+space
```

Both fire the same **Pressed** signal; **Matched Shortcut** says which one
matched. This is also how you cover a key that needs Shift on some layouts and
not on others — the demo writes `?, shift+?` for exactly that reason.

### Modifiers match exactly

`cmd+k` does **not** fire on Cmd+Shift+K. If you want both, list both. The
alternative — "at least these modifiers" — would make every plain shortcut fire
during every chord that contains it, and there would be no way to fix that from
the graph.

## The text-field rule

🔴 **This is the behaviour that separates a usable shortcut node from an
annoying one**, so it is spelled out rather than left to be discovered.

With **Ignore In Text Fields** on (the default), and focus inside an `<input>`,
`<textarea>`, `<select>` or a `contenteditable` element:

| Shortcut | While typing in a text field |
|---|---|
| `escape` | **Fires.** "Close this" has to work from inside the field you are typing in. |
| `mod+k`, `ctrl+s`, `alt+n` — any Cmd/Ctrl/Alt chord | **Fires.** Cmd+K in a search box is what every app with Cmd+K does. |
| `?`, `shift+?`, `k`, `/` — a bare key, with or without Shift | **Suppressed.** These are plain typing. A node that fired on them would make every text field in the app unusable. |

When a press is suppressed, **Blocked In Text Field** pulses instead of
**Pressed**. Wire it to nothing, or to a hint — it is the answer to *"why did my
shortcut do nothing?"*, available from the graph without reading any source.

Setting **Ignore In Text Fields** to false disables the whole rule, including
the Escape and chord carve-outs, and the node then fires on every match.

Buttons, checkboxes, radios, sliders and file pickers are **not** text fields:
a shortcut still fires while one of those has focus.

## Registering and — the important half — unregistering

🔴 **The listener is removed when the node goes away.** This is the defect this
kind of node exists to get wrong: a global `keydown` listener added on mount and
never removed means that after navigating away and back, one press fires the
shortcut twice; after four round trips, four times — from node instances whose
graph no longer exists.

How it is handled here, concretely:

1. `initialize` calls `attach`, which adds exactly one `document` `keydown`
   listener and stores its reference on the node.
2. In the **same function**, `this.addDeleteListener(...)` registers the
   removal. That is the runtime's own teardown hook —
   `Node.prototype._onNodeDeleted` runs it on delete, on unmount, and on
   navigating away — and it is the same call the built-in `Screen Resolution`
   node uses for its `resize` listener. Registering the removal in the same
   breath as the registration is what makes it impossible to add one without
   the other.
3. `detach` is idempotent: it clears the stored reference as it uses it, so a
   second call is a no-op rather than a `removeEventListener(null)`.
4. Belt and braces: `detach` also sets a `detached` flag that the handler checks
   first. A listener that somehow outlived its removal is silent as well as
   unreachable — the difference between a leak you can see in DevTools and a
   shortcut that fires twice.

This is covered by the demo: mount the component, navigate away, come back, and
one Cmd/Ctrl+K still produces one state change.

## Other behaviour worth knowing

- **Bubble phase, not capture.** A dialog that has already handled Escape can
  call `preventDefault()`, and this node then stays quiet — it skips any event
  whose `defaultPrevented` is already true. Capturing would put the node ahead
  of your own components, which is the opposite of what you want.
- **Auto-repeat is off.** A held key repeats about thirty times a second.
  **Allow Auto-Repeat** turns it on for the cases that want it.
- **Alt shortcuts on macOS.** Alt is a compose key there: `alt+k` arrives as
  `event.key === '˚'`. When — and only when — Alt is part of the combination,
  the node falls back to `event.code` so the physical key still matches. It does
  not do this for other shortcuts, because on a non-QWERTY layout that would
  make `mod+a` fire from two different keys.
- **`Prevent Default` cannot beat the browser everywhere.** Some combinations
  (Cmd+W, Ctrl+N and friends) are reserved and are never delivered to the page.
- **Server-side rendering.** The node is declared `client-only`: there is no
  keyboard on a server, so it registers nothing until the browser runs it.
- **A combination the node cannot read** (`"cmd+"`, `"k+j"`) raises a runtime
  error in the editor once, when the value changes — not once per keystroke.
  An unreadable shortcut is the likeliest reason one "does nothing".

## The demo component

`/Keyboard Shortcuts Demo` has three Keyboard Shortcut nodes feeding one States
node whose current state is shown as text:

| Press | Result |
|---|---|
| Cmd/Ctrl + K | `Palette` |
| Escape | `Idle` |
| `?` outside the text box | `Help` |
| `?` **inside** the text box | `Typing` — via **Blocked In Text Field**, so the rule is visible rather than theoretical |

## Editing the node

The kit is one hand-written file: `noodl_modules/keyboard-shortcuts/index.js`.
It ships a copy of the node-kit types in `types/node-kit.d.ts`, so a
TypeScript-aware editor autocompletes the definition with no `npm install`, no
`tsconfig` and no build step.

No post-install configuration is required.
