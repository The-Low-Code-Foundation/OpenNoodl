# Brief

## What this app is

The solution project for University spine lesson 8, "Snacks". Lesson 7's app, plus its first list: `Pantry` (**Static Array**) holds three snacks as data, `Snack` is a component that is the design for one of them, `Menu` (**Repeater**) places that design once per item underneath the board's buttons, and a click on any row leaves the design as `eaten`, comes back up through the Repeater, and switches `Ignored` off — so the creature that has been asking to be fed since lesson 7 can be fed.

🔴 **The starter of this lesson is the solution of lesson 7.** `starter(N)` must equal `solution(N-1)` on `nodes.json` and `connections.json` (`npm run lessons:chain`). Two rules follow:

- **This lesson may only ADD.** `Feed`, `Play` and `Sleep` stay on the board as the three hand-typed words they were; the menu goes underneath them. A step that removed them would have no way to be subtracted.
- **Ungraded furniture may only be added to nodes this lesson creates.** `Snack row`'s padding and border are on a node the learner makes; nothing is set on `Board`, `Ignored` or `Patience`.

## Who uses it

Somebody who has finished lesson 7 and has an app that asks to be fed and offers no way to do it. Every visible thing on their screen is a node they placed by hand, and the three words on the board are three copies of the same node.

## 🔴 The one idea

**A list is data, and a design written once is repeated per item of it.**

The two halves are one lesson because neither is visible alone: data with no design draws nothing, and a design with no data is a single row. The Repeater is where they meet, and it is the only node in the lesson whose job is the join.

## 🔴 The join that makes the lesson work: a name in the data is a port on the design

The Repeater sets an input on each instance for every item field whose name matches a **Component Inputs** port on the template. So `name` in `Pantry`'s header and `name` on `Fields` are one contract, and the lesson grades the port by name because that is the half a learner can get wrong without the editor saying a word — the row simply says `Text`.

The second join runs the other way: a **Component Outputs** port connected from a signal becomes a signal output of the component, and the Repeater publishes it as its own, under **Item Signals**. That is how a click inside one of three identical rows reaches `Home` with nothing else needed.

## Deliberately out of scope

- **`For Each Actions`** (**Repeater Item**). Named in the curriculum entry and not built. Its job is a row's own lifecycle — its item id, and the `Try Remove` / `Remove Completed` handshake that lets a row animate out before it is destroyed. Nothing in this lesson removes a row: the menu is fixed data, and the outro says so. A node whose only ports are about removal, placed in a list nothing removes from, would teach padding.
- **Removing an eaten snack from the menu.** That needs a mutable array and a removal node, and it is the shape of lesson 9's problem, not this one's.
- **A second field per snack.** One column keeps the CSV to a header and three words. A second field is one more heading and one more port, and the lesson says so.
- **Replacing `Feed`, `Play` and `Sleep`.** They are the outro's own example of the problem, and a spine lesson may not delete.
