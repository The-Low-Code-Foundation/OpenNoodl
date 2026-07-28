# Phase 27 — what is left, and what each piece needs

**Written 2026-07-28, after WFA-008.** The findings register in
[PROGRESS.md](./PROGRESS.md) says *what is wrong*; this file says *what closing each one takes*, so an
unowned row is a decision waiting rather than a paragraph nobody can act on. Every item was
re-verified on the date given, by running the check named — none of it is quoted forward from an
older note.

Sizes are honest estimates for someone who has not seen the code: **S** ≈ half a day, **M** ≈ 2–4
days, **L** ≈ a week or more.

---

## Scheduled

| # | What | State |
|---|---|---|
| **WFA-007** | AI proposes workflows onto the canvas | ⬜ Specced, not started — [WFA-007-AI-PROPOSES-ONTO-CANVAS.md](./WFA-007-AI-PROPOSES-ONTO-CANVAS.md). The last task of the phase as scoped. Adds **no AI capability**; it adds a review surface for what the MCP tools can already author |

## Proposed, needs a call

| # | What | Size | The call to make |
|---|---|---|---|
| **WFA-009 / F27** | A cloud function cannot return a value: a Response node's `pm-<name>` ports have not existed since WF-007 deleted the cloud runtime's editor client | **M** | **Does this join phase 27 (7 / 9) or go elsewhere?** It is authoring substrate rather than a canvas surface, but nothing else in the plan owns it, and phase 27's whole thesis is that cloud functions are authorable again. Spec written: [WFA-009-RESPONSE-NODE-PORTS.md](./WFA-009-RESPONSE-NODE-PORTS.md) — mechanism re-verified from source 2026-07-28, including the correction that the exporter is **not** the fault |

## Unowned findings, and what each needs

### F36 — the cloud node library gate is red, and was before this phase

**Verified 2026-07-28:** `npm run cloud-library:check` reports
*"Stale cloud node library: … does not match the cloud registry. Run `npm run cloud-library:generate`
and commit the result."* WFA-002 already established it was red on a clean `cline-dev` (by stashing),
so this is not anyone's uncommitted work.

**Size: S.** What it needs: run the generator, **diff the result and say what changed** — the point of
the gate is that a silent regeneration is how a node type quietly appears or disappears from the
picker — then commit it on its own. If the diff is large or surprising, that is a finding, not a
formality.

**Do it before WFA-009** if (a) is chosen there, because that task will regenerate this file anyway
and a stale baseline would hide its real diff.

### F26 — every name prompt is an 8-line code editor

**Verified 2026-07-28:** `StringInputPopup.tsx` still renders a line-number gutter and the placeholder
`// Add your comment here...` (`:55-62`). It is a faithful port of a legacy *comment* template, reused
by component creation, component ports, `PropListType` and `StringListType` — so **"New component
name" is an eight-line code box**, and it is the first thing a user meets when creating a cloud
function.

**Size: S–M.** What it needs: a `multiline` (or `variant`) prop, defaulting to the single-line form,
with the code-editor treatment kept for the one caller that is genuinely a comment. The care is in the
call sites, not the component: four of them, each with its own placeholder, and one of them is the
comment node whose current appearance is correct.

**Owner suggestion:** whoever next does an editor-UX pass (PLAT-005's family), not a backend task.

### F37 — a doubled workflow name in schedule-triggered executions

`countOrdercountOrderss` in the execution list. Cosmetic, from the WF-005 trigger path.

**Size: S.** What it needs: find the one place a name is composed twice (the trigger dispatcher's
execution record vs. the engine's), and a spec that fires a schedule and asserts the name. It has
survived three tasks that read this list, so it is not blocking anything — but it makes the inspector
look untrustworthy, which is the surface WFA-002 exists to make trustworthy.

### F55 — the TSFixme / `any` ratchet is red, with a baseline 48 commits stale

**Still open, and deliberately so.** WFA-006 measured `TSFixme +16 / any +9` against a baseline pinned
at `b22cfab0`; it then removed twelve copies of the same three-line `ipcRenderer` cast, taking `any`
**below** the baseline, and left TSFixme at **+14**.

**Size: S to re-pin, M to do it honestly.** What it needs, in order:

1. **A clean tree.** The gate writes every uncommitted `.ts/.tsx` file into the baseline as if it were
   part of that commit — WFA-006's notes record the ratchet warning about 31 files from a concurrent
   session, including deletions. As of 2026-07-28 the tree still carries another session's work
   (`Logo.tsx`, `Icon.tsx`, `EditorTopbar.tsx`, the app icons, `main.js`, `package.json`), so this
   cannot be done today.
2. **Someone who can say which of the remaining 14 markers are intended.** PLAT-004's rule is that the
   baseline is raised *deliberately and said so*, not laundered. A marker that is a genuine escape
   hatch stays and is documented in [TYPE-ESCAPE-HATCHES.md](../../reference/TYPE-ESCAPE-HATCHES.md);
   one that is a to-do gets fixed or filed.
3. **A commit of its own**, touching only `.tsfixme-baseline.json`, so the diff is readable as the
   decision it is.

Until then the gate is red for everyone, which is its own cost: a red gate that is always red stops
being read.

### F57 — a property-panel checkbox does not respond to a dispatched click

The Request node's *Allow Unauthenticated* toggle reports a real 32×19 rect and a real
`<input type=checkbox>`, and `Input.dispatchMouseEvent` at its centre changed nothing (WFA-006,
observed live). **Not workflow-specific** — `PropertyPanelCheckbox` is used by every node type.

**Size: S to diagnose, unknown to fix.** What it needs first is one question answered: **is it broken
for a user, or only for a synthetic click?** A human click may work fine, in which case this is a
driving note rather than a defect — and every future live pass needs to know which. Until someone
clicks it by hand, it is filed as unknown rather than as a bug.

### F61 — an out-of-process write does not reach an open canvas

**New in WFA-008, accepted rather than fixed.** The `TRIGGERS_CHANGED` broadcast lives on
`TriggerBackendClient`'s write functions, which is the right place for the editor's own surfaces — but
MCP or `curl` changing a trigger leaves the entry nodes stale until the Workflows panel refreshes.
Observed deliberately during the live pass, by deleting through raw IPC.

**Size: M, and worth waiting for company.** What it needs is a backend-side signal, not another
renderer broadcast: BAK-001's `ChangeBus` and its SSE transport already exist and WF-005 is its second
consumer, so a `triggers`/`workflows` topic on that bus would close this for *every* surface and every
writer at once. Doing it for triggers alone would be a third tap on the same idea — the phase's own
"reuse or escalate" rule says wait until a second consumer needs it (a workflow definition edited by
MCP has exactly the same staleness).

**Meanwhile it is not silent:** the Workflows panel's Refresh re-reads triggers deliberately, and
`backend:statusChanged` (F47) already covers a backend starting, stopping or dying.

### F60(b) — the panel-hide fix is verified live only

WFA-008 fixed two halves of the same defect; the first (a trigger node never claims the selection) is
specced as an invariant, the second (removing an *unselected* node does not tear down the panels) is
verified live only, because `ModelBindings` needs a real `NodeGraphEditor` and the editor suite has no
harness for one.

**Size: M**, and it is really a request for a *harness*: a headless `NodeGraphEditor` over a
`NodeGraphModel` would make this and the whole selection/panel policy testable. Worth doing the next
time a task needs to assert canvas-view behaviour — three tasks in this phase have wanted it.

---

## What is deliberately not here

- **Durable / resumable workflow runs** — WF-001's headline residual, explicitly out of phase 27's
  scope and unchanged by it.
- **DEP-002 / DEP-005 promotion of workflows to a production backend** — a phase-26 conversation, as
  recorded in WFA-004's decision on where workflows live.
- **`db-change` filter authoring** — out of scope since WFA-005 and still out; the collection and
  actions are editable, the filter is not.
