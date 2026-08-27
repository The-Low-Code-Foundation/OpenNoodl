# EXP-002 Component Outputs — callback props, written by hand first

> Session 10. The other half of the component interface: Component Inputs became a typed
> optional-props interface in step 4; this slice decides what a **Component Outputs** node
> becomes. The headline decision: **a signal output becomes an optional callback prop**
> (`onWaved?: () => void`), fired from the same handler machinery every other action uses —
> not a `useImperativeHandle` handle, and not a new runtime construct. §1 argues why. Value
> outputs are *recorded* here (§6) but not implemented: the corpus has zero statically
> translatable value feeds, and their faithful shape (lifted state) belongs with the
> component-state slice.

The runtime semantics were read from the source, not assumed (`componentoutputs.ts`,
`componentinstance.ts` in `noodl-runtime/src/`):

- A **Component Outputs** node is pure plumbing: any input written to it calls
  `componentOwner.setOutputFromComponentOutput(name, value)` on the owning instance. It renders
  nothing and holds nothing.
- The **instance** stores the value (`componentOutputValues[name]`), guards on `hasOutput(name)`
  (a write to an undeclared port is silently dropped), and `flagOutputDirty(name)` pushes the
  change to whatever the parent wired. Downstream reads are getter-based, but nothing ever
  pulls spontaneously — every propagation is initiated by this push.
- The runtime's own embedding API is already a callback: creators register
  `creatorCallbacks.onOutputChanged(name, value, previous)` (`componentinstance.ts`). The
  export writes the same contract down as typed props.
- A component may host **several** Component Outputs nodes; the instance treats them as one
  merged port set (`_internal.componentOutputs` is an array; ports come from the component
  model). The export's interface is therefore the union of every outputs node's declared
  ports, by name.
- Signals travel the same `set` path as values — a signal wired into an outputs port fires the
  instance's signal output of that name.

## Corpus (2026-08-27 survey, the 40 audit projects — `outputs-survey.ts`, session 10 scratchpad)

141 Component Outputs nodes; **244 declared signal ports vs 95 value ports**; 220 parent-side
wires from instance outputs.

- **Child-side feeds are almost entirely rendered-element events into signal ports**:
  `button.onClick` (~150 wires), `Text.onClick`, `Group.onClick`, `textinput.onEnter`. The
  remainder are EXP-003 material (`JavaScriptFunction`, `Javascript2`, `ComponentObject`,
  `Switch.state`, `Counter`, model nodes) and the popup slice (`NavigationClosePopup.done`).
- **Every value port in the corpus is fed by an untranslatable source.** Not one value output
  has a statically-known feed today.
- **Parent-side consumption is 100% signal**: ~171 wires into `NavigationShowPopup.show` (the
  popups slice rides these rails next), 22 into `RouterNavigate.navigate` (translatable now),
  17 into `Variable2.fetch`, 1 into `DbCollection2.storageFetch`.
- **No component internally consumes a signal *input*** (zero wires from `Component Inputs` of
  signal kind) — the `() => void` input props stay declared-and-unused, unchanged.
- One structural shape recurs: `For Each.<output> → Component Outputs` — a repeater relaying
  its rows' outputs upward. Which row fired is data this slice cannot carry; it defers with a
  named reason (§4).

---

## 1. Callback props, not a handle

The alternative was a returned handle — `useImperativeHandle` exposing the child's outputs for
the parent to read. It loses on every axis:

- **Direction.** A handle exposes methods for the parent to call *into* the child. Outputs flow
  the other way: the child announces, the parent reacts. A signal output is an event, and
  React's entire event vocabulary — DOM and component alike — is callback props.
- **Fidelity.** The runtime's propagation is push-initiated (`flagOutputDirty`); nothing polls
  `componentOutputValues`. A callback invoked at the moment the internal wire delivers is the
  faithful translation of that push. A handle would invent a pull that the runtime does not
  perform.
- **Precedent in the runtime itself.** `creatorCallbacks.onOutputChanged` is the runtime's own
  way of handing outputs to an embedder — a callback, name-first.
- **Composition.** A handle needs a ref per instance; refs do not compose with `items.map()`
  rows. Callback props close over the row item for free — exactly what the For Each relay
  (§4) will need when a later slice takes it on.

So: each declared **signal** output port becomes an optional callback prop on the child, typed
`() => void`, listed after the input props in the same props interface. The child fires it from
whatever handler owns the feeding signal; the parent passes an arrow built by the same
action-compilation machinery every DOM handler already uses.

## 2. Prop naming

Port names are user content (spaces, punctuation, anything). The prop name derives from the
port name, deterministically, on the **child component's declarations** — so parent and child
agree by construction:

- A port name that is already a valid identifier matching `/^on[A-Z]/` is kept verbatim
  (`onClick` stays `onClick` — no `onOnClick`).
- Otherwise the prop is `on` + PascalCase(port name): `waved` → `onWaved`,
  `Filter Values Changed` → `onFilterValuesChanged`.
- A port whose mangled name is not a valid identifier, or collides with an input prop or
  another output's prop, **defers that port** with a note. A silently renamed or renumbered
  callback is a trap for the reader; the author can rename the port.

## 3. The target, hand-written — the fixture's new `FarewellCard`

The Cheer fixture grows `Components/FarewellCard` (a Group with a Text and a "Wave" button;
`waveButton.onClick → outputs.waved`) and `Pages/Home` places it, wiring
`farewell.waved → RouterNavigate(/Pages/Mood)`.

```tsx
// src/components/FarewellCard.tsx
import styles from './FarewellCard.module.css';

export interface FarewellCardProps {
  onWaved?: () => void;
}

export function FarewellCard({ onWaved }: FarewellCardProps) {
  return (
    <div className={styles.card}>
      <p className={styles.farewellText}>Waving goodbye</p>
      <button className={styles.waveButton} onClick={() => onWaved?.()}>Wave</button>
    </div>
  );
}
```

```tsx
// in src/pages/Home.tsx
<FarewellCard onWaved={() => navigate('/mood')} />
```

Decisions visible in the target:

- **`onClick={() => onWaved?.()}`, never `onClick={onWaved}`.** The uniform arrow composes with
  other actions in the same handler and never leaks the DOM event into a `() => void`
  signature. The optional call (`?.()`) is the `hasOutput`/unwired case: a parent that passes
  nothing gets nothing, exactly like the runtime.
- The child fires the callback **synchronously inside its own handler** where the runtime
  defers propagation to end-of-frame — the same accepted divergence class as every handler
  action since step 5.
- The parent-side arrow is the ordinary compiled action list — several actions, or a `branch`,
  take the same forms they take on a DOM event attribute.

## 4. Child side — what translates, what defers

The Component Outputs node becomes a new action sink with **dynamic trigger ports**: any wire
into it whose `toProperty` is a declared signal port compiles to the action
`{ kind: 'output-signal', prop }`, attached to the handler owner exactly as `navigate` or
`emit` attach — a rendered element's event (including the control roles' `Changed`), an Event
Receiver's `useSignal`, or a Condition arm.

| Shape | Ruling |
| --- | --- |
| Signal port fed by a translatable handler owner | `onX?.()` in that handler |
| Signal port declared, nothing wired in | Prop declared, never called — the honest export of an unfed port |
| Port fed by `For Each` output | Defers, named: a repeater relays its rows' outputs; which row fired is not statically expressible in this slice |
| Signal port fed by an untranslatable source (JS node, popup nodes, …) | Wire unconsumed and reported; the node defers |
| **Value**-kind port (fed or not) | Not declared this slice; a wire into one drops with a note naming §6 |
| Wire into a port no outputs node declares | Dropped with a note (the runtime's `hasOutput` guard drops it too) |
| Port name unmanglable or colliding (§2) | That port defers with a note |

**Node disposition:** `static` (it *is* the interface declaration, like Component Inputs) when
every fed port translated; `deferred` with the first failure's reason when any fed port did
not. Translated ports still attach in the mixed case — the emitted app keeps the behaviour
that does translate (a missing callback is absent behaviour, reported; not a lying structure) —
but the node counts deferred, so the audit under-claims rather than over-claims.

## 5. Parent side — instance outputs as handler owners

A wire from a **rendered instance's** declared signal output into a translatable trigger port
attaches the compiled action to the instance, in `plan.handlers[instanceId][portName]` — the
same table DOM events use. At emit, the instance element gains
`<Sym onX={() => action; action}>` attributes after its value props.

- **The port's kind comes from the target component's declarations**, not from the
  connection: parse's source-kind resolution cannot see across components, so instance-output
  wires all parse as `value` — analysis consults the target `ComponentIR`'s outputs interface
  (`outputPropsOf`, the same helper the child side names props with).
- Expression context is the instance's own `dom` context: `input-text` and `payload` reads
  correctly fail attachment (the callback runs in parent render scope, with no event and no
  payload).
- An instance of a component that exports no file already fails `requireInstance` and is
  reported; its handlers never emit.
- `Variable2.fetch` and `NavigationShowPopup.show` sinks stay untranslated this slice — the
  wires report as today. The popups slice inherits a working instance-handler rail.

## 6. Value outputs — the recorded future shape, not this slice

A value output's faithful translation is **lifted state**: the child pushes on change
(`onCountChanged?.(value)` inside whatever handler produces the change), the parent hosts
`useState` and passes the setter, and parent sinks read the state. That is idiomatic React and
matches the push semantics exactly. It is not built now because:

- The corpus offers **zero** statically-translatable value feeds — every one flows from
  EXP-003 material, so the child-side call site cannot be compiled yet.
- A value output fed by *render-context* data (a store binding, a prop) needs push-on-change
  from render — an `effect()` row — which is the same paper-first design the Switch/`useState`
  and `runOnChange` slices already own. One design, one slice, later.

Signal **input** props (`() => void` from `tsTypeOf`) likewise stay as they are: declared,
typed, and — per the corpus — never consumed inside any component; wiring them into internal
triggers is future work recorded here.

## 7. Verification for this slice

- Goldens: `FarewellCard.tsx` (child props interface + fired callback) and the grown
  `Home.tsx` (instance handler attr) hold the emitter to §3 byte-for-byte.
- Shape tests by IR mutation (boolean-logic.test.ts style): receiver-fired output; two actions
  on one output wire; branch into an output port; value-port wire dropped with note; For Each
  relay defers named; undeclared port dropped; name mangling (`Filter Values Changed`,
  `onClick` kept, collision defers); mixed node counts deferred while its good port still
  fires; parent wire from unrendered instance falls through.
- jsdom drive on the emitted app: click Wave on Home, assert route changes to /mood.
- Coverage audit re-run over the 40 projects; ledger flips `Component Outputs` → `translated`
  in the same commit.
