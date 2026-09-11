# 000 — Initial scope

_Recorded 2026-09-06, from the scoping done before this project was authored._

## What was asked for

> Build spine lesson 8, "Snacks", from Richard's curriculum entry: "A menu of snacks is many
> similar things. One item design, repeated per item of data." Teaches arrays, iteration,
> templates. Nodes: Static Data, For Each, For Each Actions. 35 minutes.

## What was decided

**The app.** Lesson 7's app plus a list: `Pantry` (**Static Array**, three snacks as CSV), a `Snack`
component (a row with a `Name` Text, a **Component Inputs** port `name` and a **Component Outputs**
port `eaten`), and `Menu` (**Repeater**) inside `Board` placing `Snack` once per item. `eaten` goes
to `Ignored.off` and `Patience.restart`, so clicking a snack does to the nag what a poke does.

**The menu goes under the buttons; the three words stay.** A spine lesson may only add, and
`Feed`/`Play`/`Sleep` are the outro's own example of the problem the lesson solves.

**CSV, one column, graded with `hasParams`.** The smallest statement of "a list is data" is a header
and three words. `paramsEqual` on the text would refuse a learner who typed different snacks or a
trailing newline; the load-bearing word (`name`) is graded on the port instead.

**Feeding is `Ignored.off`, not `Pokes.increase`.** Eating is not poking; the count is the poke
count. The nag fades because `Demanding` needs `Ignored` on.

**The component is created by the learner, at the top level, as `/Snack`.** That is what the panel's
**+** produces with no folder selected, and it is one fewer thing to get wrong than a folder.

## 🔴 The curriculum entry named three nodes; two are built, one would be padding

- **`Static Data`** ✅ built — shown as **Static Array** in the picker.
- **`For Each`** ✅ built — shown as **Repeater**.
- **`For Each Actions`** ⬜ **Repeater Item**. Not built. Its ports are `Item Id`, `Added`,
  `Try Remove` / `Remove Completed` — a row's own lifecycle, and above all the handshake that lets a
  row animate out before the Repeater destroys it. Nothing in this lesson removes a row; the data is
  fixed. Placed here it would have no wire to carry.

⬜ **Curriculum correction owed**: `snacks`'s `nodes` should read `Static Data`, `For Each`,
`Component Inputs`, `Component Outputs`. ⚠️ **That overlaps lesson 11** (`build-your-own-node`:
*"Your own reusable part, with the inputs it declares"*), and the overlap is unavoidable — a
Repeater's template is a component and a component receives its data through Component Inputs.
Lesson 8 introduces both as *the design for one item*; lesson 11 is where a component is made for
reuse across pages. That is a note for Richard, not a decision taken here.

## What was deliberately not done

- **Removing an eaten snack.** Needs a mutable array (**Array**, **Remove Object From Array**) and
  is the shape of lesson 9's problem.
- **A second column.** `emoji` beside `name` is one more heading and one more port; the lesson says
  so in the outro and stops.
- **Styling the row in a graded step.** The learner's row may be bare; every parameter on
  `Snack row` is ungraded furniture on a node this lesson creates.
