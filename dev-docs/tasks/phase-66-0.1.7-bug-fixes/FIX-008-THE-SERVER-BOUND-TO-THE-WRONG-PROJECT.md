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
| C | **Per-project Settings command becomes `--scope project`.** Split `MCP_SCOPE`: bootstrap stays `user` (it has no folder); per-project writes the project's own `.mcp.json`. Update `McpSettingsSection.tsx:163`, copy, `tests-unit/mcp-001`; add a cleanup hint for existing user-scope `nodegx-<slug>` entries. | `mcpCommands.ts` | M | 📋 open |
| D | **A door into an existing project for the bootstrap server** — an `open_project(dir)` tool calling `binding.bind()` (the mechanism exists and already re-briefs: `createProject.ts:520-535`, `disclosure.ts:183-206`; it is merely gated to newly-created dirs). Minimum: `NO_PROJECT_REFUSAL` and `list_projects` emit the exact `claude mcp add --scope project …` line for the directory instead of prose. | `noodl-mcp` | M (note-only S) | 📋 open |
| E | **`get_project_info` returns the bound directory** so a mis-bound server is detectable from any tool call. | `tools/read.ts:89-105` | S | ✅ **built + driven** |

**Minimum that closes the report: A + B.** A+B+C stops it recurring. D removes the class.

## Acceptance criteria

1. Clicking Connect twice shows "Connected — registered as `nodegx`" the second time, not a red error.
2. Opening a pre-existing project (no `.mcp.json`) in the editor writes `.mcp.json` + `CLAUDE.md`
   (never overwriting either if present), and a subsequent Claude Code session in that folder lists
   `nodegx-<slug>` as connectable.
3. The Settings per-project command registers at project scope; `claude mcp list` from that folder
   shows the project entry.
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

- **C** (`--scope project` for the per-project Settings command) and **D** (`open_project` / an
  emitted registration line) are untouched. A + B close the report; C stops it recurring for users
  who copy the Settings command, and D removes the class.
- The stale user-scope `nodegx-puppy-test-3` is **still registered and still visible in every
  folder** — `claude mcp list` from an unrelated directory shows it. Nothing in A/B/E removes it;
  that is C's cleanup hint.
