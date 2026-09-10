/**
 * CMP-001 — the component interface playbook, as one text both clients speak.
 *
 * ## Why this file exists
 *
 * `decomposition.ts` says what BECOMES a component and has said it since
 * AAQ-008. Nothing anywhere said what to put ON one. Phase 85 measured the
 * consequence across three populations with a single instrument
 * (`measure-interfaces.py`, beside the phase-85 task): of the components in the
 * examples an agent learns from, **26%** publish any `Component Outputs` — 10% until
 * CMP-001 AC3 added four that do and repaired two rows that could not; of the
 * components the original Noodl team shipped in `library/prefabs`, **84%** do.
 * The corpus teaches a component that receives text and draws it. The library
 * teaches a two-way part. A model copying the corpus builds display sinks, and
 * the landing-page template (TPL-003) is what that looks like at scale: 233
 * nodes of page, zero section components, two of twenty components publishing
 * anything.
 *
 * ## Why it is a shared module rather than a prompt string
 *
 * AAQ-005: one authoring substrate, two clients. This module imports NOTHING,
 * which is what lets `noodl-mcp/src/editor-deps.ts` re-export it under the same
 * containment rule as `decomposition`, `design` and `backend`. It rides
 * `get_project_info` as the `interfaceDoctrine` result field for the same
 * measured reason SB-002 gives: the `instructions` surface is budgeted (8,280
 * tokens, single-digit headroom) and a result field rides free.
 *
 * ## 🔴 Every citation below was re-measured against the artefact
 *
 * Not inherited from the task file. That mattered: CMP-001 §3.1 offered
 * LearnBook's `Collapsable group` as "the exemplar worth copying whole" at 11
 * nodes and four inputs, with a `forceOpen → Inverter → pointerEventsEnabled`
 * wire described as the craft. The string `forceOpen` does not occur in any
 * `project.json` on this machine, and all four copies of that component read 9
 * nodes and two inputs (`title`, `mounted`). The wire is not real, so it is not
 * taught here — §"A flag has to reach everything it implies" makes the same
 * point out of `Form Fields/Labelled Select`, `Pagination` and `Table/* Cell`,
 * which are in this repo and are pinned by `cmp001InterfaceDoctrine.test.ts`
 * against the shipped graphs.
 *
 * ## 🔴 The AC3/AC4 floors are deliberately NOT in this text
 *
 * CMP-001 AC3 grades a build on three numbers (outputs ≥ 50%, flag port ≥ 20%,
 * States per component ≥ 0.15) and CMP-002 is a graded build that reads this
 * field. A doctrine that states its own grading thresholds is a doctrine a model
 * can satisfy by counting rather than by building, and the measurement stops
 * meaning what it says. The text carries the reasons and the wires; the floors
 * live in the task file with the instrument.
 *
 * @module AiAssistant/authoring/prompts/interfaces
 */

/**
 * The playbook as project-facing markdown, for `get_project_info` and for any
 * surface that hands an agent written rules rather than a system prompt.
 *
 * Ten patterns, each one a wire rather than a preference, and each one taken
 * from a component that ships in `library/prefabs` unless it says otherwise.
 */
export const INTERFACE_DOCTRINE_MD = `## What goes on a component's interface

You know what becomes a component. This is the other half — what its interface carries — and it is
the half that decides whether the next person can use the thing you built.

**Why this is written down.** Across the examples an agent learns from, **26%** of components publish
any \`Component Outputs\`. Across the components the original Noodl team shipped in the prefab
library, **84%** do. That gap is the whole difference between a part and a display sink: a sink takes
text, draws it in one fixed place, and tells nobody anything, so every wire it should have owned ends
up back on the page around it — including a wrapper \`Group\` whose only job is to push it into
position.

**A component someone is glad to inherit is placeable, configurable, and able to say what happened to
it.** The ten patterns below are how that is done, at wire level.

### 1. The placement contract — say how you sit in your parent
Expose your own box: \`Align X\`, \`Align Y\`, \`Margin Top/Right/Bottom/Left\`, \`Position\`,
\`Width\`, \`Mounted\`. Almost every prefab exposes exactly this block — \`Toggle Switch\`,
\`Date Picker\`, \`Tab Bar\`, \`Pagination\`, \`Rating\`. Skip it and the parent wraps every instance
in a single-child \`Group\` that exists for nothing but spacing, which is a node the page keeps
forever and a decision the component should have owned.

### 2. The controlled value — the same name arrives and leaves, plus a change signal
\`Toggle Switch\` takes \`State\` and publishes \`State\` and \`State Changed\`. \`Date Picker\`:
\`Value\` in, \`Value\` + \`Changed\` out. \`Tab Bar\`: \`Selected Tab\` in, \`Selected Tab\` +
\`Selected Tab Changed\` out. Also \`Pagination\` (\`Current Page\`), \`Rating\`,
\`Multi Select/Dropdown\` (\`Selection\` in, \`Selected Items\` + \`Changed\` out). This one pattern
accounts for most of that 84%. If your component holds a value the page might care about, publish the
value AND the signal that it moved — a parent that has to poll for it cannot use it.

### 3. The flag block — chrome and behaviour are chosen at the instance
\`Show Label\`, \`Show Summary\`, \`Show Rows Per Page\`, \`Disabled\`, \`Required\`, \`Clickable\`,
\`Removable\`, \`Mounted\`. Named \`show*\`, \`is*\`, \`has*\`, \`enable*\`. Two pages wanting the same
card with and without its footer is one component and one boolean, never two components.

### 4. The state machine is the component's brain
A \`States\` node, and three idioms:
- **Variant selector.** \`Component Inputs.<enum port> → States.currentState\`. 🔴 \`currentState\` is
  two ports sharing one name: a static string OUTPUT, and — once \`states\` is set — a generated enum
  INPUT. The input is the wire that switches a variant. Measured in \`toast\` (\`Type\`), \`xano\`
  (\`Request Type\`), \`media-query\` (\`Debugger Position\`). One \`size\` port driving a States node
  beats three components called Small, Medium and Large.
- **Boolean visual switch.** \`Condition.ontrue/onfalse → States.to-<X>/to-<Y>\`.
- **Operation lifecycle.** \`File Upload\` runs \`Idle,Picking,Uploading,Done,Failed\`; \`Auth Pages\`
  runs an Idle/Busy pair and drives the submit button's \`enabled\` from it.
⚠️ A chain of \`Condition\` nodes each setting one colour is this pattern written badly. One States
node, one input, every property it implies.

### 5. A component can be a parameter
\`Multi Select/Dropdown\` exposes \`Option Template\` and \`Pill Template\` and wires them straight
into \`For Each.template\`. The consumer supplies the component that draws the row, so the container
is written once and never again.

### 6. Polymorphic rows
\`For Each.templateType: "dynamic"\` plus a \`templateScript\` that picks the component per row from
the row's own data — \`Table/Row\` (\`component = '../' + item.Type + ' Cell'\`), \`Show Toast\`,
\`Filters\`, \`Form\`. A heterogeneous list is one repeater, not a hand-built branch per type.

### 7. The slot
\`Component Children\` marks where the consumer's children land: \`Page Header\`,
\`Table/Base Cell\`, and in production apps every modal, context menu and collapsible group. A
container that can only hold what it was built to hold is not a container. ⚠️ A slot is not an
excuse to skip the rest: \`Page Header\` still takes \`Title\`, \`Subtitle\` and
\`Breadcrumbs\` and still publishes \`Crumb Clicked\` and \`Crumb Target\`, and \`Table/Row\`
— which draws nothing of its own — publishes \`Click\`, because a row nobody can click on is a
picture of a table.

### 8. Failure is a port
\`Success\` / \`Failure\` on every cloud action component; \`Error\`, \`Failed\` and \`State\` on
\`File Upload\`; \`Has Error\` on \`Form Fields/Labelled Select\`. **Fifty-four** components in the
shipped library publish one of these. If your component can fail, its failure is an output, not a
console message — the page cannot show what it is never told.

### 9. Data-shaped inputs
One array port feeding a \`For Each\`: \`Items\`, \`Options\`, \`Headers\`, \`Filters\`,
\`Rows Per Page Options\`. Never one port per row, and never a component per row.

### 10. The named utility publishes too
\`Component Inputs\` → one or two working nodes → \`Component Outputs\`, under a name that is a job:
\`Format full name\`, \`Is Trainer check\`, \`Sanitise email\` — never \`Function 3\`, never
\`Helper\`. A logic component with no \`Component Outputs\` is a node with extra steps, because the
parent cannot read the result. Put it in a shared logic folder, not beside the page that happened to
need it first: findability is the case for extracting it and reuse is the bonus. **However small** is
meant literally — 48 of the 83 logic-only components in the shipped library are one or two working
nodes, and a production app's shared folder holds 17 of them instantiated 50 times, \`Format full
name\` alone nine times.

### A repeated row publishes to the repeater, not to nowhere
Rows end up mute because it looks as if there is nowhere to wire them: the page never places the
row, a \`For Each\` does. The repeater publishes for you. Every output port on the template
component reappears on the repeater itself — a \`signal\` as \`itemOutputSignal-<name>\`, a value as
\`itemOutput-<name>\` — beside \`itemActionItemId\`, the id of the row that raised it. Take the
trigger and the id from that same node and the write lands on exactly the row that was clicked.

🔴 **The id only moves if the signal is consumed.** A repeater tracks an item output only when
something is connected to it, so an \`itemActionItemId\` wire with no \`itemOutputSignal-…\` wire
beside it reads empty forever, and the delete that looked wired never fires.

⚠️ **A row acting on itself does not need this.** \`For Each Actions\` (\`Repeater Item\`) hands the
row its own \`itemId\` — that is what a checkbox storing \`done\` on its own record should use.
Publish when you are asking the page to act; stay internal when the target is your own record.

### A flag has to reach everything it implies
\`Form Fields/Labelled Select\` takes \`Disabled\` and does not merely grey the label — it drives the
control's own \`enabled\` through a Function, so the flag cannot be contradicted by a click.
\`Pagination\` computes \`BackEnabled\`/\`NextEnabled\` from the page it is on and disables the two
buttons that would walk off the ends. \`Table/String Cell\` takes one \`Editable\` flag and mounts the
text input from it while mounting the read-only \`Text\` from its \`Inverter\`, so the two halves can
never both be showing and never both be gone.

**A component that wires the visible half of a flag and stops has the same shape as one that works
and a bug inside it.** When you add a port, ask what else in the graph is now allowed to disagree
with it.

### Before you call a component done
- **What can the parent set?** If the answer is only text, look again at 1, 3 and 4.
- **What can the parent learn?** If nothing comes out, say why out loud. Something happened in
  there — a click, a choice, a value, a failure — and 84% of the library's components tell the page
  about it.
- **What does it do when it fails?** See 8.

### An interface is not a kitchen sink
Ports nobody sets are cost: they are rows in a panel, lines in a description, and things the next
reader has to rule out. Expose what a parent would otherwise have to work around — placement, the
variant, the flags, the value, the failure — and stop. A component used everywhere earns a long
interface (a production app's \`Clickable icon\` carries 18 inputs, 14 of them box and placement); a
component used once does not earn one by imitation. And measured honestly: in that same app's shared
logic folder, 7 of the 17 components there are used once or never. Extraction is not free, and the
case for it is that the next builder can find the thing — not that reuse is guaranteed.`;
