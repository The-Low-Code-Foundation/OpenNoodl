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
