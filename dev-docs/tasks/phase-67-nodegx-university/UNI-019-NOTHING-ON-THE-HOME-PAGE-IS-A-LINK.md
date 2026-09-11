# UNI-019 — nothing on the home page is a link

> 🔴 **THE DESIGN IS AN ARTIFACT, AND THIS FILE IS NOT IT.**
> **["Every page is the same page"](https://claude.ai/code/artifact/5cc390dd-a8dc-48c9-b960-b74ed89010e6)**
> — the review this task and UNI-020…023 were scoped from, with a **rendered specimen of the
> proposed home** in full CSS. ⚠️ **Open it before writing markup.**
>
> ⚠️ **UNI-013's recorded failure applies to every task in this group.** Session 24 built slices 2–3
> *from the prose of a task file* and never opened the artifact it was scoped from; Richard's
> reaction was *"I don't see the visual changes from the artifact"*, and the prose genuinely did not
> carry four of the five things the design named. **Prose is a summary of a design, never the
> design.**

**Surface:** platform · **Tier 1** · **Effort:** S/M · ✅ **Blocked on nothing** — no ruling, no
purchase, no schema.

> 🔴 **This task is on the phase-67 close list already.** It is **E3** — *"UNI-009 AC1: the home
> shows real threads signed out"* — which has been open since session 28 with no task owning it.
> Scoping it here is not adding to the close; it is giving an existing close item an owner.

## Premise

The home page is a menu of six things, and **not one entry is a link.** All six are plain
`<section class="card">` with no anchor anywhere inside them (`src/app/page.tsx` — six sections,
zero anchors). Two of the six name surfaces with no public route at all: *Forum* (the real thing is
`/bench`) and *Prefab shelf* (which exists only inside an org, at
`/orgs/[slug]/shelf/[itemId]`).

🔴 **And the Bench — the one surface on this site with life in it — is unreachable by clicking.**
It was built by UNI-015/016, it has threads, an unanswered queue and posts that render graph
attachments. It is not in the nav, and **the only internal link to `/bench` in the entire
application is the Bench's own "All" filter pill.** A visitor cannot get there from anywhere.

⚠️ **None of this is a signed-out artifact**, which is the first thing anyone will assume. The
cards are `<section>` for a signed-in viewer too; there is no session branch on this path to get
wrong.

## Scope (v1)

- **Every card on the home page is a link, or it is deleted.** The *Prefab shelf* card names
  something with no public route — either it acquires one or the card goes. **A card that lies is
  worse than a missing card**, because the missing card costs a visitor nothing.
- **The Bench enters the nav**, beside Tutorials and Replays.
- **The home becomes an instance of UNI-013's *index* archetype** — mixed rails of live content,
  each with its own shape, rather than one grid of identical rectangles:
  - **the Bench rail** — the newest threads, with the unanswered ones marked (this is AC1);
  - **the next call** and **the newest replay** (standing sources that cannot run dry);
  - **start here** — one tutorial, the beginner one;
  - **newest from the community** — a person who joined, an open brief.
- **A real empty state per rail**, as a component rather than as prose typed twice. Half of these
  rails will be thin for months.

## The obligation this discharges, and it is not the threshold

🔴 **D16's composition obligation is currently discharged nowhere**, and D16 says out loud that the
threshold does not discharge it: *"the mirror's home must be structurally incapable of looking
empty — events, replays, release notes and the prefab shelf all exist whether or not anyone posted
this week. The threshold protects the launch; the composition protects every quiet week after it."*
Session 28 measured `/replays` and `/tutorials` at **~90% empty viewport under one dashed box**.
A rail whose source is *"a call happens every week"* cannot empty; a rail whose source is *"somebody
posted"* can. **Compose from the first kind and decorate with the second.**

## Acceptance criteria

1. **Every card region on the rendered home contains an anchor, and every `href` resolves to a
   route that exists on disk.** 🔴 Derive the route list by **reading `src/app` from the
   filesystem**, never by writing one down — the UNI-011 sweep pattern, for the reason it was built:
   a hand-kept list agrees with itself while disagreeing with the app. ⚠️ **Carry a known-firing
   control**: a fixture card pointing at `/shelf` (no such route) must turn it red, or the sweep is
   asserting an absence with no proof it can fire.
2. **UNI-009 AC1 — signed out, the home shows real threads.** Rendered with the seed's threads
   present, their titles appear; and 🔴 **with `bench_threads` empty the page still renders every
   rail and its empty state** — the D16 arm. ⚠️ These are two arms of one criterion and both must
   be asserted: *"shows threads"* alone passes on a page that collapses to nothing when the table
   is empty, which is precisely the failure D16 exists to prevent.
3. **Reachability, computed:** every public page under `src/app` is reachable from the home or the
   nav in **one click**, with a **per-route verdict and a reason**, so a page added later fails this
   test until somebody gives it one. ⚠️ The verdict list is the deliverable — `/bench` being
   reachable is one row of it, not the point of it.
4. **It is an instance of the index archetype** (UNI-013 slice 5), not a bespoke page. No colour
   literal; 🔴 **any new colour role carries a per-theme row in `tests/uni013-contrast.test.ts`** —
   a mockup is not a contrast measurement, and this repo has now shipped that defect five times.
5. **Control: the existing suites pass unchanged.** No schema moves and no lib signature changes,
   so a moving suite is a defect in this task rather than a consequence of it.

## Not in v1

- **No schema.** Every rail reads a table that already exists.
- **No search and no sort** — that is UNI-023.
- **No public prefab shelf.** If the card cannot point somewhere real, it goes; building the shelf
  is UNI-005's surface and a task of its own.
- **Not the editor's mirror.** D16's threshold governs when the editor opens this at all.

## Dependencies

| Needs | Why |
|---|---|
| nothing | 🔴 blocked on no ruling and no purchase |
| **UNI-013 slice 5** (soft) | the index archetype. ⚠️ If slice 5 has not landed, this task **draws** the archetype and slice 5 adopts it — what must not happen is a ninth bespoke page |
| **UNI-015** ✅ built | the threads the rail reads |

## How it gets driven, and the trap that eats the drive

✅ **Seed the content first, then look.** An empty page looks sad for a reason that is not design,
and reviewing one produces a list of fixes that change nothing (UNI-013 slice 5's own method note).

🔴 **Check the served CSS hash against `ls .next/static/css/` before believing any screenshot.** A
stale `next start` serves a stylesheet hash that no longer exists — the page renders **unstyled**,
every gate stays green, and an unstyled page is exactly what a *"looks sad"* review misreads. This
has bitten this repo already; `npm run check:css` exists for it.

---

# ✅ BUILT — 2026-08-18 (session 31) · `nodegx-community@636d488`

**All five acceptance criteria met.** The premise held exactly as written: `src/app/page.tsx` was
six `<section class="card">` with zero anchors, for signed-in readers too.

## What shipped

| Piece | Where |
|---|---|
| The composition, as a **value** | `src/lib/home.ts` — `homeRails(sql, {asOf})`, four rails, `HomeCard.href` **required** |
| The kit + the page | `src/components/Home.tsx` — `CardView`, `EmptyState`, `Chip`, `Figure`, `Rail`, `Home` |
| The page | `src/app/page.tsx`, now three lines of glue |
| **`/bench` in the nav** | `src/app/layout.tsx`, first item |
| The sweep | `tests/uni019-home.test.tsx` — **20 specs** |
| Contrast rows | `tests/uni013-contrast.test.ts` — 4 new pairs × 2 themes |
| Bench threads in the seed | `scripts/seed.mjs` — 3 threads, one accepted, node attachments |

🔴 **The queue clock moved out of `bench/page.tsx` into `lib/bench.ts`** (`threadClock`). The home
needed the same three states, and two escalation ladders is the site disagreeing with itself about
who has been left waiting — D16's one software-movable component.

## AC by AC

1. ✅ **Every card region contains an anchor; every href resolves.** Both halves asserted: each card
   rendered through the real `CardView` must emit its own href, **and** the page's card count must
   equal the composition's (cardinality, because "is it rendered?" cannot see a card drawn twice).
   Route list read off disk. ⚠️ Control: `/shelf` — the deleted *Prefab shelf* card's destination —
   must come back unresolved, and does.
2. ✅ **UNI-009 AC1, both arms.** Seeded threads' titles appear signed out; and with `bench_threads`
   empty every rail still renders with its empty state. There is **no viewer argument anywhere on
   this path**, which is the strongest form of "signed out works".
3. ✅ **Reachability, computed, 17 pages, no UNREACHABLE.** Verdict + reason per route.
4. ✅ **Instance of the index archetype**, no colour literal, `check:css` clean.
5. ✅ **Control: 773 specs / 27 files, from a measured floor of 745 / 26.** +20 new, +8 contrast
   rows, **nothing existing moved**.

## 🔴 TWO DEFECTS THE INSTRUMENT FOUND THAT WERE NOT IN THIS TASK'S SCOPE

1. **`/orgs/[slug]/assignments` was reachable from nowhere in the whole application.** UNI-006 built
   assign, grade and review; the only way in was typing the URL. **This is the Bench's defect, one
   surface over, and nobody had noticed it either.** Fixed with one anchor on the org page.
   ⚠️ **This is what AC3 is for** — not `/bench`, which was already known.
2. **The first `reachability()` inferred a detail page's index from its PATH PREFIX and was wrong.**
   `/u/[handle]`'s index is `/people` — not its parent directory, and never will be. It now derives
   the link graph from page **source** (templated hrefs included, so reachability is a property of
   the app rather than of today's rows). Recorded because the path-prefix version *passed* on
   sixteen of seventeen routes, which is exactly how a plausible instrument survives.

## Driven, over real HTTP, on the seeded database

`next build` → `next start` → curl. **8 card regions, 23 anchors, all four rails, every internal
href 200.** The one non-200 is `/api/auth/github/start` → **503**, which is **E10** and Richard's.
Stylesheet served 200 / 40,475 bytes — the stale-CSS trap checked, not assumed.

⚠️ **The light theme was NOT visually captured.** `--force-prefers-color-scheme=light` does not move
the `matchMedia` read in the theme stamp, so both screenshots are dark. Light is graded by the
contrast arithmetic in `uni013-contrast.test.ts`, which is the stronger instrument — but nobody has
*looked* at this page in light, and that is a gap, not a pass.

## What this deliberately did NOT do

- **No `/tutorials/[slug]`.** It is **UNI-020's**, by name. The *Start here* card therefore points
  at `/tutorials` — honest, and one href for UNI-020 to re-point.
- **No facet bar.** **UNI-023's**; five pages wait on it and the home has nothing to filter.
- **No events table.** The call date is *projected* from the cadence of the calls that happened and
  is labelled **"next expected"**. 🔴 There is no schema that knows a future date, and printing one
  as fact would be the page asserting something the database does not know.
- **No public prefab shelf.** The card is deleted, per this task's own rule.
