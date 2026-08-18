# UNI-023 — one facet bar, six lists

> 🔴 **THE DESIGN IS AN ARTIFACT, AND THIS FILE IS NOT IT.**
> **["Every page is the same page"](https://claude.ai/code/artifact/5cc390dd-a8dc-48c9-b960-b74ed89010e6)**
> — §04 draws the bar with counts and §09 shows it serving People and the Work board unchanged.
> ⚠️ **Open it before writing markup.**

**Surface:** platform · **Tier 1** · **Effort:** M · ✅ **Blocked on nothing.**

## Premise

Six lists, and between them **one filter dimension each and no search anywhere**. People filters on
a single query param with three link pills; Work filters open/closed; the Bench filters by section;
Tutorials and Replays filter on nothing at all.

🔴 **The page with real numbers is the one with no controls.** `coaching_offers` stores
`price_cents`, `duration_minutes` and `currency` per offer — and `/coaching` sorts by price and
offers the visitor no say in anything. The data for a rate filter has been sitting there since
UNI-004.

⚠️ **And the rate filter Richard asked for does not exist for people.** `profiles` is `bio`,
`avatar_url`, `visibility`, `available_for_work`, `offers_coaching` — no rate, no skills. That half
is a migration, and it is the smaller half of this task.

✅ **UNI-009 deferred *"search across all surfaces"* to Not-in-v1 and it never got an owner.** This
task takes the per-list half of it. **One box across the whole site stays deferred** — see below,
because the distinction is the scope line.

## Scope (v1)

**The component, built once:**

- **Text search** — a `<form method="get">`, 🔴 **not a client island.** This site has exactly one
  `"use client"` component in it (`ApproveForm.tsx`) and every page is server-rendered and readable
  with no JavaScript. **A search box must not be the thing that makes a public page require JS to
  read**, on a site whose one promise is that reading never asks for anything.
- **Multi-select facets with counts**, reflected in the URL so a filtered list is a link somebody
  can send.
- **Sort** — newest, and one page-specific extra.
- **The empty result state** — 🔴 *"no rows matched these filters"*, with the filters named and a
  way to clear them. This is a **different** state from *"nothing has been posted yet"*, and
  collapsing the two is how a working filter reads as a broken page.

**Applied to six lists, with these dimensions:**

| Page | Facets | Sort |
|---|---|---|
| `/people` | available for work · offers coaching · **rate band** · **skill** | recently active · points |
| `/rfps` | open/closed · budget band · **needs a response** | newest · fewest responses |
| `/coaching` | price band · duration | price · recently listed |
| `/tutorials` | level · category · node *(UNI-020)* | newest |
| `/replays` | topic *(UNI-021)* | newest |
| `/bench` | section · answered/unanswered · node facet | newest · longest unanswered |

**The migration (people only):**

- `profiles.rate_band` — a **band, not a number.** 🔴 Nobody should have to publish a figure to be
  findable, and a band is the version of this that people will actually fill in. ⚠️ Optional, and
  **its absence must not hide anybody** — D8's listing bar is the only thing that governs who
  appears, and a rate filter that silently excludes everyone who left it blank is a second,
  accidental bar.
- `profile_skills (account_id, skill)` — node types and topics, the same vocabulary as UNI-020's
  chips.

## 🔴 The two assertions this task lives or dies on

**1. A count must equal what the filter returns.** A facet count comes from a `group by` and the
list comes from a `where`; **two producers of one number is exactly where they drift**, and nothing
in a *"does it render?"* test can see it. Assert the **cardinality** — for every facet, the count
shown equals the number of rows that facet yields.

**2. Every filter needs a positive arm.** A filter returning zero rows and a broken query returning
zero rows are **identical on screen and have opposite fixes.** Every filter assertion carries a row
it *does* return, in the same test.

## Acceptance criteria

1. **One component serves all six lists.** 🔴 The falsifiable form: **grep for the pill markup** —
   more than one implementation of the bar in `src/` fails this criterion. ⚠️ This is the criterion
   most likely to be met on the day and broken in a fortnight, which is why it is a grep and not a
   judgement.
2. **Filter state round-trips through the URL.** A filtered page, copied and re-opened in a fresh
   session with no cookies, shows the same rows.
3. **The counts match the rows** — the cardinality assertion above, on every faceted page.
4. **Every facet has a positive arm and the empty-result state is distinguishable from the
   never-posted state**, asserted separately.
5. **Search works with JavaScript disabled.** 🔴 Driven, not reasoned about: fetch the page over
   HTTP with a query string and assert the narrowed rows are in the **server-rendered HTML**.
6. **The rate band is optional and does not gate listing.** Control: a listed profile with no rate
   band still appears in the unfiltered directory and in every non-rate facet. ⚠️ D8's bar is the
   only listing rule; this must not become a second one.
7. **`/people` rows carry avatars, points and badge progress** — the profile page's own language,
   which exists and is applied on exactly one page today. *(Session 28: "the one component whose
   whole job is to make people feel present" has no avatars.)*
8. **Control: the existing suites pass unchanged**, apart from the two profile columns.

## Not in v1

- **No global search box.** One query across threads, tutorials, replays and people is a real
  feature with a real index behind it; UNI-009 deferred it and it stays deferred. **Per-list search
  is not a down-payment on it** — say so, or the next reader assumes it was.
- **No saved searches, no alerts, no RSS.**
- **No fuzzy matching or ranking.** `ilike` over titles and bodies; when that stops being enough,
  the answer is a search index, not a cleverer `where`.
- **No rate on RFPs.** A brief has a budget band already.

## Dependencies

| Needs | Why |
|---|---|
| nothing | the bar and the migration are both unblocked |
| **UNI-020 / UNI-021** | supply the tutorial and replay dimensions. ⚠️ Either order — whoever is second consumes the bar rather than building a second one |
| **UNI-013 slice 5** (soft) | the bar is the head of the *list* archetype; building it here and drawing it there is two descriptions of one component |
