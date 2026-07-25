# BAK-003: Access Control — Permissions, ACLs, Roles, API Keys

## Metadata

| Field | Value |
|-------|-------|
| **ID** | BAK-003 |
| **Phase** | Phase 22 — Production Backend (Revival Track H) |
| **Tier** | 1 — credibility |
| **Priority** | 🔴 Critical (a backend anyone can fully read and write is not deployable, whatever else it does) |
| **Difficulty** | 🔴 High |
| **Estimated Time** | 2–3 weeks |
| **Prerequisites** | WF-004; its design shapes BAK-001/004/005/006 — land the *model* early |
| **Branch** | `task/bak-003-access-control` |
| **Recommended executor** | 🔵 **Fable 5** — the permission model is semantics-defining and expensive to reverse; a wrong default here is either a data breach or a product nobody can use. Implementation delegates down once the model is recorded. |

## Objective

Define and enforce the backend's authorization model: collection-level permissions, per-record ACLs, roles, and server-side API keys — with a default posture that is safe when deployed and unobtrusive during local development, and with the whole model visible and editable to agents via MCP.

## Background

WF-004 deliberately ships minimal auth: localhost binding plus one bearer token. Fine for a dev service; fatal for the phase's production claim — the moment WF-003 puts a backend on a VPS, every collection is world-readable and world-writable to anyone holding the app id. Pocketbase's equivalent (per-collection API rules) is arguably its single most production-defining feature.

Two constraints shape the design. First, **the wire protocol is the Parse subset** — enforcement must happen behind the existing routes without changing what the four runtime clients emit. Parse's own model (class-level permissions + per-object ACL field + roles) is therefore the natural vocabulary: the clients already pass session tokens, and an `ACL`-shaped field on records is within the dialect they tolerate. Verify against `cloudstore.js`/`userservice.ts` behavior, not Parse docs. Second, **agents must be able to author security**: a permission model that only exists as UI clicks breaks the AI-authors-the-backend story; the model must be config-shaped, enumerable, and writable via MCP like everything else.

## Current State

- WF-004 (specced): localhost by default; single bearer token for wider binding; sessions (`/login`, `/users`, `X-Parse-Session-Token`, error 209) exist; **no master-key surface**.
- No permission checks on any data route; no roles; no API keys; `/functions` and triggers run with full access implicitly.
- BAK-001 ships a pluggable `canRead` hook awaiting this task; BAK-006 wants file-read checks; BAK-005 wants an admin tier.

## Desired State — the model (decide, record, hold everything to it)

- **Three principal types**: end users (session token), **API keys** (server-to-server callers — external services invoking functions/hooks; named, revocable, scoped to capabilities), and **the admin credential** (full access; consumed by the editor's supervision channel and BAK-005's dashboard; supersedes WF-004's single token — record the migration).
- **Collection-level permissions (CLPs)** per operation (find, get, create, update, delete) with values from: `public` / `authenticated` / `role:<name>` / `nobody` (server-only). Stored in backend config → deploys with the backend, diffable, MCP-editable.
- **Per-record ACLs**: an ACL field granting read/write to users/roles/public, Parse-shaped. CLPs gate the operation; ACLs filter the rows. Queries must apply ACL filtering **in SQL**, not post-filter in JS (correctness of `count`/`limit` and performance both demand it — this is the hard engineering in the task).
- **Ownership convenience**: the common "users see their own records" case must be expressible without hand-writing ACL JSON — creator-owns default per collection (an `owner` pointer set server-side + template ACL). This is the 90% case in every classroom and most apps; it should be one toggle.
- **Roles**: flat role membership (`_Role`-shaped, users↔roles), usable in CLPs and ACLs. No role hierarchy in v1 — record the restriction.
- **Server-side context**: cloud functions, workflows, and triggers run as **system** (bypass) by default, with an opt-in "run as calling user" mode per function — the inverse default is a foot-gun; record the reasoning.
- **Default posture (pre-decided, verify in design):** collections default to `authenticated` CRUD + creator-owns on create. Local dev adds a per-backend **dev-open switch** that relaxes everything while the service binds to localhost only — and that switch is *physically incapable* of surviving a non-localhost binding: deploying with dev-open on is a refuse-to-start error, not a warning. Loud-failure doctrine applied to security.
- **Surfaces**: per-collection permissions editor in the Backend Services panel (one-panel constraint); the same config via MCP; BAK-005 renders the same editor in the served dashboard later.

## Scope

### In Scope
- [ ] The recorded model document (permission vocabulary, principal types, defaults, evaluation order) — this artifact is a deliverable, referenced by BAK-001/004/005/006
- [ ] Enforcement middleware on `/classes`, `/aggregate`, `/files`, `/functions`, and the BYOB `/api/:table` routes — one enforcement point, every route through it
- [ ] ACL-aware SQL query rewriting in `QueryBuilder` with correctness tests (count/limit/skip under ACL filtering)
- [ ] Roles, API keys (issue/revoke/scope), admin credential; WF-004 token migration
- [ ] Creator-owns toggle; dev-open switch with the deploy interlock
- [ ] Flip BAK-001's delivery hook to real ACL checks (checklist item owed to that task)
- [ ] Panel permissions editor; full MCP surface (enumerate/set CLPs, roles, keys)
- [ ] Migration for pre-existing backends (default: authenticated, with a loud one-time notice)
- [ ] Adversarial test suite: cross-user reads, ACL bypass via aggregate/distinct/count, session reuse after password change, key scope escalation

### Out of Scope
- Field-level permissions and row-level *rule expressions* (Pocketbase-style filter DSL) — the CLP+ACL+owner model first; a rule DSL only if real usage demands it (record as a possible BAK follow-on)
- Role hierarchies/inheritance
- MFA, SSO (parked at phase level); OAuth is BAK-004 atop these sessions
- Admin *UI* beyond the panel editor (BAK-005)

## Implementation Steps

1. **Write the model document.** Evaluation order, JSON shapes, defaults, every "why." Review against each downstream task's needs before any code.
2. **Enforcement middleware + session/key/admin resolution**, applied route-by-route with the dev-open switch and deploy interlock first — the posture must exist before the finesse.
3. **ACL SQL rewriting** with the correctness suite.
4. **Roles + API keys + creator-owns.**
5. **Panel editor + MCP surface.**
6. **BAK-001 hook flip; migration; adversarial suite; docs** (a security page an operator can actually follow).

## Success Criteria

- [ ] Model document recorded and referenced by the downstream specs
- [ ] Two users on a deployed backend cannot read each other's creator-owned records — via query, get, count, aggregate, distinct, *or* realtime
- [ ] Deploying with dev-open on refuses to start, loudly
- [ ] An API key scoped to one function cannot call others or touch `/classes`
- [ ] An agent can, via MCP alone: lock a collection to a role, create the role, assign a user, verify the effect
- [ ] Adversarial suite green; enforcement provably on every route (route-table test that fails when a new route skips the middleware)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| A route slips past enforcement (the classic BaaS CVE) | Single middleware + a test that walks the route table and fails on unenforced additions |
| ACL-in-SQL complexity breaks query correctness | Dedicated correctness suite runs the same queries with/without ACLs against known fixtures |
| Defaults too strict → local dev friction → users disable security globally | The dev-open switch gives frictionless local dev; the interlock makes the unsafe path impossible rather than discouraged |
| Model too weak for real apps (no field rules) | Creator-owns + roles covers the wedge use-cases; the rule-DSL escape hatch is recorded, not improvised |
| Semantics designed twice (this + BAK-005 admin tier) | The admin credential is defined *here*; BAK-005 consumes it |

## References

- [WF-004](../phase-19-cloud-workflows/WF-004-BACKEND-SERVICE.md) — sessions, tokens, the wire subset enforcement must hide behind
- [BAK-001](./BAK-001-REALTIME-SUBSCRIPTIONS.md) — the delivery hook this task flips
- Parse CLP/ACL model; Pocketbase API rules — prior art at the two ends of the expressiveness spectrum
- SUB-008 — MCP surface conventions

## Checklist

- [ ] Model document written, reviewed against downstream tasks, recorded
- [ ] Middleware + posture + interlock; ACL SQL + correctness suite
- [ ] Roles, keys, admin credential, creator-owns
- [ ] Panel + MCP; BAK-001 flip; migration
- [ ] Adversarial suite; security docs; CHANGELOG
