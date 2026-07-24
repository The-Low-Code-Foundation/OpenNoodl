# Phase 16 Progress — Runtime & Deploy Health

**Created:** 2026-07-22, from [NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md) Track D
**Overall status:** 🟡 In progress — 0 / 4 tasks complete, RUN-001 started 2026-07-24

## Status vocabulary

Not started · In progress · **Built–not wired** · Complete · Superseded

## Tasks

| ID | Title | Status | Estimate | Notes |
|---|---|---|---|---|
| RUN-001 | Runtime React 17 → 19 | In progress (2026-07-24) | ↓ from 4–6 wks | Re-scope + slices 1–2 done, see [RUN-001-ASSESSMENT.md](./RUN-001-ASSESSMENT.md). Spec premise was stale: runtime ships vendored React **18.3.1** UMD (`1477a29` half-migrated it upstream); React 19's missing UMD build is the real problem. **Found + fixed a live P1 en route** (`0d075b2`): `1477a29`'s findDOMNode replacement never worked for any built-in component, so `setStyle`'s direct-DOM fast path (incl. transforms/animations) silently no-oped since Dec 2025 — fixed via the setDOMElement contract, live-verified in the preview. React 19 global bundles built + hooks-verified (`1c6790c`), not yet consumed. Cloud runtime React-free (excluded); SSR harness unwired (RUN-002's). Remaining: per-project runtime setting, editor selection UI + migration scan, corpus 18-vs-19 pass, user docs |
| RUN-002 | SSR / SSG support | Not started | 4–6 wks | Prerequisite (React 19 runtime) becomes satisfied by RUN-001 |
| RUN-003 | Finish UBA | Not started | 3–5 wks | UBA-001…009 complete as of the 2026-02-18 sprint; remaining: UBA-010 E2E, Directus reference backend, Supabase adapter |
| RUN-004 | Stabilise local SQLite backend | Not started | 2 wks | `better-sqlite3` currently falls back to an in-memory mock — data silently does not persist |

## Inherited state worth knowing

- **UBA is further along than its top-level tracker says.** `phase-6-uba-system/PROGRESS.md` reports 0%; the per-developer notes and git history show UBA-001…009 delivered (types, SchemaParser, field renderers, ConfigPanel, UBAClient with HTTP+SSE, UBAPanel, sidebar registration, health indicator). REV-006 corrects that record; RUN-003 assumes the work exists.
- **The local backend's failure is silent.** The fallback to an in-memory mock means a user can build an entire feature against a database that discards everything on restart. RUN-004 treats making the failure *loud* as a first deliverable, ahead of fixing the native build.

## Blockers

- RUN-004 should wait for **REV-004** (Electron 31 → 43), which changes the native ABI and forces a `better-sqlite3` rebuild regardless.
- ~~RUN-001 overlaps `noodl-viewer-react` with **PLAT-003** (Phase 14). Agree boundaries before both start.~~ Resolved 2026-07-24: PLAT-003 already typed the binding hub and all of `src/nodes/`; boundary agreed in RUN-001-ASSESSMENT.md §5 (RUN-001 owns `highlighter.js`, `Drag.tsx`, the entry, `webpack-configs/`, `static/`; PLAT-003 keeps typing the rest of `src/` root; `catalog:check` is the shared gate).
