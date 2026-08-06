# MCP-001 — "Connect an AI agent": the front door

**Created:** 2026-08-05, out of [TALK-004](TALK-004-THE-MCP-FRONT-DOOR.md) decisions 1, 2, 3 and 4.
**Status:** built, 2026-08-06. Both commands verified end-to-end against the real `claude` CLI
(see "What shipped" at the foot). Not yet driven in the running editor — the live-QA recipe is
written and the section has never been on screen.
**Depends on:** [MCP-003](MCP-003-OBSERVE-RECONNECTS.md) (gates the observe button),
[MCP-002](MCP-002-SHIP-THE-SERVERS.md) (gates both buttons for non-repo users).
**Pairs with:** [MCP-004](MCP-004-THE-MCP-DOCS-PAGE.md) — the section's link has to resolve.

Richard's item 13: *"I don't see where to start the MCP server, get its URL and copy paste the
terminal command… This needs to be super clear because it's the main point of attraction."*

**There is no URL and nothing to start.** Both servers are stdio processes the MCP client spawns
itself. The deliverable is two copy-pasteable `claude mcp add` commands with the right absolute
paths already substituted.

## Where it goes

A new section in
[EditorSettingsTab.tsx:72](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/EditorSettingsTab.tsx#L72),
beside `<AiSettingsSection />`. Same `CollapsableSection` chrome as everything else in that tab.

The interaction is already written and shipping — reuse it verbatim rather than inventing one:
[ExecutionDetail.tsx:180-190](../../../packages/noodl-editor/src/editor/src/views/panels/ExecutionHistoryPanel/components/ExecutionDetail/ExecutionDetail.tsx#L184)
is a button that writes to `navigator.clipboard` and flips its own label to a confirmation, with the
text built by a **pure, React-free module beside it** (`fixRequest.ts`, whose header explains that
separation). Do the same: a pure `mcpCommands.ts` that builds strings, and a thin component.

## The two commands

```
claude mcp add nodegx-<project-slug> -- node <resolved>/noodl-mcp.cjs <project-dir> --allow-writes
claude mcp add nodegx-observe        -- node <resolved>/nodegx-observe.cjs
```

- `<resolved>` comes from [MCP-002](MCP-002-SHIP-THE-SERVERS.md)'s resolver — the repo path in dev,
  `process.resourcesPath` in a packaged build.
- `<project-dir>` is `ProjectModel.instance._retainedProjectDirectory`.
- `node`, not `ELECTRON_RUN_AS_NODE` (TALK-004 decision 8).

### The slug is the directory basename, not the project name

⚠️ **`ProjectModel.instance.name` is optional** —
[projectmodel.ts:123](../../../packages/noodl-editor/src/editor/src/models/projectmodel.ts#L123)
declares `public name?: string`, and `LocalProjectsModel` falls back to the literal `'Untitled'`
([LocalProjectsModel.ts:180](../../../packages/noodl-editor/src/editor/src/utils/LocalProjectsModel.ts#L180)).
Slugging the name gives you `nodegx-undefined`, or two different projects both registering as
`nodegx-untitled` — which re-creates the exact collision decision 4 exists to prevent.

Use the **basename of `_retainedProjectDirectory`**: always present when the path is, unique on disk
by construction, and stable across renames. Slug it (lowercase, non-alphanumerics to `-`, collapse
runs, trim) and keep it short.

The observe registration takes **no** project suffix — it attaches to whatever app is running, and
one is all you can have today.

## Slices

### Slice 1 — the pure command builder

`mcpCommands.ts`: takes `{ authoringEntry, observeEntry, projectDir }` and returns the two command
strings plus a per-button reason-it-is-unavailable. No React, no clipboard, unit-tested. Every rule
above lives here.

### Slice 2 — the section

Two rows, each with a one-line caption saying *what it is for* (decision 2 — two servers presented
as two things):

- **Authoring** — edits the components and files of this project on disk. Does not need the app
  running.
- **Observe** — watches and drives your **running** app. Needs the editor open with the preview
  started.

Plus a link to the docs page ([MCP-004](MCP-004-THE-MCP-DOCS-PAGE.md)) and one short paragraph on
the first-run flow: **create the project in NodeGX, then point the agent at it** (TALK-004 decision
3 — this copy is the entire deliverable of choosing option (a), so it has to actually be written).

### Slice 3 — gate the authoring button on the v2 check the server itself performs

A copied command that dies at startup is worse than no button. `noodl-mcp` refuses unless the
directory holds `nodegx.project.json` **or** `components/_registry.json`
([ProjectStore.ts:113-123](../../../packages/noodl-mcp/src/project/ProjectStore.ts#L113)), and it
distinguishes the legacy case (a monolithic `project.json`) with a different message.

Perform the same check, and **surface the server's own wording** — including the "migrate it to the
v2 format" path for legacy projects. Two sources of truth for this message will drift; prefer
importing the string, or at minimum leave a comment at both ends naming the other.

### Slice 4 — the honest unavailable states

Three, each with its own copy, none of them a disabled button with no explanation:

| State | What the section says |
|---|---|
| No project open | The authoring command needs a project. Observe still offers its button. |
| Binary not found (`entry: null`) | Name the paths probed (MCP-002 returns them) and, in a dev checkout, that the package build has not run. |
| Not a v2 project | The server's own message, verbatim (slice 3). |

## Success criteria

- [ ] The section appears in Editor Settings under the AI section, in both themes.
- [ ] Copying the authoring command and running it registers a working server against the open
      project — verified by an agent listing that project's components.
- [ ] Two different projects produce two differently-named registrations that coexist.
- [ ] Copying the observe command and running it registers a working server — and it still works
      after the editor is restarted (that is [MCP-003](MCP-003-OBSERVE-RECONNECTS.md), verified
      here because this is the surface that promises it).
- [ ] The authoring button is unavailable, with the server's own message, on a legacy project.
- [ ] With `dist/` deleted, the section explains rather than emitting a broken command.
- [ ] Driven live in the real editor, both themes, packaged build included — not only in dev.

## Traps

- **HMR will not reach a mounted panel.** Sidebar panels are hidden-not-unmounted; restart the
  editor before concluding anything about this section's rendering.
- **`navigator.clipboard.writeText` needs a user gesture and a focused document.** The
  ExecutionDetail button works because it is a real click handler — keep it that way.
- **Concurrent-session note:** another session has uncommitted work in `projectmodel*` and
  `LocalProjectsModel.ts`. This task only *reads* `ProjectModel.instance`; do not edit those files,
  commit by explicit pathspec, never `git add -A`, never stash.
- ⚠️ **`claude mcp add` writes to a scope tied to the directory it is run from.** Verify the CLI's
  current default before shipping the string — if the copied command lands in a scope the user does
  not expect, the registration "works" and then appears to vanish. Decide explicitly whether to
  emit a scope flag; do not leave it to chance.
- The section's copy makes promises about the observe server's reliability. If MCP-003 has not
  landed, **do not ship the observe button** — that ordering is the whole point of the track.

---

## What shipped — 2026-08-06

### The two strings

```
claude mcp add --scope user nodegx-<dir-slug> -- node <authoring-entry> <project-dir> --allow-writes
claude mcp add --scope user nodegx-observe    -- node <observe-entry>
```

Both were **run**, not just written. Two projects registered as `nodegx-demo-app` and
`nodegx-hello-world` simultaneously, both reporting `✔ Connected`; `claude mcp get` confirmed
`Scope: User config (available in all your projects)`; all three registrations removed cleanly
afterwards. `nodegx-observe` registered and reported `✘ Failed to connect`, which is correct with
no editor running — MCP-003 kept startup refusal deliberate and only recovers an already-running
server.

### The scope flag the traps section asked us to decide

⚠️ **`--scope user`, and it is not the default.** `claude mcp add --help` gives
`-s, --scope <scope>  Configuration scope (local, user, or project) (default: "local")`, and
`local` ties the registration to the directory the command was pasted in — a directory the editor
cannot know. The user pastes into whatever terminal is open, and from anywhere else the server
would look as though it had silently vanished. `user` is the only scope whose behaviour this
section can honestly promise. The section says so on screen: *"Registers it as `<name>` for your
user account, so it works from any directory."*

### Two rules the task doc did not have

1. **The paths must be shell-quoted.** The default project location has a space in it, so an
   unquoted command points `node` at the first word of the path. And the quoting is not uniform:
   a backslash is an escape character inside POSIX double quotes and a path separator on Windows,
   so `quoteArg` wraps a drive-letter/UNC path without touching its separators and escapes
   everything else the POSIX way.
2. **Two slugs collapse, and one of them collides with the other button.** A directory named only
   in non-Latin script slugs to the empty string, and a directory literally named `observe` slugs
   to `nodegx-observe` — the *other* registration, which it would overwrite. Both fall back to a
   short FNV-1a hash of the full path.

### Where the code is

| | |
|---|---|
| Pure command builder | `SettingsPanel/sections/mcpCommands.ts` (no React, no clipboard, no imports at all) |
| The section | `SettingsPanel/sections/McpSettingsSection.tsx` + its `.module.scss` |
| Paths + project verdict | `main/src/mcp/mcpFrontDoor.js`, over `ipcMain.handle('mcp:front-door')` |
| Tests | `tests-unit/mcp-001/mcpCommands.test.ts`, `tests-main/mcp/mcp-front-door.test.js` |

The renderer cannot call `resolveMcpServer` directly — it reads `__dirname` relative to the *main*
bundle and asks `require('electron').app` for the app path — hence the round trip. Nothing in the
renderer guesses a path.

### The v2 gate, and the duplicated strings

`mcpFrontDoor.describeProject` performs `ProjectStore`'s own two-file check and reproduces its two
refusal messages verbatim, including the *"Migrate it to the v2 format (NodeGX editor: project
settings → migrate)"* path. They cannot be imported (`@noodl/mcp` is not a dependency of the
editor, and making it one would drag the server bundle into the main process), so **both ends now
carry a comment naming the other** and `tests-main/mcp/mcp-front-door.test.js` asserts the wording
rather than just the verdict.

### Staleness, which the traps section is right about

Sidebar panels are hidden-not-unmounted, so this section does not remount and every answer in it
can age: someone runs `npm run build:sidecars`, or opens a different project. Two things stop that
being silent — the project path each command was built from is printed under it, and a **Check
again** button re-asks the main process (which re-resolves rather than caching).

### The docs link is probed, not hard-coded

MCP-004's page is a change to a **different repository**, so on the day this shipped the URL 404s.
A link that 404s is worse than no link, and a hard-coded one we must remember to switch on is
exactly the kind of promise that goes stale. So the section `HEAD`s
`<docs-endpoint>/docs/getting-started/ai-assisted-dev/mcp/` once per session and renders the
"How this works" button **only if it answers**. It turns itself on the day the page is published,
with no editor release. A network failure and "not published" are deliberately indistinguishable:
both mean "do not offer a link".

### Live-QA recipe — not yet run

Not driven live: a dev launch rewrites the example project and a sibling session shares this
checkout. What to do, in **both themes** (Settings → Editor → Appearance → Theme):

1. Open Settings → the **Editor** tab. "Connect an AI agent" is the last section, under **AI**.
   Check the section header, the two captions, the command boxes and the dashed unavailable boxes
   all read correctly in light *and* dark — the stylesheet is token-only, so a hard-coded colour
   would show up as an unreadable box in one theme.
2. With a v2 project open: both rows show a command. Click **Copy the command** on each; the label
   flips to "Copied — paste it in a terminal" and returns after three seconds. Paste each into a
   terminal **in an unrelated directory** and run it; `claude mcp list` must show both, the
   authoring one `✔ Connected`.
3. Ask the agent to list that project's components — it must answer about the project the editor
   has open.
4. Open a *second* project. The section will still be showing the first one's path (it does not
   remount): press **Check again**, and the command's server name and path must both change.
5. Restart the editor, leave the observe server registered, and ask it something — MCP-003's
   reconnect is what this section's copy is promising.
6. `mv packages/noodl-mcp/dist packages/noodl-mcp/dist.bak`, press **Check again**: the authoring
   row must become the dashed box listing every probed path and saying `npm run build:sidecars`,
   with no command. Restore.
7. On a legacy project, the authoring row must show `noodl-mcp`'s own migration message.
8. Close the project: the authoring row says to open one; **the observe row still offers its
   button**.
