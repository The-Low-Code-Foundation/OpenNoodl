# CED-001: Code Editor Overhaul & Inline AI Copilot

## Metadata

| Field | Value |
|-------|-------|
| **ID** | CED-001 |
| **Phase** | Phase 29 — Code Editor (Track N) |
| **Tier** | Slices A–B are independent and ship alone; C depends on A; D is optional and later |
| **Priority** | 🟠 High — B is a live project-file defect; A is the daily authoring experience |
| **Difficulty** | 🟢 Low (A) · 🟠 Medium (B, C) · 🔵 Design-led (C2–C5, D) |
| **Estimated Time** | A: 1–2 days · B: 2–3 days · C: 5–8 days · D: separate |
| **Prerequisites** | None for A/B. C needs A2 and A7 landed, and AIX-001's `AiClient` (already shipped) |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟢 **Sonnet 5** for A and B1–B2 · 🟠 **Opus** for B3–B4 and C1/C3 · 🔵 **Fable** for the C2/C5 interaction design and the D decision |
| **Status** | 🟡 Slices A and B complete (2026-07-29). C not started; D not scheduled |

## Objective

Stop the code editor fighting the library it is built on, get code history out of `project.json`, and
add an inline AI copilot so a person can describe a line or a function in words and get reviewable
code back — without leaving the editor.

## Background — how we got here

The code editor has three commits behind it:

| Commit | What it did |
|---|---|
| `6f081635` "new code editor" | Built the CodeMirror 6 editor, history manager, diff, formatter, validator — replacing Monaco for Function/Expression/Script ports |
| `addd4d9c` | Bug-fix pass over the above |
| `f14fd14b` (DEBT-011) | Moved JSON + array ports onto it, deleted the dead per-node TypeScript-intellisense subsystem, wrote `dev-docs/future-projects/TYPED-INTELLISENSE-REVIVAL.md` |

**The base library choice is correct and is not in question.** CodeMirror 6 is the right editor for an
Electron app: modular, no web workers, a fraction of Monaco's weight, and Monaco is what was deliberately
retired. [`CodeDiffView.tsx`](../../../packages/noodl-core-ui/src/components/code-editor/CodeDiffView.tsx)
— which uses `@codemirror/merge` directly — is the reference for how the rest of the folder should look.

What went wrong is the layer built *on top*: features CodeMirror already ships were re-implemented by
hand, several stock extensions were switched off so the hand-rolled ones would not conflict with them,
and code history was persisted in the one place it should never have gone.

## Audit findings

Recorded 2026-07-28 from a read of the whole subsystem. Every row is evidence, not speculation.

| # | Finding | Evidence |
|---|---|---|
| 1 | **Code history is written into `project.json`.** Up to 20 full copies of every code parameter, per node, serialised with the graph. Bloats the project file, churns git on every save, hands the SUB-007 merge driver 20 code blobs per node to reconcile, and **deploys to production**. Also triggers a project write on every editor close via `metadataChanged` | [`CodeHistoryManager.ts:186`](../../../packages/noodl-editor/src/editor/src/models/CodeHistoryManager.ts#L186), serialised at [`NodeGraphNode.ts:1529`](../../../packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphNode.ts#L1529) |
| 2 | **Autocomplete is crippled by one word.** `override: [noodlCompletionSource]` *replaces* all language completion, so the editor offers 25 hardcoded strings and loses local variables, keywords, scope and property completion that `javascript()` gives free | [`codemirror-extensions.ts:399`](../../../packages/noodl-core-ui/src/components/code-editor/codemirror-extensions.ts#L399) |
| 3 | **The linter is dead code.** `createLinter()` is defined and never added to the extensions array; `lintGutter` is imported and unused. There are no inline squiggles — errors surface only in the panel below the editor | [`codemirror-extensions.ts:308`](../../../packages/noodl-core-ui/src/components/code-editor/codemirror-extensions.ts#L308) |
| 4 | **`closeBrackets()` and `indentOnInput()` are "PERMANENTLY DISABLED"** so they stop conflicting with a hand-rolled `handleEnterKey`. The stock extensions are syntax-tree-aware; the replacement knows three bracket pairs and re-indents by `tabSize` regardless of context | [`codemirror-extensions.ts:421-424`](../../../packages/noodl-core-ui/src/components/code-editor/codemirror-extensions.ts#L421-L424) |
| 5 | **The formatter can corrupt valid code.** A character loop with a naive string-state machine: it does not know `//` comments, regex literals, `${}` inside template literals, or `for (i=0; i<n; i++)` — which gets a newline after each semicolon | [`jsFormatter.ts`](../../../packages/noodl-core-ui/src/components/code-editor/utils/jsFormatter.ts) |
| 6 | **Validation positions are decorative.** `new Function(...)` catches syntax errors, then the message is regexed for `line (\d+)` — which V8 almost never emits. `parseErrorLocation` returns `undefined` nearly always, so the linter's position maths (were it wired) points at the whole document | [`jsValidator.ts`](../../../packages/noodl-core-ui/src/components/code-editor/utils/jsValidator.ts) |
| 7 | **Two diff implementations.** A hand-rolled LCS serves the history dropdown while `@codemirror/merge` sits next door serving `CodeDiffView`. `calculateSimilarity` is a character-bag overlap, so `"abc"` vs `"cba"` scores 1.0 | [`codeDiff.ts`](../../../packages/noodl-core-ui/src/components/code-editor/utils/codeDiff.ts) |
| 8 | **Layering violation.** `noodl-core-ui` — the design-system package — dynamically imports `@noodl-models/CodeHistoryManager` out of the editor app, with a `.catch(console.warn)` that silently disables history | [`CodeHistoryDropdown.tsx:63`](../../../packages/noodl-core-ui/src/components/code-editor/CodeHistory/CodeHistoryDropdown.tsx#L63) |
| 9 | **`width="100%"` produces a 400px editor.** `parseInt("100%")` → 100, then `minWidth: 400` clamps it. The Expression modal's editor is 400px wide regardless of the modal | [`JavaScriptEditor.tsx:53`](../../../packages/noodl-core-ui/src/components/code-editor/JavaScriptEditor.tsx#L53), consumer at [`ExpressionEditorModal.tsx:105`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/ExpressionEditorModal/ExpressionEditorModal.tsx#L105) |
| 10 | **The controlled-value sync is dead after the first keystroke.** The guard returns early when `changeGeneration > lastSynced`, but `lastSynced` only advances *inside* the block that guard blocks. The `value` prop is ignored from the first edit onward. Benign today — no consumer pushes a value back — but the component documents itself as controlled and is not | [`JavaScriptEditor.tsx:167`](../../../packages/noodl-core-ui/src/components/code-editor/JavaScriptEditor.tsx#L167) |
| 11 | **Undo is all-or-nothing.** Format, history restore and external sync each dispatch a whole-document replace, so one `Cmd-Z` discards everything | [`JavaScriptEditor.tsx:109,181,258`](../../../packages/noodl-core-ui/src/components/code-editor/JavaScriptEditor.tsx#L109) |
| 12 | **Zero tests.** Nothing in the repo covers the validator, formatter, diff, history manager or the component | — |

## Non-goals

- **Replacing CodeMirror.** Not with Monaco (retired for good reasons), not with anything else. The
  answer here is *less* code on the same library.
- **Rewriting the property-panel `TypeView` plumbing.** `CodeEditorType` stays a `TypeView` that mounts a
  React root into a popout; only what it passes changes.
- **The inline `ExpressionInput` / `ExpressionToggle` field.** Adjacent, sharing no code with the popout
  editor. If it grows problems, it gets its own task.
- **Retiring the legacy `AiAssistantModel` / `AiCopilotContext` template system.** Slice C builds beside
  it on `AiClient`, and does not migrate the existing Function-node chat.

---

## Slice A — Stop fighting CodeMirror

Almost entirely deletion. Expect a net-negative line count.

- [x] **A1 — Restore stock bracket and indent behaviour.**
      Delete `handleEnterKey` and its keymap entry; re-enable `closeBrackets()`, `closeBracketsKeymap`
      and `indentOnInput()`. Remove the "PERMANENTLY DISABLED" comment block.
      *Acceptance:* typing `function f() {` + Enter indents from the syntax tree; typing `(` inserts the
      pair; typing the closing `)` over an auto-inserted one types through instead of duplicating.

- [x] **A2 — Completions become an added source, not an override.**
      Replace `override: [noodlCompletionSource]` with the Noodl source registered *alongside* the
      JavaScript language's own completion. Keep the Noodl entries; they are useful.
      *Acceptance:* a local `const total = 1` is offered when typing `tot`; `Noodl.` still offers
      `Variables` / `Objects` / `Arrays`. Also drop the unused `syntaxTree` import from
      [`noodl-completions.ts`](../../../packages/noodl-core-ui/src/components/code-editor/noodl-completions.ts).

- [x] **A3 — Wire real diagnostics, or drop the dependency.**
      Source diagnostics from the Lezer tree that `javascript()` already builds (walk for error nodes)
      rather than from `new Function` message-regexing. Add `linter(...)` and `lintGutter()` to the
      extension array. Keep the summary panel; it is good, it just should not be the only signal.
      *Acceptance:* an unclosed brace squiggles at the offending position, not across the whole document;
      the gutter marker appears; `@codemirror/lint` is either used or removed from `package.json`.

- [x] **A4 — Retire the hand-rolled formatter.**
      Either wire `prettier/standalone` + `parser-babel`, or delete the Format button. Do not ship a
      formatter that can mangle code. See the dependency trap below before choosing.
      *Acceptance:* `for (let i = 0; i < n; i++) {}`, a regex literal, a `//` comment and a template
      literal with `${}` all survive a format round-trip byte-identical where already well-formed.

- [x] **A5 — One diff implementation.**
      Delete [`codeDiff.ts`](../../../packages/noodl-core-ui/src/components/code-editor/utils/codeDiff.ts)
      and render the history dropdown's diffs through `CodeDiffView`. The `getDiffSummary` line-count
      label can be derived from `@codemirror/merge`'s chunks.
      *Acceptance:* the history diff modal renders through `MergeView`; `codeDiff.ts` is gone.

- [x] **A6 — Fix the size props.**
      Accept CSS strings (`'100%'`, `'70vh'`) as-is and only parse to a number when the value is numeric
      or `px`. Keep the drag-resize path working on numbers.
      *Acceptance:* `ExpressionEditorModal` fills its modal.

- [x] **A7 — Replace the generation counters with a transaction annotation.**
      Tag the component's own dispatches with a `StateEffect`/`Annotation` and have the update listener
      ignore its own echo — the standard CM6 pattern. Delete `changeGenerationRef` /
      `lastSyncedGenerationRef`.
      *Acceptance:* setting `value` from outside after the user has typed updates the document; typing
      does not loop.

- [x] **A8 — Undo granularity.**
      Format, restore and external sync should dispatch a computed minimal change rather than a
      full-document replace, so `Cmd-Z` steps back sensibly.
      *Acceptance:* formatting then `Cmd-Z` restores the pre-format text as one step and leaves earlier
      typing history intact.

- [x] **A9 — Tests.**
      The subsystem has none. Cover: validator verdicts per `ValidationType`; the annotation round-trip
      in A7; size-prop parsing; and (if kept) the formatter's round-trip idempotence.
      *Acceptance:* suites run in the package's existing runner — `noodl-core-ui` uses jest, and the
      editor package's specs are **jasmine, not jest** (see AIX-011).

---

## Slice B — Code history off the project file

- [x] **B1 — Stop writing `codeHistory_*` into node metadata.**
      Remove the `saveHistory` write path in
      [`CodeHistoryManager.ts`](../../../packages/noodl-editor/src/editor/src/models/CodeHistoryManager.ts)
      and the `saveSnapshot` call in
      [`CodeEditorType.ts:138`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/CodeEditor/CodeEditorType.ts#L138).
      *Acceptance:* editing and closing a Function node produces no `metadata` delta in `project.json`.

- [x] **B2 — Migration: strip existing keys.**
      Projects in the wild already carry these arrays. Strip `codeHistory_*` on load (or on the next
      write) so existing projects shrink rather than freeze at their current size.
      *Acceptance:* opening the NodeGX QA fixture — or any project with history — and saving removes the
      keys; graph diff shows the removal once and never again.

- [x] **B3 — Decide what backs history. ✅ DECIDED 2026-07-29: a sidecar file.**
      The task file recommended git. Richard chose the fallback — `<project>/.nodegx/code-history.json`,
      written by [`CodeHistoryStore`](../../../packages/noodl-editor/src/editor/src/models/CodeHistory/CodeHistoryStore.ts).
      The reasoning against git: it cannot do per-parameter history without parsing a whole
      `project.json` per revision, it has nothing to show until the user commits, and it is blank for
      projects not under version control — so the History button would be empty exactly when a person
      most wants it. The sidecar keeps the existing 20-snapshot UX and the Preview/Restore dropdown
      working unchanged, and `.nodegx/` was already the reserved, deploy-excluded location for the
      editor's own project state (`compilation/build/ignore.ts`). The store adds `.nodegx/` to the
      project's `.gitignore` on first write.
      *Acceptance:* the History button shows snapshots of that parameter, sourced from outside
      `project.json`. ✅ Verified live — see the progress log.

- [x] **B4 — Core-ui takes a provider, not a dynamic import.**
      Replace `import('@noodl-models/CodeHistoryManager')` with a `historyProvider` prop supplied by
      `CodeEditorType`. The design-system package must not reach into the editor app.
      *Acceptance:* `grep -r "@noodl-models" packages/noodl-core-ui/src` returns nothing from the
      code-editor folder; history still works when the provider is passed and the button hides when it
      is not.

---

## Slice C — Inline AI copilot ("say what you want, get reviewable code")

The goal is a person who cannot yet write the line describing it in words, seeing the code arrive as a
**diff they choose to accept**, and being able to ask why it works. It is an authoring tool and a
teaching tool at the same time — which is why nothing lands silently.

### The seam

Build on [`AiClient`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/AiClient.ts)
— the provider-agnostic client from AIX-001 (`chat`, `chatStream`, `getActiveModel().capabilities`,
usage/cost recording). **Not** on the legacy `AiAssistantModel` / `AiCopilotContext` template system: that
one stores chat history in the project file, which is the very mistake Slice B is undoing.

- [ ] **C1 — `CodeCopilotSession` on `AiClient`.**
      A small session object in `AiAssistant/` owning: the request, streaming, cancellation
      (`AbortController`), and turning a response into a proposed document. No UI, no CodeMirror imports
      — testable headlessly.
      *Acceptance:* a unit test drives a fake provider and gets a proposed document out.

- [ ] **C2 — The prompt bar (`Cmd-K`).**
      An inline single-line prompt in the editor toolbar or over the current line. Two intents, inferred
      from whether there is a selection: **edit this selection**, or **insert here**. Escape cancels an
      in-flight request.
      *Acceptance:* select three lines, `Cmd-K`, "make this handle an empty array", get a proposal.

- [ ] **C3 — Proposals arrive as an accept/reject diff, never as a silent write.**
      Use `@codemirror/merge`'s `unifiedMergeView` with `acceptChunk` / `rejectChunk` — already a
      dependency, already proven in `CodeDiffView`. Per-chunk accept means a person can take one line of
      a three-line suggestion.
      *Acceptance:* a proposal renders inline with accept/reject affordances; rejecting everything leaves
      the document byte-identical; accepting is one undo step.

- [ ] **C4 — Context is the node, not just the text.**
      Send the node's type and its actual input/output port names alongside the code and the validation
      type. This is what makes a suggestion for a Function node correct rather than generic — the model
      should write `Outputs.total`, not invent a name.
      *Acceptance:* on a Function node with inputs `items`, `taxRate`, "sum the items with tax" produces
      code referencing `Inputs.items` and `Inputs.taxRate`.

- [ ] **C5 — Explain mode (the learning angle).**
      Select code (or nothing, for the whole document) → "explain this". Prose, in a side rail, with no
      edit proposed. Follow the conventions in
      [`AiAssistant/explain/`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/explain/),
      which already does this for graphs.
      *Acceptance:* explaining a `reduce` produces prose and changes no code.

- [ ] **C6 — A chat rail in the popout.**
      Multi-turn refinement beside the editor ("now handle the null case"), reusing the
      `@noodl-core-ui/components/ai` chat primitives the authoring panel uses. Session-scoped, in
      memory — **history is not persisted to the project**.
      *Acceptance:* a second turn refines the first proposal; closing the popout discards the thread.

- [ ] **C7 — Guardrails.**
      Hide the whole affordance when `AiClient.isConfigured()` is false. Route the "AI is off" state to
      the same settings entry point the authoring panel uses. Record usage via the existing
      `authoringTelemetry` conventions. Never auto-save; never write to the project on the AI's behalf.
      *Acceptance:* with AI disabled the editor looks and behaves exactly as it does today.

---

## Slice D — Typed intellisense (optional, later)

- [ ] **D1 — Pick up [`TYPED-INTELLISENSE-REVIVAL.md`](../../future-projects/TYPED-INTELLISENSE-REVIVAL.md).**
      The genuinely missing capability is *types*: a generated `.d.ts` for `Inputs` / `Outputs` / the
      Noodl API, fed to a TypeScript language service, giving real completion, hover and diagnostics.
      This is what Monaco was originally wanted for and it is achievable on CM6 without Monaco's weight.
      Not scheduled here — noted so Slice A's completion work does not get designed in a way that
      forecloses it.

---

## Traps

- **Adding a dependency leaves every checkout unbuildable until `npm install` runs.** This repo has
  already been bitten (see the reasoning in
  [`markdown-language.ts`](../../../packages/noodl-core-ui/src/components/code-editor/markdown-language.ts)).
  `prettier` is present at the repo root at 2.8.8 but as a **devDependency** — shipping it inside
  `noodl-core-ui` is a real dependency addition, not a free one. Weigh that against deleting the Format
  button in A4.
- **`noodl-core-ui` is consumed by Storybook as well as the editor.** Anything requiring editor models
  must arrive by prop (this is exactly what B4 fixes).
- **The editor package's specs are jasmine, not jest.** `noodl-core-ui` is jest. Do not write a jest
  suite into `noodl-editor/tests`.
- **HMR keeps stale component instances alive.** When live-verifying, a full editor restart is often
  required before a change to the popout is visible (see UIX-013, LIB-005).
- **CDP driving: `--target=editor` silently attaches to the preview window.** Use `--target=dashboard`.
  Launch detached; never `cdp reload`.

## Verification

Per slice, in this order:

1. `npx tsc --noEmit` clean in `noodl-core-ui` and `noodl-editor`.
2. Package test suites (`test:ci`).
3. The TSFixme ratchet (PLAT-004) is not regressed.
4. **Live editor QA** — this subsystem's defects (findings 9, 10, 11) are all things that compile fine
   and only show up when you open the popout. Run the editor, open a Function node, an Expression field,
   an Options node's `Items` array and a JSON port, and drive each one.
5. For Slice B specifically: open a project with existing history, save, and diff `project.json`.

---

## Progress log

Newest entry last. One entry per working session, whatever was achieved.

### 2026-07-28 — Audit and task file
- Read the whole `code-editor` folder, `CodeHistoryManager`, `CodeEditorType` and all five consumers.
- Recorded the 12 findings above. Nothing implemented yet.
- Confirmed `@codemirror/merge` already exports `unifiedMergeView` / `acceptChunk` / `rejectChunk` — the
  accept/reject affordance in C3 needs no new dependency.
- Confirmed `prettier@2.8.8` resolves at the repo root but is a devDependency (A4 trap).
- Confirmed the subsystem has zero tests.
- **Open decision for Richard:** B3 — what backs code history. Recommendation is git; see B3.

### 2026-07-29 — Slices A and B, built and live-verified

**B3 decided: sidecar file** (Richard), not git. Reasoning recorded on B3 above.

**Slice A.** Net deletion, as expected.
- **A1** `handleEnterKey` deleted; `closeBrackets()`, `closeBracketsKeymap` and `indentOnInput()` restored,
  along with `lintKeymap`. The redundant hand-written `Mod-z`/`Mod-y` bindings went too — `historyKeymap`
  already carries them.
- **A2** `override: [noodlCompletionSource]` replaced by
  `javascriptLanguage.data.of({ autocomplete: noodlCompletionSource })`, so the Noodl entries run beside
  the language's own local-variable and snippet sources rather than instead of them. The source is not
  registered for JSON, where Noodl globals are not in scope.
- **A3** New [`syntaxDiagnostics.ts`](../../../packages/noodl-core-ui/src/components/code-editor/utils/syntaxDiagnostics.ts)
  walks the Lezer tree for error nodes; `linter(...)` and `lintGutter()` are in the extension array.
  Zero-length error nodes are widened onto a neighbouring character so they actually draw, and a run of
  errors from one mistake is merged into one diagnostic. `firstErrorPosition` feeds the summary panel a
  real line/column, which is the part of finding 6 that a linter alone would not have fixed.
- **A4** `jsFormatter.ts` **deleted**. Format now dispatches `indentRange(state, 0, doc.length)` — the
  language's own indentation service. It only ever rewrites leading whitespace, so it cannot corrupt
  code, it needs no new dependency (so the prettier trap does not apply), and it returns a minimal change
  set, which gives A8 for free on that path.
- **A5** `codeDiff.ts` **deleted**. `CodeHistoryDiffModal` renders through `CodeDiffView`/`MergeView`; the
  dropdown label comes from new `summariseDiff`, built on `@codemirror/merge`'s chunks. About 120 lines of
  now-dead per-line diff CSS went with it. `formatTimestamp` was written out three times with three sets
  of thresholds — now one module.
- **A6** New `parseSizeProp`: numbers and `px` strings become numbers (the drag-resize path needs
  arithmetic), every other CSS length passes through untouched. The `minWidth`/`minHeight` floors are
  applied only to pixel sizes — a 400px floor on a `'100%'` editor in a narrow modal only overflows it.
- **A7** Generation counters deleted. `externalValueSync` annotation marks the component's own
  value-prop dispatches and the update listener skips them. Format and restore are deliberately *not*
  annotated: they are real edits the consumer needs to hear about, so their manual `onChange` calls could
  go too.
- **A8** External sync and restore dispatch a computed `minimalChange` instead of a whole-document
  replace.
- **A9** `noodl-core-ui` **had no test runner at all** — the task file's note that it "uses jest" was
  stale (`@types/jest` in devDependencies, no jest, no config, no `test` script). Added one, scoped to a
  new `tests/` sibling of `src/`, `testEnvironment: 'node'` so it needs no `jest-environment-jsdom`
  (absent from the tree; adding it would leave every checkout failing until the next `npm install`).
  **44 specs, green.** Wired into the root `test:packages` scope so it is actually in CI — the RUN-004
  lesson.
- Also deleted: an `indentGuides()` ViewPlugin that was defined and never added to the extension array,
  same as `createLinter()`. Not enabled — its stylesheet rule put `position: absolute; width: 1px` on a
  *line* decoration, which would collapse every indented line. Dead and wrong; the rule went too.

**Slice B.**
- **B1** `CodeHistoryManager` **deleted**, replaced by `models/CodeHistory/`. `CodeEditorType` and
  `AiChat` both snapshot through `CodeHistoryStore`, fire-and-forget — a snapshot that cannot be written
  must never hold up the write of the user's actual code.
- **B2** `stripCodeHistoryMetadata` runs in `NodeGraphNode.fromJSON`, so the keys never enter the model
  and the next write sheds them. A node whose only metadata was history loses the metadata object
  entirely rather than serialising `"metadata": {}`.
- **B3** `CodeHistoryStore` writes `<project>/.nodegx/code-history.json`, keyed `<nodeId>/<parameter>`,
  20 snapshots per parameter, parameters aged out at 30 days (nothing else deletes entries for nodes that
  no longer exist). Read-modify-write is serialised through a promise chain, since closing a popout can
  save two ports in a tick. Every failure path degrades to "no history", never to a failed save.
- **B4** `historyProvider` prop replaces `nodeId`/`parameterName`; `CodeEditorType` supplies it, and only
  for editable ports of a project that exists on disk. `grep -r "@noodl-models"
  packages/noodl-core-ui/src/components/code-editor` returns nothing.

**Verification.**
- `npx tsc --noEmit` clean in both packages (the only editor errors are the untracked in-flight
  `BlocklyEditor/` work in this tree, which is not ours).
- `noodl-core-ui`: 44/44 jest specs pass. TSFixme ratchet: this task contributes **+0**; the tree was
  already +14 RED from the in-flight workflow/canvas work. Lint ratchet 3092 under baseline. Hex-colour
  ratchet holding.
- **The editor's jasmine suite could not be run**: `npm run test:ci` fails at the webpack build on 29
  type errors in the untracked `BlocklyEditor/` work. The new `tests/models/code-history.test.ts` is
  therefore committed unrun in its own runner, though it typechecks and its subject is verified live
  below.
- **Live editor QA** — drove a real project (a copy of the NodeGX QA fixture, with 20 `codeHistory_*`
  snapshots injected into a Function node and 1 into an Expression node) through the running app:
  - **A1** typing `function f() {` yields `function f() {}` — `(` auto-pairs, `)` types *through* the
    auto-inserted one, `{` auto-pairs. Enter between the braces produces a 2-space-indented body with `}`
    on its own line, from the syntax tree.
  - **A2** typing `tot` inside the function offers the local `total`; `Noodl.V` offers `Variables`. Both
    sources, side by side.
  - **A3** an unmatched brace gives **one** diagnostic at line 5 column 17, span **1 character** in a
    113-character document, with the gutter marker and inline squiggle both drawn. The panel reads
    "Line 5, Column 17". Broken JSON lands at line 3 column 8 — the comma — even though V8's message for
    that error carries no position at all.
  - **A4** a document with `for (let i = 0; i < 10; i++)`, a regex literal containing `;` and `{}`, a `//`
    comment containing a brace and a semicolon, and a template literal with `${}` and a `;` survives
    Format **byte-identical**. Badly-indented code is correctly re-indented, nested bodies included.
  - **A8** type, then Format, then one Cmd-Z: back to the pre-format text with the typing intact.
  - **A5/B3/B4** two saves produce two snapshots in `.nodegx/code-history.json` and a `.gitignore`
    containing `.nodegx/`; the dropdown lists them labelled "No changes" and "+1 line, −1 line"; Preview
    renders a syntax-highlighted `MergeView`.
  - **B1/B2** after edit → save → close, `project.json` contains **zero** `codeHistory_` keys. The
    injected node's metadata went from 2142 bytes (20 snapshots) to 47.
  - **A6** the Expression modal's editor renders `width: 100%` with **no** `min-width` floor — 660px
    filling its 660px wrapper in a 700px modal. It was a 400px stub.
  - All four consumer paths opened and driven: Function node, Expression node, Options node `Items`
    array (EXPRESSION mode), Static Data JSON port (JSON mode).

**Noticed, not fixed, out of scope.**
- Opening *any* project rewrites `project.json`: it drops the top-level `rootComponent` and each
  component's `visual: true`, and adds `graph.visualRoots`. Pre-existing, unrelated to this task, and
  already recorded — but it fired on a local copy of the QA fixture during this session and was restored.
- `CodeEditorType.getValidationType()` classifies the Expression *node's* code port as `function`, not
  `expression`, because it matches on the port's type name rather than the node's. Harmless today (both
  validate `a + b`) and untouched here.

---

## Changelog

| Date | Change |
|---|---|
| 2026-07-28 | Created from the code-editor audit. Phase 29 / Track N opened for it. |
| 2026-07-29 | Slices A and B built and live-verified. B3 decided: sidecar file, not git. Status → 🟡. |
