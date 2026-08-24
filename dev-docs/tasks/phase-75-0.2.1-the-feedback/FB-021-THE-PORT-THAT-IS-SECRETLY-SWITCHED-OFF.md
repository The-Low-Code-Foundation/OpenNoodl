# FB-021 — the port that is secretly switched off

**Filed:** 2026-08-22, from Jordan's session-2 report §2.1 (and §9's "highest cost-to-fix
ratio"). **Status: ⬜ open — the behaviour is real and confirmed; no coverage.** Size: M.

> *"Under content-size mode, width and height are not live ports at all. Wiring to them does
> nothing, and nothing says so. I learned this from Claude Code, not from the UI."* — repeated
> aloud four times: *"where is width?"*

---

## Ground truth

- Confirmed during FB-019's sweep: `sizeMode` is an enum that **gates whether the dimension
  ports exist at all** via `dynamicports`
  (`node-shared-port-definitions.ts:768–811` — width/height are only registered under
  `explicit`/partial modes). The panel silently omits them; a wire into a non-existent port
  moves nothing and nothing says why.
- The same mechanism gates other port families (`useLabel` → label ports, `useIcon` → icon
  ports, dynamic enum-dependent groups). Jordan hit dimensions; the fix should be the
  mechanism, not the instance.
- **The precedent is already shipped and Jordan cited it**: refused *connections* now explain
  themselves instead of silently removing the port. This task is the same principle one step
  further: a **gated port renders present-and-disabled with its reason**, e.g. *"Width is not
  driveable while Size Mode is Content"*, with the gating control one click away.

### 🔴 Corrected 2026-08-24 (session 20) — the premise above is inverted, measured

The ground truth says `sizeMode` "gates whether the dimension ports exist at all" and that in the
connection panel "the port simply isn't offered". **Both are wrong, and the truth is worse.** The
port is fully live everywhere except the Properties panel.

`addDynamicInputPorts` (`node-shared-port-definitions.ts:154`) pushes a group with **no `name`**, so
`nodelibraryexport.ts:148` defaults it to **`conditionalports/basic`**. And `basic` is not the mode
that removes a port — `portConnectivity.ts` already writes this down: `extended` means *"not on the
node at all"*, while a plain rule "only suppresses the **property row** — the port still exists and a
wire to it stays valid."

Measured on the shipped catalog (`noodl-types/src/node-catalog.json`, 175 types):

| gate mode | gated **input** ports | meaning |
|---|---|---|
| `basic` | **328** | port exists, wire survives, value delivered — panel row hidden |
| `extended` | **21** | genuinely absent from the node |

So the population this task serves is **328 ports that are live-but-hidden**, not a handful that
don't exist. Width/Height are `basic`.

Driven 2026-08-24 on `NodeGX test projects/fb021-drive` (five Groups, one selector for every arm):

| node | `sizeMode` | `width` wired | Width row | Height row | Min Width row | chips |
|---|---|---|---|---|---|---|
| 0010 | `explicit` | **yes** | ✅ shown | shown | shown | `Bound to Number · Value` |
| 0020 | `explicit` (control) | no | shown | shown | shown | — |
| 0030 | `contentSize` | no | 🔴 **absent** | absent | shown | — |
| 0040 | `contentSize` | **yes** | 🔴 **absent** | absent | shown | 🔴 **none** |
| 0050 | `contentSize` (control) | no | absent | absent | shown | — |

1. **The wire survives.** `isPortConnected('width','target')` is `true` on 0040 after a load — so
   `isConnectionValid`, which asks with `['extended']`, does not drop it. The value reaches the
   runtime and `layout.ts:66-75` then assigns neither axis under `contentSize`: **delivered, then
   discarded.**
2. **0040 and 0050 are indistinguishable in the Properties panel** — a live wire and no wire at all
   render identically. That is AC3, and it is the *central* case rather than an edge one, because
   every wire into a gated `basic` port is in this state.
3. **The port IS offered.** In the **Ports tab** — which filters with `PORT_CONDITION_FILTER_MODES`
   `['extended']`, *the same scope the connection popup uses* — the **input** `Width` (type
   `dimension`, *"Width of the element; how the value is read depends on Size Mode"*) is listed for
   0040 while it is in `contentSize`, and correctly reads `from …` there versus *"Nothing drives this
   yet"* on unwired 0050.
   ⚠️ The **output** `Width` (*"…actually ended up with after layout"*) is listed too and reads
   almost identically; an earlier pass here nearly graded the output row as proof about the input.
   Separate INPUTS from OUTPUTS before believing any row.

**What this changes.** Scope 1 stands, but the generated sentence must not say the port does not
exist — under `basic` it does, and its value is being thrown away, which is a different and more
alarming thing to tell an author. **Scope 2 is inverted**: the popup already offers the port, so the
work there is to mark it inert, not to start showing it. 🔴 **Undecided, needs Richard**: whether a
`basic`-gated port should stay wireable at all, or whether the popup should refuse it the way
refused connections already explain themselves.

## Scope

1. In the properties panel: a port removed by a `dynamicports` condition renders as a
   disabled row with the reason derived from the gating enum (the condition is data — the
   sentence can be generated: "<port> is available when <gate port> is <values>").
2. In the connection panel: dragging a wire toward a gated port shows the same reason
   (today the port simply isn't offered — the author can't distinguish "doesn't exist" from
   "switched off").
3. Clicking the reason focuses the gating control (`sizeMode` in the motivating case).
4. Scope guard: derive from the `dynamicports` declarations generally, but ship with the
   dimension case driven and asserted; other families follow the same path free.

## Acceptance criteria

- AC1: a node in content size mode shows Width/Height as disabled rows naming Size Mode;
  switching Size Mode enables them in place — driven.
- AC2: the reason sentence is derived from the port declaration, not hand-written per node —
  asserted by a sweep across visual nodes with gated dimension ports (cardinality: every
  gated port has a reason row, none double-renders when enabled).
- AC3: an existing connection into a port that *becomes* gated (author flips sizeMode after
  wiring) is surfaced, not silently inert — at minimum the disabled row shows the connection
  chip (FB-018's) so the dead wire is visible.
- AC4: interacts correctly with FB-017's tiers — a gated basic-tier port stays in the basic
  tier while disabled (hiding it again would recreate the bug).

## Traps

- `dynamicports` re-registration is the machinery FB-019's sweep touched — don't fork a
  second source of truth for "which ports exist"; render state must derive from the same
  declaration the runtime uses.
- Jordan's §2.2 ("margin and position manipulate the same underlying number") is NOT this
  task — it's FB-019's investigation item. Don't merge them on superficial resemblance.

---

## 🔴 The FB-017 constraint — verified at source 2026-08-24, and RE-ADDED after being lost twice

⚠️ **Recorded here, in the task file, and deliberately not in the phase handover.** This finding was
relayed to a live session twice (both times to a mistaken identity, both dropped), then written into
`NEXT-SESSION-PROMPT.md` — where a concurrent rewrite of that file discarded it before the commit
that was meant to preserve it. **Three delivery mechanisms, three losses.** The task file is the
only record that is not competing with anyone else's edits.

### FB-017's property filter cannot see gated ports — in either direction

`modelProxy.getPorts` (`views/panels/propertyeditor/models/modelProxy.ts:76`):

```js
let ports = [].concat(source.getPorts(filter));
// Apply ports condition filter
const portFilter = NodeLibrary.instance.applyPortConditionsFilterForNode(this);
portFilter.forEach((portname) => {
  const idx = ports.findIndex((p) => p.name === portname);
  if (idx !== -1) ports.splice(idx, 1);
});
```

The gated port is spliced out **before** `Ports._getPorts()` runs, so it never becomes a view, and
FB-017's filter only ever sees `group.views`. **No conflict with FB-017** (shipped `879f2f4c`,
`c93ae426`, AC7 `7f8ca477`): its filter can neither hide these ports nor reveal them.

### 🔴 The precondition, which fails silently

If FB-021 reveals gated ports, the filter picks them up for free — **but only if each revealed row
is a real view carrying `name`/`displayName`**, not merely a decorated element. `Ports.ts:237`
builds `portsByName` keyed on `port.name`, and the render loop reads `v.name`:

```js
const el = describePortElement(v.render(), v.name ? portsByName.get(v.name) : undefined);
const gate = typeName && v.name ? gateForPort(typeName, v.name, target) : undefined;
els.push(gate ? decoratePortElement(el, gate, target, v.name) : el);
```

A revealed row without a `name` renders, then is invisible to the filter, to `portsByName` **and**
to gate decoration — three misses, no error anywhere.

### ✅ A seam that may already do most of the work

`Ports.ts:243` calls `portDecoration.ts` *"the one place every row's element passes through,
whatever class produced it"*. BCN-010's backend gate already renders there as `{effective, reason}`,
and ERG-004's port descriptions hang off the same seam. This task's proposed
*"Width is not driveable while Size Mode is Content"* is that same shape — a gate plus a reason.

⚠️ **Unexamined, and the real design question**: whether to stop splicing at `modelProxy`, or to
keep the splice and mark the port instead. Nobody has looked.
