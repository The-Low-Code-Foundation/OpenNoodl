# CN-012 — the measurement pass (s24, 2026-08-18)

🔴 **Predictions written BEFORE running anything.** CN-012's own spec says the logic half is
"inherited, plausible, and completely unexercised", and the phase rule is *build the caller*. The
caller is `noodl_modules/tally-kit` — a kit with `nodes` and **no `reactNodes` at all**, three nodes
covering the three claims (receive a signal + hold state + emit a value and a signal · receive a
signal *from another kit node* · `runOnValueChange`).

Fixture: a scratchpad project, `logic-kit-project`, wiring
`Group.didMount → Accumulator.add`, `Accumulator.total → Text.text`,
`Accumulator.totalChanged → Stamp.mark`, `Stamp.label → Text.text`, `Gauge.output → Text.text`,
with `step = 7` and `reading = 42` set as parameters.

## Predicted (before measuring)

| # | Claim | Prediction | Why I might be wrong |
|---|---|---|---|
| M1 | A logic-only kit registers | **Yes** — `registerModule` loops `module.nodes` unconditionally and `viewer.jsx`'s `reactNodes` branch is guarded | `defineNode` throws without `category`; nothing else in the phase has supplied one from a kit |
| M3a | `Accumulator.total` reaches the Text | **Yes**, reads `7` | `flagOutputDirty` on a signal never fires (recorded trap) — that trap is about *signals*, so the value may arrive and the signal may not |
| M3b | `Accumulator.totalChanged → Stamp.mark` fires | **Yes**, reads `marked 1` | if it reads `marked 0` the signal never left the kit node |
| M3c | `Gauge.output` reads `42` | **Yes** | `runOnValueChange` synthesises `runOnChange-reading`; a kit that never sets it may publish nothing |
| M4 | It runs in the cloud runtime | **No** — `noodl-viewer-cloud/src` has no `registerModule` call | the deploy/bundle path may register elsewhere |
| M5 | The catalog overlay carries it | **Yes**, but with `category: 'Math'` where CN-003 was designed against visual nodes | `availableIn` / `inNodePicker` may be visual-only |

🔴 **The one that would be a false pass:** every Text reading its *parameter* rather than the
connection. `TOTAL-UNSET` / `STAMP-UNSET` / `GAUGE-UNSET` are the parameters, so the readout names
its own failure — a Text that reads `TOTAL-UNSET` proves the connection did nothing, and no reading
is ambiguous between "worked" and "was never wired".

## Measured

_(filled in below, as each runs)_

### M1 — a logic-only kit registers. ✅ Prediction held.

Real extractor (`kitExtract/entry.js`, bundled to a **scratch** path with esbuild — never over
`packages/noodl-mcp/dist/`, which peers' registered servers load):

```
kits:     [{"kitModule":"Tally Kit","dirPath":"noodl_modules/tally-kit"}]
failures: []   warnings: []   moduleRuntimes: {"Tally Kit":["browser"]}
nodetypes: 3
  tally.kit.Accumulator | cat: Math | module: Tally Kit | color: data | 2 in / 2 out
  tally.kit.Stamp       | cat: Math | module: Tally Kit | color: data | 1 in / 1 out
  tally.kit.Gauge       | cat: Math | module: Tally Kit | color: data | 3 in / 2 out
```

`registerModule` loops `module.nodes` with no visual assumption anywhere, and `viewer.jsx`'s
`reactNodes` branch is guarded — so a module supplying **only** `nodes` takes the same path a
built-in does. `category` is required by `defineNode` and a kit supplies it like anyone else.

✅ **`runOnValueChange` synthesis works from a kit.** Gauge's third input is
`runOnChange-reading`, `boolean`, `allowEditOnly`, group `Run On Value Change`, `default: true`,
carrying the runtime's own description — the whole NDA-017 mechanism, unmodified, on a kit node.

### M5 — the catalog overlay handles a logic node. ✅ Prediction held.

`catalogNodesFromNodeLibrary` on the same payload: `isVisual: false`, `inNodePicker: true`,
`availableIn: ["browser"]`, `providedBy: "project-kit"`, `kitModule: "Tally Kit"`, no
`allowAsChild` / `allowAsExportRoot` (both correctly follow `isVisual`), signals marked
`isSignal: true` on both plugs, `collisions: []`. **Nothing about the overlay is visual-only** —
`isVisual = category === 'Visual'` is the only branch and a logic node takes the false arm cleanly.

### M3 — signals and values work end to end. ✅ Prediction held (after one authoring correction).

Real Chromium, `withRenderedPage` over the working-tree viewer bundle:

```
TEXT NODES  : ["7","marked 1","42"]
MODULES     : [{"nodes":3,"reactNodes":0}]
FAILURES    : []      CONSOLE ERR : []
```

- `7` — `Group.didMount` (a **built-in visual** node's signal) reached a **kit logic** node's
  `add`, state was held across the call, and `flagOutputDirty('total')` published the value.
- `marked 1` — the kit node's own `sendSignalOnOutput('totalChanged')` reached **another kit logic
  node's** signal input, which published a value of its own. A kit-to-kit signal edge works.
- `42` — see below.

🔴 **`Gauge` read `0`, not `42`, on the first run, and it was MY kit that was wrong.**
`runOnValueChange` synthesises the checkbox **port**; obeying it is the author's, exactly as every
built-in in the class does it (`if (this.shouldRunOnValueChange(name)) …`). The first draft's
setter stored the value and flagged nothing, so the Text held the `0` that `connectInput` pushed at
boot — *"a node that has never evaluated reports a confident 0"*, which is constraint 4 in
`run-on-value-change.ts`' own header. Adding the guard turned it into `42` in the same fixture.
⚠️ **Worth keeping as a finding about the documentation, not the runtime**: the declaration reads
as if it wires itself, and nothing tells an author otherwise — CN-005's provisional types describe
`runOnValueChange` without mentioning `shouldRunOnValueChange` at all.

### M4 — the cloud runtime. 🔴 Prediction held, and the shape of it is the headline.

Built the caller: `CloudRunner` + a cloud function graph `request → <node> → response`, 1500 ms bound.

| Arm | Result |
|---|---|
| **kit logic node, as shipped** | ⏱ **`CloudFunctionTimeoutError` — never answers** |
| **built-in `Counter`, same graph shape** (control) | ✅ `200 {"result":{}}` |
| **kit logic node, after calling `runtime.registerModule` by hand** | ✅ `200 {"result":{}}` |

🔴 **The runtime is not the blocker — there is simply no caller.** `NoodlRuntime.registerModule`
works perfectly in the cloud runtime; the kit node registers, runs and answers. What does not exist
is anything that calls it: `CloudRunner`'s constructor calls `registerNodes` only, and `load()`
takes `(exportData, projectSettings)` — **there is no parameter a module could arrive through.**

🔴 **The failure mode is a HANG, not an error.** This is CWF-018's second confirmed instance: an
unregistered type is logged and skipped by `NodeScope`, its connections are dropped, and the graph
runs with the chain cut. Without CWF-018's timeout the socket would be held open.

### M4b — `runtimes: ["cloud"]` makes a kit run NOWHERE. 🔴 Not predicted; worse than predicted.

Same kit, same graph, manifest changed to `"runtimes": ["cloud"]`, rendered in the same browser:

```
TEXT NODES  : ["TOTAL-UNSET","STAMP-UNSET","GAUGE-UNSET"]
MODULES     : []
CONSOLE ERR : ["Can't find component model for tally.kit.Accumulator", … , "Unknown node id acc", …]
```

`buildInjectionTags` filters on `runtimes.indexOf('browser') !== -1`, so the kit is **removed from
the page** — and nothing loads it server-side either. **The field's only positive value takes the
kit out of the one runtime that would have run it.** That is CN-012's own predicted "misleading
rather than merely unimplemented", measured.

⚠️ **And it is silent.** `FAILURES: null` — CN-015's capture preamble is emitted lazily, only when
at least one browser module script is injected, so a project whose every kit was filtered out
carries **no capture window at all**. A kit that vanished this way cannot be named by the mechanism
built to name vanished kits.

📊 **Census, because the field's blast radius depends on who uses it:** of the 40 `manifest.json`
files under a `noodl_modules/` in this repo — all 29 shipped library modules, the starter project's
two, the example projects', and the test fixtures' — **not one shipped module declares `runtimes` at
all**; the only declarations are two test fixtures saying `["browser"]`. ✅ **The scaffold writes no
`runtimes` field either.** So the field is entirely aspirational today, and nothing on disk breaks
if its meaning is settled now.

### Found in passing, and NOT a CN-012 finding — the harness's own bootstrap

🔴 **`render-from-disk.js` hand-writes a `Noodl.defineModule` shim that is missing CN-003's name
adoption**, so in the harness every kit node registers as `Unknown Module`:

```
__noodl_module_name: "Tally Kit"        <- the injector DID write the marker
module.name        : [null]             <- the shim never reads it
stamped module     : ["tally.kit.Accumulator -> Unknown Module", …]
```

✅ **Control: identical on the VISUAL `kit-dynports` fixture** (`"Dynports Kit"` → three
`Unknown Module`s), so this is the harness, not the logic half. All three product bootstraps
(`static/deploy/index.js`, `static/ssr/runtime-globals.js`, the editor's viewer `index.html`) carry
the adoption; `render-from-disk.js:406` is the fourth copy and the only one without it. ⚠️ **Nothing
reads the stamp in the harness today** (`render-report.js` never touches `.module`), so this is
latent rather than biting — but it is CN-001's instrument disagreeing with the product about the
exact fact CN-003 was written to fix, and it is the instrument UNI-010's F4 grades with.

---

## M2 — the editor. Observations written down BEFORE the launch.

The one claim left. Everything above ran headless or in a bare Chromium; **whether an author can
find a logic kit node and place it** is only answerable in the editor. CN-012 item 2 asks three
things and I am writing what each would look like both ways first, because "it looked fine" is what
a drive that measures nothing produces.

Fixture: a `cp -R` of the scratchpad `logic-kit-project` into `NodeGX test projects/cn012-drive`
(never the repo, never a real project — ⚠️ opening a project WRITES three files into it).

| # | Observation | Met looks like | NOT met looks like |
|---|---|---|---|
| O1 | The three kit types reach the editor's node library | `Tally Kit`'s three types present, `module: 'Tally Kit'` on each | absent, or present under `Unknown Module` |
| O2 | Category is honoured, not forced to Visual | the picker lists them under a **non-Visual** heading | filed under Visual, or under no heading |
| O3 | A logic kit node can be **placed**, like an `Expression` | the node appears on canvas with its declared ports | refused, or placed with no ports |
| O4 | Its ports are the author's, plus the class's | `Add`/`Step` in, `Total`/`Total Changed` out; Gauge additionally shows the `Run On Value Change` checkbox | the runtime's visual base set appears on a node that has no visual half |
| O5 | 🔴 The **control**: a built-in logic node in the same picker | `Counter` present and visual-free the same way | if the built-in also looks wrong, O2–O4 are about the editor, not about kits |

🔴 **O5 is the one that stops this drive proving the wrong thing.** Every other row could be
satisfied by an editor that treats *all* logic nodes identically well or identically badly; without
a built-in in the same reading, a defect in the editor's logic-node handling would be filed as a
kit defect.

⚠️ **Instrument traps already recorded and expected to bite here:** `BaseDialog` renders every
dialog twice (filter `:not([class*=MeasuringContainer])`), `ed.selection` does not exist (it is
`ed.selector._selected`), and `node.setParameter()` does not re-render the property panel.

### M2 measured — the editor. ✅ Four of five met outright; one instrument was dead.

Live editor (`dev:debug --quiet`, CDP 9222), project `cn012-drive` opened through
`LocalProjectsModel.openProjectFromFolder` and then the real launcher card.

| # | Result |
|---|---|
| **O1** | ✅ All three types in the library, each `module: "Tally Kit"` — **not** `Unknown Module` |
| **O2** | ✅ `category: "Math"`, `color: "data"` — the author's category survives; nothing forces Visual |
| **O3** | ✅ Placed on canvas; the type **resolved** (not the unknown-type placeholder) and carried its declared ports. Control `Counter` placed identically |
| **O4** | ✅ Exactly the author's ports and no more — Accumulator `add`/`step` → `total`/`totalChanged`; Gauge additionally shows `runOnChange-reading` |
| **O5** | ✅ Control: built-in `Counter` reads the same way — `Math`, no visual ports, ports resolved |

🔴 **O4 is the row worth keeping, and it is a contrast with the visual half.** CN-008 found that
the runtime's base set takes `demo.kit.Badge` from 12 in / 9 out down to the 8 and 1 its author
declared. **A logic kit node gets no base set at all** — what the author wrote is exactly what the
editor shows, which is why the port lists above are so short. The `runOnChange-reading` checkbox is
the only synthesised port, and it is the one the author asked for by declaring `runOnValueChange`.

⚠️ **`WarningsModel` is dead for this question and I proved it rather than trusting the zero.** It
read `0`, which is what a healthy canvas looks like — and also what it reads with a node of type
`ThisTypeDoesNotExistAnywhere` sitting on the same canvas, which I added as a live control and then
removed. **Third confirmation of the recorded trap.** So "the editor raises no warning about a logic
kit node" is recorded as **unmeasured, not silent**.

⚠️ **Not measured: the property panel's rendering** of these ports. Nothing was selected and this
build exposes no `NodeGraphEditor` singleton to select through; the model-level reading above is
what determines what the panel *can* show, and CN-010 s19 already drove a kit's panel rows live.

⚠️ **Instrument note:** `openProjectFromFolder` returns the model but does not move the UI, and the
editor had already read `recently_opened_project.json` before I edited it — so the store edit did
nothing and the launcher card click is what actually opened the project.
