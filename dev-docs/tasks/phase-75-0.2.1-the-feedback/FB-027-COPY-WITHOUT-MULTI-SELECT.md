# FB-027 — copy without multi-select

**Filed** 2026-08-27 by Richard. **Scoped by Richard the same day**, built, specced, gated and
driven — see *Driven in a running Visual Function*.

> Oh also I can't shift click blocks in the visual function editor, which is sad for copy pasting.

## He is right, and it cannot be fixed the obvious way

Blockly 12 core selects one block at a time. `@mit-app-inventor/blockly-plugin-workspace-multiselect`
is what adds shift-click and marquee selection, and its peer range is **`blockly >=11 <12`** while
this editor is pinned to **12.3.1**. LGC-006 recorded that in 2026-08-12; **re-checked against the
npm registry on 2026-08-27, not recalled** — still true, and there is no 12-compatible successor.

🧭 **Ruled by Richard, 2026-08-27**, offered three ways: hand-roll a shift-click selection layer
against Blockly 12's internals; downgrade to Blockly 11 and take the plugin; or leave the plugin
alone and make the gesture that exists carry the group. **He chose the third.**

## What was actually wrong, and it is not only the missing selection

`BlockSvg.toCopyData(addNextBlocks = false)` — **the default is `false`**, and all four of Blockly's
own call sites (context-menu Duplicate, Ctrl+C, Ctrl+X, the comment duplicate) call it with no
argument. So copying a block took the block and the blocks plugged *into* it and silently left
everything **stacked below** it behind.

For a Visual Function that is the common case: a program is a stack. "Copy this" quietly meant
"copy the first line of this" — which is most of why copy-pasting felt like it needed multi-select
in the first place.

🔴 **`MyBlocksSave.ts` asserted the opposite and had done since 2026-08-12**: that Save-as-a-block
takes the stack *"exactly as Blockly's own Duplicate behaves"*. `bodyFromBlocks` does take the
stack; Blockly's Duplicate did not. FB-027 made the comparison true rather than deleting it; the
sentence there now says so.

## What changed — `stackCopy.ts`

- **`toCopyData`'s default becomes `true`.** One seam reaches Duplicate, Ctrl+C and Ctrl+X, and
  reaches any future call site without this module having to know about it. An explicit argument
  still wins, so Blockly's own single-block serialisations are unaffected.
- **Cut removes what it copied.** Cut is *copy, then* `checkAndDelete()`, and `checkAndDelete`
  **heals** the stack — it reconnects what was below to what was above. Left alone, Ctrl+X would
  have put the whole stack on the clipboard and removed one block from the workspace. The cut
  shortcut's callback is replaced; a value block (one with an `outputConnection`) has no stack
  below it and keeps the healing answer.
- **The menu item says so.** *"Duplicate this and everything below"* — Richard's *"say so in the
  UI"*, at the point the gesture is made, which no hint strip elsewhere can match.

⚠️ **`Delete` is deliberately untouched.** It goes through the same `checkAndDelete`, and a Delete
key that took the rest of the program with it would be a worse surprise than the one being fixed.

## What was measured

10 rows in `tests-unit/fb-027/`, of which three are 🔴 discriminators.

🔴 **The doubles had a hole shaped exactly like the defect, and the suite found it.**
`ShortcutRegistry.register` **throws** on a key code that is already mapped — `allowOverrides` only
silences the *name* warning — so the first version threw at editor startup while every row in this
file was green. `test:main` went from 352 suites passing to **5 suites, 90 tests failing**, all of
them specs that call `initBlocklyIntegration`. Two things changed as a result: the code now
`unregister`s before registering, and the double **refuses what Blockly refuses**, plus a row that
applies the whole thing to the **real Blockly** and asserts it does not throw.

Also read off the installed toolkit rather than asserted: that `blockDuplicate` and `cut` are the
real registry ids (both writers return early on a miss, so a wrong id would fail silently), and that
Blockly's serialiser really does drop `next` when asked the way `toCopyData` asks.

| | |
|---|---|
| editor `test:main` | **5791 pass, 0 fail** |
| editor `test:ci` | **2856 specs, 4 failures** — the recorded `AIX-006` floor |

## Driven in a running Visual Function, 2026-08-27

Every gesture was made with **real input events** — a genuine right-click, real `Ctrl` chords
through `Input.dispatchKeyEvent` with focus emulation on the same connection. A synthetic
`contextmenu` never reaches the Blockly canvas, and `el.click()` on a menu item is not the gesture.
Counts are `ws.getAllBlocks(false).length` before and after each one.

Starting program: a hat, then a four-block stack, with one value block plugged into the last of them
— 6 blocks.

| gesture | before | after | Δ | what it took |
|---|---|---|---|---|
| right-click the stack's top block | 6 | — | — | menu reads **“Duplicate this and everything below”** |
| …click it | 6 | 11 | **+5** | the **whole stack** — 4 statements *and* the value block plugged into one |
| `Delete` on a stack top | 11 | 10 | **−1** | **one block**, and the stack healed around it |
| `Ctrl+C` then `Ctrl+V` | 10 | 14 | **+4** | the whole stack |
| `Ctrl+X` on a stack | 14 | 10 | **−4** | it **removed what it copied**, not one healed block |
| `Ctrl+V` again | 10 | 14 | **+4** | the clipboard really held the stack |
| `Ctrl+X` on a **value** block | 14 | 13 | **−1** | itself only — the `outputConnection` carve-out |

🔴 **The `Delete` row and the value-cut row are what make the rest mean something.** They are the
same instrument, the same workspace and the same session answering **−1** while the copy gestures
answer **+5 / +4 / −4**, so the stack-shaped numbers are not a constant. The `Delete` row is also
the regression this task named as the one to watch, and it holds: `Delete Block` (singular) is still
in the menu, and the key still takes one.

⚠️ Read off the running toolkit rather than assumed: `ShortcutRegistry` has `copy` on
`Control+67` / `Meta+67`, `cut` on `Control+88` / `Meta+88`, `paste` on `Control+86` / `Meta+86`,
and `delete` on bare `8` / `46`. Both modifier families are registered, so Richard's Ctrl and macOS
Cmd both reach the same handler.

⚠️ **A block's bounding box is not its hit area** — the value block's box centre hit-tested to
nothing. Sample the box and keep a point whose `elementFromPoint` lands inside the block's own SVG
root.

## What is left

⬜ **Shift-click multi-select is still absent**, by Richard's ruling — not by oversight. `bodyFromBlocks`
and `applyStackCopy` both stay array- and block-shaped, so a plugin can feed them if Blockly 12
ever gets one.
