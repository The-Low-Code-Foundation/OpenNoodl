# SBR-012 — The raw-colour gate

**Workstream B's enforcement.** The rule that keeps SBR-003..009 true after this phase ends.
🧭 Scoped down from the screens artifact's "no component may set a raw value" (unenforceable as
stated) to what a gate can actually hold: **no raw colour anywhere in the template, and every
consumed token resolves** — plus a named-exemption audit for non-token dimensions.

## 1. What exists to build on

- `DiagnosticCode.RawColorLiteral` (`validation/parameterValues.ts:976`, regex at `:578`) —
  already detects `#hex`/`rgb()`/`hsl()` in color-typed ports; **warning by design** (the wider
  corpus carries 553 and imported content is not wrong for being untokenised). The template
  gate promotes it to FAIL **for this template's populations only** — do not touch the global
  severity.

## 2. Scope

- A gate (jest, beside the sb-007 family) that fails on:
  1. any raw colour in the site-builder **component sets**;
  2. any raw colour in the **generated artefact** (two populations — both, always);
  3. any `var(--x)` whose `--x` resolves in neither `DefaultTokens` nor the template's
     `designTokens` block nor the Theme-record schema (the typo'd token renders as *nothing* —
     an absence the RawColor check cannot see);
  4. 🔴 the hole shaped like the defect: RawColorLiteral only reads **color-typed ports**. A
     hex smuggled through a `*`-typed port, a Script body, or `applyTheme`'s own literals
     evades it — the artefact-level scan is therefore textual over parameter values AND script
     sources, with the `designTokens`/preset-data blocks as the one allowed home for literals.
- The dimension audit: non-token spacing/width values are listed in a named exemption constant
  with a reason each — additions red the gate until named (the REMOVED_BY_SB018 pattern: an
  exemption, not a relaxation).

## 3. Acceptance criteria

1. Green at the phase's end state; **red on a planted hex** in (a) a color port, (b) a script
   body, (c) the artefact only (regeneration drift) — known-good and known-broken must
   disagree, demonstrated in the suite itself.
2. Red on a planted `var(--tpyo)`.
3. The exemption list is empty or every entry carries a reason.
4. Runs in `test:ci` (registered in the spec barrel — an unexported spec never runs).

## 4. Traps

- 🔴 A new checker's first finding is about the checker — calibrate on HEAD before believing
  any red.
- 🔴 Strip comments before counting; measure the artefact, not the task file.
