# SUB-011: Expression Parameters and the Substrate — Fixture, then Decision

## Metadata

| Field | Value |
|-------|-------|
| **ID** | SUB-011 |
| **Phase** | Phase 13 — Format & AI Substrate (follow-on, created 2026-07-24) |
| **Priority** | 🟡 Medium (the fixture half is 🟠 High — it guards against silent data loss) |
| **Difficulty** | 🟢 Easy (fixture) + 🔵 decision (posture) |
| **Estimated Time** | 2–3 days fixture + verification; embrace-path work is scoped separately if chosen |
| **Prerequisites** | None for the fixture. DEBT-003 (expressions cannot see Variables) should be resolved before any *embrace* work — no point teaching agents to emit expressions against a broken evaluator |
| **Branch** | `task/sub-011-expression-parameters` |
| **Recommended executor** | 🟢 **Sonnet 5** for the fixture; 🔵 **Fable 5** for the posture decision (it defines what "a valid graph" means) |

## Objective

Close the untested gap between the shipped inline-expression feature and the v2 substrate: add round-trip fixtures for object-valued expression parameters, then make a deliberate, recorded decision — **embrace** (teach catalog/validator/MCP/authoring about inline expressions) or **freeze** (keep it working for humans, defer substrate integration) — instead of leaving the substrate blind by accident.

## Background

The salvage audit ([PRE-REVIVAL-SALVAGE-AUDIT.md](../../reviews/PRE-REVIVAL-SALVAGE-AUDIT.md) §3) corrected an assumption: the "expressions as values" attempt (phase-3 TASK-006/006B — the n8n-style `fx` toggle on property fields) **shipped and works end-to-end** for text/number properties. Evaluation lives in the typed runtime (`node.ts:137-205`, invoked from `setInputValue`), with reactive re-evaluation and subscription cleanup; the editor UI is live in `BasicType` ports via `PropertyPanelInputWithExpressionModal`.

The problem is what it does to the substrate's implicit contract. An inline expression turns a stored parameter from a primitive into `{mode: 'expression', expression, fallback, version}` on a port still typed `string`/`number`. Today nothing breaks — because everything downstream ignores parameter values:

- **SUB-002's round-trip corpus has no fixture** for object-valued parameters. Fidelity is *untested*, not proven. If a future normalization or typed serialization pass mishandles the object form, user expressions get silently mangled — the exact class of loss SUB-002 exists to prevent.
- **SUB-006's validator** normalizes nodes without parameter values (`validation/model.ts` `NormNode`); it cannot see the implicit data-flow binding an expression creates, and if it ever grows parameter/type checking, the object form reads as invalid without an explicit carve-out (the same shape as the existing dynamic-port carve-outs).
- **SUB-008's MCP surface** has no expression awareness: agents reading a project see opaque blobs; authoring agents don't know the object form exists.

The fixture half of this task is unconditional. The posture half is a genuine product decision: inline expressions are a massively terser way for agents to express bindings than wiring Expression nodes (it is the n8n idiom), but embracing them widens what every substrate tool must understand.

## Current State

See the audit §3 for the full inventory. Key files:

- Runtime: `packages/noodl-runtime/src/expression-evaluator.js` (314), `expression-type-coercion.js` (111), `node.ts` `_evaluateExpressionParameter` (:137-205)
- Editor: `models/ExpressionParameter.ts` (170 — type guards, factory, serialization helpers), `ParameterValueResolver.ts`, `DataTypes/BasicType.ts` (dispatched from `Ports.ts:401`)
- UI: core-ui `ExpressionInput`/`ExpressionToggle`/`PropertyPanelInput`; `ExpressionEditorModal`
- Only `BasicType` (string/number) ports have the UI; color/enum/boolean were specced, never wired
- Related defect: **DEBT-003** — expressions cannot see Variables (15 failing runtime tests); same evaluator

## Desired State

1. **Fixture (unconditional):** SUB-002's corpus includes components carrying expression parameters (with fallbacks, with special characters in the expression string, on both string and number ports); whole-object round-trip tests pass; first-save normalization (the SUB-010 finding) proven not to strip or rewrite them.
2. **Posture (decided and recorded):** a short decision section appended to this file, choosing:
   - **Embrace** — follow-up scope: validator awareness (recognize the object form; skip type checks on expression-mode parameters, mirroring dynamic-port carve-outs; optionally surface the dependency as information), MCP read/write support (`ExpressionParameter.ts` guards reused, not reimplemented), authoring-loop emission guidance, and *only then* consider extending the UI to more port types.
   - **Freeze** — the feature stays as-is for humans; the fixture guards it; substrate integration re-evaluated after Gate G2; explicitly: do **not** extend the UI to more port types while frozen (that widens the blind spot).

## Scope

### In Scope
- [ ] Round-trip fixtures + tests for object-valued expression parameters (SUB-002 corpus)
- [ ] Verify first-save normalization and the v2 open path leave them intact
- [ ] Verify SUB-006 emits no false findings on a corpus project containing them (it shouldn't — prove it)
- [ ] The posture decision, recorded here with reasoning
- [ ] If **embrace**: write the follow-up scope as concrete work items (likely a small task per tool: validator, MCP, authoring guidance)

### Out of Scope
- Fixing the evaluator's Variables visibility (DEBT-003)
- Extending the `fx` UI to more port types (gated on an *embrace* decision + its follow-ups landing)
- Export semantics for expressions (Phase 18's known-hard problem; the viability report already flags runtime-interpreted expressions as export-resistant)

## Implementation Steps

1. **Fixtures**: hand-author + capture-from-editor components with expression parameters; add to the SUB-002 corpus with whole-object assertions.
2. **Round-trip + normalization runs**; fix nothing silently — if loss is found, that's a finding to record and fix visibly.
3. **Validator run** over the fixture project; assert zero expression-caused findings.
4. **Decide the posture** (the decision-maker should read the audit §3 and AIX-002's current emission format first); record it below.
5. If embrace: **write the follow-up items** with owners/phases.

## Success Criteria

- [ ] Corpus round-trips expression parameters losslessly, proven by tests
- [ ] Normalization/open paths verified intact
- [ ] Validator confirmed silent on expression parameters
- [ ] Posture decision recorded here with reasoning and (if embrace) concrete follow-up scope

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Fixture reveals actual round-trip loss | That is the fixture doing its job — record and fix visibly; this is exactly SUB-002's charter |
| Decision drifts unmade while the UI quietly grows | The out-of-scope rule is explicit: no port-type extension until the decision + follow-ups land |
| Embrace scope balloons into "validator understands JavaScript" | The carve-out model is the ceiling: recognize, exempt from type checks, surface as information — never evaluate |

## References

- [PRE-REVIVAL-SALVAGE-AUDIT.md](../../reviews/PRE-REVIVAL-SALVAGE-AUDIT.md) §3
- `dev-docs/tasks/phase-3-editor-ux-overhaul/TASK-006-expressions-overhaul/` — the design spec (`phase-2-inline-property-expressions.md`)
- SUB-002 (corpus), SUB-006 (carve-out pattern), SUB-008 (MCP), DEBT-003 (evaluator defect)

## Decision record

*(append here when the posture is decided)*
