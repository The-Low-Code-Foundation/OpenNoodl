# COM-002 — The Bubble phrasebook

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

**AC1 — the page exists, in Bubble's words.** A reference page under `docs-site/docs/` whose row
labels are Bubble's operator names verbatim, each with the NodeGX node and working code. Sortable or
searchable; the search term is the product.

**AC2 — the 32 blanks are filled or refused.** Every blank row gets an answer or an explicit
"NodeGX does not do this, here is what to do instead". 🔴 **A silently omitted row reads as an
answered one** — the reader cannot tell the difference between "we have no equivalent" and "nobody
got to it", and the current file has 32 rows of exactly that ambiguity.

**AC3 — the Parse-era rows are re-tested or marked.** ⚠️ Several rows are written against the old
Noodl Parse backend and say so in their own Notes column — *"Only works in back end cloud functions
using the Noodl Parse back end"*, *"This only works with the Noodl Parse backend"*, *"NB: This only
works as a cloud function"*. 🔴 **Untested, these teach a lie.** Each is re-run against the current
backend, or carries a visible marker.

**AC4 — every code cell has been executed.** Not read — executed. The dictionary's code was written
for an editor that no longer exists. Measured by a checker over the page's code cells, not by
inspection.

**AC5 — it is reachable by someone who has never heard of NodeGX.** The page is in the sidebar and
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
