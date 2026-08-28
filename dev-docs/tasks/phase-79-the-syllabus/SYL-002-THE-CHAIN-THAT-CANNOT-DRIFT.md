# SYL-002 — the chain that cannot drift

| Field | Value |
|---|---|
| **Prefix** | `SYL` |
| **Effort** | S |
| **Surface** | `scripts` (`check-lesson-bundles.ts` or a sibling), CI |
| **Rules** | [R1](RICHARD-RULINGS-2026-08-28.md#r1--the-pet-spine-stands-as-written) |
| **Blocked by** | **two spine lessons existing.** Nothing to compare before that — start it the day lesson 2 lands, not sooner |

## The job

R1 accepted the spine as written: twelve lessons, each `needs`ing the one before, **all building one
app**. That makes a claim nothing currently checks:

> **`starter(N)` must equal `solution(N-1)`.**

If it does not, the learner finishes lesson 3 with an app that is not the app lesson 4 starts from,
and every completion condition after the divergence grades against a project the learner never had.

## Why this cannot be left to the existing gate

`derive_starter` produces a starter by **subtracting a lesson's own steps from its own solution**.
That is a *within-lesson* invariant and it is already sound — it is why a starter cannot drift from
the solution it came from. **It says nothing about the lesson before.**

So the two failures look identical from inside one bundle:

| | lesson 3 alone | the chain |
|---|---|---|
| starter derived from its own solution | ✅ passes | ✅ passes |
| starter equals lesson 2's finished app | not asked | 🔴 **can be false** |

🔴 **This is the hole-shaped-like-the-defect shape.** A per-bundle gate that passes on every bundle
individually is exactly the instrument that would exonerate a spine that has come apart, and the
existing `npm run lessons:check` is that gate. A green corpus is not evidence for the chain claim,
because the chain claim is not in the corpus.

## Scope

1. Read the **order from `curriculum.json`** (the community repo's file), not from a list in the
   checker. ⚠️ Adding a lesson must stay a data edit — that is the curriculum file's whole stated
   reason for existing, and a checker that hardcodes the spine re-breaks it.
2. For each adjacent pair in a path, compare `starter(N)` against `solution(N-1)`.
3. Compare **graph-meaningfully**, not byte-wise. A project directory carries ids, timestamps and
   editor bookkeeping that differ across two saves of an identical app; a byte compare would be red
   on day one and get switched off.
4. Report the **first divergence per pair**, named — which component, which node — not a diff dump.
5. CI job, beside `lessons:check`.

## Acceptance criteria

1. Two adjacent built lessons pass.
2. 🔴 **A deliberately broken chain is RED** — take lesson N's starter, add one node, and watch it
   fail. **A checker whose first run finds nothing has graded the checker, not the corpus**; the
   red row is the one that proves it works.
3. 🔴 **A pair that is fine for the WRONG REASON is caught**: two *empty* projects also compare
   equal. Assert the comparison saw a non-trivial graph, or an unbuilt lesson reads as a passing
   chain.
4. Lessons in **different paths** (the spine vs Data vs Custom nodes) are not compared to each
   other — `needs` crosses paths (`queries-that-do-not-lie` needs `a-cupboard-that-remembers`, a
   spine lesson), so the pairing follows `needs`, **not array position**.
5. An `in-writing` lesson with no bundle is **skipped and reported as skipped**, never counted as a
   pass. ⚠️ Today that is all sixteen of them, so the honest first output is *"0 pairs checked"* —
   and it must say so rather than exiting 0 in silence.

## Traps

- 🔴 **AC5 is the whole risk.** A chain checker over a curriculum with no bundles has nothing to do
  and will exit 0 — indistinguishable from a healthy spine. It must print its denominator.
- ⚠️ The community repo is a **separate checkout**. Decide whether the checker reads `curriculum.json`
  from a path, a copy, or a fetched artefact — and if it is a copy, **it is a second copy of a fact
  and will drift**. Prefer reading the real file over vendoring it.
- ⚠️ Do not make this a step in the install path. D17: a lesson stays installable from a local
  directory with no origin, and that includes one whose neighbours are absent.
