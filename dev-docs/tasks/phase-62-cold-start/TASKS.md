# Phase 62 — the tasks (BST: the cold start)

**Created:** 2026-08-11, out of [README.md](README.md) and an installed user who could not get Claude
Code to see NodeGX at all.

**Every claim about existing code in these files was read in source on 2026-08-11.** Anything marked
⚠️ **unverified** must be confirmed before the task depending on it is worked. This phase **reverses
[TALK-004 decision 3](../phase-42-first-hour/TALK-004-THE-MCP-FRONT-DOOR.md#L149)** and re-opens
**decision 8**; both reversals are argued in the README and neither is smuggled.

## The one-line premise

`create_project` takes an arbitrary directory and needs no store
([`server.ts:165-167`](../../../packages/noodl-mcp/src/server.ts#L165)) — and it can only be reached
from a server that refuses to start without a project
([`server.ts:48`](../../../packages/noodl-mcp/src/server.ts#L48)).

| Task | File | One line | State |
|---|---|---|---|
| BST-001 ⭐ | [BST-001-THE-SERVER-THAT-STARTS-WITH-NO-PROJECT.md](BST-001-THE-SERVER-THAT-STARTS-WITH-NO-PROJECT.md) | **the structural task** — the store becomes optional, and the unbound surface is four tools | 📋 open |
| BST-002 ⭐ | [BST-002-CREATE-PROJECT-BINDS-THE-LIVE-SERVER.md](BST-002-CREATE-PROJECT-BINDS-THE-LIVE-SERVER.md) | **the flagship** — the session that made the project can author in it. ⚠️ **gated on one unverified client behaviour** | 📋 open |
| BST-003 | [BST-003-THE-ON-RAMP-BEFORE-THERE-IS-A-PROJECT.md](BST-003-THE-ON-RAMP-BEFORE-THERE-IS-A-PROJECT.md) | the launcher offers the connection with zero projects. ⚠️ **contains a decision for Richard** | 📋 open |
| BST-004 | [BST-004-A-RUNTIME-THE-USER-ALREADY-HAS.md](BST-004-A-RUNTIME-THE-USER-ALREADY-HAS.md) | `node` is not installed on a designer's Mac. Re-opens TALK-004 decision 8 for the bootstrap command | 📋 open |
| BST-005 | [BST-005-THE-PROJECT-CONFIGURES-THE-NEXT-AGENT.md](BST-005-THE-PROJECT-CONFIGURES-THE-NEXT-AGENT.md) | every new project carries `.mcp.json` and `CLAUDE.md`, so session two is never cold | 📋 open |
| BST-006 | [BST-006-WHAT-THE-SERVER-SAYS-FIRST.md](BST-006-WHAT-THE-SERVER-SAYS-FIRST.md) | the unbound `instructions`, and `list_projects` so the agent can find what already exists | 📋 open |

## Suggested order, and why

1. **BST-001 first.** Everything else is downstream, and it is the only task that changes a contract
   two other packages read. It ships behind a flag with no user-visible change, which is correct.
2. **BST-006 alongside it.** The unbound server's instructions are the *only* thing a model reads
   before calling anything, and BST-001 is meaningless without them — a four-tool server with a
   project-bound briefing is a worse first impression than no server. Same task boundary as
   FUN-001's: write the copy before the surfaces that consume it.
3. **BST-004 next, and early.** It is small, it is independent, and **it decides the string BST-003
   emits**. Doing it after BST-003 means writing that command twice.
4. **BST-003.** The on-ramp. Needs 001 and 004 to have something correct to emit, and it is the task
   that decides whether any of this is ever seen.
5. **BST-002.** The flagship, and deliberately not first: it is the only task whose design is gated
   on an unverified client behaviour, and the phase delivers real value at step 4 even if 002 has to
   fall back to "register the project server and reconnect".
6. **BST-005** any time after 001. Independent of the live-bind question entirely, and the cheapest
   task that helps the *second* session — which is most sessions.

**If exactly one thing ships from this phase, ship BST-001 + BST-006 + BST-003.** That is a stranger
going from install to a project on disk. BST-002 makes it one session instead of two; BST-005 makes
every session after the first one warm.

## Standing constraints

- ⚠️ **`instructions` is fixed at `initialize` and interpolates the project directory**
  ([`server.ts:53-54`](../../../packages/noodl-mcp/src/server.ts#L53)). A server that binds
  mid-session cannot rewrite its briefing. Project-bound guidance must travel in tool results. This
  is the phase's most likely silent defect: the tools appear, the *knowledge of how to use them* does
  not.
- ⚠️ **`create_project` is inside `if (options.allowWrites)`**
  ([`server.ts:146`](../../../packages/noodl-mcp/src/server.ts#L146)). A read-only bootstrap server
  can create nothing, so the registration BST-003 emits **must** carry `--allow-writes`. A
  bootstrap command without it produces a server that starts, advertises, and cannot do the one thing
  it exists for.
- ⚠️ **`create_project` is `resident: false`**
  ([`toolGroups.ts:265-271`](../../../packages/noodl-mcp/src/toolGroups.ts#L265)). Unbound, it must be
  resident. Do not solve this by making it resident *always* — a bound server advertising
  `create_project` is how an agent makes a second project instead of editing the first.
- ⚠️ **The two `ProjectStore` refusal messages are mirrored by hand in the editor**
  ([`ProjectStore.ts:107-114`](../../../packages/noodl-mcp/src/project/ProjectStore.ts#L107) →
  [`mcpFrontDoor.js`](../../../packages/noodl-editor/src/main/src/mcp/mcpFrontDoor.js)). The editor
  cannot import `@noodl/mcp`. Any change to those strings is a two-file change, and the comment says
  so.
- ⚠️ **A refusal that does not name the fix is a dead end.** Every unbound-mode error is read by a
  model with no other information. `"No project"` produces a guess; `"call create_project, or restart
  me with a project directory"` produces the next correct call. Write them as instructions, not as
  diagnoses.
- ⚠️ **The unbound surface must be small.** A model calls what it is shown. Four resident tools, and
  `find_tools` must not reveal project-shaped groups while unbound.
- **The project directory is still the "which project" instruction.**
  [TALK-004's finding](../phase-42-first-hour/TALK-004-THE-MCP-FRONT-DOOR.md#L136) stands: `ProjectStore`
  is constructed once and nothing rebinds it. BST-002 adds exactly one bind, at exactly one moment.
  Nothing here makes the server follow a user between projects.
- **Verify the consequence, not the mechanism.** Every acceptance list ends at a *project a person
  can open*, not at a server that started or a command that copied. The originating failure was an
  agent that answered confidently with no tools at all.
- **Structure > gate > documentation**, inherited unchanged. BST-001 before its consumers; BST-006's
  copy before the surfaces that quote it.

## What is deliberately not here

- **Merging `noodl-mcp` and `nodegx-observe`.** Phase 36 closed it, [TALK-004 decision 2](../phase-42-first-hour/TALK-004-THE-MCP-FRONT-DOOR.md#L148)
  kept it closed, and nothing observed on 2026-08-11 re-opens it. Observe has no project to be
  unbound from; its discovery problem is tabs, and that is TAB-006's.

- **Rebinding the store on every `open`/`switch`.** The tempting generalisation of BST-002: a
  `use_project` tool that repoints the server at will. It turns a one-shot bootstrap into a stateful
  session contract — every tool result becomes ambiguous about *which* project it described, the
  `instructions` briefing is wrong for all but the first, and the failure mode is an agent editing
  the project the user is not looking at. **Filed, not scheduled.** If it is ever wanted, the shape
  is a server that reports its binding in every result, and that is a change to 89 response
  envelopes.

- **`npm publish`ing the servers.** Would make the registration a one-liner with no paths at all
  (`claude mcp add nodegx -- npx @nodegx/mcp`) and delete BST-004 entirely. Still refused for
  [decision 8's reason](../phase-42-first-hour/TALK-004-THE-MCP-FRONT-DOOR.md#L154) — a publish
  pipeline and version discipline `extraResources` does not have — and it would put a network fetch
  in the first-run path, which is the worst possible place for one. Revisit when there is a release
  pipeline worth hanging it on.

- **Auto-registering silently at install time.** The installer could write `~/.claude.json` and never
  mention it. Refused: it edits another application's configuration without consent, it is invisible
  when it goes wrong, and an uninstall would leave a broken registration behind. BST-003 asks, once,
  and tells the user what it did.

- **A launcher walkthrough.** One card and one prompt. The bet of this phase is that the *agent* does
  the explaining, because the agent is what the user already opened — and BST-006 is where that
  explanation actually lives.

- **Teaching Claude Code about NodeGX globally.** No user-scope `CLAUDE.md` edit, no global rules
  file. BST-005 writes into projects NodeGX creates, and nowhere else. Someone's global config is
  not ours to author.
