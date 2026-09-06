# Snacks

The solution project for University spine lesson 8. Lesson 7's app, plus the first list in it: a `Pantry` (**Static Array**) holding three snacks as data, a `Snack` component that is the design for one of them, a `Menu` (**Repeater**) on the board that places the design once per item, and an `eaten` signal that leaves the design, comes back up through the Repeater, and feeds Nibbles. It is the finished state the learner reaches, and the starter is derived from it by subtraction.

## How to change this app

The component graphs under `components/` are generated files. Editing that JSON by hand skips schema validation, the semantic checks, and the bookkeeping that keeps the registry and the router in step — the result usually loads, which is what makes it expensive to find later.

Use a `nodegx` MCP server bound to this folder instead.

⚠️ **If you must write the JSON by hand, match the tools' encoding**: literal UTF-8 (not `\uXXXX` escapes), two-space indent, and **no trailing newline** on the component files. The spine's chain check compares `nodes.json` and `connections.json` against lesson 7's solution.

## Where the decisions are

`docs/BRIEF.md` is what this lesson is for, `docs/ARCHITECTURE.md` is the tree and what was measured, `docs/CONVENTIONS.md` is what may and may not be added. `docs/decisions/` holds the scoping record.

🔴 **Two of this lesson's three curriculum nodes wear a different name in the picker.** `Static Data` is shown as **Static Array**; `For Each` is shown as **Repeater**. Conditions use the type name, prose uses the display name. See `docs/ARCHITECTURE.md` §1.

🔴 **`Snack` is the first second component in the spine, and it is not in the starter.** The learner creates it; `derive_starter` cannot subtract a component, only nodes, so the empty `components/Snack` it leaves is removed by hand before `create_lesson`. See `docs/ARCHITECTURE.md` §2.

🔴 **The Repeater's `eaten` port does not exist in any catalog.** It is minted at runtime from the template component's outputs, and its real name is `itemOutputSignal-eaten`. See `docs/ARCHITECTURE.md` §3.
