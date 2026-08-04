# Phase 39 — handover prompt

Written 2026-08-04 at the end of the **sixth** build session (`0667f365`…`db7aaf0b`).
Paste the block below into a fresh session.

---

Continue `dev-docs/tasks/phase-39-alpha-polish` (Track X — the twelve things I hit driving the editor
for an hour as an alpha user, plus four found on the way). Read `PROGRESS.md` first; it is current as
of commit `db7aaf0b` on `cline-dev`.

## Where it stands

**15 of 16 done. One task open, three loose ends, nothing alpha-blocking.**

POL-001 … POL-015 are all done and every one has been driven in the running editor with a committed
driver. The sixth session closed **POL-008 Part B** (residual filed as AIB-010) and **POL-013** (the
`IconSize` sweep), fixed a white-screen it found on the way, and then **corrected the register**,
which had been quietly wrong.

## Read this before anything else: the register was lying

The sixth session reported the phase as *"16 of 16, nothing open"*. Both halves were wrong, and
Richard caught it.

- There are **15** numbered tasks, not 16. A miscount.
- *"Nothing open"* was true only of the table. POL-005's layout pass filed **three** findings; one
  became POL-014 and the other two were written into **prose inside a done task's notes cell**, where
  nothing tracked them again. They had been carried invisibly since the third session — absent from
  the status line, from the count, and from every handover.

They are now [POL-016](POL-016-THE-TWO-FINDINGS-POL-005-FILED.md). **The rule the phase has adopted:
anything filed-not-fixed gets a row.** A finding recorded only as prose inside a completed task is a
finding that has been lost. If you file something on the way, give it a row in the same commit.

## Do these, in this order

1. **POL-016 — and its first half needs Richard's decision, so ask early.** The Sign-in backend
   surface's **"Save policy" button reads as plain text**: a real `PrimaryButton`, 90×30,
   `is-variant-muted`, computed background `rgb(247,249,251)` against a panel of essentially the same
   colour, `border-width: 0`. It is the only save control on that surface. Every sibling surface uses
   an ordinary button ("Add role", "Issue key", "Add provider").

   The question is **not** which colour. It is whether `muted` is wrong *here* (a one-line variant
   change) or wrong *generally* (a `PrimaryButton` fix plus a call-site sweep — a variant whose
   background is within a hair of every surface it sits on, with no border, cannot read as a control
   anywhere). **Count the `is-variant-muted` call sites and look at two or three others before
   putting the question**, so it is asked with evidence rather than in the abstract.

   The second half is Schema's bespoke header — cosmetic, lowest priority in the phase, and listed so
   it is a decision rather than an oversight.

2. **POL-002 criterion 6 — the packaged build has never been run since Algolia was removed.** It is
   recorded as "human-gated" and that is worth re-testing rather than inheriting: *signing and
   publishing* are human-gated (REV-007), but a packaged **build** may not be. Removing a dependency
   is the one change in POL-002 that can break packaging without breaking dev — its own trap says so,
   and the `JSX`-namespace blast radius that removal already caused is the reason to take it
   seriously. If it can run headlessly, run it. If it genuinely cannot, name the step that needs a
   human and put it on `phase-33-alpha-launch/HUMAN-GATED-ITEMS.md`.

3. **POL-004 criterion 1 — the doc-review diff modal is still unverified live.** The other half of
   that residual (a populated provenance walk) was closed by POL-010. This one needs a drive that
   opens a doc review with a real diff in it, screenshotted in both themes.

## The two tasks you have never heard discussed

Richard asked about these, and the answer is simple: **neither was in his twelve.** Both were found
on the way, by a session doing something else, and both are done.

- **POL-014 — the Data Browser reads a key nothing sends.** Found while running POL-005's 860px
  pass. Records arrive carrying `objectId`; the grid read `record.id`. Blank id column, a React key
  warning on every load, one cell click opening editors in all eight rows, and a delete that silently
  did nothing. **A sixth consequence decided the fix**: the search clause sent `{ id: { contains } }`,
  which the adapter turns into `"id" LIKE ?` against a table with no such column, so every search
  failed at the database. The drive found two more defects on the way — Enter in a cell editor saved
  the value the cell *started* with (a `useCallback` closure captured at mount), and a failed delete
  was on screen for ~300ms because the realtime refresh clears `error`.

- **POL-015 — the first workflow on a backend cannot be created.** Found while building POL-009's
  fixture: POL-009's criteria all start "pin a run on a workflow canvas", so that session pressed `+`
  in the Workflows panel. It had never worked — *"Creating failed."* A first-run blocker, which is
  why nobody with an existing workflow ever meets it. Fixed by sourcing the backend list from
  `listWorkflowDefinitions()`, the call the panel already makes, already scoped to *running* backends
  — better than the spec's `useLocalBackends`, which lists stopped ones.

## What this session found that the specs did not

- **POL-013's shape was not the spec's, in three ways.** The call-site count is **441, not ~130 — and
  319 of them declare no size at all**, taking whatever their SVG file happened to be
  (16/20/24/25/30/31). **47 visible glyphs were not the wrong size, they were destroyed** — rendering
  at 0.48–8px, because `Icon`'s auto-width span is an ordinary flex item and `flex-shrink: 1` let an
  overflowing row crush it; no screenshot sweep would have named that, it reads as "an icon is
  missing". And criterion 5's 169-file SVG rewrite is **unnecessary**: `svg { width: 100% }` is CSS
  and already outranks a presentation attribute — the intrinsic attributes only ever mattered because
  the *span* had no size.

- **`flex: 0 0 auto` then broke three hosts that had been holding a glyph in by shrinking it** — the
  components panel's caret (a 12px wrapper) and category icon (15px), and the component trail's
  `.Icon` (11px, applied to the Icon's own root, so a straight specificity loss). Any wrapper smaller
  than its glyph was relying on the shrink. Each declares a size now.

- **Closing a project with the Settings panel open white-screened the editor.** `router.tsx` nulls
  `ProjectModel.instance` from a `setTimeout(…, 0)` — a deliberate HACK meant to let React unmount
  first. `ProjectSettingsTab` lost that race and threw *inside a cleanup*, uncaught. Isolated rather
  than inferred: Settings open killed it every time, Components-only did not. Worth noticing that
  this is the **third** defect in this phase whose whole mechanism is "the Settings surface throws"
  (POL-001, POL-004's tooltip token, this) — it is the surface a user reaches for first when
  something looks wrong.

## Harness facts worth keeping

- **An instrument has to be shown trustworthy before its output is evidence.** Two runs of the *same
  build* of POL-013's census disagreed by 47 icons — the side panel keeps whatever width the previous
  run left it, so a row overflowed in one run and fitted in the next, and a flex-shrunk icon is a
  *correct* measurement of a different layout. Pin the viewport (1600×1000, what the UIX-009 corpus
  harness does) and add a sub-pixel floor. Same-build churn then went to **0 moved**.

- **A key must not contain the thing the change changes.** The first before/after diff reported
  `1354 appeared / 1355 vanished / 0 unchanged`, because each icon was keyed by a DOM path that
  included its class list — and the fix adds a class. **Total churn is that bug's signature, not a
  big result.**

- **`getComputedStyle().width` cannot tell you whether a host sized an element.** It returns the
  *used* width — a px number — for an unsized block span exactly as for a sized one. The only
  question that separates them is whether the measured box equals the SVG's own attributes.

- **The launcher's "Open project" is icon-only now** (`[data-test="launcher-open-project"]`), so the
  older pol39 drivers' `clickButtonWithText('Open project')` fails with *"no button reading …"*. And
  waiting for `!document.querySelector('[data-panel-id]')` after `exitProject()` is true **during the
  gap** before the launcher renders — wait for `launcher-open-project` instead.

- **Every driver run litters the launcher.** The throwaway project copy is added to
  `~/Library/Application Support/NodeGX/recently_opened_project.json`, which outlives the temp
  directory. **31** dead "Shine Phase 2" cards had accumulated across sessions; pruned by the
  `/T/pol0NN-` path prefix. `pol013-icon-census.js` deletes its own copy now; the store entry it
  cannot reach.

- Six reusable drivers under `packages/noodl-editor/scripts/pol39-live/`: `pol010-walk.js`,
  `pol008-sandbox-session.js`, `pol008b-rejudge.js` (**spends provider money**),
  `pol012-linked-sides.js`, `pol011-fx-multiline.js`, and this session's **`pol013-icon-census.js`**
  (censuses every rendered `Icon` across the launcher, the editor and every rail panel; `--diff`
  compares two runs).

## Working rules

- Commit straight to `cline-dev`. No branches, no PRs.
- **Another session still has uncommitted work** in `projectmodel.ts`, `projectmodel.editor.ts`,
  `LocalProjectsModel.ts`, `ProjectImporter.ts`, `analyze.ts`, `featureFlags.ts`,
  `VersionControlPanel/**`, `tests-unit/erg-005/` and `nodegx-observe/bin`. Untouched across **six**
  sessions now — re-check whether it is still there and still theirs. **Never `git add -A`, never
  stash**, and pathspec-scope every commit.
- **`tests-unit/erg-005/` fails 3 jest specs and they are not yours** — the other session's untracked
  work. Confirmed three times. Do not spend time proving it.
- The editor suite is `npm run test:ci` from `packages/noodl-editor`. **Only the `Jasmine:` line
  counts.** Baseline is **2148 specs, 0 failures** — unchanged this session.
- Gates to keep green: `npx tsc --noEmit -p tsconfig.json` (in `noodl-editor`, `noodl-runtime`,
  `noodl-viewer-react` and `nodegx-backend`), `npm run tokens:css` and
  `npm run starter-iconset:check`, both **from the repo root**. `noodl-core-ui`'s own tsc has
  pre-existing alias failures (`@noodl-store`, `@noodl-versioning`) — it is not a gate.
- `nodegx-backend`'s jest suite is **not green at baseline** (`tests/email-flows.test.ts`, two 30s
  timeouts). Pre-existing, nobody owns it, do not chase it.
- Verify in the running editor, not only in jest. The `run-editor` skill has the recipe. **HMR will
  not apply a change to an already-mounted panel, and the viewer is a second bundle** — restart the
  stack before concluding a fix did nothing. Stop the stack when you are done (`npm run dev:stop`,
  from the repo root).
- **Work on a copy of any project you drive**, and prune the launcher's recent list afterwards.
- Ask Richard if a decision is genuinely his. His eight earlier answers are in `PROGRESS.md` — don't
  re-ask them.

## One open question

POL-016's first half: **is `is-variant-muted` wrong on this button, or wrong generally?** Survey the
call sites before asking, so it is a question about evidence rather than about taste.
