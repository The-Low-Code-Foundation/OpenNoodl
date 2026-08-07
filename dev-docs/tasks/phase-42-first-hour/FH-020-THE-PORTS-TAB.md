# FH-020 — The Ports tab: a read-only port explorer in the property panel

**Status:** shipped 2026-08-06 — slices 1-4. Slice 5 (the connection popup's dropped `description`)
is **deferred, not done**; it is independent by the doc's own note and nothing below depends on it.
Two of this doc's own instructions were wrong and are corrected in place — see
[What shipped, and what this doc got wrong](#what-shipped-and-what-this-doc-got-wrong).

Out of [TALK-006](TALK-006-THE-THREE-SIGNALS.md) decision 2 (had 2026-08-05). Covers reported item
**0**'s real remainder — signal-port descriptions render nowhere — and widens past it on Richard's
argument, because the same tab answers a bigger question than "what does Done mean".

## What was asked

> I like the idea of having a way to see ALL inputs and outputs without dragging a connection, with
> annotations of what the port can connect to. For example when you drag and connect node A to node
> B where node B only has string inputs, it filters and limits what you see of the output ports on
> node A. This is right behaviour for the connection popups, but doesn't help the user know the
> potential of Node A if they never drag and connect to a Script node or something that would
> reveal all the possible outputs. […] I actually loved seeing on the State node when I hooked up a
> string node to the state node 'state' input, that it showed in the left props panel that the
> state was defined by another node, and clicking that pill takes you to the connected node, super
> cool. I'm picturing in my head a separate tab in every node props panel where you see all the
> ports (read only) and also if they're connected to anything, same pill system when you click the
> pill to get taken to that connected node. it doubles up as a port explorer, explainer and pathway
> helper.

Three jobs, one surface: **explorer** (what does this node have), **explainer** (what does each
port mean and accept), **pathway helper** (what is it wired to, and take me there).

## Why the property panel and not the two surfaces that look closer

- **The connection popup filters by what you dragged from** — that is `getConnectionStatus`
  ([`NodeGraphModel.ts:491-537`](../../../packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphModel.ts#L491-L537))
  disabling type-incompatible rows, and it is correct behaviour for wiring. It means the popup can
  never show a node's full surface unless you happen to drag at something that accepts everything.
- **The canvas has no port hover to extend.** There is no per-port hit-testing anywhere: the node's
  mouse handler knows the body, the border and the connection-drag corner, and its tooltip is
  node-level (annotation → health → comment)
  ([`NodeGraphEditorNode.ts:220-249`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNode.ts#L220-L249)).
  ERG-004's note calls this a rendering gap; it is a missing model.

## What already exists — this is mostly promotion, not invention

**1. The tab strip is already in this panel, on one path only.**
[`index.tsx:136-160`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/index.tsx#L136-L160)
renders `<Tabs variant={TabsVariant.Sidebar}>` under a `NodeLabel` — but only when the AI assistant
is on. The ordinary path (`:111-118`) is a bare `NodeLabel` + `ScrollArea` + `Frame`. So the shape
Richard is describing is already built, mounted in the right container, and currently reachable by
about one user in a hundred.

**2. The connected-source chip exists — for inputs, on 5 row classes of ~29.**
[`utils.ts:85-127`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/utils.ts#L85-L127):

- `getConnectionSourceLabel(model, portName)` → `"Node label · Port name"`, `+N` appended when
  there is more than one.
- `getConnectionSourceNavigate(model, portName)` → a click handler that calls
  `editor.selectNode(...)` on the node the wire comes from, or `undefined` when it cannot navigate
  (the chip then renders inert — deliberate).

Wired into `BasicType`, `EnumType`, `ListValueType`, `TextAreaType`, `StringListType`. That is
exactly the "a field threaded per class is a field most classes drop" trap that
[`portDescription.ts:22-26`](../../../packages/noodl-editor/src/editor/src/utils/portDescription.ts#L22-L26)
records against `tooltip` (copied by eleven classes, rendered by two). The Ports tab dodges it
completely by rendering its own rows.

**3. The descriptions are already in `NodeLibrary`.** ERG-004 restored ~1656 input and ~1045 output
descriptions; today the only surface is a native `title` attached at the one seam every row passes
through, `Ports.renderParams`
([`Ports.ts:197-223`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/Ports.ts#L197-L223)).

## What does not exist, and the trap inside it

⚠️ **Do not reuse `Ports._getPorts()`.**
[`Ports.ts:567-582`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/Ports.ts#L567-L582)
returns `model.getPorts('input')` filtered to ports that are **not** `allowConnectionsOnly` **and**
have a view class. That is precisely the set with property rows — which excludes every signal, every
connection-only port, and all 100% of outputs. It is the set the tab exists to escape. Read
`model.getPorts('input')` and `model.getPorts('output')` directly and filter nothing.

> ⚠️ **Correction (build).** "Filter nothing" is wrong by one filter.
> `conditionalports/*` is a **filter over statically declared ports**
> ([`dynamicPortRules.ts:32`](../../../packages/noodl-editor/src/editor/src/models/nodelibrary/dynamicPortRules.ts#L32)),
> so a port whose condition is currently false is still sitting in `getPorts()` while not actually
> being on the node. Listing it explains a port that is not there. The tab applies
> `NodeLibrary.instance.applyPortConditionsFilterForNode(model)` — the same call `ModelProxy.getPorts`
> makes, so the two tabs agree about what the node has — and filters nothing else.

Two more absences:

- **No output-side connection lookup.** Both helpers in `utils.ts` filter `c.toId === node.id &&
  c.toProperty === portName`. An output needs the mirror (`fromId` / `fromProperty`) — and an output
  legitimately has **many** targets, where `getConnectionSourceLabel`'s `connections[0]` + `+N` hides
  the useful part. "Where does `Done` go?" is the question the tab is for; `Foo · Do +3` does not
  answer it.
- **No "what can this connect to" annotation.** The raw type is on the port;
  `NodeLibrary.nameForPortType(type)`
  ([`NodeLibrary.ts:48`](../../../packages/noodl-editor/src/editor/src/models/nodelibrary/nodelibrary.ts#L48))
  renders it, and `NodeLibrary.instance.canCastPortTypes(from, to)` (`:311`) is the compatibility
  rule the connection popup already enforces.

## What to build

**Slice 1 — the tab exists.** Promote the `Tabs` wrapper out of `AiPropertyEditor` so both paths
use it: `Properties | Ports` normally, `AI Chat | Properties | Ports` when the assistant is on.
`NodeLabel` stays above the strip on both. Remember the selected tab per panel, not per node — a
tab that resets every time you click a different node is a tab nobody keeps open.

**Slice 2 — the port list.** For the selected node, both directions, unfiltered, grouped the way
the ports declare (`port.group`, with `port.tab.label` appended the way the connection popup does at
[`ConnectionBar.tsx:36`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/ConnectionBar.tsx#L36)).
Per row: display name; the signal ⚡ glyph for signals (same `IconName.Lightning` the popup uses);
type name, with enum values spelled out as `DocsPopup` does; and the description — in the row, not
in a `title`, because reading the descriptions is the whole point of this tab.

**Slice 3 — the connection chips, both directions.** Reuse `getConnectionSourceLabel` /
`getConnectionSourceNavigate` for inputs. Add the output mirror in the same file, returning a
**list** of `{label, navigate}` rather than one label plus a count. A port with no connections says
so quietly — the empty state is information here ("nothing reads this yet"), not an absence to hide.

**Slice 4 — "what it accepts."** Per port, the set of port types `canCastPortTypes` will let
through, rendered as the annotation Richard asked for. Compute it from the type table, not by
probing every other node. If that set is unbounded (`*`), say `Any` and stop.

> ⚠️ **Correction (build).** `canCastPortTypes` alone gives the **wrong answer for every signal**.
> The cast table really does declare `signal -> ['boolean', 'number']`
> ([`nodelibraryexport.ts:224-226`](../../../packages/noodl-runtime/src/nodelibraryexport.ts#L224-L226)),
> and the connection popup then refuses those wires with a second rule of its own that is not in the
> table ([`ConnectionBar.tsx:144-152`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/ConnectionBar.tsx#L144-L152)):
> a **signal output** reaches signal inputs and nothing else. A slice-4 built from the table alone
> would tell an author that `Done` can drive a Number input — which is the exact class of wrong
> answer this tab exists to stop. Both halves live in
> [`portTypes.ts`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/portTypes.ts)
> so the tab and the popup cannot drift. Note the rule is **not** symmetric: it blocks signal
> *sources*, so a Boolean output can still pulse a signal input, and the tab says so.

**Slice 5 (optional, ~10 lines, not asked for).** While the connection popup stays the wiring
surface, its per-port hover renders remote docs HTML and nothing else — because
[`ConnectionBar.tsx:33-42`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/ConnectionBar.tsx#L33-L42)
hand-copies eight fields off each port and drops `description`. Add it to the copy and let
[`PortItem.tsx`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/PortItem.tsx)
prefer the node's own description over the remote page. Independent of slices 1-4; ship it whenever.

## Criteria

1. Selecting any node shows a `Ports` tab listing **every** input and output — signals included,
   `allowConnectionsOnly` ports included, outputs included. Verify against `model.getPorts()` on a
   node whose ports are dynamic (`Function` has ~76; `Component Object` derives its from a
   stringlist), not just a static one.
2. On any of the 82 outcome-contract nodes, the tab shows `Done`, `Completed`, and where present
   `Unchanged` and `Failure`, each with its own description text visible without hovering. This is
   the criterion item 0 was actually asking for.
3. A connected input shows its source chip and clicking it selects that node on the canvas. A
   connected output shows **all** its targets, each individually clickable.
4. The tab is read-only: nothing in it writes a parameter, adds a connection, or marks the project
   dirty.
5. Both themes, screenshot pass (UIX-009 harness), on a node with many ports and one with few.

## Traps

- ⚠️ **HMR will not reach this panel.** The property editor is long-lived and mounted; ERG-004 lost a
  restart to exactly this — HMR reported the modules, said *"Nothing hot updated"*, and a live probe
  read 0 tooltips against a correct change. **Relaunch the stack before measuring.**
- ⚠️ **`Ports._getPorts()` is the wrong source** — see above. It is the most natural-looking function
  in the file to reach for and it returns the one set that cannot answer this.
- ⚠️ **A tab strip changes the panel's height budget.** `Frame` / `ScrollArea` are sized by the
  parent; the AI path already does this correctly, so copy its structure rather than nesting a
  second scroll container.
- `getConnectionSourceNavigate` selects within `NodeGraphContextTmp.nodeGraph` only. That is fine —
  a connection never crosses a component — but it silently no-ops if the graph changed under it;
  keep the `undefined` → inert-chip behaviour rather than rendering a dead click target.
- `IconSize` is inert (UIX-010) — size the ⚡ the way `PortItem.tsx:98` does, with an explicit style.

## What shipped, and what this doc got wrong

Shipped 2026-08-06. Every mechanism this doc cites was re-read at the line it names; the two that
were wrong are corrected inline above (the `conditionalports` filter, and the signal rule slice 4
would have missed). Everything else held: the tab strip really was AI-path-only, the chip really is
on 5 row classes of ~29 and reads inputs only, `Ports._getPorts()` really is the wrong source, and
`getConnectionStatus` really is at `NodeGraphModel.ts:491`.

**Slice 1.** The `Tabs` wrapper is out of `AiPropertyEditor` and into one `PropertyEditorTabs` used
by both paths — `Properties | Ports`, with `AI Chat` in front when the assistant is on, `NodeLabel`
above the strip either way. The selected tab is **module state**, not `useState`: `createPanel`
builds a *new function component* on every node selection
([`sidebarmodel.tsx:76-85`](../../../packages/noodl-editor/src/editor/src/models/sidebar/sidebarmodel.tsx#L76-L85))
and `SidePanel` re-creates the element from it, so the element type changes identity and React
unmounts and remounts the whole panel every time you click a node. A `useState` tab would have reset
on every click — and *not* resetting is what makes the chip-to-chip walk work.

**Slice 2.** Both directions, grouped by `port.group` in declared order with `Other` last, and
`port.tab.label` appended the way the popup does. Per row: the ⚡ for signals (explicit size, UIX-010),
the type name with enum values spelled out (trimmed at 8 — a font-weight enum is longer than the row),
and the description **in the row**.

**Slice 3.** `getPortConnections(model, portName, direction)` in `utils.ts` — a list, both ways, each
entry individually clickable. `getConnectionSourceLabel` / `getConnectionSourceNavigate` are now
one-liners over it, so the five property rows and the tab cannot disagree about what a port is wired
to. Their behaviour is unchanged except that a wire whose far node no longer resolves is skipped
rather than suppressing the whole chip. Empty is stated, not hidden: *Nothing drives this yet* /
*Nothing reads this yet*.

**Slice 4.** `portTypes.ts` — pure, takes the cast table as an argument, and is therefore covered by
the plain-Node runner (`tests-unit/property-editor/portTypes.test.ts`, 12 cases including the two
signal traps).

**Deferred.** Slice 5 (`ConnectionBar.tsx` drops `description` in a field copy) — independent by this
doc's own note, and it belongs with whoever next opens the popup. Not attempted: a filter box for
the `Function` node's ~76 rows; the tab is a long scroll there, which is honest but not comfortable.

**Live QA is unrun.** No dev launch — a launch rewrites the example project and this checkout is
shared. ⚠️ Anyone driving it must **relaunch, not HMR**: the property editor is long-lived and
mounted, and ERG-004 lost a restart to exactly that.
