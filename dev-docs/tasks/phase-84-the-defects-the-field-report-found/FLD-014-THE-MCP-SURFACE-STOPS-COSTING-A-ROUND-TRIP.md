# FLD-014 — The MCP surface stops costing a round trip

*"these are papercuts on a good API, not a redesign request."* Four of them, each of which cost the
reporter a failed call — and one round-trip bug underneath that the issue did not find.

## 1. The person sentence

**Someone writing a client against the MCP server can round-trip a response into the next request
without renaming fields, and can stage one changed padding value without re-sending 101 nodes.**

## 2. What was reported, and what the code says

[#43](https://github.com/The-Low-Code-Foundation/NodeGX/issues/43), all four confirmed 2026-09-09 —
**but the premise of the first is inverted.**

🔴 **"every parameter in the API is snake_case" is false at HEAD.** Measured across `src/tools/*.ts`:
**108 camelCase input parameters against 20 snake_case**, split into two dialects **by file** —
`backendTools.ts` 98/0, `planTools.ts` 1/6, `read.ts` 0/4, `catalogTools.ts` 0/3, `lessonTools.ts`
0/3, `author.ts` 2/3, `styleTools.ts` 0/1, `createProject.ts` 2/0. The reporter only met the snake
half. Responses, by contrast, are uniformly camelCase.

🔴 **The sharpest bug is not `planId`.** The **same field** is spelled two ways across one call:
input `visual_roots` (`author.ts:620`, `planTools.ts:742`) → response `visualRoots`; input
`allow_unknown_types` (`author.ts:626`, `planTools.ts:752`) → response `allowUnknownTypes`. A client
that round-trips a response into a request breaks, silently.

**Operation order, mechanism found.** `planTools.ts:610-611` assigns `id: \`op-${index + 1}\`` from
the **submitted** index; `:683` then calls `orderPlanOperations`, and
`AiAssistant/authoring/plan.ts:504-507` **stably sorts by operation kind**
(`provision, create, update, doc`). Within a kind, submitted order survives; across kinds it does
not. An update submitted first keeps `op-1` and returns after every create — exactly the symptom.
The response `note` (`:717-720`) describes the *staging* order and never says the ids are
index-based.

**The full-graph requirement is not structural.** `update_component` calls `applyOperations`
(`noodl-mcp/src/graph.ts:169`) — **exported and pure** — and `stage_plan_operation` already reads the
baseline it would need (`planTools.ts:807`). The blockers are that `normalizeOperations`
(`author.ts:375`) and `operationSchema` (`author.ts:74`) are module-local.

**`parameters` beside `set`** (`author.ts:79`, `:109-111`) — and accepting both is safe **because**
`set` is `.strict()` (`:107`), so `set: {parameters: …}` is currently a refusal, not a silent strip.
There is no existing behaviour to collide with.

## 3. Scope

- Document the convention as **snake_case in, camelCase out** — and make it true. Accept snake-case
  aliases for the 98 camelCase inputs in `backendTools.ts` for a release.
- Add `plan_id` alongside `planId` on the `create_plan` response.
- 🔴 **Fix the round-trip pair first** (`visual_roots`/`visualRoots`, `allow_unknown_types`). It is
  the only one of these that corrupts a working client rather than failing loudly.
- Operation ids: assign **after** the sort so ids match the returned order, **or** add
  `submittedIndex` and one sentence to the note. Prefer the latter if anyone may already be
  index-staging.
- Accept granular `operations` in `stage_plan_operation`, reusing `applyOperations` unchanged; export
  `normalizeOperations` and `operationSchema`, or move them to `graph.ts`. Creates still need a full
  graph — no baseline exists — and the description must say so.
- Accept `parameters` inside `set` as well as beside it; refuse if both name the same key.

## 4. Acceptance criteria

1. **(person)** A client feeds a `create_plan` response straight into `stage_plan_operation` and
   `apply_plan` without renaming a field, and stages a single changed parameter **without** sending
   the node list.
2. A spec asserts every input alias resolves to the same behaviour as its original, enumerated —
   not spot-checked. An alias table with one untested entry is an alias table with one bug.
3. Returned operation ids and returned order agree, asserted on a submission that deliberately mixes
   kinds with an update first. Reverted arm: restore index-assignment-before-sort and it disagrees.
4. `stage_plan_operation` with `operations` and with a full graph produce an **identical** component
   on disk, from the same starting baseline. Same-output is the only assertion that proves the new
   door is the same door.
5. A create through `stage_plan_operation` with `operations` and no graph is **refused with a
   sentence naming why**, not accepted into a broken state.
6. Nothing removed. Every old spelling still works, asserted, because removal is what needs a release
   boundary and this task is not taking one.

## 5. Traps

- 🔴 **Additive is not breaking; removal is.** Adding `plan_id` beside `planId`, and aliases beside
  inputs, needs no release boundary. **Deleting** either does, and so does *moving* `parameters`
  under `set`. Do not do the removals in this task.
- 🔴 **Renumbering operation ids is a behaviour change for anyone already keying by index** — which
  is precisely what the reporter did before switching to `target`. Choose deliberately and say so in
  the note.
- ⚠️ Do not "fix" consistency by making responses snake_case. Responses are uniformly camelCase
  today; changing them breaks every existing client to satisfy a symmetry nobody asked for.
- ⚠️ `set` being `.strict()` is what makes accepting `set.parameters` safe. If anyone relaxes that
  strictness later, this becomes a silent-strip bug.
