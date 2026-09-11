# FLD-010 — An agent can ask whether a human has the project open

🟢 **BUILT 2026-09-11 (s18) — 5 of 5 ACs.** `session_status`, an MCP tool that asks the running
editor whether a person has a project open and is mid-edit. Driven in the real editor (attached /
`/App` / `unsavedBuffers true → false` naming `Site/FaqRow`, with a no-edit negative control) and
against the real relay in 13 spec arms, 7 mutants armed and caught. **0 resident tokens**, measured
on both arms. Read [FLD-010-WHAT-WAS-BUILT.md](./FLD-010-WHAT-WAS-BUILT.md).

🔴 **THREE of this file's own claims below are WRONG — §2's routing claim, §3's peer type, and
§2's field name — and the routing one would have had this task edit the relay to reach a door
HLS-009 opened months ago.** They are left in place, not corrected, so the next reader can see what
a task file cost; the measurements that replace them are in §1 of the record above. **No relay
change was made: `git diff -- relay-server.js` is empty, which is what makes AC5 true by
construction.**

**R6 is recorded as answered, and the reason is not re-proposable:** the advisory lock in §3 was
ruled OUT on 2026-09-11 because FLD-009 already refuses to reload over a dirty buffer and re-reads
before autosaving. A lock the editor honours and a guard the editor applies are the same
protection; the guard is built, cannot go stale, and needs no release. What was missing was not a
lock but a *reading*, and that is what shipped.

The feature half of #41. Gated on **R6**, because the measured answer is that the lock the issue
asks for is largely unnecessary once FLD-009 lands.

## 1. The person sentence

**An agent about to apply a plan can find out that a person has the project open and is mid-edit,
and say so instead of racing them.**

## 2. What was reported, and what the code says

[#41](https://github.com/The-Low-Code-Foundation/NodeGX/issues/41) asks for three things:
`session_status(project_dir)` → `{editorAttached, unsavedBuffers, currentComponent}`; an advisory
lock the editor surfaces; and a reverse channel telling the agent a human saved.

Measured 2026-09-09:

- 🔴 **The premise that motivates the lock is now false for component files.** The editor refuses to
  reload over a dirty buffer and re-reads before autosaving (see FLD-009 §2). *"Do not both work at
  once"* is over-conservative for the main case. **The remaining hole is FLD-009's, and a lock does
  not fix it either** — a lock the editor honours and a guard the editor applies are the same
  protection, and the guard is cheaper and cannot go stale.
- **The transport exists.** `noodl-editor/src/main/src/relay-server.js`, WebSocket on 8574, started
  from `web-server.js:280`, token-gated per launch (`relay-token.js`). `nodegx-observe` already
  proves an agent can hold a live channel to the editor.
- 🔴 **But the routing is wrong for this use.** `relay-server.js:54-56` —
  `broadcastToType = type === 'viewer' ? 'editor' : 'viewer'` — a peer registered as `editor` fans
  only to `viewer` peers, and the editor renderer is itself an `editor` peer
  (`ViewerConnection.ts:121`). The two primitives needed already exist: `cmd:'clients'` answers
  `{clientId, type}` (`:119-128`) and `targetClientId` routes to one peer (`:155-160`).
- **All three fields are answerable from state the editor already holds** — `ProjectModel.instance`
  and the save-pending flag.
- ⚠️ **There is no "project is open" marker on disk.** `noodl-mcp/src/backend/provision.ts:26` says
  so on the record: *"the editor keeps no lockfile."* And `relay-token` is **written but never
  unlinked on quit**, so its presence proves nothing. Liveness must be "can I register on 8574 with
  the current token", never "does a file exist".

## 3. Scope

- Register `noodl-mcp` as a `viewer`-typed relay client with the launch token, and add a
  `cmd:'sessionStatus'` handler on the renderer side answering from `ProjectModel`.
- Expose it as `session_status(project_dir)`. Additive tool, non-breaking.
- **R6:** if the lock is ruled in, its shape is `<projectDir>/.nodegx/agent-lock.json` with
  `{pid, startedAt, plan_id, host}`, and its stale policy is **PID liveness**, matching the existing
  precedent at `provisionTools.ts:203-205` (`ownerPid`/`ownerAlive`/`ownedByThisServer`). If it is
  ruled out, record the reason in this file so it is not re-proposed.

## 4. Acceptance criteria

1. **(person)** With the editor open on a project, an agent calls `session_status` and gets
   `editorAttached: true` and the component the person is looking at. With the editor closed, it gets
   `editorAttached: false`.
2. 🔴 **The false case is measured, not assumed.** Assert `editorAttached: false` **against a running
   relay with no editor peer**, not merely against a closed port — otherwise the tool reports
   "nobody home" for every transport failure.
3. `unsavedBuffers` is asserted true while a real unsaved edit is held, and false after a save. Both
   arms in one drive.
4. A stale `relay-token` file on disk with no editor running yields `editorAttached: false`. This is
   the specific wrong answer the obvious implementation gives.
5. The existing `nodegx-observe` channel still works — the routing change must not break the viewer
   fan-out it depends on. Asserted, not assumed.

## 5. Traps

- 🔴 **Do not build the lock before R6.** The measured position is that FLD-009 removes most of its
  justification; building a locking protocol nobody needs is expensive and hard to remove.
- 🔴 **A status tool that lies is worse than no status tool.** Every failure mode of the transport
  must map to "unknown", never to "no editor".
- ⚠️ The token is per launch. An agent that cached one from a previous editor session will
  authenticate against nothing; say what happens then.
- ⚠️ Changing `broadcastToType` touches the transport `nodegx-observe` rides on. Read that package
  before editing the routing rule.
