# Log a Thing

A one-page log: type a line, press Log it, and it is saved to the built-in database and appears in the list below. It exists to teach one rule — the Visual Function computes, the canvas does the async work, and the signal wire is the await.

## How to change this app

The component graphs under `components/` are generated files. Editing that JSON by hand skips schema validation, the semantic checks, and the bookkeeping that keeps the registry and the router in step — the result usually loads, which is what makes it expensive to find later.

Use the `nodegx-tut003-log-a-thing-solution` MCP server instead. It is registered for this folder in `.mcp.json`, so an agent started here is offered it and asks you to approve it once.

## Where the decisions are

- `docs/BRIEF.md` — what the app is and who opens it
- `docs/ARCHITECTURE.md` — how it is put together
- `docs/CONVENTIONS.md` — rules this project agreed to follow, and worth checking work against
- `docs/decisions/` — what was considered and deliberately not done, with reasons

## A note on `.mcp.json`

It names absolute paths belonging to this machine’s NodeGX install, so it is listed in `.gitignore` — committed, it would point a teammate’s agent at a path that does not exist on their disk. It is written when a project is created **and whenever the project is opened in NodeGX without one**, so a checkout cloned from git gets its own on first open. Nothing here is ever overwritten: edit either file and it stays edited.
