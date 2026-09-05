# Show what it feels

The solution project for University spine lesson 5. Lesson 4's app, plus two transformations of the poke count on its way to the screen: a `Caption` (**String Format**) that turns it into a sentence, and an `Excitement` (**Expression**) that turns it into the creature's diameter. It is the finished state the learner reaches, and the starter is derived from it by subtraction.

## How to change this app

The component graphs under `components/` are generated files. Editing that JSON by hand skips schema validation, the semantic checks, and the bookkeeping that keeps the registry and the router in step — the result usually loads, which is what makes it expensive to find later.

Use a `nodegx` MCP server bound to this folder instead.

⚠️ **If you must write the JSON by hand, match the tools' encoding**: literal UTF-8 (not `\uXXXX` escapes), two-space indent, and **no trailing newline** on the component files. The spine's chain check compares `nodes.json` and `connections.json` byte-for-byte against lesson 4's solution, and a `json.dump` default of `ensure_ascii=True` breaks it while changing nothing semantic.

## Where the decisions are

`docs/BRIEF.md` is what this lesson is for, `docs/ARCHITECTURE.md` is the tree and what was measured, `docs/CONVENTIONS.md` is what may and may not be added. `docs/decisions/` holds the scoping record.

🔴 **Take an `Expression`'s value from `Result`, never from `As Number` / `As String` / `As Boolean`.** Those three outputs are never flagged dirty (`expression.ts:238-240`), so a wire from them never updates — into `Circle.size` that means `NaN` and a creature that vanishes, with every gate green. See `docs/ARCHITECTURE.md` §1.
