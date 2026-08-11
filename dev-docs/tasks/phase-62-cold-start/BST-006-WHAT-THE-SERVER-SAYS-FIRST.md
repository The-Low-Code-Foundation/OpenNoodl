# BST-006 — What the server says before any tool is called

**Status:** 📋 open · **Track: the copy, and one tool** · **pairs with BST-001** · the phase's
`portCopy.ts`

## The gap, stated precisely

The originating complaint has two halves and only one of them is plumbing:

> *"Claude Code doesn't know wtf it is **and** can't connect the MCPs"*

BST-001…004 fix the second. **This task is the first.** An agent that has connected an unbound server
and read nothing has a tool list and no idea what NodeGX is, what it makes, where projects live, or
whether it should make a new one or find an existing one. It will guess — and it will guess from
training data about Noodl, which is the confident-wrong-answer failure the README names as the
expensive one.

The server has exactly one channel for this, it is sent once, and today it says:

```
NodeGX (OpenNoodl) project server for <projectDir> — mode: read-write. Start with get_project_info…
```
([`server.ts:53-56`](../../../packages/noodl-mcp/src/server.ts#L53))

Unbound, **every clause of that is wrong**: there is no directory, `get_project_info` is not
advertised, and the paragraphs that follow are about authoring components into a project that does
not exist.

## §1 — ⚠️ One string, sent once, and it cannot be revised

`instructions` is a constructor argument and part of the `initialize` result. **MCP has no
"instructions changed" notification.** Whatever the unbound server says is what the session has for
its whole life, including after BST-002 binds it.

That single fact shapes this task more than anything else:

- The unbound text must be **complete for the bootstrap moment** — it is all the agent gets before
  its first call.
- It must **not** attempt the bound briefing. Those paragraphs are long, specific, and about
  components, Routers and backends; sent to an agent with four tools they are noise, and by the time
  they are relevant they are already stale. BST-002 §3 carries them in the bind result instead.
- The seam between the two therefore has to be explicit, and it is this task's job to draw it.

## §2 — What the unbound text has to do

Four jobs, in order, and the order is the point — this is read top-down by something deciding its
next call:

1. **Say what NodeGX is, in one sentence**, in terms of what the user gets: a visual app builder
   whose projects are node graphs on disk, which this server reads and writes.
2. **Say what state this server is in**: no project bound; four tools; the rest arrive with a
   project.
3. **Give the two exits, and which to take.** `list_projects` if the user has built before —
   ⚠️ **named first, deliberately**: an agent that reaches for `create_project` by default will make
   a second project beside the one the user meant, and that is a *destructive-feeling* outcome even
   though nothing was deleted. `create_project` when there is nothing, or the user wants something
   new.
4. **Say what happens next**, so binding is not a surprise: creating a project points this server at
   it, and the rest of the tools appear.

⚠️ **What it must not do:** teach authoring. No Router paragraph, no `Static Data`, no plan-first
order. They belong to a project and they arrive with one.

## §3 — Where the copy lives

**One module, exporting both strings**, on the standing rule from phase 60: all copy goes in one
place ([`portCopy.ts`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/portCopy.ts)
is the precedent, and [SIG-001/002/004](../phase-60-values-and-signals/README.md) is why).

Today the bound instructions are a 60-line string literal inline in `createServer`
([`server.ts:53-113`](../../../packages/noodl-mcp/src/server.ts#L53)), interleaved with the comments
explaining which measured failure each paragraph answers. **Move it, keep every comment with the
paragraph it explains.** They are the only record of why those sentences exist, and a paragraph
whose reason is lost is a paragraph someone trims.

Three consumers, one source:

| Consumer | Takes |
|---|---|
| `createServer`, unbound | the bootstrap string |
| `createServer`, bound | the project string, as today |
| BST-002's bind result | the project string |

⚠️ **This is what makes BST-002's "do not duplicate the text" assertable**, and BST-005's
`CLAUDE.md`-does-not-restate check as well. Both are named in their acceptance and neither can be
tested until this module exists. **That is why this task pairs with BST-001 rather than following the
phase.**

## §4 — `list_projects`

No such tool exists in `noodl-mcp` today — grepped, 2026-08-11. TALK-004 mentioned one as
[TAB-006's unbuilt work](../phase-42-first-hour/TALK-004-THE-MCP-FRONT-DOOR.md#L44) and correctly
argued it cannot help a **bound** server choose, since `ProjectStore` is constructed once
([TALK-004's finding](../phase-42-first-hour/TALK-004-THE-MCP-FRONT-DOOR.md#L136)).

**Unbound, that objection inverts.** There is nothing to rebind and a real question to answer: has
this person built something already?

**Where the list comes from — and it is easier than it looks.** The launcher's recent-projects list
is `electron-store`, not renderer `localStorage`:

```ts
private recentProjectsStore = new Store({ name: 'recently_opened_project' });
```
([`LocalProjectsModel.ts:42-44`](../../../packages/noodl-editor/src/editor/src/utils/LocalProjectsModel.ts#L42))

so it is a JSON file under the app's user-data directory, readable by an external process — **the
same discovery pattern `nodegx-observe` already uses** for the relay token
(`~/Library/Application Support/NodeGX/relay-token`,
[TALK-004](../phase-42-first-hour/TALK-004-THE-MCP-FRONT-DOOR.md#L21)). There is a precedent for
reading NodeGX's user-data from a sidecar and it is one this product already ships.

⚠️ **Read it, never write it.** The editor owns that file and rewrites it wholesale on `store()`
([`LocalProjectsModel.ts:85-89`](../../../packages/noodl-editor/src/editor/src/utils/LocalProjectsModel.ts#L85)).
An MCP server writing there races the editor and loses.

⚠️ **Verify each entry before reporting it.** `fetch()` filters to folders that still exist
([`:71-72`](../../../packages/noodl-editor/src/editor/src/utils/LocalProjectsModel.ts#L71)) precisely
because the list goes stale; a tool that reports deleted directories sends an agent to open nothing.
Apply the same filter, and the v2 check as well — a legacy project in the list is one the server
cannot open, and saying so is more useful than omitting it.

⚠️ **Absent is a real answer, not an error.** A machine where NodeGX has never run has no file. The
right response is an empty list and the sentence that `create_project` is the way forward — the same
posture `resolveMcpServer`'s `entry: null` takes
([`resolveMcpServer.js:12-16`](../../../packages/noodl-editor/src/main/src/mcp/resolveMcpServer.js#L12)).

## Acceptance

- An unbound server's `initialize` returns instructions that name NodeGX, the state, both exits and
  what binding does — and **contain no authoring guidance**.
- A bound server's instructions are **unchanged, character for character**, from today. Assert it;
  this task moves a string that measured behaviour depends on.
- Every explanatory comment survives the move, attached to its paragraph.
- `list_projects` returns the launcher's projects, filtered to directories that exist, with legacy
  ones marked rather than dropped.
- On a machine where NodeGX has never run, it returns an empty list and says what to do — not an
  error.
- It never writes to the store file.
- **The consequence:** a fresh agent with only the unbound server connected, asked *"what can you do
  with NodeGX?"*, answers from these instructions — and asked *"open my app"*, calls `list_projects`
  rather than `create_project`. §2's ordering claim is testable and should be tested; if the model
  still reaches for `create_project` first, the copy is wrong and the copy is the deliverable.

## Register

| # | Finding | State |
|---|---|---|
| F25 | `instructions` is fixed at `initialize` and its first clause interpolates a directory an unbound server does not have | ✅ verified, [`server.ts:53-56`](../../../packages/noodl-mcp/src/server.ts#L53) |
| F26 | The bound briefing is a 60-line inline literal whose comments are the only record of which measured failure each paragraph answers | ✅ verified, [`server.ts:53-113`](../../../packages/noodl-mcp/src/server.ts#L53) |
| F27 | No `list_projects` exists in `noodl-mcp` | ✅ verified by grep, 2026-08-11 |
| F28 | The recent-projects list is `electron-store` — a JSON file in user-data, readable by a sidecar, on the relay-token precedent | ✅ verified, [`LocalProjectsModel.ts:42-44`](../../../packages/noodl-editor/src/editor/src/utils/LocalProjectsModel.ts#L42) |
| F29 | The editor rewrites that file wholesale, so the server must read and never write | ✅ verified, [`LocalProjectsModel.ts:85-89`](../../../packages/noodl-editor/src/editor/src/utils/LocalProjectsModel.ts#L85) |
| F30 | An agent shown `create_project` first will make a second project beside the user's existing one — an ordering problem in the copy, not in the code | ⚠️ ours to design; §2's ordering is the mitigation and it is testable |
