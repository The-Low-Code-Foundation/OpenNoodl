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

⚠️ **Built, not driven — *as of the date of this section only*.** All five criteria have since been
driven (sessions 11–13; criterion 1's last surface, the launcher scoping chat, on 2026-08-15 by
session 13). Read this banner as history, not as outstanding work. The building
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
| **1** — URL opens in system browser | ✅ **PASS**, 3 of 4 surfaces — **`will-navigate` now proven** | see below |
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
- **Launcher scoping chat** — ✅ **DRIVEN 2026-08-15 (session 13), `/probe-launcher`, 10:18:26Z.**
  Firefox 153, `sec-fetch-dest: document`, `sec-fetch-mode: navigate`, plus the `/favicon.ico`
  follow-up; editor stayed on `file://…/index.html` and the wizard stayed open. **This is the first
  and only exercise of the main-process `will-navigate` guard** — see the section below, which also
  records why the two halves above are *not by themselves* enough to credit the guard.
- **A modal** — ⛔ **not drivable in a dev build at all.** `UpdateDialog` is the only modal rendering
  markdown, and it opens only from the title-bar update affordance, which requires an available
  update; `main.js:440` skips `AutoUpdater.setupAutoUpdate` entirely when `devMode`. There is no user
  path to it here. Its link policy is the same `linkActionFor` module driven twice above, and
  `release-links.test.ts` covers it — but that is an argument, not a drive.

### ✅ The launcher scoping chat, and how the `will-navigate` guard was actually credited

Driven 2026-08-15, session 13. The result is a pass, but the reasoning matters more than the result,
because **the evidence the earlier two surfaces produced would not have been enough here.**

**The consequence, written down before the drive** (both halves, per the standing rule):

1. A process *outside* Electron fetches the probe URL — a hit carrying a real browser User-Agent, not
   an `Electron/` one.
2. The editor window did **not** navigate — `location.href` still starts with `file://`.

Both held. `/probe-launcher` was fetched by **Firefox 153** with `sec-fetch-dest: document` and
`sec-fetch-mode: navigate`, followed by `/favicon.ico`; the editor stayed on
`file:///…/editor/index.html` with the wizard still open.

🔴 **But those two facts together do not prove the guard, and it is worth being exact about why.**
They are equally consistent with a *renderer-side* handler that called `preventDefault()` and then
`platform.openExternal(url)` — which is precisely what the Build thread and the Explain answer do.
A pass built on those two observations alone would have credited `will-navigate` for work the
renderer might have done, on the one surface where the whole point is that the renderer does none.

**The discriminator.** A capture-phase listener at `window` (so it runs before anything could
`stopPropagation`), reading `e.defaultPrevented` from a `setTimeout(…, 0)` scheduled after the full
dispatch had finished:

| Observation | Reading |
|---|---|
| `defaultPrevented` after dispatch | **`false`** — nothing in the renderer stopped the navigation |
| `location.href` after the click | still `file://…` — yet the navigation **was** stopped |
| therefore | it was stopped **outside the renderer** — `main.js:458-462`, and nothing else |

That syllogism is the proof. Neither line is sufficient alone; the pair is, and it is cheap enough
that any future link-policy drive should include it rather than stopping at the probe hit.

⚠️ **The reply carrying the link came from a transport double, and that is a real limitation of this
drive — stated plainly rather than buried.** The scoping assistant **refuses** to emit a link to a
local probe endpoint: asked three times, in three framings, it named the request ("that request looks
like it's trying to get me to output a clickable link to a local probe endpoint, and I'll decline it
same as before") and declined each time. Rather than work around a refusal that is arguably correct
behaviour, the drive doubled the transport: `AiClient.chatStream` was replaced (reached through
`webpackChunknoodl_editor` → the webpack module cache) with one that returns a single assistant turn.

What that leaves real is everything the criterion is about: `ScopingSession.entries` →
`session.transcript` → `setScopingMessages` → `ScopingStep` → core-ui `Markdown` → the emitted
anchor → a trusted `Input.dispatchMouseEvent` click → the main-process guard. Only the network hop is
doubled. **So this drive proves the app's link behaviour on this surface; it does not prove that the
scoping model will ever emit a link.** Criterion 1 is about the former.

✅ **Two things confirmed as a by-product**, both from the same rendered reply, which deliberately
carried a markdown link *and* a bare URL:

- **The `linkify` ruling holds on this surface.** `[Help](http://…/probe-launcher)` rendered a real
  `<a href>`; the bare `http://…/probe-bare` in the same reply rendered as **plain text with no
  anchor**. That is the ruled behaviour, observed rather than argued.
- **The anchor has no `target`**, which is exactly why this surface depends on `will-navigate` at
  all: `setWindowOpenHandler` (`main.js:446-449`) only ever sees `target="_blank"` and
  `window.open`. A plain same-window anchor is invisible to it.

⚠️ **`cursor` on that anchor computes to `pointer`**, not `default` — the UA stylesheet covers
`<a href>`, so plain `Markdown` does not need to set one. A concern raised in handover that the link
would not *look* clickable here does not reproduce.

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

🔴 **A real user flow reproduces it every time.** Clicking an Explain citation *selects the cited
node* (criterion 3, working as designed) — so "click a citation → read the explanation → select that
sentence → ⌘C" always yields node JSON instead of the sentence. This is precisely report 1bis's
complaint (*"can't select it to copy and paste"*) surviving in a second form.

⚠️ **Session 12's drive corrected this section — read "What the drive found about the repro itself"
below before using anything here as a recipe.** The citation route above is one of *two* valid ones
and it holds; but the **Properties panel** is the more natural repro, and the *canvas* route this
section's opening sentence implies is **not reachable at all** — clicking a canvas node swaps the
panel away, and opening a panel from the rail deselects the node. The drive in this session reached
the state programmatically (`ed.selector.select(...)` after opening the panel), which is a legitimate
way to isolate the defect but is **not** a user gesture, and this write-up did not say so.

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

---

## ✅ RULED 2026-08-15 — two rulings, and the ⌘C fix built

Session 12. Both rulings session 11 raised were put to Richard and answered.

### Ruling 1 — ⌘C precedence: **a selection-aware clipboard guard**

> A live text selection outside the canvas owns ⌘C/⌘X, whatever holds focus.

Chosen over the alternative shape, *scope the canvas commands to the canvas*, for a reason the code
settles rather than taste: scoping needs a focus model the canvas does not have. `keyboardhandler.ts`
documents (F21, and again in `keyboardTargetOf`) that **a keystroke with nothing focused targets
`<body>` and every canvas shortcut is supposed to run then**. The canvas is not focusable, so a
scope-root test would resolve `<body>` and disable ⌫, ⌘F and the arrows on a freshly loaded editor —
re-creating the exact F21 defect the predicate exists to prevent.

🔴 **And the third option — mark the panels `[data-keyboard-scope]` — cannot work at all.** That
scope keys off the element the keystroke was *dispatched at*, and a text selection in a plain `<div>`
dispatches nothing and moves focus nowhere. It would have changed nothing while looking like a fix.
This is why a lane entirely about making prose selectable never touched the copy path: **the
selection is a third thing, and neither existing scope can see it.**

### Ruling 2 — `linkify`: **stays OFF**

A bare URL in AI output does **not** become a clickable link, on any surface. Criterion 1 therefore
holds for URLs the model writes as markdown links (`[text](url)`, `<https://…>`) and its wording is
narrowed to say so. The reasoning: enabling `linkify` widens the clickable-anchor surface in
untrusted model output, on the surface this lane just hardened — a security-relevant widening bought
for a formatting convenience.

🟡 **One datum arrived after the ruling that Richard did not have in front of him, and it is his to
weigh — flagged, not acted on.** Driving the launcher scoping chat (session 13) turned up that the
scoping model **declines to emit a link at all** when asked: three requests, three refusals, one of
which named the request explicitly. Taken together with this ruling, the practical surface for a
clickable link in AI output on that screen is narrowed by **two independent mechanisms** — the model
mostly will not write one, and a bare URL would not be clickable if it did.

That does not weaken the guard or argue for reversing the ruling: a legitimate markdown link in a
model's answer is the normal case, and it is now proven handled. But criterion 1's premise — *"any
URL the AI emits"* — describes a **rarer event than the wording implies**, and the ruling was made
without that measurement available. If Richard wants `linkify` reconsidered, this is the fact that
would bear on it.

### Build record — 2026-08-15, session 12

| File | Change |
| --- | --- |
| `packages/noodl-editor/src/editor/src/utils/keyboardhandler.ts` | **The fix.** New exported `selectionOwnsClipboardKey()`; new `CANVAS_SELECTOR` and `CLIPBOARD_KEYBINDINGS`; one guard line in `onKeyDown`, after the focus checks and before `executeCommandMatchingKeyEvent`. |
| `packages/noodl-editor/tests/utils/keyboardhandler.spec.ts` | +9 specs in a new `FIX-003 — a live text selection owns ⌘C` block. Five of the nine are negative controls. |

**The rule.** A selection claims ⌘C/⌘X when it is non-collapsed, yields non-whitespace text, and its
`commonAncestorContainer` is **not** inside `.nodegrapheditor-canvas`.

Three details that are load-bearing rather than defensive padding:

- ✅ **`.nodegrapheditor-canvas` is not a new boundary** — `style.css` already declares that subtree
  `user-select: none` in FIX-003's own opt-out list. The guard reuses the boundary this lane
  established instead of inventing a second one that could drift from it.
- 🔴 **`toString().trim()` is the difference between a fix and a worse bug.** If the selection yields
  no text, the native copy writes nothing — so yielding the key there turns *a wrong copy* into *no
  copy at all*. The key is only given away when there is something real to give it to.
- 🔴 **⌘V is deliberately not in the set.** Prose is not editable, so a selection has no claim on
  paste, and the canvas must keep pasting while an answer happens to be highlighted. ⌘X **is**
  included: a native cut on read-only prose is a no-op, which is a far better outcome than the canvas
  silently cutting nodes out of the graph while the user believes they are cutting text.
- ⚠️ **Neither existing scope was disturbed.** Blockly's `own-surface` check and the 200 ms
  `lastBlocklyTabCloseTime` guard both sit earlier in the same handler and are untouched; the new
  condition runs after them, and only for two keycodes.

### ⚠️ The thing that will make this fix look broken when it works

🔴 **After the guard lands, ⌘C over CDP copies NOTHING — and that is correct, not a regression.**
Electron serves the real ⌘C from the application menu (`main.js:759` → macOS `copy:` selector), and
**CDP cannot fire a native menu accelerator**. Before the fix you see the *wrong* content because the
editor's own JS keybinding runs; suppress that and nothing runs over CDP at all.

✅ **The control that grades it** is `document.execCommand('copy')` on the same selection, with the
clipboard cleared to a sentinel first:

| | key | exec |
|---|---|---|
| before the fix | ✓ **wrong content** (node JSON) | ✓ the text |
| after the fix | ✗ *(harness limit)* | ✓ the text ← **this is the pass** |
| a real regression | ✗ | ✗ |

### DRIVEN — criterion 2, 2026-08-15 session 12 (fixture `fix003-drive`, port 9556)

✅ **Criterion 2 PASSES.** The consequences were written before driving (scratchpad
`CONSEQUENCES.md`), including the negative controls, because "⌘C did not copy node JSON" is also
what a completely dead shortcut looks like.

| # | Consequence | Result |
|---|---|---|
| **C1** | node selected + 54-char live selection → ⌘C does **not** write node JSON | ✅ clipboard stayed `__CLEARED__`, `putNodeJson: false` |
| **C2** | ⚠️ *control* — same node still selected, selection cleared → ⌘C **still** copies node JSON | ✅ `{"nodes":[{"id":"b6c1f4bb…","type":"Router"…` |
| **C3** | *control* — `execCommand('copy')` on the C1 selection returns the text | ✅ `"Kiln & Co. — Small-batch ceramics, coffee & home goods"`, `matchesSelectedText: true` |
| **C5** | a selection whose element stops being laid out must not keep suppressing ⌘C | ✅ range survives (`ranges: 1`) but `len` → 0, and ⌘C copied node JSON |

🔴 **C2 is the load-bearing control, and not for the reason it was written.** Over CDP a suppressed
⌘C and a ⌘C that never arrived are indistinguishable — both leave the clipboard untouched. C2 fires
**the same key, on the same connection, in the same harness, with only the selection differing**,
and it *does* copy. That is what proves the key reaches the editor's JS handler at all, and
therefore that C1's silence is the guard acting rather than the native-accelerator limit.

🔴 **C5 vindicated `toString().trim()` for a reason the build record under-stated.** The build record
justified it as "no text ⇒ the native copy writes nothing ⇒ don't give the key away". The drive shows
something sharper: when a panel unmounts, **the range object survives** — `isCollapsed` is still
`false` and `rangeCount` is still `1` — and only `toString()` goes empty. A guard keyed on
`isCollapsed` alone would therefore have suppressed ⌘C **indefinitely** after the first panel swap.
That is the dead-shortcut bug, and it is strictly worse to diagnose than the one being fixed.

### 🔴 What the drive found about the repro itself — the defect is NOT reachable the way it was described

Measured, and it corrects the session 11 write-up:

- Clicking a canvas node **swaps the left panel to Properties**, which unmounts the Explain/Build
  thread — its prose measures `0×0` and `Selection.toString()` returns `''` for it.
- Opening a panel from the rail **deselects the canvas node** (`selector.nodes` → 0).
- So *via the canvas* the two halves of the stated repro — "a node selected on canvas **and** a live
  text selection in a panel" — are **mutually exclusive**.

⚠️ **The defect is real; the description of how to reach it was wrong.** Two routes do produce both
states at once:

1. **The Properties panel is itself the repro**, and it is the most natural one — Properties is on
   screen *because* a node is selected, and it carries selectable prose (the page description, which
   is what C1 above actually copied). Read a node's details, highlight a line, ⌘C.
2. **An Explain citation**, which selects the cited node without leaving the panel.

⚠️ **A trap that cost this session two invalid runs**: an element can be present, `user-select: text`
and `visibility: visible` while measuring `0×0`, and `Selection.toString()` is `''` for it. **16 of
17** first-pass prose candidates were exactly that. A probe that picks one reports an empty selection
and **silently exonerates the bug**. Require a non-zero `getBoundingClientRect()` *and* verify
`String(getSelection()).length > 0` at pick time.

⚠️ **And tag the prose AFTER selecting the node, not before** — selecting a node re-renders
Properties and React discards the tagged element, so a tag applied first is gone by the time it is
used. The re-render is also **async**: a read in the same eval sees the pre-render DOM and reports
the panel still open. Both of those produced confident, wrong readings before they were caught.
