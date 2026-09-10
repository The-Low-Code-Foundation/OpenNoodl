# COM-001 — The 26 nodes nobody demonstrated, and the 32 questions nobody answered

🔴 **The catalog cannot show you how to use `net.noodl.Now`. The dictionary cannot tell a Bubble
user what replaces `Current date & time`. These are one gap, and one artefact closes both.**

## 1. The person sentence

**Someone asks the date question — in Bubble's words or in ours — and gets a worked example back.**

## 2. What was measured

176 node types, 67 examples, **26 picker types with no example at all**. 94 dictionary rows,
**32 blank in both answer columns**. The overlap is not incidental (README §2): dates, hashing,
CSV, ids — the corner of the product nobody documented, sitting on the migration path.

Full readings and the counted-two-ways check: [`MEASURED-2026-09-10.md`](MEASURED-2026-09-10.md) §2.

## 3. Why the dictionary is the right brief

An example needs a *reason to exist* — otherwise it demonstrates the node's ports and teaches
nothing. "Show `DateCompare`" produces a wiring; **"answer `is after`"** produces an example with a
question in front of it, and the question is one a real person actually typed into Bubble.

So each blank row becomes an example brief. `net.noodl.Hash` is not titled *"Hash node"*; it is
titled after what the row asks for. The blank rows group cleanly:

| group | rows | types they land on |
|---|---|---|
| dates & ranges | ~20 | `Now`, `DateAdd`, `DateCompare`, `DateDifference`, `DateParts` |
| hashing & ids | 3 | `Hash`, `RandomBytes`, `UUID` |
| CSV & text formatting | ~4 | `ToCSV`, `ParseCSV` |
| list operations | ~5 | ⚠️ **may have no answer** — see AC4 |

⚠️ The 12 `noodl.cloud.*` user/JWT/secret nodes are in the 26 but **not** in the dictionary — Bubble
users do not ask for `jwtsign`. They need examples for the catalog's sake, not migration's, and they
are the lower-priority half of this task.

## 4. Acceptance criteria

**AC1 — the date family is demonstrated.** `Now`, `DateAdd`, `DateCompare`, `DateDifference` and
`DateParts` each cite at least one example, and each example is titled after the question it
answers, not the node it uses. Measured: those five types have non-empty `enrichment.examples`, and
`npm run catalog:examples` **exits 0**.

**AC2 — hashing, ids and CSV are demonstrated.** Same shape for `Hash`, `RandomBytes`, `UUID`,
`ToCSV`, `ParseCSV`.

**AC3 — the remaining 12 are covered or explicitly deferred.** The `noodl.cloud.*` and
`net.noodl.user.*` types either get examples or get a written line in this file saying why not.
🔴 **`merge.js:112` warns on every one of them**, so "deferred" means the warning is accepted on the
record, not that nobody noticed.

**AC4 — the list operations get an honest answer.** `:sorted`, `:ranked by`, `is not in`,
`contains keyword(s)` may have **no** clean node answer today. 🔴 **Do not invent one.** Either
demonstrate it, or record it as a product gap with an owner — an unowned row gets rediscovered at
full price. This AC closes on a written disposition, not on a green gate.

**AC5 — the gate stays green and the count goes up.** `npm run catalog:examples` exits 0, and the
example count is 67 + n. ⚠️ Grade on the exit status; the summary sentence prints on failure too.

## 5. 🔴 The trap this task must not fall into

**An example that demonstrates a node is not an example that answers a question.** The 67 shipped
examples were authored *from the node outwards* and that is why 26 types have none — nobody sat down
to document `RandomBytes` for its own sake, and nobody ever will. Writing 26 more from the node
outwards produces 26 artefacts nobody reads.

The dictionary inverts it: **the question exists first, in someone else's vocabulary, and the node
is the answer.** If a brief here cannot be stated as a question a person would ask, that is a signal
the example is not worth writing — say so and move on.

## 6. What this does not own

The reference page itself (COM-002). Whether the example *library* should also contain community
graphs (COM-003). Both consume this task's output; neither blocks it.
