# HLS-013 — what was built

**Session 8, 2026-09-09.** Cloud functions now deploy with no editor running.

> **An agent builds an app with a backend and ships all of it — the person is never asked to open
> the editor and press a button on a node.**

---

## 1. 🔴 Read this before you believe the task file

**Three of the task file's four §2 measurements were wrong**, and the shape of the task changed
because of it. Re-measured 2026-09-09 with `grep -a`:

| the task file said | what is actually there |
|---|---|
| `deployFunctions()` is reached from "exactly two call sites" | **one** caller (`WorkflowTypes.ts:568`) |
| call site 2 is `CloudFunctionTrailStatus.tsx:127` | that file never calls `deployFunctions` — it calls `CloudFunctionDeployer` directly |
| "**both are UI**" | **false.** `CloudFunctionDeployer.start()` pushes on `ProjectModel.projectSavedToDisk` (autosave), and `ProjectBackendLifecycle.ts:295` pushes on backend start. Two non-UI triggers already existed |

`WorkflowDocument.deployFunctions()` is a three-line wrapper. **The real subject was
`services/CloudFunctionDeployer.ts`**, and the task was never "add a headless trigger" — the
triggers were not the hard part.

**The hard part was that the deploy is not headless-*able* by its shape**, and one true thing in the
task file made the whole job tractable: the push is not an Electron mechanism at all.
`pushToBackend` → IPC `backend:update-workflow` → `BackendManager.updateWorkflow` →
`supervisor.request('PUT', '/admin/workflows/<name>', bundle)` with a `Bearer` admin token from
`<dataDir>/secrets.json`. **The IPC layer is a proxy over one HTTP request.**

## 2. The four acceptance criteria

| # | criterion | state |
|---|---|---|
| 1 | With no editor: provision, deploy, then **call one over HTTP and get its answer** | 🟢 **CLOSED — driven against a real backend** |
| 2 | A function that fails is **named**, beside one that succeeded in the same run | 🟢 CLOSED |
| 3 | The second deploy **says so** rather than reporting a fresh success | 🟢 **CLOSED — driven** |
| 4 | Both doors reach the same code; a mutant in the shared path reddens both | 🟢 CLOSED |

### AC1 — and what "answers" had to mean

The drive provisions a real `nodegx-backend`, deploys nine cloud components over MCP, and calls one
over HTTP. **The assertion is not `res.ok`, and not `!== 404`.**

`submitContactForm` answers an empty POST with **400 and a structured field list naming the three
parameters its Request node declares** — `name`, `email`, `message`, each `code: "missing"`. That is
the function's own graph executing: the router found it, the runtime loaded it, and **the parameter
list the exporter shipped arrived intact**. A missing function 404s and a refused one 403s; neither
can name the author's parameters.

🔴 **The first spelling of this test was green and meaningless.** It called
`site/SetSectionOrder`, which is a **helper, not an endpoint** — it answered 403, and
`expect(status).not.toBe(404)` passed. The four `site/*` components are deliberately not served
(DEF-015 roles), which is why the bundle is **9** and the endpoint list is **5**; both numbers are
now asserted so a change in either has to be explained.

### AC3 — the fingerprint had to come from the backend

The editor's idempotency is `pushedHashes`, an **in-memory Map**. That is a legitimate answer to
"what is this backend serving" *only because the editor is the process that put it there*. **A
headless deploy is a new process every run**, so without a new seam it could only ever report a
fresh success.

So `GET /admin/workflows` now reports `bundles: [{name, deployFingerprint, functionCount}]`, and the
deployer sends its fingerprint **with** the bundle. Read off the live backend during the drive:

```
deploy  → hash: e5ff2a43-50308   bundleName: d40-wizard-drive-578dc7b9
backend → bundles: [{"name":"d40-wizard-drive-578dc7b9","deployFingerprint":"e5ff2a43-50308","functionCount":9}]
```

🔴 **Echoed, never recomputed.** A second implementation of `hashCloudExport` in the backend would
drift silently; echoing makes the backend a *record* of what was pushed rather than a second opinion
about it. And the fingerprint is of the bundle **without** the fingerprint in it — a hash of an
object containing its own hash could never be recomputed, and every deploy would look changed
forever.

## 3. What was built

| file | what |
|---|---|
| `noodl-editor/.../exporter/cloudDeployCore.ts` | **new.** The decision: fingerprint, bundle name, skip, verdict. **Imports nothing.** |
| `noodl-editor/.../exporter/cloudDeploy.ts` | **new.** The `ProjectModel` half — builds, then delegates to the core |
| `noodl-editor/.../exporter/cloudDeployEnvironment.ts` | **new.** What a project needs around it before a headless export |
| `noodl-editor/.../exporter/cloudFunctions.ts` | `buildCloudBundleParts` — per-component fault isolation |
| `noodl-editor/.../services/CloudFunctionDeployer.ts` | now a **transport plus toasts**; the decision left |
| `noodl-editor/.../nodelibrary/nodelibrary.ts` | `loadLibrary(data?)` — a real seam for a caller with no `window` |
| `nodegx-backend/.../WorkflowRunner.ts` | `bundles` on the status body |
| `noodl-mcp/src/cloud/bundleEntry.js` | **new.** Builds the bundle in a child process |
| `noodl-mcp/src/cloud/deploy.ts` | **new.** Transport + spawn |
| `noodl-mcp/src/tools/provisionTools.ts` | `deploy_cloud_functions` |

### Why the bundle is built in a child process

**Measured, not chosen for taste.** Importing `ProjectModel` into the MCP server's TypeScript
program produced **201 type errors** in editor files that typecheck perfectly in the editor's own
program (different `strictNullChecks`, no global `TSFixme`) — and pulled
`views/panels/propertyeditor/models/modelProxy.ts`, **a renderer view module**, into a server
bundle. So the model-shaped half runs in `dist/cloud-bundle.cjs`, spawned, exactly as
`kitExtract/entry.js` already does for kit code. The child is also the containment: it installs the
**cloud** node library over a process-wide singleton, which must not decide what every later call in
that server resolves against.

### Why not a second bundle builder

`nodegx-backend`'s own suite already builds bundles a second way
(`tests/helpers/authored-bundle.ts`), and **SB-017 is the record of what that cost**: two paths, the
same graphs, opposite outcomes, and the path a person actually got was the one nobody measured. The
task said "not two mechanisms" and that is why.

## 4. 🔴 The trap that makes a headless export *look* like it works

`exportComponent` **drops every connection `getConnectionHealth` calls unhealthy**, and a connection
is unhealthy when its port does not resolve. In a plain Node process `NodeLibrary.loadLibrary()`
silently loads `{}` — nothing resolves, every wire is unhealthy, **and the export succeeds**,
shipping a graph with almost no connections in it. Every step reports success.

`prepareProjectForCloudExport` is the answer: cloud node library, project registered as a module,
`NamedPortsAdapter` + `CLOUD_DYNAMIC_PORT_ADAPTERS`, then `evaluateHealth()`. Prepared that way, a
plain Node process exports **every connection the template holds on disk**:

| component | on disk | headless export |
|---|---|---|
| `claimSite` | 21 | 21 |
| `duplicatePage` | 32 | 32 |
| `publishPage` | 22 | 22 |
| `reorderSection` | 19 | 19 |
| `submitContactForm` | 21 | 21 |
| `site/ContactRecipient` | 9 | 9 |
| `site/CopySectionToPage` | 9 | 9 |
| `site/SetSectionAccess` | 5 | 5 |
| `site/SetSectionOrder` | 5 | 5 |

⚠️ **Measured against the template on disk, not against `sb017-deployed-bundle.workflow.json`.**
That fixture is a record of one deploy of an older template *while SB-017's defect was live* — it
carries 7 components and 4–14 connections each. Comparing against it would have been comparing
against a frozen bug. Both paths are measured against the same third thing, which is the design
`sb017-deploy-connection-parity` states for itself.

## 5. What the gates caught that reading did not

- **C62** — one malformed component silently stopped **every** function in the project from
  deploying, on every autosave, with no reporter anywhere.
- **C63** — loading a project *in order to deploy it* schedules a write over the author's files.
  Found by driving; the probe's crash was the harmless half of it.
- **C64** — 🔴 the new headless path was on the **wrong side of the DEF-007 project-load seam**.
  `def007-project-load-seam.test.ts` failed and said so. ⚠️ **The drive could not have caught
  this**: measured on both drive projects, `writes: 0` with `familyNodes: 97` and `105` — the
  instrument is live, those projects already pin their values, and AC1 would have passed either way.

## 6. Suites

| suite | result |
|---|---|
| `noodl-editor` `test:main` | **442 / 7327 green**, exit 0 |
| `nodegx-backend` `npm test` | **131 suites / 1590 green** (10 skipped), exit 0 |
| `noodl-mcp` `npm test` | 95 / 1383 green + the new 4; **3 failures are C52**, re-measured unchanged |
| root `npx tsc --noEmit` | exit **0** |
| `noodl-editor` `test:ci` | see §7 |

**C52 re-measured, not inherited:** `sbr009ThemeEditorDrive` (2) and `def018-def020-layout-drive`
(1) — the same two suites, the same 3 failures, the same `rootPrimary: ""` symptom the register
records. Nothing this task touched is imported by either.

⚠️ Two count literals in `toolDisclosure.test.ts` moved 60 → 61. **Counted off the artefact**
(`BACKEND_TOOLS` has 61 entries), not bumped to match the failure.

## 7. What this does NOT leave you

- ⚠️ **No CLI subcommand.** The task allowed "an MCP tool, a CLI subcommand, or both over one
  mechanism". This is the MCP tool. The mechanism is one, so a `nodegx deploy-functions` is now a
  thin wrapper — but it does not exist.
- 🔴 **The editor's Deploy button was not clicked.** `tests/cloud/hls013-editor-door.test.ts` drives
  the real `CloudFunctionDeployer.pushToBackend` through a fake `ipcRenderer` and asserts the
  payload, which covers everything except the two UI call sites' own wiring. **Nobody pressed the
  button.**
- ⚠️ **No remote backend.** Every measurement is a local `nodegx-backend` on loopback.
- ⚠️ **The seam fix (C64) is unexercised by the drive** — see §5. Correct, necessary in general, and
  not demonstrated by anything that ran.
- 🔴 **A live MCP server does not have this tool until it restarts.** The three running
  `noodl-mcp.cjs` processes on this machine loaded the old bundle.
- **C66** — the backend cannot report a per-function load result, so a *push* failure is correctly
  attributed to every function in the bundle rather than to one.
