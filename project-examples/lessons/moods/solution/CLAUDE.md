# Moods

The solution project for University spine lesson 6. Lesson 5's app, plus the first decision it makes on its own: an `Is Happy` (**Expression**) comparing the poke count against a threshold, a `Mood Check` (**Condition**) forking on the answer, and a `Mood` (**States**) holding the two sentences one of which ends up on the card. It is the finished state the learner reaches, and the starter is derived from it by subtraction.

## How to change this app

The component graphs under `components/` are generated files. Editing that JSON by hand skips schema validation, the semantic checks, and the bookkeeping that keeps the registry and the router in step — the result usually loads, which is what makes it expensive to find later.

Use a `nodegx` MCP server bound to this folder instead.

⚠️ **If you must write the JSON by hand, match the tools' encoding**: literal UTF-8 (not `\uXXXX` escapes), two-space indent, and **no trailing newline** on the component files. The spine's chain check compares `nodes.json` and `connections.json` byte-for-byte against lesson 5's solution, and a `json.dump` default of `ensure_ascii=True` breaks it while changing nothing semantic.

## Where the decisions are

`docs/BRIEF.md` is what this lesson is for, `docs/ARCHITECTURE.md` is the tree and what was measured, `docs/CONVENTIONS.md` is what may and may not be added. `docs/decisions/` holds the scoping record.

🔴 **A `States` value that is a sentence must have its `type-<value>` set to `string`.** An untyped value is treated as a number (`states.ts:161`) and a state change tries to *tween* it, so the word arrives as a number or not at all. See `docs/ARCHITECTURE.md` §2.

🔴 **Take an `Expression`'s boolean from `Is True`, never from `As Boolean`.** `asBoolean` is one of the three outputs that are never flagged dirty (`expression.ts:238-240`), so a wire from it delivers one reading and never updates. Inherited from lesson 5, row G1.
