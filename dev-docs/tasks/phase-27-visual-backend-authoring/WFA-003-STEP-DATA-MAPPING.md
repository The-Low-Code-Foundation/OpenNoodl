# WFA-003: Step Data Mapping & One Payload Shape

## Metadata

| Field | Value |
|-------|-------|
| **ID** | WFA-003 |
| **Phase** | Phase 27 — Visual Backend Authoring (Track L) |
| **Tier** | 2 — the prerequisite |
| **Priority** | 🔴 Critical (WFA-004 cannot express the obvious without it) |
| **Difficulty** | 🟡 Medium — the mechanism is small; the compatibility rules are the work |
| **Estimated Time** | ~1 week |
| **Prerequisites** | none. WFA-002 makes the result much easier to see |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Opus 5** — a change to a persisted, deployable, agent-authored format with existing definitions in the wild |

## Objective

Let a workflow step read values from the run payload and from earlier steps' outputs, and give the
three entry points one predictable payload shape — so that "take the order id from the save step and
pass it to the charge step" is expressible at all.

## Background

A step's input is built here
([`WorkflowEngine.ts:395-398`](../../../packages/nodegx-backend/src/workflow/WorkflowEngine.ts#L395)):

```ts
const input: Record<string, unknown> = {
  ...basePayload,
  ...(step.params || {}),
  ...(previous ? { previous } : {})
};
```

`step.params` are **static literals**, merged verbatim. There is no `$path` resolution, so there is no
way to feed one step's output into the next step's function parameters (F11). Conditions *do* have a
path language — `{"$path": "previous.order.total"}` — but it is only used by `branch`, `switch` and
`for-each`'s filter, not by step inputs.

The second half of the problem is that the same workflow receives different payload shapes depending
on how it was started (F12):

| Entry point | Payload | Where |
|---|---|---|
| Webhook | `{trigger:'webhook', triggerId, slug, headers, query, body}` | `HttpServer.ts:1875` |
| Schedule | `{trigger:'schedule', triggerId, firedAt, cron}` | trigger subsystem |
| Manual fire | `{trigger:'manual', triggerId, ...body}` | `admin-triggers.ts:121` |
| Admin run | `body.payload \|\| body \|\| {}` | `admin-workflows.ts:107` |

The webhook wraps the request body under `body`; the admin run does not wrap at all. A live test
proved the consequence (F13): a workflow that ran green from `POST /admin/workflow-defs/:id/run`
failed from a webhook carrying the same JSON, with

```
Step "decide" condition failed to evaluate: Cannot order-compare undefined and 100 with "gt"
```

which is the engine failing loudly and correctly at a problem it should not have.

Today's workaround (F14) is to make every cloud function resolve its own source with a JS node —
`Inputs.previous?.result ?? Inputs.body ?? Inputs`. It works. It also means every function carries
adapter code, and it makes the phase-19 exit criterion's "triggered by a webhook **and** on a
schedule" effectively unreachable for one workflow.

**Why this blocks the canvas.** On a canvas the first gesture every user will try is dragging a wire
from `save.orderId` into `charge.amount`. If nothing can receive it, WFA-004 ships an editor that
cannot express the thing it most obviously looks like it should.

## Current State

| File | What it does |
|---|---|
| `workflow/WorkflowEngine.ts:395` | Builds step input: base payload + static params + `previous` |
| `workflow/StepExecutor.ts:30` | Documents that contract |
| `workflow/steps/conditions.ts` | The existing value language: literal, `{$path}`, `{$literal}`; paths walk objects and arrays, `-1` is last |
| `workflow/steps/kinds.ts` | Per-kind param specs, including `type: 'condition' \| 'path' \| …` |
| `server/HttpServer.ts:1875` | Webhook payload envelope |
| `server/admin-triggers.ts:121` | Manual fire payload |
| `server/admin-workflows.ts:107` | Admin run payload |
| `WorkflowEngine.ts:135` | Write-time validation against the step catalog |

## Desired State

### 1. Step params resolve values, using the language that already exists

A param value may be a literal, or one of the forms `conditions.ts` already defines:

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

Rules:

- **Reuse `conditions.ts`'s resolver.** A second path implementation that disagrees at the edges
  (missing keys, array indices, `-1`) is a bug factory. If the existing one needs extracting to be
  reusable, extract it — do not copy it.
- **`upstream.<stepId>` is addressable**, not only `previous`. The engine already builds an `upstream`
  map of every predecessor that took an edge here (`WorkflowEngine.ts:400-405`); it is currently
  passed to executors but not reachable from params. A diamond — two branches meeting at a step — has
  no `previous` worth the name, which is exactly when you need this.
- **An unresolvable path is `undefined`, not an error.** It matches how the payload behaves today and
  keeps optional parameters possible. But see criterion 4: the *canvas* should make a dangling
  reference visible at author time, and validation should warn at write time.
- **`$literal` escapes**, exactly as in conditions, so a param that genuinely needs a `$path` key can
  say so.
- Resolution is **one level deep into objects and arrays** inside a param value, so
  `{"order": {"id": {"$path": "…"}}}` works. Recursive by construction, but bounded — state the depth
  rule and test it.

### 2. One payload shape, with the old one intact

Every entry point delivers:

```jsonc
{
  "trigger": { "type": "webhook", "id": "trg_…", "firedAt": "…", "slug": "…", "cron": "…" },
  "body":    { /* the caller's JSON, always here, always unwrapped */ },
  "headers": { /* webhook only */ },
  "query":   { /* webhook only */ }
}
```

- `body` is **always** present and always the caller's own data, whether that came from a webhook
  body, a manual fire, or an admin run's `payload`. A schedule with no payload has `body: {}`.
- **Backwards compatibility is not optional.** Workflow definitions exist in data directories today,
  and their functions read top-level keys. Keep the current top-level spread alongside the new shape
  for one release, with the old keys marked deprecated in the docs and in
  `GET /admin/workflow-step-kinds`'s version. A definition written against today's shapes must keep
  running, and a test must prove it.
- This also fixes the practical half of F8 (a schedule cannot carry a payload) once WFA-005 adds the
  field: the payload lands in `body` like everything else.

### 3. The served spec describes it

`GET /admin/workflow-step-kinds` gains the value language in its spec — enough for both the MCP tools
and WFA-004's property editor to render the right control for a param without hardcoding. Bump the
`version`. The coverage-gate test WF-002 built (spec table ≡ `StepKind` union ≡ executor table) must
extend to the value language so it cannot drift.

### 4. Write-time validation says what is wrong

The existing validator already rejects unknown kinds, missing params, malformed conditions and bad
route names with a 400 naming the problem. Extend it:

- A `$path` that references a step id that does not exist in this workflow → **400**. That is a typo,
  not a runtime possibility.
- A `$path` that references a step that is not a predecessor of this one → **400**. Topological order
  means it cannot have run.
- A `$path` into a predecessor's output whose shape is unknown → allowed silently. The engine cannot
  know a function's output shape.

## Implementation Steps

1. **Extract the value resolver** from `conditions.ts` into something both conditions and params use.
   The existing condition tests must pass unchanged — that is the evidence the extraction was
   behaviour-preserving.
2. **Resolve params** in `WorkflowEngine`, with `upstream` addressable.
3. **Unify the payload** at the four entry points, keeping the legacy top-level spread.
4. **Extend write-time validation** with the two new 400 cases.
5. **Spec + version bump + coverage gate.**
6. **Docs**: `docs/runtime/WORKFLOW-NODES.md` gains a "passing data between steps" section, which is
   currently the page's most conspicuous hole.
7. **Prove it end to end on a real service**, in the pattern WF-002's suite already uses: two real
   cloud functions where the second receives a value produced by the first, asserted by the second
   function's echoed Response body rather than by a spy.
8. **Prove the compatibility claim**: take the phase-19 test workflow definition verbatim (its
   functions resolve their own inputs with a JS node) and assert it still runs green.

## Success Criteria

- [ ] A `call-function` step passes a value taken from an earlier step's output to its function, proven
      by the function's own response body.
- [ ] `upstream.<stepId>` resolves for a diamond where `previous` is ambiguous.
- [ ] All four entry points deliver the caller's data under `body`, and a schedule delivers `body: {}`.
- [ ] A workflow definition written against today's payload shapes still runs, with a test.
- [ ] `$path` to a nonexistent or non-predecessor step is a 400 naming the step.
- [ ] `$literal` escaping works for params, with a test.
- [ ] Condition behaviour is unchanged — the existing condition suite passes without edits.
- [ ] `GET /admin/workflow-step-kinds` describes the value language and its `version` is bumped; the
      coverage gate covers it.
- [ ] `docs/runtime/WORKFLOW-NODES.md` documents passing data between steps.

## Out of Scope

- **Expressions or arithmetic in params.** WF-002's reasoning stands: a persisted, deployable,
  agent-authored artifact must not carry `eval`'d strings, and PLAT-003 and LEARN-001 both spent
  effort removing `eval` from this tree. Compute in a function. This task makes *referencing* values
  possible, not *computing* them.
- **A visual mapping UI.** WFA-004 renders whatever this task makes expressible.
- **Changing what a function receives as its HTTP body.** Functions still receive JSON; this changes
  what is in it, not how it arrives.
- **Durable runs.** Still WF-001's residual, still not this phase.

## Traps

- **`conditions.ts` paths treat `-1` as last and walk arrays.** Any reimplementation will get this
  subtly different. Extract, do not copy.
- **The legacy top-level spread and the new `body` key can collide.** A caller posting
  `{"body": {...}}` today has that spread to the top level *and* wrapped by the webhook. Decide the
  precedence explicitly and test the collision, rather than letting object-spread order decide.
- **`$literal` already exists in conditions with specific semantics.** Params must match them exactly
  or authors will learn two dialects of the same syntax.
- **Write-time validation runs on load too** — the registry refuses to start on an invalid file. A new
  400 case means a definition that was valid yesterday can prevent a backend from starting today. That
  is why the two new cases are typos-only and why compatibility is a hard criterion; if a stricter
  check is tempting, weigh it against a backend that will not boot.
- **`{s: null}` SQL quirk and the `_` LIKE-wildcard** are unrelated to this task but live in the same
  package; do not "fix" them here.
- **The engine's ordering, cancel and timeout semantics are proven and must not move.** WF-002's
  evidence that it did not break them was that the WF-001 suite passed unchanged. Inherit that test.
