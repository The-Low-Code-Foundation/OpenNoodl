# LAS-002 — Staging speaks: diagnostics, not counts

**Status:** ✅ done 2026-08-08 · **Track 1 (gates)** · fixes audit **F6** (= phase-54 register F6,
filed 2026-08-08 and confirmed unfixed by this phase's audit — both rows now closed)

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

## What was actually broken — half of the build was already done

The task said "verify what `successPayload` includes today" and "verify whether the in-editor refine
loop already surfaces warning text". Both verifications came back **already correct**, which is the
finding:

| Door | Before | Change |
|---|---|---|
| `stage_plan_operation` | `warnings: 1` — a count | ✅ gains the `validation` block |
| `apply_plan` | said nothing about surviving warnings at all | ✅ gains the aggregated block |
| `create_component` / `update_component` | already returned the full `Diagnostic[]` via `successPayload` ([author.ts:205](../../../packages/noodl-mcp/src/tools/author.ts#L205)) | none needed — now pinned by a spec so it stays that way |
| editor refine loop | already formats every warning back to the model with `formatDiagnosticLine` ([AuthoringSession.ts:905-920](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/AuthoringSession.ts#L905)) | none needed |

**So the editor client was never the one that whispered — only the MCP plan path was.** That is the
same asymmetry LAS-008 found from the other side (the retrievable recipes were right, the pushed
prompt was wrong): the seam a human watches got fixed, the one only an agent reads did not.

## Acceptance

- ✅ Stage a trio-of-siblings candidate → the response contains the `repeated-sibling-subtree`
  message text verbatim, with node location.
- ✅ A clean candidate stages with no `validation` block at all — omitted rather than emitted empty,
  because a door that always speaks is a door nobody reads.
- ✅ Jest pins the response shape for all four doors:
  [`tests/stagingDiagnostics.test.ts`](../../../packages/noodl-mcp/tests/stagingDiagnostics.test.ts)
  — 2 failed / 2 passed before (the two that passed are the two doors that were already correct),
  4/4 after. noodl-mcp suite **19 suites / 200 specs**.
- ✅ phase-54 README F6 and this phase's README F6 both closed.

## Register

| # | Finding | State |
|---|---|---|
| 1 | `stage_plan_operation` threw the diagnostic objects away in `validateStaged` and returned a count — the only architecture gate in the system reached three measured builds as the integer `1` | ✅ fixed |
| 2 | `apply_plan` re-validated the whole applied set and then discarded every non-blocking diagnostic it had just computed. Not in the task's list; found while wiring `validateStaged` | ✅ fixed — aggregated across the set, each entry carrying `location.component` so a five-component apply stays legible |
| 3 | `create_component`/`update_component` and the editor's refine loop were **already** speaking full diagnostics. Half of this task did not need building — it needed checking, and the checks are now specs | 📌 verified, pinned |
| 4 | The `validation` block is typed as the same `WriteValidationSummary` the author doors return, so the two paths cannot drift into two dialects without failing to compile | 📌 shape decision, for LAS-007 |
