# CMP-001 — The component interface playbook

🔴 **The decomposition doctrine already says to make the component. Nothing anywhere says what to
put on its interface.** That second half is what separates the library the original Noodl team
shipped from what the MCP builds today, and it is missing from every surface a model reads.

## 1. The person sentence

> "Clever components are one of the backbones of why using Noodl was good. You're as close to a
> 'real developer' as possible in terms of separation of concerns and reusing as much as possible
> instead of writing everything from scratch, the difference between code that can be easily handed
> off to another developer and code that's an indecipherable mess." — Richard, 2026-09-09

**An agent building a page produces components another person would be glad to inherit: each one
placeable, configurable, and able to report what happened to it — not a display sink that renders
one fixed thing in one fixed place.**

## 2. What was measured

Three populations, one script, identical classification. Ports are derived from connections out of
`Component Inputs` / into `Component Outputs` — the same derivation `componentInterfaces()` uses.

| | MCP corpus (67 examples) | Noodl prefabs (42 entries) | LearnBook (production app) |
|---|---|---|---|
| components with `Component Inputs` | 30 | 124 | 204 |
| **mean ports per component** | **2.2** | **4.4** | **5.0** |
| carry a variant port (colour/size/style/box) | 1 (3%) | 20 (16%) | 36 (18%) |
| carry a flag port (`show*`/`is*`/`enable*`) | 1 (3%) | 26 (21%) | 40 (20%) |
| **publish any `Component Outputs`** | **3 (10%)** | **104 (84%)** | **148 (73%)** |
| `States` nodes | 1 | 28 | 146 |
| `Expression` nodes | 6 | 16 | 341 |
| `Component Children` (slot) | 1 | 2 | 7 |

🔴 **The 10% / 84% row is the finding.** The corpus teaches components that receive text and draw
it. The prefabs and the production app teach components that are two-way parts.

### 2.1 What shipped as a result

The landing-page template (`landing-pages.content.json`, TPL-003, embedded 2026-09-05) — built
through this MCP, and the first thing a new user meets:

```
/Pages/Freelancer  63 nodes    /Pages/Business  72 nodes    /Pages/Launch  98 nodes
```

233 nodes of page, **zero section components**. Of 20 authored components, **2** publish outputs
(`Site/Field.text`, `Site/Plan.chosen`); **3** accept a colour; **none** accepts a size, a variant,
or a visibility flag.

Richard rebuilt `/Pages/Freelancer` by hand in the editor on 2026-09-09. It is **13 nodes** over six
section components, and his `Visual components/Badge` takes seven inputs — `icon`, `text`,
`fontColour`, `backgroundColour`, `borderColour`, `size`, `showIcon` — with `size` driving a `States`
node. Signature-matching every subtree in the project shows his `Recent work group`, `What I Do
group` and `Testimonials group` are **structurally identical** to the sections inlined in
`Pages/Business`. He did not redesign; he cut at a boundary that was already there.

### 2.2 🔴 The extraction half is not a missing doctrine

`DECOMPOSITION_DOCTRINE_MD` (`prompts/decomposition.ts:143`) ships in `get_project_info` and says:

> **A named section is a component.** Hero, nav, card, form, footer, filter bar. If you would name it
> out loud, it gets its own component and the page instantiates it.
>
> **Rule of thumb.** A component graph past ~25 nodes is telling you it wanted to be several.

And the corpus's own worked example, `ui-landing-page`, described as *"THE WORKED PAGE… the thing to
copy when the brief is 'a landing page'"*, is `/Pages/Home` at **9 nodes** over eight `/Sections/*`
components — the shape Richard rebuilt by hand.

So TPL-003 had the rule, had the canonical example, had `instantiates` in the plan schema, and
produced pages at **3-4× the stated threshold** with zero sections. **Extraction needs a
compliance measurement, not more prose.** This task owns the interface half; the extraction half is
CMP-002 and must begin by reproducing the failure, not by writing another paragraph.

## 3. The nine patterns, with citations

Each is a wire-level shape, taken from `library/prefabs/*/project/project.json` and
`LearnBook v5.1 Noodl/project.json`.

### P1 — The placement contract
A reusable visual component says how it sits in its parent. Almost every prefab exposes the same
block: `Align X`, `Align Y`, `Margin Top/Right/Bottom/Left`, `Position`, `Width`, `Mounted`.
LearnBook's `Clickable icon` exposes 19 inputs of which 13 are placement and box.

🔴 **This is why the template wraps things.** Every column child in `Pages/Business` sits inside a
single-child `Group` that exists only to size and space it — because `Site/PhotoCard` exposes
`alt, line, picture, title` and nothing about its own box. The wrapper does what the component's own
ports should have done.

### P2 — The controlled-value contract
The same name arrives and leaves, plus a change signal. `Toggle Switch`: `State` in → `State` +
`State Changed` out. Also `Date Picker` (`Value`), `Tab Bar` (`Selected Tab`), `Pagination`
(`Current Page`), `Time Picker`, `Rating`, `Filters`, `Multi Select`. This single pattern accounts
for most of the 84%.

### P3 — The flag block
`Show Label`, `Show Summary`, `Show Rows Per Page`, `Show Details`, `Clickable`, `Removable`,
`Disabled`, `Required`, `Enable Clip`, `Enable Pinch Zooming`, `Circular Mask`, `Private`,
`showPagination`, `showSearch`, `showTabs`, `mounted`. Behaviour and chrome chosen at the instance.

### P4 — The state machine as the component's brain
Three distinct idioms, all `States`:

- **Variant selector** — `Component Inputs.<enum> → States.currentState`. Measured in `toast`
  (`Type`), `xano` (`Request Type`, `Auth Token Storage`), `media-query` (`Debugger Position`), and
  in Richard's `Badge` (`size`). Also fed from `Expression.result` (`tab-bar`, `stripe/Plan`) and
  `JavaScriptFunction` (`table/Header Cell`).
- **Boolean visual switch** — `Condition.ontrue/onfalse → States.to-<X>/to-<Y>`. `app-shell/Nav
  Item`, `navigation-menu/Item`, `multi-select/Pills/Item`, `rating/Rating Star Item`.
- **Operation lifecycle** — `file-upload` (Idle/Picking/Uploading/Done/Failed), `auth-pages`
  (Idle/Busy, Shown/Hidden) driven from `done`/`failure` signals.

🔴 **The variant selector cannot be discovered from any MCP tool.** See §4.

### P5 — Dependency injection: a component as a parameter
`multi-select/Dropdown` wires `Component Inputs.Pill Template → For Each.template` and
`Component Inputs.Option Template → For Each.template`. The consumer supplies the component that
draws the row.

### P6 — Polymorphic rows
`For Each.templateType: "dynamic"` plus a `templateScript` that picks the component per row from the
row's own data:

```js
// table/Row
if (item.Type !== undefined) component = '../' + item.Type + ' Cell'
// toast/Toast Component
component = '../' + item.Type;
```

### P7 — The slot
`Component Children` marks where the consumer's children land: `Popup modal template`,
`Collapsable group`, `Context menu`, `Drag and resize group`, `Left menu`.

### P8 — Failure is a port
`Success`/`Failure` on every Stripe and Directus action component; `Error`/`Failed`/`State` on
`file-upload`; `Has Error` on `Form Fields/Labelled Select`; `Have Errors` on `/Form`.

### P9 — Data-shaped inputs
`Items`, `Options`, `Headers`, `Controls`, `Filters`, `menuItems`, `cardList` — one array port
feeding a `For Each`, never one port per row.

### 3.1 The exemplar worth copying whole

`LearnBook /Global visual components/Collapsable group` — 11 nodes, 4 inputs, and every one of them
carries its weight:

```
Group
  Group [Header] → Text [Title], Icon
  Group [Expandable group] → Component Children      ← P7, the slot
States                                                ← P4, two values of two types
Component Inputs → title, mounted, showIcon, forceOpen

States.expand → Group.mounted            (boolean value)
States.icon   → JS → Icon.iconIconSource (string value, same state machine)
Group.onClick → States.toggle
Component Inputs.showIcon  → Icon.mounted
Component Inputs.forceOpen → Group.mounted
Component Inputs.forceOpen → Expression → States.to-opened
Component Inputs.forceOpen → Inverter → Group.pointerEventsEnabled   ← 🔴
```

That last wire is the craft: when the group is forced open, the header **stops being clickable**, so
the flag cannot be contradicted by a user click. A model that emits `forceOpen → mounted` and stops
has built the same component with a bug in it. **The playbook has to teach the third wire, not just
the port.**

## 4. 🔴 The product defect that blocks P4

`States.currentState` is **two ports sharing one name**:

- `noodl-viewer-react/src/nodes/std-library/states.ts:331` — a static string **output**.
- `:1027` — a runtime-generated **enum input** (`plug: 'input'`, `type: {name: 'enum', enums: states}`)
  that exists only once `states` is set.

The catalog documents only the output. `node-catalog-enriched.json` → `States.enrichment.ports.currentState`
reads *"String output with the active state's name"*, and the `dynamicPorts` note says states
generate *"an activation signal input and reached/left signal outputs"* — never the enum input.

**Consequence:** a model reading `get_node_type("States")` concludes the only way to select a state
is one signal per state, so a `size` input needs three ports and a Condition chain. The one-wire form
the original team used four times, and Richard used in `Badge`, is invisible. Richard found it
because the enum port is visible in the editor's property panel.

⚠️ The rest of the States enrichment is good — `whenToUse` is present on 176/176 nodes and States'
is accurate. This is one port, not a documentation gap.

## 5. Acceptance criteria

**AC1 — the enum input is documented.** `get_node_type("States")` reports `currentState` as both an
output and a dynamically-generated enum input, and the `dynamicPorts` description names it.
Measured by reading the tool response, not the source.

**AC2 — the playbook ships where a model reads it.** The nine patterns become a fifth doctrine field
alongside `authoringTraps` / `authoringDoctrine` / `designDoctrine` / `backendDoctrine` in
`get_project_info` (`tools/read.ts:157-175`) — a response field, **outside** the 8,280-token
instruction budget (`toolDisclosure.test.ts:83`), which has 6 tokens of headroom and must not be
touched. Armed by a test that fails if the field is absent when `allowWrites` is true.

**AC3 — the corpus stops teaching content-only components.** At least four new examples, each
demonstrating one pattern at wire level: a variant selector (P4 + the `currentState` wire), a
controlled value (P2), a slot (P7), and a placement contract (P1).

🔴 **Graded on the three metrics that actually separate the arms, not on port count.** Measured
2026-09-09 against the shipped template, which is the arm any new work has to beat:

| metric | shipped template | corpus today | prefabs | floor |
|---|---|---|---|---|
| mean ports/component | **3.4** | 2.2 | 4.4 | — **rejected, see below** |
| carries a variant port | **14%** | 3% | 16% | — **rejected, see below** |
| **publishes outputs** | **14%** | 10% | 84% | **≥ 50%** |
| **carries a flag port** | **0%** | 3% | 21% | **≥ 20%** |
| **`States` per component** | **0.00** | 0.03 | 0.23 | **≥ 0.15** |

⚠️ **Two obvious metrics were rejected after measuring them.** *Mean ports* does not discriminate:
the template sits at 3.4 because `/Site/Plan` alone carries ten ports, so a floor of 3.5 would have
been **green before any work was done**. *Variant port* does not discriminate either: the regex
catches `/Site/Plan`'s `edge`/`ground`/`ink` and `/Site/Stat.color`, so the template scores 14%
against the prefabs' 16%. The template's leaves are not the weak part — **the missing outputs, flags
and state machines are**, and those three separate 14/0/0.00 from 84/21/0.23 cleanly.

**AC4 — a built page shows it.** A fresh MCP build of one business landing page (CMP-002) clears
AC3's three floors, graded by the same script with the shipped template as the reverted arm.

🔴 **AC3 and AC4 are graded by the same script on the same fields.** A doctrine that raises the
corpus but not the built page has not been followed — that is the TPL-003 failure repeating, and it
is the thing this phase exists to catch.

## 6. What this task does not own

- **Extraction / section boundaries** — CMP-002. The doctrine exists; what is missing is a
  measurement of whether it is followed, and that measurement must come from a fresh build.
- **The `Options` control's collapsing border**, the `table` column-width defect, and the four other
  product defects the prefab audit found — already filed in `library/prefabs/AUDIT.md`, owner NONE.

## 7. Instrument

`measure-interfaces.py`, committed beside this task — one script, four dialects, so no arm is graded
by a pass written for it. Reproduces every number in §2 and §AC3:

```
./measure-interfaces.py corpus packages/noodl-types/src/node-catalog-enriched.json
./measure-interfaces.py legacy "library/prefabs/*/project/project.json"
./measure-interfaces.py legacy ".../templates/landing-pages.content.json"   # the reverted arm
./measure-interfaces.py v2     ".../a built project/components"             # AC4
```

Ports
derived from connections into/out of `Component Inputs`/`Component Outputs` nodes; variant regex
`colou?r|size|variant|theme|tone|style|kind|shape|width|height|margin|padding|gap|radius|weight|align|font|opacity`;
flag regex `^(show|hide|use|is|has|can|enable|disable|allow|visible|open|active|checked|selected|disabled|readonly|required|loading)`.
