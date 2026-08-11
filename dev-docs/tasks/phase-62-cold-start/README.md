# Phase 62 — The cold start: the agent arrives before the project does (Track BST)

**Created:** 2026-08-11
**Status:** 📋 specced, not started. Tasks are **[TASKS.md](TASKS.md)** (BST-001…006).
**Origin:** Richard, 2026-08-11, relaying an installed user:

> *"I installed NodeGX but Claude Code doesn't know wtf it is and can't connect the MCPs"*

and then sharpening it to the case that actually has no answer:

> *"someone who's just installed NodeGX, opened the launcher but doesn't know what to do, so asks
> Claude Code when there are no projects on the machine yet and Claude Code hasn't been pointed to a
> project folder."*

**Every claim about existing code in this phase's files was read in source on 2026-08-11.** Keep that
rule for anything added. Anything marked ⚠️ **unverified** must be confirmed before the task
depending on it is worked.

## The premise, in one sentence

The tool that creates projects **already exists and already takes an arbitrary directory** — and it
can only be reached from inside a project that already exists.

## The circularity, stated precisely

| Link | What is true | Where |
|---|---|---|
| `create_project` needs no project | It takes an absolute `directory`, refuses a non-empty one, and mints the skeleton, `docs/` and a first plan | [`createProject.ts:299-302`](../../../packages/noodl-mcp/src/tools/createProject.ts#L299), [`:386-407`](../../../packages/noodl-mcp/src/tools/createProject.ts#L386) |
| …and the server knows it | `registerCreateProjectTools(rec)` is the one registration that **takes no store** — the source comment says so | [`server.ts:165-167`](../../../packages/noodl-mcp/src/server.ts#L165) |
| but the server will not start | `new ProjectStore(options.projectDir)` throws `not-a-v2-project` **before any tool is registered** | [`server.ts:48`](../../../packages/noodl-mcp/src/server.ts#L48) → [`ProjectStore.ts:115-131`](../../../packages/noodl-mcp/src/project/ProjectStore.ts#L115) |
| and the CLI will not let you try | Exactly one positional argument, or usage and exit 2 | [`cli.ts:46-52`](../../../packages/noodl-mcp/src/cli.ts#L46) |
| and even bound, it is not advertised | `create_project` lives in group `project`, `resident: false` — held behind `find_tools` | [`toolGroups.ts:265-271`](../../../packages/noodl-mcp/src/toolGroups.ts#L265) |
| and it is write-gated | Registered only inside `if (options.allowWrites)` | [`server.ts:146`](../../../packages/noodl-mcp/src/server.ts#L146) |
| so the front door withholds itself | With no project open the authoring row has no command: *"Open a project first."* | [`mcpCommands.ts:208-212`](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/mcpCommands.ts#L208) |
| and says so in as many words | *"Create the project here in NodeGX first… it will not make you one."* | [`McpSettingsSection.tsx:79-80`](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/McpSettingsSection.tsx#L79) |

**There is no path from a fresh install to a connected agent that does not route through the editor
UI first.** The one place a registration command exists is a collapsed section inside Editor
Settings, and its authoring half is unavailable until the thing it is supposed to help you make
already exists.

## ⚠️ This phase reverses a decision. Say so out loud.

[TALK-004 decision 3](../phase-42-first-hour/TALK-004-THE-MCP-FRONT-DOOR.md#L149) considered exactly
this and chose against it:

> **Q3 — (a): the editor creates the project, the agent builds in it.** Not (b), not (c). […] (b)
> would change `ProjectStore`'s constructor contract and every tool's guard for an on-ramp the
> settings copy can just explain.

That was a good call on the evidence then, and **one clause of it did not survive contact with an
installed user: "the settings copy can just explain."** The settings copy is inside the editor. The
person who needs it is in Claude Code, in a different window, in a different application, having
never opened Settings — and the reason they opened Claude Code at all is that the launcher did not
tell them what to do next.

Two things also changed since decision 3 was taken, both of which lower its price:

- **The servers now ship.** MCP-002 landed; both bundles are in `extraResources`
  ([`package.json:95-102`](../../../packages/noodl-editor/package.json#L95)) and
  [`resolveMcpServer.js`](../../../packages/noodl-editor/src/main/src/mcp/resolveMcpServer.js) finds
  them in a checkout and a packaged app alike. Decision 3 was taken when there was no file to point
  at.
- **Progressive disclosure landed** (AWP-006). A server that advertises a small surface and grows it
  mid-session is no longer a thing to invent — it is the mechanism the server already runs on
  ([`disclosure.ts:99-115`](../../../packages/noodl-mcp/src/tools/disclosure.ts#L99)). "Every other
  tool returning a point-me-at-a-project error" is now a policy, not an architecture.

Decision 3's own words were "**(b) as the follow-up**". This phase is that follow-up.

## What the user actually meets today

1. Installs NodeGX. Opens the launcher. No projects.
2. Opens Claude Code, which has: no NodeGX server registered, no NodeGX in its context, and no reason
   to think either exists.
3. Asks it for help. It has nothing — and, being helpful, it will confabulate something about Noodl
   from training data rather than say "I have no tools for this."
4. The one artefact that would fix step 2 is two windows away, behind a collapsed section, disabled.

**Step 3 is the expensive one.** A user whose first NodeGX experience is an agent inventing an answer
does not conclude "the MCP was not connected". They conclude the product does not work.

## The shape this phase builds

One server registration, made once, that works before there is anything to work on:

```
claude mcp add --scope user nodegx -- <runtime> <…>/noodl-mcp.cjs --allow-writes
```

— no project path. It boots **unbound**: a small resident set (`create_project`, `list_projects`,
`list_examples`, `get_example`), an `instructions` string that says what NodeGX is, and every
project-shaped tool answering *"point me at a project, or make one"* instead of not existing.

Then `create_project` **binds the live server** — the same session goes straight on to authoring,
because `tools/list_changed` is already how this server grows.

| | fails when | answer |
|---|---|---|
| **Nothing is registered** | the agent has no NodeGX tools at all, and no way to learn it should | BST-003 registers one server at first launch; BST-004 makes the command runnable without Node |
| **Registered, but inert** | the server will not boot without a project | BST-001 boots unbound and refuses well |
| **Bootstrapped, then stranded** | the project exists, and the session that made it still cannot author in it | BST-002 binds the store and reveals the surface in place |
| **Nothing to read** | the model has a tool list and no idea what NodeGX is or where projects live | BST-006 writes the unbound instructions and `list_projects` |
| **Session two is cold again** | the project folder configures nothing | BST-005 writes `.mcp.json` and `CLAUDE.md` into every new project |

## The three traps this phase will most likely ship

Recorded here because each is a *wrong answer that looks like a working one*.

**1. ⚠️ `instructions` cannot be updated after `initialize`.** It is passed to the `McpServer`
constructor ([`server.ts:53`](../../../packages/noodl-mcp/src/server.ts#L53)) and interpolates
`store.projectDir` into its first sentence. MCP has no "instructions changed" notification. So a
server that binds mid-session **cannot rewrite its own briefing** — the project-bound guidance (the
plan-first order, the Router paragraph, the backend paragraph) has to arrive in `create_project`'s
**tool result** instead. Build the bind path assuming the briefing is already spent. BST-002 §3.

**2. ⚠️ A client that ignores `tools/list_changed` never sees the revealed tools.** The disclosure
module says so itself ([`disclosure.ts:17-22`](../../../packages/noodl-mcp/src/tools/disclosure.ts#L17)),
and today the escape hatch is `--all-tools`. For a deferred *group* that costs a turn. For **BST-002
it costs the whole session** — the user's project exists and their agent cannot touch it. Whether
Claude Code re-lists on the notification is ⚠️ **unverified and gates BST-002's design**; if it does
not, the bind path must also return enough in its result for the agent to keep going.

**3. ⚠️ An unbound server that answers *everything* with an error is worse than one that fails to
start.** Failing to start is loud, appears in the client's own MCP status, and is the failure MCP-001
was built to prevent. A server that starts and then refuses 89 tools is a server the user believes is
connected. BST-001's refusals must name the fix in every message, and the unbound surface must be
*small* — a model that sees `update_component` advertised will call it.

## What this phase is not

- **Not a merge of the two servers.** `nodegx-observe` is untouched. It has no project to be unbound
  from, its addressing problem is TAB-006's, and [TALK-004 decision 2](../phase-42-first-hour/TALK-004-THE-MCP-FRONT-DOOR.md#L148)
  keeps them separate. Nothing here re-opens that.
- **Not a replacement for the settings section.** MCP-001 stays exactly as it is. A per-project
  server with an explicit path is the better registration once a project exists, and someone running
  three projects wants three names ([TALK-004 decision 4](../phase-42-first-hour/TALK-004-THE-MCP-FRONT-DOOR.md#L150)).
  This phase adds the *first* door, not a different one.
- **Not `npm publish`.** Still deliberately not taken
  ([TALK-004 decision 8](../phase-42-first-hour/TALK-004-THE-MCP-FRONT-DOOR.md#L154)) — it needs a
  publish pipeline and version discipline `extraResources` does not. BST-004 re-opens the *runtime*
  half of that decision and not the distribution half.
- **Not rebinding on every project.** The unbound server binds **once**, at `create_project`. A
  server that follows the user around between projects is a much larger contract
  (`ProjectStore` is constructed once and nothing rebinds it — the point
  [TALK-004 made against `list_projects`](../phase-42-first-hour/TALK-004-THE-MCP-FRONT-DOOR.md#L136)
  still holds), and the second project is the case where the settings section's per-project command
  is the right answer anyway.
- **Not a tutorial in the launcher.** BST-003 is one card and one prompt. The phase's bet is that the
  agent explains NodeGX, because the agent is the thing the user already opened.

## The exit test

A person who has never used NodeGX, on a clean machine, with Claude Code installed and **no Node**:

1. installs NodeGX, opens the launcher, and is offered the connection **before** they have a project
   (BST-003) — with a command that runs on a machine that has no `node` (BST-004);
2. asks Claude Code *"what can you do with NodeGX?"* and gets an answer drawn from the server's own
   instructions rather than from training data (BST-006);
3. says *"make me a reading list app"*, and a project appears on disk (BST-001);
4. **in the same session, without re-registering anything**, the agent builds pages into it
   (BST-002);
5. opens that folder in Claude Code the next morning and it is configured already (BST-005);
6. opens NodeGX and the project is in the launcher, because it was written where the launcher looks.

Then the honest measurement, and this phase is unusually easy to fool: **the number is step 3-to-6
completed by someone we did not help.** A registration that succeeds is not a project, and a project
is not an app. Verify the consequence, not the mechanism — count finished apps from cold installs,
not successful `claude mcp add` invocations.

## Relationship to phase 42

Phase 42's MCP track (MCP-001…004) built the front door and is **shipped and verified** — two
projects registered side by side, observe reconnecting across an editor restart under a fresh token
([phase 42 README](../phase-42-first-hour/README.md#L251)). This phase does not revisit any of it.

It answers the one question that track deferred, and it is the question a stranger asks first:
**what happens before there is a project?**
