# Phase 75 — next session

**State as of 2026-08-22 (session 4).** The rulings queue is **empty of its four big items** —
D6, D7, R-templates and R-chat all landed this session and are recorded. Both unowned red gates
are closed. FB-019's mandatory sweep is done and **it revises the task's own AC1**. Read
`TASKS.md` first; it carries the measurements you must not re-derive.

## What changed this session

- **Four rulings settled (`378ef2c4`).** Recorded in `phase-72/README.md` §4 (D6, D7), in this
  phase's README table, and in each task file's header.
  - **D6 — launcher home in the web's tabs, editor door only.** Unblocks FB-006 + NAT-012;
    build them in one tranche. 🔴 **It narrows Richard's own D21** — name D21 in the diff or a
    later session reads the shrinking rail panel as a regression.
  - **D7 — edit-own + delete-unanswered.** Report/flag and hide-after-answers were **declined**.
    ⚠️ That leaves **FB-005 and FB-013 with no moderation posture**, and both were ruled *in* on
    the same day. Do not infer one from D7; it was ruled on the bench.
  - **R-templates — curated first.** A share button files a submission; Richard publishes.
    ECO-002's G3 stays shut, licences stay parked.
  - **R-chat — 🔴 OVERRULED: chat ships.** UNI-011's argument is **superseded by a decision, not
    answered**, so it stays quoted and the risk it named is still live. FB-014 gains a second
    corpus. Scoping doc first.
- **Both red gates closed (`9ecec25`, nodegx-community).** Token drift synced; `uni022` AC4
  fixed — the filed diagnosis was wrong again. Suite **1277 / 0**.
- **FB-019 sweep done (`9636681a`)** over all 92 `project.json` files, scripts kept beside the
  task. It corrects the filed diagnosis three ways; detail in the task file and `TASKS.md`.

## First moves, in order

1. **FB-006 + NAT-012 as one tranche** — D6 is ruled and this is the biggest unblocked thing.
   FB-006 does the launcher tab restructure (AC1–AC4), NAT-012 the navigation model and the
   editor narrowing. ⚠️ Reuse the shared `@noodl-core-ui/components/community` vocabulary; a
   second copy of the row/section primitives is the drift shape this repo keeps hitting.
2. **FB-001** — D7 is ruled, and scope 1–3 of the task file is exactly what he chose. Four
   derived-from-disk platform gates fire on the new PATCH/DELETE routes; `npm run build` first
   or the real-HTTP file self-skips.
3. **FB-019 implementation.** The sweep changed what to build: **keep the merge**, fix only the
   no-stored-unit case, on **all three** registration paths. AC1/AC2 are already rewritten.
   🔴 **Drive an image-cropper pan first** — the six broken connections are predicted from
   source and nobody has watched one fail.
4. **Quick wins with no rulings**: FB-007, FB-010, FB-003 — the build-the-caller family.
5. **Still needing Richard**: FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme baseline, prod
   `ANTHROPIC_API_KEY` (⚠️ intro pricing ends **2026-08-31** — nine days), the 15 lessons' prose,
   Discord's row in the `?` menu, `/rfps` search, the checkbox's new default tick.

## Standing traps for this phase

- 🔴 **THE FILED DIAGNOSIS HAS NOW BEEN WRONG THREE TIMES RUNNING** — FB-020 (the click always
  worked; nothing drew a tick), `uni022` AC4 (the "hardcoded slug" was a comment), FB-019 (the
  merge is the feature, not the bug; the named failure has zero instances and an unnamed third
  path has six). **Read the code the task file points at before believing what it says about it.**
- 🔴 **A gate can report N failures for one defect.** The drift check's five known-bad probes
  assert an exact difference *count*, so one real drift makes all five red. Fix the real one and
  re-run before believing you have five problems. Same family as a green suite grading nothing,
  pointing the other way.
- 🔴 **Narrowing what a sweep reads needs control arms, and one must be a mutation.** AC4 now
  ignores comments; three arms prove it still sees code, and hardcoding the slug in the route's
  real code was checked to still fail. A stripper that mis-parses a string literal deletes real
  code from the sweep — the hole shaped like the defect, 6th instance.
- 🔴 **A port NAME is not a port TYPE.** The FB-019 sweep matched by name and reported 189 hits;
  7 were `Expression.width`, and one of those was about to be written up as a shipped prefab
  hitting the bug. Split by target node type before quoting any total.
- 🔴 **Revert the fix and count the reds** (carried from session 3, still the rule).
- ⚠️ **Borders are stored per side** — `borderTopColor`, never the `borderColor` shorthand.
- ⚠️ **`scroll-behavior: smooth` makes a same-eval `scrollTop` read lie**, and toward the bug.
- ⚠️ **The launcher's recents file is a real user file the running editor owns** — write it only
  while the editor is idle on the launcher, then reload.
- **Community suite, 2026-08-22 after the fixes: 1277 specs, 0 failures.** Compare **by name**,
  and re-measure rather than quoting this.
- ⚠️ **Two community commits are unshipped**: `9ecec25` (tokens + gates) and `fd695ae` (FB-002's
  web half). nexus-1 is still `8d40b63`. Deploying changes the live site's dark inks and the
  Bench's default list — **Richard's call, ask before deploying.**
- Platform: `npm run build` first; Postgres 55432; four derived-from-disk gates plus the `/v1`
  envelope contract fire on any new route or column.
- Viewer jest is `testEnvironment: node`, but `renderToStaticMarkup` renders hooks fine — the
  core-ui `Icon`/`require.context` trap does not apply to the viewer's own `IconGlyph`.
- ⚠️ **`NAT-011` still carries an uncommitted AC7** beside older uncommitted edits from a
  previous session, and phase-65/70/71 are untracked — somebody else's work; check before
  sweeping any of it into a commit.
- Shared checkout: **commit by pathspec, never stage**; `git log -5 -- <path>` before overwriting
  a shared file; never `git stash`.

## Drive fixtures on disk

`fb020-drive` and `fb020b-drive` (A bare, B author checked-state, C Enable Icon off, D bare radio
group, E author fill colour — B, C and E are the regression arms). Both are in the launcher's
recent list. **FB-019 will want a new one**: a Group with a never-set Width fed a bare number,
plus a sibling whose Width *is* set — the population-A control that must not change.

## End every session

Update this file and memory (`phase-75-0-2-1-the-feedback.md` + its MEMORY.md pointer).
