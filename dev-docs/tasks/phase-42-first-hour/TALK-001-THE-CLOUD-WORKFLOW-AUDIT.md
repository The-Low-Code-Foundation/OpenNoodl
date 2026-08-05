# TALK-001 — The cloud-workflow node set: what's doctrine, what's a hole, what's a bug

Covers reported item **11** (item 12's pin bugs are [FH-012](FH-012-PIN-NAVIGATION-AND-Z-ORDER.md);
the cut-off labels are [FH-013](FH-013-PROPS-LABELS-WRAP.md) — same shared component). This is the
audit conversation you asked for.

## The ground truth first

The catalog is **nine step kinds, complete and correct in the picker**: Call Function, Branch (IF),
Switch, For Each, Merge, Retry, Stop/Error, Wait, Wait Until. The backend registry
(`kinds.ts:118-470`) is the single source; the editor picker is derived from it at runtime, so
there is no drift — what you saw is all there is. Backend language: **Node.js** (the engine runs
in `nodegx-backend`, functions execute in its sandbox).

The organizing doctrine, stated in the code and docs (`kinds.ts:124-128`,
`docs/runtime/WORKFLOW-NODES.md:245-253`): **workflows orchestrate, cloud functions compute.** No
expression step, no HTTP step, no data step — "do real work in a cloud function". Your instinct
("is it because it's a Node service?") is close: the recorded reason for the visual IF/SWITCH
builders is security, not language — *"an eval'd string in it is a remote-code-execution surface
with an admin credential in front of it"* (`conditions.ts:5-16`). The 19-operator condition
language is **served by the backend** to the editor so the editor can never offer an operator the
backend can't evaluate. That's the justification you'd give people: conditions are data, not code,
because workflow definitions execute with admin authority on the server.

So the answer to "can we add Expression and Function nodes to workflows?" is: **they already exist
one level down** — Expression, Function (JS), and Logic Builder are all in the *cloud function*
picker and run server-side in the sandbox. The workflow level deliberately doesn't have them.

## Your item-by-item, sorted into three piles

### Pile 1 — real bugs / broken promises (tasks, no debate needed)

1. **`call-function` has no way to pass data into the function. This is the largest hole in the
   surface.** WFA-003 specified param mapping (`{"amount": {"$path":"previous.result.total"}}`),
   the engine resolves it, round-trips preserve it if MCP writes it — but the catalog declares no
   params for `call-function`, so **no UI anywhere can author a mapping**. The `$path` picker UI
   (`WorkflowValueInput` over reachable predecessors) is *built and unreachable* because no
   catalog kind declares a `path` param. This gates everything else: whatever we decide below,
   this gets fixed first.
2. **A workflow's output is dropped before the caller sees it.** The engine computes
   `output: lastOutput`, and then the webhook dispatcher returns
   `{executionId, status}` — not the output (`dispatcher.ts:204-217`). Only the editor's admin
   route sees the result. So "what does the caller get back?" currently has the answer:
   *nothing*. Your "return node" instinct is right (see Q3).
3. **HTTP for functions is on the wrong node.** The modern `HTTP Request` (`net.noodl.HTTP`) is
   registered **browser-only** (`noodl-runtime.ts:175` — commented out "moved to viewer for
   debugging"), so the cloud picker offers only the *legacy, deprecated* `REST2` node. Re-register
   the modern node in the cloud runtime — small fix, big ergonomic gain, independent of Q4.
4. **First workflow on a backend can't be created** (POL-015, still open) and
   **`noodl.cloud.aggregate` can't be configured or fired** (OPEN-WORK F62).
5. **Retry's seven knobs, no preview** — see Q7, but two parts are just defects of presentation:
   `maxAttempts` includes the first attempt (so `1` = "no retries", accepted silently), and
   `retryOnStatus` silently inverts semantics (set = allow-list). A backoff-curve preview line and
   two better descriptions fix most of the confusion.

### Pile 2 — things that work as designed but read wrong (naming/affordance fixes)

- **"Receive" / triggers**: trigger nodes are a **read-only view** of backend trigger state —
  drawn, not authored, never saved into the definition, deletable only via the Triggers panel
  (deliberate: canvas delete is undoable, deleting a backend trigger is not). You can't "place a
  Receive node" because there's nothing to place — a workflow with no triggers still shows a
  synthetic Manual marker. What's missing is *affordance*: the picker should say this (a
  non-placeable "Triggers…" entry that opens the Triggers surface would end the confusion).
- **Call Function is not overloaded.** It only ever calls out to a cloud function; it cannot call
  another workflow (no such step exists). The confusion comes from every new workflow being born
  as a single `call-function` step that is also the entry — so the first card reads as "declares
  this workflow callable" when `entry` is just "the leftmost step with nothing wired in". Fix:
  don't birth workflows as a bare call-function (an explicit entry marker card), and/or label the
  entry step visibly.

### Pile 3 — the actual design questions (the heart-to-heart)

**Q1 — Keep the orchestrate/compute split, or soften it?**
The doctrine's cost, stated plainly by the audit: *every* external call is a round trip through a
second canvas, and today (Pile 1.1) you can't even pass data into that canvas. Options:
- **(a) Keep the split, fix the plumbing**: param mapping UI (Pile 1.1), function output actually
  returned, WFA-006's descent gesture (step → function) as the "one level down" affordance. The
  split stays honest: conditions-as-data for security, JS lives in sandboxed functions.
- **(b) Soften it with compute steps that are still data, not code**: a **Transform/Map step**
  (your "JSON manipulation node") using the *existing* `$path`/`$literal` value language + a
  small pure-function vocabulary (`toLower`, `concat`, arithmetic) — no eval, no RCE surface. This
  answers 80% of "I just need to reshape the JSON between two calls" without a second canvas.
- **(c) Full expression step in workflows** — sandboxed like functions. Honest option, but it
  reintroduces exactly what conditions.ts was designed to avoid unless it runs in the same
  isolate, at which point it *is* a one-node cloud function.
My lean: **(a) + (b)**. The split survives; the pain doesn't.

**Q2 — Data steps in workflows?** Same shape as Q1. CRUD nodes exist in cloud functions (full
record family against the built-in SQLite via the Parse-wire loopback). A dedicated
Query/Create/Update/Delete *step* would be sugar over `call-function`+params once Pile 1.1 lands.
My lean: defer until param mapping exists, then decide with usage evidence — a data step is only
worth it if the function round-trip still hurts.

**Q3 — The Return story.** Two layers: a **Respond/Return step** (explicit, visible on canvas,
"this is what the caller gets") vs the current implicit `lastOutput` (which is then discarded —
Pile 1.2). The minimum honest fix: webhook dispatch returns the workflow output (sync mode) or
keeps `{executionId, status}` (async mode) — that's a per-trigger setting. A visible Return step
is better authoring UX and matches your ask. Note cloud functions already have exactly this:
the `Response` node. The workflow level should rhyme with it.

**Q4 — An HTTP step at workflow level?** With Q1(a)+(b) and Pile 1.3 done, an HTTP call is a
one-node cloud function with a mapped input — or we admit HTTP is common enough to be a step
(`invokesFunction`-style executor, same shape as Retry). My lean: fix 1.3 first, revisit after
you've built two real apps on it.

**Q5 — Streaming / SSE to the frontend (your LLM use case).** Currently impossible at every
layer: the `Response` node answers exactly once; the engine has no streaming; the realtime hub is
DB-subscriptions only. This is the one genuinely *new* capability in your list — a
`stream-response` mechanism for functions (and/or a workflow step that emits progress events the
client can subscribe to). It's also the natural companion to TALK-005's Subscribe To Changes node
("the backend pushes, nodes subscribe"). Worth its own task doc once we agree the shape; not a
quick add.

**Q6 — Calling a workflow from a workflow.** Doesn't exist (Call Function can't). Do we want a
`run-workflow` step? Composability says eventually yes; my lean is not-yet — it multiplies the
Q3 answer (what does a nested workflow return?) and durable-runs debt (Wait holds a process and a
concurrency slot for its whole duration — WF-001 residual).

**Q7 — Retry.** Beyond Pile 1.5's presentation fixes: should Retry *wrap* rather than *replace* a
Call Function? Its current shape (it takes its own `ref` — it IS a call-function with backoff) is
defensible but reads wrong on the canvas. Options: rename ("Call with Retry"), or make retry a
*policy on the call-function step* (a params group) and delete the standalone kind. My lean:
**fold into Call Function as a policy group** — one less card, and the confusion evaporates.

## Suggested order once we've talked

1. Pile 1.1 param mapping (unlocks everything) → 1.2/Q3 minimal return → 1.3 HTTP node
   re-registration → POL-015.
2. Q1(b) Transform step + Q7 retry fold + Pile 2 affordances.
3. Q5 streaming as its own designed task. Q2/Q4/Q6 revisit with evidence.

---

# DECISIONS — 2026-08-05 (Richard)

The conversation happened. Before it, the three load-bearing claims above were re-verified against
the code: `call-function`'s params really are `[REF_PARAM]` and nothing else
([kinds.ts:119-133](../../../packages/nodegx-backend/src/workflow/steps/kinds.ts#L119-L133)), the
dispatcher really does return only `{executionId, status}`
([dispatcher.ts:217](../../../packages/nodegx-backend/src/triggers/dispatcher.ts#L217)), and the
modern HTTP node really is one commented-out line
([noodl-runtime.ts:175](../../../packages/noodl-runtime/noodl-runtime.ts#L175)).

| Q | Decision | Task |
|---|---|---|
| **Q1** | **(a)+(b)** — keep the orchestrate/compute split, fix the plumbing, **and** add a Transform step in the existing `$path`/`$literal` value language. No eval at workflow level, ever. | [CWF-004](CWF-004-THE-TRANSFORM-STEP.md) |
| **Q2** | **Deferred.** Data steps are sugar over `call-function`+params; revisit with usage evidence once CWF-001 lands. | — |
| **Q3** | **Both layers.** Dispatcher returns the output in sync mode (`{executionId, status}` in async — a per-trigger setting) **and** a visible Return step that rhymes with the cloud function `Response` node. | [CWF-002](CWF-002-THE-WORKFLOW-RETURN.md) |
| **Q4** | **Deferred.** Fix the node registration first; revisit an HTTP *step* after two real apps. | — |
| **Q5** | **Own design doc now, build after Pile 1.** Shares its shape with TALK-005's Subscribe To Changes. | [CWF-007](CWF-007-STREAMING-RESPONSES.md) |
| **Q6** | **Not yet.** `run-workflow` multiplies the Q3 answer and the Wait-holds-a-slot debt. | — |
| **Q7** | **Fold Retry into Call Function as a policy group**; delete the standalone kind, migrate existing steps. Presentation fixes ride along. | [CWF-005](CWF-005-RETRY-IS-A-POLICY.md) |

Pile 1 needed no decision and is written up regardless: [CWF-001](CWF-001-CALL-FUNCTION-PARAMS.md)
(1.1, the gate), [CWF-002](CWF-002-THE-WORKFLOW-RETURN.md) (1.2), [CWF-003](CWF-003-HTTP-IN-THE-CLOUD-RUNTIME.md)
(1.3), [CWF-005](CWF-005-RETRY-IS-A-POLICY.md) (1.5). Pile 1.4 keeps its existing owners (POL-015,
OPEN-WORK F62) — not duplicated here. Pile 2's affordances are [CWF-006](CWF-006-TRIGGERS-AND-THE-ENTRY-STEP.md).

**Build order:** CWF-001 → CWF-002 → CWF-003 → CWF-005 → CWF-004 → CWF-006. CWF-007 is a design
doc to write and argue with, not a build.

**The doctrine, in one sentence you can say to people:** conditions and params are *data, not code*,
because a workflow definition executes with admin authority on the server — compute lives one level
down in a sandboxed cloud function, where Expression, Function and Logic Builder already are.
