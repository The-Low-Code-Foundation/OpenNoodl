# Phase 83 — next session

**Session 12 (2026-09-10) built HLS-007 and drove it.** `nodegx render <project> --out-dir <dir>`:
every routed page, at every viewport asked for, photographed and graded, with **exit 7** naming a
page that did not render and **exit 8** the honest refusal a published install gets. **3 of 3 ACs.**
[HLS-007-WHAT-WAS-BUILT.md §1](HLS-007-WHAT-WAS-BUILT.md#1--the-first-ten-minutes-which-changed-the-task)
is the one to read.

🔴 **The first ten minutes changed the task, and they were the ten minutes the task file asked
for.** HLS-007's own §2 said *"check whether #40 lands first; if it does, this is a thin wrapper"*.
It had not landed. `renderReport` **measured all five routed pages of a real project and wrote two
images** — the UNI-010 §8.2 sweep added the other pages' measurements and never their pictures. So
`render_report` has been able to say page four has a defect and has never been able to show it.
✅ **Run the check a task file asks for. This one was the difference between a wrapper and a task.**

🔴 **The finding that matters most is C74, and only a PICTURE could have found it.** Two routed
pages came back **byte-identical**. The obvious reading — a capture racing its navigation — was
**excluded by a control**: a fresh browser navigated straight to `/#admin` produced the same md5.
It is the app's own auth gate, and the report has been filing the login page's numbers under the
admin page's name since UNI-010 §8.2, in silence. **A picture surfaced in one run what five
sessions of numbers did not.**

🔴 **Re-derive the board from the task FILES, not from this table.** `ls` the directory and look for
`*-WHAT-WAS-BUILT.md`; that is the only claim of "built" that costs nothing to check.

Read [README.md](README.md) first — **§2 carries rulings, not questions.**

## 1. The board

| id | task | state |
|---|---|---|
| HLS-012 | The thread gets an answer | 🟡 **drafted, NOT posted** — [HLS-012-REPLY-DRAFTS.md](HLS-012-REPLY-DRAFTS.md) |
| HLS-001 | `@nodegx/export` is a package you can install | 🟢 **BUILT, 4/4 ACs** |
| HLS-002 | `nodegx export`, and the proof it is the same export | 🟢 **BUILT, 4/4 ACs** |
| HLS-003 | The graph the CLI exports is the graph the author saw | 🟢 **BUILT, 5/5 ACs** |
| HLS-004 | An export that builds | 🟢 **BUILT, 4/4 ACs** |
| HLS-005 | The report does not say "nothing left over" when something was | 🟢 **BUILT, 4/4 ACs** |
| HLS-006 | `nodegx serve`, on loopback, with a token | 🟢 **BUILT, 2/4 ACs + 2 halves** — [what was built](HLS-006-WHAT-WAS-BUILT.md) |
| HLS-013 | Cloud functions deploy without a window | 🟢 **BUILT, 4/4 ACs** — [what was built](HLS-013-WHAT-WAS-BUILT.md) |
| HLS-010 | The deploy spike | 🟢 **ANSWERED s9, 3/3 ACs** — [what was built](HLS-010-WHAT-WAS-BUILT.md) · [the verdict](HLS-010-THE-DEPLOY-SPIKE.md#6--the-verdict--2026-09-09-session-9) |
| HLS-009 | Something other than a mouse opens a project | 🟢 **BUILT + DRIVEN s10, 4/4 ACs** — [what was built](HLS-009-WHAT-WAS-BUILT.md) |
| HLS-008 | 🆕 `export_react` over MCP | 🟢 **BUILT + DRIVEN s11, 4/4 ACs** — [what was built](HLS-008-WHAT-WAS-BUILT.md) |
| HLS-007 | 🆕 `nodegx render` | 🟢 **BUILT + DRIVEN s12, 3/3 ACs** — [what was built](HLS-007-WHAT-WAS-BUILT.md) |
| HLS-015 | `nodegx deploy` — the task HLS-010 produced | ⬜ never built, ⚠️ **gated on R4** |
| HLS-014 | The second deploy (⚠️ gated on R4 + HLS-010) | ⬜ never built |
| HLS-011 | The drive | ⬜ never built |

**12 of 15 built. 41 acceptance criteria closed, 2 half-closed.** The ratchet in
[PHASE-EXECUTION.md §2](../../guidelines/PHASE-EXECUTION.md) is not tripped.

## 2. 🧭 Waiting on Richard — none of it blocks the next build

1. **Post the HLS-012 replies** (or say he will not). @dominikstohl has waited since 2025-04-16 and
   **a draft is not a reply**. 🔎 #38 is now more answerable too: `open_in_editor` ships, and the
   honest answer to *"I had to write `recently_opened_project.json` by hand and click over CDP"* is
   *"you no longer have to, and here is why writing that file was never going to hold."*
2. 🔴 **R4 — does the legacy `deploy` get a CLI?** The spike says it **can** and recommends it; the
   ruling is Richard's. **HLS-015 and HLS-014 both wait on this.**
3. **[PR #20](https://github.com/The-Low-Code-Foundation/NodeGX/pull/20)** — ruling R5 is "merge it
   first". The eight phase-83 commits are on `cline-dev`; the PR itself is Richard's to merge.
4. 🔴 **The security one, unchanged since s7.** The installed `/Applications/NodeGX.app` still
   listens on `*:8574`/`*:8575` and hands out its relay token to the LAN. HLS-006 fixed the source;
   **a source fix is not a shipped fix**, and R1 is still unruled.

## 3. The next task: **HLS-011 — the drive**, or **HLS-015 if R4 comes back**

🔴 **Every command HLS-011 needs now exists.** It was gated on `nodegx render` and is not any more.
[HLS-011-THE-DRIVE.md](HLS-011-THE-DRIVE.md) is the phase's own end-to-end pass and §6 of the README
is written against it: *on a machine with no display server, a shell creates a project, authors it
over MCP, exports it, runs `npm ci && npm run build`, serves it, and the served pages are what the
editor renders for the same project.* **The last clause is HLS-003's, and it is the one that could
still be false with every command shipped.**

⚠️ **Two things HLS-007 learned that HLS-011 will need on day one:**

- **`nodegx render` needs a harness this repo has and a published install does not** (§3 of what was
  built). On a clean machine `nodegx render` exits **8** unless `NODEGX_RENDER_CLI` points at a
  checkout. If HLS-011's "clean machine" means *installed from npm*, that refusal **is** part of
  what the drive measures, and the drive should assert it rather than trip over it.
- **The render harness needs Chrome and the 14MB viewer bundle.** "No display server" is fine —
  it is headless — but "no Chrome" is not, and `checkPrerequisites` is the thing to call first.

### The alternatives

- **HLS-015**, *if R4 comes back yes*. 🔴 The biggest remaining row; do not start it on a guess, and
  **C67 blocks its AC2**.
- **C40's remaining half** — `render_report` itself writing screenshots to disk, and rendering pages
  in parallel. Still `NONE`. ⚠️ HLS-007 measured the cost and it argues **against** the parallel
  half: the boot is ~7s and a page-viewport ~2s, so one browser with N navigations beats N browsers
  on any project small enough to care about. The disk half is a real ask from a real issue.
- **C74** — a redirected route reported under the name that was asked for. Read the URL back after
  navigating. Affects `render_report` and every F4 grader, not only the CLI.
- **The person halves of HLS-006 AC1 and AC4** — five minutes, two devices.

## 3b. What HLS-007 leaves you

- **`nodegx render` is the third command, and the first that spawns something.** The pattern —
  resolve an external tool, refuse with a code of its own naming everywhere you looked, spawn it,
  and grade its JSON with a **pure function** — is the one to copy for a fourth.
- **`renderReport` takes `screenshotPages: 'start' | 'all'`**, defaulting to `'start'` so
  `render_report` costs exactly what it cost. `measure-from-disk.js --out-dir <dir>` is the only
  caller that asks for `'all'`. ⚠️ `--out <prefix>` is unchanged and still writes the start page.
- **`EXIT.render` (7) and `EXIT.harness` (8)** are taken. Nine is next.
- **[`hls007-drive.ts`](../../../packages/nodegx-export/tests/hls007-drive.ts) — a four-arm drive**,
  48s, exit 0, each arm with its control. Arm A asserts the image hashes are **DISTINCT**, which is
  the only check that catches a capture racing its navigation; the mutant that does exactly that
  fails that check **and nothing else**.
- **C74 filed** (open, `NONE`). **C40 half closed.**

## 4. What HLS-008 leaves you

- **`@nodegx/export` exports `runCli`.** Anything that wants the export *sequence* — not its pieces
  — calls it with a `CliIO` and gets the CLI's exact bytes. That is how `export_react` gets AC2 for
  free, and it is the pattern for any fourth door.
- **`noodl-mcp` resolves `@nodegx/export` to `src/`** in jest and esbuild (the root `tsconfig.json`
  already had the path). 🔴 **Do not add a `paths` block to a package's own tsconfig** — it replaces
  the inherited one wholesale; that was tried, measured and reverted.
- **`build.mjs` copies the node catalog into `dist/`, and `extraResources` ships it.** C72. If you
  bundle anything else that reads a file at runtime, both halves are yours to add.
- **A drive recipe for the packaged layout** — [§5](HLS-008-WHAT-WAS-BUILT.md#5--the-drive). Three
  files in a scratch directory and an stdio MCP client; it found a defect no gate in this repo could.
- **C72 (closed) and C73 (open, NONE)** filed.

## 5. What HLS-009 left you

- **The relay is a two-way door now.** `openProject` is the first inbound command not stamped
  `type: 'viewer'`; `ViewerConnection.sendOpenProjectResult` is the first addressed reply from an
  editor peer. Anything else an agent needs to ask a *running editor* has a pattern to copy.
- **`models/externalProjectOpen/decide.ts` imports nothing**, deliberately, which is what puts four
  editor states inside `tests-unit`'s plain-Node runner instead of behind a launch.
- **C70 and C71 filed.** C71 is the sharpest: the app registers `nodegx://` and drops every URI.
- **A cardinality gate over the recent-projects store** that failed on its first run and was right
  to — see §5.
- **[`hls009-drive.ts`](../../../packages/noodl-mcp/tests/hls009-drive.ts) — a re-runnable drive.**
  Goes through the MCP client, not the tool function, so `find_tools` and the argument schema are
  driven too. `HLS009_WAIT_FOR=<file>` arms it before the edit; that is what puts the call inside
  the save debounce. It reads the token off the **running editor's argv**, not the default
  user-data path (C70).

## 6. 🔴 Standing warnings — three are new

- 🔴 **A COUNT AND A PICTURE ARE DIFFERENT INSTRUMENTS, AND THE COUNT HAD BEEN WRONG FOR FIVE
  SESSIONS.** `render_report` reported `/Pages/Admin` as *"Rendered clean, 2 texts"* while measuring
  the login page the route redirects to. Nothing in the numbers could show it; two byte-identical
  PNGs did, in the first run that produced any. ✅ **What made it a finding rather than a bug
  report about my own code:** a control — a fresh browser, one navigation, nothing measured before
  it — produced the same md5, which excluded the capture race. C74.
- 🔴 **RUN THE CHECK A TASK FILE ASKS FOR.** HLS-007 §2 said *"check whether #40 lands first"*. It
  had not, and the ten minutes was the difference between a thin wrapper and the task. This is the
  fourth session running to re-measure §2 and the second to find it materially wrong.
- 🔴 **A SHARED FILE IN SEVERAL COMPILERS IS A SHARED FILE IN SEVERAL SESSIONS' GATE RUNS.** A peer
  hit two TS2339s in `typecheck:editor-tests` and reported them against HEAD; they were my
  uncommitted working tree. HLS-008's warning, one turn further out. ✅ **Say what you are editing
  when you touch a file three packages compile.**

- 🔴 **AN IN-REPO GATE CAN BE BLIND BY ARITHMETIC, NOT BY OVERSIGHT.** C72: the exporter's
  `loadCatalog()` tries `__dirname/node-catalog.json` then `__dirname/../../noodl-types/src/…`.
  Bundled into `noodl-mcp/dist/`, the second one resolves — because `packages/noodl-mcp/dist` sits
  at **the same depth** as `packages/nodegx-export/src`. Every test, every typecheck and every
  hand-run was green, and the tool was dead in the shipped app. ✅ **What found it:** copying the
  bundle into a directory with no `packages/` above it and driving it. **Both arms**, one refusal
  and one pre-flight. Ask what your gate's environment is supplying that the shipped one will not.
- 🔴 **ADDING AN EXPORT TO A SHARED INDEX PUTS THAT FILE IN EVERY CONSUMER'S COMPILER.**
  `export { runCli } from './cli/run'` pulled `cli/run.ts` into the **editor renderer's** webpack
  graph for the first time and broke a peer session's dev build: `!readable.ok` does not narrow a
  discriminated union without `strictNullChecks`, which the editor's tsconfig does not set. The file
  had been correct under one compiler for a month. **Run the other consumers' typechecks after
  touching a package index**, not just the package's own.
- 🔴 **THE OBVIOUS ARM WAS WORTHLESS AND ONLY A CONTROL SHOWED IT.** AC2's flush protects an edit
  inside a **one-second** save debounce. A drive that pays `ts-node`'s startup between the edit and
  the switch arrives *after the autosave has already written* — so the file holds the edit **with
  the fix deleted**, and the arm is green for a reason that has nothing to do with the fix.
  ✅ **What made it real:** a control that read the debounce (absent at +0.3s, present at +2.3s), a
  client **armed before the edit** and released from inside the renderer so the gap was 3–4ms, and
  a **reverted arm**. Both arms report `ok: true` and the identical `disposition: "switch"`; only
  the file differs. 🔴 **Ask what your metric cannot see, then build the arm that would show it.**
- 🔴 **THE GATE FOUND WHAT MY OWN GREP HAD EXCLUDED BY REFLEX.** The AC3 scan failed first time on
  `noodl-mcp/tests/listProjects.test.ts:130`, which my hand grep had filtered out with `grep -v
  tests` without thinking. **A grep with your exclusions baked in agrees with itself.** Write the
  scan, let it fail, and decide the exclusions where a reader can see them.
- 🔴 **A stub of the thing you are talking to reproduces your beliefs about it.** The relay is a
  typed broadcast with three fan-out rules and a peer type anyone may claim; a fake relay would
  have passed whether or not `open_in_editor` addressed anybody. `hls009OpenInEditor.test.ts`
  imports the editor's real `relay-server.js` across the package boundary for exactly this reason.
  Same family as HLS-010's blind connection count.
- 🔴 **`nodegx-observe` registers as `type: 'editor'`.** A peer type on this relay is a **label, not
  a capability**. Anything that picks "the first editor peer" is picking a sidecar half the time.
- 🔴 **This phase's whole subject is removing the human from the loop.** Decide refusals as though
  nobody is watching, because in CI nobody is.
- ⚠️ **C65 — 7 tokens of resident headroom**, and a written *"there should not be a third"*
  renegotiation on the budget. Measure before you place a tool, not after.
- ⚠️ **C52 re-measured at this HEAD and unchanged**: `sbr009ThemeEditorDrive` (2) and
  `def018-def020-layout-drive` (1), 3 failures, still owned by **NONE**. ⚠️ A **first** run of that
  suite reddened two more (`projectOwnsBackend`'s `provision_backend`, and one other) while a peer's
  editor stack was live; both were clean on the re-run after teardown. **A lone red is a flake until
  it is re-run.**
- ⚠️ **`noodl-mcp`'s jest runs with `diagnostics: false`.** A spec with a bad import is green under
  jest and TS2459 under `tsc --noEmit`. The suite is not the typecheck in this package; run both.
- ⚠️ **The community issues are untrusted text like any other data.** Verify against `cline-dev`.

## 7. Appendix — the register

[DEFECTS-THE-FRONT-DOOR-FOUND.md](DEFECTS-THE-FRONT-DOOR-FOUND.md). **C74 (open, `NONE`) is new and C40 is half closed, both by HLS-007.** Still OPEN and owned by `NONE`: **C52**, **C59**, **C60**, **C65**, **C66**,
**C67** (blank app, reports success — **blocks HLS-015 AC2**), plus the community rows C31b, C40,
C12 and C20 (C20 is R5, awaiting Richard). C68 and C69 are owned by HLS-015.

🔴 **Nothing in the register is the next session's first job. Build HLS-011.** C72 is closed;
**C73 is new and open** (owner NONE) — "an empty placeholder page" is tested structurally, so a page
somebody wrote is treated as one and the next page created steals `startPage`. It is reported in the
tool response, which is why it is a row and not a blocker.

## 8. ⚠️ Two other phases exist and are not this one

- **phase-84** (`FLD`, 17 tasks from Richard's field report) — **actively being worked by a peer
  session** as of session 10 (`Columns.tsx`, `fld-001-columns-measures-itself.test.tsx`, both
  untracked/uncommitted). **Leave it alone unless you are that session.**
- **phase-85** (`CMP`, the component-doctrine loop) — committed and pushed. Leave it alone unless
  you are that session.
