# Phase 40 — AI authoring quality: the handover prompt

Written 2026-08-04 at the end of the diagnosis session. **Nothing is committed.** The phase number is
provisional — this is the direct successor to Phase 38 (Track W) and can be folded into it if that
reads better.

Paste the block below into a fresh session.

---

You are starting **Phase 40 — AI authoring quality**. This is a *pair-building* session, not a task
list. Richard is going to teach you how a Noodl/NodeGX graph should actually be architected, by
building something with you in the running editor's AI Build panel. Your job is to learn it, then
encode what you learned into the prompts and the node library so the built-in agent and Claude Code
externally both author like an expert.

Read `dev-docs/tasks/phase-40-ai-authoring-quality/HANDOVER.md` (this file) and
`dev-docs/tasks/phase-38-ai-build-ux/README.md` before doing anything. Phase 38 is the same lineage:
Richard drove the whole AI stack end to end and it destroyed 44 nodes on apply. This phase begins the
same way — he drove it end to end again and got a page with no styling and no layout.

## What triggered this, and the thing you must not get wrong

Richard built a puppy-adoption page through the Build panel. It rendered as an unstyled serif column
with a puppy photo overflowing the viewport. His reading was *"the AI produced nodes with zero
styling or any sense of layout."*

**That reading was wrong, and it is the most important fact in this phase.** The agent's submission
was good. It set `flexDirection`, `columnGap`, padding on all four sides, `backgroundColor`,
`borderRadius`, `boxShadow`, `sizeMode`, `objectFit`, real Unsplash images and plausible copy, on
every node, and it grouped the page into named sections. Then **four separate mechanisms threw the
styling away, and not one of them raised an error.**

Do not start this session believing the model is bad at design. Start it believing the seams lie.
When something looks wrong in the render, your first question is *"did this reach the runtime?"* —
not *"why did the model not do this?"* That instinct is the phase's whole lesson.

## Already done — do not redo it

Four seams were found and closed. All of it is **uncommitted** on `cline-dev`. Typecheck is clean and
`npx jest tests-unit/aib-001` is **63 passing**.

1. **`variant` is a connection-only port.** `Text`, `Group` and `net.noodl.controls.button` all
   declare `variant` as `{"name":"string","allowConnectionsOnly":true}`. The port *exists*, so the
   unknown-parameter rule never saw it; the value is a well-formed string, so the value rule never
   saw it either. The agent expressed **all** typography as `variant: "heading-1" | "lead" | "muted"`
   and set no `fontSize`, `color` or `fontFamily` at all — which is why every word rendered at the
   browser default. New `DiagnosticCode.ConnectionOnlyParameter`, severity **error**.

2. **`width: 260, widthUnit: "px"` renders at 260%.** `width`/`height`/`maxWidth`/`minWidth` are
   `dimension` ports with `defaultUnit: "%"`. `widthUnit` is not a port and is ignored; a bare number
   is explicitly legal and is merged into the port's default unit. So the puppy `Image` at
   `width: 228, height: 180` was **228% × 180%**. Two new rules: `unitSuffixTrap` (**error**, for the
   legacy pairing) and `DiagnosticCode.UnitlessDimension` (**warning**, for a bare number on any
   `%`-defaulting port — this is the one that catches the `Image`, which had no unit sibling to give
   the intent away).

3. **`var(--token)` did not resolve in the preview window Richard was looking at.**
   `PreviewTokenInjector` injects the `:root` block only into Electron `<webview>` tags it is handed;
   `html-processor` stamps it only into *built* HTML. `static/viewer/index.html` carries none, so
   anything served over the preview web server — a detached preview window, a phone on the LAN, a
   browser tab — lost every colour, space, radius and shadow. Added `projectGetDesignTokenCss` to
   `editorapi.js` and wired it through `main.js` into `web-server.js`, ahead of the project's own head
   code, matching the export path.

4. **Warnings never blocked the gate.** `authoring/validate.ts` was `ok: errors.length === 0`.
   `UnknownParameter` and `UnitlessDimension` are now blocking **for authored output only**, via a
   `BLOCKING_WARNINGS` set — deliberately *not* by raising severity, because the corpus is full of
   imported nodes carrying settings the catalog cannot see and `validate:project` gaining a new error
   class across it is a separate decision.

Both new rules were calibrated against real content, not guessed. Across every `project.json` in the
repo, units-typed ports appear in `{value, unit}` form **3,589 times** and as a bare number on a
`%`-defaulting port **zero times** — while bare numbers on `px`-defaulting ports (`borderRadius` ×70,
`fontSize` ×11, `letterSpacing` ×6) are common and correct. That is why the rule keys on the port's
default unit rather than the value's shape. `parameterValuesCorpus.test.ts` asserts the corpus error
set is *exactly* `['Text.sizeMode']` and still passes: **zero false positives.**

Replayed over Richard's actual page, the validator now produces **31 findings where it previously
reported clean** — 19 dead `variant`s, 6 mis-united widths, 6 percentage-sized images.

Two prompt changes followed directly and are also done: `StyleVocabulary.ts` no longer offers the
marker-param route (it used to read *"set the element type via the marker param, or copy the styles
it implies"* — the agent took the shorter-looking option, which does not work), and
`prompts/authoring.ts` now carries an "A VARIANT IS NOT A PARAMETER" block and a units block.

### The nine files that are yours

```
packages/noodl-editor/src/editor/src/validation/diagnostics.ts
packages/noodl-editor/src/editor/src/validation/parameterValues.ts
packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/validate.ts
packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/prompts/authoring.ts
packages/noodl-editor/src/editor/src/models/StyleTokensModel/StyleVocabulary.ts
packages/noodl-editor/src/editor/src/utils/editorapi.js
packages/noodl-editor/src/main/main.js
packages/noodl-editor/src/main/src/web-server.js
packages/noodl-editor/tests-unit/aib-001/parameterValues.test.ts
```

**Every other modified file in `git status` was already dirty before this work started** —
`ProjectImporter.ts`, `projectmodel*.ts`, `featureFlags.ts`, `LocalProjectsModel.ts`, `analyze.ts`,
the whole `VersionControlPanel/` set, `package-lock.json`, `nodegx-observe`. Do not attribute them,
do not commit them, and **never `git add -A`** — this is a shared checkout.

## What this session is actually for

**Richard teaches; you build and then encode.** Expect the session to run roughly like this, but let
him lead — he may reorder it.

1. **He teaches you the architecture.** When a repeated block earns its own component. When a
   Repeater over a data source beats three hand-duplicated siblings. How a page should be factored
   into sections, what belongs in a component's interface, when to reach for Component Inputs/Outputs
   versus a shared variable. Ask about the cases you cannot infer from the catalog.
2. **You build it with him in the running editor**, through the AI Build panel where that is the
   point, and by hand where the panel gets in the way. Both are informative — the places you have to
   go around the panel are findings.
3. **You encode it.** Into `prompts/authoring.ts`, `prompts/planning.ts`, the style vocabulary, the
   catalog enrichment, and wherever else it belongs. A lesson that only lives in this conversation is
   a lesson that is lost.

**The bar is Claude-artifact quality.** Richard's words: *"we want Claude artifact quality output or
nobody is going to accept it."* A page that merely validates is not the goal.

## The two known-open problems

**1. Decomposition — the planning prompt argues against it.**
`prompts/planning.ts` line ~79 says *"Keep plans as small as the request allows. Two or three precise
operations beat six vague ones."* There is no instruction anywhere to factor repeated UI into a
reusable component. That is why three identical puppy cards became three hand-duplicated `Group`
subtrees rather than one component instantiated three times, or a Repeater. **Do not rewrite this
prompt from your own taste — this is exactly what Richard is going to teach you.** Get the teaching
first, then write it.

**2. There is no conversation history for in-editor builds.**
`lib21-qa/.nodegx/` is **empty**. Nothing is written at all. The "Show the conversation" affordance
in `ProjectAuthoringView.tsx` (~line 1084) only ever appears for a plan scoped in the *launcher*, and
only when `recovered && !plan && !runState`. Richard cannot reopen a past build conversation to
correct it, which is his third complaint and is a build, not a prompt fix. Scope it after you have
seen what a good session looks like — you will know better then what needs to persist.

## Running it

A dev server was already up in the previous session (`node scripts/start.ts`, webpack watchers, the
Electron editor with `lib21-qa` open). **Check whether it is still running before starting another** —
`ps aux | grep -iE "electron|webpack"`. Two sessions on this checkout fight; a sibling `dev:stop`
kills a `test:ci` silently, and the editor is a queue, not a resource to seize.

**Seam 3's fix needs a full Electron restart.** It touches `main.js` and `web-server.js`, so HMR will
not reach it. Ask Richard before restarting — his editor may have unsaved work.

To verify seam 3 after a restart, with a project open:

```
curl -s http://localhost:8574/ | grep -c "noodl-design-tokens"   # 0 before the fix, 1 after
```

The `run-editor` skill drives the editor headlessly (CDP, screenshots, console). Read its traps
first — `--target=editor` attaches to the **preview**, and closing a webview CDP target white-screens
the editor.

## Traps that will bite you in this specific work

- **A declared `default` never runs its setter.** The most repeated trap in this repo. A port with a
  declared default is not initialised by its `set()` function.
- **A saved project applies a parameter before the port exists.** Jest never reproduces this; only a
  real load does. Anything that looks like an ordering bug in the runtime probably is one.
- **`registerOutputIfNeeded` has two callers**, and a signal/undefined-value port is late forever.
- **HMR will not reach a mounted panel.** Sidebar panels are hidden, not unmounted — restart before
  concluding a UI change did not work.
- **The editor test suite lies three ways.** Only the `Jasmine:` line counts. Editor specs under
  `tests/` are **jasmine, not jest**; `tests-unit/` is jest.
- **A green build proves nothing about packaging** (externals hoisting, `DefinePlugin` folding), and
  a green catalog proves nothing about the editor.
- **Launching the dev editor rewrites the example project.** Revert it after killing the editor.

## How to know you have actually finished

Not "the tests pass". The measure is: **build a page with Richard, look at it rendered in a real
preview window, and have him say it looks good.** Then re-run the same brief through the Build panel
cold, with your prompt changes in place, and see whether the agent gets close on its own. If it does
not, the lesson is not encoded yet — it is still in the conversation.
