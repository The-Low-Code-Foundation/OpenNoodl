# MCP-002 — Ship both MCP servers in the packaged app

**Created:** 2026-08-05, out of [TALK-004](TALK-004-THE-MCP-FRONT-DOOR.md) decision 7.
**Status:** specified, not started. **Gates:** [MCP-001](MCP-001-CONNECT-AN-AI-AGENT.md) for anyone
who did not clone the repo. **Depends on:** nothing.

A packaged-app user has **no file to point `claude mcp add` at**. SUB-010's own assessment named
this — the gap between "provable" and "usable by a stranger" is distribution — and it was never
closed. Without this task, MCP-001's Copy buttons emit a path that exists only on developer
machines.

## The gap, exactly

- `extraResources` in [package.json:82-99](../../../packages/noodl-editor/package.json#L82) has
  four entries: `nodegx-backend/cli.js`, its map, `PRIVACY.md`, `TERMS.md`. **No MCP binary.**
- `dist` is gitignored ([.gitignore:107](../../../.gitignore#L107)), so the built `.cjs` files exist
  only where someone ran the build.
- Both `bin` shims are one line —
  [`require('../dist/noodl-mcp.cjs')`](../../../packages/noodl-mcp/bin/noodl-mcp.js) — and are
  workspace symlinks, not anything on a user's PATH.
- `npm publish` was explicitly deferred in SUB-008 and stays deferred (TALK-004 decision 8).

## Why this is small

The precedent is exact and already load-bearing for the backend:

- **Build step**: [build-editor.ts:69-76](../../../scripts/build-editor.ts#L69) builds
  `nodegx-backend` specifically so `extraResources` has something to copy, with a comment saying so.
- **Resolver**: [ServiceSupervisor.js:60-90](../../../packages/noodl-editor/src/main/src/local-backend/ServiceSupervisor.js#L65)
  probes an ordered candidate list — source-relative path for dev, `app.getAppPath()`, then
  `process.resourcesPath` — and returns both the winner and everything it probed.

Two more build steps, two more `extraResources` entries, one resolver in the same shape.

## Slices

### Slice 1 — build both packages during the editor build

Add `noodl-mcp` and `nodegx-observe` builds to
[build-editor.ts](../../../scripts/build-editor.ts) next to the `nodegx-backend` step, with the same
comment convention naming why they are built (so the next person does not delete them as unused).

Both packages already have `"build": "node build.mjs"` and produce a single `.cjs`.

### Slice 2 — `extraResources` entries

```
../noodl-mcp/dist/noodl-mcp.cjs        → noodl-mcp/noodl-mcp.cjs
../nodegx-observe/dist/nodegx-observe.cjs → nodegx-observe/nodegx-observe.cjs
```

Ship the `.map` files or don't — but decide, and match what `nodegx-backend` does (it ships its
map). A stack trace from a bundled MCP server with no map is unreadable, and these are the
processes an agent runs unattended.

### Slice 3 — one resolver, two servers

A small module — **not** a copy of `ServiceSupervisor`'s function twice — that takes a server name
and returns `{ entry, probed }` over the same candidate order:

1. repo-relative from `__dirname` (dev)
2. `path.join(app.getAppPath(), '..', <name>, '<name>.cjs')`
3. `path.join(process.resourcesPath, <name>, '<name>.cjs')`

Return `probed` for the same reason `ServiceSupervisor` does: when it fails, the list of paths tried
*is* the bug report. MCP-001 renders that list rather than a bare "not found".

⚠️ **`entry: null` is a real state, not an error.** In a dev checkout where nobody has run the
package builds, neither server exists. MCP-001 must be able to say "run `npm run build`" rather
than emit a command pointing at a missing file — so the resolver returns null and the caller
decides.

### Slice 4 — a build-artefact check

`scripts/check-build-artefacts.js` exists and currently knows nothing about these. A packaged build
that silently ships without the MCP binaries is exactly the "a green build proves nothing" class
from the packaging notes — assert both files are present after a pack.

## Success criteria

- [ ] `npm run build:editor` produces both `.cjs` files before electron-builder runs.
- [ ] A packaged app contains `Resources/noodl-mcp/noodl-mcp.cjs` and
      `Resources/nodegx-observe/nodegx-observe.cjs`.
- [ ] The resolver returns the repo path in `npm run dev` and the `resourcesPath` path in a
      packaged build, from the same code.
- [ ] With `dist/` deleted, the resolver returns `entry: null` and a populated `probed`.
- [ ] `check:artefacts` fails if either binary is missing.

## Traps

- **Externals hoisting and DefinePlugin folding** — the standing packaging traps. A green build
  proves nothing; open the packaged app and run one of the commands.
- **`build:editor` runs `lerna clean`.** Anything you built by hand beforehand is gone by the time
  packaging starts; the builds must be *in* the script, not run before it.
- The deploy-artefact precedent (`noodl.deploy.js` gitignored, rebuilt by nothing) is the failure
  mode to avoid repeating: an artefact that exists on the machine that made it and nowhere else.
- Do not add these to `files` in the editor's package.json instead — `extraResources` puts them
  *outside* the asar, which is what lets an external `node` process read them at all.
