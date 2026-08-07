# WFA-005 — Notes

**Status:** ✅ Complete. Every success criterion driven in the running editor and
screenshotted.
**Spec:** [WFA-005-TRIGGERS-ON-CANVAS.md](./WFA-005-TRIGGERS-ON-CANVAS.md)

**Commits**

| Commit | What |
|---|---|
| `0b692e56` | F8's class (unknown keys 400) then `schedule.payload`; F7's Bearer exemption |
| `5c247dcd` | Workflow targets + the picker (F9), the canvas entry nodes, and F47's event |
| (this) | The live pass, the docs, and one chip that named a colour as if it were a category |

---

## Step 1 — F7 and F8 reproduced before anything was changed

Against a real `nodegx-backend serve` on `:8590` (`--backend-id wfa005`), a scratch data dir
holding two workflow definitions (`ping`, `orderPipeline`) copied from the live SQLite backend.
Every response below is verbatim.

### F8 — a schedule payload is silently discarded

```
POST /admin/triggers
{"type":"schedule","name":"F8 repro","target":{"kind":"workflow","name":"ping"},
 "schedule":{"cron":"*/5 * * * *","missedFirePolicy":"skip","payload":{"source":"nightly"}}}

HTTP/1.1 201 Created
{"trigger":{"id":"trg_xVCUmjjd3Qjd","type":"schedule","name":"F8 repro","enabled":true,
 "target":{"kind":"workflow","name":"ping"},…,
 "schedule":{"cron":"*/5 * * * *","missedFirePolicy":"skip"}}}
```

201, and `payload` is not in the stored trigger. Not rejected, not stored.

**And it is not about `payload`.** The same probe against every config object, and against the
trigger itself:

| Probe | Result |
|---|---|
| `schedule: {…, payload: {...}}` | **201**, dropped |
| top level: `retryPolicy: "exponential"` | **201**, dropped |
| `webhook: {…, verifySsl: false}` | **201**, dropped — stored config is `{slug, scheme, maxBodyBytes}` |
| `dbChange: {…, filter: {total: {$gt: 100}}}` | **201**, dropped |

**The asymmetry is the defect.** Put that same key in `triggers.json` and the service will not
start:

```
[nodegx-backend] FATAL: …/triggers.json is invalid — refusing to start with triggers that
would not fire correctly:
  - trigger "trg_asym": unknown schedule key "payload"
```

So the registry has exactly one rule and applies it to stored data but not to input. The cause is
in `TriggerRegistry.upsert`: it **reconstructs** `def` field by field from `input` and then
validates the reconstruction, so an unknown key is gone before `validateTriggerDef` ever sees it.
Validation of the write path is validation of a value the write path just built, which can only
ever pass. `payload` was how it was noticed.

Consequence, confirmed on the run the `*/5` schedule fired unattended:

```
triggerData: { triggerId, firedAt, cron,
               trigger: {type:'schedule', id, firedAt, cron},
               triggerType: 'schedule',
               body: {} }
```

`body` is `{}` — the field WFA-003 built for the caller's data — and the authored payload is
nowhere. One definition cannot serve both a webhook and a schedule, which is the phase-19 exit
clause.

### F7 — `Authorization: Bearer <secret>` can never authenticate

A `token`-scheme webhook (`slug: f8probe`, target `{kind:'workflow', name:'ping'}` — which also
demonstrates that the *admin API* has always accepted a workflow target, F9's point), fired three
ways with the correct secret:

| Transport | Status |
|---|---|
| `X-Webhook-Token: whsec_…` | **200** |
| `?token=whsec_…` | **200** |
| `Authorization: Bearer whsec_…` | **401** `{"error":"Unauthorized."}` |

And with no credential at all, for contrast — this is `webhook.ts`'s own message, which advertises
the transport that cannot work:

```
{"error":"Webhook rejected: missing webhook token (X-Webhook-Token / Bearer / ?token=)"}
```

**Two things beyond the spec's description**, both from the execution log:

1. **The Bearer rejection produces no execution record.** `/executions` after the four hits holds
   three runs and one rejection — the rejection being the *no-credential* one, recorded loudly by
   `dispatcher.recordRejection` as the spec's trap describes. The Bearer attempt was refused in
   `handle()` before routing reached `handleWebhook`, so it left nothing behind. An operator asking
   "why is my integration failing?" sees an empty history, not a rejected hook.
2. **It feeds the auth lockout budget.** `handle()` calls `authLimiter.recordFailure` on a thrown
   principal resolution, so a third-party service retrying a Bearer hook walks itself into BAK-005's
   429 for every route on the backend.

---

## Step 2 — F8's general case, and only then the field

The spec's step order was right and it mattered: **adding `payload` first would have
hidden the class of bug.** The gap is one line of shape, not one missing key —
`TriggerRegistry.upsert` builds a `TriggerDef` field-by-field from the input and then
validates *the object it just built*, so validation of the write path can only ever
confirm that `upsert` copied correctly. An unknown key is gone before it is looked at.

The key sets now live in one place (`TRIGGER_KEYS`, `TARGET_KEYS`, `SCHEDULE_KEYS`,
`WEBHOOK_KEYS`, `DB_CHANGE_KEYS`) and `validateTriggerInput` checks what the CALLER
sent, before any of it is copied. Only key *names* are checked there; every value rule
stays in `validateTriggerDef`, which still runs on the constructed definition — so
there is one description of a valid trigger, and the new strictness lands on the write
path only. That is the spec's stored-data trap closed by construction: a `triggers.json`
that boots today still boots.

**One rule needed a deliberate exception.** `createdAt`, `updatedAt` and `status` are
registry-owned, and `GET` → edit → `PUT` is the obvious editing gesture from a panel or
an agent — it round-trips exactly those three. Refusing them would have made the fix
break the most likely caller, so they are accepted and ignored, with a spec that says so.

`ScheduleConfig.payload` then lands as WFA-003's `body`, and is **omitted** from the
stored file when absent, so a schedule that carries nothing reads on disk exactly as it
did before the field existed.

**A test fire now sends the schedule's own payload** when the caller posts no body.
Otherwise "Test fire" exercises a payload the real fire never uses, which is the one
thing a test fire must not do. An explicitly posted body still wins.

## Step 3 — F7, and where the exemption is scoped

`resolvePrincipal` runs for every request before routing and throws 401 for any `Bearer`
that is not an admin token, so the transport `webhook.ts` accepts — and whose own 401
advertises — could never authenticate.

**The exemption keys off the matched route's declared access kind**
(`route.access.kind === 'webhook'`), not off the path. `matchRoute` has already run by
that point, so this is the exact set of routes the table marks `{kind: 'webhook'}` — one
today. It is not a prefix test and not a substring test: nothing about the request can
steer it, and reaching a second route through it would take adding that route to the
family deliberately. `checkAccess` already treated `webhook` as self-enforcing for the
same reason, so this makes one declaration govern both steps instead of one.

An admin token gains nothing: on a hook it arrives anonymous like every other caller and
is then compared, timing-safely, against *that hook's* secret. Verified live and in
specs, including the ones that try to reach `/admin/*` through the exemption.

**Two consequences the spec did not list**, both found by reading the execution log
during the repro rather than by reading the code:

1. The Bearer rejection produced **no execution record at all** — it was refused in
   `handle()` before routing reached `handleWebhook`, so the loud-rejection behaviour the
   spec's trap protects never ran. An operator debugging a failing integration saw an
   empty history. Fixed as a side effect: the request now reaches the handler, which
   records the refusal like every other bad credential.
2. It fed BAK-005's **auth lockout budget**. A third-party service retrying a Bearer hook
   walked itself into a 429 for every route on the backend.

## F9 — two defects wearing one number

The panel hardcoded `target: {kind: 'function'}`, and the target was free text.

Both halves are now chosen: a `runs` control (`a cloud function` / `a workflow`) and a
name picked from what the backend actually has — `/admin/workflows` for functions,
`/admin/workflow-defs` for workflow definitions, filtered to *this* backend, because a
trigger pointing at another backend's workflow would 404 at fire time. Free text remains
available behind *Type a name…* for a function that is not deployed yet, and an
unresolved target is **flagged, not refused** — the fire-time error is untouched, and
author-time validation is an addition to it.

`isTargetResolved` answers `true | false | null`, and the third value is the point:
"we could not ask the backend" must not be reported as "it is not there". A wrong warning
about a working trigger is worse than no warning.

## The canvas — a view of a backend object, kept honest

The design constraint is one sentence: **a trigger is a backend object, and the canvas
draws a view of it.** Everything else follows.

- `kindFromTypeName` checks the trigger prefix FIRST and answers `undefined`, so a
  trigger is not a step to any of the code that asks what kind of step a node is —
  most importantly `toInput`, which walks every node on the canvas. Without that,
  a trigger would be written into the definition as a step of kind `trigger.webhook`
  and the backend would refuse the save.
- The nodes are added inside `buildGraph`, i.e. **before the document binds its dirty
  listener**, so a workflow does not open with unsaved changes because something
  triggers it. Redrawing them later is wrapped in a `redrawingTriggers` flag for the
  same reason.
- The node types are `singleton: true`, which `NodeGraphNode.canBeDeleted`/`canBeCopied`
  already read — so the canvas will not delete or copy one. The real actions are on the
  node's right-click menu, where the label names the backend.
- Positions are derived from the entry step's, and **not persisted**: a trigger has no
  `ui` field to save, and re-deriving is what keeps the picture consistent when a
  trigger is added from a different surface.

**Deliberate deviation from step 6, and the reasoning.** The spec asks for delete "from
the node". It is on the node's menu rather than on the canvas's delete key, because
canvas delete is local and undoable and deleting a trigger from a backend is neither —
putting an irreversible cross-process delete behind Cmd-Z's promise would be a lie about
what just happened. The confirmation says it removes a backend object and that a
webhook's secret goes with it.

**Adding a trigger from the canvas** opens the Triggers panel pointed at this backend,
over an `EventDispatcher` event, rather than growing a second creation form on a
Canvas2D surface that has no controls. §5's "the panel and the canvas agree" is enforced
structurally: both go through `models/triggers/TriggerBackendClient`.

### The defect adding these nodes caused

Exactly the F49 shape — a global structure grew a member every existing walker assumed
could not exist.

- **`workflowScope.upstreamSteps` offered a TRIGGER as an upstream step.** A trigger *is*
  upstream of the entry step on the canvas, so the `$path` picker listed it — and
  `{"$path": "upstream.trg_…"}` is a 400 from the backend, which is precisely the drift
  that module exists to prevent.
- **`syncEntry` had the mirror problem.** The trigger's wire made the entry step look
  like it had a predecessor, so deleting the entry step would have promoted the wrong
  one — or promoted the trigger itself.

Both are fixed and both are now specs. The existing WFA-004 spec that walks every node
and asserts six ids caught the first symptom immediately, which is why
`fromDefinition` now distinguishes **"not asked" from "nothing"**: the `manual` entry
marker is a positive claim that nothing triggers this workflow, and drawing it from an
unanswered question would be a lie the canvas tells confidently. `open()` always asks;
the pure conversion path does not.

## F47, folded in on Richard's call

Three panels describe another process's state, and the sidebar keeps an inactive panel
**mounted and hidden**. Each had an `activeChanged` refetch, which cannot help the case
that actually bites: the panel already open and in front of you when the backend starts.
There was no event to listen to.

`BackendManager.broadcastStatusChanged` now fires on create / start / stop / delete —
**and on an unexpected exit**, which was the state that was previously invisible: a
crashed backend left every panel still describing a running one. `ServiceSupervisor`
gained an `onUnexpectedExit` callback that fires only for a death nobody asked for
(`stop()` sets a `stopping` flag before signalling, so a deliberate stop is not reported
as a crash). One `useBackendStatusChanged` hook, three panels.

## Tests

- **`packages/nodegx-backend/tests/triggers-auth-and-input.test.ts` — 29 specs against a
  real running service with enforcement ON** (`devOpen: false`), because the
  "the exemption reaches nothing else" specs are meaningless when dev-open relaxes every
  gate anyway. All three transports, a wrong secret in each rejected with the *webhook's*
  message, the HMAC path untouched, `/admin/*` still unreachable, a request dressed as a
  hook, an admin token refused as a hook credential, and a hook secret refused everywhere
  else. Plus a 400 naming the key for every trigger type and for `target`, that a
  rejected create stores nothing, and that a full `GET` body round-trips through `PUT`.
- `tests/scheduler.test.ts` gained the payload delivery (through the real `CronScheduler`
  call site), the file round trip through a second `TriggerRegistry` — i.e. the boot
  path — and that a schedule with no payload still omits the key.
- **`packages/noodl-editor/tests/workflow/workflowtriggernodes.test.ts` — 24 specs**, most
  of them about the property that makes the drawing safe: a trigger node is on the canvas
  and invisible to everything that asks for steps. Including the two defects above.
- **Backend 66 suites / 715 (was 65 / 683). Editor 1791 specs / 0 (was 1767).** Editor
  typecheck clean.

## The live pass

Driven over CDP against the real SQLite backend on `:8578`, from the launcher. Fixture
left in place: workflow **Both Ways** (`wfa005BothWays`) with a webhook and a schedule
trigger, both targeting it.

| Criterion | Evidence |
|---|---|
| F47 — a panel notices a backend starting | Workflows panel read *"Start a backend to author workflows"*, the backend was started from the main process, and **2.5s later with no Refresh press** the same panel read *"SQLITE BACKEND · All Nine Kinds · Order Pipeline · Slow Job"* |
| A trigger created from the editor with `target.kind: 'workflow'` | Both created through the panel's own form. The `runs` control offered *a cloud function* / *a workflow*; choosing workflow offered the backend's four real definitions |
| The target comes from what the backend has | With no functions deployed the picker said *"No functions on this backend"* rather than showing an empty box; the workflow list came from `/admin/workflow-defs` |
| **All three transports authenticate** | Against the URL copied off the panel: `X-Webhook-Token` **200**, `Authorization: Bearer` **200**, `?token=` **200**. A wrong Bearer and an **admin token** both `{"error":"Webhook rejected: webhook token does not match"}` |
| The runs appear in the inspector | `/executions` shows three successful webhook runs with `body` = `{mode:'adhoc', via:'header'\|'bearer'\|'query'}`, and the two refusals recorded as errors — the loud-rejection behaviour the spec's trap says not to silence |
| A schedule carries a payload, unattended | The `*/2` schedule fired on its own: `body = {"mode":"nightly"}` |
| **The phase-19 exit clause** | One definition, two entry points, and the branch takes a **different route** for each: schedule → `nightly` success, `adhoc` skipped; webhook → `adhoc` success, `nightly` skipped. That comparison was impossible before F8, because a schedule had no way to say anything |
| Triggers as entry nodes | Both drawn left of the entry step, wires labelled `fires`, cards reading `Webhook · POST /both-ways` and `Schedule · every 2 minutes`; the definition saved back with four steps and no trigger in it |
| The webhook URL, with a copy button | `http://127.0.0.1:8578/hooks/backend_mkgmvdcayltzq/both-ways` and a Copy button in the property editor, beside the three transports named and the secret's non-recoverability stated |
| Enable/disable from the node → `GET /admin/triggers` | Disabled from the node: card became `Webhook · POST /both-ways · DISABLED`, `GET /admin/triggers` reported `enabled=False`, the hook itself answered `No enabled webhook "both-ways"`, and **the document stayed clean** — no definition changed |
| Opening does not dirty the workflow | `dirtyOnOpen: false` with two triggers drawn |

**One thing the screenshot caught that no test would have.** The property editor's header
chip appends the taxonomy key as if it were a category, so the webhook read
`WEBHOOK · POST /BOTH-WAYS · DATA`. The colour is `data` for its hue — a trigger is where
the run's data comes from — but "Data" is not what a trigger *is*, and the type label
already said what it is. `getNodeTypeChipInfo` gained a one-line opt-out
(`metadata.hideCategoryChip`) with the reasoning written down, because the general
problem is that the suffix names a colour and for most nodes the colour and the category
happen to be the same word.

### Driving notes, on top of WFA-004's

- **HMR breaks the webpack probe.** After a hot reload the chunk-push trick captured a
  `__webpack_require__` whose `R.c` did not contain the modules the running app was using
  — `byPath('WorkflowEditorService')` returned `null` while that service was demonstrably
  running. A **clean restart** is the fix; re-pushing a second probe chunk is not.
- `ed.selectNode` wants the node **view**, not the model or the id — it assigns
  `node.selected`, so passing a string throws
  `Cannot create property 'selected' on string`. Views come from `ed.forEachNode`, whose
  callback is still the truthy-return early-exit WFA-004 recorded.
- `ed.setPanAndScale` takes **one object** `{x, y, scale}`. Passing scale as a second
  argument leaves the zoom `undefined` and the toolbar reads **`NaN%`** — which looks
  exactly like a rendering defect and is not one.
- Launch with `setsid nohup … & disown`. A plain backgrounded `npm run dev:debug` inside a
  tool call dies with the call.

## Open items to hand on

| # | Item |
|---|---|
| a | **Editing a trigger's config from the canvas is not offered** — the rows are read-only and *Add a trigger…* opens the panel. Changing a cron means the panel. Defensible (a trigger is a backend object whose status the service rewrites), but it is the obvious next ask. |
| b | The Triggers panel still has no *edit* at all, on either surface: a wrong cron is delete-and-recreate, and for a webhook that mints a new secret. `PUT /admin/triggers/:id` exists and is tested; only the form is missing. |
| c | A `db-change` trigger has an entry node and a card, but its filter authoring is unchanged (explicitly out of scope). No `db-change` trigger was exercised live this pass. |
| d | The fixture left on the local backend: workflow `wfa005BothWays` (*Both Ways*) with two triggers. Delete it if the backend is being used for something else. |
