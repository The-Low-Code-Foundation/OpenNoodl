# SYL-011 — lesson 8, "Snacks"

| Field | Value |
|---|---|
| **Prefix** | `SYL` |
| **Effort** | M |
| **Surface** | `project-examples/lessons/snacks` |
| **Rules** | [R1](RICHARD-RULINGS-2026-08-28.md#r1--the-pet-spine-stands-as-written) (the chain), R3 via [SYL-001](SYL-001-THE-HAND-HOLDING-HALF.md) (`detail`), [LESSON-VOICE.md](LESSON-VOICE.md) |
| **State** | 🟢 **Built, gated and DRIVEN 2026-09-06 (session 13).** ⬜ **The prose is a draft awaiting Richard.** |

## What it is

Spine lesson 8, the first lesson with a **list** in it and the first with a **second component**. A
`Pantry` (**Static Array**) holds three snacks as CSV, a `Snack` component is the design for one of
them, a `Menu` (**Repeater**) inside `Board` places that design once per item, and a click on any row
leaves the design as `eaten`, comes back up through the Repeater, and switches `Ignored` off — so the
creature that has been asking to be fed since lesson 7 can be fed. **Six graded steps** between an
intro and an outro popup.

```
Board   (Group)                          lesson 2
  └ Menu (Repeater, type `For Each`)      ← step 5 — template "/Snack", Pantry.items → items
                                          ← step 7 — itemOutputSignal-eaten → Ignored.off
                                          ← step 7 — itemOutputSignal-eaten → Patience.restart
Pantry  (Static Array, type `Static Data`) ← step 2 — csv "name\nApple\nBiscuit\nCarrot"

/Snack                                    ← step 3 — the component itself, learner-created
Snack row (Group)                         ← step 3 — the root a Visual Component is born with
  └ Name  (Text)                          ← step 3 — NO text parameter
Fields    (Component Inputs)              ← step 4 — port `name`; name → Name.text
Signals   (Component Outputs)             ← step 6 — port `eaten`; Snack row.onClick → eaten
```

## 🔴 Three things about this lesson no earlier spine lesson had to solve

1. **The learner creates a component, and `derive_starter` cannot subtract one.** It subtracts nodes,
   so after removing every graded node in `Snack` it leaves an *empty* component (`nodes: []`, a
   `component.json`, a registry entry). `lessons:chain` reads that, correctly, as *"a component in
   this starter that the previous solution does not have"*. The starter is finished by hand:
   `components/Snack` deleted, `_registry.json` replaced by lesson 7's. After that all four graph
   files are **byte-identical** to lesson 7's solution. Registered as
   [L1](DEFECTS-LESSON-8-FOUND.md).
2. **The step-7 port does not exist in any catalog.** The Repeater mints `itemOutputSignal-eaten`
   at runtime from the template's Component Outputs (`foreach.tsx`,
   `_collectPortsInTemplateComponent`) and shows it as **eaten** under **Item Signals**. The
   condition's `fromPort` is the long name, `create_lesson` accepted it, and the runner graded it —
   the editor model read live shows exactly
   `itemOutputSignal-eaten | eaten | Item Signals | signal` on `Menu`.
3. **Whether `eaten` is a signal at all is decided inside `Snack`.** A port added from the panel is
   typed `*`; `componentmodel.ts` derives the component's port type from the wire. Measured on a
   learner-made port: `name | output | *`, identical to the solution's.

## 🔴 The curriculum named three nodes; two are built, one would be padding

- **`Static Data`** ✅ built. ⚠️ **The picker shows it as `Static Array`**, and the picker files it
  under **Read & Write Data · Array** — not the catalog's `Data`.
- **`For Each`** ✅ built. ⚠️ Picker name **Repeater**, under **Read & Write Data** — not `Visual`.
- **`For Each Actions`** ⬜ **Repeater Item.** Not built. Its ports are `Item Id`, `Added`,
  `Try Remove` / `Remove Completed` (`foreachactions.ts`) — a row's own lifecycle, above all the
  handshake that lets a row animate out before the Repeater destroys it. Nothing in this lesson
  removes a row: the data is fixed, and the outro says so. Placed here it would have no wire to
  carry. The removal story needs a mutable array and is the shape of lesson 9's problem.

⬜ **Curriculum correction owed** (the **sixth** entry out of eight built): `snacks`'s `nodes` should
read `Static Data`, `For Each`, `Component Inputs`, `Component Outputs`. ⚠️ **That overlaps lesson
11** (`build-your-own-node`, *"Your own reusable part, with the inputs it declares"*), and the
overlap is unavoidable: a Repeater's template is a component, and a component receives its data
through Component Inputs. Lesson 8 introduces both as *the design for one item*; lesson 11 is where
a component is made for reuse across pages. **That is a note for Richard, not a decision taken here.**

## 🔴 A grading decision to read before editing the prose

**The CSV is graded with `hasParams`, not `paramsEqual`.** `isParamEqual` on a string is an exact
compare (case-insensitive, no trimming — `lessonevalconditions.ts`), so `paramsEqual` on the text
would refuse a learner who chose different snacks or left a trailing newline: the D1 class, a step
that refuses correct work. The one load-bearing word, the header `name`, cannot be graded through
the CSV — so it is graded on the other side of the join, as `hasPort: "name"` on `Fields`, and step
2's body says in as many words that it is the only word that matters.

**What that leaves open, stated:** a learner who types header `snack` and port `name` satisfies
every condition and sees three rows reading `Text`. Step 5's `detail` names that exact symptom and
its cause. It is the same trade lesson 2 made for the three Texts, and the sabotage arm below shows
the failure is at least *visible* to the gate that renders the solution.

## Measurements — do not re-derive

| gate | reading |
|---|---|
| `derive_starter` | written; 15 retractions, the five *"no … wire exists"* lines are [G3](DEFECTS-LESSON-5-FOUND.md)'s benign cascade (wires vanish with their nodes) |
| starter vs lesson 7 solution | **all four graph files + `_registry.json` byte-identical**, after the hand finish |
| `create_lesson` (bound MCP server) | F1 pass, F2 pass, F3 pass, **F4 not-checked** — *"render harness could not be located"* — **refused, nothing written** |
| `create_lesson` (from source, `NODEGX_RENDER_CLI` set) | **F1 pass, F2 pass, F3 pass, F4 pass.** 6 graded steps, 15 conditions. 🔴 **`allow_unrendered` NOT used** |
| `lessons:check` | **exit 0**, 9 bundles, 18 projects, 39 components, 319 nodes |
| `lessons:chain` | **exit 0**, `snacks ← it-gets-demanding` holds; 7 pairs, 0 diverged |
| the chain, in the checker's numbers | `3n → 6n → 11n → 15n → 18n → 21n → 25n → 30n → 36n` |
| the subtraction | solution **36** nodes − starter **30** = the six the learner builds (2 on Home, 4 in `Snack`) |
| `measure-from-disk` @ `1280x900` and `390x844` | **14 texts** both (11 + 3 rows), `placeholders: 0`, `overflowing: 0`, `consoleErrors: []` |
| 🔴 sabotage arm — `Fields` port renamed `snack` | **`placeholders: 3`**, all reading `Text` — the join failure is visible to F4's check |
| the browser drive, shipped solution | nag `1` at t≈9s → click **Apple** → **`0`** at +1.2s → **`1`** again 6.5s later → click **Carrot** → **`0`**. `errors: []` |
| 🔴 the control — `eaten` wires removed | same clicks, nag **`1` throughout**. `errors: []` |
| the lesson runner, negative arm (untouched starter, cold open) | **refused** at step 1: *"Looking for a Static Array called “Pantry” on Home and csv set on “Pantry”."* |
| the lesson runner, positive arm (`[SOLVED]` copy, cold open) | **all six ticked on NEXT**, *"Nice work — you've finished "Snacks [SOLVED]""*, outro shown |
| the runner's Repeater ports, read live | `itemOutputSignal-eaten \| eaten \| Item Signals \| signal` present on `Menu` |
| voice | 1835 words, **21 em dashes, 0 hyphen-dashes, 0 contractions**, 73 bold, 85 code spans |
| ⚠️ `typecheck` / `test:ci` | **not run, and not needed** — no TypeScript changed; the only source-adjacent edit is `spine.json` |

## 🟢 The chrome in the `detail` prose was MEASURED, and five sentences changed

Session 8's rule — *`detail` prose that names editor chrome must be checked against the editor* —
was applied on a fresh profile with the untouched `Snacks` starter open, and it earned its keep:

| what the draft said | what the editor shows | changed to |
|---|---|---|
| "choose **Visual Component**" | the panel's **+** menu reads *Create Page Component / **Create Visual Component** / Create Logic Component / Create Folder* | **Create Visual Component** |
| "**Static Array** is under **Data**" | picker category **Read & Write Data · Array** | **Read & Write Data** |
| "**Repeater** is under **Visual**" | **Read & Write Data** | **Read & Write Data** |
| "**Template** is a dropdown … listing every component" | a text box; clicking it opens a **Choose component** menu listing components by short name (`Probe`) | "a box … click it and a **Choose component** list opens" |
| "at the bottom of its properties panel there is a **+ Port** button" | selecting Component Inputs opens a panel headed **Inputs** with **+Port** / **+Group** in its footer; the prompt is **New port name**, placeholder *e.g. title, subtitle* | "the panel that opens for it, headed **Inputs**, has a **+ Port** button" |

And two claims confirmed as written: **Component Inputs** / **Component Outputs** are under
**Component Utilities**; creating a Visual Component named `Probe` from the panel root produces
`/Probe` at the top level, with the canvas switched to it and one root **Group** on it — so `/Snack`
in every condition and in `template` is the name a learner actually gets.

⚠️ **One sentence is source-read, not driven:** the CSV row rendering with an **Edit** button
(`CodeEditorType`, `Ports.ts:863`; the Repeater's `Script | Edit` row is the same widget). The
picker refused to open a second time behind a locking tooltip dialog, and the Static Array was never
inserted. If that sentence is wrong it is the first thing to fix.

## ⬜ What was NOT done

- **A learner's own edit flipping a step while the editor watches.** Both runner arms are cold opens,
  as in session 8. The throwaway `/Probe` component and its `name` port were made by hand in the
  starter, but no step was re-checked against them.
- **Dragging the `eaten` wire on the canvas.** The port is there (read from the model); that a person
  can drag from it is a separate claim.
- **The curriculum edit** in `nodegx-community` — recorded above, not made.

## What is Richard's

1. 🔴 **The step prose.** Eight bodies and six `detail` blocks.
2. **The `description`** — his curriculum sentence verbatim.
3. **The badge**, currently `One Design, Many Rows`.
4. **The three snacks** (`Apple`, `Biscuit`, `Carrot`) — ungraded, so free to change.
5. 🔴 **Whether feeding should also count as a poke.** It does not: `eaten` goes to `Ignored.off` and
   `Patience.restart` only, so a snack quiets the nag without touching the count or the mood. That
   is a design call.
6. 🔴 **The lesson 8 / lesson 11 overlap** on Component Inputs and Outputs, above.
