# ✅ THE WHOLE TRANCHE LANDED — 2026-08-18, session 36

**UNI-023, UNI-021, UNI-022 and the twelve badges are all built.** This file is kept because its
*reasoning* is what the session followed, and because three of its predictions were right in ways
worth reading back:

- **The order was right, and UNI-023's deferred row paid off inside one session.** UNI-023 shipped
  `/replays` with search and sort and **no topic legend**, with the deferral written down as an
  assertion — which turned red the moment UNI-021 landed `replay_topics`, in the same session.
- **§4's recommendation held.** The badges are SVG, generated from four family marks and one tier
  rule, and the *"halves the work"* insight was correct: the artwork only had to carry family.
  📐 [The Twelve Marks](https://claude.ai/code/artifact/359b212c-b97d-4ee0-9b46-655a29d3a604) —
  ⚠️ **three questions for Richard at the end of it.**
- **§5's warning was the right one.** Every page was read back over real HTTP in **both** themes,
  and the light theme had never been looked at in five sessions.

🔴 **One thing this file got wrong, and it is UNI-022's:** the scope said progress is derived from
`points_ledger` because *"lesson completion is already an event"* there. It is — and **the ledger
records that A lesson was finished, not WHICH**. The count is derivable and the design's per-lesson
ticks are not. See UNI-022's own file.

---

# The visual tranche — UNI-023, UNI-021, UNI-022 and the badges

**Written 2026-08-18 (session 35), for pasting into a fresh session.** These four are what is left
of *"simple and sad"*. None of them is in the phase's closing bar — the close is E10, a Brevo
domain, an `openssl` command and a deploy run, and it is **not** blocked by any of this.

🔴 **The badge artworks moved from Richard's column to ours on 2026-08-18.** He is not drawing
them. The recommendation and the reasoning are in §4 — read it before opening an image generator,
because the answer is *not* a generated image and the reason is structural.

---

# Paste this

> Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`. **This is the
> visual tranche: UNI-023, then UNI-021, then UNI-022, plus UNI-013 slice 4 (the twelve badges,
> which are OURS now — Richard is not drawing them).** Read
> `PROMPT-THE-VISUAL-TRANCHE.md` first — it carries the order, the reason for the order, and the
> traps each one will hit. Then read each task file before starting it.
>
> 🔴 **Platform work is `/Users/richardosborne/vscode_projects/nodegx-community`** — a sibling
> directory, never nested. None of the OpenNoodl checkout's gates, peers or traps apply there.
>
> **Before any code: take your own floor.** `npm test` in the platform repo, and quote the count.
> Session 35 measured **32 files / 873 tests / 0 failures, exit 0** — but a number quoted from a
> handover is a number measured under somebody else's load. ⚠️ **The suite drops and rebuilds
> `public`, so it WIPES the dev database.** Order is `npm test` → `npm run db:seed` → `npm start`,
> and a server left running across the wipe holds a pool against a dropped schema and must be
> restarted.
>
> **Finish with a real browser look at every page you touched, in BOTH themes.** See §5 — this is
> the part that has been skipped five sessions running and it is the only instrument that has ever
> caught anything on these pages.

---

# 1. The order, and why it is this order

```
UNI-023 (the bar)  ──►  UNI-021 (replays)  ──►  UNI-022 (syllabus)
   builds .facet         plugs ONE facet          independent of both
   once, for 5 lists     into the finished bar
```

**UNI-023 first.** It builds the facet bar **once** and applies it to six lists. Its own task file
is emphatic: *"Do not draw a second pill style"* — `.facet` is one component and seven pages
already share it. If UNI-021 goes first it will need filters before the bar exists, will grow its
own, and UNI-023 will then be rework rather than a build.

🔴 **One consequence to state out loud rather than discover:** UNI-023's scope table lists
`/replays | topic (UNI-021)`, and **`replay_topics` does not exist yet**. So UNI-023 ships the
replays row with **search and sort only**, and the topic facet arrives with UNI-021. ⚠️ **Write
that down in UNI-023's task file as a deferred row**, do not leave it as a silently missing facet —
a scope table with one unmarked hole in it is how the hole survives three sessions.

**UNI-022 last, and it is independent.** It touches no facet bar and no shared component. It can be
done at any point, including by a different session in parallel, and it is the one whose value does
not depend on the other two.

**The badges are independent of all three.** Do them when a change of gear helps.

---

# 2. 🔴 The design artifact — open it before writing markup

All three task files open with the same instruction and it is not decoration:

> **["Every page is the same page"](https://claude.ai/code/artifact/5cc390dd-a8dc-48c9-b960-b74ed89010e6)**

| Section | What it draws | For |
|---|---|---|
| **§04** | the facet bar with counts | UNI-023 |
| **§07** | the poster grid, the duration badge, the chapter list | UNI-021 |
| **§08** | the spine, the step column, the progress panel | UNI-022 |
| **§09** | the bar serving People and the Work board unchanged | UNI-023 |

⚠️ **The task file is not the design.** Each of the three says so in its own first line.

---

# 3. What will bite, per task

## UNI-023 — one facet bar, six lists

🔴 **The two assertions this task lives or dies on are already written in its file, and the first
one is the one that will actually be got wrong:**

**A facet count must equal what the filter returns.** The count comes from a `group by` and the
list comes from a `where` — **two producers of one number, which is exactly where they drift**, and
no *"does it render?"* test can see it. **Assert the cardinality**: for every facet, the number
shown equals the number of rows that facet yields. ⚠️ This repo has been bitten by the two-producer
shape before; a check that can only ask *"is this reported?"* cannot see *"reported twice"*.

**Search must not be a client island.** 🔴 The site has **exactly one** `"use client"` component in
it (`ApproveForm.tsx`), every page is server-rendered, and the site's one promise is that reading
never asks for anything. A search box is a `<form method="get">`. Making a public page require JS to
read would be the single most damaging thing in this tranche.

**Two empty states, not one.** *"No rows matched these filters"* — naming the filters and offering a
way to clear them — is a **different** state from *"nothing has been posted yet"*. Collapsing them
is how a working filter reads as a broken page.

**The migration is the smaller half:** `profiles.rate_band` (a **band**, not a number) and
`profile_skills`. ⚠️ **A blank rate band must not hide anybody.** D8's listing bar is the only thing
that governs who appears, and a rate filter that silently excludes everyone who left it blank is a
second, accidental bar.

## UNI-021 — replays you can actually watch

🔴 **AC2 is an absence, so it needs a known-firing control.** *"No request leaves for a video host on
page load"* is asserted over the rendered HTML — no `iframe`, `script` or third-party `img` src.
**Carry a fixture that DOES embed on load and require it to turn the assertion red.** An absence
asserted with a broken instrument measures nothing, and this repo has recorded that failure
repeatedly.

**The poster is generated locally** — dot grid and a gradient, no asset, **no provider thumbnail
fetch**. ⚠️ That is the trap the task names: *"a thumbnail URL looks like an image and behaves like
a tracker"*, and fetching one silently undoes AC2.

**Both arms in one test.** A recognised provider embeds after one activation; an **unrecognised
host** renders a link with `target="_blank" rel="noopener noreferrer"`. 🔴 The second arm is the one
that will rot — it is the branch nobody looks at, **and it is the one the current seed hits**.

**AC4 is the row the seed keeps producing:** no chapters, no speakers, no duration. A poster grid
breaks on that row first.

**Register the migration in `MIGRATIONS`** (`src/db/migrate.ts`) — `tests/db-schema-drift.test.ts`
asserts that list equals the sorted contents of `sql/`, so an unregistered migration is a red test
rather than a silent absence. ⚠️ **New since session 35:** there is now a `schema_migrations` ledger
and `migrateToLatest`. Adding a migration is unchanged; just do not reach for `applySchema` or
`resetSchema` outside the suite.

## UNI-022 — the syllabus, published

**Per-lesson state, never one banner.** ⚠️ The task is explicit and the reasoning is good: a
"coming soon" banner over eight real lessons reads as a dead product; eight rows of which five are
ready and three say *"in writing"* reads as a curriculum being built.

🔴 **Progress is DERIVED, never stored.** Lesson completion is already an event in `points_ledger`.
A `lessons_completed` column would be a second description of a fact that already has one.

**The curriculum is a checked-in file, not a code change** — same posture as
`src/lib/challenge-catalogue.json`. ⚠️ **Do not invent a syllabus schema**: UNI-007 owns the lesson
format, so read the *same file* the lesson system reads.

🔴 **D17's invariant:** a lesson stays installable from a local directory with no origin. **Nothing
on this page may become a step in that path.** The syllabus is a view of a curriculum; it is never
the route a lesson arrives through.

**Signed out, the same page** with no ticks and one line offering to track progress. The read path
takes no viewer at all.

---

# 4. 🔴 The badges — SVG, and not a generated image

**Richard asked whether to draw SVGs or use an image generator (Nano Banana or similar). The answer
is SVG, and it is not close.** Not a stylistic preference — five structural reasons:

1. **D4 already ruled it:** *"flat SVG in the editor's icon idiom"*. Migration 0002's own comment
   says the same on the `artwork` column.
2. **They render small.** These sit in a row on a profile at roughly 24–40px. Generated raster art
   at that size is mush; flat vector is the form that was designed for it.
3. 🔴 **Twelve marks must read as ONE SYSTEM.** A diffusion model produces twelve unrelated
   pictures. The family relationship (learning / building / contributing / community) and the tier
   progression (bronze → silver → gold) have to be **structural** — and structure is precisely what
   a vector source gives you and a generated image does not.
4. **Theme.** The site runs light and dark. An SVG can take `currentColor` and the tier token; a
   generated PNG bakes its background in and one of the two themes always looks wrong.
5. **E7.** An SVG in `public/badges/` needs no object storage, no CDN and no hosting decision. A
   raster set is the one thing in this tranche that would touch a decision that is not made yet.

## 🔴 The design insight that halves the work

**UNI-013 already moved the tier onto the badge's top edge.** Read the comment in
`src/app/u/[handle]/page.tsx`: the tier used to be a coloured disc, the disc *"spent the whole
component's visual budget standing in for artwork that does not exist"*, and it was deleted.

**So the artwork only has to carry FAMILY.** Tier is already expressed, twice — by the edge and by
the badge's own title (*"Answered"* / *"Ten answers"* / *"Fifty answers"*).

That makes this **four motifs and one tier rule**, not twelve drawings:

- **learning** · **building** · **contributing** · **community** — four marks in the editor's icon
  idiom.
- Tier is a **progression of the same mark** — e.g. one, two or three elements filled — so bronze,
  silver and gold are visibly the same badge earned three times, which is what the taxonomy
  actually means.

⚠️ **But there are still twelve files, because migration 0002 seeds twelve paths**
(`badges/learning-bronze.svg` … `badges/community-gold.svg`) as part of a table whose primary key
**is** the cross-product. Do not change that schema to save eight files.

✅ **Generate the twelve from the four.** A small script writing `public/badges/*.svg` from four
path definitions and one tier rule means the twelve cannot drift from each other, and *"the badge
set is consistent"* becomes true by construction rather than by twelve careful edits. That is the
same argument migration 0002 makes for seeding the taxonomy in the schema.

**What to check first:** `public/badges/` **does not exist**, and nothing currently renders
`b.artwork` — the profile deliberately renders no image at all rather than a broken one. So there
is a rendering change here too, and it needs the *no artwork yet* branch to keep working while the
files land.

**Where the idiom comes from:** the editor's own icon set in the OpenNoodl checkout. Match stroke
weight and corner treatment to it — the badges appearing on a profile beside NodeGX-styled chips is
most of what makes them look like they belong.

⚠️ **Show Richard the four family marks before generating all twelve.** Four drawings is a cheap
thing to redo; twelve files plus a rendering change is not.

---

# 5. 🔴 Finish in a browser, in BOTH themes — this is not optional

**Nobody has looked at any page in the LIGHT theme in five sessions.** It has been graded by
contrast arithmetic alone, and this phase has already found palette **pairings** failing AA six
times — where the trigger was a new *pairing*, not a new colour role. Every one of these four tasks
creates new pairings: facet pills in an active state, a duration badge over a generated poster, a
lesson-state label, and twelve badge marks on a profile.

```
localStorage['nodegx-theme'] = 'light'   // then reload
```

**And curl the pages you built.** UNI-020's level printed **twice** on the new tutorial page — in
the meta line and again as a chip two lines below — **with every suite green**. 🔴 *A page's markup
is outside every gate this repository has.* Read the rendered HTML.

Local server: `npm start` (session 35 had one on `:3210`). All seven pages currently render real
seeded content.

---

# 6. What to update when each lands

- **`TASKS.md`** — the table.
- **`README.md` §"Explicitly NOT in the close"** — as each of the three lands, it stops being a
  deferred item. ⚠️ **The close list stays at ten items**; none of these joins it.
- **The badges** — 🔴 UNI-013 slice 4 is recorded in three places as *"Richard's, and not code"*
  (`README.md`, `NEXT-SESSION-PROMPT.md`, `phase-67b`'s table). **All three are now wrong.** Fix
  them when the badges land, or the next session will read that they are still his.
