# BST-004 — built 2026-08-11

**What shipped:** the emitted `claude mcp add` command now names a runtime that exists on the
machine it was emitted from. `node` when there is one — character for character the command that
shipped — and NodeGX's own bundled Electron when there is not, named rather than substituted
silently.

Editor only: `packages/noodl-editor`. `packages/noodl-mcp` untouched.

## The three risks §1 named, answered before anything was written

| # | Risk | Answer |
|---|---|---|
| **F18** | 🔴 *"Electron-as-Node keeps stdout clean enough for stdio MCP"* — **unverified, and it can invalidate the whole task** | ✅ **Byte-identical.** Both runtimes produced the same 8258-byte stdout and the same 208-byte stderr across `initialize` + `tools/list`. `diff` of the two captures: no output |
| **F19** | ⚠️ *"`claude mcp add` supports `--env`"* — unverified; fallback was a shim script | ✅ Supported: `-e, --env <env...>`. **No shim needed** — but see F78, the flag is not free |
| **F17** | `extraResources` puts the bundles outside the asar for an external `node` | ✅ Unchanged. An Electron-as-Node process reads them identically; nothing about packaging moved |

## Acceptance

| Criterion | State |
|---|---|
| The command **registers a server that actually spawns and answers `tools/list`** — in a real client, not by inspecting the string | ✅ **`✔ Connected`** from `claude mcp list` |
| Raw stdio is **byte-clean MCP** | ✅ byte-identical to plain `node` |
| Settings section **unchanged on a machine that has `node`**, character for character | ✅ asserted in `mcp-004/mcpRuntime.test.ts` |
| Where `node` is absent, the front door **says so**, and the fallback is **named not substituted** | ✅ `runtime.probed` + `row.runtimeNote`, rendered in the panel |
| Both runtimes chosen in `mcpCommands.ts` from **a field supplied by main**; no detection in the renderer | ✅ `frontDoor.runtime` |
| macOS **and Windows**, with a space in the install path | 🟠 **macOS driven end to end. Windows is asserted as a string only** — see §Unverified |

## 🔴 F78 — the ordering bug only a real client could find

The first emitted command **failed to register at all**:

```
Invalid environment variable format: nodegx
```

`-e, --env <env...>` is **variadic**. Placed before the server name — the natural spot, beside
`--scope`, where every other option goes — it swallows the name as a second variable. The CLI's own
documented example puts it *after* (`claude mcp add my-server -e API_KEY=xxx -- npx …`), and that is
the only order that parses.

⚠️ **Nothing about reading the string reveals this**, and it is the second time this task's own
premise bit: a command that looks completely correct and does not work. It is exactly why the
acceptance says *verify inside a real client*. Now asserted by name and by index in
`mcpRuntime.test.ts`.

## 🔴 F79 — the naive node probe answers backwards on the machine that matters most

`spawnSync('node')` from the app's own process is wrong, and wrong in the expensive direction.

- A macOS app launched from **Finder or the Dock** inherits `PATH=/usr/bin:/bin:/usr/sbin:/sbin`.
  It never reads `.zshrc`, so it sees neither Homebrew nor nvm.
- Measured on this machine: `node` is at `~/.nvm/versions/node/v22.22.0/bin/node`, put there
  **purely by a shell rc file**. The fast probe returns **ENOENT**; `zsh -lic 'command -v node'`
  finds it.

So the naive probe reports *"no node"* for a developer with nvm — the person **most** likely to have
one — and would have swapped the shipped, legible `node <path>` command for the strange one on a
machine that never needed it. That is the regression the acceptance explicitly forbids.

Hence two probes in cost order: this process's PATH (~17ms, right whenever the editor was started
from a terminal), then the login shell (~2.3s, and the only one that answers the question actually
being asked — the command is pasted into *that* shell). The slow one is cached for the life of the
process and warmed off the critical path by `warmNodeRuntime()`, because the IPC handler is
synchronous and would otherwise freeze the settings panel for 2.3s on exactly those machines.

⚠️ **`nodePath` is evidence, not the command.** Even when only the login shell finds node, the
emitted command says the bare word `node`: it is pasted into that same shell, where it resolves, and
baking in `~/.nvm/versions/node/v22.22.0/bin/node` would break on the next `nvm use`.

## 🔴 F80 — `ELECTRON_RUN_AS_NODE` is load-bearing and the naive test says otherwise

Without the variable, the binary boots as a **full Electron app** — `process.type === 'browser'`,
`process.defaultApp === true`, a dock icon, a GUI event loop that never exits — and **still serves
stdio correctly**. A probe that forgot the variable would pass.

| | `process.type` | `versions.electron` |
|---|---|---|
| plain `node` | `null` | `null` |
| `ELECTRON_RUN_AS_NODE=1` | `null` | `43.2.0` |
| no env var | **`browser`** | `43.2.0` |

⚠️ **And the measuring environment lies.** `ELECTRON_RUN_AS_NODE=1` is exported by VS Code's
integrated terminal **and by Claude Code's own host process** — it was already `1` in this session's
shell. Every negative control here needed an explicit `env -u`, and the repo already knows this:
`scripts/start.ts`, `test-editor.ts`, `dev-debug.js` and `run-electron-tests.js` all delete it on the
way past. A session that measures this without stripping it will conclude the flag is decoration.

## What BST-003 should use, and one thing it must not assume

`buildBootstrapCommand(frontDoor)` — **new, and it is the string BST-004 exists to decide.**

🔴 **`buildMcpCommands` will not serve BST-003.** It refuses to emit without a project
(*"Open a project first… that path is half the command"*), which is right for a settings row *about*
a project and exactly wrong for the launcher card, whose whole premise is that there isn't one.
`buildBootstrapCommand` is the separate command: server name `nodegx`, no project directory,
**always Electron**, and `--allow-writes` — without which `create_project` is write-gated and the
one tool the card exists to reach refuses.

Verified end to end at bootstrap, with **no project bound**: registered, `✔ Connected`, and
`tools/list` answered all five tools.

## Unverified, and deliberately so

- 🟠 **Windows.** No Windows machine here. The path form is asserted in the suite (`quoteArg` wraps
  `C:\Program Files\NodeGX\NodeGX.exe` without escaping its separators, which was already MCP-001's
  tested behaviour), and the runtime choice is platform-independent. **What is untested is that
  `NodeGX.exe` under `ELECTRON_RUN_AS_NODE=1` spawns and speaks clean stdio.** F18 held on macOS;
  there is no reason to expect otherwise, and that is a expectation, not a measurement.
  ⚠️ The login-shell probe is deliberately **not** run on Windows — a GUI process there inherits the
  user's real `PATH`, so the fast probe is already correct.
- 🟠 **The settings panel was not driven live.** The runtime note is rendered from
  `row.runtimeNote` through the existing `.Provenance` class; the string and the choice behind it are
  unit-tested, the pixels are not.

## Gates

| Gate | Result |
|---|---|
| `npm run test:ci` | ✅ **`Jasmine: 2670 specs, 6 failures`** — the documented floor, **by name** |
| `npx jest --config jest.config.js` (noodl-editor: `tests-main` + `tests-unit`) | ✅ **127 suites / 1798 tests, all passing** — was 124 / 1774 |
| `cd packages/noodl-mcp && npx jest` | ✅ **1 failed / 405 passed of 406** — the floor, unmoved (F65's byte cap) |
| `npx tsc --noEmit -p tsconfig.tests-main.json` | 419 errors, **none in any file this task touched**; all pre-existing SCSS-module noise in `noodl-core-ui` |

The six `test:ci` failures, compared **by name** rather than by count — 6 → 12 has two routes and only
the names separate them:

```
AIX-006 style vocabulary  AIB-009 F11: a provider that stalls during the style pass …
AIX-006 style vocabulary  a style suggestion never downgrades a valid authoring …
AIX-006 style vocabulary  with guidance off, a raw candidate is accepted immediately …
AIX-006 style vocabulary  offers one advisory style pass on a valid-but-raw candidate …
AI model registry         has exactly one default per provider that owns models
AI model registry         treats openai-compatible as sharing the OpenAI catalogue
```

All six are provider/model-catalogue drift. None touches MCP, the front door, or command building.

⚠️ **The backgrounded exit code reported `0` while npm had exited `1`.** Only the `Jasmine:` line was
true. The suite lies three ways and this was the third; the run was read from that line and the
`FAILED:` names, never from the status.

⚠️ The `tsc` baseline is **426 with the changes stashed**, which is *higher* than the 419 after.
`git stash` without `-u` leaves untracked files, so the baseline run compiled the new tests against
the old source. The honest number is the filtered one: **zero errors in BST-004's files.**

## Register

| # | Finding | State |
|---|---|---|
| F18 | Electron-as-Node stdout is byte-clean for stdio MCP — **the risk that could invalidate the task** | ✅ **verified**, byte-identical over `initialize` + `tools/list` |
| F19 | `claude mcp add` supports `-e/--env`; the shim-script fallback is not needed | ✅ verified |
| F78 | 🔴 **`-e` is variadic and eats the server name when placed before it.** The registration fails outright with `Invalid environment variable format`. Invisible to any amount of reading the string | ✅ fixed and asserted |
| F79 | 🔴 **The naive `spawnSync('node')` probe answers "no node" for an nvm user**, because a Finder-launched mac never reads `.zshrc` — under-detecting on precisely the developer machines that already worked | ✅ two probes, login-shell fallback, cached and warmed |
| F80 | 🔴 **Without `ELECTRON_RUN_AS_NODE` the binary boots a GUI app and serves stdio anyway**, so the flag reads as decoration. ⚠️ **Claude Code's own host exports it**, so the measuring environment must be stripped with `env -u` or every control is contaminated | ✅ asserted; documented at both ends |
| F81 | ⚠️ **`buildMcpCommands` cannot serve BST-003** — it refuses without a project by design. The launcher card needs `buildBootstrapCommand`, which is what this task adds | ✅ built and driven |
| F82 | ⚠️ **Richard's real `nodegx-observe` registration reports `✘ Failed to connect`** in `claude mcp list`. Noticed in passing while health-checking; it points at `/Applications/NodeGX.app/…`, not this checkout. **Not investigated — not this task's** | 🟠 filed |
| F83 | 🟠 **The settings panel still says *"The authoring server works inside a project that already exists; it will not make you one."*** That is F70's sentence, in a second place, and BST-001 made it false. Left alone deliberately: BST-003 rewrites this copy, and changing it here would collide. **A structural change has a documentation half, and it is never in only one file** | 🟠 filed for BST-003 |
