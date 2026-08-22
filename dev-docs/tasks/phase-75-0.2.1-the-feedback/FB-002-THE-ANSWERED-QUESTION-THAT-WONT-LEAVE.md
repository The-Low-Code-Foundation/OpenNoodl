# FB-002 — the answered question that won't leave

**Filed:** 2026-08-22, from Richard's item 1b. **Status: 🟡 web half done 2026-08-22 (AC1, AC2);
editor half open (AC3, AC4).** Size: S (web) + M (editor).

> *"The ones that are marked as answer accepted still appear in the list of questions on the
> bench, instead of being relegated to an 'answered' filter (still searchable)."*

---

## What exists (swept 2026-08-22)

- **The facet is already built** — UNI-023 (✅ 2026-08-18, driven over real HTTP):
  `nodegx-community/src/lib/lists.ts:729–741`, `key:'state'`, legend `Answered` /
  `Solved` / `Waiting for an answer`. What Richard is seeing is the **default**: unfiltered,
  newest-first.
- **The editor/launcher mirror has no facets at all** — NAT-008 recorded that none of the ten
  `/v1/community` endpoints reads a `q`; filtering is the client's job and nobody built the
  bench's client-side facets.

So the web half is a default change, not a build. The editor half is a small build on an
existing seam.

## Acceptance criteria

- AC1 (web): the default `/bench` list shows waiting-for-an-answer threads; solved threads live
  behind the existing `Answered`/`Solved` facet, one click away, and **search still returns
  them** (the FTS index does not care about the facet — assert it with a solved thread and a
  body-word query).
- AC2 (web): the facet state is visible in the URL so an answered-list link is shareable, if
  UNI-023's facet bar already does this — don't invent a second mechanism if it does.
- AC3 (editor/launcher): the bench list in the mirror gains the same three-state filter with the
  same default. ⚠️ It filters client-side over a **paged** endpoint —
  `a-local-filter-over-a-paged-endpoint-must-report-its-bound` is the recorded trap; the count
  must say what it was computed over.
- AC4: both surfaces show the same default for the same account (D15's mirror-agreement rule).

## Traps

- Do not change what "answered" means: accepted-answer is the platform's definition
  (`accepted_post_id` non-null), not "has any reply".
- UNI-023's facet bar was driven over real HTTP; extend its spec rather than writing a parallel
  one.

---

## Done — 2026-08-22 (the web half)

- **AC1** ✅ `/bench` defaults to waiting-for-an-answer; `Solved` is one click away; **a search
  still returns solved threads.**
- **AC2** ✅ Through the existing mechanism, not a second one: `hrefFor` already keeps a
  dimension sitting on its fallback out of the URL, so `/bench` and `/bench?state=waiting` are
  the same page and `/bench?state=solved` is shareable.
- Specs: 8 new assertions inside `tests/uni023-facet-bar.test.tsx` (extended, not paralleled, as
  the task asked). 39/39 in that file.

### 🔴 The two halves of Richard's sentence fight, and the fix is in `readQuery`

*"relegated to an 'answered' filter (still searchable)"* — a default that also filters the
**search box** satisfies the first half and breaks the second, and it looks correct from the
list page. So `Dimension` gained **`fallbackYieldsToSearch`**: the fallback applies to
*browsing* and steps aside for a typed query, while an explicit `?q=…&state=waiting` still
wins because the reader said so.

It is applied in `readQuery` rather than in `select`, deliberately: everything downstream —
pills, counts, hrefs, hidden inputs, `filtered` — reads the map that function writes, so a
"Waiting" pill drawn *active* over search results containing a solved thread is impossible by
construction rather than by care. A spec asserts no pill is active during a search.

⚠️ **Opt-in per dimension.** `/rfps`'s `show: open` did **not** take it; whether a search there
should surface closed briefs is Richard's to reverse, not a side effect of this task. A spec
pins that too.

### ⚠️ The task's AC1 named a mechanism that does not exist

*"the FTS index does not care about the facet — assert it with a solved thread and a body-word
query"*. **There is no FTS index and no body search.** The Bench's haystack is
`title + authorHandle + section + nodes` (`lists.ts`, `BENCH_SPEC.searchable`), matched with
`includes()` over the 200 newest threads — the engine's own comment says *"deliberately dumb …
when that stops being enough the answer is a search index, not a cleverer where"*. The
assertion is therefore by **title** word. **Bodies being unsearchable is real and unowned** —
it belongs with FB-014, which is the search task.

### One met assertion was deliberately revised

`tests/uni013-slice5.test.tsx` — *"counts a section the SAME way the section page filters it"*
expected `showcase · 1`, and now expects `showcase · 0`, because the only showcase thread in the
fixture is solved and clicking that pill from the default list returns nothing. **That is the
count keeping its promise about the click**, which is the one defect that file exists to catch.
A second pair of assertions from the solved side was added so the partition is still provably
real rather than an empty vocabulary.

---

## The editor half (AC3, AC4) — open, and cheaper than it looks

🔴 **No platform change is needed. `accepted` is already on the wire.**
`GET /api/v1/community/threads` → `mirrorThreads` (`src/lib/mirror.ts:84`) sends
`{id, title, section, authorHandle, createdAt, replyCount, accepted, firstReplyMinutes}`.
The editor's `ForumThread` (`communityapi.ts:191`) declares **four of those eight**, and
`CommunityThreadRow` (`Community.tsx:91`) the same four. So the work is a **type widening plus
a client-side filter** — no new route, no new column, and **none of the four derived-from-disk
gates or the `/v1` envelope contract fire.**

⚠️ **The bound is 100, not 200.** `mirrorThreads` calls `listThreads(sql, { limit: 100 })` while
the web Bench's window is 200. The filter is client-side over that window, so the count must
say what it was computed over — `a-local-filter-over-a-paged-endpoint-must-report-its-bound`.

⚠️ The threads list renders through the **shared** `CommunitySection` vocabulary
(`@noodl-core-ui/components/community`), which replays and articles also use. A filter control
added there lands on all three; the sections' own view models are composed in
`models/community/mirrorview.ts`. Decide which before building — that is the real design
question in AC3, and it is why this is M and not S.
