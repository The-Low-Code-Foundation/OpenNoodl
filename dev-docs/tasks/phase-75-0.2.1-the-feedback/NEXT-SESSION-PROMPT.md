# Phase 75 — next session

**State as of 2026-08-22 (session 2).** T0 is measured and closed; FB-008 and FB-004 are built,
specced and committed; FB-002's web half is built, specced and committed on the platform.
Everything else is as filed. Read `TASKS.md` first — it now carries T0's answer and a
**baseline** you must not re-derive.

## What changed this session

- **T0 ✅ nexus-1 runs `8d40b63`, clean, deployed 2026-08-21T09:25Z** — the same commit as local
  `main`. The `0cbd716` handover was stale. **No deploy is needed**, so the mail-drain refusal
  is still ahead of us rather than behind. Both sites 200.
- **FB-008 ✅** — `NodeGX Community` in the editor's `?` menu (`14ae3df7`). Discord kept.
- **FB-004 ✅** — the Learning tab is two tabs (`cef15952`). ⚠️ **Undriven** — see below.
- **FB-002 🟡** — the web half (`fd695ae` in `nodegx-community`). The editor mirror is open and
  the task file now says it is cheaper than filed.

## First moves, in order

1. **Drive the editor once, for two things at the same time.** CDP 9222 was **free** all of this
   session — no dev editor was running — so the drive queue may have cleared. Ask before
   assuming, do not reap.
   - **FB-020, the unclickable checkbox** — still the right first item: a broken control in a
     shipped release, reported by Richard and Jordan independently. The code says the component
     should work (local-state toggle), so the drive's job is finding what eats the click; prime
     suspect is design-mode inspector listeners staying attached in preview (`inspector.ts` —
     `preventDefault` on click at document capture), which if true kills **every** control after
     design mode is visited. Discriminators are in the task file. Fix the `props.checked` desync
     (`checkbox.ts:39-47`) in the same pass regardless.
   - **FB-004's layout**, which is reasoned about and not seen. The segmented `Tabs` strip sits
     inside `ContentArea`, which scrolls; `Tabs`' root is `height: 100%; overflow: hidden`, which
     should resolve to `auto` under an auto-height parent. That is an argument. This repo's rule
     is *drive it, do not reason about it*. Check both tabs, the empty-shelf default, and that a
     lesson grid taller than the window is not clipped.
2. **Put the rulings to Richard in one sitting** — unchanged and still blocking Tier 2/4: D6
   (FB-006 is the written proposal), D7 (FB-001), R-templates (FB-005), R-chat (FB-013, both
   sides quoted), plus the carried ones: FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme
   baseline, prod `ANTHROPIC_API_KEY` (⚠️ intro pricing ends **2026-08-31**), the 15 lessons'
   prose. Add two small ones this session raised:
   - **Discord's row in the `?` menu** — kept for now; removing it is one line.
   - **`/rfps` search and closed briefs** — FB-002 gave the Bench's default a search yield and
     deliberately did *not* give `/rfps` one. Same question, his call.
3. **Two red gates nobody owns, both pre-existing, both real** (details in `TASKS.md`):
   - `npm run tokens:sync` in `nodegx-community` — the vendored `colors.css` has drifted from
     the editor's by 6 tokens. ⚠️ Its *probes* fail too, so it is reporting one drift, not five;
     sync, then re-run before believing anything.
   - `uni022-syllabus` AC4 — `api/v1/me/path/project/route.ts` hardcodes a lesson slug.
4. **Then the rest of Tier 1b**: FB-019 (two confirmed runtime bugs + Jordan's §2.2 aliasing
   investigation; sweep examples/lessons for dimension-port connections before changing
   coercion), then FB-018/FB-021/FB-015; FB-017 → FB-016 → FB-022 for the panel/canvas trio.
   **FB-002's editor half** slots in here too — it is a type widening plus a client-side filter,
   not a platform change.
5. **Quick wins remaining with no rulings**: the build-the-caller family — FB-007, FB-010,
   FB-003.

## Standing traps for this phase

- **Community suite baseline, re-measured 2026-08-22 after `npm run build`: 1274 specs, 7
  pre-existing failures** (6 token drift + 1 syllabus). **Compare by name, never by count**, and
  re-measure rather than quoting this.
- Platform suite: `npm run build` first or the real-HTTP file self-skips; Postgres is 55432;
  four derived-from-disk gates + the `/v1` envelope contract fire on any new route/column.
- ⚠️ **`NAT-011` carries an uncommitted AC7** (FB-004's reconciliation AC), sitting beside
  **older uncommitted edits from a previous session** in the same file. It was left uncommitted
  rather than sweeping somebody else's work into a commit. Several other phase-72 files, and the
  whole of phase-65/70/71, are untracked for the same reason — check with whoever owns them
  before committing any of it.
- `COMMUNITY_URL` is a hardcoded constant — local platform drives need the one-line edit,
  reverted after.
- Shared checkout: commit by pathspec, never stage; `git log -5 -- <path>` before overwriting
  any shared file; never `git stash`.
- Three FB tasks **revise met ACs** — name the revised AC in the diff or a later session reads
  the change as a regression. **FB-004 → UNI-007 AC1 is now done and named**; FB-009 → UNI-022
  and FB-011 → UNI-016 are still ahead. FB-002 revised one too (`uni013-slice5`'s section
  counts), and that is in its commit message.
- 🔴 **A view that reaches core-ui's `Icon` cannot be imported by a spec at all** —
  `require.context` is a webpack builtin and ts-jest rejects it at type-check time, so the suite
  fails to *run*. Both tasks built this session hit it. The move is a sibling module holding the
  data, imported by both the view and the spec; the view's own use of it is then checked at the
  source level. `tests-unit/support/renderElements.ts` says the same thing about hooks.

## End every session

Update this file and memory (`phase-75-0-2-1-the-feedback.md` + its MEMORY.md pointer).
