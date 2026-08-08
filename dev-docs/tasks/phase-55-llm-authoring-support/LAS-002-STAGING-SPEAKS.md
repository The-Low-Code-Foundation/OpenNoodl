# LAS-002 — Staging speaks: diagnostics, not counts

**Status:** 📋 open · **Track 1 (gates)** · fixes audit **F6** (= phase-54 register F6, filed
2026-08-08 and confirmed unfixed by this phase's audit)

## The defect, measured

`stage_plan_operation` returns `{"staged":"op-4","warnings":1}` — a count, no text, no way to read
a *staged* candidate's diagnostics
([planTools.ts:504](../../../packages/noodl-mcp/src/tools/planTools.ts#L504), the `warnings:
validation.warnings` field; `validateStaged` throws away the diagnostic objects at
[planTools.ts:217-221](../../../packages/noodl-mcp/src/tools/planTools.ts#L217)).

Consequence in all three measured builds: `repeated-sibling-subtree` — the only architecture gate
in the system — fired **at the moment the agent could act on it** and was delivered as an opaque
integer. Haiku shipped two trios; the baseline shipped three; nothing ever saw the words.

## Build

1. **`validateStaged` keeps the warnings.** Return `{ ok, errors, warnings: Diagnostic[] }`
   (objects, not a count). Format with the same `formatDiagnosticLine` the rejection path uses —
   one dialect, no second renderer.
2. **Every authoring door returns them:**
   - `stage_plan_operation` — response gains `warningDiagnostics` (readable lines) alongside the
     existing count (keep the count for compatibility with anything parsing it).
   - `create_component` / `update_component` — verify what `successPayload(validation)`
     ([author.ts:305](../../../packages/noodl-mcp/src/tools/author.ts#L305)) actually includes
     today; if it is also count-only, give it the same lines.
   - `apply_plan` — the final response lists any warnings that survive across the applied set.
3. **The editor loop gets the same payload** through the shared validate module
   (`authoring/validate.ts`) — verify whether the in-editor refine loop already surfaces warning
   text to the model; if it does, reuse its formatting; if not, this task fixes both clients from
   the one module (the AAQ-005 rule).
4. Note for LAS-007: this response field is where attached examples will ride — shape it as
   structured entries (`{ code, message, location }`), not a pre-joined string, so the mapping
   table can key on `code`.

## Acceptance

- Stage a trio-of-siblings candidate → the response contains the `repeated-sibling-subtree`
  message text verbatim, with node location.
- A clean candidate stages with an empty array — no noise.
- Jest pins the response shape for all four doors (the noodl-mcp suite is a gate —
  `packages/noodl-mcp` jest).
- Update phase-54's README register row F6 to ✅ with the commit hash, and this phase's README row
  F6 likewise. Registers outlive their fixes — close both.

## Register

| # | Finding | State |
|---|---|---|
| — | | |
