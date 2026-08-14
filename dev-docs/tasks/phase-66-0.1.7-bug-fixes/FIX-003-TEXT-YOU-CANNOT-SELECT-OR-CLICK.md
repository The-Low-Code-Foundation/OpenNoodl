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

## 🔴 Ruling needed

**Invert the global rule, or keep opting in per surface?** Inverting (`user-select: text` default,
opt *out* on canvas/tree/drag surfaces) is the correct end state but risks drag-behaviour
regressions on the canvas, panels trees and list rows; per-surface opt-in is safe and incremental.
Recommend: opt-in now (steps 1-3), file the inversion as a follow-up with a drag-surface test plan.

## Acceptance criteria

1. Any URL the AI emits in the Explain answer, the Build thread, the launcher scoping chat, and
   a modal opens in the system browser on click. Driven per surface.
2. Text in all four surfaces is selectable and copyable (⌘C yields the text).
3. Explain citations (`noodl-node:` links) still navigate to the node — the delegation branch must
   not regress LEG-003's citation contract.
4. The Build panel renders markdown (bold, lists, code, links) in assistant turns.
5. `release-links.test.ts` still green; new spec on the shared `AiMarkdown` link policy.
