# BST-002 — `create_project` binds the live server

**Status:** 📋 open · **Track: the seam** · ⭐ **the flagship** · **depends on BST-001** ·
✅ **the gate in §2 is MEASURED and it passed** — see
[MEASUREMENTS §1](MEASUREMENTS-CLIENT-CONTRACT.md#1--f91-claude-code-does-re-list-on-notificationstoolslist_changed).
Claude Code 2.1.217 re-issues `tools/list` **3ms** after the notification, with a clean
no-notification control. **§1 is the whole task; the third-state fallback is not built.**

## The gap, stated precisely

BST-001 gets a stranger from "no projects" to "a project on disk". Without this task that is where
the session ends: the agent has made a project it cannot open, and the user — who does not know what
an MCP registration is, which is why we are here — has to be told to run a second command and restart
their client.

**The first thing they ever built with NodeGX ends in a configuration errand.**

## §1 — What binding actually is

One method on BST-001 §2's binding, called from one place:

```ts
// tools/createProject.ts, after the directory is written and validated
binding.bind(projectDir);          // constructs the ProjectStore over the new project
disclosure.revealNames(BOUND_SET); // the SDK emits notifications/tools/list_changed
```

Both halves already exist. `revealNames` enables the SDK handles and the notification is the
protocol's own ([`disclosure.ts:107-115`](../../../packages/noodl-mcp/src/tools/disclosure.ts#L107),
and the module header states the mechanism at
[`:11-14`](../../../packages/noodl-mcp/src/tools/disclosure.ts#L11)). `ProjectStore` over a directory
`create_project` just wrote is by construction a directory it accepts.

⚠️ **Bind once, and refuse the second.** `create_project` called twice on a bound server must create
the second project and **not** rebind — otherwise an agent tidying up mid-session silently repoints
every subsequent tool at a different project, and nothing in any response says which one it is
describing. The second call returns the same "register a server for this one" advice a bound server
gives today. This is the boundary that keeps BST-002 from becoming the `use_project` contract
[TASKS.md files and does not schedule](TASKS.md#what-is-deliberately-not-here).

## §2 — ⚠️ The behaviour this task is gated on

The disclosure module states the risk itself:

> ⚠️ **A client that ignores the notification never sees them.** That is the one way this trades a
> cost problem for a capability problem
> ([`disclosure.ts:17-22`](../../../packages/noodl-mcp/src/tools/disclosure.ts#L17))

For a deferred group that costs a turn — `find_tools` says so in its payload and `--all-tools` exists
for whoever configured the client. **Here it costs the session.** If Claude Code does not re-list on
`notifications/tools/list_changed`, the agent finishes `create_project` and the authoring tools stay
invisible for the rest of the conversation.

⚠️ **Verify this before designing the rest of the task.** Not by reading documentation — by driving
it: stand up a server that reveals a group mid-session and watch whether the next turn can call the
revealed tool. AWP-006 shipped on this assumption for deferred groups, so **there may already be
evidence in the phase 58 record** — check before spending a drive.

**If it re-lists:** §1 is the whole task.

**If it does not:** the fallback is not "give up", it is *never to have hidden them*. A server
launched unbound could register the full surface up front and let every project tool refuse until
bound — BST-001 §3 rejects that for the bootstrap moment (a model calls what it is shown), and the
tension is real. The resolution then is a **third state**: bootstrap-only until the first
`create_project`, then everything advertised, with `--all-tools` semantics applied at bind. Same
mechanism, and it degrades to "the tools are listed and some refuse" rather than "the tools do not
exist".

## §3 — ⚠️ The briefing is already spent, and this is the silent half of the task

`instructions` is passed to the `McpServer` constructor
([`server.ts:53`](../../../packages/noodl-mcp/src/server.ts#L53)) and its first sentence
interpolates `store.projectDir`. **MCP has no "instructions changed" notification** — the string is
part of the `initialize` result and cannot be revised.

So a server that binds mid-session has already spent its one briefing on BST-006's bootstrap text.
Everything the bound server normally tells an agent up front is therefore **missing at exactly the
moment it becomes relevant**:

- the plan-first order for anything bigger than a two-node fix, and the two primitives nobody finds —
  `Static Data` and `Component Inputs` ([`server.ts:63-73`](../../../packages/noodl-mcp/src/server.ts#L63));
- the PAGES paragraph — a page is unreachable without a Router entry and blank without a `Page` node
  ([`server.ts:79-86`](../../../packages/noodl-mcp/src/server.ts#L79));
- the BACKENDS paragraph, and `provision_backend` first
  ([`server.ts:92-101`](../../../packages/noodl-mcp/src/server.ts#L92));
- `render_report` — *"a graph is a claim, a render is evidence"*
  ([`server.ts:108-112`](../../../packages/noodl-mcp/src/server.ts#L108)).

Every one of those paragraphs is in that string **because a measured model got it wrong without it**
— the comments name the sessions. An agent that binds mid-session and never reads them will reproduce
those exact failures, and the failure will look like a model problem rather than a plumbing one.

**So `create_project`'s result carries the briefing.** It already returns a `note` and a `plan`
([`createProject.ts:378-386`](../../../packages/noodl-mcp/src/tools/createProject.ts#L378)); this
task adds the guidance an unbound session never received. ⚠️ **Do not duplicate the text.** One
exported constant, consumed by the server constructor and by this result — two copies of a paragraph
that exists because a model failed without it is how one of them silently stops matching the product.

⚠️ **This is the defect most likely to ship from this task and it is invisible to every gate.** The
tools appear, the calls succeed, the project builds, and the pages are unreachable because nobody
mentioned the Router. Acceptance below tests for the *consequence*, not the reveal.

## §4 — Where the bind belongs

Inside `create_project`'s handler, **after** the files are written and validated and **before** the
result is returned — so a failed write never leaves a server bound to a half-made project, and a
successful one never returns a result the agent cannot act on.

`registerCreateProjectTools` currently takes only the recorder
([`server.ts:167`](../../../packages/noodl-mcp/src/server.ts#L167)). It gains the binding and the
disclosure registry — the same two arguments `registerAuthorTools` and `registerPlanTools` already
take ([`server.ts:155-156`](../../../packages/noodl-mcp/src/server.ts#L155)), so this is an existing
shape rather than a new one.

## Acceptance

- **The end-to-end run, and it is the acceptance:** one server, launched with no project. Ask for an
  app. `create_project` runs, and **the same session** goes on to build pages into it with
  `create_plan` / `apply_plan`. No second registration, no restart.
- The built app **renders** — `render_report` returns something drawn, not an empty page. §3's
  failure mode passes every other check.
- Pages are reachable: the Router lists them. This is the specific thing a briefing-less agent gets
  wrong, and it is why the acceptance is a render and not a tool count.
- A second `create_project` on a now-bound server creates the project and **does not rebind**.
  Assert the bound directory is unchanged.
- A `create_project` that fails validation leaves the server **unbound**, with the bootstrap surface
  intact.
- The guidance text exists once. A test asserts the constructor's instructions and the bind result
  quote the same constant.
- The bound-from-the-start path is untouched — same tools, same behaviour, existing suite green.

## Register

| # | Finding | State |
|---|---|---|
| F6 | `enable()` → `notifications/tools/list_changed` is the SDK's own mechanism; nothing needs inventing | ✅ verified, [`disclosure.ts:11-14`](../../../packages/noodl-mcp/src/tools/disclosure.ts#L11), [`:107-115`](../../../packages/noodl-mcp/src/tools/disclosure.ts#L107) |
| F7 | **`instructions` cannot be revised after `initialize`**, and the bound briefing exists because measured models failed without it | ✅ verified, [`server.ts:53-112`](../../../packages/noodl-mcp/src/server.ts#L53) — the paragraphs cite LAS-006, AAQ-005, AAQ-011 |
| F8 | A client that ignores `list_changed` never sees revealed tools — a turn's cost for a group, **a session's cost here** | ✅ **measured 2026-08-11: Claude Code is not such a client.** Re-lists 3ms after the notification; control run issues one `tools/list` and never a second. Phase 58's record was no help — it records the *driver rig* being taught to act on the notification, which says nothing about Claude Code. [MEASUREMENTS §1](MEASUREMENTS-CLIENT-CONTRACT.md) |
| F91 | The measurement itself cost nothing, because the probe reveals **on a timer** rather than on a tool call — so booting a client is the whole trigger and no turn is taken | ✅ the technique, worth keeping |
| F9 | `registerCreateProjectTools` takes only the recorder; the binding + disclosure pair is the shape `registerAuthorTools` already uses | ✅ verified, [`server.ts:155-167`](../../../packages/noodl-mcp/src/server.ts#L155) |
