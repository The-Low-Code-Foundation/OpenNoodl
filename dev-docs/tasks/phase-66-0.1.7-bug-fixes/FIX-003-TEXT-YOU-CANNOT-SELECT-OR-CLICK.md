# FIX-003 — Text you cannot select or click

**Report 1bis** · Tier 1 · Effort **M** overall, **S** for the first 80%

> *"The output text in the chat (same for the builder panel, and all other panels and especially
> editor / launcher modals) isn't clickable … can't select it to copy and paste."*

## Mechanism — two global root causes, both pinned

**A. Selection.** `src/assets/css/style.css:205-208` — `div { user-select: none }` inherits into
every `<p>` the `Text` component renders. Only three opt-ins exist today: `.react-json-view`
(`style.css:210`), `AiChatMessage` (core-ui — **mounted nowhere**, dead code), and
`UpdateDialog.module.scss:24`. The launcher runs in the same renderer and inherits the same rule.

**B. Links.** Two separate problems:
1. Most AI surfaces render **no markdown at all** — there is no `<a>` to click. The entire Build
   panel thread (`BuildThread.tsx` `ActivityRow` `:72-140`, `OutcomeSummary` `:215-275`, user
   bubble `:522-524`, `InterviewCard`, `ProjectReviewView`, `ProjectAuthoringView:1418`,
   `PlanDocReviewDialog`) is plain `<Text>`. ⚠️ This is a **regression against phase-38 AIB-006**,
   which established markdown rendering — `AiChatMessage` does it correctly (selectable, clickable)
   and is used by nothing.
2. The Explain answer **does** render markdown but **actively disables** non-citation links:
   `ExplanationView.module.scss:79-83` — `a:not([href^='noodl-node:']) { pointer-events: none }`.

**The hard part is already done.** Commit `3f633df4` (updater release notes) installed a **global
`will-navigate` guard** in `main/main.js:452-461`: any `http(s)` navigation from the renderer is
prevented and handed to `shell.openExternal`. A bare `<a href="https://…">` anywhere in the editor
now opens in the browser without per-surface JS. That commit's triple — `Markdown` component +
`user-select: text` wrapper + delegated `linkActionFor` handler (`UpdateManager/releaseLinks.ts:33-45`,
spec `tests-unit/update-dialog/release-links.test.ts`) — is the reusable pattern.

## Fix direction, in cost order

1. **One line:** `user-select: text` on `Markdown.module.scss` `.Root` — fixes the launcher scoping
   chat, DocsPanel preview, UpdateDialog, and every future `Markdown` consumer at once.
2. **~15 lines:** delete `pointer-events: none` at `ExplanationView.module.scss:79-83`; add a
   delegated non-citation branch in `ExplanationView.tsx:44-52` routing through `linkActionFor` →
   `platform.openExternal`; `user-select: text` on its `.Root`.
3. **The real job:** promote the `3f633df4` triple into a shared **`AiMarkdown`** component in
   `noodl-core-ui`; move `releaseLinks.ts` out of `UpdateManager/` to a neutral home; convert the
   Build panel's assistant-text surfaces (`ActivityRow`, `OutcomeSummary`) to it. Keep
   `linkActionFor` as defence-in-depth even though `will-navigate` is global — relying on the main-
   process guard alone means every future surface silently depends on a guard invisible from the
   renderer.
4. **Surface sweep** (from the lane's inventory table): user turns and error turns get the wrapper
   class (they are plain `<Text>`, not markdown); `ConfirmModal.tsx:25,66` renders raw HTML strings
   via `dangerouslySetInnerHTML` — check whether any caller passes model-authored content (if so it
   is an XSS surface AIB-009 did not cover); `ConnectionPopup` `DocsPopup.tsx:129-133` and
   `ConnectionBar.tsx:460-472` raw HTML.

## ✅ RULED 2026-08-14 — **invert the global rule now**, not per-surface opt-in

The question was: invert (`user-select: text` default, opt *out* on canvas/tree/drag surfaces) or
keep opting in per surface? The recommendation was opt-in now and file the inversion as a follow-up.
**Richard ruled the inversion, now** — the correct end state, taken in this phase rather than
deferred.

🔴 **This enlarges the task.** The written recommendation existed because inverting risks
drag-behaviour regressions on the canvas, the panel trees and list rows, and the follow-up was to
carry a **drag-surface test plan**. That plan is now *in scope here*, not deferred:

- Replace `div { user-select: none }` (`style.css:205-208`) with `user-select: text` and add an
  explicit opt-**out** list. Candidate surfaces to enumerate before flipping, not after: the canvas
  (`VisualCanvas` and its chrome strip), every panel tree and list row, the node picker, drag
  handles, the sidebar dividers, and the launcher's project grid.
- The three existing opt-*ins* (`.react-json-view` `style.css:210`, `AiChatMessage`,
  `UpdateDialog.module.scss:24`) become redundant — remove them in the same change or they stand as
  false evidence that the old rule is still in force.
- Steps 1–3 of the fix direction still ship (they are the AI surfaces' markdown and link policy, a
  separate concern from selection) — the inversion **replaces step 4's per-surface wrapper sweep**.
- Acceptance gains a control: **dragging still works** on canvas nodes, panel tree rows and the
  sidebar divider after the flip. Driven, per surface — this is the regression the ruling accepts
  the risk of, so it is the one that must be measured.

## Acceptance criteria

1. Any URL the AI emits in the Explain answer, the Build thread, the launcher scoping chat, and
   a modal opens in the system browser on click. Driven per surface.
2. Text in all four surfaces is selectable and copyable (⌘C yields the text).
3. Explain citations (`noodl-node:` links) still navigate to the node — the delegation branch must
   not regress LEG-003's citation contract.
4. The Build panel renders markdown (bold, lists, code, links) in assistant turns.
5. `release-links.test.ts` still green; new spec on the shared `AiMarkdown` link policy.

---

## Build record — 2026-08-15, branch `fix003-lane`

⚠️ **Built, not driven.** Every criterion below that says "driven" is still owed. The building
agent was **stopped mid-flight by Richard** before it ran a single gate or wrote this record; the
orchestrating session preserved its work as `1b75f99d`, then verified it, finished the one
investigation it owed, and wrote what follows. So the code is one author's and the readings are
another's — worth knowing if something here turns out wrong.

### Commits

| Commit | What |
|---|---|
| `1b75f99d` | The stopped agent's snapshot: the selection inversion, `AiMarkdown`, the link delegation. **No gates had been run when it was taken.** |
| `f1647f92` | The `ConfirmModal` escaping fix (below) — orchestrator's, after the stop. |

### The inversion, and the shape that makes it survive a new surface

`div { user-select: none }` is gone. The default is now **`:root { user-select: text }`**, and the
opt-outs are **container-level**, which is the load-bearing detail: `user-select`'s used value
resolves through the parent, so `none` on a container covers every descendant that does not
explicitly opt back in. ⚠️ The stylesheet carries the warning in place — **never reintroduce a
`div { user-select: text }` rule**, because an explicit `text` on every div punches through every
container-level `none` and silently un-fixes all of this.

Opt-outs taken, each because a drag or a click-to-select gesture would otherwise anchor a stray
selection: `#top-bar` (the Electron window drag region), `.nodegrapheditor-canvas` (canvas pan,
rubber-band select, node and wire drags, plus the HUD and comment layers nested inside it),
`.popup-layer-dragger`, `.drag-handle` (the label-is-the-handle family), `.frames-divider`, the
node picker, the side panel's float-resize gesture, the launcher's project grid, and the curve
editor. The three now-redundant opt-*ins* (`.react-json-view`, `AiChatMessage`,
`UpdateDialog.module.scss`) are removed, so nothing stands as false evidence that the old rule
still applies.

Plus a rule neither the task nor the ruling anticipated, and which the drag-surface plan needs:
**`body.noodl-dragging * { user-select: none !important }`**, added on drag start and lifted on
mouseup by the two drag engines (`PopupLayer`, `FrameDivider`). Both drag on *window* listeners, so
the gesture crosses panels that are now full of selectable text; a container opt-out cannot help
once the pointer has left the container. `!important` is deliberate — for the gesture's duration it
must also beat the explicit opt-INs.

⚠️ **The launcher grew a second grid after this lane was cut.** `a89ec153` added
`LearningSection.module.scss` with its own `.Grid`, above the projects grid, so the opt-out here
covered only one of the two. The section's author ruled they should match; **the merge adds the
same opt-out to `LearningSection`'s grid.**

🔴 **Not by hoisting it to a container, and the reason is the whole point of this task.** The
tempting fix — put `user-select: none` on `Projects.module.scss`'s `.Main` so every present and
future section inherits it — also swallows the welcome copy and the no-results message, which are
exactly the kind of prose FIX-003 exists to make selectable. A container-level opt-out is the right
instrument for a *drag surface* (see `.nodegrapheditor-canvas`, which is drag all the way down) and
the wrong one for a *page region that happens to contain some cards*. **The convention is therefore
per-card-grid, in the grid's own module**, and the two grids use different card components anyway,
so no shared primitive would have covered both. A future launcher section must opt its own grid out
— `.unselectable` in `style.css` is the helper to reach for from markup.

### Links

`pointer-events: none` is deleted from `ExplanationView.module.scss`; a delegated container listener
routes non-citation links through `linkActionFor` → `platform.openExternal`, leaving `noodl-node:`
citations to navigate as before (LEG-003's contract). `releaseLinks.ts` moved out of `UpdateManager/`
to its neutral home at `noodl-core-ui/components/ai/AiMarkdown/linkActions.ts`, and the Build
panel's `ActivityRow` and `OutcomeSummary` now render `AiMarkdown` throughout.

### 🔴 The `ConfirmModal` XSS check — the answer is yes, and it is fixed

Step 4 asked whether any `ConfirmModal` caller passes model-authored content into its
`dangerouslySetInnerHTML` message. **Two of the three do.** `TextStylePicker` and
`colorstylepicker` both build their delete confirmation as
``  `…delete <strong>${name}</strong>?…`  `` — and a style name is chosen by the user or **written by
the AI**. A style named with a tag executed in the editor's renderer. (The third caller,
`projectmodel.editor.ts`, passes a static literal and is safe.)

Fixed in `f1647f92` by escaping at both sites through one shared
`src/editor/src/utils/escapeHtml.ts` rather than a fourth private copy of the same four
replacements — three already exist (`nodeDocs.ts`, `nodeWarning.ts`, `lessonformat.ts`). The sink
itself is unchanged: the modal still takes HTML on purpose, since both callers rely on `<strong>`
and `<br>`. Spec: `tests-unit/fix-003/confirmModalEscaping.test.ts`, 7 tests.

### ✅ `AiMarkdown`'s own URL policy — checked against the payloads, not the comment

A concurrent session found the same class of bug one hop further out: `lessonformat.ts` compiled
lesson prose into HTML and a `[click](javascript:…)` link became a live anchor in a renderer with
node integration. Escaping would not have stopped it — the payload is a *URL scheme*, not markup.
That is the same shape as this lane's new `AiMarkdown`, which renders whatever a model wrote, so it
was measured rather than assumed. **Thirteen payloads through Remarkable 2.0.1 as this component
configures it** — `javascript:`, `JaVaScRiPt:`, `java\tscript:`, embedded newline and NUL, leading
space, a leading control byte, `vbscript:`, `data:text/html` (link and image), an HTML-entity
`&#106;avascript:` — **every one refused**, and refused hard: no anchor is emitted at all, the
markdown renders as literal text. Only the `https:` control produced an `<a>`.

So the surface is defended three times over, and the layers are independent: Remarkable's own link
validation, `html: false` at the parser (AIB-009), and `aiLinkActionFor`'s **allow-list** of
`http:`/`https:` reached through real `URL` parsing, with `preventDefault()` on every branch
including the refused ones. ⚠️ The allow-list is what makes it survivable — a blocklist of known-bad
schemes would have to enumerate the spellings above, and the tab/NUL/entity variants are exactly
what defeats `startsWith('javascript:')`.

### Gate readings — run by the orchestrator on `f1647f92`, in the worktree

| Gate | Reading |
|---|---|
| `noodl-core-ui` jest | ✅ **22 suites / 361 tests, 0 failed** (base 21/337 — +1 suite, +24 tests: the new `aiMarkdownLinkPolicy` spec) |
| `noodl-editor` jest | ✅ **191 suites / 2939 tests, 0 failed** (this lane's base 190/2932 — +1/+7, the escaping spec; **no total dropped**) |
| `release-links.test.ts` | ✅ green after the move |
| `tsc -p packages/noodl-editor --noEmit` | ✅ 0 errors |
| `tsc -p packages/noodl-core-ui --noEmit` | 44 errors — the known-red project; **none names a file this lane touched**, and two other sessions read 44 independently the same day |
| `test:ci` (jasmine) | ⛔ not runnable from a worktree — owed on the primary after merge |

### Still owed

1. **All five acceptance criteria need DRIVING.** Every spec here grades source or a pure function;
   nothing has proven a link opens, text selects, or ⌘C yields anything.
2. **The drag-surface regression drives the ruling put in scope** — canvas node drag, panel tree row
   drag, sidebar divider, and the launcher grid — each driven per surface. This is the regression
   the ruling knowingly accepted the risk of, so it is the one that must actually be measured.
   The `noodl-dragging` class is the thing to watch: it is added and lifted by JS, so a drag that
   ends outside the window is the failure mode to look for.
3. **The two launcher grids' disagreement** (above) needs a call and probably one more opt-out line.

---

## DRIVEN — 2026-08-15, session 11 (fixture `fix003-drive`, port 9555)

Items 1 and 2 above are now **largely discharged**; item 2 was closed by session 10. What follows is
per criterion, with the evidence rather than the verdict. **Criterion 2 FAILS**, for a reason that
has nothing to do with `user-select` and was invisible to every spec in this lane.

### How criterion 1 was graded, and why not with a spy

"Opens in the system browser" is a *consequence*. Stubbing `platform.openExternal` and asserting it
was called grades the **mechanism** and would pass on an app whose links open nothing. So the drive
ran a local HTTP server and used a URL pointing at it: a hit in that server's log, **with a browser's
User-Agent**, is the consequence itself — the URL left the app, reached the OS, and something
outside Electron fetched it.

| Criterion | Verdict | Evidence |
|---|---|---|
| **1** — URL opens in system browser | ✅ **PASS**, 2 of 4 surfaces | see below |
| **2** — text selectable and ⌘C yields it | 🔴 **FAIL** — selects fine, **⌘C copies the wrong thing** | see the defect below |
| **3** — `noodl-node:` citations still navigate | ✅ **PASS** | cited node revealed, selected, Properties panel followed |
| **4** — Build panel renders markdown | ✅ **PASS** | real `<strong>`×1, `<li>`×2, `<code>`×1, `<a>`×1 in the assistant turn |
| **5** — specs green | ✅ (unchanged from the build record) | not re-run this session |

**Criterion 1, per surface.** Both driven surfaces produced a hit from **Firefox 153** with
`sec-fetch-dest: document` / `sec-fetch-mode: navigate` — a real top-level browser navigation, plus a
follow-up `/favicon.ico` — while the editor stayed on `file://…/index.html`, so the window never
navigated:

- **Build thread** (`AiMarkdown`, renderer-side delegated handler) — `/probe-build`, 08:37:23Z.
- **Explain answer** (own Remarkable + own delegation) — `/probe-explain`, 08:44:46Z.
- **Launcher scoping chat** — ⛔ **not driven.** Reaching it needs a full project-creation wizard run
  with a live scoping conversation. ⚠️ It is also the surface most worth driving, because it is the
  **only** AI surface with *no renderer-side handler* (`ScopingStep.tsx:98,122` renders plain
  `Markdown`), so it is the only one whose links depend on the main-process `will-navigate` guard
  alone — and **neither drive above exercised that guard**, since both were `preventDefault`ed in the
  renderer and routed through `platform.openExternal`. The guard is therefore still unproven in use.
- **A modal** — ⛔ **not drivable in a dev build at all.** `UpdateDialog` is the only modal rendering
  markdown, and it opens only from the title-bar update affordance, which requires an available
  update; `main.js:440` skips `AutoUpdater.setupAutoUpdate` entirely when `devMode`. There is no user
  path to it here. Its link policy is the same `linkActionFor` module driven twice above, and
  `release-links.test.ts` covers it — but that is an argument, not a drive.

### 🔴 Criterion 2 FAILS — ⌘C copies the selected canvas **node**, not the selected text

Selection itself is fine. A real mouse drag across assistant text selects it, and the computed
`user-select` is `text`. The failure is the **copy**:

> With a node selected on the canvas and a live text selection in a panel, ⌘C puts
> `{"nodes":[{"id":"…","type":"Router",…}],"connections":[],"comments":[]}` on the clipboard.

Measured on **both** panels, so this is not Explain-specific:

| Surface | text selected | ⌘C put on clipboard | `execCommand('copy')` |
|---|---|---|---|
| Explain answer | *"This slice is the app's root component, /App…"* | **node JSON** | the text ✅ |
| Build thread | *"Applied — 2 components changed."* | **node JSON** | the text ✅ |

`execCommand('copy')` returning the correct text on the same selection is what proves the selection
is genuinely copyable — the defect is entirely in **which handler wins the keystroke**.

**Mechanism, pinned:**

- `EditorDocument.tsx:562-564` binds `CtrlCmd | KEY_C` → `nodeGraph.copy()` →
  `EditorClipboard.ts:61` → `clipboard.writeText(JSON.stringify(nodeSet.toJSON()))`. That string is
  byte-for-byte what landed on the clipboard.
- The guard that should have stopped it is `keyboardhandler.ts:165`, and it is **focus**-based:
  `TEXT_ENTRY_TAGS = {INPUT, TEXTAREA, SELECT}`. A text selection inside a `<div>` — which is what
  every panel's prose is — classifies as `'none'`, so all canvas commands run.
- 🔴 **The guard asks the wrong question.** Focus and selection are different things, and ⌘C's
  contract depends on the *selection*, not on what is focused. That is why this survived a lane whose
  whole subject was making text selectable: FIX-003 correctly made the text selectable and never
  touched who owns the keystroke.

🔴 **The most natural user flow reproduces it every time.** Clicking an Explain citation *selects the
cited node* (criterion 3, working as designed) — so "click a citation → read the explanation →
select that sentence → ⌘C" always yields node JSON instead of the sentence. This is precisely
report 1bis's complaint (*"can't select it to copy and paste"*) surviving in a second form.

**Control, and it is what makes the diagnosis safe:** with **nothing** selected on the canvas, ⌘C
copies nothing at all — the clipboard keeps its prior value. So the canvas handler is demonstrably
the thing winning, not some general copy failure.

⚠️ **This needs a ruling before a fix.** The obvious repair — teach the guard about a non-collapsed
`getSelection()` — is one condition, but it changes a global keybinding's precedence and the right
answer may instead be to scope the canvas commands to the canvas. Not built on assumption.

### What the harness could and could not prove

⚠️ **The ⌘C *keystroke* is only partly drivable, and the report above is careful about which half is
which.** Electron serves ⌘C from the application menu (`main.js:759` binds `CmdOrCtrl+C` to the
macOS `copy:` selector), and **CDP cannot fire a native menu accelerator**. So:

- Where a node **was** selected, the editor's own JS keybinding ran and the wrong content was
  copied — that is a real, driven observation.
- Where no node was selected, ⌘C did nothing *over CDP*, which proves nothing about a real keyboard.
  That half is a harness limit, and it is why the pass/fail above rests on `execCommand` plus the
  node-selected case rather than on "⌘C did nothing".

✅ **A control test is what separated the two**, and it is worth repeating: run the same copy through
`execCommand('copy')` on the same selection. Key ✗ / exec ✓ means the key never reached the copy
path; key ✗ / exec ✗ would have meant the selection genuinely was not copyable.

### Two findings the build record did not have

🔴 **1. A bare URL is never a link, on any surface.** `linkify` is off in both Remarkable instances
(the default in 2.0.1, never overridden), so only `[text](url)` and `<https://…>` autolinks produce
an `<a>`. `https://example.com` written as prose renders as inert text. Verified against the exact
config both renderers construct. ⚠️ Criterion 1 says "**any** URL the AI emits" — as built, that is
true only for URLs the model happens to write as markdown links. Whether that satisfies the criterion
is a **ruling**, not something to quietly fix: turning `linkify` on widens what becomes a clickable
anchor in untrusted model output, which is a security-relevant change to the surface this lane just
spent its effort hardening.

⚠️ **2. `TextArea.module.scss:37` puts `user-select: none` on the `<textarea>` itself** — and an
explicit rule on the element **beats** the new `:root { user-select: text }` default, so the
inversion did not clear it. It predates this lane (initial commit). **Measured: it does not actually
block anything** — Chromium special-cases form controls, and a real drag across the Build composer
selected all 29 characters of the probe string, which `execCommand('copy')` then copied exactly. So
this is a latent wrong-ness, not a live defect: harmless where it sits, and misleading the moment
anyone reads it as evidence of intent or moves the rule to a non-form-control element.
