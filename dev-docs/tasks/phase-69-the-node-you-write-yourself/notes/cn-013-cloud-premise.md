# CN-013 — the premise check D18 asked for, and the answer is not the one D18 assumed

**s25, 2026-08-18.** 🔴 **Written before building anything.** D18 binds whoever builds CN-013's
cloud half to *"verify preview AND production, not one of them — the isolate and the service process
are different execution contexts and this ruling exists because they disagree."* That obligation
names two contexts. **This repo has one.**

## What D18 asserts, and what is measurable about it

| D18 premise | Status |
|---|---|
| 1. `manifest.dependencies` is script paths/URLs, not npm | ✅ **stands** — not re-litigated here |
| 2. *"The editor's cloud preview runs in an isolate where `require` is stubbed"* (`sandbox.isolate.js:23`) | 🔴 **FALSE** — see below |
| 3. *"The deployed backend runs cloud functions in the service process, where `require` would work"* | ✅ **stands**, and it is the **only** context |
| 4. A deployed backend is one prebuilt `cli.js`, no `npm install`, nowhere for a package to land | ✅ **stands** — and it is what actually carries the ruling |

🔴 **Premise 2 and premise 3 do not describe two paths. Premise 3 describes both.**

## The three measurements

**M1 — nothing in this repo loads the isolate bundle.** `webpack.prod.js:1-6` records its own
retirement: *"That server and its cloudruntime sandbox are deleted — cloud functions now run inside
nodegx-backend, which esbuilds this package's `src/` directly via the `@cloud-runtime` alias."*
Only `webpack.isolate.*` still builds it, as the published `@noodl/cloud-runtime` artefact for
consumers outside this repo.

**M2 — the isolate could not run here even if something loaded it.** Its `console`, `fetch` and
`setTimeout` shims all call `_noodl_api_call`, and `_noodl_api_call` has **no implementation
anywhere in this repo** — the only occurrences are the four call sites inside `sandbox.isolate.js`
itself, plus two doc comments *about* its absence. It was the external `noodl-cloudservice`'s host
global. A kit loaded there would not fail at `require`; the first `console.log` would throw
`ReferenceError`.

**M3 — the editor's "cloud preview" is a real `nodegx-backend` child process.** `CloudFunctionDeployer`
pushes the bundle over `backend:update-workflow` → `BackendManager.js:215` → `WorkflowRunner.loadWorkflow`,
and `ServiceSupervisor.js:43-80` spawns **`packages/nodegx-backend/dist/cli.js`** in dev and
`<resources>/nodegx-backend/cli.js` when packaged. `scripts/build.js` builds both from
`noodl-viewer-cloud/src` via the same `@cloud-runtime` alias. **The editor and a deploy target run
the same bundle of the same source.**

⚠️ Prior art, not my discovery: `nodegx-backend/tests/cloud-logic-builder-log.test.ts` recorded M1
and M2 for FIX-004 in its header — *"this file is not one of two paths, it is the path"*. D18 was
ruled without it. 🔴 **The finding was already in the repo, in a test comment, in another phase's
file.** That is the "a hole recorded in two halves is not recorded" shape again, and it is why this
note lives under the task rather than in a suite header.

## What this changes, and what it does not

✅ **D18's conclusion stands, on premise 4 alone.** Pure-JS logic nodes are in; server-side SDK
dependencies are out — because a deployed backend is a single prebuilt `cli.js` with nowhere for an
npm package to land. That reason is untouched by any of the above.

🔴 **D18's stated *reason* was partly wrong, and the verification obligation it derived from that
reason is unsatisfiable as written.** There is no "verify it in the isolate as well". Substituting a
second context that does not exist would produce exactly the false-confidence reading this phase
keeps finding.

✅ **The replacement obligation, which is real and which I will honour instead:** the one context has
**two build shapes** —

1. **source, via the `@cloud-runtime` alias** — what `nodegx-backend`'s jest suites import, and
2. **`dist/cli.js`, the esbuild bundle** — what the editor spawns and what a deploy target runs.

A loader that evaluates kit source with `new Function` is exactly the kind of thing that behaves
differently once bundled (⚠️ recorded trap: *webpack rewrites `require.resolve` to a module id*;
plain-Node gates are blind to it). **Verify in both shapes.** That is the honest version of D18's
"verify preview AND production".
