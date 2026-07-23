# Node Graph Patterns & Anti-Patterns

**Provenance:** mined from the real-project corpus in this repository
(`packages/noodl-editor/tests/testfs`, `packages/noodl-platform-node/tests/testfs` — 17 projects,
including a ~3000-node production e-commerce app), not invented. Counts below are occurrence
counts of the exact wiring in that corpus. Where a pattern is demonstrated by a validated example
fragment, the example id from `docs/node-catalog/examples/` is given — prefer learning from those,
they are checked in CI.

Legacy note: the corpus predates some node renames. `Collection`/`Model`/`Globals` in old graphs
correspond to today's `Collection2` (Array), `Model2` (Object) and `Variable2` (Variable); the
wiring shapes carry over unchanged. Do not author the legacy types in new graphs.

## Structural patterns

### 1. Nested Groups are the only layout mechanism
`Group > Group` (713), `Group > Text` (382), `Group > Image` (151). All layout is composed from
flex containers: a column root Group, row Groups for horizontal arrangement, padding/margins on
the Group — there is no separate layout node. A component's visual tree virtually always starts
with a single root Group.

### 2. The list page: array → Repeater → item component
`Collection.items -> For Each.items` (28), `Filter Collection.items -> For Each.items` (6),
`Static Data.items -> Collection.items` (6). An array source (Query Records, Array, Static Data,
or a Filter between them) feeds the Repeater; the item component receives each record's
properties through identically-named Component Inputs. *Example: `repeater-query-records`.*

### 3. Per-item actions resolve the item id back to an object
`For Each Actions.itemId -> Model.modelId` (27), `Component Inputs.Item Id -> Model.modelId` (8).
When an item is clicked/acted on, the flow carries the item's id, and an Object/Record node with
that id gives access to the full data. Ids travel over wires; objects are looked up where needed.

### 4. Component port surface: Component Inputs/Outputs at both ends
Component Inputs (148) / Component Outputs (93) are among the most-used nodes in real projects:
inner nodes read the component's inputs (`Component Inputs.Title -> Text.text`, 8), and events
bubble out through Component Outputs. Parent-child communication goes through this surface —
events (Send/Receive Event) are reserved for unrelated components.

### 5. Conditional UI is driven through `mounted`
`Expression.result -> Group.mounted` (20), `Component Inputs.Mounted -> Group.mounted` (16),
`Inverter.result -> Group.mounted` (6), `Switch.state -> Group.mounted` (6). Real projects gate
sections of UI by the `mounted` input (removes from layout) far more often than `visible`
(hides but keeps space). Derive the boolean with an Expression/Condition/Inverter and wire it in.

### 6. Interaction state machines: States + blend nodes
`Group.onClick -> States.toggle` (11), `States.<value> -> Group.opacity` (12 combined),
`Color Blend.result -> Text.color` (11), `Color Blend.result -> Group.backgroundColor` (10),
`String Selector.currentValue -> States.currentState` (8). Hover/selected/expanded styling is a
States node with per-state values driving style inputs, optionally through Color Blend for
smooth color transitions. States is the current tool for this (Animation/Transition are
deprecated).

### 7. Display formatting sits between data and Text
`String Format.formatted -> Text.text` (43) — the single most common value wiring in the corpus.
Raw values are not wired straight into user-visible text; a String Format (or a small formatting
component) shapes them first. Reusable formatters become components (`/Components/Price Format`
appears 17×).

### 8. Decoupled signalling via event channels
`Group.onClick -> Event Sender.sendEvent` (13), `Timer.timerFinished -> Event Sender.sendEvent`
(12), Event Sender (73) / Event Receiver (65) overall. Cross-cutting notifications (refresh,
add-to-cart, close-everything) are events on named channels; receivers act locally.
*Example: `send-event-across-components`.*

### 9. Timers for delay/debounce, retriggered by interaction
`Group.onClick -> Timer.restart` (8), `Timer.timerFinished -> Event Sender.sendEvent` (12).
The Timer's restart-on-signal shape is the idiomatic debounce: each trigger restarts the delay,
the action fires only when the user goes quiet.

### 10. Popup lifecycle: close from inside
`Group.onClick -> NavigationClosePopup.close` (8). Popups are shown with NavigationShowPopup by
the opener; the Close Popup node lives *inside* the popup component, wired from its own close
affordances.

## Anti-patterns

### A1. Expression chains
`Expression.result -> Expression.num` occurs 13× in the corpus — expressions feeding expressions
feeding expressions. Two is a smell; a lattice is a program written in the worst possible IDE.
Collapse multi-step computation into one Function node with readable JavaScript.

### A2. Signals wired to level inputs
Wiring a signal (e.g. Condition `ontrue`) to a boolean input like `visible`/`mounted` delivers a
momentary true-then-false pulse, not a lasting state. Use the level outputs (`result`,
`isfalse`) for anything that must stay on. See `compatibility.json` → signalSemantics.

### A3. Globals/legacy state for new work
The corpus leans on `Globals` (36) and per-instance `Boolean`/`String` holders with `savedValue`
reads. In new graphs use named Variables (Variable2/Set Variable) and Objects (Model2) — same
shapes, current nodes, and the id-based stores make data flow explicit.

### A4. Repeater refresh as a data-change handler
The Repeater diffs its `items` array; wiring data-change signals into `refresh` forces full
rebuilds and loses instance state. Only refresh when the template itself must be rebuilt.

### A5. Unpaged queries into repeaters
Query Records keeps results live; binding an unlimited query straight into a large list makes
every remote change re-render unbounded UI. Set limit/pagination on the query, not in the UI.

### A6. One mega-component
The corpus's healthy projects are hundreds of small components ("/UI Components/Design System/…")
composed via instance nodes and Component Children wrappers. If a component's graph needs a
minimap, split it: extract repeated fragments into components with a clear Inputs/Outputs surface.
