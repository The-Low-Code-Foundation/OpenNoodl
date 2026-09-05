# Poke it

The solution project for University spine lesson 3. Lesson 2's creature card and care strip, plus a **Poke** button, a **Reaction** text, and the two logic nodes that stand between them — a `Switch` and an `Animate To Value`. It is the finished state the learner reaches, and the starter is derived from it by subtraction.

## How to change this app

The component graphs under `components/` are generated files. Editing that JSON by hand skips schema validation, the semantic checks, and the bookkeeping that keeps the registry and the router in step — the result usually loads, which is what makes it expensive to find later.

Use a `nodegx` MCP server bound to this folder instead.

## Where the decisions are

`docs/BRIEF.md` is what this lesson is for, `docs/ARCHITECTURE.md` is the tree and the three measurements that decide it, `docs/CONVENTIONS.md` is what may and may not be added. `docs/decisions/` holds the scoping record.
