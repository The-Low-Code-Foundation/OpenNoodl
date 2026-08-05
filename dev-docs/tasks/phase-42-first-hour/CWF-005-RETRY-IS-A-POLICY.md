# CWF-005 — Retry is a Call Function wearing a different hat

**From:** [TALK-001](TALK-001-THE-CLOUD-WORKFLOW-AUDIT.md) Pile 1.5 + **Q7, decided 2026-08-05**:
fold Retry into Call Function as a policy group and delete the standalone kind.
**Status:** open, unowned. Sequence after [CWF-001](CWF-001-CALL-FUNCTION-PARAMS.md) — the fold
changes call-function's param list, and doing both at once beats migrating twice.

## The mechanism, exactly

`retry` takes `REF_PARAM` and `invokesFunction: true`
([kinds.ts:323-367](../../../packages/nodegx-backend/src/workflow/steps/kinds.ts#L323-L367)). It
*is* a call-function with backoff — it does not wrap a neighbouring step, it replaces it. On the
canvas that reads as "a retry card that mysteriously needs to know a function name", and the author
who wants to retry an existing Call Function has to delete it and rebuild it as a Retry.

Two of its seven knobs also lie in their descriptions:

- **`maxAttempts` includes the first attempt.** `1` means "no retries" and is accepted in silence
  ([kinds.ts:335](../../../packages/nodegx-backend/src/workflow/steps/kinds.ts#L335) — the text
  does say "including the first", but the *name* says otherwise and the name is what people read).
- **`retryOnStatus` silently inverts the semantics.** Unset = retry any failure; set = retry
  **only** those statuses, so adding `503` to be helpful makes every other failure fail immediately
  ([kinds.ts:350-356](../../../packages/nodegx-backend/src/workflow/steps/kinds.ts#L350-L356)).
  The description says it; the field does not feel like it.

## Slices

**S1 — Presentation fixes, shippable alone and immediately.**
- Rename the displayed label to make the arithmetic obvious — `maxAttempts` → "Total attempts
  (including the first)", and validate `1` with a *warning* that says "1 means no retry".
- Reword `retryOnStatus` as an allow-list in the label itself: "Retry only these statuses (leave
  empty to retry any failure)".
- A **backoff preview line** in the property panel: given the four numbers, render the actual delay
  sequence ("1s, 2s, 4s — 3 attempts over 7s"). This is the fix that makes the seven knobs stop
  being seven knobs. Jitter shows as a range.

**S2 — The fold.** Move the six retry params onto `call-function` as a **policy group** (a
collapsed section in the property panel; the group is off until `maxAttempts` > 1). The executor
path is unchanged — it already knows how to invoke with backoff; it now reads the policy off the
call-function step.

**S3 — Migration.** Existing `retry` steps in saved workflow definitions become `call-function`
steps with the policy set. ⚠️ Retry's output includes `attempts` and `retried`
([kinds.ts:359](../../../packages/nodegx-backend/src/workflow/steps/kinds.ts#L359)) — a downstream
`$path` into `previous.attempts` must keep resolving, so call-function's output gains those two
fields **when the policy is active**. Migrate on read (definitions are JSON on disk/in the DB), and
keep the reader accepting `kind: "retry"` forever — a deployed backend may hold old definitions.

**S4 — Delete the kind** from the catalog and picker, bump `STEP_KIND_CATALOG_VERSION`, update
`docs/runtime/WORKFLOW-NODES.md`, and tell MCP: an agent that has learned `retry` will keep writing
it, so the write path must accept-and-migrate rather than reject.

## Done when

- The picker has eight kinds, not nine, and Call Function has a Retry policy section.
- A saved workflow authored with the old `retry` kind opens, runs, and retries — driven live, not
  asserted from a unit test.
- The backoff preview matches the observed delays in a real failing run.
- `noodl-mcp` suite green (it is a gate).

## Traps

- ⚠️ **A declared `default` never runs its setter.** Retry's defaults (`3`, `1000`, `2`, `60000`)
  live in the catalog and are applied by the executor's own fallbacks — check which, before moving
  them, or the fold quietly changes every existing retry's behaviour.
- ⚠️ Backoff waits are cancellable today ([kinds.ts:362-363](../../../packages/nodegx-backend/src/workflow/steps/kinds.ts#L362-L363)).
  Whatever the fold does, cancelling a run must still abort the wait rather than sleeping it out.
- The validator's `case 'retry'` ([kinds.ts:669-683](../../../packages/nodegx-backend/src/workflow/steps/kinds.ts#L669-L683))
  moves to `case 'call-function'`, which currently has **no case at all** — CWF-001 adds one. Land
  them in that order.
