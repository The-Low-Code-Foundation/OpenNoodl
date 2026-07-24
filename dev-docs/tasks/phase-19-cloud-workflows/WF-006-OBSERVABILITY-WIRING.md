# WF-006: Light Up Execution Observability

## Metadata

| Field | Value |
|-------|-------|
| **ID** | WF-006 |
| **Phase** | Phase 19 — Cloud & Workflows (Revival Track G) |
| **Priority** | 🟠 High (first task of the phase; days-scale, high visibility) |
| **Difficulty** | 🟢 Easy to 🟡 Medium |
| **Estimated Time** | 3–5 days |
| **Prerequisites** | REV-001 (the `@noodl-viewer-cloud/execution-history` path alias) |
| **Branch** | `task/wf-006-observability-wiring` |
| **Recommended executor** | 🟢 **Sonnet 5** — both ends of the pipeline exist and are tested; the work is connecting them along a path the code already implies. Escalate only if the IPC channel shapes turn out to mismatch the store's API badly. |

## Objective

Connect the tested-but-never-called execution-history library to the running function runtime and to the shipped editor UI, so the Execution History Panel and canvas Execution Overlay display real executions — before any workflow engine exists.

## Background

The 2026-07-24 salvage audit ([PRE-REVIVAL-SALVAGE-AUDIT.md](../../reviews/PRE-REVIVAL-SALVAGE-AUDIT.md) §7) found the observability pipeline severed at both ends:

- `ExecutionStore` (648 lines) and `ExecutionLogger` (394 lines) in `packages/noodl-viewer-cloud/src/execution-history/` are well-tested and **never imported by any production code** — no call sites in `CloudRunner`, `WorkflowRunner`, `LocalBackendServer`, or `BackendManager`. The store takes its database via constructor injection and has never been fed a real one.
- The Execution History Panel (`.../views/panels/ExecutionHistoryPanel/`) calls IPC channels for which **no `ipcMain.handle` exists anywhere** in `packages/noodl-editor/src/main`. The canvas `ExecutionOverlay` renders but no data ever flows to it.

This is the cheapest genuinely visible win in the phase: today's *function* executions (`POST /functions/:name` through `WorkflowRunner`/`CloudRunner`) are real executions worth logging. Wiring them makes ~2,150 lines of shipped UI and ~1,350 lines of tested library real, and gives WF-001's engine an observability layer that is already proven end-to-end when it arrives.

## Current State

- `WorkflowRunner.run()` (`packages/noodl-editor/src/main/src/local-backend/WorkflowRunner.js:303`) delegates to `CloudRunner.run()`; neither logs anything to the execution store.
- `LocalBackendServer.handleFunction()` (lines 421–447) routes `POST /functions/:name` — the single execution entry point today.
- The panel's hooks (`ExecutionHistoryPanel/hooks/useExecutionHistory.ts`, `useExecutionDetail.ts`) invoke `execution-history:*`-style IPC channels; verify the exact channel names against the hooks before writing handlers.
- `ExecutionStore` expects a "better-sqlite3-compatible" synchronous database handle (`execution-history/index.ts` doc comments); `schema.sql` defines the schema.

## Desired State

- Every function execution through the local backend produces an execution record: start, per-node events as available, completion or failure, duration.
- The History Panel lists real executions; opening one shows its detail.
- The canvas Execution Overlay shows badges/timeline for the most recent execution of the open component.
- The wiring is engine-agnostic: WF-001's workflow engine later emits into the same logger without touching the panel or handlers again.

## Scope

### In Scope
- [ ] Instantiate `ExecutionStore` with a real database in the editor main process (see engine note below)
- [ ] Wire `ExecutionLogger` into the function-execution path (`WorkflowRunner`/`LocalBackendServer.handleFunction`)
- [ ] Implement the missing `ipcMain.handle` handlers for every channel the panel's hooks call
- [ ] Verify the panel and overlay render real data end to end
- [ ] A small integration test: run a function, assert a record exists and is retrievable over the IPC path

### Out of Scope
- The workflow engine (WF-001) and workflow-level event semantics
- Durable storage guarantees — durability is WF-004/RUN-004 territory (see engine note)
- Reworking the panel or overlay UI
- Per-node granularity beyond what `CloudRunner` can currently report (don't instrument the runtime deeply; log what the run boundary knows)

### Engine note (read before starting)

The store needs a synchronous SQLite handle, and `better-sqlite3` is not installed (RUN-004). Two acceptable paths, in order of preference:

1. **`node:sqlite`** (`DatabaseSync`) if the current Electron's bundled Node provides it flag-free — check at runtime, not from docs. No native module, no ABI question.
2. **An in-memory SQLite-compatible fallback, loudly labeled** — observability data is the one place ephemerality is tolerable short-term; label the panel accordingly ("history is not persisted yet") rather than silently pretending. Durable execution history arrives with WF-004's engine decision.

Do **not** add `better-sqlite3` as a dependency in this task; that decision belongs to WF-004/RUN-004 jointly.

## Implementation Steps

1. **Read the hooks** to enumerate the exact IPC channels and expected payload shapes.
2. **Instantiate the store** in the main process per the engine note; run `schema.sql`.
3. **Wire the logger** around `WorkflowRunner.run()` / `handleFunction`: execution started, completed/failed, duration, function name, request metadata (no secrets — scrub headers/bodies per the store's types).
4. **Implement the IPC handlers** against the store's query API.
5. **Verify live**: run a local-backend function, open the History Panel, see the execution; open the component, see the overlay.
6. **Integration test** for the run→store→IPC path.

## Success Criteria

- [ ] A function execution appears in the History Panel without manual steps
- [ ] Execution detail view shows real data
- [ ] Canvas overlay displays execution state for the open component
- [ ] No silent failure: if the store can't initialize, the panel says so
- [ ] Integration test in place; existing execution-history unit tests still green
- [ ] No `better-sqlite3` dependency added

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| IPC channel shapes don't match the store's API | Step 1 enumerates them first; adapt in the handler layer, never by editing the tested store |
| `node:sqlite` unavailable in current Electron | The labeled in-memory fallback keeps the task shippable; durability explicitly deferred |
| Request payloads logged verbatim leak secrets | Scrub at the logger call site; the store's types indicate what belongs in each field |
| Deep runtime instrumentation creep | Log at the run boundary only; per-node workflow events are WF-001's job |

## References

- [PRE-REVIVAL-SALVAGE-AUDIT.md](../../reviews/PRE-REVIVAL-SALVAGE-AUDIT.md) §7
- [BACKEND-GAP-ASSESSMENT.md](./BACKEND-GAP-ASSESSMENT.md) §1, §8
- `packages/noodl-viewer-cloud/src/execution-history/` — store, logger, types, schema
- Related: WF-001 (consumes this wiring), WF-004 (durable engine decision), REV-001 (path alias)

## Checklist

- [ ] Confirm REV-001 alias present; enumerate IPC channels from the hooks
- [ ] Store instantiation per engine note; logger wired at the run boundary
- [ ] IPC handlers; live verification in panel + overlay
- [ ] Integration test; CHANGELOG
