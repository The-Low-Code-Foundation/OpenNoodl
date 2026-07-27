# AIX-005 — live editor verification

> **Superseded in part by `LIVE-RUN.md` (same day).** Everything below still holds, but
> the four items under "Not verified" have since been closed — the app has been run
> against the mock server, and the object-typed property row and port groups have been
> seen on screen. Running it found two defects the test suites could not see. Read
> `LIVE-RUN.md` for what is actually still open.

**Date:** 2026-07-27 · **Branch:** `cline-dev` · **Driven via CDP** (`scripts/devtools/cdp.js`)

Every agent that built these nodes reported "never opened in the editor" as its
largest gap, three of them explicitly. This is the pass that closes part of it,
and states precisely which part is still open.

An editor instance had been running since 23:13 and was holding the primary
checkout — idle at 0% CPU for 2h24m, with a project open and CDP live on 9222.
Its bundle predated every AIX-005 merge, so it could not have verified this work.
It was closed and a fresh instance launched on the merged tree, on Richard's
explicit instruction.

## Verified

| Check | Result |
|---|---|
| Editor boots on the merged tree | `reactMounted: true`, canvas and panels render |
| Renderer exceptions during boot + project open | **0** (`[renderer:exception]` count in `.logs/dev.log`) |
| All 15 new node types in the live node library | **15/15 present**, 150 types total |
| `inNodePicker` | **none** of the 15 flagged `false` |
| Picker placement | Read & Write Data → **Streaming** (6), **App State** (7), **Agent Actions** (2) |
| `project-examples/agent-chat` opens | 7 components, **262 nodes**, root resolves to **`App`** |
| All 15 types instantiate in a real project | **15 distinct types** found on the graph |

The picker check is the one that matters most, because it is the defect this
phase already shipped once: AGENT-003's three store nodes were registered in
`noodl-runtime.js` but absent from `nodelibraryexport.js`, which generates
`inNodePicker: false` — a node that exists and cannot be added. It was found only
because AGENT-002 hit the same edge and mentioned it. Confirming the fix in a
running editor, rather than by reading the index, is the point.

The root-component check matters for a second known trap: `setRootComponent`
no-ops when the node library is empty, so a new project can open with no Home.
The example carries an explicit `rootNodeId`, and the editor resolves `App`.

## Not verified — and why

1. **The object-typed property row has never been seen on screen.** Both halves
   of the fix are confirmed present in code — the `object` branch in
   `propertyeditor/DataTypes/Ports.ts` (editing as a literal in the same code
   editor `array` uses) and `object` in `nodedefinition.ts`'s
   `typesToSaveInInput`, without which the port type never reaches the instance.
   What is unproven is how the popout **looks** and whether the value
   round-trips through a save. Reaching it needs a node selected, and the canvas
   is Canvas2D — nodes are painted, not DOM, so selection cannot be driven by a
   CSS selector and needs the live `NodeGraphEditor` instance, which is held in
   React state with no static accessor.
2. **Port groups and labels** in the property panel, for the same reason.
3. **The app has not been run.** No preview against
   `project-examples/agent-chat/mock-agent-server.mjs`, so the streaming path has
   not been watched rendering token by token in a browser. The nodes *have* been
   run against a real server headlessly — `test/agent-live-endpoint.test.ts`,
   7/7 opt-in — which covers the transport but not the rendering.
4. **AIX-003's review-UI smoke** (its own separate residual) was not attempted in
   this pass.

## Traps worth recording

- **`loadProject` resolves without navigating.** It returns the loaded project —
  `ok:Agent Chat Example` — while `ProjectModel.instance` still reports the
  previously open project. Loading and navigating are separate steps; clicking the
  launcher card (`div.LauncherProjectCard-module__Card--*`) does both. Two
  attempts were wasted believing a resolved promise meant an open project.
- **A restored project blocks a swap.** With a project already open,
  `openProjectFromFolder` resolves and changes nothing. The editor has to be at
  the launcher first, which means a restart if something was restored.
- `NodeLibrary.instance.library.nodeIndex.coreNodes` is the picker's real source.
  `getNodeTypeWithName` returns falsy here and the objects from `getNodeTypes()`
  carry no `.ports`, so port metadata is not reachable that way.
- The webpack probe from AIX-003's notes still works:
  `window.webpackChunknoodl_editor.push([["k"],{},function(r){req=r;}])` reaches
  any editor module. Eval scope is shared across calls, so use a fresh chunk key
  each time and wrap in an IIFE.
