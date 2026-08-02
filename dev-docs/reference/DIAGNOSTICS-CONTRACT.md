# The Diagnostics Contract

**Status:** Normative. Written 2026-08-02 as scope item 1 of phase 36
[`OBS-003`](../tasks/phase-36-runtime-observability/OBS-003-NODE-DIAGNOSTICS.md), **before** the
second check was authored — because phase 30 and phase 35 both found the same failure and named it
the same way:

> the nodes are not individually bad so much as individually inconsistent, because nobody wrote down
> the rule they all had to satisfy.

**Applies to:** every node-local invariant check in `noodl-runtime` and `noodl-viewer-react`.
**Seventh contract** in the series, after [`REACTIVITY-CONTRACT.md`](./REACTIVITY-CONTRACT.md),
[`EMPTY-VALUE-CONTRACT.md`](./EMPTY-VALUE-CONTRACT.md), [`FAILURE-CONTRACT.md`](./FAILURE-CONTRACT.md),
[`PORT-TYPE-CONTRACT.md`](./PORT-TYPE-CONTRACT.md), [`BINDING-CONTRACT.md`](./BINDING-CONTRACT.md)
and [`OUTCOME-CONTRACT.md`](./OUTCOME-CONTRACT.md).

---

## The problem this contract exists to solve

By the time OBS-003 was picked up there were **three** channels a node could report something on,
all shipped, all in use, and no written rule saying which one a given condition belongs on:

| Channel | Reaches | Shape |
|---|---|---|
| Outcome ports — `Done` / `Unchanged` / `Failure` / `Completed` | the graph | one per invocation |
| `this.raiseRuntimeError(code, message, detail?)` | every runtime, `On App Error`, the console, **and** the editor via a subscriber | an event |
| `context.editorConnection.sendWarning(...)` | the editor only — danger ring + Problems panel | ad hoc |

The consequence is visible in the library today. Warning keys include `'js-parse-waring'`,
`'rest-run-waring-'`, `'add-relation'`, `'layout-warning'`, `'query-collection'` and
`'invalid-object-' + name` — five naming schemes, two of them misspelt, one of them shared by two
unrelated nodes. Some sites clear with `clearWarning`, some with `clearWarnings` (which deletes
*every* key on the node, including other subsystems'), and most never clear at all.

**OBS-003 adds checks in bulk.** Adding them to that is how the Problems panel becomes noise and
gets ignored, which costs more than the checks are worth.

---

## The rule

> **Raise a failure when the node was asked to act and could not. Report a diagnostic when the
> node's current input or configuration is almost certainly not what the author meant — whether or
> not it was asked to do anything.**
>
> **A failure is an event. A diagnostic is a predicate.**

That distinction decides the channel, and it is not a matter of taste:

- A **failure** happened at a moment. It is per-invocation, it is what a deployed app's operator
  needs in the log, and an author may legitimately want to branch on it. It goes on the runtime
  error bus, per [`FAILURE-CONTRACT.md`](./FAILURE-CONTRACT.md).
- A **diagnostic** is true *continuously*, from the moment the condition arises until the author
  changes something. It has no moment. Putting it on the error bus would fire `On App Error`
  repeatedly for a condition that never "happened", and would print a console line per update in a
  deployed app — where nobody can act on it anyway, because **the only person who can fix
  "`Items` is not an array" is the author, in the editor.**

⚠️ **This is the exact inverse of the Failure Contract's argument, and it is deliberate.** That
contract exists because `sendWarning` is editor-only and diagnoses were vanishing when apps shipped.
For a *diagnostic*, editor-only is not a limitation — it is the correct audience. Do not "fix"
diagnostics onto the bus.

### Which channel — the decision table

| The condition | Channel |
|---|---|
| A signal input ran and the work could not be done | `raiseRuntimeError` **+** the `Failure` outcome port |
| A signal input ran and the post-condition already held | the `Unchanged` outcome port. Not a diagnostic |
| An input holds a value this node can never use | **diagnostic** |
| Two of this node's settings contradict each other | **diagnostic** |
| A name typed by the author matches nothing this node has | `raiseRuntimeError` if it was reached by an action (it *is* a failed invocation); **diagnostic** if it is standing configuration |
| An input is `undefined` | **neither.** Absence of opinion — see [`EMPTY-VALUE-CONTRACT.md`](./EMPTY-VALUE-CONTRACT.md) |
| A query returned zero rows | **neither.** A legitimate empty result |

The fifth row is the one that will be argued about. `States` is the worked example and it is a
**failure**: `goToState` is reached by an action, the action could not be performed, and the node
already raises `states/unknown-state`. The near-match suggestion this contract's first batch adds is
a *better message on an existing raise*, not a new diagnostic.

### The hybrid, and it is not a loophole

One node can produce both, and `States` does. The failure is an event — the transition was refused,
`On App Error` saw it, a deployed console logged it, and none of that is retractable. But the
*editor's danger ring* raised by that event is a standing claim about the node's **current** state,
and once the author fixes the name that claim is false.

So a node that raises may also **withdraw the editor's claim** with
`setDiagnostic(sameCode, null)`, without retracting anything on the bus. The rule for where to put
that call is the one every diagnostic follows and is easy to get wrong here:

⚠️ **Evaluate it where the corrected value arrives, not where the corrected value takes effect.**
The first attempt on `States` cleared inside `goToState` after the unknown-state guard, and a live
run found it doing nothing in the commonest case: the correction of `"Clicked"` is `"clicked"` —
the state the node is *already in* — and two separate `state === current` early returns skip it.
The predicate is about the name on the input, not about whether a transition results.

---

## The API

One method. It is deliberately a *setter*, not a `report` plus a `clear`:

```ts
this.setDiagnostic(key: string, message?: string | null): void
```

- A non-empty `message` means **the predicate holds**: raise, or update an already-raised one.
- `null` / `undefined` / `''` means **the predicate does not hold**: clear it.

So one call site expresses the whole predicate, and a stale warning is not something a caller can
forget to clean up — it is structurally impossible:

```ts
this.setDiagnostic(
  'repeater/items-not-a-collection',
  isCollectionLike(value) ? null : `Items expects an array, received ${describeValue(value)}.`
);
```

The ternary builds the message string only in the branch that needs it, so the happy path costs an
`isCollectionLike` and a call that returns on its first line.

⚠️ **Two methods you must remember to pair is the shape that produced the current mess.** Of the
~30 `sendWarning` call sites in the library, fewer than a third have a matching clear, and three of
those clear with `clearWarnings`, taking unrelated keys with them.

For a predicate whose *evaluation* is expensive — not just its message — guard on the same gate the
helper uses:

```ts
if (this.diagnosticsEnabled) {
  this.setDiagnostic(KEY, expensivePredicate() ? null : '…');
}
```

---

## Keys

> **`<node-type>/<condition>`, kebab-case, in the same namespace as failure codes.**

`'repeater/items-not-a-collection'`, `'states/unknown-state'`, `'node/nan-input/<port>'`.

A check that is **per-port** appends the port as a third segment. One node with two NaN inputs then
carries two independently clearable diagnostics rather than one that flickers between them.

One namespace for both is the point, not an accident:

- A node's failure code and its diagnostic key can never collide, because both are minted from the
  same node-type prefix and both must be unique within it.
- Tooling matches them the same way. The MCP `get_warnings` tool, the semantic validator and the
  provenance walk all see one flat `code`-shaped identifier and do not need to know which channel
  produced it.
- Grepping `'repeater/'` finds everything that node can say about itself.

**A key must not carry a value.** `'invalid-object-' + name` interpolates a *port* name, which is
fine — the port set is finite and stable. Interpolating a value (`'unknown-state-' + state`) mints
an unbounded key space, and every one of them stays raised for ever because nothing knows to clear
a key it cannot name. Put the value in the message and the `detail`, never in the key.

Generic checks that live in the base `Node` class use the prefix **`node/`**.

---

## When to clear

> **A diagnostic is re-evaluated wherever its inputs change, and the same statement that raises it
> clears it.**

Concretely: put the `setDiagnostic` call in the `set` of the port the predicate reads. If the
predicate reads two ports, call it from both, or from a small shared method both setters call.

A diagnostic must also survive nothing: it is not cleared on preview reload by the node (the
runtime is rebuilt, so the predicate is simply re-evaluated from scratch), and it is not cleared by
`clearWarnings`, which the node should not call at all.

⚠️ **Never call `editorConnection.clearWarnings(component, node)` from a node.** It deletes every
key on that node — the node's own, the base class's typecast warnings, the expression compiler's.
Several nodes do this today and it is why a fixed problem can take an unrelated ring down with it.
Use `setDiagnostic(key, null)`, or `clearWarning(component, node, key)` if you are outside a node.

---

## Cost

> **The gate is `editorConnection.isRunningLocally()`, and it is checked before anything else.**

⚠️ **`if (this.context.editorConnection)` is not a gate.** A deployed build constructs an
`EditorConnection` anyway ([`noodl-runtime.ts:286-295`](../../packages/noodl-runtime/noodl-runtime.ts)),
so that guard is *true in production*, and every warning behind it is formatted, JSON-serialised and
pushed onto a send queue that will never drain. This was already a measured leak once — see the
comment on `sendTimer` in [`editorconnection.ts`](../../packages/noodl-runtime/src/editorconnection.ts).
Most existing call sites use the wrong guard. `setDiagnostic` uses the right one, which is one more
reason for call sites to go through it.

Beyond the gate:

- **The predicate runs on the hot path.** It must be O(1) in the size of the value where it can be.
  `Array.isArray(v)` is fine; `v.every(...)` over an array of unknown length is not, and belongs
  behind a length cap or nowhere.
- **Evaluate on change, not on update.** An input `set` runs when the value changes. `update()` runs
  every frame the node is dirty. Checks go in setters.
- **Do not build the message unless the predicate holds.** The ternary shape above is the reason the
  API takes a message rather than a condition plus a formatter.

---

## Where checks live

Colocated with the node whose invariant they are — in the node's own definition file, in the setter
of the port concerned. **Not** in a central registry, and **not** in the catalog.

The catalog is the right long-term home for *declaring* invariants ([OBS-003 scope item 3](../tasks/phase-36-runtime-observability/OBS-003-NODE-DIAGNOSTICS.md)),
and that remains a direction rather than a prerequisite. Hand-write until the pattern is visible in
enough call sites to be worth extracting; designing the declaration format first is how the task
stalls.

---

## Where a diagnostic surfaces

Three places, and a check written to this contract reaches all three without any of them changing:

| Surface | How |
|---|---|
| The **danger ring** on the node card | `showwarning` → `WarningsModel` |
| The **Problems panel** | the same model |
| A **provenance walk's** row detail (layer 3 of OBS-002) | `WalkRow.warnings`, filled from `WarningsModel` in the editor and from the pushed warning stream in `nodegx-observe` |

That third one is why the key namespace matters. An agent reading a walk annotated with
node-authored diagnoses is reporting facts; an agent reading a bare graph is guessing.

---

## What is not a diagnostic

- **A style opinion.** "This Group has no children" is not a bug. A diagnostic that fires on a graph
  under construction trains authors to ignore the panel, which costs more than the check saves.
- **Anything that needs the whole project.** A diagnostic is *node-local* — it is answerable from the
  node's own inputs and its own declared state. "Nothing reads variable `cart`" is a **static,
  whole-graph** question and belongs in the semantic validator, not in the runtime. It was in
  OBS-003's proposed batch and is moved out here for that reason.
- **A condition the author cannot act on.** If the only fix is "wait for the network", it is a
  failure or it is nothing.

---

## Two defects in the channel itself, found while writing this

Recorded because both were load-bearing for the cost clause above, and neither was known.

### ⚠️ The warning de-duplicator has never de-duplicated anything

[`editorconnection.activewarnings.ts`](../../packages/noodl-runtime/src/editorconnection.activewarnings.ts)
opens with *"used to optimize warnings so we're not sending unnecessary warnings. Improves editor
performance, especially in larger projects"*, and compares the incoming payload to the stored one
with `===`.

Every caller in the library passes a fresh object literal. `{a:1} === {a:1}` is false, so **every
repeat was sent** — a message per evaluation for `'expression-error-…'`, which is re-raised from
`_evaluateExpressionParameter` on every update of a node with a broken expression. The comparison is
now by content over the payload's own enumerable properties, which is what the file always claimed.

### ⚠️ A failure raised on the error bus can never be cleared

`createEditorWarningSubscriber` forwards `raiseRuntimeError` to `sendWarning` and there is no
corresponding path back. A node that raises once keeps its danger ring and its Problems entry until
the project is reloaded, even after the author has fixed the cause. Nodes that want a clearable
failure pair the raise with an explicit `clearWarning` on the same code — `foreach.tsx`'s
`repeater/template-script-syntax-error` is the one that does this correctly, and it is the pattern.

**This is not fixed here**, because "when is a past failure no longer interesting?" is a question
about the Failure Contract, not this one. It is recorded so the next person does not conclude the
clearing works.

---

## Conformance

The first batch, and what each one proves:

| Key | Node | Pins |
|---|---|---|
| `repeater/items-not-a-collection` | Repeater | the predicate shape, and clearing on the good value |
| `node/nan-input/<port>` | base `Node` | a generic check, per-port keys, and that the hot path stays cheap — measured at **~14 ns per wire delivery**, inside run-to-run noise |
| `states/unknown-state` | States | *not new* — the near-match suggestion is a better message on an existing raise, plus the hybrid withdrawal above |

Every check ships with a corpus row proving **both** halves: that it fires on the bad input, and
that it stays silent on the good one. A check with only the first half is untested — a predicate
that returns true unconditionally passes it.
