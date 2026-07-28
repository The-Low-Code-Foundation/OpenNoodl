# WFA-008 — Decisions, recorded before building

Following WFA-004 §1 and WFA-006 §7: the choice, the alternatives, and the reason — written down
before the code exists, so the reasoning can be argued with rather than reverse-engineered from a
diff.

**Spec:** [WFA-008-EDIT-A-TRIGGER.md](./WFA-008-EDIT-A-TRIGGER.md)

---

## §1 — Where the edit form lives

**Decision: one form, in the Triggers panel. The canvas gets a door to it, not a second form.**

The canvas trigger node's right-click menu gains *Edit this trigger…*, which opens the Triggers panel
pointed at that backend **and that trigger**, with the row already in edit mode. That is the same
shape as WFA-005's *Add a trigger on \<backend\>…*, deliberately.

### The three options

| Option | What it would mean |
|---|---|
| **(a) Panel only** | Edit lives beside create. The canvas offers a menu entry that opens it. |
| (b) Canvas only | The trigger node's property-editor rows become writable. |
| (c) Both | Two forms over one PUT. |

### Why (a)

1. **The form already exists, and it is the create form.** An edit is the same seven fields — type,
   target kind, target name, cron, missed-fire policy, payload, slug, scheme, collection, actions —
   prefilled. Building a second one guarantees the two drift, and the one that drifts is the one
   missing the field somebody added last (F8's `payload` is the worked example: it reached the create
   form and the registry, and nothing else, because nothing else existed).
2. **WFA-005 already made this call for creation, and its reason applies unchanged**: "adding one needs
   a form — type, cron or slug, scheme, target — and that form is the Triggers panel. The canvas asks
   for it rather than growing a second one on a Canvas2D surface that has no controls." Editing needs
   the same controls, including a JSON text field and a two-list target picker.
3. **The canvas rows are read-only by construction, not by omission.** `triggerParameters` renders
   *prose*: `enabled` is `"No — this trigger will not fire"`, `missedFires` is
   `"skip — missed windows are ignored"`, `secret` is a sentence about non-recoverability. Making
   those writable means a second parameter vocabulary — machine values beside the readable ones — on a
   node whose whole point is to be readable at a glance. The one row that is genuinely a value (`cron`)
   would be writable while the four around it are not, which reads as a bug either way round.
4. **A 400 from the registry is prose that needs somewhere to go.** The backend's refusals are the
   good part of this subsystem (`step "wait".params.duration must be a number > 0`,
   `webhook slug "bbb" is already used by trigger "trg_…"`), and the panel has an error banner that
   shows them verbatim. A Canvas2D property row has nowhere to put a three-line message.
5. **The gestures that stay on the node are the ones that are single verbs.** Enable, disable, delete,
   and now *edit* — each is one menu item that names the backend it changes. That division is already
   the canvas's rule for triggers and it does not need a new one.

Option (b) was rejected on 3 and 4. Option (c) was rejected because it is (b) plus a maintenance
promise; this repository's characteristic failure is half-wired duplicate surfaces (phase 27 exists
because of four of them), and two forms over one PUT is exactly that shape.

### What is given up, and why it is acceptable

Editing a cron takes one extra click (menu → panel) instead of typing into the row you are looking
at. In exchange the field you type into is the one that has the cron gloss, the validation and the
error banner — and there is exactly one description of what a trigger is in the editor.

## §2 — What happens when the registry has changed the trigger under you

**Decision: the form opens from a fresh `GET`, keeps `updatedAt` as its token, and re-reads before it
writes. A moved token means the PUT is not sent.**

A trigger is a backend object that at least four writers can change: this panel, the canvas node menu,
MCP's `update_backend_trigger` / `set_backend_trigger_enabled`, and the running service itself. Only
the last of those is benign, and it is benign for a specific reason worth stating:

```
upsert()     → updatedAt = now      (a configuration change)
setEnabled() → updatedAt = now      (a configuration change)
recordFire()  → status only         (something HAPPENED; the configuration is the same)
setNextFire() → status only
```

So `updatedAt` already means exactly "the configuration changed", and a trigger firing twenty times
while a form is open does not move it. That makes it a usable token with no new field and no version
column: the form remembers the `updatedAt` it read, and on save re-reads and compares. If it moved,
the panel says **what** changed — diffed field by field, so it reads *"it was disabled"* or *"its cron
is now `0 3 * * *`"* rather than a generic warning — and offers to reload the form. Nothing is sent.

Three supporting decisions fall out:

- **`enabled` is never sent.** `upsert` keeps the stored value when the key is absent (verified: a
  trigger disabled between create and PUT stayed disabled). So even in the race the conflict check is
  built to catch, an edit cannot silently re-enable a trigger someone turned off. The correctness does
  not depend on the check.
- **`secret` is never sent by the form.** Sending it *is* the rotate gesture, so an edit that carried
  it would rotate as a side effect. Rotation is its own action with its own confirmation (§3).
- **A save must not resurrect a deleted trigger.** `upsert` is a true upsert and the route passes the
  URL's id straight in, so a PUT to a trigger deleted while the form was open **creates it** — with a
  new secret, a reset status, and a 200. That is F59, it is reachable from MCP too, and it is fixed at
  the route (404) rather than defended against in the form: a form-level guard protects one caller,
  and the HTTP verb is where the promise lives.

Last-write-wins was the alternative and is what most CRUD panels do. It is rejected here because the
losing write is not a text field — it is a live automation, and the thing quietly reverted could be
"this hook was disabled because it was firing into production".

## §3 — Rotation is a verb, not a field

**Decision: a new route, `POST /admin/triggers/:id/secret`, beside `/enabled`.**

The registry already mints (`'whsec_' + crypto.randomBytes(24).toString('base64url')`) and already
knows a secret is webhook-only. Two things that must not happen instead:

- **The editor inventing a secret and PUTting it.** Then the format lives in two places and the
  weaker one wins the next time someone copies the pattern.
- **A `secret` field on the edit form.** A blank box labelled "secret" beside a trigger whose secret
  is unrecoverable reads as "type the existing one here", and submitting the form empty would either
  rotate silently or do nothing silently.

The action confirms with the consequence stated in the plainest available words — every existing
sender stops working until it is given the new value — and shows the new secret once, with the
create path's own wording about non-recoverability.

## §4 — The walker audit

The F49 / F51 / F44 shape — a shared structure grows a member every existing walker assumed could not
exist — has bitten this phase three times, so every reader of the trigger-node set was re-read before
building. **The structure here is not new; what is new is that a member can now change identity-
relevant fields in place.** That distinction is where the two real findings are.

| Walker | What an edit does to it | Needed |
|---|---|---|
| `triggersForWorkflow(all, id)` | Filters `kind === 'workflow' && name === id`. A **re-target** A→B makes a trigger leave A's set and join B's | ✅ correct as written — but only if something re-reads (see below) |
| `WorkflowDocument.refreshTriggers` | Compares the id SET; same set → patch each node, different set → rebuild. A re-target changes the set, so the node is removed from A | ✅ correct |
| `refreshTriggerNode` | Patches parameters, label and sub-label of the same node object | ⚠️ **wrote `node.parameters[x] = v` directly**, so nothing was notified — see (i) |
| `addTriggerNodes` | Re-derives position from the entry step; nothing persisted | ✅ correct |
| `WorkflowDocument.toInput` | `kindFromTypeName` answers `undefined` for a trigger, so no trigger reaches the definition | ✅ unchanged — an edit adds no node type |
| `workflowScope.upstreamSteps`, `syncEntry` | Already exclude trigger nodes (F51) | ✅ unchanged |
| `bindNode` | Returns early for trigger nodes, so a trigger's `parametersChanged` can never dirty the document | ✅ and it is what makes (i) safe |
| `ViewerConnection` `isWorkflowModelEvent` | Walks node → graph → component for the workflow prefix, so a trigger node's parameter event is dropped before it reaches the viewer | ✅ verified — this is F44's guard doing its job for a case F44 did not have |

**(i) A selected trigger node's property rows go stale after an edit.** `refreshTriggerNode` assigns
into `node.parameters` directly, so `parametersChanged` never fires; and the property editor does not
rebuild a row on that event anyway — which is precisely the defect WFA-006's live pass found in its own
`ref` row ("the old name beside the new name's answer"). `WorkflowTriggerInfoType` already reads
through `getParameter` (WFA-006's lesson landed), so it needs the same one-line subscription its
sibling has, and `refreshTriggerNode` needs to write through `setParameter` so there is an event to
subscribe to. Both are safe because `bindNode` ignores trigger nodes and the viewer guard drops the
broadcast.

**(ii) Nothing tells an open canvas that a trigger changed in the panel.** Today the only cross-surface
re-read is `WorkflowsPanel.refresh` — a button press or that panel becoming active. So editing a
trigger in the Triggers panel would leave the entry node drawing the old cron, and re-targeting one
away from the open workflow would leave a node standing for a trigger that no longer belongs to it.
Fixed the way WFA-006 closed F48 — **as a rule rather than per caller**: the write functions in
`TriggerBackendClient` are the one door every surface goes through (that is what §5 of WFA-005 bought),
so the broadcast belongs there, and `WorkflowDocument` listens. A caller cannot forget to announce a
change it made through the only door there is.

## §5 — F58: a trigger's type is not editable

**Decision: refuse it in the registry, not in the form.**

`upsert` reconstructs the definition from the input, so `{type: 'schedule'}` on a webhook's id is
accepted today. Observed consequences: the stored trigger loses its `webhook` block, the secret stays
in `secrets.json` orphaned (only `delete()` clears it), and morphing **back** to a webhook re-uses that
old secret instead of minting — so a hook an operator believes is gone can return, credential intact,
silently.

Clearing the secret on the way out was the alternative. It is worse: it makes type-morphing look
supported, and a webhook → schedule → webhook round trip would then hand out a new URL-compatible
secret while every sender still holds the old one — the exact failure this task exists to prevent,
arriving through a feature nobody asked for. A different type is a different trigger. The message says
so and names the two steps.

Enforced in the registry so the panel, the canvas and MCP get one rule; the form shows the type as a
fixed label, because a disabled dropdown is a promise that the thing is editable somewhere.
