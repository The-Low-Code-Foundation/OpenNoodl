# Catalog Acceptance Tests

## SUB-004 baseline (structural catalog) — PASSED 2026-07-23

An LLM given only `node-catalog.json` + `SCHEMA.md` authored a small component using correct
type strings and port names, and correctly rejected invalid types (`Rectangle`, `Markdown`,
`REST`). Recorded in `dev-docs/tasks/phase-13-format-ai-substrate/PROGRESS.md`.

## SUB-005 comparative test (structural vs enriched) — PROTOCOL READY, RUN PENDING

The measure of the enrichment layer is the *delta* between what an LLM authors from the
structural catalog alone and what it authors from the enriched catalog. The run was blocked on
2026-07-23 by an API spend limit (subagents required); the harness below is ready.

### Protocol

1. **Arm A (structural)**: a fresh agent gets `packages/noodl-types/src/node-catalog.json` +
   `docs/node-catalog/SCHEMA.md` — nothing else from `docs/node-catalog/` — and this task:
   *"Author a task-list page backed by a cloud query: list of task records, a text input and
   button that create a record, an empty-state message. Output as an example-format JSON file
   (id `acceptance-a`), following the components/nodes/connections shape of the schema doc."*
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
