# EXP-002 — Controlled state: the target output (session 15)

**Decided on paper before code, like every slice since step 5. Read this before touching
Switch/Counter translation, control value/checked wiring, `mounted`/`visible` sinks, lifted
value outputs, or any `useState`/`useEffect` emission.** This is the slice the last four
sessions' named defers point at: it is triply motivated (EXP-003 Tier B's vocabulary, the
run-wired→render shape of JS-TARGET §3.7, the Component Object §7 upgrade), and it is the
first slice that materializes *state* in the emitted component rather than compiling it away.

Sources read first: `packages/noodl-runtime/src/nodes/std-library/switch.ts`, `counter.ts`;
`packages/noodl-viewer-react/src/nodes/controls/checkbox.ts`, `slider.ts`,
`radiobuttongroup.ts`, `options.ts`, `text-input.ts` (including the in-flight FB-026 edits —
value ports typed per field Type; display renames only, port ids frozen), `utils.ts`
(`addControlEventsAndStates` — `enabled`); `node-shared-port-definitions.ts` (`visible`);
`react-component-node.ts` (`mounted`); `foreach.tsx` (`items` arrivals). Corpus:
`cs-survey.ts`, session 15 scratchpad (`21dc830c-…`), output `cs-survey-out.txt` — 40 audit
projects, clone-deduped.

## §1 What the runtime actually does (from the sources)

### The stateful logic nodes

- **Switch** (switch.ts) is a latch, not a ternary (the session-7 finding, now designed for):
  `_internal.state` boots `false`; `on`/`off`/`flip` are signal inputs sharing
  `setStateByAction` — no-op with `unchanged` when already there, else write + `switched` +
  `switchedToOn|Off` + `done`, value flagged **before** the pulses. `flip` always changes.
  ⚠️ **The `onFromStart` ("State") input's setter emits the switched signals on every set** —
  its own description admits it "announces a switch even though nothing switched". A *wired*
  `onFromStart` is therefore a signal-fabricating arrival; a literal one is just the boot
  value (the setter runs before anything listens on the load path we emit for).
- **Counter** (counter.ts) is the number of the same family: `currentValue` boots 0 (or
  literal `startValue`), `increase`/`decrease`/`reset` mutate it, `countChanged` pulses on
  every actual change, `currentCount` reads it. Optional min/max limits gate the mutations
  when `enableLimits` is on.

### The controls — one dual-path shape, five times

Checkbox, Slider, Radio Button Group, Dropdown and Text Input all keep **their own internal
state** with two write paths that the export must not conflate:

- **The graph path** (the `checked`/`value`/`startValue` input): writes the internal state,
  flags the value output, and **deliberately does not fire `Changed`** — every description
  says so ("setting it from the graph does not fire Changed").
- **The user path** (DOM interaction): writes the same state, flags the output, **and fires
  `Changed`**. `Changed` means "the user did it".
- Checkbox additionally has `check`/`uncheck` **actions** (outcome `done`/`unchanged`, never
  `Changed`) — the Switch shape grafted onto a control.

Arrival coercion differs per control and is part of the contract (the NDA-012 G1 family):

| control | input arrival rule (from `set`) |
|---|---|
| Checkbox `checked` | `!!value`, applied always (no abstain) |
| Slider `value` | abstain on `undefined`/`null`/`''`; non-finite raises + abstains; else clamp to \[min, max] |
| RBG `value` | `toString()` when possible; abstain when still not a string (`null` abstains) |
| Dropdown `value` | `toString()` when non-string; **`undefined` applies** (deselects) |
| Text Input `startValue` | `undefined` abstains; `null` → the field type's empty value (FB-026: `''` text, `null` number); applies as it arrives **only while ticked under Run On Value Change** — unticked it waits for `set` |

`enabled` (utils.ts) is already a translated sink (`disabled` inversion, LOGIC §7).

### The two visibility ports (every visual node)

- **`visible`** (node-shared-port-definitions.ts): `set` is a truthiness gate —
  falsy ⇒ `visibility: hidden`, truthy ⇒ remove the style. **The element keeps its layout
  space.**
- **`mounted`** (react-component-node.ts): truthiness-coerced; false **removes the element
  from the tree entirely** (the parent re-renders without it).

Both are truthiness devices, so both take the LOGIC §6 boolean vocabulary (`logical`, `not`,
`truthy`) and both fold a maybe-undefined source to hidden/unmounted — exactly what the
runtime's `if (value)` / `value ? true : false` does with an undefined delivery.

### For Each `items`

Accepts a collection or plain array; `null`/`undefined` are ordinary arrivals meaning
**clear the list** (foreach.tsx documents this on the input). So an items feed that folds to
undefined renders zero rows, faithfully.

## §2 The corpus (cs-survey.ts, session 15 scratchpad — clone-deduped)

- **`visible`/`mounted` sinks are the biggest demand by far** (~60 wires): overwhelmingly
  `Component Inputs.<x> → Text/Group.visible` (the ProductCard/DealOfTheMonth clones —
  truthiness of a prop), then `Condition.isfalse`, `Expression.isTrue`, `Inverter.result`,
  `Switch.state`, `Component Inputs → Text.mounted`. These subtrees defer *wholesale* today
  because the sink port is outside the emit vocabulary.
- **Wired control state** flows almost entirely from `net.noodl.ComponentObject.value-*`
  (the Filters family — Tier B territory: the writers are JS) and `Model2.prop-*` (the Model2
  slice). One fixture case: Cheer GreetingCard `startValue ← ComponentObject.value-Draft`.
- **Control outputs consumed**: the Filters family wires `checked`/`value`/`onTextChanged`
  into `JavaScriptFunction.in-*` + `Changed → run` (Tier B); the tutorial/puppy projects wire
  `onTextChanged` into backend chains (already-translated `input-text` context or stub
  territory). Two immediately-render-shaped finds: **`range.value → Text.text`** (the slider's
  position displayed live) and `onTextChanged → placeholder` of another input.
- **Switch** (small, fully translatable): `Group.hoverStart/hoverEnd → on/off` with
  `state → Component Outputs.hovered` (Footer ×3); button-driven `on/off` with
  `state → Group.visible` + `state → Inverter → visible` (phase58 StockCupboard);
  `flip` with `state → Text.mounted` (Tutorial). **No project consumes `switched*`, `done`,
  `unchanged`, or wires `onFromStart`.**
- **Component Outputs value ports** (the s10 wall): fed by `For Each` row relays (needs row
  identity — stays deferred), `ComponentObject.value-*` (Tier B), `Switch.state` (this
  slice), `Counter.currentCount` (bench probes), `JavaScriptFunction.out-discountedPrice`
  (a pure re-hosted node — this slice's push effect completes it).
- **For Each items from state**: `ComponentObject.value-Items/Checkboxes/FilterItems` (Tier
  B), and **`Component Inputs.links → items`** (FooterLinkColumn ×3 — a plain prop-fed list,
  translatable now).
- **Run-wired JS with value outputs** feeding render sinks: effectively zero direct demand
  (the two hits feed handler chains); the shape is designed anyway because Tier B's rewrites
  produce it.

## §3 The design: five state rows, one vocabulary

The slice adds **five constructs** to the plan/emit vocabulary. Everything in §4 is a
composition of these; EXP-003 Tier B and CO §7 consume the same five.

1. **A state var** — `const [x, setX] = useState<T>(boot)` in the component. Planned as
   `StateVarPlan { name, tsType, boot, originNodeId, origin }`; names sanitize from the node
   label (the jsfun rule), deduped per component against the existing identifier space
   (props, hooks, wrappers — one space, the stores rule).
2. **A state read** — `ValueExpr { kind: 'state-get', name, maybeUndefined? }`, legal in
   render binds and handler chains. In a handler it reads the render closure's value —
   see the chain-local snapshot rule below.
3. **A state write** — `HandlerAction { kind: 'state-set', name, expr | op }` where `op` is
   `'toggle' | 'inc' | 'dec'` (functional updates: `setX(v => !v)` — immune to closure
   staleness, which is why Switch's `flip` and Counter's arithmetic use `op`, never `expr`).
4. **A sync effect** — `useEffect(() => { <coerce+guard per §1's table>; setX(…); }, [src])`:
   the graph path of a wired control-state input. It runs the *input setter's* semantics —
   coercion, abstain guards, clamping — and **never** the `Changed` chain (the runtime's own
   asymmetry).
5. **A push effect** — `useEffect(() => { onXChanged?.(expr); }, [deps])`: the lifted value
   output (CO §6's recorded shape, now built). Fires on change *and once at mount — which is
   the boot delivery a parent wire gets from the interpreter*, so the mount fire is the
   faithful part, not an artifact.

**The chain-local snapshot rule.** The runtime updates state synchronously mid-chain: a
handler that pulses `Switch.on` and later reads `state` sees the new value. React's setter
doesn't update the closure. So inside one compiled handler chain, after a
`state-set { name, expr }`, subsequent reads of `name` in that chain resolve to the written
expression (hoisted as a `const` when non-trivial: `const next = …; setX(next); … use next`).
A chain that writes with an `op` (functional update) and *then* reads the same var defers the
reading node — the value isn't statically expressible mid-chain. (Corpus: no chain does
either; the rule exists so the compiler never silently emits the stale read.)

**Grades.** State vars are grade-Q equivalent by construction: every quiescent point has the
same published value on both sides. Per-invocation ordering inside a chain is grade I and is
preserved by statement order plus the snapshot rule. The one recorded divergence is timing:
the runtime writes state synchronously mid-frame, React batches to the next render — invisible
at quiescence, and nothing in the vocabulary lets a graph observe the difference (`switched*`
consumers, the one thing that could, defer).

## §4 The shapes, hand-written first

### 4a — Switch (and Counter, the same shape in number)

```tsx
export function Footer(props: { onHoveredChanged?: (value: boolean) => void }) {
  const { onHoveredChanged } = props;
  // From the Switch node "Hovered" — a latch: on/off/flip write it, `state` reads it.
  const [hovered, setHovered] = useState<boolean>(false);
  useEffect(() => {
    onHoveredChanged?.(hovered);
  }, [hovered, onHoveredChanged]);
  return (
    <div className={styles.footer} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      …
    </div>
  );
}
```

- `on` → `setX(true)`, `off` → `setX(false)`, `flip` → `setX(v => !v)` as handler actions in
  the triggering owner's chain; `state` reads are `state-get`. Boot value: literal
  `onFromStart` parameter, else `false`.
- Counter: `useState<number>(boot)`; `increase`/`decrease` → `op: 'inc' | 'dec'`
  (`setN(v => v + 1)`), `reset` → `state-set` to the literal start value; `currentCount`
  reads it. **Corpus demand is bench-probe-only** — the vocabulary carries it, but the build
  session flips Counter's ledger entry only if its instances actually translate; Switch is
  the proven one.
- **Gates (defer, named):** consumed `switched`/`switchedToOn`/`switchedToOff`/`done`/
  `unchanged` (expressible later as change-conditional statements, zero demand today); wired
  `onFromStart` (its setter fabricates switched pulses — §1); Counter with `enableLimits`
  (clamped mutation, zero demand); Counter's consumed `countChanged` likewise.

### 4b — `visible` and `mounted` sinks (truthiness, the `enabled` siblings)

```tsx
{/* mounted ← Switch "Show Details" — false removes the element, the runtime's own rule */}
{showDetails && <p className={styles.detailText}>…</p>}

{/* visible ← Component Inputs "compareAtPrice" — hidden but keeping its layout space */}
<p className={joinClasses(styles.comparePrice, !compareAtPrice && styles.hiddenKeepSpace)}>…</p>
```

with one shared utility rule emitted once per module that needs it:
`.hiddenKeepSpace { visibility: hidden; }`.

- Both are **truthiness sinks** — they join `enabled` in the LOGIC §6 admission list, so
  `logical`/`not`/`truthy` expressions and every maybe-undefined source fold exactly as the
  runtime's `if (value)` does (undefined ⇒ hidden/unmounted).
- A **literal** `visible: false` / `mounted: false` parameter folds statically (the class
  bare / the element omitted with a note — an authored-invisible element is not dead code,
  it is authored state; keep the note).
- **Gate:** a `mounted` wire into a component's *root* node defers the component (a page
  that unmounts its own root is a router concern, not an element concern; zero demand).
- `visible` on the row of a repeater template, fed by row data, works unchanged — the
  binding vocabulary already resolves row fields.

### 4c — Wired control state (the controlled input)

The faithful React shape for the dual-path contract is **local state + sync effect**, not a
bare controlled `value=` — because the runtime control keeps accepting user edits even when
the graph feed goes quiet, and a graph write must not fire the `Changed` chain:

```tsx
// Text Input "Draft" — its Value input is wired, so the field is local state synced from
// the source; the user path (onChange) also runs the wired Changed chain.
const [draft, setDraft] = useState<string>('');
useEffect(() => {
  if (draftSource === undefined) return;          // the input setter abstains (§1's table)
  setDraft(draftSource === null ? '' : String(draftSource));
}, [draftSource]);
…
<input
  className={styles.draftInput}
  value={draft}
  onChange={(e) => {
    setDraft(e.target.value);
    …the wired Changed/onTextChanged chain, statement order…
  }}
/>
```

- The **sync effect body is the §1 coercion table per control** — checkbox `!!v` (no guard),
  slider abstain + clamp to literal min/max, RBG/dropdown string rules, text input's
  undefined-abstain. A slider whose min/max are *wired* defers (the clamp bounds aren't
  static).
- The control's **value/checked output** anywhere in the component reads the local state
  (`state-get`); inside the control's own `onChange`, it reads `e.target.value` /
  `e.target.checked` (the existing `input-text` context rule, generalized per control role).
  This lands the survey's `range.value → Text.text` live-display shape.
- An **unwired** control keeps today's translation (uncontrolled, `defaultChecked`/static) —
  no state row is minted for a control nobody feeds. A control whose state input is wired
  from a source outside the vocabulary defers the *wire* with the feeder named, keeps local
  state for its consumed outputs (strict-mixed, the s10/s12 precedent).
- Text Input's `startValue` honours Run On Value Change: **unticked** (`!== false` family:
  explicitly false) means arrivals wait for a `set` pulse — the sync effect would be a lie ⇒
  the wire defers named (the `set`-pulse action shape is A2h territory, later). Ticked
  (absent) is the effect above. `set`/`clear` actions consumed: `clear` →
  `state-set` to the field's empty value (FB-026: `''`/`null` per type) — it's in the corpus
  (×6, JS-fed today) and trivially expressible; `set` defers (reads the *pending* input
  value, a second register this slice doesn't model).
- Checkbox `check`/`uncheck` actions → `state-set` true/false; their `done`/`unchanged`
  consumed → defer (same as Switch's).

### 4d — Lifted value outputs (CO §6, built)

Child side: a `Component Outputs` value port fed by anything in the source vocabulary
becomes an optional callback prop + push effect (§3.5):

```tsx
// Component Outputs "discountedPrice" ← re-hosted Function output (grade Q: push-on-change).
useEffect(() => {
  onDiscountedPriceChanged?.(priceDiscountOut.discountedPrice);
}, [priceDiscountOut.discountedPrice, onDiscountedPriceChanged]);
```

- Prop naming: `on` + PascalCase + `Changed` — the s10 name source, collisions **fail the
  port, never silently rename**; the parent derives the same name from the child's plan.
- Parent side: a consumed instance value output mints a parent state var
  (`useState<T | undefined>(undefined)`, maybe-undefined at every sink — the boot render
  happens before the child's mount push), passes `onXChanged={setX}`, and parent sinks read
  `state-get`. A parent that only consumes the *signal* outputs keeps s10's shape untouched.
- POPUPS §7's close-*results* ride exactly this rail when demand appears; the close-outcome
  dispatch arrow stays deferred (still zero corpus demand — recorded here so the deferral
  keeps naming a section).
- **Gate:** a For Each relaying its rows' outputs still defers (row identity, the s10
  reason); a value output fed by something outside the vocabulary defers that port, good
  ports keep firing (mixed-outputs rule).

### 4e — For Each items from a prop or state read

`RepeaterPlan` grows `itemsExpr?: ValueExpr` (beside the query/collection ids): any
vocabulary source typed as a list renders

```tsx
{(links ?? []).map((item, i) => (
  <FooterLink key={i} label={item.label} url={item.url} />
))}
```

- `?? []` is foreach.tsx's own "empty arrival clears the list". Rows key by **index** —
  these lists have no identity column, and the runtime re-renders on array identity change
  anyway (grade Q). Mapping resolves exactly as today (`'template-inputs'` included).
- Item field types: from the prop's declared type when authored; else fields read as `any`
  off an untyped list (the §10 `any` ruling — strict tsc must not reject an untyped feed).

### 4f — Invoked JS with render sinks (JS-TARGET §3.7, resolved)

A run-wired Function/Expression whose outputs feed render sinks materializes its output
record as a state var written where the chain runs:

```tsx
const [stockCheckOut, setStockCheckOut] = useState<{ warning?: string } | undefined>();
…
onClick={() => {
  const out = stockCheck({ count });
  setStockCheckOut(out);
  …rest of the done-chain…
}}
…
<p>{stockCheckOut?.warning ?? ''}</p>
```

Render reads are maybe-undefined until the first invocation — **which is the runtime's own
pre-first-run contract** (unwritten outputs read undefined; Expression abstains null). The
A2h purity gate applies unchanged; this only adds the landing zone. Direct corpus demand is
~zero, but Tier B rewrites emit precisely this shape.

## §5 What defers, all named (the map for later slices)

Beyond the per-shape gates above: control-state feeds from `Model2.prop-*` (the Model2
slice), `ComponentObject.value-*` where the record has a JS writer (Tier B — until then CO's
alias/boot-value rules of s12 apply unchanged), `User.authenticated` / `DbCollection2.isEmpty`
into visibility (backend/stub state), `onTextChanged` into ports outside the vocabulary
(named per port), wired slider min/max, wired `onFromStart`, consumed latch pulses, the
`set`-pulse register, root-`mounted`, For Each row-output relays.

## §6 Recorded divergences (cosmetic, deliberate — the standing register)

- **Write timing**: runtime state lands synchronously mid-frame; React batches to the next
  render. Quiescent-equal; mid-chain reads are handled by the snapshot rule, everything else
  that could observe it defers.
- **Boot push**: the parent's lifted state is undefined for the boot render, then the mount
  push delivers — the interpreter's parent read is the child's boot value one microtask
  earlier. Folds cover the gap.
- **`visible` implementation**: a class toggle vs the runtime's inline style mutation — same
  computed style, different mechanism.
- Slider `valuePercent` output: not modeled (derivable, zero demand); consuming it defers.
- A control's visual-state machinery (hover/pressed/checked parameter sets) stays untranslated
  everywhere (the visuals slice's standing exclusion).

## §7 What this unlocks (do not re-derive)

- **CO §7 materialization**: a Component Object property with a translated JS writer becomes
  a state var (row 1), its mirror wires sync effects (row 4), its reads state reads (row 2),
  `changed-X` consumers push effects (row 5). The s12 alias stays the degenerate no-writer
  case.
- **EXP-003 Tier B**: `Component.Object` → the materialized record; control-fed
  `in-*`/`run` → the controlled-input vocabulary; JS-written outputs feeding render → 4f.
  The Filters family (~80 nodes) is a per-component rewrite against these five rows.
- **`Text.mounted`/`Group.visible` JS reads** named by §10's defers land the moment 4b
  ships — the Text Search and phase58 expressions re-enter the pure tier.

## §8 Corpus impact, stated honestly

The mechanical wins are 4b (~60 wires whose ProductCard-family subtrees currently defer as
collateral), the phase58/Text Search/Tutorial latch-and-visibility shapes, FooterLinkColumn's
prop-fed rows, and the slider live-display. The Filters family stays locked behind Tier B by
design — this slice is its vocabulary, not its translation. §10's lesson stands: several
D-visible rows sit in components that *also* carry other defects (wired STRUCTURE elsewhere,
bare-named Function wires), so the number that actually flips is the audit re-run's to
report, not this document's to promise.

## §9 Fixture & test plan (the EXP-002 discipline)

- Cheer grows, via MCP on the live project (prefixed wires!), snapshot re-copied: a Switch
  latch (button `flip` → `state` into a Text's `mounted` and a Group's `visible`), a
  controlled Text Input (wired `startValue` from a variable + Changed chain), and a lifted
  value output (a component pushing a state-fed value port consumed by Home).
- Tests: goldens for each §4 shape (byte-for-byte); the §1 coercion table per control (sync
  effect bodies); truthiness folds at `visible`/`mounted` incl. maybe-undefined and literal
  folds; the chain-local snapshot rule (read-after-set inlines, read-after-op defers); every
  §5 defer producing its named reason; prop-name collision failing the port; ledger flips in
  the same commit (`Switch` at minimum; `Counter` only if its instances translate).
- jsdom drive: flip → element vanishes (mounted) vs stays-with-space (visible); typing syncs
  the controlled field and the lifted value arrives at the parent. Emitted app `tsc -b` +
  `vite build` clean; audit re-run with named-reason spot-checks.
