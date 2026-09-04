# REL-016 — the Design Tokens panel, slice 1

**Richard, 2026-09-04, asked which of two: create FIX-015's successor phase, or build it in place.
His answer: _build it in place in phase 82._** So this row carries
[FIX-015](../phase-66-0.1.7-bug-fixes/FIX-015-THE-TOKENS-NOBODY-CAN-EDIT.md)'s **slice 1** —
*"make tokens visible and editable"*, gaps **A** and part of **H**. Slices 2–4 stay with FIX-015 and
are not started.

---

## ✅ What session 39 built

**Gap A — "no human editing surface at all" — was ONE COMPONENT DEEP, not a phase away.**

`DesignTokensTab` already passed a real, undoable write:

```tsx
onTokenChange={(name, value) => styleTokensModel?.setToken(name, value, { undo: true })}
```

It arrived at `TokenCategorySection`'s `TokenRow`, which destructured it to `_onTokenChange` behind
an `eslint-disable` and **dropped it**, with a comment deferring the work to *"Phase 3:
TokenPicker"*. The value rendered as a read-only `<span>`. So the panel could be read and never
edited, and the missing piece was never the write path.

The row now renders a value input per token, committing on blur or Enter and reverting on Escape.

- 🔴 **Committed on blur, not per keystroke.** `setToken` writes through with `undo: true`, so a
  keystroke-per-write would put one undo entry on the stack per character and re-render every
  subscriber mid-word. Same rule `PropertyPanelNumberInput` follows.
- ⚠️ **An empty value reverts rather than writing `''`.** A half-typed field is not an edit;
  clearing is what the reset button is for, and that restores the *default* rather than leaving the
  token undefined.
- An external write — a reset, an undo, an AI edit — wins over a stale draft, keyed on the token's
  own value.

## 🔴 The finding that changes slice 1's shape: **TokenPicker is the wrong component**

FIX-015 slice 1 says *"editable rows via the already-built TokenPicker"*. Measured, that premise is
false:

```ts
/** Called when the user picks a token.
 *  The argument is the full CSS `var(--token-name)` string, ready to use as a style value. */
onTokenSelect: (cssVar: string) => void;
```

`TokenPicker` chooses **which token a property references**. It cannot change a token's own
**value**, which is the only thing this panel exists to do — editing `--primary` from `#3b82f6` to
`#ff0000` is not a token *selection*. Its zero call sites were read as "the editing surface exists,
it is just unwired"; what they actually mean is that the *property-side* picker has no host yet.
That is real work, and it belongs with **gap B ("level 2" — token override per property)**, not
here.

⚠️ So slice 1 does **not** consume TokenPicker, and its cost estimate should not have included it.

## ⬜ Deliberately NOT done: the panel is still `devMode`-gated

`router.setup.ts:445` registers `design-tokens` inside `if (config.devMode)`, so a packaged build
does not register it at all. **That flag is untouched, on FIX-015's own instruction:**

> 🔴 *"Un-gate the panel" is the wrong verb. The Design Tokens panel has **never run in any shipped
> or dev build** … flipping the flag exposes UI nobody has ever exercised. Budget slice 1 as
> **build and test the panel**, not *reveal* it, and expect the first drive to be a bug list rather
> than a confirmation.*

Shipping an unexercised panel into 0.2.2 is the outcome that ruling exists to prevent. Editing now
works and is graded headlessly, so **a drive finally has something to find bugs in** — which is the
step that must come before the flag moves.

### What a drive has to confirm before ungating

1. A token edit reaches the preview (`PreviewTokenInjector`) and survives a reload.
2. Undo actually undoes one edit, not one keystroke — the blur-commit rule, observed rather than
   reasoned.
3. The reset button restores the default and clears `isCustom`.
4. A `var(--other)` reference typed into a row resolves rather than being stored as literal text.
5. The panel renders at all under a real `SidebarModel` — nothing here exercises its mount.

## Two smaller things found in the same file

- `const displayValue = isRef ? token.value : token.value;` — **both branches identical**, a dead
  ternary. Removed with the span it fed.
- `TokenCategorySection` imported the `@noodl-models/StyleTokensModel` **barrel**, which re-exports
  `StyleTokensModel` → `projectmodel` → `bugtracker`, which reads `platform.getUserDataPath()` at
  module scope. 🔴 That is why this file had no coverage: a spec importing it failed **to run**,
  reporting `Tests: 0 total` — the failure mode that reads like a clean pass. It now imports the two
  self-contained leaf modules it actually needs.

## Gates

`tests-unit/fix-015` 6/6, and the reverted arm (the read-only span restored) reddens 4 of the 6 —
the two that survive are the reset-button and empty-list rows, which the change does not touch.
`tsc -p noodl-editor` clean. Editor `test:main` **423 suites / 7086 tests EXIT=0**, up from
422/7080 by exactly this file.

⚠️ **Not driven in a running editor.** See the five points above.
