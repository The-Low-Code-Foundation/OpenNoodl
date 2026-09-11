# SB-003 — A helper is not an endpoint

**Status: ✅ DONE s1 (2026-08-26), not driven** (the boundary is specced over real HTTP; SB-008's
drive exercises it in the running app). Findings 1–2 of the phase README §3.
Naming/UI legibility of function-vs-component is phase-43's — coordinate, don't absorb.
🧭 **D3 still open** (does this land in 0.2.1) — the change is committed on `cline-dev`; whether it
rides the release is Richard's call.

## The defect, located (map verified s1 against the working tree)

A cloud *function* is a `/#__cloud__/` component **with a `noodl.cloud.request` node**; a helper is
one without. The editor knows this (`ComponentIcon.ts:11-29`, `componentpicker.ts:119-127`). The
backend does not:

- `WorkflowRunner.hasFunction()` (`nodegx-backend/src/workflow/WorkflowRunner.ts:641-648`) matches
  on name only. A helper passes it, gets a full per-request instantiation, then the CloudRunner
  rejects at `noodl-viewer-cloud/src/index.ts:316` ("Could not find request node"), which unwinds
  to a **500** at `WorkflowRunner.ts:587` — and writes a *failed execution record* (`:571-576`) for
  a call that was never a legitimate endpoint.
- `getAvailableFunctions()` (`WorkflowRunner.ts:681-692`) is prefix-only, so
  `GET /admin/permissions/functions` (`admin-security.ts:209-260`) lists every helper as a function;
  `effectiveFunctionRule` (`security/model.ts:587-597`) then presents it as an
  authenticated-callable endpoint, and `getStatus()` (`:694-700`) advertises it too.
- The irony: `functionAllowsNoAuth()` (`:655-667`) **already walks the graph** with
  `findRequestNode()` (`:669-680`) on this exact code path — the data to exclude helpers is
  computed and then flattened into "not public" instead of "not a function".

All four dispatch paths funnel through those two methods: `run()` (:492), `invokeFunction()`
(:607), `triggers/dispatcher.ts:189`, `StepExecutor.ts:208`, plus the admin listing. One fix, four
consequences.

## The fix (s1)

Build a function index at load time — `loadWorkflows()` (`:363-384`) and `loadWorkflow()` (`:424`)
already hold the parsed bundles, and both already use build-candidate-then-swap (`:456-459`). A
`Map<functionName, { workflow, allowNoAuth }>` derived by walking each bundle's components with
`findRequestNode`. Then:

- `hasFunction` = map lookup → helpers 404 identically to nonexistent names (no existence leak).
- `getAvailableFunctions` = map entries → helpers vanish from the permissions listing and status.
- `functionAllowsNoAuth` collapses into the same lookup (drops an O(nodes) walk per HTTP request).

## Acceptance

1. `POST /functions/<helper>` → **404**, same body shape as an unknown name; **no execution record
   written**. The existing fixture is the proof: `cloud-run-tasks-loop.test.ts:37-68` ships
   `/#__cloud__/helpers/registerOne` (helper) beside `/#__cloud__/bulkRegister` (function).
2. A workflow step calling a helper → `StepExecutionError` 404, not 500.
3. `GET /admin/permissions/functions` lists functions only; `bulkRegister` (known-firing control)
   still listed, `helpers/registerOne` absent. Same for `getStatus()`.
4. Existing suite green: `service-http`, `security-functions`, `cloud-function-timeout`,
   `cloud-run-tasks-loop`, `workflow-steps` (fake runner seam at `workflow-steps.test.ts:41`).

## FUNCTION_NAME_RE — the second half (RESOLVED s1: nested names are legitimate)

Defined `noodl-editor/.../models/workflow/newFunctionFromStep.ts:48` — `/^[A-Za-z_][A-Za-z0-9_-]*$/`,
forbids `/` and spaces. Enforced at exactly two creation doors (`ComponentTemplates.ts:241-248` via
`useComponentActions.ts:387-391`; `planFunctionFromStep`), **not** at rename, drag-into-folder,
export (`exporter/cloudFunctions.ts:28-45`), or backend load. The shipped prefab library violates it
wholesale (`Stripe/Subscriptions/*`, `Send Email` — nested + spaces) and works at runtime because
the router splits before decoding (`HttpServer.ts:175-186`), so `POST /functions/a%2Fb` matches
`functions/:name`.

The question was: **what actually breaks on an RE-illegal name?** Measured answer: **nothing, on
every call path.** All three app-side callers encode (`cloudfunction2.ts:280`,
`cloudfunction.ts:289`, `api/cloudfunctions.ts:83`); the permissions panel's main-process proxy
encodes (`BackendManager.js:325,332`); workflow steps and triggers pass raw names in-process; and
the backend router splits before decoding so `a%2Fb` matches `functions/:name`. Nested/spaced
names are shipped practice (the prefab library) and work everywhere. So: **no enforcement added at
export or load** — the RE is a house style for names *minted* by the two creation doors, and its
header comment in `newFunctionFromStep.ts` now says exactly that (it used to claim the name "is a
URL path segment", which the measurement disproved). Any UI that *displays* the distinction is
phase-43's.

## What shipped (s1)

- `WorkflowRunner.ts`: `findRequestNodeForFunction()` shared by `hasFunction` /
  `functionAllowsNoAuth`; `getAvailableFunctions` filters by Request node. No load-time index —
  the per-request walk is over in-memory parsed bundles and the full suite runs unchanged; the
  index remains an optimization if profiling ever asks for it.
- `tests/sb-003-helper-not-endpoint.test.ts` — 4 specs over real HTTP, every absence beside a
  known-firing control. **Mutation-graded: mutant A (name-only `hasFunction`) killed by exactly the
  2 dispatch specs; mutant B (prefix-only listing) killed by exactly the listing spec.**
- Full `nodegx-backend` suite after: **102 suites, 1094 passed, 0 failed** (summary line read, not
  `$?`). `newFunctionFromStep.test.ts` 21/21.
- Acceptance 1, 3, 4 met directly; 2 (step path) via the shared predicate — `StepExecutor` and the
  trigger dispatcher call the same `hasFunction`, whose 404 arm the suite already pins.

## Session log

- **s1 (2026-08-26)** — mapped (Explore, verified file:lines above); fix + spec + mutation grading
  + name-rule ruling all landed. Closed.
