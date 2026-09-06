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

---

## The drive — 2026-09-05 · all five checks run, and the gate is not what the row thought

FIX-015's ruling expected *"a bug list rather than a confirmation"*. **All five checks pass.** What
the drive found instead is that the panel could not have been reached to be tested at all.

### 🔴 `if (config.devMode)` at `router.setup.ts:435` is DEAD IN EVERY BUILD, dev included

`config.devMode` is **`undefined` everywhere**. `devMode: true` lives only in
`shared/config/config-dev.js`, and **nothing requires that file**; the only config swap in the repo
is `scripts/noodl-editor/build-editor.ts`, which copies `config-dist.js` over `config.js` for a
packaged build, and neither of those declares the key. The repo already knows this — `bugtracker.ts`
carries the measurement for its *own* branch — but the note never reached this gate.

**So `design-tokens`, `file-explorer` and `undo-queue` are registered in no build at all.** Not "not
in a packaged build": in none. Measured as an A/B on the running editor, in Settings → Editor →
Experimental panels:

| arm | the experimental-panels list |
|---|---|
| as shipped | Component X-Ray · Explain · Build · Docs · Problems · Node References — **6, and none of the three** |
| the block forced open | the same six **plus Design Tokens, File Explorer, Undo Queue** |

✅ This is what FIX-015's *"the panel has never run in any shipped or dev build"* actually rests on,
and it is now a reading rather than an assertion. 🔴 **It also means the row's own phrase — "a
packaged build does not register it" — is too narrow, and a session that flipped `devMode` to
un-gate would be changing a flag that turns on two other unexercised panels at the same time.**

### ⚠️ And un-gating is TWO gates, not one

Every one of these registers with `experimental: true`, which puts it behind a **per-user Settings
toggle that is off by default** (`EditorSettingsTab`, "Experimental panels"). So removing the dead
`devMode` gate does **not** put the panel on anyone's rail — it puts a checkbox in Settings. That is
a mild shipping posture, and arguably the one FIX-015's caution actually asks for: the panel becomes
*reachable by someone who opts in* rather than *revealed to everyone*.

### The five checks — driven, in a real editor, on a copied project

Fresh `userData` (via the new `NOODL_USER_DATA_DIR`, see REL-012), a **copy** of
`project-examples/lessons/log-a-thing`, the `devMode` block forced open for the drive and
**restored byte-identical afterwards** (`md5 1fbe9b2f…` before and after).

| # | check | reading |
|---|---|---|
| 1 | edit reaches the preview and survives a reload | 🟢 preview `--primary: #2563eb` → `#ff0000` on commit; after a **full reload + reopen** the injected style still carried the override and resolved |
| 2 | undo undoes one edit, not one keystroke | 🟢 seven keystrokes, **one** `⌘Z` restored the previous committed value |
| 3 | reset restores the default and clears `isCustom` | 🟢 input `#2563eb`, reset button gone, *"1 token overriding defaults"* gone, **`customTokens: []` on disk** |
| 4 | a `var(--other)` reference resolves | 🟢 `--primary: var(--blue-500)` in the injected CSS, and **measured at the consumer**: a probe styled `color: var(--primary)` computed `rgb(59, 130, 246)` |
| 5 | the panel renders under a real `SidebarModel` | 🟢 renders, all categories, rows editable |

🔴 **Check 2's evidence is a pair, not a single reading.** The preview was read **before** the blur
and still said `#2563eb` with `#ff0000` sitting in the input — so the "one write per edit" claim is
carried by an observed *absence of writes while typing*, beside the write that did land. A
per-keystroke implementation would have moved the preview seven times.

🔴 **Check 4 was nearly graded on the wrong thing.** `--primary: var(--blue-500)` appearing in the
`<style>` block proves only that the string was stored. The question is whether it *resolves*, and
that is only answerable at a consumer: `getComputedStyle` on an element using `var(--primary)`.

### Registered, owner `NONE`

| finding | detail |
|---|---|
| 🆕 **`config.devMode` gates three panels and is dead in every build** | Not this row's to decide: removing it exposes `file-explorer` and `undo-queue` too, neither of which has been driven. **Richard's call whether 0.2.2 carries one of them, all three, or none.** The Design Tokens panel is the only one graded |
| 🆕 **A collapsed `CollapsableSection`'s contents are in `document.body.innerText` but are not clickable** | The "Enable Design Tokens" label read as present and `elementFromPoint` returned the section root. A DOM-text drive would have reported the toggle as present and then "clicked" nothing. ✅ **`elementFromPoint`, every time** |
