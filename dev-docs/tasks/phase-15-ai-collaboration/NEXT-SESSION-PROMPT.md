# Next-session prompt — phase 15 closeout

Written 2026-08-02 at `3823d243`, immediately after the closing batch merged (`74ef6651`).
**Three concurrent sessions were live in this checkout** — see the concurrency section, which is
again not boilerplate.

## What the last session did

The Anthropic key had credit again, which was the stated blocker on almost everything left. Four
parallel worktree agents plus a live-editor pass. ~$7.60 of provider spend.

| Thing | State |
|---|---|
| **AIX-011 `update /App`** | ✅ Diagnosed + fixed. `/App` has no `id`; `buildCandidate`'s JSON round-trip dropped it |
| **AIX-011 criterion 7 doc turn** | ✅ Live sample exists. The prompt's precondition was unsatisfiable |
| **🔴 Pre-existing errors charged to the candidate** | ✅ Fixed. The agent was retyping module nodes to `Text` and scoring 100% ids-kept |
| **AIX-003 live round trip** | ✅ Done, `--mode=changeset`, 13 sessions |
| **🔴 all-accepted did NOT reproduce the proposal** | ✅ Fixed (`childIndex` is per-parent) |
| **🔴 Wire labels never survived a v2 export→import** | ✅ Fixed in exporter + importer |
| **AIX-008 provider run + `sample_data`** | ✅ Done. Model fills it 9/9; +234 tokens/request (2–5% of baseline) |
| **🔴 "Renders populated lists with no backend" was false** | ✅ Fixed. 8/8 previously-blank now populate |
| **AIX-008 Sample-data/Real-backend toggle** | ✅ Driven live. 2 src changes for 2 clicks, no reload loop |
| **🔴 `collectBackendSummary` read a stub returning `[]` since WF-007** | ✅ Fixed. It was calling reachable backends unreachable |
| **🔴 Two AI templates fed an empty database schema** | ✅ Fixed. One reader behind all three consumers now |
| **🔴 Banner listener group was global** | ✅ Fixed + spec-proven. One panel unmounting deafened the other |
| **AIX-005 `EXPRESSION` popout title** | ✅ Premise stale, but the *class* was real — css/text/html ports were JS-validated |
| **AIX-010 banner at 240px / dismissal persistence** | ✅ Closed live |
| **AIX-012 settings section at dialog width** | ✅ Closed live (dialog is 460px, not the 420px the note said) |
| **AIX-003 slice-4/5 UI smoke** | ❌ **Attempted, not completed.** The headline engineering gap — see §C |
| **40-node fresh-reviewer test** | ❌ **Needs Richard.** Artifact written and waiting — see §A |
| **AIX-007 billing reconciliation** | ❌ **Needs Richard.** Measured as impossible for an agent — see §A |
| **Gate G2** | ❌ A calendar, not an engineering task |

**Gates at `3823d243`.** Editor Electron/jasmine **2076 specs, 0 failures**. `noodl-core-ui` jest
117/117. `noodl-mcp` jest 76 passed, **1 pre-existing red** (`tools.test.ts`, confirmed on a branch
touching no MCP code). `tsc --noEmit` clean in `noodl-editor`. `catalog:check` green and
`catalog:generate` leaves an **empty** `git diff`. The runtime jest suite was **not** re-run at the
merge — no runtime source changed, but that is an argument, not a measurement.

## ⚠️ Concurrency — this checkout is busy

Three other sessions were working here (ERG, LIB and WFA batches), and `cline-dev` **moved twice
mid-session**, ~50 commits, while agents were running.

- **Re-check `git rev-parse cline-dev` immediately before merging**, and re-run gates after any
  rebase. The first trial merge was green against a stale base and meant nothing.
- ⚠️ `packages/noodl-core-ui/.../json-editor/utils/listValueCodec.ts` and its test have been
  uncommitted in this tree since 2026-08-02 and belong to another session. **Do not touch, stash,
  or commit them.** Same for the untracked `dev-docs/tasks/phase-37-project-tabs/`.
- **Never `git stash`, never `git add -A`.** The stash is shared across worktrees and races.
- **`npm run test:ci` reports a verdict it has not earned in three ways** — see
  [[editor-suite-lies-three-ways]] in memory, and read only the `Jasmine: N specs, M failures`
  line. Its absence is the signal. Note `| tail` hides that line *and* makes `$?` the exit code of
  `tail`, which already caused one false "green" this session.
- Another session's cleanup runs `pkill -f run-electron-tests` and `pkill -f "webpack-cli
  --config=webpackconfigs/webpack.test-ci.js"`, which match **any** worktree's processes. A suite
  dying with `exit_code=15` is that, not your bug. Re-run rather than diagnose.

## The work, in the order it is worth doing

### A. ⚠️ Ask Richard early — two items no agent can close

Both are cheap for him and block nothing else, so raise them first.

1. **The 40-node fresh-reviewer test** (AIX-003's last success criterion). It needs a person who has
   not seen the change to say what happened. The artifact is written and waiting:
   `measurements/live/changeset/settings-page.review.md`, rendered through the product's own
   change-rail presentation, with the request deliberately held in
   `settings-page.request.md` so the page does not spoil the test. `share-popup` is the more
   interesting pair — the §B design problem is visible in it.
2. **AIX-007's reconciliation against Anthropic's billed figure.** Measured as impossible for an
   agent: the cost endpoints exist but need an Admin key (200 on `/v1/messages`, 401 on
   `cost_report` and `usage_report/messages`, 404 on a made-up sibling route — the 404 is what makes
   the 401s meaningful). The exact dates, models and figures to compare are written into
   `AIX-007-NOTES.md`. **The reading rule matters**: our number is a *floor*, so a Console figure
   that is **lower** than ours is the failure this residual exists to catch.

### B. The one open design question — do not let an agent decide it

**Some changes are rejectable in the rail and not in reality.** When a component's base uses
module-provided types absent from the catalog, the strict gate rejects the model's resubmission of
the base, so the agent must rewrite them. Consequences, all measured:

- the review is dominated by work nobody asked for (**16 of 17 rows** in one sample);
- those rows honestly report `requires: []`, because structurally they *are* independent;
- rejecting one makes the Build panel refuse the **whole** selection, over a node the reviewer never
  touched.

Five other corpus components carry the same types. The shape of a fix is semantic requirements in
the change set and/or marking gate-forced repairs distinctly — but that is a design call about what
a review *means*, not a patch. Full write-up in `AIX-003-LIVE-ROUND-TRIP.md`.

### C. The headline engineering gap — the scripted no-provider session

**AIX-003's slice-4/5 UI pass** (exclude/restore clicks, Before/After, walkthrough, Accept-N-of-M
through the real panel) is still not done, and it has now been owed across three sessions.

What was tried on 2026-08-02: a genuine 10-change set built from a live candidate inside the running
editor, then `ChangeReviewDocument` mounted directly via the webpack-require probe. **It renders
nothing**, console reports `Element type is invalid … got: undefined`. The same ad-hoc mounting
worked that day for `ProjectReviewBanner`, `AiSettingsSection`, `LauncherSettingsDialog` and
`SandboxPreview` — so it is *suggestive*, but it was **not** chased to a conclusion and is recorded
as attempted-not-completed, **not** as a defect. The document normally arrives through
`AppRegistry`'s document path, which ad-hoc mounting bypasses.

**Do not repeat the ad-hoc mount.** Build the thing that has been missing since the last pass: a
scripted no-provider authoring session that stages a real candidate in a real project, so the panel
opens the way the app opens it. That one asset closes AIX-003's UI smoke *and* gives AIX-008 and
AIX-011 their panel smokes, which are the same shape.

The underlying logic is **not** the risk — it is covered by 318 single-change rejections and 520
seeded random subsets against live proposals.

### D. Filed, not fixed — five real findings with owners elsewhere

Each was measured, none is speculative. None belongs to phase 15.

1. **`SchemaHandler` is a dead handler that still erases metadata.** Zero data consumers, but
   `_store()` runs on every window focus and clears `dbCollections`/`systemCollections` from project
   metadata — which the runtime's `schema-ports.ts` still reads as its Parse-wire fallback, and six
   runtime nodes subscribe to. Probably harmless under the fresh-start decision, but the class is "a
   stub with side effects". **BCN/runtime territory.**
2. **`nodegxPreset.endpoints.schema = '/schemas'` is wrong** — live-probed 404; the real routes are
   `/api/_schema` and `/admin/schema`, both admin-scoped, while the preset declares
   `defaultAuth: {method:'none'}`. Latent because nothing creates one today. **BCN territory.**
3. **`buildComponentV2Files` still exports an id-less component to an id-less `component.json`.**
   The AIX-011 fix is deliberately at `buildCandidate` (the untrusted-input boundary); both layers
   deserve one. **Exporter territory.**
4. **`create_component`'s gate is component-scoped, `validate_project`'s is project-scoped**, so the
   same ids are accepted by one and called `duplicate-node-id` by the other. This is the cause of
   the pre-existing `noodl-mcp` red. **Two gates, two answers, one write.**
5. **`<img>` egress from model sample data.** Every event-card run returned a `picsum.photos` URL;
   an `<img src>` goes through neither the `fetch` nor the `XHR` shim, and the sandbox webview sets a
   `partition` but no CSP. `synth.placeholderImage` returns an inline `data:image/svg+xml`
   *specifically* to avoid this — that is the shape a fix should convert model URLs into, **not**
   proxying. Reasoned, not yet observed leaving; worth a live check when the editor is free.

### E. A cost problem nobody owns

`plan-docs` run 2's `Pages/Saved` went **11 turns with zero submissions**, burned 117,167 of a
120,000-char budget, and outspent the other five operations put together. Project-scope authoring is
already 5–6× standalone per component, making a five-operation plan a ~$0.90 action — and **the
panel says so nowhere**. A single operation that can silently consume most of a plan's budget and
produce nothing is worth either a cap or a warning.

## Reusable assets from this session

- **The live harness now has nine modes**: `update|agentic|plan|scope|review|explain|plan-docs|changeset|sandbox`.
  `--model=` is **required in practice** (the registry default reads `EditorSettings`, which the
  bundle stubs). `--mode=sandbox --replay=<dir>` re-runs dataset synthesis over recorded candidates
  with **no provider calls** — free, deterministic, and the right way to re-check a synthesiser
  change. Note `review` is AIX-010's *docs* review and `changeset` is AIX-003's *graph* review;
  different features, same English word.
- **Offscreen component mounting via CDP** closed three residuals without touching another session's
  open project: push a probe chunk onto `window.webpackChunknoodl_editor` to capture
  `__webpack_require__`, require the component by its path-shaped module id, mount into a
  `position:fixed;left:-9999px` host with `react-dom/client`, measure, unmount, remove. React and
  react-dom are externalised as bare `'react'` / `'react-dom'` ids. It works for leaf components and
  did **not** work for `ChangeReviewDocument` (§C).
- **A perfect resubmission is the diagnostic for "is it the base or the model?"** — copy a component
  back verbatim and see whether it still fails.
- **`git archive` the base commit to a scratch tree** to prove a test failure is pre-existing rather
  than asserting it.

## Two lessons that cost time

**A metric that proves a feature works must be checked against what it looks like when the feature
fails.** "100% of base node ids kept" was the evidence an update stays reviewable — and it was
simultaneously the thing hiding four module nodes being silently retyped to `Text`, precisely
*because* their ids were kept.

**Trial-merge in a throwaway worktree, always.** It caught two defects this session that no single
agent could see: a one-line fix landing in a function another branch had extracted (silently
reverted by taking "theirs"), and specs that pass alone and fail once another spec registers a real
listener. Both fixes belong to the merge commit, not to either branch — applied to either branch
alone they would be green there and meaningless.
