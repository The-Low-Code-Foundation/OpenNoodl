# OPS-006: The Security Sweep & the Deploy Interlock

## Metadata

| Field | Value |
|-------|-------|
| **ID** | OPS-006 |
| **Phase** | Phase 31 — Readiness & Operations (Track P) |
| **Tier** | 3 — the sweep |
| **Priority** | 🔴 Critical — this is the finding that saves somebody's business |
| **Difficulty** | 🟠 Medium–High — the client/server provenance analysis is the hard part |
| **Estimated Time** | 1.5–2 wks |
| **Prerequisites** | OPS-001 |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** — §1 defines what "this value reaches the client" means for a graph, and every later check inherits that definition |

## Objective

Before an app reaches strangers, NodeGX tells its author the things only NodeGX can know: which secrets
will ship to every visitor, which data anyone can read, and which functions anyone can call.

## Background

The [control-panel chapter](../../../../ai-coding-docs/docs/part-5/control-panel.md) puts a security
runner in the browser rather than in CI, for a reason worth restating:

> "Automated checks encoded as functions […] Run from the browser, not CI. This catches runtime config
> issues that static analysis misses entirely."

Its evidence is an env-var name that looked right, followed conventions, passed code review, and did
not exist. The class of bug is *plausible and invisible*.

NodeGX's version of that class is worse and more common. **A low-code author types an API key into a
node property, and if that node runs client-side the key is baked into `window.projectData` and served
to every visitor.** It looks identical in the editor to a key held safely in a cloud function. There is
no red squiggle, no review, no CI. This is the single most damaging thing a NodeGX user can do by
accident, and NodeGX is the only tool positioned to catch it — because it knows which side of the wire
each node runs on.

WF-003 already ships a credential scan that fails the managed-deploy build. That is the right instinct
arriving too late: at build time, on the artifact, as a terminal failure. This task moves it to the
graph, pre-emptively, where the author can still act.

## Current State

| Piece | State |
|---|---|
| Credential scan | WF-003, build-time, managed deploy only, fails the build |
| Access control | BAK-003 — CLPs, ACLs, roles, keys; ACL filtered in SQL with a property-tested JS twin; a dev-open deploy interlock exists |
| Audit trail | `_Audit` collection (BAK-009) |
| Rate limits | `ops/rate-limit.ts` (BAK-009) |
| Trigger secrets | WF-005 webhooks; WFA-008 established that editing a trigger keeps its secret |
| Client/server provenance | **nothing.** No part of the product answers "does this value reach the browser?" |
| Node catalog | SUB-004/SUB-005 — the substrate every check reads |

## Desired State

### 1. Provenance: does this value reach the client?

The foundation, and the reason this task is Fable-tier. For any authored value in the graph, decide
whether it is baked into the client bundle. That requires a per-node fact — *this node executes in the
viewer* vs *this node executes in the backend* — and a propagation rule through connections and
component ports.

- Add the fact to the node catalog (SUB-004), so it is data rather than a hardcoded list that rots.
- Where the answer is genuinely unknown (a dynamic-port node, a module-registered node), the result is
  **`unknown`, reported as unknown** — the same discipline as OPS-001's `ReadinessState`. A security
  check that quietly assumes "probably server-side" is worse than no check.

### 2. The checks

| Check | What it finds | Severity |
|---|---|---|
| **Client-side secret** | a value that looks like a credential on a node that runs in the browser | 🔴 Critical |
| **Open collection** | a collection readable or writable without authentication (BAK-003 CLPs) | 🔴 Critical if writable, 🟠 if readable |
| **Unauthenticated function** | a cloud function callable by anyone | 🟠 High — often correct, always worth confirming |
| **Unprotected trigger** | a webhook with no secret, or one shared across environments | 🟠 High |
| **Overbroad ACL** | records created with public-write ACLs | 🟠 High |
| **Weak transport** | a non-HTTPS endpoint configured for a Live/Scale project | 🟠 High |
| **Stale module** | a module whose source is gone or whose version is unknown (LIB-003) | 🟡 Medium |
| **Missing rate limits** | auth or write endpoints with no limit at Scale | 🟡 Medium |

The credential heuristic will produce false positives. Two mitigations, both required: findings are
**dismissible with a recorded reason** per value, and dismissals survive re-runs so the second sweep is
not the same list.

### 3. It runs where the truth is

Three places, and the difference matters:

- **In the editor**, against the graph — pre-emptive, the common case.
- **At export**, against the artifact — this is WF-003's scan, generalised to every target rather than
  only managed deploy.
- **Against a running backend**, for the checks that are runtime config rather than graph shape (CLPs,
  ACLs, rate limits). This is the chapter's "run it from the browser, not CI" point.

A check that can only be answered at runtime and has not been run reports `unknown`, not pass.

### 4. The interlock

The one place in this phase where something is blocked. At **Live** and **Scale**, a 🔴 Critical finding
blocks deploy — with an override that:

- requires the reason to be typed, not selected from a list;
- is recorded on the artifact (OPS-002 `acknowledgements`);
- is displayed in the Ops panel afterwards, indefinitely, not as a dismissible toast.

At Playing and Sharing the sweep reports and never blocks. Somebody experimenting with an API key on
their laptop is not doing anything wrong.

BAK-003's dev-open deploy interlock is the precedent and its behaviour should be folded into this one
rather than left as a second, differently-shaped gate.

### 5. Findings, not a report

Every result is an OPS-003 finding with `source: 'builder'` and a graph-anchored context, so clicking
it opens the component and selects the node. A PDF-shaped security report is the wrong artifact: the
right one is *"here is the node, here is what happens, here is the fix."*

Where the fix is mechanical — move this value into a cloud function, add a trigger secret, tighten a
CLP — offer it as an AIX-002 proposal the user reviews and accepts.

### 6. Readiness items

`security.no-client-secrets` (Sharing — this one matters even for five friends),
`security.access-control-reviewed` (Live), `security.rate-limits` (Scale).

## Implementation Steps

1. **Provenance first**, in the catalog, with the `unknown` case explicit. Nothing else is meaningful
   until this is right; write it up in `OPS-006-NOTES.md` with the propagation rules.
2. The client-side secret check + dismissal-with-reason + dismissal persistence.
3. Graph-time checks; then export-time (generalising WF-003); then runtime-config checks.
4. Findings integration with click-to-node.
5. The interlock, folding in BAK-003's existing dev-open gate, with the typed override recorded on the
   artifact.
6. Mechanical fixes as AIX-002 proposals.
7. Readiness items.
8. **Live pass**: plant a real API key on a real frontend node in the QA fixture, deploy at Live, and
   confirm the block, the typed override, and the permanent record. Then accept the offered fix and
   confirm the key is genuinely gone from the built artifact — grep it.

## Success Criteria

- [ ] Provenance is a catalog fact with an explicit `unknown`, not a hardcoded list.
- [ ] A key on a frontend node is found; the same key inside a cloud function is not (no false alarm).
- [ ] `unknown` provenance is reported as unknown and never silently passes.
- [ ] Dismissals are per-value, require a reason, and survive re-runs.
- [ ] The interlock blocks at Live, the override requires typed text, and the record is permanent and
      visible in the Ops panel.
- [ ] Every finding opens its node on the canvas.
- [ ] At least one mechanical fix (secret → cloud function) works end to end and the artifact is
      verifiably clean afterwards — **grepped, not assumed**.
- [ ] Playing and Sharing never block.

## Out of Scope

- **Penetration testing a deployed app.** Deliberately deferred. It requires proof of target ownership,
  an authorization gate, and a defined suite; it is a Scale-level feature and belongs in its own task
  once deploy targets (DEP-004) carry ownership evidence. Recorded here so it is not forgotten:
  auth-bypass probing, IDOR on record ids, rate-limit verification, TLS and header checks.
- **Auditing NodeGX itself.** Different job, different owner — project hygiene via `/security-review`
  and the review workflows, not a user-facing feature.
- **Dependency CVE scanning of the user's modules.** LIB-003 owns module provenance; this task reports
  "unknown source," not a vulnerability database.
- **Compliance frameworks.** No SOC2 checklists. This finds real defects, not paperwork.

## Traps

- **False positives will kill this feature faster than false negatives.** A sweep that cries wolf on
  every string containing `key` gets switched off in week one, and then the real finding is invisible.
  Dismissal-with-memory is not a nice-to-have; it is what keeps the feature alive.
- **Provenance is not a property of a node type alone.** A Function node is client-side in the viewer
  and server-side in a cloud function; the same type, two answers. The propagation rule must key on
  *where the graph is running*, and cloud functions are a different graph (WFA-001's fifth cut).
- **Dynamic-port nodes skip port checks everywhere else in the codebase** (SUB-006, SUB-008). The same
  hole exists here and must surface as `unknown` rather than being skipped silently.
- **WF-003's scan fails the build.** Generalising it to every target means it will now fail builds that
  used to succeed. Stage that: report-only for one release at Sharing, blocking at Live from the start.
- **`ops/redact.ts` must be applied to the findings themselves.** A finding that says "found the key
  `sk_live_…`" and stores it in `.findings/` has moved the secret, not removed it. Store a fingerprint
  and a location, never the value.
- **BAK-003's ACL is filtered in SQL with a property-tested JS twin.** Any check that reimplements ACL
  logic to *report* on it creates a third implementation that can disagree with both. Read the state;
  do not re-derive it.
</content>
