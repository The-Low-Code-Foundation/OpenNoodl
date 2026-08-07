# FH-004 — The Object node gets its object-valued output

Covers reported items **3** and the blocker half of **0.1**.

## What was reported

> The Object node is supposed to have an Object output as well as an ID output, so you can output
> the full object JSON rather than just its ID, but I don't see it in the node ports.

## Status — never built, and already decided

The memory is of a **decision**, not a build. `ERG-004-NOTES.md:388-441` (§7.4, marked 🔴):

> **✅ DECIDED by Richard, 2026-08-02 — add an object-valued output to the `Object` node** …
> **The work is unowned and not started.**

Confirmed in source: `Model2` (`modelnode2.ts`) outputs exactly `id` (string), `changed`, `fetched`,
`done`, `completed`, `failure` — plus dynamic `prop-*`/`changed-*` per-property ports. The catalog
(`node-catalog.json`) agrees. No object port exists, hidden or flagged.

## Why it matters more than a missing port

The whole Data category identifies objects by string id, and `Object Changed` / `Array Changed`
(ERG-004's new watcher nodes) take a **live object/array** input. The obvious wiring —
`Object.Id → Object Changed.Object` — is *permitted* by the typecast table and then fails
grotesquely: the `string→object` cast `eval`s the id as a JS literal (`node.ts:360-390`), throws
`ReferenceError`, substitutes `{}`, **and the node watches nothing for the life of the app**
(`ERG-004-NOTES.md:399-407`). So `Object Changed` is effectively only reachable through a Script
node today. This task is what unblocks it.

Note: `Array Changed` may already be reachable without this — `Collection2.items`
(`collectionnode2.ts:176-184`) returns the **live Collection instance**, and
`isWatchableArray` (`arraychanged.ts:86-91`) should accept it since `on`/`off` live on
`Array.prototype`. **Verify `Array.Items → Array Changed.Array` live as slice 0** — if it works,
the array side needs nothing new and the doc/AI vocabulary just needs to say so.

## What to build

Per the ERG-004 decision (`ERG-004-NOTES.md:429-431`):

1. **`Object` (Model2) gains an output that emits the live `Model`** — not its id, not a JSON
   snapshot. Type `object`. Fires alongside `id` (same getter timing; a declared `default` never
   runs its setter — the most-repeated trap in the repo — so make sure the getter path, not a
   setter side effect, produces it).
2. **`Array` (Collection2)**: confirm `items` already serves this role (slice 0); if its type or
   timing is wrong for `Array Changed`, fix in place rather than adding a twin port.
3. Accepted blast radius, already recorded (`ERG-004-NOTES.md:432-441`): two ways to name an
   object; the `string→object` typecast still silently accepts the wrong wiring. Do not try to fix
   the typecast here — that's its own conversation.
4. Corpus test alongside the existing `erg-004-*` tests: `Object.Object → Object Changed.Object`,
   mutate a key, `Key Changed` fires.

## Criteria

1. The Object node shows an `Object` output in the ports panel and the catalog.
2. `Object.Object → Object Changed.Object` works with zero Script nodes: key edits fire
   `Key Changed` with `key`/`value`/`previousValue` populated.
3. `Array.Items → Array Changed.Array` verified live (works today or fixed here).
4. `node-catalog.json` regenerated — the cloud-library snapshot gate is red for commits if stale.
5. Runtime corpus test green (jest is fine here — this is noodl-runtime, not the editor).
