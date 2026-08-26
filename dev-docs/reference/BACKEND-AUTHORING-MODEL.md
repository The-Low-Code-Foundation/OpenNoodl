# The backend authoring model: workflows and cloud functions

**Status:** canonical. Written 2026-08-05 after Richard — who commissioned both systems — spent an
hour concluding the wrong thing about them. Every doc, every task and every piece of product wording
about the backend should derive from this page. If something contradicts it, this page wins or this
page changes.

## The one sentence

**A workflow orchestrates; a cloud function computes. A workflow calls cloud functions.**

## The two surfaces

| | **Cloud function** | **Workflow** |
|---|---|---|
| What it is | A component in your project, named `/#__cloud__/…`, authored with nodes and wires | A JSON definition stored **in the backend**, drawn as step cards |
| What runs it | The cloud runtime (`noodl-viewer-cloud`), bundled into `nodegx-backend` and executed in-process | The backend's `WorkflowEngine` |
| Shape | Request in → graph → Response out. Runs once, answers once | A step DAG with branching, retries, waits and a durable execution record |
| Vocabulary | ~57 general nodes: records, HTTP, strings, Expression, JavaScript, Logic Builder | 15 step kinds: Call Function, Branch, Switch, For Each, Merge, Transform, Validate, Filter, Sort, Deduplicate, Split, Stop/Error, Return, Wait, Wait Until |
| Started by | Your app (Cloud Function node), an HTTP POST, **or a workflow step** | A trigger: webhook, schedule, record change — or run manually |
| Auth | The Request node's `Allow Unauthenticated` declares it; backend config can override per function | Runs as system, with admin authority |
| Data it holds | Whatever its graph computes, for one request | The run payload plus each step's output, for the life of the run |

## Which one do I reach for?

- **"Run this now and give the user an answer."** → Cloud function, called from the app. Immediate,
  returns into the user's session.
- **"Run this every night / when a record changes / when a supplier POSTs us."** → Workflow, with a
  trigger, calling a cloud function to do the work.
- **"Do some real work — read records, call an API, send mail, transform a payload with code."** →
  Always a cloud function. Never a workflow step.
- **"Try three times, wait an hour, then take a different path."** → Only a workflow can express
  this. A function graph has no concept of it.

## Why the split exists — and it is not an accident of history

Two independent reasons, both load-bearing:

1. **Security.** A workflow definition is persisted, deployable, agent-authorable JSON that
   **executes with admin authority on the server**. An `eval`'d string inside one is a
   remote-code-execution surface with an admin credential in front of it — which is why a workflow's
   conditions are declarative data (a 19-operator language served *by the backend*, so the editor
   can never offer an operator the backend won't evaluate) rather than JavaScript. The code you
   write runs one level down, inside the function sandbox, where it belongs.
2. **The separation is the product.** Compare n8n, where orchestration and compute are one melting
   pot: every flow is part router, part script, and the script is where the security model and the
   readability both go to die. Richard's framing, 2026-08-05: *"we're separating pure JSON workflow
   from real cloud compute, whereas an n8n flow mixes everything together"*. The workflow layer
   stays inspectable, diffable, agent-writable and safe **because** it cannot compute. That is a
   feature to defend, not a limitation to apologise for.

## What this rules in and out

⚠️ **That row has been wrong twice.** It said "9 step kinds" and listed `Retry` for a day after
CWF-005 folded retry into Call Function, and it kept saying it after CWF-002 added Return and
CWF-004 added Transform and its five-kind family. The authority is
[`steps/kinds.ts`](../../packages/nodegx-backend/src/workflow/steps/kinds.ts) and the served
`GET /admin/workflow-step-kinds`, which is exactly why the vocabulary is served rather than written
down — a prose list of a served contract is a copy, and copies drift. Read the count here as a
sketch, never as the list.

**In, at the workflow level:** anything that *references, routes or reshapes* data without
evaluating a string — paths, conditions, branching, iteration, merging, retry policy, waits, and the
declarative data steps (see
[CWF-004](../tasks/phase-42-first-hour/CWF-004-THE-TRANSFORM-STEP.md)): reshaping, validating,
filtering, ordering, de-duplicating and batching. Reshaping an awkward supplier payload before
handing it to a function is workflow work: it is pure JSON plumbing, and doing it in the function
would mean every function carries its caller's mess. Validating it before anything acts on it is the
same argument one step earlier.

**Out, at the workflow level, permanently:** a free JavaScript/expression step, an HTTP step, a
database step. Not because they'd be hard — because each one recreates the melting pot, and each has
a home one level down that is already better at it. The escape hatch when you genuinely need code is
a **one-node cloud function** reached by the descent gesture, not an eval in the definition. Since
CWF-004 S6 that escape hatch is one gesture even when the function does not exist yet: a step whose
`ref` resolves to nothing offers **New cloud function "…" from this step**, which creates it,
declares the step's params on its Request node, points the step at it and drops you inside its graph.

**And aggregation is out for the same reason, decided 2026-08-06.** No `count` / `sum` / `min` /
`max` step: it is the one candidate in CWF-004's family that *computes* rather than referencing or
reshaping, and `VALUE_LANGUAGE.limits` serves *"No arithmetic, string interpolation or function
calls. Compute in a cloud function"* to every client. The accepted cost is that an in-flight array
that is never stored needs a `call-function` hop to be summed — `Aggregate Records` covers data at
rest only.

## How they join

A `call-function` step invokes a function in the same backend. The function receives, as its request
body, `{ ...the run payload, ...the step's resolved params, previous: <the last step's output> }`
and its Request node splits named keys into output ports.

⚠️ Two traps live at this join, both open tasks:
- The step's `params` — the *mapping* that lets you pass `previous.result.total` as `amount` — is
  resolved by the engine but **declared by no catalog kind**, so no UI can author it
  ([CWF-001](../tasks/phase-42-first-hour/CWF-001-CALL-FUNCTION-PARAMS.md)).
- A workflow invokes functions with **no session token**, so any function whose Request node has
  `Allow Unauthenticated` unticked — *the default* — fails the step. Note precisely where that
  refusal comes from: a step calls the function **in process**, so the backend's per-function `call`
  rule (CWF-017's panel) never runs for it — a step is a system caller and bypasses that gate
  entirely. The gate it does meet is the node's own check, inside the graph. Opening the rule in the
  panel cannot fix a failing step; ticking the port can.

## Secrets: one namespace a graph may read

A cloud function reaches a credential through the **Secret** node (CWF-009), and the policy behind
it is short enough to state here in full:

- The backend's secrets all live in one machine-local `<dataDir>/secrets.json`, namespaced by
  subsystem — `webhooks`, `email`, `auth`, `files`, and a top-level `adminToken`
  ([SecretsStore](../../packages/nodegx-backend/src/config/SecretsStore.ts)). Those namespaces
  belong to the *backend*.
- **`functions` is the one namespace that belongs to the project author**, and the only one a graph
  can read. The resolver in `service.ts` supplies the namespace; the node supplies a name. So the
  other namespaces are not merely forbidden to a function — they are unnameable by it. That matters
  because "the author of a function is the person who deploys the backend" stops being true the day
  an agent writes one, and a flat trust model is a bad thing to still be relying on when it does.
- A deploy target that provisions environment variables rather than a data directory can set
  `NODEGX_SECRET_<NAME>` instead; the resolver falls back to it. This is a second **door**, not a
  second store — `process.env` is already fully readable from inside any cloud function
  (TALK-007 §3.1), so it adds no exposure.
- **`secrets.json` is machine-local and does not travel with a deploy.** A function that works
  locally and fails in production because nobody provisioned the secret is therefore the *expected*
  failure, and the node's error message says so in those words.
- A workflow has no equivalent and needs none: a workflow definition is diffable, deployable JSON,
  and a credential must never appear in one. Where a step needs a credential, the function it calls
  reads it.

## Users: what a cloud function may do to an account

A cloud function runs **as the system** (the loopback services carry the master key, §4 of
`service.ts`), and CWF-015 gives that authority four nodes: `Create User`, `Update User`,
`Delete User`, `Verify Session Token`. Four facts about them belong here, because they follow from
the model above rather than from the nodes:

- **They are cloud-only, and the seven session-shaped user nodes stay browser-only.** Sign Up,
  Log In, Log Out, Verify Email, Reset Password, Sign In With and Magic Link each set *the browser's
  current session* as a side effect. "The server is now logged in as bob" is meaningless in one
  process answering many requests, so those seven have no server-side equivalent and will not get
  one. Nothing in the CWF-015 family touches the request's current user; each addresses a row by id.
- **They add no HTTP route.** The seam is a process global (`_noodl_system_users`), the same idiom
  as the Secret node's, and deliberately so: a second door onto account creation would be a second
  gate to keep in step with the first. The only gate is the function's own `call` rule.
- **⚠️ Which makes that rule load-bearing.** A function holding these nodes with no rule falls back
  to its Request node's `Allow Unauthenticated` — `public` if ticked, which is account creation for
  the open internet. Set `functions.<name>.call` in the Permissions panel (CWF-017).
- **They cannot manufacture privilege.** Admin authority is a credential, not a user row; a user's
  privilege is role membership in `_Role`, which nothing in this family writes; and `ACL`,
  `objectId` and every `_`-prefixed column are refused by name rather than dropped. Since F86
  something else *does* write roles — see the next section, which is a separate family for exactly
  this reason.

## Roles: how an account acquires privilege

**Membership in a role is the only way a `_User` row gains any authority on this backend.** Admin
authority is a credential (`security.adminToken`), never a row; everything else a user may do comes
from a CLP, a function `call` rule or a record ACL naming `role:<name>`, resolved per request by
`SecurityState.rolesForUser`. Three nodes write it, and they are cloud-only:

| Node | What it does |
| --- | --- |
| `Add User To Role` | Puts a named user in a named role, idempotently |
| `Remove User From Role` | Takes them out, idempotently |
| `Get User Roles` | Reads their roles through the resolver the access check itself uses |

Four facts that follow from the model rather than from the nodes:

- **There is no browser version and there will not be one.** A client-side node that adds the
  current user to a role is one wire from a button to "make me staff". Role mutation is
  backend-authoritative; the seam is a process global (`_noodl_system_roles`), it adds no HTTP
  route, and the only gate is the function's own `call` rule — the same shape as CWF-015's, and the
  same ⚠️ applies: **with no rule it falls back to `Allow Unauthenticated`.**
- **⚠️ It is a separate module from the CWF-015 family on purpose.** `users/SystemUsers.ts` carries
  a documented, tested property that it writes neither `_Role` nor the membership junction — the
  property that makes "a node that can create a user" provably not "a node that can create an
  admin". Granting privilege therefore has its own module (`roles/SystemRoles.ts`), its own process
  global and its own audit actions (`role.system.*`, distinct from the operator's `role.*`), so
  "what in this process can grant privilege?" has one file as the answer. A function that needs
  both wires Create User's `Done` into Add User To Role, which is a graph an author can see.
- **Creating a role grants nothing.** A role nothing references is inert; privilege comes from a
  *rule* naming it, and rules are written in the Permissions panel and nowhere else. `Add User To
  Role` still refuses an unknown role by default: a role name is written by two people at two times
  — the rule that grants through it and the call that fills it — and creating on demand would turn
  a typo into a member of a role no rule names, which is a grant that silently never happens. Tick
  `Create Role If Missing` for the case that is genuinely not a typo (a function deployed to a
  fresh backend).
- **Roles are flat.** Parse allowed roles to contain roles; this backend does not.
  `SecurityState.rolesForUser` is a single non-recursive JOIN over `_Join_users__Role`, so a
  role-in-role edge would be stored and never resolved. Nothing offers to write one, and the change
  would start at that JOIN.

## Per-record access control: yes, it works

The Access Control Rules on `Create Record` and `Set Record Properties` are **live and enforced**,
not a Parse vestige. This section exists because the question was asked by the person who
commissioned the backend, and answering it took forty minutes of reading source (SPR-001 §1, F87).

The chain, verified end to end on 2026-08-06:

| Link | Where |
| --- | --- |
| The node collects the ACL | `noodl-runtime/src/nodes/std-library/data/dbmodelcrudbase.ts` — `_getACL`, via the `accessControl` proplist |
| The adapter sends it | `noodl-runtime/src/api/backends/ParseWireAdapter.ts` — `{ ACL: options.acl }` on create and on update |
| The backend models it | `nodegx-backend/src/security/model.ts` — `principalKeys()` returns `['*', userId, …roles.map(r => 'role:' + r)]`, exactly the key set an ACL object may use |
| The backend enforces it | Same file: a JS predicate **property-tested against its SQL twin** (`tests/security-model.test.ts`), and shared with realtime delivery so query filtering and event filtering cannot drift apart |

So a record the caller has no read rule for is not returned by a query **and** its changes are not
delivered over realtime. It is a permission boundary, not a display filter. The normative document
is [`BAK-003-SECURITY-MODEL.md`](../tasks/phase-22-production-backend/BAK-003-SECURITY-MODEL.md),
whose own header states the rule to keep: *if code and document disagree, the document wins and the
code is the bug.*

**Two things this does not mean.**

- ⚠️ **The BYOB REST backends drop a per-record ACL.** `RestDataAdapter.ts` (~`:1032`) skips it when
  the backend does not declare `data.acl`, warns to the console, and still creates the record.
  That is deliberate — Supabase, PostgREST, Directus and PocketBase control access with roles, RLS
  or API rules instead. It is **not** invisible in the editor: `data.acl` is bound to this port in
  `nodegx-backend-contract/src/nodeCapabilities.ts`, so the property row is gated with its reason by
  `capability-gating/gateForPort`. The console warning is the second line of defence, not the first.
- ⚠️ **A role ACL only means something if something can fill the role.** It could not until F86 —
  membership was reachable only by pasting an objectId into the Permissions panel by hand. `Add User
  To Role` closes it; see §Roles above for why that node is cloud-only.

## Four things a deployed graph does not do the way the canvas does

🔴 **Every one of these was found by running an MCP-authored cloud function on a real backend
(SB-004 §7), and every one of them was green through both authoring doors first.** They share a
cause worth stating on its own: **a deployed backend has no editor connection**, and a surprising
amount of the runtime's helpfulness is behind `context.editorConnection.isRunningLocally()`.

**1. Declare a code node's custom signal outputs, or they are dead.** `Outputs.done()` is a call,
and it resolves only if `out-done` is on the node as a `signal` port. The editor derives those
ports by parsing the script and saves what it derived; the MCP door derives nothing. So an authored
`JavaScriptFunction` needs them written out:

```json
{ "id": "gate", "type": "JavaScriptFunction",
  "ports": [{ "name": "out-ok", "plug": "output", "type": "signal" }],
  "parameters": { "functionScript": "Outputs.ok();" } }
```

Undeclared, the script throws mid-run, no Response node is reached, and the caller waits out the
30-second timeout. The built-in `success`/`failure` outcome outputs are declared on the node type
and always work — which is why this is invisible until you name your own signal.

**2. A signal is not a promise that the values beside it have arrived.** Values are queued per
input name and drained a pass at a time, so a node triggered by one producer's signal can run before
another producer's value reaches it. A code node fed by **two** producers must therefore guard:

```js
if (Inputs.items === undefined || Inputs.flag === undefined) return;
```

Returning is safe and cheap: `runOnValueChange` is ticked by default, so a late value re-runs the
node by itself. **Acting on the incomplete first run is what cannot be undone.** Better still,
prefer a chain to a fan-out — start nothing downstream until the step before it has answered — so
every consumer's values are at least one hop older than its trigger.

⚠️ This is why `receive` is not the universal answer. It fires after every parameter output on the
**Request node** has been updated; it says nothing about when those values reach a node three hops
away.

**3. A `Query Records` node fetches once, unfiltered, when the graph is built.** `collectionName`
and `visualFilter` are parameters, and setting either schedules a fetch. That first query has no
`qp-` value, a rule with an undefined value is *dropped* rather than failed, and a dropped rule is
no `where` — every row in the class, delivered on `fetched` before your request has done anything.

For a query **with** a filter parameter, the shape that works is: switch off the implicit triggers
and leave `Do` unwired, so the filter value arriving is the only trigger.

```json
{ "type": "DbCollection2", "parameters": {
    "runOnChange-collectionName": false,
    "runOnChange-querySettings": false,
    "collectionName": "Section",
    "visualFilter": { "combinator": "and",
      "rules": [{ "property": "pageId", "operator": "equal to", "input": "pageId" }] } } }
```

⚠️ **Do the opposite for an unfiltered query.** With those boxes off and no load-time fetch, the
`isEmpty` output is never flagged and reads `true` for a collection that has rows in it. Leave the
defaults on a query that has nothing to be early for.

**4. `points to` cannot narrow anything from a cloud function, and it widens instead of failing.**
It is the one operator that needs the collection schema, the schema cache is never populated in the
cloud runtime, and the translator's refusal is reported through the editor connection that is not
there. The query then runs with no filter at all. **Use a plain id String and `equal to` for a
link a cloud function has to filter on.** Pointers are fine to write and fine to read back; it is
filtering on one that does not work here.

## Naming

"Cloud function" is a Noodl-era term; the wire URLs say Parse for compatibility reasons that have
nothing to do with what the thing is; and neither word tells an author which canvas they are on.
Whether these names survive is [phase 43](../tasks/phase-43-backend-authoring-clarity/README.md)'s
to decide. Until it does, use "cloud function" and "workflow" consistently and never abbreviate
either to "backend thing".

## What has already gone

Parse Server, the Parse Dashboard, the master-key deploy pass, the external-environment management
UI and the hidden-BrowserWindow function server are all **deleted** (WF-007). There is no Parse
dependency anywhere in the monorepo. What survives is a ~7-route wire subset that
`nodegx-backend` implements itself against `node:sqlite`, because that protocol — not the framework
— is the compatibility contract the record/user/config nodes ride on.
