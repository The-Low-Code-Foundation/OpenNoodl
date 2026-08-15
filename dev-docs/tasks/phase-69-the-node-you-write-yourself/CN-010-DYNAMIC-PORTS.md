# CN-010 — Dynamic ports

| Field | Value |
|---|---|
| **Tier** | 4 |
| **Effort** | M |
| **Surface** | `runtime`, `docs`, `editor` (validation interaction) |
| **Rulings** | — |
| **Depends on** | CN-003, CN-004 (this task changes what "fully checked" means), CN-005 |

## Why this is the flexibility task

A node with fixed ports is a widget. A node whose **ports come from its data** is a building block —
it is the difference between "a chip" and "a row that adapts to whatever record you feed it". The
built-in library leans on this heavily: `Function`'s `in-`/`out-` ports are mined from the script
text, `Object`/`Set Object Properties` build `prop-<name>` ports from a `properties` list, and
`For Each`'s template drives what an instance exposes.

`ReactNodeDefinition` already carries `dynamicports`, and `nodelibraryexport.ts` already knows both
forms — the editor-format entries (`ports`/`template`/`port`/`channelPort`) and the name-list form
(`inputs`/`outputs`) that `formatDynamicPorts` expands against the node's own port metadata. **None
of it is documented for a kit author**, and this phase's proof did not exercise it.

## Establish behaviour before specifying it

⚠️ **Build a kit that uses `dynamicports` before writing the rest of this spec.** The mechanism is
inherited and the repo's record on inherited-but-unexercised mechanisms is poor —
`0 of 29 shipped modules have ever been run`. Specifically unknown today:

- whether a kit's `dynamicports` survive `sendNodeLibrary` into the editor's property panel intact;
- whether the **conditional** forms (`condition`, `parentPort`) work from a module;
- what the editor does when a kit's dynamic ports change while nodes using them exist on canvas.

## The validation interaction, which is the real design work

CN-004 deliberately preserved the dynamic-port carve-out: a node with dynamic ports keeps its
unknown-parameter check skipped, because those ports are real and the catalog cannot see them
statically. SUB-006 already reasoned this through for `PageInputs.pathParams`, and the rule it
landed on is the one to honour:

> **A dynamic node's *static* ports are as static as anyone's.** Parameters naming a
> statically-declared port are still checked; only the dynamic surface is exempt.

So the question this task must answer is: **can the overlay resolve a kit's dynamic ports well
enough to check them, or do they stay exempt?** Both answers are acceptable; what is not acceptable
is leaving it implicit. If they stay exempt, CN-002's `info` diagnostic must say so for those ports
— the user should know which half of the node was verified.

## Acceptance criteria

1. A kit node declaring `dynamicports` shows the expected ports in the property panel and is
   connectable.
2. The static/dynamic split in validation is **explicit and documented**: static ports checked,
   dynamic ports either checked or reported as skipped, never silently ignored.
3. `get_node_type` reports the dynamic-port mechanism the way it does for `Function` and `Object`,
   so an agent knows the port list is not exhaustive. The catalog already has a `dynamicPorts`
   descriptor shape with `mechanisms` and `declaredPortGroups` — reuse it.
4. Documented in CN-007 with a worked example.

## Traps

- 🔴 **`hasType()` passing is not the match succeeding** — 103 recorded divergences.
- ⚠️ **Function-node ports are `in-`/`out-` prefixed and the catalog does not say so.** Any doc or
  scaffold this task produces must use the real port names, or it joins the list of docs whose
  examples lie.
