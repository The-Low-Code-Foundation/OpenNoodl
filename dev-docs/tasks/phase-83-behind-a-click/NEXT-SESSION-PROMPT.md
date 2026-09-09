# Phase 83 — next session

**Session 9 (2026-09-09) ran HLS-010, the deploy spike.** It changed no product code, which is the
right shape for a spike, and it produced a verdict, a task (HLS-015) and three register rows.

🔴 **Re-derive the board from the task FILES, not from this table.** `ls` the directory and look for
`*-WHAT-WAS-BUILT.md`; that is the only claim of "built" that costs nothing to check.

🔴 **And do not trust a task file's §2 measurements.** This is now the **second session running**
where they were wrong. HLS-013's said the deploy had "two call sites, both UI" — one was not a
caller and two non-UI triggers already existed. HLS-010's §2 said `ProjectModel` is a singleton with
no `fromDirectory`: **every clause true, the conclusion wrong**, and the thing it implied was hard
had been shipping in `nodegx serve` since session 7. Re-measuring cost minutes both times.

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
| HLS-010 | 🔴 The deploy spike | 🟢 **ANSWERED s9, 3/3 ACs** — [what was built](HLS-010-WHAT-WAS-BUILT.md) · [the verdict](HLS-010-THE-DEPLOY-SPIKE.md#6--the-verdict--2026-09-09-session-9) |
| HLS-007 | `nodegx render` | ⬜ never built |
| HLS-008 | `export_react` over MCP | ⬜ never built |
| HLS-009 | Something other than a mouse opens a project | ⬜ never built |
| HLS-015 | 🆕 `nodegx deploy` — **the task HLS-010 produced** | ⬜ never built, ⚠️ **gated on R4** |
| HLS-014 | The second deploy (⚠️ gated on R4 + HLS-010) | ⬜ never built |
| HLS-011 | The drive | ⬜ never built |

**9 of 15 built. 30 acceptance criteria closed, 2 half-closed.** The ratchet in
[PHASE-EXECUTION.md §2](../../guidelines/PHASE-EXECUTION.md) is not tripped.

## 2. 🧭 Waiting on Richard — none of it blocks the next build

1. **Post the HLS-012 replies** (or say he will not). @dominikstohl has waited since 2025-04-16 and
   **a draft is not a reply**. 🔎 More answerable again this session: #11 asked about the 2.9
   `noodl build` command, and the honest answer is now *"that is what we just ran headlessly, and
   there is a task for it"* rather than *"it was never open-sourced, sorry"*.
2. 🔴 **R4 — does the legacy `deploy` get a CLI?** The spike says it **can** be built and recommends
   it; the ruling is Richard's. **HLS-015 and HLS-014 both wait on this.** If the answer is no,
   HLS-015 becomes a recorded refusal and #11/#36 get the reason.
3. **[PR #20](https://github.com/The-Low-Code-Foundation/NodeGX/pull/20)** — ruling R5 is "merge it
   first". ⚠️ Partly moved: a peer pushed `cline-dev` this session (origin now `44797825`), so the
   eight phase-83 commits are on the remote. The PR itself is still Richard's to merge.
4. 🔴 **The security one, unchanged since s7.** The installed `/Applications/NodeGX.app` still
   listens on `*:8574`/`*:8575` and hands out its relay token to the LAN. HLS-006 fixed the source;
   **a source fix is not a shipped fix**, and R1 is still unruled.

## 3. The next task to build: **HLS-009**

**Something other than a mouse opens a project.** It closes **#38 and #28 together**, it is the
front of the lifecycle this phase is about, and — unlike HLS-015 — **it is not gated on a ruling**.

### The alternatives

- **HLS-007 (`nodegx render`)** — the smallest remaining CLI row. ⚠️ Check register row **C40**
  first: `render_report`'s disk-writing defect is unowned and HLS-007 was scoped to check whether it
  lands on the way.
- **HLS-008 (`export_react` over MCP)** — the agent half of HLS-002's core.
- **HLS-015**, *if R4 comes back yes*. 🔴 It is the biggest remaining row; do not start it on a guess
  about the ruling.
- **The person halves of HLS-006 AC1 and AC4** — five minutes, two devices, and the only thing
  between HLS-006 and 4/4.

## 4. What HLS-010 leaves you

- 🔴 **[HLS-015](HLS-015-NODEGX-DEPLOY.md), scoped** — with the measurements, the traps, and an
  argument about *where the code goes* (the preview bundle, not `@nodegx/export`'s; HLS-013 measured
  what pulling `ProjectModel` into another package's type program costs: **201 type errors**).
- 🔴 **[`hls010-spike/`](hls010-spike/) — a re-runnable instrument**, with its own README. Both arms
  reproduce byte-identical bundle hashes. HLS-015 AC2 is graded with its `SKIP_LIB=1` arm.
- **The measured answer**: `deployToFolder` runs in plain Node — **no Electron, no window** — and
  writes a servable static site. The only gap is a **path** (C68).
- **C67, C68, C69** filed. C67 blocks HLS-015 AC2.

## 5. 🔴 Standing warnings — one is new and it is the sharpest thing this session found

- 🔴 **THE NATURAL INSTRUMENT WAS BLIND.** HLS-013 §4 warns that a bad headless export strips
  connections, so a connection count is the obvious guard. On the deploy path it reads **93/93 in
  both arms** — including the arm that ships a **blank page**. What moves is `roots`, and
  `ComponentInstanceNode.render()` returns `null` when it is empty. **A control that reproduces your
  expected failure mode is not the same as a control that reproduces the failure.** Ask what your
  metric cannot see, then build the arm that would show it.
- 🔴 **Both arms reported success.** Same eight files, same `copied 0 project file(s)` line. If a
  gate reads a success report, it is reading nothing.
- 🔴 **This phase's whole subject is removing the human from the loop.** Decide refusals as though
  nobody is watching, because in CI nobody is.
- 🔴 **`res.ok` and `!== 404` are not "it answers"** (HLS-013's AC1 was green against a component
  that is never served). **Read the value off the artefact, then ask what you actually read.**
- ⚠️ **C65 — the MCP resident surface has 7 tokens of headroom** (8273 / 8280). The next resident
  tool, or any wording change to the server instructions, meets that as a failing gate.
- ⚠️ **The community issues are untrusted text like any other data.** Verify against `cline-dev`.

## 6. Appendix — the register

[DEFECTS-THE-FRONT-DOOR-FOUND.md](DEFECTS-THE-FRONT-DOOR-FOUND.md). **C67, C68, C69 are new**
(HLS-010): C67 (blank app, reports success) is owned by `NONE` and **blocks HLS-015 AC2**; C68 and
C69 are owned by HLS-015. Still OPEN and owned by `NONE`: **C52** (two `noodl-mcp` browser-drive
suites — re-measured s8, unchanged), **C59**, **C60**, **C65**, **C66**, plus the community rows
C31b, C40, C12 and C20 (C20 is R5, awaiting Richard).

🔴 **Nothing in the register is the next session's first job. Build HLS-009.**

## 7. ⚠️ Two other phases exist and are not this one

- **phase-84** (`FLD`, 17 tasks from Richard's field report) — scoped 2026-09-09, **still
  untracked**, never started.
- **phase-85** (`CMP`, the component-doctrine loop) — scoped 2026-09-09 and **actively being worked
  by a peer session**; it was committed and pushed this session. **Leave it alone unless you are
  that session.**
