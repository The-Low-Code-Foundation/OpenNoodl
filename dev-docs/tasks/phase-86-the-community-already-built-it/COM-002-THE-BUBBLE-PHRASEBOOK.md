# COM-002 — The Bubble phrasebook

> ✅ **BUILT 2026-09-11 (session 3). All five ACs closed.** 94 rows, 0 blank, 5 refused in plain
> words. **77 code cells, every one executed** by `npm run docs:bubble:check`. Running the community
> table's own code found **18 demonstrably wrong rows**, and the accusations are executed too. Outcome
> and three corrections to this task file in §7.

🔴 **There is no Bubble migration content in this repo. None.** `grep -ril bubble` over the whole
tree returns Chart.js bubble charts, one metaphor in `docs/node-catalog/patterns.md:36`, and two
P71 rows about Bubble's *pricing*. A person arriving from Bubble has nothing to read.

## 1. The person sentence

**A Bubble user searches the words they already know — `:formatted as JSON-safe`, `:ranked by`,
`<-range->` — and lands on the NodeGX answer.**

## 2. Why the dictionary is worth more than a guide

It is written in **Bubble's** vocabulary, not ours. That is the entire asset. `:ranked by` is not a
concept we would ever have named; it is what a Bubble user types into a search box. 94 rows of it,
built up by the community over years.

⚠️ **This is a reference table, not a tutorial.** The instinct to write "Migrating from Bubble: a
guide" should be resisted — a guide answers the questions its author thought of, and this table
already contains the questions real users had. The acquisition value is in matching their search
terms, not in our narrative.

## 3. What is there, and what is missing

| | n |
|---|---|
| rows | 94 |
| answered with an `Expression` | 30 |
| answered with a `Function / Script` | 30 |
| answered with another node | 2 |
| 🔴 **blank in both columns** | **32** |

The 14 standalone code snippets in [`corpus/components/`](corpus/components/) are the same kind of
content in a different container — `Add params to URL`, `Check window width`, `Map new values to an
existing array`, `Input mapping for repeater nodes`. They belong in the same table.

## 4. Acceptance criteria

✅ **AC1 — the page exists, in Bubble's words.** A reference page under `docs-site/docs/` whose row
labels are Bubble's operator names verbatim, each with the NodeGX node and working code. Sortable or
searchable; the search term is the product.

✅ **AC2 — the 32 blanks are filled or refused.** Every blank row gets an answer or an explicit
"NodeGX does not do this, here is what to do instead". 🔴 **A silently omitted row reads as an
answered one** — the reader cannot tell the difference between "we have no equivalent" and "nobody
got to it", and the current file has 32 rows of exactly that ambiguity.

✅ **AC3 — the Parse-era rows are re-tested or marked.** ⚠️ Several rows are written against the old
Noodl Parse backend and say so in their own Notes column — *"Only works in back end cloud functions
using the Noodl Parse back end"*, *"This only works with the Noodl Parse backend"*, *"NB: This only
works as a cloud function"*. 🔴 **Untested, these teach a lie.** Each is re-run against the current
backend, or carries a visible marker.

✅ **AC4 — every code cell has been executed.** Not read — executed. The dictionary's code was written
for an editor that no longer exists. Measured by a checker over the page's code cells, not by
inspection.

✅ **AC5 — it is reachable by someone who has never heard of NodeGX.** The page is in the sidebar and
its title carries the word Bubble. ⚠️ Acquisition is the point; a correct page nobody lands on has
done nothing.

## 5. The honest limit

🔴 **This is not a migration tool and must not be described as one.** Nothing here reads a Bubble
app, converts a workflow, or imports data. It is a phrasebook. Overclaiming it is worse than not
shipping it: a person who arrives expecting an importer and finds a table leaves angrier than one
who arrived expecting a table.

What it *is* good for: the person already evaluating NodeGX who cannot work out how to express the
thing they used to write in one line.

## 6. What this does not own

The examples the table links to (COM-001). Bubble's pricing as a competitive argument — that is
P71 SM-005/SM-007 and is a different conversation.

---

## 7. Outcome — session 3, 2026-09-11

**The page is [`docs-site/docs/coming-from-bubble.md`](../../../docs-site/docs/coming-from-bubble.md)
— generated, never hand-edited**, from one source of truth:

| file | what it is |
|---|---|
| `scripts/bubble-phrasebook/rows.js` | all 94 operators, each with its answer, a fixture, and — where the community's code was wrong — that code verbatim |
| `scripts/bubble-phrasebook/check.js` | executes every code cell and every accusation. `npm run docs:bubble:check` |
| `scripts/bubble-phrasebook/build.js` | writes the page. Refuses to write if a cell fails. `npm run docs:bubble` |

| reading | value |
|---|---|
| operators on the page | **94** |
| rows blank in both columns | **32 → 0** |
| refused in plain words, with what to do instead | **5** |
| code cells, all executed | **77** |
| demonstrably wrong rows in the community table | **18** |
| site build | `npm --prefix docs-site run build` exits 0 |

### 7.1 AC4 — what executing the table actually found

🔴 **18 rows are demonstrably wrong, in three different kinds, and the page says which.** Lumping
them together would have been the easy overclaim; they are not the same finding:

- **11 whose code returns the wrong answer when run.** `:formatted as JSON-safe` wraps
  `JSON.stringify` in quotes a *second* time and returns `""pink…""`. `... contains` has its operands
  the wrong way round and answers `false` where its own row says TRUE. `:rounded to` returns the
  string `"3"`, not `3`. `+(days)` mutates the Date it was handed and adds seconds, minutes, hours,
  days, months **and** years at once — asked for "+2 days" it returns **2025-09-08**. `change minutes
  to` publishes `1688644800000`, a timestamp rather than a Date. `extract month` calls `getDay()` and
  returns **4**. `:unique elements` deduplicates a list of colour strings by `item.id` and returns
  **one** element where the row says ten. `- :formatted as years` and `:plus item` assign **no
  outputs at all**. And `:item #` does not even compile.
- **3 whose stated ANSWER is wrong** while the code is fine — `Int1 ^ 2` is given as `9.999`, which
  is 3.333 × 3 rather than its square; `:center`'s result is the midpoint of a range that is not the
  one its own `:end` row defines; `intersects with` claims `blue, red` from two lists that share
  nothing.
- **2 that claim an answer they never shipped.** `... is not empty`'s code cell is the literal text
  *"See above"*. `:group by...` names **Function / Script** in its node column and leaves the code
  cell **empty** — so it is not one of the 32 rows blank in both columns, and a reader scanning the
  node column sees an answered row. That is the quietest hole in the file.

### 7.2 🔴 The accusations are executed too, and two of them were wrong

*"The community's code is broken"* is a claim, and a claim read off a page is worth nothing. Each of
the 11 carries the **original code verbatim** in `corpusOriginal`, and the checker runs it: **a row
accusing the table of being broken fails the build if the old code turns out to work.**

**That check fired on two rows and they were demoted.** `:formatted as ... (currency)` hard-codes a
dollar sign — but executed on its own example it returns `$3.33`, exactly what the row says. `contains`
hard-codes the singular `"apple"` under an example about `"apples"` — and still answers FALSE, so it
agrees with its row. Both are real criticisms (one is wrong everywhere outside the US, the other is
right for the wrong reason and buries a value nobody can wire) and **neither is a correctness bug**.
They now carry `note_corpus`, which makes no correctness claim. The count went 13 → 11 because of it.

### 7.3 🔴 A product defect the checker found, which nothing else would have

**An Expression whose text ends in a `//` comment does not compile.** `expression.ts` wraps the body
as `return ( <your text> );` on a single line, so a trailing line comment swallows the closing `);`
and the whole thing dies with `Unexpected token '}'` — an error naming nothing the author wrote and
never mentioning comments.

Three community rows are written that way — `:item #`, `:items until #`, `:items from #` — which
means **all three have provably never been run by anybody**, in the years they circulated.

⚠️ **Not owned here, and not fixed here.** `grep` finds no test covering a comment in an Expression
and no note about it in `expression.ts`. **Nominated owner: the runtime.** The one-character fix is a
newline before the `);` — `return (\n' + code + '\n);` — and it wants a spec beside it. The page warns
readers under [One thing to know before you paste anything](../../../docs-site/docs/coming-from-bubble.md).

### 7.4 Three corrections to this task file

1. 🔴 **AC3's premise is wrong about where the Parse-era rows are.** It places them in the dictionary
   and therefore in this task. **The dictionary's 94 rows contain ZERO of them** — searching every
   column for `parse`, `backend` or `cloud function` returns nothing. The three quoted strings are in
   **`Components.csv`**, the community *components*. Marked and re-tested in
   [`corpus/components/PARSE-ERA-ROWS.md`](corpus/components/PARSE-ERA-ROWS.md) rather than on the
   page, because the page has no such row to mark.
2. ⚠️ **And "Parse backend" is not a death sentence.** `nodegx-backend-contract`'s `parse.ts` is kept
   *"by decision, not by inertia"* with cells probed against a live `parse-server:7.3.0`, and cloud
   functions ship today. What died was Noodl's *hosted* Parse service, not the wire. The accurate
   marker is **"needs a Parse-compatible backend"**, and none of the three has been *run* yet.
3. ⚠️ **§3 says the 14 standalone code snippets "belong in the same table". They were deliberately
   left out**, and the reason is §2's own argument: the asset is that every row label is a phrase a
   Bubble user would type. `Add params to URL` and `Check window width` are NodeGX recipes in our
   vocabulary, not Bubble operators — putting them in this table dilutes the one thing that makes it
   findable. They are COM-003's and COM-005's material. If they want a page it is a different page.

### 7.5 AC5, verified in the built site rather than asserted

The site was built and the artefact inspected, because "it is in the sidebar" is checkable and worth
checking. `build/docs/coming-from-bubble/index.html` exists; **Coming from Bubble** appears in the
sidebar rendered onto every other page; and the site already ships
`@easyops-cn/docusaurus-search-local`, so `build/search-index.json` was grepped directly —
`:ranked by`, `<-range->` and `:formatted as MD5 hash` are all **in the index**. The search term is
the product, and the search box actually has it.
