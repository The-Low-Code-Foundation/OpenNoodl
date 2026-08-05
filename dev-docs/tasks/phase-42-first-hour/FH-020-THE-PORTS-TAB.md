# FH-020 — The Ports tab: a read-only port explorer in the property panel

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
