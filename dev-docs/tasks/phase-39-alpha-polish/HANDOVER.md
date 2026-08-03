# Phase 39 — handover prompt

Written 2026-08-04 at the end of the **third** build session (`5c8c43cf`…`0064d520`).
Paste the block below into a fresh session.

---

Continue `dev-docs/tasks/phase-39-alpha-polish` (Track X — the twelve things I hit driving the editor
for an hour as an alpha user). Read `PROGRESS.md` first; it is current as of commit `0064d520` on
`cline-dev`.

## Where it stands

Done and verified in the running editor: **POL-001** (the settings crash — the alpha blocker),
**POL-002** (links + Learn tab), **POL-003** (rail contrast + Lucide glyphs), **POL-004** (undefined
CSS tokens + a new gate), **POL-005** (backend surfaces at 860px), **POL-009** (a pin belongs to one
canvas), and now **POL-014** (the Data Browser) and **POL-015** (the first workflow) — the two the
verification pass found rather than me, and the two that were worse than anything left on my list.

Nothing is "built but unwatched". Every done item has been driven.

**Two are diagnosed and not fixed, and neither should be re-diagnosed:** **POL-010** (the provenance
walk) and **POL-008 Part A** (sample data). Both mechanisms are written into their own specs with the
evidence. In both cases the answer was *not* on the spec's own candidate list — read the diagnosis
before you plan the fix, because the fix each one implies is not the fix the spec originally sketched.

Not started: **POL-006**, **POL-007**, **POL-011**, **POL-012**, **POL-013**.

## Do these first, in this order

1. **POL-007** — the Build panel's row min-width exceeds its 400px panel. Mechanism confirmed in the
   spec, down to the file and line. It is a layout task with no unknowns: the operation row becomes
   two lines, the target ellipsises, and the panel body stops scrolling sideways. Its traps section
   is worth reading first — a run is required to see most of the states, and the no-provider drivers
   exist so that costs nothing.

2. **POL-006** is the one with leverage: **POL-008 Part B is explicitly gated on it**
   ("re-judge after POL-006"), and the repo already ships all ~1998 Lucide glyphs as a bundled
   webfont, so it is wiring rather than sourcing. It needs a line in `LocalProjectsModel.ts`, which
   another session has been sitting on for three sessions now — stage that hunk surgically.

3. Then **POL-012**, **POL-011**, **POL-013**.

4. The two diagnosed fixes, whenever you want them. **POL-008 Part A's is small**: the sandbox
   already ships a complete signed-in user with a session token, so the fix is to seed the session
   where `installSandbox` runs and let the existing `/users/me` interception do the rest. POL-010's
   is the bigger call and question 2 below is still open.

## What this session found that the specs did not

- **POL-008 Part A is none of its three candidates.** All three assumed the sample data was missing.
  It is not: `buildSandboxExport` with `sampleData: undefined` — Richard's exact case — ships a user
  with `username`, `email` and a `sessionToken`, and a summary reading *"Sample data — signed in as a
  sample user"*, which is verbatim the string in his screenshot. The sandbox intercepts the network
  and only the network; `UserService` asks for `/users/me` only when a session already exists;
  nothing writes one. **The sandbox serves a signed-in user nobody asks for.**

- **The same failure as POL-010's dead candidate, one phase later.** That one assumed node ids are
  UUIDs. This one assumed the data was absent. Both branches died to two minutes of printing the
  actual value. Print it before theorising about it — it is now the phase's stated pattern.

- **Enter in a Data Browser cell editor saved the value the cell started with.** `handleKeyDown` was
  memoised on `[type, onCancel]` and declared above `handleSave`, so it captured the mount-time
  closure over `editValue`. Blur — an inline arrow, re-created every render — saved correctly. Both
  paths report success, so the only symptom was your typing vanishing. Nothing in POL-014's spec
  predicted it; criterion 3 simply could not pass, and that is what a criterion is for.

- **A failed delete was on screen for about 300ms.** `loadData` clears `error` on every run, and the
  realtime subscription runs `loadData` on every change to the collection — including the change that
  made the row stale. Write failures need their own state, and now have it.

- **A green search is not a working search.** The Data Browser's search sent `{ id: { contains } }`,
  which the adapter turns into `"id" LIKE ?` against a table with no `id` column. Every search failed
  at the database. It was invisible because nobody had typed in the box — a sixth consequence of the
  same one-word defect, and the thing that decided option (b) over (a).

## Harness facts worth keeping

- **A widget's `getBoundingClientRect()` can be outside its own panel.** The Data Browser's grid
  scrolls horizontally inside the 860px surface, so a delete button reported `x: 1006` — a real
  viewport coordinate, in a different panel. `dispatchClick` there lands on something else and
  reports success. It cost most of an hour and three separate wrong theories about the native
  confirm. Always `scrollIntoView({ block: 'center', inline: 'center' })` first, then assert
  `el.contains(document.elementFromPoint(x, y))` **before** clicking, and abort rather than click
  blind.

- **The native-confirm recipe is correct** — `osascript … set frontmost … keystroke return` answers
  OK. Every "it must be answering Cancel" theory this session was the click above missing the button.
  Do not go looking for a better dismissal; check that the click landed. (Naming the button via
  System Events does *not* work: the dialog's buttons enumerate as `missing value`.)

- **A CDP script that never exits is a `connect()` you never closed.** Two-minute timeouts on scripts
  that had already printed their answer. End with `.then(() => process.exit(0))`.

- **`filesystem.openDialog` returns the directory string**, not `{ filePaths: [...] }`. The stub in
  `scripts/aix15-live/scripted-session.js` is the one to copy.

- **The editor bundle does not contain the sandbox responder.** `responder.ts`, `store.ts` and
  `install.ts` resolve only in the viewer bundle — which is the editor/viewer separation itself, and
  a fast way to confirm which side of the seam a behaviour lives on. Use the webpack module-cache
  probe to check: `Object.keys(cache).filter(k => /sandbox/.test(k))`.

- **The realtime SSE stream will refresh a grid out from under a race you are trying to set up.** The
  debounce is 300ms. If you need a stale row, freeze the renderer first (a native modal does it) or
  accept that you are testing the wrong layer.

## Working rules

- Commit straight to `cline-dev`. No branches, no PRs.
- **Another session still has uncommitted work** in `projectmodel.ts`, `projectmodel.editor.ts`,
  `LocalProjectsModel.ts`, `ProjectImporter.ts`, `analyze.ts`, `featureFlags.ts`,
  `VersionControlPanel/**` and `nodegx-observe`. Untouched across three sessions now — re-check
  whether it is still there and still theirs. **Never `git add -A`, never stash**, and pathspec-scope
  every commit.
- The editor suite is `npm run test:ci` from `packages/noodl-editor`. **Only the `Jasmine:` line
  counts.** Baseline is now **2148 specs, 0 failures** (2137 plus the 11 this session added).
- **`nodegx-backend`'s jest suite is NOT green at baseline** — `tests/email-flows.test.ts` fails two
  specs on 30s timeouts. Confirmed pre-existing against `HEAD`. Do not spend time proving it is not
  yours; PROGRESS.md records the proof.
- Gates to keep green: `npx tsc --noEmit -p tsconfig.json` (in both `noodl-editor` and
  `nodegx-backend`), and `npm run tokens:css` **from the repo root** — it is a root script, not a
  package one.
- Verify in the running editor, not only in jest. The `run-editor` skill has the recipe. **HMR will
  not apply a change to an already-mounted panel; restart the stack before concluding a fix did
  nothing.** Stop the stack when you are done (`npm run dev:stop`, from the repo root).
- **Work on a copy of any project you drive.** This session drove a scratchpad copy of the QA fixture
  and both originals came through untouched. It also created a `PolFourteen` table on the `BCN009 QA`
  backend and dropped it afterwards; that backend and `SQLite backend` were left stopped, as found.
- Ask me if a decision is genuinely mine. My four earlier answers are recorded in `PROGRESS.md` —
  don't re-ask them.

## Three questions for me, none urgent

1. **Should a backend surface be able to reach full mode deliberately?** POL-005 removed `openFull()`,
   which was the only route it had — and it was firing unasked. All seven are usable at 860 and I
   said that width "looks perfect", so nothing I wanted was lost. But it is a real reduction and it
   is my call.

2. **How far should POL-010's fix go?** Sourcing the walk's topology from `ProjectModel` instead of
   the runtime makes it answer about the graph the user is looking at, which is what the panel claims
   to do — but it costs component-scoping and a decision about component instances that the runtime
   dictionary got for free. The cheap alternative is slice 3 alone: the panel stops presenting one row
   as a result and says which of four states it is in.

3. **New — is the sandbox meant to be signed in at all?** POL-008 Part A's fix seeds a fake session so
   a profile page previews with sample values. That makes `Authenticated` true and the logged-in
   branch of every graph the default in preview. It is almost certainly what you want for previewing a
   profile page, but it means "signed out" becomes a state the preview can no longer show. Say if you
   want a toggle rather than a default.
