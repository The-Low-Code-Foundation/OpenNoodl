# Phase 83 — next session

**Session 11 (2026-09-10) built HLS-008 and drove it.** `export_react` over MCP: an agent that
authored an app ships it in the same conversation — created a project, authored two pages, exported,
and `npm install && npm run build` in the output folder exited 0. **4 of 4 ACs.**
[HLS-008-WHAT-WAS-BUILT.md §1](HLS-008-WHAT-WAS-BUILT.md#1--the-shape-and-the-one-decision-that-made-everything-else-easy)
is the one to read: **the tool calls `runCli`, so AC2's byte-identity is structural rather than
asserted** — and the spec is a regression test on the wiring, not the thing keeping it true.

🔴 **The finding that matters most is C72, and no in-repo gate could have seen it.** `export_react`
would have shipped **dead in the packaged app**: the exporter reads its node catalog from disk, and
the in-repo path resolves only *by coincidence of directory depth*. Driving the built bundle from a
directory with no `packages/` above it is what showed it. **That is the class, not the instance** —
it is the first thing bundled into `noodl-mcp.cjs` that reads a file at runtime, and the next one
will be invisible the same way.

🔴 **Re-derive the board from the task FILES, not from this table.** `ls` the directory and look for
`*-WHAT-WAS-BUILT.md`; that is the only claim of "built" that costs nothing to check.

🔴 **Do not trust a task file's §2 — but note what happened this time.** Three sessions running
found §2 wrong, so session 11 re-measured HLS-008's before writing a line: **it was right in every
clause** (24 tool modules not 23, which changes nothing). ✅ **Keep re-measuring anyway.** The
budget bought a correct answer in ten minutes, and the two rules it produced were worth more than
the check: the resident surface was read **before** the placement was chosen (§3), and the *built*
artefact was driven rather than the checkout (C72).

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
| HLS-007 | `nodegx render` | ⬜ never built |
| HLS-015 | `nodegx deploy` — the task HLS-010 produced | ⬜ never built, ⚠️ **gated on R4** |
| HLS-014 | The second deploy (⚠️ gated on R4 + HLS-010) | ⬜ never built |
| HLS-011 | The drive | ⬜ never built |

**11 of 15 built. 38 acceptance criteria closed, 2 half-closed.** The ratchet in
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

## 3. The next task: **HLS-007 — `nodegx render`**

The smallest remaining CLI row, and the last one that is not gated on a ruling. ⚠️ **Read register
row C40 before scoping it**: `render_report` does not write screenshots to disk and renders pages
serially ([#40](https://github.com/The-Low-Code-Foundation/NodeGX/issues/40)), owned by **NONE**,
and C40's own disposition says *"HLS-007 checks whether it lands first"*. That check is the first
ten minutes of the task, not a footnote.

🔴 **Drive the BUILT artefact, not the checkout.** This is C72's lesson and it is now the phase's
sharpest one. Anything that reads a file at runtime resolves in a checkout by accident of directory
depth and is absent in the shipped app; `noodl-editor`'s `extraResources` ships **named files**, not
directories. The recipe is in [HLS-008 §5](HLS-008-WHAT-WAS-BUILT.md#5--the-drive): copy the bundle
into a directory with no `packages/` above it and drive it over stdio.

### The alternatives

- **HLS-011 (the drive)** — the phase's own end-to-end pass. Everything it needs now exists except
  `nodegx render`.
- **HLS-015**, *if R4 comes back yes*. 🔴 The biggest remaining row; do not start it on a guess, and
  **C67 blocks its AC2**.
- **The person halves of HLS-006 AC1 and AC4** — five minutes, two devices.

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

## 6. 🔴 Standing warnings — two are new

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

[DEFECTS-THE-FRONT-DOOR-FOUND.md](DEFECTS-THE-FRONT-DOOR-FOUND.md). **C72 (closed, HLS-008) and C73 (open, `NONE`) are new.** Still OPEN and owned by `NONE`: **C52**, **C59**, **C60**, **C65**, **C66**,
**C67** (blank app, reports success — **blocks HLS-015 AC2**), plus the community rows C31b, C40,
C12 and C20 (C20 is R5, awaiting Richard). C68 and C69 are owned by HLS-015.

🔴 **Nothing in the register is the next session's first job. Build HLS-007.** C72 is closed;
**C73 is new and open** (owner NONE) — "an empty placeholder page" is tested structurally, so a page
somebody wrote is treated as one and the next page created steals `startPage`. It is reported in the
tool response, which is why it is a row and not a blocker.

## 8. ⚠️ Two other phases exist and are not this one

- **phase-84** (`FLD`, 17 tasks from Richard's field report) — **actively being worked by a peer
  session** as of session 10 (`Columns.tsx`, `fld-001-columns-measures-itself.test.tsx`, both
  untracked/uncommitted). **Leave it alone unless you are that session.**
- **phase-85** (`CMP`, the component-doctrine loop) — committed and pushed. Leave it alone unless
  you are that session.
