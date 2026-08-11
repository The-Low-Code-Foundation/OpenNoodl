# BST-001 — The server that starts with no project

**Status:** 📋 open · **Track: the seam** · ⭐ **structural — BST-002, 003, 004 and 006 all stand on
it** · no user-visible change of its own

## The gap, stated precisely

The tool that creates projects is the one registration in the server that **takes no store**:

```
// AIX-012. Takes no store: it creates a project at a directory the caller
// names, which is by definition not the one this server is pointed at.
registerCreateProjectTools(rec);
```
([`server.ts:165-167`](../../../packages/noodl-mcp/src/server.ts#L165))

Two lines earlier in the same file, the store that it does not need is constructed first and throws:

```ts
const store = new ProjectStore(options.projectDir); // throws early on non-v2 targets
```
([`server.ts:48`](../../../packages/noodl-mcp/src/server.ts#L48) →
[`ProjectStore.ts:115-131`](../../../packages/noodl-mcp/src/project/ProjectStore.ts#L115))

And the CLI will not even let you reach it with nothing: exactly one positional argument, or usage
and exit 2 ([`cli.ts:46-52`](../../../packages/noodl-mcp/src/cli.ts#L46)).

So the capability exists, is store-independent, and is unreachable.

## §1 — The shape of the fix

**`projectDir` becomes optional, everywhere it is threaded.**

```ts
export interface ServerOptions {
  /** Absent = unbound. The server starts with the bootstrap surface and no store. */
  projectDir?: string;
  allowWrites: boolean;
  deferTools?: boolean;
}
```

and the CLI accepts zero or one positional
([`cli.ts:46-52`](../../../packages/noodl-mcp/src/cli.ts#L46)), with the usage text saying what zero
means. **Zero positionals is currently the "you got it wrong" branch**, so the help output is where
someone will first read that unbound mode exists — write it there properly.

## §2 — ⚠️ A lazy store, not sixteen conditionals

The instinct is to make each `register*Tools(rec, store, …)` call conditional. There are sixteen of
them ([`server.ts:126-167`](../../../packages/noodl-mcp/src/server.ts#L126)) and it is the wrong
shape: it makes the unbound surface a property of sixteen call sites, means BST-002 must re-run
registration to bind, and guarantees one of them is forgotten.

**Register everything, always. Hold the store behind a handle that is empty until bound.**

```ts
/** The store, or the reason there isn't one. Constructed once; bound at most once. */
class ProjectBinding {
  private store: ProjectStore | null;
  /** Every tool that needs a project calls this and does not check anything itself. */
  require(): ProjectStore  // throws ToolError('no-project', …) when unbound
  bind(dir: string): ProjectStore  // BST-002. Throws if already bound.
}
```

Three consequences worth having:

1. **The refusal is written once**, so it cannot drift between tools — the same argument
   `ProjectStore`'s own header makes about its two mirrored messages
   ([`ProjectStore.ts:107-114`](../../../packages/noodl-mcp/src/project/ProjectStore.ts#L107)).
2. **BST-002's bind touches one object**, not a re-registration pass.
3. **A tool that forgets to call `require()` fails loudly** the first time it dereferences nothing,
   rather than quietly reading a half-built store.

⚠️ **`require()` must be called at request time, not at registration time.** A `register*Tools`
function that resolves the store into a closure when it registers captures `null` forever. Every one
of the sixteen currently receives `store` as a registration argument and closes over it, so this is
not a hypothetical — **it is the defect this task will ship if the binding is passed where the store
is passed today.** Pass the *binding*, dereference in the handler.

## §3 — What is advertised while unbound

Four tools, and they are resident:

| Tool | Why it is in the bootstrap set |
|---|---|
| `create_project` | The point of the mode |
| `list_projects` | BST-006. So an agent can find projects that already exist instead of making a second one |
| `list_examples` | Scoping a build without a project to read |
| `get_example` | Same, and it is the one thing that shows what a NodeGX graph looks like |

⚠️ **Everything else must be hidden, not merely erroring.** A model calls what it is shown; an
advertised `update_component` on an unbound server produces a call, a refusal, and a turn spent. Use
the disclosure registry that already does this
([`disclosure.ts:78-87`](../../../packages/noodl-mcp/src/tools/disclosure.ts#L78)) rather than a new
mechanism — the unbound surface is one more policy, applied at
[`server.ts:172`](../../../packages/noodl-mcp/src/server.ts#L172).

⚠️ **`find_tools` must not reveal project groups while unbound.** It is resident in both modes by
design ("the door out of the deferred set cannot be behind the write flag",
[`server.ts:142-145`](../../../packages/noodl-mcp/src/server.ts#L142)), so an agent that calls it
will otherwise reveal 85 tools that all refuse. While unbound it should report the bootstrap set and
say plainly that the rest arrive with a project.

## §4 — ⚠️ `--allow-writes` is not optional here

`create_project` is registered inside `if (options.allowWrites)`
([`server.ts:146`](../../../packages/noodl-mcp/src/server.ts#L146)). An unbound **read-only** server
is therefore a server with nothing in it at all.

Two acceptable answers, and the task must pick one deliberately: refuse the combination at startup
with a message that names the flag, or treat unbound + read-only as a listing-only server
(`list_projects`, `list_examples`, `get_example`) that says so. **Refusing is better** — it fails in
the client's MCP status where someone can see it, rather than presenting a server that appears
connected and cannot act.

## §5 — What the startup line says

The stderr line at [`cli.ts:78-88`](../../../packages/noodl-mcp/src/cli.ts#L78) is the one diagnostic
a person configuring a client actually reads. It currently opens with
`noodl-mcp serving <dir> (read-write) on stdio`.

Unbound it must not print a directory it does not have. Something that names the state and the exit:

```
noodl-mcp: no project bound — bootstrap mode (4 tools). call create_project, or restart with a project directory.
```

## Acceptance

- `node noodl-mcp.cjs --allow-writes`, with **no positional argument**, starts, completes
  `initialize`, and answers `tools/list` with exactly the four bootstrap tools.
- The same binary with a project directory behaves **identically to today** — same tool count, same
  groups, same deferral. Assert this against the existing disclosure suite rather than by eye; the
  regression this task risks is to the bound path, which is every existing user.
- `create_project` succeeds from the unbound server and writes a project that
  [`ProjectStore`](../../../packages/noodl-mcp/src/project/ProjectStore.ts#L115) accepts. (Binding
  the live server is BST-002; here it is enough that the directory is real and openable by a second
  server.)
- Every project-shaped tool is **absent from `tools/list`**, not present-and-erroring.
- `find_tools` while unbound reveals nothing project-shaped and says why.
- Unbound + read-only is refused at startup, with the flag named in the message.
- A tool handler that dereferences the binding at **registration** time fails a test. Write that test
  first — it is §2's trap and it will otherwise ship green.
- The refusal string exists in exactly one place and is asserted from there.

## Register

| # | Finding | State |
|---|---|---|
| F1 | `registerCreateProjectTools` already takes no store, and the source comment says why — the capability was always store-independent | ✅ verified, [`server.ts:165-167`](../../../packages/noodl-mcp/src/server.ts#L165) |
| F2 | `new ProjectStore()` runs before any registration, so the throw precedes every tool | ✅ verified, [`server.ts:48`](../../../packages/noodl-mcp/src/server.ts#L48) |
| F3 | The CLI's zero-positional branch is today's usage-and-exit-2 path — the help text is where unbound mode gets explained | ✅ verified, [`cli.ts:46-52`](../../../packages/noodl-mcp/src/cli.ts#L46) |
| F4 | `create_project` is write-gated, so unbound + read-only is an empty server | ✅ verified, [`server.ts:146`](../../../packages/noodl-mcp/src/server.ts#L146) |
| F5 | Sixteen `register*Tools` calls receive `store` as a registration argument and close over it — a binding passed the same way captures `null` permanently | ⚠️ ours to design; **the defect most likely to ship from this task** |
