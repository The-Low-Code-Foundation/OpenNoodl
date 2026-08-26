# FB-024 — the search box that could not see a question

**Filed and fixed:** 2026-08-26 (session 41), taking queue item 1 — *"the bench search ANDs its
terms"*. **Status: FIXED, 20 specs, 9 mutants.** Owner: platform (`nodegx-community`).

> **In one line:** the Bench's search box was labelled *"Search questions"* and **could not see
> one word of one question** — and the defect that had been filed was in a different function,
> one that nothing on the site calls.

---

## The filed premise was wrong in the way that mattered

The queue item, carried from [FB-014-DESIGN.md](FB-014-DESIGN.md), read:

> *"`websearch_to_tsquery` ANDs bare terms, so a conversational query matches **2/22** even in
> perfect vocabulary. Anyone typing a sentence into the bench search gets nothing. Cheap
> (`plainto_tsquery` + ranking, or OR-ing terms)."*

Every clause about `searchThreads` is true. **But nothing on the site calls `searchThreads`** —
grep finds exactly one importer, its own test file. The reader's search box goes

```
/bench/page.tsx -> benchList -> buildList -> select() in facets.ts
```

which matched a **JavaScript substring** over rows already in memory. Two different searches, and
the item was filed against the one no reader can reach. **Same shape as FB-005 T1 last session** —
a registry whose contract was documented against its one unreachable implementation. The habit
that catches it is the same: **grep the callers before believing the mechanism.**

### And the live one was worse

`benchList` builds its rows from `listThreads`, which returns `BenchThreadSummary` — a title, a
handle, a section, some counts, and **no body**. So the haystack was
`[title, authorHandle, section, ...nodes]`. **The Bench was the only one of the six lists whose
`searchable` named no text field**; tutorials, profiles and briefs all search a body, a bio or a
description. It was the one list whose row type had nothing to give, which is why it was also the
one nobody noticed.

---

## The measurements

One fixture: a thread titled *"Repeater draws nothing"*, its question body carrying `kerning`,
`slider`, `port` and *"the row never updates"*, one answer carrying `marmalade` and
*"output fires"*, plus a second unrelated thread. Rows returned by `benchList` — the Bench's own
list, as a reader gets it.

| query | before | after | |
|---|---|---|---|
| a word in the TITLE | **1** | 1 | the control — the box worked at all |
| a word in the QUESTION body | **0** | **1** | |
| a word in an ANSWER body | **0** | **1** | |
| those same words via `searchThreads` | 1, 1 | 1, 1 | the control — the text was always there |
| `repeater draws` (adjacent, in order) | **1** | 1 | |
| `repeater nothing` (one word between) | **0** | **1** | *same title, same two words* |
| `draws repeater` (reversed) | **0** | **1** | |
| `which output fires when the row never updates` | **0** | **1** | the sentence the item names |
| that sentence, one word swapped for a nonsense word | 0 | **0** | the control that stops the row above meaning "matches everything" |
| `repeater timer` — one word from each thread | 0 | **0** | order-independence is not term-independence |

**`plainto_tsquery` is not the fix the item suggested.** Measured beside `websearch_to_tsquery`
on the same sentence, it returns the **identical** tsquery —
`'output' & 'fire' & 'row' & 'never' & 'updat'`, the same lexemes joined by the same `&`. What
differs between the two is the syntax they accept, not how they join what they parsed.

---

## What shipped

**1. `facets.ts` — the query is its words, not one substring.** `termsOf` splits on whitespace and
every term must be a substring of the haystack. Each term is **still** a substring, so `kern`
keeps finding `kerning`; what changed is that the terms may sit anywhere in any order. This only
ever **widens** — anything the old whole-string match returned, term matching returns too.

**2. Stopwords, taken from Postgres rather than invented** — the 127 words of
`tsearch_data/english.stop`, the snowball list the `english` config already uses. This is what
makes a typed **sentence** work: every term is required, so the sentence needed `which` and `when`
to appear in a thread. **The words carrying no meaning were the only ones doing any excluding.**
An all-stopword query keeps its words rather than dropping to none — a box that answers `the` with
every row looks broken in the direction that costs most.

**3. `bench.ts` — `threadSearchText`**, one query for the window, built from the **parsed** model
(`plainTextOf(parsePostBody(...))`) exactly as `excerptFor` is and for the same reason: a haystack
of raw markdown lets a reader match fence markers and link targets. **`hidden_at is null`** —
making bodies searchable means making moderated bodies searchable unless the query says otherwise,
and a box that confirms a word is present in hidden text is a way to read it one guess at a time.
Specced, with the pre-hide state as the control in the same test.

**4. The label stopped over-promising** — *"Search questions"* over titles is the wording that
prevents a reader diagnosing the miss. It is *"Search questions and answers"*, and it searches
both.

**5. `searchThreads` — ORed and ranked**, though still called by nothing. Fixed rather than
deleted because **FB-014's hybrid retriever measured this exact query as its lexical arm** and
`body_tsv`'s GIN index is maintained by a trigger for that reader. Ordering was `t.seq desc`,
pure recency — survivable while every term is required, indefensible once one shared word can
match, so ranking is what supplies the precision the AND used to.

**An explicit operator is left alone, and the guard tests the PARSED query, not the raw string.**
`repeater -solved` parses to `'repeat' & !'solv'`; ORing that yields `'repeat' | !'solv'` —
**every thread that fails to mention "solved"**, a negation turned into its own opposite. A
tsquery containing `!` or `|` is one the reader built on purpose and runs as written.

**`searchThreads` is deliberately NOT wired into the faceted list.** `select()` is by design the
only place a row is included or excluded, which is what makes a pill's count equal the rows behind
it. A second matcher beside it is exactly how those two drift. AC5 re-asserts that equality under
the changed matcher.

---

## Left open

- **`body_tsv`, its GIN index and its trigger still serve no reader.** Now that the live search
  covers bodies, the column's only prospective caller is FB-014. If FB-014 is not built, this is a
  delete — but it is a migration, and the call is Richard's rather than a tidy-up.
- **`benchList` now parses the markdown of every visible post in the 200-thread window on every
  request** (the page is `force-dynamic`). Free at 3 posts; it is the first thing to cache when
  the Bench has content, and paging arrives before the window does.
- **Node names that are stopwords.** `For Each`, `Not`, `And`, `Or` are all in the snowball list.
  The all-stopword fallback covers the exact query `for each`; `Static Data For Each` searches
  `static data` and matches more widely than typed. Correct rows, extra ones.
- **Not deployed.** Web-side; nexus-1 still runs the old matcher.
