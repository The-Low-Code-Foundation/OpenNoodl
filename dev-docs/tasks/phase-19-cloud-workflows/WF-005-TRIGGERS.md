# WF-005: Triggers — Schedule, Webhook, DB-Change

## Metadata

| Field | Value |
|-------|-------|
| **ID** | WF-005 |
| **Phase** | Phase 19 — Cloud & Workflows (Revival Track G) |
| **Priority** | 🟠 High (triggers are what turn "functions" into "automation") |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 2–3 weeks |
| **Prerequisites** | WF-004 (the service triggers live in); WF-001 only for workflow-targeted triggers |
| **Branch** | `task/wf-005-triggers` |
| **Recommended executor** | 🟠 **Opus 4.8** — scheduling, webhook security, and missed-fire semantics have opaque failure modes; the editor UX half is conventional once the semantics are set. |

## Objective

Give the backend service the three trigger types that make it an automation platform — cron schedules, incoming webhooks, and database-change events — able to invoke today's request/response functions immediately and WF-001's workflows once they exist.

## Background

The salvage audit ([PRE-REVIVAL-SALVAGE-AUDIT.md](../../reviews/PRE-REVIVAL-SALVAGE-AUDIT.md) §7) established that **no trigger infrastructure exists anywhere** — no scheduler, no webhook registration, no queue. The phase-11 README's claim that Phase 5 delivered "basic trigger nodes (Schedule, DB Change, Webhook)" is not borne out by code; the only invocation path is a manual `POST /functions/:name`.

Triggers are deliberately their own task, separate from the engine, for two reasons. First, they are valuable *before* the engine: a cron-fired or webhook-fired plain function is already a useful automation, and shipping that early exercises the whole service path. Second, their semantics (missed fires, retries, dedup, payload limits) are a distinct design space from execution semantics, and bundling them into WF-001 would bloat the phase's hardest task.

This is also where the "n8n alternative" claim earns its keep in the education wedge: webhook-in → process → store → scheduled digest is *the* backend curriculum, in graphs.

## Current State

- `LocalBackendServer.js` route table (lines 155–238): `/health`, `/api/_schema`, `/api/_batch`, `/api/:table`, `/api/:table/:id`, `/functions/:name`. Nothing else.
- No cron/scheduler dependency in any package.
- `LocalSQLAdapter` performs writes but emits no change events.
- The node catalog (`packages/noodl-types/src/node-catalog.json`) contains only `noodl.cloud.request`, `noodl.cloud.response`, `noodl.cloud.aggregate` + the client Cloud Function node.

## Desired State

- **Schedule:** a cron expression (plus friendly presets) attached to a function/workflow; the scheduler lives in the WF-004 service, fires while the service runs, and has *defined and documented* missed-fire behavior (service was down at fire time → skip vs. run-once-on-start; pick, document, surface in UI).
- **Webhook:** `POST /hooks/<backend-id>/<hook-slug>` routes to a designated function/workflow with the request as payload. Per-hook secret (HMAC signature or token — decide against what typical senders like GitHub/Stripe do), payload-size limit, and per-hook enable/disable. Localhost binding + WF-004's auth still govern reachability; a deployed instance exposes hooks deliberately, not by default.
- **DB-change:** insert/update/delete on a chosen table invokes a designated function/workflow with the change payload. Delivered post-commit; loop protection (a handler writing to its own trigger table must not recurse unbounded — decide the rule: no re-trigger from trigger-context writes, or a depth cap; document it).
- **Editor UX:** trigger configuration lives with the cloud function component (a panel section listing a function's triggers: type, config, enabled, last fired, last result), backed by trigger definitions stored in backend config so they deploy with the backend.
- **Catalog:** whatever surfaces as nodes (e.g., a "Webhook Received" event node as a workflow entry point) ships with SUB-004/005 catalog entries; trigger *configuration* that isn't node-shaped is still visible to agents via MCP (SUB-008) — an agent must be able to enumerate and create triggers, or the AI-authors-the-backend story has a hole.
- Every trigger firing produces an execution record through WF-006's wiring, with the trigger source recorded.

## Scope

### In Scope
- [ ] Trigger registry in backend config (persisted, deployable, CRUD over the existing IPC/HTTP seam)
- [ ] Cron scheduler in the service + missed-fire policy
- [ ] Webhook routes + per-hook secrets + size limits
- [ ] DB-change events from the adapter's write path + loop protection
- [ ] Editor UI for creating/managing triggers on a function
- [ ] MCP visibility: enumerate/create/update triggers
- [ ] Catalog entries for any new nodes
- [ ] Execution records tagged with trigger source (via WF-006)
- [ ] Tests: cron fire, webhook auth accept/reject, change-event delivery, loop protection

### Out of Scope
- Queues, at-least-once delivery guarantees, or distributed scheduling — single-process semantics, documented honestly
- Polling triggers (IMAP, RSS, third-party APIs) — integration territory, permanently parked per the phase README
- Public tunnel/ngrok-style exposure for local webhooks (document the limitation; a deployed instance is the answer)
- Retry policies beyond a single documented default (rich retry is WF-002's error-node territory)

## Implementation Steps

1. **Design the trigger registry schema** (type, target, config, enabled, secrets) and the firing contract shared by all three types — one code path from "trigger fired" to "execution started, record written."
2. **Cron** (use a small, maintained cron-parse library; the scheduler loop is trivial once parsing is): fire → invoke target → record. Missed-fire policy decided and documented.
3. **Webhooks**: routes, secret verification, limits; reject unauthenticated hooks loudly in the execution record.
4. **DB-change**: emit from the adapter post-commit; loop rule enforced and tested.
5. **Editor UI** section + IPC/HTTP CRUD.
6. **MCP + catalog** surface.
7. **Docs** for each trigger type: semantics, security, limitations.

## Success Criteria

- [ ] A function fires on a cron schedule with the service running, and its executions appear in the History Panel tagged as scheduled
- [ ] An external `curl` with the correct secret fires a webhook-targeted function; wrong secret is rejected and recorded
- [ ] A table insert fires a change-targeted function; a handler writing to its own table does not recurse unbounded
- [ ] Triggers survive service restart (persisted config) and deploy with the backend
- [ ] An agent can enumerate and create triggers via MCP
- [ ] Missed-fire, loop, and security semantics documented

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Webhook endpoint becomes an attack surface | Per-hook secrets mandatory, size limits, localhost default, WF-004 auth for wider binding; failures recorded, not silent |
| Scheduler drift/missed fires erode trust | Explicit documented policy + "last fired / next fire" visible in UI beats false precision |
| DB-change triggers create infinite loops | The loop rule is a scope item with a test, not an afterthought |
| Trigger config invisible to agents breaks the AI-backend story | MCP surface is in scope and a success criterion, mirroring WF-002's catalog rule |
| Semantics designed twice (functions now, workflows later) | One firing contract; workflows are just a second target type when WF-001 lands |

## References

- [BACKEND-GAP-ASSESSMENT.md](./BACKEND-GAP-ASSESSMENT.md) §1, §5
- [PRE-REVIVAL-SALVAGE-AUDIT.md](../../reviews/PRE-REVIVAL-SALVAGE-AUDIT.md) §7 — "no triggers" finding
- WF-004 (the service), WF-006 (execution records), SUB-008 (MCP), SUB-004/005 (catalog)

## Checklist

- [ ] Registry schema + firing contract designed and recorded
- [ ] Cron, webhook, DB-change implemented with their policies
- [ ] Editor UI; MCP surface; catalog entries
- [ ] Tests incl. security and loop protection; docs; CHANGELOG
