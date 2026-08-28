# EXP-011 — Close the picker gap, ranked by what apps need

**Status:** 🔴 Not started (new, 2026-08-28, session 32)
**Depends on:** nothing — but sequenced after EXP-009 and EXP-010, which are worth more per hour
**Replaces:** every "what to build next" list in this phase from sessions 20–31

---

## §1 The gap, measured

```
node scripts/export-ledger/picker-coverage.js
```

> **PICKER COVERAGE: 51 of 127 placeable nodes export (40.2%)** — 2026-08-28

| category | nodes a user can place and cannot export |
|---|---|
| **Data** | 27 |
| **Utilities** | 16 |
| **Cloud Services** | 9 |
| **Navigation** | 5 |
| **Variables** | 4 |
| Visual · Component Utilities | 3 · 3 |
| CustomCode · Animation · String Manipulation | 2 · 2 · 2 |
| Interpolation · Math · Logic | 1 · 1 · 1 |

The full list regenerates from the script; do not paste it into docs where it will go stale.

## §2 First, fix the corpus — this task is worthless without it

🔴 **Do not rank this work with `coverage-audit.ts` / `rank2.ts`.** That is the instrument that
cost this phase twelve sessions (README § *What went wrong*). It is weighted by ~40 old drive
fixtures, 83% of its remaining complaints are one unplaced third-party Noodl prefab, and it is
structurally blind to any node those projects never used — which is most of this gap.

The corpus stays as a **regression net**. Alongside it, build a small set of projects that exist
to exercise the picker:

- Built in the **0.2.0 editor** and by the **MCP**, not hand-edited JSON.
- One per gap cluster below, each a small app that a person would plausibly build.
- Each placed on a routed page and actually rendering — session 31 found 20% of the old corpus is
  in components no route reaches, which is code no metric should be counting.
- Added to `projects.txt` and to `build-corpus.ts`, so they gate.

**A slice is not done until a project in this set exports and runs.**

## §3 The ranking, by what an app needs

Ranked by *"can you build a normal app without it"*, not by corpus frequency.

### Tier 1 — an ordinary app hits these on day one

1. **The client-side data vocabulary (Data, ~10 of the 27).** `Object`, `Set Object Properties`,
   `Create New Array`, `Clear Array`, `Remove Object From Array`, `Array Filter`, `Array Map`,
   `Repeater Item`. This is how anyone holds a working set of rows in the UI. It is also the
   honest, NodeGX-shaped version of the `Model2` work sessions 17–31 kept circling — with the
   difference that this time it is aimed at what the picker offers, not at a legacy prefab's use
   of it. **[EXP-002-MODEL2-TARGET-OUTPUT.md](./EXP-002-MODEL2-TARGET-OUTPUT.md) §4's design is
   still good and should be reused; §2, §3 and §7's ranking are void.**
2. **`HTTP Request`.** Any app that talks to anything that is not its own backend.
3. **The date family (Utilities, 6).** `Now`, `Date To String`, `Date Add`, `Date Compare`,
   `Date Difference`, `Date Parts`. Anything with a timestamp needs at least two of these.
4. **`String` / `Number` / `Boolean` / `Color` (Variables, 4).** The plain value nodes. Cheap, and
   embarrassing to be missing.

### Tier 2 — common, not universal

5. **Navigation (5).** `Page Inputs` is the important one — no path parameters means no detail
   pages. Then `Navigate To Path`, `External Link`, the component stack pair.
6. **Cloud Services (9).** Mostly **unblocked by EXP-009**, and several may fall out of it for
   free — `Cloud Function`, `Record`, `Set User Properties`, `Sign In With`. Re-measure after
   EXP-009 lands rather than planning against today's list.
7. **String/Math utilities (4).** `Substring`, `String Mapper`, `Number Remapper`, `UUID`.

### Tier 3 — real, but a smaller audience

8. **`States` and `Animate To Value`** — the animation pair. Genuinely hard (they are time-based
   and stateful) and worth doing properly rather than early.
9. **`CSS Definition` and `Script`** — global CSS and arbitrary script. `CSS Definition` looks
   trivial and ⚠️ **every instance in the current corpus is the empty stub `".group1 "`, so it
   would buy nothing measurable there** — build it against a real project, not the corpus.
10. **`Component Children`, `Drag`, `Component Stack`, the parent-object family.**

### Not a target

`Action Dispatcher` / `Action Handler`, `Optimistic Update`, `State History` / `Undo / Redo`,
`Stream Buffer`, `SSE`, `WebSocket`, `JSON Stream Parser`, `Parse CSV` / `To CSV`,
`Pattern Extractor`, `Text Accumulator`, `Run Tasks`, `On App Error`, `Screen Resolution`,
`Gyroscope`, `Open File Picker`, `Random Bytes`, `Hash`.

These are real nodes and some are excellent, but they are specialist. **Say so in the ledger's
exemption sentence** rather than leaving them looking like a backlog — an exemption that names a
node as deliberately out of scope is a decision; one that says "pre-gate backlog" is a to-do
nobody will ever do. Most of the current 101 exemptions say the latter, verbatim.

## §4 Acceptance criteria

1. **The picker number moves and holds.** Every slice raises `pickerCoverageFloor` in the same
   commit — `export-ledger:picker` fails if it does not.
2. **Tier 1 complete ⇒ 51 → ~72 of 127 (≈57%).** Tiers 1+2 ⇒ ≈87 (≈68%). Everything except the
   "not a target" list ⇒ ≈108 (≈85%).
3. **Each slice has a picker-exercising project** that exports, builds and runs (§2).
4. **The exemption sentences get rewritten** so that "deferred" means one of *deliberately out of
   scope* (with the reason) or *scheduled* (with the tier), never "pre-gate backlog".

## §5 A standing rule for this task

**Rank by the picker; verify against a project someone would actually build; never let the corpus
choose the work.** If a future session finds itself reading a deferral census to decide what to do
next, it has taken the wrong turn — that census answers "did I break anything", and nothing else.
