# Phase 66 — CLOSED 2026-08-18 (s63)

**This is the close-out, not a handover. There is no next session for this phase.**
Written by session 63, replacing the closing brief it was handed.

## ✅ The phase is complete

**24 tasks accounted for: 23 closed here, and FIX-015 deliberately left for its own phase.**
⚠️ **Count the names in `TASKS.md`; never copy that total.** This phase's index drifted out of
agreement with its own task files once already (`TASKS.md` § *"reconciled 2026-08-16"*), and the
drift ran in the direction of advertising finished work as outstanding.

**FIX-021 was the last one open**, and it closed on its editor half:

| Half | Driven | Where |
|---|---|---|
| MCP **server** end | ✅ **4/4**, s62 | `get_project_info` over real stdio — absent with no env var, absent with the pristine seeded template, **present** with headings answered, present on a read-only server |
| **Editor** end | ✅ **3/3 + a control**, s63 | `Connect Claude Code` clicked on the real launcher; the **real `~/.claude.json`** read before and after |

🔴 **The observation that carried the most weight was the control, not the feature.**
`ELECTRON_RUN_AS_NODE` is still present beside the new `NODEGX_USER_PREFERENCES`. A registration
that *replaced* the env record instead of extending it passes any probe that checks only the new
key, and leaves a server booting a GUI app with a dock icon (BST-004/F80).

Full evidence, instruments and rows: **`FIX-021-THE-PROJECT-THAT-KNOWS-ITS-BUILDER.md`**, final
section. Per-task status: **`TASKS.md`**. Phase framing: **`README.md`**.

## 🔴 What did NOT ship — and is not a defect

- **FIX-015** produced rulings and a **green-lit successor phase**, not code. ⚠️ **Its slice 1 is
  "build and test the panel."** It is not an unfinished P66 task; do not count it as one.
- **FIX-021 slice A** was **RULED OUT** at Q2 (one file), **not deferred.** Proposing it is
  proposing to overturn a ruling.

## Carried out of the phase — real, unowned, and nobody is holding them

Each of these was measured inside P66 and is **not** covered by any P66 acceptance criterion. They
need an owner, not a re-investigation.

- ⚠️ **The editor's `.mcp.json` backfill is specced but never driven.** There are **two** writers:
  `noodl-mcp`'s `create_project` (inherits the variable from its environment — **this one is
  driven**), and the **editor's** backfill on project open (`utils/LocalProjectsModel.ts:142` →
  `models/template/agentConfig.ts`), which reaches the path via the **front door** instead
  (`withUserProfile`, `mcpCommands.ts:287,468`). Spec cover exists at
  `tests-unit/mcp-001/mcpCommands.test.ts:362`. 🔴 **`withUserProfile` returns the runtime unchanged
  when the front door has no path — the key is dropped silently and nothing grades that branch
  end-to-end.** One drive for whoever next has an editor open.
- ⚠️ **`claudeMcpAdd` does not quote its `-e` pairs — DISPLAY ONLY.** `connectBootstrapServer` uses
  `spawnSync(exec, cliArgs(registration))`, an argv array with no shell
  (`connectBootstrapServer.js:193-196`), and Richard's own path contains a space, which is the worst
  case. Cosmetic; wants its own small task.
- 🆕 **The Connect success message overstates what happened.** It said an earlier registration
  *"pointed somewhere else and was replaced"*, but `command` and `args` were **byte-identical**
  before and after — only `env` changed. A user reading it would think their server was repointed.
  Pairs naturally with the `claudeMcpAdd` display defect.
- 🔴 **A bar that teaches `define()`** (s50) — needs the node's **real** port list behind
  `parser.getPorts()`, i.e. a syntax-tree parse. ⚠️ **Not covered by FIX-016's AC1 retirement**, and
  the mining slice is *not* retired: `modeHasDeclaredPorts` stays `true` for `'script'`.
- ⚠️ **A Script node's `define()`-declared ports are invisible to every editor surface** (s50).
- 🔴 **`io-error: Unexpected failure: ${err.message}` names neither the tool nor the project.**
- ⚠️ **A missing `id` has the identical shape to FIX-023's missing `type`, and is unguarded.**
- ⚠️ **`noodl-core-ui` cannot be eslinted at all** — `eslintConfig` extends an uninstalled
  `react-app`; every file fails identically. Pre-existing, confirmed against an untouched control.
- ⚠️ **The PLANNING turn does not carry the profile** — only the authoring turn does, as Q5 specified.
- 🔴 **Blockly should enumerate declared globals as draggable blocks** — App Variables, Objects,
  Arrays, plus `Function Variables`. ✅ Blockly's own native model.

## Owed by Richard, outside this phase

- 🔴 **The Anthropic credit balance is exhausted.** ⚠️ Nothing in P66's close needed it.
- 🔴 **`scripts/library/check.ts` — LAND IT.** Phase 65's work, still uncommitted in the tree.
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`.
- ⚠️ **`package-lock.json`'s `@nodegx/kit-scaffold` line** — phase 69 should confirm it.
- ⚠️ **The 0.1.7 repackage was BUILT, LEFT IN `dist/`, NOT INSTALLED** (ruled s59). So
  `nodegx-puppy-test-3` still resolves to the Aug-13 bundle. **Do not install it without asking.**

## What this session measured about the environment, because it decides whether a drive is possible

✅ **The drive itself is ~10 minutes. Getting a renderer is the whole risk.**

| | s62 | s63 |
|---|---|---|
| load average at launch | **23–53** | **6.8** |
| renderer first compile | **998 s**, then a permanent wedge | **208 s**, clean |
| outcome | no renderer in ~1h40m | mounted, drove, closed the phase |

🔴 **Two structural hazards of the shared checkout, both still live.** `start.ts` calls
`reapPreviousSession()`, so **a peer's `npm run dev` kills your stack**; and with `hot: true` a peer
edit *after* Electron launches can wedge the bundle permanently (`cdp reload` does **not** recover
it). ✅ **What actually worked was announcing the launch and asking the peer to hold** — a peer
messaged mid-compile saying they were about to launch, held on request, and the drive survived.
⚠️ **`curl` of `/src/editor/index.bundle.js` returning `000` is also what your own probe logs look
like** (`wait until bundle finished`) — do not read your own diagnostic as the wedge.

## Notes for whoever reads this next

- ⚠️ **`--quiet` writes to `.logs/dev.log` ONLY.** Watching the launcher's stdout for
  `launching Electron` finds nothing, because there is nothing there.
- 🔴 **`PREFERENCES.md`'s `c3c8425…` is a `sha1`**, not md5. Stating the algorithm would have saved
  two sessions a few minutes each.
- 🔴 **Never restore `~/.claude.json` wholesale.** ~25 live sessions rewrite it continuously; compare
  and repair the **`mcpServers` section** only. This session compared per-server: two identical, one
  changed — which is exactly and only what the drive was for.
