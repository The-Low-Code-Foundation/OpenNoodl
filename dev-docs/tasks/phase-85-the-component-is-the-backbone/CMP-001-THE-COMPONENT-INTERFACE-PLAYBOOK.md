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

⚠️ **The LearnBook column is NOT reproducible on this machine (measured 2026-09-10, session 6).**
The four copies under `~/vscode_projects/Noodl projects/` all read **100** components with an
interface, **58%** publishing outputs, mean **3.9** ports and **67** `States` nodes — not 204 / 73% /
5.0 / 146. Whatever `LearnBook v5.1 Noodl` was, it is not here, so treat that column as unverified
and cite the two columns that re-measure exactly (corpus **10%**, prefabs **84%** — both reproduced
with `measure-interfaces.py` on 2026-09-10). See §3.1.

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

## 3. The ten patterns, with citations

Each is a wire-level shape, taken from `library/prefabs/*/project/project.json` and
`LearnBook v5.1 Noodl/project.json`. P1–P9 were mined 2026-09-09; **P10 was added 2026-09-10**
and is owned by [CMP-003](CMP-003-LOGIC-COMPONENTS.md).

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

🔴 **The variant selector could not be discovered from any MCP tool until 2026-09-10.** See §4.

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

### P10 — The named utility
🔴 **Added 2026-09-10 by CMP-003, and it is the only pattern here that came from correcting a rule
rather than from reading a graph.** A small piece of thinking with a name, in a shared folder:
`Component Inputs` → one or two working nodes → `Component Outputs`. LearnBook's two shared logic
folders hold **37** of them, instantiated **107** times — `Is Trainer check` (9×, one working node),
`Generate Google icon object` (9×, one working node), `Format full name` (9×). **45 of the 80
logic-only components in `library/prefabs` are one or two working nodes.**

The three rules that make it a pattern rather than an excuse to make files:

1. **The name is a job**, imperative or a check — `Format full name`, `Is Trainer check`,
   `Sanitise email`. Never `Function 3`, never `Helper`.
2. **It publishes.** A logic component with no `Component Outputs` is a node with extra steps; the
   parent has to be able to read the result. This is P8/P2 applied to something with no pixels.
3. **It lives in a shared folder, not beside a page** — that is what makes it findable by the next
   builder, which is the case for extracting it. Reuse is the bonus.

⚠️ **Measured against itself** (⚠️ on the v5.1 copy — the LearnBook here reads **17** shared
logic components instantiated **50** times, 7 of them used 0 or 1 times, and 48 of the 83
logic-only prefabs are one or two working nodes): 17 of LearnBook's 37 are used 0 or 1 times, so extraction is not
free and not always repaid in reuse. It is still right at one use, for the findability reason — but
a model should hear the honest version, not a rule that promises reuse it will not always get.

### 3.1 🔴 THE EXEMPLAR WAS NOT REAL — corrected 2026-09-10 (session 6)

⚠️ **What this section said until now does not exist in any artefact on this machine**, and it was
about to ship into the doctrine as "the craft". Kept below the correction, because the correction is
the finding.

**Claimed:** `LearnBook /Global visual components/Collapsable group` at **11 nodes, 4 inputs**
(`title, mounted, showIcon, forceOpen`), with `forceOpen → Inverter → Group.pointerEventsEnabled`
called *"the third wire"*.

**Measured**, across all four copies of LearnBook under `~/vscode_projects/Noodl projects/`
(`LearnBook`, `LearnBook test`, `LB copy backup`, and the one under a project UUID) — every one of
them reads:

```
Group                                     9 nodes, 2 inputs, 0 outputs
  Group [Header] → Text [Title], Icon
  Group [Expandable group] → Component Children      ← P7, the slot
States  (collapsed,opened)                           ← P4
JavaScriptFunction [Convert to icon object]
Component Inputs → title, mounted

States.expand → Group [Expandable group].mounted     (boolean value)
States.icon   → JS → Icon.iconIconSource             (string value, same state machine)
Group.onClick → States.toggle
Component Inputs.title  → Text.text
Component Inputs.mounted → Group.mounted
```

🔴 **`forceOpen` does not occur in any `project.json` on this machine** (`grep -rl forceOpen
--include=project.json ~/vscode_projects` is empty, and the same grep for `Collapsable group` finds
four files, so the search works). Neither does the `Inverter`, the `Expression`, or `showIcon`. The
LearnBook this repo can reach is **not** the `v5.1` the §2 table was measured from either: it reads
**100** components with an interface, **58%** publishing outputs and `Clickable icon` at **18**
inputs, against §2's 204 / 73% / 19.

**What the real component teaches** is still worth having, and it is not what §3.1 claimed: one
`States` node driving **two properties of two different types** (a boolean `mounted` and a string
that becomes an icon), a slot for the consumer's children — **and no `Component Outputs` at all**,
so a parent cannot ask whether it is open. Its sibling `Collapsable menu title` publishes exactly
that (`current state`). The exemplar is an example of the 84%/10% gap, not an exception to it.

✅ **The shipped doctrine teaches the same lesson from artefacts in THIS repo**, under §"A flag has
to reach everything it implies": `Form Fields/Labelled Select` (`Disabled` → Function → the
control's own `enabled`), `Pagination` (`BackEnabled`/`NextEnabled` disable the two buttons that
would walk off the ends) and `Table/String Cell` (one `Editable` flag mounts the input, its
`Inverter` mounts the read-only text). All three are pinned wire-by-wire by
`packages/noodl-mcp/tests/cmp001InterfaceDoctrine.test.ts`.

**Generalises — and it is the fifth time in this phase.** A citation written into a task file is a
claim, not a measurement, and this one survived four sessions and two ✅ rows because every reader
after the first inherited it. See
`[[measure-the-artefact-before-believing-the-task-file]]`.

## 4. ✅ FIXED 2026-09-10 — the catalog defect that blocked P4

⚠️ Read §4.1 before §4: the diagnosis below is the one filed on 2026-09-09 and its first
sentence is wrong. Kept verbatim because the correction is the interesting part.

`States.currentState` is **two ports sharing one name**:

- `noodl-viewer-react/src/nodes/std-library/states.ts:331` — a static string **output**.
- `:1027` — a runtime-generated **enum input** (`plug: 'input'`, `type: {name: 'enum', enums: states}`)
  that exists only once `states` is set.

The catalog documents only the output *(🔴 not true — see §4.1)*. `node-catalog-enriched.json` → `States.enrichment.ports.currentState`
reads *"String output with the active state's name"*, and the `dynamicPorts` note says states
generate *"an activation signal input and reached/left signal outputs"* — never the enum input.

**Consequence:** a model reading `get_node_type("States")` concludes the only way to select a state
is one signal per state, so a `size` input needs three ports and a Condition chain. The one-wire form
the original team used four times, and Richard used in `Badge`, is invisible.

### 4.1 🔴 Corrected 2026-09-10, measured on the live server before any edit

**"The catalog documents only the output" is not true, and the truth is worse.** The enrichment's
`runtimeBehavior` prose has always carried one clause — *"A generated enum input `currentState` sets
the state by name"* — and `runtimeBehavior` travels with the DEFAULT summary response, so it reached
every reader. What made the port undiscoverable was not absence but **four-to-one contradiction**:

| surface | what it said before 2026-09-10 |
|---|---|
| the `ports` list (the scannable index) | `out currentState: string` — no input |
| `ports: ["currentState"]`, the cheapest targeted question | *"String output with the active state's name"* — complete-looking, one-directional |
| `dynamicPorts.description` | states get *"an activation signal input and reached/left signal outputs"* — and there has never been a `left-` port either |
| `runtimeBehavior`, closing sentence | *"An authoring tool should… **wire signals to `to-S`**"* — the other form, named as the instruction, one sentence after the enum clause |
| `antiPatterns` | `currentState` only as a string to READ |
| `runtimeBehavior`, mid-paragraph | the one clause naming the enum input |

⚠️ **The general lesson is the one worth keeping.** A model does not weigh five statements and pick
the true one; it follows the instruction nearest the thing it is about to do. A fact stated once in
prose and contradicted by the surrounding advice is not documented — and a check that asks only
*"does the response contain the string `currentState`?"* would have passed on the shipped text. Richard found it
because the enum port is visible in the editor's property panel.

⚠️ The rest of the States enrichment is good — `whenToUse` is present on 176/176 nodes and States'
is accurate. This is one port, not a documentation gap.

## 5. Acceptance criteria

**AC1 — the enum input is documented.** ✅ **DONE, 2026-09-10.** `get_node_type("States")` reports
`currentState` as both an output and a dynamically-generated enum input, and the `dynamicPorts`
description names it. Measured by reading the tool response, not the source —
`packages/noodl-mcp/tests/phase85Doctrine.test.ts`, four assertions over a real server.

Changed: `docs/node-catalog/enrichment/states.json` (the port description now states BOTH
directions; the closing authoring sentence now names both forms and when each applies; a P4 pattern
and the Condition-chain anti-pattern added) and `scripts/node-catalog/lib/dynamic-port-notes.js`
(the enum input named, and the phantom `left-<state>` output removed). Both artefacts regenerated
with `catalog:generate` + `catalog:merge`; both `--check` gates green. `docs-site` page regenerated
for this node only — 28 other pages were ALREADY stale at HEAD and folding them in would have been
an unperformed merge.

⚠️ The `patterns` / `antiPatterns` half of that edit reaches a PERSON, not an agent:
`get_node_type` emits neither field at any detail level. Filed in README §7, owner NONE.

**AC2 — the playbook ships where a model reads it.** ✅ **DONE, 2026-09-10 (session 6).** The ten
patterns ride `get_project_info` as a fifth doctrine field, `interfaceDoctrine`, directly after
`authoringDoctrine` — the two are one decision and the second half is the one that gets skipped.

- **The text**: `packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/prompts/interfaces.ts`
  (`INTERFACE_DOCTRINE_MD`, 7.5 KB), a shared module that imports nothing, re-exported through
  `noodl-mcp/src/editor-deps.ts` under the same containment rule as `decomposition` / `design` /
  `backend`. One substrate, two clients — the in-editor loop can consume it without a second dialect.
- **The wire**: `tools/read.ts` ships it read-write only; `ProjectInfoResponse.interfaceDoctrine`
  declares it. The resident instruction surface is **8,275 / 8,280 — unchanged**, because a result
  field rides free. The `get_project_info` payload grows 38,287 → **45,830 chars** (+20%), which is
  the honest cost of the channel.
- **Armed by**: `packages/noodl-mcp/tests/cmp001InterfaceDoctrine.test.ts`, 20 specs, two halves —
  (a) the text ARRIVES (asserted on the received field over a real server, length-bounded, absent
  read-only), and (b) 🔴 every component, port, state list, wire and percentage the text cites is
  **re-derived from the real shelf and the real enriched catalog** and asserted on both sides. Four
  controls run red: field removed from `read.ts` (16/20), module blanked (19/20 — the survivor is
  the meta-spec that grades the claim table), a cited port renamed in the text only (2 red), a
  percentage literal bumped (1 red).
- 🔴 **The AC3/AC4 floors are deliberately NOT in the shipped text**, and a spec asserts their
  absence (beside a known-firing anchor). CMP-002 is a graded build that reads this field; a
  doctrine that states its own thresholds can be satisfied by counting.
- ⚠️ **What it does NOT do:** the in-editor authoring and planning prompts do not include it yet
  (`decomposition.ts` has three copies of its own doctrine and this text is deliberately not a
  fourth). Cross-referencing it from `DECOMPOSITION_DOCTRINE_MD` was left alone this session because
  a peer was live in `packages/noodl-editor` and that string is pinned by editor-side suites.
  Follow-up, owner NONE.

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
