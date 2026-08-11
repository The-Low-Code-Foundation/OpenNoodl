# Phase 62 — three of six, and the next task is blocked on a decision, not on code

**Written:** 2026-08-11, by the session that built BST-004. It supersedes the handover written
earlier the same night by the BST-001/006 session — that one is history, and **§3 of it is now
spent**: it sends you to build BST-004, which is built, and it describes `bst-lane` as ready for
work that has since happened somewhere else.

**This is the live prompt.**

---

## §0 — The gates, and what each one is actually worth

🔴 **`npm run test:ci` is not the gate. It is one gate.** Three run, they cover different things, and
two of them were measured tonight rather than inherited.

| Gate | Floor, measured 2026-08-11 |
|---|---|
| `npm run test:ci` | **`Jasmine: 2670 specs, 6 failures`** |
| `cd packages/noodl-mcp && npx jest` | **1 failed / 405 passed of 406** — F65, DEBT-009's byte cap at 30,365 |
| `cd packages/noodl-editor && npx jest --config jest.config.js` | **127 suites / 1798 tests, all green** — no floor, any red is yours |

The six `test:ci` failures **by name**, because 6 → 12 has two routes and only the names separate
them:

```
AIX-006 style vocabulary  AIB-009 F11: a provider that stalls during the style pass …
AIX-006 style vocabulary  a style suggestion never downgrades a valid authoring …
AIX-006 style vocabulary  with guidance off, a raw candidate is accepted immediately …
AIX-006 style vocabulary  offers one advisory style pass on a valid-but-raw candidate …
AI model registry         has exactly one default per provider that owns models
AI model registry         treats openai-compatible as sharing the OpenAI catalogue
```

All six are provider/model-catalogue drift. `grep -n "^  FAILED:" <log>` and compare that list.

⚠️ **The exit code lies, and tonight it lied through the harness too.** The background-task
notification reported **exit code 0** for a `test:ci` run in which npm had exited **1** with six
failures. Only the `Jasmine:` line is true. Read that line and the `FAILED:` names; never the status.

⚠️ **`npx tsc --noEmit -p tsconfig.tests-main.json` in `noodl-editor` reports ~419 errors and always
has** — SCSS-module resolution noise in `noodl-core-ui`. It is not a gate. Filter to your own files.
🔴 And do not baseline it by stashing: `git stash` without `-u` leaves untracked files, so the
"before" run compiles your new tests against the old source and reports a *higher* count than the
after. That happened tonight (426 before, 419 after). Filter by filename instead.

Unchanged and still true:

- ⚠️ `npm run dev:stop --list` **kills** (npm swallows the flag); `node scripts/devtools/dev-processes.js --list`
  is a **silent no-op**; the one correct spelling is `npm run dev:stop -- --list`.
- ⚠️ `test:ci` beside a live dev stack manufactures phantoms. Stop it first. It self-terminates at 15
  minutes.

## §1 — Where things stand

`cline-dev` is **`ab8e5c1e`**. **Working tree clean.** `origin/cline-dev` is **228 behind** at
`9ba239cf` and has still not been pushed.

| Phase | State |
|---|---|
| **54** — design groundwork | ✅ closed 7/7. Only §4's Richard items remain |
| **50** — legibility (LEG) | **4 of 7.** LEG-003/004/006/007 in; **LEG-001, 002, 005 open** |
| **62** — cold start (BST) | **3 of 6.** BST-001, 006 (`6c4dc372`) and **004 (`ab8e5c1e`)** in; **002, 003, 005 open** |

## §2 — What BST-004 landed, and the two things it deliberately did not

`ab8e5c1e`, editor only — `packages/noodl-mcp` untouched. Full account in
[NOTES-BST-004.md](NOTES-BST-004.md).

Main now reports a `runtime` on the `mcp:front-door` answer, on the model of `entry` and `probed`;
`mcpCommands.ts` chooses from it and **nothing in the renderer probes the machine**. `node` when
there is one — character for character the command that shipped — and NodeGX's own Electron when
there is not, **named in the panel** rather than substituted silently.

🔴 **Two things it deliberately did not do. Neither is an oversight:**

1. **The settings prose was not corrected.** It still says *"The authoring server works inside a
   project that already exists; it will not make you one"* — F70's sentence in a second place, made
   false by BST-001. **BST-003 §4 owns that rewrite**, and editing it here would have collided.
2. **Windows was not driven.** No machine. The path *string* is asserted (`quoteArg` already handled
   `C:\Program Files\…`, which was MCP-001's tested behaviour); that `NodeGX.exe` under
   `ELECTRON_RUN_AS_NODE=1` spawns and speaks clean stdio is **an expectation, not a measurement**.

⚠️ **And one thing it did that BST-003 needs to know about:** `buildBootstrapCommand(frontDoor)` is
new and it is **already exactly BST-003 §3's string** — server name `nodegx` unsuffixed, no project
path, always-Electron, `--allow-writes`. It was driven end to end: registered in a real client,
`✔ Connected`, `tools/list` answered all five bootstrap tools.

🔴 **`buildMcpCommands` will not serve BST-003.** It refuses to emit without a project by design
(*"Open a project first… that path is half the command"*), which is right for a row *about* a project
and exactly wrong for a card whose whole premise is that there isn't one. Use the new function; do
not loosen the old one.

## §3 — What a next session should pick up

**BST-003 — but read §2 of its spec before writing anything, because it opens with a decision that
is Richard's and it blocks the task.**

Three shapes for what the card's button does: **A** copy a command, **B** run `claude mcp add` for
them, **C** write the client's config file directly. The spec recommends **B, with A as the visible
fallback and C refused**, and the reasoning is sound: C trades a legible dependency for an invisible
one, writing another application's undocumented schema, and a malformed write breaks a tool the user
was already using successfully.

🔴 **F14 decides it and F14 is still unverified:** *does a Claude Code **desktop app** user have the
`claude` CLI on PATH?* If they do not, B's failure path is the common case rather than the edge, and
the card is mostly A wearing a button.

⚠️ **Measure that before asking Richard, not after.** It is the same shape as F79 below — an
assumption about what is on a stranger's PATH — and it is cheap. It is also the one question whose
answer changes which product gets built.

**Everything else in BST-003 is unblocked and can be built while that sits:** the command string
already exists, the launcher card's placement is settled (`ProjectsPage.tsx`, **visible with zero
projects**), and §4's two settings-copy edits are pure correction.

⚠️ **Its last acceptance is a consequence, not a mechanism:** after the click, a fresh Claude Code
session *in a folder with nothing to do with NodeGX* can answer "what can you do with NodeGX?" from
the server's own instructions. **A successful `claude mcp add` is not the deliverable** — that is the
thing this phase has already been caught reporting as success once.

### The alternatives

- **BST-005**, which wants BST-004's answer for `.mcp.json`'s `"command"` and now has it. It has an
  escape hatch that is better than the answer: write it from the server's own `process.argv[1]`,
  correct by construction.
- **BST-002**, the flagship. The previous handover's three landmines are unchanged and still exact:
  `ProjectBinding.bind()` plus the disclosure reveal in one commit; `BOOTSTRAP_INSTRUCTIONS`' closing
  sentence is asserted on purpose so the task cannot land without meeting it; and 🔴 **`find_tools`'
  description is chosen at REGISTRATION from the mode**, so a server that binds mid-session leaves
  the stale bootstrap description advertised — `RegisteredTool.update()` is the mechanism, and it is
  the one of the three that gets missed. Over all of it: **`instructions` is fixed at `initialize`**,
  so project-bound guidance must travel in tool results, and no gate can see that it didn't.
- **Finish phase 50.** Three left. 🔴 **LEG-001 is blocked and the blocker is recorded**: `toJSON`
  passes `metadata` **by reference**, so a pasted node shares its source's bag. Fix `clone()` first.
- **Housekeeping:** push `cline-dev` (228 ahead); `git worktree prune` (~20 stale entries, most cut
  into per-session temp directories that no longer exist); decide about `nightly-to-main`'s one real
  commit `77d4920b`.

## §4 — What needs Richard, not a session

- 🔴 **BST-003 §2's decision** — A, B or C. See §3. **Measure F14 first.**
- 🔴 **BST-006's last acceptance, still unrun.** A fresh agent with only the unbound server, asked
  *"open my app"*, should call `list_projects` and not `create_project`. Two blockers, both
  decisions: `scripts/devtools/mcp-model-driver.js` requires `--project` and needs a no-project mode,
  and **a drive costs money**. ⚠️ Until it runs, BST-006 is *built* and its ordering claim is
  *unmeasured*.
- **F65** — the MCP byte cap, the one red in the `noodl-mcp` suite. 🔴 The mechanism is structural,
  not an overshoot: summary mode does `s.examples = full.examples` verbatim and the corpus is *meant*
  to grow. Raising it to 31,000 buys until the next recipe; bounding the list per type is the fix
  that holds.
- **`§9`'s prose**, **F51** (a destructive-text token that passes AA), **the 25% accent ceiling**
  (`ACCENT_CEILING` in `score-design.js`), **F33** (a copied project directory inherits its parent's
  id) — all unchanged from the previous handover.
- 🟠 **New, and small:** your real `nodegx-observe` registration reports **`✘ Failed to connect`** in
  `claude mcp list`. Noticed while health-checking something else; it points at
  `/Applications/NodeGX.app/…`, not this checkout. Not investigated (F82).

## §5 — Register, new this session

F1–F64 in the phase-54 files; F65–F69 in the first handover; F70–F77 in the second. Full text for
these in [NOTES-BST-004.md](NOTES-BST-004.md).

| # | Finding | State |
|---|---|---|
| F78 | 🔴 **`-e/--env` is variadic, so placed before the server name it eats the name.** The first emitted command did not merely misbehave — it **failed to register at all**: `Invalid environment variable format: nodegx`. The flag goes *after* the name, as the CLI's own example shows. **No amount of reading the string reveals this**, which is exactly why the acceptance said *verify inside a real client* | ✅ fixed and asserted by index |
| F79 | 🔴 **The obvious node probe answers backwards on the machine that matters most.** A Finder-launched mac inherits `PATH=/usr/bin:/bin:/usr/sbin:/sbin` and never reads `.zshrc`. On this machine node is at `~/.nvm/…`, so `spawnSync('node')` returns ENOENT **for an nvm user — the person most likely to have one** — which would have swapped the shipped command on machines that already worked. Two probes now: process PATH (~17ms), then `$SHELL -lic` (~2.3s, cached, warmed off the synchronous IPC handler) | ✅ built |
| F80 | 🔴 **`ELECTRON_RUN_AS_NODE` is load-bearing and every naive test says otherwise.** Without it the binary boots a full Electron *app* (`process.type === 'browser'`, dock icon, an event loop that never exits) and **still serves stdio correctly**. ⚠️ **Claude Code's own host process exports it** — it was already `1` in this session's shell — so every negative control needs an explicit `env -u` or it is contaminated. The repo already knew: `start.ts`, `test-editor.ts`, `dev-debug.js` and `run-electron-tests.js` all delete it on the way past | ✅ asserted at both ends |
| F18 | Electron-as-Node stdout is byte-clean for stdio MCP — **the risk that could have invalidated the whole task** | ✅ **verified**: 8258 bytes stdout and 208 stderr, byte-identical to plain `node` over `initialize` + `tools/list` |
| F19 | `claude mcp add` supports `-e/--env`; the shim-script fallback is not needed | ✅ verified |
| F81 | ⚠️ **`buildMcpCommands` cannot serve BST-003** — it refuses without a project by design. `buildBootstrapCommand` is the separate command, and it is built and driven | ✅ built |
| F82 | ⚠️ The real `nodegx-observe` registration reports `✘ Failed to connect`. Not this task's; filed | 🟠 filed |
| F83 | 🟠 **F70's sentence lives in a second place** — the settings panel still says the server *"will not make you one"*. Left deliberately for BST-003 §4, which rewrites that copy. **A structural change has a documentation half, and it is never in only one file** | 🟠 filed for BST-003 |
| F84 | ⚠️ **A backgrounded command's completion notification reported exit 0 for a run that exited 1** with six test failures. The old rule ("the exit code lies") now has a second door: the *harness's* status is as untrustworthy as the shell's. Only the `Jasmine:` line counts | 🟠 recorded |

## §6 — Running this in two lanes

⚠️ **Both worktrees are stale.** They sit at `b56e1f43`, two commits behind. Before using either:

```
git -C ../OpenNoodl-worktrees/<lane> merge --ff-only cline-dev
```

| Lane | Path | Branch | Work |
|---|---|---|---|
| **A** | `../OpenNoodl-worktrees/bst-lane` | `bst-lane` | ~~BST-004~~ → **BST-003** (decision-gated) → BST-005 |
| **B** | `../OpenNoodl-worktrees/leg-lane` | `leg-lane` | the `clone()` fix → LEG-001 → 002 → 005 |

🔴 **Lane A's premise has weakened.** BST-003 is decision-gated and its live half is a **launcher
UI** — and rule 3 below puts editor live verification in the primary. What is left for a lane there
is the command string (already built) and the settings-copy edits. **Consider running BST-003 in the
primary and giving lane A to BST-005**, which is self-contained.

The axis that pays is still **62 is `noodl-mcp`, 50 is editor** — except that BST-003, BST-004 and
BST-005 are all *editor* tasks, so that separation no longer holds within phase 62. Two lanes remain
the ceiling; the reason is the gates, not the agent count.

### The rules that keep it from costing more than it saves

1. 🔴 **Do NOT use the harness's `isolation: "worktree"`.** It creates the branch from `origin/main`
   — hundreds of commits behind, no `dev-docs/` at all. Seven batches out of seven. Launch
   **non-isolated** agents pinned to the absolute paths above, with `-C <path>` on every git command
   and the primary checkout off limits for edits.
2. 🔴 **One full gate at a time.** Two concurrent `test:main` runs manufacture failures, and
   `start.ts` sweeps leftover processes, so one lane's `test:ci` reaps the other's stack. Lanes run
   their **package-local** suite only. **The orchestrator runs `test:ci` once, at merge, from the
   primary.**
3. 🔴 **`lerna exec` runs the PRIMARY checkout's source**, so `dev:debug` and `test:ci` launched from
   a worktree exercise primary's code and report a result unrelated to the diff. **Editor live
   verification belongs to the primary, after merging.**
4. ⚠️ **Never `npm install` in a worktree**, and **never `dev:stop`** (it kills by checkout and
   matches a running `test:ci` Electron too).
5. ⚠️ **Every agent commits on its own branch before reporting.** An uncommitted agent produced
   nothing.
6. ⚠️ **Never give two agents the same task from different angles.** Already paid for.
7. ⚠️ **Reserve this file and `TASKS.md` for the orchestrator**; give each lane its own NOTES file.
8. ⚠️ **Agents cannot see uncommitted work** — a worktree branches from a *commit*. One previously
   declared two real files "phantoms" and deleted them. **Verify any destructive claim against the
   primary before merging it.**

### Refreshing or rebuilding a lane

`scripts/devtools/make-worktree.sh <name> [base] [parent]`. It does the whole thing and **verifies
before it exits**. Cut into `../OpenNoodl-worktrees/`, **never a session scratchpad** — that is why
`git worktree list` carries ~20 stale entries.

🔴 **Two traps it handles, both of which fake a result:** the **dual-load trap** (symlinking
`node_modules` wholesale makes `@noodl/runtime` resolve through primary's relative symlink, so
`collection.ts` loads twice and throws *"Cannot redefine property: items"* — a whole suite fails and
reads like a real defect; note there are **two** scopes, `@noodl` **and** `@nodegx`), and the
**silent-skip trap** (build artifacts are gitignored and some suites do
`existsSync(...) ? describe : describe.skip`, so a fresh worktree reported `1 failed, 356 passed`
where primary reports `1 failed, 405 passed` — **49 tests silently absent, and the number still
looks like a pass**). ⚠️ **Compare a lane's TOTAL to primary's, never its failure count.**
