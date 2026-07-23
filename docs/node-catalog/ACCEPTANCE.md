# Catalog Acceptance Tests

## SUB-004 baseline (structural catalog) — PASSED 2026-07-23

An LLM given only `node-catalog.json` + `SCHEMA.md` authored a small component using correct
type strings and port names, and correctly rejected invalid types (`Rectangle`, `Markdown`,
`REST`). Recorded in `dev-docs/tasks/phase-13-format-ai-substrate/PROGRESS.md`.

## SUB-005 comparative test (structural vs enriched) — RUN 2026-07-23, ENRICHED ARM CLEARLY BETTER

Two blind agents authored the same feature (task list + create flow + empty state) from
different inputs; raw outputs are committed in `./acceptance/`. Neither saw the validator,
examples directory, or node source.

| | Arm A (structural: catalog + SCHEMA.md) | Arm B (enriched: enriched catalog + ENRICHMENT.md + patterns.md) |
|---|---|---|
| Validator (strict, warnings-as-errors) | 0 errors, 0 warnings | 0 errors, 0 warnings |
| Dead wires (ports that don't exist at runtime) | **1** — `created → fetch` on Query Records; the real input is `storageFetch` (verified in `dbcollectionnode2.js`). Dynamic node, so the validator cannot catch it: a silently non-functional connection. | **0** |
| Redundant wiring | Re-fetch after create — unnecessary, live queries pick up new records (the enrichment documents this; Arm A itself flagged the uncertainty). | None — explicitly cited the documented live-update behaviour as the reason to omit it. |
| Item data delivery | `DbModel2` + `idSource: "foreach"` per row — workable, but non-canonical and heavier (an extra record binding per row). | Component Inputs matched to record property names — the corpus-canonical pattern, identical to the shipped example. |
| Empty state | `isEmpty → visible` (correct level semantics, non-corpus idiom). | `isEmpty → mounted` on a wrapping Group — the corpus idiom (patterns.md §5). |
| Correct hard guesses | `prop-title` convention ✓ (verified: `dbmodelnode2.js` registers `prop-<name>`), enum values checked against catalog ✓. | Same `prop-title` ✓; scroll container with `clip` per Group enrichment ✓. |

**Verdict: success criterion met.** Both arms produce validator-clean graphs — the structural
catalog already prevents hard port errors on static nodes. The enrichment's value shows exactly
where the validator is blind: the runtime-determined region (Arm A's dead `fetch` wire) and
idiom (canonical item-data delivery, `mounted` gating, no redundant re-fetch). Arm B's own
rationale cited the embedded example, the anti-pattern note, and patterns.md — the enrichment
was not just present but load-bearing.

### Protocol (as run)

### Protocol

1. **Arm A (structural)**: a fresh agent gets `packages/noodl-types/src/node-catalog.json` +
   `docs/node-catalog/SCHEMA.md` — nothing else from `docs/node-catalog/` — and this task:
   *"Author a task-list page backed by a cloud query: a list of task records, a text input plus
   a button that create a new task record, and an empty-state message shown when there are no
   tasks."* Output as an example-format JSON file (id `acceptance-a`).
2. **Arm B (enriched)**: a fresh agent gets `packages/noodl-types/src/node-catalog-enriched.json`
   + `docs/node-catalog/ENRICHMENT.md` + `docs/node-catalog/patterns.md` and the identical task
   (id `acceptance-b`).
3. Both outputs land in a scratch directory and are scored with the semantic validator:
   `ts-node -P ./scripts/tsconfig.json ./scripts/validate-examples.ts --dir <scratch> --json`
4. **Metrics**: validator errors and warnings (hard count); then an idiomatic review against
   `patterns.md` — does the wiring use Repeater+Query+Component Inputs (pattern 2/3), signals vs
   levels correctly (compatibility signalSemantics), `isEmpty` for the empty state?
5. Record both raw outputs and the scores here. Success = Arm B strictly better: fewer invalid
   ports and measurably more idiomatic wiring.

### Why this design

Neither arm sees the validator while authoring, and the grader (the validator + the pattern
checklist) is fixed before the run — the comparison measures the catalog inputs, not prompt luck.
