# DEBT-012: Data-Flow Tracker Salvage — Fix the Live Instrument, Decide the Broken One

## Metadata

| Field | Value |
|-------|-------|
| **ID** | DEBT-012 |
| **Phase** | Phase 14.5 — Revival Debt (added 2026-07-24 from the pre-revival salvage audit) |
| **Priority** | 🟡 Medium (a live instrument is dropping data; a broken panel is user-reachable) |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 3–5 days |
| **Prerequisites** | None |
| **Branch** | `task/debt-012-dataflow-salvage` |
| **Recommended executor** | 🟠 **Opus 4.8** — the dedup fix requires understanding real pulse-event timing in the live preview; the lineage decision is pre-made below and just needs executing. |

## Objective

Make the Trigger Chain Debugger trustworthy (it currently drops legitimate events), take the broken Data Lineage panel out of users' reach, and clean up the abandonment residue — so what remains of phase-4's data-flow work is exactly the parts that are true.

## Background

The salvage audit ([PRE-REVIVAL-SALVAGE-AUDIT.md](../../reviews/PRE-REVIVAL-SALVAGE-AUDIT.md) §4) sorted the phase-4 "data flow tracker" cluster into keep / fix / retire:

- **Keep (no action):** `utils/graphAnalysis/` (~2,029 lines), Component X-Ray, the Highlighting API — sound, consumed by shipped features (Explain Mode drives HighlightManager).
- **Fix:** the Trigger Chain Debugger (~1,800 lines) is genuinely live-wired — `ViewerConnection.ts:106-115` feeds real `connectiondebugpulse` events from the running preview into the recorder — but its `KNOWN-ISSUES.md` documents a critical bug: a **5ms dedup threshold that drops legitimate signal steps** (data loss in a debugging tool), plus zero noise filtering (~40 events for one button click). This is the only live data-flow instrumentation the product has; the AI-collaboration story will eventually want it (AIX-005-era realtime, and Explain Mode grounding).
- **Retire from reach:** the Data Lineage panel is registered and user-reachable (`router.setup.ts:114-123`) but its tracing algorithm is wrong by its own author's account — it enumerates all ports instead of following wires (40+ noise steps for a 3-node chain), five fix attempts failed, and the commit message says "implementation failed and requires rethink." A reachable panel that confidently shows wrong data-flow answers is worse than none — especially next to Explain Mode, which answers the same question correctly.

**The lineage decision, pre-made here so this task doesn't re-litigate it:** unregister the panel now; do **not** patch the algorithm (attempt #6 of a documented dead end). If a deterministic lineage service is wanted later, it gets rebuilt on the substrate (catalog + v2 format) as a service the validator/Explain/agents consume — that idea goes to `dev-docs/future-projects/`, not to a revival of this panel.

## Current State

- Trigger Chain: `utils/triggerChain/` (recorder, chainBuilder — the 5ms threshold lives in the dedup logic), `views/panels/TriggerChainDebuggerPanel/`, wiring in `ViewerConnection.ts`; `KNOWN-ISSUES.md` holds an unexecuted 5-phase investigation plan
- Data Lineage: `utils/graphAnalysis/lineage.ts` (562), `views/panels/DataLineagePanel/` (833), registered as experimental panel id `data-lineage`; canvas context-menu entry already disabled (`NodeContextMenu.ts:178-194`); `useDataLineage.ts:24-49` still emits `🔗 [DataLineage]` console spew
- Topology Map: registration fully commented out — already unreachable; leave as-is
- Zero automated tests across all of it

## Desired State

- Trigger Chain records without dropping legitimate steps; a basic noise filter (collapse per-frame propagation chatter, group by interaction) makes a button-click recording readable; a smoke test exists for the recorder path.
- Data Lineage panel unregistered (code can stay for one release cycle behind the dead registration, then be deleted with the next cleanup batch — record which); its debug logging gone either way; `NOT-PRODUCTION-READY.md` updated to point at the future-projects note.
- A `future-projects` note: "deterministic lineage as a substrate service" — what it would consume (catalog, v2 files), who would use it (validator info-findings, Explain Mode grounding, agents), and why the panel-first attempt failed.
- Phase-4 PROGRESS.md updated to reflect all of the above (it currently lists these as unowned gaps).

## Scope

### In Scope
- [ ] Fix the dedup data loss: distinguish "same connection pulsing twice legitimately" from "duplicate event" by more than a 5ms wall-clock heuristic (the recorder has connection ids and sequence context; use them)
- [ ] Minimal noise strategy: per-interaction grouping and/or collapse of same-frame propagation runs — readable, not perfect
- [ ] Recorder smoke test
- [ ] Unregister the DataLineage panel; strip the console spew; update its status docs
- [ ] Future-projects note (lineage-as-substrate-service)
- [ ] Update phase-4 PROGRESS.md ownership lines

### Out of Scope
- Rewriting the lineage algorithm (decided against above)
- Topology Map (stays shelved)
- Building the substrate lineage service (future-projects note only)
- Deep trigger-chain UX work (the panel is experimental; trustworthy > polished)

## Success Criteria

- [ ] A recording of a known interaction contains every step the graph actually fired (verified against a hand-traced example in the live editor)
- [ ] A button-click recording is readable (grouped/collapsed), not ~40 raw rows
- [ ] Recorder smoke test green
- [ ] Data Lineage no longer reachable from the sidebar; no console spew; docs updated
- [ ] Future-projects note written; phase-4 PROGRESS.md updated

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| The dedup fix reintroduces the duplicate-flood the 5ms hack suppressed | Understand what the duplicates *were* first (the KNOWN-ISSUES investigation plan's step 1) — fix causes, not symptoms; the smoke test pins both directions |
| Removing the lineage panel breaks a HighlightManager consumer path | The audit lists live HighlightManager consumers; DataLineagePanel is one — remove its registration, not the HighlightManager API |
| "One release cycle then delete" gets forgotten | Record the deletion in DEBT-010's small-cleanups list when unregistering |

## References

- [PRE-REVIVAL-SALVAGE-AUDIT.md](../../reviews/PRE-REVIVAL-SALVAGE-AUDIT.md) §4
- `dev-docs/tasks/phase-4-canvas-visualisation-views/` — VIEW-003 KNOWN-ISSUES.md, VIEW-005 NOT-PRODUCTION-READY.md, PROGRESS.md (2026-07-23 truth pass)
- Related: AIX-004 (the human-facing successor to lineage's intent), AIX-005 (future consumer of live pulse data)
