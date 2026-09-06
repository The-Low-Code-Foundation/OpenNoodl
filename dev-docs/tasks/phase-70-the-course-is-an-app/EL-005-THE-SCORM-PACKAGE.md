# EL-005 — The SCORM package

| Field | Value |
|---|---|
| **Tier** | 3 |
| **Effort** | L |
| **Surface** | `deploy`, `editor` |
| **Rulings** | **D3** (SCORM 1.2 first) |
| **Depends on** | EL-002 (the client-side transport), EL-001 (`isELearningProject` gates the tab) |

## The job

The trojan horse: a NodeGX course drops into the LMS an organisation already runs. Two doors onto
one packaging core, in that order:

1. **The packaging core** — a gated, in-repo package (the CN-006 one-generator pattern) that takes
   a deployed static-site folder and produces a SCORM 1.2 package: `imsmanifest.xml` (single SCO),
   the **SCORM API adapter** injected into `index.html` (the standard `window.API` frame-walk,
   exposing the discovered API to EL-002's Report Progress transport), and the zip. Callable
   headlessly — a user with Claude Code can package a deploy the day this half lands, before any
   UI exists.
2. **The deploy tab** — a "SCORM package" tab in `DeployPopup`, pushed onto the (today literal,
   one-element) tabs array **only when `isELearningProject()`** (P1). It runs the normal
   `compilation.deployToFolder` pipeline to a staging dir — **CSR forced** — then the packaging
   core, then save-as.

Configuration (course identifier, title, mastery score) reads from project settings/metadata with
sane defaults — a packaging step that opens with a form of SCORM jargon has failed the
Storyline-refugee test.

## Premises to measure before building

1. 🔴 **Relative paths.** An LMS serves package content from an arbitrary nested path. Establish
   whether `deployer.ts` output (`index.html` asset URLs, `noodl_bundles/` fetches, router base)
   survives being served from `/content/12345/…` rather than root — *before* designing the
   manifest. If absolute-from-root paths exist, fixing that is part of this task and benefits
   every self-hosted deploy.
2. **Frame-walk reach**: SCORM packages are typically same-origin with the LMS player frame, but
   verify the adapter's discovery in at least one real LMS's actual frame nesting.
3. Whether EL-003's chosen navigation substrate produces URL changes that fight LMS iframe
   history (a back-button that navigates the LMS instead of the course is a classic).

## Acceptance criteria

1. 🔴 **The package imports and reports in two real LMSes** — Moodle (self-hosted, free) and
   **SCORM Cloud** (the industry conformance harness): completion, score and (1.2 CMI) lesson
   status arrive, and SCORM Cloud's debug log shows clean calls. This is the phase's Definition
   of done made concrete; nothing else here matters if this fails.
2. A deck course and a scenario course both package and report — two templates, one packager.
3. **P1 control, driven**: an ordinary project's deploy popup shows exactly today's one tab; an
   eLearning project shows two.
4. SSR/SSG modes are **refused at the SCORM door with a message naming why** (kits unproven
   server-side, CN-013) — not silently coerced.
5. Commit discipline measured: close the LMS player mid-course; on relaunch, progress resumes from
   the last commit (suspend/resume via `cmi.suspend_data` or documented v1 posture if deferred —
   but *state which*, don't let resume silently not exist).
6. **One generator, two doors** (the CN-006 pattern): the headless invocation and the tab produce
   byte-identical packages from the same input, asserted.
7. The manifest validates against the ADL SCORM 1.2 schema, and a control with a deliberately
   malformed manifest is rejected by the validator — proving the validator runs.

## Traps

- 🔴 **`scripts/` is not in `build.files`** — anything under `scripts/` is dead for real users in
  the packaged app (UNI-010 F4's ruled-and-shipped hole). The packaging core must live where the
  build ships it; the CN-006 webpack `require.resolve` hole is the precedent for how a packaged
  editor breaks path assumptions the repo layout hides — test the core **bundled**, not just
  under jest's cwd.
- ⚠️ `deployer.ts` refuses to write into a project folder — the staging dir must respect that; and
  `deployRenderingMode` is a persisted project setting, so *forcing* CSR for packaging must not
  silently overwrite the user's chosen mode for ordinary deploys.
- ⚠️ The adapter and the kit transport are two halves of one protocol — a change to either is a
  change to both; the fake-API harness from EL-002 AC3 is the shared contract test.
- ⚠️ xAPI still applies inside an LMS: D3 says the kit emits xAPI *alongside* whatever the SCORM
  wrapper reports, when an LRS is configured. Don't let the SCORM path disable the richer data.
- ⚠️ Zip determinism: timestamps in zips break byte-identical assertions (AC6) — normalize.

## Out of scope

- SCORM 2004 (sequencing/navigation), cmi5, and LTI 1.3 — later, by D3, each behind a first
  customer whose LMS wants it.
- Multi-SCO packages — v1 is one course, one SCO.
- Uploading to an LMS from the editor — the output is a zip; the LMS's own import UI takes it
  from there.
