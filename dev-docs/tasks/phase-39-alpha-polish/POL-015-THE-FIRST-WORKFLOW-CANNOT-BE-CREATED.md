# POL-015 — The first workflow on a backend cannot be created

Found on 2026-08-03 while setting up the fixture **POL-009** needed. POL-009's criteria all begin
"pin a run on a workflow canvas", so the first thing that session did was press `+` in the Workflows
panel. It has never worked.

Not reported by Richard — his hour with the editor did not reach the Workflows panel. It is a
first-run blocker, so every new user meets it and nobody who already has a workflow ever will.

## What happens

Workflows panel → `+` → type a name → **Create**:

> Creating failed.
> Error invoking remote method 'backend:workflow-step-kinds': Error: Backend must be running to read
> the step-kind catalog

The backend *is* running. The panel is asking the wrong one — it is asking for the step-kind catalog
of a backend whose id is the empty string.

## The mechanism — confirmed

```ts
// WorkflowsPanel.tsx:215
const backendId = newBackendId || workflows[0]?.backendId || '';
```

Three sources, and with zero workflows all three are empty:

- `newBackendId` is set only by a `<select>` that renders under `{backends.length > 1 && …}`
  (`WorkflowsPanel.tsx:337`).
- `backends` is derived **from the workflows themselves**:
  `[...new Map(workflows.map(w => [w.backendId, w.backendName]))]` (`:229`).
- `workflows[0]` does not exist.

So `backends` is empty → no picker → `newBackendId` stays `''` → `backendId` is `''` →
`WorkflowDocument.create` → `backend:workflow-step-kinds` → `requireRunning('')` throws.

**The list of backends you can create a workflow on is computed from the workflows that already
exist on them.** With one workflow it works, with two backends it offers a choice, with none it
cannot offer anything — and the panel's own empty state ("*No workflows on this backend yet. Use +
above to make one.*") points straight at it.

## What to build

**Slice 1 — get the backend list from the backends.** `useLocalBackends` already supplies exactly
this to `BackendServicesPanel`, names and running state included. The create form should offer the
*running local backends*, not the backends inferred from existing workflows, and default to the
project's active one.

Keep `workflows[0]?.backendId` as a fallback if it earns its place, but it must not be the only
source. Note this also fixes a quieter half of the same bug: with exactly **one** backend that has
workflows and a **second** backend that has none, the picker does not render at all
(`backends.length > 1`), so a workflow can only ever be created on the first.

**Slice 2 — do not offer a create that cannot work.** A stopped backend cannot answer for its
step-kind catalog. Either disable those entries with the reason, or start the backend as part of
creating. Decide, do not leave it to the error.

**Slice 3 — the error banner is sticky.** After the failure the red text stayed put through a
successful Refresh and through the workflow appearing in the list. Clear `status` when the next
action succeeds.

## Criteria

1. On a project with a running local backend and **zero** workflows, `+` → name → Create makes a
   workflow, on that backend.
2. With two local backends and workflows on only one, the picker offers both.
3. A stopped backend either is not offered or is started; no user reaches "Backend must be running".
4. A successful refresh or create clears a previous failure message.
5. Verified in the running editor from a project that has never had a workflow.

## Traps

- The workaround this session used — `POST /admin/workflow-defs` straight at the backend — makes the
  panel list the workflow correctly, so **the list, open, save, run and pin paths are all fine**.
  Only creation is broken. Do not widen the fix.
- Opening a component from the Components panel **closes** an open workflow document rather than
  leaving it in a tab, and the tab-history `‹` skipped past it. Getting back to a workflow means
  reopening it from the Workflows panel. That is its own question (phase 37 owns tabs) and is not
  part of this task, but it will shape how you drive the verification.
