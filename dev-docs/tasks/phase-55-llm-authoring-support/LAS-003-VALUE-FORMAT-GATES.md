# LAS-003 — Value-format gates: layoutString, the unsized absolute Group, raw hex

**Status:** 🟡 check 1 done 2026-08-08 (F3) · checks 2 (F7) and 3 (hex) open · **Track 1 (gates)**

## The defects, measured

1. **F3:** haiku emitted `layoutString: "1fr 1fr 1fr 1fr"` (CSS Grid dialect). The runtime
   silently fails to parse it and renders **one column, even at desktop** — the entire point of
   using `Columns` (the only node that reflows) voided by a string format, with 0 diagnostics.
2. **F7:** sonnet's badge pill — a `position: absolute` Group with **no width/height**. Group
   dimensions default to `%`, so the unsized pill fills its parent: parent-sized `--primary`
   ellipses over 4 of 6 product photos, and the basket count stretched across the full navbar
   ([measurements/sonnet-full.png](measurements/sonnet-full.png)).
3. **Hex:** the server instructions say `var(--token)`, "never raw hex/px" — prose with no check
   behind it (verified: no hex rule exists anywhere in `validation/rules/`).

## Mechanism to verify before building

- **Where value-level checks live.** Phase 38/AIB-001 built the parameter-value contract
  (`invalid-parameter-value` diagnostics — haiku's replay was rejected by them for `"100%"` and
  string `iconSize`, so the layer exists and works). Find it (likely in the semantic validator
  beside the catalog's type info) and add these checks there, NOT as new standalone rules, unless
  the existing layer turns out to be structured per-type — follow its shape.
- **The real `layoutString` grammar.** Read `partitionColumnChildren` / the Columns node source in
  the runtime for what it actually parses (the recipes say `"1 1 2"` integers-and-spaces; verify
  whether other tokens are legal before rejecting them). The 35 corpus specs pinning Columns are
  the reference.
- **The dimension-default claim behind F7.** The audit inferred "unsized absolute Group fills its
  parent" from the render; confirm the mechanism in the runtime's Group sizing defaults before
  writing the diagnostic text.
- **Which ports are colour-typed / token-eligible** — from the enriched catalog
  (`node-catalog-enriched.json` is the file the validator indexes; phase-54 F1's lesson: regen it
  if the check needs data it lacks, and run all three catalog gates).

## Build

1. **`layoutString` grammar check** — on `layoutString`, `mediumLayout`, `smallLayout` of
   `net.noodl.visual.columns`. Error message includes the corrected string ("did you mean
   `\"1 1 1 1\"`" for the fr case — strip units, keep ratios). **Authored-blocking (error) from
   day one**: no legitimate population can exist for a string the runtime cannot parse — but
   corpus-run anyway to be sure, per the standing habit.
2. **Unsized absolute Group** — `position: absolute` and neither `width` nor `height` set →
   warning naming the mechanism ("dimensions default to %, this will fill its parent"). Corpus-
   calibrate severity; expected: authored-blocking candidate, project-wide warning.
3. **Raw hex / raw px on token-eligible ports** — colour parameters matching `#…`/`rgb(`/`hsl(`
   where the style vocabulary offers tokens → warning pointing at `get_style_vocabulary`. Spacing/
   radius bare-px is noisier — measure the corpus before including it at all; if the hit count is
   large, ship colour-only and record the decision. Expected end state: authored-blocking, corpus
   untouched (imported projects are full of hex by construction).

## Acceptance

- Haiku's exact `FeaturedProducts` candidate rejects on `"1fr 1fr 1fr 1fr"` with the corrected
  string in the message; restaged with `"1 1 1 1"` it passes.
- Sonnet's `Cards/Product Card` Badge group draws the F7 warning (and after LAS-002, the staging
  response shows its text).
- A `backgroundColor: "#B3542E"` candidate warns and names the nearest/first token source.
- Jest per check; corpus runs recorded in the register; catalog gates green if the enriched
  catalog was touched.

---

# Check 1 — `layoutString` grammar ✅ done 2026-08-08

## ⚠️ The grammar this task described is wrong, and building to it would have shipped a bad gate

This task said "integers and spaces (`"1 1 2"`)". The `ui-*` recipes say the same. **The runtime
does not agree.** `readLayoutToken`
([Columns.tsx](../../../packages/noodl-viewer-react/src/components/visual/Columns/Columns.tsx)) is:

```ts
const fraction = Number(token);
return Number.isFinite(fraction) && fraction > 0 ? fraction : undefined;
```

and its own docblock records *why* it is `Number`: `parseInt` had silently truncated `"1 2.5 1"` to
`1 2 1`, and nothing downstream assumes integers because `_calcAutofold` only ever sums and divides.
`Number` rather than `parseFloat` for the opposite reason — `parseFloat` reads a *prefix*, turning
`"1abc"` into `1`.

**So fractional proportions are legal**, and a gate built on this document's stated grammar would
have rejected `"1 2.5 1"` — a validator inventing a constraint the thing it guards does not have,
which is the most expensive kind of false positive here (diagnostics feed an automated repair round;
the agent is told never to argue with one). This is the phase's own rule paying for itself: *read
the mechanism in source before trusting any stated fact* — including facts stated by this phase.

The implemented predicate mirrors `readLayoutToken` exactly, with a docblock naming it as the
authority, and the spec pins the divergent cases (`1 2.5 1` accepted, `1abc` rejected, `0`/`-1`
rejected, double-space tolerated because `describeLayoutString` deliberately declines to report it).

## Corpus calibration — measured, not assumed

| Corpus | Files | Columns nodes | Violations |
|---|---|---|---|
| Legacy (`project.json`) | 91 projects, 5,509 nodes | **0** | 0 |
| v2 (`nodes.json`) | 67 files | 8 | **2** |

Two things fall out of that table:

1. **Zero false-positive surface.** Authored-blocking `error` from day one is confirmed safe rather
   than merely argued for.
2. **`Columns` appears in zero of the 91 corpus projects.** The one node in the runtime that can
   reflow is absent from every piece of shipped content a model could learn the pattern from. The
   recipes are the *only* place it exists — which is why LAS-007 (push, not pull) matters more than
   its position in the dependency graph suggests.

Both violations are in `phase55-replay-haiku` — and **the audit found one of them, not two**:
`FeaturedProducts` (`"1fr 1fr 1fr 1fr"`, the known F3) *and* `BrowseCategories` (`"1fr 1fr 1fr"`,
previously unrecorded). Haiku made the same mistake twice; hand-inspection caught it once.

## Acceptance — check 1

- ✅ Haiku's exact candidate rejects with `suggestion: "1 1 1 1"` — the corrected string, not advice.
- ✅ Restaged with `"1 1 1 1"` it passes.
- ✅ 10 specs in
  [`tests-unit/phase-55/layoutStringGrammar.test.ts`](../../../packages/noodl-editor/tests-unit/phase-55/layoutStringGrammar.test.ts)
  — 6 failed / 4 passed before (the 4 were the accepts-legal-input cases), 10/10 after.
- ✅ Editor jest **73 suites / 992 specs**; `typecheck:editor` clean; noodl-mcp 19/200 unaffected.

## Register

| # | Finding | State |
|---|---|---|
| 1 | **This task doc and the shipped `ui-*` recipes both state the `layoutString` grammar wrong** — "integers and spaces". The runtime accepts any positive finite `Number`, decimals included, deliberately | ✅ implementation follows source; recipes/doctrine text not yet corrected — **carry to LAS-007** |
| 2 | Haiku emitted the CSS Grid dialect **twice**, not once — `BrowseCategories` was missed by the hand audit. Found by the corpus scan, not by reading | 📌 the audit's own numbers were low; a scan beats an inspection |
| 3 | `net.noodl.visual.columns` occurs **0 times in 91 corpus projects**. No shipped content teaches the only responsive node in the runtime | 📌 raises LAS-007's priority |
| 4 | The suggestion is offered only when *every* token repairs by stripping a unit. `repeat(2, minmax(0, 1fr))` gets an error with no suggestion — an agent is told never to argue with a diagnostic, so a partial guess would be auto-applied and wrong | 📌 design decision |
| 5 | The check lives in `parameterValues.ts` beside `unitSuffixTrap` rather than in the `FORMATS` table: `layoutString` is typed `string`, so every string passes the per-port-type layer. The constraint is the **node's**, not the port type's | 📌 shape decision |
