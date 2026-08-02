# ERG-002 build notes — external libraries in app config

Built in worktree `wt-erg-002` off `cline-dev@2a1138a8`. This session could not launch the Electron
editor or run a deployed build (the primary checkout held the single-instance lock and running Electron
was explicitly forbidden) — everything below was verified with `npx jest` and `npx tsc --noEmit` inside
each package, never `npm run test:ci`/`npm run dev:*`.

## What was measured (and where the spec's §0 was stale)

Re-verified every line-number citation in §0/§3 against the actual file, since this repo's own memory
records "four stale spec premises in a single recent batch" as a standing risk:

- `injectIntoHtml`'s original `:275-302` / `:285` / `:296-297` citations were correct as of 2026-08-01,
  but this task's own additions (the verify/register/list/remove functions, ~400 lines) now sit *above*
  `injectIntoHtml` in `projectmodules.ts` — so it's `:676-738` / `:686` / `:697-698` post-build. Corrected
  in the spec file with a note explaining why the drift happened (self-caused, not a pre-existing error).
- `external/ssr/index.js:68` was wrong even before this task touched anything — there is no `external/`
  directory; the real path is `packages/noodl-viewer-react/static/ssr/index.js:68`. Corrected.
- `web-server.js:73` was off by one (`:72` is the actual `customHeadCode` replacement line). Corrected.
- `html-processor.ts:46-66` and `javascript.ts:692-694` (the `Script Downloader`-has-no-replacement
  finding) both checked out exactly as cited — no change.
- `build/ignore.ts` genuinely has no `noodl_modules` entry — the "ships verbatim on deploy" claim holds
  structurally (I could not re-run NDA-007's actual deployed-build witness; see "could not verify" below).

No premise about *behaviour* (the `runtimes` filter, http(s)-URL passthrough, the four consuming HTML
paths) turned out to be wrong — only citations moved or were mistyped. §0/§1/§2's design reasoning was
sound and is what got built.

## What was built

All in `packages/noodl-editor/src/shared/utils/projectmodules.ts` (the one scanner, per its own header
comment — no second injection mechanism was created):

- **`verifyLibrarySource(code, globalName)`** — §2's "whole of Richard's pain" check. Runs the fetched
  source in a `vm.createContext` sandbox shaped like a browser tab (`window`/`self`/`globalThis` all
  aliased to the sandbox, plus stub `document`/`navigator` so a UMD wrapper's `typeof` probes fall
  through to the browser branch) and confirms the declared global actually appears. Distinguishes three
  failure shapes by message, each naming the likely cause per the spec's own example text:
  - ES-module build (`export`/`import` syntax errors) → "look for the UMD or 'browser' build"
  - CommonJS build (`module`/`exports` not defined) → same UMD advice, CJS-specific wording
  - runs clean but defines a different name → lists what it *did* define, "did you mean one of those?"
  11 tests in `tests-unit/erg-002/verifyLibrarySource.test.ts`, deliberately weighted toward failure
  cases per success criterion 2's own wording ("if it passes only for correct input, it has not been
  met").
- **`fetchUrlSource(url)`** — Node's built-in `http`/`https`, follows redirects, no new dependency.
  Tested against a real local loopback HTTP server (not a mock) in `tests-unit/erg-002/fetchUrlSource.test.ts`
  — redirect-follow logic is easy to get subtly wrong against a mocked client.
- **`registerLibrary` / `listRegisteredLibraries` / `removeLibrary`** — the write/read/delete surface.
  Verify-before-write (a failed check writes nothing to disk); a `kind: 'external-library'` manifest
  marker so list/remove never touch a hand-authored module (an icon set, say) that happens to share a
  folder name; vendoring (`vendor: true`) downloads the source into the module folder and drops the
  remote `dependencies` entry, matching §2's "offer to vendor it locally." 12 tests across
  `registerLibrary.test.ts` and the `registerLibrary`-with-URL-source half of `fetchUrlSource.test.ts`.
- **`libraryNeedsSsrWarning(lib, deployRenderingMode)`** — §3's trap, as a pure predicate: true when the
  project's `deployRenderingMode` setting (`DeployToFolderTab.ts` — the only place that setting is
  written; unset means CSR) is `ssr`/`ssg` and the library is browser-only. 5 tests.
- `ModuleManifest` gained two optional fields — `kind` and `global` — both additive; the existing schema
  is `additionalProperties: true` throughout, so this cannot regress an existing manifest.

**UI**: `packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/LibrariesSection.tsx`,
wired into `ProjectSettingsTab.tsx` after `VariablesSection` (same "React section, not the legacy ports
view" family as `IdentitySection`). Name / Source URL / Global name / Stylesheet URL / vendor-locally
checkbox, a verify-then-write "Add" flow, a list of registered libraries each showing its global and
(when the project is SSR/SSG and the library is browser-only) an inline warning naming the specific
`window.<global>` reference that will fail server-side — §3's requirement, satisfied via
`libraryNeedsSsrWarning`. New classes (`HelpText`, `EmptyState`) added to the existing
`sections.module.scss`; reused `VariableCard`/`ButtonRow`/etc. rather than inventing parallel ones.

**AI authoring loop context** (§2, §1 finding #5): `AuthoringContextBuilder.libraryOverview()` — one
line per registered library naming its global, following the exact `charge()`/absent-means-omitted
pattern every other handout uses. Threaded through `AuthoringSessionOptions.libraries` →
`AuthoringContextBuilder` constructor → `initialUserMessage`/`updateUserMessage` → `referenceBlocks`'s
stable (cache-prefix) half in `prompts/authoring.ts`. 4 tests run headlessly (no Electron, no
ProjectModel) — `AuthoringContextBuilder` and the prompt builders are pure by design already.

**Code editor completions** (§2, §1 finding #4): `packages/noodl-core-ui/src/components/code-editor/library-completions.ts`
(new file) — `createLibraryCompletionSource(libraries)`, a CodeMirror completion source shaped like the
existing `noodlCompletionSource`, so it can be registered beside it via
`javascriptLanguage.data.of(...)`. 5 tests against a real `EditorState`/`CompletionContext`, same
headless pattern `syntaxDiagnostics.test.ts` already uses in this package.

Total: **33 new tests in `noodl-editor` + 5 in `noodl-core-ui` = 38**, all passing. Full existing suites
re-run clean after every change: `noodl-editor` 140/140 (`npx jest`, tests-main + tests-unit),
`noodl-core-ui` 49/49. Full-package `tsc --noEmit` clean for both `noodl-editor` and `noodl-core-ui`
(0 errors from any file this task touched; the pre-existing `TSFixme`/`.module.scss` ambient-type gaps
in unrelated files under `tsconfig.tests-main.json` were confirmed present before this task and are not
mine). `npm run lint` (scoped to `packages/noodl-editor/src` — the repo's own lint script) shows only 2
pre-existing `no-explicit-any` errors in `projectmodules.ts` at lines the diff never touched (`catch
(error: any)` in the original `scanModuleManifests`); every lint issue this task's own additions
introduced was fixed (an unregistered `react-hooks/exhaustive-deps` disable-comment removed, two
`react/no-unescaped-entities` in JSX text, one `@typescript-eslint/ban-types` in the new `kind` field's
type).

## Deviations from the spec, with reasoning

1. **The completion source is built but not registered.** Wiring it in means editing
   `codemirror-extensions.ts` (which assembles the extension list) and/or `JavaScriptEditor.tsx` (the
   call site) to thread the open project's registered libraries down to it — both existing files in
   `noodl-core-ui`, which this task's territory fence restricts to "new components only." I built the
   hard part (correct CodeMirror completion logic, tested against a real `EditorState`) as a standalone,
   ready-to-call factory rather than leave it undesigned, but did not cross the fence to finish the wire.
   **This is criterion 3's code-editor half, unmet, and named explicitly rather than silently dropped.**
2. **The AI loop's context is wired but not live-populated.** `AuthoringSession` now accepts
   `options.libraries` and puts it in the prompt when supplied — but there is no automatic default the
   way `projectDocs` has one (`currentProjectDocs()`, a synchronous read off an installed
   `ProjectDocsModel` cache). `listRegisteredLibraries` is async (real `fs` reads), and
   `AuthoringSession`'s constructor is synchronous, so it cannot call it inline the way `projectDocs`
   does. Building a `ProjectDocsModel`-equivalent cache for libraries is real, scoped work I judged
   out of size for this session. The live call site that would supply real data —
   `views/panels/AiAuthoringPanel/AiAuthoringPanel.tsx`, where `AuthoringSession.create`/`.update` are
   actually invoked — sits outside "project-settings / app-config surfaces," this task's territory for
   `views/panels/**`. **So as shipped, a real chat session's context carries zero libraries until a
   caller explicitly passes them; the plumbing is real and tested, the live wire is not.**
3. **Territory interpretation, stated plainly.** The fence names one file explicitly — "the AI
   authoring loop's ContextBuilder (find it) for §2's 'registered libraries in context'" — but making
   `libraryOverview()` reach an actual prompt required also touching `AuthoringSession.ts`,
   `prompts/authoring.ts`, and `types.ts`, all in the same `authoring/` family and none of them owned by
   the concurrent session (which the handoff describes as working ERG-001, not AIX/authoring code). I
   read the parenthetical as scoping *intent* (get libraries into the loop's context) rather than a
   literal single-file allowlist, and kept every change there additive/optional-parameter so every
   existing caller (`DocSession.ts`, `PlanningSession.ts`, `review/assembleProject.ts`, and the handful
   of jasmine specs under `tests/ai/authoring-*.test.ts` I could not run) is byte-for-byte unaffected
   when `libraries` is omitted. If this reading was too generous, the fix is a one-line revert of each
   optional parameter — nothing here is entangled with anything else.
4. **The validator rule (§2's third bullet) was not built at all.** `packages/noodl-editor/src/editor/src/validation/**`
   is not in this task's territory list (unlike ContextBuilder, it has no parenthetical carve-out
   either). Beyond the fence question, it would also be substantial new scope on its own merits: the
   validator's `NormNode` (`validation/model.ts`) carries no source-code field for Function/Script
   nodes today — only `instancePorts` — so "a graph referencing a global no library declares is a
   warning" would first need the normalize adapters to start carrying JS source, then real free-variable
   AST analysis (walking `@babel/parser`'s tree, tracking lexical scope, filtering a browser/JS builtin
   allowlist) to tell "references an undeclared global" from "references `window`/`console`/a local
   `const`." That is a task-sized piece of work in its own right, not a small addition riding along.
   **Named here as explicitly not attempted, not silently dropped.**
5. **`main` vs `dependencies` shape decision.** The manifest schema doesn't have a slot for "a global
   name for a remote-URL dependency" — `main` (a project-relative path, always) is what the injector
   turns into the module's own `<script>` tag; a CDN URL can only live in `dependencies`. So a
   non-vendored library's script is written as a `dependencies` entry with no `main`, and a vendored
   one gets a `main` pointing at the locally-written file with an empty `dependencies` array. This is a
   real (small) design decision the spec didn't spell out at this level of detail; documented in
   `registerLibrary`'s own comments and pinned by 4 tests covering both combinations.
6. **A dropped-file source (as opposed to a URL) always writes locally, regardless of `vendor`.** The
   spec's own table lists the Source field as "a URL, or a file dropped into the project" — a dropped
   file has no remote location to fall back to, so `vendor: false` on a `{kind: 'file'}` source still
   persists it (there's nowhere else for it to live). The UI built in this pass only exposes the URL
   path (no file-drop widget) — see "could not verify" below for why, and `registerLibrary`'s `source`
   union already models the file case correctly for whoever builds that widget next.

## Could not verify

- **Success criterion 4** (verified in a real deployed build) and **6's "survives a deploy with no
  network access"** — both require an actual `noodl deploy` / static build served over http, which needs
  the live editor. Not attempted, per the task's own instructions. The vendoring mechanism itself is
  unit-tested (the file lands on disk, the manifest drops the remote URL), and NDA-007 §2 previously
  confirmed `noodl_modules/` ships verbatim and resolves live — but that confirmation predates this
  task's additions and was not re-run against a library registered through this UI.
- **Any live rendering of `LibrariesSection.tsx`** — no Electron, so no confirmation the panel actually
  renders, the verify button's async flow doesn't wedge the UI, or the SSR warning banner's copy reads
  well in context. Only `tsc --noEmit` (clean) and code review back this component; it received zero
  runtime execution.
- **The AI loop actually referencing a registered library in a real chat turn** — `libraryOverview()`
  and its prompt wiring are unit-tested in isolation (headless), but no live `AuthoringSession.run()`
  against a real provider was exercised — the existing jasmine specs that would (`tests/ai/authoring-*.test.ts`)
  run only under `npm run test:ci`, which was off-limits.
- **The code editor's live autocomplete UX** — `createLibraryCompletionSource` is tested against a real
  `EditorState`, but never inside a running `JavaScriptEditor.tsx`/`EditorView`, since it isn't wired in
  (deviation 1) and that would need the editor regardless.
- **`dev-docs/reference/REUSING-CODE-EDITORS.md`** describes a Monaco-based editor with
  `addExtraLib`-style ambient declarations. The current code editor is CodeMirror 6
  (`packages/noodl-core-ui/src/components/code-editor/`), and grepping for `monaco`/`addExtraLib`/
  `declare global` across `noodl-editor` and `noodl-core-ui` returns zero hits — that reference doc is
  stale relative to the shipped implementation. Flagged here rather than fixed: it's outside this task's
  territory (not the spec file, not one of the listed paths) and correcting a general reference doc is a
  separate, better-scoped task.

## Success criteria — status

1. **Structurally met, live-unverified.** An author can register PocketBase/tinyMCE from app config
   without touching a file (URL path) or knowing what UMD means going in — the verify step tells them if
   they got the build type wrong and names the fix. Never exercised in a running editor.
2. **Met.** Verify-on-add fails an ES-module build, a CommonJS build, and a global-name typo, each with
   a message naming the cause — 11 tests, weighted toward the failure cases per the criterion's own
   wording.
3. **Half met.** AI loop context: met (wired, tested, not live-populated — deviation 2). Code editor:
   built but not wired (deviation 1) — the criterion as a whole is not met.
4. **Blocked** — needs a real deployed build; not attempted (see above).
5. **Met (logic + UI wiring), live-unverified.** `libraryNeedsSsrWarning` plus the inline banner in
   `LibrariesSection.tsx` name the specific `window.<global>` reference that will fail server-side. Never
   rendered in a live editor.
6. **Half met.** The vendoring write path is real and tested (file lands in `noodl_modules/`, manifest
   drops the remote URL). The "survives a deploy with no network access" half is blocked on criterion 4's
   same constraint.
7. **Met.** `headCode` was read only for the §0 citation check — `html-processor.ts`'s `customHeadCode`
   path was not modified anywhere in this build.
