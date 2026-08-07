# WFA-005: Triggers as Canvas Entry Nodes

## Metadata

| Field | Value |
|-------|-------|
| **ID** | WFA-005 |
| **Phase** | Phase 27 — Visual Backend Authoring (Track L) |
| **Tier** | 3 — the canvas |
| **Priority** | 🟠 High (carries two shipped defects, one of which blocks phase 19's exit criterion) |
| **Difficulty** | 🟡 Medium — the canvas half is small; the security-ordering defect needs care |
| **Estimated Time** | 1.5–2 weeks |
| **Prerequisites** | WFA-004 |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** — one auth-ordering fix in a security path, plus straightforward canvas and form work |

## Objective

Put a workflow's trigger on the canvas as its entry node, so the whole automation is one picture; let
a trigger target a workflow at all; and fix the two trigger defects the live test found.

## Background

### The trigger is invisible, and cannot point at a workflow

Triggers live in a separate panel reached through a local backend card's overflow menu. That panel
hardcodes its target kind (F9):

```ts
// TriggersPanel.tsx:44
target: { kind: 'function'; name: string };
// TriggersPanel.tsx:109
const def = { type: newType, target: { kind: 'function', name: target.trim() } };
```

The registry supports `kind: 'function' | 'workflow'` and WF-001 added the workflow target
deliberately — "a target kind, not a second dispatch path". The editor cannot express it. So the only
way to schedule a workflow today is the admin API or MCP.

The target is also free text with no validation. A live test created a trigger against a nonexistent
function; it was accepted with 201 and failed at the next fire with
`Trigger target function "…" not found on this backend`. Loud and correct at fire time, but the
mistake was made a minute earlier in a form that knew the function list.

### Two shipped defects

**F7 — a webhook secret sent as `Authorization: Bearer` can never authenticate.**
`webhook.ts` accepts that form and its own rejection message advertises it:

```
missing webhook token (X-Webhook-Token / Bearer / ?token=)
```

But `resolvePrincipal` runs for every request before routing
([`HttpServer.ts:1310`](../../../packages/nodegx-backend/src/server/HttpServer.ts#L1310)) and throws
401 for any `Bearer` that is not an admin credential
([`security/state.ts:220-224`](../../../packages/nodegx-backend/src/security/state.ts#L220)).
Observed live: `X-Webhook-Token` and `?token=` both ran the workflow; `Authorization: Bearer <secret>`
returned `{"error":"Unauthorized."}`. A third-party service that only sends Bearer cannot call a
NodeGX hook, and the error it gets does not mention webhooks.

**F8 — a schedule trigger silently discards a `payload`.** Posting
`schedule: {cron, missedFirePolicy, payload}` returned **201**, and the stored trigger contained only
`cron` and `missedFirePolicy`. Not rejected, not stored. The registry's own doctrine is the opposite:
"a trigger that silently no-ops is an automation that fails on a delay timer."

The consequence is that a scheduled run always receives `{trigger, triggerId, firedAt, cron}`, so one
workflow cannot serve both a webhook and a schedule — which is exactly what phase 19's exit criterion
asks for. WFA-003 gives the payload somewhere to land (`body`); this task gives it a way in.

## Current State

| Piece | Where | State |
|---|---|---|
| Trigger registry | `triggers/registry.ts` | `schedule \| webhook \| db-change`; targets `function \| workflow`; strict validation on load |
| `ScheduleConfig` | `registry.ts:46` | `{cron, missedFirePolicy}` only |
| Webhook verification | `triggers/webhook.ts:57-90` | `token` and `hmac-sha256`; HMAC verified correct live, including a rejected tamper |
| Principal resolution | `HttpServer.ts:1310`, `security/state.ts:207` | Runs before routing; Bearer → admin-or-401 |
| Admin routes | `server/admin-triggers.ts` | CRUD + `POST /admin/triggers/:id/fire` |
| Editor panel | `views/panels/triggers/TriggersPanel.tsx` | Works; function-only; free-text target |
| Editor IPC | `BackendManager.js:238-260` | list/get/create/update/setEnabled/delete/fire — complete |

Confirmed working live: cron fired every minute unattended, status recorded `lastFiredAt`,
`nextFireAt`, `fireCount` and `lastResult`, and all of it survived a service restart including the
webhook secret.

## Desired State

### 1. The trigger is the entry node

A workflow's canvas shows its trigger(s) as entry node(s) feeding the entry step:

- **Webhook** node shows its method and full URL (`POST /hooks/<backendId>/<slug>`), its scheme, and a
  copy button. The URL is the single most-wanted string in this whole feature and today it is
  assembled by hand from two panels.
- **Schedule** node shows its cron, a plain-English gloss ("every minute", "at 03:00 daily"), its
  missed-fire policy, and its next fire time.
- **DB change** node shows collection and actions.
- **Manual** — a workflow with no trigger still draws an entry marker, so "how does this start?" has a
  visible answer.

Enabled/disabled is visible on the node, and togglable from it. A disabled trigger that looks like an
enabled one is the failure this whole surface exists to prevent.

Triggers are backend objects, not part of the workflow definition. Drawing them on a workflow's canvas
is a **view**, and this task must be explicit about that: deleting the node deletes the trigger from
the backend, and a trigger targeting a function rather than a workflow still lives in the panel.

### 2. Triggers can target workflows

Everywhere a trigger is created or edited — panel and canvas — the target is `{kind, name}` with:

- a **picker** over what the backend actually has: `workflows.functions` from `GET /health` and the
  list from `GET /admin/workflow-defs`;
- free text still permitted, for a function that is not deployed yet, but flagged as unresolved
  rather than accepted silently;
- the existing fire-time error preserved. Author-time validation is an addition, not a replacement.

### 3. F7 — Bearer webhooks authenticate

The webhook route must verify its own credential before generic principal resolution rejects it.
Options, in preference order:

1. Exempt `/hooks/*` from `resolvePrincipal`'s Bearer branch, since that route family authenticates
   itself against a per-hook secret and has no use for an admin principal.
2. Have `resolvePrincipal` fall through rather than throw when the path is a hook route.

Not acceptable: removing Bearer from `webhook.ts`'s accepted forms. GitHub-style consumers aside,
plenty of services send only `Authorization`, and the message already promises it works.

Constraints:

- An **admin** Bearer must still be rejected as a webhook credential unless it is also that hook's
  secret. Do not create a path where the admin token can fire arbitrary hooks.
- Comparison stays timing-safe (`timingSafeStrEqual`).
- A test asserts all three token transports (`X-Webhook-Token`, `Bearer`, `?token=`) and that a wrong
  secret in each is rejected with the **webhook** message, not the generic one.

### 4. F8 — schedules carry a payload

`ScheduleConfig` gains an optional `payload` object, delivered as WFA-003's `body`. And more
generally:

- **An unknown key in a trigger config is a 400, not a silent drop.** The registry already validates
  strictly on load and rejects unknown keys in `schedule`; the create path evidently does not apply
  the same rule. Find the gap and close it for every trigger type — that is the actual defect, and
  `payload` was only how it was noticed.
- A test posts an unknown key to each trigger type and asserts a 400 naming it.

### 5. The panel and the canvas agree

Both surfaces write through the same IPC and the same validation. Whatever the canvas can express, the
panel can too, and neither has a field the other silently ignores.

## Implementation Steps

1. **Reproduce F7 and F8** against a running backend before changing anything, and paste the observed
   responses into `WFA-005-NOTES.md`. Both are one `curl` each.
2. **Fix F8's general case** (unknown keys 400) and then add `payload`. Order matters: adding the
   field first hides the class of bug.
3. **Fix F7**, with the three-transport test.
4. **Target pickers** in the panel, plus `kind: 'workflow'`.
5. **Trigger nodes on the canvas**, read-only first, then editable.
6. **Enable/disable and delete** from the node, with the delete confirmation saying it removes a
   backend object.
7. **Docs**: `docs/runtime/TRIGGERS.md` gains the payload field and states plainly which token
   transports work.
8. **Live pass**: create a webhook trigger from the canvas, copy the URL, fire it with `curl` using
   **each** of the three transports, and watch the run appear in WFA-002's inspector. Then a schedule
   with a payload, unattended, and confirm the payload arrives in `body`.

## Success Criteria

- [ ] A workflow's canvas shows its triggers as entry nodes with the webhook URL and the cron gloss.
- [ ] A trigger can be created from the editor with `target.kind: 'workflow'`.
- [ ] The target is chosen from what the backend actually has; an unresolved target is flagged at
      author time and still fails loudly at fire time.
- [ ] `Authorization: Bearer <webhook secret>` authenticates a hook; a wrong secret is rejected with
      the webhook message; an admin token cannot fire an arbitrary hook. All asserted by tests.
- [ ] A schedule trigger carries a payload and it arrives as `body` in the run.
- [ ] An unknown key in any trigger config is a 400 naming it, with a test per type.
- [ ] Enabling/disabling from the node is reflected in `GET /admin/triggers`.
- [ ] One workflow, one webhook trigger and one schedule trigger, both producing successful runs of the
      same definition — the phase-19 exit criterion clause that is unreachable today.
- [ ] `docs/runtime/TRIGGERS.md` states the working token transports.

## Out of Scope

- **New trigger types.** Three exist.
- **Redesigning `db-change` filter authoring.** The node shows collection and actions; the filter UI
  stays as it is.
- **Trigger-level rate limiting or retry policy.** BAK-009 owns rate limits; the loop-guard and
  missed-fire policies WF-005 decided stand.
- **Triggers for cloud functions on a canvas.** A function is not a workflow and has no entry node
  here; function-targeted triggers stay in the panel.

## Traps

- **`resolvePrincipal` is a security boundary.** Any exemption must be scoped to the hook route family
  by exact prefix, not by a substring match, and must not widen what an unauthenticated caller can
  reach. Write the test that tries to reach `/admin/*` through whatever exemption is added.
- **Webhook secrets are shown once and stored in `secrets.json`, not in `triggers.json`.** A canvas
  node must not imply the secret is recoverable. Rotation, if offered, mints a new one and says so.
- **The HMAC path is correct and was verified live** — a valid GitHub-style `X-Hub-Signature-256`
  ran the workflow and a tampered one was rejected. Do not refactor it while fixing the token path.
- **`triggers.json` is validated strictly on load and an invalid file refuses to start the service.**
  A new required field, or a stricter rule applied to stored data rather than to input, can stop an
  existing backend from booting. New strictness applies at the write path.
- **Trigger status is persisted back into `triggers.json`** (`lastFiredAt`, `fireCount`, …), so the
  file is written by the running service. A canvas that writes the whole file back can clobber status
  written between read and write.
- **A rejected webhook still produces an execution record** with the reason — good behaviour, and the
  inspector should show it. Do not "fix" it into silence.
