# AIB-007 — A scope that needs a backend gets one

| Field | Value |
|---|---|
| **Phase** | 38 — The AI Build Experience |
| **Priority** | 🟠 High |
| **Difficulty** | 🟠 Medium-hard (crosses the AI stack and the backend stack) |
| **Recommended executor** | 🔵 Fable to decide the contract, 🟠 Opus to build |
| **Prerequisites** | none |

## Objective

When the scoping conversation agrees the app stores data, the project the wizard creates **has a
backend** — visible in Backend Services, with the collections the scope described — and the plan's
data nodes point at something real.

## What happened

> *"It's making nodes with backend stuff, but it doesn't appear to have actually added a backend, I
> can't see one in the Backend Services panel."*

The screenshot shows the plan authoring `Create User Account (Sign Up)` and `Log In Existing User
(Log In)` nodes.

## The mechanism, verified

**The scope records the backend as prose.**
[`scope.ts:84-85`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/scoping/scope.ts#L84-L85):

```ts
/** A description of the backend, or an explicit "none". */
backend?: string;
```

The tool schema
([prompts.ts:90-92](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/scoping/prompts.ts#L90-L92))
asks the model for *"What the app stores data in, or the word 'None'…"* — free text. It is written
into ARCHITECTURE.md under `## Backend contracts`
([scope.ts:358-359](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/scoping/scope.ts#L358-L359))
and into the scoping record. That is the whole lifecycle. **No code path reads it back.**

**And nothing provisions.** Verified on Richard's project — `ai-test/project.json`:

```
components:   /#__page__/Home, App
settings keys: (empty)
cloudservices: null
```

No backend, no endpoint, no collections. The Backend Services panel is correct to show nothing.

**So the authored nodes are wired to nothing.** They validated — the semantic validator checks node
types and ports, and `Create User Account` is a real node type with real ports — but a Sign Up node
in a project with no cloud services cannot work at runtime. The gate has no concept of "this node
requires a backend the project does not have."

This is the same shape as AIB-001: a validation gate that checks structure and names but not the
preconditions the thing actually needs.

## The design question to settle first

Three defensible answers, and the task should not start until one is chosen:

| | Behaviour | For | Against |
|---|---|---|---|
| **A — Provision on create** | Wizard creates a local NodeGX backend when the scope says data | The user gets a working app; matches "describe it and it exists" | Creates a backend for people who said "a to-do list" and meant localStorage; a backend has a lifecycle the wizard does not own |
| **B — Plan it, don't do it** | The plan gains an explicit `provision backend` operation the user approves like any other | Consistent with everything else in the plan; user consents; reviewable | More clicks before anything runs |
| **C — Refuse and explain** | The gate rejects backend-dependent nodes and tells the user to add a backend | Cheapest, no new mechanism | Punts the whole problem to the user at the worst moment |

**Recommendation: B.** It reuses the machinery that already exists, keeps the "nothing happens
without approval" property that the rest of the phase is defending, and makes the backend visible as
a decision rather than a side effect. A `provision` operation kind in the plan is a real addition,
but the plan is already a heterogeneous list (`create` / `update` / `doc`) and `PlanRun` already
handles a second operation kind with its own pass.

Whichever is chosen, **C's diagnostic is needed regardless** as the backstop: authoring a
backend-dependent node into a project with no backend must not pass silently.

---

### ✅ Settled 2026-08-03: **B**, with three corrections the question could not have known

The recommendation stands. Reading the mechanism first changed *how*, in three ways — each of which
contradicts something written above.

**1. Slice 2's mechanism is stale. The reviewed table already exists.**
BCN-010 built [`nodeCapabilities.ts`](../../../packages/nodegx-backend-contract/src/nodeCapabilities.ts):
a frozen `NODE_CAPABILITIES` table binding node types to contract capabilities, plus a
`DELIBERATELY_UNBOUND` record so the next reader does not re-derive the omissions. Its module note
gives three reasons for a table over a per-node catalog field, and the first two apply here verbatim
(*"thirty claims spread across twenty-two files cannot be reviewed the way one table can"*).

So there is **no `catalog:*` generator change and no committed snapshot** — which also means the
trap this task warns about (`catalog:merge:check` blind on dynamic nodes) is not reached at all.

What `NODE_CAPABILITIES` does *not* answer is the coarser question. It binds *which capability of a
backend* a node needs; a node bound to `auth.password` obviously needs a backend, but `DbModel2` is
in `DELIBERATELY_UNBOUND` — *"fetch and save are supported on every backend"* — and still does not
work in a project with none. "Requires a backend at all" is a second, coarser fact, and it gets its
own small table, guarded by a test that fails when a new cloud node is added unclassified.

**2. Slice 3's single-undo cannot include the machine half — and must not.**
`UndoActionGroup`'s actions are **synchronous** `() => void`
([undo-queue-model.ts:67-70](../../../packages/noodl-editor/src/editor/src/models/undo-queue-model.ts#L67-L70)),
and `applyAuthoredPlan` calls `undo.undo()` synchronously in its rollback path. Creating a backend is
`ipcRenderer.invoke('backend:create')`, starting it is a supervised child process, and creating a
collection is an HTTP request to that process. None of it can ride a synchronous inverse.

And the stronger objection is not mechanical. Even if it could, **undoing "apply plan" by deleting a
database is this phase's headline defect inverted** — destroying durable output the user did not ask
to destroy. A backend is also machine-level, not project-level: `backends/<id>/` in userData, with a
`projectIds` array, shared across projects.

So the transaction splits at the seam the product already has:

| Half | Where it lives | Undo |
|---|---|---|
| The project's **binding** — `cloudservices` `{endpoint, appId, type: 'nodegx'}` | project metadata | in the group, synchronous, exact |
| The **machine resource** — the backend dir, its process, its collections | userData + a child process | survives; idempotent; deletable in Backend Services |

Criterion 4 is met for everything that is *in the project*, which is what "one undo restores the
project" means. The rest is stated **before** apply, not apologised for after — which is the actual
content of the task's rule that a step which cannot be undone "must be refused in preflight, not
applied and apologised for."

**3. The provision operation costs no tokens, and collections are pre-seeding, not a prerequisite.**
It is derived from the structured scope, so `PlanRun` stages it synchronously — no `AuthoringSession`,
no budget, and none of F11's "a turn that never returns". And `nodegx-backend` creates a collection on
first write
([HttpServer.ts:1578](../../../packages/nodegx-backend/src/server/HttpServer.ts#L1578),
[AdapterFacade.ts:383](../../../packages/nodegx-backend/src/persistence/AdapterFacade.ts#L383)), so
creating them up front buys the Data Browser something to show and typed columns — not the ability to
run. A collection that fails to create is therefore a **warning on a succeeded provision**, not a
failed apply.

**Trap 4 checked and clear.** The export allow-list is on `backendServices.backends[].auth`
([json.ts:73](../../../packages/noodl-editor/src/editor/src/utils/exporter/json.ts#L73)); a provision
writes `cloudservices` (endpoint + appId, no credential) and adds no field to it. `exportToJSON`
already *overrides* `cloudservices` from the chosen deploy environment, so a provisioned
`http://localhost:8578` does not reach a deploy that names one. The WF-003 constraint is unchanged,
because the provision writes exactly what pressing **Start** on a local backend has written since
WF-004.

## Scope

### Slice 1 — the scope carries structure, not prose

`ProjectScope.backend` becomes structured alongside the prose:

```ts
backend?: {
  kind: 'none' | 'nodegx' | 'external';
  /** What the conversation actually said — still written to ARCHITECTURE.md verbatim. */
  description: string;
  /** Collections the conversation named, with the fields it named. */
  collections?: Array<{ name: string; fields?: Array<{ name: string; type: string }> }>;
  /** Set when the conversation agreed users log in. */
  needsAuth?: boolean;
};
```

The tool schema gains the same shape. Keep `description` — ARCHITECTURE.md's prose section is good
and should not become a generated table.

### Slice 2 — a catalog fact: which nodes need a backend

The gate cannot check a precondition it cannot see. Add a `requires: ['backend']` (and
`['backend:auth']`) marker to catalog entries for the cloud-data and user nodes. This is a
`catalog:*` generator change with a committed snapshot — see the trap below.

Then a diagnostic in the AIB-001 validator: *"`Create User Account` requires a backend; this project
has no cloud services configured."* Severity **error** when authoring from a scope that said "none",
**warning** otherwise (the user may be about to add one).

### Slice 3 — the provision operation

A `provision` plan operation carrying the slice-1 structure. `PlanRun` stages it like a doc
operation — computing what would be created, changing nothing. `applyAuthoredPlan` gains a preflight
and an apply that writes cloud services config and creates collections, recording its inverse in the
same undo group as everything else.

The single-undo property is the constraint that matters and the one most likely to be quietly
dropped here, because provisioning touches more than the project model. If a step cannot be undone,
it must be refused in preflight, not applied and apologised for.

### Slice 4 — say it in the wizard

The Review step lists the plan. A backend operation appears there like any other, so the user sees
*"provision backend — 3 collections, auth enabled"* before creating anything.

## Acceptance criteria

1. A scoping conversation that agrees a backend produces a structured scope, and ARCHITECTURE.md is
   unchanged in character.
2. Authoring a `Create User Account` node into a backend-less project produces a diagnostic naming
   the node and the missing precondition.
3. Applying a plan with a provision operation yields a project whose Backend Services panel shows the
   backend and its collections.
4. One undo reverts the provision along with the components — asserted on real files.
5. A scope that agreed no backend still authors and applies with no backend and no diagnostics.
6. **Live**: Richard's chat app scoped again, built, and the Sign Up node works against a real
   backend in preview.

## Traps

- **`catalog:merge:check` is blind on dynamic nodes** and `cloud-library:check` has been omitted
  from the gates before, leaving a committed snapshot stale for several builds. If slice 2 touches a
  generator, run every `catalog:*` and `cloud-library:*` check and confirm the snapshot is committed.
- Phase 34 settled that there is **one backend contract** — `CloudStore` is 14 methods, and the
  Parse/BYOB split was drift. Provisioning must go through that contract, not around it.
- **Baked `cloudservices` cannot be overridden at runtime** (WF-003). A provisioned endpoint written
  at create time constrains deploy. Check with the phase-26 material before choosing where it is
  written.
- The export path publishes credentials by allow-list. A newly provisioned backend's config must be
  checked against that allow-list or it either leaks or silently fails to publish.
