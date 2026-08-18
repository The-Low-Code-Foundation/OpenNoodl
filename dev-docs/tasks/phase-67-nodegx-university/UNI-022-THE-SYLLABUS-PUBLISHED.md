# UNI-022 — the syllabus, published

> 🔴 **THE DESIGN IS AN ARTIFACT, AND THIS FILE IS NOT IT.**
> **["Every page is the same page"](https://claude.ai/code/artifact/5cc390dd-a8dc-48c9-b960-b74ed89010e6)**
> — §08 draws the spine with its step column, the in-progress lesson and the progress panel.
> ⚠️ **Open it before writing markup.**

**Surface:** platform · **Tier 2** · **Effort:** M · ✅ **D17 is already ruled** — this task honours
it, it does not wait on it.

# ✅ BUILT 2026-08-18, session 36

**University is the curriculum now.** `src/lib/curriculum.json` holds fifteen lessons in three
paths — the twelve-lesson spine from `CURRICULUM-DESIGN.md` §5 plus *data & backends* and *custom
nodes* — and `/university` renders it as a spine with a step column, per-lesson state and node
chips. Every lesson says **in writing**, which is the state the site is actually in, and the page
is still a syllabus.

## 🔴 A PREMISE OF THIS TASK IS HALF FALSE, AND IT IS THE HALF THE DESIGN DRAWS

The scope says *"lesson completion is already an event in `points_ledger`"*. **It is — and the
ledger records that A lesson was finished without recording WHICH.** A row carries `challenge_id`,
`family`, `tier`, `delta` and a free-text `reason` that defaults to the challenge's own title
(*"A lesson finished"*). There is no lesson identity anywhere in it.

So:

- ✅ **The count is derivable**, and it is exactly the design's own progress panel (*"2 of 8"*).
- 🔴 **The per-lesson ticks §08 draws are NOT.** Drawing them would mean matching prose in
  `reason` — a guess wearing a tick's clothes, right on the seed and wrong the first time a
  challenge title was reworded, with nothing to notice.

⚠️ **The fix is not a `lessons_completed` column** — that is the second description of a fact the
ledger already half-has, which this task rules out in as many words. It is **a lesson identity on
the event**, and it belongs to whoever builds the bridge that reports one. 🔴 **Nothing currently
calls `recordEvent` with `lesson.completed` at all** — the only rows that exist are seeded — so
this is a gap in *front* of the syllabus rather than behind it.

**The absence is asserted**, so a later session cannot quietly add ticks it cannot justify, and the
page says the honest sentence out loud: *"counted from your points ledger, which records that a
lesson was finished rather than which one."*

## What each criterion cost

| AC | Result |
|---|---|
| 1 · from the file, no viewer | ✅ `syllabus.length === 0` — the read function takes nothing, so there is no signed-out branch to get wrong |
| 2 · per-lesson state, never a banner | ✅ and **the control is the live arm**: every lesson is *in writing* today and the page is still ordered, titled, timed and specific. The blocked state is DERIVED from `needs`, so a lesson cannot be ready while its prerequisite is not |
| 3 · derived progress, agreeing with the profile | ✅ and it counts a lesson **once** although two challenges listen to the event — counting rows would report two lessons for one. A revocation removes it from **both** readers |
| 4 · the file is the source of truth | ✅ a sweep asserting no `.ts`/`.tsx` under `src/` names any lesson slug or title |
| 5 · presentation | ✅ no new colour role; six new contrast rows in both themes |

## 🔴 Two instrument failures worth carrying forward

**1 · A prose sweep cannot tell a prohibition from an offer.** D17's check looked for the word
*"download"* and found it — first in the page's own header comment saying there is none, then in
the visible sentence *"nothing here is a download"*. **Twice.** The natural reaction to that
failure is to delete the sentence, which is the test editing the product. A route is a **link**, so
the assertion sweeps `linksInPage` and the curriculum file's own **field names** instead.

**2 · A short-word sweep across a whole repo reports coincidence as duplication.** AC4's first
draft swept `tests/` too and found `uni006` naming *"capstone"* about an assignment and `uni021`
naming *"the node you write yourself"* about a **meetup replay**. Two files talking about their own
subjects. The criterion is about the product, so the sweep is `src/` only — **and the bound is
stated in the test**, because a bounded query reports its bound.

**What the drive confirmed for this task:** fifteen rows, all `data-state="in-writing"`, each with
its minutes, what it teaches, a blurb and its node chips — and the page reads as a curriculum being
built rather than as a page that forgot to load, which was AC2's whole claim. 🔴 **It also found
the `⚠️` in the closing copy** (below).


## ✅ DRIVEN OVER REAL HTTP, IN BOTH THEMES — and the drive found the one thing no gate could

`next build` + `npm start` on the seeded database, every page read back as **markup** and shot as a
**picture** in light and dark.

🔴 **THE FINDING: the house `⚠️` marker leaked into USER-FACING COPY.** `/university`'s closing
line read *"Every lesson above is being written. ⚠️ Nothing here is a download…"* — the marker is
the convention for a caution in a task file and a code comment, and it rendered as a literal
warning emoji mid-sentence on a public page. **Every suite was green, `check:css` was clean and
`tsc` was clean.** A page's copy is outside every gate this repository has; the browser look is the
only instrument that has ever caught this class, and this is its third catch in four sessions
(UNI-020's doubled level, UNI-013's unstyled-page trap, this).

⚠️ **AND THE THEME INSTRUMENT LIED THREE TIMES BEFORE IT WORKED**, which is worth more than the
screenshots:

| attempt | what it did | why it was wrong |
|---|---|---|
| `--blink-settings=preferredColorScheme=1` | `--dump-dom` reported `data-theme="light"` | the **screenshot from the same flag came back dark**, so one of the two readings was false and neither said which |
| hard-code `data-theme="light"` into a saved copy | page still dark | **the stamp script runs on load and overwrites it** — the test measured the stamp, not the CSS |
| delete the stamp from the saved copy | *"Application error: a client-side exception"* | React hydration replaced `<html>` and the page died — a third thing entirely |

✅ **What worked: CDP, seeding `localStorage['nodegx-theme']` before the document runs** — which is
exactly what a returning visitor has — **and reading the computed ground back out of the live page
in the same call as the screenshot**, so the image and the theme it claims are one measurement
rather than two. Light reports `data-theme=light` + `rgb(238,241,245)`; dark reports
`data-theme=dark` + `rgb(11,14,18)`. 🔴 **The light theme was fine all along** — the first three
instruments were the defect, and any one of them alone would have been written up as a bug.

---

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
