# OPS-004: The Ops Panel — One View Over What Is Already Emitted

## Metadata

| Field | Value |
|-------|-------|
| **ID** | OPS-004 |
| **Phase** | Phase 31 — Readiness & Operations (Track P) |
| **Tier** | 2 — visibility |
| **Priority** | 🟠 High |
| **Difficulty** | 🟢 Low–Medium — almost everything it shows already exists and is unreachable |
| **Estimated Time** | ~1 wk |
| **Prerequisites** | OPS-001 (level + registry), OPS-002 (identity) |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** — the whole value is in what it looks like when something is wrong |

## Objective

One panel that answers "what is my app doing right now" for a deployed NodeGX app, assembled entirely
from data the backend and the deploy pipeline already produce.

## Background

The [control-panel chapter](../../../../ai-coding-docs/docs/part-5/control-panel.md) opens with the
audience this phase exists for:

> "People who come from n8n, Directus, Pocketbase, and Bubble are used to seeing their backend. […]
> When AI codes your backend, that visibility disappears."

Its four tabs are Deployment Centre, Data Browser, Automation Visualiser, and Security & Testing.
**Three of them already exist in NodeGX as better, native surfaces** — `views/panels/databrowser/`,
WFA-004's workflow canvas with WFA-002's run inspector, and (after OPS-006) the security sweep.
Rebuilding them as tabs would be cargo-culting the prosthetic.

What is missing is the first one, and it is missing in a specific way: the chapter's `deployment.json`
is a file a human must keep accurate. NodeGX knows its own services. There is nothing to author.

The chapter's own evidence for why this pays: the deployment tab immediately revealed that Sprint 3
code had never been deployed, and the security runner caught `DIRECTUS_URL` where `VITE_DIRECTUS_URL`
was needed. Both are runtime-config truths that reading the code cannot produce.

## Current State

Everything below exists and is not assembled anywhere:

| Data | Where it already is |
|---|---|
| Backend liveness | `GET /health`, `HttpServer.ts:413` (public) |
| Ops state, metrics | `packages/nodegx-backend/src/ops/OpsState.ts`, `metrics.ts` (BAK-009) |
| Request ids, rate limits | `ops/request-id.ts`, `ops/rate-limit.ts` |
| Audit trail | `ops/audit.ts`, the `_Audit` collection |
| Structured logs, redaction | `ops/logger.ts`, `ops/redact.ts` |
| Executions | `GET /executions` (WF-004/WF-006), surfaced by WFA-002 |
| Backups | BAK-007, including a tested restore round-trip |
| Access control state | BAK-003 CLPs/ACLs |
| Build identity | OPS-002 |
| Backend endpoints in the editor | `views/panels/BackendServicesPanel/` |

## Desired State

### 1. One panel, five rows, no tabs

Rail panel, visible at Sharing and above. Each row is one question a person actually asks:

| Row | Answers | Source |
|---|---|---|
| **Running** | is it up, and what build is it? | `/health` + OPS-002 identity, side by side |
| **Errors** | what has broken recently? | `runtime-error` findings (OPS-003) + backend error log |
| **Traffic** | is anything happening, and is anything being throttled? | `ops/metrics.ts`, `ops/rate-limit.ts` |
| **Data** | how big, when was it last backed up, and has a restore ever been proven? | BAK-007 |
| **Access** | who can read and write what? | BAK-003 CLP summary; the full audit is OPS-006 |

The **Running** row is the one that must be excellent. Build digest, age, target, declared level, and
any acknowledged unmet readiness items from the deploy — the artifact carries them (OPS-002 §1), so the
answer to "did we ship this knowing it wasn't ready?" is one glance.

### 2. Multiple backends, honestly

Execution history already merges across every running backend plus the editor-local store, and WFA-002
found that two backends running the same-named function produce near-identical records. The Ops panel
inherits that problem and must not hide it: every row is per-backend, and a backend that fails to
answer reads as *unreachable*, never as *zero*.

### 3. Empty and broken states are distinct

Three states, always distinguishable, for every row:

- no backend configured (a frontend-only app — this is `not-applicable`, not a failure)
- backend configured, not reachable
- backend reachable, nothing to report

### 4. Readiness items

Registers `ops.uptime-check` (Live) and `ops.backup-verified` (Live). The second one is deliberate:
BAK-007 shipped a *tested restore round-trip*, and almost nobody who takes backups has ever restored
one. `met` evidence is the date of the last proven restore, and the item offers to run one.

### 5. It is read-only

No restarts, no scaling, no destructive actions. WFA-002's run/cancel already exists in its own panel
and belongs there. A panel that can break production is a different task with a different review bar.

## Implementation Steps

1. Inventory what `ops/*` and BAK-007 actually expose over HTTP today, and record the gaps in
   `OPS-004-NOTES.md` before designing around assumptions.
2. The Running row, including acknowledged-unmet display.
3. Errors, Traffic, Data, Access rows.
4. Per-backend rendering + the unreachable-vs-zero distinction.
5. The three empty states.
6. The two readiness items, including "run a restore now."
7. **Live pass**: with a backend running, stop it mid-session and confirm every row degrades to
   *unreachable* rather than to zeroes. Screenshot both states.

## Success Criteria

- [ ] Every row is populated from an existing source; **no new backend endpoint was added**, or the
      one that was is justified in writing.
- [ ] The Running row shows digest, age, target, level and any acknowledgements.
- [ ] Stopping a backend turns rows *unreachable*, never zero. Verified live.
- [ ] Two backends serving the same function are distinguishable.
- [ ] A frontend-only project reports `not-applicable`, not failure.
- [ ] `ops.backup-verified` shows the last proven restore date and can trigger one.
- [ ] No action in the panel can affect production state.

## Out of Scope

- **Rebuilding the data browser, the automation visualiser or the run inspector.** They exist.
  Link to them.
- **Prometheus/Grafana.** The observability chapter is explicit that infra metrics are a different
  axis and usually overkill for a small-team deployment. At Scale we link out; we do not embed.
- **Alerting.** OPS-005 owns it.
- **Extending `nodegx-backend`.** This is a view. A missing endpoint is a finding.

## Traps

- **`GET /executions` returns a bare array; `GET /executions/:id` returns an object** (observed live,
  WFA-002). Do not assume a consistent envelope across the ops surface either — check each.
- **Hidden-but-mounted panels go stale** (WFA-002's own finding). Whatever polls here must stop when
  the panel is not visible, or a background poller runs for the life of the editor.
- **`ops/redact.ts` exists for a reason.** Anything rendered from logs or audit goes through it. A
  screenshot of this panel is one support ticket away from containing a token.
- **A "0 errors" reading is the most dangerous cell on the panel.** It is correct exactly when error
  capture is wired (OPS-005) and misleading otherwise. Until OPS-005 lands, this row says *"error
  capture is not switched on"*, not zero.
- **Backup size and count are cheap; a *verified restore* is not.** Do not let the readiness item's
  evidence quietly degrade from "restore proven" to "backup exists" — that is the entire distinction
  the item is for.
</content>
