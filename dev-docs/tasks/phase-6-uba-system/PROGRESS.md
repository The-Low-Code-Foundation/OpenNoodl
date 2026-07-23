# Phase 6: UBA System (Universal Backend Adapter) - Progress Tracker

**Last Updated:** 2026-07-23 (REV-006 documentation truth pass)
**Overall Status:** 🟡 In progress — foundational slice built and wired; four of six sub-phases not started

---

## Status vocabulary

- **Not started** — no code exists for this task.
- **In progress** — some code exists but the task's deliverables are incomplete.
- **Built–not wired** — the deliverable(s) exist and are tested, but have zero call sites in the application outside of tests. The task expected to close the gap is named; if none exists, that is stated explicitly.
- **Complete** — deliverable exists, is tested, AND has real call sites in the app outside tests.
- **Superseded** — the task's goal was later addressed by different work, or the task itself is obsolete.

---

## True current state (summary)

The previous version of this file claimed **0% / Not Started** across all six tasks, last touched 2026-01-07. That was wrong for three of the six, and the error predates a real sprint: on **2026-02-18**, six commits (`6e0ad68` → `ade2afe`) built a working MVP slice of the UBA system — schema types, an instance-method `SchemaParser`, 8 field renderers, a tabbed `ConfigPanel` with conditional visibility, an HTTP+SSE `UBAClient`, and a `UBAPanel` — and **wired it into the running app**: `UBAPanel` is imported and registered as a real sidebar entry in `router.setup.ts` (id `uba`, experimental-gated the same way `execution-history` and `trigger-chain-debugger` are — that is the normal pattern for beta panels in this app, not evidence of non-integration). No commits touched this code between 2026-02-19 and 2026-07-22, confirming the mid-sprint stall described in REV-006. On 2026-07-22 (`d0eefb9`, REV-008) the two existing UBA test specs were repaired and confirmed passing under the Jasmine/Electron runner (they had been stranded, non-running, for five months).

**The known lead from the 2026-07-22 viability assessment is directionally correct but overstates both scope and test coverage.** Two corrections:

1. **"UBA-001 through UBA-009" is `PROGRESS-richard.md`'s own ad-hoc session numbering, not the task IDs in the actual specs.** The six spec files in this folder (`UBA-001-FOUNDATION.md` … `UBA-006-COMMUNITY.md`) are each a multi-week **sub-phase** (6A–6F) containing their own granular task IDs (6A = UBA-001…007, 6B = UBA-008…013, 6C = UBA-014…017, 6D = UBA-018…022, 6E = UBA-023…028, 6F = UBA-029…030). Richard's "UBA-001…009" refer to his own session log, which happens to overlap in the low numbers with 6A/6B/6C's real IDs but is not the same list. The task table below uses the six real sub-phases (matching this folder's filenames and `README.md`) since that is the granularity every other phase's `PROGRESS.md` uses.
2. **"With tests" oversells coverage.** Only two of the built pieces have automated tests: `SchemaParser` (`UBASchemaParser.test.ts`, 18 cases) and the conditional-visibility helper (`UBAConditions.test.ts`, 12 cases). There is **no test file anywhere** for `UBAClient`, the 8 field renderers, `ConfigPanel`, `UBAPanel`, `DebugStreamView`, or the health-indicator hook — `tests/services/index.ts` exists but only registers `StyleAnalyzer.test`, not a UBA client test as Richard's notes implied.

Net effect: Foundation (6A) is mostly done and genuinely wired into the app; Field Types (6B) and Debug System (6C) are each roughly half-built (the parts that exist are wired); Polish (6D), Reference Backend (6E, the planned Erleah adapter), and Community (6F, CLI/gallery) have **zero code** — no Directus/Erleah files, no CLI tool, no gallery, anywhere in the repo.

---

## Quick Summary

| Metric              | Value                                          |
| ------------------- | ----------------------------------------------- |
| Total sub-phases     | 6                                                |
| Complete             | 0                                                |
| In progress          | 3 (6A, 6B, 6C)                                   |
| Not started          | 3 (6D, 6E, 6F)                                   |
| **Progress**         | **~35–40%** (weighted by the 2–3 week effort estimates in each spec; see notes) |

---

## Task Status

| ID (folder file) | Spec sub-phase | Status | Evidence (commit / path) | Notes |
| --- | --- | --- | --- | --- |
| **UBA-001** Foundation | 6A: Schema Spec, Parser, Basic Fields, Config Panel Shell, Config Storage, Backend Discovery, Config Push (internal UBA-001…007) | 🟡 **In progress** (~5 of 7 internal sub-tasks done and wired) | `6e0ad68`, `c04bf2e` (2026-02-18). Code: `packages/noodl-editor/src/editor/src/models/UBA/types.ts`, `SchemaParser.ts`; `views/UBA/ConfigPanel.tsx`, `ConfigSection.tsx`; 8 field renderers in `views/UBA/fields/`. Wired via `views/panels/UBAPanel/UBAPanel.tsx` → registered in `router.setup.ts:31,191` (sidebar id `uba`). Tested: `tests/models/UBASchemaParser.test.ts` (18 cases, passing per `d0eefb9`). | Schema types, parser, 8 basic field renderers, config-panel shell, and config storage (in project metadata) are done, tested (parser only), and wired. **Missing**: "Backend Discovery" — fetch-schema-by-URL with caching/offline support and a dedicated "Add Backend" dialog (spec's internal UBA-006) do not exist; `SchemaParser.ts`'s own doc comment says "the calling layer (BackendDiscovery, AddBackendDialog) is responsible for..." — i.e. deferred, not built. Only a plain URL-input `SchemaLoader` exists in `UBAPanel.tsx`, no cache. |
| **UBA-002** Field Types | 6B: Complex Field Types (relations/JSON/key-value), Special Field Types (prompts/code editor), BYOB Integration Types, Dynamic Options, Validation System, Conditional Visibility (internal UBA-008…013) | 🟡 **In progress** (~15–20%; only 1 of 6 internal sub-tasks fully done) | `c04bf2e` (2026-02-18). Code: `models/UBA/Conditions.ts` (evaluates `visible_when`/`depends_on`), used by `views/UBA/ConfigPanel.tsx:17` and `ConfigSection.tsx:14`. Tested: `tests/models/UBAConditions.test.ts` (12 cases). Partial: `views/UBA/hooks/useConfigForm.ts` has `validateRequired()` — required-field checking only. | "Conditional Visibility" is done, tested, and wired. Required-field validation exists but the spec's full "Validation System" (patterns, custom validators, cross-field rules) does not. **No code exists** for complex field types (relation/JSON/key-value editors), special field types (prompt/code-editor fields), BYOB integration field types, or dynamic-options fields — grep for these component names outside the 8 basic fields returns nothing. |
| **UBA-003** Debug System | 6C: Debug Connection, Debug Event Store, Debug Panel UI, Debug Export (internal UBA-014…017) | 🟡 **In progress** (~2 of 4 internal sub-tasks done and wired) | `ed16302`, `7bd9b4c` (2026-02-18). Code: `services/UBA/UBAClient.ts` (`openDebugStream()` via SSE/EventSource); `views/panels/UBAPanel/DebugStreamView.tsx`, mounted as the Debug tab in `UBAPanel.tsx`. **No test file** for either. | "Debug Connection" (SSE client) and "Debug Panel UI" (live log viewer, connect/disconnect, auto-scroll, colour-coded event types, 500-event cap) exist and are wired into the Debug tab — but **untested** (no `UBAClient.test.ts` or `DebugStreamView.test.ts` exists anywhere). "Debug Event Store" is only an inline React state array (500-item cap), not a dedicated store module the spec describes. "Debug Export" (saving/exporting captured events) — **not found**; no export/download affordance in `DebugStreamView.tsx`. |
| **UBA-004** Polish | 6D: Error Handling, Performance Optimization, Backend Services Integration, Documentation, Example Schemas (internal UBA-018…022) | 🔴 **Not started** (as a distinct task; incidental partial coverage from 6A/6C work) | No commits reference `UBA-018`…`UBA-022`. Incidental: `services/UBA/UBAClient.ts` has a `UBAClientError` class, fetch timeouts, and try/catch guarding (baseline error handling built for other reasons). | No dedicated performance work (no virtualization beyond the 500-event cap), no integration between the UBA panel and the existing `BackendServicesPanel` (grepped — zero cross-references either direction), no UBA documentation, and no example schema files anywhere in the repo (`find … -iname "*schema*.json"` under UBA paths returns nothing). Treat as not started; the `UBAClientError` handling above is a side effect of 6A/6C, not evidence this task was worked. |
| **UBA-005** Reference Backend | 6E: Erleah AI Agent full reference implementation (internal UBA-023…028) | 🔴 **Not started** | No commits, no files. `grep -rli "directus\|erleah"` under the editor source returns nothing UBA-related (the only "directus" hits are the pre-existing, unrelated `BackendServices` preset system). | Confirms the lead's implicit scope did not extend here — nothing in this sub-phase was built. |
| **UBA-006** Community | 6F: Schema Validation CLI, Schema Gallery (internal UBA-029…030) | 🔴 **Not started** | No commits, no files. No CLI tool, no gallery UI, no marketplace code anywhere in the repo. | Same as above — zero code. |

---

## Integration-gap note

There is no partially-built-but-unwired ("Built–not wired") item in this phase — everything that exists is wired into a real call site (the sidebar panel, the Debug tab, the config form). The gaps here are pieces that were **never built**, not built-and-orphaned. If 6B/6C/6D/6E/6F are picked back up, no separate "wiring" task needs to be named — the existing `UBAPanel` shell already provides the Configure/Debug tab structure they'd slot into.

---

## Recent Updates

| Date       | Update                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------- |
| 2026-01-07 | Moved from Phase 3 TASK-008 to own phase                                                   |
| 2026-02-18 | Sprint 2: 6A (Foundation) mostly built; partial 6B (conditional visibility only) and 6C (SSE connection + panel UI) built; all wired into sidebar (`6e0ad68`…`ade2afe`) |
| 2026-02-19 | — sprint stalls; no further UBA commits until REV-008 —                                    |
| 2026-07-22 | REV-008 (`d0eefb9`) repairs and re-enables the two stranded UBA test specs under the Jasmine runner; no new UBA feature code |
| 2026-07-23 | REV-006 documentation truth pass — this rewrite. Old file claimed 0%/Not Started throughout; corrected against code + git evidence |

---

## Dependencies

Depends on: Phase 3 (Editor UX foundation)

---

## Per-developer notes merged in

`PROGRESS-richard.md` (session log, 2026-02-18/19) is preserved unchanged in this folder. Its claims were used as leads and verified against code/git above; where its numbering ("UBA-001…009") diverges from the spec files' internal task IDs, this file uses the spec numbering (see "True current state" above) and cites Richard's log by content, not by his ID scheme, to avoid conflating the two systems. Its "tests" claims for UBAClient/ConfigPanel/UBAPanel were not corroborated by any test file found in the repo — see the UBA-002/003 rows above.

---

## Notes

This phase was previously TASK-008 in Phase 3. Moved to its own phase for clarity. UBA enables configuring any backend (Directus, Supabase, etc.) through a unified adapter interface. The sidebar entry is registered under the same "experimental" gating used for other beta panels (`execution-history`, `trigger-chain-debugger`) — a user must enable it via settings, but it is real, shipped, production code, not a dead stub.
