# WFA-008: Edit a Trigger's Configuration

## Metadata

| Field | Value |
|-------|-------|
| **ID** | WFA-008 |
| **Phase** | Phase 27 — Visual Backend Authoring (Track L) |
| **Tier** | 3 — the canvas and its panel |
| **Priority** | 🟠 High — the missing form makes the only available gesture (delete-and-recreate) destroy a webhook secret |
| **Difficulty** | 🟢 Low–Medium — the route exists and is tested; the care is in what a PUT must *not* change |
| **Estimated Time** | 2–3 days |
| **Prerequisites** | WFA-005 (the create form, the target picker, the entry nodes) |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus** — small surface, but it writes to a backend object other processes are also writing to |
| **Added** | 2026-07-28, on Richard's call, ahead of WFA-007 (F53) |

## Objective

Let an existing trigger's configuration be changed — its cron, its slug, its target, its schedule
payload — **without minting a new webhook secret**, from the editor, on the surface that already
holds the form that creates one.

## Background

WFA-005 built the create form, the target picker and the canvas entry nodes, and deliberately stopped
short of editing. Its own open items (a) and (b) name the consequence, and it is filed as **F53**:

> The Triggers panel still has no *edit* at all, on either surface: a wrong cron is
> delete-and-recreate, and for a webhook that mints a new secret. `PUT /admin/triggers/:id` exists and
> is tested; only the form is missing.

This is not a polish item, and that is why it comes before WFA-007. A webhook's secret is shown
**once**, at create time, and is not recoverable — `TriggerDef` carries no secret material and
`GET /admin/triggers` cannot return one. So today, fixing a typo in a cron expression costs the
operator every sender of that hook: they delete the trigger (which deletes its secret), create a new
one, and then have to go back to GitHub, Stripe or whatever else and re-paste a new secret. The
editor's only available gesture is destructive in a way the user is not told about until afterwards.

### The fact this feature rests on, verified rather than assumed

`TriggerRegistry.upsert` **keeps** an existing webhook secret. It mints only when none is stored for
that id, and it overwrites only when the caller actually sends `secret`:

```ts
// triggers/registry.ts — "Secret handling (webhook only)"
if (def.type === 'webhook') {
  if (input.secret) { …set…; mintedSecret = input.secret; }
  else if (!this.secrets.get(WEBHOOK_SECRETS_NAMESPACE, id)) { …mint…; }
}
```

Confirmed against the real registry rather than read off the page: a PUT that changes the name and the
target of a token-scheme webhook returned **no** `secret` in its response, left
`getWebhookSecret(id)` byte-identical to the value handed out at create time, and preserved
`createdAt`. That is the whole argument for the feature: an edit that keeps senders working is
something delete-and-recreate cannot promise.

### The three ways an edit *can* break a sender, and what each requires

| Change | Effect on senders | What this task must do |
|---|---|---|
| cron, missed-fire policy, payload, name, target | none | plain edit |
| `webhook.slug` | the URL changes — every sender 404s (`No enabled webhook "…"`) | say so before saving, at the field |
| sending `secret` | the secret is *replaced*; every sender's credential is stale | never a side effect of an edit; a separate, explicit **rotate** action that says it breaks every sender |

### Two things the probe found that the register did not know

**F58 — a PUT may change a trigger's `type`, and the secret survives the change.** `upsert`
reconstructs the definition from the input, so `{type: 'schedule'}` on a webhook's id is accepted:
the stored trigger becomes a schedule with no `webhook` block, and the secret stays in `secrets.json`
under that id, orphaned, because the secret block only runs for `def.type === 'webhook'` and only
`delete()` clears it. Morphing back to a webhook then **reuses the old secret** rather than minting —
so a webhook an operator believes they got rid of can come back, credential and all, without ever
being told. Observed, not deduced.

**F59 — `PUT /admin/triggers/:id` on an id that does not exist CREATES it.** `upsert` is a true
upsert and the route passes `ctx.params.id` straight in, so a PUT to a trigger that was deleted while
a form was open silently resurrects it under the same id — with a **new** secret (delete removed the
old one), a reset status, and a 200 reported to the caller as a successful edit. This is the concrete
version of the "the registry changed under you" hazard, and it is reachable from MCP's
`update_backend_trigger` too.

## Current State

| Piece | Where | State |
|---|---|---|
| `PUT /admin/triggers/:id` | `server/admin-triggers.ts` `update()` → `upsert` | Works; keeps the secret; **accepts a type change** (F58) and **creates on a missing id** (F59) |
| Write-path validation | `registry.ts` `validateTriggerInput` | WFA-005's; checks the caller's keys before anything is copied, and accepts-and-ignores `createdAt`, `updatedAt`, `status` **precisely so GET → edit → PUT round-trips** (specced in `tests/triggers-auth-and-input.test.ts`) |
| `enabled` on a PUT | `registry.ts` `upsert` | Omitted → the stored value is kept. Verified with a disabled trigger |
| `updatedAt` | `registry.ts` | Bumped by `upsert` and `setEnabled`; **not** by `recordFire`/`setNextFire`, which touch only `status` |
| IPC | `BackendManager.js:259-288` | `listTriggers`, **`getTrigger`**, `createTrigger`, **`updateTrigger`**, `setTriggerEnabled`, `deleteTrigger`, `fireTrigger` — complete |
| Renderer client | `models/triggers/TriggerBackendClient.ts` | `updateTrigger` is typed and has **zero callers**; there is no `getTrigger` |
| Panel | `views/panels/triggers/TriggersPanel.tsx` | Create form, target picker, test-fire / enable / delete per row. **No edit** |
| Canvas | `models/workflow/workflowTriggerNodes.ts`, `WorkflowDocument.triggerActions` | Read-only rows; enable/disable/delete + *Add a trigger…* on the node menu |
| MCP | `noodl-mcp` `update_backend_trigger` | Already exists — so the backend rules this task adds apply to agents too |

## Desired State

### 1. One edit form, in the panel, reachable from the canvas

A configured trigger's row offers **Edit**, which opens the same fields the create form uses,
prefilled. The canvas trigger node's right-click menu gains *Edit this trigger…*, which opens the
Triggers panel **pointed at that trigger** — the same shape as WFA-005's *Add a trigger…*, for the
same reason: the knowledge of which backend and which trigger stays in `WorkflowDocument`, and the
form is not duplicated onto a Canvas2D surface that has no controls.

The decision and the rejected alternatives are recorded in
[WFA-008-ASSESSMENT.md](./WFA-008-ASSESSMENT.md) §1 **before** any code, per WFA-004 §1 and
WFA-006 §7.

### 2. What an edit does not touch

- **`enabled` is never sent.** A disable that happened elsewhere — the canvas menu, MCP, another
  window — survives an edit, because `upsert` keeps the stored value when the key is absent. Enabling
  and disabling keep their own control, which is a single verb with its own route.
- **`secret` is never sent by the edit form.** Rotation is its own action (§4).
- **`status`, `createdAt` and `updatedAt`** ride along harmlessly if a whole `GET` body is PUT back —
  that exemption is WFA-005's and is specced. The form nonetheless sends only the fields it owns.

### 3. The registry changed under you

The form is opened from a **fresh `GET /admin/triggers/:id`**, not from the list snapshot the panel
rendered, and `updatedAt` from that read is kept as the concurrency token. On save, the trigger is
re-read: if `updatedAt` has moved, the PUT is **not sent** and the panel says what changed, in words,
offering to reload the form. A fire does not trip this, because `recordFire` does not bump
`updatedAt` — the token means "the configuration changed", not "something happened".

If the trigger is *gone*, the save must fail rather than recreate it (F59).

### 4. Rotating a webhook secret is a separate, explicit action

*Rotate secret* on a webhook's row, behind a confirmation that says plainly that **every existing
sender stops working** until it is given the new value, and which shows the new secret once with the
same never-recoverable wording the create path uses.

It must mint server-side rather than have the editor invent a secret: minting is the registry's job
and the format (`whsec_` + 24 random bytes, base64url) belongs in one place. `POST` a rotate verb
beside `/enabled`, and expose it through MCP-visible routes like every other trigger action.

### 5. F58 — a trigger's type is not editable

A webhook that becomes a schedule orphans secret material that a later change back silently reuses.
The type is therefore **refused on an update**: a different type is a different trigger, and the
message says so and names the two steps (create the new one, delete this one) rather than leaving the
caller to guess. Enforced in the registry, so the panel, the canvas and MCP get the same rule; the
form shows the type as a fixed label rather than a disabled dropdown pretending to be editable.

### 6. F59 — a PUT to an unknown id is a 404

In the route, not the registry: `upsert` is legitimately an upsert (the boot path and `POST` both use
it), and the HTTP verb is what carries the promise. `PUT /admin/triggers/:id` for an id the registry
does not hold answers **404** with the same message shape `GET` and `DELETE` already use.

## Implementation Steps

1. **Confirm the premise on a real registry** — the secret survives a cron/target change, a sent
   `secret` replaces it, `enabled` omitted is preserved — and paste the observations into the notes.
   Do this before writing a form for a path that only looks right.
2. **Record the §1 decision** in `WFA-008-ASSESSMENT.md`: where the form lives, what happens when the
   registry changes under you, and the walker audit (§4 below).
3. **Backend**: refuse a type change (F58); 404 a PUT to an unknown id (F59); add the rotate verb.
   Tests first — each of the three is a spec against a real service.
4. **Renderer client**: `getTrigger` (the IPC already exists) and `rotateTriggerSecret`.
5. **Panel**: the edit form, prefilled from the fresh GET, with the conflict check, the slug warning
   and the rotate action.
6. **Canvas**: *Edit this trigger…* on the node menu; `OpenTriggersSurfaceDetail` gains an optional
   `triggerId`.
7. **Cross-surface refresh**: an edit made in the panel must reach an open workflow canvas — including
   the case where the trigger's target moved to a *different* workflow, or to a function, and its
   entry node must therefore disappear.
8. **Docs**: `docs/runtime/TRIGGERS.md` gains editing, which changes break senders, and rotation.
9. **Live pass** in the running editor, with screenshots: create a webhook trigger, fire it, **edit
   its cron and its target**, and fire it again **with the original secret** to prove it still
   authenticates. That is the criterion this feature exists for and no unit test can give it.

## Success Criteria

- [ ] An existing trigger's cron, name, target and schedule payload can be changed from the editor.
- [ ] A webhook whose configuration was edited still authenticates **the original secret** — proven
      live with the hook itself, not by reading `secrets.json`.
- [ ] Changing `webhook.slug` warns that the URL changes and that senders will 404, before saving.
- [ ] *Rotate secret* is a separate action, says it breaks every sender, and shows the new secret once.
- [ ] A PUT that changes `type` is refused with a message naming the two-step alternative (F58).
- [ ] A PUT to an unknown id is a 404 and stores nothing (F59).
- [ ] A trigger changed on the backend between opening the form and saving it does not get silently
      overwritten: the panel says what changed and offers to reload.
- [ ] `enabled` is not resurrected by an edit — a trigger disabled after the form opened stays
      disabled.
- [ ] Editing a trigger's target from workflow A to workflow B removes its entry node from A's open
      canvas, and the definition is untouched (`dirty` stays false).
- [ ] Both suites green: editor `npm run test:ci`, backend `npm test`; editor typecheck clean.

## Out of Scope

- **`db-change` filter authoring.** Still WFA-005's out-of-scope item (c); the collection and actions
  are editable like every other field, the absent filter UI stays absent.
- **Editing the trigger's fields on the canvas itself.** Decided in the assessment, not omitted.
- **A trigger history / audit of who changed what.** BAK-009 owns `_Audit`; nothing in this task
  writes to it.
- **Changing a trigger's type in place.** §5 refuses it deliberately.
- **Recovering an existing secret.** It is not stored recoverably and this task must not imply it is.

## Traps

- **A trigger is a backend object the running service writes to.** `triggers.json` is rewritten with
  status between your read and your write, so an edit must send fields, not a whole file, and must not
  carry `status` back as if it were authoritative.
- **`validateTriggerInput` checks the caller's KEYS before anything is copied** (WFA-005/F8). A form
  that helpfully sends `undefined` for a field of another type, or sends `enabled: undefined`, is a
  400 naming a key the user never typed. Build the input, do not spread the form.
- **Omitting a type's config block is a 400, not "keep what is stored".** A PUT with no `webhook` was
  refused with `webhook.slug must match …` — the block is rebuilt from the input every time, so the
  form must be prefilled and must send it whole.
- **The secret is not recoverable and no surface may imply it is.** The canvas already says so
  (`workflowTriggerNodes.triggerParameters`); the edit form must not grow a `secret` field that shows
  a blank box next to the word "secret".
- **Audit every walker before assuming a panel change is only a panel change.** F49, F51 and F44 were
  all a shared structure growing a member an existing walker assumed could not exist. Here the
  structure is the set of trigger entry nodes: `refreshTriggers`, `refreshTriggerNode`,
  `addTriggerNodes` and `triggersForWorkflow` all draw from it, and a **re-targeted** trigger changes
  which workflow's canvas it belongs on at all.
- **HMR keeps the old class.** WFA-006's fix appeared not to work because `Ports.ts` had not
  hot-updated. Restart clean before concluding a fix failed.
- **`setsid` does not exist on macOS.** `nohup npm run dev:debug -- --quiet < /dev/null & disown`, and
  check `lsof -ti:9222` is empty first.
