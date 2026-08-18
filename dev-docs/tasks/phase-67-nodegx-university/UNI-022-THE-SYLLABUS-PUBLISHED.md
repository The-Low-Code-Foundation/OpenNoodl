# UNI-022 — the syllabus, published

> 🔴 **THE DESIGN IS AN ARTIFACT, AND THIS FILE IS NOT IT.**
> **["Every page is the same page"](https://claude.ai/code/artifact/5cc390dd-a8dc-48c9-b960-b74ed89010e6)**
> — §08 draws the spine with its step column, the in-progress lesson and the progress panel.
> ⚠️ **Open it before writing markup.**

**Surface:** platform · **Tier 2** · **Effort:** M · ✅ **D17 is already ruled** — this task honours
it, it does not wait on it.

## Premise

Richard, on being shown the page: *"University — no idea wtf this page is supposed to be doing
yet."* That is the correct reading. `src/app/university/page.tsx` is **41 lines with zero
queries** — static prose holding a name so the wing exists from day one, and it says so itself in
its own last paragraph.

That was a defensible call and it has outlived its usefulness. 🔴 **A visitor cannot tell a
placeholder from an abandoned product.** The page's honesty is invisible to the only people it
matters to.

## The decision this task makes

**University is the curriculum, published as a syllabus.** Not a brochure explaining how lessons
work — **the actual ordered list of lessons**: what each one teaches, what it needs first, roughly
how long it takes, and its honest state. Signed in, the same page gains progress: a tick per lesson
finished.

✅ **This is what D17 already permits.** D17 ruled the curriculum index is *"part of the platform
API under D14 — one content path, the same one the web reads — with GitHub Pages as the v0 while
`community.nodegx.io` and the platform do not exist."* A syllabus rendered from a checked-in
curriculum file **is that v0**, and it becomes v1 by changing an origin, not a design.

🔴 **A syllabus is a real page when no lesson is installable.** That is the property worth having:
this page stops depending on UNI-007 shipping. A curriculum somebody can read, argue with and plan
around is a product surface on its own — and it is the only honest way to show a course that is
being written.

## Scope (v1)

- **The spine, rendered** — the ordered lessons, each with title, minutes, prerequisite and the
  node types it covers (the same chips as UNI-020).
- **Per-lesson state, stated plainly**: *ready*, *in writing*, *needs lesson N first*. ⚠️ **Per
  lesson, never one banner for the page.** A banner saying "coming soon" over a list of eight real
  lessons reads as a dead product; eight rows of which five are ready and three say "in writing"
  reads as a curriculum being built.
- **Other paths** beside the spine — data & backends, custom nodes — as a shorter list.
- **Progress, signed in.** 🔴 **Derived, never stored.** UNI-002's points are computed from
  `points_ledger` and there is no column to write a balance into even if one wanted one; lesson
  completion is already an event in that ledger. A `lessons_completed` column would be a second
  description of a fact that already has one.
- **Signed out, the same page** with no ticks and one line offering to track progress. ⚠️ The
  syllabus itself gates nothing — UNI-009 AC2, and the strongest form of it is that the read path
  takes no viewer at all.

## Where the curriculum comes from

**v1: a checked-in curriculum file in the platform repo**, in the shape UNI-007's lesson manifest
already uses, read at request time. Same posture as `src/lib/challenge-catalogue.json` — the
catalogue is JSON *precisely so that neither the seed nor the module is the thing you edit to add
an entry* (UNI-002 AC4). Adding a lesson to the syllabus must not be a code change.

⚠️ **This task does not define the lesson format.** UNI-007 owns it. If the format moves, this
page's reader moves with it — which is an argument for reading the *same file* the lesson system
reads, and against inventing a syllabus schema here.

🔴 **The property D17 says survives every version: a lesson stays installable from a local
directory with no origin.** Nothing on this page may become a step in that path. The syllabus is a
view of a curriculum; it is never the route through which a lesson arrives.

## Acceptance criteria

1. **The page renders the curriculum from the file, signed out, with no viewer argument on the read
   path.** ⚠️ A read function that cannot see who is asking cannot accidentally start caring —
   `src/lib/content.ts` already states this about replays and tutorials, and it is the same claim
   here.
2. **Every lesson row states one of the three states, and a lesson that is not yet written renders
   as a row rather than as an absence.** 🔴 **Control:** with *every* lesson marked *in writing*,
   the page is still a syllabus — that is the state the site is actually in today, and it must be
   the state the page was designed for rather than its degenerate case.
3. **Signed in, completion ticks are derived from `points_ledger`** and match what `/u/[handle]`
   reports for the same account. 🔴 **Assert the two agree** — two readers of one ledger is exactly
   where a second, quietly different query appears, and *"is it reported?"* cannot see *reported
   twice, differently*.
4. **Adding a lesson to the curriculum file changes the page and touches no `.ts` file.** The
   falsifiable form of "the file is the source of truth".
5. **Presentation:** the *index* archetype with a detail-ish spine (UNI-013 slice 5); no colour
   literal; the three lesson states are a new colour role and 🔴 **need per-theme contrast rows** —
   good/warn/alert tokens have already failed AA in the light theme on this site.

## Not in v1

- **Not the lesson system.** No install, no grading, no step checking — UNI-007.
- **No intake or personalised path.** UNI-007 again; the syllabus is the same for everybody.
- **No enrolment, no certificates, no cohorts.**
- **No GitHub Pages deployment.** D17's v0 *origin* is a deployment question and this task's v1 is a
  page on the platform; the file is positioned so serving it elsewhere is an origin change.

## Dependencies

| Needs | Why |
|---|---|
| **D17** ✅ ruled | curriculum hosting. This task is its v0, not a fork of it |
| **UNI-002** ✅ built | the ledger the progress ticks are derived from |
| **UNI-007** (soft) | the lesson manifest shape. 🔴 Read its format; do not invent one |
| **UNI-013 slice 5** (soft) | the index archetype |

⚠️ **CURRICULUM-DESIGN §11 blocks UNI-007's spine on phase 61**, which is exactly why this task is
worth doing separately: **the syllabus can be published while the lessons behind it are still being
written.**
