# HLS-013 — 🔴 Cloud functions deploy without a window

Found while answering Richard's lifecycle question (README §1b), not from either community issue.
**It is the hard blocker on "the person never opens the editor", and no other task touches it.**

## 1. The person sentence

**An agent builds an app with a backend and ships all of it — the person is never asked to open the
editor and press a button on a node.**

## 2. What was measured (2026-09-09)

| | |
|---|---|
| the only deploy | `WorkflowDocument.deployFunctions()` — `models/workflow/WorkflowDocument.ts:465` |
| call site 1 | `views/panels/propertyeditor/DataTypes/WorkflowTypes.ts:568` — a property-editor action |
| call site 2 | `views/NodeGraphComponentTrail/CloudFunctionTrailStatus.tsx:127` — a button on the component trail |
| headless equivalent | **none** |
| what MCP already has | `provision_backend` — an agent can create the backend |
| the function list | `models/workflow/functionRefResolution.ts:120` — *"the same list the deployer pushes"*, already computed as data |

So the asymmetry is exact: **an agent can provision a backend and cannot put a function on it.** The
list of what to deploy is already a value in the model; only the trigger is a click.

⚠️ **Verify all of the above before building.** It was read once, on one day, and both call sites are
`.tsx` — a third, non-UI caller would change the shape of this task.

## 3. Scope

- A headless door to the same deploy: an MCP tool (`deploy_cloud_functions`), a CLI subcommand, or
  both over one mechanism — **not two mechanisms**.
- A **verdict an agent can read**: which functions were pushed, which failed, and why. A boolean
  return is not enough for something running unattended.
- Whatever `deployFunctions` needs from the editor's live document, named — this is the same
  coupling question as HLS-010, on a much smaller surface, so **do this one first and let it inform
  the spike**.
- **Out of scope:** provisioning (exists), and the app deploy itself (HLS-010/R4).

## 4. Acceptance criteria

1. **(person)** With no editor running: provision a backend over MCP, deploy an app's cloud
   functions, then call one over HTTP and get its answer.
2. A function that fails to deploy is **named** in the result, beside one that succeeded in the same
   run — so the failure is about that function and not about the deploy being down.
3. Deploying the same functions twice leaves the backend in the same state, and the second run says
   so rather than reporting a fresh success. (The seam HLS-014 generalises.)
4. The editor's own deploy button and this door reach the same code. A mutant in the shared path
   reddens both.

## 5. Traps

- 🔴 **`await` on a callback-style write has a dead error path** — this repo has shipped that exact
  bug. Check how `deployFunctions` reports failure before trusting its return.
- 🔴 **A cloud function that deployed and a cloud function that answers are two claims.** AC1 calls
  one over HTTP for that reason; "deploy returned true" is not the criterion.
- ⚠️ The backend policy applies only when the backend starts with the project directory (SBR-001's
  machinery). A headless deploy that skips that ships functions with the wrong ACLs — assert the
  policy on the deployed backend, not the local one.
- ⚠️ The MCP tool surface has a token budget. Check the free slots before adding, and measure after.
