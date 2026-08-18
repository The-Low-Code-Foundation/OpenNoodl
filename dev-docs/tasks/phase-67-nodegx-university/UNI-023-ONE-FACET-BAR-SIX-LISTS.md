# UNI-023 — one facet bar, six lists

> 🔴 **THE DESIGN IS AN ARTIFACT, AND THIS FILE IS NOT IT.**
> **["Every page is the same page"](https://claude.ai/code/artifact/5cc390dd-a8dc-48c9-b960-b74ed89010e6)**
> — §04 draws the bar with counts and §09 shows it serving People and the Work board unchanged.
> ⚠️ **Open it before writing markup.**

**Surface:** platform · **Tier 1** · **Effort:** M · ✅ **Blocked on nothing.**

# ✅ BUILT 2026-08-18, session 36

**One engine, six lists, and the count is no longer a second producer.** `src/lib/facets.ts` holds
a `ListSpec` per page and computes the rows and every pill's count with **one function** — a pill's
number is not *related to* what clicking it returns, it **is** what clicking it returns, from the
same call. `src/lib/lists.ts` is now six specs and six compositions; `FacetBar` grew a
`<form method="get">` and a row of sort links; `0013` added `profiles.rate_band` and
`profile_skills`.

## What each criterion cost

| AC | Result |
|---|---|
| 1 · one component | ✅ a **grep** over `src/`: the pill markup is declared once, in `Kit.tsx`, and no page contains `<FacetBar` or `'facet` |
| 2 · URL round-trip | ✅ a pill's href re-read with **no argument but the URL** returns the same rows |
| 3 · counts match | ✅ every pill on every page, plus **from an already-filtered page** and **with a search term on** |
| 4 · positive arms + two empties | ✅ two floors — one for "a pill was checked", one for "a pill returned something" |
| 5 · search with no JS | ✅ `<form method="get">`, the narrowed rows in the **server-rendered HTML**, and a sweep asserting the site still has exactly ONE `"use client"` component |
| 6 · the rate band gates nothing | ✅ a listed profile with no band, asserted present in the unfiltered page and under every non-rate facet — with a positive arm beside it |
| 7 · avatars, points, badge progress | ✅ and the badge count is asserted to **agree with `badgesFor` per account**, because that is two readers of one ledger |
| 8 · existing suites | ⚠️ **not literally unchanged** — see below |

## 🔴 Four things worth carrying forward

**1 · An active pill's href turns it OFF, and the first test got that backwards.** On a multi-select
bar the natural assertion — read the href off the filtered page, expect the filtered rows —
measures the toggle, not the filter. It failed, correctly. Take the link from the **unfiltered**
page.

**2 · A dimension with nothing to filter by is now omitted, including its "All" pill.** `/replays`
had a `topic` dimension before `replay_topics` existed, and the "All" pill alone drew a legend
reading *"Topic · All 3"* over a page where nothing had a topic — a control that does nothing. The
rule was per-page prose in slice 5; it is one line in the engine now.

**3 · AC8 is not literally met, and pretending otherwise would be worse.** Three call sites in
`tests/uni013-slice5.test.tsx` changed, because the model genuinely did: `peopleList(sql, {filter})`
became `peopleList(sql, params)` and `benchList(sql, {section, asOf})` became
`benchList(sql, {asOf, params})`. ⚠️ **`ListParams` is an index signature over the query string, so
a `Date` cannot sit beside it** — the clock the Bench renders is not something a reader can put in
a URL. The **substance** of AC8 holds: no assertion was weakened, and the one floor that was
retired (*"no fragment link was checked"*) was retired by UNI-021 rather than by this task.

**4 · A `max(timestamptz)` comes back as a STRING.** `lastActivity` typed it as `Date` and the sort
comparator died with `b.lastActiveAt?.getTime is not a function` — a page-level crash from a value
that typechecked. The driver parses a plain `timestamptz` column to a `Date` and an aggregate of one
to a string.

## ⚠️ What was deferred, and where the row is

`/replays | topic` was in the scope table above and `replay_topics` did not exist. The page shipped
with **search and sort and no legend**, and the deferral was written down as an assertion —
`expect(replays.facets).toEqual([])` — which **turned red the moment UNI-021 landed the column**,
in the same session. That is what a deferred row should do.

**What the drive confirmed for this task:** every rate band has a positive arm on the running site
(1 each) and **`mo-makes` has none**, which is AC6 standing on the page rather than in a fixture;
`/people?rate=400-700` returns exactly the 1 row its pill promises; `?q=zzzz` renders
`data-empty="no-match"`; and the search form carries `<input type="hidden" name="for"
value="coaching"/>` when submitted from a filtered page.


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
