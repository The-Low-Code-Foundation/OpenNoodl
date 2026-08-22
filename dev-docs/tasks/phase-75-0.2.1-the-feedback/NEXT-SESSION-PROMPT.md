# Phase 75 — next session

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

1. **Drive NAT-012's AC3/AC4** — the biggest unpaid debt on this tranche. Open a project, use the
   door, watch it close and land on the launcher's Community tab, reopen and check the canvas
   comes back on the same component. ⚠️ AC4's other half means **posting a real question to the
   live Bench** — still Richard's call, still deliberately undriven.
2. **NAT-012 AC7** — the rail icon for a D15-refused viewer. `SidebarModel.register` is
   synchronous at setup for **every** panel; the fix is shared editor bootstrap, and it must be
   driven with a refused account **and a permitted control beside it**. The two states must
   *disagree*.
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

- 🔴 **THE FILED DIAGNOSIS HAS NOW BEEN WRONG FOUR TIMES RUNNING** — FB-020, `uni022` AC4, FB-019,
  NAT-012 AC3. **Read the code a task file points at before believing what it says about it.**
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
- 🔴 **Revert the fix and count the reds** (still the rule). NAT-012: reverting the panel turns
  **11 of 20** rows red; mutating **only** the door's label turns exactly **1** — worth knowing
  separately, because a silent door is the failure that would otherwise look like a feature.
- ⚠️ **Borders are stored per side** — `borderTopColor`, never the shorthand.
- ⚠️ **`scroll-behavior: smooth` makes a same-eval `scrollTop` read lie**, and toward the bug.
- ⚠️ **The launcher's recents file is a real user file the running editor owns** — write it only
  while the editor is idle on the launcher, then reload.
- **Editor `tests-unit`, 2026-08-22 after `e17ee460`: 289 suites / 4723 specs, 0 failures.**
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
a sibling whose Width *is* set — the population-A control that must not change. **NAT-012's drive
needs any project with at least two components**, so the restore has something to be wrong about.

## End every session

Update this file and memory (`phase-75-0-2-1-the-feedback.md` + its MEMORY.md pointer).
