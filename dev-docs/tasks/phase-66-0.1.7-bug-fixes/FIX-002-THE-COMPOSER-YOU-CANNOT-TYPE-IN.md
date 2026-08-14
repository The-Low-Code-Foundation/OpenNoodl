# FIX-002 — The composer you cannot type in

**Report 1 (d)** · Tier 1 · Effort **S**

> *"Typing into the single line input at the bottom is hard: you can't use backspace, you can't
> see new lines, it's just one line of text."*

## Mechanism — pinned in source

`ExplainPanel.tsx:309-315` uses **`TextInput`** (a single-line `<input>`). The "backspace doesn't
work" symptom is an optical illusion with a precise cause:

- `TextInput.tsx:143` uses `useResizableInput`; `:301-308` sets `maxWidth`/`flexBasis` on the
  `<input>` to the **full measured width of the string** (hidden `.Sizer`, `TextInput.hooks.ts:9-37`).
- The wrapper is `overflow-x: hidden` (`TextInput.module.scss:110-115`). Because the input element
  grows to full text width instead of scrolling, the browser has nothing to scroll the caret into
  view — past ~40 characters **the caret and the tail of the text are outside the clipped box**.
  Backspace *is* deleting; the user cannot see it happening.
- Plain Enter submits (`TextInput.tsx:283-289`), so a newline is impossible by design.

Ruled out: the global `KeyboardHandler` correctly refuses to run canvas commands while an
`INPUT`/`TEXTAREA` is focused (`keyboardhandler.ts:44, 161-181, 228-232`) — the canvas
Backspace→delete binding does not fire here.

**The correct shape is already built:** the Build panel's composer
(`AiAuthoringPanel/thread/BuildThread.tsx:627-656`) uses **`TextArea`**
(`noodl-core-ui/.../TextArea/TextArea.tsx`) with multiline, file drop/paste, and mention support.

## Fix direction

1. Swap the Explain composer to `TextArea`, matching `BuildThread.tsx:627-656`.
2. Add a **Send button** — Explain has none today; Enter is currently the only way to submit.
3. Unify the send key (see ruling below) across **both** composers.

## 🔴 Ruling needed — the send key

The two composers currently answer to **different keys**: `TextInput.onEnter` fires on plain Enter;
`TextArea.onEnter` fires on **Shift+Enter** (plain Enter inserts a newline — the *opposite* of the
industry default of Enter=send / Shift+Enter=newline). Two composers in one app answering to
different keys is the real bug. Pick one convention and change both. Changing `TextArea`'s
semantics touches BLD-010's driven acceptance for the Build composer — re-drive it.

## Acceptance criteria

1. Typing a 200-character question into the Explain composer keeps the caret visible at all times;
   Backspace visibly deletes.
2. A newline can be inserted and is visible; the composer grows to show it.
3. The chosen send key submits in **both** the Explain and Build composers; the other key inserts
   a newline in both. Driven, not just spec'd.
4. A Send button submits the current text.
