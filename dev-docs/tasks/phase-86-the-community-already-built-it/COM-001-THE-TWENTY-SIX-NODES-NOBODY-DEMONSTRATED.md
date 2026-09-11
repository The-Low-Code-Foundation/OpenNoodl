# COM-001 — The 26 nodes nobody demonstrated, and the 32 questions nobody answered

> ✅ **BUILT 2026-09-11 (session 2). All five ACs closed. The warning count went 26 → 0** and the
> example corpus 72 → 89. Outcome, and four things the task got wrong, in §7.

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

✅ **AC1 — the date family is demonstrated.** `Now`, `DateAdd`, `DateCompare`, `DateDifference` and
`DateParts` each cite at least one example, and each example is titled after the question it
answers, not the node it uses. Measured: those five types have non-empty `enrichment.examples`, and
`npm run catalog:examples` **exits 0**.

✅ **AC2 — hashing, ids and CSV are demonstrated.** Same shape for `Hash`, `RandomBytes`, `UUID`,
`ToCSV`, `ParseCSV`.

✅ **AC3 — the remaining 12 are covered or explicitly deferred.** The `noodl.cloud.*` and
`net.noodl.user.*` types either get examples or get a written line in this file saying why not.
🔴 **`merge.js:112` warns on every one of them**, so "deferred" means the warning is accepted on the
record, not that nobody noticed.

✅ **AC4 — the list operations get an honest answer.** `:sorted`, `:ranked by`, `is not in`,
`contains keyword(s)` may have **no** clean node answer today. 🔴 **Do not invent one.** Either
demonstrate it, or record it as a product gap with an owner — an unowned row gets rediscovered at
full price. This AC closes on a written disposition, not on a green gate.

✅ **AC5 — the gate stays green and the count goes up.** `npm run catalog:examples` exits 0, and the
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

---

## 7. Outcome — session 2, 2026-09-11

**17 examples written, 26 types now cited, `merge.js` warns on none.**

| reading | before | after | command |
|---|---|---|---|
| types with no example | **26** | **0** | `npm run catalog:merge:check` |
| examples in the corpus | **72** | **89** | same line |
| `catalog:examples` | exit 0 | exit 0 | `npm run catalog:examples` — 89/89 strict, warnings-as-errors |

`catalog:check` and `catalog:tokens` were run too and both exit 0; the committed enriched catalog
was regenerated and `catalog:merge:check` agrees it is current.

### 7.1 The examples, by the question in front of them

**The date family (AC1)** — `bubble-is-this-date-overdue` (`is after`/`is before`),
`bubble-do-two-date-ranges-overlap` (`overlaps with` and the rest of the range block),
`bubble-how-many-days-until` (`<-range->` read as a duration),
`bubble-round-a-date-down-to-the-month` (`rounded down to`, `equals rounded down to`).

**Hashing, ids and CSV (AC2)** — `bubble-hash-a-value`, `bubble-mint-an-id-and-an-invite-token`,
`bubble-write-a-list-out-as-csv`, `bubble-read-a-pasted-csv`.

**The cloud half (AC3)** — covered, not deferred: `cloud-invite-a-team-member`,
`cloud-who-is-in-this-role`, `cloud-revoke-a-role-and-record-it`,
`cloud-delete-an-account-and-its-sessions`, `cloud-sign-a-token-with-a-stored-secret`,
`cloud-check-a-webhook-and-a-token`, `cloud-check-a-session-token-from-a-client`,
`auth-sign-in-without-a-password`, `app-catch-every-error-in-one-place`.

### 7.2 🔴 AC4 — the list operations, dispositioned

Three of the five are answered, and **the instrument that said otherwise was a bad grep.** A search
for a "sort or order port" across all 176 types returns nothing — but only because `order` matches
`border` and was filtered out by hand, and because **`Filter Collection`'s sort is configured in its
filter settings rather than exposed as a named port.** It sorts. Measure the node, not the port list.

| Bubble row | answer | who owns it |
|---|---|---|
| `:sorted` | ✅ **Answered.** `Filter Collection` sorts in memory; `DbCollection2` sorts at the query, which is where anything not already in memory should be sorted. | COM-002 writes the row |
| `:format as text` | ✅ **Answered.** `net.noodl.ToCSV` for a file (now demonstrated); an `Expression` `.map().join()` for a sentence. | COM-002 writes the row |
| `is not in` | ✅ **Answered**, with a caveat: `Expression` — `!list.includes(x)`. There is no Array Contains node, so this is a one-liner and not a wiring. | COM-002 writes the row |
| `:ranked by` | 🔴 **GAP. No answer, and none invented.** Bubble's own example is *"ranked by numerical similarity to Jane"* — a similarity ranking. Nothing in the catalog does this and no Expression one-liner honestly does either. | **🔴 unowned — needs a product decision. Nominated: COM-002 records it as a gap in the phrasebook rather than leaving the row blank a second time.** |
| `contains keyword(s)` / `doesn't contain keyword(s)` | 🔴 **GAP. No answer, and `.includes()` is NOT it.** | **🔴 unowned — same nomination.** |

⚠️ **The keyword rows are the one place this task could most easily have lied,** so the reason is
written down. The corpus CSV's own note says the operator *"takes the argument supplied, breaks it up
into component words, removes any 'stop' words … and looks for the resulting word(s) … 'the cat in
the hat' is returned by 'cat hat', 'hat cat' or 'cat in the hat' … 'pepp' would not return
'peppers'."* That is tokenisation, stop-word removal and stem matching. `Expression` `.includes()` is
substring matching, which gets **both** of those examples wrong in **both** directions: it fails
`'hat cat'` and it wrongly matches `'pepp'`. Writing `.includes()` into the phrasebook would be
AC4's forbidden invented answer wearing a plausible face.

### 7.3 🔴 Four things the task file got wrong, and one it never mentioned

1. **The example baseline was 72, not 67.** AC5 says "the example count is 67 + n"; `catalog:merge`
   read **72** before any of this work. Five examples had landed since the task was written. The
   arithmetic that matters is **72 → 89**.
2. **`net.noodl.Now` was already demonstrated.** `logic-date-formatting` names it in `demonstrates`;
   its enrichment entry simply never cited it back. One of the 26 was a **bookkeeping** gap, not a
   documentation gap — the two lists are maintained by hand and had drifted. Every other one of the
   26 was real: a sweep of all 72 examples found no second case.
3. **The 26 are not "the dictionary's types plus 12 `noodl.cloud.*`".** Measured, the non-dictionary
   half is 12 `noodl.cloud.*` **plus 2 `net.noodl.user.*` plus `net.noodl.Log` plus `On App Error`**.
   §3's group table accounts for none of the last two, and `On App Error` — the app-wide error
   boundary — is the most broadly useful node in the entire undemonstrated set.
4. **Three enrichment files had no `examples` key at all**, rather than an empty array:
   `net.noodl.user.requestmagiclink`, `net.noodl.user.signinwith`, `on-app-error`. A fix written as
   "replace `"examples": []`" silently skips them and leaves three warnings standing.
5. ⚠️ **AC2 asks for MD5 and SHA-1 and the product will never answer.** `net.noodl.Hash` offers
   SHA-256/384/512 only; the enrichment already says MD5 and SHA-1 are *"deliberately not offered"*
   because WebCrypto implements neither for digesting. So the dictionary's two hashing rows get an
   answer, but the answer is **"not offered, on purpose — re-hash the source data with SHA-256"**,
   not a translation. A Bubble app's stored MD5 fingerprints will not reproduce here.

### 7.4 What the gate taught, which is worth keeping

The example validator is strict and it caught two real authoring errors that would have shipped as
teaching:

- **A signal wired into a value input.** `done` into a Text's `visible` reads as "show this when it
  succeeds" and actually holds **false**, because a signal is played true-then-false in one pass. The
  fix is a `Switch` latching the pulse into remembered state. It refused this twice, in two different
  examples, which is a fair sign of how easily it is written.
- **An unwired third outcome.** A node routing `done` and `failure` to different places but leaving
  `unchanged` dangling is a chain that silently stops. Chasing that down improved the design rather
  than just the wiring: `noodl.cloud.createuser`'s `unchanged` **still publishes `userId`**, carrying
  the existing account, so routing it onward makes a provisioning function idempotent in one wire.
  The gate's complaint was the better design.
