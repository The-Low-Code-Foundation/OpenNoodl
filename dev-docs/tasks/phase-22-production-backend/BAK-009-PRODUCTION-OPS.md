# BAK-009: Production Ops — Rate Limits, Logs, Metrics, Audit

## Metadata

| Field | Value |
|-------|-------|
| **ID** | BAK-009 |
| **Phase** | Phase 22 — Production Backend (Revival Track H) |
| **Tier** | 3 — polish |
| **Priority** | 🟡 Medium (invisible until the day it is the only thing that matters) |
| **Difficulty** | 🟢 Low–Medium |
| **Estimated Time** | 1–2 weeks |
| **Prerequisites** | WF-004; deliberately **last** in the phase — it hardens the final route table, not a moving one |
| **Branch** | `task/bak-009-production-ops` |
| **Status** | ✅ **COMPLETE 2026-07-26** — see [BAK-009-NOTES.md](./BAK-009-NOTES.md) |
| **Recommended executor** | 🟢 **Sonnet 5** — every deliverable is a known pattern with a checkable output; the two small policy decisions are pinned below. |

## Objective

Give a deployed `nodegx-backend` the operational hygiene a production service owes its operator: rate limiting, structured request logs, an audit trail for privileged actions, a metrics endpoint, request correlation, graceful shutdown, and honest CORS/security-header defaults — plus the deployment documentation that ties it together.

## Background

Everything else in this phase adds capability; this task adds *survivability*. The individual items are small and boring — which is exactly why they get skipped, and why their absence is what a security reviewer or a sysadmin notices in the first ten minutes. Several earlier tasks ship narrow versions of these (BAK-002 rate-limits its two endpoints; BAK-005 logs admin mutations "into the service log"); this task generalizes those one-offs into single subsystems so the service ends the phase with one rate limiter, one log format, one audit trail — not five improvisations.

Scope honesty per the phase README: single-process semantics. In-memory rate-limit state, local log files, one process's metrics. No Redis, no log shippers, no APM — the operator's reverse proxy and journald do the fleet-grade parts.

## Current State

- WF-004 (specced): `/health`, supervised logs to the editor, bearer auth — nothing else operational.
- BAK-002/BAK-005 (specced) each note local one-offs awaiting this generalization.
- WF-006's execution records cover *function/workflow* observability — request-level observability (every HTTP hit, not just executions) has no owner until this task.
- WF-003 owns the deploy path its docs slot into.

## Desired State

- **Rate limiting**: one middleware, token-bucket per key (IP for anonymous, session/API key otherwise), with per-route-class policies (auth endpoints strict; hooks moderate; data routes generous; `/_admin` login strict) configurable per backend, sane defaults on. 429s with `Retry-After`. BAK-002's bespoke limits migrate onto it. Behind-proxy correctness: trusted-proxy config for `X-Forwarded-For` (document the default: trust loopback only).
- **Structured logs**: JSON lines to stdout (the service is supervised — journald/docker collect it): timestamp, level, request id, method, route, status, duration, principal type (never credentials), plus app-level events. Human-pretty mode for dev. Log level per backend config. **No secrets in logs** enforced by a redaction helper used everywhere a config object is logged — greppable convention, tested.
- **Request correlation**: `X-Request-Id` accepted or generated, present in logs, error responses, and execution records (WF-006 hookup) — one id follows a webhook from arrival through workflow to reply.
- **Audit trail**: an append-only `_Audit` table for privileged mutations — schema changes, permission/CLP edits, role changes, key issue/revoke, backup/restore, template/config edits, admin logins (success and failure) — recording who/what/when/from-where. Queryable in the dashboard (BAK-005 section), exportable via BAK-007. Pre-decided: plain table + documented "the DB owner can edit it" honesty; no tamper-proofing theater.
- **Metrics**: `GET /metrics`, Prometheus text format, admin-or-localhost gated: request counts/durations by route class and status, active SSE connections, trigger firings, email sends, backup age, DB file size, process stats. No dashboards shipped — the format is the product.
- **Graceful shutdown**: SIGTERM → stop accepting, drain in-flight (bounded), close SSE with `resync`-style goodbye, flush, exit 0 — tested, because WF-004's supervisor and every `docker stop` depend on it.
- **Headers/CORS**: correct defaults — CORS per backend config (explicit origins; `*` allowed but warned on non-localhost), sensible security headers on `/_admin`, honest `Server` header. TLS stays the reverse proxy's job: a **verified** Caddy example (and an nginx equivalent) in the deploy docs, tested end-to-end once.
- **Ops runbook**: one document — systemd unit, Docker example, reverse proxy, log collection, metrics scrape, backup destination, "what to check when it's slow."

## Scope

### In Scope
- [x] Rate-limit middleware + route-class policies + migration of BAK-002's one-offs + trusted-proxy handling
- [x] Structured logging + redaction helper + tests that secrets never log
- [x] Request ids end-to-end incl. WF-006 linkage
- [x] `_Audit` table + hook points in the privileged paths + dashboard section + retention setting
- [x] `/metrics` + gating
- [x] Graceful shutdown incl. SSE goodbye, with tests
- [x] CORS/header defaults + config
- [x] Verified Caddy + nginx examples; the ops runbook *(Caddy verified live; nginx gained the `/metrics` refusal but its TLS path was not re-run)*
- [x] MCP: read rate-limit config, query audit entries (agents debugging their own backends)

### Out of Scope
- Distributed rate limiting, log shipping, tracing (OpenTelemetry noted as future; request ids are the seam)
- Alerting (metrics + the operator's Prometheus/Grafana are the answer)
- Uptime/status pages; APM integrations
- Tamper-proof audit (documented stance)

## Implementation Steps

1. **Logging + request ids first** — everything else wants them.
2. **Rate limiter** + policies + BAK-002 migration + proxy trust.
3. **Audit trail** + hook points (sweep every privileged route; the BAK-003 route-table test pattern finds them).
4. **Metrics; graceful shutdown; headers/CORS.**
5. **Runbook + verified proxy examples** (live end-to-end check on a clean VM with WF-003's deploy path).

## Success Criteria

- [x] Hammering `/login` yields 429 + `Retry-After` while data routes stay unaffected; limits configurable per backend; correct client IPs behind the documented proxy setup *(both tested and verified live through Caddy, including a forged `X-Forwarded-For` being ignored)*
- [x] Every request produces one structured log line; a planted secret in config never appears in logs (test) *(one line even for 404s and hung-up clients; re-narrowing the redaction rule fails the test)*
- [x] A webhook's request id is traceable: access log → execution record → response header
- [x] Changing a CLP, restoring a backup, and a failed admin login all appear in the audit view with actor and origin *(plus REFUSED attempts, which record as failures)*
- [x] `/metrics` scrapes cleanly in Prometheus; backup-age metric goes stale-visible when backups stop *(absent rather than zero until a backup succeeds; scraped by a real exposition parser in test, not by a real Prometheus)*
- [x] `docker stop` (SIGTERM) exits 0 with in-flight requests completed and SSE clients notified — under test *(real CLI, real signal; the test builds the bundle first)*
- [x] A cold reader deploys with the runbook + Caddy example and gets TLS, logs, metrics, limits without guesswork *(`docs/runtime/BACKEND-OPERATIONS.md`; the Caddy example was run rather than written from memory — a cold READER has not been observed)*

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Rate limits break legitimate SSE/webhook bursts | Route-class policies, not one global bucket; SSE connections exempted from request-rate buckets and capped by connection count instead |
| Redaction misses a path | Single helper + test fixture with planted secrets across every loggable config shape |
| Audit hooks drift as routes evolve | Reuse BAK-003's route-walking test pattern: privileged routes must declare an audit action or fail CI |
| Shutdown hangs on stuck streams | Bounded drain timeout, then hard close — documented |
| Runbook rot | The Caddy example is *verified* as a named step, and re-verified in WF-003's release checks |

## References

- [WF-004](../phase-19-cloud-workflows/WF-004-BACKEND-SERVICE.md) — supervision/lifecycle this hardens; [WF-006](../phase-19-cloud-workflows/WF-006-OBSERVABILITY-WIRING.md) — execution records joined by request id
- [WF-003](../phase-19-cloud-workflows/WF-003-MANAGED-DEPLOY.md) — the deploy docs home
- [BAK-002](./BAK-002-EMAIL-SUBSYSTEM.md), [BAK-005](./BAK-005-SERVED-ADMIN-DASHBOARD.md) — the one-offs this generalizes
- Prometheus exposition format; Pocketbase's logs/settings UI — parity reference

## Checklist

- [x] Logs + redaction + request ids
- [x] Rate limiter + policies + proxy trust
- [x] Audit trail + dashboard view + CI hook-coverage test
- [x] Metrics; graceful shutdown tests; CORS/headers
- [x] Runbook + verified proxy examples; MCP; CHANGELOG
