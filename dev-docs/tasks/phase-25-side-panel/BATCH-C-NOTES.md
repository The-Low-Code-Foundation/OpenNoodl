# Batch C — F21, F41, F44

Three findings from the phase-25 register, taken in one pass on `batch-c-editor-shell`.
The register's own instruction was followed: each described cause was re-confirmed against
the source before anything was changed, and **one of the three descriptions was wrong** —
F44's named files no longer exist and its "lag" was not a timing problem at all.

Nothing in this batch was verified by running the Electron editor. A worktree cannot launch
it (`lerna exec` resolves to the primary checkout, not here), so every claim below is either
a spec that ran, a typecheck that ran, or is listed under
[What could NOT be verified](#what-could-not-be-verified). That section is not a formality —
read it.

---

## Evidence: the suite was run twice, deliberately

An assertion that has never failed is not evidence, and phase 25 has twice been bitten by
"verified" behaviour whose gate had never executed. So the editor suite was run in a
**before-behaviour state** (old semantics, new seams — so the new specs compile and execute
against the old logic) and then in the **after state**.

| Run | Specs | Failures | Which |
|---|---|---|---|
| Before (seed 61847) | 1682 | **12** | F41 ×5, F44 ×3, F21 ×4 — and nothing else |
| After (seed 39502) | 1682 | **0** | — |

The before-run's 12 failures are the whole of the new material, and the remaining 1670 specs
were green in both runs, so none of these fixes moved anything else.

Note which four F21 specs failed before: the four *button-focus* cases (⌘F, Backspace, keyup,
Escape). The four *text-entry* cases passed in the before-run — which is the point. They are
inverse guards, and a guard that passes in both states is doing its job: the fix did not buy
"shortcuts work near buttons" by breaking "typing goes to the field".

Reproducing the before-run: the three source files were reverted to old *behaviour* while
keeping the new exports, because a plain `git checkout` of them makes the new specs fail to
*compile*, and a compile error is not a failing test. The after-state was then restored from a
byte-exact snapshot and confirmed identical with `diff` against the saved patch.

Two environment bridges were needed to run the suite from a worktree at all, both recorded
here because the next agent will hit them:

- `packages/node_modules` does not exist in a worktree, and `noodl-git` resolves dugite's git
  binary through it. Without a symlink to the primary checkout's copy, every Git spec throws
  `Git could not be found at the expected path` and burns a 60s jasmine timeout each — the run
  looks hung rather than broken. Symlinking `packages/node_modules` fixes it; `node_modules`
  alone is not enough.
- `npm run test:ci` from `packages/noodl-editor` *does* honour the worktree (the runner uses
  `path.join(__dirname, '..')`, not lerna). Typechecks were run as direct
  `./node_modules/.bin/tsc -p packages/noodl-editor` and `-p .../tsconfig.tests.json` from
  inside the worktree; both clean.

---

## F21 — a focused `<button>` disabled every editor keyboard shortcut

**Cause: confirmed as described, and it had a second half nobody had seen.**

`keyboardhandler.ts`'s `getFocusedElement()` returned any element that was focusable at all
(`element.type || element.href || element.tabIndex !== -1`), and `onKeyDown` treated a non-null
result as "a text input or similar" and declined to run commands. Chromium focuses a `<button>`
on click, so after clicking any rail icon, toolbar button or panel header, ⌘F / ⌘D / ⌘R / ⌘⇧X /
⌘⇧E, Backspace/Delete and the arrow-nudges were all dead until the user happened to click
something unfocusable. PNL-003 had bought back only ⌘\ and ⌘B with an opt-in
`worksWhenFocused` flag.

### The fix: the predicate, not a flag on every command

`worksWhenFocused` is **deleted** — the interface field, the `onlyWorksWhenFocused` parameter
on `executeCommandMatchingKeyEvent`/`findCommand`, and both uses in `EditorPage.tsx`. It has no
remaining meaning: with the predicate fixed, ⌘\ and ⌘B behave exactly as they did (they run
when a button is focused, they do not run while you are typing), so the flag was pure
scaffolding. That was the "decide what it should still mean, if anything" question; the answer
is nothing.

In its place, focus is classified three ways (`getKeyboardFocusKind`, exported so it can be
tested directly):

- **`text-entry`** — `input`, `textarea`, `select`, anything `contenteditable`, and anything
  inside a `.cm-editor` subtree. Every keystroke belongs to the field; no command runs. Escape
  blurs, as before.
- **`activatable`** — `button`, `summary`, `option`, `a[href]`, and the ARIA roles whose
  keyboard contract includes Space/Enter (`button`, `link`, `checkbox`, `switch`, `radio`,
  `menuitem`, `menuitemcheckbox`, `menuitemradio`, `option`, `tab`). **Only unmodified Space
  and Enter** are withheld; everything else runs.
- **`none`** — everything else, including a `tabindex="0"` div. All commands run.

The `activatable` tier is not decoration. The editor binds **bare Space** (canvas pan, down and
up, `EditorEventBindings.ts:187,192`) and **bare Enter** (`Keybindings.PROPERTY_PANEL_EDIT_LABEL`,
rename node). Space and Enter are also how the platform presses a focused button. Without this
tier, fixing F21 would have made every Space on a focused button both click it and start a
canvas pan — trading one regression for another. `.cm-editor` is matched as a subtree rather
than trusting `isContentEditable`, because `propertyeditor.ts:313` focuses `.cm-content` by
selector and CodeMirror's own search panels host plain inputs.

Escape also changed, deliberately: it now reaches the command layer when a *button* has focus
instead of merely blurring the button. Previously Escape on a focused button inside a popup
blurred the button and left the popup open, needing a second press. Escape in a text field
still blurs and runs nothing, so the two-stage behaviour inside a popup that contains an input
is preserved.

`onKeyUp` got the same predicate. It had the identical bug (`if (getFocusedElement()) return;`),
which is why the Space-up half of the pan binding could be stranded.

### Second half, found by writing the test — `document.hasFocus()` made the guard inert

The old `getFocusedElement()` began `if (!document.hasFocus()) return null;`. In the spec
runner's Electron window `document.hasFocus()` is **false**, so the guard returned null for
everything and *every* command ran regardless of focus. The first before-run proved this: the
button-focus specs passed against the old code, and the *text-entry* specs failed — the exact
opposite of the defect being described. The old code was accidentally right about buttons and
wrong about text fields in that window.

That check could never change the outcome in production, because a document that is not focused
receives no keyboard events and this code is not reached. But it silently disabled the guard in
any window Chromium does not report as focused — where typing in a text field *would* fire
canvas shortcuts, the exact inverse of F21 — and it made the predicate unprovable. It is
removed, with the reasoning in the source comment.

This is worth flagging as a general lesson rather than a footnote: **the first before-run's
failures were the opposite of the ones predicted, and that is what surfaced the second bug.**
Had the after-run been run alone it would have been green and the `hasFocus()` problem would
have shipped untouched.

### Sweep of the registration sites

All 13 named sites were checked. **No site had its own copy of the bad predicate**, so no site
needed a change beyond `EditorPage.tsx`'s two flag removals. `grep activeElement` across
`editor/src` returns exactly two hits: `keyboardhandler.ts` and `SidePanel.tsx:277`. The latter
(PNL-009's Escape-returns-a-detached-panel listener) already used the narrow, correct predicate
(`INPUT || TEXTAREA || isContentEditable`) and was left alone — it is a local `document`
listener, not a `KeyboardHandler` command, and rewriting it to import the shared predicate
would only add a CodeMirror case it does not need. Recorded rather than done, so it is a choice.

`router.tsx` registers no keyboard commands at all, despite being on the sweep list. The real
`registerCommands` callers are `useKeyboardCommands.ts`, `nodegrapheditor.ts`, `lessonlayer2.ts`
and `popuplayer.ts`; the rest of the listed files register *through* the hook.

**Changed:** `utils/keyboardhandler.ts`, `pages/EditorPage/EditorPage.tsx`.
**Spec:** `tests/utils/keyboardhandler.spec.ts` (16 specs — 8 predicate units, 8 end-to-end via
real `document.dispatchEvent`), wired into `tests/utils/index.ts`.

---

## F41 — ⌘B on a floating panel returned it docked

**Cause: confirmed exactly as described.**

`useSidePanelLayout.tsx` holds one `SidePanelMode` enum. `toggleHidden` did
`prev === 'hidden' ? 'docked' : 'hidden'`, so hiding **overwrote** `'floating'` (or `'full'`, or
`'wide'`) and un-hiding hardcoded `'docked'`. The mode you were working in was simply gone.
Two other paths had the same hole: `revealIfHidden` (the rail click) hardcoded `'docked'` too,
and the drag-to-collapse branch in `onDividerSizeChanged` set `'hidden'` without remembering
anything.

### The fix

A `modeBeforeHidden` ref carries the mode a panel was hidden *from*, and hide/reveal/dock are
expressed as four pure functions over `{ mode, remembered }` — `hideTransition`,
`revealTransition`, `toggleHiddenTransition`, `dockTransition` — which the hook applies through
one `applyHideTransition` helper. Pure and exported specifically so the round trip is provable:
this suite has no React test infra (no `@testing-library`, no `renderHook`, nothing renders a
component anywhere in `tests/`), and a fix that could only be checked by clicking would have
been another unverified claim.

**PNL-009's CSS-only constraint is preserved.** Nothing is re-parented; the same element carries
a different class. That was the constraint that let legacy `Frame`-hosted panels survive, and it
is untouched.

Three decisions inside the fix, none of which the register asked about:

- **`wide` is restored too**, not just `floating`/`full`. Wide is cleared on a *panel switch* by
  existing design (the mock treats it as per-session); hiding is not a panel switch, so
  returning docked from a hidden-while-wide panel was the same defect wearing a different mode.
- **`dock()` retires the remembered mode.** Escape, the dock button and dragging the divider
  back out are all explicit "I want this docked" gestures. Without this, floating → hide →
  Escape → hide → show would resurrect a float the user had already left.
- **Hiding twice does not forget.** `hideTransition` is idempotent on `remembered`, so a double
  ⌘B (or a rail click while already hidden) cannot overwrite the answer with `'docked'`.

### Corpus script updated, as owned

`corpus/panel-modes.mjs` printed this on every run as an `ok: null` record with the note
*"returns docked; floating is not restored"*. That record is now a **real assertion** —
`floating: the mode survives a ⌘B hide → ⌘B show round trip (F41)`, checking
`position === 'fixed'` after the round trip. The file header's item 6 was updated to say so, and
the stale comment above the `⋯`-overflow check (which explained that it had to re-enter floating
*because* the round trip dropped it) now describes `ensureFloating` as idempotent insurance
instead. The script's own count of asserted checks therefore goes up by one.

**Changed:** `pages/EditorPage/useSidePanelLayout.tsx`,
`dev-docs/tasks/phase-23-visual-refresh/corpus/panel-modes.mjs`.
**Spec:** `tests/sidepanel/hideTransitions.spec.ts` (8 specs), new `tests/sidepanel/` area wired
into `tests/index.ts`.

---

## F44 — the app name did not reach `project.json`

**Cause: NOT as described. The register's description is stale in its file names, and its
framing as a "lag" points away from the actual mechanism. The instrument was sound.**

Corrections to the record, in order of how much they matter:

1. **There is no `AppSetupPanel` and no `ProjectSettingsModel` save path.** PNL-008 consolidated
   the panels; the surviving files are `views/panels/SettingsPanel/` —
   `ProjectSettingsTab.tsx`, `sections/IdentitySection.tsx`, and a `ProjectSettingsModel.ts`
   that is only a view-model for the legacy Ports editor and never writes anything.
2. **It is not a timing lag and not a debounce.** The value was never scheduled to be written at
   all. It appeared "one step later" because `toJSON()` serialises `metadata` unconditionally,
   so the pending value went out with whatever save some *other* change happened to arm.
3. **It is not a residue of F15**, though F15 explains why it was invisible. F15's outcome — two
   stores, `metadata.appConfig` for the app name and `settings.htmlTitle` for the tab title —
   is intact and correct. What nobody checked was whether *both* stores reach the saver.
4. **`ProjectModel.setSetting` throwing on undefined settings (RUN-002) is not in play.** The
   app name never goes through `setSetting`.

### The actual mechanism

`ProjectModel.setMetaData` (`projectmodel.ts:1001`) mutates `this.metadata[key]` and dispatches
`ProjectModel.metadataChanged`. The editor's **only** autosave is the `Model.*` listener at
`projectmodel.ts:1393`. `EventDispatcher.notifyListeners` matches on the first dot-component
being *identical* (`EventDispatcher.ts:17`), so `ProjectModel.metadataChanged` can never reach a
`Model.*` listener. No save was ever armed.

`setSetting`, by contrast, ends in `this.notifyListeners('settingsChanged')`, which
`Model.prototype.notifyListeners` re-dispatches as `Model.settingsChanged` — a match, and not in
`ignoreEvents`. Hence the two controls behaving differently, which is what made this look like
the instrument.

Why the corpus check saw it only on the *second* edit: `ProjectSettingsTab.tsx:118-124` has a
follow rule — while the browser title is empty or still equal to the *old* app name, setting the
app name also calls `setSetting(htmlTitle, …)`, which arms a real save and drags the app name
along. Once the two titles have diverged on purpose, the app-name write is on its own and
nothing happens. Every listener on `ProjectModel.metadataChanged` was checked (`StylesModel`,
`StyleTokensModel`, `ViewerConnection`, `ProjectSettingsTab`); none of them saves. There is no
second saver.

### Blast radius — this was never only the app name

Everything routed through `setMetaData`/`mergeMetadata` had the same defect, and only the app
name had a follow rule to bail it out:

- all of identity (`description`, `coverImage`), all of `updateSEO`, all of `updatePWA`, all of
  `updateVariables` (`ProjectSettingsTab.tsx:126,137,144,152`)
- `StylesModel.store()`, `StyleTokensModel._store()`, `schemahandler`'s DB schema cache,
  `BackendServices`, `topologyPersistence`, `cloudservices`, merge-conflict bookkeeping

`StyleTokensModel` and `topologyPersistence` were accidentally rescued (a following
`notifyListeners('tokensChanged')`, and an `UndoQueue.pushAndDo` wrapper respectively) — an
accident, not a design.

### The fix

The autosave-arming body was extracted from the `Model.*` listener into
`scheduleProjectSave()`, and `setMetaData` and `mergeMetadata` call it.

Deliberately **not** done: renaming the event to `Model.metadataChanged`. That name is already
taken by `ComponentModel.setMetaData` and forwarded to the viewer over the wire
(`ViewerConnection.ts:816`), so reusing it would have meant a project-level change arriving as a
component-level one. Arming the save directly is narrower and has no event-namespace side
effects.

`scheduleProjectSave` keeps the `saveOnModelChange` check, so metadata writes inside a
`setSaveOnModelChange(false)` bulk operation stay suppressed exactly as `Model.*` events do —
asserted, because getting this wrong would make bulk imports write the project once per node.
Project *load* is unaffected: `fromJSON` assigns `this.metadata` directly
(`projectmodel.ts:147`) and never calls `setMetaData`.

**Changed:** `models/projectmodel.ts`.
**Spec:** `tests/project/projectmetadatasave.js` (4 specs) — end-to-end against a real project
copied to a temp directory, polling `project.json` on disk. Not a spy on a timer: the assertion
is the bytes on disk, which is what F44 is about.

---

## What could NOT be verified

Listed explicitly and without softening. Nothing here is "probably fine".

### 1. Nothing was run in the real Electron editor (all three findings)

A worktree cannot launch it. Everything below needs the primary checkout.

### 2. F44 — the human keystroke, and the full project lifecycle (the important one)

The specs drive `updateAppConfig` / `setMetaData` **directly**. They therefore prove the *save
is armed and the bytes land*, which is the defect, but they do **not** exercise:

- the real input commit path — `PropertyPanelTextInput` commits on blur and on Enter, gated on
  `inputValue !== value`. The register's caveat about synthetic input driving is **still open**:
  a real keystroke may commit differently, and no test here touches the component.
- quit and reopen. The save is a 1000ms debounce; whether a rename followed immediately by ⌘Q
  survives depends on shutdown flushing that timeout, and I did not look at the quit path.

**The check that settles it**, exactly as the register proposed: open a project, rename the app
in Settings → Project → Identity **using the keyboard**, touch nothing else, quit, reopen, and
confirm the new name is in the title field and in `project.json` on disk. Do it a second time
with the Browser tab title already set to something different from the app name — that is the
case the follow rule stops masking, and the one that failed.

Also unverified: that the ~12 other `setMetaData` writers listed under blast radius now persist
correctly and do not save more often than intended. Two specs cover the generic path
(`setMetaData` and `mergeMetadata` with probe keys); no spec covers Styles, design tokens, SEO,
PWA or config variables through their own UI.

### 3. F21 — the real app, and one behaviour I changed on judgement

The 16 specs dispatch synthetic `KeyboardEvent`s at `document`. That is the same code path the
real handler uses, but it is not a real key press and not the real DOM.

Specifically unverified in the app:

- that ⌘F / ⌘D / ⌘R / ⌘⇧X / ⌘⇧E genuinely work after clicking a real toolbar button — the
  reported symptom. The spec proves the decision; only the app proves the fix.
- **Escape on a focused button now closes the popup instead of blurring the button.** This is a
  deliberate behaviour change beyond the finding's wording, and it is the change most likely to
  surprise someone. Worth a click-through of the popups and modals.
- **removing `document.hasFocus()`** rests on the argument that an unfocused document receives
  no key events. I believe it, and the Electron `<webview>` case reasons out the same either way
  (a `WEBVIEW` element classifies as `none`, so commands run as before) — but it is reasoning,
  not an observation. The scenario to try is: focus the preview webview, then press ⌘F.
- the `activatable` role list is from the ARIA keyboard contract, not from an inventory of what
  this editor actually renders. A control using a role outside that list will keep Space/Enter
  as a shortcut rather than an activation. No sweep of `role=` attributes was done.
- `select` is still classified as text entry (for its letter type-ahead), and so are
  checkboxes/radios/ranges, because they are `INPUT`. A focused checkbox therefore still blocks
  ⌘F. That is a deliberate conservatism — narrowing it risked breaking Space-to-toggle — and it
  is a smaller version of F21 left in place, not a thing that is fixed.

### 4. F41 — the corpus assertion has not been executed

This is the sharpest gap in this section. The new assertion in `panel-modes.mjs` was written
against the fix and **never run**, because running it needs a dev editor with a project open on
a CDP endpoint, launched from the primary checkout. Only the script's syntax was checked. The
pure transitions are proven by 8 specs; the *panel* returning to `position: fixed` after ⌘B ⌘B
is not.

Run `node dev-docs/tasks/phase-23-visual-refresh/corpus/panel-modes.mjs` from the primary
checkout with the editor up. Until someone does, F41 is "fixed in the state machine" and no
more than that.

Also unverified: whether the floating card comes back at its previous rect. The rect is stored
per panel in `EditorSettings` and was not touched, so it should — but `constrainFloat` runs
against `editorArea`, and I did not check what `editorArea` reports while the panel is hidden.

### 5. Suite scope

1682 editor specs, both themes of nothing — this is jasmine in Electron, not a visual gate. No
runtime, viewer, core-ui or backend suite was run; none of the three changes touches those
packages. `typecheck:core-ui`'s pre-existing
`Cannot find module '@noodl-viewer-cloud/execution-history'` errors were left alone as
instructed.
