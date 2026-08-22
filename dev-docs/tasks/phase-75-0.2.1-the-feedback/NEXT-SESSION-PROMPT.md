# Phase 75 — next session

**State as of 2026-08-22 (session 3).** T0 closed; FB-008, FB-004 and **FB-020** done, specced
and committed; FB-002's web half committed on the platform. Read `TASKS.md` first — it carries
T0's answer and a **baseline you must not re-derive**.

## What changed this session

- **FB-020 ✅ closed and driven (`64bd02b3`).** 🔴 **The filed diagnosis was wrong, and the
  correction is the transferable part.** All three ranked candidates were ways the *click* might
  be swallowed (prime suspect: a design-mode `inspector.ts` listener leak). One drive killed all
  three: `input.checked` true, `_internal.checked` true, `Checked` output propagating — **and the
  box pixel-identical.** The click always worked; nothing *drew* a tick. **No listener leak, and
  no other control is implicated by it** — anything that still says otherwise is stale.
  Fixed in `Checkbox.tsx` (default tick), `RadioButton.tsx` (AC4: same defect from the other
  side, plus the dot was painted on every button in the group) and `checkbox.ts` (the
  `props.checked` desync). Viewer suite **945 / 74 suites**, typecheck clean.
- **FB-004 ✅ driven.** The `overflow: hidden` clipping worry is disproved by measurement, not
  argument: a 1400px probe grows the tab root and `ContentArea` scrolls (687/1800).

## First moves, in order

1. **Put the rulings to Richard in one sitting** — now the top of the list, unchanged and still
   blocking Tier 2/4: D6 (FB-006 is the written proposal), D7 (FB-001), R-templates (FB-005),
   R-chat (FB-013, both sides quoted), plus the carried ones: FIX-026 (a)/(b), FIX-027 14/15/16
   + 22, tsfixme baseline, prod `ANTHROPIC_API_KEY` (⚠️ intro pricing ends **2026-08-31**), the
   15 lessons' prose. Three smaller ones raised since:
   - **Discord's row in the `?` menu** — kept for now; removing it is one line.
   - **`/rfps` search and closed briefs** — FB-002 gave the Bench's default a search yield and
     deliberately did *not* give `/rfps` one. Same question, his call.
   - **The checkbox's new default tick** — it is deliberately conservative (an author icon, an
     author image, or Enable Icon off all still win). Worth him seeing it once.
2. **Two red gates nobody owns, both pre-existing, both real** (details in `TASKS.md`):
   - `npm run tokens:sync` in `nodegx-community` — the vendored `colors.css` has drifted from
     the editor's by 6 tokens. ⚠️ Its *probes* fail too, so it reports one drift, not five;
     sync, then re-run before believing anything.
   - `uni022-syllabus` AC4 — `api/v1/me/path/project/route.ts` hardcodes a lesson slug.
3. **The rest of Tier 1b**: FB-019 (two confirmed runtime bugs + Jordan's §2.2 aliasing
   investigation; sweep examples/lessons for dimension-port connections before changing
   coercion), then FB-018/FB-021/FB-015; FB-017 → FB-016 → FB-022 for the panel/canvas trio.
   **FB-002's editor half** slots in here too — a type widening plus a client-side filter.
   ⚠️ FB-019 and FB-021 are the two most likely to want a drive; the queue was clear all of this
   session, but **ask before assuming, and do not reap**.
4. **Quick wins with no rulings**: the build-the-caller family — FB-007, FB-010, FB-003.

## Standing traps for this phase

- 🔴 **A green suite grades nothing until you revert the fix and count the reds.** FB-020's 14
  specs were all green; reverting the three fixes gave **4** red, so ten were passing either way
  — and two of those *claimed* to be grading the fix. They asserted a colour against the whole
  markup, where the wrapper's border carries the same value. Scoped to the mark's own element,
  the revert gives **6**. Do the revert pass on anything that ships a fix.
- 🔴 **Borders are stored per side — `borderTopColor`, never the `borderColor` shorthand.**
  Reading the shorthand yields `undefined` and falls through to `currentColor`: correct-looking
  on a light page, invisible on a dark one, and green in both the drive and the first spec run.
- 🔴 **A control arm is what turns "nothing happened" into a measurement.** FB-020's fixture
  carried a checkbox with a configured `checked` state; it turned red on the same click that left
  the bare one still. Without it, a dead mechanism and a missing default read identically.
- ⚠️ **`scroll-behavior: smooth` makes a same-eval `scrollTop` read lie**, and it lies *toward*
  the bug: `scrollHeight 1800 / clientHeight 687 / scrollTop 0` reads as content that refuses to
  scroll. Measure the scroll position in a second CDP call.
- ⚠️ **The launcher's recents file is a real user file the running editor owns.** Prepending a
  fixture to `~/Library/Application Support/NodeGX/recently_opened_project.json` is how you open
  one without the native dialog — but the editor's `store()` clobbers your write whenever it
  saves its in-memory list. Write it only while the editor is idle on the launcher, then reload.
- **Community suite baseline, 2026-08-22 after `npm run build`: 1274 specs, 7 pre-existing
  failures** (6 token drift + 1 syllabus). **Compare by name, never by count**, and re-measure
  rather than quoting this.
- Platform suite: `npm run build` first or the real-HTTP file self-skips; Postgres is 55432;
  four derived-from-disk gates + the `/v1` envelope contract fire on any new route/column.
- Viewer package jest is `testEnvironment: node`, but **`renderToStaticMarkup` renders hooks
  fine** — the core-ui `Icon`/`require.context` trap does *not* apply to the viewer's own
  `IconGlyph`, so no sibling-module extraction is needed there.
- ⚠️ **`NAT-011` carries an uncommitted AC7** (FB-004's reconciliation AC), beside **older
  uncommitted edits from a previous session** in the same file. Left uncommitted rather than
  sweeping somebody else's work into a commit. Several other phase-72 files, and the whole of
  phase-65/70/71, are untracked for the same reason — check with whoever owns them first.
- `COMMUNITY_URL` is a hardcoded constant — local platform drives need the one-line edit,
  reverted after.
- Shared checkout: commit by pathspec, never stage; `git log -5 -- <path>` before overwriting any
  shared file; never `git stash`.
- Three FB tasks **revise met ACs** — name the revised AC in the diff or a later session reads the
  change as a regression. FB-004 → UNI-007 AC1 is done and named; FB-009 → UNI-022 and FB-011 →
  UNI-016 are still ahead. FB-002 revised `uni013-slice5`'s section counts, named in its commit.

## Drive fixtures on disk

`fb020-drive` (diagnosis: bare / visual-state control / labelled) and `fb020b-drive` (fix: A bare,
B author checked-state, C Enable Icon off, D bare radio group, E author fill colour — B, C and E
are the regression arms). Both are in the launcher's recent list; the editor genuinely opened them.

## End every session

Update this file and memory (`phase-75-0-2-1-the-feedback.md` + its MEMORY.md pointer).
