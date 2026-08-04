# Phase 39 — handover prompt

Written 2026-08-04 at the end of the **fifth** build session (`f3e7f4a2`…`4e6bbc5f`).
Paste the block below into a fresh session.

---

Continue `dev-docs/tasks/phase-39-alpha-polish` (Track X — the twelve things I hit driving the editor
for an hour as an alpha user). Read `PROGRESS.md` first; it is current as of commit `4e6bbc5f` on
`cline-dev`.

## Where it stands

**14 done, 1 not started, 1 open question.** Nothing is "built but unwatched" — every done item has
been driven in the running editor with a committed driver.

Done: **POL-001** (the settings crash — the alpha blocker), **POL-002**, **POL-003**, **POL-004**,
**POL-005**, **POL-006**, **POL-007**, **POL-009**, **POL-014**, **POL-015**, and this session's
**POL-010** (the provenance walk), **POL-008 Part A** (the sandbox signs in), **POL-012** (set all
four sides at once) and **POL-011** (`fx` on multiline strings).

**Not started: POL-013 only.** **One open question, and it is the first thing to read.**

## Do these, in this order

1. **Answer the POL-008 Part B question — it is mine to answer and nothing else is blocked on it.**
   Written up in `PROGRESS.md` under *"Open — needs Richard, 2026-08-04 (fifth session)"* and in the
   spec. Short version: I re-judged Part B against the **real provider**, and the premise moved. The
   agent no longer produces "a div and a couple of texts" — it produced **seven styled nodes**: a
   spacing scale (`var(--space-8)`, `var(--space-4)`), a card with `var(--surface)`,
   `var(--radius-2xl)` and a shadow, a 140px avatar, and a declared type hierarchy. It renders in
   Inter. Causes 1–3 in the spec are answered, and the spec's prescribed fix — a visual section in
   the `CONVENTIONS.md` template — would tell the model to do what it is already doing.

   What is still poor on screen is **two invented names**: `textStyle: "heading-3"` and
   `textStyle: "muted"` (this project's styles are `Body Text`, `Button Label`, `Label Text`, so both
   Texts render identical 16px black with *no type hierarchy at all*), and `src: "profileIcon.svg"`,
   which is no file, so the avatar is a broken-image box. Both passed the SUB-006 gate under
   *"Submitted — passed validation."*

   That is phase 38's finding exactly: **nothing validates parameter VALUES.** The option I would
   take is (a) — a value check for named references (`textStyle`, `colorStyle`, image `src`) that
   fails or reports rather than passing silently, **plus** telling the agent what this project's
   style names are, because it cannot use `Body Text` if it has never been told the project has one.
   It is bigger than a polish slot and touches the authoring context, so it is not started.

2. **POL-013 — the `IconSize` sweep.** The only task left, and the only reason it is last is the one
   you gave: *"it is a ~130-call-site change the moment the CSS rules exist, with no incremental
   landing, and it is not alpha-blocking."* That is still true and it is the whole shape of the task
   — the first commit changes every icon in the editor at once, so criterion 2 (a both-theme
   screenshot sweep against the UIX-009 corpus, and fixing what moved) is not padding, it **is** the
   task. Budget for the sweep before writing the four `is-size-*` rules, not after.

   Criterion 5 is worth deciding early: stripping intrinsic `width`/`height` from the SVG files so
   the component is the only thing that sizes a glyph. Without it the two mechanisms stay in
   competition and the sweep has to be re-run every time someone adds an icon.

## What this session found that the specs did not

- **POL-010's state A had a second half, and without it the state was unreachable.** The spec said
  "no viewer / no topology"; only the second was implemented at first. But a topology is **held**
  and outlives its viewer, so a walk over a preview that closed ten minutes ago rendered identically
  to a live one — same rows, same values, all frozen. That is slice 2b's lie one scope smaller.
  `foundationOf` takes `previewRunning` now.

- **The in-editor preview cannot be closed on its own.** It is a `<webview>`, a guest of the
  editor's window: `/json/close` on its CDP target throws `Invalid guestInstanceId` out of
  `GUEST_VIEW_MANAGER_CALL`, uncaught, inside React, and **white-screens the editor**. Not a state
  any user can produce, so not one worth measuring against. Navigating it away is.

- **POL-008 Part A: writing one session key would have been a copy of a rule already rewritten
  twice.** `UserService._handle()` resolves the token from `cloudservices`, or from a
  `backendServices` entry, or to `undefined` (BCN-006, BCN-009). A mirror of that if/else would fail
  **silently** when it drifted — straight back to placeholders, which is the defect. It writes every
  candidate key instead; the sandbox has its own storage partition, so the extras are inert.
  `Parse/undefined/currentUser` is in that set deliberately and is the *common* case.

- **POL-012: "link on only if all four already agree" means it starts ON.** Four untouched sides
  *do* agree. The rule the spec is protecting is the other one — never flatten four values that
  differ — and that is a separate case. The driver's first version assumed the opposite and reported
  five failures against correct behaviour.

- **POL-011: `TextAreaType` was rendering a bare `PropertyPanelRow`, and that was the whole defect.**
  The reset dot, the binding chip and the `fx` toggle all come from `PropertyPanelInput`, which it
  was not using. A new `PropertyPanelInputType.TextArea` gives a multiline property the same row as
  every other string, and expression mode then shows the expression input rather than a textarea for
  free.

## Harness facts worth keeping

- **Connecting to a CDP target that is mid-navigation hangs forever.** The session detaches with the
  document and `cdp.js`'s `evaluate` has no deadline. Wait from the **host** side —
  `webview.getURL()` and `webview.isLoading()` are on the element and survive the guest reloading.
  And setting `webview.src` *starts* a navigation and returns: a fixed sleep read the signed-in page
  while asking about the signed-out one and reported a working fix as broken.

- **`node.parameters[name]` and `getParameter(name)` are different questions**, and the difference
  cost three false failures in one run. The first is what is *stored* (`undefined` at the declared
  default); the second resolves the default, and it is what the property editor reads. A check
  comparing a captured fallback against the stored `undefined` calls a correct conversion broken.

- **`data-identifier` disappears in expression mode** — it is on the input, which is replaced by an
  `ExpressionInput`. A panel-wide query had already produced a false pass (an expression input was
  present, belonging to a *different* row). POL-011 added `data-property` on the row, which survives
  the mode switch. Use it.

- **`setParameter` already batches undo.** It takes an `UndoActionGroup` as `args.undo` and only
  creates-and-pushes its own when handed a boolean. Build one group, pass it to every write, push it
  once — and **`push`, never `pushAndDo` and never the constructor's `do`/`undo` form**, which
  leaves `ptr` at 0 and yields a group that cannot be undone at all. During a drag the model already
  holds the dragged value, so the commit must carry `oldValue`s captured at mousedown.

- **A green check count says nothing about where a control sits.** POL-012 was 12/12 with both new
  toggles covering their group tags and one of them sitting on a value field. Only a screenshot
  caught it. The overlap is a measurement now — every toggle's box against every tag and label.

- Five reusable drivers, all committed under `packages/noodl-editor/scripts/pol39-live/`:
  `pol010-walk.js` (four walk states + the project-switch reset; `--capture` writes the jest
  fixture), `pol008-sandbox-session.js` (signed in / out / back, reading the rendered pixel),
  `pol008b-rejudge.js` (**spends provider money** — one authoring session through the Build panel),
  `pol012-linked-sides.js` and `pol011-fx-multiline.js`.

## Working rules

- Commit straight to `cline-dev`. No branches, no PRs.
- **Another session still has uncommitted work** in `projectmodel.ts`, `projectmodel.editor.ts`,
  `LocalProjectsModel.ts`, `ProjectImporter.ts`, `analyze.ts`, `featureFlags.ts`,
  `VersionControlPanel/**`, `tests-unit/erg-005/` and `nodegx-observe/bin`. Untouched across **five**
  sessions now — re-check whether it is still there and still theirs. **Never `git add -A`, never
  stash**, and pathspec-scope every commit.
- **`tests-unit/erg-005/` fails 3 jest specs and they are not yours** — that is the other session's
  untracked work. Confirmed twice this session. Do not spend time proving it.
- The editor suite is `npm run test:ci` from `packages/noodl-editor`. **Only the `Jasmine:` line
  counts.** Baseline is **2148 specs, 0 failures** — unchanged this session.
- Gates to keep green: `npx tsc --noEmit -p tsconfig.json` (in `noodl-editor`, `noodl-runtime`,
  `noodl-viewer-react` and `nodegx-backend`), `npm run tokens:css` and
  `npm run starter-iconset:check`, both **from the repo root**. Note that `noodl-core-ui`'s own tsc
  has pre-existing alias failures (`@noodl-store`, `@noodl-versioning`) — it is not a gate.
- `nodegx-backend`'s jest suite is **not green at baseline** (`tests/email-flows.test.ts`, two 30s
  timeouts). Pre-existing, nobody owns it, do not chase it.
- Verify in the running editor, not only in jest. The `run-editor` skill has the recipe. **HMR will
  not apply a change to an already-mounted panel, and the viewer is a second bundle** — restart the
  stack before concluding a fix did nothing. Stop the stack when you are done (`npm run dev:stop`,
  from the repo root).
- **Work on a copy of any project you drive.** Every driver this session copies first.
- Ask me if a decision is genuinely mine. My seven earlier answers are in `PROGRESS.md` — don't
  re-ask them.

## One open question

The POL-008 Part B question above. The alternative that was rejected and why is already written into
`PROGRESS.md` and the spec — read it before proposing anything.
