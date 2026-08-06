# Workflow Step Kinds (NodeGX Backend)

A **workflow** is the WF-001 engine's artifact: a multi-step, ordered,
error-routed, cancellable server execution, stored as
`<dataDir>/workflow-defs/<id>.workflow-def.json` and run by the `nodegx-backend`
service. This page documents the **step kinds** — the vocabulary you assemble a
workflow out of.

If you have not read [WF-001's semantics](../../dev-docs/tasks/phase-19-cloud-workflows/WF-001-SEMANTICS.md),
read the two paragraphs under "Ordering" first. The one thing to internalise:

> **On the server, only the steps you wire an edge to run, and they run in DAG
> order, once each.** There are no frames and no dirty-flag propagation. A step
> runs because a predecessor's edge selected it — not because a value it reads
> changed.

- **Discover them live:** `GET /admin/workflow-step-kinds` on a running backend,
  or the MCP tool `list_backend_step_kinds`.
- **Author them:** the **Workflows panel** in the editor, which draws a workflow
  as a graph on the canvas — or the MCP tools `create_backend_workflow` /
  `update_backend_workflow`.
- **Watch them run:** every step produces an event in the Execution History
  panel and, because a canvas node id *is* a step id, a badge on the step that
  produced it in the canvas Execution Overlay.

---

## Authoring one on the canvas

Open the **Workflows** panel (the sidebar rail). It lists the workflows of every
running backend, grouped by backend — and with none running it says so, because
a workflow lives in a backend's data directory and there is nothing to list and
nothing to author against until one is up.

Click a workflow to draw it:

- **A step is a node.** Its title is the step's name (or its id), and its second
  line is the kind, the function it invokes for `call-function` and `for-each`, and
  `entry step` on the one the run starts at.
- **An edge is a connection.** `next` is the plain wire; a route carries its
  name on the wire, because an unlabelled branch is unreadable; `onError` is red
  and dashed.
- **Params are edited in the property editor.** A condition is three controls —
  left value, operator, right value — with `all`/`any` groups that nest. Any
  value can be a literal or a reference to data the run produced, chosen from a
  picker over the steps that can actually have run before this one.
- **The canvas will not let you draw a loop.** A workflow is a DAG; the engine
  rejects a cyclic definition and would refuse to load one, so the connection is
  refused at the moment you draw it rather than at the moment you save.
- **Save writes to the backend**, and a definition the backend's validator
  rejects comes back with that validator's own message. Nothing is written until
  it is accepted.
- **Run & pin** runs the workflow and pins the execution to this canvas, so the
  badges land on the steps you just authored.

### What a workflow is *not*

A workflow is **not** a project component, and the canvas is the only place the
two look alike. It is not in your project, does not arrive with a `git clone`,
is not in an export, and **is not deployed with your app** — a deploy carries
the project artifact, and workflow definitions are state on whichever backend
holds them. Moving a workflow to a production backend is done against that
backend's admin API (or its own editor session), not by deploying the app.

Step positions are the one editor-owned thing stored in the definition, as an
optional `ui: { x, y }` per step, and the engine ignores them. They live there
rather than in editor-local storage because the definition is the *only*
artefact a workflow has: no repository carries a layout beside it, so
editor-local positions would mean every collaborator opened a workflow that had
never been arranged. A workflow with no positions — one written by an agent, say
— is laid out deterministically on first open.

### When an AI writes one

An agent can author a workflow through MCP's `create_backend_workflow` /
`update_backend_workflow`. Both take **`propose: true`**, and that is the mode to
ask for when you have the editor open:

- the candidate is validated against your backend first, and one that would not
  save is refused with that backend's own errors instead of becoming a suggestion
  you cannot take;
- nothing is written. The proposal waits under **Workflows → Proposed for
  \<backend\>**, and **Review on the canvas** draws it as a diff — added,
  removed and changed steps and edges, in place, on the same canvas you author
  on. Clicking an entry centres it; **Before / Changes / After** switch what the
  canvas is showing.
- you can accept the whole thing or exclude individual changes. An exclusion
  takes what depends on it with it: dropping a step drops the edges into it, and
  drops any step whose params read `{"$path": "upstream.<that step>…"}`. Whatever
  you keep is validated again before it is written, so a selection that would not
  add up to a saveable workflow is refused with the reason and nothing is
  written.
- **Discard** throws the proposal away and changes nothing.

A failed run in the **Execution History** panel offers **Copy a fix request** — a
ready-made request carrying the run, its failing step and the error, asking for
the answer as a proposal rather than as a write.

**The honest limit:** `propose` is opt-in. An agent that calls these tools
*without* it still writes straight to a running backend, and the editor learns
about that the next time the Workflows panel refreshes. This makes a reviewable
path exist; it does not remove the direct one, and a workflow appearing in your
list that you did not author is what the direct path looks like.

---

## Why these are not in the node catalog

A workflow step is **not a canvas node**. The node catalog
(`packages/noodl-types/src/node-catalog.json`) is generated by *running* the
browser and cloud node registers and serialising what registered; a step kind
registers in neither, because it is a `kind` field in a step DAG rather than a
node with ports on a canvas.

The step-kind catalog above is the equivalent contract in the form the artifact
actually has, and it is served **by the running backend**, so it can never drift
from what that backend executes. See `WF-002-NOTES.md` for the full argument.

---

## Edges: `next`, `routes`, `onError`

Every step has up to three kinds of outgoing edge.

| Edge | Taken when | Meaning |
|---|---|---|
| `next` | the step **succeeds**, whatever it decided | "always continue here" |
| `routes.<name>` | the step succeeds **and selects that route** | "continue here conditionally" |
| `onError` | the step **fails** | the catch branch |

`next` and `routes` compose: a `branch` with both will take its selected route
**and** its `next` edges. Use `next` for work that must happen either way.

A step reached by no taken edge is recorded **`skipped`** — visible in the
execution record, not silently absent.

### Error routing is try/catch

There is no Try/Catch step kind, because `onError` edges already are one:

| CF11-002's Try/Catch node | The WF-001 equivalent |
|---|---|
| `try` output | the step's own `next` edges |
| `catch` output | the step's `onError` edges |
| `error` object | `previous.error` on the handler step |
| `finally` output | a `merge` step (`mode: "any"`) fed by both paths |
| `success` boolean | which edge was taken (also in the step record) |

A step that fails **with** `onError` edges is *routed*: execution continues and
the workflow can still finish successfully — though the failed step is still
recorded `error`, loudly. A step that fails with **no** `onError` edge is
*unrouted*: the run halts and is recorded failed.

The handler receives:

```jsonc
{ "previous": { "error": { "message": "...", "name": "StepExecutionError", "statusCode": 502, "step": "charge" } } }
```

---

## Passing data between steps

A step's input is:

```
{ ...runPayload, ...step.params, previous }
```

`previous` is the output of the predecessor whose edge reached this step (or its
`{ error }` when that predecessor failed).

The interesting part is that a **param can be a reference, not just a literal**.
That is what makes "take the order id from the save step and pass it to the
charge step" expressible:

```jsonc
{
  "id": "charge",
  "kind": "call-function",
  "ref": "chargeCard",
  "params": {
    "amount":   { "$path": "previous.result.total" },
    "orderId":  { "$path": "upstream.save.result.orderId" },
    "currency": "GBP",
    "note":     { "$literal": { "$path": "not a path" } }
  }
}
```

References are resolved **before** the step runs, so the function receives
`{ amount: 4200, orderId: "ord_9", currency: "GBP", note: {"$path": "not a path"} }`
and the execution record shows those values rather than the references. It is the
same value language conditions use — one dialect, not two.

### What a `$path` can address

| Root | What it is |
|---|---|
| `body` | **The caller's own data.** The webhook body, the manual-fire body, the admin run's `payload`. Always present; `{}` when there was none. |
| `trigger` | How this run started: `{ type, id?, firedAt, slug?, cron?, collection?, action?, recordId? }`. |
| `triggerType` | The trigger type as a bare string — `switch` on this to branch by entry point. |
| `headers`, `query` | Webhook runs only. |
| `previous` | The output of the predecessor whose edge reached this step, or its `{ error }`. |
| `upstream.<stepId>` | The output of an **earlier step, by id**. |
| *a param name* | This step's own params, which are merged into the input. |

Rules worth knowing before you debug something:

- Segments walk objects and arrays alike: `body.items.0.id`. A **negative index
  counts from the end**, so `previous.items.-1` is the last item.
- A missing segment resolves to `undefined` rather than failing, which is what
  keeps an optional param possible. A *dangling step reference* is different —
  see [Validation](#validation).
- A param **cannot reference another param of the same step**. Resolution happens
  before params are merged, so there is no order to rely on.
- `{ "$literal": … }` is the escape: the wrapped value is used verbatim and is
  not looked inside. Use it when a param genuinely needs a `$path` key.
- References resolve through nested objects and arrays, to a depth of 32. Deeper
  than that is rejected when you save.

### Authoring the mapping on the canvas

Select a Call Function step and its property panel has a **Params** section: one
row per name, each with the same value control the rest of the panel uses — a
fixed value, or **from** a reference with a picker over the steps that can have
run before this one.

This is what the step passes the function, and the names are yours. Pick them to
suit the *function*, not the step that happens to feed it: a function whose
Request node declares `amount` can then be called from anywhere, and each caller
says where its `amount` comes from. Naming them after wherever the data happens to
sit today (`result`, `total`, `previous`) welds the function to one position in
one workflow.

One name is refused when you save: **`previous`**. The engine writes it into the
step input *after* your params, so a param called `previous` would be silently
discarded — not shadowed, lost.

`body`, `trigger`, `triggerType`, `headers` and `query` are allowed, because
params merge *after* the run payload and so yours wins. That is an override, and
sometimes it is exactly what you want; the panel notes that the function will see
your value instead of the payload's.

Only Call Function takes author-named params. `for-each` shapes its per-item input
with its own `itemKey` / `indexKey` params instead.

### `previous` vs `upstream.<stepId>`

Use `previous` for a straight line. Use `upstream.<stepId>` the moment anything
sits in between:

```jsonc
// `previous` here is the BRANCH's output — `{result: true, isfalse: false}` —
// which is not the data you wanted. The quote step is still addressable.
{ "id": "big", "kind": "call-function", "ref": "chargeCard",
  "params": { "amount": { "$path": "upstream.quote.result.total" } } }
```

The same applies where two branches converge: `previous` is whichever arrived
first, which is not something to build on.

### Params that are structures, not values

A `condition`, a `for-each` `filter` and a `switch`'s `cases` are **not values** —
they are small structures whose own operands use this language, evaluated when the
step runs. They are marked `raw` in `GET /admin/workflow-step-kinds` and are
passed to the step exactly as authored (so the execution record shows the
comparison you wrote, not its answer).

### No expressions, deliberately

There is no arithmetic, no string interpolation and no function call in a param.
A workflow definition is a persisted, deployable, agent-authored JSON file, so an
`eval`'d string inside one is a remote-code-execution surface with an admin
credential in front of it. **Compute in a cloud function** — that is what the
function is for. This language makes *referencing* values possible, not
*computing* them.

### One payload, whatever started the run

Every entry point — webhook, schedule, manual fire, admin run, db-change —
delivers the same envelope:

```jsonc
{
  "trigger":     { "type": "webhook", "id": "trg_…", "firedAt": "…", "slug": "github" },
  "triggerType": "webhook",
  "body":        { /* the caller's JSON, always here, always unwrapped */ },
  "headers":     { /* webhook only */ },
  "query":       { /* webhook only */ }
}
```

This is why one definition can be triggered by a webhook **and** on a schedule:
`{"$path": "body.total"}` means the same thing either way. Before this, the
webhook wrapped the caller's JSON under `body` and the admin run did not wrap at
all, so a workflow that ran green from `POST /admin/workflow-defs/:id/run` failed
from a webhook carrying the same JSON.

**Migrating a definition written before this.** Every entry point still spreads
the keys it used to deliver at the top level, **deprecated, for one release** — so
a definition reading `{"$path": "total"}` from an admin run keeps working. Two
things to know:

- `payload.trigger` **was the type as a string** and is now the object above. One
  key cannot be both. Read **`triggerType`** (or `trigger.type`) for the string.
- Where a legacy top-level key collides with a canonical one, the **canonical one
  wins**. If your own data has a `body` key, the top-level view of it is shadowed
  and it is reachable as `body.body`.

A db-change run puts the changed record in `body`, and `collection` / `action` /
`recordId` on `trigger`.

### The condition language

`branch`, `switch` and `for-each`'s filter take **declarative conditions**, not
JavaScript expression strings. A workflow definition is a persisted, deployable,
agent-authored JSON file; an `eval`'d string inside one would be a
remote-code-execution surface. Conditions are instead a closed operator set that
can be validated when you save and described to an agent.

A **value** anywhere in a condition is a literal, a path, or an escaped literal:

```jsonc
120                                   // literal
{ "$path": "previous.order.total" }   // read from the step input
{ "$literal": { "$path": "x" } }      // an object that really does have a $path key
```

Paths walk objects and arrays: `previous.items.0.id`, and `-1` means last.

A **comparison** is `{ left, op, right }`:

```jsonc
{ "left": { "$path": "previous.total" }, "op": "gt", "right": 100 }
```

| Group | Operators |
|---|---|
| Equality (deep) | `eq`, `neq` |
| Ordering | `gt`, `gte`, `lt`, `lte` |
| Membership | `in`, `notIn`, `contains`, `notContains` |
| Strings | `startsWith`, `endsWith`, `matches` (+ optional `flags`) |
| Presence | `exists`, `notExists`, `truthy`, `falsy`, `empty`, `notEmpty` |

Combine with `all`, `any`, `not`:

```jsonc
{ "all": [
  { "left": { "$path": "previous.total" }, "op": "gte", "right": 100 },
  { "not": { "left": { "$path": "previous.status" }, "op": "eq", "right": "void" } }
]}
```

Three notes that save debugging time:

- `exists`, `truthy` and `empty` are **different questions**. `0` exists, is
  falsy, and is not empty.
- Ordering compares numbers numerically, numeric strings numerically (`"10" >
  "9"` is true), ISO dates as instants, and plain strings lexicographically.
- A condition that **cannot** be evaluated — incomparable operands, a bad regex
  — is a **loud step failure**, never a silent `false`. A silently-false
  condition is a branch that takes the wrong edge forever.

---

## The kinds

### `call-function`

Invokes an existing cloud function; its 2xx response body becomes the step
output. A non-2xx response, or a function that does not exist, is a step
failure. This is the workhorse — any real work is a cloud-function graph.

```jsonc
{ "id": "validate", "kind": "call-function", "ref": "validateOrder", "next": ["charge"] }
```

#### Retrying it — the policy, not a separate step

A Call Function step can retry itself with exponential backoff. The policy is
**off** unless `maxAttempts` is greater than 1, and a step without it is invoked
exactly once, exactly as before.

| Param | Shown as | Default | Description |
|---|---|---|---|
| `maxAttempts` | Total attempts (incl. the first) | `3` | How many times the function is called **in total**. `1` means no retry. |
| `delayMs` | First delay (ms) | `1000` | The wait before the **second** attempt. Later delays multiply from this. |
| `backoffMultiplier` | Delay multiplier | `2` | Multiplies each subsequent delay. `1` = a fixed delay every time. |
| `maxDelayMs` | Longest single delay (ms) | `60000` | Ceiling on any one delay, however far the multiplier has taken it. |
| `jitter` | Spread delays randomly | `false` | Randomise each delay across [50%, 100%], to avoid retry storms. |
| `retryOnStatus` | Retry ONLY these statuses | — | **Leave empty to retry any failure.** Set it and the meaning inverts. |

```jsonc
{
  "id": "charge", "kind": "call-function", "ref": "chargeCard",
  "params": { "maxAttempts": 4, "delayMs": 500, "jitter": true, "retryOnStatus": [429, 502, 503, 504] },
  "next": ["receipt"], "onError": ["alertOps"]
}
```

Two of these have caught people out, and the property panel now says so where you
read it rather than only in this table:

- **`maxAttempts` counts the first call.** `4` means one attempt and three
  retries; `1` means no retry at all, and used to be accepted without a word. The
  panel labels it "Total attempts (incl. the first)" and says "1 means no retry"
  when you type one.
- **`retryOnStatus` is an allow-list, and setting it INVERTS the default.** Empty
  means "retry any failure". Adding `503` to be helpful makes every other failure
  fail immediately — which is usually right, and is never what adding one code to
  a list looks like. Set it when you can: a `400` will not become a `200` on the
  third attempt.

The panel draws the **delay sequence** beside the attempt count — "3 attempts,
waiting 1s, then 2s — up to 3s of delay" — because five numbers you have to
multiply together are not a policy anyone can read. With jitter on it shows a
range, because that is what you will observe.

With the policy on, the step output also carries **`attempts`** and
**`retried`**, so `{"$path": "previous.attempts"}` downstream keeps resolving.
Exhausting the attempts is an ordinary step failure, so `onError` routing (or the
unrouted-halt rule) applies. Backoff waits are **cancellable** — cancelling the
run does not sleep out the remaining delay.

#### There used to be a `retry` step kind

There is not one now. It took its own `ref` and invoked a function directly, so it
never wrapped a neighbouring step — it *was* a Call Function with backoff, and an
author who wanted to retry an existing Call Function had to delete it and rebuild
it as a Retry.

A definition that still says `kind: "retry"` is **migrated when it is read**, and
keeps working: it becomes a `call-function` step with the same policy, and its
`maxAttempts` is written in explicitly so a Retry that never set one keeps
retrying three times. **The file on disk is not rewritten** by being read — the
migrated form is persisted the first time you save that workflow yourself. The
reader accepts `kind: "retry"` forever, so an agent that learned the old
vocabulary is converted rather than refused.

The one thing to know if you roll a backend BACK past this change: a workflow
saved after the fold says `call-function`, and an older backend will load it, run
it, and call the function **once**, ignoring the policy.


#### How a function returns a value

Everything the rest of this document says about `previous.result.…` depends on
the called function actually putting something in `result`, and that is done
entirely on the function's own canvas:

1. On the **Response** node, add each name you want to return to **Parameters**
   (`total`, `orderId`, …).
2. Each name immediately becomes an **input port** on that node, labelled with
   the name. Wire the value into it, or type a literal.
3. `Send` answers the request with `{"result": { … }}` — one key per parameter,
   holding whatever reached its port. A step's output is that body, so
   `{"$path": "previous.result.total"}` reads it.

The **Request** node is the mirror image: names added to its **Parameters**
become **output ports** carrying the matching keys of the caller's JSON body, so
`params` sent by a step arrive as ports to wire from.

The ports appear as you type, with no backend running — they are derived from
the parameter by the editor (WFA-009), not pushed by a runtime. Removing a name
removes its port, and any connection left behind is flagged *"Target port
doesn't exist."* rather than being dropped silently.

If the Response node's **Status** is `Failure`, the parameters are not on offer
at all: it answers `400` with `{"error": <Error Message>}`, and the calling step
fails.

---

### `branch`

CF11-001's IF. Evaluates a condition and takes `ontrue` or `onfalse`.

| Param | Required | Description |
|---|---|---|
| `condition` | yes | A declarative condition. |

**Routes:** `ontrue`, `onfalse`. **Output:** `{ result, isfalse }`.

```jsonc
{
  "id": "isLarge", "kind": "branch",
  "params": { "condition": { "left": { "$path": "previous.total" }, "op": "gt", "right": 100 } },
  "routes": { "ontrue": ["manualReview"], "onfalse": ["autoApprove"] }
}
```

**Client equivalent:** the `Condition` node. Port names match (`ontrue`,
`onfalse`, `result`, `isfalse`). Differences: the condition is a declarative
object rather than a JavaScript expression, and there is no `eval` signal input
— a step runs when its incoming edge is taken.

---

### `switch`

Multi-way routing. Cases are matched **in order** and the first hit wins.

| Param | Required | Description |
|---|---|---|
| `value` | — | The value to switch on (literal or `$path`). Not needed if every case uses `when`. |
| `cases` | yes | `[{ label, equals }]` or `[{ label, when: <condition> }]`. Exactly one of `equals`/`when` per case. |

**Routes:** one per case label, plus `default`. **Output:** `{ matched, value }`.

```jsonc
{
  "id": "byStatus", "kind": "switch",
  "params": {
    "value": { "$path": "previous.status" },
    "cases": [{ "label": "paid", "equals": "paid" }, { "label": "refunded", "equals": "refunded" }]
  },
  "routes": { "paid": ["fulfil"], "refunded": ["restock"], "default": ["flagUnknown"] }
}
```

Labels must be unique and cannot be `default` (that name is the no-match route).

**Client equivalent: none.** The client `Switch` node is a two-state on/off
toggle — the shared name is a collision, not an equivalence.

---

### `for-each`

Invokes `ref` once per item of an array and collects the results.

| Param | Default | Description |
|---|---|---|
| `items` | `{"$path":"previous.items"}` | Must resolve to an array. |
| `itemKey` | `item` | Key the item is passed under. |
| `indexKey` | `index` | Key the original index is passed under. |
| `maxIterations` | `1000` | Hard cap; exceeding it **fails** the step. |
| `concurrency` | `1` | Items at once. `1` keeps results deterministically ordered. |
| `continueOnError` | `false` | See below. |
| `filter` | — | Condition; non-matching items are skipped and counted. |

**Routes:** `empty`, `nonempty`.
**Output:** `{ results, count, skipped, errors: [{index, message}], failed }`.

```jsonc
{
  "id": "billLines", "kind": "for-each", "ref": "chargeLine",
  "params": { "items": { "$path": "previous.lines" }, "concurrency": 4, "continueOnError": true },
  "next": ["summarise"]
}
```

Behaviours worth knowing:

- `items` resolving to something that is **not an array** is a **failure**, not
  "no items" — that distinction is usually a wiring bug you want to hear about.
- `maxIterations` **fails** rather than truncating. A silently truncated
  iteration is a half-processed order.
- `continueOnError: false` (default) stops at the first failing item and fails
  the step. `true` collects failures into `errors` and succeeds — but every
  failure is still in the output; nothing is swallowed.
- `index` and `errors[].index` are positions in the **original** array, so they
  stay meaningful under a `filter`.

**Client equivalent:** the Repeater renders a component per item. This runs a
*function* per item and collects return values.

> CF11-001 sketched a `triggerOutputAndWait` sub-graph per item. WF-001 has no
> signal ports and no nested scheduler, so the per-item unit is a function
> invocation — which keeps "a workflow node is a node" true. Iterating an
> arbitrary sub-DAG is deferred.

---

### `merge`

Combines the outputs of the upstream steps that reached it. No waiting is
involved: topological order guarantees every predecessor has finished.

| Param | Default | Description |
|---|---|---|
| `mode` | `all` | `all`: every declared source must have arrived, else the step **fails**. `any`: merge whatever arrived. |
| `sources` | every step with an edge into this one | Step ids expected to feed the merge. |
| `strategy` | `object` | `object` → `{[stepId]: output}` (lossless); `array` → outputs in order; `shallow` → one flat object, later sources winning (lossy). |

**Output:** `{ merged, sources, missing }`.

```jsonc
{ "id": "join", "kind": "merge", "params": { "mode": "any", "strategy": "object" }, "next": ["report"] }
```

`mode: "all"` is the default deliberately: a half-merge passed downstream as if
complete is a silent data-loss bug. Use `"any"` when converging genuinely
alternative branches (as after a `branch` or `switch`), which is the common case.

---

### `stop`

Ends this path deliberately.

| Param | Default | Description |
|---|---|---|
| `message` | `Workflow stopped` | Recorded as the step error message. |
| `isError` | `true` | `true`: fail the step (routed via `onError`, or halt). `false`: succeed but take **no** outgoing edges. |

```jsonc
{ "id": "guard", "kind": "stop", "params": { "message": "Order has no lines" }, "onError": ["notifyBadOrder"] }
```

A non-error stop takes no edges **at all**, not even `next`; everything
downstream is recorded `skipped`, so "this path ended on purpose" is visible in
the execution record rather than inferred.

---

### `return`

Ends this path **and** sets the value the run answers with.

| Param | Default | Description |
|---|---|---|
| `value` | the upstream step's output | What the run returns: a literal, or `{"$path": "…"}` into any predecessor. |

**Routes:** none — it ends its path like a non-error `stop`. A `return` with a
`next` edge is refused when you save the workflow.

```jsonc
{
  "id": "answer", "kind": "return",
  "params": { "value": { "orderId": { "$path": "previous.result.id" }, "ok": true } }
}
```

#### The Response node's rhyme

A cloud function's graph ends at a **Response** node; a workflow's path ends at
a **Return** step. They mean the same thing one tier apart — *this is the value
that leaves* — which is why the workflow layer does not invent a second word for
it. The difference is direction: Response answers a request it was handed;
Return sets the **run result**, and whether anyone is listening depends on how
the run started.

Who actually receives it:

| Started by | Gets the returned value? |
|---|---|
| A **webhook** trigger with `responseMode: "sync"` | Yes — it *is* the response body. |
| A **webhook** trigger in `async` mode (the default) | No — `{executionId, status}`. The value is on the execution record. |
| `POST /admin/workflow-defs/<id>/run` | Yes, as `run.output`. |
| A **schedule** or **db-change** trigger | Nobody is listening. Not an error; the value is still recorded. |

See [Triggers → Answering the caller](./TRIGGERS.md#answering-the-caller-responsemode).

#### Without one

A workflow with no `return` step answers with **whichever step finished last** —
which is what every workflow did before this kind existed, and is unchanged. On
a straight line that is obvious; through a branch, or a `for-each` with
concurrency, it is not something you can read off the canvas. That is the whole
argument for writing it down.

#### Two of them

**Two Return steps is normal** — a success path and an error path, one on each
branch — and is *not* validated as a mistake. Only one of them runs, so only one
of them answers.

If two both *run* (a parallel merge), the **first wins**, and the execution
record carries `returnConflict` naming both. Recorded rather than resolved
silently: two live Returns is usually a graph that means something the author
did not intend, and a value chosen by scheduling order should never look
deliberate.

**Client equivalent:** the cloud function **Response** node.

---

### `wait`

Pauses the run.

| Param | Default | Description |
|---|---|---|
| `duration` | — (required) | How long, in `unit`s. Must be > 0. |
| `unit` | `milliseconds` | `milliseconds`, `seconds`, `minutes`, `hours`. |

**Output:** `{ waitedMs }`.

```jsonc
{ "id": "cooldown", "kind": "wait", "params": { "duration": 2, "unit": "seconds" }, "next": ["nextPage"] }
```

#### Waiting on a server is not waiting in a browser

In the browser a Timer is nearly free. Here it is not, and the difference is
worth stating plainly:

- **There are no frames.** A wait is a real pending timer in a real service
  process, which must stay alive for the wait to complete.
- **A waiting run holds a concurrency slot.** With the default cap of `1`, a
  ten-minute wait means every other run of that workflow queues for ten minutes.
- **Runs are in memory.** A restart during a wait does not resume it — the run is
  recorded `error` with `metadata.interrupted`. The longer the wait, the more
  fragile it is.
- **On a metered host it is billed occupancy for doing nothing.**

Hence a hard **24-hour ceiling**, enforced when you *save* the workflow rather
than at 3am in production. For anything beyond minutes, use a **[schedule
trigger](./TRIGGERS.md)** instead: persisted cron costs nothing while it waits
and survives a restart.

Cancelling the run, or tripping a per-step or per-workflow timeout, ends a wait
immediately.

**Client equivalent:** the `Timer` node (displayName "Delay"); `duration` matches.

---

### `wait-until`

Waits until a target instant.

| Param | Required | Description |
|---|---|---|
| `target` | yes | ISO-8601 string, epoch milliseconds, or a `$path` resolving to either. |

**Routes:** `done`, `skipped`. **Output:** `{ waitedMs, skipped, target }`.

```jsonc
{
  "id": "embargo", "kind": "wait-until",
  "params": { "target": { "$path": "previous.publishAt" } },
  "routes": { "done": ["publish"], "skipped": ["publishNow"] }
}
```

A target already in the past takes `skipped` immediately — that is a normal
outcome, not an error. An **unparseable** target is a step failure: degrading a
typo to a zero wait would quietly stop honouring the embargo. Same 24-hour cap
and cancellation behaviour as `wait`.

---

## A worked example

Webhook → validate → branch on value → charge with a retry policy → notify, with an error
route throughout:

```jsonc
{
  "version": 1,
  "id": "order-pipeline",
  "name": "Order pipeline",
  "entry": "validate",
  "concurrency": 2,
  "stepTimeoutMs": 30000,
  "steps": [
    { "id": "validate", "kind": "call-function", "ref": "validateOrder",
      "next": ["isLarge"], "onError": ["alertOps"] },

    { "id": "isLarge", "kind": "branch",
      "params": { "condition": { "left": { "$path": "previous.total" }, "op": "gt", "right": 100 } },
      "routes": { "ontrue": ["manualReview"], "onfalse": ["charge"] } },

    { "id": "manualReview", "kind": "call-function", "ref": "queueForReview", "next": ["join"] },

    // `previous` here is the branch's `{result, isfalse}`, so the amount comes
    // from the validate step by id — the case `previous` cannot express.
    { "id": "charge", "kind": "call-function", "ref": "chargeCard",
      "params": { "amount": { "$path": "upstream.validate.total" },
                  "maxAttempts": 4, "delayMs": 500, "retryOnStatus": [429, 502, 503] },
      "next": ["join"], "onError": ["alertOps"] },

    { "id": "join", "kind": "merge", "params": { "mode": "any" }, "next": ["receipt"] },

    { "id": "receipt", "kind": "call-function", "ref": "sendReceipt" },

    { "id": "alertOps", "kind": "call-function", "ref": "alertOps" }
  ]
}
```

Point a [webhook trigger](./TRIGGERS.md) at it with
`target: { kind: "workflow", name: "order-pipeline" }`.

---

## Validation

Definitions are validated **strictly on write and on load**. A definition that
could not possibly run is rejected with HTTP 400 naming every problem, and an
invalid file on disk makes the backend **refuse to start**.

Checked: unique step ids; a real `entry`; every `next` / `onError` / `routes`
target exists; the graph is acyclic; the kind is known; `ref` is present exactly
where it belongs; conditions are well-formed; switch cases are unambiguous,
unique and not named `default`; route names are valid for the kind; numeric
params are in range; and a `wait` is inside the 24-hour cap.

**Step references are checked too.** A `{"$path": "upstream.<stepId>…"}` is a
**400 naming the step** when:

- the step **does not exist** in this workflow — that is a typo, not a runtime
  possibility, and
- the step is **not upstream** of the one referencing it — topological order
  means it cannot have produced output by the time this step runs.

A path *into* an upstream step's output is allowed silently. The engine cannot
know what shape a cloud function returns, so `upstream.save.whatever.it.returns`
is between you and your function; if it resolves to nothing you get `undefined`,
which is what the payload has always done.

Nothing here checks `previous.…` or a payload key against a shape — there isn't
one to check against.

---

## Related

- [WF-001 semantics](../../dev-docs/tasks/phase-19-cloud-workflows/WF-001-SEMANTICS.md) — ordering, cancellation, timeouts, durability, concurrency
- [Triggers](./TRIGGERS.md) — what starts a workflow
- [Backend services](./BACKEND-SERVICES.md) — the service these run in
