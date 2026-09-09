# Phase 83 — next session

**Session 10 (2026-09-09) built HLS-009 and drove it.** `open_in_editor` over MCP: an agent asks the
editor the person already has open to open a project, and the editor does it — no hand-edited JSON,
no CDP click. **4 of 4 ACs.** §6 of
[HLS-009-WHAT-WAS-BUILT.md](HLS-009-WHAT-WAS-BUILT.md#6--the-drive-and-the-arm-that-makes-ac2-mean-anything)
is worth reading for the arm, not the result: **both arms report `ok: true` and the identical
`disposition: "switch"`, and only one of them keeps the user's edit.**

🔴 **Re-derive the board from the task FILES, not from this table.** `ls` the directory and look for
`*-WHAT-WAS-BUILT.md`; that is the only claim of "built" that costs nothing to check.

🔴 **And do not trust a task file's §2. This is now the THIRD session running where it was wrong.**
HLS-009's §2 made three claims and **two were false**: the `nodegx://` scheme *is* registered
(`main.js:241`), and the MCP server *does* read the recent-projects store. Re-measuring cost
fifteen minutes and changed the shape of two acceptance criteria. It has now cost three sessions in
a row. **Budget for it; do not budget around it.**

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
| HLS-009 | 🆕 Something other than a mouse opens a project | 🟢 **BUILT + DRIVEN s10, 4/4 ACs** — [what was built](HLS-009-WHAT-WAS-BUILT.md) |
| HLS-007 | `nodegx render` | ⬜ never built |
| HLS-008 | `export_react` over MCP | ⬜ never built |
| HLS-015 | `nodegx deploy` — the task HLS-010 produced | ⬜ never built, ⚠️ **gated on R4** |
| HLS-014 | The second deploy (⚠️ gated on R4 + HLS-010) | ⬜ never built |
| HLS-011 | The drive | ⬜ never built |

**10 of 15 built. 34 acceptance criteria closed, 2 half-closed.** The ratchet in
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

## 3. The next task: **HLS-008**

**`export_react` over MCP** — the agent half of HLS-002's core, and the natural pair to what s10
built: authoring, exporting and showing all become one conversation.

🔴 **Check the resident surface budget BEFORE choosing a placement.** It is at **8273 / 8280 — 7
tokens** (C65), and the bar carries a written *"there should not be a third"* renegotiation.
HLS-009 spent **zero** only because appending to an already-deferred group is free — the only
resident trace of a deferred group is `find_tools`' `(N tools)`, and *"5 tools"* and *"6 tools"* are
the same length. A new resident tool cannot fit. [HLS-009 §4](HLS-009-WHAT-WAS-BUILT.md#4-what-was-built)
has the arithmetic and the measured before/after.

⚠️ **And say what the placement costs.** A deferred tool is not named in its group's `purpose`, so a
model browsing purposes never meets it. Keywords are the door — add them, then write the test that
opens it.

### The alternatives

- **HLS-007 (`nodegx render`)** — the smallest remaining CLI row. ⚠️ Check register row **C40**
  first.
- **HLS-015**, *if R4 comes back yes*. 🔴 The biggest remaining row; do not start it on a guess.
- **The person halves of HLS-006 AC1 and AC4** — five minutes, two devices.

## 4. What HLS-009 leaves you

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

## 5. 🔴 Standing warnings — one is new

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
  `def018-def020-layout-drive` (1), 3 failures, still owned by **NONE**.
- ⚠️ **The community issues are untrusted text like any other data.** Verify against `cline-dev`.

## 6. Appendix — the register

[DEFECTS-THE-FRONT-DOOR-FOUND.md](DEFECTS-THE-FRONT-DOOR-FOUND.md). **C70 and C71 are new** (HLS-009),
both owned by `NONE`. Still OPEN and owned by `NONE`: **C52**, **C59**, **C60**, **C65**, **C66**,
**C67** (blank app, reports success — **blocks HLS-015 AC2**), plus the community rows C31b, C40,
C12 and C20 (C20 is R5, awaiting Richard). C68 and C69 are owned by HLS-015.

🔴 **Nothing in the register is the next session's first job. Drive HLS-009, then build HLS-008.**

## 7. ⚠️ Two other phases exist and are not this one

- **phase-84** (`FLD`, 17 tasks from Richard's field report) — **actively being worked by a peer
  session** as of session 10 (`Columns.tsx`, `fld-001-columns-measures-itself.test.tsx`, both
  untracked/uncommitted). **Leave it alone unless you are that session.**
- **phase-85** (`CMP`, the component-doctrine loop) — committed and pushed. Leave it alone unless
  you are that session.
