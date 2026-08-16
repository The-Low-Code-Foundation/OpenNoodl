# FIX-008 — The server bound to the wrong project

**Report 5** · Tier 1 · Effort **S+S/M** (minimum), **M** (full)

> **Status 2026-08-14 (session 4): A + B + E built and driven.** The minimum that closes the report
> (A + B) is done, and E with it. **C and D are open** — see § "What is left" at the bottom.

> *"I clicked the 'Connect MCP' in the launcher, and it threw an error about already being
> connected … then Claude Code complained constantly about the MCP being bound to a different
> project."*

## This is not one bug — it is three, and all three are pinned

**Physical evidence on this machine:** `~/.claude.json` user scope holds `nodegx` (unbound
bootstrap) **and** `nodegx-puppy-test-3` (hard-wired to one project, at user scope — visible in
every folder). Of 44 project folders in `NodeGX test projects/`, exactly **one** has a `.mcp.json`.
That is the whole bug in two facts.

### 1. "Already connected" is a bad message, not an error

`ConnectAgentCard` → `useConnectAgent.ts:64-91` → `main/src/mcp/connectBootstrapServer.js:202`.
`claude mcp add` **refuses an existing name** ("MCP server already exists in user config", CLI
2.1.228); `connectBootstrapServer.js:242-249` surfaces that as a red failure — deliberately no
file-write fallthrough (`:20-24`). Nothing pre-reads the existing registration (the config parse at
`:129-156` already exists and isn't consulted); there is no `already-connected` card state
(`ConnectAgentCard.tsx:40`); state resets to `idle` on every mount (`useConnectAgent.ts:36`). The
requested end state was already true — the user was shown a failure for a success.

### 2. Existing projects never get a `.mcp.json`

BST-005's per-project write **exists and is correct** (`authoringServerName()` →
`nodegx-<slug>`, `mcpCommands.ts:188-189`; render/never-overwrite/gitignore in
`models/template/agentConfig.ts:232-268`) — but runs on **project creation only**
(`LocalProjectsModel.ts:237-242`, called solely from `newProject`; MCP `createProject.ts:612`).
There is **no open-project hook**; backfill-on-open was left optional in BST-005 §4 and never taken
up (`NOTES-BST-002-005.md` §4 row 6). The gitignore banner even claims "created **or opened**"
(`agentConfig.ts:124-128`) — currently false. So 43 of 44 projects on this disk open in Claude Code
with only the user-scope servers visible: the unbound `nodegx` and someone else's
`nodegx-puppy-test-3`.

### 3. The Settings command manufactures wrongly-scoped globals

Settings → "Connect an AI agent" copies a command with `--scope user` (`MCP_SCOPE`,
`mcpCommands.ts:133` — shared by the bootstrap and per-project rows) — which is how
`nodegx-puppy-test-3` became global. And `CLAUDE.md`'s own escape hatch (`agentConfig.ts:205-211`)
points users at exactly that command. Worse: a user-scope `nodegx-<slug>` **silently shadows** the
project-scope twin of the same name (F94, measured — the project entry is simply absent from
`claude mcp list`).

A wrongly-bound server is nearly undetectable in-session: the bound directory appears **only** in
the `initialize` instructions (`instructions.ts:59`); `get_project_info` returns the name but not
the directory (`tools/read.ts:89-105`); every write it accepts lands in the other project,
validated and silent.

## Fix direction

| # | Fix | Where | Effort | Status |
|---|---|---|---|---|
| A | **Idempotent, honest Connect.** Pre-read `~/.claude.json`; identical entry → `ok: 'already-registered'` with a "Connected" card state; different entry (stale path) → offer remove + re-add. Never render the CLI's refusal raw. | `connectBootstrapServer.js`, `useConnectAgent.ts`, `ConnectAgentCard.tsx` | S | ✅ **built + driven** |
| B | **Backfill `.mcp.json` + `CLAUDE.md` on project open.** One call to `installProjectAgentConfig` on the open seam, honouring the existing never-overwrite rule (`agentConfig.ts:243-249`). Fix the false gitignore banner. Closes every pre-BST-005 project. | `LocalProjectsModel` / open seam | S–M | ✅ **built + driven** |
| C | **Per-project Settings command becomes `--scope project`.** Split `MCP_SCOPE`: bootstrap stays `user` (it has no folder); per-project writes the project's own `.mcp.json`. Update `McpSettingsSection.tsx:163`, copy, `tests-unit/mcp-001`; add a cleanup hint for existing user-scope `nodegx-<slug>` entries. | `mcpCommands.ts` | M | ✅ **built s47, DRIVEN s48 (AC3)** |
| D | **A door into an existing project for the bootstrap server** — an `open_project(dir)` tool calling `binding.bind()` (the mechanism exists and already re-briefs: `createProject.ts:520-535`, `disclosure.ts:183-206`; it is merely gated to newly-created dirs). Minimum: `NO_PROJECT_REFUSAL` and `list_projects` emit the exact `claude mcp add --scope project …` line for the directory instead of prose. | `noodl-mcp` | M (note-only S) | 📋 open |
| E | **`get_project_info` returns the bound directory** so a mis-bound server is detectable from any tool call. | `tools/read.ts:89-105` | S | ✅ **built + driven** |

**Minimum that closes the report: A + B.** A+B+C stops it recurring. D removes the class.

## Acceptance criteria

1. Clicking Connect twice shows "Connected — registered as `nodegx`" the second time, not a red error.
2. Opening a pre-existing project (no `.mcp.json`) in the editor writes `.mcp.json` + `CLAUDE.md`
   (never overwriting either if present), and a subsequent Claude Code session in that folder lists
   `nodegx-<slug>` as connectable.
3. ✅ **MET, driven s48.** The Settings per-project command registers at project scope; `claude mcp
   list` from that folder shows the project entry. See *"AC3, driven"* below.
4. `get_project_info` output contains the bound directory.
5. MCP suite green (`@noodl/mcp`), `tests-unit/mcp-001` updated, and the BST-005 acceptance
   ("same two files, same shape, both creators") re-verified.

## Open questions

- ✅ **Answered 2026-08-14 — the shared seam is `LocalProjectsModel.bindProject`.** Not
  `projectFromDirectory`, which is also how the import engine *reads a source project it is not
  opening* (`import-engine/analyze.ts:104`, `apply.ts:158`) — backfilling there would write into a
  folder the user only pointed an importer at. Every route that produces an **opened** project
  crosses `bindProject`: `loadProject` (launcher rows, recents, a just-cloned repo,
  `projectlibrarymodel`), `_addProject` (new project, unzip, open-from-folder) and
  `EditorPage.tsx:334`'s reload. One call, all routes.
- ✅ **Ruled 2026-08-14: silent backfill on open.** Both files are machine-local and git-ignored,
  neither is ever overwritten, and 43 of 44 projects on this disk were otherwise unreachable. This
  reverses BST-005's deliberate create-only choice; the reversal is stated in
  `LocalProjectsModel.backfillAgentConfigFor` and in `renderClaudeMd`'s own paragraph, which was
  false until now and is true because of it.
- Cleanup of existing stale user-scope registrations (`nodegx-puppy-test-3` is visible in every
  folder forever until removed) — a "registered elsewhere" list in Settings?
- With C, two NodeGX servers can be visible in one session (project's own + a stale global bound
  elsewhere). Better or worse for the model? Untested — measure once before shipping C's copy.

---

## What was built (2026-08-14, session 4)

| Fix | Files |
|---|---|
| A | `main/src/mcp/connectBootstrapServer.js` (`readExistingRegistration`, `sameRegistration`, `removeViaCli`, a shared `readClaudeConfig`), `mcpFrontDoor.js`, `ConnectAgentCard.tsx` (the `method` union) |
| B | `models/template/agentConfig.ts` (`backfillAgentConfig` + the v2 gate), `installAgentConfig.ts` (`backfillProjectAgentConfig`), `LocalProjectsModel.bindProject`, `noodl-mcp/src/editor-deps.ts` |
| E | `noodl-mcp/src/tools/read.ts`, `tools/responses.ts` |

**Specs: +14 in `tests-main/mcp/connect-bootstrap-server.test.js`, +8 in
`noodl-mcp/tests/agentConfig.test.ts`, +1 in `noodl-mcp/tests/tools.test.ts`.**

Two decisions inside B that the fix direction did not specify:

1. 🔴 **A legacy project is refused, and gets neither file.** `noodl-mcp` will not open a
   monolithic `project.json`, so a backfilled `.mcp.json` there is a registration, an approval
   prompt, and a server that dies at startup — strictly worse than nothing. The test is the folder's
   own markers (`components/_registry.json` or `nodegx.project.json`), read through the same host
   the writes go through, **not** `ProjectModel._projectFormat`: at creation time the project is
   still legacy on disk when the config is written, so a model-based gate would have broken the
   creating path.
2. **`hasDocs` is read off the folder** rather than passed in. The creating caller knows what it
   just wrote; a caller opening a project from 2024 does not.

## What the drive measured (2026-08-14, dev stack, dark)

**Criterion 1 — clicking Connect when it is already connected.** The real launcher card, real
click, real `~/.claude.json`:

- card went to the **success** state (`[data-test=connect-agent-success]`), reading *"Claude Code is
  already connected. The server is registered as “nodegx” for your user account, so it is available
  in every folder — there was nothing to change."*
- `~/.claude.json` **sha256 identical before and after** (`d723455b…`) — not merely unchanged in
  `mcpServers`, byte-for-byte the same file.
- ⚠️ `claude` **is** on this machine (`~/.nvm/versions/node/v22.22.0/bin/claude`), which is what
  makes the drive meaningful: pre-fix this click spawned `claude mcp add`, got "already exists", and
  rendered it as a red failure. That is report 5's first sentence, reproduced by construction.

**Criterion 2 — opening a pre-existing project.** A copy of `ecommerce-example` (v2, no `.mcp.json`,
not in git), opened by **clicking its launcher card**:

| | before | after |
|---|---|---|
| `.mcp.json` | absent | written, `nodegx-fix008-v2`, absolute paths, `--allow-writes` |
| `CLAUDE.md` | absent | written, names the server, no `docs/` section (there is no `docs/`) |
| `.gitignore` | absent | created with the three-line block |

…and then, from that folder, **the real client**:

```
$ claude mcp list
nodegx-fix008-v2: node …/noodl-mcp.cjs …/fix008-v2 --allow-writes - ⏸ Pending approval (run `claude` to approve)
```

which is criterion 2's second half exactly: listed, and offered for approval once.

**The other three cases, through `openProjectFromFolder`:**

- **A legacy project** (copy of `fix018-drive`) — opened fine, and the folder still holds only
  `project.json`. Nothing written, as designed.
- **A git-tracked v2 project** (copy of `leg003-drive`, which has `docs/`) — both files written, the
  `CLAUDE.md` **did** carry the `docs/CONVENTIONS.md` section, and `git diff .gitignore` is exactly
  the three added lines and nothing else.
- **Re-opening both** — every sha256 identical, a hand-added line in `CLAUDE.md` survived, and the
  `.mcp.json` ignore line count stayed at **1**.

**Criterion 4 — `get_project_info`.** Driven over real stdio against the freshly built bundle (a
throwaway JSON-RPC client, `initialize` → `tools/call`), not only through the in-process test
harness: `projectDirectory: /…/fix008-v2`.

**Criterion 5** — MCP suite **41 suites / 467 tests, all green** (the "red since DSG-003" note in
memory is stale); `tests-unit/mcp-001` needed no change, because `MCP_SCOPE` is fix C's business and
was not touched.

### 🔴 Two things worth knowing before the next session

1. **Richard's five running MCP servers run the *packaged* bundle**
   (`/Applications/NodeGX.app/Contents/Resources/noodl-mcp/noodl-mcp.cjs`), not
   `packages/noodl-mcp/dist/`. Grepped: **0 occurrences** of fix E's new description string in it.
   So rebuilding `dist/` — which this session did, and which the `nodegx` bootstrap registration
   *does* point at — leaves every project-bound server on the old code until the app is repackaged.
   The stale-`dist` trap has a second half.
2. ⚠️ **The `.gitignore` write is a diff in a repo the user did not edit.** Measured, three lines,
   and the alternative is a machine-specific `.mcp.json` getting committed — but it is the sharpest
   edge of the silent-backfill posture and the first thing a user will notice.

### Driving note

`cdp click` reported `clicked … at 410,395` for a card measured at `y 555–593`. The launcher grid
had **re-laid out** between the measure and the click (not React recycling this time — the
`data-drive` attribute travelled with the node). The target was confirmed by consequence:
`ProjectModel.instance._retainedProjectDirectory` was the drive copy, and a sweep of all 44 real
test projects found **no** new `.mcp.json` or `CLAUDE.md`. Check the consequence, not the
coordinates.

## What is left

- **D** (`open_project` / an emitted registration line) is untouched. A + B close the report; C
  stops it recurring for users who copy the Settings command, and D removes the class.
- The stale user-scope `nodegx-puppy-test-3` is **still registered and still visible in every
  folder** — `claude mcp list` from an unrelated directory shows it. Nothing in A/B/E removes it;
  C's copy now tells the reader how, but **nothing removes it for them**.

---

## ✅ The open measurement, taken 2026-08-16 (session 47)

The question ruled to be an agent's: *"with C, two NodeGX servers can be visible in one session (the
project's own plus a stale global bound elsewhere); better or worse for the model?"*

**Answer: unambiguously better, and the pre-C arm is worse than it looked.**

**Design.** One variable — whether the project's own server is registered. Both arms ran `claude -p`
with `--strict-mcp-config --mcp-config <arm>`, so **Richard's real `~/.claude.json` was never
touched or read as config**; the registration shapes were copied from it read-only. cwd was the
working project in both arms. All three servers ran the **same** HEAD bundle, so the only difference
between arms is the server set. Prompt, identical: *"Add a new page component called Pricing to this
project, with a heading that reads 'Pricing'."* No `CLAUDE.md` in either project — the harder test,
since nothing hints at which server to use. Model `claude-sonnet-5`.

| arm | servers visible | server the model chose | attempted writes to the wrong project |
|---|---|---|---|
| **A — pre-C** | `nodegx` (unbound) + `nodegx-puppy-test-3` (bound elsewhere) | the stale one, **3/3** (16, 14, 18 calls) | **yes, 3/3** |
| **B — post-C** | those two **+ the project's own** | the project's own, **4/4** (5–7 calls) | none |

In arm B every run wrote into the correct project and the stale project was **byte-identical
before and after**. Not one call in seven went to the wrong server, in either direction.

🔴 **The arm A disk reading is a trap, and stating it without the caveat would be a lie.** The stale
project also finished unchanged — but *not* because the model showed restraint. It called
`create_component` repeatedly and **every write crashed** (below). The model's *intent* was wrong in
all three runs, and it never once questioned the binding despite fix E putting `projectDirectory` in
`get_project_info`'s output, which it read first every time. **Had the writes worked, arm A would
have corrupted a project the user was not in, three times out of three.**

⚠️ **Cost $4.29 across 7 runs.** Harness, configs and per-run transcripts are in this session's
scratchpad (`run-arm.sh`, `analyze.js`, `arm-{a,b}.mcp.json`, `results/`); the fixtures are
`fix008c-work` and `puppy-test-3-fix008c` under `NodeGX test projects/`. ⚠️ **Scratchpad is
cleaned** — the numbers above are the durable record.

### 🔴 A separate, pre-existing bug the measurement fell over

`validate_project`, `create_component` and every write on **`Puppy test 3`** fail with
`io-error: Unexpected failure: Cannot read properties of undefined (reading 'startsWith')`.

- **Root cause:** one node carrying only `{id, x, y}` and **no `type`**, at
  `components/Pages/Admin Login/nodes.json`, id `6d5ec795-be88-fdd9-b555-1bb2f6bba281`. It reaches
  `isComponentRef(node.type)` in the semantic validator, which calls `.startsWith` on `undefined`.
- **Not a regression, and not mine:** the **packaged Aug-13 bundle fails identically**, so it
  predates this session's `dist/` rebuild.
- **Census: 1 of 27 v2 projects on this disk** — but it is precisely the project Richard has a
  registered user-scope server for, so his own `nodegx-puppy-test-3` cannot author or validate.
- 🔴 **The editor was hardened against this exact node on 2026-08-11 and the MCP server was not.**
  `UnknownNodeType.localName` got a fallback so one malformed node costs you the node; memory
  records that the debris was deliberately left in place. The same node costs the MCP server **the
  entire project's validate-and-write surface**, behind an `io-error` that names neither the node
  nor the component.

**Wants its own task** — the fix is a guard in the validator plus an error that names the node.

## ✅ What C built (2026-08-16, session 47)

| File | Change |
|---|---|
| `mcpCommands.ts` | `MCP_SCOPE` split into `SCOPE_UNBOUND` (`user`) and `SCOPE_PER_PROJECT` (`project`); `claudeMcpAdd` takes the scope; `McpCommandRow` gains `scope` + `scopeNote`; `perProjectScopeNote` / `unboundScopeNote` |
| `McpSettingsSection.tsx` | the hardcoded *"for your user account, so it works from any directory"* provenance line replaced by `row.scopeNote` |
| `tests-unit/mcp-001` | authoring row is `--scope project`; two new specs for the directory sentence and the removal hint; observe and bootstrap pinned to `user` |
| `tests-unit/mcp-004` | two BST-004 character-for-character fences updated, **with a comment saying the scope moved deliberately and the runtime half is what they fence** |

🔴 **`--scope project` is resolved against the shell's cwd, exactly like `local`** — and `claude mcp
add` has **no flag naming a target directory** (checked against 2.1.228). So the flag alone does not
put the registration in the project; the user running it *in the project folder* does. That
dependency is invisible in the emitted string, which is why the row now carries a `scopeNote` naming
the folder. ⚠️ **This is the same hazard the original `MCP_SCOPE` comment was written to avoid**, and
it is not fully solved — it is made visible. A future session may want the emitted command to be
directory-independent; there is no CLI affordance for that today.

⚠️ **Observe stays `user` deliberately.** It attaches to whatever app is running, so it is bound to
no project and "works from any directory" is the correct promise. M4 below exists to stop a later
reader "finishing the job".

**Gates (s47, 2026-08-16):** `test:main` **227 suites / 3526 tests, all green** (s44's
`bld-004/reasoningChannel` flake passed here); `--findRelatedTests` on both changed source files
**2 suites / 46**; `tsc -p tsconfig.json` and `tsc -p tsconfig.tests.json` both clean, read off
**empty output** rather than an exit code.

**Mutation table — all four applied and all four bite** (each announced `[mutant applied]`; source
`diff`ed back to identical afterwards):

| mutant | bites |
|---|---|
| **M1 — per-project server back to `user`** (the bug C fixes) | 🔴 4 of 57 |
| **M2 — scope note stops naming the directory** | 🔴 1 of 57 |
| **M3 — stale user-scope cleanup hint dropped** | 🔴 1 of 57 |
| **M4 — observe project-scoped too** (over-applying the split) | 🔴 2 of 57 |

⚠️ **The first attempt at M2 and M3 did not apply** — a `\$` escaped inside single quotes never
matched the source — **and said so**, because the helper prints `[MUTANT DID NOT APPLY]` and exits.
Without that, two rows would have reported a healthy suite passing on unmodified source, which is
s46's finding repeating itself in a new place.

## ✅ AC3, driven 2026-08-16 (session 48)

**The command was not hand-written.** `buildMcpCommands` was called directly, with the bundle path
from `resolveMcpServer('noodl-mcp')` — the same two units the Settings panel composes — so the string
that was run is the string the panel hands the user. Target: a **copy** of `cn019-drive` (v2) in the
scratchpad, deleted afterwards.

```
claude mcp add --scope project nodegx-fix008c-ac3 -- node …/packages/noodl-mcp/dist/noodl-mcp.cjs <projectDir> --allow-writes
```

**A 2×2 — location × before/after — not a single after-reading:**

| `claude mcp list` | in the project folder | from `$HOME` |
|---|---|---|
| **before the add** | absent | absent |
| **after the add** | ✅ **`nodegx-fix008c-ac3` listed** | ❌ absent |

✅ **The absence at `$HOME` is asserted beside a known-firing signal**, so it is a real absence and
not a broken command: the same listing still names **three** other `nodegx*` servers, and `claude mcp
get` from `$HOME` fails with *"No MCP server named …"* while **listing the six that do exist**.
✅ **`claude mcp list` from `$HOME` is byte-identical before and after the whole drive** (`diff`
clean) — nothing leaked to user scope.

✅ **Scope asserted directly, not inferred from location:** `claude mcp get` in the folder reports
**`Scope: Project config (shared via .mcp.json)`**. The written file is exactly the
`{type, command, args, env}` shape `BootstrapRegistration` documents, which is a schema this repo
does not own and had only ever read off a live file.

### 🔴 What the drive found that the copy does not say

**A project-scope server lists as `⏸ Pending approval (run claude to approve)`, where every
user-scope server lists as `✔ Connected`.** This is Claude Code's trust prompt for a `.mcp.json` —
correct and desirable, since a project folder can now carry a server definition — but it is a
**behaviour C introduced and `perProjectScopeNote` does not mention**. The user pastes the command,
runs `claude mcp list`, and sees something that does not say "connected".

🔴 **This is the shape of C's trade, and it should be stated rather than discovered:** the old
user-scope registration was *immediately live and wrongly visible everywhere*; the new one is
*correctly scoped and needs one approval*. **Worth a sentence in `perProjectScopeNote`** — small, and
the suite already fences that string.

⚠️ **The shadowing claim in the same note was NOT re-tested here** and rests on the 2026-08-11
measurement (`phase-62-cold-start/MEASUREMENTS-CLIENT-CONTRACT.md`): proving it again requires
writing a user-scope entry into Richard's real `~/.claude.json`, which this drive deliberately did
not do.

✅ **Incidental corroboration of the bug C exists for**, visible in every reading above:
`nodegx-puppy-test-3` is a **user-scope** server bound to `…/NodeGX test projects/Puppy test 3` and
it is `✔ Connected` **from `$HOME` and from an unrelated project folder alike**. That is the
wrongly-bound server the 3/3 measurement was about, sitting on this machine right now.
⚠️ It resolves to `/Applications/NodeGX.app/…` — **the packaged Aug-13 bundle**, i.e. pre-fix-E code,
which is the second reason the repackage is owed.

## ✅ RULED 2026-08-16 (session 42)

**Fix C's open measurement is an AGENT's to take, not Richard's.** The question — *"with C, two
NodeGX servers can be visible in one session (the project's own plus a stale global bound elsewhere);
better or worse for the model?"* — is measurable on this machine: register both, ask a model to
author against the project, and see which server it reaches for. It no longer blocks C.
**Measure it, then build C.** This was the oldest open item on the phase's ruling list and it was
mis-filed as Richard's.
