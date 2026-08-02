# Next-session prompt — phase 36, after OBS-004

**Replaces** the "after OBS-002" prompt.

**Three of the four OBS tasks are discharged.** Tier 1 (the trace substrate and the walk) and tier 3
(agent access) are built. **OBS-003 — node-local diagnostics — is the only task left in the phase.**

Commits `5b423340`, `03a06d41`, `38f75a0f`, `546c9cc4` (OBS-001/002) and `75c10708`, `bc0ed19c`,
`0d9e4a05`, `039817de` (OBS-004), plus [OBS-002-NOTES.md](./OBS-002-NOTES.md) and
[OBS-004-NOTES.md](./OBS-004-NOTES.md).

Paste the block under the rule. Everything above it is context for choosing.

## Take OBS-003 — but check the territory first

It is the only task left, it has **no dependencies**, and it delivers from the first check. It is
also what makes OBS-004 good: `get_warnings` currently returns whatever the existing `sendWarning`
call sites happen to emit, which is thin.

⚠️ **OBS-003's first batch collides with phase 35.** Its checks target `states.ts`, the Repeater
family, `Set Variable`, `Array`, `Object` and generic checks in `node.ts` — and ERG-001 has been
rewriting exactly those files' failure reporting. As of `ba2a815f` it had reached Array, Object and
Variable. **Read [ERG-001's outcome-contract work](../phase-35-authoring-ergonomics/) first: a
diagnostic check that duplicates a `reportOutcome` call is noise rather than signal.** If phase 35
is still live, either take the nodes it has already finished, or start with the convention (scope
item 1), which touches nothing.

## What OBS-004 gives you

| Thing | Where |
|---|---|
| `nodegx-observe` MCP server, 9 tools, zero runtime deps | `packages/noodl-mcp/src/observe/` |
| Its user-facing docs | [`packages/noodl-mcp/docs/OBSERVE-SERVER.md`](../../../packages/noodl-mcp/docs/OBSERVE-SERVER.md) |
| Input injection by node id | `packages/noodl-viewer-react/src/inputinjector.ts` |
| The relay, now gated | `packages/noodl-editor/src/main/src/relay-server.js`, `relay-token.js` |

**`WalkRow.warnings` is still an empty array, and it is the seam OBS-003 fills.** A check written
today appears in three surfaces without any of them changing: the danger ring, the Problems panel,
and — via `annotateWarnings` in the observe server — an agent's walk.

**A live-driving recipe that worked, and is faster than CDP for anything about the running app:**
build a probe with esbuild against `src/observe/relayClient.ts`, read the token from
`<userData>/relay-token`, and drive the app directly. That is how OBS-004 was verified — topology,
an injected click, a real 7-event cascade and four walks — in one script, with no renderer
automation at all.

## ⚠️ Things that will bite

- **The relay token changes every editor launch.** Anything holding one across a restart is refused
  with close code 4401. A browser tab with the preview open self-heals by reloading **once**.
- **Reloading the editor renderer drops to the launcher** — the project is not reopened.
- **HMR does not reliably pick up new modules under `utils/`.** Suspect a stale module first.
- **The launcher lists two projects named "NodeGX QA Fixture."** They differ. Index into
  `[class^=LauncherProjectCard-module__Card]` and read each card's `__Name` span; do not click by
  name.
- **`http.Server#close()` never fires its callback while a WebSocket is open.** Both new socket
  suites hang rather than fail without terminating clients first.
- **`noodl-mcp`'s tsconfig has `strictNullChecks`; the editor's does not.** Pulling an editor module
  into that package compiles it under stricter rules. `duplicateNodeId.ts` already errors there —
  pre-existing, do not attribute it to a new import.
- `__nodeGraphEditor.activeComponent.graph.nodeMap` is empty; use `graph.findNodeWithId(id)`.
  Serialising a `NodeGraphNode` through CDP hits "Object reference chain is too long".
- Editor specs are **jasmine, not jest** — except `tests-main/` and `tests-unit/`, which are plain
  jest and where pure code belongs.
- The editor takes a **single-instance lock**. If another session is driving it, never run
  `dev:stop` — it kills by checkout and takes their run down too.

---

## The prompt

Continue phase 36 (Track U) on branch `cline-dev` in `/Users/richardosborne/vscode_projects/OpenNoodl`.
**OBS-003 (node-local diagnostics) is the only task left in the phase.**

**First, check whether another session holds the checkout:** `git log --oneline -5` and
`git status --porcelain`, then compare a modified file's mtime against `date` — a clean status only
means they have nothing uncommitted *at that instant*. Phase 35 (ERG-001) has shared this checkout
through the last two sessions. **Never `git stash` in a shared checkout, and never `git add -A`.**
Commit with explicit pathspecs.

**Read first, in this order:**

1. `dev-docs/tasks/phase-36-runtime-observability/README.md` — the design position. "The log is
   never the surface" and "scale comes from topology, not filtering" are the whole spec.
2. `dev-docs/tasks/phase-36-runtime-observability/OBS-003-NODE-DIAGNOSTICS.md` — the task.
3. `dev-docs/tasks/phase-36-runtime-observability/OBS-004-NOTES.md` — what consumes your output,
   and the recurring defect class this phase keeps finding: **a surface stating more than it knows.**
   Three of OBS-002's defects and two of OBS-004's were that, and nothing else.
4. `dev-docs/tasks/phase-35-authoring-ergonomics/ERG-001-OUTCOME-CONTRACT.md` and its S0 measurement
   — so a check does not duplicate a `reportOutcome` call that already reports the same thing.
5. `packages/noodl-runtime/src/editorconnection.ts` around `sendWarning`/`clearWarnings` — the
   channel. It has been shipped and in use for years; nothing needs building.

**The shape of the work.** Scope item 1 first: write down the convention (warning keys, when to
clear, warning vs error, cost on the hot path, where they live) **before the second check is
authored**. Phase 30 and phase 35 both found the same failure — *"the nodes are not individually bad
so much as individually inconsistent, because nobody wrote down the rule they all had to satisfy."*

Then the first batch. The worked example is the shape: a States node receives `"Clicked"` but the
state is named `"clicked"` — `if (!this.states.includes(value)) warn(…)`. Most "aha" moments are
node-local invariants nobody has written yet.

**Two facts about the runtime that decide designs:**

- **Delivery is queued, not a call stack.** `OutputProperty.sendValue` pushes into the target's
  `_inputValuesQueue`; the target drains it in its own `update()`.
- **`cause: 0` means root** — a timer, a DOM event, boot. It does not mean "unknown".

**Definition of done:** a check that fires on a real project, reaches **both** the Problems panel and
the walk's row detail, and has a corpus row proving it fires on the bad input and stays silent on the
good one. Plus: the convention, written down.

**Report at the end:** whether the shelved `TriggerChainDebuggerPanel` was rebuilt or retired
(open question 3, still Richard's call), and whether the two MCP servers should stay in one package
(open question 5, new).

## Open questions for Richard

1. **Buffer default.** Shipped at **250k events** with a **200-char value-preview cap**. The real
   memory lever is the character cap. Still untested at scale.
2. **Session boundary.** Shipped as **clear on trace start and on preview reload**, not time-based.
3. **Does the shelved panel get rebuilt or retired?** Untouched. `TriggerChainDebuggerPanel` is still
   registered `experimental: true` in
   [router.setup.ts](../../../packages/noodl-editor/src/editor/src/router.setup.ts) and still reads
   the old snapshot recorder. OBS-002 replaced what it was *for*; its forward-chain view remains a
   genuine companion surface.
4. ~~**OBS-004 scope.**~~ **Answered: token first.** Built. Note the question understated the
   exposure — browsers do not apply the same-origin policy to WebSockets, so the relay was readable
   by any page the user visited, not merely "obscure".
5. **Do the two MCP servers stay in one package?** `nodegx-observe` ships inside
   `packages/noodl-mcp` as a second binary — one dependency set, one build, no shared code path.
   That was taken to avoid a lockfile change while a concurrent session held the checkout, not
   because they belong together. The spec's warning that the two must not be *confused* stands, and
   sharing a package works against it.
6. **Is the in-editor AI path worth building?** OBS-004 scope item 4, not built. The tools exist and
   the split still holds — in-editor AI reads and explains, Claude Code reads *and acts* — but
   nothing in the editor consumes them today.
7. **Is the property editor worth a per-port entry?** Carried over from OBS-002. Still unbuilt, and
   the property editor is the legacy non-React one.
