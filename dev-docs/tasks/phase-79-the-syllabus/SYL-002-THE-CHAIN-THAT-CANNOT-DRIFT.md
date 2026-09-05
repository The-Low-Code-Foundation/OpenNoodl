# SYL-002 — the chain that cannot drift

| Field | Value |
|---|---|
| **Prefix** | `SYL` |
| **Effort** | S |
| **Surface** | `scripts` (`check-lesson-bundles.ts` or a sibling), CI |
| **Rules** | [R1](RICHARD-RULINGS-2026-08-28.md#r1--the-pet-spine-stands-as-written) |
| **Blocked by** | ~~two spine lessons existing~~ — **unblocked 2026-09-05, seven now ship** |
| **State** | 🟢 **BUILT 2026-09-05 (session 10).** `npm run lessons:chain` + `:self-test`, both in CI. **All five ACs met.** 6 adjacent pairs compared and holding; 12 mutations, 0 uncaught. See *What was built*, below |

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

---

## What was built — 2026-09-05, session 10

`npm run lessons:chain` ([scripts/check-lesson-chain.ts](../../../scripts/check-lesson-chain.ts)) and
`npm run lessons:chain:self-test`, both wired into `pr.yml` beside `lessons:check`.

```
✔ it-breaks-on-a-phone  ←  your-creature-on-screen  — starter matches the previous solution (2c/6n)
✔ poke-it               ←  it-breaks-on-a-phone     — starter matches the previous solution (2c/11n)
✔ it-forgets-you        ←  poke-it                  — starter matches the previous solution (2c/15n)
✔ show-what-it-feels    ←  it-forgets-you           — starter matches the previous solution (2c/18n)
✔ moods                 ←  show-what-it-feels       — starter matches the previous solution (2c/21n)
✔ it-gets-demanding     ←  moods                    — starter matches the previous solution (2c/25n)
· your-creature-on-screen — chain head, no predecessor to compare.
· log-a-thing — standalone, deliberately outside the spine.

6 adjacent pair(s) compared, 0 diverged, 0 skipped, 1 chain head(s), 1 standalone.
```

### 🔴 The gate's first run found a real divergence — in `curriculum.json`

The one thing the scope was most specific about (*"read the order from `curriculum.json`"*) turned out
to be the thing that was wrong. **`curriculum.json` had never gained `it-breaks-on-a-phone`** — the
lesson [R2](RICHARD-RULINGS-2026-08-28.md#r2--responsive-layout-becomes-a-new-spine-lesson) ruled into
the spine at position 2 — and so claimed `poke-it` follows `your-creature-on-screen`.

**Six lessons had shipped against an order the published syllabus did not describe.** Measured:

```
=== ACTUAL built order ===            === CURRICULUM order ===
it-breaks-on-a-phone ← lesson 1  ✅    poke-it ← your-creature-on-screen
poke-it ← it-breaks-on-a-phone   ✅      → differs in: ['Pages/Home/nodes.json']
```

Fixed in the community repo the same session (Richard's call, asked and answered): lesson 2 inserted
at position 2, `poke-it.needs` repointed, the spine `lede` corrected from *"Twelve lessons"* to
*"Thirteen"*.

### The three decisions, and why

| decision | why |
|---|---|
| **Order lives in [`project-examples/lessons/spine.json`](../../../project-examples/lessons/spine.json)** | Not `lesson.json`: UNI-022 states the boundary deliberately — *"What is NOT in a manifest is curriculum-level: order, prerequisite, and state."* Not `curriculum.json` alone: CI has no community checkout, so that gate would report *"0 pairs checked"* forever. Not a vendored copy: that file describes 16 lessons, 9 with no bundle |
| **The two copies are gated against each other** | They ARE two statements of one fact and they will drift. Whenever the community file is reachable, every slug is cross-checked and disagreement FAILS. ⚠️ **This is the arm that found the drift above** |
| **A DENYLIST, not an allowlist, of compared fields** | Excluded: `x`/`y`, `metadata`, `$schema`, `version`. Everything else compared. 🔴 An allowlist silently stops comparing the day a node gains a field, and the divergence walks through. A denylist fails closed |

⚠️ **A byte compare would have been green today** — all six pairs are byte-identical, because
`derive_starter` copies — **and that is exactly why it was not used.** The first legitimate re-save
that nudges a node turns it red, and a gate that reddens for a reason nobody cares about is a gate
somebody switches off. Canvas moves are excluded from equality but **reported as a note**, so the
exclusion is never a silent blind spot.

### Acceptance criteria

| AC | state | evidence |
|---|---|---|
| 1. Two adjacent built lessons pass | ✅ | six pairs, not two |
| 2. 🔴 A deliberately broken chain is RED | ✅ | 5 graph mutations + a repointed `needs`, each caught and NAMED (`node board-0001 (type Group, label "Board")`) |
| 3. 🔴 Fine-for-the-wrong-reason is caught | ✅ | the two-empty-projects arm: a comparison that saw no nodes FAILS rather than passing |
| 4. Pairing follows `needs`, not array position | ✅ | `spine.json` states `needs` per lesson; cross-path prerequisites work by construction |
| 5. An unbuilt lesson is skipped, never passed | ✅ | arm asserts BOTH the `⊘ … SKIPPED` line and that the denominator drops 6→5 |

### Traps this paid for

- 🔴 **The self-test read the developer's real community checkout**, so two arms passed here and
  would have gone red in CI — for a reason having nothing to do with the corpus. It now writes a
  curriculum **fixture derived from `spine.json`**. ✅ **A self-test that only works where somebody
  happens to have a sibling repo checked out is not a self-test.**
- ⚠️ **Two arms first read as "NOT caught" when the gate was right and my expectation was wrong** —
  it reported the divergence in the opposite direction to the phrase I predicted, and it correctly
  exited 0 on a skipped lesson. ✅ **A failing arm is a claim about the expectation as much as
  about the code.**
- ⚠️ **`expect: 'SKIPPED'` alone would pass on a gate that printed the word and counted the pair
  anyway.** Arms now assert the denominator moved, not just that a sentence appeared.
- ⚠️ `curriculum.json` does not round-trip through `json.dumps` — its `nodes` arrays are kept on one
  line by hand (662 bytes of reformatting). ✅ **Edited surgically as text.**

### Left open, deliberately

- ⬜ **`state` in `curriculum.json` is still `in-writing` for all thirteen spine lessons.** The seven
  that ship are built, gated and driven — but their **prose is still a draft awaiting Richard**, and
  `LessonState` has only `ready | in-writing`. `ready` would claim the writing is finished. One-line
  change per lesson when the prose lands.
- ⬜ **Four comments in the community repo still say "fifteen lessons"** (`curriculum.ts:111`,
  `pathing.ts:24`, `university/page.tsx:27-28`, `me/assignments/[id]/lesson/route.ts:15`). Prose, not
  code; now sixteen. Not edited — flagged rather than swept into this change.
