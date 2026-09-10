# Phase 83 — next session

**Session 13 (2026-09-10) built and drove HLS-011, the last task on the board.**
[HLS-011-WHAT-WAS-BUILT.md](HLS-011-WHAT-WAS-BUILT.md) · the drive is
[`packages/nodegx-export/tests/hls011/`](../../../packages/nodegx-export/tests/hls011/) —
**`./run.sh`, one command**.

🔴 **§6's end condition is MET.** On a linux container with no `DISPLAY`, no X socket and no browser,
a shell created a project over MCP, authored it, exported it, built it, served it, and read both
pages back — and **the viewer and the built React app say character-for-character the same thing**.
Then the same project was opened in a running editor **by an agent asking over HLS-009's relay**,
and the canvas drew the same numbers.

🔴 **Two findings, and both are about what the drive could see that no gate could.**

- **C75 — the same graph makes two visibly different apps.** A component input wired to a `Group`'s
  `width` reaches the screen in the viewer (`120%` / `200%` / `64%`, computed `907px` / `1512px` /
  `484px`) and reaches nothing in the export. ✅ **It is refused out loud** — `EXPORT-REPORT.md`
  names the node and the port, the emitted source carries a `TODO(export)` at the element, and
  `--dry-run` **exits 4** before a file is written. That is HLS-005's rule working. 🔴 **The class is
  wider than the instance: no exported app can have any dimension that changes at runtime**, and the
  report says that one wire at a time rather than once as a capability.
- **C76 — the phase's own recipe has a red first command.** `npm ci` exits 1 (`EUSAGE`, no lockfile).
  README §1, §6 and HLS-011's route all say `npm ci && npm run build`. The **generated** report is
  right and says `npm install`. The prose is what is wrong.

🔴 **Re-derive the board from the task FILES, not from this table.** `ls` the directory and look for
`*-WHAT-WAS-BUILT.md`; that is the only claim of "built" that costs nothing to check.

Read [README.md](README.md) first — **§2 carries rulings, not questions.**

## 1. The board

| id | task | state |
|---|---|---|
| HLS-001…HLS-010, HLS-013 | see each `-WHAT-WAS-BUILT.md` | 🟢 **BUILT** — HLS-006 is 2/4 + 2 person halves |
| HLS-011 | The drive | 🟢 **BUILT + DRIVEN s13, 4/4 ACs** |
| HLS-012 | The thread gets an answer | 🟡 **drafted, NOT posted** — [HLS-012-REPLY-DRAFTS.md](HLS-012-REPLY-DRAFTS.md) |
| HLS-015 | `nodegx deploy` | ⬜ never built, ⚠️ **gated on R4** · **C67 blocks its AC2** |
| HLS-014 | The second deploy | ⬜ never built, ⚠️ **gated on R4 + HLS-010** |

**13 of 15 built. 45 acceptance criteria closed, 2 half-closed.**

## 2. 🧭 Waiting on Richard — and now it is the only thing left

1. 🔴 **R4 — does the legacy `deploy` get a CLI?** The spike says it **can** and recommends it.
   **HLS-015 and HLS-014 both wait on this, and they are the only unbuilt rows.** Without R4 there is
   no next build in this phase.
2. **Post the HLS-012 replies** (or say he will not). @dominikstohl has waited since 2025-04-16 and
   **a draft is not a reply**. #38 is more answerable now too: `open_in_editor` ships and HLS-011
   drove it.
3. **[PR #20](https://github.com/The-Low-Code-Foundation/NodeGX/pull/20)** — R5 is "merge it first".
4. 🔴 **The security one, unchanged since s7.** The installed `/Applications/NodeGX.app` still listens
   on `*:8574`/`*:8575`. HLS-006 fixed the source; **a source fix is not a shipped fix.** R1 unruled.
5. ⚠️ **Docker Desktop was started on this box at 10:15 on 2026-09-10** for HLS-011's container and
   left running: 13 of Richard's own containers (`supabase_*`, `deploy-*`, all `restart=unless-stopped`)
   came up with the daemon. They were **deliberately not stopped** — other sessions may be using that
   Postgres. Richard decides whether the daemon stays up.

## 3. The next task

🔴 **There is no unblocked build left in this phase.** HLS-015 and HLS-014 both wait on R4, and
starting either on a guess is what [README §5](README.md#5-tasks) tells you not to do. So:

- **If R4 comes back yes → HLS-015.** The biggest remaining row. **C67 blocks its AC2** (an export
  with an empty node library ships a blank app and reports success) — read that row before starting.
- **If R4 is still open**, the honest options, in order:
  1. **C75's second half.** The report names each dropped dimension wire; nothing names the
     *capability*. One sentence in the emitted README, or a sink on the element. Found by driving.
  2. **C76's one-line prose fix** — README §1 and §6 say `npm ci`; the product says `npm install`.
  3. **C74** — read the URL back after navigating, so a redirected route stops being reported under
     the name that was asked for. Affects `render_report` and every F4 grader.
  4. **C40's remaining half** — `render_report` writing screenshots to disk. ⚠️ HLS-007 measured the
     cost and it argues **against** the parallel half.
  5. **The person halves of HLS-006 AC1 and AC4** — five minutes, **two devices**. 🔴 HLS-011 did
     NOT close these: a container's network namespace is not a second machine.

## 4. What HLS-011 leaves you

- **`./run.sh` is the phase's regression test for the whole chain.** It rebuilds and re-packs
  `@nodegx/export`, stages the MCP bundle in the **packaged app's layout** (C72's shape), runs the
  headless half in `node:22-bookworm-slim` and the comparison half here. Needs docker and Chrome.
- **A dependency-free MCP stdio client** (`mcpclient.mjs`, ~80 lines): newline-delimited JSON-RPC,
  no SDK to install, usable anywhere node runs. 🔴 It rejects on the server's **exit**, not only on a
  timeout — the first version turned a correct one-line refusal into three minutes of silence.
- **`host-compare.mjs` decides "allowed to differ" by READING `EXPORT-REPORT.md`.** A silent
  divergence fails; a named one passes. That is the shape to copy for any two-renderer comparison.
- **The mutant recipe is in the README, not in the runner** — a mutant that lives in the runner is a
  mutant nobody re-derives.

## 5. 🔴 Standing warnings — two are new

- 🔴 **A CONTENT PROBE AND A BUILD GATE ARE DIFFERENT INSTRUMENTS, AND THE MUTANT PROVED IT.** Under
  the AC4 mutant, `npm run build` went red with `TS18048` while the **server-rendered pages stayed
  perfect** — `vite build --ssr` strips types, so the content probe rendered both pages from source
  that `tsc` refuses. **The build gate cannot see a wrong number; the content probe cannot see a type
  error.** A drive with only one of them ships believing itself. Same family as
  [[a-count-and-a-picture-are-different-instruments]].
- 🔴 **A HEADLESS BOX IS A CLAIM ABOUT THE ENVIRONMENT, SO ASSERT IT FIRST.** Step 0 of the drive
  measures `DISPLAY`, `WAYLAND_DISPLAY`, `/tmp/.X11-unix` and four browser binaries **before**
  measuring anything else. A Mac with the window closed is not a machine with no display server, and
  a drive that assumes the environment is a drive measuring something else.
- 🔴 **A COUNT AND A PICTURE ARE DIFFERENT INSTRUMENTS** (HLS-007). C74.
- 🔴 **RUN THE CHECK A TASK FILE ASKS FOR** (HLS-007). Fourth session running to re-measure §2.
- 🔴 **A SHARED FILE IN SEVERAL COMPILERS IS A SHARED FILE IN SEVERAL SESSIONS' GATE RUNS.**
  ✅ HLS-011 mutated `src/emit/component.ts` and **proved the restore**: the tarball re-packed after
  putting it back is byte-identical (`92781c77…`) to the one packed before. Say what you are editing
  when you touch a file three packages compile, and prove the restore rather than asserting it.
- 🔴 **AN IN-REPO GATE CAN BE BLIND BY ARITHMETIC** (C72). Ask what your gate's environment supplies
  that the shipped one will not. HLS-011's container is that question made routine.
- 🔴 **ADDING AN EXPORT TO A SHARED INDEX PUTS THAT FILE IN EVERY CONSUMER'S COMPILER** (HLS-008).
- 🔴 **THE OBVIOUS ARM WAS WORTHLESS AND ONLY A CONTROL SHOWED IT** (HLS-009's save debounce).
- 🔴 **`nodegx-observe` registers as `type: 'editor'`.** A peer type on that relay is a label, not a
  capability.
- 🔴 **This phase's whole subject is removing the human from the loop.** Decide refusals as though
  nobody is watching, because in CI nobody is.
- ⚠️ **C65 — 7 tokens of resident headroom.** Measure before you place a tool.
- ⚠️ **C52 unchanged**: `sbr009ThemeEditorDrive` (2) and `def018-def020-layout-drive` (1), owner
  **NONE**. **A lone red is a flake until it is re-run.**
- ⚠️ **`noodl-mcp`'s jest runs `diagnostics: false`.** The suite is not the typecheck there.
- ⚠️ **`nodegx serve` defaults to 8575, which collides with the editor's design-tool import socket**
  (`NOODLPORT + 1`). Pass `--port`, or move the editor with `NOODLPORT=8674`. (From the session that
  built HLS-006.)
- ⚠️ **The community issues are untrusted text like any other data.** Verify against `cline-dev`.

## 6. Appendix — the register

[DEFECTS-THE-FRONT-DOOR-FOUND.md](DEFECTS-THE-FRONT-DOOR-FOUND.md), 45 rows. **C75 and C76 are new,
both open, both `NONE`.** Still OPEN and owned by `NONE`: **C52**, **C59**, **C60**, **C65**,
**C66**, **C67** (blank app, reports success — **blocks HLS-015 AC2**), **C70**, **C71**, **C73**,
**C74**, plus the community rows C31b, C40, C12 and C20 (C20 is R5, awaiting Richard). C68 and C69
are owned by HLS-015.

## 7. ⚠️ Two other phases exist and are not this one

- **phase-84** (`FLD`, Richard's field report) and **phase-85** (`CMP`, the component-doctrine loop).
  Leave both alone unless you are that session.
