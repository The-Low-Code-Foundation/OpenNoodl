# It gets demanding

The solution project for University spine lesson 7. Lesson 6's app, plus the first thing in it that happens without anybody clicking: a `Patience` (**Delay**) started by the page itself, an `Ignored` (**Switch**) turning its one moment into a lasting fact, a `Demanding` (**And**) requiring that fact *and* a bad mood, and a `Nag` text that fades in to ask for something. It is the finished state the learner reaches, and the starter is derived from it by subtraction.

## How to change this app

The component graphs under `components/` are generated files. Editing that JSON by hand skips schema validation, the semantic checks, and the bookkeeping that keeps the registry and the router in step — the result usually loads, which is what makes it expensive to find later.

Use a `nodegx` MCP server bound to this folder instead.

⚠️ **If you must write the JSON by hand, match the tools' encoding**: literal UTF-8 (not `\uXXXX` escapes), two-space indent, and **no trailing newline** on the component files. The spine's chain check compares `nodes.json` and `connections.json` byte-for-byte against lesson 6's solution.

## Where the decisions are

`docs/BRIEF.md` is what this lesson is for, `docs/ARCHITECTURE.md` is the tree and what was measured, `docs/CONVENTIONS.md` is what may and may not be added. `docs/decisions/` holds the scoping record.

🔴 **The node whose type name is `Timer` is called `Delay` in the picker**, and it is a one-shot countdown: no repeat, no `isRunning` boolean, only `timerStarted` and `timerFinished` signals. Turning it into a readable fact needs a `Switch` beside it. See `docs/ARCHITECTURE.md` §1.

🔴 **`And`'s inputs are named `input 0`, `input 1`** — the family name, a space, the index (`nodedefinition.ts:144`). They display as **Input 0** and **Input 1**.
