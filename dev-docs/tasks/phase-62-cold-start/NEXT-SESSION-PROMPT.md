# Phase 62 — two of six in, and a gate whose floor just moved

**Written:** 2026-08-11, late, by the session that built BST-001 and BST-006. It supersedes the
handover written earlier the same night — that one is history, and **§0 and §5 of it are now wrong**
in ways that would cost a session: it quotes an MCP suite baseline of 366 that is now 405, and it
sends you to build the two tasks below, which are built.

**This is the live prompt.**

---

## §0 — The gates, and the two numbers that just changed

🔴 **`npm run test:ci` is not the gate. It is one gate.** The noodl-mcp suite is **still red** and has
been since `89cf26cb` — DSG-003's recipe commit, which landed the evening phase 54 was declared
closed. `catalog:examples`, `catalog:tokens` and `catalog:merge:check` were all green; none of them
reads the thing that broke. It is in `test:packages`, not `test:ci`.

```
cd packages/noodl-mcp && npx jest       # expect 1 failed / 405 passed of 406
```

⚠️ **That floor moved tonight.** It was 366 of 367 for the whole of the previous handover; BST-001/006
added 39 specs. **The one failure is the same one** — `tools.test.ts`, DEBT-009's 30,000-byte
`get_node_type` summary cap, at 30,365. Anything else in that list is yours.

⚠️ **`npx tsc --noEmit` in that package has 7 errors in `tests/` and 0 in `src/`.** They are
pre-existing (`interfaceGate`, `stagingDiagnostics`, `connectionPresentation`), confirmed by stashing
and re-running. **Count `^src/` only**, or you will spend an hour on somebody else's.

Unchanged and still true, all of it:

- 🔴 **When `test:ci` is red, compare the failure NAMES, never the count.** 6 → 12 has two different
  routes and only the names separate them. `grep -n "^  FAILED:" <log>`.
- ⚠️ **The exit code lies.** Only the `Jasmine:` line counts.
- ⚠️ `npm run dev:stop --list` **kills** (npm swallows the flag); `node scripts/devtools/dev-processes.js --list`
  is a **silent no-op**; the one correct spelling is `npm run dev:stop -- --list`.

## §1 — Where things stand

`cline-dev` is `6c4dc372`. **Working tree clean.** `origin/cline-dev` is **225 behind** at `9ba239cf`
and has not been pushed.

| Phase | State |
|---|---|
| **54** — design groundwork | ✅ closed 7/7. Only §4's Richard items remain |
| **50** — legibility (LEG) | **4 of 7.** LEG-003/004/006/007 in; **LEG-001, 002, 005 open** |
| **62** — cold start (BST) | **2 of 6.** BST-001 ⭐ and BST-006 in (`6c4dc372`); **002, 003, 004, 005 open** |

Branches: `wt-trial54` is stale and holds zero unlanded content (verified by tree diff, both
directions) — it and the four `leg-*` worktrees can be pruned. `nightly-to-main` is one real
unmerged commit, `77d4920b`, a packaged nightly workflow aimed at `main`. Somebody should decide
about it.

**Two live worktrees are cut and waiting** at `../OpenNoodl-worktrees/{bst-lane,leg-lane}`, both from
`b56e1f43`, both verified against a real suite run. See §6.

## §2 — What landed, and what it did NOT do

`6c4dc372`, `packages/noodl-mcp` only — **no editor file was touched**, so nothing in `test:ci`'s
scope moved. Full account in [NOTES-BST-001-006.md](NOTES-BST-001-006.md).

The server now starts with no project directory and advertises `list_projects`, `create_project`,
`list_examples`, `get_example` and `find_tools`. The store sits behind a `ProjectBinding`; everything
registers in both modes and a *policy* decides what is advertised, so a later bind touches one
object. Both briefings moved to `src/instructions.ts` and the bound one is pinned character for
character against fixtures captured before the move.

🔴 **Three things it deliberately did not do. Do not "fix" any of them as oversights:**

1. **`tools/list` is FIVE names, not four.** BST-001's acceptance says "exactly the four bootstrap
   tools"; its §3 designs `find_tools`' unbound behaviour. Both cannot be true. §3 won — an absent
   `find_tools` answers a returning model *"unknown tool"*, a dead end that names no fix.
2. **`ProjectBinding.bind()` was not written.** §1 sketches it for BST-002. A `bind()` with no caller
   binds the store and leaves the surface at four tools and the briefing at the bootstrap text — a
   half-mechanism the next session would call and be misled by.
3. 🔴 **BST-006's live-model acceptance was NOT run** — see §4.

## §3 — What a next session should pick up

**BST-004, then BST-003.** That order is the phase's own and it still holds: 004 is small,
independent, and **it decides the string 003 emits**, so doing it second means writing that command
twice. 003 is the on-ramp — the task that decides whether any of this is ever seen.

⚠️ **The registration BST-003 emits must carry `--allow-writes`.** `create_project` is write-gated,
so a bootstrap server without it can do nothing. The CLI now refuses that combination out loud with
the flag named, so the failure is at least visible in the client's MCP status rather than presenting
a connected server that cannot act — but the emitted string still has to be right.

### If BST-002 instead — the three places it must come back and change

It is the flagship and the phase delivers real value without it, which is why it is not first. When
it lands:

- **`ProjectBinding`** — add `bind()`, plus the disclosure reveal, in the same commit.
- **`BOOTSTRAP_INSTRUCTIONS`** ends *"the project is written to disk, and this server stays
  unbound"*. True today, false after BST-002. **`tests/instructions.test.ts` asserts that sentence on
  purpose**, so BST-002 cannot land without meeting it. The rule: 🔴 **don't promise a bind this
  build does not perform** — an agent told the tools are coming waits for tools that never arrive,
  and that looks like a hang, not an instruction.
- 🔴 **`find_tools`' description is chosen at REGISTRATION from the mode.** A server that binds
  mid-session leaves the stale bootstrap description advertised. `RegisteredTool.update()` is the
  mechanism, and this is the one of the three that gets missed.

⚠️ And the standing constraint that shapes the whole task: **`instructions` is fixed at `initialize`**
([`server.ts`](../../../packages/noodl-mcp/src/server.ts)). A server that binds mid-session cannot
rewrite its briefing, so project-bound guidance must travel in tool results. This is the phase's most
likely silent defect — the tools appear, the knowledge of how to use them does not, and no gate can
see it.

### The alternatives

- **Finish phase 50.** Three left. 🔴 **LEG-001 is blocked and the blocker is recorded**: `toJSON`
  passes `metadata` **by reference**, so a pasted node shares its source's bag and `toJSON` mutates
  the live node. Fix `clone()` before LEG-001 puts `comment` in there.
- **F65**, if Richard has ruled (§4). Half a day, and it un-reds a gate.
- **Housekeeping:** prune `wt-trial54` and the four `leg-*` worktrees; decide about
  `nightly-to-main`; push `cline-dev`, 225 ahead of its remote.

## §4 — What needs Richard, not a session

- 🔴 **BST-006's last acceptance, unrun.** A fresh agent with only the unbound server connected,
  asked *"open my app"*, should call `list_projects` and not `create_project`. What is asserted is
  the **ordering of the copy** — the mitigation, not the measurement. Two blockers, both decisions:
  `scripts/devtools/mcp-model-driver.js` requires `--project` and needs a no-project mode, and **a
  drive costs money**. ⚠️ Until it runs, BST-006 is *built* and its ordering claim is *unmeasured* —
  the same shape as phase 58's green cost row beside three failing criteria.
- **F65** — the MCP byte cap. 🔴 The mechanism is structural, not an overshoot: summary mode does
  `s.examples = full.examples` verbatim, and the corpus is *meant* to grow. Raising it to 31,000 buys
  until the next recipe; bounding the list per type is the fix that holds. It changes what the MCP
  surface returns, and that budget cost a session to get to 7.8k tokens/turn.
- **`§9`'s prose** — add identifiers, fix the two copy-pasted wrong sentences
  (`03-INTERACTION-AND-STATE.md:73` has the same error).
- **F51** — a destructive-text token that passes AA. `--destructive` on `--surface` is 3.60:1 at 14px.
- **The 25% accent ceiling** — the corpus cannot defend the number; `ACCENT_CEILING` in
  `score-design.js` is the one line.
- **F33** — a copied project directory inherits its parent's id. Refuse-and-explain is plausible;
  re-minting may be wrong, because "duplicate this project, same data" is legitimate.

## §5 — Register, new this session

F1–F64 are in the phase-54 files; F65–F69 in the previous handover. Full text for these in
[NOTES-BST-001-006.md](NOTES-BST-001-006.md).

| # | Finding | State |
|---|---|---|
| F70 | 🔴 **The README said the opposite of what shipped** — *"this server authors inside a project that already exists; it will not make you one"*, in the Quick start, the one sentence a stranger reads before configuring a client. 405 specs green, `tsc` clean, binary driven end to end, and the prose still described the old product. Found only because the tool tables were being checked for something else — which also revealed `create_project` had **never** been in them, since AIX-012. **A change to what a thing CAN do has a documentation half and no gate reads prose** | ✅ fixed; the *habit* is the finding |
| F71 | ⚠️ **24 of the 30 projects on this machine are legacy** (6 v2, 5 directories gone). Verified on disk. Marking rather than dropping them was right by a wide margin: dropping answers "you have 6 projects" to a user with 30, and the omission reads as "you have never built anything" — the answer that produces a duplicate | 🟠 design validated; the corpus is Richard's |
| F72 | ⚠️ **`--all-tools` had to be refused in bootstrap mode.** The flag exists for a client that ignores `list_changed` and there is nothing to change into, so honouring it would advertise 89 project tools on a server with no project — this mode's entire failure, in one flag | ✅ handled and asserted |
| F73 | ⚠️ **The bound briefing is now pinned to a byte** against three pre-move fixtures. Every paragraph answers a measured phase-55 failure and the replays were run against that exact wording; a reword would invalidate them silently. The fixtures are a record of a moment, not a spec — a deliberate change edits them in the same commit and the diff is the review | ✅ built |
| F74 | ⚠️ **`list_projects` must never return `thumbURI`** — every row in the launcher's store carries a base64 PNG, and a dozen is ~1 MB of tokens for a picture nothing in the loop can look at. The obvious implementation passes the row straight through | ✅ guarded |
| F76 | 🔴 **A gitignored build artifact makes 49 tests vanish, and the run still reads as a pass.** `noodl-mcp`'s provisioning and project-identity specs do `existsSync(nodegx-backend/dist/cli.js) ? describe : describe.skip`. A fresh worktree has no build outputs, so it reported **`1 failed, 356 passed`** against primary's **`1 failed, 405 passed`** — the missing 49 announced only as a "skipped" count nobody reads. **A lane's green was quietly 49 tests weaker than the primary's**, and the failure mode is a lane merging work whose real coverage never ran. Generalise it: `grep -rn "describe.skip\|it.skip" tests/` for anything gated on `existsSync` before trusting a worktree's number | ✅ handled in `make-worktree.sh`; the *pattern* is the finding |
| F77 | ⚠️ **The worktree recipe was recorded as "written down as a script" and the script is gone** — it lived in a session scratchpad. Seven recurrences of the same traps were re-derived tonight from prose. **A procedure that survives only in a note gets re-learned at full price**; it is now `scripts/devtools/make-worktree.sh`, in the repo, and it verifies rather than instructs | ✅ fixed |
| F75 | ⚠️ **The previous handover's §0 and §5 went stale within one session** — a quoted suite baseline and a "pick this up next" that were both wrong the moment the work landed. This file replaced it rather than being written beside it, and that is the convention: **one live prompt, superseded in place** | 🟠 recorded |

## §6 — Running this in two lanes

**The worktrees are already cut.** Both from `b56e1f43`, both verified.

| Lane | Path | Branch | Work |
|---|---|---|---|
| **A** | `../OpenNoodl-worktrees/bst-lane` | `bst-lane` | BST-004 → BST-003 → BST-005 |
| **B** | `../OpenNoodl-worktrees/leg-lane` | `leg-lane` | the `clone()` fix → LEG-001 → 002 → 005 |

Two lanes, not five, and **the limit is the gates, not the agent count**. Within phase 62 the tasks
are nearly a chain by their own design — BST-004 decides the string BST-003 emits, and BST-005 wants
that same answer for `.mcp.json`'s `"command"` (it has an escape hatch: write it from the server's
own `process.argv[1]`, correct by construction). The axis that actually pays is **62 is `noodl-mcp`,
50 is editor** — zero file overlap.

### The rules that keep it from costing more than it saves

1. 🔴 **Do NOT use the harness's `isolation: "worktree"`.** It creates the branch from `origin/main`
   — `git reflog` says so literally — hundreds of commits behind, with no `dev-docs/` at all. Seven
   batches out of seven. Launch **non-isolated** agents pinned to the absolute paths above, and tell
   each to pass `-C <path>` to every git command with the primary checkout off limits for edits.
2. 🔴 **One full gate at a time.** Two concurrent `test:main` runs manufacture failures; `start.ts`
   sweeps leftover processes, so one lane's `test:ci` reaps the other's stack. Lanes run their
   **package-local** suite only (`cd packages/noodl-mcp && npx jest` — safe concurrently, its backend
   specs set `NODEGX_BACKENDS_DIR` to a temp dir per suite). **The orchestrator runs `test:ci` once,
   at merge, from the primary.**
3. 🔴 **`lerna exec` runs the PRIMARY checkout's source**, so `npm run dev:debug` and `test:ci`
   launched from a worktree exercise primary's code and report a result unrelated to the diff.
   **Editor live verification belongs to the primary, after merging** — which is most of LEG-005.
4. ⚠️ **Never `npm install` in a worktree** (the module symlinks would mutate primary's tree), and
   **never `dev:stop`** (it kills by checkout, and matches a running `test:ci` Electron too).
5. ⚠️ **Every agent commits on its own branch before reporting.** An uncommitted agent produced
   nothing — that is how ten finished pieces sat on no branch for three days.
6. ⚠️ **Never give two agents the same task from different angles.** Already paid for.
7. ⚠️ **Reserve this file and `TASKS.md` for the orchestrator**; give each lane its own NOTES file.
   Zero conflicts across four merges last time that rule was used.
8. ⚠️ **Agents cannot see uncommitted work** — a worktree branches from a *commit*. One previously
   declared two real files "phantoms" and deleted them. **Verify any destructive claim against the
   primary before merging it.**

### Refreshing or rebuilding a lane

`scripts/devtools/make-worktree.sh <name> [base] [parent]` — new this session, because the previous
recipe was recorded as "written down as a script" and the script lived in a session scratchpad and is
gone. It does the whole thing and **verifies before it exits**. If the tip has moved since:
`git -C <worktree> merge --ff-only cline-dev`.

⚠️ **Cut worktrees into `../OpenNoodl-worktrees/`, never a session scratchpad.** `git worktree list`
carries ~20 stale entries, half marked `prunable`, entirely because they were cut into per-session
temp directories that no longer exist. `git worktree prune` clears the bookkeeping for the dead ones
safely — it touches no branch — and is worth running before adding more.

### 🔴 Two traps the script now handles, both of which fake a result

- **The dual-load trap.** Symlinking `node_modules` wholesale makes `@noodl/runtime` resolve through
  *primary's* relative symlink, so `collection.ts` loads twice and its
  `Object.defineProperty(Array.prototype, 'items')` throws *"Cannot redefine property: items"* on the
  second. A whole suite fails to run and it reads exactly like a real defect on the branch. The
  script builds real directories of per-entry symlinks and **verifies `require.resolve` lands inside
  the worktree** before it exits. ⚠️ Note there are **two** workspace scopes, `@noodl` **and**
  `@nodegx` — the older recipe knew only about the first.
- **The silent-skip trap, found tonight.** Build artifacts are gitignored, and some suites gate
  themselves on one rather than failing: `noodl-mcp`'s provisioning and project-identity specs do
  `existsSync(nodegx-backend/dist/cli.js) ? describe : describe.skip`. A fresh worktree therefore
  reported **`1 failed, 356 passed`** where primary reports **`1 failed, 405 passed`** — 49 tests
  silently absent, and the number still looks like a pass. The script links the artifact and says so.
  ⚠️ **A lane that changes `nodegx-backend` must rebuild in its own worktree** rather than trust that
  link, which points at primary's output.
