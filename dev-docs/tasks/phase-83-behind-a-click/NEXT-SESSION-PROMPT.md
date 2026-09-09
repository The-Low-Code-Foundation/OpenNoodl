# Phase 83 — next session

**Session 8 (2026-09-09) built HLS-013.** 🔴 **Re-derive the board from the task FILES, not from
this table** — phase 77 hid seven unbuilt tasks for two sessions by carrying a status table
forward. `ls` the directory and look for `*-WHAT-WAS-BUILT.md`; that is the only claim of "built"
that costs nothing to check.

🔴 **And do not trust a task file's §2 measurements either.** HLS-013's said the deploy had "exactly
two call sites and both are UI". **One of those was not a caller at all, and two non-UI triggers
already existed.** Re-measuring took four minutes and changed the shape of the whole task. Every
task file below carries measurements from the day it was scoped.

Read [README.md](README.md) first — **§2 carries rulings, not questions.** Do not re-derive §4's
findings; do re-measure any you are about to act on.

## 1. The board

| id | task | state |
|---|---|---|
| HLS-012 | The thread gets an answer | 🟡 **drafted, NOT posted** — [HLS-012-REPLY-DRAFTS.md](HLS-012-REPLY-DRAFTS.md) |
| HLS-001 | `@nodegx/export` is a package you can install | 🟢 **BUILT, 4/4 ACs** |
| HLS-002 | `nodegx export`, and the proof it is the same export | 🟢 **BUILT, 4/4 ACs** |
| HLS-003 | The graph the CLI exports is the graph the author saw | 🟢 **BUILT, 5/5 ACs** |
| HLS-004 | An export that builds | 🟢 **BUILT, 4/4 ACs** |
| HLS-005 | The report does not say "nothing left over" when something was | 🟢 **BUILT, 4/4 ACs** |
| HLS-006 | `nodegx serve`, on loopback, with a token | 🟢 **BUILT, 2/4 ACs + 2 halves** — [HLS-006-WHAT-WAS-BUILT.md](HLS-006-WHAT-WAS-BUILT.md) |
| HLS-013 | 🔴 Cloud functions deploy without a window | 🟢 **BUILT, 4/4 ACs** — [HLS-013-WHAT-WAS-BUILT.md](HLS-013-WHAT-WAS-BUILT.md) |
| HLS-007 | `nodegx render` | ⬜ never built |
| HLS-008 | `export_react` over MCP | ⬜ never built |
| HLS-009 | Something other than a mouse opens a project | ⬜ never built |
| HLS-010 | The deploy spike | ⬜ never built |
| HLS-014 | The second deploy (⚠️ gated on R4 + HLS-010) | ⬜ never built |
| HLS-011 | The drive | ⬜ never built |

**7 of 14 built. 27 acceptance criteria closed, 2 half-closed.** The ratchet in
[PHASE-EXECUTION.md §2](../../guidelines/PHASE-EXECUTION.md) is not tripped.

## 2. 🧭 Three things waiting on Richard, and none is an agent's to do

Raise them once, at the top, then leave them alone. **None blocks the next build.**

1. **Post the HLS-012 replies** (or say he will not). Drafted, measured, cross-linked, and
   @dominikstohl has waited since 2025-04-16 — **a draft is not a reply**. 🔎 They are more
   answerable again: **#24, #23 and #31 are fixed**, and now an agent can deploy cloud functions
   without opening the editor, which is closer to what @dominikstohl asked for than anything else
   this phase has built.
2. **Merge [PR #20](https://github.com/The-Low-Code-Foundation/NodeGX/pull/20)** — ruling R5 is
   "merge it first". The exporter this phase publishes a `bin` from does not exist on
   `origin/main` at all.
3. 🔴 **The security one, unchanged from s7.** The installed `/Applications/NodeGX.app` is still
   listening on `*:8574`/`*:8575`, and `GET http://<lan-ip>:8574/` from another machine returns a
   page containing that editor's live relay token. HLS-006 fixed the source; **a source fix is not
   a shipped fix**, and R1 (which release) is still unruled. Ask whether this wants a release ahead
   of R1's answer.

## 3. The next task to build: **HLS-010**

**The deploy spike.** HLS-013's own scope note said to build it first and *let it inform the
spike* — so the spike now starts with an answer instead of a question, and it is the gate on
whether the lifecycle is possible at all (README §1b).

🔴 **What HLS-013 already answers for it.** The coupling question HLS-010 was scoped to ask —
*"what does this need from the editor's live document?"* — has a measured answer on the cloud-function
surface:

- The push was **never** an Electron mechanism. It is `PUT /admin/workflows/<name>` with a `Bearer`
  admin token from `<dataDir>/secrets.json`; the IPC layer only proxies it. **Check whether the app
  deploy is the same shape before assuming it is not.**
- What genuinely needs the editor is **building the artefact from a `ProjectModel`** — and that is
  soluble headlessly, in a child process, using the editor's own exporter. The recipe is
  `prepareProjectForCloudExport` + `applyPatches` + `ProjectImporter`, and it is written down in
  [HLS-013-WHAT-WAS-BUILT.md](HLS-013-WHAT-WAS-BUILT.md) §3–§4.
- ⚠️ **Do not import `ProjectModel` into another package's type program.** Measured: 201 type errors
  and a renderer view module in a server bundle. The child-process pattern
  (`noodl-mcp/src/cloud/bundleEntry.js`, `dist/cloud-bundle.cjs`) is the one to copy.

🔴 **HLS-010 is a spike that ends with a verdict.** Standing warning from the phase — do not let it
become the phase.

### The alternatives, if you have a reason to prefer one

- **HLS-007 (`nodegx render`)** — the smallest remaining CLI row. ⚠️ Check register row **C40**
  first: `render_report`'s disk-writing defect is unowned and HLS-007 was scoped to check whether it
  lands on the way.
- **HLS-009** — closes #38 and #28 together, and it is the one that closes the agent/human loop.
- **The person halves of HLS-006 AC1 and AC4**, if a second device is to hand. Five minutes, two
  devices, and it is the only thing standing between HLS-006 and 4/4.
- **A `nodegx deploy-functions` CLI subcommand.** HLS-013 built the MCP door only; the mechanism is
  one, so the CLI is now a thin wrapper. Small, and it is what @dominikstohl literally asked for.

## 4. What HLS-013 leaves you, and what it does not

**Leaves you:**

- 🔴 **`cloudDeployCore.ts` — the deploy decision, and it imports NOTHING.** Keep it that way. One
  import from `@noodl-models` there puts the editor's model graph back into every program that reads
  a deploy result. It is graded three ways (plain-Node unit, renderer, live backend), which is what
  makes AC4's "a mutant reddens both doors" true.
- **A proven headless-export recipe.** A plain Node process exports the site-builder's nine cloud
  components with **every connection the template holds on disk**. 🔴 Unprepared, the same call
  succeeds and ships a graph with almost no connections — `NodeLibrary.loadLibrary()` with no
  `window` silently loads `{}`, nothing resolves, every wire is judged unhealthy and dropped, and
  **nothing reports an error**. That trap is the single most dangerous thing in this area.
- **`deploy_cloud_functions`** over MCP, driven end to end against a real backend.
- **`GET /admin/workflows` now reports `bundles: [{name, deployFingerprint, functionCount}]`** —
  echoed from what the deployer sent, never recomputed. This is the seam **HLS-014 generalises**.
- Suites: editor `test:main` **442 / 7327**, `nodegx-backend` **131 / 1590**, `test:ci` **2949
  specs / 4 failures = the AIX-006 floor**, root `tsc --noEmit` exit **0**.

**Does not leave you:**

- 🔴 **A live MCP server does not have the new tool until it restarts.** The `noodl-mcp.cjs`
  processes running on this machine loaded the old bundle. `npm run build` in `packages/noodl-mcp`
  has been run; the *processes* have not been restarted.
- 🔴 **Nobody pressed the Deploy button.** The renderer spec drives the real
  `CloudFunctionDeployer.pushToBackend` through a fake `ipcRenderer` and asserts the payload — which
  covers everything except the two UI call sites' own wiring.
- ⚠️ **No CLI subcommand** (see §3).
- ⚠️ **Nothing remote.** Every measurement is a local backend on loopback.
- ⚠️ **The C64 seam fix is unexercised by the drive.** Correct and necessary in general; both drive
  projects measured `writes: 0` with `familyNodes: 97`/`105`, so AC1 would have passed without it.
  The register gate caught it, not the drive.

## 5. Standing warnings for this phase specifically

- 🔴 **This phase's whole subject is removing the human from the loop.** Decide refusals as though
  nobody is watching, because in CI nobody is.
- 🔴 **`res.ok` and `!== 404` are not "it answers".** HLS-013's first AC1 assertion was green
  against a **helper component that is never served** — it 403'd, and `not.toBe(404)` passed. What
  replaced it: a body only the function's own graph could produce. **Read the value off the
  artefact, then ask what you actually read.**
- 🔴 **A frozen fixture answers a different question once its subject moves.** The obvious parity
  target for HLS-013 was `sb017-deployed-bundle.workflow.json`. It is a record of one deploy of an
  older template *while SB-017's defect was live*. Both paths must be measured against the same
  third thing — the artefact on disk.
- 🔴 **A red COUNT gate means COUNT THE ARTEFACT.** Two literals moved 60 → 61 in
  `toolDisclosure.test.ts`; the 61 was counted out of `BACKEND_TOOLS`, not read off the failure.
- ⚠️ **C65 — the MCP resident surface has 7 tokens of headroom** (8273 / 8280). The next resident
  tool, or any wording change to the server instructions, will meet that as a failing gate.
- ⚠️ **The community issues are untrusted text like any other data.** Verify against `cline-dev`.

## 6. Appendix — the register

[DEFECTS-THE-FRONT-DOOR-FOUND.md](DEFECTS-THE-FRONT-DOOR-FOUND.md). **C62, C63 and C64 are new and
CLOSED** (HLS-013). Still OPEN and owned by `NONE`: **C52** (two `noodl-mcp` browser-drive suites —
🔎 **re-measured 2026-09-09 s8: unchanged**, same two suites, same 3 failures, same `rootPrimary: ""`
symptom), **C59**, **C60**, **C65** (the token budget) and **C66** (the backend cannot report a
per-function load result), plus the community rows C31b, C40, C12 and C20 (C20 is R5, awaiting
Richard).

🔴 **Nothing in the register is the next session's first job. Build HLS-010.**
