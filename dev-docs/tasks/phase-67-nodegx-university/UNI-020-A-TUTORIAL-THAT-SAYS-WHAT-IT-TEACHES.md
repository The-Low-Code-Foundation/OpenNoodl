# UNI-020 — a tutorial that says what it teaches

> 🔴 **THE DESIGN IS AN ARTIFACT, AND THIS FILE IS NOT IT.**
> **["Every page is the same page"](https://claude.ai/code/artifact/5cc390dd-a8dc-48c9-b960-b74ed89010e6)**
> — §06 draws the proposed card in full, including the three-line *"you'll be able to —"* block and
> the node chips. ⚠️ **Open it before writing markup.**

**Surface:** platform · **Tier 1** · **Effort:** M · ✅ **Blocked on nothing** for the shipping cut;
one affordance is blocked and is scoped out below.

# ✅ BUILT 2026-08-18, session 34 — `nodegx-community@767b670`

**The site's one dead-end page is a page.** `/tutorials` was the only list whose rows carried
`href: null`; the row type made that gap cost a written reason so it could not blend in, and the
assertion in `tests/uni013-slice5.test.tsx` that named this page as the site's one exception now
reads `expect(unlinked).toEqual([])`.

## 🔴 THE PREMISE BELOW IS HALF FALSE, AND IT CHANGED WHAT THIS TASK WAS

The Premise section says the cheap half is free because *"the bodies are already written"*. That
is true of the **column** — `articles.body` is `not null` and populated — and false of the
**content**: every row the seed wrote had the body `'Placeholder body.'`. A route rendering that
is a page which says "Placeholder body." to a stranger, **on a phase whose closing bar is *"does
not look like a placeholder"***. Shipping the route alone would have moved the defect rather than
removed it.

✅ **So the prose is part of the task.** Five articles, real bodies, every dimension filled — and
`tests/uni020-tutorials.test.tsx` asserts no seeded body is a placeholder and that each clears a
length floor, with a control proving the comment-stripper it reads through has not simply
returned an empty string. ⚠️ **The first version of that assertion went red against this task's
own comment explaining the history** — a file that MENTIONS a defect in prose is not a file that
has it, which is why the editor repo's source-analysis specs strip comments first.

## What is built, and where

| File | What |
|---|---|
| `src/db/sql/0011_…` | `level`, `category`, `estimated_minutes`, `outcomes text[]`, `project_url`; `article_nodes`, `article_tags` |
| `src/lib/articles.ts` | the vocabularies, `getArticle`, `paragraphsOf`, the level→tone map |
| `src/app/tutorials/[slug]/page.tsx` | 🔴 the **fourth** instance of slice 5's detail archetype — and the first built by a task other than the slice that extracted it |
| `src/lib/lists.ts` | three new dimensions, node chips, outcomes, and **the one line** the composition existed to make cheap |
| `src/components/Kit.tsx` · `src/lib/cards.ts` | `outcomes` on a card, drawn **above** the action |
| `scripts/seed.mjs` | five articles, real prose, every dimension |

## Acceptance criteria — 6/6, and two of them are not what they asked for

| AC | State |
|---|---|
| 1 | ✅ **Renders published, 404s unknown AND unpublished — all three in one assertion.** The unpublished draft lives in the corpus rather than in one test, so it is the control for every count and every filter at once |
| 2 | ✅ **The PAGE narrows, not the function.** Asserted through the rendered markup of the real list, addressed the way a browser addresses it, and **driven over real HTTP** |
| 3 | ✅ Every filter names a row it **does** return, in the same assertion |
| 4 | ✅ Registered. CHECK constraints, **not enum types** — this repo has already been refused an `alter type … add value` used in the same migration, and a vocabulary that will grow is cheaper to widen |
| 5 | ✅ The seed grows — and the premise above is why this AC earned its place |
| 6 | ⚠️ **Presentation: yes, but AC6 asked for three NEW colour roles and got NONE.** `.chip` paints its own `--theme-color-bg-2` ground and the site's three existing tones are all graded against it. Inventing `--site-fg-level-*` would have been three tokens and six ratios to keep right in both themes for a scale the existing tones already read as. **Six rows added to the contrast table naming the surfaces**, per the precedent that file sets for pairings it already covers by value |

## 🔴 THREE FINDINGS THAT OUTLIVE THIS TASK

### A. The free-text census was blind to array-typed columns

`outcomes text[]` reports as `data_type = 'ARRAY'` with the element type in `udt_name`, so
`tests/uni005-data-inventory.test.ts` did not see it — and reported the classification as **stale**
rather than grading it. ✅ Widened, floor **94 → 108**. 🔴 **It had caught nothing before only
because no array column existed anywhere in the schema**: a census that cannot see a whole storage
shape is a census whose silence means nothing, and the day somebody adds `tags text[]` to a table
a pupil can write, that silence would have been the answer.

### B. The drive caught what no spec would have

The level printed **twice** on the detail page — in the meta line and again as a chip two lines
below. Every suite was green. ✅ Fixed by saying it once, in the vocabulary the index filters by.
🔴 This is UNI-019's lesson again and it keeps being true: **a page's markup is outside every gate
this repository has.**

### C. `project_url` ships with its renderer proved and no content

Nothing seeds one, because **there is no hosted starter project to point at** — where artefacts
live is **E7** and is owned by nobody. A link to a file that does not exist is the *"button that
opens nothing"* this whole review is about, so the column stays null and the spec asserts the
button appears when it is set and is absent when it is not. ⚠️ **The one piece of this task's
scope that is built but not shippable content**, and it is blocked on a decision rather than work.

## What this does NOT close

- **The node chips are a filter, not yet a bridge.** UNI-020's own argument is that they compose
  with the Bench's node facets and with an editor asking *"what is written about this node"*.
  Neither is wired; both are cheaper now than they were, because the vocabulary is a table.
- 🔴 **UNI-023 is now cheaper too, and that is the reason to do it next**: its node filter wanted
  a closed vocabulary and this task built one. ⚠️ **Do not draw a second pill style** — `.facet`
  is the one component and seven pages now share it.
- ⚠️ **Still nobody has looked at this page in the LIGHT theme.** Graded by the contrast
  arithmetic only, which is the stronger instrument and not a look.

## Gates — MEASURED 2026-08-18, session 34

| | Before any edit | After |
|---|---|---|
| vitest | **813 passed / 29 files / exit 0** (249s) | ✅ **847 passed / 30 files / exit 0** (298s) |
| `tsc --noEmit` | — | ✅ exit 0 |
| `next build` · `check:css` | — | ✅ exit 0 · exit 0 |

✅ **The floor matched session 33's after-state to the test** — verified rather than believed.
✅ **The delta reconciles per file: +20** (this task's spec), **+12** (six contrast pairings × two
themes), **+2** (two new tables in the drift check). **Nothing existing moved.**

⚠️ **Driven over real HTTP** on a seeded database, `next start` on 3210: all five rows link, the
detail page renders body and outcomes, an unknown slug 404s, and `level`/`category`/`node` each
narrow the real page (5 → 1, 5 → 2, 5 → 2, 5 → 1).

---

## Premise

This page has the clearest job on the site — move somebody from **installed** to **building** — and
the least to do it with. A card has to answer three questions before the click: **is this for me,
what will I be able to do, and how do I start.** It answers none of them, because the only column
it can render is `kind`, and `kind` is the only column that exists.

🔴 **And the bodies are already written.** `articles.body` is `not null` and populated, and there
is **no `/tutorials/[slug]` route anywhere in the app**. Every card on the index is a dead end
pointing at prose that exists. That is the cheapest half of this task and it needs no migration at
all.

⚠️ **This is a content surface, not the lesson system.** UNI-007 owns lessons that open in the
editor and grade a live graph. This task must not grow into it — see *Not in v1*.

## 🔴 The node chips are the load-bearing idea, not decoration

*"This tutorial is about **For Each** and **Static Data**"* is a filter dimension **nobody else's
community can offer**. It is also how people actually get stuck — not by topic, by node — and it
composes in three directions that already exist:

- **the Bench** files questions against node types already (UNI-016's facets are generated columns);
- **the editor** can one day ask *"what is written about this node"* with the node in hand;
- **the search** in UNI-023 gets a dimension that is a closed vocabulary rather than free text.

⚠️ **A tutorial about a custom kit node must be taggable.** UNI-016 recorded the same trap one
surface over: a `node_excerpt` naming a custom kit node **must not be validated** against
`lessonverify`'s built-ins-only catalogue. The chip is a name, not a claim that the node ships with
the product.

## Scope (v1)

**The route, which needs no schema:**

- **`/tutorials/[slug]`** — the *detail* archetype, rendering `articles.body`. Reachable signed
  out, like everything else here.

**The content model, one additive migration:**

- `articles.level` — beginner / intermediate / advanced.
- `articles.estimated_minutes` — an integer, shown as *"18 min"*.
- `articles.category` — data & lists, logic, styling, backend.
- `article_nodes (article_id, node_type)` — the chips, and the strongest filter.
- `article_tags (article_id, tag)` — the softer one.
- `articles.outcomes text[]` — the *"you'll be able to —"* lines. Prose, never filtered on.

**The index:**

- Level, minutes and category as chips on the card; the node chips beneath the summary; three
  outcomes above the actions.
- **Filters**: level, category, node. (The facet bar itself is UNI-023 — this task supplies the
  dimensions and consumes whatever bar exists. ⚠️ If UNI-023 has not landed, ship the three
  filters in the shape UNI-023 specifies rather than inventing a fourth pill style.)

**The actions, in the order they can actually be built:**

1. **Read it** — the route above. Ships in this task.
2. **Download project** — a starter project as a file. Ships in this task **if** the article has
   one; the column is nullable and a tutorial without a project shows no button.
3. ~~**Open in editor**~~ — 🔴 **scoped out, deliberately.** It needs the launcher's Learning
   section (D5) and UNI-007's install path. **Do not stub it.** A button that opens nothing is the
   defect this whole review is about.

## Acceptance criteria

1. **`/tutorials/[slug]` renders the body of every published article, signed out**, and 404s for an
   unpublished or unknown slug. ⚠️ Assert the 404 arm **beside a known-good slug in the same test**
   — a route that 404s for everybody passes a 404 assertion identically when it is broken.
2. **Every dimension added is filterable and the filter is wired to the page.** 🔴 *Build the
   caller*: a `listArticles({level, category, node})` whose only caller is its own test file is not
   built, and this phase has recorded that failure **eleven times**. The assertion is that the
   **page** narrows, not that the function can.
3. **Each filter carries a positive arm.** 🔴 A filter that returns zero rows and a broken query
   that returns zero rows are indistinguishable; every filter assertion needs a row it **does**
   return, in the same test.
4. **The migration is registered.** 🔴 A new file in `src/db/sql/` that is not added to
   `MIGRATIONS` in `src/db/migrate.ts` fails `tests/db-schema-drift.test.ts` — which is the guard
   working, and is the fastest way to lose an afternoon if it is met with confusion. ⚠️ **If
   `level` becomes a Postgres enum, create the type and use it in the same migration is fine —
   `alter type … add value` and then using that value in the same migration is REFUSED**, and this
   repo has hit that already.
5. **The seed grows with the schema.** A column nothing seeds is a column nobody can look at, and
   this task's whole complaint is about pages nobody could look at.
6. **Presentation:** the index is an instance of the *list* archetype and the detail page of the
   *detail* archetype (UNI-013 slice 5). No colour literal; 🔴 the three level chips are a new
   colour role and **need per-theme contrast rows** — the obvious tokens for good/warn/alert have
   already failed AA in the light theme once, which is why `--site-fg-alert` and `--site-fg-good`
   are split by theme today.

## Not in v1

- **Not the lesson system.** No grading, no steps, no live graph — UNI-007.
- **No "Open in editor".** See above; it is scoped out rather than deferred vaguely.
- **No authoring UI.** Articles are seeded and inserted by hand, as they are today.
- **No global search.** Per-list search is UNI-023; one box across all surfaces stays deferred,
  where UNI-009 put it.
- **No blob storage.** No cover images — the card's figure is the node chips, which need no asset.

## Dependencies

| Needs | Why |
|---|---|
| nothing | for the route, the schema and the index |
| **UNI-023** (soft) | the facet bar. Either order works; what must not happen is two filter components |
| **UNI-013 slice 5** (soft) | the list and detail archetypes |
| **UNI-007 + D5** | 🔴 only for *Open in editor*, which is explicitly **not** in this task |
