# Defects building spine lesson 2 found

**Opened 2026-09-05 while building [SYL-005](SYL-005-LESSON-2-IT-BREAKS-ON-A-PHONE.md).** Every row
is a finding about the *product or the lesson tooling*, not about lesson 2 — lesson 2 works around
each one and ships. Rows carry an **owner or `NONE`**; `NONE` means nobody is doing this and it will
be rediscovered at full price by whoever writes lesson 3.

⚠️ None of these blocked an acceptance criterion, so none was fixed here. The standing rule is build
the tasks, not farm the defects.

| # | severity | owner | one line |
|---|---|---|---|
| D1 | 🔴 high | `NONE` | the gate cannot see a condition whose **unit** a learner can never type |
| D2 | ⚠️ medium | ✅ **FIXED 2026-09-05 (s9)** | a condition's prose shows the learner a raw type name |
| D3 | ⚠️ medium | `NONE` | a Columns node silently overflows its parent by `marginX` |
| D4 | low | `NONE` | `derive_starter` leaves `_registry.json` counting the solution's nodes |
| D5 | low | `NONE` | `Columns.justifyContent` is inert for auto-height items |

---

## D1 🔴 — `create_lesson` cannot catch a condition a learner can never satisfy

**The shape.** F2 replays each condition against the **solution**. The solution is written by the
authoring tool, which writes `{"value":560,"unit":"px"}`. The learner writes the same value through
the property panel, which commits the port's **`defaultUnit`** unless they change the dropdown. When
those two differ, the condition holds against the solution, every class passes, the bundle ships —
and the step refuses correct work.

**The instance, caught by hand and not by any gate.** `Group.maxWidth` declares
`defaultUnit: "%"` with `units: ["%","px","vw","vh"]`
(`packages/noodl-types/src/node-catalog-enriched.json`). A learner typing `560` into **Max Width**
commits **560 per cent**. Lesson 2's step 2 grades `{"value":560,"unit":"px"}`.

Measured, not assumed — `NumberWithUnits.updateValue`
([`NumberWithUnits.ts:255`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/NumberWithUnits.ts#L255))
commits `{ value, unit: edit.unit ?? fallbackUnit ?? this.type.defaultUnit }`, and
`NumberUnitInput.tsx:75` renders a dropdown only when a port declares more than one unit.

**Why it is worth a fix rather than a note.** This is exactly the failure class the authoring brief
says it exists to prevent — *"a condition naming a display name matches nothing, and the learner is
told they have not done a step they have in fact done"* — and it is a second, unlisted way to
commit it. Every future lesson that grades a dimension by value is exposed, and the author has no
signal at all: all four classes read `pass`.

**The fix is cheap and mechanical.** For every `paramsEqual` naming a number-with-units port, compare
the condition's `unit` against that port's `defaultUnit` in the catalog. If they differ, that is not
an error — it is legitimate, and lesson 2 does it deliberately — but the step's `body` must then name
the unit. Warn, name the step, and say so. ⚠️ **A warning is the right strength: a refusal would
reject lesson 2, which is correct.**

**Lesson 2's workaround.** Step 2's `body` reads *"**Max Width** to `560`, with its unit set to
**px**"*, and it is in `body` rather than `detail` because `detail` is collapsible.

## D2 ⚠️ — the learner is shown a raw type name

`describeCondition`
([`lessonconditioncopy.ts:84`](../../../packages/noodl-editor/src/editor/src/views/lessons/lessonconditioncopy.ts#L84))
renders a `hasType` condition as `` `a ${type} called “${label}”` `` with `type` the raw string from
the manifest. Conditions take **type names**; prose uses **display names**; the runner is printing a
type name into prose.

Lesson 2 is the first lesson to grade a namespaced type, so this has never surfaced before —
`Group`, `Circle` and `Text` are their own display names. Lesson 2's step 3 will read:

> Looking for a **net.noodl.visual.columns** called “Care” on Home.

**Why it matters more than it looks.** It is shown to a beginner in the second lesson they ever do,
and it names a thing that appears nowhere in the editor's UI — the picker says *Columns*. It also
gets worse, not better: `poke-it` needs `net.noodl.controls.button`, and every lesson after it uses
more namespaced types than the one before.

**The fix.** Map the type name through the catalog's `displayName` for display only, falling back to
the raw string when it is unknown. ⚠️ **Display only** — the condition must keep matching on the type
name, which is the whole point of the two vocabularies.

**Not worked around in lesson 2.** There is no way to; the condition has to name the type.

## D3 ⚠️ — a Columns node overflows its parent by `marginX`, silently

A Columns node draws its gutters with negative margins, so at full width its container measures
`parent + marginX`. With no horizontal padding on the parent, `render_report` at `390x844` found
**four elements at 406px inside a 390px viewport**, clipped by an ancestor and reachable by nobody.

Arguably the standard gutter technique rather than a bug — but nothing tells the author. There is no
`validate_project` diagnostic, and the composition vocabulary's `gridAutoFit` entry does not mention
that its parent needs padding. The render harness *did* catch it (`elements-overflowing`), which is
the argument for it being a documentation gap rather than a code one.

**Fix, cheapest first:** say it in the `gridAutoFit` / `columnsTwoUp` composition notes, and in
`get_node_type`'s prose for `marginX`.

**Lesson 2's workaround.** `Board` carries `paddingLeft`/`paddingRight`, and the step prose explains
that the padding is structural rather than decorative.

## D4 low — `derive_starter` ships a `_registry.json` that counts the solution

The derivation rewrites three files — a component's `nodes.json`, its `connections.json`, and project
`metadata` — and copies everything else verbatim
([`starterWriter.ts:11`](../../../packages/noodl-mcp/src/lessons/starterWriter.ts#L11) says so, and
says why). `_registry.json` carries per-component `nodeCount` and a `totalNodes`, and those are not
recounted.

Measured on the bundles that ship today:

| | real nodes in `Pages/Home` | `_registry.json` says |
|---|---|---|
| `your-creature-on-screen` starter | **2** | 5 |
| `it-breaks-on-a-phone` starter | **5** | 10 |

So this is **pre-existing and already shipping** — lesson 1 has carried it since 2026-08-28. Nothing
is known to read those counts, which is why it is `low` and not higher; that is an absence of
evidence, not evidence of absence, and whoever picks this up should check before deciding it is
harmless.

## D5 low — `Columns.justifyContent` is inert for auto-height items

Setting it to `center` on lesson 2's Columns node changed **nothing** at either viewport, pixel for
pixel across two `render_report` runs. It maps to `align-items` on the cross axis
(`alignComp: "align-items"` in the catalog) and the column items are auto-height, so there is nothing
to centre.

It is offered in the panel with three values, none of which does anything in the common case. Either
it should be conditional on the items having a definite height, or its description should say what it
actually aligns.

**Consequence for authoring**, which is the reason this is written down: it was going to be lesson
2's "alignment" step, and grading it would have taught a learner to set a control that does nothing.
Caught only because the render was compared before and after.

---

## Still open from lesson 1, not re-registered here

- 🔴 **Pressing "Check my work" on an incomplete step removes the instructions** — body and the
  `detail` disclosure both leave the DOM, and no new feedback appears. Raised by
  [SYL-004](SYL-004-LESSON-1-YOUR-CREATURE-ON-SCREEN.md); it is the runner, so it applies to all
  three bundles. Still unfixed.
- ⚠️ **Both lesson projects leave `bodyScroll` unset**, so `validate_project` reports
  `page-cannot-scroll` on every write. Harmless while a lesson's page fits a phone; lesson 2's does,
  measured (`contentBottom` 844 of 844 at `390x844`). A later spine lesson with a taller page will
  hit it, and fixing it in lesson 1's project is what fixes it for the chain.
- ⚠️ **The header comment on `tests-unit/tut-004/the-real-bundle-installs.test.ts`** says
  `log-a-thing` "is the only" shipped bundle. It was already false; it is now false about two.


---

## ✅ D2 — FIXED 2026-09-05 (session 9), and it was wider than recorded

The *"Looking for…"* line resolves a lesson's `hasType` through the node picker's **own**
`getItemLabel`, injected from `LessonLayerView` rather than imported, so the sentence and the picker
cannot disagree about what a node is called. Gated by 10 rows in
`tests-unit/fix-025/check-my-work-copy.test.ts`, mutant-checked.

🔴 **The row recorded this as the raw dotted ids. It is not only those.** Eight of the types the
shipped lessons grade do not read as their own name, and three of them are ordinary words that are
simply the **wrong** word — a learner hunting the picker for what the sentence named would not find
it:

| the lesson grades | the learner was told | the editor actually calls it |
|---|---|---|
| `net.noodl.controls.button` | `net.noodl.controls.button` | **Button** |
| `net.noodl.visual.columns` | `net.noodl.visual.columns` | **Columns** |
| `net.noodl.animatetovalue` | `net.noodl.animatetovalue` | **Animate To Value** |
| `Circle` | *a Circle* | **Shape** |
| `Timer` | *a Timer* | **Delay** |
| `Logic Builder` | *a Logic Builder* | **Visual Function** |
| `DbCollection2` | *a DbCollection2* | **Query Records** |
| `NewDbModelProperties` | *a NewDbModelProperties* | **Create Record** |

The three undotted ones are the same mismatch as [E4](DEFECTS-LESSON-3-FOUND.md) and
[H3](DEFECTS-LESSON-6-FOUND.md) (`Timer` vs `Delay`) — which had been filed twice, as a curriculum
problem, without either row noticing that the runner was repeating the wrong name to the learner at
the moment they were looking for the node.

⚠️ **The fallback is a deliberate degradation.** With no library loaded a dotted id loses its
namespace and nothing else: it cannot recover `Animate To Value` from `animatetovalue`, and it must
not guess at `Circle`, whose real name shares no letters with it. Consistent with the module's
standing contract — degrade the copy, never break grading — and pinned by its own spec row so
nobody later mistakes the fallback for the answer.
