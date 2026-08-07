# Phase 26 — Deployment (Track K): Progress

**Status:** 📋 Specced, not started — 0 / 8
**Specced:** 2026-07-27 (DEP-001…007 from the deployment scoping session; DEP-008 filed by AIX-009 the same day)
**Phase overview:** [README.md](./README.md)

## Status vocabulary

Not started · In progress · **Built–not wired** · Complete · Superseded

## Task status

| ID | Title | Tier | Status | Landed | Notes |
|---|---|---|---|---|---|
| [DEP-001](./DEP-001-RUNTIME-BACKEND-CONFIG.md) | Runtime backend config — un-freeze the endpoint | 1 | ⬜ Not started | — | Prerequisite for 002/003/005. ~100 lines; the care is in four existing consumers and the SSR hydration case |
| [DEP-008](./DEP-008-ARTIFACT-CONTENTS-AND-IGNORE.md) | Artifact contents & the ignore mechanism | 1 | ⬜ Not started | — | Filed by AIX-009. A **live privacy defect** in the shipping deploy path, not only a blocker. Blocks AIX-009 |
| [DEP-002](./DEP-002-LOCAL-FULLSTACK-BUNDLE.md) | Local full-stack bundle — one process, no Docker | 2 | ⬜ Not started | — | Owns the Deploy popup's new IA. Closes phase-5 TASK-007F |
| [DEP-003](./DEP-003-STATIC-HOST-PUBLISH.md) | Publish to Netlify & Cloudflare Pages | 2 | ⬜ Not started | — | Two adapters, one interface. No git anywhere in the flow |
| [DEP-004](./DEP-004-DEPLOY-TARGETS-AND-SECRETS.md) | Deploy targets & secret storage | 3 | ⬜ Not started | — | Where "dev VM / prod VM" lives. Decides where every credential in the phase goes |
| [DEP-005](./DEP-005-REMOTE-DEPLOY-SSH.md) | Remote deploy over SSH + the Caddy target | 3 | ⬜ Not started | — | Transport wrapper over WF-003's tested script. Closes two WF-003 residuals (SSE, file upload through the proxy) |
| [DEP-006](./DEP-006-HETZNER-PROVISIONING.md) | Hetzner provisioning | 4 | ⬜ Not started | — | Spends the user's money — gated, priced, deletable |
| [DEP-007](./DEP-007-DEPLOY-ASSISTANT.md) | The deploy assistant | 4 | ⬜ Not started | — | Read-only by construction. Everything works without it |

## Findings register

Established by reading the code during the 2026-07-27 scoping session, with file and line confirmed.
Executors should re-confirm the live symptom before building around a finding — if one turns out to
be stale, correct it here rather than implementing around the description.

| # | Finding | Where | Owner |
|---|---|---|---|
| D1 | The entire user-facing deploy surface is one tab, and it writes the **frontend only** | `DeployPopup.tsx:26` | DEP-002 |
| D2 | The backend endpoint is frozen into the bundle at export; no runtime override exists | `external/deploy/index.js`, `deployer.ts` | DEP-001 |
| D3 | Four runtime consumers read `cloudservices` lazily from graph metadata, and the graph model already emits `metadataChanged.cloudservices` — the seam for an override exists | `cloudstore.js:36`, `cloudfunction2.ts:53`, `userservice.ts:173`, `configservice.ts:58`, `dbcollectionnode2.ts:883` | DEP-001 |
| D4 | `setMetaData` no-ops when the new value equals the old (`JSON.stringify` compare), so an override identical to the baked value fires no event | `graphmodel.js:246` | DEP-001 |
| D5 | `copyProjectFilesToFolder` ships the whole project folder past a five-name filter with a `// TODO: Load something like .noodlignore` | `build/copy.ts:5-24` | DEP-008 |
| D6 | The `.git`/`.noodl` exclusions are unanchored `indexOf` substring matches, so legitimate assets are silently dropped | `build/copy.ts` | DEP-008 |
| D7 | v2 project source (`nodegx.*.json`, `components/`) is deployed by accident — `project.json` is excluded by name, its successors are not | `build/copy.ts` | DEP-008 |
| D8 | `nodegx-backend` has **no general static file serving** — only the self-contained `/_admin` document | `admin/AdminDashboardRoutes.ts` | DEP-002 |
| D9 | Phase-5 TASK-007F (bundle the backend with the exported app) was specced and never started; it is far cheaper now that WF-004 produces a single Node-runnable bundle | `phase-5/PROGRESS.md` | DEP-002 |
| D10 | `deployToFolder` is fire-and-forget (literal `NOTE: Fire-n-forget`), so there is no completion or error reporting to build multi-step deploys on | `DeployToFolderTab.tsx` | DEP-002 |
| D11 | `deploy/Caddyfile.example` exists, unused and unverified | `nodegx-backend/deploy/` | DEP-005 |
| D12 | WF-003 residual: SSE and file upload **through the proxy** are untested — BAK-001 realtime and BAK-006 files both depend on that path | `WF-003-NOTES.md` | DEP-005 |
| D13 | WF-003 residual: images were built **arm64 only**. Apple Silicon laptop → x86 VPS is the likeliest configuration in this phase | `WF-003-NOTES.md` | DEP-005 |
| D14 | Anonymous reads 403 by default (BAK-003), so a successful first deploy renders a shell and no data; `{"find":"public"}` silently persists nothing **and answers `success:true`** | BAK-003 / BAK-009 | DEP-002, DEP-005 |
| D15 | `entrypoint.sh` must write a locked security policy on first run because `devOpen: true` is the shipped default and BAK-003's interlock refuses non-loopback binds while it is set | `deploy/entrypoint.sh` | DEP-002, DEP-005 |
| D16 | Stale duplicate export directories in the tree — `external/deploy 2/`, `external/ssr 3/`. Editing them appears to do nothing, forever | `noodl-editor/src/external/` | DEP-001 (avoid); unowned to delete |
| D17 | Two credential stores already exist for one idea (`store/AiCredentials.ts` editor-side, `nodegx-backend/src/config/SecretsStore.ts` server-side). A third needs a stated reason | both | DEP-004 |
| D18 | `models/BackendServices/` is a typed list of named remote services with a panel — the closest existing shape to a target list | `models/BackendServices/` | DEP-004 |
| D19 | WF-003's general lesson, still live: when a later task takes ownership of a value, an earlier task's safety net around it becomes an active bug (the credential-rotation P1) | — | DEP-005 |
| D20 | `lerna exec` runs the main checkout, not a worktree — a worktree cannot drive the editor, which is why WF-003 never deployed a real export | — | all live passes |

## Open questions

- **Do targets belong to the project or to the machine?** DEP-004 proposes per-project *editor
  settings* — so a clone inherits no servers. Defensible the other way for a team with one shared
  prod box. Decide when someone actually has a team.
- **Full-stack + SSR in one process.** DEP-002 adds a full-stack local option alongside the existing
  SSR mode, and the two overlap. Whether the combination is supported is DEP-002's call to make and
  record.
- **Should the local deploy set starting collection permissions?** It dramatically improves first
  run, and a silently-public collection is worse than a blank page. DEP-002 decides; whatever it
  decides must be stated in the generated README in plain words.
- **Encrypted SSH private keys** — supported with a passphrase prompt, or refused with a clear
  message? DEP-004 picks one; silent failure is not an option.
- **How much does DEP-007 actually help?** Its four induced-failure diagnoses are the evidence. If
  they are unimpressive, the honest outcome is to ship the DNS explainer and drop the rest.

## Log

- **2026-07-27** — Phase specced. Seven tasks from the deployment scoping session, tiered so each
  tier is a stopping point. Four decisions taken and recorded in the README: the deploy path is
  deterministic with the AI as guide/troubleshooter only; SSH is bundled `ssh2` rather than shelling
  out; Hetzner is the first and only provisioning provider; Netlify and Cloudflare Pages both ship in
  DEP-003 so the adapter interface is shaped by two genuinely different upload models. DEP-008 was
  filed independently the same day by the AIX-009 scoping session and slots into tier 1 — it is a
  live privacy defect in the deploy path that ships today, and it gets worse the moment this phase
  adds four more destinations.
