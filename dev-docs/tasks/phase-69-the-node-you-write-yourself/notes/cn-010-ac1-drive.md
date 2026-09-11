# CN-010 AC1 — the property panel drive

**Session 19, 2026-08-17.** Fixture: `packages/noodl-mcp/tests/fixtures/kit-dynports`, driven from a
`cp -R` copy in the session scratchpad (never the fixture itself — a drive writes into a project).

---

## Part 0 — the observations, written BEFORE the editor was launched

🔴 Recorded first on purpose. A drive can pass on a broken feature; the only defence is naming the
observation that a broken feature could not produce, and doing it before you can see the answer.

AC1 reads: *"A kit node declaring `dynamicports` shows the expected ports in the property panel and
is connectable."* Two nodes in the fixture, two different mechanisms, so four observations.

| # | Observation | What a BROKEN feature looks like | Why the obvious reading is not enough |
|---|---|---|---|
| **O1** | `NodeLibrary.instance`'s entry for `dynports.kit.Panel` carries a `dynamicports` array whose one entry is `conditionalports/basic` with `condition: "mode = list"` and a **`ports`** array (not `inputs`) holding `itemCount` with full metadata. | `dynamicports` absent, or present but still in the author's `inputs: ['itemCount']` form. | The editor's filter (`applyPortConditionsFilterForNode`) reads `ref.ports`. An entry that survived transport in the *author's* shape would iterate `undefined` and the filter would silently do nothing — the same visible result as no dynamic ports at all. |
| **O2** | With `mode = grid`, the Panel's property panel **does not** show an `Item Count` row. With `mode = list` it **does**. | The row is present in both, or absent in both. | 🔴 **This is the discriminating pair, and it is the whole point of the drive.** "The row appears" is true of a node with no dynamic ports at all — `itemCount` is *also* declared as an ordinary `inputProps` entry, so a totally inert `dynamicports` array still renders it. Only the *disappearance* under `mode = grid` can distinguish a working conditional group from a decorative one. |
| **O3** | The Panel's `itemCount` is **connectable** in the state where it is shown — it appears in the connection popup's input list for a wire dragged to the node — and the connection survives a save/reload. | Row renders but the port is not offered to the connection popup. | "Shows in the panel" and "is connectable" are two lists built by different code (`getPorts` vs the popup's own filter). AC1 asks for both by name. |
| **O4** | The Feed's `channelName` port exists on the node despite the exporter deliberately excluding a channel port from the static `ports` list. | `channelName` missing everywhere, so the fixture's stored `parameters.channelName = "ticks"` names nothing. | The exporter's `conditionalPortNames` block removes `input/channelName` from `nodeObj.ports`. If nothing on the editor side puts it back, the parameter in the fixture is orphaned — which is exactly the "guaranteed false `unknown-parameter`" the fixture header predicts, seen from the editor's end. |
| **O5** | Changing the kit's `dynamicports` while an instance sits on canvas: what the editor does. | — | 🔴 **No prediction is recorded, deliberately.** This one is open-ended ("what does it do"), and inventing an expectation first would turn it into a pass/fail on a guess. What is recorded instead is the *procedure*: edit `index.js`, get the library re-sent, and read the panel and the stored parameters again. |

**Controls the run must carry**, so a null result is attributable:

- **C1 — a positive control on the same instrument.** Every panel read is taken alongside a
  *built-in* node with a known conditional group, so "no rows changed" cannot be the signature of a
  dead probe. If the built-in's rows do not move either, the instrument is broken, not the kit.
- **C2 — `selectNode(null)` poisons the selection** and makes every subsequent panel render
  identically, which reads exactly like a real defect. Nulls are filtered out of
  `ng.selector._selected` before any reading is believed.
- **C3 — `BaseDialog` renders every dialog twice.** Any dialog query is filtered with
  `:not([class*=MeasuringContainer])`.
- **C4 — the panel is measured, not the model.** `node.dynamicports` (the instance cache) is known
  to disagree with the rendered panel; the rendered panel is the reliable readout of *declaration*.
  O1 is a claim about the **library entry**, which is a third thing again, and is read as such.

---

## Part 1 — results

**Verdict: AC1 is met for the conditional-group form and NOT met for the channel-port form.** Two
further findings came out that are worth more than the criterion, and both are named in §4 and §5.

| # | Predicted | Measured | |
|---|---|---|---|
| **O1** | editor-format `ports` array, condition intact | **exactly that** | ✅ |
| **O2** | `Item Count` present at `mode = list`, absent at `mode = grid` | **exactly that, and reversible** | ✅ |
| **O3** | connectable, connection survives a reload | **connectable, wired, saved, and live at runtime** | ✅ |
| **O4** | `channelName` exists somewhere | **exists nowhere — three surfaces, all silent** | 🔴 |
| **O5** | (no prediction recorded) | **an edit to an existing kit node is silently discarded for the session** | 🔴 |

### O1 ✅ — the author's shorthand arrives as the editor's format

`NodeLibrary.instance.getNodeTypeWithName('dynports.kit.Panel').dynamicports`:

```json
[{ "name": "conditionalports/basic", "condition": "mode = list",
   "ports": [{ "name": "itemCount", "type": "number", "plug": "input",
               "group": "List", "displayName": "Item Count", "default": 3 }] }]
```

The author wrote `inputs: ['itemCount']`. `formatDynamicPorts` (`nodelibraryexport.ts:118-155`)
expanded it against the node's own `inputProps` and `sendNodeLibrary` delivered it whole. **Nothing
about this path is kit-aware and nothing about it needed to be.**

### O2 ✅ — the condition is evaluated, both ways

Driven through the real `Mode` dropdown (trusted clicks on the `<li>` inside the non-measuring
`BaseDialog` copy), reading the panel in a *separate* eval each time:

| `mode` | property panel |
|---|---|
| `list` | `… ¶ Mode ¶ **LIST ¶ Item Count ¶ fx** ¶ GENERAL …` |
| `grid` | `… ¶ Mode ¶ GENERAL …` — the group heading goes too |
| `list` again | back, unchanged |

`parameters.itemCount` stays `4` throughout: the port is hidden, the value is kept.

🔴 **The instrument nearly produced a false negative, and the tell is worth carrying.** The first
attempt set the parameter through the model (`node.setParameter('mode','grid')`). The panel did not
change — **including the `Mode` row itself, which still read `List`**. Had `Item Count` been the only
thing watched, this would have been recorded as *"the condition is not evaluated"* about working
code. **The property panel is not a live readout of the model; it re-renders on the UI write path.**
The control that caught it was free: the row I was *driving* is also a row I can *check*.

### O3 ✅ — connectable, and the wire carries a value

Opened the real connection popup (`interaction.draggingConnection` + `connectionPopups.open()`),
clicked `Child Index` on the Group's out-bar and `Item Count` on the Panel's in-bar:

- model: `dyn_group.childIndex -> dyn_panel.itemCount`
- canvas: a drawn wire into a drawn `Item Count` port
  ([screenshot](cn010-ac1-conditional-port-connected.png))
- property panel at `mode = list`: **`Item Count ¶ Bound to App Root · Child Index`**
- Group's **Ports** tab: `Child Index … to ¶ List Panel · Item Count`
- **runtime**: with `App` made the home component the preview renders **`Lanes (0)`** — `props.title`
  plus `props.itemCount`, and the `0` is `Child Index` arriving over that wire
- it round-tripped: after an editor reload and re-open, the connection was still there

⚠️ **The popup does not apply the condition** — `Item Count` was offered while `mode = grid`, i.e.
while the condition was false. ✅ **This is not a kit defect**: the same popup offers `Group`'s
`Offset X`, `Shadow Enabled`, `Border Width` and `Border Color` — all of which
`applyPortConditionsFilterForNode(dyn_group)` returns as filtered-out. **A built-in and a kit node
are treated identically, which is what P1 asks for.** The Ports tab likewise lists `Item Count` in
both modes, and that one is arguably correct: its own header promises *"every port on this node,
whether or not it has a property."*

### O4 🔴 — a `channelPort` is erased, and nothing in the product would ever have noticed

`dynports.kit.Feed` declares `{ channelPort: { plug: 'input', name: 'channelName' }, name: 'channel' }`
and the fixture stores `parameters.channelName = "ticks"`. Where `channelName` appears:

| surface | result |
|---|---|
| library entry's static `ports` | **absent** — `nodelibraryexport.ts:487-492` deliberately removes it |
| Properties tab | **absent** (`Heading` only) |
| Ports tab — *"every port on this node"* | **absent** — 5 inputs, 9 outputs |
| connection popup | **absent** — `Variant, Mounted, CSS Class, Heading` |
| `node.getPorts()` with the runtime live and the node **mounted** | **absent**, 14 ports |
| `node.dynamicports` (what a runtime would push) | **`[]`** |

🔴 **The last two rows are the ones that make this a finding rather than a guess.** With no home
component the Feed never mounts, and *"the port only appears while previewing"* would have been a
live hypothesis. `App` was made the home component, the preview rendered `Live` (so the node is
mounted and running), and the port is still absent. **There is no state in which it exists.**

🔴 **Census over the whole library: `channelPort` occurs exactly once in 177 types, and it is this
fixture's own kit node. Zero shipped built-ins use it.**

| mechanism | types declaring it |
|---|---|
| `conditionalports/basic` | 136 |
| `conditionalports/extended` | 21 |
| `port` (WFA-009's `namedports/list`) | 7 |
| `template` | 2 |
| **`channelPort`** | **1 — the fixture** |

So there is **no built-in control to compare against**, and that *is* the explanation: the exporter
strips the port on the assumption an editor-side manager re-adds it, and
`NodeLibrary.DynamicPortChannel` is one of the four managers commented out at
`nodelibrary.ts:94-106` (*"their classes no longer exist in the repo"*,
`dynamicPortRules.ts:36-40`). Nothing shipped exercises the shape, so nothing ever went red.

⚠️ **Not P1.** A built-in declaring `channelPort` would be erased identically. The hole is generic in
the code and kit-only in consequence, because a kit is the only thing that can newly declare one.

⚠️ **What this drive did NOT establish**: whether the editor *warns* about the orphaned
`channelName` parameter. `WarningsModel.getTotalNumberOfWarnings()` returned **0** — but it also
returned 0 with a deliberately bogus `Totally.Not.A.Real.Type` node sitting on the canvas beside it
(added as a positive control, removed after). **The instrument did not fire on a known-bad input, so
its zero says nothing.** Recorded as unmeasured rather than as silence.

### O5 🔴 — a kit's node definition is delivered once and then frozen

The open-ended question. The answer is sharper than expected, because a control pair fell out of a
single edit.

**One write to `index.js` made two changes:** flipped `Panel`'s condition `mode = list` → `mode = grid`,
and added a brand-new third node `dynports.kit.Badge`. Then one viewer reload
(`document.querySelector('webview').reload()`).

| change | delivered? |
|---|---|
| **new** type `dynports.kit.Badge` | ✅ **immediately** — `NodeLibrary.types` 177 → 178 |
| **changed** condition on the existing `dynports.kit.Panel` | 🔴 **never** — `mode = list` on 5 polls over 30s |
| after a full editor reload + re-open | ✅ `mode = grid` |

✅ **Same file, same write, same reload, same round trip.** The only variable is *whether the editor
already knew the type name*. That rules out the file, the watcher, the transport and the reload in
one move — which no amount of polling the failing case alone could have done.

🔴 **The cause is a `TODO` sitting on the exact line.** `NodeLibraryImporter.mergeUpdates`
(`NodeLibraryImporter.ts:338-...`), per incoming node type:

```ts
if (index === -1) { …push…; updated = true; }
else {
  // TODO: Update the node data?          ← the new definition is discarded here
  …only runtimeTypes is touched…
}
```

and `updateIndex` only re-runs `NodeLibrary.instance.reload()` when
`forceUpdate || removedNodes.length > 0`. So an in-place change is dropped twice over: it is never
merged into `currentNodeLibrary`, and it would not have triggered a reload if it had been.
⚠️ `mergeInByName` further down (`:366-388`) has the mirror-image bug for the picker index — it
replaces by name but sets `updated = true` **only in the `else` branch**, with the fix commented out
directly beneath it.

⚠️ **This was already on the board.** s12 flagged `mergeInByName` as *"replaces a group wholesale by
name … wants a look"*. It wanted a look.

### O5's consequence, which is the part a user meets

With the changed condition live (`mode = grid`) and the node still at `mode = list`, the
`Item Count` port's condition is now **false** — so:

- the property panel **hides the row, and with it `Bound to App Root · Child Index`**
- the canvas, two inches to the right, **still draws the port and the wire**
- the connection is still in `connections.json`
- the runtime still delivers the value — the preview still reads `Lanes (0)`

[Screenshot](cn010-ac1-condition-changed-panel-hides-live-wire.png). **The one surface that answers
"what is driving this value?" is the one surface that stops mentioning it.** Generic to conditional
ports; only a kit can have its condition change under an open project.

---

## Part 2 — what an author actually experiences

Worth stating plainly because the two 🔴s compound in a way neither does alone:

1. You write `dynamicports` in your kit. It works — first time, no build step.
2. You tune the condition and reload. **Nothing changes.** The natural conclusion is *"dynamic ports
   don't work in kits"*, and it is false: the only broken thing is the update path.
3. If you reach for `channelPort` instead, the port does not exist anywhere, in any state, with no
   diagnostic.

---

## Part 3 — conditions

- **Fixture untouched.** Everything ran on a `cp -R` copy in the scratchpad;
  `git status packages/noodl-mcp/tests/fixtures/kit-dynports` clean at the end.
  ⚠️ Confirmation of a known trap in passing: the copy gained `.gitignore`, `.mcp.json` and
  `CLAUDE.md` purely from being opened.
- **Stack**: launched by this session (`dev:debug --quiet`), CDP on 9222, no peer stack running at
  launch (`dev:stop --list` clean, `ps` clean, paired with a positive control matching 28 Electrons
  so the zeros were attributable). Torn down with `dev:stop` — **26 processes stopped, and the 28
  peer MCP servers on this checkout survived**, which is `NEVER_SWEEP` doing its job.
- **No repo source was edited during the drive**, so no peer's `test:ci` window was contaminated.
- **`window.__wr` survived every eval** between reloads I initiated myself — the cheap evidence that
  no HMR reload silently wiped the renderer mid-measurement.
