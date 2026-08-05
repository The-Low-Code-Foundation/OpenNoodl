# MCP-001 — "Connect an AI agent": the front door

**Created:** 2026-08-05, out of [TALK-004](TALK-004-THE-MCP-FRONT-DOOR.md) decisions 1, 2, 3 and 4.
**Status:** specified, not started.
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
