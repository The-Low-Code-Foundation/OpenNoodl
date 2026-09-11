# FB-009 — the syllabus you cannot start

**Filed:** 2026-08-22, from Richard's item 9. **Status: ⬜ open (mechanism) + 🧭 Richard
(content).** Size: M/L. Revises nothing — it builds **D17's own v0**, owed since 2026-07-25.

> *"The university lessons on the community web page look cool, how do I start the lessons?
> Right now you can't click them at all."*

---

## What exists (swept 2026-08-22) — the unclickability is three different things

1. **Deliberate:** D17 rules the University page is *a view of a curriculum and never the route
   a lesson arrives through* — `src/app/university/page.tsx` says so in its header: no install
   link, no bundle URL, no download. That part is working as ruled and stays.
2. **Owed:** D17's other half — *"curriculum hosting: part of the platform API under D14, GitHub
   Pages as v0"* — was ruled 2026-08-16 and **nothing serves a curriculum index**
   (`RULINGS.md:897`). UNI-007 §11 has owed it since 2026-07-25.
3. **The wall:** **all 15 lessons in `curriculum.json` are `state: 'in-writing'`** — there is
   nothing to start. The prose is Richard's (67b's handover lists it under *Needs Richard*).
   Every path is honest about it (the `truth` sentence), but the page's entries are dead ends.

Meanwhile the route that *does* work end-to-end is the tutorial one: `/tutorials/[slug]` +
`GET /api/v1/community/tutorials/[slug]/bundle` (TUT-004, 7/8, needs its drive).

## Scope

1. **Serve the curriculum** (D17 v0): the platform (or Pages, per the ruling) serves the index +
   `ready` lesson bundles through the same seam TUT-004 installs from. A lesson must stay
   installable from a local directory with no origin — D17's own red line.
2. **Make ready entries startable, in-writing entries honest**: a `ready` lesson's syllabus row
   links to its tutorial page (web: download; that page already owns install UX per R2 =
   `curated`). An `in-writing` row says so — a label, not a dead click target. This threads the
   needle on D17: the syllabus still isn't the arrival route; it links to the page that is.
3. **Content**: which lessons move `in-writing → ready` is Richard + the MCP lesson-authoring
   surface (see FB-012). This task ships with however many are ready, even zero — with zero,
   the AC is that no row *looks* clickable.

## Acceptance criteria

- AC1: a `ready` lesson is reachable from `/university` to an installed, opening lesson in ≤3
  clicks (syllabus → tutorial page → install), driven for real.
- AC2: an `in-writing` row is visibly inert and says why; no cursor-pointer lies.
- AC3: the curriculum index is served (not bundled into the page) and the editor's path client
  reads the same source — one curriculum, no second copy to drift.
- AC4: a lesson still installs from a local directory with no origin (D17's red line, asserted).
- AC5: UNI-022's syllabus specs updated where they asserted link-absence — the AC being revised
  is named in the diff.
