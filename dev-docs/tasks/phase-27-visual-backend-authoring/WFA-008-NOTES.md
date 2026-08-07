# WFA-008 — Notes

**Status:** ✅ Complete. Every success criterion driven in the running editor and screenshotted; the
live pass found **two** defects in this task's own work, one of which destroyed a webhook secret.
**Spec:** [WFA-008-EDIT-A-TRIGGER.md](./WFA-008-EDIT-A-TRIGGER.md) ·
**Decisions:** [WFA-008-ASSESSMENT.md](./WFA-008-ASSESSMENT.md)

**Screenshots:** [screenshots/wfa-008/](./screenshots/wfa-008/)

---

## Step 0 — the spec, because there wasn't one

F53 was added to phase 27 on Richard's call ahead of WFA-007, with no spec file. It was written
first, from the register entry and WFA-005's open items (a) and (b), in the shape of the other seven —
and the assessment beside it, because the shape of this task is a decision (*where does the form
live?*) followed by a small amount of code.

## The premise, verified before a line was written

The feature exists because `TriggerRegistry.upsert` **keeps** an existing webhook secret. Read first
and then run against a real registry, because a form written over a path that only looks right is how
this phase's four cuts happened:

| Probe | Result |
|---|---|
| PUT changing name + target of a token webhook | **200**, response carries **no** `secret`, `getWebhookSecret(id)` byte-identical, `createdAt` preserved |
| PUT sending `secret: 'whsec_mine'` | the stored secret becomes `whsec_mine` — sending it **is** rotation |
| PUT omitting `webhook` | **refused**: `webhook.slug must match [a-z0-9]…` — the block is rebuilt from the input every time, so a form must prefill and send it whole |
| PUT omitting `enabled` on a **disabled** trigger | stays disabled — "absent means keep" |
| PUT with a clashing slug | refused, naming the other trigger |
| PUT changing `type` webhook → schedule | **accepted** — and the secret stayed in `secrets.json`, orphaned |
| …then schedule → webhook again | **re-used the old secret** rather than minting |
| PUT to an id that does not exist | **created it** |

The last three are new findings, filed as **F58** and **F59**, and neither is editor-only: MCP's
`update_backend_trigger` reaches both.

## What was built

**Backend** — three changes, each one a rule rather than a guard in the caller:

- **F58: a trigger's type cannot change.** Refused in `upsert`, so the panel, the canvas and MCP get
  one rule. Clearing the orphaned secret instead was rejected in the assessment §5: it makes morphing
  look supported, and a webhook → schedule → webhook round trip would then hand out a secret every
  existing sender is unaware of — the exact failure this task exists to prevent, arriving through a
  feature nobody asked for.
- **F59: `PUT /admin/triggers/:id` on an unknown id is a 404.** In the route, not the registry:
  `upsert` is legitimately an upsert (the boot path and `POST` both use it) and the promise belongs to
  the HTTP verb. Before this, saving a form over a trigger deleted meanwhile **recreated** it with a
  new secret and a reset fire count, and answered 200.
- **Rotation is a verb**: `POST /admin/triggers/:id/secret` mints server-side and returns the value
  once. Registered in BAK-009's audit vocabulary as `trigger.secret.rotate` — it is the entry an
  operator goes looking for when working integrations start failing at 14:06 — and its rate-limit
  class was reviewed rather than absorbed silently (the drift gate made that a deliberate act, which
  is what that gate is for).

**Editor** — the §1 decision in code: one form, in the panel, with a door from the canvas.

- `models/triggers/triggerEditing.ts` is pure and shared by both paths: `formStateFromDef`,
  `buildTriggerInput`, `describeTriggerChange`. The form is **built, not spread** — the registry
  checks the caller's keys before copying anything (F8), so a spread form would post `slug` on a
  schedule and earn a 400 naming a key the user never typed.
- `TriggerFormFields.tsx` renders the fields once for create and edit. That is what makes "one form"
  structural: a field added later cannot reach one path and miss the other.
- The form **never sends `secret`** (sending it rotates) and **never sends `enabled`** (absent means
  keep, so an edit cannot re-enable something someone turned off).
- It opens from a fresh `GET` and re-reads before it writes, comparing `updatedAt` — which works
  because a **fire does not move `updatedAt`** and a configuration change does. A conflict is reported
  field by field (*it was disabled*, *its cron is now …*) and nothing is sent.
- Changing a slug confirms first, saying the URL moves and the credential does not.
- The canvas trigger node's menu gains **Edit this trigger…**, opening the panel at that trigger.

## The walker audit found two things (assessment §4)

The structure was not new; what is new is that a member can now change identity-relevant fields in
place. Two consequences no existing reader handled:

1. **A selected trigger node's property rows went stale.** `refreshTriggerNode` assigned into
   `node.parameters` directly, so nothing was notified — and `WorkflowTriggerInfoType` had no
   subscription anyway. This is exactly the defect WFA-006's live pass found in its own `ref` row
   ("the old name beside the new name's answer"). Now written through `setParameter` and subscribed,
   which is safe in both directions and both were checked: `bindNode` returns early for trigger nodes
   so it cannot dirty the document, and `ViewerConnection`'s `isWorkflowModelEvent` guard (F44) drops
   the global broadcast before it reaches the viewer.
2. **Nothing told an open canvas that a trigger changed elsewhere.** The only cross-surface re-read
   was the Workflows panel's Refresh. Closed the way WFA-006 closed F48 — as a rule, not per caller:
   the write functions in `TriggerBackendClient` broadcast `TRIGGERS_CHANGED`, because since WFA-005
   §5 they are the one door every surface writes through, and `WorkflowDocument` listens (filtered on
   its backend). The case that only editing can produce is a **re-targeted** trigger: its entry node
   must leave workflow A's canvas entirely, which `refreshTriggers` already handles because it
   compares the id set — what was missing was anyone telling it.

## Tests

- **`packages/nodegx-backend/tests/triggers-edit.test.ts` — 13 specs against a real running service.**
  The headline one does not read `secrets.json`: it **fires the hook** with the original secret after
  the target and name changed, because "the value is still on disk" is a weaker claim than "the sender
  still gets a 200". Then the two changes that *do* break senders (slug moves the URL — old 404, new
  200 with the same credential; rotation — old **401**, new 200), F58 with the trigger still working
  afterwards (a refusal that half-applied would be the worse failure), F59 including a deleted trigger
  that cannot be edited back into existence, and the `updatedAt`-does-not-move-on-a-fire property the
  editor's conflict check depends on.
- **`packages/noodl-editor/tests/workflow/triggerediting.test.ts` — 27 specs.** What the form sends and
  does not (`secret`, `enabled`, `id`, `maxBodyBytes` all absent; only the chosen type's block), the
  conflict diff in words including the identical-definition case (a rotation moved `updatedAt` and
  changed nothing — saying "nothing changed" would deny what the timestamp says), and the canvas
  consequences: the card repaints, the parameter change notifies **without** dirtying the workflow,
  and a re-targeted trigger's node leaves the canvas with the definition untouched.
- **Backend 67 suites / 728** (was 66 / 715). **Editor 1851 specs / 0** (was 1823 — the extra spec
  above 1850 is the one the live pass earned). Editor typecheck clean.

## The live pass

Driven over CDP against the real SQLite backend on `:8578`, from the launcher, in the `VerifyFix4`
project. **Zero `renderer:exception` lines** across the session.

| Criterion | Evidence |
|---|---|
| An existing trigger's configuration can be changed from the editor | Cron `0 3 * * *` → `*/30 * * * *` in the row's form; the stored definition, the node's `cron`/`when` parameters and the card all followed, and the card read **`Schedule · every 30 minutes`** ([06](./screenshots/wfa-008/06-cron-edit-form.png)) |
| **The edited webhook still authenticates the ORIGINAL secret** | The hook was fired **before** the edit (200, ran *Both Ways*), then re-targeted to *Order Pipeline* from the canvas node's *Edit this trigger…*, then fired again **with the same secret**: `X-Webhook-Token` **200**, `Authorization: Bearer` **200**, a wrong secret **401** with the webhook's own message. `/executions` shows it: same URL, same credential, *Both Ways* before and **Order Pipeline** after |
| The edit survives a backend restart | The editor was restarted mid-pass; `GET /admin/triggers` still reported `target: orderPipeline` |
| The canvas is a view that keeps up | Creating a trigger in the panel replaced the manual marker with its entry node **with no Refresh press**, and the document stayed clean ([03](./screenshots/wfa-008/03-created-secret-and-node.png)) |
| **A re-targeted trigger leaves the canvas it no longer belongs to** | Saving the retarget removed the entry node from *Both Ways* and restored the manual marker; opening *Order Pipeline* drew it there ([05](./screenshots/wfa-008/05-retargeted-node-left-canvas.png)). `dirty: false` throughout, and the definition was never touched |
| Changing the slug warns before saving | The form said *"⚠ The URL will change to /hooks/…/wfa008-moved — anything still posting to /hooks/…/wfa008-hook will get a 404"*, then the confirmation added that the credential does not change. After saving: old URL **404** (`No enabled webhook "wfa008-hook"`), new URL **200 with the same secret** ([09](./screenshots/wfa-008/09-slug-warning.png)) |
| Rotation is separate, explicit, and breaks senders | *Rotate secret…* confirmed with *"Every sender using the current secret STOPS WORKING the moment this happens"*; the new secret was shown once. Old secret **401**, new secret **200** ([08](./screenshots/wfa-008/08-rotated-secret.png)) |
| **The registry changing under an open form is reported, not overwritten** | Cron edited to `15 4 * * *`, then the trigger was disabled from another surface. Save answered *"This trigger changed on SQLite backend while you were editing it: • it was disabled … Nothing was saved."* and the stored cron was still `*/30` ([07](./screenshots/wfa-008/07-conflict-banner.png)) |
| An edit does not re-enable what someone turned off | Pressing Save a second time wrote the cron **and left `enabled: false`** — the card read `Schedule · at 04:15 daily · DISABLED`. Structural, not defensive: the form never sends the key |
| F58 live | `PUT` with `type: schedule` on the webhook → **400** naming the two-step alternative; the webhook still answered 200 with its secret afterwards |
| F59 live | `PUT /admin/triggers/trg_does_not_exist` → **404** *"it may have been deleted. Nothing was changed."*, and nothing was stored |
| The canvas door | The trigger node's menu reads *Edit this trigger… / Disable this trigger / Delete this trigger from SQLite backend… / Add a trigger on SQLite backend…* ([02](./screenshots/wfa-008/02-node-menu.png)) |
| Delete still says what it does | *"This removes a backend object, not a piece of this workflow… a webhook's secret goes with it"*, then the manual marker returned |

### The two defects the pass found — both in this task's own work

**1. Creating a trigger destroyed its one-time secret.** The redraw this task added worked *too*
well: `ModelBindings`' `nodeAdded` handler **selects** a newly added node unless told not to, and
selecting switches the sidebar to the property editor. The Triggers panel is a *transient* panel, so
switching away unmounts it — taking the banner holding the webhook's unrecoverable secret with it, one
tick after it was created. Observed exactly that: `active: "PropertyEditor"`, no secret anywhere on
screen, the trigger created. Fixed by passing `disableSelect: true` from `addTriggerNodes`: a trigger
node appearing is a redraw of a view, never the user creating a node.

**2. And then it happened again through the other half of the redraw.** With the selection fixed, the
panel switched to **Components** instead: `rebuildTriggerNodes` *removes* the manual marker, and the
`nodeRemoved` handler calls `clearSelection()` unconditionally → `hidePanels()` → the `components`
fallback. So removing a node **nobody had selected** was tearing down an unrelated panel. Fixed at
that handler, which is the general statement of it: the panels are hidden only when the node that was
removed was the selected one.

Both are the WFA-005/006 shape from a new angle — *a redraw must not disturb what the user is doing* —
and neither is visible to a unit test of the panel or of the graph, because the damage is in a third
place (the sidebar). A spec now asserts the first as an invariant (`disableSelect` on every trigger
node added); the second is verified live only, and is recorded here as such.

### Also worth knowing

- **The create form's target dropdown briefly read *Type a name…* on a fresh form**, because the
  edit-form logic (a stored name the picker cannot offer must stay editable) treated an *empty* pick
  the same way. Caught in the pass, fixed, and re-verified: a new form reads *Choose a function…*.
- **The cross-surface redraw covers the editor's own surfaces, not an out-of-process writer.** The
  broadcast is on `TriggerBackendClient`'s write functions, so a trigger deleted by MCP or `curl`
  leaves the canvas stale until the Workflows panel is refreshed — observed deliberately, by deleting
  through raw IPC. Filed below.

### Driving notes, on top of WFA-004/005/006's

- **A click at `NaN` leaves the project.** A helper that read a button's box and clicked it *in two
  steps* dispatched at `NaN,NaN` when the box came back `null`; the editor left `VerifyFix4`, landed on
  the launcher and opened **Agent Chat Example**, which rewrote `project-examples/agent-chat/project.json`
  (the known launch trap). Reverted after quitting. The helper now refuses to click a missing element —
  worth keeping: `clicktext.sh` in this session's scratchpad.
- **`window.confirm` is a native modal**, so a dispatched click on a button behind one would hang the
  eval. Stub it (`window.confirm = (m) => { record(m); return true; }`) and assert the recorded text —
  which is better evidence than a screenshot of a dialog anyway.
- **Two forms are on screen at once** (Add a trigger, and the row being edited), so
  `document.querySelector('[aria-label=…]')` finds the *create* form's control. Take the **last**
  match. This is the F34 hidden-but-mounted shape with both copies visible.
- The two selects that had no `aria-label` now have one (`Trigger type`, `Missed fires`) — driving a
  form by index is how a pass ends up asserting the wrong control.
- **HMR did not take on `TriggerFormFields.tsx`**: the module hot-updated and the running app kept the
  previous render. Restart clean before concluding a UI fix failed (WFA-006's trap, third sighting).

## Open items to hand on

| # | Item |
|---|---|
| a | **An out-of-process write does not reach an open canvas.** MCP or `curl` changing a trigger leaves the entry nodes stale until the Workflows panel refreshes, because the broadcast lives on the renderer's write door. A backend-side signal (SSE from `ChangeBus`, which BAK-001 and WF-005 already share) would close it for every surface at once — worth doing when something else needs the same thing, not for this alone. |
| b | **The panel-hide fix is verified live only.** `ModelBindings` needs a real `NodeGraphEditor` to exercise, and the editor suite has no harness for one; the invariant that trigger nodes are added with `disableSelect` *is* specced. If a canvas-view harness ever appears, this is a case for it. |
| c | **The `db-change` filter is still unauthored** (WFA-005's open item (c), unchanged). Its collection and actions are editable like every other field. |
| d | No fixture left behind: both triggers created during the pass were deleted, and the local backend on `:8578` is back to **zero triggers** and its four workflow definitions. |
| e | Pre-existing and not mine, seen while linting the files this task touches: `WorkflowTypes.ts` has 4 `react/no-children-prop` errors and `ModelBindings.ts` one unused `e`. `noodl-mcp`'s `tools.test.ts` (`create_component` → `validate_project`) fails on a clean tree too — confirmed by stashing. |
