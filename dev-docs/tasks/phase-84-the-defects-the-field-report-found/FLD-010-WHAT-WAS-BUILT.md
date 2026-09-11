# FLD-010 — what was built

**Session 18, 2026-09-11.** `session_status` — an MCP tool that asks the running editor whether a
person has a project open and is mid-edit, answered by the editor from its own state.

🔴 **THREE of this task's own claims were wrong, and the biggest one would have had this task
change the relay.** **Fifth task running in this phase whose file was wrong in more than one
place** (FLD-004, FLD-005, FLD-015, FLD-003, now FLD-010). The standing instruction to *measure
before believing a task file in this phase* has now paid five times out of five.

## 1. 🔴 The wrong claims

### (i) "The routing is wrong for this use." *(§2, and §5's trap)*

**It is not, and no relay change was made.** §2 is right that
`broadcastToType = type === 'viewer' ? 'editor' : 'viewer'` means an `editor` peer fans only to
`viewer` peers — and that is a fact about **broadcast**, which this feature does not use.
`relay-server.js:156-160` routes on `request.target` by `clientId` and **ignores peer type
entirely**, and **HLS-009 has been carrying an agent→editor command over exactly that branch since
it shipped**: `openInEditor.ts` registers as a `service`, asks the relay `cmd:'clients'`, and
addresses the window by `target`. `ViewerConnection.processRequest` already has an inbound branch
for it, whose own comment says it is *"the only inbound branch here that is not
`type === 'viewer'`, and that is deliberate."*

The task file never mentions HLS-009. Following §2 instead would have meant editing the fan-out
rule that `nodegx-observe` rides on — the change §5's last trap warns about — **to reach a door
that was already open**.

✅ **This is also what makes AC5 true by construction rather than by assertion.**
`git diff -- packages/noodl-editor/src/main/src/relay-server.js` is **empty**.

### (ii) "Register `noodl-mcp` as a `viewer`-typed relay client." *(§3)*

**Wrong type, and it would have had visible consequences in the editor.** A peer registering as
`viewer` makes the relay announce `cmd:'registered', type:'viewer'` to every editor, and on
disconnect `cmd:'disconnect'` — which `ViewerConnection` handles by dropping that clientId from
`clientsToExportTo`, deleting its export cache, calling
`NodeLibraryImporter.instance.onClientDisconnect` and firing `viewerClientsChanged`, the signal
behind the bottom bar's *"Preview live"*. An agent asking a question would have appeared in the
editor as a preview window arriving and leaving.

`service` is the right type and the shipped precedent already says why, in
`openInEditor.ts`'s own note: it keeps the peer out of the fan-out, and naming no service keeps it
out of the relay's `services` map, where a second MCP server would silently evict the first.

### (iii) "`targetClientId` routes to one peer (`:155-160`)." *(§2)*

The field is **`target`**, at `:156-160`. A small drift, and the kind that costs an hour if it is
copied into an implementation instead of read off the file.

### Two smaller drifts, both harmless, both recorded because the file will be read again

- *"started from `web-server.js:280`"* — it is **`:386`**.
- *"`provision.ts:26`"* — the sentence is real and quoted correctly, at **`:25`**.

✅ **Two of §2's claims were checked and are RIGHT**, and they are the two the design rests on:
`relay-token.js` has **no `unlink`**, so the token file outlives the editor that wrote it (which is
why AC4 exists and why liveness here is the socket, never a file); and all three fields #41 asked
for are answerable from state the editor already holds.

## 2. What shipped

**Editor side**
- `models/sessionStatus/collect.ts` — `collectSessionStatus()`, a pure read of `ProjectModel`, the
  save baselines and the node graph.
- `models/sessionStatus/index.ts` — `installSessionStatus()`, the relay half, mirroring
  `installExternalProjectOpen` exactly: `ViewerConnection` stays transport, the decision lives in
  the model, the reply is addressed back by `clientId`.
- `ViewerConnection.ts` — one inbound `sessionStatus` branch and `sendSessionStatusResult`.
- `projectmodel.ts` — `hasPendingProjectSave()`, an accessor on the flag
  `flushPendingProjectSave` already reads.
- `ProjectStructure/index.ts` — `baselineProjectDirectory`, a read of the guard FLD-009 added.
- `router.tsx` — installed once per window, beside HLS-009's.

**MCP side**
- `tools/sessionStatus.ts` — `session_status(directory?)`, reusing HLS-009's `findRelayToken` and
  `relayPort` unchanged.
- Appended to the deferred `project` group.

## 3. 🔴 The one property the whole design is built around

**The dangerous answer is not "I don't know". It is a confident `editorAttached: false` produced by
a transport that failed** — an agent told nobody is home, writing over a person's unsaved work.
§5 says this in words (*"every failure mode of the transport must map to unknown, never to no
editor"*) and it is the reason the field is `boolean | null`.

| what happened | status | `editorAttached` |
|---|---|---|
| window answered | `attached` | `true` |
| window registered, did not answer (an editor older than this tool) | `attached-no-answer` | `true` |
| nothing listening on the relay port | `no-editor` | **`false`** |
| relay up, no window registered yet (a starting editor) | `unknown` | `null` |
| token refused by a live relay | `unknown` | `null` |
| no reply, unreadable reply, editor threw | `unknown` | `null` |

**`false` is reachable from exactly one place**, and it is the one the transport can actually
establish: the relay runs *inside* the editor's main process, so nothing listening is genuinely
nobody home.

⚠️ **`unsavedComponents` is `null`, never `[]`, whenever the comparison cannot be trusted** — a
legacy project (no per-component baselines exist) or baselines that still describe the previously
open project. `[]` is the shape of *"every file is safe to write"*, and producing it from another
project's baseline map is the same lie one field over.

## 4. The token budget — measured on both arms, not reasoned about

**A new resident tool costs its whole schema (~276 tokens measured for `derive_starter`) and the
surface had 5 to spare.** Appending to an existing deferred group costs 0, because the only
resident trace of one is `find_tools`' `(N tools)` and *"7 tools"* and *"8 tools"* are the same
length. That is the arithmetic HLS-009 and HLS-008 both recorded — and this time it was **measured
on both arms** rather than inherited:

| arm | `[surface]` |
|---|---|
| with `session_status` | **8,275 / 8,280 — 5 under** |
| the manifest and the registration swapped for their `HEAD` copies | **8,275 / 8,280 — 5 under** |

**0 tokens.** Both files restored and verified md5-identical afterwards.

⚠️ **And the baseline moved since it was last written down.** Memory recorded 8,272 / 8 free at
P85 CMP-006 this morning; it reads **8,275 / 5 free** now, because other work landed in between.
The delta is only honest because both arms were measured in the same minute — a remembered
baseline would have reported this task as costing 3 tokens it did not cost.
