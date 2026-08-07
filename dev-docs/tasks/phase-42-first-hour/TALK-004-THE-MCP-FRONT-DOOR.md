# TALK-004 — The MCP front door: there is no URL, and there is no door

Covers reported item **13**. Brainstorm doc — the mental-model correction changes what we build.

## What was reported

> I don't see where to start the MCP server, get its URL and copy paste the terminal command I
> need to run in my Claude Code to make it connect. I guess there should be two URLs for two MCPs
> to add? This needs to be super clear because it's the main point of attraction for using NodeGX.

## The mental-model correction first

**There are no URLs, and nothing to "start".** Both MCP servers are **stdio** processes that the
MCP client (Claude Code) spawns itself — there is no HTTP/SSE transport anywhere in the repo. So
the deliverable is not "show two URLs" but "hand the user two copy-pasteable `claude mcp add`
commands with the right absolute paths already substituted". Two servers, two registrations
(deliberately split, settled in phase 36):

- **`noodl-mcp`** (authoring, ~85 tools): reads/writes the **project directory on disk**; doesn't
  need the editor at all. Needs one argument: the project path (plus `--allow-writes`).
- **`nodegx-observe`** (running-app observability, 9 tools): dials the **editor's relay** on port
  8574 with a per-launch token it auto-discovers from `~/Library/Application Support/NodeGX/
  relay-token`. Needs the editor running; zero config otherwise.

Today's working incantations (repo users only):
```
claude mcp add nodegx -- node <repo>/packages/noodl-mcp/dist/noodl-mcp.cjs <project-dir> --allow-writes
claude mcp add nodegx-observe -- node <repo>/packages/nodegx-observe/dist/nodegx-observe.cjs
```

## What research confirmed about the gap — your complaint is exactly right

1. **The editor has zero MCP UI.** A full grep finds only source comments — no settings row, no
   panel, no menu item, nothing in the launcher or Help Center.
2. **Nothing is packaged.** `extraResources` ships no MCP binary; `dist/` is gitignored;
   `npm publish` was explicitly deferred in SUB-008. A packaged-app user has **no file to point
   `claude mcp add` at**. SUB-010's own assessment already named this: the gap between "provable"
   and "usable by a stranger" is distribution, and it was never closed.
3. **The observe README's config (`"command": "nodegx-observe"`) doesn't work off-PATH** — the
   bin is only a workspace symlink.
4. **`create_project` can't bootstrap**: the authoring server refuses to start without an existing
   v2 project directory, and after creating one you must register a *second* server against the
   new directory. Known since AIX-012.
5. The nearest specced onboarding work (TAB-006's tab directory + `list_projects`) is unbuilt.

One good precedent exists: the Execution History panel's **"Copy a fix request"** clipboard
button — the exact interaction pattern to reuse.

## Proposed shape (research's ranked list, which I endorse)

1. **A "Connect an AI agent" section in Editor Settings** beside the existing AI section: two Copy
   buttons emitting fully-resolved commands — authoring (current project's path substituted from
   `ProjectModel.instance._retainedProjectDirectory`) and observe. Reuse the ExecutionDetail
   clipboard pattern verbatim. This is templating, not design.
2. **Ship both `dist/*.cjs` via `extraResources`**, resolved from `process.resourcesPath` in
   packaged builds vs the repo path in dev — without this, step 1's command only works for people
   who cloned the repo.
3. **Gate the authoring button on the v2-format check** the server itself performs, with the same
   message — a copied command that dies at startup is worse than no button.
4. Fix the observe README's misleading bare-command config.
5. Cheap extra that completes the pitch: a third copy button (or launch action) for
   `npm run preview -- <dir> --open` → `http://127.0.0.1:8575` — the "see it" half when the
   editor isn't the viewer.

## The questions for the session

**Q1 — Where does the front door live?** Editor Settings (recommendation above), the launcher
(visible before any project is open — but the authoring command needs a project path), or a
dedicated left-rail panel? My lean: settings section now; consider a launcher card when
`create_project` bootstrap (Q3) exists.

**Q2 — Do we present one server or two?** Two commands is honest but doubles the copy-paste. A
merged single server was deliberately left open in phase 36. Short-term: two buttons with
one-line "what it's for" captions. Re-open the merge question only if users trip on it.

**Q3 — The first-run story.** "Create apps directly in Claude Code" currently requires an
existing project first. Options: (a) accept it — the editor creates the project, the agent builds
in it (matches "look at the result in NodeGX" anyway); (b) make `noodl-mcp` startable without a
project dir, with `create_project` allowed and every other tool returning a "point me at a
project" error; (c) TAB-006's directory + `list_projects`. My lean: (a) for alpha with the
settings section copy explaining the flow, (b) as the follow-up.

**Q4 — Docs.** Nothing under `docs/` (the user-facing tree) mentions MCP at all. The settings
section needs a "how this works" link with the two-command explanation — that page has to exist.

## HAD — 2026-08-05

Every claim above was re-verified against the code before the conversation. The mental-model
correction holds — both servers build a `StdioServerTransport` and nothing else
([noodl-mcp/cli.ts](../../../packages/noodl-mcp/src/cli.ts),
[nodegx-observe/cli.ts](../../../packages/nodegx-observe/src/cli.ts)) — as does every gap in the
list. A grep of the editor source for `noodl-mcp` / `nodegx-observe` / `claude mcp` returns 37 hits,
**all of them source comments**. `extraResources` ships four entries
([package.json:82-99](../../../packages/noodl-editor/package.json#L82)) and no MCP binary. And
`create_project` genuinely cannot bootstrap: `ProjectStore`'s constructor throws `not-a-v2-project`
([ProjectStore.ts:113-123](../../../packages/noodl-mcp/src/project/ProjectStore.ts#L113)) before any
tool is registered.

**One doc claim is wrong in both halves.** Q4 calls `docs/` "the user-facing tree". It isn't: it
holds `format/`, `node-catalog/`, `research/`, `runtime/` — reference material with no index. And it
*does* mention MCP, in `docs/research/rise-assessment.md`. The user-facing docs are a **separate
repo** served as a CDN from
[`getDocsEndpoint.ts`](../../../packages/noodl-editor/src/editor/src/utils/getDocsEndpoint.ts)
(`the-low-code-foundation.github.io/opennoodl-docs`), the same origin the Docs panel, lessons and
prefab library read. The substantive point — no user-facing onboarding page anywhere — stands, but
the page is a change to *that* repo, which makes it different work. See
[MCP-004](MCP-004-THE-MCP-DOCS-PAGE.md).

### Three things this doc did not have

**1. `nodegx-observe` never reconnects, and the relay token is minted per editor launch.**
[relayClient.ts:129-171](../../../packages/nodegx-observe/src/relayClient.ts#L129) connects exactly
once — no `close` handler after settling, no retry, no re-read of the token file. Claude Code keeps
a stdio server alive for a whole session. So the user copies the command, it works, they restart the
editor (minting a fresh token), and from then on **every observe tool throws `Not connected to the
NodeGX relay.`** ([relayClient.ts:293-297](../../../packages/nodegx-observe/src/relayClient.ts#L293))
— a message that never says the fix is to reconnect the MCP server. A front door that hands out a
command which silently expires on the next editor restart is *worse* than today's no-door, because
it teaches the user the feature is flaky. This is a hard prerequisite, not a follow-up.

**2. The proposed commands collide across projects.** Both incantations hard-code the server name
`nodegx`. Register a second project and it clashes with or replaces the first — already wrong today
with sequentially-opened projects, and constantly wrong once tabs land.

**3. `nodegx-observe` is in no gate.** `test:packages` scopes `@noodl/mcp` but not `@noodl/observe`,
so the server we would be pointing every new user at has a suite nothing runs.

### Q3's premise was inverted, and TAB-006 says so

Richard's lean was (c) — TAB-006's directory + `list_projects` — reasoning that tabbed projects mean
Claude Code must be told which project to edit. But
[TAB-006](../phase-37-project-tabs/TAB-006-TAB-AWARE-AGENT-ACCESS.md#L23) records the opposite split:
`noodl-mcp` is bound to **the project path in argv** and the effect of phase 37 on it is *"none — it
works unchanged"*; it is `nodegx-observe`, bound to a port, whose addressing tabs actually break.

The path in the command **already is** the "which project" instruction. `list_projects` cannot help
the authoring server choose, because `ProjectStore` is constructed once at spawn and no code path
rebinds it. What tabs genuinely break is observe's discovery — which is TAB-006's own scope.

The real defect the instinct was pointing at is finding 2 above, and its fix is cheap and available
now: **name the registration after the project**.

### Decisions

| # | Decision | Consequence |
|---|---|---|
| 1 | **Q1 — the front door is a section in Editor Settings**, beside `AiSettingsSection` in [EditorSettingsTab.tsx:72](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/EditorSettingsTab.tsx#L72). | It sits next to the AI keys the user already configured, and the current project's path is in reach. Templating, not design. A launcher card is reconsidered only if the on-ramp changes. |
| 2 | **Q2 — two Copy buttons with one-line captions**, one per server. The phase-36 merge question stays closed. | Honest about what exists: they have different prerequisites and different failure modes. Re-open the merge only if users trip on it. |
| 3 | **Q3 — (a): the editor creates the project, the agent builds in it.** Not (b), not (c). | Matches "look at the result in NodeGX" anyway. (c) is TAB-006's job and gated on unbuilt TAB-001/002; (b) would change `ProjectStore`'s constructor contract and every tool's guard for an on-ramp the settings copy can just explain. |
| 4 | **The emitted server name carries the project**: `claude mcp add nodegx-<project-slug> …`. | Multiple projects coexist as distinct registrations instead of overwriting one another, and the agent picks by name. This is the piece that makes the tabbed future work without a rewrite — decided now because it costs nothing now. |
| 5 | **Q4 — a user-facing docs page**, linked from the section, **plus** both package READMEs corrected. | The observe README's `{ "command": "nodegx-observe" }` ([README.md:30](../../../packages/nodegx-observe/README.md#L30)) does not work off-PATH, and noodl-mcp's assumes a cloned repo. Three surfaces, one story. |
| 6 | **The observe reconnect fix gates the observe button.** | Finding 1. A command that dies on the next editor restart, with a message that doesn't say why, is a worse first impression than no button. Its suite joins `test:packages` in the same task. |
| 7 | **Ship both `dist/*.cjs` via `extraResources`**, resolved from `process.resourcesPath` in packaged builds and the repo path in dev. | Without it, step 1's command only works for people who cloned the repo. The precedent is exact: [build-editor.ts:69-73](../../../scripts/build-editor.ts#L69) already builds `nodegx-backend` for this, and [ServiceSupervisor.js:79](../../../packages/noodl-editor/src/main/src/local-backend/ServiceSupervisor.js#L79) already does the resolution. |
| 8 | **The command invokes `node`**, not `ELECTRON_RUN_AS_NODE` against the app binary. | Anyone running an MCP client has Node; the Electron trick buys little for the added strangeness. **`npm publish` is deliberately not taken** — cleanest for strangers, but it needs a publish pipeline and version discipline `extraResources` doesn't. |

### Deliberately not taken

**The preview button** (the doc's ranked item 5 — `npm run preview -- <dir> --open` →
`http://127.0.0.1:8575`). [noodl-preview](../../../packages/noodl-preview/src/cli.ts) is real and the
root `preview` script exists, but it is not MCP, and a settings section titled "Connect an AI agent"
is the wrong home for it. Left here so it can be pulled in on request rather than smuggled in.

### The track

| # | Task | Why |
|---|---|---|
| 1 | [MCP-003](MCP-003-OBSERVE-RECONNECTS.md) — observe reconnects | **Gates MCP-001's observe button.** No reconnect, per-launch token; today the copied command expires at the next editor restart. Also puts `@noodl/observe` into `test:packages`. |
| 2 | [MCP-002](MCP-002-SHIP-THE-SERVERS.md) — ship both servers | Two build steps, two `extraResources` entries, one resolver. Without it MCP-001's commands only work in a cloned repo. |
| 3 | [MCP-001](MCP-001-CONNECT-AN-AI-AGENT.md) — the front door | The settings section. Two captioned Copy buttons, per-project server names, v2-gated authoring button. |
| 4 | [MCP-004](MCP-004-THE-MCP-DOCS-PAGE.md) — the page and the READMEs | The "how this works" link has to resolve, and both package READMEs currently contradict it. |
