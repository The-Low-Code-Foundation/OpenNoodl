# Phase 16: Runtime & Deploy Health (Revival Track D)

**Phase:** 16
**Track:** D — Runtime & Deploy Health
**Source:** [NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md) Horizon 1, Track D
**Status:** ✅ **Complete** — all four tasks closed 2026-07-26 (created 2026-07-22). See [PROGRESS.md](./PROGRESS.md) for what each one actually found; several of the specs' premises turned out to be stale and are corrected there.

## Why this phase exists

Three of the four revival tracks are about the editor — the thing developers use. This one is about **the apps people actually ship with it**, which have quietly fallen behind.

The editor was migrated to React 19 during Phase 1. The runtime that powers deployed applications was not: apps built with OpenNoodl still run on React 17. That gap matters for real users in a way editor internals do not — it affects the performance, ecosystem compatibility, and longevity of every application anyone builds with this tool. A project doing a competent job of modernising its own IDE while shipping its users a two-major-versions-old runtime has its priorities inverted.

The rest of the phase closes similar gaps between "built" and "actually dependable": the Universal Backend Adapter is complete but has no reference backend or end-to-end test, so nobody can be sure it works against a real system; the local SQLite backend silently falls back to an in-memory mock, meaning users can build against a database that quietly forgets everything.

This track runs in parallel with Tracks A, B, and C and shares few files with them, so it is good work to staff independently.

## Task Table

| ID | Title | Priority | Estimate | Prerequisites | Executor |
|---|---|---|---|---|---|
| [RUN-001](./RUN-001-RUNTIME-REACT-19.md) | Runtime React 17 → 19 migration | 🟠 High | 4–6 wks | REV-003 | 🟠 Opus 4.8 |
| [RUN-002](./RUN-002-SSR-SSG.md) | SSR / SSG support | 🟡 Medium | 4–6 wks | RUN-001 | 🟠 Opus 4.8 |
| [RUN-003](./RUN-003-FINISH-UBA.md) | Finish UBA: E2E, reference backend, second adapter | 🟠 High | 3–5 wks | REV-001 | 🟢 Sonnet 5 |
| [RUN-004](./RUN-004-STABILIZE-LOCAL-BACKEND.md) | Stabilise the local SQLite backend | 🟠 High | 2 wks | REV-004 (Electron ABI) | 🟠 Opus 4.8 |

## Sequencing notes

- **RUN-001 before RUN-002.** Server-side rendering depends on React 19's SSR capabilities; the existing SSR design document names the React 19 migration as its prerequisite, and that prerequisite is now satisfiable.
- **RUN-004 must follow REV-004.** The Electron upgrade changes the native module ABI, so `better-sqlite3` has to be rebuilt anyway. Doing this task first means doing the native module work twice.
- **RUN-003 is independent** and can start immediately after the reanimation — UBA-001…009 are already built, so this is finishing work rather than new construction.
- **Coordinate RUN-001 with PLAT-003** (typing the runtime, Phase 14): both touch `noodl-viewer-react` heavily. Either sequence them or agree file boundaries; running them blind in parallel will produce constant conflicts.

## Exit criterion

Applications built with OpenNoodl run on a current React, can be rendered server-side when that suits the project, connect to real backends through a tested adapter with at least one reference implementation, and never silently lose data to a mock database.

## A note on what is *not* here

The original Phase 5 (multi-target deployment) proposed PWA, Capacitor, Electron-app, and browser-extension targets alongside the web deploy — eleven tasks, of which three were done. The revival roadmap parks that matrix deliberately. The reasoning: Phase 18's code export is a universal escape hatch that serves the same underlying need (take your app elsewhere) far better than five partially-maintained wrappers, and each additional target multiplies the surface that must keep working. One excellent web deploy plus real export beats five mediocre packaging targets.

## References

- [Revival roadmap — Horizon 1, Track D](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- [Viability report — §5 roadmap triage](../../reviews/NOODL-VIABILITY-REPORT.md)
- [`dev-docs/future-projects/PHASE-RUNTIME-REACT-19-MIGRATION.md`](../../future-projects/PHASE-RUNTIME-REACT-19-MIGRATION.md)
- [`dev-docs/future-projects/SSR-SUPPORT.md`](../../future-projects/SSR-SUPPORT.md)
- [`dev-docs/future-projects/NATIVE-BAAS-INTEGRATIONS.md`](../../future-projects/NATIVE-BAAS-INTEGRATIONS.md)
- [`dev-docs/tasks/phase-6-uba-system/`](../phase-6-uba-system/) — UBA-001…009, already complete
