# MCP-002 — Ship both MCP servers in the packaged app

**Created:** 2026-08-05, out of [TALK-004](TALK-004-THE-MCP-FRONT-DOOR.md) decision 7.
**Status:** **BUILT** 2026-08-06 — all four slices, plus a fifth the doc did not know it needed
(see *The premise that was wrong*). Not verified against an actual packaged app; see *What a
human must still verify*.
**Gates:** [MCP-001](MCP-001-CONNECT-AN-AI-AGENT.md) for anyone who did not clone the repo.
**Depends on:** nothing.

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

## The premise that was wrong — and it was the load-bearing one

**"Follow the `nodegx-backend` precedent" would have shipped nothing.** The precedent is not
load-bearing; it is dead code on the path that matters.

`scripts/build-editor.ts` is the *local* packaging entry point. **CI does not use it.**
[release.yml](../../../.github/workflows/release.yml) and
[nightly.yml](../../../.github/workflows/nightly.yml) call `build:editor:_viewer` and then
`build:editor:_editor` directly, so the `nodegx-backend` build step in `build-editor.ts` has never
run in a published build.

And nothing complains, because electron-builder does not treat a missing `extraResources` source as
an error:

```js
// node_modules/app-builder-lib/out/fileMatcher.js — copyFiles()
const fromStat = await statOrNull(matcher.from);
if (fromStat == null) {
  log.warn({ from: matcher.from }, `file source doesn't exist`);
  return;
}
```

A warning, and the app ships without the file. So **every released NodeGX artifact is very likely
missing `Resources/nodegx-backend/cli.js`** (this task did not run a release to confirm it, but the
code path is unambiguous) — the exact "artefact that exists on the machine that made it and nowhere
else" failure this doc's own traps section warns about, already happening to the thing being
copied.

The fix is one list in one place, called from every path:

- `npm run build:sidecars` builds all three bundles and ends in
  `check-build-artefacts.js --built`, which fails when any `extraResources` source is missing.
- `scripts/build-editor.ts` calls it (replacing its inline `nodegx-backend` step).
- `release.yml` and `nightly.yml` each gained a **Build packaged sidecars** step, because they
  bypass `build-editor.ts` entirely.

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

**Decided: no maps.** Both packages build with `sourcemap: false`, and — the reason that is the
right default rather than an oversight — **Node ignores a source map unless the process was started
with `--enable-source-maps`**, which the command MCP-001 hands out (`node <path> …`) does not pass.
Shipping a 5MB file nothing reads is the stale-artefact failure mode in miniature. If the emitted
command ever gains that flag, flip `sourcemap` in both `build.mjs` files and add two more
`extraResources` entries — one line each. Noted in `build-editor.ts` so the next person finds it.

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

⚠️ **The script is not what this slice assumed.** It is a *git-tracking* guard — it fails when
generated bundles are **committed** — and it runs on a bare checkout with no `npm install`
(`check-build-artefacts.yml`). Adding "both binaries must exist" to it unconditionally would make
`npm run check:artefacts` red in every fresh clone. So it grew two modes instead:

- default (the commit gate): every `extraResources` entry that comes from a package `dist/` names a
  package `build-editor.ts` mentions. Requires nothing to be built, catches an entry added with no
  build step and a build step deleted from under an entry.
- `--built` (run from `build:sidecars`, i.e. from every packaging path): the sources must exist on
  disk.

## Success criteria

- [ ] `npm run build:editor` produces both `.cjs` files before electron-builder runs.
- [ ] A packaged app contains `Resources/noodl-mcp/noodl-mcp.cjs` and
      `Resources/nodegx-observe/nodegx-observe.cjs`.
- [ ] The resolver returns the repo path in `npm run dev` and the `resourcesPath` path in a
      packaged build, from the same code.
- [ ] With `dist/` deleted, the resolver returns `entry: null` and a populated `probed`.
- [ ] `check:artefacts` fails if either binary is missing.

## What shipped

| Slice | Where |
|---|---|
| 1 | `npm run build:sidecars` (root `package.json`), called from `scripts/build-editor.ts` and from both packaging workflows |
| 2 | `packages/noodl-editor/package.json` → `build.extraResources`, two entries, no maps |
| 3 | `packages/noodl-editor/src/main/src/mcp/resolveMcpServer.js` + `tests-main/mcp/resolve-mcp-server.test.js` (6 tests) |
| 4 | `scripts/check-build-artefacts.js`, two modes |

The resolver has **no caller yet** — MCP-001 is its caller, and the IPC that carries it to the
settings renderer is MCP-001's work. It carries each server's one-line caption alongside the path so
the two servers are described in one place rather than in the panel.

## What a human must still verify

No packaged build was run (it is not cheap, and `build:editor` starts with `lerna clean`). The
bundles themselves were built and smoke-run — `node packages/nodegx-observe/dist/nodegx-observe.cjs
--version` prints `0.1.0`, `noodl-mcp --help` prints its usage — but nothing here proves what lands
inside a `.app`. To confirm:

```
npm run build:editor
ls "packages/noodl-editor/dist/mac-arm64/NodeGX.app/Contents/Resources/noodl-mcp"
ls "packages/noodl-editor/dist/mac-arm64/NodeGX.app/Contents/Resources/nodegx-observe"
node "…/NodeGX.app/Contents/Resources/nodegx-observe/nodegx-observe.cjs" --version
```

The last line is the one that matters: `extraResources` puts the file outside the asar precisely so
an external `node` can read it, and only running it proves that it did.

⚠️ **Watch the build log for `file source doesn't exist`.** That warning is how this failed
silently for `nodegx-backend`; `--built` should now make it impossible to reach, and seeing it would
mean the check was bypassed.

## Traps

- **Externals hoisting and DefinePlugin folding** — the standing packaging traps. A green build
  proves nothing; open the packaged app and run one of the commands.
- **`build:editor` runs `lerna clean`.** Anything you built by hand beforehand is gone by the time
  packaging starts; the builds must be *in* the script, not run before it.
- The deploy-artefact precedent (`noodl.deploy.js` gitignored, rebuilt by nothing) is the failure
  mode to avoid repeating: an artefact that exists on the machine that made it and nowhere else.
- Do not add these to `files` in the editor's package.json instead — `extraResources` puts them
  *outside* the asar, which is what lets an external `node` process read them at all.
