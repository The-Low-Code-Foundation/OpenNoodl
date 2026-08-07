# The Backend Gap — Viability Assessment

**Date:** 2026-07-24
**Question:** NodeGX has a strong frontend (React runtime, RUN-001) and a nearly-real local database (RUN-004's territory). Backend logic — functions, workflows, triggers — is the remaining leg of the full-stack story. Is filling it viable for this project, and what shape should it take?
**Supersedes:** the "park most of it" framing in this phase's original README (2026-07-22). That framing predated the 2026-07-24 salvage audit ([PRE-REVIVAL-SALVAGE-AUDIT.md](../../reviews/PRE-REVIVAL-SALVAGE-AUDIT.md)) and the completion of the AI substrate (phase 13) it turns out to change the economics of this work.

## Verdict

**Viable — as "one coherent self-hostable backend service," not as n8n parity.** Roughly 3–4 months of sequenced solo-with-AI work, of which the genuinely hard part (workflow execution semantics) is one task. The rest is assembly of pieces that already exist, several of them tested and waiting. Two conditions attach:

1. **Scope discipline.** The moment this phase starts chasing n8n's integration library or a hosted platform, it recreates the twelve-parallel-ambitions failure. The differentiator is not integration count (see §5) and must not be pursued as if it were.
2. **Sequencing.** This track still yields to the G2-critical work (authoring loop, pilots). But "yields" now means "runs second," not "stays parked" — because the backend is what makes both wedges whole (§4).

## 1. What "backend" means here

Six capabilities, judged separately because their states differ wildly:

| Capability | What it means | State today |
|---|---|---|
| **Functions** | Request → graph logic → response, over HTTP | **Works.** `CloudRunner` (99 lines) + `WorkflowRunner` dispatch + `POST /functions/:name` on the local backend |
| **Data** | Persistent storage the backend and frontend share | **Wired but hollow** — full adapter + REST API + UI over an in-memory mock; `better-sqlite3` never installed (RUN-004) |
| **Workflows** | Multi-step executions with ordering, error routing, retry, cancellation | **Absent.** No engine. The deeper `feature/task-007c-workflow-runtime` work is not in this clone — treat it as lost |
| **Triggers** | Schedule/cron, webhooks, DB-change events | **Absent entirely.** No scheduler, no webhook registration, no queue — specs only |
| **Observability** | Execution history, per-node visibility on the canvas | **Built at both ends, severed in the middle.** Tested `ExecutionStore`/`ExecutionLogger` (~1,300 lines) never called; History Panel + canvas ExecutionOverlay shipped but their IPC channel has no handler |
| **Deploy** | Run it somewhere other than the editor | **Absent.** The backend currently lives inside Electron's main process and cannot run headless |

The pattern (same as everywhere in the salvage audit): the visible layers exist, the load-bearing middle doesn't. That is why the user experience reads as "shitty backend" while the audit reads as "60% built."

## 2. What is reusable — the inventory that changes the math

The February 2026 sprint left more standing than the phase-11 tracker records:

- **The function model is good and stays.** Request/response cloud functions authored as graph components under `/#__cloud__/` — this is the part the original Noodl got right. Nothing here proposes changing how users author backend logic.
- **`LocalSQLAdapter` + `QueryBuilder` + `SchemaManager`** (~2,274 lines) — a real data layer needing only a real engine underneath (§3.2).
- **`LocalBackendServer`** (595 lines) — HTTP surface with REST-per-table (`/api/:table`), batch, schema, and function routes. Grows trigger routes; doesn't get rewritten.
- **Execution history** — a tested store with a real schema, a logger with defined event shapes, and two shipped UI surfaces. This is WF-001's observability layer, already paid for.
- **The node substrate.** Workflow nodes are ordinary nodes on the typed runtime (PLAT-003), enumerable in the catalog (SUB-004/005), checkable by the validator (SUB-006), and authorable through MCP (SUB-008). None of this existed when phase 11 stalled. It is the single biggest change to this assessment (§5).
- **Schema manager + data browser UI** (~4,600 lines) — the admin surface a backend product needs, already wired.

## 3. The architecture decision: a standalone backend service

The "overhaul completely and satisfactorily" option is real, and it is not a rewrite — it is a **relocation**. Extract the local backend into its own package (working name: `packages/nodegx-backend`) that runs as a **separate Node process**: spawned as a child process by the editor during development, run directly (`node`, `systemd`, Docker) in deployment. WF-004 owns this.

Why this is the load-bearing move:

### 3.1 It is the deploy story
A backend living in Electron's main process can never run on a server. As a standalone service, "deploy" stops being a bespoke target-matrix problem and becomes "run this Node service" — which makes WF-003's Docker-Compose-on-a-VPS default natural, and keeps the education wedge honest (a school server can run it; no vendor account).

### 3.2 It may dissolve the native-module trap
The viability report rates the `better-sqlite3`/Electron-ABI problem as one of the few potential project-killers. Two escape routes open up, to be evaluated in WF-004/RUN-004 jointly:

- **`node:sqlite`.** Node's built-in SQLite module (flag-free since Node 22.13/23.4; the post-REV-004 Electron bundles a Node in that range — verify the exact version and API coverage: prepared statements, WAL, transactions). If it covers `LocalSQLAdapter`'s needs, the native dependency disappears *entirely* — no ABI, no rebuild scripts, no platform matrix, forever. The adapter's engine access is already funneled through one `require` in one file; the swap surface is small.
- **Separate-process placement** changes what ABI matters at all, and for a deployed instance (system Node) prebuilt `better-sqlite3` binaries are routine.

Either route also un-blocks the orphaned `ExecutionStore`, which takes its database via constructor injection and has never been fed a real one.

### 3.3 Crash isolation and honesty
A hung workflow must not wedge the editor. A separate process makes cancellation and timeouts (WF-001's semantics) enforceable at the process boundary in the worst case, and makes the backend's status (running / stopped / failed) an honest, visible fact rather than an implicit property of the editor being open.

### 3.4 What happens to Parse "Cloud Services" — revised 2026-07-24 after a code-level map

A full map of the framework (run 2026-07-24) replaced the earlier "leave it untouched" position with a sharper one. Three findings drive it:

1. **There is no Parse server anywhere in this repo and never was.** No `parse-server` or `parse` SDK dependency in any package; no broker; `packages/noodl-parse-dashboard` is a vendored Parse Dashboard that nothing references. The "framework" is only ever a set of *clients* pointed at an external server the user configures (`CloudServicePanel` → `{endpoint, appId, masterKey}` in local storage, `{endpoint, appId}` in project metadata).
2. **There are two parallel data stacks that never meet.** The 9 current record nodes (`DbCollection2`/"Query Records", `DbModel2`/"Record", relations, etc.), the user/auth nodes, and cloud-function calls all speak **Parse REST** through four thin clients (`cloudstore.js` 626 lines — the object-CRUD choke point — plus `userservice.ts` 434, `cloudfunctions.js` 73, `configservice.js` 112). The local backend speaks a *different* protocol (`/api/:table`) consumed only by the separate BYOB nodes. Consequence: **"Query Records" against the local backend has never worked** — the flagship data nodes and the local database cannot see each other. The `AdapterRegistry`'s `parse` stub ("use existing CloudStore") is the seam where these were supposed to meet and never did.
3. **The Parse surface the nodes actually use is a bounded subset**: ~15 endpoints (`/classes`, `/aggregate`, `/files`, `/functions`, `/config`, `/login`+7 session endpoints), one query grammar, five special types (Pointer/Date/File/GeoPoint/Relation + Increment). **No** live queries, push, GraphQL, or client-side schema/ACL management. And `LocalSQLAdapter`/`QueryBuilder` were already written CloudStore-shaped — the query-grammar logic half-exists.

**The decision: the wire protocol is the contract; the framework is not.** `nodegx-backend` speaks the Parse-wire *subset* the four clients emit. That single choice:

- makes the record/user/function nodes work against the local backend **with zero client-file changes** — healing the two-stack split (one node set, one backend, at last);
- keeps existing external-Parse users working for free (protocol compatibility *is* the compat story — nothing to maintain beyond the subset we serve ourselves);
- and licenses deleting the actual mess (WF-007): the `CloudServices` model + `CloudServicePanel`, the `deploy-cloud-functions` master-key POST pass, the hidden-BrowserWindow `cloud-function-server.js` on port 8577 (today's dev-time cloud-function runner — superseded by the service's `/functions` route), and the orphaned `noodl-parse-dashboard` package.

What we explicitly do **not** build: master-key admin surface, ACL/CLP management, live queries, push — unused by the nodes, permanently out. The BYOB nodes and `backendServices` metadata remain the external-backend (Directus/Supabase) story, per RUN-003.

## 4. Why the backend matters strategically (the user's case, tested)

The claim "we fix that, we fix the last piece of the puzzle" holds up under both wedges:

- **The AI-collaborative builder.** AIX-002's demo currently stops at the frontend. An agent that can author a page but not the endpoint behind it builds half an app; every real project then requires a third-party backend signup, which is exactly the friction the product exists to remove. With workflow nodes in the catalog, *"describe an app → agent builds the page, the API, and the scheduled job — all in graphs you can read"* is a demo no competitor offers.
- **Education (Phase 17).** A webhook receiving data, a cron job processing it, a DB storing it — that *is* the backend curriculum, in the same visual language as the frontend curriculum. And self-hosting matters here: school data may not leave premises, and "sign up for n8n cloud" is a hard stop in a classroom.
- **Full-stack completeness compounds.** Frontend + DB without backend logic is a brochure-site tool. Each leg raises the value of the other two.

## 5. The n8n question, answered honestly

Bringing NodeGX "to the capability level of n8n" is the right *capability* target and the wrong *strategy* target. n8n's moat is ~400+ maintained integrations, a marketplace, and a hosted product with a company behind it. Chasing that checklist solo is unwinnable and is precisely the shape of failure this project already lived through once.

What n8n cannot offer, and NodeGX can:

1. **One language, front and back.** The same graph vocabulary, same editor, same catalog for the page and the workflow behind it. n8n is backend-only; every n8n user still needs a frontend somewhere else.
2. **AI-authorable through a substrate, not a chat window.** The catalog + validator + MCP stack means an agent authors workflows the same verified way it authors pages — and the integration library problem inverts: instead of maintaining 400 connectors, an agent writes the specific Stripe-webhook handler you need, as a graph you can read and a validator can check. Integrations become *generated, legible artifacts* rather than a library to maintain. This is the only credible answer to the integration-count question, and it only exists because phase 13 shipped.
3. **Self-hosted by default, no per-execution pricing.** A Node service and a SQLite file. For education and hobbyists this is not a feature, it is the whole ballgame.

The scope rule that follows: **build the engine, the trigger surface, and the substrate integration. Do not build an integration library. Ever.** If a specific connector matters, it is an example workflow or a generated artifact, not a maintained product surface.

## 6. Risks

| Risk | Assessment |
|---|---|
| **Capacity — the historic killer.** This is ~3–4 months that isn't the authoring loop or pilots | Sequencing condition in the verdict: Track G runs behind the G2-critical path. WF-006 and RUN-004's loud-failure fix are days-scale and can land early without competing; the engine work waits its turn |
| **Execution semantics are genuinely hard** (ordering without frames, error routing, cancellation, partial-execution recording) | WF-001 treats semantics as the deliverable, documented before implementation; everything else in the phase is assembly |
| **Webhooks are an attack surface** — a listening HTTP server accepting external calls | Localhost-only by default; token auth required the moment it binds wider (WF-004); deploy hardening in WF-003. No public-by-default anything |
| **Long-running executions vs. process lifecycle** (laptop closes mid-workflow) | Semantics must define durability honestly: v1 workflows are resumable-or-failed-loudly, never silently half-run. The execution store records partial state |
| **`node:sqlite` doesn't cover the adapter's needs** | It's an evaluation gate in WF-004, not an assumption; `better-sqlite3`-with-prebuilds remains the fallback, made tractable by process separation |
| **Scope re-inflation** (Python runtime, monitoring suite, provider matrix, marketplace) | Stays parked, same reasons as before. The phase does six tasks and stops |

## 7. Exit criterion for the phase

A user — or an agent through MCP — can build a workflow that: is triggered by a webhook **and** on a schedule, reads and writes the local database, handles a failing step through an error route, and shows its executions in the History Panel and on the canvas. The same workflow deploys to a VPS by the one documented path and keeps running with the editor closed.

That sentence is the "last piece of the puzzle" made testable.

## 8. Task map (revised phase 19)

| Order | Task | What | Size |
|---|---|---|---|
| 1 | **WF-006** | Light up observability: wire `ExecutionLogger` into today's function executions, add the missing IPC handlers — the shipped panels show real data *before* any engine exists | 3–5 days |
| 2 | **WF-004** | The standalone backend service: extract to `packages/nodegx-backend`, child process in dev / headless in deploy, engine decision (`node:sqlite` vs `better-sqlite3`), coordinate with RUN-004, minimal token auth | 2–3 wks |
| 3 | **WF-001** | The workflow engine: execution semantics (ordering, error routing, cancellation, timeouts, durability), built on the typed node substrate | 3–4 wks |
| 4 | **WF-002** | Series 1 workflow nodes (logic, error handling, wait/delay) + catalog entries — largely as already specified | 3–4 wks |
| 5 | **WF-005** | Triggers: cron scheduler, webhook routes, DB-change events; trigger-configuration UX in the editor | 2–3 wks |
| 6 | **WF-003** | One deploy target done well (Docker Compose self-host default), now reduced to packaging the WF-004 service | 2–3 wks |
| 7 | **WF-007** | Retire the Parse framework: relocate endpoint config, delete the dashboard package / CloudServices model + panel / deploy pass / port-8577 function server | ~1 wk |

RUN-004's loud-failure deliverable is independent and should land immediately regardless of this phase's schedule; its engine-fix half merges into WF-004's decision. WF-004 grows one load-bearing scope item from §3.4: the service's data/auth/function routes speak the Parse-wire subset, which is what makes WF-007's deletions safe and the record nodes finally local-capable.
