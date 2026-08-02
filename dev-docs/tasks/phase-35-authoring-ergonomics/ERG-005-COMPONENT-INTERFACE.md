# ERG-005 — Component Inputs / Outputs

| Field | Value |
|---|---|
| **Tier** | 2 |
| **Prerequisites** | none for §1. §2 is a design decision and should not start before §1 lands |
| **Recommended executor** | 🔴 Opus for §1 (a mechanism with no documentation channel is a plumbing problem, not a writing one) |
| **Origin** | Richard, 2026-08-01: *"they're sacred, there are a lot of things to know about them"* |

## Why this is not just a documentation task

`Component Inputs` and `Component Outputs` **define every component's public interface** — they are how
a component tells the rest of the project, and the AI authoring loop, what it accepts and returns.

They are also **the only mechanism in the library that cannot be documented by any means the library
has.** Their ports come from the **Port Editor panel**, which is one of four dynamic-port mechanisms
and one of the three that carry no `description` channel at all (FINDINGS **SR-ii**):

| Mechanism | Documentation channel |
|---|---|
| Declared ports | ✅ `description` — fixed by NDA-005 §0 |
| `sendDynamicPorts` | ❌ carries no `description`; nothing has asked it to |
| `numberedInputs` | ❌ writes no metadata entry at all (`nodedefinition.ts:100-131`) |
| **Port Editor panel** | ❌ **worst of the four** — and it is this task's |

So NDA-005 reports these nodes as `n/a` on coverage, and the audit's 90.4% library-wide figure
measures one mechanism of four. **An author cannot be told the rules, the validator cannot enforce
them, and the AI loop cannot know them.** That is the defect; the prose is the easy part.

## §0 — The rule nobody has written down

Richard, from memory, and it needs verifying against source before it is documented as truth:

> when you declare inputs and outputs, they only become a 'type' instead of Any when you connect them
> inside the component to something with a clear type. So if you define on the Component Input
> 'orderNumber' and connect it to a number node, or a Function or Script number input, or a state
> Number input, then when you place that component it'll expect a number.

**§0 is blocking and it is measurement, not writing.** Establish, live:

1. Is the inferred type taken from the first connection, the most recent, or something else?
2. What happens when an input is connected to two things of **different** types inside the component?
3. What happens when the connection that supplied the type is **deleted** — does the outer contract
   revert to `Any`, and do existing outer connections survive?
4. Does the same rule govern `Component Outputs`, or only inputs?
5. Does the inferred type reach the **catalog** — i.e. can the validator and the AI loop see it, or is
   it editor-only?

⚠️ **Do not answer these from source alone.** Both `Page`'s dead `Title`/`Url Path` ports and
`Page Inputs`' total absence of connectable ports lived inside `setup()`, **which `graph-harness` does
not call** — three findings this phase. Drive the editor.

⚠️ **And treat the recollection as a hypothesis.** Phase 30 found four stale spec premises in a single
batch, and its standing rule is that an inherited claim is a hypothesis whoever inherits it must test.
That applies to a remembered rule too, including this one. If §0 contradicts §0's own quote, the
measurement wins and this file gets corrected.

## §0 — ANSWERED, 2026-08-02, against the running editor

**Richard's recollection is correct as far as it goes, and it stops one step short of the
interesting part.** One connection does give the port that connection's type. But nothing about the
rule is *ordinal*, and with more than one connection the answer can be a type **neither** connection
has.

Measured live in `erg005-qa` (`dev-docs/qa-fixtures/generate-erg005.py`), by wiring and unwiring
inside `/Probe` over CDP against `ProjectModel.instance` and reading `ComponentModel.getPorts()` —
the same call the property editor, the node-instance ports and the connection health pass are all
built from — plus the instance's own ports in `/App` as an independent second reading.

The mechanism, for reference while reading the answers: `componentmodel.ts:91-205` recomputes the
whole port set **from scratch on every call**. There is no stored type anywhere.

### 1. First connection, most recent, or something else? → **None of the three. It is derived, statelessly, from all connections at once.**

| Wiring | Result |
|---|---|
| `pStr` → `String.value` | `string` |
| `pNum` → `Number.value` | `number` |
| `pNone` → `Boolean.value` | `boolean` |
| `pAB` → `String.value`, **then** `Number.value` | `string` |
| `pBA` → `Number.value`, **then** `String.value` | `string` |

The last two rows are the measurement. **Same answer from opposite wiring orders**, so the rule
cannot be "first" and cannot be "most recent". `getPorts()` collects every connection on the port
and calls `_deriveType`: one connection returns that connection's type verbatim; more than one goes
to `NodeLibrary.findCompatiblePortType`.

⚠️ **A consequence worth stating on its own:** because it is recomputed rather than stored, the
outer contract has **no memory**. There is no "the type this port was given"; there is only "the
type this port's current wiring implies".

### 2. Two connections of different types? → **The first row of the 16-entry typecast table that can cast to all of them — which is frequently a third type neither side is.**

| Wiring | Derived type | |
|---|---|---|
| `string` + `string` | `string` | modifiers merged (enums unioned, `multiline`/`allowEditOnly`/`allowConnectionsOnly` OR-ed) |
| `string` + `number` | `string` | |
| `number` + `boolean` | 🔴 **`string`** | **neither connection is a string** |
| `signal` + `number` | 🔴 **`boolean`** | **neither connection is a boolean** |
| `*` + `string` | `string` | one explicit type wins outright — a dedicated branch |
| `number` + `font` | `*` | no candidate casts to both, so it gives up |

`findCompatiblePortType` (`nodelibrary.ts:383-444`) walks `library.typecasts` **in table order** and
returns the first `from` whose casts cover every connection. `string` is row 1 and casts to nine
types, so it wins nearly every mixed pair. `boolean` is row 2 and is the only thing that casts to
`signal`, which is why `signal + number` lands there.

So the type an author sees on the outside of a component is chosen by **the row order of a table in
the node library**, and it can be a type that appears nowhere in the component. This is the single
most surprising thing in §0 and it is the strongest argument for §2's explicit-type option.

### 3. Deleting the connection that supplied the type? → **The contract reverts immediately, and existing outer connections survive — including ones that are now illegal.**

- Delete the only connection: the port goes back to `*` on the very next read, model **and**
  instance. Nothing is remembered.
- Delete one of two: the type re-derives from what is left (`string`+`number` → delete the string →
  `number`).
- **Outer connections are not touched.** An instance wired while the port was `string` still carries
  that connection after the port becomes `*` or `number`. Nothing rewires, nothing warns at
  deletion time.
- The editor **does** catch the fallout, on its next scheduled health pass
  (`NodeGraphModel.evaluateConnectionHealth`). Driven deliberately: a `string` component output
  wired into a `font` input produced *"Target port of type **font** cannot be connected to a source
  port of type **string**"*, and a connection to a port that does not exist on the instance produced
  *"Target port doesn't exist."* — both `level: 'error'`.

⚠️ So an author can break every caller of a component by deleting one connection **inside** it, and
find out via a health warning on the callers rather than anything at the site of the edit.

### 4. Do outputs follow the same rule? → **Yes, symmetrically — same function, same table, same statelessness. With one asymmetry that is not about types.**

`Component Outputs` derives from the **source** port feeding it, exactly mirroring inputs deriving
from the **target** port they feed. Measured: single string source → `string`; single number source
→ `number`; string-source-then-number-source and number-source-then-string-source both → `string`;
deleting both → `*`.

⚠️ **The asymmetry is the default value.** `_deriveDef` only ever populates from the `direction:'to'`
side, which only the input map records. So a **Component Input** silently inherits the *default
value* of the internal input port it feeds (`pStr` → `String.value` arrived carrying `default: ""`),
and a **Component Output** never inherits one. Both inherit `group`. This is undocumented and is a
second hidden channel from an internal implementation detail to the public interface.

### 5. Does the inferred type reach the catalog? → **No. It exists only in the running editor, and three of the four things that ought to see it do not.**

| Reader | Sees the inferred type? | Measured how |
|---|---|---|
| The editor (property panel, instance ports, connection health) | ✅ yes | `getPorts()` and the instance's ports agree; the health pass raised 2 errors on a deliberately bad graph |
| `project.json` | ❌ **never written** | `ProjectModel.toJSON()` emits `name`/`id`/`graph`/`metadata` for a component — **no `ports` key at all.** The only type on disk is the Port Editor's own declaration, which is `{"name": "*"}` for every port it has ever created |
| The semantic validator (`npm run validate:project`) | ❌ no | The same graph the editor gives **2 errors** for validates **0 errors, 0 warnings**. It is blind twice over: the types are not on disk, *and* `typeIncompatibleConnection.ts:37` and `nonexistentPort.ts:65` both `continue` on any component ref by design |
| The AI authoring loop | ❌ names only | Ran its own `componentPorts()` (`AiAssistant/explain/graph.ts:69`) over the live project: it returns `inputPorts: ['pAB','pBA',…]` — a sorted list of **strings**. There is no type field in the structure it builds |

⚠️ **This is the finding that sizes §1.** ERG-005 was scoped as "the Port Editor carries no
`description`". It is worse than that: the Port Editor's ports carry **no type either**, anywhere
outside the running editor's memory. A component's public interface — the thing the validator should
check and the authoring loop should be told — is reconstructible only by re-running the editor's
derivation. §1 should carry the derived *type* out alongside the description, or the description will
document an interface the reader still cannot type-check.

### Corrections to this file's own §0 prose

- *"they only become a 'type' instead of Any when you connect them inside the component to something
  with a clear type"* — **true for one connection, incomplete for more than one.** Two connections
  can produce a type that is not on either of them, and one `*` connection alongside one typed
  connection does not dilute the result.
- The five questions assumed the rule might be ordinal ("first connection or most recent"). **It is
  not ordinal at all**, and any §1 prose that describes it as such would be wrong.

### ⚠️ Traps this measurement cost, for whoever drives it next

1. **The instance's port list lags the model by exactly one tick.** Reading
   `ComponentModel.getPorts()` and the `/Probe` instance's `getPorts()` in the *same* eval showed
   `string` and `*`. Read again on any later tick and they agree. It is a cache invalidation that
   settles before the next frame, **not** something an author sees — but a probe that batches a
   mutation and a reading into one expression will report a phantom discrepancy.
2. **Direct model mutation does not schedule a health pass.** `graph.addConnection(...)` over CDP
   left `WarningsModel` at 0 warnings, which reads exactly like "the editor does not check this".
   It does — `scheduleEvaluateHealth` is on a 2s timer driven by editor events my probe bypassed.
   Call `graph.evaluateHealth()` explicitly before concluding anything about warnings.
3. **A `Component Inputs` port authored by hand needs `plug: 'output'`** (and `Component Outputs`
   needs `plug: 'input'`) — the plug is the direction *inside* the component, which is the opposite
   of what the port becomes on the instance. `componentports.tsx:286-293` is the shape to copy:
   `{name, plug, type: {name:'*'}, group, index}`.
4. **Another session ran `npm run dev:stop` and killed this stack mid-probe.** `dev:stop` claims to
   touch only this checkout, but it matches on the Electron binary path, so it reaps a *worktree's*
   test run — and a worktree's `dev:stop` reaps yours. Re-check CDP is alive before trusting a
   silent result.

### ✅ Richard's named case — a `Function` node's dynamic port — measured

The one row §0 was still owed. Driven 2026-08-02 in the same fixture, against a `JavaScriptFunction`
carrying `scriptInputs: [{id:'q1', label:'qty'}]` with `intype-qty: 'number'` and
`scriptOutputs: [{id:'o1', label:'tag'}]` with `outtype-tag: 'boolean'` — **neither of which is the
declared default (`string`)**, so a reading of `string` could not be mistaken for a correct answer.

| Wiring | Derived |
|---|---|
| `pClash` → `Fn.in-qty` (dynamic, `number`) | **`number`** |
| `Fn.out-tag` (dynamic, `boolean`) → `oNone` | **`boolean`** |
| `pClash` → `Fn.in-qty` (dynamic `number`) **+** `Boolean.value` (declared `boolean`) | **`string`** |
| delete the dynamic connection, then the declared one | `boolean`, then `*` |

**Provenance is irrelevant.** A dynamic port supplies a type exactly as a declared one does, mixes
with a declared port through the same table (row 3 is the `number`+`boolean` → `string` case again,
now with one side dynamic), and reverts identically. `getPorts()` concatenates
`type.ports + node.ports + node.dynamicports` and the derivation never asks where a port came from.
So Richard's *"a Function or Script number input"* is confirmed, and it is not a special case.

⚠️ **Two traps this row cost, both worth having.**

- **The value port is `in-qty`, not `qty`.** `JavaScriptFunction` is `simplejavascript.ts`, which
  declares `inputPrefix: 'in-'` (`:569`, `:676`). The unprefixed `name: p.label` at
  `noodl-viewer-react/src/nodes/std-library/javascript.ts:799-823` belongs to the **`Script`**
  (`Javascript2`) node, which is a different node. Reading the wrong one of the two produced a port
  name that does not exist — the live port list is the authority.
- **A hand-authored Function's dynamic ports appeared without the preview being started by hand.**
  The fixture ships `"dynamicports": []` and the node had five by the time it was read. Do not take
  that as "the viewer is not needed" — `sendDynamicPorts` still only runs under
  `isRunningLocally()`, and the fixture sets `/App` as home precisely so a viewer can mount.
  **Read the port list before wiring, every time**; a missing dynamic port is a missing viewer, and
  the failure looks identical to a defect.

## §1 — Give the mechanism a documentation channel

The build. Whatever §0 measures is unwritable until this exists. **§0 is now answered and it widens
this section:** the Port Editor's ports carry no `description` *and* their derived type never leaves
the running editor (§0 question 5). Carrying prose out while leaving the type behind would document
an interface the validator and the authoring loop still cannot check.

- The Port Editor's port definitions gain a `description`, carried through to the catalog the same way
  NDA-005 §0 carried declared ports' descriptions (which had been declared on both port types and
  **copied nowhere** — the field authors were told to write was inert).
- ⚠️ **And the derived type travels with it.** `ProjectModel.toJSON()` writes no `ports` key on a
  component at all; the derivation lives only in `ComponentModel.getPorts()`. Serialising the derived
  contract is what lets `validate:project` stop skipping component refs and lets the authoring loop
  see more than a list of names.
- The two nodes themselves get real prose: what they are for, and §0's typing rule stated plainly.
- The rule reaches the **AI authoring loop's context**, because "add a component input" is a thing the
  loop does and it currently cannot know what happens next.
- ⚠️ **`description` is canonical** (Richard, 2026-08-01). Enrichment `ports` may only add what the
  source cannot know; `tooltip` is display-only and derived. Do not put this prose in enrichment
  because the channel is easier.

Consider whether the same fix serves `numberedInputs` — two nodes (`String Mapper`, `Index To String`)
are undocumentable through it, and if one change covers both mechanisms it should.

## §2 — The typing decision (do not start before §1)

Should a Component Input carry an **explicit** type instead of inferring one?

**Recommendation: add the explicit option, keep inference as the default, do not make it breaking.**

**For inference.** It is genuinely good ergonomics and it is part of why components feel light to
build. Nobody wants to declare a type for a value that is obviously a number.

**Against, and it is a real failure mode.** The type of a component's **public** interface is decided
by an implementation detail **inside** it. An innocent internal rewiring silently changes the contract
every caller depends on, with nothing on the outside saying why — and phase 30 has a name for this
shape: it is the same class as `Slider`'s private border generator drifting four ways from the shared
one, and as a reader and a writer of the same state resolving to different components (FINDINGS
**F-i′**). Hidden coupling between an internal choice and an external contract.

⚠️ **§0 measured this failure mode rather than predicting it, and it is worse than "the type
changes".**

- The type can be one **no connection in the component has**: a Component Input feeding a `Number`
  input and a `Boolean` input is `string` on the outside, because `string` is row 1 of the typecast
  table and casts to both. `signal` + `number` gives `boolean`. Inference here does not pick a type
  an author wired; it picks a type the *table* offers.
- Deleting one connection inside reverts the contract to `*` with no memory of what it was, leaves
  every caller's connection in place, and surfaces as an error on the **callers** rather than at the
  edit.
- The derived type is not written to disk, so no reviewer reading a diff can see the contract change
  at all — the diff shows one connection removed inside a component.

The strongest version of the argument for the explicit option is therefore not "types should be
declared" but **"the current default lets a one-connection edit silently retype a public interface,
and leaves no trace in the project file."** An optional "pin this to Number" costs nothing when
unused and gives an author a way to say *this is the contract* rather than *this is what I happened
to wire*.

An optional "pin this to Number" costs nothing when unused and gives an author a way to say *this is
the contract* rather than *this is what I happened to wire*.

⚠️ **§2 is a discussion after §1, not before.** Right now nobody — including the person who would make
the decision — can read the current rule anywhere. Changing an undocumented rule means the change
cannot be described either.

## Success criteria

1. §0's five questions are answered by driving the running editor, and the answers are in this file.
   Where they contradict the remembered rule, the measurement is recorded as the correction.
   **Met, 2026-08-02.** All five answered live, including Richard's named `Function`-node case —
   nothing is owed. The fixture is `dev-docs/qa-fixtures/generate-erg005.py`.
2. The Port Editor mechanism carries a `description` through to the catalog.
3. `Component Inputs` and `Component Outputs` have real prose, including the typing rule, reachable by
   an author in the editor and by the AI loop in its context.
4. NDA-005's coverage instrument reports these two nodes honestly — a real figure, or `n/a` with the
   reason, not 100% on `0/0`.
5. §2 is written up as a decision for Richard with §0's measurements attached. **No typing behaviour
   changes in this task.**
