# MCP-004 — The page the front door links to, and the two READMEs that contradict it

**Created:** 2026-08-05, out of [TALK-004](TALK-004-THE-MCP-FRONT-DOOR.md) decision 5.
**Status:** **half done, 2026-08-06.** Slice 2 (both package READMEs) is shipped. Slices 1 and 3 —
the page itself — are a change to **another repository** and are specified below, at
"What still has to be written, and where". **Pairs with:**
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

---

## What shipped in this repo — 2026-08-06

### Slice 2 — both READMEs, done

**`packages/nodegx-observe/README.md`.** The bare `{ "command": "nodegx-observe" }` is gone,
replaced by the `claude mcp add --scope user … -- node <path>` form, the generic
`{ "command": "node", "args": [...] }` form, the three packaged-app paths, and an explicit note
saying *why* the old one failed (a workspace symlink on nobody's PATH) so nobody restores it.

A **second stale claim in the same file** was found and fixed while there: it said that a server
started against an older launch *"will refuse to connect and say so; restart it"*. MCP-003 landed
an hour before this and changed that — an already-running server reconnects and re-reads the
token; only *startup* with no editor present still refuses.

**`packages/noodl-mcp/README.md`.** The cloned-repo path is now the contributor note, under
"Contributors, working in a checkout", and it says `npm run build:sidecars` rather than the
per-package build. The primary form is the packaged-app path with the **per-project server name**
and `--scope user`, both with a sentence saying what goes wrong without them.

Both files now open by pointing at **Settings → Editor → Connect an AI agent**, because that is
the only surface that knows the path for the reader's actual installation — a Linux AppImage
mounts at a different path on every launch, so no document can state it.

### One premise of this doc's own to correct

The docs origin is **Docusaurus v3**, not a docsify site. Routes are real paths
(`/opennoodl-docs/docs/guides/…`), not `#/` hash routes. This matters for slice 1 — a page added
at a hash route would not exist — and it is worth knowing that the `{@link
https://docs.noodl.net/#/javascript/…}` URLs still in `global.d.ts.keep` are therefore pointing at
a route shape the live site no longer serves. That is not this task's to fix; it is filed here so
the next person does not "confirm" the hash form from those.

Everything else this doc asserted was verified true: `getDocsEndpoint.ts` is three lines resolving
to `the-low-code-foundation.github.io/opennoodl-docs`; the observe README's config was on line 30
and the noodl-mcp one on line 33; `ProjectStore`'s two refusals are where it says.

## What still has to be written, and where

**Repository:** the docs repo behind `https://the-low-code-foundation.github.io/opennoodl-docs`
(the origin `getDocsEndpoint()` returns — *not* this monorepo's `docs/`, which serves nobody).

### The exact path — this is load-bearing

```
docs/getting-started/ai-assisted-dev/mcp
```

so that it publishes at

```
https://the-low-code-foundation.github.io/opennoodl-docs/docs/getting-started/ai-assisted-dev/mcp/
```

⚠️ **The editor probes that URL literally, trailing slash and all**, and shows its "How this
works" button only when the probe returns `ok`
(`McpSettingsSection.tsx`, `MCP_DOCS_PATH`). Publish it anywhere else and the button never
appears; publish it there and the button turns itself on with no editor release. If the path has
to change, change it in `MCP_DOCS_PATH` in the same breath.

It is a sibling of the three pages that already exist in that section — `overview`, `chat-gpt`,
`rest` (confirmed from the site's sitemap, 2026-08-06) — so it also needs its **sidebar entry**,
or it will publish and be unreachable by navigation.

### The content

Sections 1–6 of "What the page has to say" above, unchanged, plus these corrections now that the
buttons exist and their strings are settled:

- The commands must be **byte-identical in shape** to what ships:

  ```
  claude mcp add --scope user nodegx-<project-slug> -- node <path>/noodl-mcp.cjs <project-dir> --allow-writes
  claude mcp add --scope user nodegx-observe        -- node <path>/nodegx-observe.cjs
  ```

  Including `--scope user` and its explanation. A page that omits it teaches a registration that
  appears to vanish.
- The packaged-app paths (macOS / Windows / Linux deb) and the AppImage caveat — copy them from
  either README, which now agree.
- The failure modes: the v2-format requirement in `noodl-mcp`'s own words including the migration
  path; "the editor is not running" for observe; and — corrected by MCP-003 — that an
  already-running observe server now **recovers by itself** after an editor restart, so the old
  advice to re-register is wrong.
- The first-run flow (TALK-004 decision 3), stated plainly: create the project in NodeGX, then
  point the agent at it.

### How to check it, given the traps

The `useLocalDocs` global makes everything resolve at `localhost:3000` and proves nothing about
the deployed link. The only check that counts is `curl -I` against the published origin returning
200 for the URL above — the same request the editor makes. GitHub Pages caches for ten minutes
(`cache-control: max-age=600`), and the editor probes once per session, so allow for both before
concluding the button is broken.
