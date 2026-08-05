# MCP-004 — The page the front door links to, and the two READMEs that contradict it

**Created:** 2026-08-05, out of [TALK-004](TALK-004-THE-MCP-FRONT-DOOR.md) decision 5.
**Status:** specified, not started. **Pairs with:**
[MCP-001](MCP-001-CONNECT-AN-AI-AGENT.md) — its "how this works" link must resolve.

Nothing user-facing explains what the two MCP servers are, what each needs, or what to do when one
does not connect. The settings section can carry a paragraph; it cannot carry prerequisites,
failure modes and a second client's config format.

## ⚠️ Correction to TALK-004: `docs/` is not the user-facing tree

TALK-004's Q4 says *"Nothing under `docs/` (the user-facing tree) mentions MCP at all."* Both halves
need fixing before anyone acts on it.

- `docs/` in this monorepo contains `format/`, `node-catalog/`, `research/`, `runtime/` — reference
  material, no index, no getting-started. It is **not** what users read. (It also *does* mention
  MCP, in `docs/research/rise-assessment.md`.)
- The user-facing docs are a **separate repo**, served as a dumb CDN from GitHub Pages.
  [getDocsEndpoint.ts](../../../packages/noodl-editor/src/editor/src/utils/getDocsEndpoint.ts)
  resolves to `https://the-low-code-foundation.github.io/opennoodl-docs`, or `http://localhost:3000`
  when the `useLocalDocs` global is set. This is the same origin the Docs panel, the lessons and
  the prefab library all read from (phase 21, ALPHA-006, LEARN-001).

**So the page is a change to the docs repo, not a file added here** — which makes it a different
kind of work with a different review path, and it means the link in MCP-001 points at an origin
this repo does not control. Confirm the docs repo's current structure before writing; do not assume
a path.

## What the page has to say

Written for someone who has never heard of MCP and wants their agent to build a NodeGX app.

1. **There are no URLs and nothing to start.** Both servers are stdio processes the MCP client
   spawns. This is the mental-model correction Richard's report was really asking for, and it
   belongs at the top.
2. **Two servers, and which one you want.**

   | | Authoring | Observe |
   |---|---|---|
   | Reads | the project directory on disk | the running app, over the editor's local relay |
   | Needs the editor running | no | **yes**, with the preview started |
   | Configured with | the project path | nothing |

3. **The commands** — the same strings MCP-001's buttons emit, including the per-project server
   name, so the page and the button never disagree.
4. **Generic MCP host config**, for clients that are not Claude Code — the `{ "command": …,
   "args": [...] }` form.
5. **Prerequisites and failure modes**: the v2-format requirement (with the legacy migration path,
   in the server's own words); "the editor is not running"; and what to do after restarting the
   editor now that [MCP-003](MCP-003-OBSERVE-RECONNECTS.md) makes that recoverable.
6. **The first-run flow** (TALK-004 decision 3): create the project in NodeGX, then point the agent
   at it. Say this plainly rather than letting people discover that `create_project` needs a
   project to already exist.

## The two READMEs that currently contradict all of it

### `nodegx-observe`

[README.md:30](../../../packages/nodegx-observe/README.md#L30) is:

```json
{ "mcpServers": { "nodegx-observe": { "command": "nodegx-observe" } } }
```

**This does not work.** `nodegx-observe` is a `bin` entry resolved through a workspace symlink; it
is on nobody's PATH. Anyone following the README gets a spawn failure with no clue why.

### `noodl-mcp`

[README.md:33](../../../packages/noodl-mcp/README.md#L33) hard-codes a cloned-repo path
(`/path/to/OpenNoodl/packages/noodl-mcp/dist/noodl-mcp.cjs`). Correct for a contributor, wrong for
everyone after [MCP-002](MCP-002-SHIP-THE-SERVERS.md) ships the binaries into the app bundle.

Both should give the packaged-app path as the primary form and the repo path as the contributor
note — and both should use the per-project server name, so the three surfaces (page, README,
button) tell one story.

## Slices

1. **Write the page** in the docs repo, structured as above.
2. **Fix both package READMEs** to match it.
3. **Link it** from MCP-001's section (and check the link against a real docs deploy, not just the
   local server).

## Success criteria

- [ ] A reader who has never used MCP can go from the settings section to a working registration
      without asking anyone.
- [ ] The commands on the page are byte-identical in shape to the ones the buttons emit.
- [ ] The observe README's config works when copied.
- [ ] The link resolves against the published docs origin, not only `useLocalDocs`.

## Traps

- **The docs origin is a dumb CDN with a caching history.** The prefab library's stale-zip trap
  (`<userData>/library/`, never re-downloaded once non-empty) is the same origin — assume a
  published change is not immediately what a user sees, and verify rather than assume.
- **`useLocalDocs` makes everything work locally.** A page that resolves at `localhost:3000` proves
  nothing about the deployed link.
- Do not write the page in this repo's `docs/` and call it done — nothing serves it to users.
