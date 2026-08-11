# Phase 62 — closing it: two tasks, two measurements, and three debts a session cannot pay

**Written:** 2026-08-11 by the session that built BST-003. It **supersedes** the prompt written
earlier the same night by the BST-004 session — that one sends you to build BST-003, which is built.

**This is the live prompt.**

---

## §0 — Read this first: the goal is six of six, and you will not get it

You have been asked to close phase 62 in one session. **The code of it, yes — realistically.** The
whole of it, no, and the parts that cannot close are not effort problems:

| Debt | Why a session cannot close it |
|---|---|
| **Windows spawn** (BST-004, BST-005) | There is no Windows machine. The path *string* is asserted; that `NodeGX.exe` under `ELECTRON_RUN_AS_NODE=1` spawns and speaks clean stdio is **an expectation** |
| **The paid model drives** (BST-006's ordering acceptance, BST-003's consequence in prose) | A drive costs real money against a real Anthropic key. **Ask Richard before spending it** |
| **Anything needing a quiet checkout** | A concurrent session has been live all night (see §0.2) |

🔴 **Do not report the phase closed because the code landed.** This phase has already been caught
once reporting a successful `claude mcp add` as the deliverable. Land the code, run what you can, and
**name the rest as outstanding** — that is a complete session, and a false "6/6" is not.

### §0.1 — The gates, and who measured what

| Gate | Floor | Provenance |
|---|---|---|
| `cd packages/noodl-mcp && npx jest` | **1 failed / 418 passed of 419** | ✅ **measured 2026-08-11 ~23:00**, this checkout |
| `cd packages/noodl-editor && npx jest` | **128 suites / 1826 tests, all green** | ✅ **measured**, after BST-003 |
| `npm run test:ci` | `Jasmine: 2670 specs, 6 failures` | ⚠️ **INHERITED — not measured this session.** Measure it before you trust it |

🔴 **The MCP total moved and the floor did not.** It was `1 failed / 405 passed of 406`; it is now
**419**. Thirteen tests arrived from other work. **Compare the TOTAL to this number, not the failure
count** — a gitignored build artifact can make a whole file's specs vanish and still read as a pass.
The one red is **F65**, the byte cap at `tests/tools.test.ts:182`, and it is structural rather than an
overshoot.

The six `test:ci` failures **by name** — 6 → 12 has two routes and only the names separate them:

```
AIX-006 style vocabulary  AIB-009 F11: a provider that stalls during the style pass …
AIX-006 style vocabulary  a style suggestion never downgrades a valid authoring …
AIX-006 style vocabulary  with guidance off, a raw candidate is accepted immediately …
AIX-006 style vocabulary  offers one advisory style pass on a valid-but-raw candidate …
AI model registry         has exactly one default per provider that owns models
AI model registry         treats openai-compatible as sharing the OpenAI catalogue
```

⚠️ **The exit code lies, and so does the harness's.** A background task reported **exit 0** for a
`test:ci` run in which npm exited **1** with six failures. Only the `Jasmine:` line counts.

### §0.2 — 🔴 A concurrent session is live on this checkout, and it has been all night

While BST-003 was being built, another session merged three lanes and landed phase 50's LEG-001/002/
005. `HEAD` moved under this session twice. At the time of writing an Electron test run is still up.

**What this cost, and what it must cost you:**

- ⚠️ **`git add -A` is a loaded gun.** Both BST-003 commits were checked file-by-file afterwards and
  were clean — but that was luck plus the other session working in worktrees. **Check
  `git status --short` before every commit and name your paths if anything is not yours.**
- 🔴 **Do not launch the editor while their run is up.** `start.ts` sweeps leftover processes and
  will reap it. That is exactly why BST-003's card has never been rendered.
- ⚠️ **`npm run dev:stop -- --list` is the ONLY spelling that lists.** `dev:stop --list` **kills**
  (npm eats the flag) and would kill *their* run; `dev-processes.js --list` is a silent no-op.
- Before any live work: `npm run dev:stop -- --list`, and if it shows someone else's run, **wait or
  do the non-live half first.**

## §1 — Where things stand

`cline-dev` is at **`c80452c1`** and is **245 ahead** of an unpushed `origin/cline-dev`.

| Task | State |
|---|---|
| BST-001, 006 | ✅ built `6c4dc372` — 006 has **one acceptance line unrun** |
| BST-004 | ✅ built `ab8e5c1e` — Windows unverified |
| BST-003 | ✅ built `d1e3bfaa` — **card never rendered** |
| **BST-002** | 📋 **open — the flagship** |
| **BST-005** | 📋 **open — the cheapest** |

**Phase 50 is not yours** but it moved tonight; LEG-001/002/005 landed from lanes.

## §2 — 🔴 Measure two things before you write anything

Both open tasks are gated on an unverified premise about a client you do not control. **This exact
shape has now paid out twice** — F14 inverted BST-003's recommendation, F79/F85 twice caught a probe
answering backwards on the machines that matter most. Both measurements below are cheap, and both
decide what gets built rather than merely how.

### §2.1 — BST-002's gate: does Claude Code re-list on `notifications/tools/list_changed`?

The whole flagship rests on it. `disclosure.ts:17-22` states the risk itself: *"A client that ignores
the notification never sees them."* For a deferred group that costs a turn. **Here it costs the
session** — the agent finishes `create_project` and the authoring tools stay invisible for the rest
of the conversation.

⚠️ **You do not need BST-002 to measure this.** Write a throwaway stdio MCP server that advertises
one tool, then reveals a second on first call and emits the notification. Register it, call the first
tool, and see whether the client ever lists the second. That is the entire question, it costs no
model spend, and it decides whether BST-002 is *"bind and reveal"* or *"bind, and tell the user to
reconnect"*.

🔴 **If it does NOT re-list, do not build the reveal and call it done.** Say so, and take the fallback
the phase already planned for: register the project server and reconnect. TASKS.md §"suggested order"
is explicit that the phase delivers real value at step 4 even if 002 falls back.

### §2.2 — BST-005's gate: the `.mcp.json` contract

Its own spec marks two things unverified, and **the file is worthless if either is wrong**: the exact
key shape, and whether an unapproved server is silently ignored. Verify by **writing one and opening
the folder** — the spec says so and it is right.

✅ **One input you now have for free:** BST-003 measured the live registration shape. Claude Code
stores stdio servers as `{ type: 'stdio', command, args, env }`, and `--scope user` writes
`~/.claude.json` → top-level `mcpServers`. `.mcp.json` is a *different file* with project scope, so
**confirm it separately** — but you are not guessing from nothing.

⚠️ **Take the spec's escape hatch on `"command"`:** write it from the server's own `process.argv[1]`,
which is correct by construction, rather than re-deriving a path.

## §3 — The work, in order

**1. BST-005 first, not second.** It is self-contained, it is the cheapest thing in the phase, and it
is the only task that helps *every session after the first* — a project directory currently holds
nothing that says what it is, so session two is as cold as session one and colder in one way, because
the user believes they connected something yesterday. ⚠️ **Both files or neither**: a registered
server with no context gives a model 20+ tools and no vocabulary; a `CLAUDE.md` with no server gives
vocabulary and no way to act. The complaint that opened this phase is those two failures in one
sentence.

**2. BST-002 after its measurement.** Three landmines, all still exact:

- `ProjectBinding.bind()` **plus** the disclosure reveal **in one commit**.
- **Bind once, refuse the second.** A second `create_project` on a bound server creates the project
  and does **not** rebind — otherwise an agent tidying up silently repoints every later tool and
  nothing in any response says which project it is describing.
- 🔴 **`find_tools`' description is chosen at REGISTRATION from the mode**, so a server that binds
  mid-session leaves the stale bootstrap description advertised. `RegisteredTool.update()` is the
  mechanism. **This is the one of the three that gets missed.**

Over all of it: ⚠️ **`instructions` is fixed at `initialize`.** A server that binds mid-session can
never send its real briefing, so project-bound guidance must travel **in tool results** — and no gate
can see that it didn't.

**3. Then the acceptance debts in §4**, which is where the phase is actually thin.

## §4 — The debts, and who can pay them

| # | Debt | Who |
|---|---|---|
| 1 | **BST-003's card has never been rendered.** No screenshot, no click, no zero-project profile | **A session**, once the checkout is quiet. The acceptance asks for an *empty project list*, driven — not reasoned about |
| 2 | **BST-006's ordering acceptance.** A fresh agent with only the unbound server, asked *"open my app"*, must call `list_projects` and **not** `create_project` | **Blocked on two things**: `scripts/devtools/mcp-model-driver.js` requires `--project` and needs a no-project mode, and **the drive costs money** |
| 3 | **F87 — the briefing miscounts its own tools.** `instructions` says *"only four tools are advertised"*; `tools/list` returns **five** (`find_tools`). The stderr line says four too | **A session.** It is BST-006's text. One sentence, and it is the first thing a fresh agent reads |
| 4 | **Windows** | Nobody here |
| 5 | **F65** — the MCP byte cap, the phase's one red | 🔴 Structural: summary mode does `s.examples = full.examples` verbatim and the corpus is *meant* to grow. Raising it to 31,000 buys until the next recipe; **bounding the list per type is the fix that holds** |

⚠️ **Debt 3 is the cheapest real improvement in this list** and it is not cosmetic: the number is
wrong in the one sentence that decides what a cold agent does first.

## §5 — What needs Richard, not a session

- 🔴 **Authorisation to spend on model drives** (debt 2, and BST-003's consequence in prose). A real
  Anthropic provider **is** configured and a drive costs money.
- 🔴 **If §2.1 comes back "no"** — whether BST-002 ships the reconnect fallback or waits.
- **F82** — the real `nodegx-observe` registration reports `✘ Failed to connect` in `claude mcp list`.
  Still true tonight. Points at `/Applications/NodeGX.app/…`, not this checkout. Not investigated.
- **F51**, the **25% accent ceiling** (`ACCENT_CEILING` in `score-design.js`), **F33**, and **`§9`'s
  prose** — all unchanged.

## §6 — Findings this session should not have to rediscover

| # | Finding | State |
|---|---|---|
| F14 | 🔴 **The Claude Code desktop app ships NO `claude` CLI.** Docs: *"To use `claude` from the terminal, install the CLI separately."* Its pitch is *"No terminal required."* `Claude.app` contains no binary, no bundled node. **The card's audience is defined by not having the thing option B spawns** | ✅ measured |
| F85 | 🔴 **And a Finder-launched editor cannot reach the CLI even when it exists** — under `PATH=/usr/bin:/bin:/usr/sbin:/sbin`, `which claude` exits 1 (npm global under nvm). **F79 exactly, one task later, different binary.** Now one prober: `probeBinary.js` | ✅ fixed |
| F86 | 🟠 **`~/.claude.json` → `mcpServers` is Claude Code's OWN store**, shared by CLI and Desktop by documentation, and the CLI **prints the filename on stdout**. Writing it was never "a foreign undocumented schema" — that objection killed the only option that works for the target user | ✅ measured |
| F87 | 🔴 The bootstrap `instructions` says **four** tools; `tools/list` returns **five** | 🟠 filed, see §4 |
| F88 | ⚠️ BST-003's card render blocked by a **concurrent session's `test:ci`** — environment, not code | 🟠 open |
| F89 | ⚠️ **A number invented for rhetorical weight is still a number someone will rely on.** "twenty-five top-level keys" in `~/.claude.json` was written from a truncated list; it is **58** | ✅ corrected |
| F90 | 🔴 **`--border-control` does not exist in editor chrome CSS.** It is an **app-facing** project style token (`DefaultTokens.ts`, `StylePresets/presets/*.ts`); chrome uses `--theme-color-border-*`. An undefined custom property renders **no border** and nothing reports it. Recalled memory said "defined ✅" and was right about a *different namespace* | ✅ fixed; use `--theme-color-border-default` |

⚠️ **F90's general form is worth more than F90:** a remembered fact can be accurate and still be
about a different thing than the one in front of you. Verify a token against the file that must load
it.

## §7 — Two lanes, if you want them

The axis that paid — *"62 is `noodl-mcp`, 50 is editor"* — **is now clean again**, because phase 50
landed tonight and both remaining tasks are `noodl-mcp`:

| Lane | Work |
|---|---|
| **A** | **BST-005** — `.mcp.json` + `CLAUDE.md`. Self-contained, touches project scaffolding only |
| **B** | **BST-002** — binding and disclosure. Touches `server.ts`, `createProject.ts`, `disclosure.ts` |

⚠️ **They collide in `noodl-mcp`.** BST-005 writes files at project creation; BST-002 changes what
`create_project` does. **Both edit `createProject.ts`.** If you run two lanes, give BST-002 that file
and have BST-005 land its writer as a separate module the other calls — or just run them in sequence,
which for two tasks of this size is probably faster than the merge.

### The rules that keep lanes from costing more than they save

1. 🔴 **Never the harness's `isolation: "worktree"`** — it branches from `origin/main`, hundreds of
   commits back, no `dev-docs/` at all. Seven out of seven. Use
   `scripts/devtools/make-worktree.sh <name> [base] [parent]`, which verifies before it exits.
2. 🔴 Cut into `../OpenNoodl-worktrees/`, **never a session scratchpad** — that is why
   `git worktree list` carries ~20 stale entries. `git worktree prune` is overdue.
3. 🔴 **One full gate at a time**, and the orchestrator runs `test:ci` once, at merge, from the
   primary. Lanes run their **package-local** suite only.
4. 🔴 **`lerna exec` runs the PRIMARY checkout's source**, so `dev:debug` and `test:ci` from a
   worktree exercise primary's code. **Editor live verification belongs to the primary.**
5. ⚠️ **Never `npm install` in a worktree**, and **never `dev:stop`** — it kills by checkout and
   matches a running `test:ci` Electron too.
6. ⚠️ **Every agent commits on its own branch before reporting.** An uncommitted agent produced
   nothing.
7. ⚠️ **Compare a lane's suite TOTAL to primary's, never its failure count** — a fresh worktree once
   reported `1 failed, 356 passed` against primary's `405`: **49 tests silently absent, and the
   number still looked like a pass.**

## §8 — Definition of done for this session

Do not claim more than this, and do not claim less:

- [ ] §2.1 measured, and its answer written into BST-002 before any code
- [ ] §2.2 measured by writing a real `.mcp.json` and opening the folder
- [ ] BST-005 built, both files, with the Windows caveat stated
- [ ] BST-002 built — or its fallback taken, explicitly, with the measurement quoted
- [ ] F87 fixed (one sentence, and the stderr line)
- [ ] BST-003's card rendered with zero projects, **if** the checkout goes quiet
- [ ] `noodl-mcp` suite compared by **total** (419) and by failure **name**
- [ ] `test:ci` measured, not inherited, and compared by the six names in §0.1
- [ ] Everything unrun named in the handover, Windows and paid drives included
