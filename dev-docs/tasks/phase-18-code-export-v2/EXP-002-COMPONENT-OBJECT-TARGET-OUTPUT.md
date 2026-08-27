# EXP-002 — Component Object: the target output (session 12)

**Decided on paper before code, like every slice since step 5. Read this before touching
Component Object, `undefined`-expression, or record-aliasing code.**

## §1 What the runtime actually does (componentobject.ts, read first)

`net.noodl.ComponentObject` is a window onto a **per-component-instance record**:
`Model.get('componentState' + componentOwner.getInstanceId())`. Every family node in the same
component instance shares that one record. The `properties` stringlist parameter exists for the
*editor* (it mints the dynamic ports); the runtime honors **any** `value-X` port it is asked to
register, declared or not.

The load-bearing findings, each of which shaped a rule below:

- **There is no imperative write action.** `value-X` is a *continuous* value input: every
  upstream delivery writes `inputValues`, marks the key dirty, and `scheduleStore` flushes at
  end-of-frame. No `Do`, no `Set` trigger. So every statically-visible write is a *mirror* —
  the record key continuously copies its source wire. (The prompt's guess was
  "lifted-state-shaped, like useState"; reading the source first corrected it, again — the
  Switch-is-a-latch lesson.)
- Reads (`value-X` outputs) are `model.get(key)`; the model boots **empty**, so a key no wire
  writes reads `undefined` until a runtime script writes it (`Component.Object` in a Function
  node — EXP-003 territory, deferred nodes today).
- `changed` / `changed-X` fire on any write; `fetch` → `fetched` + `done` republish; all gated
  by `runOnChange-object` (absent = ticked = live). None of this is consumed anywhere in the
  corpus (§2).
- `{ resolve: true }` on get/set only matters when the **key contains a dot** — then it
  path-resolves through nested Models. A dotted property name is therefore not static.
- The family: `net.noodl.SetComponentObjectProperties` writes the same record imperatively;
  `net.noodl.ParentComponentObject` / `net.noodl.SetParentComponentObjectProperties` climb the
  component tree (`componentwalk.ts`, unbounded) and read/write an **ancestor's** record.

## §2 The corpus (co-survey.ts, session 12 scratchpad)

73 raw nodes (the deduped audit's 28), dominated by clones of one Filters app. Every one:
exactly **one CO node per component**, `properties` literal, **no other parameter authored** —
no `fetch` wire, no `runOnChange-object`, and **zero consumption of `changed`/`changed-*`/
`fetched`/`done`** anywhere. Writers: `Component Inputs.Value → value-Date` (9) and
`Model2.prop-Value → value-Date` (8) — nothing else; every other property is written only by
deferred JS. Reads land on `textinput.startValue` (25), `For Each.items` (24), range
value/min/max/step (72), `Component Outputs` value ports (25), `Text.text` (8), Group margins
(16), `checkbox.checked` (8), `Radio Button Group.value` (8). Twins: **one**
`ParentComponentObject` in the whole corpus (Puppy test, `__page__/Home2`); zero Set-variants.

## §3 The translation: the record compiles away

Because every static write is a continuous mirror and no signal output is consumed, the
deterministic slice needs **no state at all** — the session-6 rule again: *the derived row
compiles away*.

- **A property with exactly one mirror wire**: reads of `value-X` resolve to the writer's own
  source expression (`resolveExpr` recursion, cycle-guarded per `${nodeId}:${prop}`). The
  record was a pass-through latch; the emitted code reads the source. Divergence, recorded:
  the runtime write lands end-of-frame, so runtime reads lag one scheduling tick — cosmetic,
  same family as the store write-in-handler divergence.
- **A property no wire writes**: reads resolve to the boot value — a new ValueExpr kind
  `{ kind: 'undefined' }`. It is maybe-undefined by definition and folds at its sinks the way
  the runtime folds it:
  - format placeholder → `''` (the runtime's own substitution rule, session 6),
  - logical operand → falsy (decisive for And, dropped for Or),
  - `truthy` → literal `false`; `not` → literal `true` (the Inverter still defers first — its
    undefined-passthrough gate reads maybe-undefined and bails, unchanged),
  - render children (`Text.text`, button label) → no child (the runtime renders empty),
  - `attr:` sinks (`defaultValue`, `src`…) → the attribute is **omitted** (what an unwired
    port would do; undefined delivered or nothing delivered render identically),
  - `enabled` → bare `disabled` (`!!undefined` is the runtime's own coercion),
  - anywhere else it prints as literal `undefined` (valid TS; cold path, corpus-empty).
  Each undefined-read that lands gets a plan note naming it — the fold is a translation, but
  the report should say the value is a boot value because the writer is a runtime script.
- **A write into a property nothing reads** is dead: the record is unobservable in the emitted
  app (no signal consumers by gate §4). The wire is consumed and noted, the node unaffected —
  elision is the faithful translation. This is the Date Filter's `Model2.prop-Value →
  value-Date` (its only read is `Formatted Date`).

Reads participate exactly where the existing vocabulary already lands: the render pass binds
them only into sinks the emitter honestly renders — `children` params (`Text.text`,
button `label`), `attr:` roles (`startValue`→`defaultValue`, `src`…), `attr-not:disabled` —
and `resolveExpr` serves handler contexts for free. `For Each.items`, group-value, margins and
every styled-only param are **not** in that vocabulary; a read landing there is not consumed
(see §5) — those are the component-state and repeater-state slices' work, not a silent drop.

## §4 The node gates (any hit ⇒ the whole node defers, reason named)

1. **Two CO nodes in one component** — they share one record; cross-node key traffic is not
   worth modelling until a graph does it (corpus: never).
2. `properties` authored but not literal.
3. A `net.noodl.SetComponentObjectProperties` in the same component — an imperative writer of
   the same record (its own slice later; corpus: zero).
4. **Descendant poison**: any component reachable from this one through instance nodes or
   For Each templates (transitively) hosts `ParentComponentObject` or
   `SetParentComponentObjectProperties` — the walk can resolve *this* record from below.
   Shadowing by intermediate CO components is ignored (over-defers at worst; corpus: one such
   node, in a page that hosts no CO).
5. `runOnChange-object` authored `false` — the model subscription is silenced, so outputs
   freeze between Fetch pulses; a live alias would lie. (Absent means ticked — the
   Evaluate-additive family; check `!== false`, never falsy.)
6. `fetch` wired — batch-republish semantics with `fetched`/`done` ordering is signal work.
7. Any signal output consumed (`changed`, `changed-*`, `fetched`, `done`) — signal-on-write is
   the `effect()` slice (component-state vocabulary), not this one.

Per-read gates (fail the read, and via §5 the node): dotted property name (path-resolve);
two writer wires (last-writer-wins races are not static); writer expression is a boolean kind
(the record would hold an operand where the runtime holds it too — but reads are value-shaped
sinks; same rule as every value sink); writer unresolvable (Model2 today); wire cycles.

## §5 The node's disposition — strict-mixed, the Component Outputs precedent

A CO node is **collapsed** (into its component file) only when the gates pass and **every**
`value-*` read wire off it was consumed by a translating path. Any read that did not land —
resolution failed, or the sink is deferred/out-of-vocabulary — defers the **node** with that
read's reason (first in wire order), while reads that did land keep their behaviour: the
mixed-node rule Component Outputs set. The audit under-claims; the reasons become named and
actionable ("feeds a repeater's items — state, the component-state slice") instead of
"logic node (net.noodl.ComponentObject)".

Expected corpus outcome (fix016 shape): Text Search and Date Filter collapse; Date Picker
defers on its Component Outputs value port; Filters root, Checkbox, Multi/Single Choice,
Slider, Range defer on repeater-items / wired-structure / margin sinks — all now with reasons
that point at the next slices.

## §6 Recorded divergences (cosmetic, deliberate)

- Alias reads are live; the runtime's are end-of-frame (scheduleStore/flag-dirty batching).
- The record is invisible to `getInspectInfo` in the emitted app — it does not exist.
- `resolve: true` is not modelled; dotted keys defer instead.

## §7 The upgrade path (do not re-derive)

When EXP-003 translates a JS writer of `Component.Object.set('X', …)`, property X stops being
alias-able and must **materialize as component state** (`useState`, boot `undefined`): aliases
become state reads, mirror wires become sync effects, and `changed-X` consumers become
`effect()` subscribers. That is the component-state vocabulary (COMPONENT-OUTPUTS §6, POPUPS
§7, the controlled-state slice) — this slice's alias is the degenerate no-writer/mirror case
of it, chosen so nothing emitted today has to be unlearned: a senior dev reading "state that
only mirrors a prop" writes the prop; one reading "state a script writes" writes useState.
