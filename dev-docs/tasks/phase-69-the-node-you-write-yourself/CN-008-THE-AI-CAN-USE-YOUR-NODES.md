# CN-008 — The AI can use your nodes

| Field | Value |
|---|---|
| **Tier** | 3 |
| **Effort** | M |
| **Surface** | `editor` (`AiAssistant`, prompts) |
| **Rulings** | ✅ **D7** — "this project", not "the shelf" |
| **Depends on** | CN-003 |

## The problem

The built-in authoring loop composes from the catalog, so it composes from **built-ins only**. A user
who has just built a `Cashflow Lane` and asks the AI to "add another row" gets a `Group` and a
`Text`, because the AI does not know the lane exists. The user's own best building blocks are the
ones it cannot see.

There is already a precedent for exactly this shape: ERG-002 added
`AuthoringContextBuilder.libraryOverview()` — one line per registered UMD library naming its global,
threaded through `AuthoringSessionOptions` → the builder → `initialUserMessage` /
`updateUserMessage` → `referenceBlocks`'s **stable (cache-prefix) half** in `prompts/authoring.ts`.

## What to build

`nodeKitOverview()` beside it, listing the project's kit node types with their ports.

✅ **Follow `libraryOverview`'s conventions exactly** — this is a well-trodden path and deviating from
it costs more than it gains:

- the `charge()` accounting, so the cost is visible rather than discovered later;
- **absent means omitted** — a project with no kits adds *nothing*, not an empty section. 🔴 An
  omitted context section reads as a claim: a heading with nothing under it tells the model "there
  are no custom nodes here" in a way that silently becomes "and there never can be";
- placement in the **stable half** of `referenceBlocks`, so it participates in prompt caching. Kits
  change rarely; putting them in the volatile half wastes the cache on every turn.

## What to include per node, and what to leave out

The tension is that a kit can be large — the cashflow kit's five nodes carry ~60 ports between them,
and a naive dump would swamp the prompt.

- **Include**: type name, display name, what it is for (the `docs` string authors already write), and
  the ports an instance would actually set — the inputs with no default, plus signals out.
- **Exclude**: the inherited visual ports. Every visual node has `Width`/`Height`/margins; repeating
  them per kit node is pure cost, and the model already knows them from the built-in vocabulary.
- **Budget it explicitly.** State the per-node and per-project token cost in the task's own notes,
  and decide a cap before a user with a 40-node kit finds one for us.

## Acceptance criteria

1. In a project with the cashflow kit, asking the AI for another cashflow row produces a graph using
   **`Cashflow Lane` + `Money Pill`**, not a hand-rolled `Group`. 🔴 This is the consequence; "the
   handout appears in the prompt" is the mechanism and would be equally true of a broken feature.
2. A project with no kits produces a prompt **byte-identical** to today's.
3. The handout sits in the cache-stable half — verified by inspecting the assembled prompt, not by
   intent.
4. Cost is reported through `charge()` like every other handout.
5. Tests run headlessly. `AuthoringContextBuilder` and the prompt builders are pure by design and
   ERG-002's four tests already prove the pattern — no Electron, no `ProjectModel`.

## Traps

- ⚠️ **The Build composer authors on a one-character prompt**, and `ed.undo()` does not undo an AI
  apply. Any live drive of this task must `cp -R` the project first.
- ⚠️ **A debounce boolean swallows the urgent request** — the recorded failure mode in this area.
  Kits changing mid-session (a scaffold, an install) must invalidate the handout without being
  coalesced away.
