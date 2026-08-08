# LAS-003 — Value-format gates: layoutString, the unsized absolute Group, raw hex

**Status:** 📋 open · **Track 1 (gates)** · fixes audit **F3** and **F7**, plus makes the
"never raw hex" instruction checkable

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

## Register

| # | Finding | State |
|---|---|---|
| — | | |
