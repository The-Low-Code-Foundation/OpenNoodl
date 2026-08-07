# WFA-009: A Cloud Function Can Return a Value (F27)

## Metadata

| Field | Value |
|-------|-------|
| **ID** | WFA-009 (proposed) |
| **Phase** | Phase 27 — Visual Backend Authoring (Track L) |
| **Tier** | 2 — the authoring substrate, not a surface |
| **Priority** | 🔴 **Blocking for authoring** — a cloud function cannot return a value through the node the template gives you |
| **Difficulty** | 🟡 Medium — small code, but it decides how dynamic ports work in this editor from now on |
| **Estimated Time** | 3–5 days |
| **Prerequisites** | WFA-001 (the generated cloud node library and its synthetic client) |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus** — the decision in §1 outlives the fix |
| **Status** | 📋 **Proposed, not scheduled.** Written 2026-07-28 by WFA-008 so F27 stops being a paragraph in a register. **Richard's call** whether it joins phase 27 (making it 7 / 9) or is picked up elsewhere |

## Objective

Make a Response node's parameter ports exist again, so a cloud function authored in the editor can
return `{result: {...}}` — the thing every non-trivial cloud function has to do.

## Background

### The symptom

Author a cloud function from the shipped template. Its Response node offers `params`,
`errorMessage`, `send` and `status`, and **nothing else**. Type `id` into `params` and no `id` input
port appears, so there is nothing to wire a value into, so the function returns `{result: {}}`.

### The diagnosis, corrected once and re-verified for this spec

The register's original entry blamed the exporter. **WFA-006 corrected it, and every claim below was
re-read from source on 2026-07-28.**

Those `pm-<name>` ports have only ever existed because a **running cloud runtime pushed them to the
editor**:

```ts
// noodl-viewer-cloud/src/nodes/cloud/response.ts:101
export function setup(context, graphModel) {
  if (!context.editorConnection || !context.editorConnection.isRunningLocally()) return;
  …
  context.editorConnection.sendDynamicPorts(node.id, ports);   // :129
}
```

Three facts follow, and together they are the whole finding:

1. **WF-007 deleted the client that ran it.** The cloud runtime's editor connection was the port-8577
   window; since then no `setup()` runs for any cloud node (F25b).
2. **WFA-001 restored the node *library*, not the runtime.** `cloud-node-library.json` is generated
   JSON served by a synthetic client that never executes node code, so `setup()` is not merely absent
   at run time — there is nothing to execute it.
3. **The editor has no local machinery that could do it instead.** The dynamic-port managers are
   commented out in `nodelibrary.ts:117-130` (`numbered`, `portchannel`, `conditionalports`,
   `expand`), and the only surviving path is `applyPortConditionsFilterForNode` (`:452`), which
   *filters* statically declared ports by a condition. **Nothing in the editor can derive a port from a
   parameter's value**, which is exactly what `pm-<name>` needs. The Response node's own
   `dynamicports` in the library carry only the two `conditionalports/extended` entries.

So the ports are missing upstream of anything the exporter does. There is nothing to wire.

### The second fault, behind the first

Currently unreachable, and worth knowing before it is met:

```ts
// utils/exporter/util.ts:16 exportPorts
if (node.type.exportDynamicPorts && !find(node.type.ports, …)) exports.push(p);
```

`noodl.cloud.response` does not set `exportDynamicPorts`, so even once the ports exist in the editor
they would not be written into the export. **But the export may not need them**: the runtime registers
an input when a *connection* names it —
`nodescope.ts:120` calls `targetNode.registerInputIfNeeded(connectionData.targetPort)`, and
`response.ts:89` implements exactly that hook. Which of the two is load-bearing is the first thing to
find out (§2 step 1), because the answer decides whether this task touches the exporter at all.

## Current State

| Piece | Where | State |
|---|---|---|
| The port generator | `noodl-viewer-cloud/src/nodes/cloud/response.ts` `setup()` | Correct, and unreachable — needs a runtime with an editor connection |
| `registerInputIfNeeded` | `response.ts:89`; called from `nodescope.ts:120,149` | Live. A wired `pm-x` would register at run time |
| Editor dynamic-port managers | `nodelibrary.ts:117-130` | **Commented out.** Only `conditionalports/*` survives, as a filter |
| The served library | `cloud-node-library.json` | Static; `dynamicports` has the two conditional entries only |
| Export of dynamic ports | `utils/exporter/util.ts:16` | Gated on `exportDynamicPorts`, which this type does not set |
| Same pattern elsewhere | `noodl-viewer-cloud/src/nodes/data/aggregatenode.js:282` | A second node with the same hook — whatever is built must not be Response-only |

## Desired State

### 1. A decision, recorded before any code: where do value-derived ports come from?

Two candidates. The task's first deliverable is an assessment choosing one, in the shape of
[WFA-004-ASSESSMENT.md](./WFA-004-ASSESSMENT.md) §1 and [WFA-006-ASSESSMENT.md](./WFA-006-ASSESSMENT.md) §7.

**(a) An editor-side provider declared in the node library.** A dynamic-port rule the *library* can
express — "for each name in the string-list parameter `params`, offer an input `pm-<name>` of type
`*` in group `Parameters`" — evaluated by the editor the way `conditionalports/*` already is.
*For:* no second runtime, works with the generated library, one mechanism for every node with this
shape, and it re-opens a door the editor deliberately kept shut (a declarative rule, not arbitrary
code). *Against:* it is a new contract to keep in step with the node's own `setup()`, and the
duplication is real — the drift WFA-004's F42 and F43 both warn about.

**(b) Restore a cloud-runtime editor connection.** A real cloud runtime client that runs node
`setup()` and pushes ports over `sendDynamicPorts`, as before WF-007. *For:* one source of truth —
the node's own code — and it fixes every cloud node at once. *Against:* WF-007 deleted that window on
purpose; re-introducing a long-lived runtime process for authoring is a much larger surface, and
WFA-001 chose the generated library over it deliberately.

Whichever wins, the assessment must answer: **what happens to `aggregatenode`**, and **what a third
node with the same need does next year** — the point of the decision is that it is not a Response-node
special case.

### 2. The port appears, and a wired value arrives

- Typing `id,total` into `params` makes `id` and `total` appear as input ports **without a running
  backend** (the editor is the only thing that can be asked).
- Removing a name removes its port, and a connection into a removed port is handled the way every
  other disappearing port is — not left dangling silently.
- A value wired into `pm-id` reaches the deployed function and comes back in the response body.

### 3. Whether the exporter needs anything is answered by evidence

Step 1 of the implementation is a live test — wire a port, deploy, call, read the body — **before**
touching `exportPorts`. If `registerInputIfNeeded` is enough, the exporter is not part of this task
and the register's original entry stays corrected. If it is not, `exportDynamicPorts` is set for this
type with a test that would fail without it.

## Implementation Steps

1. **Reproduce, and find out which fault is load-bearing.** With the ports faked into the model by
   hand (or set through MCP), deploy a function with a wired `pm-id` and call it. Paste the response
   body into the notes. That single result decides whether the exporter is in scope.
2. **Write the §1 assessment** and choose (a) or (b), including the `aggregatenode` answer.
3. **Build it**, with specs that assert the *behaviour* (a parameter change changes the ports), not
   the implementation.
4. **The live pass**: author a cloud function from the template in the running editor, type two
   parameter names, wire both, deploy, call it, and show the returned body containing both values.
   Then a workflow step calling that function and reading `previous.result.total` — which is what
   WFA-003's `$path` was built for and has never been demonstrated end to end.
5. **Docs**: `docs/runtime/WORKFLOW-NODES.md` and the cloud-function docs describe how a function
   returns a value.

## Success Criteria

- [ ] Typing a name into a Response node's `params` makes an input port of that name appear, with no
      backend running.
- [ ] A value wired into it is returned by the **deployed** function — proven by the response body,
      live.
- [ ] A workflow step calls that function and reads the returned value through `{"$path": …}`.
- [ ] Whatever mechanism is chosen covers `noodl.cloud.aggregate` too, or the assessment says why not.
- [ ] The decision is written down before the code, and the register's F27 entry is closed against it.
- [ ] Editor suite and backend suite green; typecheck clean.

## Out of Scope

- **Reviving the other three dynamic-port managers** (`numbered`, `portchannel`, `expand`). If (a) is
  chosen, this task adds one rule; resurrecting the commented-out block wholesale is a separate,
  larger question about a machinery nothing has needed for two years.
- **A general cloud-runtime editor connection**, unless (b) is chosen deliberately in §1.
- **Changing what a Response node returns.** The shape (`{result: {...}}` / `{error}`) is not in
  question — only whether you can put anything in it.

## Traps

- **The register's original diagnosis was wrong**, and the corrected one is in F27's current entry.
  Do not "fix the exporter" first; it is downstream of a port that does not exist.
- **`conditionalports/*` is a FILTER over declared ports**, not a generator. Reading it as prior art
  for (a) without noticing that difference will produce a rule that cannot express `pm-<name>`.
- **The cloud node library is generated and gated in CI** (`npm run cloud-library:check`, currently
  reporting stale — F36). If (a) changes what the library carries, regenerate and commit it in the
  same change, and fix F36 while there rather than around it.
- **A port that appears in the editor and not in the export is worse than no port**: it looks wired
  and silently drops the value. Whichever half is fixed, the live pass has to read the response body.
- **`setup()` is not dead code.** If a cloud runtime with an editor connection ever returns, it will
  push these ports again — so (a) must not fight it, and the assessment should say what happens when
  both are present.
