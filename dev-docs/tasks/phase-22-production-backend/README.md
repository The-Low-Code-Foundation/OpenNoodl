# Phase 22: Production Backend (Revival Track H)

**Phase:** 22
**Track:** H — BaaS parity for the standalone backend
**Source:** Strategy discussion 2026-07-25, building directly on [Phase 19](../phase-19-cloud-workflows/) and its [BACKEND-GAP-ASSESSMENT.md](../phase-19-cloud-workflows/BACKEND-GAP-ASSESSMENT.md)
**Status:** Not started (created 2026-07-25)
**Starts:** After Phase 19's WF-004 lands. Nothing here starts before the standalone service exists.

## Why this phase exists

Phase 19 turns the local backend into a real, deployable service: `nodegx-backend` running headless with a real database, a workflow engine, triggers (cron / webhook / DB-change), and one documented deploy path. That is the skeleton of a Backend-as-a-Service. This phase puts flesh on it — the features that decide whether someone *keeps* a deployed NodeGX backend in production rather than treating it as a learning tool: realtime, transactional email, access control, OAuth, an admin surface that exists outside the editor, file handling beyond raw upload, backups, search, and operational hygiene.

The reference point is **Pocketbase**, and the lesson is taken precisely: Pocketbase is beloved because it is *small and complete*, not featureful. Single process, SQLite, honest single-node semantics, admin UI, auth, realtime, files, hooks — and it stops there. This phase adopts the same stance and adds the one sentence nobody else can say: **your backend logic is visual graphs, and an AI agent can author all of it.** Every capability added here must therefore be visible to agents (catalog + MCP), or the differentiator leaks away one feature at a time.

What this phase is *not*: a feature-count race. The parked list at the bottom is as load-bearing as the task table.

## Task Table

| Order | ID | Title | Tier | Priority | Estimate | Prerequisites | Executor |
|---|---|---|---|---|---|---|---|
| 1 | [BAK-001](./BAK-001-REALTIME-SUBSCRIPTIONS.md) | Realtime subscriptions (SSE) | 1 — credibility | 🟠 High | 1–2 wks | WF-004 | 🟠 Opus 4.8 |
| 2 | [BAK-002](./BAK-002-EMAIL-SUBSYSTEM.md) | Email: SMTP, templates, reset & verify | 1 — credibility | 🟠 High | 1–2 wks | WF-004 | 🟢 Sonnet 5 |
| 3 | [BAK-003](./BAK-003-ACCESS-CONTROL.md) | Access control: permissions, ACLs, roles, API keys | 1 — credibility | 🔴 Critical | 2–3 wks | WF-004 | 🔵 Fable 5 |
| 4 | [BAK-007](./BAK-007-BACKUPS-EXPORT-MIGRATIONS.md) | Backups, export/import, dev→prod promotion | 1 — credibility | 🟠 High | ~2 wks | WF-004; WF-005 for scheduling | 🟠 Opus 4.8 |
| 5 | [BAK-004](./BAK-004-OAUTH-PASSWORDLESS.md) | OAuth & passwordless sign-in | 2 — parity | 🟡 Medium | 2–3 wks | BAK-002, BAK-003 | 🟠 Opus 4.8 |
| 6 | [BAK-005](./BAK-005-SERVED-ADMIN-DASHBOARD.md) | The served admin dashboard | 2 — parity | 🟠 High | 2–3 wks | WF-004; BAK-003 for auth | 🟠 Opus 4.8 |
| 7 | [BAK-006](./BAK-006-FILE-STORAGE-V2.md) | File storage v2: metadata, transforms, S3 driver | 2 — parity | 🟡 Medium | 1–2 wks | WF-004; BAK-003 for private files | 🟢 Sonnet 5 |
| 8 | [BAK-008](./BAK-008-FULL-TEXT-SEARCH.md) | Full-text search (FTS5) | 3 — polish | 🟡 Medium | ~1 wk | WF-004 engine decision | 🟢 Sonnet 5 |
| 9 | [BAK-009](./BAK-009-PRODUCTION-OPS.md) | Production ops: rate limits, logs, metrics, audit | 3 — polish | 🟡 Medium | 1–2 wks | WF-004; ideally last | 🟢 Sonnet 5 |

## Sequencing notes

- **Tiers are stopping points, not just priorities.** Tier 1 alone makes a deployed backend production-*credible* (live data, working password reset, permissions, restorable data). If capacity is contended with the G2-critical path, ship Tier 1 and pause; the phase remains coherent. Tier 2 is Pocketbase *parity*; Tier 3 is what makes ops people trust it.
- **BAK-003 is the phase's Fable task** and its decisions ripple: BAK-001's subscriptions must re-check read permissions at delivery, BAK-004 issues sessions into its model, BAK-005's admin auth sits above it, BAK-006's private files consult it. Its *design* should land early even if implementation overlaps later tasks; BAK-001 and BAK-002 can run before it with documented open-access semantics.
- **BAK-002 before BAK-004** — magic links and verification mail are email flows first.
- **BAK-009 runs last deliberately**: rate limits and audit logging want the final route table, not a moving one.
- **One-panel constraint holds** (from RUN-003's consolidation): all *editor-side* configuration for these features lives in the existing Backend Services panel. BAK-005's dashboard is not an editor panel — it is a web page served by the deployed service itself, for operating a backend where no editor exists.
- **The AI-visibility rule** (mirrors WF-002/WF-005): every capability ships with catalog entries (SUB-004/005) for anything node-shaped and MCP surface (SUB-008) for anything an agent must enumerate or configure — permissions, email templates, OAuth providers, backup schedules included. An agent must be able to build *and secure and operate* the backend, or the "AI authors the full stack" story has a hole.
- **Loud-failure doctrine applies everywhere** (RUN-004): no capability silently degrades. Email unconfigured → sends fail loudly into execution records; sharp missing → transforms report unavailable; backup failed → status says so.

## Exit criterion

A NodeGX app deployed by WF-003's path: browsers receive live record updates over SSE; a visitor signs up with email + password or Google OAuth, verifies their address, and resets a forgotten password — all by email; row-level permissions stop them reading another user's records; the operator administers data, users, and schema through the service's own web dashboard with the editor closed; a scheduled backup exists and a restore has been demonstrated; and an agent, through MCP, can enumerate and configure every one of those capabilities.

## What this phase deliberately parks

- **Postgres / MySQL / any second engine** — single-file SQLite is the product, as it is for Pocketbase. Export (Phase 18) and BYOB (RUN-003) are the answers for people who need more.
- **Horizontal scaling, clustering, multi-node** — honest single-process semantics, documented. A VPS goes remarkably far.
- **Multi-tenancy / hosting NodeGX-backend-as-a-service** — ECO-004 territory, gated on G3.
- **Native mobile push (APNs/FCM)** — heavy vendor surface. If demand shows, web push (VAPID) is the plausible first slice; it would slot beside BAK-001. Parked until then.
- **GraphQL** — the clients don't speak it; the Parse-wire subset plus BYOB covers the runtime. Permanently parked unless external demand is loud.
- **MFA/TOTP, SAML, enterprise SSO** — beyond OIDC. Revisit only with a real deployment asking for it.
- **An integration library** — permanently, per Phase 19. Integrations are generated artifacts.
- **Per-execution billing / metering** — no business model work in this phase.

## References

- [Phase 19 README](../phase-19-cloud-workflows/README.md) and [BACKEND-GAP-ASSESSMENT.md](../phase-19-cloud-workflows/BACKEND-GAP-ASSESSMENT.md) — the skeleton this phase fleshes out
- [WF-004](../phase-19-cloud-workflows/WF-004-BACKEND-SERVICE.md) — the service, the Parse-wire subset, the engine decision
- [WF-005](../phase-19-cloud-workflows/WF-005-TRIGGERS.md) — the trigger/firing contract several tasks reuse
- [RUN-004](../phase-16-runtime-deploy-health/RUN-004-STABILIZE-LOCAL-BACKEND.md) — the loud-failure doctrine
- [RUN-003](../phase-16-runtime-deploy-health/) — BYOB nodes and the Directus realtime node BAK-001 extends
