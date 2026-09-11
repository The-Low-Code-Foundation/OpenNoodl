# It forgets you

The solution project for University spine lesson 4. Lesson 3's app, plus a `Counter` that keeps a running total of pokes, a `Score` text that displays it, and a second button that puts it back. It is the finished state the learner reaches, and the starter is derived from it by subtraction.

## How to change this app

The component graphs under `components/` are generated files. Editing that JSON by hand skips schema validation, the semantic checks, and the bookkeeping that keeps the registry and the router in step — the result usually loads, which is what makes it expensive to find later.

Use a `nodegx` MCP server bound to this folder instead.

⚠️ **If you must write the JSON by hand, match the tools' encoding**: literal UTF-8 (not `\uXXXX` escapes), two-space indent, and **no trailing newline** on the component files. The spine's chain check compares `nodes.json` and `connections.json` byte-for-byte against the previous lesson's solution, and a `json.dump` default of `ensure_ascii=True` breaks it while changing nothing semantic.

## Where the decisions are

`docs/BRIEF.md` is what this lesson is for, `docs/ARCHITECTURE.md` is the tree and what was measured, `docs/CONVENTIONS.md` is what may and may not be added. `docs/decisions/` holds the scoping record.
