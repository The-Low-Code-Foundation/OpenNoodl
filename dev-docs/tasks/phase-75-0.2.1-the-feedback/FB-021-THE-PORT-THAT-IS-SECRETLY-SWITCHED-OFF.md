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

#### ✅ Re-verified independently 2026-08-25 (session 26) — the numbers hold, on three legs

The handover asked for these to be re-checked before anyone builds on them. **They are correct.**
Re-derived from the artefacts, not from this file:

| leg | checked against | result |
|---|---|---|
| the count | `node-catalog.json`, 175 types, counted fresh | **328 basic + 21 extended = 349**, exact |
| the default | `nodelibraryexport.ts:150` | `name: dp.name \|\| 'conditionalports/basic'` — verbatim |
| the meaning | `portConnectivity.ts:28-29` | `extended` = *"the port is not on the node at all"*; a plain rule *"only suppresses the property row"* — verbatim |

✅ **The catalog does carry the gate mode**, so this is checkable without reading the viewer source:
`declaredPortGroups[].name`. 135 groups are **unnamed** (→ `basic`) and carry **328** input ports;
**21** groups are named `conditionalports/extended` and carry **21**. Two other named group kinds
exist — `expand/basic` (2) and `namedports/list` (7) — and they carry **0 input ports each**, which
is the only reason the basic/extended split is a clean partition of all 349. A future catalog entry
under either name would break that silently.

🔴 **A conflation to avoid when re-running this: 21 is both the group count and the port count, by
coincidence.** Every `extended` group happens to hold exactly one input port today; every `basic`
group averages 2.4. Deriving the port population from group counts reproduces the right number now
and the wrong one later. **Count ports, never groups.**

⚠️ **All 21 `extended` ports are on data/logic nodes** — `DbModel2`, `Model2`, `SetModelProperties`,
`For Each`, `Static Data`, `noodl.cloud.response` and siblings (`modelId`, `repeaterComponent`,
`template`, `json`/`csv`, `params`). **Not one is a visual or layout port.** So every gated port an
author meets while laying a page out — Width, Height, the border and scroll families — is in the
328. The motivating complaint is squarely in the majority case, not an edge of it.

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

---

## ✅ BUILT, SPECCED AND DRIVEN — 2026-08-25 (session 30). AC1–AC4 met.

The design question this file left open — *"stop splicing at `modelProxy`, or keep the splice and
mark the port instead"* — is answered: **stop splicing, for the ports whose condition can be put
into a sentence.** Everything else follows from that.

### What ships

| file | what it does |
|---|---|
| `models/nodelibrary/portGateReason.ts` (new) | derives the sentence; **narrates, never decides** |
| `utils/portGate.ts` (new) | draws the row, and AC3's jump |
| `models/nodelibrary/dynamicPortRules.ts` | exports `tokenizeCondition` — one tokenizer, two readers |
| `propertyeditor/models/modelProxy.ts` | `getPorts` keeps + marks instead of splicing |
| `propertyeditor/DataTypes/Ports.ts` | `renderParams` wraps the row; `focusGatePort` travels |
| `styles/propertyeditor/propertyeditor.css` | shares `.property-capability-gated`'s visual language |

`applyPortConditionsFilterForNode` is still the **only** thing that decides which ports are off.
`portGateReason.ts` is handed that answer and asked only *what would switch them back on* — so the
task's "don't fork a second source of truth" trap is structurally impossible to trip, not merely
avoided.

### The corpus, re-measured — and the number this file has been quoting is the wrong kind

`npm run catalog:check` reports **"Committed catalog is up to date"**, so these are facts about
what ships, not about a stale snapshot.

| | ports | |
|---|---|---|
| explained outright | 320 | `<param> <op> <value>` against a declared port |
| recovered | 18 | `range`, once an always-false disjunct is dropped |
| **explained** | **338** | |
| refused — `#js` | 9 | the deliberate remainder |
| refused — unhideable | 2 | `icon`'s `iconSourceType`/`iconSize` |

🔴 **349 is the count of gate-ABLE ports, not of gated ones.** It asks *"if this port were switched
off, could the row explain itself?"* of every port in every conditional group. At runtime only the
ports whose condition currently **fails** are hidden — a subset. This file's earlier "328 live-but-
hidden ports" is that same counterfactual, and any statement of the form "328 ports are hidden right
now" over-reports. The population is right; the tense is not.

⚠️ **The 2 are not a gap.** `icon.ts` calls `addIconInputs(IconNode, { hideEnableIconInput: true })`,
so the node never registers the `useIcon` port its own condition asks about — `useIcon NOT SET` is
therefore always true and the real filter never hides those ports at all. Graded with the **real
evaluator**, not by arguing it.

### 🔴 Two defects the specs could not see, both found in the first ten minutes of driving

Consistent with sessions 28 and 29: the suite was green through both.

1. **AC3 did nothing on the one node this task was filed about.** `focusGatePort` focused
   `el.querySelector('input, select, textarea, button')`. That is right for the twenty-odd rows
   built on `PropertyPanelInput` — and `Size Mode` renders `SizeModeInput`, which is **`div`s and
   `span`s and nothing else**: measured live, `focusables: 0`, `tagCensus: [DIV, SPAN]`. The jump
   ran, scrolled, found nothing, and left `document.activeElement` on `BODY`.
   ⚠️ **Note how narrowly this missed being caught**: `focusGatePort`'s own comment already warned
   that a `data-identifier` selector would fail on `SizeModeType`. The *focus* step then failed on
   the same node for the adjacent reason. **Knowing a class is unusual is not checking every step
   against it.** Fixed by `revealGateTarget`: focus the row itself when nothing inside can take
   focus, and **always draw a highlight** — focusing a `div` produces no visible change at all.
2. **The sentence named the control twice.** `width` is gated by
   `sizeMode = explicit OR sizeMode = contentHeight OR sizeMode NOT SET`, and the row read *"Width
   applies when Size Mode is Explicit or Content Height or Size Mode is not set."* Every word true,
   and unreadable. Now: *"Width applies when Size Mode is Explicit or Content Height, or is not
   set."*

### 🔴 And two of my own specs passed for the wrong reason — found by mutation, not by review

18 deliberately-broken implementations were run against the suite. Sixteen killed rows that named
the defect. **Two killed nothing:**

- Deleting the `#js` guard in `parseCondition` changed nothing, because every `#js` condition that
  ships tokenises with the expression's first word in the *operator* slot, so the clause check
  refuses it anyway. ✅ The guard is **explicit rather than load-bearing for today's corpus** —
  worth knowing before someone simplifies it away. Pinned with `'#js = 1'`, the one body that would
  otherwise parse.
- Flipping the `NOT SET` guard changed nothing, because my test declared **neither** parameter, so
  the clause list emptied and the module refused by a different path entirely. Declaring the other
  clause's port is what makes the guard the only thing left that can refuse.

21 mutants now, all killing rows. **A mutant that kills nothing is the finding, not a formality.**

### Driven on a copy of `fb021-drive`, 5 arms, each read in its own eval

⚠️ The first probe selected all five nodes inside **one** `eval` and reported identical results for
all of them — `selectNode` and the panel rebuild are async, so one eval reads one stale DOM. The
five-arms-look-the-same reading was the probe, not the feature. Same trap as *"a write is invisible
in the same eval"*.

| node | `sizeMode` | `width` wired | Width row | dead-wire line |
|---|---|---|---|---|
| 0020 | `explicit` (control) | no | ✅ normal, editable | — |
| 0030 | `contentSize` | no | 🔒 gated + reason | no |
| 0040 | `contentSize` | **yes** | 🔒 gated + reason | ✅ **yes** |
| 0050 | `contentSize` (control) | no | 🔒 gated + reason | no |

**0040 and 0050 are now distinguishable** — that was AC3's central case, and the thing session 20
recorded as identical.

- **AC1** — clicking `Explicit` on the real `SizeModeInput`: gated rows 18 → 16, `width`/`height`
  ungated, and the Width row **stays in place** (still rendered, no longer wrapped).
- **AC2** — the sweep above, over the shipped catalog, with cardinalities asserted.
- **AC3** — "Show Size Mode" now lands: `activeElement` **is** the Size Mode row,
  `class="property-port-gate-target"`, `tabindex="-1"`. The gating control was in a **collapsed
  group**, which the jump opens first.
- **AC4** — the gated row keeps `group: 'Dimensions'`, which `tierForGroup` reports **basic**
  (`ADVANCED_CSS_GROUPS` is a denylist). It cannot be hidden again by the tiering.

✅ **The peer's prediction, confirmed**: because a revealed row is a real view carrying
`name`/`displayName`, **FB-017's property filter now finds it** — typing `width` on a `contentSize`
Group surfaces the gated Width row, which could not happen before.

✅ **The `#js` remainder, observed rather than assumed**: on the Icon node only `iconImageSource` is
hidden-with-no-reason (its condition is currently false); `iconIconSource`, `iconColor`,
`iconSourceType` and `iconSize` all render normally. Checked beside a known-firing control
(`visible` has a view) so the absence is a reading and not a broken probe.

### Still open, and honestly

- 🔴 **The 9 `#js` ports keep the original defect.** On an Icon with a wire into `iconImageSource`
  the value is still delivered and discarded with nothing said. Parsing the expression is the
  "escape hatch until it is code in JSON" `dynamicPortRules.ts` warns against; the count is
  asserted so a tenth cannot arrive unnoticed.
- 🔴 **Scope 2 (the connection panel) is NOT done.** This session is scopes 1, 3 and 4. The popup
  already *offers* gated ports (session 20 measured that), so the work there is to mark them inert
  — and it still needs **Richard's ruling**: should a `basic`-gated port stay wireable at all?
- ⚠️ **The highlight was verified as a class and a focus, not as pixels.** Nobody has looked at the
  outline against both themes.
- ⚠️ **Only `Group` was driven.** The other 174 types are covered by the catalog sweep, which grades
  sentences and not rendering.

### 🔴 Session 31 — the two amber rules are the same amber, and the comment said otherwise

Read while checking, before committing, whether the tokens this feature names actually exist. They
do. What does not exist is the **difference between two of them**.

`colors.css:483` says it in its own words — *"`notice` is the legacy name for warning and aliases
onto it"* — and defines `--theme-color-notice: var(--theme-color-warning)`. The light block
(`:root[data-theme='light']`, line 631) overrides `--theme-color-warning` and **does not** restate
`notice`, so the alias holds there too. **The two tokens are the same colour in both themes.**

FB-021 draws its two lines with those two tokens, and the comment beside the second one claimed the
choice was doing work: *"Not dimmed, and **warning rather than notice**: a value is arriving and
being discarded."* On screen the hue is identical. Worse than the token being cosmetic is **where
these two land**: `portGate.ts` appends both to the same `wrapper`, so on a gated port that is also
wired an author sees two 2px amber rules stacked directly on top of each other, one of which is
meant to read as more serious.

🔴 **The second claim in the same comment was wrong in a way that would survive a source read.** It
said the dead-wire line is *"OUTSIDE `.property-port-gated-control` on purpose … must not be dimmed
along with the control"*. It is outside — and **so is the reason line**; both are siblings of the
control, not children. Being outside distinguishes neither. The distinction that does ship is one
step of opacity: `.85` on the reason block, full on the dead wire. Small, real, and not what the
comment named.

⚠️ **And the paragraph above it had the comparison inverted.** *"Only the accent differs"* — the
accent is the one thing that does **not** differ from `.property-capability-reason`, which resolves
to the same amber. The two features differ by their bottom margin, 6px against 8px.

✅ **Fixed as comments only.** Three corrections in `propertyeditor.css`, no rule changed. The token
choice itself is left alone deliberately: **FB-017's `.property-structural-hint` already documents
this exact aliasing** and keeps the distinct token so the two can be separated later without
editing the rule. That convention is right and FB-021 now follows it honestly rather than claiming
a distinction it does not have.

🔴 **The lesson is the one this phase keeps relearning.** Session 30's drive verified the highlight
*as a class and a focus, never as pixels* — this file said so — and a claim about **colour** sat
three lines away from it, unchecked, phrased confidently. A comment asserting a visual difference is
a claim about rendering, and reading the source back proves only that the token name is spelled the
way the comment spells it. **Resolve the token before believing the sentence.**

⚠️ **Left for Richard, a design call, not a defect**: given the two lines co-occur, should the dead
wire actually become visually louder — `--theme-color-danger` exists and is red in both themes? The
capability-gating precedent argues *against* red ("this is information, not an error"), but that
argument was made about a port that **cannot** work, not one that is working and being thrown away.
Unchanged pending a ruling.

### ✅ Session 31 — the missing `'target'` argument, answered: it could never have mattered here

Session 30 left this as an unowned worry: *"the dead-wire line is drawn from `isPortConnected(name)`
with no direction argument — everywhere else in this panel passes `'target'`. It reads correctly on
the fixture; nobody has constructed a node where the two answers differ."*

**Nobody could have.** `Ports.model` is a `ModelProxy` (declared at `Ports.ts:82`), the DataTypes'
`parent` is that same Ports view, and `ModelProxy.isPortConnected` is declared

```ts
isPortConnected(name) {           // modelProxy.ts:65 — one parameter
  … return this.model.isPortConnected(name);
}
```

It **takes no second parameter and forwards none**. So all ~25 `parent.model.isPortConnected(p.name,
'target')` call sites in `DataTypes/` are passing `'target'` into a function that discards it, and
every row in this panel has always been reading the untyped from-**or**-to answer. FB-021's call is
byte-for-byte different and behaviourally identical. ✅ **No defect, and no change made** — adding
`'target'` at `Ports.ts:379` would have been pure cargo cult, matching the other 25 in appearance
while changing nothing, and making the real problem harder to see.

🔴 **The real finding is one level up, and it is not FB-021's.** The panel's evident intent — only
an *inbound* wire counts — is honoured **nowhere**, because the proxy's signature drops it.
`NodeGraphNode.isPortConnected(portname, type?)` treats a missing `type` as *"source or target"*
(`NodeGraphNode.ts:270`), so a port plugged `input/output` and wired only **outbound** reports
connected to every row in this panel. For FB-021 specifically that would put *"a value is arriving
and being discarded"* under a port where nothing is arriving. Unreached on any fixture so far, and
left alone deliberately: fixing the proxy signature changes the connection chip on 25 row types at
once (FB-018's surface), which is a change that must be driven, not slipped into a CSS-comment
session. **Filed here because it now has an explanation rather than a shrug.**

⚠️ Note the shape of this one for the phase's collection: the source text read as *"FB-021 is
inconsistent with 25 neighbours"*, and the truth was *"FB-021 matches all 25 in behaviour, and all
26 are inconsistent with their own stated intent."* **A difference in argument lists is not a
difference in behaviour until the callee's signature is read.**

## 🔴 RICHARD'S RULING, 2026-08-25 (session 31) — scope 2, and the canvas

**Scope 2 (the connection panel):** *"I dunno, I guess the more there's visual feedback the less
grief I'll get from confused non-tech builders?"* → **mark, do not hide.** A `basic`-gated port stays
offered in the popup and is drawn inert with its reason, rather than being removed from it. Consistent
with scopes 1/3/4, which keep the row and explain it.

**The canvas:** *"maybe make it dotted for a port that can't work? That's what happens when a port is
deleted at the moment and the connector is still there."*

✅ **The precedent he is remembering is real, and it is reached by a route we can reuse exactly.**
A deleted port makes `getPort()` return undefined, `evaluateConnectionHealth` raises
`con-no-target-port`, `getConnectionHealth` returns `{healthy: false}`, and both paint sites plus
`restoreWireDash` set `setLineDash([5])`. Dashed wire, with a message.

🔴 **And the gated case was deliberately excluded from that check.** The same statement reads

```js
!targetPort || !NodeLibrary.instance.isConditionalPortValid(targetNode, c.toProperty, ['extended'])
```

`['extended']` only. A `conditionalports/extended` port is genuinely not on the node and already
warns; a `conditionalports/basic` port — **the entire subject of FB-021** — is live, discards its
value, and is **not** covered. That is the same defect this task was filed about, on the other
surface: `modelProxy` hid the row, and `evaluateConnectionHealth` leaves the wire solid.

### The shape of the work, when it is taken

- A sibling key (`con-target-port-gated`) raised in `evaluateConnectionHealth` when the target port
  **exists**, is valid under `extended`, and is currently switched off by a `basic` condition.
- The message comes from `portGateReason.ts`, which already produces the sentence — narrating once
  more rather than forking a second explanation.
- ⚠️ **No new dash pattern.** `restoreWireDash`'s header already warns that three meanings live on
  `setLineDash` (`[5]` unhealthy, `[6,4]` `Deleted`, `[7,4]` error edge) and they are barely
  distinguishable; the health route gets the dash for free, in every paint path, with no fourth.
- ⚠️ **Open, and the one thing still needing Richard**: `level: 'error'` (red, identical to a broken
  wire) or `level: 'warning'` (amber, advisory)? The wire is not *invalid* — it is valid and ignored
  — which argues for `warning`; the value being silently discarded argues for `error`.
- ⚠️ **Check `UNRESOLVED_PORT_WARNING_KEYS` before adding the key.** It lists the two warnings that
  *ports arriving* may clear, and its comment is deliberate about what is excluded. A gated port's
  warning is cleared by a **parameter change**, not by ports arriving, so it likely does **not**
  belong in that list — but FIX-007's urgent lane is keyed on it, so this needs deciding rather than
  assuming.

### 🔴 …and the reason it is NOT a one-liner: the warning would be STALE BY CONSTRUCTION

`level: 'warning'` ruled by Richard (session 31): the wire is valid and its value ignored, so amber
rather than the red a deleted port earns. Red stays meaning *"this cannot work at all"*.

Then the check that matters. **Nothing re-evaluates connection health when a parameter changes.**
The complete list of triggers, read from `NodeGraphModel`'s constructor and `projectmodel.ts:193`:

| trigger | note |
|---|---|
| `Model.instancePortsChanged` | urgent lane, **gated on `hasUnresolvedPortWarning`** |
| `typeRenamed` | |
| `moduleRegistered` / `moduleUnregistered` / `libraryUpdated` | via `scheduleUpdateTypes` |
| `Model.variantAdded` / `Deleted` / `Renamed` | |

`grep -rn "parameterChanged" .../models` returns **nothing** on a path to health. Every other
connection warning is keyed on facts that only *those* events change — a port existing, a type
name, a port's type. **A gated port is different: its state is a function of a sibling parameter's
value**, and that is the one input health never watches.

So the new warning would be **wrong in both directions until an unrelated event happened to fire**:
flip `Size Mode` to `Content Size` and the wire stays solid; flip it back and the wire stays dashed.
⚠️ This is the same failure the panel had before FB-017 AC4 — *"the panel never re-renders on a
parameter change"* — arriving on the canvas for exactly the same reason. It would have shipped
looking correct on any fixture built by *constructing* a graph, because construction fires the other
triggers; only flipping the control **after** the wire exists exposes it.

#### The trigger needs a guard, not just a hook

🔴 `setParameter` is **hot**: FB-022 measured **13 model writes in one 60px drag**. A naive
`parameterChanged → scheduleEvaluateHealth()` schedules a graph-wide pass on every one. The 2 s
debounce coalesces them, but the existing code is deliberate about not letting a common path arm
that timer at all — FIX-007's comment says so about ports arriving for a hundred healthy nodes.

✅ **Mirror `hasUnresolvedPortWarning`**: schedule only when the changed parameter actually **gates
something on that node's type** — i.e. it appears as the left-hand side of a `dynamicports`
condition. `parseCondition`/`tokenizeCondition` already extract that, so the predicate is a lookup
over the node's own `dynamicports` and needs no new parsing. Cheap, and it keeps every ordinary
parameter write off the timer.

#### Shape, in order

1. `con-target-port-gated` in `evaluateConnectionHealth`, raised when the port **is** on the node
   (`isConditionalPortValid(node, port, ['extended'])` true) but **is switched off**
   (`isConditionalPortValid(node, port, ['basic'])` false) — symmetric with the existing statement.
2. Message from `portGateReason.ts`; `level: 'warning'`, `showGlobally: true`.
3. The parameter-change trigger with the gating-parameter guard above.
4. **NOT** in `UNRESOLVED_PORT_WARNING_KEYS` — that list is the warnings *ports arriving* can clear,
   and this one is cleared by a parameter. Adding it would arm FIX-007's urgent lane wrongly.
5. Scope 2's popup half: mark the offered port inert with the same sentence.
6. ⚠️ **The drive has to flip the control on a graph that already has the wire** — building the
   graph and reading it once would pass on a broken implementation.

---

## 2026-08-25 (session 33) — scope 2 and the canvas, BUILT. ⬜ Not yet driven.

### 🔴 FIRST: the premise of the section above is WRONG, and the work was much smaller for it

Session 31 recorded *"nothing re-evaluates connection health when a parameter changes"*, concluded
the warning would be **stale by construction**, and scoped a new trigger plus a guard to keep it off
`setParameter`'s hot path. **That trigger already exists.** The chain, read end to end:

```
node.setParameter(...)
  → NodeGraphNode.notifyListeners('parametersChanged', …)      NodeGraphNode.ts:740/754/1307
  → EventDispatcher.instance.notifyListeners('Model.' + event)  shared/model.js:76  ← the global bridge
  → NodeGraphModel.bindModels' listener on 'Model.parametersChanged'
  → scheduleUpdateTypes()  → 1 ms →  updateTypes()  →  scheduleEvaluateHealth()   → 2 s → the pass
```

🔴 **The error was a bounded query reporting its bound.** The grep was `parameterChanged`; the event
is **`parametersChanged`**. One letter, and it turned a three-line change into a scoped M with a
performance guard. ✅ *`model.js:76` broadcasts **every** model event globally as `Model.<event>`* is
the fact worth carrying: if a model notifies it, the dispatcher has it.

**Consequences for the plan above:** items **1, 2, 4, 5, 6 stand**; item **3 (the parameter-change
trigger and its gating guard) is deleted** — it would have been a second scheduler racing the one
already there, which is the `a-check-in-a-second-pipeline-is-a-duplicate-first` shape. And the
FB-022 hot-path worry dissolves: `updateTypes` **already** runs on every parameter write today, so
this warning adds no scheduling cost at all, only work inside a pass that was happening anyway.

### What was built

**The canvas half** — `NodeGraphModel.evaluateConnectionHealth`, a new `con-target-port-gated`
statement, symmetric with `con-no-target-port` directly above it: the port **is** on the node
(`targetPort` present) but `isConditionalPortValid(node, port, ['basic'])` is **false**. Message
from `portGateReason.reasonsForGatedPorts` — the module that already owns the sentence, so the wire
and the property row cannot drift into two accounts. `level: 'warning'`, `showGlobally: true`, and
**no new dash pattern**: `getConnectionHealth` turns any unhealthy verdict into `setLineDash([5])`
in every paint path. Deliberately **not** in `UNRESOLVED_PORT_WARNING_KEYS`, per item 4.

**Scope 2** — `ConnectionBar._getPorts` asks the filter a *second* time at `['basic']`, and marks
what comes back `disabled` / `reason: 'gated'` / `message: <the sentence>`. Richard's *"mark, do not
hide"* lands on machinery that was already built and already styled: SIG-001's refusal vocabulary,
`PortItem`'s disabled state and `RefusedPorts`' collapsing summary. No new UI.

🔴 **Two placements in that pass are load-bearing, and both are counter-intuitive:**
- **After** the `getConnectionStatus` loop, because a gated port is normally perfectly connectable
  — `p.disabled = !status.connectable` would wipe the mark. The defect *is* that the wire is legal.
- **Outside** the `if (sourcePort !== undefined)` guard, because that loop only runs while a wire is
  in flight; opening the popup with no drag would otherwise list a switched-off port as ordinary.

⚠️ **`refusedGroupSummary`'s new branch sits ABOVE its `targetTypeName === 'signal'` test.** A gated
signal port would otherwise be summarised *"a moment, not a value"* — true about signals, wrong
about why that row is inert. **Ordering is the only thing holding it**, so a spec pins it, and a
mutant that moves the branch below the signal test **fails that spec** (verified, not assumed).

🔴 **And the generic line is not a vaguer version of the gated one, it is the opposite claim.**
Every other `RefusalReason` means *the wire will not be made*; `gated` means it **will be made and
then ignored**. *"N ports this wire can't reach"* would send an author hunting a type error that is
not there — Jordan's reading, four times.

### Gates

- `npm run typecheck:editor` — **0 errors**.
- `npm run test:main` — **335 files / 5438 specs / 0 failures**.
- `npm run test:ci` — **2849 specs / 4 failures, THE FLOOR, matched BY NAME** (all four
  `AIX-006 style vocabulary`). ✅ **Default ceiling, run alone on an idle machine, on committed
  code** — this is the re-measure FB-002's session owed and did not take. Completed 18:26.
  ⚠️ Taken **before** the FB-021 edits landed; it grades the FB-002 commit, not this one.
- **Mutation-checked**, 1 mutant, 1 killed (the ordering above).
- 🔴 The completion notification said *"exit code 0"* while the log's last line was `EXIT=1` and the
  summary line said `4 failures`. **Sixth session.** The summary line is the only honest readout.

### ⬜ Left: the drive, and it is the one that matters

⚠️ **Everything above is reading plus unit specs.** The trigger claim in particular — that a
parameter change already reaches health — is **read from source, not observed**, and it is exactly
the claim whose failure mode is a warning that is stale in both directions.

**The drive, per item 7:** wire something into `width` on a `Group`, **then** flip `Size Mode` to
`Content Size`, wait out the 2 s debounce, and see the wire go dashed with the sentence; flip back
and see it go solid. 🔴 **Building the graph and reading it once would pass on a broken
implementation**, because construction fires the other triggers.

### ✅ DRIVEN — the canvas half, 2026-08-25 (session 33)

Real stack, real `Group`, and the graph was built **first** so that the flip happened on a wire
that already existed — the one ordering item 7 insists on.

Fixture: a `String` node's `value` wired into a `Group`'s `width`, then `setParameter('sizeMode', …)`
through the ordinary model path, reading after the 2 s debounce each time.

| `Size Mode` | `isConditionalPortValid(…,['basic'])` | `con-target-port-gated` | `con-no-target-port` | `getConnectionHealth` |
|---|---|---|---|---|
| *(unset)* — **control** | true | 0 | 0 | — |
| `contentSize` | **false** | **1**, level `warning` | 0 | `{healthy:false}` + the sentence |
| `explicit` (flipped back) | true | **0 — cleared** | 0 | `{healthy:true}` |

✅ **The trigger claim is now observed, not read.** Flipping the control after the wire existed
raised the warning, and flipping back cleared it — **not stale in either direction**, which is
precisely what session 31 predicted would fail. The `Model.parametersChanged` chain carries it.

✅ **The dash is reached, and by the route that was supposed to reach it.** `getConnectionHealth`
asks `WarningsModel.getWarnings({component, connection})` **key-agnostically** — any warning on the
wire makes it unhealthy — so the new key needed no registration anywhere and inherits
`setLineDash([5])` in every paint path. No fourth dash pattern, as ruled.

✅ The message renders as intended:
> This wire is delivering a value the node ignores: **Size Mode** has switched this port off.
> Width applies when Size Mode is Explicit or Content Height, or is not set.

✅ `con-no-target-port` stays at **0** throughout — the new warning does not double-report with the
deleted-port error, which was the risk in making the two statements symmetric.

### 🔴 TWICE in one session, the PROBE was the broken thing, not the code

Both times the false reading said *"the feature does not work"*, and both times it was believed for
several minutes:

1. **`getWarningsForRef({component, connection, key})` returned a wrapper whose `.warning` was
   `undefined`** while the warning was really there — visible immediately in
   `getAllWarningsForComponent`. The first probe printed `w.message || String(w)`, so an
   **absence** and a **wrapper** both rendered as `[object Object]`, and a real warning read as
   null once the reader was "tightened" to `.warning`.
2. FB-002's two threads render identically, so *"the pill flips and the row does not change"*
   looked exactly like a dead filter.

✅ **The rule both cases point at: a probe must be able to tell the two answers apart, and that is a
property to check BEFORE trusting either answer.** `getAllWarningsForComponent` enumerates and can
distinguish; `getWarningsForRef` matches and cannot say why it matched nothing. **Prefer the
enumerating reader over the matching one**, and when a reading says "broken", re-read it with a
different instrument before believing it.

### ~~⬜ Still not driven: scope 2, the popup~~ → ✅ DRIVEN 2026-08-25 (session 34)

The `ConnectionBar` half was built and unit-specced but had **not been opened in a running editor**.
Its two load-bearing placements (after the status pass, outside the source-port guard) are exactly
the kind of thing that reads correct and behaves wrong, and neither was covered by the copy specs.
⚠️ The catalog sweep grades *sentences*, not rendering — the same gap `.property-port-gate-target`
still has.

---

## ✅ 2026-08-25 (session 34) — scope 2 DRIVEN, and the drive found a defect

Real stack, real `Group`, a copy of `fb020-drive` opened from the renderer. The wire
(`String.value → Group.width`) existed **before** `Size Mode` was touched, and the popup was opened
by the ordinary route: `interaction.draggingConnection = {fromNode, toNode, popupOpen: true}` then
`editor.openConnectionPanels()` — the two lines `InteractionController`'s `mouseup` runs.

### Both entry paths, and the control

⚠️ The two placements the commit calls load-bearing map onto the popup's two states exactly:
**STEP 2 before a source port is picked** is `sourcePort === undefined` (outside the guard), and
**after picking one** is the state where `getConnectionStatus` has run (the mark applied last).

| `Size Mode` | popup state | `Width` / `Height` | rest of the node |
|---|---|---|---|
| `explicit` — **control** | STEP 2, no source port | **enabled**, in `Dimensions` | 30 other ports gated by *their* settings |
| `explicit` — **control** | source port = `value` | **enabled** | + `Focus` refused, `type-mismatch` |
| `contentSize` | STEP 2, no source port | **refused**, `reason: 'gated'` | the group's summary goes 6 → **8** |
| `contentSize` | source port = `value` | **refused**, mark survives | `Focus` still refused for its own reason |
| back to `explicit` | source port = `value` | **enabled again** | mark lifts |

✅ **All four claims the specs could not reach are now observed.** The port is *listed*, not hidden
(Richard's *"mark, do not hide"*); the mark appears with **no wire in flight**, so the guard
placement is right; it **survives** the status pass, so the ordering is right; and it **lifts** when
the gating parameter changes back, so the popup reads the live parameter rather than a constant.

✅ **The status pass demonstrably ran** in the source-port arm — `Focus` appears refused there and
not in the no-source arm. Without that row, "the mark survived" and "the pass never happened" would
be the same reading. **A control that shows the thing you fear ran.**

✅ The sentence renders, from `portGateReason` via `PortItem` → `DocsPopup`:
> Width applies when Size Mode is Explicit or Content Height, or is not set.

✅ Bonus, visible in the same frame: the canvas wire into `width` is drawn **dashed** — session 33's
`con-target-port-gated` half, live beside this one.

### 🔴 The defect the drive found: two correct functions composing into the forbidden sentence

Mid-drag, the fully-refused groups fold into **one** block. With `Size Mode` at `contentSize` that
block held **8 gated ports and one type-mismatched `Focus`** — a mixed set, so `dominantReason`
answered `'other'` (deliberately, and rightly, for two kinds of *refusal*) and the summary read

> **"9 ports this wire can't reach"**

over eight ports the wire reaches perfectly well. **That is the exact sentence this task exists to
prevent**, and it is the one the commit message singles out: *"the generic line is not a vaguer
version of the gated one, it is the opposite claim… would send an author hunting a type error that
is not there — Jordan's reading, four times."*

🔴 **Every part was green.** `refusedGroupSummary('gated')` is right and specced. `dominantReason` is
right and specced. The `gated` branch even sits above the signal test, with a mutant proving the
ordering. The defect is in the **composition**, which no unit spec addressed — and it is only
visible on the surface that is **shown before anything is expanded**, so an author who never opens
the block reads nothing but the false line.

⚠️ It is **not** fixable by letting `gated` win in `dominantReason`: that puts *"switched off by a
setting"* over the type-mismatched row instead — the same defect pointing the other way.

**The fix.** `partitionGated` in `refusalPlan.ts`, applied inside `RefusedPorts`, which now renders
up to two summary blocks. The split lives in the component rather than in `ConnectionBar` because
**both** call sites have the defect — a mixed *group* as much as the folded block.

✅ **Both halves gained.** After the fix the same drag reads:

| block | before | after |
|---|---|---|
| the type-mismatched `Focus` | *(melted in)* | **"1 signal input · a moment, not a value"** |
| the 8 gated ports | *(melted in)* | **"8 ports switched off by a setting"** |
| the two together | **"9 ports this wire can't reach"** | *(never rendered)* |

`Focus` had lost its own honest wording to the merge too. **A summary over a mixed set was making
both halves less true, not one.**

⚠️ **One behaviour change beyond the summary, and it is UNDRIVEN**: the gated block is not given
`canRedirect`. Offering *a different wire* is the right answer when this one is refused and the
wrong one when it is legal — the port comes back by changing the setting the row names. The fixture
here produced no confident redirect (`offer.actionable` false), so **no row in either block was a
redirect and the distinction was never exercised**. Reaching it needs a source whose type exactly
matches a primary port, e.g. a `String` output at a `Button`.

### 🔴 A second finding: `refusalHeadline` has NO production caller

`grep -rn refusalHeadline packages/` returns `portCopy.ts` (the definition) and **two test files**.
Nothing in `src/` calls it. So FB-021's `'This port is switched off by another setting.'` branch —
and the spec asserting it — grade **dead code**, and so do the three pre-existing SIG-001 headlines
beside it. The sentence a user actually reads comes from `p.message` through `PortItem` →
`DocsPopup`'s `docsRefusal`, which the drive confirmed renders.

⚠️ Not fixed here. Wiring the headline in changes the explainer for **every** refusal reason —
SIG-001's surface, four headlines at once — which needs its own drive, not a slipped-in line.
✅ **The shape worth carrying: a spec can be green, mutation-checked, and still grade a function
nothing calls.** `refusalHeadline` was mutation-checked in session 33 *within itself*; a mutant that
changes an unreachable function's output still fails its spec. **Mutation testing proves the spec
reads the function; only a caller-grep proves the function reaches the user.**

### Gates

- `npm run typecheck:editor` — **0 errors**, after the fix and the new spec.
- `npm run test:main` — **336 files / 5444 specs / 0 failures** (was 335/5438; +1 file, +6 specs).
- `npm run test:ci` — see the phase handover; run alone, on this tree.
- **Mutation-checked**: reverting `partitionGated` to the pre-fix single block (everything into
  `refused`) fails **3** of the 6 new specs, including the one asserting the generic line never
  appears. The mutant is the defect as driven, so the spec grades the real thing.
- ⚠️ **Undriven, by construction of the fixture**: the mixed-*group* case (a group with connectable
  ports *and* both kinds of refusal). Every group on a `Group` node was homogeneous. It is the same
  component and the same partition, and the spec covers the composition — but it was not seen.
