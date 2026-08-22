# Phase 75 — next session

**State as of 2026-08-22 (session 7).** Session 7 did **one** thing: it drove NAT-012's AC3, and
the drive deleted half the mechanism AC3 shipped with (`f50efe73`). Read *"What session 7 found"*
below before touching NAT-012, then the session-6 notes, which still stand.

## What session 7 found

- ✅ **NAT-012 AC3 — DRIVEN, and it passes.** Fixture `nat012-drive` (a copy of `fix012-drive`,
  two components `/App` + `/Probe`, registered in the launcher). Door label reads *"Community home
  — closes your project"*; `ProjectModel.instance` goes **`undefined`**; the launcher lands on
  **Community**; reopening puts the canvas back on `/Probe`. The narrowing is confirmed live too —
  the panel draws Discussions + Tutorials + the two buttons, and People/Guides/Replays/health are
  on the launcher page.
- 🔴 **But the restore was never ours, and the code written for it was DEAD.** The control that
  broke it: the *ordinary* exit ("Back to projects") also came back on `/Probe`. Three arms —
  steal the stash (`/Probe` anyway), clear `selectedComponentName` instead (`/App`), and an
  instrumented `switchToComponent` — showed **two calls on every open**: `restoreEditorPlace` →
  the stashed name, then **`useSwitchToDefaultComponent` (`UseSetupNodeGraph.ts:26`) → the
  default, unconditionally, later**. The second always won.
  - The restore AC3 promises is **`EditorDocument.tsx:401/432`**, which predates the task: same
    `ProjectModel.id` key, same `getComponentWithName`, same `replaceHistory: true`, and
    **persisted to `editorSettings.json`** — so it survives a restart and covers *every* exit
    route, not just this door.
  - `rememberEditorPlace` / `takeEditorPlace` / `restoreEditorPlace` are **deleted**; the landing
    half stays and is load-bearing. Re-driven after the deletion: unchanged.
  - ⚠️ **Its spec asserted the source text `restoreEditorPlace(currentInstance);` was present.**
    It was, and it meant nothing. Replaced with an absence row + an `EditorDocument` pin, both
    mutation-checked, beside a **new known-firing arm** (the old one only covered the panel file).
- 🔴 **AC7 has a hole shaped like the defect, measured before anything was built.**
  `SidebarModel` already has a removal path (the experimental toggle): splice `items`, notify.
  Run against a live *active* Community panel it leaves `activeId === 'community'`,
  `panels['community']` registered, and **the panel still drawing** — icon gone, surface present,
  the inverse of D15. The fix is three things (splice, `delete panels[id]`, switch away to
  `components`), and **the drive must read the PANEL, not the rail**. Full table in NAT-012 AC7.
- ⚠️ **Two things noticed, owned by nobody.** The launcher's recents file has a **duplicate project
  id** (`692d3658…` shared by `tut001-drive` and `Puppy test 3`), which React warns about on every
  launcher render. And the first `dev:debug` of the session died on *"Noodl is already running"*
  with no editor process on the machine — a transient single-instance race; the relaunch was clean.

**State as of 2026-08-22 (session 6).** The D6 tranche is **shipped**: FB-006's launcher
restructure (`5d31a567`), NAT-012's AC4 (`39404361`), and now **NAT-012's AC2 audit, AC3 and the
editor narrowing** (`e17ee460`). Both of session 5's open rulings came back. Read `TASKS.md`
first; it carries the measurements you must not re-derive.

## What changed this session

- ✅ **Bench vs Discussions — RULED, and the question was better than the answer expected.**
  Richard asked whether a rename was quietly merging the bench with the **chat** he commissioned
  (FB-013). It was not, and the check is on disk: *"Discussions"* was only ever a heading over
  `view.threads`; those threads are `bench_threads` from `/api/v1/bench/threads`, opened at
  `community.nodegx.io/bench/<id>`; UNI-011 coined the word for exactly that list; the web has
  **no `/discussions` route**. 🔴 **Chat is the argument FOR "Bench"** — FB-013 arrives as its own
  tab in the same table, and a chat feed is more literally a *discussion* than an answered-state
  Q&A is, so keeping "Bench" leaves the word free for the surface that will want it. Reasoning
  lives in `communityTabs.ts`'s module note; the label is still one table row.
- ✅ **NAT-012 AC3 — RULED: accept the close, label it honestly.** Richard took option (2), so the
  dispose branch in `router.tsx` is untouched. The door reads **"Community home — closes your
  project"**, and reopening restores the component you were on.
  - `utils/launcher/launcherHandoff.ts` — the two facts (landing page, place-per-project),
    **module state, consumed on read**. 🔴 Not `localStorage`: a landing read off disk at startup
    is FIX-025's defect rebuilt, and opening a project already writes three files without a fourth.
  - `utils/launcher/leaveForLauncher.ts` — the gesture. 🔴 **Both reads happen BEFORE
    `exitProject`**, which notifies `'exitEditor'` synchronously and disposes everything; that
    order is asserted as order.
  - ⚠️ **The place is keyed by NAME**, because the reopened project is a different `ProjectModel`
    with different `ComponentModel` objects — `componentInstanceId`'s WeakMap cannot answer this.
    A rename while you are away therefore **misses, and draws nothing**, which is correct: a guess
    that looked like a restore would be worse.
- ✅ **The editor narrowing.** `CommunityPanel` drew seven things; it now draws what passes *"is
  this about the project on the canvas?"* — Discussions, the thread pane, the profile pane, and
  TUT-004's installable tutorials. People / Guides / Replays / the health readout went to the
  launcher, which already draws all four. `openCommunity` **lost its `path` parameter** with the
  rows that jumped to Chrome silently.
- 🔴 **Two live task files revised, named in the diff**: NAT-008 AC1's **rail half is withdrawn**
  (AC2's profile pane stays — you reach it from an author line that is still drawn); NAT-005's
  **panel** loses two sections while its components and vocabulary are untouched.
- 🔴 **uni-001's AC4 rows were REPOINTED, not shortened.** Two anchors vanished and `isGated`
  **threw** rather than passing blind — which is the only reason it was caught. The claim follows
  the sections to the launcher page, **with a mutation arm**: that file has no viewer conditional
  at all, so three bare `false`s would have proved nothing.

## First moves, in order

1. ~~Drive NAT-012's AC3~~ — ✅ **done, session 7** (`f50efe73`). ⚠️ **AC4's other half is still
   open**: posting a real question to the live Bench from a signed-in editor. Richard's call.
2. **NAT-012 AC7** — the rail icon for a D15-refused viewer. `SidebarModel.register` is
   synchronous at setup for **every** panel; the fix is shared editor bootstrap, and it must be
   driven with a refused account **and a permitted control beside it**. The two states must
   *disagree*. 🔴 **Start from the measured table in NAT-012 AC7** — the naive unregister leaves
   the panel drawing, and a rail-only drive passes on it. `me().community.surface === 'absent'`
   (`mirrorview.ts:125`) is the signal; `useCommunityMirror` is where it is read today.
3. **FB-001** — D7 is ruled, scope 1–3 of the task file is what he chose. Four derived-from-disk
   platform gates fire on the new PATCH/DELETE routes; `npm run build` first or the real-HTTP file
   self-skips.
4. **FB-019 implementation** — the sweep already revised AC1/AC2: keep the merge, fix only the
   no-stored-unit case, on **all three** registration paths. 🔴 **Drive an image-cropper pan
   first** — the six broken connections are predicted from source and nobody has watched one fail.
5. **Quick wins with no rulings**: FB-007, FB-010, FB-003 — the build-the-caller family.
6. **Still needing Richard**: FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme baseline, prod
   `ANTHROPIC_API_KEY` (⚠️ intro pricing ends **2026-08-31** — nine days), the 15 lessons' prose,
   Discord's row in the `?` menu, `/rfps` search.

## Standing traps for this phase

- 🔴 **THE FILED DIAGNOSIS HAS NOW BEEN WRONG FIVE TIMES RUNNING** — FB-020, `uni022` AC4, FB-019,
  NAT-012 AC3, and now **NAT-012 AC3's own implementation**, which is the new shape: the task file
  was right that AC3 needed a restore, the ruling was right, and the code built for it was
  **dead on arrival** because nobody checked whether the editor already did it. 🔴 **Before
  building a mechanism, grep for the one that already exists** — `selectedComponentName` was one
  `grep -rn` away from the task file the whole time. **Read the code a task file points at before believing what it says about it.**
  🆕 **And the same applies to a task file's own AC wording**: NAT-012 AC3 asked for a persistence
  the router does not offer, so it was *rewritten to the ruling* rather than left as a bar nothing
  would ever clear.
- 🔴 **A narrowing shrinks a checker's population silently.** When an anchor disappears, the fix is
  to **follow the subject**, not delete the row — a claim whose population quietly shrank is how a
  gate goes quiet without going red. ⚠️ And when you repoint it to a new file, **prove the checker
  can fire there**: `Community.tsx` has no viewer conditional, so every absence read `false`
  vacuously until a mutation arm was added.
- 🔴 **A shared component's spec is a hostage** (FB-006's `TabStrip`). Before reaching for a
  stateful component in a graded tree, check whether `tests-unit`'s walker can evaluate it.
- 🔴 **A SPEC THAT ASSERTS A CALL EXISTS PASSES ON DEAD CODE.** `expect(src).toContain('foo(x);')`
  is a mechanism check, and NAT-012 AC3 is the case where the mechanism was present, correct, and
  overwritten by a later effect on every single run. The drive is the only thing that could tell
  the difference. When the subject is *"does this produce an outcome"*, the arm is: **starve every
  other candidate and see whether the outcome survives.**
- 🔴 **Revert the fix and count the reds** (still the rule). NAT-012: reverting the panel turns
  **11 of 20** rows red; mutating **only** the door's label turns exactly **1** — worth knowing
  separately, because a silent door is the failure that would otherwise look like a feature.
- ⚠️ **Borders are stored per side** — `borderTopColor`, never the shorthand.
- ⚠️ **`scroll-behavior: smooth` makes a same-eval `scrollTop` read lie**, and toward the bug.
- ⚠️ **The launcher's recents file is a real user file the running editor owns** — write it only
  while the editor is idle on the launcher, then reload.
- **Editor `tests-unit`, 2026-08-22 after `f50efe73`: 290 suites / 4720 specs, 0 failures.**
  Reconciled **by name** against the 4723 baseline: **−8** from `launcher-handoff.test.ts`
  (12 → 4, the deleted place half), **+5** from the phase-65 peer's `tests-unit/lib-006` suite,
  which landed in `ed3e0f4d` *after* that baseline was taken. Older reading, for the arithmetic:
  ⚠️ **That is `tests-unit` ALONE.** `npx jest -c jest.config.js` with no path also runs
  `tests-main` (19 more suites) and reports **308 / 4987** — reconcile against disk before
  believing either. `typecheck:editor` and `typecheck:editor-tests` both 0; `typecheck:core-ui`
  reports **44 pre-existing `TS2307`**, unchanged and not yours. Compare **by name**, and
  re-measure rather than quoting this.
- ⚠️ **Two community commits are still unshipped**: `9ecec25` (tokens + gates) and `fd695ae`
  (FB-002's web half). nexus-1 is still `8d40b63`. Deploying changes the live site's dark inks and
  the Bench's default list — **Richard's call, ask before deploying.**
- Platform: `npm run build` first; Postgres 55432; four derived-from-disk gates plus the `/v1`
  envelope contract fire on any new route or column.
- ⚠️ **A peer was blitzing phase 65 in this checkout on 2026-08-22** (library/**, scripts/library,
  noodl-mcp, import-engine) and had `library/modules/*` deletions staged. `NAT-011` still carries
  an uncommitted AC7 beside older uncommitted edits, and phase-65/70/71 are untracked — somebody
  else's work; check before sweeping any of it into a commit.
- Shared checkout: **commit by pathspec, never stage**; `git log -5 -- <path>` before overwriting
  a shared file; never `git stash`.

## Drive fixtures on disk

`fb020-drive` and `fb020b-drive` (A bare, B author checked-state, C Enable Icon off, D bare radio
group, E author fill colour — B, C and E are the regression arms). Both are in the launcher's
recent list. **FB-019 will want a new one**: a Group with a never-set Width fed a bare number, plus
a sibling whose Width *is* set — the population-A control that must not change.
✅ **`nat012-drive`** now exists (a copy of `fix012-drive`; `/App` + `/Probe`, fresh project id,
registered in the launcher) — that is the two-component fixture AC3 needed, and AC7's drive can
reuse it.

⚠️ **Driving this editor from CDP: there is no editor global, but webpack's require is reachable.**
`window.webpackChunknoodl_editor.push([[Math.random()],{},(r)=>{req=r}])` hands back
`__webpack_require__`, and `req('./src/editor/src/models/projectmodel.ts')` &c. give the app's own
module instances. 🔴 **Check `req.c[id]` first** — a module that is not already instantiated gets a
*fresh* copy, and you would be reading state the app does not share. Patching a prototype method
(`NodeGraphEditor.prototype.switchToComponent`) to record call stacks is what named the overwriter
in AC3, and is the cheapest way to answer "who actually did this".

## End every session

Update this file and memory (`phase-75-0-2-1-the-feedback.md` + its MEMORY.md pointer).
