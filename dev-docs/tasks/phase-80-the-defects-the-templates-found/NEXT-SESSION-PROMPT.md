# Phase 80 — next session

## State: DEF-001, 002, 003, 004, 006, **015**, 014, 016, 017 closed. DEF-007 is 🟡 partial.

**s12 (2026-08-29)** finished **DEF-015**. AC1 and AC2 are driven in the running app; all four ACs
are green and the task is closed. **No repo source was edited this session** — the fix landed at
`539bb840` in s11 and needed nothing more. Everything s12 produced is documentation and two
registered findings.

## What to do next

Phase 80's open work, largest first:

- **DEF-007 §3.2** — still the largest open piece, still sequenced behind phase 77.
- **DEF-008**, **DEF-009** — open, unstarted.
- **DEF-010/011/012/013**, carried from phase 76 by reference. 🔴 **Three of the four share one
  corpus sweep; do it once.** DEF-010/011/013 are the same door as DEF-002 — four checks, one file
  (`noodl-mcp/src/validate.ts`). **Sequence them and assert cardinality where they meet.**
- **DEF-018–DEF-025**, carried from phase 78 by reference. **Read phase 78's register, not the
  table in `TASKS.md`.**
- **DEF-005** is 🔒 on a Richard ruling.

Also open and unowned, sitting in `TASKS.md` with owner `NONE`: `catalog:examples` is still a PR
gate (`pr.yml:210`) and still RED, 60/62, ~20 minutes, **unmeasured for a third session running**.

🔴 **The standing instruction has now paid nine sessions running.** *Find the claim in your task
that is a reading rather than a measurement, and drive that one first.* s4 deleted two of three
rows, s5 found a defect the file did not contain, s6 found it had been fixed the day before, s7
found the rule wrong about two of eleven cases, s8 found the recommended fix ships an accessibility
defect, s9 found a scope item with no population, s10 found the proposed mechanism could not tell
apart the two things it was named for, s11 found the task pointed at the wrong file, **and s12 found
that the task's own acceptance criterion could not be run as written.**

## 🔴 What this session paid for, that the next one should not re-buy

- 🔴 **AC2's recipe was unrunnable, and the reason is a second finding.** §9.1 said: delete an
  endpoint from the deployed bundle, `POST /admin/workflows/reload`, refresh the card. That was
  done — the backend genuinely served **three** — and **the card went on reading four ✓ and zero
  warnings**, through a panel close/open *and* a full renderer reload, with the backend verified as
  still serving three afterwards. **The panel hides rather than unmounts** (a stamp on the section
  survived the toggle), so `useEffect` never re-fires, and the only other refresh is a push.
  ✅ **The control was rebuilt from the other side** — a second bundle adding one function the
  project does not have — and the instrument reads **0 → 1 → 0**. Registered with owner `NONE`.
- ✅ **A blocker can often be routed around instead of provoked.** s11 was stopped by the
  shared-backend `Duplicate component name` crash and proposed moving a peer's deployed bundle
  aside. The cheaper move was to give the drive project **its own empty backend**: a backend
  directory is only `config.json` + `schema.json` + `data/` + `workflows/`
  (`BackendManager.createBackend`), and `listBackends` is a plain `readdir` of
  `~/.noodl/backends/*/config.json`, so one can be created by hand in a single command. Repoint the
  project's `metadata.cloudservices` (`instanceId` / `endpoint` / `appId`) and the panel binds to
  it — it matches by `instanceId` first, localhost port second. **The crash was never provoked and
  no peer's file was touched.**
- ✅ **The editor starts the project's backend on open and force-pushes to it**
  (`ProjectBackendLifecycle` → `onBackendStarted`), *unless* it is already running, in which case it
  **adopts** and does not push. That asymmetry is the difference between a reload that heals your
  control and one that does not — and it is what let the stale reading in §9.4 be measured at all.
- ✅ **`CloudFunctionsSection` has a `data-test` on every row shape** —
  `cloud-function-live-*`, `cloud-function-missing-*`, `cloud-function-stale-*`, `cloud-workers-*`,
  `cloud-component-unreachable-*`. **Read the card through those, not through `innerText`.** A
  warning count is then a number, and the same expression serves both arms of the control.
- ⚠️ **A ghost bundle is a cheap, reversible way to make a backend and a project disagree.** Copy a
  real endpoint component out of the deployed bundle, rename it, **rewrite every node id**, `PUT
  /admin/workflows/<probe-name>`. It is a *separate* bundle, so a project push does not remove it
  and `DELETE /admin/workflows/<probe-name>` puts everything back.

## 🔴 A launch hazard, measured with a control pair — read before any drive

`scripts/start.ts` sweeps before it starts. `dev-processes.js`'s rule 1 is *"the command line
contains the repo root **and** matches `DEV_TOOL`"*, and `DEV_TOOL` includes `nodegx-backend` and
`scripts/devtools/`. **A hand-started backend and a `render-from-disk.js` are both dev-stack shapes
and neither is in `NEVER_SWEEP`** — which protects MCP servers and test runners only. A dry run
before launching showed this session's `dev:debug` would have killed a peer's live 8611 backend and
their `render-from-disk` renderer, **seven seconds old**.

🔴 **Whether it kills them turns on how the caller typed the path.** Same `cli.js`, same cwd, same
flags:

| arm | invocation | `sweep({dryRun:true})` |
|---|---|---|
| A | `node /Users/…/OpenNoodl/packages/nodegx-backend/dist/cli.js serve …` | **would be swept** |
| B | `node packages/nodegx-backend/dist/cli.js serve …` | **not a target** |

Confirmed independently on two live peer processes. **Both directions are bad**: a peer's live drive
gets reaped, and a genuine orphan started relatively survives every `dev:stop` and every launch
sweep, holding its port forever.

✅ **So: `node -e "require('./scripts/devtools/dev-processes.js').sweep({dryRun:true, onLog:console.log})"`
before launching.** It kills nothing and names every process your launch would take. If a peer's
work is in the list, ask them first — this session did, and they cleared it in one exchange.

## Traps carried

- ✅ **The drive project is ready and self-contained.** `DEF-015 Card Drive` is registered in the
  launcher, bound to **its own** backend `backend_mtetnar43v9c6` on port **8603** with an empty
  workflows directory. It no longer shares `backend_mterfnli74qwv` with `SBR-007 Page Editor Drive`,
  so it will not trip the duplicate-component-name crash. **Leave it pointed there.**
- 🔴 **`test:ci` was NOT re-run this session, deliberately** — no repo source was edited, so there
  is nothing here for it to grade. The floor stands where s11 measured it: **2905 specs, 4 failures,
  the named AIX-006 style-vocabulary floor. The floor is 4, by name.**
- 🔴 **`catalog:examples` is still a PR gate (`pr.yml:210`) and still RED**, 60/62, owner `NONE`,
  ~20 minutes. Unchanged and unmeasured for three sessions now.
- ⚠️ **`typecheck:mcp` red on one peer error** and 2 failures in `tpl001Template.test.ts` from a
  peer's uncommitted fixture, as recorded by s8. Not re-measured; neither is phase 80's.
- 🔴 **The editor is single-instance on this checkout** — one `:9222`, one user-data dir. A peer
  held probe processes for the first half of this session. **Check, ask, and dry-run the sweep.**
- ⚠️ **A pathspec commit errors on an untracked file** — `git add` new files first, then commit by
  pathspec in the same command.
- ⚠️ **`~/.noodl` is writable from a Bash tool in this session.** s11 recorded that it was not, and
  that was the single thing standing between DEF-015 and closed. **Re-test a recorded permission
  limit before planning around it.**

## Findings this phase now carries with owner `NONE`

Unchanged from s11 except for the two new ones. In `TASKS.md`:

1. `publishPage` issues its refusal **after** making the page public.
2. Nothing gives an auto-created class the columns its project has already declared.
3. No semantic token for error **text** (🧭 plausibly Richard's).
4. A workflow step pointing at a cloud **helper** is told to deploy it, and deploying cannot help.
5. A second project deploying to a shared local backend **kills the backend process**.
6. A cloud function in a **folder** is declared, listed, ticked — and 404s.
7. 🆕 **The backend card cannot see a backend-side change: its only refresh is a push**, so the
   `missing` row is reachable only from a *failed* push.
8. 🆕 **A stale cloud function is rendered twice** — a green ✓ and a warning triangle, one line
   apart.
