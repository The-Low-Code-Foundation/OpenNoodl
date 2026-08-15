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

## ✅ RULED 2026-08-14 — the send key is **Enter sends, Shift+Enter newlines**

The two composers currently answer to **different keys**: `TextInput.onEnter` fires on plain Enter;
`TextArea.onEnter` fires on **Shift+Enter** (plain Enter inserts a newline — the *opposite* of the
industry default of Enter=send / Shift+Enter=newline). Two composers in one app answering to
different keys is the real bug.

**Richard ruled the industry default: Enter = send, Shift+Enter = newline, in both composers.**
That means **`TextArea`'s semantics change**, not Explain's — Explain already sends on plain Enter
and only gains multiline plus a Send button. ⚠️ Changing `TextArea` touches **BLD-010's driven
acceptance** for the Build composer, which must be **re-driven**, and `TextArea` is a
`noodl-core-ui` component — grep every consumer before flipping it, not just the two AI composers.

## Acceptance criteria

1. Typing a 200-character question into the Explain composer keeps the caret visible at all times;
   Backspace visibly deletes.
2. A newline can be inserted and is visible; the composer grows to show it.
3. The chosen send key submits in **both** the Explain and Build composers; the other key inserts
   a newline in both. Driven, not just spec'd.
4. A Send button submits the current text.

---

## Build record — 2026-08-15 (fix002-lane)

### What changed

| File | Change |
| --- | --- |
| `packages/noodl-core-ui/src/components/inputs/TextArea/TextArea.keys.ts` | **New.** `shouldSubmitOnKey(ev, hasOnEnter)` — the whole send-key policy as a pure, import-free module, because both jest runners are node-env (no jsdom) and an inline JSX handler is behaviour no spec here can reach. Honours `defaultPrevented` first (BLD-016's menu), then plain-Enter-without-Shift. |
| `packages/noodl-core-ui/src/components/inputs/TextArea/TextArea.tsx` | The flip. `onKeyDown` now delegates to `shouldSubmitOnKey`; `onEnter` fires on **plain Enter** and Shift+Enter falls through to the browser's newline. JSDoc rewritten (it said "Occurs when Shift+Enter is pressed."). |
| `packages/noodl-editor/src/editor/src/views/panels/ExplainPanel/ExplainPanel.tsx` | Composer swapped `TextInput` → `TextArea` (import and element); a **Send** `PrimaryButton` added below it, `isGrowing`, disabled under exactly the guard `askFollowUp` enforces (`state.busy || question.trim().length === 0`). Enter sends via the flipped `onEnter`; Shift+Enter newlines. |
| `packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/thread/BuildThread.tsx` | Composer region only: the two comments describing Shift+Enter-as-send rewritten (the 20-line block beside `onEnter`, and `ComposerBindings.onKeyDown`'s doc). **No behavioural change** — the `onEnter` binding and its `busy || !canSend` guard are untouched; the key it answers to changed inside `TextArea`. |
| `packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/thread/useComposerMentions.ts` | Comment only — `preventDefault`'s "double duty" note now names Enter's send, not Shift+Enter's. The mechanism itself needed no change: it already speaks `defaultPrevented`, which the new policy honours identically. |
| `packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.tsx` | Comment only — `canSend`'s BLD-011 note said the condition governs "Send and Shift+Enter". |
| `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/components/NodeComment/NodeComment.tsx` | Comment only — the "deliberately not `onEnter`" rationale re-argued under the new semantics (binding it would now make Enter *commit*; a comment needs Enter to stay a newline). |
| `packages/noodl-editor/tests-unit/leg-005/nodeCommentRow.test.ts` | Doc comment above the "binds no onEnter" assertion updated; the assertion itself is unchanged and still guards the right thing. |
| `packages/noodl-core-ui/tests/inputs/textAreaKeys.test.ts` | **New suite** (8 specs) — behavioural over `shouldSubmitOnKey`, plus structural reads asserting `TextArea.tsx` delegates to it, the old `ev.shiftKey && ev.key === 'Enter'` condition is gone, and the JSDoc no longer lies. |
| `packages/noodl-editor/tests-unit/fix-002/explainComposer.test.ts` | **New suite** (7 specs, runs under `test:main`) — Explain composer is a `TextArea` with no `TextInput` import/element, binds `onEnter={askFollowUp}`, has a Send button on the same handler with the mirrored disable guard; Build composer and AiChat still bind `onEnter`; and a cross-package read of the core-ui source asserting the flip is real (test:main never runs core-ui's own suite, so a silent revert there must fail *here*). |

### Every `onEnter` call site, and what was decided

`TextArea.onEnter` consumers — the only code the flip can change:

| # | Site | Passes `onEnter`? | Decision |
| --- | --- | --- | --- |
| 1 | `AiAuthoringPanel/thread/BuildThread.tsx:650` (Build composer) | Yes → `onSend`, guarded `busy \|\| !canSend` | **Enter=send — the ruling itself.** No code change; comments updated. ⚠️ BLD-010 must be re-driven. |
| 2 | `propertyeditor/components/AiChat/AiChat.tsx:196` (function-node AI chat) | Yes → `handleSubmit` | **Enter=send adopted.** A third AI composer, with a "Send Message" button already; the industry default the ruling names is exactly right here, and Shift+Enter keeps multiline reachable. No code change. |
| 3 | `ExplainPanel.tsx` (Explain composer, after this task) | Yes → `askFollowUp` | **Enter=send** — Explain sent on plain Enter before (TextInput); the swap preserves its key and gains newline + Send button. |
| 4 | `ReportProblemDialog.tsx:228,253` | No | Unaffected: with no `onEnter` bound the handler never fires; Enter still newlines natively. Correct for free-text bug reports. |
| 5 | `AiAuthoringPanel/InterviewCard.tsx:180` | No | Unaffected, correct (long-form answer field). |
| 6 | `AiAuthoringPanel/ProjectAuthoringView.tsx:986` | No | Unaffected, correct (description field). |
| 7 | `VersionControlPanel/LocalChanges.tsx:152` (commit message) | No | Unaffected, correct — a commit message wants paragraphs. |
| 8 | `VersionControlPanel/BranchMerge.tsx:94` | No | Unaffected, correct. |
| 9 | `TextArea.stories.tsx`, `AiChatBox.stories.tsx` | No | Stories; unaffected. |

Adjacent surfaces checked and NOT `TextArea` consumers:

- `NodeComment.tsx` — a **raw** `<textarea>`; deliberately binds no `onEnter` (Enter = newline, blur commits). Rationale comment re-argued; the leg-005 spec that freezes this still passes.
- `PropertyPanelTextArea` — its own raw textarea, no `onEnter` concept.
- `preview/launcher/.../ScopingStep.tsx` — raw textarea with its **own** Enter=send/Shift+Enter=newline handler; already conformed to the ruling, untouched.
- Every other `onEnter` in the grep (`BlocklyDialogs`, `MyBlocksSaveDialog`, `EditorTopbar`, `BenchInputsRail`, `PageTemplatePopup`, `SavedBlocksSection`, `NodeLabel`, `ColorInput`, `PickerTextInput`, `TextStyleType`, `ColorType`, `PickerTypeView`, AiAuthoringPanel's refine field) is a **`TextInput`** consumer — `TextInput.onEnter` fired on plain Enter before and still does; unaffected by construction. The `noodl-viewer-react` `onEnter` hits are the runtime Text Input node's output signal — a different animal entirely.

**No `enterBehavior`/`submitOnEnter` prop was added.** The task authorises one only "if any consumer needs the old behavior"; the enumeration found none — every `onEnter`-passing consumer is an AI composer that wants Enter=send, and every field that wants Enter=newline simply doesn't bind `onEnter` (which remains the escape hatch, as NodeComment documents).

### Gate readings (in the worktree, 2026-08-15)

- `packages/noodl-core-ui`: `npx jest` → **22 suites / 345 tests, 0 failed** (was 21/337; +1 suite, +8 tests — all new).
- `packages/noodl-editor`: `npx jest` (tests-main + tests-unit, the `test:main` set) → **191 suites / 2939 tests, 0 failed** vs baseline 190/2932 — +1 suite, +7 tests, all new; no vanished totals.
- `tsc -p packages/noodl-editor --noEmit` → **0 errors** (exit 0).
- `tsc -p packages/noodl-editor/tsconfig.tests.json --noEmit` → 0 errors.
- `tsc -p packages/noodl-core-ui/tsconfig.tests.json --noEmit` → 0 errors.
- `tsc -p packages/noodl-core-ui --noEmit` → **44 errors, all pre-existing TS2307** path-alias failures in *noodl-editor* files the package tsconfig pulls in through its `paths` map (`@noodl-versioning`, `@noodl-store/*`, `@noodl-viewer-cloud/execution-history` — the known red script; its own `tsconfig.tests.json` says these "do not resolve outside a webpack build"). None mention any file this task touched.
- `packages/noodl-editor/tests/` (the jasmine/`test:ci` bundle) was greppped, not run (forbidden beside live siblings): its only Explain reference (`nodegraph/explain-selection.spec.ts`) imports `ExplainPanel_ID` and asserts selection plumbing — nothing keys off the composer.

### ⚠️ Still owed — NOT verified by anything above

1. **Acceptance criteria 1–4 need DRIVING in the live app.** Every spec here grades source structure or the pure key policy; no jsdom, no Electron. The 200-character caret-visibility claim, the visible newline + growth, Enter/Shift+Enter in both composers, and the Send button are all live-drive obligations.
2. **BLD-010's driven acceptance for the Build composer must be RE-DRIVEN** — it recorded Shift+Enter as the send key; the ruling (and this build) changes the key under the same binding.
3. The function-node **AiChat** composer's key flip (site 2) rides along unruled-but-consistent; worth a glance in the same drive.

---

## DRIVEN — criterion 4, 2026-08-15 session 11 (fixture `fix003-drive`, port 9555)

✅ **Criterion 4 PASSES — a Send button submits the current text.** Driven in the Explain composer,
which is the one this task added it to.

The consequence was written before driving: *clicking Send submits — the composer empties and the
panel goes busy. A broken Send leaves the text sitting there.* That is what happened:

| Step | Observation |
|---|---|
| Explain composer mounted | `<textarea placeholder="Ask a follow-up…">` — the `TextArea` swap is live, not a `TextInput` |
| Before typing | Send button present and **`disabled: true`** |
| After typing 127 chars | Send **`disabled: false`** |
| Click Send | composer `value.length` → **0**, panel busy |
| Result | a new answer arrived and rendered |

⚠️ **The disabled→enabled transition is the half worth keeping**, because it is what distinguishes a
working guard from a button that merely happens to fire: the build record says Send is disabled under
exactly `state.busy || question.trim().length === 0`, and both ends of that were observed rather than
assumed.

**Criteria 1 and 3 were driven by session 10** (caret visible at 194 characters, Backspace deletes;
plain Enter submits and Shift+Enter inserts a newline — **BLD-010's reversal confirmed**). This
session re-confirmed Enter-submits incidentally in the **Build** composer: a prompt typed there and
submitted with a plain Enter cleared the composer and produced a turn, which is item 2 of "still
owed" (BLD-010's re-drive) discharged for the send key.

🔴 **Criterion 2 remains half-met and is a RULING, not a bug** — the composer scrolls, it does not
grow (`min-height: 51px; resize: vertical`, no JS auto-grow). Nothing should be built there on
assumption. See the phase handover.

### ⚠️ One thing this drive found that belongs to FIX-003, not here

`TextArea.module.scss:37` sets `user-select: none` on the `<textarea>` element itself, and it
survived FIX-003's inversion because an explicit rule on the element beats the new `:root` default.
**Measured harmless** — Chromium special-cases form controls, so a real drag still selected the
composer's full contents and copied them. Recorded in FIX-003 so it is not rediscovered as a defect.

---

## ✅ RULED 2026-08-15 — criterion 2: **auto-grow to a max height**, capped in rows

Session 12. The question session 11 left open — *should the composer auto-grow at all, and to what
max height?* — was put to Richard and answered: **grow with the content up to a cap, then scroll.**

**The cap is a row count, not a fraction of the panel.** A percentage cap behaves differently in a
tall panel and a short one, which would make the composer's feel depend on where the user happened to
drag a divider. A row count is the same everywhere. **Eight rows** for the Explain composer: tall
enough that a typical follow-up is visible whole, short enough that the answer it is a follow-up *to*
stays on screen while you write it.

### Build record — 2026-08-15, session 12

| File | Change |
| --- | --- |
| `packages/noodl-core-ui/src/components/inputs/TextArea/TextArea.autogrow.ts` | **New.** `autoGrowHeight({scrollHeight, lineHeight, verticalChrome, maxRows})` → `{height, overflowY}`. The whole sizing decision as a pure, import-free module — same reason `TextArea.keys.ts` exists: **both jest runners here are node-env, no jsdom**, so a spec cannot mount or measure. What a spec *can* grade is the decision. |
| `packages/noodl-core-ui/src/components/inputs/TextArea/TextArea.tsx` | New opt-in `autoGrowMaxRows` prop; a `useLayoutEffect` that releases the height, measures, and applies; `setRefs` to forward `inputRef` rather than consume it; an `onMouseUp` that detects a manual resize. |
| `packages/noodl-core-ui/src/components/inputs/TextArea/TextArea.module.scss` | `line-height: 20px` on `.Input`. |
| `packages/noodl-editor/src/editor/src/views/panels/ExplainPanel/ExplainPanel.tsx` | `autoGrowMaxRows={8}`. |
| `packages/noodl-core-ui/tests/inputs/textAreaAutoGrow.test.ts` | **New suite** (16 specs) — behavioural over `autoGrowHeight`, plus structural reads that the wiring exists. |

Four decisions worth not re-deriving:

- 🔴 **Opt-in, with no default.** `TextArea` has consumers well beyond the two AI composers, and this
  file's own build record warns that changing it re-opens **BLD-010's driven acceptance** for the
  Build composer. A prop nobody passes changes nothing, so the Build composer is **deliberately
  untouched** and owes no re-drive. One structural spec asserts there is no default row count.
- 🔴 **`line-height: 20px` is required, not cosmetic.** `getComputedStyle` reports the keyword
  `normal` verbatim rather than resolving it to a number, so without an explicit line height the row
  cap would have to guess a multiplier. This makes the cap exact: `20 × 8 + 16 = 176px`.
- ⚠️ **The chrome is in the cap** because `.Input` is `box-sizing: border-box`. A cap of
  `lineHeight × maxRows` alone would show seven rows and a sliver.
- ⚠️ **`style.height = 'auto'` before measuring is what makes it shrink.** `scrollHeight` never
  reports less than the height already set, so without that line the composer sticks at its
  high-water mark forever — and every behavioural spec still passes. A structural spec holds it.
- ⚠️ **Auto-grow and the resize corner both write `style.height`, so exactly one owns it.** A drag
  landing on a height we did not set marks `userHasResized` and auto-grow stands down permanently.
  The alternative is the composer snapping back on the next keystroke, which reads as the drag
  having been ignored.

🔴 **Driving note: `min-height` is 51px, which is already two lines.** A two-line message therefore
shows no growth even when auto-grow works perfectly. **Drive it with four or more lines**, or the
measurement is vacuous. (Owed to phase-66 session 9.)

### DRIVEN — criterion 2, 2026-08-15 session 12 (fixture `fix003-drive`, port 9556)

✅ **Criterion 2 PASSES — the composer grows to show a newline, and stops at eight rows.** Driven in
the Explain composer, on a real answer generated in-session.

| value | height | `overflowY` | `scrollHeight` |
|---|---|---|---|
| 1 line | 56px | `hidden` | 56 |
| 4 lines | **176px** | `hidden` | 176 |
| 6 lines | 176px | **`auto`** | 256 |
| 20 lines | 176px | `auto` | 816 |
| back to 1 line | **56px** | `hidden` | 56 |

- **G1 growth** ✅ 56 → 176. ⚠️ Driven with ≥4 lines deliberately: `min-height: 51px` is already two
  lines, so a two-line probe shows no growth *even when auto-grow works perfectly*.
- **G2 cap** ✅ exactly **176px** = `20 × 8 + 16`, the arithmetic the spec asserts, confirmed against
  a live `getComputedStyle`.
- **G3 shrink** ✅ back to 56px — so `style.height = 'auto'` really is releasing before measuring.
- ✅ **The boundary case was hit live.** At 4 lines `scrollHeight` was **exactly** the cap (176) and
  `overflowY` stayed `hidden`; at 6 lines (256 > 176) it flipped to `auto`. That is the
  strictly-greater rule in `autoGrowHeight`, observed rather than assumed.

**G4 — the opt-in did not leak** ✅, and by a better signal than a height comparison. A non-opted-in
`TextArea` consumer (the node comment field) *does* change height with content — 48px → 184px — via
its own long-standing sizer, but its `style.height` and `style.overflowY` are both **`(none)`**. The
auto-grow effect always sets *both* inline, so its fingerprint is simply absent. It also passed 184px,
well beyond the 176px cap, confirming it is not governed by the new rule.

⚠️ **Driving note for anyone repeating this:** the Explain composer only renders once an answer
exists (`{state && …}`), so the drive has to generate one first — "Explain this node" in the panel.
And `el.value = x` does not drive React; use the native `HTMLTextAreaElement.prototype.value` setter
plus a bubbling `input` event, then allow ~450ms for the layout effect before measuring.
