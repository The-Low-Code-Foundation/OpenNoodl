# Architecture

## Page map

- **Home** (`Pages/Home`) — The only page. This lesson adds one logic node beside the tree and one
  visual node inside `Board`.
- **Snack** (`Snack`) — 🆕 The first component other than the page in the whole spine. It is the
  design for ONE snack; it is never placed by hand, only by the Repeater.

## The tree this lesson adds

```
Board   (Group)                          lesson 2
  └ Menu (Repeater, type `For Each`)      ← step 5 — template "/Snack", Pantry.items → items
                                          ← step 7 — itemOutputSignal-eaten → Ignored.off
                                          ← step 7 — itemOutputSignal-eaten → Patience.restart

Pantry  (Static Array, type `Static Data`) ← step 2 — csv "name\nApple\nBiscuit\nCarrot"

/Snack                                    ← step 3 — the component itself
Snack row (Group)                         ← step 3 — the root a Visual Component is born with
  └ Name  (Text)                          ← step 3 — NO text parameter
Fields    (Component Inputs)              ← step 4 — port `name`; name → Name.text
Signals   (Component Outputs)             ← step 6 — port `eaten`; Snack row.onClick → eaten
```

## 🔴 1. Two of the three curriculum nodes wear a different name in the picker

`get_node_type` reads `Static Data` → **Static Array** and `For Each` → **Repeater**. The step body
says the picker's name and the `detail` says the type name once, exactly as lesson 7 did for
`Timer`/**Delay**. Conditions use the type name; the gate rejects a display name in a condition.

The third, `For Each Actions` → **Repeater Item**, is not built. See `docs/BRIEF.md`.

## 🔴 2. The component is not in the starter, and `derive_starter` cannot remove a component

`derive_starter` subtracts nodes, wires and parameters. After it has subtracted every graded node
in `Snack` it leaves an **empty component**: `components/Snack/nodes.json` with no nodes, a
`component.json`, and a registry entry. The chain gate then reads that as *"a component in this
starter that the previous solution does not have — the starter adds a component the learner never
built"*, and it is right.

So the starter is finished by hand: `components/Snack` is deleted and `_registry.json` is replaced by
lesson 7's. `create_lesson`'s F2 replay is unaffected — a condition addressing `/Snack:#…` against a
project with no `/Snack` is simply unmet, which is what a starter is for.

The learner creates it from the Components panel's **+** → **Visual Component**, named `Snack`. That
lands at the top level as `/Snack` (`useComponentActions.ts`, `toFolderPath` with no parent), which
is why the conditions and the `template` parameter say `/Snack` and not `/Components/Snack`.

## 🔴 3. `eaten` is minted at runtime, and its real name is `itemOutputSignal-eaten`

The Repeater has no `eaten` port in the catalog. `foreach.tsx`'s `_collectPortsInTemplateComponent`
reads the template component's output ports and publishes each signal one as
`itemOutputSignal-<name>` (display name `<name>`, group **Item Signals**) and each value one as
`itemOutput-<name>`. `Home`'s two step-7 connections carry the long name, and the lesson runner grades
what is in `connections.json`, so the condition's `fromPort` is the long name too.

Whether it is a signal at all is decided by the *wire inside `Snack`*: a Component Outputs port added
from the panel is typed `*`, and `componentmodel.ts` derives the component's port type from what is
connected to it. Connected from `Snack row`'s Click, `eaten` is a signal.

## 🔴 4. `name` twice, and it is graded on the side the editor cannot see

The Repeater sets an input on each instance for every item field whose name matches a Component
Inputs port (`foreach.tsx`, `for (const inputKey in itemNode._inputs)`). A header spelt `snack`
against a port spelt `name` fails silently: three rows, each saying `Text`.

The CSV is graded with `hasParams` — `paramsEqual` on a string is an exact compare
(`lessonevalconditions.ts`, `isParamEqual`), and a trailing newline would refuse correct work — so
the header cannot be graded directly. The port can, and is (`hasPort: "name"`). The step body names
the header in as many words, and step 5's `detail` says what three `Text`s mean.

## 5. Measured — see the task file for the numbers

The static render can see this lesson (three rows are three rows, at t=0), which lesson 7's could
not. The drive is what shows the `eaten` path: click a row while the nag is showing, watch it fade.
The task file `SYL-011-LESSON-8-SNACKS.md` carries the readings; they are not repeated here so they
cannot drift.

## Data model

`Pantry` is inline CSV — one column, three rows. No records. That the menu is fixed and the app
cannot add to it is the outro's hook to lesson 9.
