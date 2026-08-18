# UNI-020 — a tutorial that says what it teaches

> 🔴 **THE DESIGN IS AN ARTIFACT, AND THIS FILE IS NOT IT.**
> **["Every page is the same page"](https://claude.ai/code/artifact/5cc390dd-a8dc-48c9-b960-b74ed89010e6)**
> — §06 draws the proposed card in full, including the three-line *"you'll be able to —"* block and
> the node chips. ⚠️ **Open it before writing markup.**

**Surface:** platform · **Tier 1** · **Effort:** M · ✅ **Blocked on nothing** for the shipping cut;
one affordance is blocked and is scoped out below.

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
