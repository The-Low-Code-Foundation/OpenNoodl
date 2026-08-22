# Phase 75 — next session

**State as of 2026-08-22 (session 5).** The D6 tranche is **half shipped**: FB-006's launcher
restructure is done, driven and committed (`5d31a567`), and NAT-012's AC4 is done (`39404361`).
NAT-012 is now the open half, and reading its code produced **a ruling Richard has to give**.
Read `TASKS.md` first; it carries the measurements you must not re-derive.

## What changed this session

- ✅ **FB-006 — the launcher community page is the web's tabs** (`5d31a567`). Bench · Tutorials ·
  Replays · People, one section on screen at a time, chrome (viewer, refresh, health readout,
  browser door) framing all of them, a lead sentence inside each tab. Driven in both themes.
  - 🔴 **The first tab is "Bench", not the ruled proposal's "Discussions"** — D6 said both
    *"Discussions"* and *"same names as the web"* in one sentence and the web has said **Bench**
    since UNI-015. **Flag it to Richard; it is one table row in `communityTabs.ts` to change back.**
  - 🔴 **`Tabs` grew a hook-free `TabStrip`** so the page stays walkable by `tests-unit`'s element
    walker (a hook anywhere in the returned tree throws there). `Tabs` renders it in place of the
    markup it held inline, so **the DOM seven editor panels draw is unchanged**; the variant rules
    in `Tabs.module.scss` now hang off the variant class alone.
  - Revised **NAT-005**'s page and **NAT-008**'s D15 pair (whose refused arm got *stronger*). Both
    named in the diff and in NAT-005's own file.
- ✅ **NAT-012 AC4 — asking about a node ends in the editor** (`39404361`). `AskAboutNodeDialog`
  offers **Open the thread**; `utils/community/communityThreadRequest.ts` is the stash-emit-switch
  seam (`provenanceRequest`'s pattern), claimed by `useCommunityThread`. ⚠️ **Undriven on purpose**
  — end to end it means posting a real question to the live Bench.

## First moves, in order

1. 🔴 **Ask Richard two things before building NAT-012's remainder.**
   (a) **AC3's ruling**: going from the editor to the launcher **disposes the project**
   (`router.tsx:154–210`; the only caller is `exitEditor`). So "does not lose your project or your
   place" is a *router* change, not a community one — teach the router to keep a project across a
   `'projects'` route, or accept the close, label the door honestly and restore the component on
   reopen. (b) **Bench vs Discussions** as the first tab's name.
2. **NAT-012's editor narrowing** — the biggest unblocked piece, and it needs no ruling. Remove
   People / Guides / Replays / the health readout from `CommunityPanel`, keep Discussions, the
   thread pane, the profile pane **and TUT-004's installable tutorials** (a lesson written into
   your project is project-relevant). ⚠️ Name NAT-008 AC1's rail half and NAT-005's panel in the
   diff, as FB-006 named NAT-005's page. The `openExternal` table in the task file says which call
   sites die with those sections.
3. **NAT-012 AC7** — the rail icon for a D15-refused viewer. `SidebarModel.register` is
   synchronous at setup for **every** panel; the fix is shared editor bootstrap, and it must be
   driven with a refused account **and a permitted control beside it**.
4. **FB-001** — D7 is ruled, scope 1–3 of the task file is what he chose. Four derived-from-disk
   platform gates fire on the new PATCH/DELETE routes; `npm run build` first or the real-HTTP file
   self-skips.
5. **FB-019 implementation** — the sweep already revised AC1/AC2: keep the merge, fix only the
   no-stored-unit case, on **all three** registration paths. 🔴 **Drive an image-cropper pan
   first** — the six broken connections are predicted from source and nobody has watched one fail.
6. **Quick wins with no rulings**: FB-007, FB-010, FB-003 — the build-the-caller family.
7. **Still needing Richard**: FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme baseline, prod
   `ANTHROPIC_API_KEY` (⚠️ intro pricing ends **2026-08-31** — nine days), the 15 lessons' prose,
   Discord's row in the `?` menu, `/rfps` search.

## Standing traps for this phase

- 🔴 **THE FILED DIAGNOSIS HAS NOW BEEN WRONG FOUR TIMES RUNNING** — FB-020, `uni022` AC4, FB-019,
  and now **NAT-012 AC3** (which reads as a community task and is a router task). **Read the code
  a task file points at before believing what it says about it.**
- 🔴 **A shared component's spec is a hostage.** Putting `Tabs` inside the community page would
  have taken NAT-005's twenty-assertion render spec down with an exception, not a failure. Before
  reaching for a stateful component in a graded tree, check whether the walker can evaluate it.
- 🔴 **Revert the fix and count the reds** (still the rule). FB-006: drawing every section at once
  turns **5** specs red across two files.
- 🔴 **A gate can report N failures for one defect** (the drift check's five probes, session 4).
- ⚠️ **Borders are stored per side** — `borderTopColor`, never the shorthand.
- ⚠️ **`scroll-behavior: smooth` makes a same-eval `scrollTop` read lie**, and toward the bug.
- ⚠️ **The launcher's recents file is a real user file the running editor owns** — write it only
  while the editor is idle on the launcher, then reload.
- **Editor unit suite, 2026-08-22 after both commits: 287 suites / 4688 specs, 0 failures.**
  core-ui package suite **521 / 0**. `typecheck:editor` and `typecheck:editor-tests` both 0.
  ⚠️ `typecheck:core-ui` reports **44 pre-existing `TS2307`** module-resolution errors — unchanged,
  and not yours. Compare **by name**, and re-measure rather than quoting this.
- ⚠️ **Two community commits are still unshipped**: `9ecec25` (tokens + gates) and `fd695ae`
  (FB-002's web half). nexus-1 is still `8d40b63`. Deploying changes the live site's dark inks and
  the Bench's default list — **Richard's call, ask before deploying.**
- Platform: `npm run build` first; Postgres 55432; four derived-from-disk gates plus the `/v1`
  envelope contract fire on any new route or column.
- ⚠️ **`NAT-011` still carries an uncommitted AC7** beside older uncommitted edits from a previous
  session, and phase-65/70/71 are untracked — somebody else's work; check before sweeping any of
  it into a commit. (NAT-012's equivalent block **was** committed this session, named in the
  message.)
- Shared checkout: **commit by pathspec, never stage**; `git log -5 -- <path>` before overwriting
  a shared file; never `git stash`.

## Drive fixtures on disk

`fb020-drive` and `fb020b-drive` (A bare, B author checked-state, C Enable Icon off, D bare radio
group, E author fill colour — B, C and E are the regression arms). Both are in the launcher's
recent list; `fb020b-drive` was opened this session, so it carries the three files an open writes.
**FB-019 will want a new one**: a Group with a never-set Width fed a bare number, plus a sibling
whose Width *is* set — the population-A control that must not change.

## End every session

Update this file and memory (`phase-75-0-2-1-the-feedback.md` + its MEMORY.md pointer).
