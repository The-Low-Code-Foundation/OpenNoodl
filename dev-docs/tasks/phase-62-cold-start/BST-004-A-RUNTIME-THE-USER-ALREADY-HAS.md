# BST-004 — A runtime the user already has

**Status:** 📋 open · **Track: distribution** · **blocks BST-003** ·
⚠️ **re-opens [TALK-004 decision 8](../phase-42-first-hour/TALK-004-THE-MCP-FRONT-DOOR.md#L154)**

## The gap, stated precisely

Every command this product emits starts with `node`:

```ts
return ['claude', 'mcp', 'add', '--scope', MCP_SCOPE, serverName, '--', 'node', ...args.map(quoteArg)].join(' ');
```
([`mcpCommands.ts:163-165`](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/mcpCommands.ts#L163))

The decision that put it there is explicit and was reasonable:

> **The command invokes `node`**, not `ELECTRON_RUN_AS_NODE` against the app binary. **Anyone running
> an MCP client has Node**; the Electron trick buys little for the added strangeness.
> ([TALK-004 decision 8](../phase-42-first-hour/TALK-004-THE-MCP-FRONT-DOOR.md#L154))

**The premise is true of the users that decision was written for and false of the ones this phase is
written for.** It holds for someone running the `claude` CLI from a checkout. It does not hold for a
designer who installed the Claude Code desktop app and a NodeGX installer, has never used a terminal,
and has no reason to have a Node runtime on their machine — which is precisely the person in the
originating report.

⚠️ **And the failure is silent in the worst way.** `claude mcp add` records a command; it does not run
it. The registration succeeds, the card says connected, and the server fails to spawn later inside
the client with a `spawn node ENOENT` the user never sees in NodeGX. **We would be reporting success
for a connection that cannot work** — the exact failure mode MCP-001 was built to prevent when it
gated the button on the v2 check rather than emitting a command that dies at spawn time.

## §1 — The runtime we ship

Electron **is** a Node runtime. `ELECTRON_RUN_AS_NODE=1` against the app binary runs a plain Node
process with the app's bundled V8 and no window — and every NodeGX install has one by definition.

```
claude mcp add --scope user nodegx --env ELECTRON_RUN_AS_NODE=1 -- <app binary> <…>/noodl-mcp.cjs --allow-writes
```

The bundles are already outside the asar for exactly this class of reason — `extraResources`, because
*"the process that reads them is an external `node`, which cannot see inside one"*
([`resolveMcpServer.js:16-19`](../../../packages/noodl-editor/src/main/src/mcp/resolveMcpServer.js#L16)).
An Electron-as-Node process reads them the same way. **Nothing about the packaging changes.**

⚠️ **Three things to confirm before committing to this** — each is a real way it can be worse than
`node`:

1. **stdout must be clean.** MCP speaks protocol on stdout
   ([`cli.ts:1-4`](../../../packages/noodl-mcp/src/cli.ts#L1)). Electron writes to stdout in some
   configurations; a single stray line corrupts every message. **Drive it and read the raw stream** —
   this is the one that would make the whole approach unusable, and it is cheap to test.
2. **The binary path per platform.** `.../NodeGX.app/Contents/MacOS/NodeGX` on macOS,
   `NodeGX.exe` on Windows. Both have spaces in the usual install locations; `quoteArg` already
   handles that including the Windows-path case
   ([`mcpCommands.ts:141-161`](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/mcpCommands.ts#L141)).
3. **`--env` support in `claude mcp add`.** ⚠️ **unverified.** If the flag is not available, the
   fallback is a tiny launcher script written next to the bundle that sets the variable and execs —
   which is more moving parts and should be a second choice.

## §2 — Which command each surface emits

**Not a global swap.** The decision differs by audience, and conflating them is how a working
setup gets broken for the people who already have one.

| Surface | Runtime | Why |
|---|---|---|
| **BST-003's launcher card** | Electron-as-Node, always | Its audience is defined by not having Node. It is also the command we *run for them*, so strangeness costs nothing — nobody reads it |
| **The settings section** (MCP-001) | `node` if present, Electron otherwise | Its audience is someone deliberately wiring an agent to one project, and `node <path>` is legible, portable and pasteable into any client. Decision 8's reasoning survives here intact |
| **Package READMEs** | `node` | Documentation for people working in a checkout. Unchanged |

⚠️ **Detect, do not assume, and detect in main.** Whether `node` resolves is a property of the
machine, and the answer belongs beside the bundle resolution that already runs there
([`mcpFrontDoor.js`](../../../packages/noodl-editor/src/main/src/mcp/mcpFrontDoor.js)) — it is one
more field on the front-door answer, on the exact model of `entry` and `probed`. A renderer that
guesses will guess wrong on the machines that matter.

⚠️ **`probed`-style honesty applies here too.** When `node` is missing, say so where a person can see
it, rather than silently emitting a different command. The resolver's own rule — when it misses, the
list of paths tried *is* the bug report
([`resolveMcpServer.js:12-16`](../../../packages/noodl-editor/src/main/src/mcp/resolveMcpServer.js#L12))
— is the standard to meet.

## §3 — What is not re-opened

**`npm publish` stays refused.** It would delete this task entirely — `npx @nodegx/mcp` needs neither
a path nor a runtime we chose — and decision 8's second half rules it out for reasons this phase does
not change: no publish pipeline, no version discipline, and it would put a network fetch in the
first-run path. Named here so the option is visibly declined rather than forgotten.

## Acceptance

- On a machine with **no `node` on PATH**, the launcher card's command registers a server that
  **actually spawns and answers `tools/list`**. Verify inside a real client, not by inspecting the
  string — this task exists because a recorded command that never runs looks identical to a working
  one.
- The raw stdio stream from the Electron-as-Node server is **byte-clean MCP**. Capture it and check;
  §1's first risk is the one that invalidates the approach.
- macOS and Windows both, with a space in the install path.
- The settings section is **unchanged on a machine that has `node`** — same command, character for
  character. Assert it, so this task cannot regress the shipped path.
- Where `node` is absent, the front-door answer says so, and the fallback runtime is named rather than
  substituted silently.
- Both runtimes are chosen in `mcpCommands.ts` from a field supplied by main; no detection in the
  renderer.

## Register

| # | Finding | State |
|---|---|---|
| F15 | Decision 8's premise — "anyone running an MCP client has Node" — is false for the desktop-app user this phase serves | ✅ verified as a premise, [TALK-004 decision 8](../phase-42-first-hour/TALK-004-THE-MCP-FRONT-DOOR.md#L154) |
| F16 | `claude mcp add` records a command without running it, so a missing runtime fails **later, inside the client**, after we reported success | ⚠️ ours to design; the reason this blocks BST-003 rather than following it |
| F17 | `extraResources` places the bundles outside the asar precisely so an external Node can read them — an Electron-as-Node process reads them identically | ✅ verified, [`resolveMcpServer.js:16-19`](../../../packages/noodl-editor/src/main/src/mcp/resolveMcpServer.js#L16), [`package.json:95-102`](../../../packages/noodl-editor/package.json#L95) |
| F18 | Electron-as-Node keeps stdout clean enough for stdio MCP | ⚠️ **unverified, and it can invalidate the whole task.** Test first |
| F19 | `claude mcp add` supports `--env` | ⚠️ **unverified.** Fallback is a shim script, which is worse |
